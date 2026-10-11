import crypto from 'crypto';
import { Agent, BedrockModel } from '@strands-agents/sdk';
import { OpenAIModel } from '@strands-agents/sdk/models/openai';
import { readBedrockConfig } from '../ai/bedrockConfig.js';
import { buildBedrockClientConfig, buildOpenAIClientConfig } from '../ai/bedrockService.js';
import { AIServiceError, classifyBedrockError } from '../ai/aiErrors.js';
import { buildCopilotTools } from './copilotTools.js';

const MAX_HISTORY_MESSAGES = 12;

export const COPILOT_SYSTEM_PROMPT = `You are the RuraLens Copilot for government officials, field workers, and citizens reviewing rural and urban infrastructure and public schemes.

Grounding rules:
- Answer only from tool results in this conversation. If a tool returns no data or an error, say what is missing. Never guess numbers, names, dates, or outcomes.
- Label every fact by its kind: "observed" scheme records, "prediction" from the failure model, "synthetic demonstration" or "user-added" assets, or "missing". Synthetic and user-added assets are not real infrastructure; say so when you mention them.
- When a prediction's modelSource is "js-fallback", say it came from the rule-based fallback, not the trained GNN.
- Vendor-report findings are items flagged for official review, not proof of fraud or wrongdoing. Report their review status.
- You cannot run simulations on the map or change any data. To show a scenario on the map, call propose_map_simulation; the user confirms it in the interface.
- Weather and air-quality data are not available to you.
- Keep answers short and plain: a direct answer first, then supporting facts. Do not include raw ids unless the user asks.`;

export function toAgentHistory(messages) {
  const trimmed = messages.slice(-MAX_HISTORY_MESSAGES);
  const history = [];
  for (const message of trimmed) {
    const last = history[history.length - 1];
    if (!last && message.role !== 'user') continue;
    if (last && last.role === message.role) {
      last.content[0].text += `\n\n${message.content}`;
    } else {
      history.push({ role: message.role, content: [{ text: message.content }] });
    }
  }
  return history;
}

function textOf(message) {
  return (message?.content ?? [])
    .map((block) => (typeof block?.text === 'string' ? block.text : ''))
    .join('')
    .trim();
}

function dedupeSources(sources) {
  const seen = new Map();
  for (const source of sources) seen.set(source.id, { ...seen.get(source.id), ...source });
  return [...seen.values()].slice(0, 20);
}

export function createBedrockModel(config) {
  if (config.api === 'openai') {
    const { apiKey, baseURL, timeout, maxRetries } = buildOpenAIClientConfig(config);
    return new OpenAIModel({
      api: 'chat',
      modelId: config.modelId,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      apiKey,
      clientConfig: { baseURL, timeout, maxRetries },
    });
  }
  return new BedrockModel({
    modelId: config.modelId,
    region: config.region,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    stream: false,
    clientConfig: buildBedrockClientConfig(config),
  });
}

/**
 * Runs one Copilot turn. `messages` is the conversation so far (the last entry
 * is the user's new question). Returns the answer with the sources, proposals,
 * and tool calls recorded by the tools themselves, so citations and map
 * actions are never taken from model text.
 */
export async function runCopilotTurn({ user, messages, twin, deps, config = readBedrockConfig(), createModel = createBedrockModel }) {
  if (!config.enabled) {
    throw new AIServiceError('not_configured', `The AI Copilot is not configured: ${config.errors.join(' ')}`, { httpStatus: 503 });
  }
  const history = toAgentHistory(messages);
  const question = history.pop();
  if (!question || question.role !== 'user') {
    throw new AIServiceError('invalid_request', 'The last message must be a question from the user.', { httpStatus: 400 });
  }

  const collector = { sources: [], proposals: [], calls: [], graphSynced: false };
  const agent = new Agent({
    model: createModel(config),
    systemPrompt: COPILOT_SYSTEM_PROMPT,
    messages: history,
    tools: buildCopilotTools({ user, twin, deps, collector }),
    printer: false,
    retryStrategy: null,
    toolExecutor: 'sequential',
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    agent.cancel();
  }, config.timeoutMs * 3);

  let result;
  try {
    result = await agent.invoke(question.content[0].text);
  } catch (error) {
    if (timedOut) throw classifyBedrockError({ name: 'TimeoutError' }, config);
    throw classifyBedrockError(error, config);
  } finally {
    clearTimeout(timer);
  }
  if (timedOut || result.stopReason === 'cancelled') {
    throw classifyBedrockError({ name: 'TimeoutError' }, config);
  }

  const answer = textOf(result.lastMessage);
  if (!answer) {
    throw new AIServiceError('malformed_output', 'The AI Copilot returned an empty answer.', { retryable: true, httpStatus: 502 });
  }

  return {
    answer,
    truncated: result.stopReason === 'maxTokens' || result.stopReason === 'max_tokens',
    sources: dedupeSources(collector.sources),
    proposals: collector.proposals,
    toolCalls: collector.calls,
    model: { provider: 'amazon-bedrock', modelId: config.modelId },
    generatedAt: new Date().toISOString(),
    traceId: crypto.randomUUID(),
  };
}

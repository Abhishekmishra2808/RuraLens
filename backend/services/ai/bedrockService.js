import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import OpenAI from 'openai';
import { z } from 'zod';
import { readBedrockConfig } from './bedrockConfig.js';
import { AIServiceError, classifyBedrockError } from './aiErrors.js';

/**
 * Client settings shared by the structured-output service and the Strands
 * BedrockModel. The SDK's standard retry mode retries throttling, 5xx and
 * timeout errors with exponential backoff and jitter, bounded by maxAttempts.
 */
export function buildBedrockClientConfig(config) {
  return {
    region: config.region,
    maxAttempts: config.maxAttempts,
    retryMode: 'standard',
    requestHandler: { requestTimeout: config.timeoutMs },
  };
}

/**
 * OpenAI SDK settings for Bedrock's OpenAI-compatible endpoint. The SDK retries
 * connection errors, 408, 409, 429 and 5xx with backoff; maxRetries excludes
 * the first attempt.
 */
export function buildOpenAIClientConfig(config) {
  return {
    apiKey: config.apiKey,
    baseURL: config.openaiBaseUrl,
    timeout: config.timeoutMs,
    maxRetries: config.maxAttempts - 1,
  };
}

export function toToolJsonSchema(schema) {
  const { $schema, ...json } = z.toJSONSchema(schema);
  return json;
}

function extractJsonFromText(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

function describeIssues(error) {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

function parseToolArguments(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return extractJsonFromText(raw);
  }
}

export function createBedrockService({ config = readBedrockConfig(), client, openaiClient } = {}) {
  let runtimeClient = client;
  let chatClient = openaiClient;
  const getRuntimeClient = () => {
    if (!runtimeClient) runtimeClient = new BedrockRuntimeClient(buildBedrockClientConfig(config));
    return runtimeClient;
  };
  const getChatClient = () => {
    if (!chatClient) chatClient = new OpenAI(buildOpenAIClientConfig(config));
    return chatClient;
  };

  function assertEnabled() {
    if (!config.enabled) {
      throw new AIServiceError('not_configured', `Amazon Bedrock is not configured: ${config.errors.join(' ')}`, {
        httpStatus: 503,
      });
    }
  }

  const overallSignal = () => AbortSignal.timeout(config.timeoutMs * config.maxAttempts + 5000);

  /** One forced-tool call through the Converse API, normalized to { truncated, input, text, usage }. */
  async function callConverse({ system, prompt, jsonSchema, toolName, toolDescription, maxTokens }) {
    const request = {
      modelId: config.modelId,
      system: [{ text: system }],
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens, temperature: config.temperature },
      toolConfig: {
        tools: [{ toolSpec: { name: toolName, description: toolDescription, inputSchema: { json: jsonSchema } } }],
        toolChoice: { tool: { name: toolName } },
      },
    };
    let response;
    try {
      response = await getRuntimeClient().send(new ConverseCommand(request), { abortSignal: overallSignal() });
    } catch (error) {
      throw classifyBedrockError(error, config);
    }
    const content = response?.output?.message?.content ?? [];
    return {
      truncated: response?.stopReason === 'max_tokens',
      input: content.find((block) => block?.toolUse?.name === toolName)?.toolUse?.input,
      text: content.map((block) => (typeof block?.text === 'string' ? block.text : '')).join('\n'),
      usage: response?.usage ?? null,
    };
  }

  /** The same call through the OpenAI-compatible Chat Completions endpoint. */
  async function callChatCompletions({ system, prompt, jsonSchema, toolName, toolDescription, maxTokens }) {
    const request = {
      model: config.modelId,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      tools: [{ type: 'function', function: { name: toolName, description: toolDescription, parameters: jsonSchema } }],
      tool_choice: { type: 'function', function: { name: toolName } },
      max_tokens: maxTokens,
      temperature: config.temperature,
    };
    let response;
    try {
      response = await getChatClient().chat.completions.create(request, { signal: overallSignal() });
    } catch (error) {
      throw classifyBedrockError(error, config);
    }
    const choice = response?.choices?.[0];
    const call = (choice?.message?.tool_calls ?? []).find((toolCall) => toolCall?.function?.name === toolName);
    const usage = response?.usage
      ? { inputTokens: response.usage.prompt_tokens, outputTokens: response.usage.completion_tokens, totalTokens: response.usage.total_tokens }
      : null;
    return {
      truncated: choice?.finish_reason === 'length',
      input: parseToolArguments(call?.function?.arguments),
      text: typeof choice?.message?.content === 'string' ? choice.message.content : '',
      usage,
    };
  }

  /**
   * Forces the model to answer through a single tool whose input schema is the
   * expected JSON shape, then validates it with zod. Retries once when the
   * output is malformed; never returns unvalidated data.
   */
  async function generateStructured({ system, prompt, schema, toolName, toolDescription, maxTokens, malformedRetries = 1 }) {
    assertEnabled();
    const call = config.api === 'openai' ? callChatCompletions : callConverse;
    const args = { system, prompt, jsonSchema: toToolJsonSchema(schema), toolName, toolDescription, maxTokens: maxTokens ?? config.maxTokens };

    let lastProblem = 'no structured output';
    for (let attempt = 0; attempt <= malformedRetries; attempt += 1) {
      const response = await call(args);
      if (response.truncated) {
        lastProblem = 'the response was cut off at the token limit';
        continue;
      }
      const candidate = response.input ?? extractJsonFromText(response.text);
      if (candidate === undefined) {
        lastProblem = 'the model did not return the structured result';
        continue;
      }
      const parsed = schema.safeParse(candidate);
      if (parsed.success) {
        return { data: parsed.data, modelId: config.modelId, usage: response.usage };
      }
      lastProblem = `the result did not match the expected schema (${describeIssues(parsed.error)})`;
    }
    throw new AIServiceError('malformed_output', `The AI response could not be used: ${lastProblem}.`, {
      retryable: true,
      httpStatus: 502,
    });
  }

  return {
    config,
    get enabled() {
      return config.enabled;
    },
    assertEnabled,
    generateStructured,
  };
}

let sharedService;
export function getBedrockService() {
  if (!sharedService) sharedService = createBedrockService();
  return sharedService;
}

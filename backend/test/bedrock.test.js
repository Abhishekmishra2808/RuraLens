import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { APIConnectionTimeoutError, APIError } from 'openai';
import { readBedrockConfig, describeCredentialSources, logBedrockStartupStatus } from '../services/ai/bedrockConfig.js';
import { createBedrockService, buildBedrockClientConfig } from '../services/ai/bedrockService.js';
import { AIServiceError, classifyBedrockError } from '../services/ai/aiErrors.js';

const VALID_ENV = { AWS_REGION: 'us-east-1', BEDROCK_MODEL_ID: 'amazon.nova-lite-v1:0' };

test('config: missing region and model id disable Bedrock with actionable errors', () => {
  const config = readBedrockConfig({});
  assert.equal(config.enabled, false);
  assert.match(config.errors.join(' '), /AWS_REGION is not set/);
  assert.match(config.errors.join(' '), /BEDROCK_MODEL_ID is not set/);
});

test('config: invalid region and out-of-range numbers are rejected', () => {
  const config = readBedrockConfig({ ...VALID_ENV, AWS_REGION: 'mars', BEDROCK_MAX_ATTEMPTS: '9', BEDROCK_TEMPERATURE: '3' });
  assert.equal(config.enabled, false);
  assert.equal(config.errors.length, 3);
  assert.equal(config.maxAttempts, 3, 'falls back to the default');
});

test('config: valid environment enables Bedrock with defaults', () => {
  const config = readBedrockConfig(VALID_ENV);
  assert.equal(config.enabled, true);
  assert.deepEqual(
    { region: config.region, modelId: config.modelId, maxAttempts: config.maxAttempts, timeoutMs: config.timeoutMs },
    { region: 'us-east-1', modelId: 'amazon.nova-lite-v1:0', maxAttempts: 3, timeoutMs: 30000 },
  );
  assert.deepEqual(buildBedrockClientConfig(config), {
    region: 'us-east-1',
    maxAttempts: 3,
    retryMode: 'standard',
    requestHandler: { requestTimeout: 30000 },
  });
});

test('config: Bedrock API key is reported by name, and an empty one is a config error', () => {
  const env = { ...VALID_ENV, AWS_BEARER_TOKEN_BEDROCK: 'ABSKsecretvalue' };
  assert.equal(readBedrockConfig(env).enabled, true);
  const sources = describeCredentialSources(env);
  assert.match(sources.join(' '), /AWS_BEARER_TOKEN_BEDROCK/);
  assert.doesNotMatch(sources.join(' '), /ABSKsecretvalue/);

  const empty = readBedrockConfig({ ...VALID_ENV, AWS_BEARER_TOKEN_BEDROCK: '' });
  assert.equal(empty.enabled, false);
  assert.match(empty.errors.join(' '), /AWS_BEARER_TOKEN_BEDROCK is set but empty/);
});

test('config: credential reporting and startup logs never include secret values', () => {
  const env = { ...VALID_ENV, AWS_ACCESS_KEY_ID: 'AKIAEXAMPLEKEY', AWS_SECRET_ACCESS_KEY: 'super-secret-value' };
  assert.deepEqual(describeCredentialSources(env), ['environment access keys']);
  const lines = [];
  const logger = { log: (m) => lines.push(m), warn: (m) => lines.push(m) };
  logBedrockStartupStatus(readBedrockConfig(env), env, logger);
  const output = lines.join('\n');
  assert.doesNotMatch(output, /AKIAEXAMPLEKEY|super-secret-value/);
  assert.match(output, /Enabled: model amazon\.nova-lite-v1:0 in us-east-1/);
});

const schema = z.object({ answer: z.string(), score: z.number().min(0).max(1) });
const toolResponse = (input, stopReason = 'tool_use') => ({
  stopReason,
  output: { message: { role: 'assistant', content: [{ toolUse: { toolUseId: 't1', name: 'record', input } }] } },
});

function mockClient(responses) {
  const calls = [];
  return {
    calls,
    async send(command) {
      calls.push(command.input);
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

const structured = (service) =>
  service.generateStructured({ system: 'sys', prompt: 'p', schema, toolName: 'record', toolDescription: 'Record it' });

test('structured output: forces the tool and validates the result', async () => {
  const client = mockClient([toolResponse({ answer: 'ok', score: 0.5 })]);
  const service = createBedrockService({ config: readBedrockConfig(VALID_ENV), client });
  const result = await structured(service);
  assert.deepEqual(result.data, { answer: 'ok', score: 0.5 });
  const request = client.calls[0];
  assert.equal(request.modelId, 'amazon.nova-lite-v1:0');
  assert.deepEqual(request.toolConfig.toolChoice, { tool: { name: 'record' } });
  assert.equal(request.toolConfig.tools[0].toolSpec.inputSchema.json.type, 'object');
  assert.equal('$schema' in request.toolConfig.tools[0].toolSpec.inputSchema.json, false);
});

test('structured output: retries once on malformed output, then succeeds', async () => {
  const client = mockClient([toolResponse({ answer: 'ok', score: 7 }), toolResponse({ answer: 'ok', score: 1 })]);
  const service = createBedrockService({ config: readBedrockConfig(VALID_ENV), client });
  const result = await structured(service);
  assert.equal(result.data.score, 1);
  assert.equal(client.calls.length, 2);
});

test('structured output: persistent malformed or truncated output raises malformed_output', async () => {
  const client = mockClient([
    toolResponse({ answer: 'ok', score: 7 }),
    { stopReason: 'max_tokens', output: { message: { content: [{ text: '{"answer":' }] } } },
  ]);
  const service = createBedrockService({ config: readBedrockConfig(VALID_ENV), client });
  await assert.rejects(structured(service), (error) => error instanceof AIServiceError && error.code === 'malformed_output');
});

test('structured output: unconfigured service fails without calling AWS', async () => {
  const client = mockClient([]);
  const service = createBedrockService({ config: readBedrockConfig({}), client });
  await assert.rejects(structured(service), (error) => error.code === 'not_configured' && error.httpStatus === 503);
  assert.equal(client.calls.length, 0);
});

test('structured output: AWS errors are mapped to safe, actionable errors', async () => {
  const throttled = Object.assign(new Error('Rate exceeded'), { name: 'ThrottlingException' });
  const service = createBedrockService({ config: readBedrockConfig(VALID_ENV), client: mockClient([throttled]) });
  await assert.rejects(structured(service), (error) => error.code === 'throttled' && error.retryable && error.httpStatus === 429);

  const denied = classifyBedrockError(Object.assign(new Error('no'), { name: 'AccessDeniedException' }), { modelId: 'm', region: 'r' });
  assert.equal(denied.code, 'access_denied');
  assert.match(denied.message, /bedrock:InvokeModel/);
  assert.equal(classifyBedrockError({ name: 'ResourceNotFoundException' }).code, 'model_not_found');
  assert.equal(classifyBedrockError({ name: 'CredentialsProviderError' }).code, 'credentials_unavailable');
  assert.equal(classifyBedrockError({ name: 'ModelTimeoutException' }).retryable, true);
  assert.equal(classifyBedrockError({ name: 'ValidationException', message: 'bad' }).retryable, false);
  const restricted = classifyBedrockError({ name: 'ValidationException', message: 'Operation not allowed' });
  assert.equal(restricted.code, 'account_restricted');
  assert.match(restricted.message, /AWS Support/);
});

const OPENAI_ENV = { AWS_REGION: 'us-east-1', BEDROCK_MODEL_ID: 'openai.gpt-oss-120b', BEDROCK_API: 'openai', AWS_BEARER_TOKEN_BEDROCK: 'ABSKsecretvalue' };

test('config: OpenAI-compatible mode needs an API key and only accepts AWS endpoints', () => {
  const config = readBedrockConfig(OPENAI_ENV);
  assert.equal(config.enabled, true);
  assert.equal(config.api, 'openai');
  assert.equal(config.openaiBaseUrl, 'https://bedrock-mantle.us-east-1.api.aws/v1');
  assert.equal(config.apiKey, 'ABSKsecretvalue');
  assert.doesNotMatch(JSON.stringify(config), /ABSKsecretvalue/, 'the key is not serialized');
  assert.doesNotMatch(JSON.stringify({ ...config }), /ABSKsecretvalue/, 'the key is not copied by spreads');

  const lines = [];
  logBedrockStartupStatus(config, OPENAI_ENV, { log: (m) => lines.push(m), warn: (m) => lines.push(m) });
  assert.doesNotMatch(lines.join('\n'), /ABSKsecretvalue/);
  assert.match(lines.join('\n'), /OpenAI-compatible endpoint/);

  const { AWS_BEARER_TOKEN_BEDROCK, ...withoutKey } = OPENAI_ENV;
  assert.match(readBedrockConfig(withoutKey).errors.join(' '), /requires a Bedrock API key/);
  assert.match(readBedrockConfig({ ...OPENAI_ENV, BEDROCK_API: 'grpc' }).errors.join(' '), /BEDROCK_API must be one of/);
  assert.equal(readBedrockConfig({ ...OPENAI_ENV, BEDROCK_OPENAI_BASE_URL: 'https://evil.example.com/v1' }).enabled, false);
  assert.equal(
    readBedrockConfig({ ...OPENAI_ENV, BEDROCK_OPENAI_BASE_URL: 'https://bedrock-mantle.us-east-1.api.aws/openai/v1' }).openaiBaseUrl,
    'https://bedrock-mantle.us-east-1.api.aws/openai/v1',
  );
});

function mockOpenAIClient(responses) {
  const calls = [];
  return {
    calls,
    chat: {
      completions: {
        async create(request) {
          calls.push(request);
          const next = responses.shift();
          if (next instanceof Error) throw next;
          return next;
        },
      },
    },
  };
}

const chatToolResponse = (args, finish = 'tool_calls') => ({
  choices: [{ finish_reason: finish, message: { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'record', arguments: JSON.stringify(args) } }] } }],
  usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
});

test('structured output (OpenAI-compatible): forces the function, validates, and retries malformed output', async () => {
  const openaiClient = mockOpenAIClient([chatToolResponse({ answer: 'ok', score: 9 }), chatToolResponse({ answer: 'ok', score: 0.4 })]);
  const service = createBedrockService({ config: readBedrockConfig(OPENAI_ENV), openaiClient });
  const result = await structured(service);
  assert.deepEqual(result.data, { answer: 'ok', score: 0.4 });
  assert.deepEqual(result.usage, { inputTokens: 12, outputTokens: 4, totalTokens: 16 });
  const request = openaiClient.calls[0];
  assert.equal(request.model, 'openai.gpt-oss-120b');
  assert.deepEqual(request.tool_choice, { type: 'function', function: { name: 'record' } });
  assert.equal(request.tools[0].function.parameters.type, 'object');
  assert.equal(openaiClient.calls.length, 2);

  const truncated = createBedrockService({
    config: readBedrockConfig(OPENAI_ENV),
    openaiClient: mockOpenAIClient([chatToolResponse({}, 'length'), chatToolResponse({}, 'length')]),
  });
  await assert.rejects(structured(truncated), (error) => error.code === 'malformed_output' && /token limit/.test(error.message));
});

test('errors (OpenAI-compatible): HTTP statuses map to the same codes as the Converse API', async () => {
  const apiError = (status, message) => APIError.generate(status, { error: { message } }, undefined, new Headers());
  const ctx = { modelId: 'openai.gpt-oss-120b', region: 'us-east-1' };
  assert.equal(classifyBedrockError(apiError(401, 'bad key'), ctx).code, 'credentials_unavailable');
  assert.equal(classifyBedrockError(apiError(403, 'denied'), ctx).code, 'access_denied');
  assert.equal(classifyBedrockError(apiError(404, 'missing'), ctx).code, 'model_not_found');
  assert.equal(classifyBedrockError(apiError(429, 'slow down'), ctx).code, 'throttled');
  assert.equal(classifyBedrockError(apiError(503, 'down'), ctx).code, 'unavailable');
  assert.equal(classifyBedrockError(apiError(400, 'Operation not allowed'), ctx).code, 'account_restricted');
  const plainText = APIError.generate(400, undefined, 'Operation not allowed', new Headers());
  assert.equal(classifyBedrockError(plainText, ctx).code, 'account_restricted', 'plain-text error bodies');
  const unsupported = classifyBedrockError(apiError(400, "The model 'x' does not support the '/v1/chat/completions' API"), ctx);
  assert.equal(unsupported.code, 'invalid_request');
  assert.match(unsupported.message, /gpt-oss-120b/);
  assert.equal(classifyBedrockError(new APIConnectionTimeoutError(), ctx).code, 'timeout');
  assert.equal(classifyBedrockError(Object.assign(new Error('wrapped'), { cause: apiError(429, 'x') }), ctx).code, 'throttled');

  const service = createBedrockService({ config: readBedrockConfig(OPENAI_ENV), openaiClient: mockOpenAIClient([apiError(401, 'bad key')]) });
  await assert.rejects(structured(service), (error) => error.code === 'credentials_unavailable' && !/ABSK/.test(error.message));
});

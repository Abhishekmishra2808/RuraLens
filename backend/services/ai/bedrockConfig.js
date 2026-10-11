/**
 * Reads Amazon Bedrock settings from the environment. Credentials are never
 * read here: the AWS SDK resolves them through its default provider chain
 * (environment variables, shared config/credentials files, SSO, or an
 * attached role).
 */

const REGION_PATTERN = /^[a-z]{2}(-gov)?-[a-z]+-\d+$/;

/** `converse`: Bedrock Runtime Converse API. `openai`: Bedrock's OpenAI-compatible Chat Completions endpoint. */
const API_MODES = ['converse', 'openai'];

// Restricted to AWS hosts so a misconfigured URL cannot send the API key elsewhere.
const OPENAI_BASE_URL_PATTERN = /^https:\/\/bedrock-(mantle|runtime)\.[a-z]{2}(-gov)?-[a-z]+-\d+\.(api\.aws|amazonaws\.com)\/(openai\/)?v1\/?$/;

const LIMITS = {
  maxTokens: { env: 'BEDROCK_MAX_TOKENS', fallback: 2048, min: 256, max: 8192 },
  timeoutMs: { env: 'BEDROCK_TIMEOUT_MS', fallback: 30000, min: 2000, max: 120000 },
  maxAttempts: { env: 'BEDROCK_MAX_ATTEMPTS', fallback: 3, min: 1, max: 5 },
};

function readInt(env, { env: key, fallback, min, max }, errors) {
  const raw = env[key];
  if (raw === undefined || String(raw).trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${key} must be an integer between ${min} and ${max} (got "${raw}").`);
    return fallback;
  }
  return value;
}

function readTemperature(env, errors) {
  const raw = env.BEDROCK_TEMPERATURE;
  if (raw === undefined || String(raw).trim() === '') return 0.2;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    errors.push(`BEDROCK_TEMPERATURE must be a number between 0 and 1 (got "${raw}").`);
    return 0.2;
  }
  return value;
}

export function readBedrockConfig(env = process.env) {
  const errors = [];
  const region = String(env.AWS_REGION || '').trim();
  const modelId = String(env.BEDROCK_MODEL_ID || '').trim();

  if (!region) {
    errors.push('AWS_REGION is not set. Set it to the AWS Region where Bedrock model access is enabled (for example us-east-1).');
  } else if (!REGION_PATTERN.test(region)) {
    errors.push(`AWS_REGION "${region}" is not a valid AWS Region code (for example us-east-1).`);
  }
  if (!modelId) {
    errors.push('BEDROCK_MODEL_ID is not set. Set it to a Bedrock model ID or inference profile ID that supports tool use (see docs/BEDROCK.md).');
  }
  // The AWS SDK switches to bearer auth whenever this variable exists, even when it is empty.
  const apiKey = String(env.AWS_BEARER_TOKEN_BEDROCK ?? '').trim();
  if ('AWS_BEARER_TOKEN_BEDROCK' in env && !apiKey) {
    errors.push('AWS_BEARER_TOKEN_BEDROCK is set but empty. Paste the Bedrock API key or remove the variable.');
  }

  const api = String(env.BEDROCK_API || 'converse').trim().toLowerCase();
  let openaiBaseUrl = null;
  if (!API_MODES.includes(api)) {
    errors.push(`BEDROCK_API must be one of ${API_MODES.join(', ')} (got "${env.BEDROCK_API}").`);
  } else if (api === 'openai') {
    if (!apiKey) {
      errors.push('BEDROCK_API=openai requires a Bedrock API key in AWS_BEARER_TOKEN_BEDROCK.');
    }
    const override = String(env.BEDROCK_OPENAI_BASE_URL || '').trim();
    if (override) {
      if (OPENAI_BASE_URL_PATTERN.test(override)) openaiBaseUrl = override.replace(/\/$/, '');
      else errors.push(`BEDROCK_OPENAI_BASE_URL must be an Amazon Bedrock endpoint such as https://bedrock-mantle.us-east-1.api.aws/v1 (got "${override}").`);
    } else if (REGION_PATTERN.test(region)) {
      openaiBaseUrl = `https://bedrock-mantle.${region}.api.aws/v1`;
    }
  }

  const config = {
    api,
    region,
    modelId,
    openaiBaseUrl,
    maxTokens: readInt(env, LIMITS.maxTokens, errors),
    timeoutMs: readInt(env, LIMITS.timeoutMs, errors),
    maxAttempts: readInt(env, LIMITS.maxAttempts, errors),
    temperature: readTemperature(env, errors),
  };
  const result = { ...config, enabled: errors.length === 0, errors };
  // Non-enumerable so the key never appears when the config is logged, spread or serialized.
  Object.defineProperty(result, 'apiKey', { value: apiKey || null, enumerable: false });
  return result;
}

/** Human-readable name of the Bedrock API in use, for logs and status. */
export function describeBedrockApi(config) {
  return config.api === 'openai' ? `the OpenAI-compatible endpoint (${config.openaiBaseUrl})` : 'the Converse API';
}

/** Names (never values) of credential sources visible to the SDK chain. */
export function describeCredentialSources(env = process.env) {
  const sources = [];
  if (env.AWS_BEARER_TOKEN_BEDROCK) sources.push('Bedrock API key (AWS_BEARER_TOKEN_BEDROCK, takes precedence)');
  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) sources.push('environment access keys');
  if (env.AWS_PROFILE) sources.push('AWS_PROFILE');
  if (env.AWS_WEB_IDENTITY_TOKEN_FILE) sources.push('web identity token');
  if (env.AWS_CONTAINER_CREDENTIALS_FULL_URI || env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI) sources.push('container credentials');
  return sources;
}

export function logBedrockStartupStatus(config = readBedrockConfig(), env = process.env, logger = console) {
  if (!config.enabled) {
    logger.warn('[bedrock] AI Copilot and AI vendor-report comparison are disabled:');
    for (const error of config.errors) logger.warn(`[bedrock]   - ${error}`);
    logger.warn('[bedrock] Deterministic vendor-report checks and GNN predictions still work.');
    return;
  }
  logger.log(`[bedrock] Enabled: model ${config.modelId} in ${config.region} via ${describeBedrockApi(config)}.`);
  if (config.api === 'openai') {
    logger.log('[bedrock] Authenticating with the Bedrock API key in AWS_BEARER_TOKEN_BEDROCK.');
    return;
  }
  const sources = describeCredentialSources(env);
  logger.log(
    sources.length
      ? `[bedrock] Credential sources detected: ${sources.join(', ')}.`
      : '[bedrock] No credential environment variables detected; the AWS SDK will try shared config files or an attached role on first use.',
  );
}

import { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError } from 'openai';

/**
 * Provider-neutral AI error. `message` is safe to show to users: it never
 * includes credentials, request bodies, or document text.
 */
export class AIServiceError extends Error {
  constructor(code, message, { retryable = false, httpStatus = 502, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'AIServiceError';
    this.code = code;
    this.retryable = retryable;
    this.httpStatus = httpStatus;
  }

  toJSON() {
    return { code: this.code, message: this.message, retryable: this.retryable };
  }
}

/** Sends a JSON error for AI failures; logs the code and error name only. */
export function sendAIError(res, error, context, extra = {}) {
  const aiError = error instanceof AIServiceError ? error : classifyBedrockError(error);
  console.warn(`[ai] ${context} failed: ${aiError.code}${aiError.cause?.name ? ` (${aiError.cause.name})` : ''}`);
  return res.status(aiError.httpStatus).json({
    error: aiError.message,
    code: aiError.code,
    retryable: aiError.retryable,
    ...extra,
  });
}

const CREDENTIAL_ERRORS = new Set([
  'CredentialsProviderError',
  'UnrecognizedClientException',
  'InvalidSignatureException',
  'ExpiredTokenException',
  'InvalidClientTokenId',
]);

const KNOWN_ERRORS = new Set([
  ...CREDENTIAL_ERRORS,
  'ThrottlingException',
  'ModelThrottledError',
  'ServiceQuotaExceededException',
  'ServiceUnavailableException',
  'InternalServerException',
  'ModelNotReadyException',
  'ModelTimeoutException',
  'TimeoutError',
  'AbortError',
  'RequestTimeout',
  'AccessDeniedException',
  'ResourceNotFoundException',
  'ValidationException',
  'ContextWindowOverflowError',
  'ModelErrorException',
]);

function shortMessage(error) {
  return String(error?.message || '').replace(/\s+/g, ' ').slice(0, 200);
}

/** Strands wraps provider errors (e.g. ModelError -> AccessDeniedException); find the meaningful one. */
function rootKnownError(error) {
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (KNOWN_ERRORS.has(current.name)) return current;
    current = current.cause;
  }
  return error;
}

/** OpenAI SDK errors are only identifiable by class; their `name` is the generic "Error". */
function rootOpenAIError(error) {
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current instanceof APIError) return current;
    current = current.cause;
  }
  return undefined;
}

/** Errors from Bedrock's OpenAI-compatible endpoint, mapped onto the same codes as the Converse API. */
function classifyOpenAIError(error, modelId, region) {
  if (error instanceof APIUserAbortError || error instanceof APIConnectionTimeoutError) return { name: 'TimeoutError' };
  if (error instanceof APIConnectionError) return { name: 'ServiceUnavailableException' };
  // `error.message` is prefixed with the status code; the server's own text is in the body.
  const message = shortMessage({ message: error.error?.message ?? String(error.message || '').replace(/^\d{3}\s+/, '') });
  switch (error.status) {
    case 401:
      return new AIServiceError(
        'credentials_unavailable',
        'Bedrock rejected the API key in AWS_BEARER_TOKEN_BEDROCK. It may be wrong, revoked or expired.',
        { httpStatus: 503, cause: error },
      );
    case 403:
      return new AIServiceError(
        'access_denied',
        `Bedrock denied access to ${modelId} in ${region}. Check that the API key's IAM identity may use this model.`,
        { httpStatus: 503, cause: error },
      );
    case 404:
      return { name: 'ResourceNotFoundException' };
    case 408:
      return { name: 'TimeoutError' };
    case 429:
      return { name: 'ThrottlingException' };
    case 400:
    case 422:
      if (/does not support the/i.test(message)) {
        return new AIServiceError(
          'invalid_request',
          `Model ${modelId} is not available through the OpenAI-compatible Chat Completions endpoint. Choose a model listed for it, such as openai.gpt-oss-120b.`,
          { httpStatus: 502, cause: error },
        );
      }
      return { name: 'ValidationException', message };
    default:
      return error.status >= 500 ? { name: 'ServiceUnavailableException' } : undefined;
  }
}

/** Maps AWS SDK / OpenAI SDK / Strands errors onto AIServiceError codes with actionable messages. */
export function classifyBedrockError(rawError, { modelId = 'the configured model', region = 'the configured region' } = {}) {
  if (rawError instanceof AIServiceError) return rawError;
  let error = rootKnownError(rawError);
  if (!KNOWN_ERRORS.has(error?.name)) {
    const openaiError = rootOpenAIError(rawError);
    const mapped = openaiError && classifyOpenAIError(openaiError, modelId, region);
    if (mapped instanceof AIServiceError) return mapped;
    if (mapped) error = Object.assign(mapped, { cause: openaiError });
  }
  const name = error?.name || '';

  if (CREDENTIAL_ERRORS.has(name)) {
    return new AIServiceError(
      'credentials_unavailable',
      'AWS credentials are missing, invalid, or expired. Configure credentials for the backend through the AWS SDK credential chain.',
      { httpStatus: 503, cause: error },
    );
  }
  switch (name) {
    case 'ThrottlingException':
    case 'ModelThrottledError':
    case 'ServiceQuotaExceededException':
      return new AIServiceError('throttled', 'Amazon Bedrock is throttling requests. Wait a moment and try again.', {
        retryable: true,
        httpStatus: 429,
        cause: error,
      });
    case 'ServiceUnavailableException':
    case 'InternalServerException':
    case 'ModelNotReadyException':
      return new AIServiceError('unavailable', 'Amazon Bedrock is temporarily unavailable. Try again shortly.', {
        retryable: true,
        httpStatus: 503,
        cause: error,
      });
    case 'ModelTimeoutException':
    case 'TimeoutError':
    case 'AbortError':
    case 'RequestTimeout':
      return new AIServiceError('timeout', 'The AI request timed out. Try again with a shorter question or document.', {
        retryable: true,
        httpStatus: 504,
        cause: error,
      });
    case 'AccessDeniedException':
      return new AIServiceError(
        'access_denied',
        `Bedrock denied access to ${modelId} in ${region}. Enable model access in the Bedrock console and allow bedrock:InvokeModel for this model in the backend's IAM policy.`,
        { httpStatus: 503, cause: error },
      );
    case 'ResourceNotFoundException':
      return new AIServiceError(
        'model_not_found',
        `Model ${modelId} was not found in ${region}. Check BEDROCK_MODEL_ID and that the model is offered in AWS_REGION.`,
        { httpStatus: 503, cause: error },
      );
    case 'ValidationException':
      if (/^operation not allowed\.?$/i.test(shortMessage(error).trim())) {
        return new AIServiceError(
          'account_restricted',
          'Your AWS account is not yet allowed to invoke Bedrock models ("Operation not allowed"). This is an account-level restriction that IAM cannot fix: confirm a payment method is on file and open an "Account and billing" case with AWS Support asking them to enable Bedrock model invocation.',
          { httpStatus: 503, cause: error },
        );
      }
      return new AIServiceError('invalid_request', `Bedrock rejected the request: ${shortMessage(error)}`, {
        httpStatus: 502,
        cause: error,
      });
    case 'ContextWindowOverflowError':
      return new AIServiceError('input_too_large', 'The request is too large for the model context window.', {
        httpStatus: 413,
        cause: error,
      });
    case 'ModelErrorException':
      return new AIServiceError('model_error', 'The model failed to process the request.', { httpStatus: 502, cause: error });
    default:
      return new AIServiceError('unknown', 'The AI request failed unexpectedly.', { httpStatus: 502, cause: error });
  }
}

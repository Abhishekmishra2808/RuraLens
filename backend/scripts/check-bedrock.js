/**
 * Sends one small structured request to the configured Bedrock model to
 * confirm region, model access, IAM permissions and forced tool choice.
 * Prints only the config status, model ID and error codes, never credentials.
 *
 * Usage: npm run check:bedrock
 */
import 'dotenv/config';
import { z } from 'zod';
import { logBedrockStartupStatus, readBedrockConfig } from '../services/ai/bedrockConfig.js';
import { createBedrockService } from '../services/ai/bedrockService.js';

const config = readBedrockConfig();
logBedrockStartupStatus(config);
if (!config.enabled) process.exit(1);

const service = createBedrockService({ config });
const started = Date.now();
try {
  const { data, modelId, usage } = await service.generateStructured({
    system: 'You are a connectivity check. Reply only through the provided tool.',
    prompt: 'Report status "ok".',
    schema: z.object({ status: z.string() }),
    toolName: 'report_status',
    toolDescription: 'Report the connectivity check status.',
    maxTokens: 256,
    malformedRetries: 0,
  });
  console.log(`[bedrock] Check passed in ${Date.now() - started} ms: model ${modelId} replied "${data.status}".`);
  if (usage) console.log(`[bedrock] Tokens used: ${usage.inputTokens ?? '?'} in, ${usage.outputTokens ?? '?'} out.`);
} catch (error) {
  console.error(`[bedrock] Check failed (${error.code ?? error.name}): ${error.message}`);
  process.exit(1);
}

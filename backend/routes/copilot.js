import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { readBedrockConfig } from '../services/ai/bedrockConfig.js';
import { sendAIError } from '../services/ai/aiErrors.js';
import { runCopilotTurn } from '../services/copilot/copilotService.js';
import { TWIN_ASSET_TYPES } from '../services/copilot/copilotTools.js';
import { defaultCopilotDeps } from '../services/copilot/copilotDeps.js';
import { sanitizePII } from '../utils/piiSanitizer.js';

const recordArray = z.array(z.record(z.string(), z.unknown())).max(2000);

export const copilotRequestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(20),
  twin: z
    .object({
      cityId: z.string().max(40).optional(),
      datasetId: z.string().max(80).optional(),
      assets: z
        .array(
          z.object({
            id: z.string().min(1).max(120),
            name: z.string().min(1).max(160),
            type: z.enum(TWIN_ASSET_TYPES),
            status: z.string().max(40).optional(),
            provenance: z.enum(['synthetic-demo', 'user-added', 'verified']),
          }),
        )
        .max(1000),
      infraState: z.object({
        waterTanks: recordArray.optional(),
        waterPumps: recordArray.optional(),
        waterPipes: recordArray.optional(),
        powerNodes: recordArray.optional(),
        buildings: recordArray.optional(),
        roads: recordArray.optional(),
        sensors: recordArray.optional(),
        pumps: recordArray.optional(),
        pipes: recordArray.optional(),
      }),
    })
    .optional(),
});

export function createCopilotRouter({ deps = defaultCopilotDeps, runTurn = runCopilotTurn, getConfig = readBedrockConfig } = {}) {
  const router = express.Router();

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.user.userId,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many Copilot questions. Try again in a minute.', code: 'rate_limited', retryable: true },
  });

  router.get('/status', requireAuth, (req, res) => {
    const config = getConfig();
    res.json({
      enabled: config.enabled,
      provider: 'amazon-bedrock',
      modelId: config.enabled ? config.modelId : null,
      region: config.enabled ? config.region : null,
      problems: req.user.role === 'admin' ? config.errors : undefined,
    });
  });

  router.post('/chat', requireAuth, limiter, async (req, res) => {
    const parsed = copilotRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid Copilot request.',
        code: 'invalid_request',
        issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`),
      });
    }
    const { messages, twin } = parsed.data;
    if (messages[messages.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'The last message must be a question from the user.', code: 'invalid_request' });
    }

    const started = Date.now();
    try {
      const result = await runTurn({
        user: req.user,
        messages: messages.map((m) => ({ role: m.role, content: sanitizePII(m.content) })),
        twin,
        deps,
        config: getConfig(),
      });
      console.log(
        `[copilot] user=${req.user.userId} role=${req.user.role} tools=${result.toolCalls.map((c) => c.name).join(',') || 'none'} ms=${Date.now() - started}`,
      );
      return res.json(result);
    } catch (error) {
      return sendAIError(res, error, 'copilot');
    }
  });

  return router;
}

export default createCopilotRouter();

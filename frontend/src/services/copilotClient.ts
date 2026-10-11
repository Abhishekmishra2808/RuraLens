/**
 * Client for the backend Copilot (Amazon Bedrock). The browser never calls
 * Bedrock directly; it sends the conversation and the active twin dataset to
 * the backend, which answers through typed, read-only tools. Map simulations
 * come back as proposals that the user confirms before anything runs.
 */
import { API_URL, authHeaders } from '../config/api';
import type { RawInfraState } from '../data/twinCities';
import type { FailureSeverity, TwinAsset, TwinAssetType } from '../types/twin';
import { toBackendInfraState } from './twinData';
import type { InterpretationContext, InterpretedScenario } from './scenarioInterpreter';

export interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CopilotSource {
  id: string;
  type: string;
  title?: string;
  snippet?: string;
  timestamp?: string | null;
}

export interface CopilotProposal {
  action: 'simulate-failure';
  targetAssetId: string;
  targetName: string;
  failureType: string;
  failureTypeLabel: string;
  severity: FailureSeverity;
  focusTypes: TwinAssetType[];
  rationale: string;
}

export interface CopilotReply {
  answer: string;
  truncated: boolean;
  sources: CopilotSource[];
  proposals: CopilotProposal[];
  toolCalls: Array<{ name: string; ok?: boolean }>;
  model: { provider: string; modelId: string };
  generatedAt: string;
  traceId: string;
}

export interface CopilotStatus {
  enabled: boolean;
  modelId: string | null;
  problems?: string[];
}

export class CopilotRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CopilotRequestError';
  }
}

const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 2000;

async function readError(response: Response): Promise<CopilotRequestError> {
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    return new CopilotRequestError('Sign in to use the AI Copilot.', 'auth_required', false, 401);
  }
  return new CopilotRequestError(
    body.error || `Copilot request failed (HTTP ${response.status}).`,
    body.code || 'http_error',
    Boolean(body.retryable),
    response.status,
  );
}

export async function fetchCopilotStatus(signal?: AbortSignal): Promise<CopilotStatus> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/copilot/status`, { headers: authHeaders(), signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new CopilotRequestError(`Backend unreachable at ${API_URL}.`, 'network', true, 0);
  }
  if (!response.ok) throw await readError(response);
  return response.json();
}

export function buildTwinContext(
  cityId: string,
  datasetId: string,
  assets: TwinAsset[],
  raw: RawInfraState | null,
) {
  return {
    cityId,
    datasetId,
    assets: assets.slice(0, 1000).map((a) => ({
      id: a.id,
      name: a.name.slice(0, 160),
      type: a.type,
      ...(a.rawStatus ? { status: a.rawStatus.slice(0, 40) } : {}),
      provenance: a.provenance,
    })),
    infraState: toBackendInfraState(raw ?? {}),
  };
}

export async function sendCopilotMessage(
  messages: CopilotMessage[],
  twin: ReturnType<typeof buildTwinContext> | undefined,
  signal?: AbortSignal,
): Promise<CopilotReply> {
  const trimmed = messages.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
  while (trimmed.length > 0 && trimmed[0].role !== 'user') trimmed.shift();

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/copilot/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ messages: trimmed, twin }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new CopilotRequestError(`Backend unreachable at ${API_URL}.`, 'network', true, 0);
  }
  if (!response.ok) throw await readError(response);
  return response.json();
}

/** Turns a backend proposal into the panel's typed scenario; it still has to pass `validateInterpretation`. */
export function proposalToInterpretation(proposal: CopilotProposal, ctx: InterpretationContext): InterpretedScenario {
  const target = ctx.assets.find((a) => a.id === proposal.targetAssetId) ?? null;
  return {
    status: target ? 'ready' : 'unsupported',
    action: 'simulate-failure',
    targetType: target?.type ?? null,
    candidateIds: target ? [target.id] : [],
    targetId: target?.id ?? null,
    failureTypeId: proposal.failureType,
    severity: proposal.severity,
    focusTypes: proposal.focusTypes.filter((t) => ctx.assets.some((a) => a.type === t)),
    assumptions: proposal.rationale ? [`Copilot's reason: ${proposal.rationale}`] : [],
    questions: [],
    unsupportedReason: target ? undefined : `The proposed asset "${proposal.targetName}" is not in the active dataset.`,
    interpreter: 'amazon-bedrock',
  };
}

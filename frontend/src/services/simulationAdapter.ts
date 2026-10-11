/**
 * Adapts the existing /api/gnn/predict-structured response into typed twin
 * results. Values are passed through as returned; nothing is synthesized.
 */
import type { RawInfraState } from '../data/twinCities';
import type {
  AffectedNodePrediction,
  ModelSource,
  OverallAssessment,
  PropagationStep,
  ScenarioRequest,
  SimulationResult,
  TimelineFrame,
} from '../types/twin';
import { postJson, toBackendInfraState } from './twinData';

/** Marker text the backend adds when its guided post-processing promotes a node. */
const GUIDED_RULE_MARKER = 'policy guidance';

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function normalizeModelSource(value: unknown): ModelSource {
  return value === 'python-model' || value === 'js-fallback' ? value : 'unknown';
}

function normalizeMetrics(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const n = num(v);
    if (n !== undefined) out[k] = n;
  }
  return out;
}

export async function runFailurePrediction(
  request: ScenarioRequest,
  raw: RawInfraState,
  targetName: string,
  assetIds: Set<string>,
  signal?: AbortSignal,
): Promise<SimulationResult> {
  const data = await postJson<any>(
    '/api/gnn/predict-structured',
    {
      nodeId: request.targetAssetId,
      node_name: targetName,
      failure_type: request.failureType,
      severity: request.severity,
      infraState: toBackendInfraState(raw),
    },
    signal,
  );

  if (!data?.success) {
    throw new Error(data?.error || 'Prediction failed');
  }

  const impact = data.impact ?? {};
  const rawAffected: any[] = Array.isArray(data.affectedNodes)
    ? data.affectedNodes
    : Array.isArray(impact.affectedNodes)
      ? impact.affectedNodes
      : [];

  const sourceNodeId = str(data.sourceNodeId) ?? str(impact.sourceFailure?.nodeId) ?? request.targetAssetId;

  const affected: AffectedNodePrediction[] = rawAffected
    .filter((n) => n && n.nodeId && n.nodeId !== sourceNodeId)
    .map((n) => {
      const effects = strList(n.effects);
      return {
        nodeId: String(n.nodeId),
        nodeName: str(n.nodeName) ?? String(n.nodeId),
        nodeType: str(n.nodeType),
        probability: num(n.probability),
        severity: str(n.severity),
        severityScore: num(n.severityScore),
        timeToImpact: num(n.timeToImpact),
        forceFail: Boolean(n.forceFail),
        ruleAdjusted: Boolean(n.forceFail) || effects.some((e) => e.includes(GUIDED_RULE_MARKER)),
        effects,
        recommendations: strList(n.recommendations),
        metrics: normalizeMetrics(n.metrics),
        onMap: assetIds.has(String(n.nodeId)),
      };
    });

  const propagation: PropagationStep[] = (Array.isArray(impact.propagationPath) ? impact.propagationPath : [])
    .filter((p: any) => p && p.from && p.to)
    .map((p: any) => ({ from: String(p.from), to: String(p.to), depth: num(p.depth) }));

  const oa = impact.overallAssessment ?? {};
  const assessment: OverallAssessment = {
    riskLevel: str(oa.riskLevel),
    summary: str(oa.summary),
    priorityActions: strList(oa.priorityActions),
    estimatedRecoveryTime: str(oa.estimatedRecoveryTime),
    affectedPopulation: num(oa.affectedPopulation),
  };

  const modelSource = normalizeModelSource(data.modelSource);
  const modelError = str(data.modelError) ?? null;
  if (modelSource !== 'python-model') {
    console.warn('[simulation] GNN service unavailable; showing the rule-based estimate, not GNN output.', {
      modelSource,
      modelError,
    });
  }

  return {
    modelSource,
    modelError,
    requestedNodeId: request.targetAssetId,
    sourceNodeId,
    affected,
    propagation,
    assessment,
    totalAffected: num(impact.totalAffected),
    criticalCount: num(impact.criticalCount),
    highCount: num(impact.highCount),
    timestamp: str(impact.timestamp),
  };
}

/**
 * Builds snapshot-playback frames: initial state, the source failure, then
 * affected nodes grouped by their predicted time-to-impact (if reported),
 * otherwise by backend severity order. This orders one prediction; it does not
 * represent independently simulated intermediate states.
 */
export function buildTimelineFrames(result: SimulationResult): TimelineFrame[] {
  const frames: TimelineFrame[] = [
    { index: 0, label: 'Before failure', revealedNodeIds: [], sourceFailed: false },
    { index: 1, label: 'Failure triggered', revealedNodeIds: [], sourceFailed: true },
  ];

  const onMap = result.affected.filter((a) => a.onMap);
  if (onMap.length === 0) return frames;

  const hasTiming = onMap.every((a) => a.timeToImpact !== undefined);
  const revealed: string[] = [];

  if (hasTiming) {
    const groups = new Map<number, string[]>();
    for (const a of onMap) {
      const t = a.timeToImpact as number;
      groups.set(t, [...(groups.get(t) ?? []), a.nodeId]);
    }
    const times = Array.from(groups.keys()).sort((x, y) => x - y);
    for (const t of times) {
      revealed.push(...(groups.get(t) ?? []));
      frames.push({
        index: frames.length,
        label: `Predicted impact at t≈${t}`,
        timeToImpact: t,
        revealedNodeIds: [...revealed],
        sourceFailed: true,
      });
    }
  } else {
    // Backend returns affected nodes sorted by severity; reveal in that order.
    for (const a of onMap) {
      revealed.push(a.nodeId);
      frames.push({
        index: frames.length,
        label: `Affected: ${a.nodeName}`,
        revealedNodeIds: [...revealed],
        sourceFailed: true,
      });
    }
  }

  return frames;
}

/** Unit the backend uses for timeToImpact on each code path (see backend/routes/gnn.js). */
export function timeUnitFor(source: ModelSource): string {
  if (source === 'python-model') return 'h';
  if (source === 'js-fallback') return 'min';
  return '';
}

export const MODEL_SOURCE_INFO: Record<ModelSource, { label: string; detail: string; tone: 'model' | 'fallback' | 'unknown' }> = {
  'python-model': {
    label: 'Python GNN',
    detail: 'PyTorch Geometric service. Trained-weight status isn’t reported; backend rules may adjust flagged nodes.',
    tone: 'model',
  },
  'js-fallback': {
    label: 'Rule-based model',
    detail: 'Estimated from the asset dependency network.',
    tone: 'fallback',
  },
  unknown: {
    label: 'Unknown engine',
    detail: 'The backend did not report which engine ran.',
    tone: 'unknown',
  },
};

/** Human labels for backend metric keys; unknown keys are shown verbatim. */
export const METRIC_LABELS: Record<string, string> = {
  supplyDisruption: 'Supply disruption',
  pressureDrop: 'Pressure drop',
  qualityRisk: 'Quality risk',
  cascadeRisk: 'Cascade risk',
  accessDisruption: 'Access disruption',
  serviceDisruption: 'Service disruption',
  economicImpact: 'Economic impact',
  populationAffected: 'Population affected',
  powerImpact: 'Power impact',
  recoveryTime: 'Recovery time',
  safetyRisk: 'Safety risk',
};

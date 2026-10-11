/**
 * Digital twin domain types. Rendering-agnostic: nothing here depends on Cesium.
 */

export type LngLat = [number, number];

export type TwinAssetType =
  | 'tank'
  | 'pump'
  | 'pipe'
  | 'hospital'
  | 'school'
  | 'power'
  | 'market'
  | 'sensor'
  | 'road'
  | 'building';

/** Where a record came from. Synthetic data must never be presented as verified. */
export type DataProvenance = 'synthetic-demo' | 'user-added' | 'verified';

/** Baseline condition derived only from fields present in the dataset. */
export type BaselineCondition = 'healthy' | 'degraded' | 'unknown';

export interface TwinAsset {
  id: string;
  name: string;
  type: TwinAssetType;
  /** Representative point [lng, lat] (WGS84). For linear assets this is the path midpoint. */
  position: LngLat;
  /** Physical geometry for linear assets (roads, pipes), [lng, lat] vertices. */
  path?: LngLat[];
  condition: BaselineCondition;
  /** Raw status string as stored in the dataset, if any. */
  rawStatus?: string;
  /** Display-ready attributes taken verbatim from the dataset. */
  attributes: Array<{ label: string; value: string }>;
  provenance: DataProvenance;
}

export type EdgeKind = 'dependency' | 'proximity';
export type EdgeDirection = 'forward' | 'backward' | 'both';

/** Undirected pair of assets with the directed backend edges collapsed onto it. */
export interface TwinEdge {
  key: string;
  /** Lexicographically smaller id. */
  a: string;
  b: string;
  /** a→b, b→a or both, as present in the backend graph. */
  direction: EdgeDirection;
  kind: EdgeKind;
  /** Backend `type` / `relationship` labels for every directed edge on this pair. */
  relations: string[];
  weight: number;
}

export interface BackendGraphEdge {
  source: string;
  target: string;
  weight?: number;
  type?: string;
  relationship?: string;
}

export interface BackendGraphNode {
  id: string;
  type: string;
  name?: string;
}

export type GraphSource = 'backend' | 'unavailable';

// ---------------------------------------------------------------------------
// Simulation

export type FailureSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FailureScenarioOption {
  id: string;
  name: string;
  description?: string;
  applicableTo?: string[];
}

export interface ScenarioRequest {
  targetAssetId: string;
  failureType: string;
  failureTypeLabel: string;
  severity: FailureSeverity;
  /** How the request was created; copilot requests carry the original prompt. */
  origin: { kind: 'manual' } | { kind: 'copilot'; prompt: string };
}

export type ModelSource = 'python-model' | 'js-fallback' | 'unknown';

export interface AffectedNodePrediction {
  nodeId: string;
  nodeName: string;
  nodeType?: string;
  probability?: number;
  severity?: string;
  severityScore?: number;
  timeToImpact?: number;
  forceFail: boolean;
  /** True when the backend's guided post-processing rules promoted this node. */
  ruleAdjusted: boolean;
  effects: string[];
  recommendations: string[];
  metrics: Record<string, number>;
  /** False when the id is not present in the active dataset (cannot be placed on the map). */
  onMap: boolean;
}

export interface PropagationStep {
  from: string;
  to: string;
  depth?: number;
}

export interface OverallAssessment {
  riskLevel?: string;
  summary?: string;
  priorityActions?: string[];
  estimatedRecoveryTime?: string;
  affectedPopulation?: number;
}

export interface SimulationResult {
  modelSource: ModelSource;
  modelError: string | null;
  requestedNodeId: string;
  /** Node the backend actually simulated (may differ if it re-resolved the id). */
  sourceNodeId: string;
  affected: AffectedNodePrediction[];
  propagation: PropagationStep[];
  assessment: OverallAssessment;
  totalAffected?: number;
  criticalCount?: number;
  highCount?: number;
  timestamp?: string;
}

/**
 * One step of snapshot playback. The backend returns a single prediction, so
 * frames are an ordering of that prediction, not independently simulated states.
 */
export interface TimelineFrame {
  index: number;
  label: string;
  /** Predicted time-to-impact for nodes revealed at this frame, if reported. */
  timeToImpact?: number;
  /** Affected node ids visible at or before this frame. */
  revealedNodeIds: string[];
  sourceFailed: boolean;
}

export interface SimulationRun {
  id: string;
  datasetId: string;
  request: ScenarioRequest;
  result: SimulationResult;
  frames: TimelineFrame[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Scene visual state

export type AssetVisualState =
  | 'healthy'
  | 'degraded'
  | 'unknown'
  | 'failed'
  | 'predicted-failure'
  | 'affected-low'
  | 'affected-medium'
  | 'affected-high'
  | 'affected-critical';

export interface LayerVisibility {
  buildings: boolean;
  terrain: boolean;
  infrastructure: boolean;
  physicalNetworks: boolean;
  dependencyNetwork: boolean;
  proximityLinks: boolean;
  labels: boolean;
}

export type BasemapStyle = 'satellite-labels' | 'satellite' | 'streets';

export type LoadState = 'idle' | 'loading' | 'ready' | 'fallback' | 'error';

export interface SceneStatus {
  terrain: LoadState;
  imagery: LoadState;
  buildings: LoadState;
  message?: string;
}

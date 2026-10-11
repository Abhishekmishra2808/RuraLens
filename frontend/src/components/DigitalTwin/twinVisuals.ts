/**
 * Visual language and pure state derivation for the digital twin.
 * Shared by the Cesium layer and the React panels so both stay consistent.
 */
import { Building2, Cross, Droplets, Gauge, Radio, Route, School, Store, Waypoints, Zap, type LucideIcon } from 'lucide-react';
import type {
  AssetVisualState,
  SimulationRun,
  TwinAsset,
  TwinAssetType,
  TwinEdge,
} from '../../types/twin';

export const ASSET_TYPE_META: Record<TwinAssetType, { label: string; plural: string; icon: LucideIcon }> = {
  tank: { label: 'Water tank', plural: 'Tanks', icon: Droplets },
  pump: { label: 'Pump', plural: 'Pumps', icon: Gauge },
  pipe: { label: 'Pipeline', plural: 'Pipelines', icon: Waypoints },
  hospital: { label: 'Hospital', plural: 'Hospitals', icon: Cross },
  school: { label: 'School', plural: 'Schools', icon: School },
  power: { label: 'Power', plural: 'Power', icon: Zap },
  market: { label: 'Market', plural: 'Markets', icon: Store },
  sensor: { label: 'Sensor', plural: 'Sensors', icon: Radio },
  road: { label: 'Road', plural: 'Roads', icon: Route },
  building: { label: 'Building', plural: 'Buildings', icon: Building2 },
};

export const ASSET_TYPE_ORDER: TwinAssetType[] = [
  'tank',
  'pump',
  'pipe',
  'power',
  'hospital',
  'school',
  'market',
  'sensor',
  'road',
  'building',
];

/** Status colours: brand green, amber and red only (plus neutral grey for unknown). */
export const STATE_META: Record<AssetVisualState, { label: string; color: string; ring: boolean }> = {
  healthy: { label: 'Healthy', color: '#3f8b54', ring: false },
  degraded: { label: 'Degraded', color: '#d97706', ring: false },
  unknown: { label: 'Unknown', color: '#a1a1aa', ring: false },
  failed: { label: 'Failed', color: '#7f1d1d', ring: true },
  'predicted-failure': { label: 'Predicted failure', color: '#7f1d1d', ring: true },
  'affected-critical': { label: 'Critical', color: '#dc2626', ring: true },
  'affected-high': { label: 'High', color: '#dc2626', ring: true },
  'affected-medium': { label: 'Medium', color: '#f59e0b', ring: true },
  'affected-low': { label: 'Low', color: '#f59e0b', ring: true },
};

/** Legend rows: one per distinct colour. */
export const STATE_LEGEND: Array<{ label: string; color: string }> = [
  { label: 'Healthy', color: STATE_META.healthy.color },
  { label: 'Degraded', color: STATE_META.degraded.color },
  { label: 'Unknown', color: STATE_META.unknown.color },
  { label: 'Impact: low–medium', color: STATE_META['affected-medium'].color },
  { label: 'Impact: high–critical', color: STATE_META['affected-critical'].color },
  { label: 'Failed', color: STATE_META.failed.color },
];

export const EDGE_COLORS = {
  dependency: '#ffffff',
  proximity: '#d4d4d8',
  upstream: '#8fc69d',
  downstream: '#ffffff',
  twoWay: '#ffffff',
  propagation: '#ef4444',
  road: '#fafafa',
  pipe: '#8fc69d',
};

function affectedState(severity: string | undefined, forceFail: boolean): AssetVisualState {
  if (forceFail) return 'predicted-failure';
  switch ((severity || '').toLowerCase()) {
    case 'critical':
      return 'affected-critical';
    case 'high':
      return 'affected-high';
    case 'medium':
      return 'affected-medium';
    default:
      return 'affected-low';
  }
}

export function baselineState(asset: TwinAsset): AssetVisualState {
  return asset.condition;
}

/** Effective frame index for the current simulation view. */
export function effectiveFrame(run: SimulationRun, frameIndex: number, view: 'timeline' | 'before' | 'after'): number {
  if (view === 'before') return 0;
  if (view === 'after') return run.frames.length - 1;
  return Math.min(Math.max(frameIndex, 0), run.frames.length - 1);
}

export function computeVisualStates(
  assets: TwinAsset[],
  run: SimulationRun | null,
  frame: number,
): Map<string, AssetVisualState> {
  const states = new Map<string, AssetVisualState>();
  for (const a of assets) states.set(a.id, baselineState(a));
  if (!run) return states;

  const current = run.frames[frame];
  if (!current) return states;

  const revealed = new Set(current.revealedNodeIds);
  for (const a of run.result.affected) {
    if (a.onMap && revealed.has(a.nodeId)) states.set(a.nodeId, affectedState(a.severity, a.forceFail));
  }
  if (current.sourceFailed) states.set(run.result.sourceNodeId, 'failed');
  return states;
}

export function isAffectedState(s: AssetVisualState): boolean {
  return s === 'failed' || s === 'predicted-failure' || s.startsWith('affected-');
}

/**
 * Propagation links visible at a frame. Only links returned in the backend's
 * propagation path are drawn; none are inferred on the client.
 */
export function propagationLinks(run: SimulationRun | null, frame: number): Array<{ from: string; to: string }> {
  if (!run) return [];
  const current = run.frames[frame];
  if (!current || !current.sourceFailed) return [];
  const revealed = new Set(current.revealedNodeIds);
  return run.result.propagation
    .filter((p) => revealed.has(p.to) && (p.from === run.result.sourceNodeId || revealed.has(p.from)))
    .map((p) => ({ from: p.from, to: p.to }));
}

export interface Neighborhood {
  upstream: string[];
  downstream: string[];
  twoWay: string[];
  proximity: string[];
  edgeRole: Map<string, 'upstream' | 'downstream' | 'twoWay' | 'proximity'>;
}

/**
 * Direct neighbours of a node in the backend graph. "Upstream" means the backend
 * has only an edge into the selected node; "downstream" only an edge out of it.
 */
export function neighborhoodOf(id: string | null, edges: TwinEdge[]): Neighborhood {
  const n: Neighborhood = { upstream: [], downstream: [], twoWay: [], proximity: [], edgeRole: new Map() };
  if (!id) return n;
  for (const e of edges) {
    if (e.a !== id && e.b !== id) continue;
    const other = e.a === id ? e.b : e.a;
    if (e.kind === 'proximity') {
      n.proximity.push(other);
      n.edgeRole.set(e.key, 'proximity');
      continue;
    }
    if (e.direction === 'both') {
      n.twoWay.push(other);
      n.edgeRole.set(e.key, 'twoWay');
      continue;
    }
    const outgoing = (e.direction === 'forward' && e.a === id) || (e.direction === 'backward' && e.b === id);
    if (outgoing) {
      n.downstream.push(other);
      n.edgeRole.set(e.key, 'downstream');
    } else {
      n.upstream.push(other);
      n.edgeRole.set(e.key, 'upstream');
    }
  }
  return n;
}

export function matchesFilters(
  asset: TwinAsset,
  state: AssetVisualState,
  query: string,
  types: TwinAssetType[],
  status: 'all' | 'healthy' | 'degraded' | 'affected' | 'failed',
): boolean {
  if (types.length > 0 && !types.includes(asset.type)) return false;
  if (status === 'healthy' && state !== 'healthy') return false;
  if (status === 'degraded' && state !== 'degraded') return false;
  if (status === 'affected' && !state.startsWith('affected-')) return false;
  if (status === 'failed' && state !== 'failed' && state !== 'predicted-failure') return false;
  const q = query.trim().toLowerCase();
  if (q && !asset.name.toLowerCase().includes(q) && !asset.id.toLowerCase().includes(q)) return false;
  return true;
}

/**
 * Converts the existing infraState shape into twin assets and fetches the
 * dependency graph that the backend GNN actually uses.
 */
import { API_URL } from '../config/api';
import type { RawInfraState } from '../data/twinCities';
import type {
  BackendGraphEdge,
  BaselineCondition,
  DataProvenance,
  LngLat,
  TwinAsset,
  TwinAssetType,
  TwinEdge,
} from '../types/twin';

const DEGRADED_STATUSES = new Set(['warning', 'critical', 'offline', 'failed', 'fault', 'degraded']);
const HEALTHY_STATUSES = new Set(['operational', 'ok', 'good', 'active', 'online']);
const DEGRADED_CONDITIONS = new Set(['poor', 'critical']);

export function isValidLngLat(value: unknown): value is LngLat {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}

function toLngLat(value: unknown): LngLat | null {
  if (isValidLngLat(value)) return [value[0], value[1]];
  if (value && typeof value === 'object') {
    const v = value as { lng?: number; lon?: number; lat?: number };
    const lng = v.lng ?? v.lon;
    if (Number.isFinite(lng) && Number.isFinite(v.lat)) return [lng as number, v.lat as number];
  }
  return null;
}

function toPath(value: unknown): LngLat[] | null {
  if (!Array.isArray(value)) return null;
  const points = value.map(toLngLat).filter((p): p is LngLat => p !== null);
  return points.length >= 2 ? points : null;
}

function pathMidpoint(path: LngLat[]): LngLat {
  return path[Math.floor((path.length - 1) / 2)];
}

function conditionFrom(status?: string, roadCondition?: string): BaselineCondition {
  const s = (status || '').toLowerCase();
  const c = (roadCondition || '').toLowerCase();
  if (DEGRADED_STATUSES.has(s) || DEGRADED_CONDITIONS.has(c)) return 'degraded';
  if (HEALTHY_STATUSES.has(s) || c === 'good' || c === 'fair') return 'healthy';
  return 'unknown';
}

function attr(label: string, value: unknown, suffix = ''): { label: string; value: string } | null {
  if (value === undefined || value === null || value === '') return null;
  const text = typeof value === 'number' ? value.toLocaleString('en-IN') : String(value);
  return { label, value: `${text}${suffix}` };
}

function compact<T>(items: Array<T | null>): T[] {
  return items.filter((i): i is T => i !== null);
}

function buildingType(raw: string | undefined): TwinAssetType {
  const t = (raw || '').toLowerCase();
  if (['health', 'hospital', 'clinic', 'medical'].includes(t)) return 'hospital';
  if (['school', 'college', 'education', 'university'].includes(t)) return 'school';
  if (['market', 'commercial', 'shop', 'mall'].includes(t)) return 'market';
  return 'building';
}

/**
 * Normalizes a raw infraState into twin assets. Records without valid
 * coordinates are reported in `skipped` instead of being placed arbitrarily.
 */
export function buildTwinAssets(
  raw: RawInfraState,
  provenance: DataProvenance,
): { assets: TwinAsset[]; skipped: string[] } {
  const assets: TwinAsset[] = [];
  const skipped: string[] = [];

  const push = (
    item: any,
    type: TwinAssetType,
    position: LngLat | null,
    attributes: Array<{ label: string; value: string } | null>,
    path?: LngLat[] | null,
    condition?: BaselineCondition,
  ) => {
    if (!item?.id) return;
    if (!position) {
      skipped.push(`${item.name || item.id} (no valid coordinates)`);
      return;
    }
    assets.push({
      id: String(item.id),
      name: String(item.name || item.id),
      type,
      position,
      path: path ?? undefined,
      condition: condition ?? conditionFrom(item.status),
      rawStatus: item.status,
      attributes: compact(attributes),
      provenance: item.provenance === 'user-added' ? 'user-added' : provenance,
    });
  };

  raw.waterTanks?.forEach((t) =>
    push(t, 'tank', toLngLat(t.coords), [
      attr('Capacity', t.capacity, ' L'),
      attr('Level', t.currentLevel, '%'),
      attr('Status', t.status),
    ]),
  );

  raw.waterPumps?.forEach((p) =>
    push(p, 'pump', toLngLat(p.coords), [
      attr('Capacity', p.capacity, ' L/min'),
      attr('Flow', p.currentFlow, ' L/min'),
      attr('Status', p.status),
      attr('Feeds from', p.tankId),
    ]),
  );

  raw.waterPipes?.forEach((p) => {
    const path = toPath(p.path) ?? toPath([p.from, p.to]);
    const position = path ? pathMidpoint(path) : toLngLat(p.coords);
    push(
      p,
      'pipe',
      position,
      [attr('From', p.fromNode), attr('To', p.toNode), attr('Status', p.status)],
      path,
    );
  });

  raw.buildings?.forEach((b) =>
    push(b, buildingType(b.type), toLngLat(b.coords), [
      attr('Category', b.type),
      attr('Occupancy', b.occupancy),
      attr('Floors', b.floors),
      attr('Status', b.status),
    ]),
  );

  raw.powerNodes?.forEach((p) => {
    const load =
      Number.isFinite(p.currentLoad) && Number.isFinite(p.capacity) && p.capacity > 0
        ? `${Math.round((p.currentLoad / p.capacity) * 100)}%`
        : null;
    push(p, 'power', toLngLat(p.coords), [
      attr('Kind', p.type),
      attr('Capacity', p.capacity, ' kVA'),
      attr('Load', p.currentLoad, ' kVA'),
      load ? { label: 'Utilisation', value: load } : null,
      attr('Status', p.status),
    ]);
  });

  raw.sensors?.forEach((s) =>
    push(s, 'sensor', toLngLat(s.coords), [
      attr('Measures', s.type),
      attr('Unit', s.unit),
      attr('Status', s.status),
    ]),
  );

  raw.roads?.forEach((r) => {
    const path = toPath(r.path) ?? toPath([r.from, r.to]);
    const position = toLngLat(r.coords) ?? (path ? pathMidpoint(path) : null);
    push(
      r,
      'road',
      path ? pathMidpoint(path) : position,
      [attr('Class', r.type), attr('Width', r.width, ' m'), attr('Condition', r.condition)],
      path,
      conditionFrom(r.status, r.condition),
    );
  });

  return { assets, skipped };
}

/**
 * Payload sent to the backend, matching what the classic map already sends
 * (including the `pumps`/`pipes` aliases read by the backend graph builder).
 */
export function toBackendInfraState(raw: RawInfraState) {
  return {
    waterTanks: raw.waterTanks ?? [],
    waterPumps: raw.waterPumps ?? [],
    waterPipes: raw.waterPipes ?? [],
    powerNodes: raw.powerNodes ?? [],
    buildings: raw.buildings ?? [],
    roads: raw.roads ?? [],
    sensors: raw.sensors ?? [],
    pumps: raw.waterPumps ?? [],
    pipes: raw.waterPipes ?? [],
  };
}

const PROXIMITY_TYPES = new Set(['proximity']);

/**
 * Collapses directed backend edges onto undirected asset pairs, dropping edges
 * whose endpoints are not on the map (e.g. backend-only nodes).
 */
export function collapseEdges(edges: BackendGraphEdge[], assetIds: Set<string>): TwinEdge[] {
  const byKey = new Map<string, TwinEdge & { forward: boolean; backward: boolean; dependency: boolean }>();

  for (const e of edges) {
    if (!e?.source || !e?.target || e.source === e.target) continue;
    if (!assetIds.has(e.source) || !assetIds.has(e.target)) continue;

    const [a, b] = e.source < e.target ? [e.source, e.target] : [e.target, e.source];
    const key = `${a}|${b}`;
    const isForward = e.source === a;
    const isDependency = !PROXIMITY_TYPES.has(String(e.type || ''));
    const relation = [e.type, e.relationship].filter(Boolean).join(': ');

    let entry = byKey.get(key);
    if (!entry) {
      entry = {
        key,
        a,
        b,
        direction: 'both',
        kind: 'proximity',
        relations: [],
        weight: 0,
        forward: false,
        backward: false,
        dependency: false,
      };
      byKey.set(key, entry);
    }

    // Direction is only meaningful for dependency edges; proximity edges are always mirrored.
    if (isDependency) {
      entry.dependency = true;
      if (isForward) entry.forward = true;
      else entry.backward = true;
    }
    if (relation && !entry.relations.includes(relation)) entry.relations.push(relation);
    entry.weight = Math.max(entry.weight, Number(e.weight) || 0);
  }

  return Array.from(byKey.values()).map(({ forward, backward, dependency, ...edge }) => ({
    ...edge,
    kind: dependency ? 'dependency' : 'proximity',
    direction: dependency ? (forward && backward ? 'both' : forward ? 'forward' : 'backward') : 'both',
  }));
}

export class BackendUnavailableError extends Error {}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new BackendUnavailableError(`Backend unreachable at ${API_URL}`);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Request to ${path} failed (${response.status})${text ? `: ${text.slice(0, 200)}` : ''}`);
  }
  return response.json() as Promise<T>;
}

/** Builds the backend graph from the dataset and returns its real edges. */
export async function fetchBackendGraph(raw: RawInfraState, signal?: AbortSignal) {
  const data = await postJson<{ nodes?: Array<{ id: string; type: string; name?: string }>; edges?: BackendGraphEdge[] }>(
    '/api/gnn/initialize',
    { infraState: toBackendInfraState(raw) },
    signal,
  );
  return { nodes: data.nodes ?? [], edges: data.edges ?? [] };
}

export async function fetchFailureScenarios(signal?: AbortSignal) {
  const response = await fetch(`${API_URL}/api/gnn/scenarios`, { signal });
  if (!response.ok) throw new Error(`Scenario list failed (${response.status})`);
  const data = await response.json();
  return Array.isArray(data?.scenarios) ? data.scenarios : [];
}

export { postJson };

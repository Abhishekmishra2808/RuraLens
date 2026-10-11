/**
 * State for the 3D digital twin. Kept separate from appStore so the twin's
 * city datasets never overwrite the graph used by the dashboard and classic map.
 */
import { create } from 'zustand';
import { DEFAULT_CITY_ID, getCity, getDataset, type RawInfraState } from '../data/twinCities';
import {
  BackendUnavailableError,
  buildTwinAssets,
  collapseEdges,
  fetchBackendGraph,
  fetchFailureScenarios,
} from '../services/twinData';
import { buildTimelineFrames, runFailurePrediction } from '../services/simulationAdapter';
import type {
  BackendGraphEdge,
  BasemapStyle,
  FailureScenarioOption,
  LayerVisibility,
  LngLat,
  SceneStatus,
  ScenarioRequest,
  SimulationRun,
  TwinAsset,
  TwinAssetType,
  TwinEdge,
} from '../types/twin';

export type StatusFilter = 'all' | 'healthy' | 'degraded' | 'affected' | 'failed';

export type CameraRequest =
  | { kind: 'overview'; nonce: number }
  | { kind: 'asset'; id: string; nonce: number }
  | { kind: 'assets'; ids: string[]; nonce: number }
  | { kind: 'zoom'; direction: 'in' | 'out'; nonce: number };

/** Built-in failure types used when the backend scenario list is unavailable (same list as the classic map). */
export const FALLBACK_FAILURE_TYPES: FailureScenarioOption[] = [
  { id: 'Supply Disruption', name: 'Supply Disruption' },
  { id: 'Contamination Alert', name: 'Contamination Alert' },
  { id: 'Power Failure', name: 'Power Failure' },
  { id: 'Infrastructure Damage', name: 'Infrastructure Damage' },
  { id: 'Complete Failure', name: 'Complete Failure' },
];

/** Scenario ids the backend lists use 'power' for power assets and 'hospital' etc. for buildings. */
export function scenariosFor(type: TwinAssetType, all: FailureScenarioOption[]): FailureScenarioOption[] {
  const applicable = all.filter((s) => !s.applicableTo || s.applicableTo.includes(type));
  return applicable.length > 0 ? applicable : all;
}

interface GraphState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  edges: TwinEdge[];
  directed: BackendGraphEdge[];
  /** Backend nodes that are not represented on the map. */
  hiddenNodeCount: number;
  error?: string;
}

export type PanelTab = 'assets' | 'simulate' | 'ask' | 'layers';

interface SimulationState {
  status: 'idle' | 'running' | 'error';
  error?: string;
  runs: SimulationRun[];
  activeRunId: string | null;
  frameIndex: number;
  playing: boolean;
  view: 'timeline' | 'before' | 'after';
}

interface TwinState {
  cityId: string;
  datasetId: string;
  datasetStatus: 'idle' | 'loading' | 'ready' | 'error';
  datasetError?: string;
  raw: RawInfraState | null;
  assets: TwinAsset[];
  skipped: string[];
  graph: GraphState;
  scenarios: FailureScenarioOption[];
  scenariosFromBackend: boolean;

  selectedId: string | null;
  /** Asset chosen as the failure source in the Simulate tab. */
  simTargetId: string | null;
  /** Map location picked (right-click) for a new scenario asset. */
  draftLocation: LngLat | null;
  query: string;
  typeFilter: TwinAssetType[];
  statusFilter: StatusFilter;
  layers: LayerVisibility;
  basemap: BasemapStyle;
  sceneStatus: SceneStatus;
  cameraRequest: CameraRequest | null;
  panelTab: PanelTab;

  simulation: SimulationState;

  // actions
  setCity: (cityId: string) => Promise<void>;
  loadDataset: (datasetId: string) => Promise<void>;
  reloadGraph: () => Promise<void>;
  loadScenarios: () => Promise<void>;
  addUserAsset: (type: UserAssetType, name: string, position: LngLat) => Promise<void>;
  select: (id: string | null, opts?: { fly?: boolean }) => void;
  flyToAsset: (id: string) => void;
  flyToAssets: (ids: string[]) => void;
  resetCamera: () => void;
  zoomCamera: (direction: 'in' | 'out') => void;
  setQuery: (q: string) => void;
  toggleType: (t: TwinAssetType) => void;
  clearTypeFilter: () => void;
  setStatusFilter: (s: StatusFilter) => void;
  toggleLayer: (key: keyof LayerVisibility) => void;
  setBasemap: (b: BasemapStyle) => void;
  setSceneStatus: (patch: Partial<SceneStatus>) => void;
  setPanelTab: (tab: PanelTab) => void;
  setSimTarget: (assetId: string | null) => void;
  setDraftLocation: (position: LngLat | null) => void;

  runScenario: (request: ScenarioRequest) => Promise<SimulationRun | null>;
  setFrame: (index: number) => void;
  setPlaying: (playing: boolean) => void;
  setSimulationView: (view: SimulationState['view']) => void;
  selectRun: (runId: string | null) => void;
  resetSimulation: () => void;
  clearRunHistory: () => void;
}

export type UserAssetType = 'tank' | 'pump' | 'hospital' | 'school' | 'market' | 'power' | 'sensor';

let datasetLoadToken = 0;
let graphLoadToken = 0;
let simulationAbort: AbortController | null = null;

const INITIAL_SIMULATION: SimulationState = {
  status: 'idle',
  runs: [],
  activeRunId: null,
  frameIndex: 0,
  playing: false,
  view: 'timeline',
};

export const useTwinStore = create<TwinState>((set, get) => ({
  cityId: DEFAULT_CITY_ID,
  datasetId: getCity(DEFAULT_CITY_ID).defaultDatasetId,
  datasetStatus: 'idle',
  raw: null,
  assets: [],
  skipped: [],
  graph: { status: 'idle', edges: [], directed: [], hiddenNodeCount: 0 },
  scenarios: FALLBACK_FAILURE_TYPES,
  scenariosFromBackend: false,

  selectedId: null,
  simTargetId: null,
  draftLocation: null,
  query: '',
  typeFilter: [],
  statusFilter: 'all',
  layers: {
    buildings: true,
    terrain: true,
    infrastructure: true,
    physicalNetworks: true,
    dependencyNetwork: true,
    proximityLinks: false,
    labels: true,
  },
  basemap: 'satellite-labels',
  sceneStatus: { terrain: 'idle', imagery: 'idle', buildings: 'idle' },
  cameraRequest: null,
  panelTab: 'assets',

  simulation: INITIAL_SIMULATION,

  setCity: async (cityId) => {
    const city = getCity(cityId);
    simulationAbort?.abort();
    set({
      cityId: city.id,
      selectedId: null,
      simTargetId: null,
      draftLocation: null,
      simulation: INITIAL_SIMULATION,
      cameraRequest: { kind: 'overview', nonce: Date.now() },
    });
    await get().loadDataset(city.defaultDatasetId);
  },

  loadDataset: async (datasetId) => {
    const dataset = getDataset(datasetId);
    const token = ++datasetLoadToken;
    if (!dataset) {
      set({ datasetStatus: 'error', datasetError: `Unknown dataset "${datasetId}"` });
      return;
    }
    set({ datasetId, datasetStatus: 'loading', datasetError: undefined, assets: [], raw: null });
    try {
      const loaded = await dataset.load();
      if (token !== datasetLoadToken) return;
      // Deep copy so user-added assets never mutate the shared module data.
      const raw: RawInfraState = JSON.parse(JSON.stringify(loaded));
      const { assets, skipped } = buildTwinAssets(raw, dataset.provenance);
      set({ raw, assets, skipped, datasetStatus: 'ready' });
      await get().reloadGraph();
    } catch (err) {
      if (token !== datasetLoadToken) return;
      set({ datasetStatus: 'error', datasetError: (err as Error).message });
    }
  },

  reloadGraph: async () => {
    const { raw, assets } = get();
    if (!raw) return;
    const token = ++graphLoadToken;
    set((s) => ({ graph: { ...s.graph, status: 'loading', error: undefined } }));
    try {
      const { nodes, edges } = await fetchBackendGraph(raw);
      if (token !== graphLoadToken) return;
      const ids = new Set(assets.map((a) => a.id));
      set({
        graph: {
          status: 'ready',
          directed: edges,
          edges: collapseEdges(edges, ids),
          hiddenNodeCount: nodes.filter((n) => !ids.has(n.id)).length,
        },
      });
    } catch (err) {
      if (token !== graphLoadToken) return;
      const message =
        err instanceof BackendUnavailableError
          ? `${err.message}. Start the backend to load the dependency graph and run simulations.`
          : (err as Error).message;
      set({ graph: { status: 'error', edges: [], directed: [], hiddenNodeCount: 0, error: message } });
    }
  },

  loadScenarios: async () => {
    try {
      const list = await fetchFailureScenarios();
      const scenarios: FailureScenarioOption[] = list
        .filter((s: any) => s && s.id && s.name)
        .map((s: any) => ({
          id: String(s.id),
          name: String(s.name),
          description: s.description,
          applicableTo: Array.isArray(s.applicableTo) ? s.applicableTo : undefined,
        }));
      if (scenarios.length > 0) set({ scenarios, scenariosFromBackend: true });
    } catch {
      // Keep the built-in list; the failure dialog notes the source.
    }
  },

  addUserAsset: async (type, name, position) => {
    const { raw, datasetId } = get();
    if (!raw) return;
    const id = `user-${type}-${Date.now().toString(36)}`;
    const base = { id, name, coords: position, status: 'operational', provenance: 'user-added' };
    const next: RawInfraState = { ...raw };
    switch (type) {
      case 'tank':
        next.waterTanks = [...(raw.waterTanks ?? []), base];
        break;
      case 'pump':
        next.waterPumps = [...(raw.waterPumps ?? []), base];
        break;
      case 'hospital':
        next.buildings = [...(raw.buildings ?? []), { ...base, type: 'health' }];
        break;
      case 'school':
        next.buildings = [...(raw.buildings ?? []), { ...base, type: 'school' }];
        break;
      case 'market':
        next.buildings = [...(raw.buildings ?? []), { ...base, type: 'market' }];
        break;
      case 'power':
        next.powerNodes = [...(raw.powerNodes ?? []), { ...base, type: 'transformer' }];
        break;
      case 'sensor':
        next.sensors = [...(raw.sensors ?? []), base];
        break;
    }
    const dataset = getDataset(datasetId);
    const { assets, skipped } = buildTwinAssets(next, dataset?.provenance ?? 'synthetic-demo');
    set({ raw: next, assets, skipped, selectedId: id, draftLocation: null, panelTab: 'assets' });
    await get().reloadGraph();
  },

  select: (id, opts) => {
    // While setting up a scenario, picking an asset on the map chooses the failure source.
    if (id && get().panelTab === 'simulate') set({ selectedId: id, simTargetId: id });
    else if (id && get().panelTab !== 'ask') set({ selectedId: id, panelTab: 'assets' });
    else set({ selectedId: id });
    if (id && opts?.fly) get().flyToAsset(id);
  },
  flyToAsset: (id) => set({ cameraRequest: { kind: 'asset', id, nonce: Date.now() } }),
  flyToAssets: (ids) => set({ cameraRequest: { kind: 'assets', ids, nonce: Date.now() } }),
  resetCamera: () => set({ cameraRequest: { kind: 'overview', nonce: Date.now() } }),
  zoomCamera: (direction) => set({ cameraRequest: { kind: 'zoom', direction, nonce: performance.now() } }),

  setQuery: (query) => set({ query }),
  toggleType: (t) =>
    set((s) => ({
      typeFilter: s.typeFilter.includes(t) ? s.typeFilter.filter((x) => x !== t) : [...s.typeFilter, t],
    })),
  clearTypeFilter: () => set({ typeFilter: [] }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  setBasemap: (basemap) => set({ basemap }),
  setSceneStatus: (patch) => set((s) => ({ sceneStatus: { ...s.sceneStatus, ...patch } })),
  setPanelTab: (panelTab) => set({ panelTab }),
  setSimTarget: (simTargetId) => set({ simTargetId, ...(simTargetId ? { panelTab: 'simulate' as const } : {}) }),
  setDraftLocation: (draftLocation) => set({ draftLocation, ...(draftLocation ? { panelTab: 'assets' as const } : {}) }),

  runScenario: async (request) => {
    const { raw, assets, datasetId } = get();
    const target = assets.find((a) => a.id === request.targetAssetId);
    if (!raw || !target) return null;

    simulationAbort?.abort();
    const controller = new AbortController();
    simulationAbort = controller;

    set((s) => ({
      simulation: { ...s.simulation, status: 'running', error: undefined, playing: false },
    }));

    try {
      const result = await runFailurePrediction(
        request,
        raw,
        target.name,
        new Set(assets.map((a) => a.id)),
        controller.signal,
      );
      if (controller.signal.aborted) return null;
      const run: SimulationRun = {
        id: `run-${Date.now().toString(36)}`,
        datasetId,
        request,
        result,
        frames: buildTimelineFrames(result),
        createdAt: new Date().toISOString(),
      };
      set((s) => ({
        selectedId: result.sourceNodeId,
        panelTab: s.panelTab === 'ask' ? 'ask' : 'simulate',
        simulation: {
          ...s.simulation,
          status: 'idle',
          runs: [...s.simulation.runs, run].slice(-10),
          activeRunId: run.id,
          frameIndex: 0,
          playing: true,
          view: 'timeline',
        },
      }));
      return run;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null;
      const message =
        err instanceof BackendUnavailableError
          ? `${err.message}. The simulation needs the RuraLens backend (npm run dev in /backend).`
          : (err as Error).message;
      set((s) => ({ simulation: { ...s.simulation, status: 'error', error: message } }));
      return null;
    }
  },

  setFrame: (index) => set((s) => ({ simulation: { ...s.simulation, frameIndex: index, view: 'timeline' } })),
  setPlaying: (playing) => set((s) => ({ simulation: { ...s.simulation, playing, view: 'timeline' } })),
  setSimulationView: (view) => set((s) => ({ simulation: { ...s.simulation, view, playing: false } })),
  selectRun: (activeRunId) => {
    const run = get().simulation.runs.find((r) => r.id === activeRunId);
    set((s) => ({
      simulation: {
        ...s.simulation,
        activeRunId,
        playing: false,
        view: 'timeline',
        frameIndex: run ? run.frames.length - 1 : 0,
      },
    }));
  },
  resetSimulation: () => {
    simulationAbort?.abort();
    set((s) => ({
      simulation: { ...s.simulation, status: 'idle', error: undefined, activeRunId: null, frameIndex: 0, playing: false, view: 'timeline' },
    }));
  },
  clearRunHistory: () =>
    set((s) => ({ simulation: { ...s.simulation, runs: [], activeRunId: null, frameIndex: 0, playing: false } })),
}));

export function getActiveRun(state: Pick<TwinState, 'simulation'>): SimulationRun | null {
  const { runs, activeRunId } = state.simulation;
  return runs.find((r) => r.id === activeRunId) ?? null;
}

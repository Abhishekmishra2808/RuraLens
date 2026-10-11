import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTwinAssets, collapseEdges, toBackendInfraState } from '../twinData';
import { buildTimelineFrames, runFailurePrediction } from '../simulationAdapter';
import { ruleBasedInterpreter, validateInterpretation } from '../scenarioInterpreter';
import { FALLBACK_FAILURE_TYPES } from '../../store/twinStore';
import { delhiDemoInfraData } from '../../data/delhiDemoInfra';
import { TWIN_CITIES } from '../../data/twinCities';
import type { FailureScenarioOption, ScenarioRequest, SimulationResult } from '../../types/twin';

const delhi = TWIN_CITIES.find((c) => c.id === 'delhi')!;
const raw = JSON.parse(JSON.stringify(delhiDemoInfraData));
const { assets, skipped } = buildTwinAssets(raw, 'synthetic-demo');
const ids = new Set(assets.map((a) => a.id));

describe('Delhi demo dataset', () => {
  it('places every record within ~6 km of the Delhi city centre', () => {
    expect(skipped).toEqual([]);
    expect(assets.length).toBeGreaterThan(10);
    for (const a of assets) {
      const dLng = (a.position[0] - delhi.center.lon) * 111 * Math.cos((delhi.center.lat * Math.PI) / 180);
      const dLat = (a.position[1] - delhi.center.lat) * 111;
      expect(Math.hypot(dLng, dLat), a.id).toBeLessThan(6);
    }
  });

  it('labels all assets as synthetic and avoids keywords that trigger backend guided rules', () => {
    for (const a of assets) {
      const text = `${a.id} ${a.name}`.toLowerCase();
      expect(a.provenance).toBe('synthetic-demo');
      expect(text, a.id).not.toContain('main');
      if (a.type !== 'road') expect(text, a.id).not.toContain('road');
      if (a.type === 'pump') expect(text, a.id).not.toContain('station');
    }
  });

  it('skips records without coordinates instead of inventing positions', () => {
    const result = buildTwinAssets({ waterTanks: [{ id: 'x', name: 'No coords' }] }, 'synthetic-demo');
    expect(result.assets).toEqual([]);
    expect(result.skipped).toHaveLength(1);
  });

  it('sends the pumps/pipes aliases the backend graph builder reads', () => {
    const payload = toBackendInfraState(raw);
    expect(payload.pumps).toBe(payload.waterPumps);
    expect(payload.pipes).toBe(payload.waterPipes);
  });
});

describe('collapseEdges', () => {
  it('merges directed edges, keeps direction for dependencies and drops off-map endpoints', () => {
    const edges = collapseEdges(
      [
        { source: 'a', target: 'b', type: 'water_supply' },
        { source: 'b', target: 'c', type: 'proximity' },
        { source: 'c', target: 'b', type: 'proximity' },
        { source: 'a', target: 'zz', type: 'water_supply' },
        { source: 'c', target: 'a', type: 'power_supply' },
        { source: 'a', target: 'c', type: 'power_supply' },
      ],
      new Set(['a', 'b', 'c']),
    );
    const byKey = Object.fromEntries(edges.map((e) => [e.key, e]));
    expect(Object.keys(byKey).sort()).toEqual(['a|b', 'a|c', 'b|c']);
    expect(byKey['a|b']).toMatchObject({ kind: 'dependency', direction: 'forward' });
    expect(byKey['b|c']).toMatchObject({ kind: 'proximity', direction: 'both' });
    expect(byKey['a|c']).toMatchObject({ kind: 'dependency', direction: 'both' });
  });
});

const request: ScenarioRequest = {
  targetAssetId: 'dl-pump-01',
  failureType: 'failure',
  failureTypeLabel: 'Component Failure',
  severity: 'high',
  origin: { kind: 'manual' },
};

describe('runFailurePrediction', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('passes backend values through without inventing missing fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            modelSource: 'js-fallback',
            sourceNodeId: 'dl-pump-01',
            impact: {
              propagationPath: [{ from: 'dl-pump-01', to: 'dl-hospital-01', depth: 1 }],
              overallAssessment: { riskLevel: 'high' },
            },
            affectedNodes: [
              { nodeId: 'dl-pump-01', nodeName: 'source' },
              { nodeId: 'dl-hospital-01', nodeName: 'H', severity: 'critical', effects: ['x (policy guidance)'] },
              { nodeId: 'backend-only', nodeName: 'Elsewhere', probability: 0.4 },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const result = await runFailurePrediction(request, raw, 'Demo pump', ids);
    expect(result.modelSource).toBe('js-fallback');
    expect(result.affected.map((a) => a.nodeId)).toEqual(['dl-hospital-01', 'backend-only']);
    const hospital = result.affected[0];
    expect(hospital.ruleAdjusted).toBe(true);
    expect(hospital.onMap).toBe(true);
    expect(hospital.probability).toBeUndefined();
    expect(hospital.timeToImpact).toBeUndefined();
    expect(result.affected[1].onMap).toBe(false);
    expect(result.assessment.affectedPopulation).toBeUndefined();
  });

  it('reports an unknown engine when modelSource is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, impact: {} }))));
    const result = await runFailurePrediction(request, raw, 'Demo pump', ids);
    expect(result.modelSource).toBe('unknown');
  });
});

describe('buildTimelineFrames', () => {
  const base: SimulationResult = {
    modelSource: 'python-model',
    modelError: null,
    requestedNodeId: 's',
    sourceNodeId: 's',
    affected: [],
    propagation: [],
    assessment: { priorityActions: [] },
  };
  const node = (nodeId: string, timeToImpact?: number, onMap = true) => ({
    nodeId,
    nodeName: nodeId,
    timeToImpact,
    forceFail: false,
    ruleAdjusted: false,
    effects: [],
    recommendations: [],
    metrics: {},
    onMap,
  });

  it('groups on-map nodes by predicted time-to-impact', () => {
    const frames = buildTimelineFrames({
      ...base,
      affected: [node('a', 2), node('b', 1), node('c', 2), node('off', 0, false)],
    });
    expect(frames.map((f) => f.revealedNodeIds)).toEqual([[], [], ['b'], ['b', 'a', 'c']]);
    expect(frames[0].sourceFailed).toBe(false);
  });

  it('falls back to backend order when timing is missing', () => {
    const frames = buildTimelineFrames({ ...base, affected: [node('a'), node('b', 3)] });
    expect(frames.slice(2).map((f) => f.revealedNodeIds)).toEqual([['a'], ['a', 'b']]);
  });
});

describe('ruleBasedInterpreter', () => {
  const backendScenarios: FailureScenarioOption[] = [
    { id: 'outage', name: 'Power Outage', applicableTo: ['power'] },
    { id: 'leak', name: 'Water Leak', applicableTo: ['tank', 'pump', 'pipe'] },
    { id: 'failure', name: 'Component Failure', applicableTo: ['power', 'tank', 'pump', 'pipe', 'hospital'] },
  ];
  const ctx = { assets, scenarios: backendScenarios, selectedId: null };

  it('asks which pump when several match and reports on hospitals', async () => {
    const r = await ruleBasedInterpreter.interpret(
      'Simulate a severe pump failure and identify which hospitals and residential areas may lose water access.',
      ctx,
    );
    expect(r.status).toBe('needs-clarification');
    expect(r.targetType).toBe('pump');
    expect(r.candidateIds.length).toBeGreaterThan(1);
    expect(r.severity).toBe('high');
    expect(r.focusTypes).toContain('hospital');
    expect(r.assumptions.join(' ')).toMatch(/Residential areas are not modelled/);
  });

  it('targets the asset type nearest the failure word and narrows by name', async () => {
    const r = await ruleBasedInterpreter.interpret('What happens to schools if the Janpath transformer has an outage?', ctx);
    expect(r.targetType).toBe('power');
    expect(r.status).toBe('ready');
    expect(r.targetId).toBe('dl-power-02');
    expect(r.failureTypeId).toBe('outage');
    expect(r.focusTypes).toEqual(['school']);
    expect(validateInterpretation(r, ctx)).toEqual({ ok: true });
  });

  it('refuses interventions the engine cannot model', async () => {
    const r = await ruleBasedInterpreter.interpret(
      'Compare the current situation with a scenario in which a backup pump is activated.',
      ctx,
    );
    expect(r.status).toBe('unsupported');
    expect(r.unsupportedReason).toBeTruthy();
  });

  it('works with the built-in failure list when the backend list is unavailable', async () => {
    const r = await ruleBasedInterpreter.interpret('critical failure of the Barakhamba substation', {
      ...ctx,
      scenarios: FALLBACK_FAILURE_TYPES,
    });
    expect(r.severity).toBe('critical');
    expect(r.failureTypeId).toBe('Complete Failure');
  });

  it('rejects interpretations that target assets outside the dataset', () => {
    const check = validateInterpretation(
      {
        status: 'ready',
        action: 'simulate-failure',
        targetType: 'pump',
        candidateIds: [],
        targetId: 'not-a-real-asset',
        failureTypeId: 'failure',
        severity: 'high',
        focusTypes: [],
        assumptions: [],
        questions: [],
        interpreter: 'test',
      },
      ctx,
    );
    expect(check.ok).toBe(false);
  });
});

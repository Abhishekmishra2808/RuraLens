/**
 * Contract test against a running backend. Skipped unless TWIN_BACKEND_URL is set:
 *   TWIN_BACKEND_URL=http://localhost:3001 npx vitest run twin.backend
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../../config/api';
import { buildTwinAssets, collapseEdges, fetchBackendGraph, fetchFailureScenarios } from '../twinData';
import { buildTimelineFrames, runFailurePrediction } from '../simulationAdapter';
import { delhiDemoInfraData } from '../../data/delhiDemoInfra';

const BACKEND: string | undefined = (globalThis as any).process?.env?.TWIN_BACKEND_URL;

describe.skipIf(!BACKEND)('backend contract (Delhi demo dataset)', () => {
  const raw = JSON.parse(JSON.stringify(delhiDemoInfraData));
  const { assets } = buildTwinAssets(raw, 'synthetic-demo');
  const ids = new Set(assets.map((a) => a.id));

  beforeAll(() => {
    const realFetch = globalThis.fetch;
    vi.stubGlobal('fetch', (url: RequestInfo | URL, init?: RequestInit) =>
      realFetch(String(url).replace(API_URL, BACKEND as string), init),
    );
  });
  afterAll(() => vi.unstubAllGlobals());

  it('builds a graph whose nodes are the dataset assets', async () => {
    const { nodes, edges } = await fetchBackendGraph(raw);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const missing = assets.filter((a) => !nodeIds.has(a.id)).map((a) => `${a.type}:${a.id}`);
    console.log(`backend nodes=${nodes.length} edges=${edges.length}; dataset assets not in graph: ${missing.join(', ') || 'none'}`);

    const twinEdges = collapseEdges(edges, ids);
    const dependency = twinEdges.filter((e) => e.kind === 'dependency');
    console.log(
      `collapsed: ${twinEdges.length} pairs, ${dependency.length} dependency; relations: ${Array.from(
        new Set(dependency.flatMap((e) => e.relations)),
      ).join(' | ')}`,
    );
    expect(nodes.length).toBeGreaterThan(0);
    expect(dependency.length).toBeGreaterThan(0);
  });

  it('lists failure scenarios', async () => {
    const scenarios = await fetchFailureScenarios();
    expect(scenarios.length).toBeGreaterThan(0);
  });

  it('runs a pump failure through /api/gnn/predict-structured', async () => {
    const result = await runFailurePrediction(
      {
        targetAssetId: 'dl-pump-01',
        failureType: 'failure',
        failureTypeLabel: 'Component Failure',
        severity: 'high',
        origin: { kind: 'manual' },
      },
      raw,
      assets.find((a) => a.id === 'dl-pump-01')!.name,
      ids,
    );
    const frames = buildTimelineFrames(result);
    console.log(
      `modelSource=${result.modelSource} source=${result.sourceNodeId} affected=${result.affected.length} ` +
        `(on map ${result.affected.filter((a) => a.onMap).length}, rule-adjusted ${result.affected.filter((a) => a.ruleAdjusted).length}) ` +
        `propagation=${result.propagation.length} frames=${frames.length}` +
        (result.modelError ? ` modelError=${result.modelError}` : ''),
    );
    expect(result.sourceNodeId).toBe('dl-pump-01');
    expect(['python-model', 'js-fallback']).toContain(result.modelSource);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildTwinContext,
  CopilotRequestError,
  proposalToInterpretation,
  sendCopilotMessage,
  type CopilotProposal,
} from '../copilotClient';
import { buildTwinAssets } from '../twinData';
import { validateInterpretation } from '../scenarioInterpreter';
import { delhiDemoInfraData } from '../../data/delhiDemoInfra';
import type { FailureScenarioOption } from '../../types/twin';

const raw = JSON.parse(JSON.stringify(delhiDemoInfraData));
const { assets } = buildTwinAssets(raw, 'synthetic-demo');
const scenarios: FailureScenarioOption[] = [
  { id: 'outage', name: 'Power Outage', applicableTo: ['power'] },
  { id: 'failure', name: 'Component Failure', applicableTo: ['power', 'tank', 'pump', 'pipe', 'hospital'] },
];
const ctx = { assets, scenarios, selectedId: null };

const proposal = (overrides: Partial<CopilotProposal> = {}): CopilotProposal => ({
  action: 'simulate-failure',
  targetAssetId: 'dl-power-02',
  targetName: 'Janpath transformer',
  failureType: 'outage',
  failureTypeLabel: 'Power Outage',
  severity: 'high',
  focusTypes: ['school'],
  rationale: 'Schools near Janpath draw power from this transformer.',
  ...overrides,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Copilot proposals', () => {
  it('become a ready scenario that still needs the user to confirm and passes validation', () => {
    const scenario = proposalToInterpretation(proposal(), ctx);
    expect(scenario.status).toBe('ready');
    expect(scenario.targetId).toBe('dl-power-02');
    expect(scenario.interpreter).toBe('amazon-bedrock');
    expect(scenario.assumptions.join(' ')).toMatch(/Schools near Janpath/);
    expect(validateInterpretation(scenario, ctx)).toEqual({ ok: true });
  });

  it('are refused when the asset is not in the active dataset', () => {
    const scenario = proposalToInterpretation(proposal({ targetAssetId: 'pune-tank-1', targetName: 'Pune tank' }), ctx);
    expect(scenario.status).toBe('unsupported');
    expect(scenario.targetId).toBeNull();
    expect(scenario.unsupportedReason).toMatch(/not in the active dataset/);
  });

  it('fail validation when the failure type is unknown to the prediction backend', () => {
    const scenario = proposalToInterpretation(proposal({ failureType: 'meteor' }), ctx);
    expect(validateInterpretation(scenario, ctx).ok).toBe(false);
  });
});

describe('Copilot request', () => {
  it('sends only the fields the backend schema accepts and keeps provenance', () => {
    const twin = buildTwinContext('delhi', 'delhi-demo', assets, raw);
    expect(twin.assets).toHaveLength(assets.length);
    for (const a of twin.assets) {
      expect(Object.keys(a).sort()).toEqual(expect.arrayContaining(['id', 'name', 'provenance', 'type']));
      expect(a.provenance).toBe('synthetic-demo');
    }
    expect(twin.infraState.pumps).toBe(twin.infraState.waterPumps);
  });

  it('sends the bearer token and surfaces backend error codes without inventing an answer', async () => {
    const store = new Map([['token', 'test-token']]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Amazon Bedrock is throttling requests.', code: 'throttled', retryable: true }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await sendCopilotMessage([{ role: 'user', content: 'Which hospitals depend on pump 1?' }], undefined).catch((e) => e);
    expect(error).toBeInstanceOf(CopilotRequestError);
    expect(error.code).toBe('throttled');
    expect(error.retryable).toBe(true);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(init.body).messages).toEqual([{ role: 'user', content: 'Which hospitals depend on pump 1?' }]);
  });

  it('drops leading assistant turns so the conversation starts with the user', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    await sendCopilotMessage(
      [
        { role: 'assistant', content: 'Earlier answer' },
        { role: 'user', content: 'Next question' },
      ],
      undefined,
    ).catch(() => undefined);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages).toEqual([{ role: 'user', content: 'Next question' }]);
  });
});

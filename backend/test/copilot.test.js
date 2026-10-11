import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenFor, startApp, sampleScheme } from './helpers.js';
import { buildCopilotTools, MAX_TOOL_CALLS } from '../services/copilot/copilotTools.js';
import { runCopilotTurn, createBedrockModel, toAgentHistory } from '../services/copilot/copilotService.js';
import { createCopilotRouter } from '../routes/copilot.js';
import { readBedrockConfig } from '../services/ai/bedrockConfig.js';

const SCENARIOS = [
  { id: 'outage', name: 'Power Outage', applicableTo: ['power'] },
  { id: 'leak', name: 'Water Leak', applicableTo: ['tank', 'pump', 'pipe'] },
  { id: 'failure', name: 'Component Failure', applicableTo: ['power', 'tank', 'pump', 'hospital'] },
];

function fakeDeps({ scheme = sampleScheme(), graphNodes = ['tx-1', 'pump-1', 'hosp-1'] } = {}) {
  const calls = { predict: [], sync: 0, find: [] };
  const withReport = {
    ...scheme,
    vendorReports: [
      {
        id: 'VR-1',
        vendorName: 'Acme Works',
        verificationStatus: 'under-review',
        complianceAnalysis: {
          discrepancies: [{ id: 'f-1', source: 'deterministic', type: 'budget_overrun', severity: 'high', title: 'Over budget', reviewStatus: 'pending-review' }],
        },
      },
    ],
  };
  return {
    calls,
    deps: {
      schemes: {
        find: async (filter, limit) => {
          calls.find.push({ filter, limit });
          return [withReport];
        },
        findById: async (id) => (id === withReport.id ? withReport : null),
      },
      gnn: {
        syncGraph: () => {
          calls.sync += 1;
        },
        hasNode: (id) => graphNodes.includes(id),
        getNodes: () => graphNodes.map((id) => ({ id, name: id, type: 'x' })),
        getEdges: () => [
          { source: 'tx-1', target: 'pump-1', type: 'power', relationship: 'supplies' },
          { source: 'pump-1', target: 'hosp-1', type: 'proximity' },
        ],
        getScenarios: () => SCENARIOS,
        predict: async (nodeId, failureType, severity) => {
          calls.predict.push({ nodeId, failureType, severity });
          return {
            modelSource: 'js-fallback',
            modelError: 'down',
            impact: { totalAffected: 1, affectedNodes: [{ nodeId: 'pump-1', nodeName: 'Pump', severity: 'high', probability: 0.8 }] },
          };
        },
      },
    },
  };
}

const twin = {
  datasetId: 'delhi-demo',
  assets: [
    { id: 'tx-1', name: 'Janpath Transformer', type: 'power', provenance: 'synthetic-demo' },
    { id: 'pump-1', name: 'CP Pump', type: 'pump', provenance: 'synthetic-demo' },
    { id: 'hosp-1', name: 'City Hospital', type: 'hospital', provenance: 'synthetic-demo' },
    { id: 'off-graph', name: 'Detached Tank', type: 'tank', provenance: 'user-added' },
  ],
  infraState: { powerNodes: [{ id: 'tx-1' }] },
};

function toolsFor(role, options = {}) {
  const { deps, calls } = fakeDeps(options);
  const collector = { sources: [], proposals: [], calls: [], graphSynced: false };
  const tools = Object.fromEntries(buildCopilotTools({ user: { userId: 'u1', role }, twin: 'twin' in options ? options.twin : twin, deps, collector }).map((t) => [t.name, t]));
  return { tools, collector, calls };
}

test('tools: vendor findings are refused for citizens and allowed for officials', async () => {
  const citizen = toolsFor('user');
  const denied = await citizen.tools.get_vendor_findings.invoke({ schemeId: 'SCHEME-TEST-1' });
  assert.equal(denied.error, 'forbidden');
  assert.equal(citizen.collector.sources.length, 0);

  const official = toolsFor('field_worker');
  const allowed = await official.tools.get_vendor_findings.invoke({ schemeId: 'SCHEME-TEST-1' });
  assert.equal(allowed.dataKind, 'findings_for_review');
  assert.equal(allowed.reports[0].findings[0].reviewStatus, 'pending-review');
  assert.equal(official.collector.sources[0].id, 'vendor-report-VR-1');
});

test('tools: arguments are validated by schema before any callback runs', async () => {
  const { tools, calls } = toolsFor('admin');
  await assert.rejects(tools.predict_failure_impact.invoke({ assetId: 'tx-1', failureType: 'outage', severity: 'extreme' }));
  await assert.rejects(tools.predict_failure_impact.invoke({ assetId: 'tx-1; drop', failureType: 'outage', severity: 'high' }));
  await assert.rejects(tools.search_schemes.invoke({ limit: 500 }));
  assert.equal(calls.predict.length, 0);
});

test('tools: search escapes regular expressions in user text', async () => {
  const { tools, calls } = toolsFor('user');
  await tools.search_schemes.invoke({ query: 'water.*(' });
  const pattern = calls.find[0].filter.$or[0].name;
  assert.equal(pattern.source, 'water\\.\\*\\(');
});

test('tools: predictions never fall back to a different asset', async () => {
  const { tools, calls } = toolsFor('user');
  assert.equal((await tools.predict_failure_impact.invoke({ assetId: 'nope', failureType: 'failure', severity: 'high' })).error, 'asset_not_found');
  assert.equal((await tools.predict_failure_impact.invoke({ assetId: 'off-graph', failureType: 'leak', severity: 'high' })).error, 'asset_not_in_graph');
  assert.equal((await tools.predict_failure_impact.invoke({ assetId: 'tx-1', failureType: 'leak', severity: 'high' })).error, 'failure_type_not_applicable');
  assert.equal(calls.predict.length, 0);
});

test('tools: predictions are grounded in the prediction service and labelled', async () => {
  const { tools, calls, collector } = toolsFor('user');
  const result = await tools.predict_failure_impact.invoke({ assetId: 'tx-1', failureType: 'outage', severity: 'high' });
  assert.deepEqual(calls.predict, [{ nodeId: 'tx-1', failureType: 'outage', severity: 'high' }]);
  assert.equal(calls.sync, 1);
  assert.equal(result.dataKind, 'prediction');
  assert.equal(result.modelSource, 'js-fallback');
  assert.match(result.modelSourceNote, /not trained GNN output/);
  assert.match(result.target.provenance, /synthetic demonstration/);
  assert.equal(result.totalAffected, 1);
  assert.equal(collector.sources[0].type, 'prediction');
});

test('tools: proposing a simulation does not run it and requires confirmation', async () => {
  const { tools, calls, collector } = toolsFor('user');
  const result = await tools.propose_map_simulation.invoke({ assetId: 'tx-1', failureType: 'outage', severity: 'critical', rationale: 'User asked' });
  assert.equal(result.requiresUserConfirmation, true);
  assert.equal(calls.predict.length, 0);
  assert.deepEqual(collector.proposals[0], {
    action: 'simulate-failure',
    targetAssetId: 'tx-1',
    targetName: 'Janpath Transformer',
    failureType: 'outage',
    failureTypeLabel: 'Power Outage',
    severity: 'critical',
    focusTypes: [],
    rationale: 'User asked',
  });
});

test('tools: dependencies exclude proximity links; missing twin is reported', async () => {
  const { tools } = toolsFor('user');
  const deps = await tools.get_asset_dependencies.invoke({ assetId: 'pump-1' });
  assert.equal(deps.incoming.length, 1);
  assert.equal(deps.outgoing.length, 0);
  const noTwin = toolsFor('user', { twin: null });
  assert.equal((await noTwin.tools.list_infrastructure_assets.invoke({})).error, 'twin_unavailable');
});

test('tools: the per-question tool budget is enforced', async () => {
  const { tools } = toolsFor('user');
  for (let i = 0; i < MAX_TOOL_CALLS; i += 1) await tools.list_infrastructure_assets.invoke({});
  assert.equal((await tools.list_infrastructure_assets.invoke({})).error, 'tool_budget_exhausted');
});

test('history: conversation is trimmed to alternate roles starting with the user', () => {
  const history = toAgentHistory([
    { role: 'assistant', content: 'hello' },
    { role: 'user', content: 'a' },
    { role: 'user', content: 'b' },
    { role: 'assistant', content: 'c' },
    { role: 'user', content: 'd' },
  ]);
  assert.deepEqual(
    history.map((m) => [m.role, m.content[0].text]),
    [['user', 'a\n\nb'], ['assistant', 'c'], ['user', 'd']],
  );
});

const CONFIG = readBedrockConfig({ AWS_REGION: 'us-east-1', BEDROCK_MODEL_ID: 'amazon.nova-lite-v1:0' });

function bedrockModelWith(responses, requests) {
  return (config) => {
    const model = createBedrockModel(config);
    // Replace the SDK client so no AWS call is made; responses use the Converse API shape.
    model._client = {
      send: async (command) => {
        requests.push(command.input);
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next;
      },
    };
    return model;
  };
}

test('agent: runs a Strands turn over Bedrock Converse with tools and grounded sources', async () => {
  const requests = [];
  const responses = [
    {
      stopReason: 'tool_use',
      output: { message: { role: 'assistant', content: [{ toolUse: { toolUseId: 'call-1', name: 'list_infrastructure_assets', input: { type: 'power' } } }] } },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    },
    {
      stopReason: 'end_turn',
      output: { message: { role: 'assistant', content: [{ text: 'There is one synthetic demonstration transformer: Janpath Transformer.' }] } },
      usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
    },
  ];
  const { deps } = fakeDeps();
  const result = await runCopilotTurn({
    user: { userId: 'u1', role: 'user' },
    messages: [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
      { role: 'user', content: 'Which transformers are there?' },
    ],
    twin,
    deps,
    config: CONFIG,
    createModel: bedrockModelWith(responses, requests),
  });

  assert.match(result.answer, /Janpath Transformer/);
  assert.deepEqual(result.toolCalls, [{ name: 'list_infrastructure_assets', ok: true }]);
  assert.deepEqual(result.sources.map((s) => s.id), ['asset-tx-1']);
  assert.equal(result.model.modelId, 'amazon.nova-lite-v1:0');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].modelId, 'amazon.nova-lite-v1:0');
  assert.equal(requests[0].messages.length, 3, 'prior conversation plus the new question');
  assert.ok(requests[0].toolConfig.tools.some((t) => t.toolSpec.name === 'predict_failure_impact'));
});

test('agent: the model provider follows BEDROCK_API', () => {
  assert.equal(createBedrockModel(CONFIG).constructor.name, 'BedrockModel');
  const openaiConfig = readBedrockConfig({
    AWS_REGION: 'us-east-1',
    BEDROCK_MODEL_ID: 'openai.gpt-oss-120b',
    BEDROCK_API: 'openai',
    AWS_BEARER_TOKEN_BEDROCK: 'ABSKtest',
  });
  const model = createBedrockModel(openaiConfig);
  assert.equal(model.constructor.name, 'OpenAIModel');
  assert.equal(model.getConfig().modelId, 'openai.gpt-oss-120b');
});

test('agent: Bedrock failures surface as clear AI errors', async () => {
  const denied = Object.assign(new Error('denied'), { name: 'AccessDeniedException' });
  await assert.rejects(
    runCopilotTurn({
      user: { userId: 'u1', role: 'user' },
      messages: [{ role: 'user', content: 'Q' }],
      deps: fakeDeps().deps,
      config: CONFIG,
      createModel: bedrockModelWith([denied], []),
    }),
    (error) => error.code === 'access_denied',
  );
  await assert.rejects(
    runCopilotTurn({ user: { userId: 'u1', role: 'user' }, messages: [{ role: 'user', content: 'Q' }], deps: fakeDeps().deps, config: readBedrockConfig({}) }),
    (error) => error.code === 'not_configured',
  );
});

test('route: requires auth, validates input, and strips PII before the model', async () => {
  const seen = [];
  const router = createCopilotRouter({
    deps: fakeDeps().deps,
    getConfig: () => CONFIG,
    runTurn: async (args) => {
      seen.push(args);
      return { answer: 'ok', sources: [], proposals: [], toolCalls: [], model: {}, generatedAt: 'now' };
    },
  });
  const app = await startApp((a) => a.use('/api/copilot', router));
  try {
    const post = (body, token) =>
      fetch(`${app.url}/api/copilot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
    assert.equal((await post({ messages: [{ role: 'user', content: 'hi' }] })).status, 401);
    assert.equal((await post({ messages: [{ role: 'user', content: 'hi' }] }, 'not-a-jwt')).status, 401);
    assert.equal((await post({ messages: [] }, tokenFor('user'))).status, 400);
    assert.equal((await post({ messages: [{ role: 'assistant', content: 'x' }] }, tokenFor('user'))).status, 400);
    const bad = await post({ messages: [{ role: 'user', content: 'q' }], twin: { assets: [{ id: 'a', name: 'A', type: 'rocket', provenance: 'verified' }], infraState: {} } }, tokenFor('user'));
    assert.equal(bad.status, 400);

    const ok = await post({ messages: [{ role: 'user', content: 'Call me at 9876543210 or a@b.com' }] }, tokenFor('field_worker'));
    assert.equal(ok.status, 200);
    assert.equal(seen[0].user.role, 'field_worker');
    assert.doesNotMatch(seen[0].messages[0].content, /9876543210|a@b\.com/);
  } finally {
    await app.close();
  }
});

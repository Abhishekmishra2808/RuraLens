import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(backendDir, '..');

test('gnn: predictions work without any Bedrock configuration and never import it', async () => {
  for (const key of ['AWS_REGION', 'BEDROCK_MODEL_ID', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) delete process.env[key];
  process.env.PYTHON_GNN_API_URL = 'http://127.0.0.1:9';

  for (const file of ['routes/gnn.js', 'utils/gnnImpactService.js', 'python-gnn/api_server.py']) {
    const source = fs.readFileSync(path.join(backendDir, file), 'utf8');
    assert.doesNotMatch(source, /bedrock|strands/i, `${file} must stay independent of Bedrock`);
  }

  const originalWarn = console.warn;
  const originalLog = console.log;
  console.warn = () => {};
  console.log = () => {};
  try {
    const { predictImpactWithModelOrFallback, syncGraphFromRequestState } = await import('../routes/gnn.js');
    syncGraphFromRequestState({
      infraState: {
        waterTanks: [{ id: 'tank-1', name: 'Tank 1', coords: [77.21, 28.63], capacity: 1000, currentLevel: 800, status: 'good' }],
        waterPumps: [{ id: 'pump-1', name: 'Pump 1', coords: [77.211, 28.631], status: 'good' }],
        powerNodes: [{ id: 'power-1', name: 'Transformer', coords: [77.212, 28.632], type: 'transformer', status: 'good' }],
        buildings: [{ id: 'hosp-1', name: 'Hospital', type: 'health', coords: [77.213, 28.633] }],
      },
    });
    const result = await predictImpactWithModelOrFallback('power-1', 'outage', 'high');
    assert.equal(result.modelSource, 'js-fallback', 'labelled as fallback when the trained model is unreachable');
    assert.match(result.modelError, /unavailable/);
    assert.ok(Array.isArray(result.impact.affectedNodes));
  } finally {
    console.warn = originalWarn;
    console.log = originalLog;
  }
});

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'android', 'ios', '.agents', '__pycache__', 'build', 'coverage']);
const TEXT_EXT = /\.(js|mjs|cjs|ts|tsx|jsx|json|py|txt|md|ya?ml|toml|env|example|html|css|sh|ps1)$|Dockerfile$|\.npmrc$/;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name));
    } else if (TEXT_EXT.test(entry.name) || entry.name.startsWith('.env')) {
      yield path.join(dir, entry.name);
    }
  }
}

test('pathway: no Pathway code, configuration, scripts, or docs remain', () => {
  const self = fileURLToPath(import.meta.url);
  const offenders = [];
  for (const file of walk(repoRoot)) {
    if (file === self || /package-lock\.json$/.test(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      // "Field Pathway" is the name of a walking path asset in the Pune sample dataset.
      if (/pathway/i.test(line) && !/Field Pathway/.test(line)) offenders.push(`${path.relative(repoRoot, file)}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
  for (const removed of ['docker-compose.pathway.yml', 'backend/pathway-rag', 'backend/utils/pathwayClient.js', 'backend/utils/pathwayPdfService.js']) {
    assert.equal(fs.existsSync(path.join(repoRoot, removed)), false, `${removed} should be deleted`);
  }
});

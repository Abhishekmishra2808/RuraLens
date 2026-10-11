import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenFor, startApp, buildPdf, sampleScheme } from './helpers.js';
import { createVendorReportRouter } from '../routes/vendorReports.js';
import { createReportRepository } from '../services/vendorComparison/reportRepository.js';
import { AIServiceError } from '../services/ai/aiErrors.js';

const VENDOR_PDF = buildPdf([
  'PROGRESS REPORT\nContractor: Acme Infra Pvt Ltd\nReport for Phase 2 dated 15/08/2025',
  'Total expenditure claimed: Rs. 12,50,000\nExpected completion date: 30/09/2025',
]);

/** In-memory stand-in for the Mongoose Scheme model's updateOne/findOne semantics used by the repository. */
function memorySchemeModel(scheme) {
  const state = { scheme: structuredClone(scheme), updates: 0 };
  return {
    state,
    findOne: ({ id }) => {
      const found = state.scheme.id === id ? state.scheme : null;
      return { lean: async () => structuredClone(found), then: (resolve) => resolve(found) };
    },
    updateOne: async (filter, update, options = {}) => {
      const s = state.scheme;
      if (filter.id !== s.id) return { matchedCount: 0, modifiedCount: 0 };
      const guard = filter['vendorReports.documentSha256'];
      if (guard?.$ne && s.vendorReports.some((r) => r.documentSha256 === guard.$ne)) return { matchedCount: 0, modifiedCount: 0 };
      if (filter['vendorReports.id']) {
        const index = s.vendorReports.findIndex((r) => r.id === filter['vendorReports.id']);
        if (index === -1) return { matchedCount: 0, modifiedCount: 0 };
        s.vendorReports[index] = structuredClone(update.$set['vendorReports.$']);
      }
      if (update.$push) s.vendorReports.push(structuredClone(update.$push.vendorReports));
      if (update.$inc?.budgetUtilized) s.budgetUtilized += update.$inc.budgetUtilized;
      if (update.$inc?.['phases.$[reported].spent']) {
        const phase = s.phases.find((p) => p.id === options.arrayFilters[0]['reported.id']);
        if (phase) phase.spent += update.$inc['phases.$[reported].spent'];
      }
      state.updates += 1;
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };
}

test('repository: a retried insert of the same PDF is rejected atomically and spend is counted once', async () => {
  const model = memorySchemeModel(sampleScheme());
  const repo = createReportRepository(model);
  const record = { id: 'VR-1', documentSha256: 'abc', expenseClaimed: 100, phase: 2 };
  assert.equal(await repo.insertReportOnce('SCHEME-TEST-1', record), true);
  assert.equal(await repo.insertReportOnce('SCHEME-TEST-1', { ...record, id: 'VR-2' }), false);
  assert.equal(model.state.scheme.vendorReports.length, 1);
  assert.equal(model.state.scheme.budgetUtilized, 4000100);
  assert.equal(model.state.scheme.phases[1].spent, 2800100);
});

function harness({ bedrock } = {}) {
  const model = memorySchemeModel(sampleScheme());
  const stored = new Map();
  const documents = {
    storePdf: async ({ buffer, filename }) => {
      const id = `file-${stored.size + 1}`;
      stored.set(id, buffer);
      return { fileId: id, sha256: 'ignored-by-route', size: buffer.length, filename };
    },
    readPdf: async (id) => ({ buffer: stored.get(id), filename: 'x.pdf', metadata: {} }),
  };
  const saves = [];
  const repository = {
    ...createReportRepository(model),
    loadForUpdate: async () => {
      const doc = model.state.scheme;
      Object.defineProperty(doc, 'save', {
        value: async () => saves.push(structuredClone(doc)),
        enumerable: false,
        configurable: true,
      });
      return doc;
    },
  };
  const router = createVendorReportRouter({
    repository,
    documents,
    bedrock:
      bedrock ??
      {
        enabled: true,
        config: { modelId: 'm', region: 'r' },
        generateStructured: async () => {
          throw new AIServiceError('access_denied', 'Bedrock denied access to m in r.', { httpStatus: 503 });
        },
      },
    now: () => new Date('2025-08-20T00:00:00Z'),
  });
  return { model, router, saves, stored };
}

async function upload(url, pdf, token) {
  const form = new FormData();
  form.append('pdf', new Blob([pdf], { type: 'application/pdf' }), 'report.pdf');
  return fetch(`${url}/api/schemes/SCHEME-TEST-1/vendor-report`, {
    method: 'POST',
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

test('vendor routes: auth, unreadable PDFs, honest AI failure, duplicates, and review', async () => {
  const { model, router, saves } = harness();
  const app = await startApp((a) => a.use('/api/schemes', router));
  try {
    assert.equal((await upload(app.url, VENDOR_PDF)).status, 401);
    assert.equal((await upload(app.url, VENDOR_PDF, tokenFor('user'))).status, 403);
    assert.equal((await upload(app.url, VENDOR_PDF, tokenFor('field_worker'))).status, 403);

    const scanned = await upload(app.url, buildPdf(['']), tokenFor('admin'));
    assert.equal(scanned.status, 422);
    assert.equal((await scanned.json()).code, 'pdf_scanned');

    const created = await upload(app.url, VENDOR_PDF, tokenFor('admin'));
    assert.equal(created.status, 201);
    const body = await created.json();
    assert.equal(body.ai.status, 'failed');
    assert.match(body.warnings[0], /Bedrock denied access/);
    assert.equal(body.report.complianceAnalysis.aiProcessed, false);
    assert.equal(body.report.complianceAnalysis.overallCompliance, null);
    assert.ok(body.report.complianceAnalysis.discrepancies.every((f) => f.source === 'deterministic' && f.reviewStatus === 'pending-review'));
    assert.equal(body.report.expenseClaimed, 1250000);
    assert.equal(model.state.scheme.budgetUtilized, 5250000);

    const retry = await upload(app.url, VENDOR_PDF, tokenFor('admin'));
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);
    assert.equal(model.state.scheme.vendorReports.length, 1, 'retry did not create a second report');
    assert.equal(model.state.scheme.budgetUtilized, 5250000, 'retry did not double-count spend');

    const report = model.state.scheme.vendorReports[0];
    const finding = report.complianceAnalysis.discrepancies.find((f) => f.severity === 'high' || f.severity === 'critical');
    const review = await fetch(`${app.url}/api/schemes/SCHEME-TEST-1/vendor-reports/${report.id}/findings/${finding.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor('admin', 'official-7')}` },
      body: JSON.stringify({ reviewStatus: 'confirmed', note: 'Invoices checked' }),
    });
    assert.equal(review.status, 200);
    const saved = saves.at(-1);
    const savedFinding = saved.vendorReports[0].complianceAnalysis.discrepancies.find((f) => f.id === finding.id);
    assert.equal(savedFinding.reviewedBy, 'official-7');
    assert.equal(saved.status, 'discrepant', 'only an official confirmation marks the scheme discrepant');
    assert.equal(saved.discrepancies.filter((d) => d.id === `vr-${finding.id}`).length, 1);

    const reanalyze = await fetch(`${app.url}/api/schemes/SCHEME-TEST-1/vendor-reports/${report.id}/reanalyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenFor('admin')}` },
    });
    assert.equal(reanalyze.status, 200);
    const after = model.state.scheme.vendorReports;
    assert.equal(after.length, 1);
    assert.equal(after[0].complianceAnalysis.discrepancies.find((f) => f.id === finding.id).reviewStatus, 'confirmed');
    assert.equal(model.state.scheme.budgetUtilized, 5250000, 're-analysis does not add spend again');
  } finally {
    await app.close();
  }
});

test('vendor routes: re-analysis explains when the original PDF was never stored', async () => {
  const { model, router } = harness();
  model.state.scheme.vendorReports.push({ id: 'VR-OLD', pdfFileName: 'old.pdf', complianceAnalysis: { discrepancies: [] } });
  const app = await startApp((a) => a.use('/api/schemes', router));
  try {
    const res = await fetch(`${app.url}/api/schemes/SCHEME-TEST-1/vendor-reports/VR-OLD/reanalyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenFor('admin')}` },
    });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).code, 'document_missing');
  } finally {
    await app.close();
  }
});

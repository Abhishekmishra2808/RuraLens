import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPdf, sampleScheme } from './helpers.js';
import { extractPdfPages } from '../services/documents/pdfText.js';
import { extractFacts, parseAmounts, parseDates, pickClaimedTotal } from '../services/vendorComparison/evidence.js';
import { budgetVariance, daysBetween, severityForOverrun, severityForDelay, runDeterministicChecks } from '../services/vendorComparison/deterministic.js';
import { verifyAiFindings, selectRelevantExcerpts, aiComparisonSchema } from '../services/vendorComparison/aiComparison.js';
import { analyzeVendorReport, buildReportRecord } from '../services/vendorComparison/index.js';
import { AIServiceError } from '../services/ai/aiErrors.js';

const VENDOR_PAGES = [
  { page: 1, text: 'PROGRESS REPORT\nContractor: Acme Infra Pvt Ltd\nReport for Phase 2 dated 15/08/2025' },
  {
    page: 2,
    text: 'EXPENDITURE\nTotal expenditure claimed: Rs. 12,50,000\nPipeline laid: 9 km of pipeline\nExpected completion date: 30/09/2025\nPhysical progress 85%',
  },
];

test('pdf: empty, malformed, and scanned files get explicit statuses', async () => {
  assert.equal((await extractPdfPages(Buffer.alloc(0))).status, 'empty');
  assert.equal((await extractPdfPages(Buffer.from('not a pdf at all'))).status, 'malformed');
  const scanned = await extractPdfPages(buildPdf(['', '']));
  assert.equal(scanned.status, 'scanned');
  assert.match(scanned.message, /OCR is not supported/);
  const broken = await extractPdfPages(Buffer.from('%PDF-1.4 garbage'), {
    parse: Object.assign(async () => {
      throw new Error('bad xref');
    }, { DEFAULT_OPTIONS: {} }),
  });
  assert.equal(broken.status, 'malformed');
});

test('pdf: text is extracted per page and long documents are marked truncated', async () => {
  const pdf = buildPdf(['Scheme plan page one with budget details', 'Second page lists milestones and dates', 'Third page annexure']);
  const all = await extractPdfPages(pdf);
  assert.equal(all.status, 'ok');
  assert.equal(all.numPages, 3);
  assert.match(all.pages[1].text, /milestones/);
  assert.equal(all.pages[1].page, 2);

  const limited = await extractPdfPages(pdf, { maxPages: 2 });
  assert.equal(limited.truncated, true);
  assert.equal(limited.pages.length, 2);
});

test('evidence: amounts, dates, and facts keep page and quote', () => {
  assert.deepEqual(parseAmounts('Total Rs. 12,50,000 and ₹2.5 crore and 45 lakh').map((a) => a.value), [1250000, 25000000, 4500000]);
  assert.deepEqual(parseDates('Due 30/09/2025, revised 15 March 2026, ISO 2025-01-31').map((d) => d.date), ['2025-01-31', '2025-09-30', '2026-03-15']);
  assert.deepEqual(parseDates('Invalid 31/02/2025'), []);

  const facts = extractFacts(VENDOR_PAGES);
  assert.equal(facts.vendorName.value, 'Acme Infra Pvt Ltd');
  assert.equal(facts.phase.value, 2);
  const claimed = pickClaimedTotal(facts);
  assert.equal(claimed.value, 1250000);
  assert.equal(claimed.page, 2);
  assert.equal(claimed.quote, 'Total expenditure claimed: Rs. 12,50,000');
  assert.equal(claimed.section, 'EXPENDITURE');
});

test('deterministic: budget, date, and severity calculations are exact', () => {
  assert.deepEqual(budgetVariance(5000000, 5250000), { variance: 250000, variancePercentage: 5 });
  assert.equal(budgetVariance(0, 10).variancePercentage, null);
  assert.equal(budgetVariance(undefined, 10), null);
  assert.equal(daysBetween('2025-06-30', '2025-09-30'), 92);
  assert.equal(daysBetween('2025-06-30T23:00:00Z', '2025-07-01T01:00:00Z'), 1);
  assert.equal(daysBetween('bad', '2025-01-01'), null);
  assert.equal(severityForOverrun(30), 'critical');
  assert.equal(severityForOverrun(12), 'high');
  assert.equal(severityForOverrun(3), 'medium');
  assert.equal(severityForOverrun(-5), null);
  assert.equal(severityForDelay(120), 'high');
  assert.equal(severityForDelay(10), 'low');
});

test('deterministic: checks produce evidence-backed findings without inventing values', () => {
  const result = runDeterministicChecks({ scheme: sampleScheme(), vendorFacts: extractFacts(VENDOR_PAGES), asOf: new Date('2025-08-20') });
  const byType = (type) => result.findings.filter((f) => f.type === type);

  const [total, phase] = byType('budget_overrun');
  assert.equal(total.variance, 250000);
  assert.equal(total.variancePercentage, 5);
  assert.equal(total.vendorEvidence.page, 2);
  assert.equal(total.vendorEvidence.quote, 'Total expenditure claimed: Rs. 12,50,000');
  assert.deepEqual(total.planEvidence, { source: 'scheme-record', quote: null, page: null, section: 'Scheme record: total budget' });
  assert.equal(total.confidence, null);
  assert.equal(phase.variance, 1050000);
  assert.equal(phase.severity, 'critical');

  const [overdue] = byType('overdue_phase');
  assert.equal(overdue.variance, 51);
  assert.equal(overdue.vendorEvidence.quote, null);

  const [slip] = byType('schedule_slip');
  assert.equal(slip.reportedValue, '2025-09-30');
  assert.equal(slip.variance, 92);
  assert.deepEqual(result.budgetAnalysis, { plannedBudget: 5000000, claimedExpense: 1250000, priorUtilized: 4000000, variance: 250000, variancePercentage: 5 });
});

test('deterministic: quantities are compared only when the plan document lists the same item', () => {
  const planFacts = extractFacts([{ page: 3, text: 'Scope of work\nLay 12 km of pipeline' }]);
  const result = runDeterministicChecks({ scheme: sampleScheme(), vendorFacts: extractFacts(VENDOR_PAGES), planFacts, asOf: new Date('2025-08-20') });
  const qty = result.findings.find((f) => f.type === 'quantity_mismatch');
  assert.equal(qty.variance, -3);
  assert.equal(qty.planEvidence.page, 3);
  assert.equal(qty.vendorEvidence.page, 2);
});

test('ai verification: invented quotes, pages, and values are removed', () => {
  const vendorPages = [{ page: 2, text: 'Pipeline laid: 9 km of pipeline\nWater quality tests pending' }];
  const base = { severity: 'medium', description: 'Needs review of test status.', confidence: 0.7, plannedValue: null, reportedValue: null };
  const { findings, discarded } = verifyAiFindings(
    [
      { ...base, type: 'quality_concern', title: 'Tests pending', planEvidence: { quote: null, page: null, section: null }, vendorEvidence: { quote: 'Water quality tests pending', page: 7, section: null }, reportedValue: '40 tests' },
      { ...base, type: 'unsupported_claim', title: 'Invented', planEvidence: { quote: 'Plan requires 50 tests', page: 1, section: null }, vendorEvidence: { quote: 'Vendor completed everything', page: 2, section: null } },
    ],
    { planPages: [], vendorPages, recordText: 'Scheme: X', generatedAt: '2025-08-20T00:00:00.000Z', modelId: 'm' },
  );
  assert.equal(discarded, 1);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].vendorEvidence.page, 2, 'page corrected to where the quote actually appears');
  assert.equal(findings[0].reportedValue, null, 'value not present in the quote is dropped');
  assert.equal(findings[0].planEvidence.quote, null);
  assert.deepEqual(findings[0].modelSource, { provider: 'amazon-bedrock', modelId: 'm' });
  assert.equal(findings[0].variance, null);
});

test('ai excerpts: only relevant lines are sent, tagged with page numbers', () => {
  const { text } = selectRelevantExcerpts([{ page: 4, text: 'Weather was pleasant\nBudget utilised Rs. 5 lakh' }]);
  assert.equal(text, '[p.4]\nBudget utilised Rs. 5 lakh');
});

const fakeBedrock = (impl) => ({ enabled: true, config: { modelId: 'm', region: 'r' }, generateStructured: impl });

test('analysis: an AI failure is reported honestly and deterministic findings remain', async () => {
  const analysis = await analyzeVendorReport({
    scheme: sampleScheme(),
    vendorPages: VENDOR_PAGES,
    bedrock: fakeBedrock(async () => {
      throw new AIServiceError('throttled', 'Amazon Bedrock is throttling requests.', { retryable: true, httpStatus: 429 });
    }),
    now: new Date('2025-08-20'),
  });
  assert.equal(analysis.analysisStatus, 'deterministic_only');
  assert.equal(analysis.ai.status, 'failed');
  assert.deepEqual(analysis.ai.error, { code: 'throttled', message: 'Amazon Bedrock is throttling requests.', retryable: true });
  assert.equal(analysis.ai.findings.length, 0);
  assert.ok(analysis.deterministic.findings.length >= 3);

  const record = buildReportRecord({ id: 'VR-1', analysis, file: { fileId: 'f', sha256: 'h', filename: 'r.pdf' }, textMeta: {}, now: new Date('2025-08-20') });
  assert.equal(record.complianceAnalysis.aiProcessed, false);
  assert.equal(record.complianceAnalysis.overallCompliance, null, 'no fabricated compliance score');
  assert.equal(record.complianceAnalysis.aiSummary, null);
  assert.equal(record.verificationStatus, 'under-review', 'findings require official review; nothing is auto-approved or rejected');
});

test('analysis: unconfigured Bedrock is stated, not hidden', async () => {
  const analysis = await analyzeVendorReport({ scheme: sampleScheme(), vendorPages: VENDOR_PAGES, bedrock: { enabled: false }, now: new Date('2025-08-20') });
  assert.equal(analysis.ai.status, 'not_configured');
  assert.match(analysis.ai.error.message, /not configured/);
});

test('analysis: successful AI comparison adds verified, timestamped findings', async () => {
  const analysis = await analyzeVendorReport({
    scheme: sampleScheme(),
    vendorPages: VENDOR_PAGES,
    bedrock: fakeBedrock(async ({ prompt }) => {
      assert.match(prompt, /\[p\.2\]/);
      assert.doesNotMatch(prompt, /Acme Infra Pvt Ltd/, 'irrelevant lines are not sent');
      return {
        modelId: 'm',
        data: {
          summary: 'Progress claims need supporting measurement records.',
          matchingItems: ['Pipeline work is under way'],
          findings: [
            {
              type: 'unsupported_claim',
              severity: 'medium',
              title: 'Progress percentage lacks measurement detail',
              description: 'The report states physical progress without measurement records.',
              planEvidence: { quote: null, page: null, section: null },
              vendorEvidence: { quote: 'Physical progress 85%', page: 2, section: 'EXPENDITURE' },
              plannedValue: null,
              reportedValue: '85%',
              confidence: 0.6,
            },
          ],
        },
      };
    }),
    now: new Date('2025-08-20'),
  });
  assert.equal(analysis.analysisStatus, 'completed');
  const [finding] = analysis.ai.findings;
  assert.equal(finding.source, 'ai');
  assert.equal(finding.reportedValue, '85%');
  assert.ok(finding.generatedAt);
});

test('persistence: re-analysis keeps review decisions and does not duplicate findings', async () => {
  const run = (bedrock) => analyzeVendorReport({ scheme: sampleScheme(), vendorPages: VENDOR_PAGES, bedrock, now: new Date('2025-08-20') });
  const file = { fileId: 'f', sha256: 'h', filename: 'r.pdf' };
  const aiOk = fakeBedrock(async () => ({
    modelId: 'm',
    data: {
      summary: 's',
      matchingItems: [],
      findings: [
        {
          type: 'quality_concern',
          severity: 'low',
          title: 'Progress claim',
          description: 'Progress claim should be checked on site.',
          planEvidence: { quote: null, page: null, section: null },
          vendorEvidence: { quote: 'Physical progress 85%', page: 2, section: null },
          plannedValue: null,
          reportedValue: null,
          confidence: 0.5,
        },
      ],
    },
  }));
  const first = buildReportRecord({ id: 'VR-1', analysis: await run(aiOk), file, textMeta: {}, now: new Date('2025-08-20') });
  const reviewed = structuredClone(first);
  const target = reviewed.complianceAnalysis.discrepancies.find((f) => f.type === 'budget_overrun');
  Object.assign(target, { reviewStatus: 'confirmed', reviewedBy: 'admin-1', reviewNote: 'Checked invoices' });

  const failedAi = fakeBedrock(async () => {
    throw new AIServiceError('unavailable', 'down', { retryable: true });
  });
  const second = buildReportRecord({ existing: reviewed, analysis: await run(failedAi), file, textMeta: {}, now: new Date('2025-08-21') });
  const ids = second.complianceAnalysis.discrepancies.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate findings');
  assert.equal(ids.length, first.complianceAnalysis.discrepancies.length);
  const kept = second.complianceAnalysis.discrepancies.find((f) => f.id === target.id);
  assert.equal(kept.reviewStatus, 'confirmed');
  assert.equal(kept.reviewNote, 'Checked invoices');
  const previousAi = second.complianceAnalysis.discrepancies.find((f) => f.source === 'ai');
  assert.equal(String(previousAi.generatedAt), String(first.complianceAnalysis.discrepancies.find((f) => f.source === 'ai').generatedAt), 'old AI findings keep their original timestamp');
  assert.equal(second.aiAnalysis.status, 'failed');
  assert.equal(second.complianceAnalysis.aiProcessed, false);
  assert.equal(second.id, 'VR-1');
});

test('AI schema: page numbers returned as strings are read, anything else is rejected', () => {
  const withPage = (page) => ({
    summary: 'Summary',
    matchingItems: [],
    findings: [
      {
        type: 'other',
        severity: 'low',
        title: 'A finding',
        description: 'A finding for review.',
        planEvidence: { quote: null, page: null, section: null },
        vendorEvidence: { quote: 'q', page, section: null },
        plannedValue: null,
        reportedValue: null,
        confidence: 0.5,
      },
    ],
  });
  const pageOf = (page) => {
    const parsed = aiComparisonSchema.safeParse(withPage(page));
    return parsed.success ? parsed.data.findings[0].vendorEvidence.page : 'rejected';
  };
  assert.equal(pageOf(3), 3);
  assert.equal(pageOf('3'), 3);
  assert.equal(pageOf('p.3'), 3);
  assert.equal(pageOf('[p.3]'), 3);
  assert.equal(pageOf(null), null);
  assert.equal(pageOf('three'), 'rejected');
  assert.equal(pageOf('0'), 'rejected');
  assert.equal(pageOf('3-4'), 'rejected');
});

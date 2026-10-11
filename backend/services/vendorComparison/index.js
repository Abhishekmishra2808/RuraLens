import { extractFacts } from './evidence.js';
import { runDeterministicChecks } from './deterministic.js';
import { runAiComparison } from './aiComparison.js';
import { AIServiceError, classifyBedrockError } from '../ai/aiErrors.js';

export const REVIEW_STATUSES = ['pending-review', 'confirmed', 'dismissed'];
export const ANALYSIS_METHOD = 'deterministic+bedrock';

/**
 * Compares a vendor report with the scheme plan. Deterministic checks always
 * run; the Bedrock comparison runs when configured. An AI failure is reported
 * as such and never replaced with generated defaults.
 */
export async function analyzeVendorReport({ scheme, vendorPages, planPages = null, bedrock, now = new Date() }) {
  const vendorFacts = extractFacts(vendorPages);
  const planFacts = planPages ? extractFacts(planPages) : null;
  const deterministic = runDeterministicChecks({ scheme, vendorFacts, planFacts, asOf: now });

  const ai = {
    status: 'not_configured',
    error: null,
    modelSource: null,
    generatedAt: null,
    discardedUnverified: 0,
    summary: null,
    matchingItems: [],
    findings: [],
  };

  if (bedrock?.enabled) {
    try {
      const result = await runAiComparison({ bedrock, scheme, planPages, vendorPages, deterministicFindings: deterministic.findings });
      Object.assign(ai, {
        status: 'succeeded',
        modelSource: { provider: 'amazon-bedrock', modelId: result.modelId },
        generatedAt: result.generatedAt,
        discardedUnverified: result.discardedUnverified,
        summary: result.summary,
        matchingItems: result.matchingItems,
        findings: result.findings,
      });
    } catch (error) {
      const aiError = error instanceof AIServiceError ? error : classifyBedrockError(error, bedrock.config);
      ai.status = 'failed';
      ai.error = { code: aiError.code, message: aiError.message, retryable: aiError.retryable };
    }
  } else {
    ai.error = { code: 'not_configured', message: 'AI comparison is not configured on the server (Amazon Bedrock settings are missing).', retryable: false };
  }

  return {
    analysisStatus: ai.status === 'succeeded' ? 'completed' : 'deterministic_only',
    deterministic,
    ai,
    planEvidenceSource: planPages ? 'plan-document' : 'scheme-record',
  };
}

const REVIEW_FIELDS = ['reviewStatus', 'reviewedBy', 'reviewedAt', 'reviewNote'];

/**
 * Builds the stored vendor report. On re-analysis, findings with the same id
 * keep their review decision, reviewed findings that no longer appear are kept
 * and marked superseded, and if the new AI run failed the previous AI
 * findings stay with their original timestamps.
 */
export function buildReportRecord({ existing = null, id, analysis, file, textMeta, uploadedBy, now = new Date() }) {
  const previous = existing?.complianceAnalysis?.discrepancies ?? [];
  const previousById = new Map(previous.filter((f) => f.id).map((f) => [f.id, f]));
  const nowIso = now.toISOString();

  let aiFindings = analysis.ai.findings;
  if (analysis.ai.status !== 'succeeded') {
    aiFindings = previous.filter((f) => f.source === 'ai' && !f.supersededAt);
  }

  const fresh = [...analysis.deterministic.findings, ...aiFindings].map((f) => {
    const prior = previousById.get(f.id);
    const review = Object.fromEntries(REVIEW_FIELDS.map((key) => [key, prior?.[key] ?? null]));
    return {
      ...f,
      generatedAt: f.generatedAt ?? nowIso,
      modelSource: f.modelSource ?? null,
      actualValue: f.reportedValue ?? null,
      ...review,
      reviewStatus: review.reviewStatus ?? 'pending-review',
      supersededAt: null,
    };
  });
  const freshIds = new Set(fresh.map((f) => f.id));
  const superseded = previous
    .filter((f) => f.id && !freshIds.has(f.id) && f.reviewStatus && f.reviewStatus !== 'pending-review')
    .map((f) => ({ ...f, supersededAt: f.supersededAt ?? nowIso }));

  const det = analysis.deterministic;
  const decided = existing?.verificationDecision?.by ? existing.verificationStatus : null;
  const pending = fresh.some((f) => f.reviewStatus === 'pending-review');

  const lastAi =
    analysis.ai.status === 'succeeded'
      ? { summary: analysis.ai.summary, matchingItems: analysis.ai.matchingItems, generatedAt: analysis.ai.generatedAt, modelSource: analysis.ai.modelSource }
      : existing?.aiAnalysis?.lastSuccess ?? null;

  return {
    id: existing?.id ?? id,
    vendorName: det.vendorName ?? existing?.vendorName ?? null,
    submittedDate: existing?.submittedDate ?? (det.reportDate ? new Date(det.reportDate) : now),
    phase: det.reportedPhase ?? existing?.phase ?? null,
    workCompleted: existing?.workCompleted ?? null,
    expenseClaimed: det.claimedExpense,
    verificationStatus: decided ?? (pending ? 'under-review' : 'pending'),
    verificationDecision: existing?.verificationDecision ?? null,
    documents: existing?.documents ?? [],
    pdfFileName: file.filename,
    documentFileId: file.fileId,
    documentSha256: file.sha256,
    uploadedBy: existing?.uploadedBy ?? uploadedBy ?? null,
    analysisMethod: ANALYSIS_METHOD,
    analysisStatus: analysis.analysisStatus,
    analyzedAt: now,
    planEvidenceSource: analysis.planEvidenceSource,
    textExtraction: textMeta,
    aiAnalysis: {
      status: analysis.ai.status,
      error: analysis.ai.error,
      modelSource: analysis.ai.modelSource,
      generatedAt: analysis.ai.generatedAt,
      discardedUnverified: analysis.ai.discardedUnverified,
      lastSuccess: lastAi,
    },
    complianceAnalysis: {
      overallCompliance: null,
      matchingItems: lastAi?.matchingItems ?? [],
      discrepancies: [...fresh, ...superseded],
      overdueWork: det.overdueWork,
      budgetAnalysis: det.budgetAnalysis,
      aiSummary: lastAi?.summary ?? null,
      aiProcessed: analysis.ai.status === 'succeeded',
    },
  };
}

import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import Scheme from '../models/Scheme.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { documentStore as defaultDocumentStore, sha256 } from '../services/documents/documentStore.js';
import { extractPdfPages } from '../services/documents/pdfText.js';
import { getBedrockService } from '../services/ai/bedrockService.js';
import { analyzeVendorReport, buildReportRecord, REVIEW_STATUSES } from '../services/vendorComparison/index.js';
import { createReportRepository } from '../services/vendorComparison/reportRepository.js';

const HIGH_SEVERITIES = new Set(['high', 'critical']);

export const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

const reviewSchema = z.object({
  reviewStatus: z.enum(REVIEW_STATUSES),
  note: z.string().trim().max(500).optional(),
});
const verificationSchema = z.object({
  verificationStatus: z.enum(['approved', 'rejected', 'under-review']),
  note: z.string().trim().max(500).optional(),
});

function storeError(res, error) {
  const status = error?.httpStatus ?? 500;
  return res.status(status).json({ error: error?.message || 'Document storage failed.', code: 'document_store' });
}

const safe = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch((error) => {
    console.error(`[vendor-report] ${req.method} ${req.path} failed: ${error?.name || 'Error'}`);
    if (!res.headersSent) res.status(500).json({ error: 'Vendor report processing failed.' });
  });

function textMetaOf(extraction) {
  return { numPages: extraction.numPages, pagesAnalyzed: extraction.pages.length, truncated: extraction.truncated };
}

function aiNotice(ai) {
  if (ai.status === 'succeeded') return null;
  return ai.error?.message ?? 'AI comparison did not run.';
}

export function createVendorReportRouter({
  repository = createReportRepository(Scheme),
  documents = defaultDocumentStore,
  bedrock: bedrockOverride,
  extractPages = extractPdfPages,
  now = () => new Date(),
} = {}) {
  const router = express.Router();
  // Resolved per request so configuration loaded by dotenv after import is used.
  const ai = () => bedrockOverride ?? getBedrockService();
  const adminOnly = [requireAuth, requireRole('admin')];

  async function loadPlanPages(scheme) {
    if (!scheme.planDocument?.fileId) return { pages: null, note: null };
    try {
      const { buffer } = await documents.readPdf(scheme.planDocument.fileId);
      const extraction = await extractPages(buffer);
      return extraction.status === 'ok'
        ? { pages: extraction.pages, note: null }
        : { pages: null, note: `The stored plan PDF could not be used (${extraction.message}); the plan record was used instead.` };
    } catch (error) {
      return { pages: null, note: `The stored plan PDF could not be read (${error.message}); the plan record was used instead.` };
    }
  }

  router.post('/:id/vendor-report', ...adminOnly, pdfUpload.single('pdf'), safe(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });
    const scheme = await repository.findScheme(req.params.id);
    if (!scheme) return res.status(404).json({ error: 'Scheme not found' });

    const hash = sha256(req.file.buffer);
    const existing = (scheme.vendorReports || []).find((r) => r.documentSha256 === hash);
    if (existing) {
      return res.json({
        success: true,
        duplicate: true,
        report: existing,
        message: `This PDF was already uploaded and analysed on ${new Date(existing.analyzedAt ?? existing.submittedDate).toISOString().slice(0, 10)}. Showing the saved analysis; use "Re-run analysis" to analyse it again.`,
      });
    }

    const extraction = await extractPages(req.file.buffer);
    if (extraction.status !== 'ok') {
      return res.status(422).json({ error: extraction.message, code: `pdf_${extraction.status}` });
    }

    let file;
    try {
      file = await documents.storePdf({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        kind: 'vendor-report',
        schemeId: scheme.id,
        uploadedBy: req.user.userId,
      });
    } catch (error) {
      return storeError(res, error);
    }

    const plan = await loadPlanPages(scheme);
    const analysis = await analyzeVendorReport({ scheme, vendorPages: extraction.pages, planPages: plan.pages, bedrock: ai(), now: now() });
    const record = buildReportRecord({
      id: `VR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      analysis,
      file,
      textMeta: textMetaOf(extraction),
      uploadedBy: req.user.userId,
      now: now(),
    });

    const inserted = await repository.insertReportOnce(scheme.id, record);
    if (!inserted) {
      const latest = await repository.findScheme(scheme.id);
      return res.json({
        success: true,
        duplicate: true,
        report: (latest?.vendorReports || []).find((r) => r.documentSha256 === hash) ?? null,
        message: 'This PDF was already uploaded for this scheme. Showing the saved analysis.',
      });
    }

    console.log(
      `[vendor-report] scheme=${scheme.id} report=${record.id} findings=${record.complianceAnalysis.discrepancies.length} ai=${analysis.ai.status}`,
    );
    const updated = await repository.findScheme(scheme.id);
    return res.status(201).json({
      success: true,
      report: record,
      ai: { status: analysis.ai.status, error: analysis.ai.error, discardedUnverified: analysis.ai.discardedUnverified },
      warnings: [aiNotice(analysis.ai), plan.note, extraction.truncated ? `Only the first ${extraction.pages.length} of ${extraction.numPages} pages were analysed.` : null].filter(Boolean),
      updatedScheme: updated
        ? { id: updated.id, overallProgress: updated.overallProgress, budgetUtilized: updated.budgetUtilized, status: updated.status, phases: updated.phases }
        : null,
    });
  }));

  router.post('/:id/vendor-reports/:reportId/reanalyze', ...adminOnly, safe(async (req, res) => {
    const scheme = await repository.findScheme(req.params.id);
    if (!scheme) return res.status(404).json({ error: 'Scheme not found' });
    const report = (scheme.vendorReports || []).find((r) => r.id === req.params.reportId);
    if (!report) return res.status(404).json({ error: 'Vendor report not found' });
    if (!report.documentFileId) {
      return res.status(409).json({
        error: 'The original PDF for this report was not stored (it was uploaded before document storage was added). Upload the PDF again to analyse it.',
        code: 'document_missing',
      });
    }

    let stored;
    try {
      stored = await documents.readPdf(report.documentFileId);
    } catch (error) {
      return storeError(res, error);
    }
    const extraction = await extractPages(stored.buffer);
    if (extraction.status !== 'ok') {
      return res.status(422).json({ error: extraction.message, code: `pdf_${extraction.status}` });
    }

    const schemeBeforeReport = {
      ...scheme,
      budgetUtilized: (scheme.budgetUtilized ?? 0) - (Number.isFinite(report.expenseClaimed) ? report.expenseClaimed : 0),
    };
    const plan = await loadPlanPages(scheme);
    const analysis = await analyzeVendorReport({ scheme: schemeBeforeReport, vendorPages: extraction.pages, planPages: plan.pages, bedrock: ai(), now: now() });
    const record = buildReportRecord({
      existing: report,
      analysis,
      file: { fileId: report.documentFileId, sha256: report.documentSha256, filename: report.pdfFileName },
      textMeta: textMetaOf(extraction),
      now: now(),
    });
    // The claimed expense was counted when the report was first uploaded.
    record.expenseClaimed = report.expenseClaimed ?? record.expenseClaimed;

    const ok = await repository.replaceReport(scheme.id, report.id, record);
    if (!ok) return res.status(404).json({ error: 'Vendor report not found' });
    return res.json({
      success: true,
      report: record,
      ai: { status: analysis.ai.status, error: analysis.ai.error, discardedUnverified: analysis.ai.discardedUnverified },
      warnings: [
        analysis.ai.status === 'succeeded' ? null : `${aiNotice(analysis.ai)} Earlier AI findings, if any, are kept with their original timestamps.`,
        plan.note,
      ].filter(Boolean),
    });
  }));

  router.patch('/:id/vendor-reports/:reportId/findings/:findingId', ...adminOnly, safe(async (req, res) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'reviewStatus must be pending-review, confirmed, or dismissed.' });
    const scheme = await repository.loadForUpdate(req.params.id);
    if (!scheme) return res.status(404).json({ error: 'Scheme not found' });
    const report = scheme.vendorReports.find((r) => r.id === req.params.reportId);
    const finding = report?.complianceAnalysis?.discrepancies?.find((f) => f.id === req.params.findingId);
    if (!finding) return res.status(404).json({ error: 'Finding not found' });

    finding.reviewStatus = parsed.data.reviewStatus;
    finding.reviewNote = parsed.data.note ?? null;
    finding.reviewedBy = req.user.userId;
    finding.reviewedAt = now();

    const issueId = `vr-${finding.id}`;
    const issue = scheme.discrepancies.find((d) => d.id === issueId);
    if (finding.reviewStatus === 'confirmed' && HIGH_SEVERITIES.has(finding.severity)) {
      if (!issue) {
        scheme.discrepancies.push({
          id: issueId,
          type: 'vendor_report',
          severity: finding.severity,
          description: `${finding.title || finding.description} (confirmed by an official from vendor report ${report.id})`,
          date: now().toISOString(),
          reportedBy: 'Official review of vendor report',
          status: 'confirmed',
        });
      } else {
        issue.status = 'confirmed';
      }
      scheme.status = 'discrepant';
    } else if (issue) {
      issue.status = finding.reviewStatus === 'dismissed' ? 'dismissed' : 'pending';
    }
    if (report.verificationStatus === 'under-review' && !report.verificationDecision?.by) {
      const stillPending = report.complianceAnalysis.discrepancies.some((f) => f.reviewStatus === 'pending-review' && !f.supersededAt);
      report.verificationStatus = stillPending ? 'under-review' : 'pending';
    }
    await scheme.save();
    return res.json({ success: true, finding, schemeStatus: scheme.status });
  }));

  router.patch('/:id/vendor-reports/:reportId', ...adminOnly, safe(async (req, res) => {
    const parsed = verificationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'verificationStatus must be approved, rejected, or under-review.' });
    const scheme = await repository.loadForUpdate(req.params.id);
    if (!scheme) return res.status(404).json({ error: 'Scheme not found' });
    const report = scheme.vendorReports.find((r) => r.id === req.params.reportId);
    if (!report) return res.status(404).json({ error: 'Vendor report not found' });

    report.verificationStatus = parsed.data.verificationStatus;
    report.verificationDecision =
      parsed.data.verificationStatus === 'under-review' ? null : { by: req.user.userId, at: now(), note: parsed.data.note ?? null };
    await scheme.save();
    return res.json({ success: true, verificationStatus: report.verificationStatus, verificationDecision: report.verificationDecision });
  }));

  return router;
}

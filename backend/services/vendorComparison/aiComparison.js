import { z } from 'zod';
import { findingId } from './deterministic.js';

const RELEVANT = /budget|cost|amount|₹|rs\.?|lakh|crore|expen|claim|invoice|milestone|phase|deliverable|complet|progress|%|quantity|km|metre|units|nos|date|schedule|delay|target|scope|quality|inspection|test|material|specification|work/i;

// Some models return page numbers as strings ("3", "p.3", "[p.3]"); anything else still fails validation.
const pageNumber = z.preprocess(
  (value) => {
    const match = typeof value === 'string' ? value.match(/^\s*\[?\s*(?:p(?:age)?\.?\s*)?(\d+)\s*\]?\s*$/i) : null;
    return match ? Number(match[1]) : value;
  },
  z.number().int().min(1).nullable(),
);

const evidenceSchema = z.object({
  quote: z.string().max(400).nullable().describe('Exact text copied from the excerpt, or null if none'),
  page: pageNumber.describe('Page number from the [p.N] tag of the quoted excerpt, or null'),
  section: z.string().max(120).nullable(),
});

export const aiComparisonSchema = z.object({
  summary: z.string().min(1).max(1200),
  findings: z
    .array(
      z.object({
        type: z.enum([
          'scope_gap',
          'missing_deliverable',
          'milestone_mismatch',
          'unsupported_claim',
          'quality_concern',
          'inconsistency',
          'budget_concern',
          'schedule_concern',
          'other',
        ]),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        title: z.string().min(3).max(140),
        description: z.string().min(10).max(800),
        planEvidence: evidenceSchema,
        vendorEvidence: evidenceSchema,
        plannedValue: z.string().max(120).nullable(),
        reportedValue: z.string().max(120).nullable(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(15),
  matchingItems: z.array(z.string().min(1).max(200)).max(15),
});

const CATEGORY = {
  scope_gap: 'scope',
  missing_deliverable: 'scope',
  milestone_mismatch: 'timeline',
  unsupported_claim: 'compliance',
  quality_concern: 'quality',
  inconsistency: 'compliance',
  budget_concern: 'budget',
  schedule_concern: 'timeline',
  other: 'compliance',
};

export const normalizeForMatch = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

/** Picks the highest-signal lines per page, tagged [p.N], within a character budget. */
export function selectRelevantExcerpts(pages, maxChars = 12000) {
  const blocks = [];
  for (const { page, text } of pages) {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter((l) => l.length > 2 && RELEVANT.test(l));
    if (lines.length) blocks.push({ page, text: lines.join('\n') });
  }
  let used = 0;
  const kept = [];
  for (const block of blocks) {
    const room = maxChars - used;
    if (room <= 200) break;
    const text = block.text.slice(0, room);
    kept.push({ page: block.page, text });
    used += text.length + 10;
  }
  return {
    text: kept.map((b) => `[p.${b.page}]\n${b.text}`).join('\n\n'),
    pages: kept,
    omittedChars: Math.max(0, blocks.reduce((s, b) => s + b.text.length, 0) - used),
  };
}

export function planRecordText(scheme) {
  const lines = [
    `Scheme: ${scheme.name}`,
    `Total budget: ₹${scheme.totalBudget ?? 'unknown'}; utilised before this report: ₹${scheme.budgetUtilized ?? 0}`,
    `Dates: ${scheme.startDate ?? 'unknown'} to ${scheme.endDate ?? 'unknown'}`,
  ];
  for (const p of scheme.phases || []) {
    lines.push(
      `Phase ${p.id} — ${p.name}: budget ₹${p.budget ?? 'unknown'}, ${p.startDate ?? '?'} to ${p.endDate ?? '?'}, recorded progress ${p.progress ?? 'unknown'}%` +
        (p.milestones?.length ? `; milestones: ${p.milestones.join('; ')}` : '') +
        (p.deliverables?.length ? `; deliverables: ${p.deliverables.join('; ')}` : '') +
        (p.plannedWork ? `; planned work: ${p.plannedWork}` : ''),
    );
  }
  return lines.join('\n');
}

export const AI_SYSTEM_PROMPT = `You assist government officials by comparing a vendor's progress report with the government scheme plan.
Rules:
- Report only contextual findings: scope gaps, missing deliverables, milestone mismatches, claims without supporting detail, quality concerns, and internal inconsistencies.
- Do not perform arithmetic. Budget variances, delays, and quantity differences are already calculated and listed; do not repeat them.
- Every finding must quote text copied exactly from the excerpts. Use the page number from the [p.N] tag of that excerpt. If there is no supporting text, set quote and page to null.
- Use null for any value you cannot copy from the text. Never invent numbers, dates, names, quotes, or page numbers.
- Findings are items for human review, not conclusions of fraud or wrongdoing. Use neutral language.
- If nothing needs review, return an empty findings list.`;

export function buildPrompt({ scheme, planExcerpts, vendorExcerpts, deterministicFindings }) {
  return [
    'SCHEME PLAN RECORD (database):',
    planRecordText(scheme),
    '',
    planExcerpts ? `SCHEME PLAN DOCUMENT EXCERPTS:\n${planExcerpts.text}` : 'SCHEME PLAN DOCUMENT: not available; compare against the plan record above.',
    '',
    `VENDOR REPORT EXCERPTS:\n${vendorExcerpts.text || '(no relevant text found)'}`,
    '',
    'ALREADY CALCULATED (do not repeat):',
    deterministicFindings.length ? deterministicFindings.map((f) => `- ${f.title}`).join('\n') : '- none',
  ].join('\n');
}

function verifyEvidence(evidence, pages, recordText) {
  const empty = { quote: null, page: null, section: evidence?.section ?? null, verified: false };
  const quote = normalizeForMatch(evidence?.quote);
  if (!quote || quote.length < 8) return empty;
  const pageHit = (p) => normalizeForMatch(p.text).includes(quote);
  const claimed = evidence.page ? pages.find((p) => p.page === evidence.page) : null;
  const found = claimed && pageHit(claimed) ? claimed : pages.find(pageHit);
  if (found) return { quote: evidence.quote.trim(), page: found.page, section: evidence.section ?? null, verified: true };
  if (recordText && normalizeForMatch(recordText).includes(quote)) {
    return { quote: evidence.quote.trim(), page: null, section: evidence.section ?? 'Scheme record', verified: true };
  }
  return empty;
}

const digitsOf = (value) => (String(value || '').match(/\d+/g) || []).join('');

function verifyValue(value, evidence) {
  if (value === null || value === undefined) return null;
  const digits = digitsOf(value);
  if (!digits) return evidence.verified ? value : null;
  return evidence.verified && digitsOf(evidence.quote).includes(digits) ? value : null;
}

/**
 * Checks model output against the source text. Quotes that do not appear in
 * the documents are removed (with their page numbers), values not present in a
 * verified quote are nulled, and findings left with no verified evidence are
 * discarded and counted.
 */
export function verifyAiFindings(findings, { planPages, vendorPages, recordText, generatedAt, modelId }) {
  const kept = [];
  let discarded = 0;
  for (const f of findings) {
    const plan = verifyEvidence(f.planEvidence, planPages, recordText);
    const vendor = verifyEvidence(f.vendorEvidence, vendorPages, null);
    if (!plan.verified && !vendor.verified) {
      discarded += 1;
      continue;
    }
    const planEvidence = { source: plan.page ? 'plan-document' : 'scheme-record', quote: plan.quote, page: plan.page, section: plan.section };
    const vendorEvidence = { source: 'vendor-report', quote: vendor.quote, page: vendor.page, section: vendor.section };
    kept.push({
      id: findingId(['ai', f.type, normalizeForMatch(f.title), vendor.quote, plan.quote]),
      source: 'ai',
      type: f.type,
      category: CATEGORY[f.type],
      severity: f.severity,
      title: f.title,
      description: f.description,
      planEvidence,
      vendorEvidence,
      plannedValue: verifyValue(f.plannedValue, plan),
      reportedValue: verifyValue(f.reportedValue, vendor),
      variance: null,
      varianceUnit: null,
      variancePercentage: null,
      pageOrSection: vendor.page ? `p. ${vendor.page}` : plan.page ? `plan p. ${plan.page}` : plan.section ?? null,
      confidence: f.confidence,
      modelSource: { provider: 'amazon-bedrock', modelId },
      generatedAt,
    });
  }
  return { findings: kept, discarded };
}

export async function runAiComparison({ bedrock, scheme, planPages, vendorPages, deterministicFindings }) {
  const planExcerpts = planPages?.length ? selectRelevantExcerpts(planPages, 6000) : null;
  const vendorExcerpts = selectRelevantExcerpts(vendorPages, 12000);
  const { data, modelId } = await bedrock.generateStructured({
    system: AI_SYSTEM_PROMPT,
    prompt: buildPrompt({ scheme, planExcerpts, vendorExcerpts, deterministicFindings }),
    schema: aiComparisonSchema,
    toolName: 'record_comparison',
    toolDescription: 'Record the comparison of the vendor report against the scheme plan.',
  });
  const generatedAt = new Date().toISOString();
  const verified = verifyAiFindings(data.findings, {
    planPages: planExcerpts?.pages ?? [],
    vendorPages: vendorExcerpts.pages,
    recordText: planRecordText(scheme),
    generatedAt,
    modelId,
  });
  return {
    summary: data.summary,
    matchingItems: data.matchingItems,
    findings: verified.findings,
    discardedUnverified: verified.discarded,
    modelId,
    generatedAt,
    omittedVendorChars: vendorExcerpts.omittedChars,
  };
}

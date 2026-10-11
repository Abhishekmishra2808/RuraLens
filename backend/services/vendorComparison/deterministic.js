import crypto from 'crypto';
import { pickClaimedTotal } from './evidence.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const round = (value, digits = 2) => Number(value.toFixed(digits));
const inr = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`;

export function budgetVariance(planned, reported) {
  if (!Number.isFinite(planned) || !Number.isFinite(reported)) return null;
  const variance = reported - planned;
  return { variance, variancePercentage: planned > 0 ? round((variance / planned) * 100) : null };
}

export function toUtcDay(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from, to) {
  const a = toUtcDay(from);
  const b = toUtcDay(to);
  return a === null || b === null ? null : Math.round((b - a) / DAY_MS);
}

export function quantityVariance(planned, reported) {
  if (!Number.isFinite(planned) || !Number.isFinite(reported)) return null;
  const variance = reported - planned;
  return { variance, variancePercentage: planned > 0 ? round((variance / planned) * 100) : null };
}

export function severityForOverrun(pct) {
  if (pct === null || pct <= 0) return null;
  if (pct >= 25) return 'critical';
  if (pct >= 10) return 'high';
  return 'medium';
}

export function severityForDelay(days) {
  if (days === null || days <= 0) return null;
  if (days > 90) return 'high';
  if (days > 30) return 'medium';
  return 'low';
}

export function findingId(parts) {
  return `f-${crypto.createHash('sha256').update(parts.map((p) => String(p ?? '')).join('|')).digest('hex').slice(0, 16)}`;
}

const recordEvidence = (section) => ({ source: 'scheme-record', quote: null, page: null, section });
const vendorEvidence = (fact) =>
  fact ? { source: 'vendor-report', quote: fact.quote, page: fact.page, section: fact.section ?? null } : { source: 'vendor-report', quote: null, page: null, section: null };

function planDocumentEvidence(planFacts, value, fallbackSection) {
  const match = planFacts?.amounts.find((a) => Math.abs(a.value - value) <= Math.max(1, value * 0.005));
  return match ? { source: 'plan-document', quote: match.quote, page: match.page, section: match.section ?? null } : recordEvidence(fallbackSection);
}

const pageOrSection = (evidence) => (evidence.page ? `p. ${evidence.page}` : evidence.section ?? null);

function finding({ type, category, severity, title, description, planEvidence, vendorEvidence: vEvidence, plannedValue, reportedValue, variance = null, varianceUnit = null, variancePercentage = null }) {
  return {
    id: findingId(['deterministic', type, title, plannedValue, reportedValue]),
    source: 'deterministic',
    type,
    category,
    severity,
    title,
    description,
    planEvidence,
    vendorEvidence: vEvidence,
    plannedValue,
    reportedValue,
    variance,
    varianceUnit,
    variancePercentage,
    pageOrSection: pageOrSection(vEvidence) ?? pageOrSection(planEvidence),
    confidence: null,
  };
}

/**
 * Runs the numeric checks in code: budget overrun (scheme and phase), overdue
 * phases, reported completion-date slips, and quantity mismatches. Returns
 * findings plus the budget/overdue summaries stored on the report.
 */
export function runDeterministicChecks({ scheme, vendorFacts, planFacts = null, asOf = new Date() }) {
  const findings = [];
  const phases = Array.isArray(scheme.phases) ? scheme.phases : [];
  const reportedPhaseId = vendorFacts.phase?.value ?? null;
  const phase = reportedPhaseId !== null ? phases.find((p) => Number(p.id) === reportedPhaseId) : null;
  const claimed = pickClaimedTotal(vendorFacts);

  let budgetAnalysis = null;
  if (claimed && Number.isFinite(scheme.totalBudget) && scheme.totalBudget > 0) {
    const priorUtilized = Number.isFinite(scheme.budgetUtilized) ? scheme.budgetUtilized : 0;
    const cumulative = priorUtilized + claimed.value;
    const total = budgetVariance(scheme.totalBudget, cumulative);
    budgetAnalysis = {
      plannedBudget: scheme.totalBudget,
      claimedExpense: claimed.value,
      priorUtilized,
      variance: total.variance,
      variancePercentage: total.variancePercentage,
    };
    const severity = severityForOverrun(total.variancePercentage);
    if (severity) {
      findings.push(
        finding({
          type: 'budget_overrun',
          category: 'budget',
          severity,
          title: 'Cumulative spend exceeds the scheme budget',
          description: `Previously utilised ${inr(priorUtilized)} plus this claim of ${inr(claimed.value)} totals ${inr(cumulative)}, which is ${inr(total.variance)} (${total.variancePercentage}%) over the sanctioned ${inr(scheme.totalBudget)}.`,
          planEvidence: planDocumentEvidence(planFacts, scheme.totalBudget, 'Scheme record: total budget'),
          vendorEvidence: vendorEvidence(claimed),
          plannedValue: inr(scheme.totalBudget),
          reportedValue: inr(cumulative),
          variance: total.variance,
          varianceUnit: 'INR',
          variancePercentage: total.variancePercentage,
        }),
      );
    }
  }

  if (claimed && phase && Number.isFinite(phase.budget) && phase.budget > 0) {
    const phaseSpent = (Number.isFinite(phase.spent) ? phase.spent : 0) + claimed.value;
    const phaseVar = budgetVariance(phase.budget, phaseSpent);
    const severity = severityForOverrun(phaseVar.variancePercentage);
    if (severity) {
      findings.push(
        finding({
          type: 'budget_overrun',
          category: 'budget',
          severity,
          title: `Phase ${phase.id} spend exceeds its budget`,
          description: `Phase ${phase.id} (${phase.name}) would reach ${inr(phaseSpent)} against a phase budget of ${inr(phase.budget)} (${phaseVar.variancePercentage}% over).`,
          planEvidence: planDocumentEvidence(planFacts, phase.budget, `Scheme record: Phase ${phase.id} budget`),
          vendorEvidence: vendorEvidence(claimed),
          plannedValue: inr(phase.budget),
          reportedValue: inr(phaseSpent),
          variance: phaseVar.variance,
          varianceUnit: 'INR',
          variancePercentage: phaseVar.variancePercentage,
        }),
      );
    }
  }

  const overdueWork = [];
  for (const p of phases) {
    const delay = daysBetween(p.endDate, asOf);
    if (delay === null || delay <= 0 || p.status === 'completed' || Number(p.progress) >= 100) continue;
    const claim = reportedPhaseId === Number(p.id) ? vendorFacts.percentages.find((pct) => pct.value >= 100) : null;
    if (claim) continue;
    overdueWork.push({ task: `Phase ${p.id}: ${p.name}`, plannedDate: p.endDate, currentStatus: p.status ?? 'unknown', delayDays: delay });
    findings.push(
      finding({
        type: 'overdue_phase',
        category: 'timeline',
        severity: severityForDelay(delay),
        title: `Phase ${p.id} is past its planned end date`,
        description: `Phase ${p.id} (${p.name}) was due on ${String(p.endDate).slice(0, 10)} and is recorded at ${p.progress ?? 'unknown'}% progress, ${delay} day(s) late as of ${new Date(asOf).toISOString().slice(0, 10)}. The vendor report does not claim it is complete.`,
        planEvidence: recordEvidence(`Scheme record: Phase ${p.id} end date`),
        vendorEvidence: vendorEvidence(null),
        plannedValue: String(p.endDate).slice(0, 10),
        reportedValue: null,
        variance: delay,
        varianceUnit: 'days',
      }),
    );
  }

  const finishDate = vendorFacts.dates.find((d) => d.isFinishDate);
  const plannedEnd = phase?.endDate ?? scheme.endDate;
  const slip = finishDate ? daysBetween(plannedEnd, finishDate.date) : null;
  if (slip !== null && slip > 0) {
    findings.push(
      finding({
        type: 'schedule_slip',
        category: 'timeline',
        severity: severityForDelay(slip),
        title: phase ? `Reported completion date is after Phase ${phase.id}'s planned end` : 'Reported completion date is after the scheme end date',
        description: `The report gives ${finishDate.date}, ${slip} day(s) after the planned ${String(plannedEnd).slice(0, 10)}.`,
        planEvidence: recordEvidence(phase ? `Scheme record: Phase ${phase.id} end date` : 'Scheme record: end date'),
        vendorEvidence: vendorEvidence(finishDate),
        plannedValue: String(plannedEnd).slice(0, 10),
        reportedValue: finishDate.date,
        variance: slip,
        varianceUnit: 'days',
      }),
    );
  }

  if (planFacts) {
    for (const planned of planFacts.quantities) {
      if (!planned.item) continue;
      const reported = vendorFacts.quantities.find((q) => q.unit === planned.unit && q.item === planned.item);
      if (!reported || reported.value === planned.value) continue;
      const qv = quantityVariance(planned.value, reported.value);
      findings.push(
        finding({
          type: 'quantity_mismatch',
          category: 'scope',
          severity: reported.value < planned.value ? 'medium' : 'low',
          title: `Reported ${planned.item} quantity differs from the plan`,
          description: `The plan lists ${planned.value} ${planned.unit} of ${planned.item}; the vendor report lists ${reported.value} ${reported.unit} (${qv.variancePercentage ?? 'n/a'}% difference). This may reflect partial progress; confirm against the work schedule.`,
          planEvidence: { source: 'plan-document', quote: planned.quote, page: planned.page, section: planned.section ?? null },
          vendorEvidence: vendorEvidence(reported),
          plannedValue: `${planned.value} ${planned.unit}`,
          reportedValue: `${reported.value} ${reported.unit}`,
          variance: qv.variance,
          varianceUnit: planned.unit,
          variancePercentage: qv.variancePercentage,
        }),
      );
    }
  }

  return {
    findings,
    budgetAnalysis,
    overdueWork,
    claimedExpense: claimed?.value ?? null,
    reportedPhase: reportedPhaseId,
    vendorName: vendorFacts.vendorName?.value ?? null,
    reportDate: vendorFacts.dates.find((d) => !d.isFinishDate)?.date ?? null,
  };
}

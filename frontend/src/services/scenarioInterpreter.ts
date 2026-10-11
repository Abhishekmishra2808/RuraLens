/**
 * Natural-language → structured scenario interpretation.
 *
 * Interpretation is separate from execution: an interpreter only proposes a
 * typed scenario that the user must confirm; the simulation engine produces
 * all results. `ruleBasedInterpreter` is a transparent keyword matcher used
 * when the backend Copilot is unavailable; Copilot proposals are converted to
 * this shape in `copilotClient.ts` and checked with `validateInterpretation`.
 */
import type { FailureScenarioOption, FailureSeverity, TwinAsset, TwinAssetType } from '../types/twin';

export interface InterpretationContext {
  assets: TwinAsset[];
  scenarios: FailureScenarioOption[];
  selectedId: string | null;
}

export interface InterpretedScenario {
  status: 'ready' | 'needs-clarification' | 'unsupported';
  action: 'simulate-failure';
  targetType: TwinAssetType | null;
  /** Assets that could be the target; the user picks one when ambiguous. */
  candidateIds: string[];
  targetId: string | null;
  failureTypeId: string | null;
  severity: FailureSeverity;
  /** Asset types the user asked about (used to focus the result summary). */
  focusTypes: TwinAssetType[];
  assumptions: string[];
  questions: string[];
  unsupportedReason?: string;
  interpreter: string;
}

export interface ScenarioInterpreter {
  id: string;
  label: string;
  description: string;
  interpret: (prompt: string, ctx: InterpretationContext) => Promise<InterpretedScenario>;
}

const TYPE_KEYWORDS: Array<[TwinAssetType, RegExp]> = [
  ['pump', /\bpump(s|ing)?\b|\bbooster\b/],
  ['tank', /\btank(s)?\b|\breservoir(s)?\b/],
  ['pipe', /\bpipe(s|line|lines)?\b|\bwater main(s)?\b|\btrunk main\b/],
  ['hospital', /\bhospital(s)?\b|\bclinic(s)?\b|\bhealth\b/],
  ['school', /\bschool(s)?\b/],
  ['market', /\bmarket(s)?\b/],
  ['power', /\bsubstation(s)?\b|\btransformer(s)?\b|\bpower\b|\belectric(al|ity)?\b|\bgrid\b/],
  ['sensor', /\bsensor(s)?\b/],
  ['road', /\broad(s)?\b|\bcorridor(s)?\b|\bstreet(s)?\b/],
];

const SEVERITY_KEYWORDS: Array<[FailureSeverity, RegExp]> = [
  ['critical', /\bcritical\b|\bcatastrophic\b|\bcomplete\b|\btotal\b/],
  ['high', /\bsevere\b|\bmajor\b|\bhigh\b|\bserious\b/],
  ['medium', /\bmoderate\b|\bmedium\b/],
  ['low', /\bminor\b|\blow\b|\bslight\b/],
];

const FAILURE_KEYWORDS: Array<[string, RegExp]> = [
  ['outage', /\boutage\b|\bpower cut\b|\bblackout\b/],
  ['overload', /\boverload/],
  ['leak', /\bleak/],
  ['contamination', /\bcontaminat/],
  ['flood', /\bflood/],
  ['fire', /\bfire\b/],
  ['collapse', /\bcollapse/],
  ['blockage', /\bblock(ed|age)\b/],
  ['accident', /\baccident\b/],
  ['damage', /\bdamage/],
];

const FAILURE_WORDS =
  /\b(fail\w*|outage|leak\w*|burst\w*|break\w*|broken|down|collapse\w*|flood\w*|fire|block\w*|contaminat\w*|damage\w*|trip\w*|shut\w*)\b/g;

const UNSUPPORTED_PATTERNS: Array<[RegExp, string]> = [
  [
    /\bbackup\b.*\b(activat|switch|turn on|enable)|\b(activat|switch on|turn on|enable)\w*\b.*\bbackup\b/,
    'Activating backup assets is an intervention, and the current prediction engine only models failures of existing assets. Add the backup as a scenario asset (right-click the map), run separate failures, and compare the runs in the Results tab.',
  ],
  [
    /\b(repair|restore|reroute|build|construct|upgrade)\b/,
    'Repairs, rerouting and new construction are not modelled by the current prediction engine, which only predicts the impact of a failure.',
  ],
];

const STOPWORDS = new Set(
  'simulate simulation failure fail fails failed severe major minor critical moderate which what where show identify affected paths path suggest options option backup compare current situation scenario areas area water access lose may might could would with from that this into near demo the and for are'.split(
    ' ',
  ),
);

function nameTokens(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

export const ruleBasedInterpreter: ScenarioInterpreter = {
  id: 'rule-based',
  label: 'Rule-based interpreter',
  description: 'Keyword matching in the browser. No language model is involved.',
  async interpret(prompt, ctx) {
    const text = prompt.toLowerCase();
    const base: InterpretedScenario = {
      status: 'ready',
      action: 'simulate-failure',
      targetType: null,
      candidateIds: [],
      targetId: null,
      failureTypeId: null,
      severity: 'medium',
      focusTypes: [],
      assumptions: [],
      questions: [],
      interpreter: this.id,
    };

    for (const [pattern, reason] of UNSUPPORTED_PATTERNS) {
      if (pattern.test(text)) return { ...base, status: 'unsupported', unsupportedReason: reason };
    }
    if (/\bcompare\b/.test(text)) {
      return {
        ...base,
        status: 'unsupported',
        unsupportedReason:
          'Comparisons use runs you have already executed: run each scenario, then use “Compare scenarios” in the Results tab.',
      };
    }

    // The target is the asset type mentioned closest to a failure word; other mentioned types are focus types.
    const mentions = TYPE_KEYWORDS.map(([type, re]) => ({ type, index: text.search(re) })).filter((m) => m.index >= 0);
    const failureIdx = Array.from(text.matchAll(FAILURE_WORDS), (m) => m.index ?? 0);
    const distance = (i: number) => (failureIdx.length ? Math.min(...failureIdx.map((f) => Math.abs(f - i))) : i);
    const mentioned = mentions.sort((a, b) => distance(a.index) - distance(b.index)).map((m) => m.type);

    if (/\bresidential\b|\bhomes?\b|\bhouseholds?\b/.test(text)) {
      base.assumptions.push('Residential areas are not modelled as assets in this dataset, so they cannot be reported.');
    }

    // Name matching narrows candidates (e.g. "Barakhamba pump").
    const tokens = nameTokens(prompt);
    const byName = ctx.assets.filter((a) => tokens.some((t) => a.name.toLowerCase().includes(t)));

    let targetType: TwinAssetType | null = mentioned[0] ?? null;
    let candidates = ctx.assets.filter((a) => (targetType ? a.type === targetType : false));
    const narrowed = candidates.filter((a) => byName.includes(a));
    if (narrowed.length > 0) candidates = narrowed;

    if (!targetType && byName.length > 0) {
      candidates = byName;
      targetType = byName[0].type;
    }

    base.targetType = targetType;
    base.focusTypes = mentioned.slice(1);
    base.candidateIds = candidates.map((a) => a.id);

    if (!targetType || candidates.length === 0) {
      base.status = 'needs-clarification';
      base.questions.push(
        targetType
          ? `There is no ${targetType} in this dataset. Which asset should fail?`
          : 'Which asset should fail? Mention an asset type (pump, tank, substation…) or name.',
      );
    } else if (candidates.length === 1) {
      base.targetId = candidates[0].id;
    } else if (ctx.selectedId && candidates.some((c) => c.id === ctx.selectedId)) {
      base.targetId = ctx.selectedId;
      base.assumptions.push('Several assets match; using the asset currently selected on the map.');
    } else {
      base.status = 'needs-clarification';
      base.questions.push(`${candidates.length} assets match. Which one should fail?`);
    }

    const severity = SEVERITY_KEYWORDS.find(([, re]) => re.test(text));
    if (severity) base.severity = severity[0];
    else base.assumptions.push('Severity not specified; assuming medium.');

    const applicable = ctx.scenarios.filter((s) => !s.applicableTo || !targetType || s.applicableTo.includes(targetType));
    const keyword = FAILURE_KEYWORDS.find(([, re]) => re.test(text));
    const keywordMatch = keyword
      ? applicable.find((s) => s.id === keyword[0] || s.name.toLowerCase().includes(keyword[0]))
      : undefined;
    const generic =
      applicable.find((s) => s.id === 'failure' || /complete failure/i.test(s.name)) ?? applicable[0] ?? ctx.scenarios[0];
    if (keyword && !keywordMatch) {
      base.assumptions.push(`“${keyword[0]}” is not available for this asset type; using “${generic?.name}”.`);
    } else if (!keyword) {
      base.assumptions.push(`Failure type not specified; using “${generic?.name}”.`);
    }
    base.failureTypeId = (keywordMatch ?? generic)?.id ?? null;

    if (/\bbackup\b|\balternative\b|\bredundan/.test(text)) {
      base.assumptions.push(
        'Backup options are not modelled; the summary will only list unaffected assets of the same type and the backend’s recommendations.',
      );
    }

    return base;
  },
};

/** Validates an interpretation (rule-based or proposed by the Copilot) against the active dataset. */
export function validateInterpretation(
  value: InterpretedScenario,
  ctx: InterpretationContext,
): { ok: true } | { ok: false; error: string } {
  if (value.action !== 'simulate-failure') return { ok: false, error: 'Unsupported action' };
  if (value.status === 'ready') {
    if (!value.targetId || !ctx.assets.some((a) => a.id === value.targetId)) {
      return { ok: false, error: 'Target asset is not in the active dataset' };
    }
    if (!value.failureTypeId || !ctx.scenarios.some((s) => s.id === value.failureTypeId)) {
      return { ok: false, error: 'Unknown failure type' };
    }
  }
  if (!['low', 'medium', 'high', 'critical'].includes(value.severity)) return { ok: false, error: 'Invalid severity' };
  return { ok: true };
}

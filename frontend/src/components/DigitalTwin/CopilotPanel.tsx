import { useState, type ReactNode } from 'react';
import { ArrowRight, Check, Loader2, RotateCcw } from 'lucide-react';
import { useTwinStore } from '../../store/twinStore';
import {
  ruleBasedInterpreter,
  validateInterpretation,
  type InterpretedScenario,
} from '../../services/scenarioInterpreter';
import { MODEL_SOURCE_INFO } from '../../services/simulationAdapter';
import { ASSET_TYPE_META } from './twinVisuals';
import { Button, Callout, SectionTitle } from './ui';
import type { SimulationRun, TwinAsset } from '../../types/twin';

const EXAMPLES = [
  'Severe pump failure: which hospitals lose water?',
  'What happens to schools if the Janpath transformer fails?',
];

const interpreter = ruleBasedInterpreter;

/** Summary built strictly from the returned prediction; nothing is generated. */
function summarize(run: SimulationRun, interpretation: InterpretedScenario, assets: TwinAsset[]): string[] {
  const name = (id: string) => assets.find((a) => a.id === id)?.name ?? id;
  const { result } = run;
  const affected = result.affected.filter((a) => a.onMap);
  const lines = [
    `${MODEL_SOURCE_INFO[result.modelSource].label} predicted ${affected.length} affected asset(s) after a ${run.request.severity} ${run.request.failureTypeLabel.toLowerCase()} at ${name(result.sourceNodeId)}.`,
  ];
  for (const type of interpretation.focusTypes) {
    const all = assets.filter((a) => a.type === type);
    if (all.length === 0) continue;
    const hit = affected.filter((a) => all.some((x) => x.id === a.nodeId));
    const label = ASSET_TYPE_META[type].plural.toLowerCase();
    lines.push(
      hit.length === 0
        ? `None of the ${all.length} ${label} appear in the prediction.`
        : `${label[0].toUpperCase()}${label.slice(1)} affected: ${hit
            .map((h) => `${name(h.nodeId)}${h.severity ? ` (${h.severity})` : ''}`)
            .join(', ')}.`,
    );
  }
  const target = assets.find((a) => a.id === result.sourceNodeId);
  if (target && /backup|alternative|redundan/i.test(run.request.origin.kind === 'copilot' ? run.request.origin.prompt : '')) {
    const sameType = assets.filter(
      (a) => a.type === target.type && a.id !== target.id && !affected.some((x) => x.nodeId === a.id),
    );
    lines.push(
      sameType.length > 0
        ? `Unaffected ${ASSET_TYPE_META[target.type].plural.toLowerCase()}: ${sameType.map((a) => a.name).join(', ')}. Backup capacity is not modelled.`
        : `No other unaffected ${ASSET_TYPE_META[target.type].plural.toLowerCase()} in this dataset.`,
    );
  }
  if (result.assessment.priorityActions?.length) {
    lines.push(`Backend recommendations: ${result.assessment.priorityActions.join(' ')}`);
  }
  return lines;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 px-3 py-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-900">{children}</dd>
    </div>
  );
}

export default function CopilotPanel() {
  const assets = useTwinStore((s) => s.assets);
  const scenarios = useTwinStore((s) => s.scenarios);
  const selectedId = useTwinStore((s) => s.selectedId);
  const running = useTwinStore((s) => s.simulation.status === 'running');
  const simError = useTwinStore((s) => s.simulation.error);
  const runScenario = useTwinStore((s) => s.runScenario);
  const resetSimulation = useTwinStore((s) => s.resetSimulation);
  const flyToAssets = useTwinStore((s) => s.flyToAssets);

  const [prompt, setPrompt] = useState('');
  const [interpreting, setInterpreting] = useState(false);
  const [interpretation, setInterpretation] = useState<InterpretedScenario | null>(null);
  const [summary, setSummary] = useState<string[] | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const ctx = { assets, scenarios, selectedId };

  const interpret = async () => {
    if (!prompt.trim()) return;
    setInterpreting(true);
    setSummary(null);
    setValidationError(null);
    try {
      setInterpretation(await interpreter.interpret(prompt.trim(), ctx));
    } finally {
      setInterpreting(false);
    }
  };

  const chooseTarget = (id: string) => {
    if (!interpretation) return;
    setInterpretation({ ...interpretation, targetId: id, status: 'ready', questions: [] });
  };

  const confirm = async () => {
    if (!interpretation || !interpretation.targetId || !interpretation.failureTypeId) return;
    const check = validateInterpretation(interpretation, ctx);
    if (!check.ok) {
      setValidationError(check.error);
      return;
    }
    const failure = scenarios.find((s) => s.id === interpretation.failureTypeId);
    const run = await runScenario({
      targetAssetId: interpretation.targetId,
      failureType: interpretation.failureTypeId,
      failureTypeLabel: failure?.name ?? interpretation.failureTypeId,
      severity: interpretation.severity,
      origin: { kind: 'copilot', prompt: prompt.trim() },
    });
    if (run) {
      setSummary(summarize(run, interpretation, assets));
      const ids = [run.result.sourceNodeId, ...run.result.affected.filter((a) => a.onMap).map((a) => a.nodeId)];
      flyToAssets(ids);
    }
  };

  const target = interpretation?.targetId ? assets.find((a) => a.id === interpretation.targetId) : null;
  const failure = interpretation?.failureTypeId ? scenarios.find((s) => s.id === interpretation.failureTypeId) : null;

  return (
    <div className="space-y-5 p-4">
      <section>
        <SectionTitle>Describe a failure</SectionTitle>
        <label htmlFor="twin-copilot-prompt" className="sr-only">
          Scenario request
        </label>
        <div className="rounded-xl border border-zinc-200 focus-within:border-zinc-400">
          <textarea
            id="twin-copilot-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void interpret();
            }}
            rows={3}
            placeholder="e.g. Severe pump failure: which hospitals are affected?"
            className="block w-full resize-none rounded-t-xl bg-transparent px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
          <div className="flex items-center justify-between border-t border-zinc-100 px-2 py-1.5">
            <span className="pl-1 text-[11px] text-zinc-400">Ctrl + Enter</span>
            <Button variant="primary" onClick={() => void interpret()} disabled={!prompt.trim() || interpreting}>
              {interpreting ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
              Interpret
            </Button>
          </div>
        </div>
        <div className="mt-2 space-y-1">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="block w-full truncate rounded-md px-2 py-1 text-left text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            >
              {ex}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">
          {interpreter.label}. You confirm before anything runs; results come from the prediction backend.
        </p>
      </section>

      {interpretation && (
        <section className="space-y-3" aria-live="polite">
          <SectionTitle>Interpreted scenario</SectionTitle>
          {interpretation.status === 'unsupported' ? (
            <Callout tone="amber">{interpretation.unsupportedReason}</Callout>
          ) : (
            <>
              <dl className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 text-sm">
                <Row label="Target">{target ? target.name : 'Needs clarification'}</Row>
                <Row label="Failure">{failure?.name ?? '—'}</Row>
                <Row label="Severity">
                  <span className="capitalize">{interpretation.severity}</span>
                </Row>
                {interpretation.focusTypes.length > 0 && (
                  <Row label="Report on">{interpretation.focusTypes.map((t) => ASSET_TYPE_META[t].plural).join(', ')}</Row>
                )}
              </dl>

              {interpretation.questions.map((q) => (
                <p key={q} className="text-xs font-medium text-zinc-800">
                  {q}
                </p>
              ))}
              {interpretation.status === 'needs-clarification' && interpretation.candidateIds.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {interpretation.candidateIds.map((id) => (
                    <Button key={id} onClick={() => chooseTarget(id)}>
                      {assets.find((x) => x.id === id)?.name ?? id}
                    </Button>
                  ))}
                </div>
              )}

              {interpretation.assumptions.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-zinc-500">
                  {interpretation.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}

              {validationError && <Callout tone="red">{validationError}</Callout>}
              {simError && !running && <Callout tone="red">{simError}</Callout>}

              <Button
                variant="danger"
                onClick={() => void confirm()}
                disabled={interpretation.status !== 'ready' || running}
                className="h-9 w-full"
              >
                {running ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirm and run
              </Button>
            </>
          )}
        </section>
      )}

      {summary && (
        <section className="space-y-2" aria-live="polite">
          <SectionTitle
            action={
              <button
                onClick={() => {
                  resetSimulation();
                  setSummary(null);
                }}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900"
              >
                <RotateCcw size={12} /> Reset map
              </button>
            }
          >
            Result
          </SectionTitle>
          <div className="space-y-1.5 text-xs leading-relaxed text-zinc-700">
            {summary.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { getActiveRun, scenariosFor, useTwinStore } from '../../store/twinStore';
import { METRIC_LABELS, MODEL_SOURCE_INFO, timeUnitFor } from '../../services/simulationAdapter';
import { AssetIcon, Badge, Button, Callout, SectionTitle, Segmented, inputClass } from './ui';
import type { AffectedNodePrediction, FailureSeverity, ModelSource, SimulationRun } from '../../types/twin';

const SEVERITIES: Array<{ value: FailureSeverity; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

function severityTone(severity?: string): 'red' | 'amber' | 'neutral' {
  if (severity === 'critical' || severity === 'high') return 'red';
  if (severity === 'medium' || severity === 'low') return 'amber';
  return 'neutral';
}

export function EngineBadge({ source, error }: { source: ModelSource; error?: string | null }) {
  const info = MODEL_SOURCE_INFO[source];
  return (
    <Callout tone={info.tone === 'model' ? 'brand' : info.tone === 'fallback' ? 'amber' : 'neutral'} icon={<Info size={13} />}>
      <span className="font-medium">{info.label}.</span> {info.detail}
      {error && <span className="mt-0.5 block opacity-80">{error}</span>}
    </Callout>
  );
}

export function NodePrediction({ node, source }: { node: AffectedNodePrediction; source: ModelSource }) {
  const unit = timeUnitFor(source);
  const metrics = Object.entries(node.metrics);
  return (
    <div className="space-y-2 text-xs text-zinc-600">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {node.severity && (
          <span>
            Severity <strong className="font-medium capitalize text-zinc-900">{node.severity}</strong>
          </span>
        )}
        {node.probability !== undefined && (
          <span>
            Probability <strong className="font-medium text-zinc-900">{node.probability}%</strong>
          </span>
        )}
        {node.timeToImpact !== undefined && (
          <span>
            Impact in{' '}
            <strong className="font-medium text-zinc-900">
              {node.timeToImpact}
              {unit && ` ${unit}`}
            </strong>
          </span>
        )}
      </div>
      {node.ruleAdjusted && (
        <p className="flex items-center gap-1.5 text-amber-700">
          <ShieldAlert size={12} className="shrink-0" /> Adjusted by backend rules
        </p>
      )}
      {metrics.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {metrics.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="truncate text-zinc-500">{METRIC_LABELS[k] ?? k}</dt>
              <dd className="text-zinc-900">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {node.effects.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-zinc-500">
          {node.effects.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {node.recommendations.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4">
          {node.recommendations.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScenarioForm() {
  const assets = useTwinStore((s) => s.assets);
  const simTargetId = useTwinStore((s) => s.simTargetId);
  const selectedId = useTwinStore((s) => s.selectedId);
  const scenarios = useTwinStore((s) => s.scenarios);
  const scenariosFromBackend = useTwinStore((s) => s.scenariosFromBackend);
  const running = useTwinStore((s) => s.simulation.status === 'running');
  const error = useTwinStore((s) => s.simulation.error);
  const graphStatus = useTwinStore((s) => s.graph.status);
  const setSimTarget = useTwinStore((s) => s.setSimTarget);
  const runScenario = useTwinStore((s) => s.runScenario);

  const targetId = simTargetId ?? selectedId ?? '';
  const target = assets.find((a) => a.id === targetId);
  const options = useMemo(() => (target ? scenariosFor(target.type, scenarios) : []), [target, scenarios]);
  const sortedAssets = useMemo(() => [...assets].sort((a, b) => a.name.localeCompare(b.name)), [assets]);
  const [failureType, setFailureType] = useState('');
  const [severity, setSeverity] = useState<FailureSeverity>('medium');

  useEffect(() => {
    if (options.length > 0 && !options.some((o) => o.id === failureType)) setFailureType(options[0].id);
  }, [options, failureType]);

  const selected = options.find((o) => o.id === failureType);

  const submit = () => {
    if (!target || !selected) return;
    void runScenario({
      targetAssetId: target.id,
      failureType: selected.id,
      failureTypeLabel: selected.name,
      severity,
      origin: { kind: 'manual' },
    });
  };

  return (
    <section className="space-y-3">
      <SectionTitle>New scenario</SectionTitle>
      <label className="block">
        <span className="mb-1 block text-xs text-zinc-500">Failing asset</span>
        <select value={targetId} onChange={(e) => setSimTarget(e.target.value || null)} className={inputClass}>
          <option value="">Select, or click one on the map</option>
          {sortedAssets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-zinc-500">Failure type</span>
        <select
          value={failureType}
          onChange={(e) => setFailureType(e.target.value)}
          disabled={!target}
          className={`${inputClass} disabled:bg-zinc-50 disabled:text-zinc-400`}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        {target && !scenariosFromBackend && <span className="mt-1 block text-[11px] text-zinc-400">Built-in list (backend list unavailable)</span>}
      </label>
      <div>
        <span className="mb-1 block text-xs text-zinc-500">Severity</span>
        <Segmented label="Severity" value={severity} options={SEVERITIES} onChange={setSeverity} />
      </div>
      {error && !running && <Callout tone="red">{error}</Callout>}
      {graphStatus === 'error' && !error && <Callout tone="amber">Backend appears to be offline.</Callout>}
      <Button variant="danger" onClick={submit} disabled={running || !target || !selected} className="h-9 w-full">
        {running ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
        {running ? 'Running…' : 'Run prediction'}
      </Button>
    </section>
  );
}

function Playback({ run }: { run: SimulationRun }) {
  const frameIndex = useTwinStore((s) => s.simulation.frameIndex);
  const playing = useTwinStore((s) => s.simulation.playing);
  const view = useTwinStore((s) => s.simulation.view);
  const setFrame = useTwinStore((s) => s.setFrame);
  const setPlaying = useTwinStore((s) => s.setPlaying);
  const setView = useTwinStore((s) => s.setSimulationView);

  const last = run.frames.length - 1;
  const index = Math.min(frameIndex, last);
  const frame = run.frames[index];
  const unit = timeUnitFor(run.result.modelSource);

  return (
    <section className="space-y-2.5 rounded-xl border border-zinc-200 p-3">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setFrame(Math.max(0, index - 1))}
          disabled={index === 0}
          className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
          aria-label="Previous step"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => {
            if (index >= last) setFrame(0);
            setPlaying(!playing);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-800"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>
        <button
          onClick={() => setFrame(Math.min(last, index + 1))}
          disabled={index >= last}
          className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
          aria-label="Next step"
        >
          <ChevronRight size={16} />
        </button>
        <input
          type="range"
          min={0}
          max={last}
          value={index}
          onChange={(e) => {
            setPlaying(false);
            setFrame(Number(e.target.value));
          }}
          aria-label="Step"
          className="ml-1 flex-1 accent-zinc-900"
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-zinc-700">
          {view === 'before'
            ? 'Before failure'
            : view === 'after'
              ? 'Full predicted impact'
              : `${index + 1}/${last + 1} · ${frame.label}${frame.timeToImpact !== undefined && unit ? ` ${unit}` : ''}`}
        </span>
        <div className="w-36 shrink-0">
          <Segmented
            label="Compare"
            value={view}
            options={[
              { value: 'before', label: 'Before' },
              { value: 'timeline', label: 'Step' },
              { value: 'after', label: 'After' },
            ]}
            onChange={setView}
          />
        </div>
      </div>
      <p className="text-[11px] text-zinc-400">Replay of one prediction, ordered by time to impact.</p>
    </section>
  );
}

function Compare({ run, runs }: { run: SimulationRun; runs: SimulationRun[] }) {
  const assets = useTwinStore((s) => s.assets);
  const others = runs.filter((r) => r.id !== run.id && r.datasetId === run.datasetId);
  const [otherId, setOtherId] = useState('');
  const other = others.find((r) => r.id === otherId);
  const name = (id: string) => assets.find((x) => x.id === id)?.name ?? id;

  const diff = useMemo(() => {
    if (!other) return null;
    const a = new Set(run.result.affected.map((n) => n.nodeId));
    const b = new Set(other.result.affected.map((n) => n.nodeId));
    return {
      both: [...a].filter((id) => b.has(id)).length,
      onlyThis: [...a].filter((id) => !b.has(id)),
      onlyOther: [...b].filter((id) => !a.has(id)),
    };
  }, [run, other]);

  if (others.length === 0) return null;

  return (
    <details className="group rounded-xl border border-zinc-200">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium text-zinc-800">
        Compare with another run
        <ChevronDown size={14} className="text-zinc-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 border-t border-zinc-100 p-3 text-xs text-zinc-600">
        <select value={otherId} onChange={(e) => setOtherId(e.target.value)} className={inputClass} aria-label="Run to compare">
          <option value="">Choose a run</option>
          {others.map((r) => (
            <option key={r.id} value={r.id}>
              {name(r.request.targetAssetId)} · {r.request.severity}
            </option>
          ))}
        </select>
        {diff && (
          <>
            <p>
              <strong className="font-medium text-zinc-900">{diff.both}</strong> affected in both
            </p>
            <p>
              <strong className="font-medium text-zinc-900">Only this run:</strong> {diff.onlyThis.map(name).join(', ') || 'none'}
            </p>
            <p>
              <strong className="font-medium text-zinc-900">Only the other:</strong> {diff.onlyOther.map(name).join(', ') || 'none'}
            </p>
          </>
        )}
      </div>
    </details>
  );
}

function Results({ run }: { run: SimulationRun }) {
  const assets = useTwinStore((s) => s.assets);
  const runs = useTwinStore((s) => s.simulation.runs);
  const select = useTwinStore((s) => s.select);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { result } = run;
  const resolved = assets.find((a) => a.id === result.sourceNodeId);
  const onMap = result.affected.filter((a) => a.onMap);
  const offMap = result.affected.filter((a) => !a.onMap);
  const oa = result.assessment;

  const stats: Array<[string, string]> = [['Affected', String(result.totalAffected ?? result.affected.length)]];
  if (oa.riskLevel) stats.push(['Risk', oa.riskLevel]);
  if (oa.estimatedRecoveryTime) stats.push(['Recovery', oa.estimatedRecoveryTime]);
  if (oa.affectedPopulation !== undefined) stats.push(['People (est.)', oa.affectedPopulation.toLocaleString('en-IN')]);

  return (
    <>
      <EngineBadge source={result.modelSource} error={result.modelError} />

      {result.sourceNodeId !== result.requestedNodeId && (
        <Callout tone="amber" icon={<AlertTriangle size={13} />}>
          Backend simulated “{resolved?.name ?? result.sourceNodeId}” instead of the requested asset.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-zinc-50 px-3 py-2">
            <div className="text-[11px] text-zinc-500">{label}</div>
            <div className="text-sm font-semibold capitalize text-zinc-900">{value}</div>
          </div>
        ))}
      </div>
      {oa.summary && <p className="text-xs leading-relaxed text-zinc-600">{oa.summary}</p>}

      <section>
        <SectionTitle>Affected assets</SectionTitle>
        {onMap.length === 0 ? (
          <p className="text-xs text-zinc-400">None on this map</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {onMap.map((n) => {
              const asset = assets.find((a) => a.id === n.nodeId);
              const open = expanded === n.nodeId;
              return (
                <li key={n.nodeId}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button
                      onClick={() => select(n.nodeId, { fly: true })}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {asset && <AssetIcon type={asset.type} size={14} />}
                      <span className="truncate text-sm text-zinc-800">{asset?.name ?? n.nodeName}</span>
                    </button>
                    {n.ruleAdjusted && (
                      <span title="Adjusted by backend rules" className="text-amber-600">
                        <ShieldAlert size={13} />
                      </span>
                    )}
                    {n.severity && (
                      <Badge tone={severityTone(n.severity)}>
                        <span className="capitalize">{n.severity}</span>
                      </Badge>
                    )}
                    <button
                      onClick={() => setExpanded(open ? null : n.nodeId)}
                      aria-expanded={open}
                      aria-label={open ? 'Hide details' : 'Show details'}
                      className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                    >
                      <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
                    </button>
                  </div>
                  {open && (
                    <div className="px-3 pb-3">
                      <NodePrediction node={n} source={result.modelSource} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {offMap.length > 0 && (
          <p className="mt-2 text-[11px] text-zinc-400">
            Not on map: {offMap.map((n) => n.nodeName).join(', ')}
          </p>
        )}
      </section>

      {oa.priorityActions && oa.priorityActions.length > 0 && (
        <section>
          <SectionTitle>Recommended actions</SectionTitle>
          <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-600">
            {oa.priorityActions.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      )}

      <Compare run={run} runs={runs} />
    </>
  );
}

export default function SimulateTab() {
  const run = useTwinStore(getActiveRun);
  const runs = useTwinStore((s) => s.simulation.runs);
  const datasetId = useTwinStore((s) => s.datasetId);
  const activeRunId = useTwinStore((s) => s.simulation.activeRunId);
  const assets = useTwinStore((s) => s.assets);
  const selectRun = useTwinStore((s) => s.selectRun);
  const resetSimulation = useTwinStore((s) => s.resetSimulation);

  const runsHere = runs.filter((r) => r.datasetId === datasetId);
  const name = (id: string) => assets.find((a) => a.id === id)?.name ?? id;

  return (
    <div className="space-y-5 p-4">
      <ScenarioForm />

      {runsHere.length > 0 && (
        <section className="space-y-3 border-t border-zinc-100 pt-5">
          <SectionTitle
            action={
              run && (
                <button onClick={resetSimulation} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900">
                  <RotateCcw size={12} /> Reset map
                </button>
              )
            }
          >
            Result
          </SectionTitle>
          <select
            value={activeRunId ?? ''}
            onChange={(e) => selectRun(e.target.value || null)}
            aria-label="Run"
            className={inputClass}
          >
            <option value="">No scenario (baseline)</option>
            {runsHere.map((r, i) => (
              <option key={r.id} value={r.id}>
                #{i + 1} {name(r.request.targetAssetId)} · {r.request.failureTypeLabel} · {r.request.severity}
              </option>
            ))}
          </select>
          {run && (
            <>
              <Playback run={run} />
              <Results run={run} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

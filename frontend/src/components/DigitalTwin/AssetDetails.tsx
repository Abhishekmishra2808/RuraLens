import { useMemo } from 'react';
import { ArrowLeft, Crosshair, Zap } from 'lucide-react';
import { useTwinStore } from '../../store/twinStore';
import { ASSET_TYPE_META, STATE_META, neighborhoodOf } from './twinVisuals';
import { useVisualStates } from './useTwinDerived';
import { AssetIcon, Button, ProvenanceBadge, SectionTitle, StatusDot } from './ui';
import { NodePrediction } from './SimulateTab';
import type { TwinEdge } from '../../types/twin';

function Connections({ title, ids, relationsFor }: { title: string; ids: string[]; relationsFor: (id: string) => string[] }) {
  const assets = useTwinStore((s) => s.assets);
  const select = useTwinStore((s) => s.select);
  if (ids.length === 0) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-zinc-700">
        {title} <span className="font-normal text-zinc-400">{ids.length}</span>
      </div>
      <ul className="-mx-1">
        {ids.map((id) => {
          const a = assets.find((x) => x.id === id);
          if (!a) return null;
          const relations = relationsFor(id);
          return (
            <li key={id}>
              <button
                onClick={() => select(id, { fly: true })}
                className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left hover:bg-zinc-50"
              >
                <AssetIcon type={a.type} size={14} />
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">{a.name}</span>
                {relations[0] && <span className="shrink-0 text-[11px] text-zinc-400">{relations[0].split(': ')[0]}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function AssetDetails() {
  const selectedId = useTwinStore((s) => s.selectedId);
  const asset = useTwinStore((s) => s.assets.find((a) => a.id === s.selectedId));
  const edges = useTwinStore((s) => s.graph.edges);
  const graphStatus = useTwinStore((s) => s.graph.status);
  const showProximity = useTwinStore((s) => s.layers.proximityLinks);
  const select = useTwinStore((s) => s.select);
  const setSimTarget = useTwinStore((s) => s.setSimTarget);
  const flyToAsset = useTwinStore((s) => s.flyToAsset);
  const { states, run } = useVisualStates();

  const neighborhood = useMemo(() => neighborhoodOf(selectedId, edges), [selectedId, edges]);
  const relationsFor = useMemo(() => {
    const byOther = new Map<string, TwinEdge>();
    for (const e of edges) {
      if (e.a === selectedId) byOther.set(e.b, e);
      else if (e.b === selectedId) byOther.set(e.a, e);
    }
    return (id: string) => byOther.get(id)?.relations ?? [];
  }, [edges, selectedId]);

  if (!asset) return null;

  const state = states.get(asset.id) ?? asset.condition;
  const prediction = run?.result.affected.find((a) => a.nodeId === asset.id);
  const isSource = run?.result.sourceNodeId === asset.id;
  const linkCount = neighborhood.upstream.length + neighborhood.downstream.length + neighborhood.twoWay.length;

  return (
    <div className="space-y-5">
      <button onClick={() => select(null)} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900">
        <ArrowLeft size={13} /> All assets
      </button>

      <header className="flex items-start gap-3">
        <AssetIcon type={asset.type} size={17} boxed />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-snug text-zinc-900">{asset.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>{ASSET_TYPE_META[asset.type].label}</span>
            <span className="flex items-center gap-1">
              <StatusDot color={STATE_META[state].color} /> {STATE_META[state].label}
            </span>
            <ProvenanceBadge provenance={asset.provenance} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => flyToAsset(asset.id)}>
          <Crosshair size={14} /> Focus
        </Button>
        <Button variant="danger" onClick={() => setSimTarget(asset.id)}>
          <Zap size={14} /> Simulate failure
        </Button>
      </div>

      {run && (isSource || prediction) && (
        <section>
          <SectionTitle>{isSource ? 'Failure source' : 'Predicted impact'}</SectionTitle>
          {isSource ? (
            <p className="text-sm text-zinc-700">
              {run.request.failureTypeLabel}, {run.request.severity} severity
            </p>
          ) : (
            prediction && <NodePrediction node={prediction} source={run.result.modelSource} />
          )}
        </section>
      )}

      <section>
        <SectionTitle>Details</SectionTitle>
        <dl className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 text-sm">
          {asset.attributes.map((a) => (
            <div key={a.label} className="flex justify-between gap-3 px-3 py-2">
              <dt className="text-zinc-500">{a.label}</dt>
              <dd className="text-right text-zinc-900">{a.value}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 px-3 py-2">
            <dt className="text-zinc-500">Location</dt>
            <dd className="font-mono text-xs text-zinc-700">
              {asset.position[1].toFixed(5)}, {asset.position[0].toFixed(5)}
            </dd>
          </div>
        </dl>
        {asset.provenance !== 'verified' && <p className="mt-1.5 text-[11px] text-zinc-400">Illustrative values, not live readings.</p>}
      </section>

      <section>
        <SectionTitle>Connections</SectionTitle>
        {graphStatus !== 'ready' ? (
          <p className="text-xs text-zinc-400">{graphStatus === 'loading' ? 'Loading…' : 'Unavailable (backend offline)'}</p>
        ) : linkCount === 0 && (!showProximity || neighborhood.proximity.length === 0) ? (
          <p className="text-xs text-zinc-400">No dependency links</p>
        ) : (
          <div className="space-y-3">
            <Connections title="Depends on" ids={neighborhood.upstream} relationsFor={relationsFor} />
            <Connections title="Supports" ids={neighborhood.downstream} relationsFor={relationsFor} />
            <Connections title="Linked both ways" ids={neighborhood.twoWay} relationsFor={relationsFor} />
            {showProximity && <Connections title="Nearby" ids={neighborhood.proximity} relationsFor={relationsFor} />}
          </div>
        )}
      </section>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { useTwinStore, type StatusFilter, type UserAssetType } from '../../store/twinStore';
import { getDataset } from '../../data/twinCities';
import { ASSET_TYPE_META, ASSET_TYPE_ORDER, STATE_META, matchesFilters } from './twinVisuals';
import { useVisualStates } from './useTwinDerived';
import { AssetIcon, Badge, Button, Callout, ProvenanceBadge, Segmented, StatusDot, inputClass } from './ui';
import AssetDetails from './AssetDetails';

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'healthy', label: 'Healthy' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'affected', label: 'Affected' },
  { value: 'failed', label: 'Failed' },
];

const USER_TYPES: UserAssetType[] = ['tank', 'pump', 'power', 'hospital', 'school', 'market', 'sensor'];

function AddAssetCard() {
  const position = useTwinStore((s) => s.draftLocation);
  const addUserAsset = useTwinStore((s) => s.addUserAsset);
  const setDraftLocation = useTwinStore((s) => s.setDraftLocation);
  const [name, setName] = useState('');
  const [type, setType] = useState<UserAssetType>('tank');
  if (!position) return null;

  const submit = () => {
    if (!name.trim()) return;
    void addUserAsset(type, name.trim(), position);
    setName('');
  };

  return (
    <section className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-900">Add asset</h3>
        <button
          onClick={() => setDraftLocation(null)}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
          aria-label="Cancel"
        >
          <X size={14} />
        </button>
      </div>
      <p className="font-mono text-[11px] text-zinc-500">
        {position[1].toFixed(5)}, {position[0].toFixed(5)}
      </p>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Name"
        aria-label="Asset name"
        className={inputClass}
      />
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as UserAssetType)}
          aria-label="Asset type"
          className={`${inputClass} flex-1`}
        >
          {USER_TYPES.map((t) => (
            <option key={t} value={t}>
              {ASSET_TYPE_META[t].label}
            </option>
          ))}
        </select>
        <Button variant="primary" onClick={submit} disabled={!name.trim()} className="h-9">
          Add
        </Button>
      </div>
      <p className="text-[11px] text-zinc-500">Links are created by the backend graph rules.</p>
    </section>
  );
}

function DatasetLine() {
  const datasetId = useTwinStore((s) => s.datasetId);
  const datasetStatus = useTwinStore((s) => s.datasetStatus);
  const datasetError = useTwinStore((s) => s.datasetError);
  const skipped = useTwinStore((s) => s.skipped);
  const graph = useTwinStore((s) => s.graph);
  const reloadGraph = useTwinStore((s) => s.reloadGraph);
  const dataset = getDataset(datasetId);
  const links = graph.edges.filter((e) => e.kind === 'dependency').length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-zinc-900">{dataset?.label ?? 'Dataset'}</span>
        {dataset && <ProvenanceBadge provenance={dataset.provenance} />}
      </div>
      {datasetStatus === 'loading' && (
        <p className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Loader2 size={12} className="animate-spin" /> Loading…
        </p>
      )}
      {datasetStatus === 'error' && <Callout tone="red">{datasetError}</Callout>}
      {skipped.length > 0 && (
        <Callout tone="amber">
          {skipped.length} record(s) without coordinates not shown.
        </Callout>
      )}
      {graph.status === 'loading' && (
        <p className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Loader2 size={12} className="animate-spin" /> Loading dependency graph…
        </p>
      )}
      {graph.status === 'ready' && (
        <p className="text-xs text-zinc-500">
          {links} dependency links
          {graph.hiddenNodeCount > 0 && ` · ${graph.hiddenNodeCount} backend-only nodes`}
        </p>
      )}
      {graph.status === 'error' && (
        <Callout tone="amber" icon={<AlertTriangle size={13} />}>
          <div className="flex items-center justify-between gap-2">
            <span>Backend offline. Links and simulation unavailable.</span>
            <button onClick={() => void reloadGraph()} className="flex items-center gap-1 font-medium hover:underline">
              <RefreshCw size={11} /> Retry
            </button>
          </div>
        </Callout>
      )}
    </div>
  );
}

function AssetList() {
  const assets = useTwinStore((s) => s.assets);
  const query = useTwinStore((s) => s.query);
  const typeFilter = useTwinStore((s) => s.typeFilter);
  const statusFilter = useTwinStore((s) => s.statusFilter);
  const setQuery = useTwinStore((s) => s.setQuery);
  const toggleType = useTwinStore((s) => s.toggleType);
  const clearTypeFilter = useTwinStore((s) => s.clearTypeFilter);
  const setStatusFilter = useTwinStore((s) => s.setStatusFilter);
  const select = useTwinStore((s) => s.select);
  const { states } = useVisualStates();

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    assets.forEach((a) => c.set(a.type, (c.get(a.type) ?? 0) + 1));
    return c;
  }, [assets]);

  const filtered = useMemo(
    () => assets.filter((a) => matchesFilters(a, states.get(a.id) ?? a.condition, query, typeFilter, statusFilter)),
    [assets, states, query, typeFilter, statusFilter],
  );

  return (
    <>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search assets"
          aria-label="Search assets"
          className={`${inputClass} pl-8`}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ASSET_TYPE_ORDER.filter((t) => counts.has(t)).map((t) => {
          const active = typeFilter.includes(t);
          const Icon = ASSET_TYPE_META[t].icon;
          return (
            <button
              key={t}
              onClick={() => toggleType(t)}
              aria-pressed={active}
              className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors ${
                active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
              }`}
            >
              <Icon size={13} />
              {ASSET_TYPE_META[t].plural}
              <span className="text-zinc-400">{counts.get(t)}</span>
            </button>
          );
        })}
        {typeFilter.length > 0 && (
          <button onClick={clearTypeFilter} className="h-7 px-1.5 text-xs text-zinc-500 hover:text-zinc-900">
            Clear
          </button>
        )}
      </div>

      <Segmented label="Status" value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} />

      <ul className="-mx-1 space-y-0.5" aria-label="Assets">
        {filtered.length === 0 && (
          <li className="py-6 text-center text-xs text-zinc-400">{assets.length === 0 ? 'No assets loaded' : 'No matches'}</li>
        )}
        {filtered.map((a) => {
          const state = states.get(a.id) ?? a.condition;
          return (
            <li key={a.id}>
              <button
                onClick={() => select(a.id, { fly: true })}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-zinc-50"
              >
                <AssetIcon type={a.type} />
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">{a.name}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-500">
                  <StatusDot color={STATE_META[state].color} />
                  {STATE_META[state].label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-zinc-400">Right-click the map to add an asset.</p>
    </>
  );
}

export default function AssetsTab() {
  const selectedId = useTwinStore((s) => s.selectedId);
  const hasDraft = useTwinStore((s) => Boolean(s.draftLocation));
  const userAdded = useTwinStore((s) => s.assets.filter((a) => a.provenance === 'user-added').length);

  return (
    <div className="space-y-4 p-4">
      {hasDraft && <AddAssetCard />}
      {selectedId ? (
        <AssetDetails />
      ) : (
        <>
          <DatasetLine />
          {userAdded > 0 && <Badge tone="brand">{userAdded} added by you</Badge>}
          <AssetList />
        </>
      )}
    </div>
  );
}

import { useEffect } from 'react';
import { Layers, LocateFixed, Map as MapIcon, MapPin, Minus, Plus, Sparkles, Zap, type LucideIcon } from 'lucide-react';
import { useTwinStore, type PanelTab } from '../../store/twinStore';
import { TWIN_CITIES } from '../../data/twinCities';
import { IconButton } from './ui';
import SceneNotice from './SceneNotice';
import AssetsTab from './AssetsTab';
import SimulateTab from './SimulateTab';
import CopilotPanel from './CopilotPanel';
import LayersTab from './LayersTab';
import type { LoadState } from '../../types/twin';

const TABS: Array<{ id: PanelTab; label: string; icon: LucideIcon }> = [
  { id: 'assets', label: 'Assets', icon: MapPin },
  { id: 'simulate', label: 'Simulate', icon: Zap },
  { id: 'ask', label: 'Ask', icon: Sparkles },
  { id: 'layers', label: 'Layers', icon: Layers },
];

const DOT: Record<LoadState, string> = {
  idle: 'bg-zinc-300',
  loading: 'bg-zinc-400 animate-pulse',
  ready: 'bg-brand-500',
  fallback: 'bg-amber-500',
  error: 'bg-red-500',
};

const STATE_TEXT: Record<LoadState, string> = {
  idle: 'off',
  loading: 'loading',
  ready: 'loaded',
  fallback: 'fallback in use',
  error: 'unavailable',
};

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)));
}

/** +/- keyboard zoom; mouse wheel and pinch zoom are handled by Cesium. */
function useZoomShortcuts() {
  const zoomCamera = useTwinStore((s) => s.zoomCamera);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (e.key === '+' || e.key === '=') zoomCamera('in');
      else if (e.key === '-' || e.key === '_') zoomCamera('out');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomCamera]);
}

function SourceStatus() {
  const scene = useTwinStore((s) => s.sceneStatus);
  const graph = useTwinStore((s) => s.graph.status);
  const graphState: LoadState = graph === 'ready' ? 'ready' : graph === 'loading' ? 'loading' : graph === 'error' ? 'error' : 'idle';
  const rows: Array<[string, LoadState]> = [
    ['Terrain', scene.terrain],
    ['Imagery', scene.imagery],
    ['Buildings', scene.buildings],
    ['Graph', graphState],
  ];
  return (
    <footer className="flex shrink-0 items-center gap-3 border-t border-zinc-200 px-4 py-2 text-[11px] text-zinc-500" aria-label="Data sources">
      {rows.map(([label, s]) => (
        <span key={label} className="flex items-center gap-1.5" title={`${label}: ${STATE_TEXT[s]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${DOT[s]}`} />
          {label}
        </span>
      ))}
    </footer>
  );
}

export default function TwinPanel({ onOpenClassic }: { onOpenClassic: () => void }) {
  const cityId = useTwinStore((s) => s.cityId);
  const tab = useTwinStore((s) => s.panelTab);
  const running = useTwinStore((s) => s.simulation.status === 'running');
  const setCity = useTwinStore((s) => s.setCity);
  const setTab = useTwinStore((s) => s.setPanelTab);
  const zoomCamera = useTwinStore((s) => s.zoomCamera);
  const resetCamera = useTwinStore((s) => s.resetCamera);
  useZoomShortcuts();

  return (
    <aside className="flex min-h-0 flex-1 flex-col bg-white" aria-label="Digital twin panel">
      <header className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="twin-city" className="block text-[11px] text-zinc-500">
            Digital twin
          </label>
          <select
            id="twin-city"
            value={cityId}
            onChange={(e) => void setCity(e.target.value)}
            className="-ml-1 max-w-full cursor-pointer rounded bg-transparent px-1 text-base font-semibold text-zinc-900 hover:bg-zinc-50 focus:outline-none"
          >
            {TWIN_CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center" role="group" aria-label="View">
          <IconButton label="Zoom in (+)" onClick={() => zoomCamera('in')}>
            <Plus size={16} />
          </IconButton>
          <IconButton label="Zoom out (-)" onClick={() => zoomCamera('out')}>
            <Minus size={16} />
          </IconButton>
          <IconButton label="Reset view" onClick={resetCamera}>
            <LocateFixed size={16} />
          </IconButton>
          <span className="mx-1 h-5 w-px bg-zinc-200" />
          <IconButton label="Classic map" onClick={onOpenClassic}>
            <MapIcon size={16} />
          </IconButton>
        </div>
      </header>

      <nav className="flex shrink-0 gap-1 border-b border-zinc-200 px-3" role="tablist" aria-label="Panel">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={`relative flex h-10 flex-1 items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
                active ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Icon size={14} />
              {label}
              {id === 'simulate' && running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
              {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-zinc-900" />}
            </button>
          );
        })}
      </nav>

      <SceneNotice />

      <div className="min-h-0 flex-1 overflow-y-auto" role="tabpanel">
        {tab === 'assets' && <AssetsTab />}
        {tab === 'simulate' && <SimulateTab />}
        {tab === 'ask' && <CopilotPanel />}
        {tab === 'layers' && <LayersTab />}
      </div>

      <SourceStatus />
    </aside>
  );
}

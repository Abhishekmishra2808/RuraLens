import { useTwinStore } from '../../store/twinStore';
import { HAS_CESIUM_TOKEN } from '../../config/cesium';
import { EDGE_COLORS, STATE_LEGEND } from './twinVisuals';
import { SectionTitle, Segmented, StatusDot } from './ui';
import type { BasemapStyle, LayerVisibility } from '../../types/twin';

const LAYER_ROWS: Array<{ key: keyof LayerVisibility; label: string; hint?: string; needsToken?: boolean }> = [
  { key: 'buildings', label: '3D buildings', hint: 'OSM coverage in Delhi is incomplete', needsToken: true },
  { key: 'terrain', label: 'Terrain', needsToken: true },
  { key: 'infrastructure', label: 'Assets' },
  { key: 'physicalNetworks', label: 'Roads and water mains' },
  { key: 'dependencyNetwork', label: 'Dependency links', hint: 'From the backend graph' },
  { key: 'proximityLinks', label: 'Proximity links', hint: 'Linked only by distance' },
  { key: 'labels', label: 'Labels' },
];

const BASEMAPS: Array<{ value: BasemapStyle; label: string; disabled?: boolean }> = [
  { value: 'satellite-labels', label: 'Hybrid', disabled: !HAS_CESIUM_TOKEN },
  { value: 'satellite', label: 'Satellite', disabled: !HAS_CESIUM_TOKEN },
  { value: 'streets', label: 'Streets' },
];

const LINE_LEGEND: Array<{ label: string; color: string; dashed?: boolean }> = [
  { label: 'Dependency', color: EDGE_COLORS.dependency },
  { label: 'Upstream of selected', color: EDGE_COLORS.upstream },
  { label: 'Failure propagation', color: EDGE_COLORS.propagation },
  { label: 'Proximity', color: EDGE_COLORS.proximity, dashed: true },
  { label: 'Water main', color: EDGE_COLORS.pipe, dashed: true },
];

function Toggle({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40 ${checked ? 'bg-zinc-900' : 'bg-zinc-200'}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

export default function LayersTab() {
  const layers = useTwinStore((s) => s.layers);
  const basemap = useTwinStore((s) => s.basemap);
  const toggleLayer = useTwinStore((s) => s.toggleLayer);
  const setBasemap = useTwinStore((s) => s.setBasemap);

  return (
    <div className="space-y-6 p-4">
      <section>
        <SectionTitle>Basemap</SectionTitle>
        <Segmented label="Basemap" value={basemap} options={BASEMAPS} onChange={setBasemap} />
      </section>

      <section>
        <SectionTitle>Layers</SectionTitle>
        <ul className="space-y-3">
          {LAYER_ROWS.map((row) => {
            const disabled = row.needsToken && !HAS_CESIUM_TOKEN;
            return (
              <li key={row.key} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className={`text-sm ${disabled ? 'text-zinc-400' : 'text-zinc-800'}`}>{row.label}</div>
                  {(row.hint || disabled) && (
                    <div className="text-[11px] text-zinc-400">{disabled ? 'Needs a Cesium ion token' : row.hint}</div>
                  )}
                </div>
                <Toggle label={row.label} checked={layers[row.key] && !disabled} disabled={disabled} onChange={() => toggleLayer(row.key)} />
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <SectionTitle>Legend</SectionTitle>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-zinc-600">
          {STATE_LEGEND.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <StatusDot color={s.color} className="h-2.5 w-2.5" />
              {s.label}
            </li>
          ))}
        </ul>
        <ul className="mt-3 space-y-2 text-xs text-zinc-600">
          {LINE_LEGEND.map((l) => (
            <li key={l.label} className="flex items-center gap-2">
              <span className="flex h-4 w-8 items-center justify-center rounded bg-zinc-800" aria-hidden>
                <span
                  className="block h-0 w-5 border-t-2"
                  style={{ borderColor: l.color, borderStyle: l.dashed ? 'dashed' : 'solid' }}
                />
              </span>
              {l.label}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Map as MapIcon } from 'lucide-react';
import { TwinScene } from './cesium/TwinScene';
import { useTwinStore } from '../../store/twinStore';
import { getCity } from '../../data/twinCities';
import { CESIUM_ION_TOKEN } from '../../config/cesium';
import { ASSET_TYPE_META, STATE_META, matchesFilters, neighborhoodOf, propagationLinks } from './twinVisuals';
import { useVisualStates } from './useTwinDerived';
interface Props {
  onOpenClassic: () => void;
}

export default function CesiumCity({ onOpenClassic }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const creditRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TwinScene | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [tilesPending, setTilesPending] = useState(0);

  const assets = useTwinStore((s) => s.assets);
  const edges = useTwinStore((s) => s.graph.edges);
  const selectedId = useTwinStore((s) => s.selectedId);
  const query = useTwinStore((s) => s.query);
  const typeFilter = useTwinStore((s) => s.typeFilter);
  const statusFilter = useTwinStore((s) => s.statusFilter);
  const layers = useTwinStore((s) => s.layers);
  const basemap = useTwinStore((s) => s.basemap);
  const cameraRequest = useTwinStore((s) => s.cameraRequest);
  const { states, frame, run: activeRun } = useVisualStates();

  // Create exactly one viewer per mount; StrictMode's mount/unmount/mount destroys the first.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let scene: TwinScene;
    try {
      const store = useTwinStore.getState();
      scene = new TwinScene(container, {
        token: CESIUM_ION_TOKEN,
        basemap: store.basemap,
        terrain: store.layers.terrain,
        buildings: store.layers.buildings,
        creditContainer: creditRef.current ?? undefined,
        callbacks: {
          onStatus: (patch) => useTwinStore.getState().setSceneStatus(patch),
          onPick: (id) => useTwinStore.getState().select(id),
          onPickCluster: (ids) => useTwinStore.getState().flyToAssets(ids),
          onHover: setHover,
          onContextMenu: (info) => useTwinStore.getState().setDraftLocation(info.position),
          onTilesPending: setTilesPending,
        },
      });
    } catch (err) {
      console.error('[CesiumCity] Viewer initialisation failed', err);
      setInitError(
        (err as Error)?.message?.includes('WebGL')
          ? 'This browser or device could not start WebGL, which the 3D city needs.'
          : `The 3D engine failed to start: ${(err as Error)?.message ?? 'unknown error'}`,
      );
      return;
    }
    sceneRef.current = scene;
    scene.flyToOverview(getCity(useTwinStore.getState().cityId), 0);
    setSceneReady(true);

    const observer = new ResizeObserver(() => scene.resize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      scene.destroy();
      sceneRef.current = null;
      setSceneReady(false);
    };
  }, []);

  // Data → scene
  useEffect(() => {
    if (sceneReady) sceneRef.current?.setAssets(assets);
  }, [assets, sceneReady]);

  useEffect(() => {
    if (sceneReady) sceneRef.current?.setEdges(edges);
  }, [edges, sceneReady]);

  useEffect(() => {
    if (sceneReady) sceneRef.current?.setBasemap(basemap);
  }, [basemap, sceneReady]);

  useEffect(() => {
    if (sceneReady) sceneRef.current?.setBuildingsVisible(layers.buildings);
  }, [layers.buildings, sceneReady]);

  useEffect(() => {
    if (sceneReady) sceneRef.current?.setTerrainEnabled(layers.terrain);
  }, [layers.terrain, sceneReady]);

  // Camera requests
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !cameraRequest) return;
    if (cameraRequest.kind === 'overview') scene.flyToOverview(getCity(useTwinStore.getState().cityId));
    else if (cameraRequest.kind === 'asset') scene.flyToAsset(cameraRequest.id);
    else if (cameraRequest.kind === 'zoom') scene.zoom(cameraRequest.direction);
    else scene.flyToAssets(cameraRequest.ids);
  }, [cameraRequest]);

  const neighborhood = useMemo(() => neighborhoodOf(selectedId, edges), [selectedId, edges]);
  const visible = useMemo(
    () =>
      new Set(
        assets
          .filter((a) => matchesFilters(a, states.get(a.id) ?? a.condition, query, typeFilter, statusFilter))
          .map((a) => a.id),
      ),
    [assets, states, query, typeFilter, statusFilter],
  );
  const propagation = useMemo(() => propagationLinks(activeRun, frame), [activeRun, frame]);

  // Visual state → scene (restyles in place; never recreates the viewer)
  useEffect(() => {
    if (!sceneReady) return;
    sceneRef.current?.render({
      states,
      visible,
      selectedId,
      neighborhood,
      propagation,
      layers,
      simulationActive: Boolean(activeRun),
    });
  }, [sceneReady, states, visible, selectedId, neighborhood, propagation, layers, activeRun]);

  const hoveredAsset = hover ? assets.find((a) => a.id === hover.id) : null;
  const hoveredState = hoveredAsset ? states.get(hoveredAsset.id) ?? hoveredAsset.condition : null;

  if (initError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 p-6">
        <div className="max-w-sm rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-3 text-red-600" size={24} />
          <h3 className="mb-1.5 text-base font-semibold text-zinc-900">3D view unavailable</h3>
          <p className="mb-5 text-sm text-zinc-600">{initError}</p>
          <button
            onClick={onOpenClassic}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            <MapIcon size={16} /> Open classic map
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="twin-cesium absolute inset-0" />

      {tilesPending > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-zinc-900/10" role="status" aria-label="Loading map tiles">
          <div className="twin-progress h-full w-1/3 bg-zinc-900/60" />
        </div>
      )}

      {/* Required data attributions (Cesium ion, OpenStreetMap, imagery providers). */}
      <div
        ref={creditRef}
        className="twin-credits absolute bottom-0 left-0 right-0 z-40 flex min-h-[22px] items-center justify-end bg-white/85 px-2 text-[10px] text-zinc-600 backdrop-blur-sm"
      />

      {hover && hoveredAsset && hoveredState && (
        <div
          className="pointer-events-none absolute z-30 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: hover.x, top: Math.max(hover.y - 88, 8) }}
        >
          <div className="font-medium text-zinc-900">{hoveredAsset.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-zinc-500">
            <span>{ASSET_TYPE_META[hoveredAsset.type].label}</span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: STATE_META[hoveredState].color }} />
              {STATE_META[hoveredState].label}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

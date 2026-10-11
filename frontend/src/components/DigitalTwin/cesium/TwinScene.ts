/**
 * Imperative owner of the Cesium Viewer and all twin graphics.
 *
 * React components never touch Cesium objects directly: they create one
 * TwinScene per mount, push plain data into it, and receive plain callbacks.
 * Entities are created once per asset/edge and then restyled in place.
 */
import {
  ArcType,
  BoundingSphere,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Cesium3DTileStyle,
  Color,
  ColorMaterialProperty,
  ConstantPositionProperty,
  ConstantProperty,
  CustomDataSource,
  DistanceDisplayCondition,
  EllipsoidTerrainProvider,
  Entity,
  HeadingPitchRange,
  HeightReference,
  ImageryLayer,
  Ion,
  IonWorldImageryStyle,
  LabelStyle,
  Math as CesiumMath,
  NearFarScalar,
  OpenStreetMapImageryProvider,
  PolylineArrowMaterialProperty,
  PolylineDashMaterialProperty,
  PolylineGlowMaterialProperty,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Terrain,
  VerticalOrigin,
  Viewer,
  createOsmBuildingsAsync,
  createWorldImageryAsync,
  defined,
  sampleTerrainMostDetailed,
  type Cesium3DTileset,
  type MaterialProperty,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import type {
  AssetVisualState,
  BasemapStyle,
  LayerVisibility,
  LngLat,
  SceneStatus,
  TwinAsset,
  TwinEdge,
} from '../../../types/twin';
import type { CityConfig } from '../../../data/twinCities';
import { EDGE_COLORS, STATE_META, isAffectedState, type Neighborhood } from '../twinVisuals';
import { MARKER_HEIGHT, MARKER_WIDTH, clusterIcon, markerIcon } from './markerIcons';

export interface TwinSceneCallbacks {
  onStatus: (patch: Partial<SceneStatus>) => void;
  onPick: (assetId: string | null) => void;
  onPickCluster: (assetIds: string[]) => void;
  onHover: (info: { id: string; x: number; y: number } | null) => void;
  onContextMenu: (info: { x: number; y: number; position: LngLat }) => void;
  onTilesPending: (pending: number) => void;
}

export interface SceneRenderInput {
  states: Map<string, AssetVisualState>;
  visible: Set<string>;
  selectedId: string | null;
  neighborhood: Neighborhood;
  propagation: Array<{ from: string; to: string }>;
  layers: LayerVisibility;
  simulationActive: boolean;
}

const ARC_BASE_HEIGHT = 12;
const ARC_SAMPLES = 28;
const PROPAGATION_GROW_MS = 900;
const MAX_ANIMATED_LINKS = 40;
/** Matches screenSpaceCameraController.minimumZoomDistance plus a small margin. */
const ZOOM_MIN_DISTANCE = 40;
const ZOOM_MAX_DISTANCE = 2_000_000;

const STATE_PRIORITY: AssetVisualState[] = [
  'failed',
  'predicted-failure',
  'affected-critical',
  'affected-high',
  'affected-medium',
  'affected-low',
  'degraded',
  'unknown',
  'healthy',
];

const css = (hex: string, alpha = 1) => Color.fromCssColorString(hex).withAlpha(alpha);
const pointKey = (p: LngLat) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;

export class TwinScene {
  private readonly viewer: Viewer;
  private readonly handler: ScreenSpaceEventHandler;
  private readonly callbacks: TwinSceneCallbacks;
  private readonly hasToken: boolean;

  private readonly assetsDS = new CustomDataSource('twin-assets');
  private readonly physicalDS = new CustomDataSource('twin-physical');
  private readonly networkDS = new CustomDataSource('twin-network');
  private readonly propagationDS = new CustomDataSource('twin-propagation');

  private assets = new Map<string, TwinAsset>();
  private assetEntities = new Map<string, Entity>();
  private physicalEntities = new Map<string, Entity>();
  private edges: TwinEdge[] = [];
  private edgeEntities = new Map<string, Entity>();
  private propagation = new Map<string, { entity: Entity; start: number }>();
  private pickIndex = new Map<Entity, string>();
  private styleKeys = new Map<string, string>();
  private stateById = new Map<string, AssetVisualState>();

  private ground = new Map<string, number>();
  private heightsVersion = 0;
  private heightsReady = true;
  private terrainEnabled = false;
  private terrainRequested: boolean | null = null;
  private terrainReady = false;
  private sampleToken = 0;

  private buildings: Cesium3DTileset | null = null;
  private buildingsVisible = true;
  private basemap: BasemapStyle | null = null;

  private pulseIds = new Set<string>();
  private rafId: number | null = null;
  private hoverScheduled = false;
  private hoveredId: string | null = null;
  private lastInput: SceneRenderInput | null = null;
  private destroyed = false;

  constructor(
    container: HTMLElement,
    options: {
      token?: string;
      basemap: BasemapStyle;
      terrain: boolean;
      buildings: boolean;
      creditContainer?: HTMLElement;
      callbacks: TwinSceneCallbacks;
    },
  ) {
    this.callbacks = options.callbacks;
    this.hasToken = Boolean(options.token);
    if (options.token) Ion.defaultAccessToken = options.token;

    this.viewer = new Viewer(container, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      vrButton: false,
      // Base imagery is added explicitly below so no ion request is made without a token.
      baseLayer: false,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
      creditContainer: options.creditContainer,
    });

    const { scene } = this.viewer;
    scene.globe.baseColor = css('#e9e9e7');
    scene.globe.depthTestAgainstTerrain = true;
    scene.globe.showWaterEffect = true;
    scene.screenSpaceCameraController.minimumZoomDistance = 25;
    scene.globe.tileLoadProgressEvent.addEventListener((pending: number) => this.callbacks.onTilesPending(pending));

    this.assetsDS.clustering.enabled = true;
    this.assetsDS.clustering.pixelRange = 28;
    this.assetsDS.clustering.minimumClusterSize = 3;
    this.assetsDS.clustering.clusterEvent.addEventListener((entities, cluster) => {
      const ids = entities.map((e) => this.pickIndex.get(e)).filter((id): id is string => Boolean(id));
      const worst = STATE_PRIORITY.find((s) => ids.some((id) => this.stateById.get(id) === s)) ?? 'healthy';
      cluster.label.show = false;
      cluster.billboard.show = true;
      cluster.billboard.image = clusterIcon(entities.length, STATE_META[worst].color) as unknown as string;
      cluster.billboard.width = 44;
      cluster.billboard.height = 44;
      cluster.billboard.verticalOrigin = VerticalOrigin.CENTER;
      cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    });

    // Order matters for draw order of overlapping translucent lines.
    void this.viewer.dataSources.add(this.physicalDS);
    void this.viewer.dataSources.add(this.networkDS);
    void this.viewer.dataSources.add(this.propagationDS);
    void this.viewer.dataSources.add(this.assetsDS);

    this.handler = new ScreenSpaceEventHandler(scene.canvas);
    this.installInteraction();

    this.buildingsVisible = options.buildings;
    this.setBasemap(options.basemap);
    this.setTerrainEnabled(options.terrain);
    void this.loadBuildings();
  }

  // -------------------------------------------------------------------------
  // Lifecycle

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (!this.handler.isDestroyed()) this.handler.destroy();
    if (!this.viewer.isDestroyed()) this.viewer.destroy();
  }

  private requestRender() {
    if (!this.destroyed) this.viewer.scene.requestRender();
  }

  // -------------------------------------------------------------------------
  // Base layers

  setBasemap(style: BasemapStyle) {
    if (this.destroyed || style === this.basemap) return;
    this.basemap = style;
    const layers = this.viewer.imageryLayers;
    layers.removeAll(true);

    const useOsm = style === 'streets' || !this.hasToken;
    if (useOsm) {
      layers.add(new ImageryLayer(new OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' })));
      this.callbacks.onStatus({ imagery: this.hasToken ? 'ready' : 'fallback' });
      this.requestRender();
      return;
    }

    this.callbacks.onStatus({ imagery: 'loading' });
    const layer = ImageryLayer.fromProviderAsync(
      createWorldImageryAsync({
        style: style === 'satellite' ? IonWorldImageryStyle.AERIAL : IonWorldImageryStyle.AERIAL_WITH_LABELS,
      }),
    );
    layer.readyEvent.addEventListener(() => {
      this.callbacks.onStatus({ imagery: 'ready' });
      this.requestRender();
    });
    layer.errorEvent.addEventListener(() => {
      if (this.destroyed) return;
      layers.remove(layer, true);
      layers.add(new ImageryLayer(new OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' })), 0);
      this.callbacks.onStatus({
        imagery: 'fallback',
        message: 'Cesium ion imagery failed to load; showing OpenStreetMap instead.',
      });
      this.requestRender();
    });
    layers.add(layer);
  }

  setTerrainEnabled(enabled: boolean) {
    if (this.destroyed || enabled === this.terrainRequested) return;
    this.terrainRequested = enabled;
    const { scene } = this.viewer;

    this.terrainReady = false;
    if (!enabled || !this.hasToken) {
      scene.terrainProvider = new EllipsoidTerrainProvider();
      this.terrainEnabled = false;
      this.ground.clear();
      this.heightsReady = true;
      this.heightsVersion++;
      this.callbacks.onStatus({ terrain: this.hasToken ? 'idle' : 'fallback' });
      this.rerender();
      return;
    }

    this.terrainEnabled = true;
    this.heightsReady = false;
    this.callbacks.onStatus({ terrain: 'loading' });
    const terrain = scene.setTerrain(Terrain.fromWorldTerrain({ requestWaterMask: true, requestVertexNormals: true }));
    terrain.readyEvent.addEventListener(() => {
      if (this.destroyed || !this.terrainEnabled) return;
      this.terrainReady = true;
      this.callbacks.onStatus({ terrain: 'ready' });
      void this.sampleGroundHeights();
    });
    terrain.errorEvent.addEventListener(() => {
      if (this.destroyed) return;
      scene.terrainProvider = new EllipsoidTerrainProvider();
      this.terrainEnabled = false;
      this.ground.clear();
      this.heightsReady = true;
      this.heightsVersion++;
      this.callbacks.onStatus({
        terrain: 'fallback',
        message: 'Cesium World Terrain failed to load; using a flat globe.',
      });
      this.rerender();
    });
  }

  private async loadBuildings() {
    if (!this.hasToken) {
      this.callbacks.onStatus({ buildings: 'fallback' });
      return;
    }
    this.callbacks.onStatus({ buildings: 'loading' });
    try {
      const tileset = await createOsmBuildingsAsync({
        style: new Cesium3DTileStyle({ color: "color('#f4f4f5', 0.96)" }),
      });
      if (this.destroyed) {
        tileset.destroy();
        return;
      }
      tileset.show = this.buildingsVisible;
      this.viewer.scene.primitives.add(tileset);
      this.buildings = tileset;
      this.callbacks.onStatus({ buildings: 'ready' });
      this.requestRender();
    } catch (err) {
      if (this.destroyed) return;
      console.warn('[TwinScene] OSM Buildings unavailable', err);
      this.callbacks.onStatus({ buildings: 'error', message: 'Cesium OSM Buildings could not be loaded.' });
    }
  }

  setBuildingsVisible(visible: boolean) {
    this.buildingsVisible = visible;
    if (this.buildings) this.buildings.show = visible;
    this.requestRender();
  }

  // -------------------------------------------------------------------------
  // Terrain heights for elevated dependency arcs

  private groundAt(p: LngLat): number {
    return this.terrainEnabled ? this.ground.get(pointKey(p)) ?? 0 : 0;
  }

  private async sampleGroundHeights() {
    // Arcs stay hidden until real terrain is available to sample against.
    if (this.terrainEnabled && !this.terrainReady) return;
    if (!this.terrainEnabled || this.assets.size === 0) {
      this.heightsReady = true;
      this.rerender();
      return;
    }
    const token = ++this.sampleToken;
    const points = Array.from(this.assets.values()).map((a) => a.position);
    const missing = points.filter((p) => !this.ground.has(pointKey(p)));
    if (missing.length === 0) {
      this.heightsReady = true;
      this.rerender();
      return;
    }
    try {
      const cartos = missing.map((p) => Cartographic.fromDegrees(p[0], p[1]));
      const sampled = await sampleTerrainMostDetailed(this.viewer.terrainProvider, cartos);
      if (this.destroyed || token !== this.sampleToken) return;
      sampled.forEach((c, i) => this.ground.set(pointKey(missing[i]), Number.isFinite(c.height) ? c.height : 0));
    } catch (err) {
      console.warn('[TwinScene] Terrain height sampling failed; arcs use ellipsoid heights', err);
    }
    if (this.destroyed || token !== this.sampleToken) return;
    this.heightsReady = true;
    this.heightsVersion++;
    this.rerender();
  }

  private arcPositions(from: LngLat, to: LngLat, progress = 1): Cartesian3[] {
    const h0 = this.groundAt(from) + ARC_BASE_HEIGHT;
    const h1 = this.groundAt(to) + ARC_BASE_HEIGHT;
    const start = Cartesian3.fromDegrees(from[0], from[1], h0);
    const end = Cartesian3.fromDegrees(to[0], to[1], h1);
    const lift = Math.min(Math.max(Cartesian3.distance(start, end) * 0.22, 40), 650);
    const steps = Math.max(2, Math.ceil(ARC_SAMPLES * progress));
    const out: Cartesian3[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * progress;
      out.push(
        Cartesian3.fromDegrees(
          from[0] + (to[0] - from[0]) * t,
          from[1] + (to[1] - from[1]) * t,
          h0 + (h1 - h0) * t + Math.sin(Math.PI * t) * lift,
        ),
      );
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Data

  setAssets(assets: TwinAsset[]) {
    if (this.destroyed) return;
    this.assets = new Map(assets.map((a) => [a.id, a]));

    for (const [id, entity] of this.assetEntities) {
      if (!this.assets.has(id)) {
        this.assetsDS.entities.remove(entity);
        this.assetEntities.delete(id);
        this.pickIndex.delete(entity);
      }
    }
    for (const [id, entity] of this.physicalEntities) {
      if (!this.assets.has(id)) {
        this.physicalDS.entities.remove(entity);
        this.physicalEntities.delete(id);
        this.pickIndex.delete(entity);
      }
    }
    this.styleKeys.clear();

    for (const a of assets) {
      if (!this.assetEntities.has(a.id)) {
        const entity = this.assetsDS.entities.add({
          id: a.id,
          position: Cartesian3.fromDegrees(a.position[0], a.position[1]),
          billboard: {
            image: markerIcon(a.type, a.condition, false),
            width: MARKER_WIDTH,
            height: MARKER_HEIGHT,
            verticalOrigin: VerticalOrigin.BOTTOM,
            heightReference: HeightReference.CLAMP_TO_TERRAIN,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new NearFarScalar(400, 1.0, 25000, 0.55),
          },
          label: {
            text: a.name,
            font: '500 12px Geist, system-ui, sans-serif',
            fillColor: css('#18181b'),
            style: LabelStyle.FILL,
            showBackground: true,
            backgroundColor: css('#ffffff', 0.92),
            backgroundPadding: new Cartesian2(7, 4),
            verticalOrigin: VerticalOrigin.BOTTOM,
            pixelOffset: new Cartesian2(0, -(MARKER_HEIGHT + 4)),
            heightReference: HeightReference.CLAMP_TO_TERRAIN,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            distanceDisplayCondition: new DistanceDisplayCondition(0, 2200),
          },
        });
        this.assetEntities.set(a.id, entity);
        this.pickIndex.set(entity, a.id);
      } else {
        const entity = this.assetEntities.get(a.id)!;
        entity.position = new ConstantPositionProperty(Cartesian3.fromDegrees(a.position[0], a.position[1]));
        if (entity.label) entity.label.text = new ConstantProperty(a.name);
      }

      if (a.path && (a.type === 'road' || a.type === 'pipe') && !this.physicalEntities.has(a.id)) {
        const entity = this.physicalDS.entities.add({
          id: `phys:${a.id}`,
          polyline: {
            positions: Cartesian3.fromDegreesArray(a.path.flat()),
            clampToGround: true,
            width: a.type === 'road' ? 7 : 4,
            material: this.physicalMaterial(a.type, null),
          },
        });
        this.physicalEntities.set(a.id, entity);
        this.pickIndex.set(entity, a.id);
      }
    }

    this.heightsReady = !this.terrainEnabled;
    void this.sampleGroundHeights();
    this.rerender();
  }

  setEdges(edges: TwinEdge[]) {
    if (this.destroyed) return;
    this.edges = edges;
    const keys = new Set(edges.map((e) => e.key));
    for (const [key, entity] of this.edgeEntities) {
      if (!keys.has(key)) {
        this.networkDS.entities.remove(entity);
        this.edgeEntities.delete(key);
        this.styleKeys.delete(`edge:${key}`);
      }
    }
    for (const e of edges) {
      if (this.edgeEntities.has(e.key)) continue;
      const entity = this.networkDS.entities.add({
        id: `edge:${e.key}`,
        show: false,
        polyline: { positions: [], width: 2, arcType: ArcType.NONE },
      });
      this.edgeEntities.set(e.key, entity);
    }
    this.rerender();
  }

  // -------------------------------------------------------------------------
  // Styling

  private physicalMaterial(type: 'road' | 'pipe', state: AssetVisualState | null): MaterialProperty {
    const affected = state && isAffectedState(state);
    if (type === 'road') {
      return new ColorMaterialProperty(affected ? css(STATE_META[state!].color, 0.9) : css(EDGE_COLORS.road, 0.55));
    }
    return new PolylineDashMaterialProperty({
      color: affected ? css(STATE_META[state!].color, 0.95) : css(EDGE_COLORS.pipe, 0.9),
      gapColor: Color.TRANSPARENT,
      dashLength: 14,
    });
  }

  private rerender() {
    if (this.lastInput) this.render(this.lastInput);
    else this.requestRender();
  }

  render(input: SceneRenderInput) {
    if (this.destroyed) return;
    this.lastInput = input;
    this.stateById = input.states;
    const { layers, selectedId, neighborhood } = input;
    const now = performance.now();

    const pulse = new Set<string>();
    const neighbors = new Set([
      ...neighborhood.upstream,
      ...neighborhood.downstream,
      ...neighborhood.twoWay,
      ...(layers.proximityLinks ? neighborhood.proximity : []),
    ]);

    // Assets
    for (const [id, entity] of this.assetEntities) {
      const asset = this.assets.get(id);
      if (!asset) continue;
      const state = input.states.get(id) ?? asset.condition;
      const selected = id === selectedId;
      const visible = layers.infrastructure && input.visible.has(id);
      const emphasized = selected || neighbors.has(id) || isAffectedState(state) || id === this.hoveredId;
      const labelVisible = visible && layers.labels;
      if (state === 'failed') pulse.add(id);

      const key = `${state}|${selected}|${visible}|${labelVisible}|${emphasized}`;
      if (this.styleKeys.get(id) === key) continue;
      this.styleKeys.set(id, key);

      entity.show = visible;
      if (entity.billboard) {
        entity.billboard.image = new ConstantProperty(markerIcon(asset.type, state, selected));
        entity.billboard.scale = this.scaleProperty(id, state === 'failed', selected ? 1.15 : 1);
      }
      if (entity.label) {
        entity.label.show = new ConstantProperty(labelVisible);
        entity.label.distanceDisplayCondition = new ConstantProperty(
          new DistanceDisplayCondition(0, emphasized ? 15000 : 2200),
        );
      }
    }

    // Physical roads / pipes
    for (const [id, entity] of this.physicalEntities) {
      const asset = this.assets.get(id);
      if (!asset || (asset.type !== 'road' && asset.type !== 'pipe')) continue;
      const state = input.states.get(id) ?? asset.condition;
      const visible = layers.physicalNetworks && input.visible.has(id);
      const key = `phys|${state}|${visible}|${id === selectedId}`;
      if (this.styleKeys.get(`phys:${id}`) === key) continue;
      this.styleKeys.set(`phys:${id}`, key);
      entity.show = visible;
      if (entity.polyline) {
        entity.polyline.material = this.physicalMaterial(asset.type, state);
        entity.polyline.width = new ConstantProperty(
          (asset.type === 'road' ? 7 : 4) + (id === selectedId ? 3 : 0),
        );
      }
    }

    // Dependency network
    const hasFocus = Boolean(selectedId) || input.simulationActive;
    for (const e of this.edges) {
      const entity = this.edgeEntities.get(e.key);
      if (!entity) continue;
      const a = this.assets.get(e.a);
      const b = this.assets.get(e.b);
      const role = neighborhood.edgeRole.get(e.key);
      const endpointsVisible =
        layers.infrastructure && Boolean(a && b) && input.visible.has(e.a) && input.visible.has(e.b);
      const layerAllows =
        e.kind === 'proximity'
          ? layers.proximityLinks
          : layers.dependencyNetwork || (role !== undefined && role !== 'proximity');
      const visible = this.heightsReady && endpointsVisible && layerAllows;
      const key = `edge|${visible}|${role ?? '-'}|${hasFocus}|${this.heightsVersion}`;
      if (this.styleKeys.get(`edge:${e.key}`) === key) continue;
      this.styleKeys.set(`edge:${e.key}`, key);

      entity.show = visible;
      if (!visible || !entity.polyline || !a || !b) continue;

      // Orient so arrows point along the backend edge direction.
      const [from, to] = e.direction === 'backward' ? [b, a] : [a, b];
      entity.polyline.positions = new ConstantProperty(this.arcPositions(from.position, to.position));

      let color = e.kind === 'proximity' ? EDGE_COLORS.proximity : EDGE_COLORS.dependency;
      let alpha = e.kind === 'proximity' ? 0.35 : 0.6;
      let width = e.kind === 'proximity' ? 1.5 : 2.5;
      if (role === 'upstream') color = EDGE_COLORS.upstream;
      if (role === 'downstream') color = EDGE_COLORS.downstream;
      if (role === 'twoWay') color = EDGE_COLORS.twoWay;
      if (role) {
        alpha = 0.95;
        width = e.kind === 'proximity' ? 2 : 4;
      } else if (hasFocus) {
        alpha = e.kind === 'proximity' ? 0.12 : 0.18;
      }

      entity.polyline.width = new ConstantProperty(width);
      entity.polyline.material =
        e.kind === 'proximity'
          ? new PolylineDashMaterialProperty({ color: css(color, alpha), dashLength: 10 })
          : e.direction === 'both'
            ? new ColorMaterialProperty(css(color, alpha))
            : new PolylineArrowMaterialProperty(css(color, alpha));
    }

    this.renderPropagation(input, now);
    this.pulseIds = pulse;
    this.ensureAnimating();
    this.requestRender();
  }

  private scaleProperty(id: string, pulsing: boolean, base: number) {
    if (!pulsing) return new ConstantProperty(base);
    return new CallbackProperty(
      () => (this.pulseIds.has(id) ? base * (1 + 0.1 * Math.sin(performance.now() / 260)) : base),
      false,
    );
  }

  private renderPropagation(input: SceneRenderInput, now: number) {
    const wanted = new Map(
      input.propagation
        .filter((p) => this.assets.has(p.from) && this.assets.has(p.to))
        .slice(0, MAX_ANIMATED_LINKS)
        .map((p) => [`${p.from}|${p.to}`, p]),
    );

    for (const [key, item] of this.propagation) {
      if (!wanted.has(key)) {
        this.propagationDS.entities.remove(item.entity);
        this.propagation.delete(key);
      }
    }

    for (const [key, p] of wanted) {
      const existing = this.propagation.get(key);
      if (existing) {
        existing.entity.show = this.heightsReady;
        continue;
      }
      const from = this.assets.get(p.from)!.position;
      const to = this.assets.get(p.to)!.position;
      const start = now;
      const entity = this.propagationDS.entities.add({
        id: `prop:${key}`,
        show: this.heightsReady,
        polyline: {
          positions: new CallbackProperty(() => {
            const progress = Math.min(1, (performance.now() - start) / PROPAGATION_GROW_MS);
            return this.arcPositions(from, to, Math.max(progress, 0.02));
          }, false),
          width: 9,
          arcType: ArcType.NONE,
          material: new PolylineGlowMaterialProperty({
            color: css(EDGE_COLORS.propagation, 0.95),
            glowPower: 0.22,
            taperPower: 0.9,
          }),
        },
      });
      this.propagation.set(key, { entity, start });
    }
  }

  private needsAnimation(): boolean {
    if (this.pulseIds.size > 0) return true;
    const now = performance.now();
    for (const item of this.propagation.values()) {
      if (now - item.start < PROPAGATION_GROW_MS + 50) return true;
    }
    return false;
  }

  private ensureAnimating() {
    if (this.rafId !== null || this.destroyed) return;
    const tick = () => {
      if (this.destroyed) return;
      this.viewer.scene.requestRender();
      if (this.needsAnimation()) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  // -------------------------------------------------------------------------
  // Interaction

  private assetIdFromPick(picked: any): string | null {
    if (!defined(picked) || !picked.id) return null;
    if (picked.id instanceof Entity) return this.pickIndex.get(picked.id) ?? null;
    return null;
  }

  private installInteraction() {
    const { scene } = this.viewer;

    this.handler.setInputAction((ev: ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = scene.pick(ev.position);
      if (defined(picked) && Array.isArray(picked.id)) {
        const ids = (picked.id as Entity[]).map((e) => this.pickIndex.get(e)).filter((x): x is string => Boolean(x));
        if (ids.length > 0) this.callbacks.onPickCluster(ids);
        return;
      }
      this.callbacks.onPick(this.assetIdFromPick(picked));
    }, ScreenSpaceEventType.LEFT_CLICK);

    this.handler.setInputAction((ev: ScreenSpaceEventHandler.MotionEvent) => {
      if (this.hoverScheduled) return;
      this.hoverScheduled = true;
      const position = Cartesian2.clone(ev.endPosition);
      requestAnimationFrame(() => {
        this.hoverScheduled = false;
        if (this.destroyed) return;
        const id = this.assetIdFromPick(scene.pick(position));
        scene.canvas.style.cursor = id ? 'pointer' : '';
        if (id !== this.hoveredId) {
          this.hoveredId = id;
          this.rerender();
        }
        this.callbacks.onHover(id ? { id, x: position.x, y: position.y } : null);
      });
    }, ScreenSpaceEventType.MOUSE_MOVE);

    this.handler.setInputAction((ev: ScreenSpaceEventHandler.PositionedEvent) => {
      const ray = this.viewer.camera.getPickRay(ev.position);
      const cartesian = ray ? scene.globe.pick(ray, scene) : undefined;
      if (!cartesian) return;
      const c = Cartographic.fromCartesian(cartesian);
      this.callbacks.onContextMenu({
        x: ev.position.x,
        y: ev.position.y,
        position: [CesiumMath.toDegrees(c.longitude), CesiumMath.toDegrees(c.latitude)],
      });
    }, ScreenSpaceEventType.RIGHT_CLICK);
  }

  // -------------------------------------------------------------------------
  // Camera

  flyToOverview(city: CityConfig, duration = 1.8) {
    if (this.destroyed) return;
    const target = Cartesian3.fromDegrees(city.center.lon, city.center.lat, 0);
    this.viewer.camera.flyToBoundingSphere(new BoundingSphere(target, 0), {
      offset: new HeadingPitchRange(
        CesiumMath.toRadians(city.overview.headingDeg),
        CesiumMath.toRadians(city.overview.pitchDeg),
        city.overview.range,
      ),
      duration,
    });
  }

  flyToAsset(id: string) {
    const asset = this.assets.get(id);
    if (!asset || this.destroyed) return;
    const target = Cartesian3.fromDegrees(asset.position[0], asset.position[1], this.groundAt(asset.position));
    this.viewer.camera.flyToBoundingSphere(new BoundingSphere(target, asset.path ? 250 : 0), {
      offset: new HeadingPitchRange(this.viewer.camera.heading, CesiumMath.toRadians(-35), asset.path ? 900 : 650),
      duration: 1.4,
    });
  }

  flyToAssets(ids: string[]) {
    const points = ids
      .map((id) => this.assets.get(id))
      .filter((a): a is TwinAsset => Boolean(a))
      .map((a) => Cartesian3.fromDegrees(a.position[0], a.position[1], this.groundAt(a.position)));
    if (points.length === 0 || this.destroyed) return;
    const sphere = BoundingSphere.fromPoints(points);
    this.viewer.camera.flyToBoundingSphere(sphere, {
      offset: new HeadingPitchRange(
        this.viewer.camera.heading,
        CesiumMath.toRadians(-45),
        Math.max(sphere.radius * 3.2, 700),
      ),
      duration: 1.4,
    });
  }

  /** Smoothly halves (in) or doubles (out) the distance to the point at the screen centre. */
  zoom(direction: 'in' | 'out') {
    if (this.destroyed) return;
    const { scene, camera } = this.viewer;
    const center = new Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2);
    const ray = camera.getPickRay(center);
    const hit = ray ? scene.globe.pick(ray, scene) : undefined;
    const distance = hit ? Cartesian3.distance(camera.position, hit) : camera.positionCartographic.height;
    const target =
      direction === 'in' ? Math.max(distance * 0.5, ZOOM_MIN_DISTANCE) : Math.min(distance * 2, ZOOM_MAX_DISTANCE);
    const move = distance - target;
    if (Math.abs(move) < 1) return;
    const destination = Cartesian3.add(
      camera.position,
      Cartesian3.multiplyByScalar(camera.direction, move, new Cartesian3()),
      new Cartesian3(),
    );
    camera.flyTo({
      destination,
      orientation: { heading: camera.heading, pitch: camera.pitch, roll: camera.roll },
      duration: 0.35,
    });
  }

  resize() {
    if (!this.destroyed) this.viewer.resize();
  }
}

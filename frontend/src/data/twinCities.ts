/**
 * City and dataset registry for the 3D digital twin.
 * Add a city by registering its camera framing and one or more datasets.
 */
import type { DataProvenance } from '../types/twin';

export interface CityConfig {
  id: string;
  name: string;
  region: string;
  /** Overview camera target and framing. */
  center: { lon: number; lat: number };
  overview: { range: number; pitchDeg: number; headingDeg: number };
  defaultDatasetId: string;
}

export interface DatasetConfig {
  id: string;
  cityId: string;
  label: string;
  provenance: DataProvenance;
  description: string;
  /** Raw infraState in the shape used by the existing backend GNN routes. */
  load: () => Promise<RawInfraState>;
}

/** Loose shape of the existing infraState contract (see backend gnnImpactService). */
export interface RawInfraState {
  waterTanks?: any[];
  waterPumps?: any[];
  waterPipes?: any[];
  buildings?: any[];
  powerNodes?: any[];
  sensors?: any[];
  roads?: any[];
}

export const TWIN_CITIES: CityConfig[] = [
  {
    id: 'delhi',
    name: 'New Delhi',
    region: 'Delhi, India',
    center: { lon: 77.2190, lat: 28.6322 },
    overview: { range: 1450, pitchDeg: -45, headingDeg: 0 },
    defaultDatasetId: 'delhi-demo',
  },
  {
    id: 'pune',
    name: 'Pune',
    region: 'Maharashtra, India',
    center: { lon: 73.8567, lat: 18.5204 },
    overview: { range: 2200, pitchDeg: -40, headingDeg: 0 },
    defaultDatasetId: 'pune-demo',
  },
];

export const TWIN_DATASETS: DatasetConfig[] = [
  {
    id: 'delhi-demo',
    cityId: 'delhi',
    label: 'Central Delhi sample network',
    provenance: 'synthetic-demo',
    description:
      'Synthetic sample assets placed at plausible locations around Connaught Place. Not surveyed infrastructure.',
    load: async () => (await import('./delhiDemoInfra')).delhiDemoInfraData,
  },
  {
    id: 'pune-demo',
    cityId: 'pune',
    label: 'Pune demo network (existing)',
    provenance: 'synthetic-demo',
    description:
      'The existing RuraLens 8-node demo dataset, kept at its original Pune coordinates. Not surveyed infrastructure.',
    load: async () => (await import('./demoInfraData')).demoInfraData,
  },
];

export const DEFAULT_CITY_ID = 'delhi';

export function getCity(cityId: string): CityConfig {
  return TWIN_CITIES.find((c) => c.id === cityId) ?? TWIN_CITIES[0];
}

export function getDataset(datasetId: string): DatasetConfig | undefined {
  return TWIN_DATASETS.find((d) => d.id === datasetId);
}

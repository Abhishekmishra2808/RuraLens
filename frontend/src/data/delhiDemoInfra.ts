/**
 * SYNTHETIC demonstration dataset for central New Delhi.
 *
 * None of these assets are real, surveyed infrastructure. Locations are plausible
 * sample points around Connaught Place / Janpath / Mandi House chosen so the
 * twin has something meaningful to render; names say "Demo" and describe the
 * surrounding area only. Attribute values (capacity, load, levels) are
 * illustrative and must not be read as observed operational data.
 *
 * Shape matches the infraState contract consumed by backend/utils/gnnImpactService.js
 * (roads need `path`, pumps link to tanks via `tankId`, pipes via `fromNode`/`toNode`).
 *
 * Names avoid "main", pump names avoid "station", and non-road names avoid "road":
 * the backend's guided rules (backend/routes/gnn.js) match these as substrings of
 * the node id/name and would otherwise promote nodes regardless of the model.
 */

export const delhiDemoInfraData = {
  waterTanks: [
    {
      id: 'dl-tank-01',
      name: 'Demo Overhead Tank (Gole Market area)',
      coords: [77.2046, 28.6336],
      capacity: 900000,
      currentLevel: 68,
      status: 'operational',
    },
    {
      id: 'dl-tank-02',
      name: 'Demo Underground Reservoir (Mandi House area)',
      coords: [77.2338, 28.6259],
      capacity: 2500000,
      currentLevel: 81,
      status: 'operational',
    },
  ],

  waterPumps: [
    {
      id: 'dl-pump-01',
      name: 'Demo Booster Pump (Baba Kharak Singh Marg)',
      coords: [77.2093, 28.6281],
      capacity: 4000,
      currentFlow: 2900,
      status: 'operational',
      tankId: 'dl-tank-01',
    },
    {
      id: 'dl-pump-02',
      name: 'Demo Booster Pump (Barakhamba area)',
      coords: [77.2276, 28.6296],
      capacity: 5000,
      currentFlow: 1400,
      status: 'warning',
      tankId: 'dl-tank-02',
    },
  ],

  waterPipes: [
    {
      id: 'dl-pipe-01',
      name: 'Demo Trunk Pipeline (BKS Marg feeder)',
      fromNode: 'dl-pump-01',
      toNode: 'dl-hospital-01',
      status: 'ok',
      path: [
        [77.2093, 28.6281],
        [77.2080, 28.6262],
        [77.2066, 28.6244],
      ],
    },
    {
      id: 'dl-pipe-02',
      name: 'Demo Distribution Pipeline (Connaught Place ring)',
      fromNode: 'dl-pump-01',
      toNode: 'dl-market-01',
      status: 'ok',
      path: [
        [77.2093, 28.6281],
        [77.2128, 28.6303],
        [77.2160, 28.6338],
      ],
    },
    {
      id: 'dl-pipe-03',
      name: 'Demo Distribution Pipeline (Barakhamba feeder)',
      fromNode: 'dl-pump-02',
      toNode: 'dl-hospital-02',
      status: 'ok',
      path: [
        [77.2276, 28.6296],
        [77.2290, 28.6250],
        [77.2297, 28.6203],
      ],
    },
  ],

  buildings: [
    {
      id: 'dl-hospital-01',
      name: 'Demo Hospital (west of Connaught Place)',
      type: 'health',
      coords: [77.2066, 28.6244],
      occupancy: 600,
      status: 'operational',
    },
    {
      id: 'dl-hospital-02',
      name: 'Demo Clinic (Mandi House area)',
      type: 'health',
      coords: [77.2297, 28.6203],
      occupancy: 120,
      status: 'operational',
    },
    {
      id: 'dl-school-01',
      name: 'Demo School (Gole Market area)',
      type: 'school',
      coords: [77.2018, 28.6297],
      occupancy: 900,
      status: 'operational',
    },
    {
      id: 'dl-school-02',
      name: 'Demo School (Barakhamba area)',
      type: 'school',
      coords: [77.2248, 28.6352],
      occupancy: 700,
      status: 'operational',
    },
    {
      id: 'dl-market-01',
      name: 'Demo Market (Connaught Place outer circle)',
      type: 'market',
      coords: [77.2160, 28.6338],
      occupancy: 2500,
      status: 'operational',
    },
    {
      id: 'dl-market-02',
      name: 'Demo Market (Janpath)',
      type: 'commercial',
      coords: [77.2184, 28.6236],
      occupancy: 1500,
      status: 'operational',
    },
  ],

  powerNodes: [
    {
      id: 'dl-power-01',
      name: 'Demo 33kV Substation (Connaught Place area)',
      type: 'substation',
      coords: [77.2138, 28.6268],
      capacity: 20000,
      currentLoad: 14600,
      status: 'operational',
    },
    {
      id: 'dl-power-02',
      name: 'Demo Distribution Transformer (Janpath)',
      type: 'transformer',
      coords: [77.2203, 28.6190],
      capacity: 1000,
      currentLoad: 870,
      status: 'warning',
    },
  ],

  sensors: [
    {
      id: 'dl-sensor-01',
      name: 'Demo Flow Sensor (BKS Marg pipeline)',
      type: 'flow',
      coords: [77.2080, 28.6262],
      unit: 'L/min',
      status: 'operational',
    },
    {
      id: 'dl-sensor-02',
      name: 'Demo Pressure Sensor (Mandi House reservoir)',
      type: 'pressure',
      coords: [77.2330, 28.6270],
      unit: 'bar',
      status: 'offline',
    },
  ],

  roads: [
    {
      id: 'dl-road-01',
      name: 'Demo Corridor (Janpath, approx. alignment)',
      type: 'arterial',
      width: 24,
      condition: 'good',
      path: [
        [77.2189, 28.6297],
        [77.2192, 28.6246],
        [77.2195, 28.6190],
        [77.2198, 28.6140],
      ],
    },
    {
      id: 'dl-road-02',
      name: 'Demo Corridor (Baba Kharak Singh Marg, approx. alignment)',
      type: 'arterial',
      width: 20,
      condition: 'fair',
      path: [
        [77.2141, 28.6298],
        [77.2110, 28.6275],
        [77.2082, 28.6253],
        [77.2055, 28.6232],
      ],
    },
    {
      id: 'dl-road-03',
      name: 'Demo Corridor (Barakhamba Road, approx. alignment)',
      type: 'arterial',
      width: 20,
      condition: 'good',
      path: [
        [77.2212, 28.6312],
        [77.2250, 28.6302],
        [77.2290, 28.6288],
        [77.2330, 28.6268],
      ],
    },
  ],
};

export default delhiDemoInfraData;

import { describe, it, expect } from 'vitest'
import {
  MinHeap,
  getGroundPositions,
  findRouteDijkstra,
  calculateSnapshot,
  calculateFullTimeline,
  exportResultFile,
  exportResults,
  classifyFailure,
  FAILURE_REASON_NO_CLIENT_SAT,
  FAILURE_REASON_GATEWAY_OFFLINE,
  FAILURE_REASON_NO_GW_SAT,
  FAILURE_REASON_ISL_DISCONNECTED,
  FAILURE_DESCRIPTIONS_RU,
  R_EARTH,
  MU,
  OMEGA,
} from './orbit'
import type { PQItem } from './orbit'
import type { Scenario } from '../types/scenario'

describe('Failure Classification Helpers', () => {
  it('correctly classifies no_client_satellite', () => {
    const res = classifyFailure(false, 1, true)
    expect(res.code).toBe(FAILURE_REASON_NO_CLIENT_SAT)
    expect(res.description).toBe(FAILURE_DESCRIPTIONS_RU[FAILURE_REASON_NO_CLIENT_SAT])
  })

  it('correctly classifies gateway_offline', () => {
    const res = classifyFailure(true, 0, true)
    expect(res.code).toBe(FAILURE_REASON_GATEWAY_OFFLINE)
    expect(res.description).toBe(FAILURE_DESCRIPTIONS_RU[FAILURE_REASON_GATEWAY_OFFLINE])
  })

  it('correctly classifies no_gateway_satellite', () => {
    const res = classifyFailure(true, 1, false)
    expect(res.code).toBe(FAILURE_REASON_NO_GW_SAT)
    expect(res.description).toBe(FAILURE_DESCRIPTIONS_RU[FAILURE_REASON_NO_GW_SAT])
  })

  it('correctly classifies isl_disconnected', () => {
    const res = classifyFailure(true, 1, true)
    expect(res.code).toBe(FAILURE_REASON_ISL_DISCONNECTED)
    expect(res.description).toBe(FAILURE_DESCRIPTIONS_RU[FAILURE_REASON_ISL_DISCONNECTED])
  })
})

describe('MinHeap', () => {
  it('returns undefined on empty pop and reports 0 length', () => {
    const heap = new MinHeap()
    expect(heap.length).toBe(0)
    expect(heap.pop()).toBeUndefined()
  })

  it('pushes and pops a single element', () => {
    const heap = new MinHeap()
    const item: PQItem = { pri: 5, sec: 10, curr: 'A', path: ['A'], totalDist: 10 }
    heap.push(item)
    expect(heap.length).toBe(1)
    expect(heap.pop()).toBe(item)
    expect(heap.length).toBe(0)
  })

  it('correctly bubbles up elements based on primary priority', () => {
    const heap = new MinHeap()
    const items: PQItem[] = [
      { pri: 50, sec: 0, curr: 'A', path: [], totalDist: 0 },
      { pri: 30, sec: 0, curr: 'B', path: [], totalDist: 0 },
      { pri: 40, sec: 0, curr: 'C', path: [], totalDist: 0 },
      { pri: 10, sec: 0, curr: 'D', path: [], totalDist: 0 },
      { pri: 20, sec: 0, curr: 'E', path: [], totalDist: 0 },
    ]
    items.forEach((it) => heap.push(it))
    expect(heap.length).toBe(5)

    const popped: number[] = []
    while (heap.length > 0) {
      popped.push(heap.pop()!.pri)
    }
    expect(popped).toEqual([10, 20, 30, 40, 50])
  })

  it('uses secondary priority as tie-breaker when primary priorities match', () => {
    const heap = new MinHeap()
    const items: PQItem[] = [
      { pri: 2, sec: 300, curr: 'A', path: [], totalDist: 300 },
      { pri: 2, sec: 100, curr: 'B', path: [], totalDist: 100 },
      { pri: 1, sec: 500, curr: 'C', path: [], totalDist: 500 },
      { pri: 2, sec: 200, curr: 'D', path: [], totalDist: 200 },
      { pri: 1, sec: 150, curr: 'E', path: [], totalDist: 150 },
    ]
    items.forEach((it) => heap.push(it))

    const result: Array<[number, number]> = []
    while (heap.length > 0) {
      const top = heap.pop()!
      result.push([top.pri, top.sec])
    }
    expect(result).toEqual([
      [1, 150],
      [1, 500],
      [2, 100],
      [2, 200],
      [2, 300],
    ])
  })

  it('correctly sinks down root element when both left and right children exist', () => {
    const heap = new MinHeap()
    heap.push({ pri: 10, sec: 0, curr: '10', path: [], totalDist: 0 })
    heap.push({ pri: 20, sec: 0, curr: '20', path: [], totalDist: 0 })
    heap.push({ pri: 15, sec: 0, curr: '15', path: [], totalDist: 0 })
    heap.push({ pri: 30, sec: 0, curr: '30', path: [], totalDist: 0 })
    heap.push({ pri: 25, sec: 0, curr: '25', path: [], totalDist: 0 })

    expect(heap.pop()!.pri).toBe(10)
    expect(heap.pop()!.pri).toBe(15)
    expect(heap.pop()!.pri).toBe(20)
    expect(heap.pop()!.pri).toBe(25)
    expect(heap.pop()!.pri).toBe(30)
  })

  it('handles sink down when only left child exists', () => {
    const heap = new MinHeap()
    heap.push({ pri: 10, sec: 0, curr: '10', path: [], totalDist: 0 })
    heap.push({ pri: 20, sec: 0, curr: '20', path: [], totalDist: 0 })

    expect(heap.pop()!.pri).toBe(10)
    expect(heap.pop()!.pri).toBe(20)
    expect(heap.pop()).toBeUndefined()
  })
})

describe('getGroundPositions', () => {
  it('converts geographical coordinates to Cartesian ECEF accurately', () => {
    const testScenario: Scenario = {
      schema_version: 'cosmo-A-1.0',
      meta: { id: 'test', title: 'Ground Station Test' },
      environment: {
        altitude_km: 550,
        inclination_deg: 87,
        earth_angle0_deg: 0,
        horizon_s: 360,
        step_s: 120,
        min_elevation_deg: 10,
        isl_range_km: 3000,
        target_availability: 0.9,
      },
      design: { launch_stage: 1, planes: [], satellites: [] },
      ground_sites: [
        { id: 'EQUATOR_PRIME', name: 'Eq 0', role: 'client', lat_deg: 0, lon_deg: 0 },
        { id: 'EQUATOR_90E', name: 'Eq 90E', role: 'gateway', lat_deg: 0, lon_deg: 90 },
        { id: 'EQUATOR_180', name: 'Eq 180', role: 'client', lat_deg: 0, lon_deg: 180 },
        { id: 'NORTH_POLE', name: 'NP', role: 'gateway', lat_deg: 90, lon_deg: 0 },
        { id: 'SOUTH_POLE', name: 'SP', role: 'client', lat_deg: -90, lon_deg: 45 },
      ],
      failures: [],
      gateway_outages: [],
    }

    const positions = getGroundPositions(testScenario)
    expect(positions).toHaveLength(5)

    const eqPrime = positions.find((p) => p.id === 'EQUATOR_PRIME')!
    expect(eqPrime.x).toBeCloseTo(R_EARTH, 4)
    expect(eqPrime.y).toBeCloseTo(0, 4)
    expect(eqPrime.z).toBeCloseTo(0, 4)
    expect(eqPrime.role).toBe('client')

    const eq90 = positions.find((p) => p.id === 'EQUATOR_90E')!
    expect(eq90.x).toBeCloseTo(0, 4)
    expect(eq90.y).toBeCloseTo(R_EARTH, 4)
    expect(eq90.z).toBeCloseTo(0, 4)
    expect(eq90.role).toBe('gateway')

    const eq180 = positions.find((p) => p.id === 'EQUATOR_180')!
    expect(eq180.x).toBeCloseTo(-R_EARTH, 4)
    expect(eq180.y).toBeCloseTo(0, 4)
    expect(eq180.z).toBeCloseTo(0, 4)

    const np = positions.find((p) => p.id === 'NORTH_POLE')!
    expect(np.x).toBeCloseTo(0, 4)
    expect(np.y).toBeCloseTo(0, 4)
    expect(np.z).toBeCloseTo(R_EARTH, 4)

    const sp = positions.find((p) => p.id === 'SOUTH_POLE')!
    expect(sp.x).toBeCloseTo(0, 4)
    expect(sp.y).toBeCloseTo(0, 4)
    expect(sp.z).toBeCloseTo(-R_EARTH, 4)

    positions.forEach((pos) => {
      const r = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z)
      expect(r).toBeCloseTo(R_EARTH, 4)
    })
  })
})

describe('Satellite Propagation and Keplerian Orbit Mechanics', () => {
  const baseScenario: Scenario = {
    schema_version: 'cosmo-A-1.0',
    meta: { id: 'test_kepler', title: 'Kepler Test' },
    environment: {
      altitude_km: 550,
      inclination_deg: 90,
      earth_angle0_deg: 0,
      horizon_s: 3600,
      step_s: 120,
      min_elevation_deg: 10,
      isl_range_km: 3000,
      target_availability: 0.9,
    },
    design: {
      launch_stage: 2,
      planes: [
        { id: 'P1', raan_deg: 0, phase_deg: 0 },
        { id: 'P2', raan_deg: 90, phase_deg: 30 },
      ],
      satellites: [
        { id: 'S1', plane_id: 'P1', slot_deg: 0, launch_batch: 1 },
        { id: 'S2', plane_id: 'P1', slot_deg: 90, launch_batch: 2 },
        { id: 'S3_UNLAUNCHED', plane_id: 'P1', slot_deg: 180, launch_batch: 3 },
        { id: 'S4_P2', plane_id: 'P2', slot_deg: 0, launch_batch: 1 },
      ],
    },
    ground_sites: [],
    failures: [{ satellite_id: 'S2', start_s: 60, end_s: 180 }],
    gateway_outages: [],
  }

  it('computes expected orbital radius and mean motion constants', () => {
    const r = R_EARTH + 550
    const expectedN = Math.sqrt(MU / Math.pow(r, 3))
    const period = (2 * Math.PI) / expectedN
    expect(period).toBeGreaterThan(5000)
    expect(period).toBeLessThan(6000)
    expect(OMEGA).toBeCloseTo((2 * Math.PI) / 86164.09054, 8)
  })

  it('propagates satellite positions and maintains orbital altitude', () => {
    const snap = calculateSnapshot(baseScenario, 0)
    expect(snap.satellites).toHaveLength(4)

    for (const sat of snap.satellites) {
      const radius = Math.sqrt(sat.x_km * sat.x_km + sat.y_km * sat.y_km + sat.z_km * sat.z_km)
      expect(radius).toBeCloseTo(R_EARTH + 550, 2)
      expect(sat.lat_deg).toBeGreaterThanOrEqual(-90)
      expect(sat.lat_deg).toBeLessThanOrEqual(90)
      expect(sat.lon_deg).toBeGreaterThanOrEqual(-180)
      expect(sat.lon_deg).toBeLessThanOrEqual(180)
    }
  })

  it('respects launch batch against launch stage', () => {
    const snap = calculateSnapshot(baseScenario, 0)
    const s1 = snap.satellites.find((s) => s.id === 'S1')!
    const s2 = snap.satellites.find((s) => s.id === 'S2')!
    const s3 = snap.satellites.find((s) => s.id === 'S3_UNLAUNCHED')!

    expect(s1.active).toBe(true)
    expect(s2.active).toBe(true)
    expect(s3.active).toBe(false)
  })

  it('marks satellite as failed and inactive during outage window', () => {
    const snapBefore = calculateSnapshot(baseScenario, 0)
    expect(snapBefore.satellites.find((s) => s.id === 'S2')!.active).toBe(true)
    expect(snapBefore.satellites.find((s) => s.id === 'S2')!.failed).toBe(false)

    const snapDuring = calculateSnapshot(baseScenario, 120)
    expect(snapDuring.satellites.find((s) => s.id === 'S2')!.active).toBe(false)
    expect(snapDuring.satellites.find((s) => s.id === 'S2')!.failed).toBe(true)

    const snapAfter = calculateSnapshot(baseScenario, 200)
    expect(snapAfter.satellites.find((s) => s.id === 'S2')!.active).toBe(true)
    expect(snapAfter.satellites.find((s) => s.id === 'S2')!.failed).toBe(false)
  })

  it('handles missing plane definition gracefully with fallback raan and phase 0', () => {
    const scenarioOrphanSat: Scenario = {
      ...baseScenario,
      design: {
        launch_stage: 1,
        planes: [],
        satellites: [{ id: 'S_ORPHAN', plane_id: 'NON_EXISTENT', slot_deg: 0, launch_batch: 1 }],
      },
    }
    const snap = calculateSnapshot(scenarioOrphanSat, 0)
    expect(snap.satellites).toHaveLength(1)
    expect(snap.satellites[0].active).toBe(true)
  })

  it('applies GMST rotation angle correctly over time', () => {
    const snapT0 = calculateSnapshot(baseScenario, 0)
    const snapT1000 = calculateSnapshot(baseScenario, 1000)
    const s1T0 = snapT0.satellites.find((s) => s.id === 'S1')!
    const s1T1000 = snapT1000.satellites.find((s) => s.id === 'S1')!

    expect(s1T0.x_km).not.toBeCloseTo(s1T1000.x_km, 1)
  })
})

describe('ISL Distance and Visibility Constraints', () => {
  it('connects satellites within isl_range_km with clear line of sight', () => {
    const scenario: Scenario = {
      schema_version: 'cosmo-A-1.0',
      meta: { id: 'isl_test', title: 'ISL Test' },
      environment: {
        altitude_km: 550,
        inclination_deg: 0,
        earth_angle0_deg: 0,
        horizon_s: 120,
        step_s: 120,
        min_elevation_deg: 10,
        isl_range_km: 3000,
        target_availability: 0.9,
      },
      design: {
        launch_stage: 1,
        planes: [{ id: 'P1', raan_deg: 0, phase_deg: 0 }],
        satellites: [
          { id: 'S01', plane_id: 'P1', slot_deg: 0, launch_batch: 1 },
          { id: 'S02', plane_id: 'P1', slot_deg: 10, launch_batch: 1 },
        ],
      },
      ground_sites: [],
      failures: [],
      gateway_outages: [],
    }

    const snap = calculateSnapshot(scenario, 0)
    expect(snap.edges).toHaveLength(1)
    expect(snap.edges[0][0]).toBe('S01')
    expect(snap.edges[0][1]).toBe('S02')
    expect(snap.edges[0][2]).toBeLessThan(3000)
  })

  it('does not connect satellites beyond isl_range_km', () => {
    const scenario: Scenario = {
      schema_version: 'cosmo-A-1.0',
      meta: { id: 'isl_range', title: 'ISL Range Limit' },
      environment: {
        altitude_km: 550,
        inclination_deg: 0,
        earth_angle0_deg: 0,
        horizon_s: 120,
        step_s: 120,
        min_elevation_deg: 10,
        isl_range_km: 500,
        target_availability: 0.9,
      },
      design: {
        launch_stage: 1,
        planes: [{ id: 'P1', raan_deg: 0, phase_deg: 0 }],
        satellites: [
          { id: 'S01', plane_id: 'P1', slot_deg: 0, launch_batch: 1 },
          { id: 'S02', plane_id: 'P1', slot_deg: 30, launch_batch: 1 },
        ],
      },
      ground_sites: [],
      failures: [],
      gateway_outages: [],
    }

    const snap = calculateSnapshot(scenario, 0)
    expect(snap.edges).toHaveLength(0)
  })

  it('blocks ISL connection when ray is obstructed by Earth sphere', () => {
    const scenario: Scenario = {
      schema_version: 'cosmo-A-1.0',
      meta: { id: 'isl_occlusion', title: 'ISL Occlusion' },
      environment: {
        altitude_km: 550,
        inclination_deg: 0,
        earth_angle0_deg: 0,
        horizon_s: 120,
        step_s: 120,
        min_elevation_deg: 10,
        isl_range_km: 25000,
        target_availability: 0.9,
      },
      design: {
        launch_stage: 1,
        planes: [{ id: 'P1', raan_deg: 0, phase_deg: 0 }],
        satellites: [
          { id: 'S01', plane_id: 'P1', slot_deg: 0, launch_batch: 1 },
          { id: 'S02', plane_id: 'P1', slot_deg: 180, launch_batch: 1 },
        ],
      },
      ground_sites: [],
      failures: [],
      gateway_outages: [],
    }

    const snap = calculateSnapshot(scenario, 0)
    expect(snap.edges).toHaveLength(0)
  })

  it('does not create ISL edges for inactive or failed satellites', () => {
    const scenario: Scenario = {
      schema_version: 'cosmo-A-1.0',
      meta: { id: 'isl_fail', title: 'ISL Inactive' },
      environment: {
        altitude_km: 550,
        inclination_deg: 0,
        earth_angle0_deg: 0,
        horizon_s: 120,
        step_s: 120,
        min_elevation_deg: 10,
        isl_range_km: 3000,
        target_availability: 0.9,
      },
      design: {
        launch_stage: 1,
        planes: [{ id: 'P1', raan_deg: 0, phase_deg: 0 }],
        satellites: [
          { id: 'S01', plane_id: 'P1', slot_deg: 0, launch_batch: 1 },
          { id: 'S02', plane_id: 'P1', slot_deg: 10, launch_batch: 1 },
        ],
      },
      ground_sites: [],
      failures: [{ satellite_id: 'S01', start_s: 0, end_s: 100 }],
      gateway_outages: [],
    }

    const snap = calculateSnapshot(scenario, 0)
    expect(snap.edges).toHaveLength(0)
  })
})

describe('Elevation and Ground-to-Satellite Links', () => {
  it('connects ground station when satellite elevation >= min_elevation_deg', () => {
    const scenario: Scenario = {
      schema_version: 'cosmo-A-1.0',
      meta: { id: 'el_test', title: 'Elevation Test' },
      environment: {
        altitude_km: 550,
        inclination_deg: 0,
        earth_angle0_deg: 0,
        horizon_s: 120,
        step_s: 120,
        min_elevation_deg: 10,
        isl_range_km: 3000,
        target_availability: 0.9,
      },
      design: {
        launch_stage: 1,
        planes: [{ id: 'P1', raan_deg: 0, phase_deg: 0 }],
        satellites: [{ id: 'S01', plane_id: 'P1', slot_deg: 0, launch_batch: 1 }],
      },
      ground_sites: [{ id: 'C1', name: 'Client 1', role: 'client', lat_deg: 0, lon_deg: 0 }],
      failures: [],
      gateway_outages: [],
    }

    const snap = calculateSnapshot(scenario, 0)
    expect(snap.elevations['C1']['S01']).toBeCloseTo(90, 1)
    expect(snap.edges).toHaveLength(1)
    expect(snap.edges[0]).toEqual(['C1', 'S01', 550])
  })

  it('does not create ground link when satellite elevation < min_elevation_deg', () => {
    const scenario: Scenario = {
      schema_version: 'cosmo-A-1.0',
      meta: { id: 'el_low', title: 'Low Elevation' },
      environment: {
        altitude_km: 550,
        inclination_deg: 0,
        earth_angle0_deg: 0,
        horizon_s: 120,
        step_s: 120,
        min_elevation_deg: 20,
        isl_range_km: 3000,
        target_availability: 0.9,
      },
      design: {
        launch_stage: 1,
        planes: [{ id: 'P1', raan_deg: 0, phase_deg: 0 }],
        satellites: [{ id: 'S01', plane_id: 'P1', slot_deg: 90, launch_batch: 1 }],
      },
      ground_sites: [{ id: 'C1', name: 'Client 1', role: 'client', lat_deg: 0, lon_deg: 0 }],
      failures: [],
      gateway_outages: [],
    }

    const snap = calculateSnapshot(scenario, 0)
    expect(snap.elevations['C1']['S01']).toBeLessThan(0)
    expect(snap.edges).toHaveLength(0)
  })

  it('omits ground link when gateway is in active outage', () => {
    const scenario: Scenario = {
      schema_version: 'cosmo-A-1.0',
      meta: { id: 'gw_outage_link', title: 'Gateway Outage Link' },
      environment: {
        altitude_km: 550,
        inclination_deg: 0,
        earth_angle0_deg: 0,
        horizon_s: 120,
        step_s: 120,
        min_elevation_deg: 10,
        isl_range_km: 3000,
        target_availability: 0.9,
      },
      design: {
        launch_stage: 1,
        planes: [{ id: 'P1', raan_deg: 0, phase_deg: 0 }],
        satellites: [{ id: 'S01', plane_id: 'P1', slot_deg: 0, launch_batch: 1 }],
      },
      ground_sites: [{ id: 'GW1', name: 'Gateway 1', role: 'gateway', lat_deg: 0, lon_deg: 0 }],
      failures: [],
      gateway_outages: [{ gateway_id: 'GW1', start_s: 0, end_s: 600 }],
    }

    const snap = calculateSnapshot(scenario, 0)
    expect(snap.elevations['GW1']['S01']).toBeCloseTo(90, 1)
    expect(snap.edges).toHaveLength(0)
  })
})

describe('Dijkstra Shortest Path Routing (findRouteDijkstra)', () => {
  it('returns empty path if onlineGateways is empty or clientId not in adj', () => {
    const adj = new Map<string, Array<[string, number]>>()
    adj.set('C1', [['S1', 100]])
    expect(findRouteDijkstra(adj, 'C1', new Set(), new Set(['C1']))).toEqual({
      path: [],
      distance: 0,
    })
    expect(
      findRouteDijkstra(adj, 'C2', new Set(['GW1']), new Set(['C1', 'C2']))
    ).toEqual({ path: [], distance: 0 })
  })

  it('prevents direct single-hop client to gateway connection without satellite', () => {
    const adj = new Map<string, Array<[string, number]>>()
    adj.set('C1', [['GW1', 50]])
    adj.set('GW1', [['C1', 50]])

    const res = findRouteDijkstra(adj, 'C1', new Set(['GW1']), new Set(['C1']))
    expect(res.path).toEqual([])
  })

  it('prevents intermediate hops traversing through another client site', () => {
    const adj = new Map<string, Array<[string, number]>>()
    adj.set('C1', [['S1', 500]])
    adj.set('S1', [
      ['C1', 500],
      ['C2', 500],
    ])
    adj.set('C2', [
      ['S1', 500],
      ['S2', 500],
    ])
    adj.set('S2', [
      ['C2', 500],
      ['GW1', 500],
    ])
    adj.set('GW1', [['S2', 500]])

    const res = findRouteDijkstra(
      adj,
      'C1',
      new Set(['GW1']),
      new Set(['C1', 'C2'])
    )
    expect(res.path).toEqual([])
  })

  it('finds valid 2-hop route: Client -> Sat -> Gateway', () => {
    const adj = new Map<string, Array<[string, number]>>()
    adj.set('C1', [['S1', 600]])
    adj.set('S1', [
      ['C1', 600],
      ['GW1', 700],
    ])
    adj.set('GW1', [['S1', 700]])

    const res = findRouteDijkstra(adj, 'C1', new Set(['GW1']), new Set(['C1']))
    expect(res.path).toEqual(['C1', 'S1', 'GW1'])
    expect(res.distance).toBe(1300)
  })

  it('prioritizes minimum hops when metric is "hops", and breaks ties by distance', () => {
    const adj = new Map<string, Array<[string, number]>>()
    adj.set('C1', [
      ['S1', 500],
      ['S3', 100],
    ])
    adj.set('S1', [
      ['C1', 500],
      ['S2', 500],
    ])
    adj.set('S2', [
      ['S1', 500],
      ['GW1', 500],
    ])
    adj.set('S3', [
      ['C1', 100],
      ['S4', 100],
    ])
    adj.set('S4', [
      ['S3', 100],
      ['S5', 100],
    ])
    adj.set('S5', [
      ['S4', 100],
      ['GW1', 100],
    ])
    adj.set('GW1', [
      ['S2', 500],
      ['S5', 100],
    ])

    const resHops = findRouteDijkstra(
      adj,
      'C1',
      new Set(['GW1']),
      new Set(['C1']),
      'hops'
    )
    expect(resHops.path).toEqual(['C1', 'S1', 'S2', 'GW1'])
    expect(resHops.distance).toBe(1500)

    const resDist = findRouteDijkstra(
      adj,
      'C1',
      new Set(['GW1']),
      new Set(['C1']),
      'distance'
    )
    expect(resDist.path).toEqual(['C1', 'S3', 'S4', 'S5', 'GW1'])
    expect(resDist.distance).toBe(400)
  })

  it('handles multi-gateway network and routes to optimal gateway', () => {
    const adj = new Map<string, Array<[string, number]>>()
    adj.set('C1', [
      ['S1', 600],
      ['S2', 600],
    ])
    adj.set('S1', [
      ['C1', 600],
      ['GW1', 800],
    ])
    adj.set('S2', [
      ['C1', 600],
      ['GW2', 650],
    ])
    adj.set('GW1', [['S1', 800]])
    adj.set('GW2', [['S2', 650]])

    const res = findRouteDijkstra(
      adj,
      'C1',
      new Set(['GW1', 'GW2']),
      new Set(['C1']),
      'hops'
    )
    expect(res.path).toEqual(['C1', 'S2', 'GW2'])
    expect(res.distance).toBe(1250)
  })

  it('prunes queue items when cheaper path already discovered', () => {
    const adj = new Map<string, Array<[string, number]>>()
    // C1 connects to A with dist 1000, to B with dist 10, to E with dist 2000
    // B connects to A with dist 10 (so A reaches cost 20)
    // A connects to D with dist 5000
    // E connects to GW1 with dist 2000
    // Queue pops: B (10) -> A (20) -> A (1000) [hits continue!] -> E (2000) -> GW1 (4000)
    adj.set('C1', [
      ['A', 1000],
      ['B', 10],
      ['E', 2000],
    ])
    adj.set('B', [
      ['C1', 10],
      ['A', 10],
    ])
    adj.set('A', [
      ['C1', 1000],
      ['B', 10],
      ['D', 5000],
    ])
    adj.set('D', [['A', 5000]])
    adj.set('E', [
      ['C1', 2000],
      ['GW1', 2000],
    ])
    adj.set('GW1', [['E', 2000]])

    const res = findRouteDijkstra(
      adj,
      'C1',
      new Set(['GW1']),
      new Set(['C1']),
      'distance'
    )
    expect(res.path).toEqual(['C1', 'E', 'GW1'])
    expect(res.distance).toBe(4000)
  })

  it('returns empty path when graph is fully explored without reaching gateway', () => {
    const adj = new Map<string, Array<[string, number]>>()
    adj.set('C1', [['S1', 100]])
    adj.set('S1', [['C1', 100]])
    adj.set('GW1', [])

    const res = findRouteDijkstra(
      adj,
      'C1',
      new Set(['GW1']),
      new Set(['C1']),
      'hops'
    )
    expect(res).toEqual({ path: [], distance: 0 })
  })
})

describe('Failure Diagnosis Precedence (All 4 Error Codes)', () => {
  const diagnosisBase: Scenario = {
    schema_version: 'cosmo-A-1.0',
    meta: { id: 'diag', title: 'Diagnosis Test' },
    environment: {
      altitude_km: 550,
      inclination_deg: 0,
      earth_angle0_deg: 0,
      horizon_s: 120,
      step_s: 120,
      min_elevation_deg: 10,
      isl_range_km: 3000,
      target_availability: 0.9,
    },
    design: {
      launch_stage: 1,
      planes: [{ id: 'P1', raan_deg: 0, phase_deg: 0 }],
      satellites: [
        { id: 'S_OVER_CLIENT', plane_id: 'P1', slot_deg: 0, launch_batch: 1 },
        { id: 'S_OVER_GW', plane_id: 'P1', slot_deg: 90, launch_batch: 1 },
      ],
    },
    ground_sites: [
      { id: 'CL1', name: 'Client 1', role: 'client', lat_deg: 0, lon_deg: 0 },
      { id: 'GW1', name: 'Gateway 1', role: 'gateway', lat_deg: 0, lon_deg: 90 },
    ],
    failures: [],
    gateway_outages: [],
  }

  it('Tier 1: diagnoses no_client_satellite when client has no visible satellites', () => {
    const scenario: Scenario = {
      ...diagnosisBase,
      failures: [{ satellite_id: 'S_OVER_CLIENT', start_s: 0, end_s: 120 }],
      gateway_outages: [{ gateway_id: 'GW1', start_s: 0, end_s: 120 }],
    }

    const snap = calculateSnapshot(scenario, 0)
    expect(snap.routes['CL1']).toEqual([])
    expect(snap.outageReasons['CL1']).toBe('Нет спутников над CL1 (уг. места < 10°)')
  })

  it('Tier 2: diagnoses gateway_offline when client sees satellite but all gateways are offline', () => {
    const scenario: Scenario = {
      ...diagnosisBase,
      gateway_outages: [{ gateway_id: 'GW1', start_s: 0, end_s: 120 }],
    }

    const snap = calculateSnapshot(scenario, 0)
    expect(snap.routes['CL1']).toEqual([])
    expect(snap.outageReasons['CL1']).toBe('Шлюз отключен (Gateway outage)')
  })

  it('Tier 3: diagnoses no_gateway_satellite when gateway is online but has no visible satellites', () => {
    const scenario: Scenario = {
      ...diagnosisBase,
      failures: [{ satellite_id: 'S_OVER_GW', start_s: 0, end_s: 120 }],
    }

    const snap = calculateSnapshot(scenario, 0)
    expect(snap.routes['CL1']).toEqual([])
    expect(snap.outageReasons['CL1']).toBe('Нет спутников над шлюзом (уг. места < 10°)')
  })

  it('Tier 4: diagnoses isl_disconnected when both client and gateway see satellites but ISL mesh is severed', () => {
    const scenario: Scenario = {
      ...diagnosisBase,
      environment: {
        ...diagnosisBase.environment,
        isl_range_km: 3000,
      },
    }

    const snap = calculateSnapshot(scenario, 0)
    expect(snap.routes['CL1']).toEqual([])
    expect(snap.outageReasons['CL1']).toBe('Разрыв ISL связности в созвездии')
  })
})

describe('calculateFullTimeline and Client Metrics Computation', () => {
  it('handles null or malformed scenario gracefully', () => {
    // @ts-expect-error test invalid scenario
    expect(calculateFullTimeline(null)).toEqual({ timelines: {} })
    // @ts-expect-error test invalid scenario
    expect(calculateFullTimeline(undefined)).toEqual({ timelines: {} })
    // @ts-expect-error test invalid snapshot
    expect(calculateSnapshot(null, 0)).toEqual({
      t_s: 0,
      satellites: [],
      edges: [],
      elevations: {},
      routes: {},
      outageReasons: {},
    })
  })

  it('handles sparse scenario with omitted environment, design, and site arrays', () => {
    const sparseScenario = {
      schema_version: 'cosmo-A-1.0',
      meta: { id: 'sparse', title: 'Sparse' },
    } as unknown as Scenario
    const snap = calculateSnapshot(sparseScenario, 0)
    expect(snap.satellites).toEqual([])
    expect(snap.edges).toEqual([])

    const tl = calculateFullTimeline(sparseScenario)
    expect(tl.timelines).toEqual({})
  })

  it('computes correct timeline slots, visibility, availability, and max_gap_s', () => {
    const scenario: Scenario = {
      schema_version: 'cosmo-A-1.0',
      meta: { id: 'timeline_test', title: 'Timeline Test' },
      environment: {
        altitude_km: 550,
        inclination_deg: 0,
        earth_angle0_deg: 0,
        horizon_s: 360,
        step_s: 120,
        min_elevation_deg: -90,
        isl_range_km: 15000,
        target_availability: 0.6,
      },
      design: {
        launch_stage: 1,
        planes: [{ id: 'P1', raan_deg: 0, phase_deg: 0 }],
        satellites: [{ id: 'S01', plane_id: 'P1', slot_deg: 0, launch_batch: 1 }],
      },
      ground_sites: [
        { id: 'C1', name: 'Client 1', role: 'client', lat_deg: 0, lon_deg: 0 },
        { id: 'GW1', name: 'Gateway 1', role: 'gateway', lat_deg: 0, lon_deg: 0 },
      ],
      failures: [{ satellite_id: 'S01', start_s: 120, end_s: 240 }],
      gateway_outages: [],
    }

    const { timelines } = calculateFullTimeline(scenario)
    expect(timelines['C1']).toBeDefined()
    const tl = timelines['C1']

    expect(tl.slots).toHaveLength(3)
    expect(tl.slots[0].hasPath).toBe(true)
    expect(tl.slots[0].hops).toBe(2)
    expect(tl.slots[1].hasPath).toBe(false)
    expect(tl.slots[1].reason).toBeDefined()
    expect(tl.slots[2].hasPath).toBe(true)

    expect(tl.metrics.total_slots).toBe(3)
    expect(tl.metrics.available_slots).toBe(2)
    expect(tl.metrics.availability_ratio).toBeCloseTo(2 / 3, 4)
    expect(tl.metrics.visibility_ratio).toBeCloseTo(2 / 3, 4)
    expect(tl.metrics.max_gap_s).toBe(120)
    expect(tl.metrics.avg_hops).toBe(2)
  })

  it('tracks trailing gaps at the end of the timeline in max_gap_s', () => {
    const scenario: Scenario = {
      schema_version: 'cosmo-A-1.0',
      meta: { id: 'gap_test', title: 'Gap Test' },
      environment: {
        altitude_km: 550,
        inclination_deg: 0,
        earth_angle0_deg: 0,
        horizon_s: 360,
        step_s: 120,
        min_elevation_deg: -90,
        isl_range_km: 15000,
        target_availability: 0.9,
      },
      design: {
        launch_stage: 1,
        planes: [{ id: 'P1', raan_deg: 0, phase_deg: 0 }],
        satellites: [{ id: 'S01', plane_id: 'P1', slot_deg: 0, launch_batch: 1 }],
      },
      ground_sites: [
        { id: 'C1', name: 'Client 1', role: 'client', lat_deg: 0, lon_deg: 0 },
        { id: 'GW1', name: 'Gateway 1', role: 'gateway', lat_deg: 0, lon_deg: 0 },
      ],
      failures: [{ satellite_id: 'S01', start_s: 100, end_s: 400 }],
      gateway_outages: [],
    }

    const { timelines } = calculateFullTimeline(scenario)
    expect(timelines['C1'].metrics.max_gap_s).toBe(240)
    expect(timelines['C1'].metrics.available_slots).toBe(1)
  })

  it('handles zero availability scenario without division by zero errors', () => {
    const scenario: Scenario = {
      schema_version: 'cosmo-A-1.0',
      meta: { id: 'zero_avail', title: 'Zero Availability' },
      environment: {
        altitude_km: 550,
        inclination_deg: 0,
        earth_angle0_deg: 0,
        horizon_s: 240,
        step_s: 120,
        min_elevation_deg: 89,
        isl_range_km: 3000,
        target_availability: 0.9,
      },
      design: {
        launch_stage: 1,
        planes: [],
        satellites: [],
      },
      ground_sites: [{ id: 'C1', name: 'Client 1', role: 'client', lat_deg: 0, lon_deg: 0 }],
      failures: [],
      gateway_outages: [],
    }

    const { timelines } = calculateFullTimeline(scenario)
    expect(timelines['C1'].metrics.available_slots).toBe(0)
    expect(timelines['C1'].metrics.availability_ratio).toBe(0)
    expect(timelines['C1'].metrics.avg_hops).toBe(0)
  })
})

describe('exportResultFile and exportResults', () => {
  it('generates compliant cosmo-A-result-1.0 export structure', () => {
    const scenario: Scenario = {
      schema_version: 'cosmo-A-1.0',
      meta: { id: 'export_scenario', title: 'Export Test' },
      environment: {
        altitude_km: 550,
        inclination_deg: 0,
        earth_angle0_deg: 0,
        horizon_s: 240,
        step_s: 120,
        min_elevation_deg: -90,
        isl_range_km: 15000,
        target_availability: 0.9,
      },
      design: {
        launch_stage: 1,
        planes: [{ id: 'P1', raan_deg: 0, phase_deg: 0 }],
        satellites: [{ id: 'S01', plane_id: 'P1', slot_deg: 0, launch_batch: 1 }],
      },
      ground_sites: [
        { id: 'C1', name: 'Client 1', role: 'client', lat_deg: 0, lon_deg: 0 },
        { id: 'C2', name: 'Client 2', role: 'client', lat_deg: 10, lon_deg: 10 },
        { id: 'GW1', name: 'Gateway 1', role: 'gateway', lat_deg: 0, lon_deg: 0 },
      ],
      failures: [],
      gateway_outages: [],
    }

    const { timelines } = calculateFullTimeline(scenario)
    const exportData = exportResultFile(scenario, timelines)

    expect(exportData.schema_version).toBe('cosmo-A-result-1.0')
    expect(exportData.meta!.generator).toContain('CosmoConstellation Studio')
    expect(exportData.meta!.calculated_at).toBeDefined()
    expect(exportData.effective_scenario).toEqual(scenario)

    expect(exportData.routes).toHaveLength(4)
    expect(exportData.routes[0]).toHaveProperty('t_s')
    expect(exportData.routes[0]).toHaveProperty('client_id')
    expect(exportData.routes[0]).toHaveProperty('path')

    expect(exportData.metrics!['C1']).toBeDefined()
    expect(exportData.metrics!['C2']).toBeDefined()
    expect(exportData.summary!.mean_availability).toBe(1)
    expect(exportData.summary!.mean_hops).toBe(2)
    expect(exportData.summary!.all_clients_meet_sla).toBe(true)

    expect(exportResults).toBe(exportResultFile)
  })

  it('correctly sets all_clients_meet_sla to false when any client fails target availability', () => {
    const scenario: Scenario = {
      schema_version: 'cosmo-A-1.0',
      meta: { id: 'sla_fail', title: 'SLA Fail Test' },
      environment: {
        altitude_km: 550,
        inclination_deg: 0,
        earth_angle0_deg: 0,
        horizon_s: 240,
        step_s: 120,
        min_elevation_deg: -90,
        isl_range_km: 15000,
        target_availability: 0.95,
      },
      design: {
        launch_stage: 1,
        planes: [{ id: 'P1', raan_deg: 0, phase_deg: 0 }],
        satellites: [{ id: 'S01', plane_id: 'P1', slot_deg: 0, launch_batch: 1 }],
      },
      ground_sites: [
        { id: 'C1', name: 'Client 1', role: 'client', lat_deg: 0, lon_deg: 0 },
        { id: 'GW1', name: 'Gateway 1', role: 'gateway', lat_deg: 0, lon_deg: 0 },
      ],
      failures: [{ satellite_id: 'S01', start_s: 120, end_s: 240 }],
      gateway_outages: [],
    }

    const { timelines } = calculateFullTimeline(scenario)
    const exportData = exportResults(scenario, timelines)

    expect(exportData.summary!.mean_availability).toBe(0.5)
    expect(exportData.summary!.all_clients_meet_sla).toBe(false)
  })

  it('handles scenario with no client sites safely in exportResults', () => {
    const scenario: Scenario = {
      schema_version: 'cosmo-A-1.0',
      meta: { id: 'no_clients', title: 'No Clients' },
      environment: {
        altitude_km: 550,
        inclination_deg: 0,
        earth_angle0_deg: 0,
        horizon_s: 240,
        step_s: 120,
        min_elevation_deg: 10,
        isl_range_km: 3000,
        target_availability: 0.9,
      },
      design: { launch_stage: 1, planes: [], satellites: [] },
      ground_sites: [{ id: 'GW1', name: 'Gateway 1', role: 'gateway', lat_deg: 0, lon_deg: 0 }],
      failures: [],
      gateway_outages: [],
    }

    const { timelines } = calculateFullTimeline(scenario)
    const exportData = exportResults(scenario, timelines)

    expect(exportData.routes).toHaveLength(0)
    expect(exportData.summary!.mean_availability).toBe(0)
    expect(exportData.summary!.mean_hops).toBe(0)
    expect(exportData.summary!.all_clients_meet_sla).toBe(false)
  })

  it('uses default 0.9 target availability when scenario.environment.target_availability is undefined', () => {
    const scenario: Scenario = {
      schema_version: 'cosmo-A-1.0',
      meta: { id: 'default_target', title: 'Default Target' },
      environment: {
        altitude_km: 550,
        inclination_deg: 0,
        earth_angle0_deg: 0,
        horizon_s: 240,
        step_s: 120,
        min_elevation_deg: -90,
        isl_range_km: 15000,
        // target_availability left undefined
      },
      design: {
        launch_stage: 1,
        planes: [{ id: 'P1', raan_deg: 0, phase_deg: 0 }],
        satellites: [{ id: 'S01', plane_id: 'P1', slot_deg: 0, launch_batch: 1 }],
      },
      ground_sites: [
        { id: 'C1', name: 'Client 1', role: 'client', lat_deg: 0, lon_deg: 0 },
        { id: 'GW1', name: 'Gateway 1', role: 'gateway', lat_deg: 0, lon_deg: 0 },
      ],
      failures: [],
      gateway_outages: [],
    }

    const { timelines } = calculateFullTimeline(scenario)
    const exportData = exportResults(scenario, timelines)
    // Availability is 1.0, default target is 0.9, so meets SLA
    expect(exportData.summary!.all_clients_meet_sla).toBe(true)
  })
})

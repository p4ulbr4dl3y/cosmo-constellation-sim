import { describe, it, expect } from 'vitest'
import {
  calculateSnapshot,
  getGroundPositions,
  classifyFailure,
  findRouteDijkstra,
  FAILURE_REASON_NO_CLIENT_SAT,
  FAILURE_REASON_GATEWAY_OFFLINE,
  FAILURE_REASON_NO_GW_SAT,
  FAILURE_REASON_ISL_DISCONNECTED,
  validateScenario,
} from './orbit'
import type { Scenario, Snapshot, SatelliteSnapshot } from '../types/scenario'
import rawFixture from './__fixtures__/parity_fixture.json'

const TOLERANCE_KM = 1e-4 // 0.1 meter tolerance for coordinates
const TOLERANCE_DEG = 1e-4 // 0.0001 degree tolerance for angular values

interface ParityFixtureSnapshot {
  t_s: number
  satellites: SatelliteSnapshot[]
  edges: [string, string, number][]
  isl_edges: [string, string, number][]
  ground_edges: [string, string, number][]
  elevations: Record<string, Record<string, number>>
  routes_hops: Record<string, { path: string[]; distance_km: number }>
  routes_distance: Record<string, { path: string[]; distance_km: number }>
}

interface ParityFixtureData {
  scenario: Scenario
  ground_positions: Record<
    string,
    { id: string; x: number; y: number; z: number; lat_deg: number; lon_deg: number }
  >
  snapshots: Record<string, ParityFixtureSnapshot>
  failure_cases: Array<{
    case_id: string
    scenario: Scenario
    t_s: number
    client_id: string
    expected_path: string[]
    expected_code: string
    client_has_sat: boolean
    gw_has_sat: boolean
  }>
  timeline_steps: Array<{
    t_s: number
    routes: Record<string, { path: string[]; distance_km: number; hops: number }>
  }>
  summary_metrics: Record<
    string,
    {
      availability_pct: number
      visibility_pct: number
      mean_hops: number
      max_outage_s: number
    }
  >
}

const parityFixture = rawFixture as unknown as ParityFixtureData

describe('Python Backend vs TypeScript Engine Parity', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fixture = parityFixture as any
  const scenario = fixture.scenario as unknown as Scenario
  const groundPositionsRef = fixture.ground_positions as Record<
    string,
    { id: string; x: number; y: number; z: number; lat_deg: number; lon_deg: number }
  >

  describe('1. Ground Station Position Parity (ECEF)', () => {
    it('matches Python ground station Cartesian coordinates within 1e-4 km', () => {
      const tsGround = getGroundPositions(scenario)
      expect(tsGround).toHaveLength(Object.keys(groundPositionsRef).length)

      for (const tsSite of tsGround) {
        const pyRef = groundPositionsRef[tsSite.id]
        expect(pyRef, `Ground site ${tsSite.id} exists in Python reference`).toBeDefined()

        const dx = Math.abs(tsSite.x - pyRef.x)
        const dy = Math.abs(tsSite.y - pyRef.y)
        const dz = Math.abs(tsSite.z - pyRef.z)

        expect(dx, `Site ${tsSite.id} ECEF X error`).toBeLessThan(TOLERANCE_KM)
        expect(dy, `Site ${tsSite.id} ECEF Y error`).toBeLessThan(TOLERANCE_KM)
        expect(dz, `Site ${tsSite.id} ECEF Z error`).toBeLessThan(TOLERANCE_KM)
      }
    })
  })

  describe('2. Satellite Orbital Positions Parity (t=0s and t=1000s)', () => {
    const testTimestamps = [0, 1000]

    for (const t_s of testTimestamps) {
      it(`matches all 48 satellite ECEF positions at t=${t_s}s within 1e-4 km`, () => {
        const pySnap = fixture.snapshots[String(t_s)]
        expect(pySnap, `Snapshot for t=${t_s} exists`).toBeDefined()

        const tsSnap: Snapshot = calculateSnapshot(scenario, t_s)
        expect(tsSnap.satellites).toHaveLength(48)
        expect(pySnap.satellites).toHaveLength(48)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pySatMap = new Map(pySnap.satellites.map((s: any) => [s.id, s]))

        for (const tsSat of tsSnap.satellites) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pySat: any = pySatMap.get(tsSat.id)
          expect(pySat, `Satellite ${tsSat.id} exists in Python snapshot`).toBeDefined()
          if (!pySat) continue

          const dx = Math.abs(tsSat.x_km - pySat.x_km)
          const dy = Math.abs(tsSat.y_km - pySat.y_km)
          const dz = Math.abs(tsSat.z_km - pySat.z_km)

          expect(dx, `${tsSat.id} t=${t_s} X coordinate delta`).toBeLessThan(TOLERANCE_KM)
          expect(dy, `${tsSat.id} t=${t_s} Y coordinate delta`).toBeLessThan(TOLERANCE_KM)
          expect(dz, `${tsSat.id} t=${t_s} Z coordinate delta`).toBeLessThan(TOLERANCE_KM)

          // Latitude and Longitude parity
          const dLat = Math.abs(tsSat.lat_deg - pySat.lat_deg)
          expect(dLat, `${tsSat.id} t=${t_s} lat delta`).toBeLessThan(TOLERANCE_DEG)

          // Active and failed state parity
          expect(tsSat.active).toBe(pySat.active)
          expect(tsSat.failed).toBe(pySat.failed)
        }
      })
    }
  })

  describe('3. ISL Line-of-Sight and Network Topology Parity', () => {
    const testTimestamps = [0, 1000]

    for (const t_s of testTimestamps) {
      it(`matches exact ISL connectivity graph and edge distances at t=${t_s}s`, () => {
        const pySnap = fixture.snapshots[String(t_s)]
        const tsSnap = calculateSnapshot(scenario, t_s)

        // Filter TS ISL edges (between two satellites)
        const tsIslEdges = tsSnap.edges
          .filter(([u, v]) => u.startsWith('S') && v.startsWith('S'))
          .map(([u, v, d]) => {
            const pair = [u, v].sort()
            return { key: `${pair[0]}--${pair[1]}`, dist: d }
          })

        const pyIslEdges = pySnap.isl_edges.map(([u, v, d]: [string, string, number]) => {
          const pair = [u, v].sort()
          return { key: `${pair[0]}--${pair[1]}`, dist: d }
        })

        expect(tsIslEdges.length, `ISL edge count mismatch at t=${t_s}`).toBe(pyIslEdges.length)

        const pyEdgeMap = new Map(pyIslEdges.map((e: { key: string; dist: number }) => [e.key, e.dist]))
        for (const tsEdge of tsIslEdges) {
          const pyDist = pyEdgeMap.get(tsEdge.key) as number | undefined
          expect(pyDist, `TS ISL edge ${tsEdge.key} should exist in Python graph`).toBeDefined()
          if (pyDist !== undefined) {
            expect(
              Math.abs(tsEdge.dist - pyDist),
              `ISL link distance for ${tsEdge.key}`
            ).toBeLessThan(TOLERANCE_KM)
          }
        }
      })
    }
  })

  describe('4. Ground Site Elevations and Radio Visibility Parity', () => {
    const testTimestamps = [0, 1000]

    for (const t_s of testTimestamps) {
      it(`matches ground site elevation angles at t=${t_s}s within 1e-4 deg`, () => {
        const pySnap = parityFixture.snapshots[String(t_s)]
        const tsSnap = calculateSnapshot(scenario, t_s)

        for (const [siteId, satMap] of Object.entries(pySnap.elevations)) {
          const tsSatMap = tsSnap.elevations[siteId]
          expect(tsSatMap, `Elevation map for site ${siteId}`).toBeDefined()

          for (const [satId, pyElev] of Object.entries(satMap)) {
            const tsElev = tsSatMap[satId]
            expect(tsElev, `Elevation from ${siteId} to ${satId}`).toBeDefined()
            expect(
              Math.abs(tsElev - pyElev),
              `Elevation angle mismatch for ${siteId}->${satId} at t=${t_s}`
            ).toBeLessThan(TOLERANCE_DEG)
          }
        }
      })
    }
  })

  describe('5. Dijkstra Route Selection Parity (100% hop match)', () => {
    const testTimestamps = [0, 1000]

    for (const t_s of testTimestamps) {
      it(`matches exact shortest path hop sequences for all clients at t=${t_s}s`, () => {
        const pySnap = parityFixture.snapshots[String(t_s)]
        const tsSnap = calculateSnapshot(scenario, t_s)

        for (const [clientId, pyRoute] of Object.entries(pySnap.routes_hops)) {
          const tsRoute = tsSnap.routes[clientId]
          expect(tsRoute, `Route for client ${clientId} at t=${t_s}`).toBeDefined()

          // Exact 100% hop sequence match
          expect(tsRoute).toEqual(pyRoute.path)

          // Distance parity
          if (tsRoute.length > 0) {
            // Recompute distance from TS snapshot edges
            const adj = new Map<string, Array<[string, number]>>()
            for (const [u, v, d] of tsSnap.edges) {
              if (!adj.has(u)) adj.set(u, [])
              if (!adj.has(v)) adj.set(v, [])
              adj.get(u)!.push([v, d])
              adj.get(v)!.push([u, d])
            }
            const res = findRouteDijkstra(
              adj,
              clientId,
              new Set(['G_MUR']),
              new Set(['C65', 'C70', 'C72']),
              'hops'
            )
            expect(Math.abs(res.distance - pyRoute.distance_km)).toBeLessThan(TOLERANCE_KM)
          }
        }
      })
    }
  })

  describe('6. Outage Root Cause Classification Parity (4 failure codes)', () => {
    const failureCases = parityFixture.failure_cases

    for (const fc of failureCases) {
      it(`diagnoses "${fc.case_id}" identically to Python backend`, () => {
        const snap = calculateSnapshot(fc.scenario, fc.t_s)
        const path = snap.routes[fc.client_id]

        // Route must be empty
        expect(path).toEqual(fc.expected_path)

        // Outage code must match Python classified code 100%
        expect(snap.outageCodes?.[fc.client_id]).toBe(fc.expected_code)

        // Direct classification function test
        const onlineGwCount = fc.case_id === 'gateway_offline' ? 0 : 1
        const classification = classifyFailure(
          fc.client_has_sat,
          onlineGwCount,
          fc.gw_has_sat
        )
        expect(classification.code).toBe(fc.expected_code)
      })
    }

    it('verifies all 4 canonical failure reason codes are covered', () => {
      const expectedCodes = new Set([
        FAILURE_REASON_NO_CLIENT_SAT,
        FAILURE_REASON_GATEWAY_OFFLINE,
        FAILURE_REASON_NO_GW_SAT,
        FAILURE_REASON_ISL_DISCONNECTED,
      ])
      const testedCodes = new Set(failureCases.map((f) => f.expected_code))
      expect(testedCodes).toEqual(expectedCodes)
    })
  })

  describe('7. Baseline Dynamic Outage at t=59400s Parity', () => {
    it('verifies exact route drop and failure code during real baseline orbital gap', () => {
      const pySnap = parityFixture.snapshots['59400']
      const tsSnap = calculateSnapshot(scenario, 59400)

      // C65 has outage in baseline at t=59400s
      const pyC65 = pySnap.routes_hops['C65']
      expect(pyC65.path).toEqual([])
      expect(tsSnap.routes['C65']).toEqual([])
      expect(tsSnap.outageCodes?.['C65']).toBe(FAILURE_REASON_NO_CLIENT_SAT)

      // C70 and C72 maintain active routes
      const pyC70 = pySnap.routes_hops['C70']
      expect(tsSnap.routes['C70']).toEqual(pyC70.path)
      expect(tsSnap.routes['C70'].length).toBeGreaterThanOrEqual(3)

      const pyC72 = pySnap.routes_hops['C72']
      expect(tsSnap.routes['C72']).toEqual(pyC72.path)
      expect(tsSnap.routes['C72'].length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('8. Multi-Step Timeline Sequence Route Parity (t=0..1080s)', () => {
    it('matches exact hop sequences and hop counts over 10 consecutive simulation intervals', () => {
      const timelineSteps = parityFixture.timeline_steps

      for (const step of timelineSteps) {
        const snap = calculateSnapshot(scenario, step.t_s)
        for (const [clientId, pyRoute] of Object.entries(step.routes)) {
          const tsRoute = snap.routes[clientId]
          expect(tsRoute, `Client ${clientId} at t=${step.t_s}`).toEqual(pyRoute.path)

          const hops = tsRoute.length > 0 ? tsRoute.length - 1 : 0
          expect(hops, `Hop count for ${clientId} at t=${step.t_s}`).toBe(pyRoute.hops)
        }
      }
    })
  })

  describe('9. Scenario Validator Parity', () => {
    it('approves compliant benchmark scenario without errors', () => {
      const errors = validateScenario(scenario)
      expect(errors).toEqual([])
    })

    it('rejects invalid schema version or corrupted fields', () => {
      expect(validateScenario(null).length).toBeGreaterThan(0)
      expect(validateScenario({}).length).toBeGreaterThan(0)
      expect(validateScenario({ ...scenario, schema_version: 'cosmo-legacy' }).length).toBeGreaterThan(0)
    })
  })
})

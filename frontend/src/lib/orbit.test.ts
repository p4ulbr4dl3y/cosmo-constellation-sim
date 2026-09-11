import { describe, it, expect } from 'vitest'
import {
  calculateSnapshot,
  calculateFullTimeline,
  getGroundPositions,
  R_EARTH,
} from './orbit'
import type { Scenario } from '../types/scenario'

const sampleScenario: Scenario = {
  schema_version: 'cosmo-A-1.0',
  meta: { id: 'test', title: 'Test Scenario' },
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
  design: {
    launch_stage: 1,
    planes: [
      { id: 'P1', raan_deg: 0, phase_deg: 0 },
    ],
    satellites: [
      { id: 'S01', plane_id: 'P1', slot_deg: 0, launch_batch: 1 },
      { id: 'S02', plane_id: 'P1', slot_deg: 22.5, launch_batch: 1 },
    ],
  },
  ground_sites: [
    { id: 'GW', name: 'Gateway', role: 'gateway', lat_deg: 68.97, lon_deg: 33.07 },
    { id: 'CL', name: 'Client', role: 'client', lat_deg: 65.0, lon_deg: 60.0 },
  ],
  failures: [],
  gateway_outages: [],
}

describe('Orbit Calculation Library', () => {
  it('calculates ground station cartesian positions accurately', () => {
    const ground = getGroundPositions(sampleScenario)
    expect(ground).toHaveLength(2)
    const gw = ground.find((g) => g.id === 'GW')!
    expect(gw).toBeDefined()
    const radius = Math.sqrt(gw.x * gw.x + gw.y * gw.y + gw.z * gw.z)
    expect(radius).toBeCloseTo(R_EARTH, 1)
  })

  it('produces valid snapshot with active satellites and elevation map', () => {
    const snap = calculateSnapshot(sampleScenario, 0)
    expect(snap.t_s).toBe(0)
    expect(snap.satellites).toHaveLength(2)
    expect(snap.satellites[0].active).toBe(true)
    expect(snap.elevations['CL']).toBeDefined()
    expect(snap.elevations['GW']).toBeDefined()
  })

  it('handles satellite failure events properly in snapshot', () => {
    const scenarioWithFail: Scenario = {
      ...sampleScenario,
      failures: [{ satellite_id: 'S01', start_s: 0, end_s: 240 }],
    }
    const snap = calculateSnapshot(scenarioWithFail, 120)
    const s1 = snap.satellites.find((s) => s.id === 'S01')!
    expect(s1.active).toBe(false)
  })

  it('handles gateway outage events properly in snapshot', () => {
    const scenarioWithGwOutage: Scenario = {
      ...sampleScenario,
      gateway_outages: [{ gateway_id: 'GW', start_s: 0, end_s: 240 }],
    }
    const snap = calculateSnapshot(scenarioWithGwOutage, 120)
    expect(snap.routes['CL']).toEqual([])
    expect(snap.outageReasons['CL']).toContain('Gateway outage')
  })

  it('calculates full timeline SLA metrics and slots', () => {
    const { timelines } = calculateFullTimeline(sampleScenario)
    expect(timelines['CL']).toBeDefined()
    expect(timelines['CL'].slots).toHaveLength(3) // 360 / 120 = 3
    expect(timelines['CL'].metrics.total_slots).toBe(3)
  })
})

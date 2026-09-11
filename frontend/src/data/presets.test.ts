import { describe, it, expect } from 'vitest'
import { PRESET_SCENARIOS } from './presets'
import { calculateSnapshot } from '../lib/orbit'

describe('Scenario Presets Configuration', () => {
  it('defines exactly 4 preset scenarios', () => {
    expect(PRESET_SCENARIOS).toHaveLength(4)
    const ids = PRESET_SCENARIOS.map((p) => p.id)
    expect(ids).toEqual([
      '01_full_constellation',
      '02_first_launch',
      '03_satellite_outages',
      '04_link_range',
    ])
  })

  it('verifies all presets adhere to cosmo-A-1.0 schema structure', () => {
    for (const preset of PRESET_SCENARIOS) {
      expect(preset.data.schema_version).toBe('cosmo-A-1.0')
      expect(preset.data.meta.id).toBeDefined()
      expect(preset.data.environment.altitude_km).toBe(550)
      expect(preset.data.environment.inclination_deg).toBe(87)
      expect(preset.data.design.satellites.length).toBeGreaterThan(0)
      expect(preset.data.ground_sites.length).toBeGreaterThan(0)

      // Test that calculateSnapshot runs cleanly on each preset at t=0
      const snap = calculateSnapshot(preset.data, 0)
      expect(snap.satellites.length).toBeGreaterThan(0)
      expect(snap.routes).toBeDefined()
    }
  })

  it('validates preset 2 first launch stage constraint', () => {
    const p2 = PRESET_SCENARIOS.find((p) => p.id === '02_first_launch')!
    expect(p2.data.design.launch_stage).toBe(1)
    const snap = calculateSnapshot(p2.data, 0)
    const activeSats = snap.satellites.filter((s) => s.active)
    // First launch stage only has batch 1 active (16 satellites)
    expect(activeSats).toHaveLength(16)
  })

  it('validates preset 3 satellite outages timing', () => {
    const p3 = PRESET_SCENARIOS.find((p) => p.id === '03_satellite_outages')!
    expect(p3.data.failures.length).toBeGreaterThan(0)
    const outageStart = p3.data.failures[0].start_s
    expect(outageStart).toBe(21600) // 6 hours

    // At t=0, failure is not active
    const snapT0 = calculateSnapshot(p3.data, 0)
    const failedT0 = snapT0.satellites.filter((s) => s.failed)
    expect(failedT0).toHaveLength(0)

    // At t=21600, failures are active
    const snapTFail = calculateSnapshot(p3.data, 21600)
    const failedTFail = snapTFail.satellites.filter((s) => s.failed)
    expect(failedTFail.length).toBeGreaterThan(0)
  })

  it('validates preset 4 ISL link range is 2000 km', () => {
    const p4 = PRESET_SCENARIOS.find((p) => p.id === '04_link_range')!
    expect(p4.data.environment.isl_range_km).toBe(2000)
  })
})

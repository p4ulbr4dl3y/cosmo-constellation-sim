import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OrbitParams } from './OrbitParams'
import type { Design, Environment } from '../../types/scenario'

describe('OrbitParams', () => {
  const design: Design = {
    launch_stage: 1,
    planes: [
      { id: 'P1', raan_deg: 0, phase_deg: 0 },
      { id: 'P2', raan_deg: 120, phase_deg: 7.5 },
    ],
    satellites: [
      { id: 'S01', plane_id: 'P1', slot_deg: 0, launch_batch: 1 },
      { id: 'S02', plane_id: 'P2', slot_deg: 0, launch_batch: 2 },
    ],
  }

  const environment: Environment = {
    altitude_km: 550,
    inclination_deg: 86.4,
    earth_angle0_deg: 0,
    horizon_s: 86400,
    step_s: 120,
    min_elevation_deg: 15,
    isl_range_km: 3000,
  }

  it('triggers onLaunchStageChange when stage button clicked', () => {
    const onLaunchStageChange = vi.fn()
    render(
      <OrbitParams
        design={design}
        environment={environment}
        onLaunchStageChange={onLaunchStageChange}
        onPlaneChange={vi.fn()}
        onEnvChange={vi.fn()}
      />
    )

    const stage3Btn = screen.getByText('Этап 3').closest('button')
    fireEvent.click(stage3Btn!)
    expect(onLaunchStageChange).toHaveBeenCalledWith(3)
  })

  it('triggers onEnvChange when ISL range button clicked', () => {
    const onEnvChange = vi.fn()
    render(
      <OrbitParams
        design={design}
        environment={environment}
        onLaunchStageChange={vi.fn()}
        onPlaneChange={vi.fn()}
        onEnvChange={onEnvChange}
      />
    )

    const range2000Btn = screen.getByText('2000 км').closest('button')
    fireEvent.click(range2000Btn!)
    expect(onEnvChange).toHaveBeenCalledWith('isl_range_km', 2000)
  })

  it('triggers onEnvChange when min elevation modified by buttons and input', () => {
    const onEnvChange = vi.fn()
    render(
      <OrbitParams
        design={design}
        environment={environment}
        onLaunchStageChange={vi.fn()}
        onPlaneChange={vi.fn()}
        onEnvChange={onEnvChange}
      />
    )

    const decBtn = screen.getByTitle('Уменьшить')
    fireEvent.click(decBtn)
    expect(onEnvChange).toHaveBeenCalledWith('min_elevation_deg', 14)

    const incBtn = screen.getByTitle('Увеличить')
    fireEvent.click(incBtn)
    expect(onEnvChange).toHaveBeenCalledWith('min_elevation_deg', 16)

    const numberInput = screen.getByDisplayValue('15')
    fireEvent.change(numberInput, { target: { value: '25' } })
    expect(onEnvChange).toHaveBeenCalledWith('min_elevation_deg', 25)
  })

  it('triggers onPlaneChange when RAAN and phase sliders change', () => {
    const onPlaneChange = vi.fn()
    const { container } = render(
      <OrbitParams
        design={design}
        environment={environment}
        onLaunchStageChange={vi.fn()}
        onPlaneChange={onPlaneChange}
        onEnvChange={vi.fn()}
      />
    )

    const sliders = container.querySelectorAll('input[type="range"]')
    // First plane RAAN slider
    fireEvent.change(sliders[0], { target: { value: '45' } })
    expect(onPlaneChange).toHaveBeenCalledWith('P1', 'raan_deg', 45)

    // First plane phase slider
    fireEvent.change(sliders[1], { target: { value: '15' } })
    expect(onPlaneChange).toHaveBeenCalledWith('P1', 'phase_deg', 15)
  })
})

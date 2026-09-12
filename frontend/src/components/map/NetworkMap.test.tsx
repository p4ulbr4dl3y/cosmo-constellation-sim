import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NetworkMap } from './NetworkMap'
import { PRESET_SCENARIOS } from '../../data/presets'
import { calculateSnapshot } from '../../lib/orbit'
import { project2D } from './projection'

const mockScenario = PRESET_SCENARIOS[0].data
const mockSnapshot = calculateSnapshot(mockScenario, 0)

describe('NetworkMap Component', () => {
  it('renders canvas, map controls, and orbit plane legend', () => {
    const onSelectClient = vi.fn()
    const onToggleFailure = vi.fn()

    const { container } = render(
      <NetworkMap
        scenario={mockScenario}
        snapshot={mockSnapshot}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
        onToggleFailure={onToggleFailure}
      />
    )

    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()

    // Legend badges
    expect(screen.getByText('P1')).toBeDefined()
    expect(screen.getByText('P2')).toBeDefined()
    expect(screen.getByText('P3')).toBeDefined()
    expect(screen.getByText('ОТКАЗ')).toBeDefined()

    // 2D and 3D buttons
    expect(screen.getByRole('button', { name: '2D' })).toBeDefined()
    expect(screen.getByRole('button', { name: '3D' })).toBeDefined()
  })

  it('switches between 2D and 3D view modes', () => {
    const onSelectClient = vi.fn()
    const onToggleFailure = vi.fn()

    render(
      <NetworkMap
        scenario={mockScenario}
        snapshot={mockSnapshot}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
        onToggleFailure={onToggleFailure}
      />
    )

    const btn3D = screen.getByRole('button', { name: '3D' })
    const btn2D = screen.getByRole('button', { name: '2D' })

    // Switch to 3D
    fireEvent.click(btn3D)
    expect(btn3D.className).toContain('bg-white/15')

    // Switch back to 2D
    fireEvent.click(btn2D)
    expect(btn2D.className).toContain('bg-white/15')
  })

  it('toggles layer controls (ISL, GSL, ID labels, Unlaunched reserve)', () => {
    const onSelectClient = vi.fn()
    const onToggleFailure = vi.fn()

    render(
      <NetworkMap
        scenario={mockScenario}
        snapshot={mockSnapshot}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
        onToggleFailure={onToggleFailure}
      />
    )

    const islBtn = screen.getByRole('button', { name: 'ISL' })
    const gslBtn = screen.getByRole('button', { name: 'GSL' })
    const idBtn = screen.getByRole('button', { name: 'ID' })
    const reserveBtn = screen.getByRole('button', { name: 'Резерв' })

    // Default: ISL, GSL, Резерв are enabled (bg-white/20)
    expect(islBtn.className).toContain('bg-white/20')
    expect(gslBtn.className).toContain('bg-white/20')
    expect(reserveBtn.className).toContain('bg-white/20')
    expect(idBtn.className).not.toContain('bg-white/20')

    // Toggle ISL off
    fireEvent.click(islBtn)
    expect(islBtn.className).not.toContain('bg-white/20')

    // Toggle GSL off
    fireEvent.click(gslBtn)
    expect(gslBtn.className).not.toContain('bg-white/20')

    // Toggle ID on
    fireEvent.click(idBtn)
    expect(idBtn.className).toContain('bg-white/20')

    // Toggle Резерв off
    fireEvent.click(reserveBtn)
    expect(reserveBtn.className).not.toContain('bg-white/20')
  })

  it('activates Arctic focus mode in 3D', () => {
    const onSelectClient = vi.fn()
    const onToggleFailure = vi.fn()

    render(
      <NetworkMap
        scenario={mockScenario}
        snapshot={mockSnapshot}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
        onToggleFailure={onToggleFailure}
      />
    )

    const arcticBtn = screen.getByRole('button', { name: /арктика/i })
    fireEvent.click(arcticBtn)

    // Should switch to 3D and 135% zoom
    const btn3D = screen.getByRole('button', { name: '3D' })
    expect(btn3D.className).toContain('bg-white/15')
    expect(screen.getByText('135%')).toBeDefined()
  })

  it('handles zoom in, zoom out, and reset view controls', () => {
    const onSelectClient = vi.fn()
    const onToggleFailure = vi.fn()

    render(
      <NetworkMap
        scenario={mockScenario}
        snapshot={mockSnapshot}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
        onToggleFailure={onToggleFailure}
      />
    )

    const zoomInBtn = screen.getByTitle('Приблизить карту')
    const zoomOutBtn = screen.getByTitle('Отдалить карту')
    const resetBtn = screen.getByTitle('Сбросить масштаб и положение (100%)')

    expect(screen.getByText('100%')).toBeDefined()

    // Zoom in to 115%
    fireEvent.click(zoomInBtn)
    expect(screen.getByText('115%')).toBeDefined()

    // Zoom out back to 100%
    fireEvent.click(zoomOutBtn)
    expect(screen.getByText('100%')).toBeDefined()

    // Zoom in then reset
    fireEvent.click(zoomInBtn)
    expect(screen.getByText('115%')).toBeDefined()
    fireEvent.click(resetBtn)
    expect(screen.getByText('100%')).toBeDefined()
  })

  it('handles canvas pointer dragging and interactions', () => {
    const onSelectClient = vi.fn()
    const onToggleFailure = vi.fn()

    const { container } = render(
      <NetworkMap
        scenario={mockScenario}
        snapshot={mockSnapshot}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
        onToggleFailure={onToggleFailure}
      />
    )

    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    expect(canvas).not.toBeNull()

    // Simulate pointer down to drag
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 120, pointerId: 1 })
    fireEvent.pointerUp(canvas, { clientX: 150, clientY: 120, pointerId: 1 })

    // Simulate mouse leave
    fireEvent.mouseLeave(canvas)

    // Simulate wheel event for zoom
    fireEvent.wheel(canvas, { deltaY: -100 })
    expect(screen.queryByText('100%')).toBeNull()
  })

  it('selects client when clicking ground station node on canvas', () => {
    const onSelectClient = vi.fn()
    const onToggleFailure = vi.fn()

    const { container } = render(
      <NetworkMap
        scenario={mockScenario}
        snapshot={mockSnapshot}
        selectedClientId="C70"
        onSelectClient={onSelectClient}
        onToggleFailure={onToggleFailure}
      />
    )

    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    expect(canvas).not.toBeNull()

    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    // Ground station C65 is at lon: 60, lat: 65
    const [px, py] = project2D(60.0, 65.0, 800, 600, 1.0, { x: 0, y: 0 })
    fireEvent.pointerMove(canvas, { clientX: px, clientY: py })
    fireEvent.click(canvas)

    expect(onSelectClient).toHaveBeenCalledWith('C65')
  })

  it('inspects satellite on canvas click and allows failure toggle and close', () => {
    const onSelectClient = vi.fn()
    const onToggleFailure = vi.fn()

    const { container } = render(
      <NetworkMap
        scenario={mockScenario}
        snapshot={mockSnapshot}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
        onToggleFailure={onToggleFailure}
      />
    )

    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    expect(canvas).not.toBeNull()

    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    const sat = mockSnapshot.satellites[0]
    const [sx, sy] = project2D(sat.lon_deg, sat.lat_deg, 800, 600, 1.0, { x: 0, y: 0 })

    fireEvent.pointerMove(canvas, { clientX: sx, clientY: sy })
    fireEvent.click(canvas)

    // MapSatelliteHUD should be visible
    expect(screen.getByText('СТАТУС:')).toBeDefined()
    expect(screen.getAllByText(new RegExp(`КА ${sat.id}`)).length).toBeGreaterThanOrEqual(1)

    // Toggle failure button
    const failBtn = screen.getByRole('button', { name: /Имитировать отказ КА/i })
    fireEvent.click(failBtn)
    expect(onToggleFailure).toHaveBeenCalledWith(sat.id)

    // Close HUD
    const closeBtn = screen.getByRole('button', { name: '✕' })
    fireEvent.click(closeBtn)
    expect(screen.queryByText('СТАТУС:')).toBeNull()
  })

  it('renders compact controls and hides legend on mobile breakpoints', () => {
    const { container } = render(
      <NetworkMap
        scenario={mockScenario}
        snapshot={mockSnapshot}
        selectedClientId="C65"
        onSelectClient={vi.fn()}
        onToggleFailure={vi.fn()}
      />
    )

    // Legend container has hidden md:flex for responsive mobile hiding
    const legend = container.querySelector('.hidden.md\\:flex')
    expect(legend).toBeDefined()
    expect(legend?.textContent).toContain('P1')
    expect(legend?.textContent).toContain('ОТКАЗ')
  })
})

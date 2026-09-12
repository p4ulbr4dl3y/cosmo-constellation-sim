import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TimelinePlayer } from './TimelinePlayer'
import { PRESET_SCENARIOS } from '../../data/presets'
import type { ClientTimeline, TimelineSlot } from '../../types/scenario'

const mockScenario = PRESET_SCENARIOS[0].data
const totalSlots = Math.floor(
  mockScenario.environment.horizon_s / mockScenario.environment.step_s
)

const mockSlots: TimelineSlot[] = Array.from({ length: totalSlots }, (_, i) => ({
  t_s: i * 120,
  hasPath: i % 2 === 0,
  isVisible: true,
  hops: i % 2 === 0 ? 2 : 0,
  reason: i % 2 === 0 ? undefined : 'no_client_satellite',
}))

const mockTimelines: Record<string, ClientTimeline> = {
  C65: {
    clientId: 'C65',
    name: 'Northern terminal 65',
    slots: mockSlots,
    metrics: {
      client_id: 'C65',
      name: 'Northern terminal 65',
      total_slots: 720,
      available_slots: 650,
      visible_slots: 686,
      availability_ratio: 0.902,
      visibility_ratio: 0.95,
      max_gap_s: 480,
      avg_hops: 2.1,
    },
  },
  C70: {
    clientId: 'C70',
    name: 'Northern terminal 70',
    slots: [],
    metrics: {
      client_id: 'C70',
      name: 'Northern terminal 70',
      total_slots: 720,
      available_slots: 600,
      visible_slots: 633,
      availability_ratio: 0.833,
      visibility_ratio: 0.88,
      max_gap_s: 720,
      avg_hops: 2.4,
    },
  },
  C72: {
    clientId: 'C72',
    name: 'Northern terminal 72',
    slots: [],
    metrics: {
      client_id: 'C72',
      name: 'Northern terminal 72',
      total_slots: 720,
      available_slots: 680,
      visible_slots: 691,
      availability_ratio: 0.944,
      visibility_ratio: 0.96,
      max_gap_s: 360,
      avg_hops: 2.0,
    },
  },
}

describe('TimelinePlayer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders playback controls and current time', () => {
    const onTimeChange = vi.fn()
    const onSelectClient = vi.fn()

    render(
      <TimelinePlayer
        scenario={mockScenario}
        currentTime={3600}
        onTimeChange={onTimeChange}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
      />
    )

    expect(screen.getByText('01:00:00')).toBeDefined()
    expect(screen.getByText('/ 24:00:00')).toBeDefined()
    expect(screen.getByRole('button', { name: /старт/i })).toBeDefined()
  })

  it('toggles play/pause and advances time during playback', () => {
    const onTimeChange = vi.fn()
    const onSelectClient = vi.fn()

    render(
      <TimelinePlayer
        scenario={mockScenario}
        currentTime={0}
        onTimeChange={onTimeChange}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
      />
    )

    const playButton = screen.getByRole('button', { name: /старт/i })
    fireEvent.click(playButton)

    // Changes to pause button
    expect(screen.getByRole('button', { name: /пауза/i })).toBeDefined()

    // Advance timers by one step interval (1000 / 5 = 200ms for 5x speed)
    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(onTimeChange).toHaveBeenCalledWith(120)

    // Click pause
    const pauseButton = screen.getByRole('button', { name: /пауза/i })
    fireEvent.click(pauseButton)
    expect(screen.getByRole('button', { name: /старт/i })).toBeDefined()
  })

  it('loops back to 0 when playback reaches or exceeds horizon', () => {
    const onTimeChange = vi.fn()
    const onSelectClient = vi.fn()
    const lastStepTime = mockScenario.environment.horizon_s - mockScenario.environment.step_s

    render(
      <TimelinePlayer
        scenario={mockScenario}
        currentTime={lastStepTime}
        onTimeChange={onTimeChange}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
      />
    )

    const playBtn = screen.getByRole('button', { name: /старт/i })
    fireEvent.click(playBtn)

    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(onTimeChange).toHaveBeenCalledWith(0)
  })

  it('handles speed selector changes (1x, 5x, 20x, 60x)', () => {
    const onTimeChange = vi.fn()
    const onSelectClient = vi.fn()

    render(
      <TimelinePlayer
        scenario={mockScenario}
        currentTime={0}
        onTimeChange={onTimeChange}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
      />
    )

    const speeds = [1, 5, 20, 60]
    speeds.forEach((spd) => {
      const btn = screen.getByRole('button', { name: `${spd}x` })
      expect(btn).toBeDefined()
      fireEvent.click(btn)
    })
  })

  it('triggers client selection on clicking client pill buttons', () => {
    const onTimeChange = vi.fn()
    const onSelectClient = vi.fn()

    render(
      <TimelinePlayer
        scenario={mockScenario}
        currentTime={0}
        onTimeChange={onTimeChange}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
      />
    )

    const c70Btn = screen.getByRole('button', { name: /C70/ })
    fireEvent.click(c70Btn)
    expect(onSelectClient).toHaveBeenCalledWith('C70')

    const c72Btn = screen.getByRole('button', { name: /C72/ })
    fireEvent.click(c72Btn)
    expect(onSelectClient).toHaveBeenCalledWith('C72')
  })

  it('handles manual step backward, step forward, and reset to beginning', () => {
    const onTimeChange = vi.fn()
    const onSelectClient = vi.fn()

    render(
      <TimelinePlayer
        scenario={mockScenario}
        currentTime={3600}
        onTimeChange={onTimeChange}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
      />
    )

    // Step back
    const stepBackBtn = screen.getByTitle('Шаг назад (-120с)')
    fireEvent.click(stepBackBtn)
    expect(onTimeChange).toHaveBeenCalledWith(3600 - 120)

    // Step forward
    const stepFwdBtn = screen.getByTitle('Шаг вперед (+120с)')
    fireEvent.click(stepFwdBtn)
    expect(onTimeChange).toHaveBeenCalledWith(3600 + 120)

    // Reset to beginning
    const resetBtn = screen.getByTitle('В начало (00:00:00)')
    fireEvent.click(resetBtn)
    expect(onTimeChange).toHaveBeenCalledWith(0)
  })

  it('supports keyboard navigation (Space, ArrowRight, ArrowLeft)', () => {
    const onTimeChange = vi.fn()
    const onSelectClient = vi.fn()

    render(
      <TimelinePlayer
        scenario={mockScenario}
        currentTime={1000}
        onTimeChange={onTimeChange}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
      />
    )

    // Space toggles play
    fireEvent.keyDown(window, { code: 'Space' })
    expect(screen.getByRole('button', { name: /пауза/i })).toBeDefined()

    // ArrowRight steps forward
    fireEvent.keyDown(window, { code: 'ArrowRight' })
    expect(onTimeChange).toHaveBeenCalledWith(1000 + 120)

    // ArrowLeft steps backward
    fireEvent.keyDown(window, { code: 'ArrowLeft' })
    expect(onTimeChange).toHaveBeenCalledWith(1000 - 120)
  })

  it('handles timeline scrubbing with pointer events', () => {
    const onTimeChange = vi.fn()
    const onSelectClient = vi.fn()

    const { container } = render(
      <TimelinePlayer
        scenario={mockScenario}
        currentTime={0}
        onTimeChange={onTimeChange}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
      />
    )

    const scrubber = container.querySelector('.cursor-ew-resize') as HTMLElement
    expect(scrubber).not.toBeNull()

    vi.spyOn(scrubber, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 1000,
      height: 40,
      right: 1000,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    // Pointer down at 50% width -> 43200 seconds
    fireEvent.pointerDown(scrubber, { clientX: 500, pointerId: 1 })
    expect(onTimeChange).toHaveBeenCalledWith(43200)

    // Pointer move while dragging
    fireEvent.pointerMove(scrubber, { clientX: 250, pointerId: 1 })
    expect(onTimeChange).toHaveBeenCalledWith(21600)

    // Pointer up ends dragging
    fireEvent.pointerUp(scrubber, { pointerId: 1 })
  })

  it('renders Gantt strips and shows tooltip on hover', () => {
    const onTimeChange = vi.fn()
    const onSelectClient = vi.fn()

    const { container } = render(
      <TimelinePlayer
        scenario={mockScenario}
        currentTime={0}
        onTimeChange={onTimeChange}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
      />
    )

    // Select the first client's Gantt row container inside the timeline
    const ganttRow = container.querySelector('.cursor-ew-resize .h-4\\.5') as HTMLElement
    expect(ganttRow).not.toBeNull()

    // 720 slots across 720px -> each slot = 1px
    vi.spyOn(ganttRow, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 100,
      width: 720,
      height: 20,
      right: 720,
      bottom: 120,
      x: 0,
      y: 100,
      toJSON: () => {},
    })

    // Hover slot 0 (even index, hasPath: true)
    fireEvent.mouseMove(ganttRow, { clientX: 0.5 })
    expect(screen.getByText('Связь активна (Хопов: 2)')).toBeDefined()

    // Hover slot 1 (odd index, hasPath: false)
    fireEvent.mouseMove(ganttRow, { clientX: 1.5 })
    expect(screen.getByText(/Обрыв: no_client_satellite/)).toBeDefined()

    // Mouse leave removes tooltip
    fireEvent.mouseLeave(ganttRow)
    expect(screen.queryByText(/Связь активна/)).toBeNull()
  })
})

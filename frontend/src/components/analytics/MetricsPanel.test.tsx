import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MetricsPanel } from './MetricsPanel'
import { PRESET_SCENARIOS } from '../../data/presets'
import { calculateSnapshot } from '../../lib/orbit'
import type { ClientTimeline, Snapshot } from '../../types/scenario'

const mockScenario = PRESET_SCENARIOS[0].data
const baseSnapshot = calculateSnapshot(mockScenario, 0)

const mockTimelines: Record<string, ClientTimeline> = {
  C65: {
    clientId: 'C65',
    name: 'Northern terminal 65',
    slots: [],
    metrics: {
      client_id: 'C65',
      name: 'Northern terminal 65',
      total_slots: 720,
      available_slots: 650,
      visible_slots: 686,
      availability_ratio: 0.902,
      visibility_ratio: 0.954,
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
      available_slots: 580,
      visible_slots: 633,
      availability_ratio: 0.805,
      visibility_ratio: 0.88,
      max_gap_s: 720,
      avg_hops: 2.6,
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
      available_slots: 690,
      visible_slots: 705,
      availability_ratio: 0.958,
      visibility_ratio: 0.98,
      max_gap_s: 360,
      avg_hops: 2.0,
    },
  },
}

describe('MetricsPanel Component', () => {
  it('renders SLA metric cards and target availability comparison', () => {
    const onSelectClient = vi.fn()

    render(
      <MetricsPanel
        scenario={mockScenario}
        snapshot={baseSnapshot}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
      />
    )

    // Metric cards
    expect(screen.getByText('Доступность SLA')).toBeDefined()
    expect(screen.getAllByText('90.2%').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Цель ≥90%')).toBeDefined()

    expect(screen.getByText('Видимость КА')).toBeDefined()
    expect(screen.getByText('95.4%')).toBeDefined()
    expect(screen.getByText('Угол места ≥10°')).toBeDefined()

    expect(screen.getByText('Макс. перерыв (Max Gap)')).toBeDefined()
    expect(screen.getByText('8 мин')).toBeDefined()
    expect(screen.getByText('макс. 480с')).toBeDefined()

    expect(screen.getByText('Среднее хопов')).toBeDefined()
    expect(screen.getByText('2.1')).toBeDefined()
    expect(screen.getByText('на активный путь')).toBeDefined()
  })

  it('highlights SLA shortfall when availability is below target', () => {
    const onSelectClient = vi.fn()

    render(
      <MetricsPanel
        scenario={mockScenario}
        snapshot={baseSnapshot}
        timelines={mockTimelines}
        selectedClientId="C70"
        onSelectClient={onSelectClient}
      />
    )

    // C70 has 80.5% (below 90% target)
    expect(screen.getAllByText('80.5%').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Цель ≥90%')).toBeDefined()
  })

  it('renders client tabs and allows selecting another client', () => {
    const onSelectClient = vi.fn()

    render(
      <MetricsPanel
        scenario={mockScenario}
        snapshot={baseSnapshot}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
      />
    )

    const c72Btn = screen.getByRole('button', { name: /C72/ })
    fireEvent.click(c72Btn)
    expect(onSelectClient).toHaveBeenCalledWith('C72')
  })

  it('renders active route, hops, and RTT latency when route is connected', () => {
    const onSelectClient = vi.fn()
    const onToggleFailure = vi.fn()

    const snapshotWithRoute: Snapshot = {
      ...baseSnapshot,
      routes: {
        C65: ['C65', 'S01', 'G_MUR'],
      },
      outageReasons: {},
    }

    render(
      <MetricsPanel
        scenario={mockScenario}
        snapshot={snapshotWithRoute}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={onSelectClient}
        onToggleFailure={onToggleFailure}
      />
    )

    // Route segments
    expect(screen.getAllByText('C65').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('S01').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('G_MUR')).toBeDefined()
    expect(screen.getByText(/RTT/)).toBeDefined()

    // Prime satellite telemetry card & failure toggle button
    expect(screen.getByText(/КА S01/)).toBeDefined()
    const failBtn = screen.getByRole('button', { name: /Имитировать отказ КА/i })
    fireEvent.click(failBtn)
    expect(onToggleFailure).toHaveBeenCalledWith('S01')
  })

  it('displays correct diagnosis and recommendations for no_client_satellite outage', () => {
    const snapshotNoClientSat: Snapshot = {
      ...baseSnapshot,
      routes: { C65: [] },
      outageReasons: { C65: 'no_client_satellite' },
    }

    render(
      <MetricsPanel
        scenario={mockScenario}
        snapshot={snapshotNoClientSat}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={vi.fn()}
      />
    )

    expect(screen.getByText('Маршрут разорван')).toBeDefined()
    expect(screen.getByText('Терминал вне зоны радиовидимости')).toBeDefined()
    expect(
      screen.getByText(
        'Ожидайте пролета очередного спутника или увеличьте число КА в группировке.'
      )
    ).toBeDefined()
  })

  it('displays correct diagnosis for gateway_offline outage', () => {
    const snapshotGwOffline: Snapshot = {
      ...baseSnapshot,
      routes: { C65: [] },
      outageReasons: { C65: 'gateway_offline' },
    }

    render(
      <MetricsPanel
        scenario={mockScenario}
        snapshot={snapshotGwOffline}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={vi.fn()}
      />
    )

    expect(screen.getByText('Технологическое окно шлюза')).toBeDefined()
    expect(
      screen.getByText('Дождитесь завершения планового технологического окна шлюза.')
    ).toBeDefined()
  })

  it('displays correct diagnosis for no_gateway_satellite outage', () => {
    const snapshotNoGwSat: Snapshot = {
      ...baseSnapshot,
      routes: { C65: [] },
      outageReasons: { C65: 'no_gateway_satellite' },
    }

    render(
      <MetricsPanel
        scenario={mockScenario}
        snapshot={snapshotNoGwSat}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={vi.fn()}
      />
    )

    expect(screen.getByText('Нет КА над шлюзом')).toBeDefined()
    expect(
      screen.getByText('Ожидайте захода КА орбитальной плоскости в приполярный сектор Мурманска.')
    ).toBeDefined()
  })

  it('displays correct diagnosis for isl_disconnected outage', () => {
    const snapshotIslDisconnected: Snapshot = {
      ...baseSnapshot,
      routes: { C65: [] },
      outageReasons: { C65: 'isl_disconnected' },
    }

    render(
      <MetricsPanel
        scenario={mockScenario}
        snapshot={snapshotIslDisconnected}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={vi.fn()}
      />
    )

    expect(screen.getByText('Разрыв межспутникового сегмента')).toBeDefined()
    expect(
      screen.getByText(
        'Проверьте состояние отказавших КА или скорректируйте лимит дальности ISL.'
      )
    ).toBeDefined()
  })

  it('renders gateway maintenance badge during scheduled gateway outage window', () => {
    const scenarioWithGwOutage = {
      ...mockScenario,
      gateway_outages: [{ gateway_id: 'G_MUR', start_s: 0, end_s: 3600 }],
    }

    render(
      <MetricsPanel
        scenario={scenarioWithGwOutage}
        snapshot={{ ...baseSnapshot, t_s: 1200 }}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={vi.fn()}
      />
    )

    expect(screen.getByText('Шлюз: техокно')).toBeDefined()
  })

  it('shows restore button when prime satellite is failed', () => {
    const onToggleFailure = vi.fn()
    const failedSat = { ...baseSnapshot.satellites[0], failed: true }
    const snapshotWithFailedSat: Snapshot = {
      ...baseSnapshot,
      satellites: [failedSat, ...baseSnapshot.satellites.slice(1)],
      routes: { C65: ['C65', failedSat.id, 'G_MUR'] },
      outageReasons: {},
    }

    render(
      <MetricsPanel
        scenario={mockScenario}
        snapshot={snapshotWithFailedSat}
        timelines={mockTimelines}
        selectedClientId="C65"
        onSelectClient={vi.fn()}
        onToggleFailure={onToggleFailure}
      />
    )

    const restoreBtn = screen.getByRole('button', { name: /Восстановить связь/i })
    expect(restoreBtn).toBeDefined()
    fireEvent.click(restoreBtn)
    expect(onToggleFailure).toHaveBeenCalledWith(failedSat.id)
  })
})

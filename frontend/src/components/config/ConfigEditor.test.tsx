import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ConfigEditor } from './ConfigEditor'
import { PRESET_SCENARIOS } from '../../data/presets'

const mockScenario = PRESET_SCENARIOS[0].data

describe('ConfigEditor and subcomponents', () => {
  const defaultProps = {
    scenario: mockScenario,
    onUpdateScenario: vi.fn(),
    onResetScenario: vi.fn(),
    activeRouteSats: ['S01', 'S02'],
    currentTime: 1000,
  }

  it('renders orbit configuration and failure management sections', () => {
    render(<ConfigEditor {...defaultProps} />)
    expect(screen.getByText('Конфигурация симуляции')).toBeDefined()
    expect(screen.getByText('Очередь развертывания')).toBeDefined()
    expect(screen.getByText('Параметры окружения и ISL')).toBeDefined()
    expect(screen.getByText('Орбитальные плоскости (RAAN и фаза)')).toBeDefined()
    expect(screen.getByText(/Отказы спутников/)).toBeDefined()
    expect(screen.getByText(/Окна обслуживания наземных шлюзов/)).toBeDefined()
  })

  it('triggers onUpdateScenario when selecting a launch stage', () => {
    const onUpdateScenario = vi.fn()
    render(<ConfigEditor {...defaultProps} onUpdateScenario={onUpdateScenario} />)

    const stage2Btn = screen.getByText('Этап 2').closest('button')
    expect(stage2Btn).not.toBeNull()
    fireEvent.click(stage2Btn!)

    expect(onUpdateScenario).toHaveBeenCalled()
    const updated = onUpdateScenario.mock.calls[0][0]
    expect(updated.design.launch_stage).toBe(2)
  })

  it('triggers onResetScenario when clicking reset button', () => {
    const onResetScenario = vi.fn()
    render(<ConfigEditor {...defaultProps} onResetScenario={onResetScenario} />)

    const resetBtn = screen.getByText('Сброс').closest('button')
    fireEvent.click(resetBtn!)
    expect(onResetScenario).toHaveBeenCalledTimes(1)
  })

  it('triggers quick failure for active route sat', () => {
    const onUpdateScenario = vi.fn()
    render(<ConfigEditor {...defaultProps} onUpdateScenario={onUpdateScenario} />)

    const quickKillBtn = screen.getByText(/Отказ S01/).closest('button')
    fireEvent.click(quickKillBtn!)

    expect(onUpdateScenario).toHaveBeenCalled()
    const updated = onUpdateScenario.mock.calls[0][0]
    expect(updated.failures.some((f: { satellite_id: string }) => f.satellite_id === 'S01')).toBe(true)
  })

  it('handles empty activeRouteSats gracefully', () => {
    const onUpdateScenario = vi.fn()
    render(
      <ConfigEditor
        {...defaultProps}
        activeRouteSats={[]}
        onUpdateScenario={onUpdateScenario}
      />
    )

    const disabledBtn = screen.getByText(/Отказ нет КА/).closest('button')
    expect(disabledBtn).not.toBeNull()
    fireEvent.click(disabledBtn!)
    expect(onUpdateScenario).not.toHaveBeenCalled()
  })

  it('triggers onUpdateScenario on environment and plane changes', async () => {
    const onUpdateScenario = vi.fn()
    const { container } = render(
      <ConfigEditor {...defaultProps} onUpdateScenario={onUpdateScenario} />
    )

    // Change ISL range
    const range2000 = screen.getByText('2000 км').closest('button')
    fireEvent.click(range2000!)
    await vi.waitFor(() => {
      expect(onUpdateScenario).toHaveBeenCalled()
    })
    expect(onUpdateScenario.mock.calls[0][0].environment.isl_range_km).toBe(2000)

    // Change Plane RAAN
    const sliders = container.querySelectorAll('input[type="range"]')
    if (sliders.length > 0) {
      fireEvent.change(sliders[0], { target: { value: '90' } })
      await vi.waitFor(() => {
        expect(onUpdateScenario).toHaveBeenCalledTimes(2)
      })
    }
  })

  it('supports adding and removing gateway outages and failures', () => {
    const onUpdateScenario = vi.fn()
    const scenarioWithFailures = {
      ...mockScenario,
      failures: [{ satellite_id: 'S01', start_s: 100, end_s: 200 }],
      gateway_outages: [{ gateway_id: 'G_MUR', start_s: 300, end_s: 400 }],
    }

    render(
      <ConfigEditor
        {...defaultProps}
        scenario={scenarioWithFailures}
        onUpdateScenario={onUpdateScenario}
      />
    )

    // Add satellite failure
    const addButtons = screen.getAllByRole('button', { name: /Добавить/i })
    fireEvent.click(addButtons[0])
    expect(onUpdateScenario).toHaveBeenCalled()

    // Add gateway outage
    fireEvent.click(addButtons[1])
    expect(onUpdateScenario).toHaveBeenCalled()

    // Delete existing failure
    const deleteButtons = screen.getAllByTitle(/Удалить/i)
    fireEvent.click(deleteButtons[0])
    expect(onUpdateScenario).toHaveBeenCalled()

    // Delete existing gateway outage
    fireEvent.click(deleteButtons[1])
    expect(onUpdateScenario).toHaveBeenCalled()
  })
})

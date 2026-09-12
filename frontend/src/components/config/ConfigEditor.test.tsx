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
})

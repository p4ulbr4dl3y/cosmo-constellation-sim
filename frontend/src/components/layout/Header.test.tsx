import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Header } from './Header'
import { PRESET_SCENARIOS } from '../../data/presets'

const mockScenario = PRESET_SCENARIOS[0].data

describe('Header', () => {
  const defaultProps = {
    currentScenario: mockScenario,
    onSelectPreset: vi.fn(),
    onLoadCustomJson: vi.fn(),
    onResetScenario: vi.fn(),
    timelines: {},
    activeTab: 'monitor' as const,
    setActiveTab: vi.fn(),
    isModified: false,
  }

  it('renders navigation tabs and active tab state', () => {
    render(<Header {...defaultProps} />)
    expect(screen.getByText('Мониторинг')).toBeDefined()
    expect(screen.getByText('Конфигурация')).toBeDefined()
    expect(screen.getByText('Сравнение')).toBeDefined()
    expect(screen.getByText('Аналитика')).toBeDefined()
  })

  it('switches to monitor tab when clicking brand logo', () => {
    const setActiveTab = vi.fn()
    render(<Header {...defaultProps} activeTab="config" setActiveTab={setActiveTab} />)
    const brandButton = screen.getByTitle('Созвездие: ЦУП (перейти к мониторингу)')
    fireEvent.click(brandButton)
    expect(setActiveTab).toHaveBeenCalledWith('monitor')
  })

  it('opens custom preset dropdown on click and displays options', () => {
    render(<Header {...defaultProps} />)

    // Preset dropdown trigger shows current scenario label
    const trigger = screen.getByText(PRESET_SCENARIOS[0].label)
    expect(trigger).toBeDefined()

    // Click trigger to open dropdown
    fireEvent.click(trigger)

    // Dropdown header and items are visible
    expect(screen.getByText('Выберите сценарий')).toBeDefined()
    expect(screen.getByText(PRESET_SCENARIOS[1].label)).toBeDefined()
  })

  it('selects a preset when option is clicked', () => {
    const onSelectPreset = vi.fn()
    render(<Header {...defaultProps} onSelectPreset={onSelectPreset} />)

    // Open dropdown
    const trigger = screen.getByText(PRESET_SCENARIOS[0].label)
    fireEvent.click(trigger)

    // Click second preset
    const option = screen.getByText(PRESET_SCENARIOS[1].label)
    fireEvent.click(option)

    expect(onSelectPreset).toHaveBeenCalledWith(PRESET_SCENARIOS[1].data)
    // Dropdown should close after selection
    expect(screen.queryByText('Выберите сценарий')).toBeNull()
  })

  it('closes dropdown on click outside', () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <Header {...defaultProps} />
      </div>
    )

    const trigger = screen.getByText(PRESET_SCENARIOS[0].label)
    fireEvent.click(trigger)
    expect(screen.getByText('Выберите сценарий')).toBeDefined()

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByText('Выберите сценарий')).toBeNull()
  })

  it('closes dropdown on touch outside or Escape key', () => {
    render(
      <div>
        <div data-testid="touch-outside">Outside</div>
        <Header {...defaultProps} />
      </div>
    )

    const trigger = screen.getByText(PRESET_SCENARIOS[0].label)

    // Touch outside
    fireEvent.click(trigger)
    expect(screen.getByText('Выберите сценарий')).toBeDefined()
    fireEvent.touchStart(screen.getByTestId('touch-outside'))
    expect(screen.queryByText('Выберите сценарий')).toBeNull()

    // Escape key
    fireEvent.click(trigger)
    expect(screen.getByText('Выберите сценарий')).toBeDefined()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Выберите сценарий')).toBeNull()
  })

  it('loads valid custom json scenario on file upload', async () => {
    const onLoadCustomJson = vi.fn()
    const { container } = render(<Header {...defaultProps} onLoadCustomJson={onLoadCustomJson} />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeDefined()

    const validJsonString = JSON.stringify(mockScenario)
    const file = new File([validJsonString], 'custom.json', { type: 'application/json' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await vi.waitFor(() => {
      expect(onLoadCustomJson).toHaveBeenCalledWith(mockScenario)
    })
  })

  it('displays error on invalid custom json file upload', async () => {
    const onLoadCustomJson = vi.fn()
    const { container } = render(<Header {...defaultProps} onLoadCustomJson={onLoadCustomJson} />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const invalidJsonString = JSON.stringify({ invalid: true })
    const file = new File([invalidJsonString], 'bad.json', { type: 'application/json' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await vi.waitFor(() => {
      expect(screen.getByText(/Неподдерживаемая версия схемы/)).toBeDefined()
    })
    expect(onLoadCustomJson).not.toHaveBeenCalled()
  })

  it('renders and handles scenario without meta property', () => {
    const scenarioWithoutMeta = { ...mockScenario }
    delete (scenarioWithoutMeta as any).meta

    render(<Header {...defaultProps} currentScenario={scenarioWithoutMeta as any} />)
    expect(screen.getByText('Пользовательский сценарий')).toBeDefined()
  })
})

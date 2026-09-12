import React, { useRef, useState, useEffect } from 'react'
import {
  Upload,
  RotateCcw,
  ChevronDown,
  Check,
  FileDown,
  Download,
  Activity,
  Sliders,
  GitCompare,
  BarChart3,
} from 'lucide-react'
import type { Scenario, ClientTimeline } from '../../types/scenario'
import { PRESET_SCENARIOS } from '../../data/presets'
import { exportResultFile } from '../../lib/orbit'
import { Button, Badge, SegmentedControl, Logo } from '../ui'
import type { SegmentedOption } from '../ui/SegmentedControl'

interface HeaderProps {
  currentScenario: Scenario
  onSelectPreset: (scenario: Scenario) => void
  onLoadCustomJson: (scenario: Scenario) => void
  onResetScenario: () => void
  timelines: Record<string, ClientTimeline>
  activeTab: 'monitor' | 'config' | 'compare' | 'report'
  setActiveTab: (tab: 'monitor' | 'config' | 'compare' | 'report') => void
  isModified: boolean
}

export const Header: React.FC<HeaderProps> = ({
  currentScenario,
  onSelectPreset,
  onLoadCustomJson,
  onResetScenario,
  timelines,
  activeTab,
  setActiveTab,
  isModified,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const [isPresetOpen, setIsPresetOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)

  // Close dropdowns on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsPresetOpen(false)
      }
      if (exportRef.current && !exportRef.current.contains(target)) {
        setIsExportOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPresetOpen(false)
        setIsExportOpen(false)
      }
    }
    if (isPresetOpen || isExportOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPresetOpen, isExportOpen])

  const [fileError, setFileError] = useState<string | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const parsed = JSON.parse(text)

        // Strict JSON validation against schema
        if (!parsed.meta || parsed.meta.format !== 'cosmo-A-1.0') {
          throw new Error('Некорректный формат: ожидается cosmo-A-1.0')
        }
        if (!parsed.planes || !Array.isArray(parsed.planes) || parsed.planes.length === 0) {
          throw new Error('Отсутствуют орбитальные плоскости (planes)')
        }
        if (!parsed.ground_sites || !Array.isArray(parsed.ground_sites)) {
          throw new Error('Отсутствуют наземные станции (ground_sites)')
        }
        if (!parsed.environment || !parsed.environment.horizon_s) {
          throw new Error('Отсутствуют параметры симуляции (environment)')
        }

        setFileError(null)
        onLoadCustomJson(parsed as Scenario)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Ошибка парсинга JSON файла'
        setFileError(message)
        setTimeout(() => setFileError(null), 5000)
      }
    }
    reader.onerror = () => {
      setFileError('Не удалось прочитать файл')
      setTimeout(() => setFileError(null), 5000)
    }
    reader.readAsText(file)

    // Reset input so re-uploading same file triggers change
    e.target.value = ''
  }

  // Export results adhering to cosmo-A-result-1.0
  const handleExportResult = () => {
    try {
      const resultObj = exportResultFile(currentScenario, timelines)
      const blob = new Blob([JSON.stringify(resultObj, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentScenario.meta.id}_result.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Ошибка экспорта результатов:', err)
      alert('Ошибка формирования файла результатов')
    }
  }

  // Export current raw scenario config (cosmo-A-1.0)
  const handleExportScenario = () => {
    const jsonStr = JSON.stringify(currentScenario, null, 2)
    const blob = new Blob([jsonStr], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentScenario.meta.id}_scenario.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const tabOptions: SegmentedOption<'monitor' | 'config' | 'compare' | 'report'>[] = [
    {
      value: 'monitor',
      title: 'Мониторинг',
      icon: <Activity className="w-3.5 h-3.5 shrink-0" />,
      label: (
        <>
          <span className="hidden md:inline">Мониторинг</span>
          <span className="md:hidden">Монит.</span>
        </>
      ),
    },
    {
      value: 'config',
      title: 'Конфигурация',
      icon: <Sliders className="w-3.5 h-3.5 shrink-0" />,
      label: (
        <>
          <span className="hidden md:inline">Конфигурация</span>
          <span className="md:hidden">Конфиг</span>
        </>
      ),
    },
    {
      value: 'compare',
      title: 'Сравнение',
      icon: <GitCompare className="w-3.5 h-3.5 shrink-0" />,
      label: (
        <>
          <span className="hidden md:inline">Сравнение</span>
          <span className="md:hidden">Сравн.</span>
        </>
      ),
    },
    {
      value: 'report',
      title: 'Аналитика',
      icon: <BarChart3 className="w-3.5 h-3.5 shrink-0" />,
      label: (
        <>
          <span className="hidden md:inline">Аналитика</span>
          <span className="md:hidden">Анализ</span>
        </>
      ),
    },
  ]

  const currentPresetLabel =
    PRESET_SCENARIOS.find((p) => p.data.meta.id === currentScenario.meta.id)?.label ||
    'Пресеты...'

  return (
    <header className="h-11 shrink-0 bg-[#0b1017] border-b border-[#1a2636] px-2 sm:px-3 flex items-center justify-between gap-1 sm:gap-2 select-none relative z-30">
      {/* Navigation Tabs & Brand */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink min-w-0 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('monitor')}
          className="flex items-center gap-1.5 shrink-0 pr-2 border-r border-[#1a2636] hover:opacity-80 transition-opacity text-left cursor-pointer"
          title="Созвездие: ЦУП (перейти к мониторингу)"
        >
          <Logo size={20} className="w-5 h-5 text-cyan-400 shrink-0" />
          <div className="items-center gap-1 text-xs hidden sm:flex">
            <span className="font-bold tracking-wider text-zinc-100 uppercase hidden lg:inline">Созвездие</span>
            <span className="text-zinc-500 font-mono text-[11px] hidden lg:inline">//</span>
            <span className="text-zinc-400 font-medium tracking-wide">ЦУП</span>
          </div>
        </button>

        <SegmentedControl
          options={tabOptions}
          value={activeTab}
          onChange={setActiveTab}
          size="md"
        />

        {isModified && (
          <Badge variant="amber" className="hidden md:inline-flex gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>изменен</span>
          </Badge>
        )}
      </div>

      {/* File error notification */}
      {fileError && (
        <div className="absolute top-12 right-4 z-50 bg-[#180d11] border border-rose-500/40 text-rose-300 text-xs px-3 py-2 rounded-md shadow-xl flex items-center gap-2">
          <span>{fileError}</span>
          <button
            type="button"
            onClick={() => setFileError(null)}
            className="text-rose-400 hover:text-rose-200 cursor-pointer text-sm font-bold ml-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Scenario Input Group */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Preset Selector */}
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsPresetOpen((v) => !v)
                setIsExportOpen(false)
              }}
              className="font-sans min-w-[90px] sm:min-w-[130px] lg:min-w-[180px] max-w-[120px] sm:max-w-[160px] lg:max-w-[220px] justify-between px-2"
            >
              <span className="truncate text-[11px] tabular-nums">{currentPresetLabel}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-150 ml-1 ${
                  isPresetOpen ? 'rotate-180 text-white' : ''
                }`}
              />
            </Button>

            {isPresetOpen && (
              <div className="absolute right-0 top-full mt-1.5 min-w-[200px] w-64 max-w-[calc(100vw-1rem)] bg-[#0b1017] border border-[#1a2636] rounded-md shadow-2xl py-1 z-50 backdrop-blur-md">
                <div className="px-3 py-1.5 text-[11px] font-sans text-zinc-400 font-medium border-b border-[#1a2636] mb-1">
                  Выберите сценарий
                </div>
                {PRESET_SCENARIOS.map((p) => {
                  const isSelected = p.data.meta.id === currentScenario.meta.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onSelectPreset(p.data)
                        setIsPresetOpen(false)
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-sans flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/10 text-cyan-300 font-medium'
                          : 'text-zinc-300 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="truncate text-[11px] tabular-nums">{p.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-2" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Load JSON */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json"
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            title="Загрузить JSON (cosmo-A-1.0)"
          >
            <Upload className="w-3.5 h-3.5" />
          </Button>

          {/* Reset */}
          {isModified && (
            <Button
              type="button"
              variant="danger"
              size="icon"
              onClick={onResetScenario}
              title="Сбросить к исходному"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Subtle Divider */}
        <div className="h-4 w-px bg-[#1a2636]" />

        {/* Unified Export Dropdown */}
        <div className="relative" ref={exportRef}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIsExportOpen((v) => !v)
              setIsPresetOpen(false)
            }}
            className="gap-1 sm:gap-1.5 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-200"
            title="Экспорт файлов"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline text-[11px] font-medium">Экспорт</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-cyan-400/70 shrink-0 transition-transform duration-150 ${
                isExportOpen ? 'rotate-180 text-cyan-200' : ''
              }`}
            />
          </Button>

          {isExportOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-60 bg-[#0b1017] border border-[#1a2636] rounded-md shadow-2xl py-1 z-50 backdrop-blur-md">
              <div className="px-3 py-1.5 text-[11px] font-sans text-zinc-400 font-medium border-b border-[#1a2636] mb-1">
                Экспорт данных
              </div>
              <button
                type="button"
                onClick={() => {
                  handleExportResult()
                  setIsExportOpen(false)
                }}
                className="w-full text-left px-3 py-2 text-xs font-sans flex items-start gap-2.5 transition-colors cursor-pointer text-zinc-200 hover:text-white hover:bg-cyan-500/10"
              >
                <Download className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[12px] font-medium text-cyan-200">Результаты расчета</div>
                  <div className="text-[10px] text-zinc-400">cosmo-A-result-1.0 (.json)</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleExportScenario()
                  setIsExportOpen(false)
                }}
                className="w-full text-left px-3 py-2 text-xs font-sans flex items-start gap-2.5 transition-colors cursor-pointer text-zinc-300 hover:text-white hover:bg-white/[0.04]"
              >
                <FileDown className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[12px] font-medium text-zinc-200">Конфиг сценария</div>
                  <div className="text-[10px] text-zinc-400">cosmo-A-1.0 (.json)</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

import React, { useRef, useState, useEffect } from 'react'
import {
  Upload,
  RotateCcw,
  ChevronDown,
  Check,
  FileDown,
  Download,
} from 'lucide-react'
import type { Scenario, ClientTimeline } from '../../types/scenario'
import { PRESET_SCENARIOS } from '../../data/presets'
import { exportResultFile } from '../../lib/orbit'
import { Button, Badge, SegmentedControl } from '../ui'

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
  const [isPresetOpen, setIsPresetOpen] = useState(false)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPresetOpen(false)
      }
    }
    if (isPresetOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isPresetOpen])

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

  const tabOptions: Array<{
    value: 'monitor' | 'config' | 'compare' | 'report'
    label: React.ReactNode
  }> = [
    { value: 'monitor', label: <span>Мониторинг</span> },
    { value: 'config', label: <span>Конфигурация</span> },
    {
      value: 'compare',
      label: (
        <>
          <span className="hidden lg:inline">A/B Сравнение</span>
          <span className="lg:hidden">A/B</span>
        </>
      ),
    },
    {
      value: 'report',
      label: (
        <>
          <span className="hidden lg:inline">Аналитика & Рекомендации</span>
          <span className="lg:hidden">Аналитика</span>
        </>
      ),
    },
  ]

  const currentPresetLabel =
    PRESET_SCENARIOS.find((p) => p.data.meta.id === currentScenario.meta.id)?.label ||
    'Пресеты...'

  return (
    <header className="h-11 shrink-0 bg-[#0b1017] border-b border-[#1a2636] px-2 sm:px-3 flex items-center justify-between gap-1 sm:gap-2 select-none relative z-30 overflow-x-auto no-scrollbar">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Preset Selector */}
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPresetOpen((v) => !v)}
            className="font-sans min-w-[110px] sm:min-w-[140px] lg:min-w-[180px] max-w-[140px] sm:max-w-[180px] lg:max-w-[220px] justify-between"
          >
            <span className="truncate text-[11px] tabular-nums">{currentPresetLabel}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-150 ${
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

        {/* Export Scenario */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExportScenario}
          title="Экспортировать входной сценарий (cosmo-A-1.0)"
          className="px-1.5 sm:px-2.5"
        >
          <FileDown className="w-3.5 h-3.5 lg:hidden" />
          <span className="hidden lg:inline">Сценарий</span>
        </Button>

        {/* Export Result */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExportResult}
          title="Экспорт cosmo-A-result-1.0"
          className="px-1.5 sm:px-2.5"
        >
          <Download className="w-3.5 h-3.5 lg:hidden" />
          <span className="hidden lg:inline">Результат</span>
        </Button>
      </div>
    </header>
  )
}

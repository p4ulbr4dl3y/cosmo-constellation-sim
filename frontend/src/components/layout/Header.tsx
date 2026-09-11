import React, { useRef, useState, useEffect } from 'react'
import {
  Upload,
  Download,
  FileCode,
  RotateCcw,
  ChevronDown,
  Check,
} from 'lucide-react'
import type { Scenario, ClientTimeline } from '../../types/scenario'
import { PRESET_SCENARIOS } from '../../data/presets'
import { exportResultFile } from '../../lib/orbit'

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string)
        if (!json || typeof json !== 'object' || json.schema_version !== 'cosmo-A-1.0') {
          alert('Ошибка: неподдерживаемая версия схемы. Требуется cosmo-A-1.0')
          return
        }
        if (
          !json.environment ||
          typeof json.environment !== 'object' ||
          !json.design ||
          typeof json.design !== 'object' ||
          !Array.isArray(json.design.planes) ||
          !Array.isArray(json.design.satellites) ||
          !Array.isArray(json.ground_sites) ||
          json.ground_sites.length === 0
        ) {
          alert('Ошибка структуры файла cosmo-A-1.0')
          return
        }
        const normalized: Scenario = {
          ...json,
          failures: Array.isArray(json.failures) ? json.failures : [],
          gateway_outages: Array.isArray(json.gateway_outages) ? json.gateway_outages : [],
        }
        onLoadCustomJson(normalized)
      } catch {
        alert('Некорректный JSON файл')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleExportResult = () => {
    const result = exportResultFile(currentScenario, timelines)
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentScenario.meta.id}_result_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

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

  return (
    <header className="h-11 shrink-0 bg-[#0c1017] border-b border-white/[0.08] px-2 sm:px-3 flex items-center justify-between gap-1 sm:gap-2 select-none relative z-30">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div className="flex items-center bg-white/[0.03] p-0.5 rounded-lg border border-white/[0.08] text-xs font-sans shrink-0">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-2 sm:px-3 py-1 rounded-md transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'monitor'
                ? 'bg-white/12 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Мониторинг</span>
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-2 sm:px-3 py-1 rounded-md transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'config'
                ? 'bg-white/12 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Конфигурация</span>
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`px-2 sm:px-3 py-1 rounded-md transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'compare'
                ? 'bg-white/12 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="hidden sm:inline">A/B Сравнение</span>
            <span className="sm:hidden">A/B</span>
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-2 sm:px-3 py-1 rounded-md transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'report'
                ? 'bg-white/12 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="hidden sm:inline">Аналитика & Рекомендации</span>
            <span className="sm:hidden">Аналитика</span>
          </button>
        </div>

        {isModified && (
          <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="hidden sm:inline">изменен</span>
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Custom Preset Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsPresetOpen(!isPresetOpen)}
            className={`h-7 px-2 sm:px-2.5 bg-white/[0.04] hover:bg-white/[0.08] border ${
              isPresetOpen ? 'border-cyan-500/40 bg-white/[0.08]' : 'border-white/[0.08]'
            } text-xs text-slate-200 font-mono rounded-md flex items-center justify-between gap-1.5 transition-colors cursor-pointer max-w-[130px] sm:max-w-[180px] md:max-w-[220px]`}
          >
            <span className="truncate text-[11px]">
              {PRESET_SCENARIOS.find((p) => p.data.meta.id === currentScenario.meta.id)?.label || 'Пресеты...'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
                isPresetOpen ? 'rotate-180 text-white' : ''
              }`}
            />
          </button>

          {isPresetOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-64 bg-[#0c1017] border border-white/15 rounded-lg shadow-2xl py-1 z-50 backdrop-blur-md">
              <div className="px-2.5 py-1 text-[10px] font-mono text-slate-500 uppercase tracking-wider border-b border-white/[0.06] mb-1">
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
                    className={`w-full text-left px-2.5 py-1.5 text-xs font-mono flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-white/[0.08] text-white font-medium'
                        : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isSelected ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]' : 'bg-transparent'
                        }`}
                      />
                      <span className="truncate text-[11px]">{p.label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
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
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Загрузить JSON (cosmo-A-1.0)"
          className="h-7 w-7 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>

        {/* Reset */}
        {isModified && (
          <button
            onClick={onResetScenario}
            title="Сбросить к исходному"
            className="h-7 w-7 rounded-md bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Export Scenario */}
        <button
          onClick={handleExportScenario}
          title="Экспортировать входной сценарий (cosmo-A-1.0)"
          className="h-7 w-7 xl:w-auto px-0 xl:px-2.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-sans flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <FileCode className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden xl:inline">Сценарий</span>
        </button>

        {/* Export Result */}
        <button
          onClick={handleExportResult}
          title="Экспорт cosmo-A-result-1.0"
          className="h-7 w-7 xl:w-auto px-0 xl:px-2.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-200 text-xs font-sans font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-sky-300" />
          <span className="hidden xl:inline">Результат</span>
        </button>
      </div>
    </header>
  )
}

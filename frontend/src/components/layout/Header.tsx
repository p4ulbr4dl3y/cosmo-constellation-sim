import React, { useRef } from 'react'
import {
  Upload,
  Download,
  FileCode,
  RotateCcw,
  ChevronDown,
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
  isBackendOnline?: boolean
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
  isBackendOnline = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    <header className="h-11 shrink-0 bg-[#0c1017] border-b border-white/[0.08] px-2 sm:px-3 flex items-center justify-between gap-1 sm:gap-2 select-none overflow-x-auto scrollbar-none">
      {/* Brand */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <span className="text-xs font-bold tracking-wider text-slate-200 uppercase font-sans">
          <span className="hidden sm:inline">Космохакатон</span>
          <span className="sm:hidden text-sky-400">COSMO</span>
        </span>
        <span className="text-[10px] text-slate-500 font-mono hidden md:inline">
          // LEO Sim
        </span>
        {isModified && (
          <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="hidden sm:inline">изменен</span>
          </span>
        )}
        <span
          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border hidden lg:inline-flex items-center gap-1 ml-0.5 ${
            isBackendOnline
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-white/5 border-white/10 text-slate-400'
          }`}
          title={
            isBackendOnline
              ? 'FastAPI бэкенд подключен (/api/v1)'
              : 'Автономный режим (TypeScript Web Engine)'
          }
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isBackendOnline ? 'bg-emerald-400' : 'bg-slate-400'
            }`}
          />
          {isBackendOnline ? 'API онлайн' : 'Автономный TS'}
        </span>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center bg-white/[0.03] p-0.5 rounded-lg border border-white/[0.08] text-xs font-sans shrink-0">
        <button
          onClick={() => setActiveTab('monitor')}
          className={`px-2 sm:px-3 py-1 rounded-md transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === 'monitor'
              ? 'bg-white/12 text-white font-medium shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="hidden sm:inline">Мониторинг</span>
          <span className="sm:hidden">Обзор</span>
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-2 sm:px-3 py-1 rounded-md transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === 'config'
              ? 'bg-white/12 text-white font-medium shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="hidden sm:inline">Конфигурация</span>
          <span className="sm:hidden">Конфиг</span>
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
          <span className="hidden lg:inline">Аналитика & Рекомендации</span>
          <span className="lg:hidden">Аналитика</span>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Preset dropdown */}
        <div className="relative">
          <select
            value={
              PRESET_SCENARIOS.find((p) => p.data.meta.id === currentScenario.meta.id)?.id || ''
            }
            onChange={(e) => {
              const preset = PRESET_SCENARIOS.find((p) => p.id === e.target.value)
              if (preset) onSelectPreset(preset.data)
            }}
            className="h-7 pl-2 pr-6 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-slate-200 font-sans rounded-md appearance-none focus:outline-none focus:border-white/30 transition-colors cursor-pointer max-w-[85px] xs:max-w-[120px] sm:max-w-[160px] md:max-w-[200px] truncate"
          >
            <option value="" disabled className="bg-[#0c1017] text-slate-400">
              Пресеты...
            </option>
            {PRESET_SCENARIOS.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#0c1017] text-slate-200">
                {p.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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

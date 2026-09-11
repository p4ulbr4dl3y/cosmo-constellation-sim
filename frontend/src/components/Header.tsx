import React, { useRef } from 'react'
import {
  Upload,
  Download,
  FileCode,
  RotateCcw,
  ChevronDown,
} from 'lucide-react'
import type { Scenario, ClientTimeline } from '../types/scenario'
import { PRESET_SCENARIOS } from '../data/presets'
import { exportResultFile } from '../lib/orbit'

interface HeaderProps {
  currentScenario: Scenario
  onSelectPreset: (scenario: Scenario) => void
  onLoadCustomJson: (scenario: Scenario) => void
  onResetScenario: () => void
  timelines: Record<string, ClientTimeline>
  activeTab: 'monitor' | 'config' | 'compare'
  setActiveTab: (tab: 'monitor' | 'config' | 'compare') => void
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
        onLoadCustomJson(json as Scenario)
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
    <header className="h-11 shrink-0 bg-[#0c1017] border-b border-white/10 px-3 flex items-center justify-between gap-2 select-none">
      {/* Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-bold tracking-wider text-slate-200 uppercase font-mono">
          КОСМОХАКАТОН
        </span>
        {isModified && (
          <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            изменен
          </span>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center bg-black/60 p-0.5 rounded-lg border border-white/10 text-xs font-mono">
        <button
          onClick={() => setActiveTab('monitor')}
          className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
            activeTab === 'monitor'
              ? 'bg-white/15 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Мониторинг
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
            activeTab === 'config'
              ? 'bg-white/15 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Конфигурация
        </button>
        <button
          onClick={() => setActiveTab('compare')}
          className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
            activeTab === 'compare'
              ? 'bg-white/15 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          A/B Сравнение
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
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
            className="h-7 pl-2.5 pr-7 bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 font-mono rounded-md appearance-none focus:outline-none focus:border-white/30 transition-colors cursor-pointer"
          >
            <option value="" disabled className="bg-[#0c1017] text-slate-400">
              Выбрать пресет...
            </option>
            {PRESET_SCENARIOS.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#0c1017] text-slate-200">
                {p.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
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
          className="h-7 w-7 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>

        {/* Reset */}
        {isModified && (
          <button
            onClick={onResetScenario}
            title="Сбросить к исходному"
            className="h-7 w-7 rounded-md bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 hover:text-rose-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Export Scenario */}
        <button
          onClick={handleExportScenario}
          title="Экспортировать входной сценарий (cosmo-A-1.0)"
          className="h-7 px-2.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <FileCode className="w-3.5 h-3.5 text-slate-400" />
          <span>Сценарий</span>
        </button>

        {/* Export Result */}
        <button
          onClick={handleExportResult}
          title="Экспорт cosmo-A-result-1.0"
          className="h-7 px-2.5 rounded-md bg-white/15 hover:bg-white/20 border border-white/20 text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-slate-200" />
          <span>Результат</span>
        </button>
      </div>
    </header>
  )
}

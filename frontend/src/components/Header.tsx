import React, { useRef } from 'react'
import {
  Radio,
  Upload,
  Download,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
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
          alert('Ошибка: поврежденный файл сценария. Отсутствуют обязательные разделы (environment, design.planes, design.satellites, ground_sites).')
          return
        }
        onLoadCustomJson(json)
      } catch (err) {
        alert('Ошибка при чтении файла JSON: ' + (err as Error).message)
      }
    }
    reader.readAsText(file)
    // reset input
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
    const blob = new Blob([JSON.stringify(currentScenario, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentScenario.meta.id}_scenario.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Calculate overall target compliance
  const clientTimelines = Object.values(timelines)
  const allMeetTarget =
    clientTimelines.length > 0 &&
    clientTimelines.every(
      (tl) => tl.metrics.availability_ratio >= currentScenario.environment.target_availability
    )

  return (
    <header className="bg-[#0b101b] border-b border-[#1f293d] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 via-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/40">
          <Radio className="w-4 h-4 text-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-widest text-cyan-400 uppercase">
              КосмоХакатон 2026
            </span>
            <span className="text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 px-1.5 py-0.5 rounded font-mono">
              cosmo-A-1.0
            </span>
            {isModified && (
              <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-700/60 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Модифицирован
              </span>
            )}
          </div>
          <h1 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>Проектирование устойчивой спутниковой группировки</span>
          </h1>
        </div>
      </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-[#070b14] p-0.5 rounded-lg border border-[#172236]">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all flex items-center gap-2 ${
              activeTab === 'monitor'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'monitor' ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
            <span>01 // МОНИТОРИНГ</span>
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all flex items-center gap-2 ${
              activeTab === 'config'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'config' ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
            <span>02 // КОНФИГУРАЦИЯ</span>
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-all flex items-center gap-2 ${
              activeTab === 'compare'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'compare' ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
            <span>03 // A/B СРАВНЕНИЕ</span>
          </button>
        </div>

      {/* Preset Selector & File Actions */}
      <div className="flex items-center gap-2">
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
            className="bg-[#121a2c] hover:bg-[#18233a] border border-[#253552] text-xs text-slate-200 font-medium py-1.5 px-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all cursor-pointer"
          >
            <option value="" disabled>
              Выбрать пресет...
            </option>
            {PRESET_SCENARIOS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
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
          title="Загрузить пользовательский сценарий JSON (cosmo-A-1.0)"
          className="p-1.5 rounded-lg bg-[#121a2c] hover:bg-[#18233a] border border-[#253552] text-slate-300 hover:text-cyan-300 transition-colors"
        >
          <Upload className="w-4 h-4" />
        </button>

        {/* Reset */}
        {isModified && (
          <button
            onClick={onResetScenario}
            title="Сбросить к исходному сценарию"
            className="p-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-700/60 text-amber-300 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}

        {/* Export Scenario */}
        <button
          onClick={handleExportScenario}
          title="Экспортировать измененный сценарий (cosmo-A-1.0)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#121a2c] hover:bg-[#18233a] border border-[#253552] text-xs text-slate-300 hover:text-cyan-300 transition-colors font-medium"
        >
          <FileCode className="w-3.5 h-3.5 text-cyan-400" />
          <span>Сценарий</span>
        </button>

        {/* Export Result cosmo-A-result-1.0 */}
        <button
          onClick={handleExportResult}
          title="Экспортировать результат расчёта (cosmo-A-result-1.0)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/90 hover:bg-cyan-500 text-xs text-white font-semibold shadow-lg shadow-cyan-600/30 transition-all cursor-pointer ring-1 ring-cyan-400/50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Результат</span>
          <span className="text-[10px] bg-cyan-800/80 px-1 rounded">result-1.0</span>
        </button>

        {/* Target SLA compliance badge */}
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono border ${
            allMeetTarget
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
              : 'bg-amber-950/60 text-amber-300 border-amber-700/60'
          }`}
          title={
            allMeetTarget
              ? 'Все клиенты удовлетворяют целевой доступности >= 90%'
              : 'Некоторые клиенты не достигают 90% доступности'
          }
        >
          {allMeetTarget ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>SLA ≥90% OK</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>SLA &lt;90%</span>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

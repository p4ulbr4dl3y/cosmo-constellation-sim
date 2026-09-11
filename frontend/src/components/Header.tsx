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
import { Button, Badge } from './ui'

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
          alert('Ошибка: поврежденный файл сценария. Отсутствуют обязательные разделы.')
          return
        }
        onLoadCustomJson(json)
      } catch (err) {
        alert('Ошибка при чтении файла JSON: ' + (err as Error).message)
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

  const targetPct = Math.round((currentScenario.environment.target_availability ?? 0.9) * 100)

  return (
    <header className="bg-[#0c1017] border-b border-[#182232] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#121824] border border-[#1e293b] flex items-center justify-center">
          <Radio className="w-4 h-4 text-[#c4f042] animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-widest text-[#c4f042] uppercase font-mono">
              КОСМОХАКАТОН 2026
            </span>
            <Badge variant="neutral">cosmo-A-1.0</Badge>
            {isModified && (
              <Badge variant="amber" className="flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Модифицирован
              </Badge>
            )}
          </div>
          <h1 className="text-xs font-semibold text-slate-300">
            Орбитальное проектирование &amp; сетевая доступность Арктики
          </h1>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center bg-[#07090e] p-1 rounded-xl border border-[#182232]">
        <button
          onClick={() => setActiveTab('monitor')}
          className={`px-3 py-1.5 text-xs font-mono font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'monitor'
              ? 'bg-[#c4f042]/10 text-[#c4f042] border border-[#c4f042]/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              activeTab === 'monitor' ? 'bg-[#c4f042] animate-pulse' : 'bg-slate-600'
            }`}
          />
          <span>01 // МОНИТОРИНГ</span>
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-3 py-1.5 text-xs font-mono font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'config'
              ? 'bg-[#c4f042]/10 text-[#c4f042] border border-[#c4f042]/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              activeTab === 'config' ? 'bg-[#c4f042] animate-pulse' : 'bg-slate-600'
            }`}
          />
          <span>02 // КОНФИГУРАЦИЯ</span>
        </button>
        <button
          onClick={() => setActiveTab('compare')}
          className={`px-3 py-1.5 text-xs font-mono font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'compare'
              ? 'bg-[#c4f042]/10 text-[#c4f042] border border-[#c4f042]/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              activeTab === 'compare' ? 'bg-[#c4f042] animate-pulse' : 'bg-slate-600'
            }`}
          />
          <span>03 // A/B СРАВНЕНИЕ</span>
        </button>
      </div>

      {/* Preset Selector & File Actions */}
      <div className="flex items-center gap-2">
        {/* Preset dropdown */}
        <select
          value={
            PRESET_SCENARIOS.find((p) => p.data.meta.id === currentScenario.meta.id)?.id || ''
          }
          onChange={(e) => {
            const preset = PRESET_SCENARIOS.find((p) => p.id === e.target.value)
            if (preset) onSelectPreset(preset.data)
          }}
          className="bg-[#0c1017] hover:bg-[#121824] border border-[#182232] text-xs text-slate-200 font-mono py-1.5 px-2.5 rounded-lg focus:outline-none focus:border-[#c4f042] transition-colors cursor-pointer"
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

        {/* Load JSON */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".json"
          className="hidden"
        />
        <Button
          size="icon"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          title="Загрузить пользовательский сценарий JSON (cosmo-A-1.0)"
        >
          <Upload className="w-3.5 h-3.5 text-slate-300 hover:text-[#c4f042]" />
        </Button>

        {/* Reset */}
        {isModified && (
          <Button
            size="icon"
            variant="danger"
            onClick={onResetScenario}
            title="Сбросить к исходному сценарию"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        )}

        {/* Export Scenario */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleExportScenario}
          title="Экспортировать сценарий (cosmo-A-1.0)"
        >
          <FileCode className="w-3.5 h-3.5 text-[#c4f042]" />
          <span>Сценарий</span>
        </Button>

        {/* Export Result cosmo-A-result-1.0 */}
        <Button
          size="sm"
          variant="primary"
          onClick={handleExportResult}
          title="Экспортировать результат расчёта (cosmo-A-result-1.0)"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Результат</span>
          <span className="text-[9px] bg-black/20 px-1 py-0.2 rounded font-mono">1.0</span>
        </Button>

        {/* Target SLA compliance badge */}
        <Badge
          variant={allMeetTarget ? 'lime' : 'amber'}
          className="py-1 px-2 text-[11px]"
        >
          {allMeetTarget ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#c4f042]" />
              <span>SLA ≥{targetPct}% OK</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>SLA &lt;{targetPct}%</span>
            </>
          )}
        </Badge>
      </div>
    </header>
  )
}

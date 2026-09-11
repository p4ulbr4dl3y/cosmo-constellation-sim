import React, { useState } from 'react'
import {
  Sliders,
  Rocket,
  Globe,
  Radio,
  Trash2,
  Plus,
  ZapOff,
  RotateCcw,
  AlertOctagon,
} from 'lucide-react'
import type { Scenario, Failure, GatewayOutage } from '../types/scenario'
import { Card, CardHeader, CardTitle, Button, Badge } from './ui'

interface ConfigEditorProps {
  scenario: Scenario
  onUpdateScenario: (updated: Scenario) => void
  onResetScenario: () => void
  activeRouteSats: string[]
  currentTime: number
}

function secondsToHHMM(totalSec: number): string {
  const clamped = Math.max(0, Math.min(86400, totalSec))
  const h = Math.floor(clamped / 3600)
  const m = Math.floor((clamped % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function hhmmToSeconds(hhmm: string): number {
  const parts = hhmm.split(':')
  if (parts.length < 2) return 0
  const h = parseInt(parts[0], 10) || 0
  const m = parseInt(parts[1], 10) || 0
  return Math.min(86400, Math.max(0, h * 3600 + m * 60))
}

function formatDurationHuman(sec: number): string {
  const totalMinutes = Math.round(sec / 60)
  if (totalMinutes < 60) return `${totalMinutes} мин`
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`
}

export const ConfigEditor: React.FC<ConfigEditorProps> = ({
  scenario,
  onUpdateScenario,
  onResetScenario,
  activeRouteSats,
  currentTime,
}) => {
  const [draft, setDraft] = useState<Scenario>(() => JSON.parse(JSON.stringify(scenario)))
  const [prevScenario, setPrevScenario] = useState(scenario)
  if (scenario !== prevScenario) {
    setPrevScenario(scenario)
    setDraft(JSON.parse(JSON.stringify(scenario)))
  }

  // New failure form inputs (in seconds)
  const [newFailSat, setNewFailSat] = useState<string>(draft.design.satellites[0]?.id || 'S01')
  const [newFailStart, setNewFailStart] = useState<number>(21600) // 06:00
  const [newFailEnd, setNewFailEnd] = useState<number>(43200) // 12:00

  // New gateway outage form inputs (in seconds)
  const [newGwStart, setNewGwStart] = useState<number>(10800) // 03:00
  const [newGwEnd, setNewGwEnd] = useState<number>(21600) // 06:00

  const handleLaunchStageChange = (stage: number) => {
    const next = { ...draft, design: { ...draft.design, launch_stage: stage } }
    setDraft(next)
    onUpdateScenario(next)
  }

  const handlePlaneChange = (planeId: string, field: 'raan_deg' | 'phase_deg', value: number) => {
    const nextPlanes = draft.design.planes.map((p) => {
      if (p.id === planeId) {
        return { ...p, [field]: ((value % 360) + 360) % 360 }
      }
      return p
    })
    const next = { ...draft, design: { ...draft.design, planes: nextPlanes } }
    setDraft(next)
    onUpdateScenario(next)
  }

  const handleEnvChange = (field: 'isl_range_km' | 'min_elevation_deg' | 'altitude_km', value: number) => {
    const next = {
      ...draft,
      environment: {
        ...draft.environment,
        [field]: value,
      },
    }
    setDraft(next)
    onUpdateScenario(next)
  }

  // 1-Click disable satellite on active route
  const handleKillActiveRouteSat = () => {
    if (activeRouteSats.length === 0) {
      alert('В данный момент нет активных спутников на выбранном маршруте.')
      return
    }
    const targetSat = activeRouteSats[0]
    const start_s = Math.max(0, currentTime - 60)
    const end_s = Math.min(draft.environment.horizon_s, currentTime + 14400) // 4 hours outage

    const nextFailures: Failure[] = [
      ...draft.failures,
      { satellite_id: targetSat, start_s, end_s },
    ]
    const next = { ...draft, failures: nextFailures }
    setDraft(next)
    onUpdateScenario(next)
  }

  const handleAddFailure = () => {
    if (newFailStart >= newFailEnd) {
      alert('Время начала отказа должно быть меньше времени окончания.')
      return
    }
    const nextFailures: Failure[] = [
      ...draft.failures,
      { satellite_id: newFailSat, start_s: newFailStart, end_s: newFailEnd },
    ]
    const next = { ...draft, failures: nextFailures }
    setDraft(next)
    onUpdateScenario(next)
  }

  const handleRemoveFailure = (idx: number) => {
    const nextFailures = draft.failures.filter((_, i) => i !== idx)
    const next = { ...draft, failures: nextFailures }
    setDraft(next)
    onUpdateScenario(next)
  }

  const handleAddGatewayOutage = () => {
    if (newGwStart >= newGwEnd) {
      alert('Время начала отказа должно быть меньше времени окончания.')
      return
    }
    const gw = draft.ground_sites.find((g) => g.role === 'gateway')
    if (!gw) return

    const nextOutages: GatewayOutage[] = [
      ...draft.gateway_outages,
      { gateway_id: gw.id, start_s: newGwStart, end_s: newGwEnd },
    ]
    const next = { ...draft, gateway_outages: nextOutages }
    setDraft(next)
    onUpdateScenario(next)
  }

  const handleRemoveGatewayOutage = (idx: number) => {
    const nextOutages = draft.gateway_outages.filter((_, i) => i !== idx)
    const next = { ...draft, gateway_outages: nextOutages }
    setDraft(next)
    onUpdateScenario(next)
  }

  return (
    <Card noPadding className="p-3.5 flex flex-col gap-3 max-w-5xl mx-auto">
      {/* Header */}
      <CardHeader className="pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-cyan-400">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div>
            <CardTitle>
              Конфигурация группировки
            </CardTitle>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Настройка этапов развертывания, орбитальных плоскостей, дальности ISL и окон отказов
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={onResetScenario}
          className="gap-1.5"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Сброс</span>
        </Button>
      </CardHeader>

      {/* Compact Stress-test quick injection bar */}
      <div className="bg-[#080b11] px-3 py-2 rounded-xl border border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <AlertOctagon className="w-4 h-4 text-amber-400/80 shrink-0" />
          <span className="text-slate-200 font-medium">
            Стресс-тест связи:
          </span>
          <span className="text-slate-400 text-[11px]">
            ввод 4-часового отказа первого КА на текущем маршруте
          </span>
        </div>
        <Button
          size="sm"
          variant="danger"
          onClick={handleKillActiveRouteSat}
          disabled={activeRouteSats.length === 0}
          className="text-xs font-medium gap-1.5 h-7 px-2.5"
        >
          <ZapOff className="w-3 h-3" />
          <span>Отключить {activeRouteSats[0] || 'нет КА'}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Launch Stage & Environment */}
        <div className="bg-[#080b11] p-3 rounded-xl border border-white/10 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
            <Rocket className="w-3.5 h-3.5" />
            <span>Очередь развертывания</span>
          </div>

          {/* Stage buttons */}
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((stg) => {
              const activeSatsCount = stg * 16
              const isSelected = draft.design.launch_stage === stg
              return (
                <button
                  key={stg}
                  onClick={() => handleLaunchStageChange(stg)}
                  className={`py-2 px-2 rounded-lg border text-xs font-mono font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white/15 border-white/30 text-white shadow-xs'
                      : 'bg-[#0c1017] border-white/10 text-slate-300 hover:border-white/20'
                  }`}
                >
                  <span>Этап {stg}</span>
                  <span className={`text-[10px] font-normal ${isSelected ? 'text-slate-200' : 'text-slate-400'}`}>
                    {activeSatsCount} КА
                  </span>
                </button>
              )
            })}
          </div>

          <div className="h-px bg-white/10 my-1" />

          {/* Environment Parameters */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 font-mono">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Параметры окружения и связи</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <label className="text-slate-400 text-[11px] block mb-1">
                Предельная дальность ISL:
              </label>
              <div className="flex gap-2">
                {[2000, 3000].map((val) => (
                  <button
                    key={val}
                    onClick={() => handleEnvChange('isl_range_km', val)}
                    className={`flex-1 py-1.5 px-2 rounded-lg font-mono text-xs font-bold border transition-colors cursor-pointer ${
                      draft.environment.isl_range_km === val
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                        : 'bg-[#0c1017] border-white/10 text-slate-300 hover:bg-[#121824]'
                    }`}
                  >
                    {val} км
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-slate-400 text-[11px] block mb-1">
                Мин. угол возвышения (°):
              </label>
              <input
                type="number"
                min="0"
                max="45"
                step="1"
                value={draft.environment.min_elevation_deg}
                onChange={(e) => handleEnvChange('min_elevation_deg', Number(e.target.value))}
                className="w-full bg-[#0c1017] border border-white/10 rounded-lg py-1.5 px-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>
        </div>

        {/* Plane Orientation & RAAN / Phase Shift */}
        <div className="bg-[#080b11] p-3.5 rounded-xl border border-white/10 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">
            <Radio className="w-4 h-4" />
            <span>Орбитальные плоскости (RAAN и фазовый сдвиг)</span>
          </div>

          <div className="flex flex-col gap-2.5">
            {draft.design.planes.map((p) => (
              <div
                key={p.id}
                className="bg-[#0c1017] p-2.5 rounded-lg border border-white/10 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-cyan-400">
                    Плоскость {p.id}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">16 аппаратов</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                  <div>
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span>RAAN (Ω):</span>
                      <span className="px-1.5 py-0.2 rounded bg-white/10 text-cyan-300 font-bold text-xs">
                        {p.raan_deg.toFixed(1)}°
                      </span>
                    </div>
                    <div className="relative flex flex-col">
                      <input
                        type="range"
                        min="0"
                        max="359"
                        step="1"
                        value={p.raan_deg}
                        onChange={(e) => handlePlaneChange(p.id, 'raan_deg', Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                      />
                      <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                        <span>0°</span>
                        <span>180°</span>
                        <span>360°</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span>Фазовый сдвиг:</span>
                      <span className="px-1.5 py-0.2 rounded bg-white/10 text-cyan-300 font-bold text-xs">
                        {p.phase_deg.toFixed(1)}°
                      </span>
                    </div>
                    <div className="relative flex flex-col">
                      <input
                        type="range"
                        min="0"
                        max="359"
                        step="0.5"
                        value={p.phase_deg}
                        onChange={(e) => handlePlaneChange(p.id, 'phase_deg', Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                      />
                      <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                        <span>0°</span>
                        <span>180°</span>
                        <span>360°</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Failures & Gateway Outages Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Satellite Outages */}
        <div className="bg-[#080b11] p-3.5 rounded-xl border border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <ZapOff className="w-3.5 h-3.5 text-red-400" />
              Отказы спутников ({draft.failures.length})
            </span>
          </div>

          {/* Add failure row with human-friendly time inputs */}
          <div className="flex flex-wrap items-center gap-2 bg-[#0c1017] p-2 rounded-lg border border-white/10 text-xs">
            <select
              value={newFailSat}
              onChange={(e) => setNewFailSat(e.target.value)}
              className="bg-[#080b11] border border-white/10 text-slate-200 py-1 px-1.5 rounded font-mono text-xs focus:outline-none focus:border-cyan-500/50"
            >
              {draft.design.satellites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} ({s.plane_id})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="text-slate-400">С:</span>
              <input
                type="time"
                value={secondsToHHMM(newFailStart)}
                onChange={(e) => setNewFailStart(hhmmToSeconds(e.target.value))}
                className="bg-[#080b11] border border-white/10 px-1.5 py-0.5 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500/50"
              />
              <span className="text-slate-400">До:</span>
              <input
                type="time"
                value={secondsToHHMM(newFailEnd)}
                onChange={(e) => setNewFailEnd(hhmmToSeconds(e.target.value))}
                className="bg-[#080b11] border border-white/10 px-1.5 py-0.5 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <Button
              size="sm"
              variant="danger"
              onClick={handleAddFailure}
              className="ml-auto"
            >
              <Plus className="w-3 h-3" />
              <span>Добавить</span>
            </Button>
          </div>

          {/* Failures list */}
          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
            {draft.failures.length === 0 ? (
              <span className="text-xs text-slate-400 font-mono italic p-2">
                Нет активных периодов отказов
              </span>
            ) : (
              draft.failures.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-[#0c1017] p-2 rounded-lg border border-white/10 text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-400">{f.satellite_id}</span>
                    <span className="text-slate-300 text-[11px]">
                      {secondsToHHMM(f.start_s)} — {secondsToHHMM(f.end_s)}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      ({formatDurationHuman(f.end_s - f.start_s)})
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveFailure(idx)}
                    className="text-slate-400 hover:text-red-400 p-1 cursor-pointer"
                    title="Удалить окно отказа"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Gateway Outages */}
        <div className="bg-[#080b11] p-3.5 rounded-xl border border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              Недоступность шлюза Мурманск ({draft.gateway_outages.length})
            </span>
          </div>

          {/* Add gateway outage row with human-friendly time inputs */}
          <div className="flex flex-wrap items-center gap-2 bg-[#0c1017] p-2 rounded-lg border border-white/10 text-xs">
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="text-slate-400">С:</span>
              <input
                type="time"
                value={secondsToHHMM(newGwStart)}
                onChange={(e) => setNewGwStart(hhmmToSeconds(e.target.value))}
                className="bg-[#080b11] border border-white/10 px-1.5 py-0.5 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500/50"
              />
              <span className="text-slate-400">До:</span>
              <input
                type="time"
                value={secondsToHHMM(newGwEnd)}
                onChange={(e) => setNewGwEnd(hhmmToSeconds(e.target.value))}
                className="bg-[#080b11] border border-white/10 px-1.5 py-0.5 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleAddGatewayOutage}
              className="ml-auto"
            >
              <Plus className="w-3 h-3" />
              <span>Добавить</span>
            </Button>
          </div>

          {/* Outages list */}
          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
            {draft.gateway_outages.length === 0 ? (
              <span className="text-xs text-slate-400 font-mono italic p-2">
                Шлюз работает без запланированных остановок
              </span>
            ) : (
              draft.gateway_outages.map((o, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-[#0c1017] p-2 rounded-lg border border-white/10 text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">{o.gateway_id}</Badge>
                    <span className="text-slate-300 text-[11px]">
                      {secondsToHHMM(o.start_s)} — {secondsToHHMM(o.end_s)}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      ({formatDurationHuman(o.end_s - o.start_s)})
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveGatewayOutage(idx)}
                    className="text-slate-400 hover:text-red-400 p-1 cursor-pointer"
                    title="Удалить окно недоступности"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

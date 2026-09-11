import React, { useState, useMemo } from 'react'
import {
  Trash2,
  Plus,
  ZapOff,
  RotateCcw,
  ChevronDown,
} from 'lucide-react'
import type { Scenario, Failure, GatewayOutage, GroundSite } from '../../types/scenario'

interface ConfigEditorProps {
  scenario: Scenario
  onUpdateScenario: (updated: Scenario) => void
  onResetScenario: () => void
  activeRouteSats: string[]
  currentTime: number
}

function secondsToTimeInputValue(totalSec: number): string {
  const clamped = Math.max(0, Math.min(86400, totalSec))
  if (clamped >= 86400) return '23:59'
  const h = Math.floor(clamped / 3600)
  const m = Math.floor((clamped % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function secondsToHHMM(totalSec: number): string {
  if (totalSec >= 86400) return '24:00'
  const clamped = Math.max(0, totalSec)
  const h = Math.floor(clamped / 3600)
  const m = Math.floor((clamped % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function hhmmToSeconds(hhmm: string): number {
  const parts = hhmm.split(':')
  if (parts.length < 2) return 0
  const h = parseInt(parts[0], 10) || 0
  const m = parseInt(parts[1], 10) || 0
  if (h === 23 && m === 59) return 86400
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
  const normalizeDraft = (sc: Scenario): Scenario => ({
    ...sc,
    failures: Array.isArray(sc.failures) ? sc.failures : [],
    gateway_outages: Array.isArray(sc.gateway_outages) ? sc.gateway_outages : [],
  })

  const [draft, setDraft] = useState<Scenario>(() => normalizeDraft(JSON.parse(JSON.stringify(scenario))))
  const [prevScenario, setPrevScenario] = useState(scenario)
  if (scenario !== prevScenario) {
    setPrevScenario(scenario)
    setDraft(normalizeDraft(JSON.parse(JSON.stringify(scenario))))
  }

  // New failure form inputs (in seconds)
  const [newFailSat, setNewFailSat] = useState<string>(draft.design.satellites[0]?.id || 'S01')
  const [newFailStart, setNewFailStart] = useState<number>(21600) // 06:00
  const [newFailEnd, setNewFailEnd] = useState<number>(43200) // 12:00

  const gateways = useMemo<GroundSite[]>(
    () => draft.ground_sites.filter((g: GroundSite) => g.role === 'gateway'),
    [draft.ground_sites]
  )
  const [newGwId, setNewGwId] = useState<string>(gateways[0]?.id || 'G_MUR')

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
    if (activeRouteSats.length === 0) return
    const targetSat = activeRouteSats[0]
    const start_s = Math.max(0, currentTime - 60)
    const end_s = Math.min(draft.environment.horizon_s, currentTime + 14400) // 4 hours

    const nextFailures: Failure[] = [
      ...(draft.failures ?? []),
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
    const targetSat = draft.design.satellites.some((s) => s.id === newFailSat)
      ? newFailSat
      : draft.design.satellites[0]?.id
    if (!targetSat) return

    const nextFailures: Failure[] = [
      ...(draft.failures ?? []),
      { satellite_id: targetSat, start_s: newFailStart, end_s: newFailEnd },
    ]
    const next = { ...draft, failures: nextFailures }
    setDraft(next)
    onUpdateScenario(next)
  }

  const handleRemoveFailure = (idx: number) => {
    const nextFailures = (draft.failures ?? []).filter((_, i) => i !== idx)
    const next = { ...draft, failures: nextFailures }
    setDraft(next)
    onUpdateScenario(next)
  }

  const handleAddGatewayOutage = () => {
    if (newGwStart >= newGwEnd) {
      alert('Время начала отказа должно быть меньше времени окончания.')
      return
    }
    const targetGwId = gateways.some((g) => g.id === newGwId) ? newGwId : gateways[0]?.id
    if (!targetGwId) return

    const nextOutages: GatewayOutage[] = [
      ...(draft.gateway_outages ?? []),
      { gateway_id: targetGwId, start_s: newGwStart, end_s: newGwEnd },
    ]
    const next = { ...draft, gateway_outages: nextOutages }
    setDraft(next)
    onUpdateScenario(next)
  }

  const handleRemoveGatewayOutage = (idx: number) => {
    const nextOutages = (draft.gateway_outages ?? []).filter((_, i) => i !== idx)
    const next = { ...draft, gateway_outages: nextOutages }
    setDraft(next)
    onUpdateScenario(next)
  }

  return (
    <div className="h-full flex flex-col gap-2 font-mono text-xs overflow-y-auto max-w-[1500px] mx-auto w-full">
      {/* Top Action Bar */}
      <div className="bg-[#0c1017] px-3 py-2 rounded-xl border border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-200 uppercase tracking-wider">
            КОНФИГУРАЦИЯ СИМУЛЯЦИИ
          </span>
          <span className="text-[10px] text-slate-400">
            (этапы развертывания, ISL, плоскости, отказы)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Stress test */}
          <button
            onClick={handleKillActiveRouteSat}
            disabled={activeRouteSats.length === 0}
            className={`h-7 px-2.5 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
              activeRouteSats.length > 0
                ? 'bg-white/5 hover:bg-rose-950/40 border-white/10 hover:border-rose-800/50 text-slate-300 hover:text-rose-300'
                : 'bg-white/5 border-white/5 text-slate-600 cursor-not-allowed'
            }`}
          >
            <ZapOff className="w-3.5 h-3.5" />
            <span>Отказ {activeRouteSats[0] || 'нет КА'} (4ч)</span>
          </button>

          {/* Reset */}
          <button
            onClick={onResetScenario}
            className="h-7 px-2.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сброс</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 flex-1 min-h-0">
        {/* Left: Constellation Geometry & Planes */}
        <div className="flex flex-col gap-2 overflow-y-auto">
          {/* Launch Stage & Environment */}
          <div className="bg-[#0c1017] p-3 rounded-xl border border-white/10 flex flex-col gap-2.5">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Очередь развертывания
            </span>

            {/* Stage buttons */}
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3].map((stg) => {
                const activeSatsCount =
                  draft.design.satellites.filter((s) => s.launch_batch <= stg).length || stg * 16
                const isSelected = draft.design.launch_stage === stg
                return (
                  <button
                    key={stg}
                    onClick={() => handleLaunchStageChange(stg)}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-[#080b11] border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Этап {stg}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                      {activeSatsCount} КА
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="h-px bg-white/10 my-0.5" />

            {/* Environment Parameters */}
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Параметры окружения и ISL
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-slate-400 text-[10px] block mb-1">
                  Дальность ISL:
                </label>
                <div className="flex gap-1.5">
                  {[2000, 3000].map((val) => (
                    <button
                      key={val}
                      onClick={() => handleEnvChange('isl_range_km', val)}
                      className={`flex-1 py-1 px-1.5 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                        draft.environment.isl_range_km === val
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-[#080b11] border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {val} км
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-400 text-[10px] block mb-1">
                  Мин. угол места (°):
                </label>
                <input
                  type="number"
                  min="0"
                  max="45"
                  step="1"
                  value={draft.environment.min_elevation_deg}
                  onChange={(e) => handleEnvChange('min_elevation_deg', Number(e.target.value))}
                  className="w-full bg-[#080b11] border border-white/10 rounded-md py-1 px-2 text-xs text-slate-200 focus:outline-none focus:border-white/30"
                />
              </div>
            </div>
          </div>

          {/* Plane Orientation & RAAN / Phase Shift */}
          <div className="bg-[#0c1017] p-3 rounded-xl border border-white/10 flex flex-col gap-2.5">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Орбитальные плоскости (RAAN и фаза)
            </span>

            <div className="flex flex-col gap-2">
              {draft.design.planes.map((p) => (
                <div
                  key={p.id}
                  className="bg-[#080b11] p-2 rounded-lg border border-white/10 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-cyan-300">
                      Плоскость {p.id}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {draft.design.satellites.filter((s) => s.plane_id === p.id).length} КА
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                    <div>
                      <div className="flex items-center justify-between text-slate-400 mb-0.5">
                        <span>RAAN (Ω):</span>
                        <span className="text-cyan-300 font-bold">
                          {p.raan_deg.toFixed(1)}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="359"
                        step="1"
                        value={p.raan_deg}
                        onChange={(e) => handlePlaneChange(p.id, 'raan_deg', Number(e.target.value))}
                        className="w-full h-1 bg-[#161c28] rounded appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-slate-400 mb-0.5">
                        <span>Фаза:</span>
                        <span className="text-cyan-300 font-bold">
                          {p.phase_deg.toFixed(1)}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="359"
                        step="0.5"
                        value={p.phase_deg}
                        onChange={(e) => handlePlaneChange(p.id, 'phase_deg', Number(e.target.value))}
                        className="w-full h-1 bg-[#161c28] rounded appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Failures & Gateway Outages */}
        <div className="flex flex-col gap-2 overflow-y-auto">
          {/* Satellite Outages */}
          <div className="bg-[#0c1017] p-3 rounded-xl border border-white/10 flex flex-col gap-2.5">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
              <span>Отказы спутников ({draft.failures.length})</span>
            </span>

            {/* Add failure row */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#080b11] p-1.5 rounded-lg border border-white/10 text-xs">
              <div className="relative">
                <select
                  value={newFailSat}
                  onChange={(e) => setNewFailSat(e.target.value)}
                  className="h-7 pl-2 pr-7 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-mono rounded-md appearance-none focus:outline-none focus:border-white/30 transition-colors cursor-pointer"
                >
                  {draft.design.satellites.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#0c1017] text-slate-200">
                      {s.id} ({s.plane_id})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-400">С:</span>
                <input
                  type="time"
                  value={secondsToTimeInputValue(newFailStart)}
                  onChange={(e) => setNewFailStart(hhmmToSeconds(e.target.value))}
                  className="h-7 px-1.5 bg-[#0c1017] border border-white/10 rounded-md text-slate-200 text-xs font-mono focus:outline-none focus:border-white/30"
                />
                <span className="text-slate-400">До:</span>
                <input
                  type="time"
                  value={secondsToTimeInputValue(newFailEnd)}
                  onChange={(e) => setNewFailEnd(hhmmToSeconds(e.target.value))}
                  className="h-7 px-1.5 bg-[#0c1017] border border-white/10 rounded-md text-slate-200 text-xs font-mono focus:outline-none focus:border-white/30"
                />
              </div>

              <button
                onClick={handleAddFailure}
                className="ml-auto h-7 px-2.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить</span>
              </button>
            </div>

            {/* Failures list */}
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-0.5">
              {draft.failures.length === 0 ? (
                <span className="text-xs text-slate-500 italic p-2 text-center">
                  Нет активных отказов
                </span>
              ) : (
                draft.failures.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-[#080b11] px-2.5 py-1.5 rounded-lg border border-white/10 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-rose-400">{f.satellite_id}</span>
                      <span className="text-slate-300 text-[11px]">
                        {secondsToHHMM(f.start_s)} — {secondsToHHMM(f.end_s)}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        ({formatDurationHuman(f.end_s - f.start_s)})
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveFailure(idx)}
                      className="text-slate-400 hover:text-rose-400 p-0.5 cursor-pointer"
                      title="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Gateway Outages */}
          <div className="bg-[#0c1017] p-3 rounded-xl border border-white/10 flex flex-col gap-2.5">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
              <span>Окна обслуживания наземных шлюзов ({draft.gateway_outages.length})</span>
            </span>

            {/* Add gateway outage row */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#080b11] p-1.5 rounded-lg border border-white/10 text-xs">
              {gateways.length > 1 && (
                <div className="relative">
                  <select
                    value={newGwId}
                    onChange={(e) => setNewGwId(e.target.value)}
                    className="h-7 pl-2 pr-7 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-mono rounded-md appearance-none focus:outline-none focus:border-white/30 transition-colors cursor-pointer"
                  >
                    {gateways.map((g) => (
                      <option key={g.id} value={g.id} className="bg-[#0c1017] text-slate-200">
                        {g.id} ({g.name || 'Шлюз'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}

              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-400">С:</span>
                <input
                  type="time"
                  value={secondsToTimeInputValue(newGwStart)}
                  onChange={(e) => setNewGwStart(hhmmToSeconds(e.target.value))}
                  className="h-7 px-1.5 bg-[#0c1017] border border-white/10 rounded-md text-slate-200 text-xs font-mono focus:outline-none focus:border-white/30"
                />
                <span className="text-slate-400">До:</span>
                <input
                  type="time"
                  value={secondsToTimeInputValue(newGwEnd)}
                  onChange={(e) => setNewGwEnd(hhmmToSeconds(e.target.value))}
                  className="h-7 px-1.5 bg-[#0c1017] border border-white/10 rounded-md text-slate-200 text-xs font-mono focus:outline-none focus:border-white/30"
                />
              </div>

              <button
                onClick={handleAddGatewayOutage}
                className="ml-auto h-7 px-2.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить</span>
              </button>
            </div>

            {/* Outages list */}
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-0.5">
              {draft.gateway_outages.length === 0 ? (
                <span className="text-xs text-slate-500 italic p-2 text-center">
                  Шлюзы доступны 24/7 без окон обслуживания
                </span>
              ) : (
                draft.gateway_outages.map((o, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-[#080b11] px-2.5 py-1.5 rounded-lg border border-white/10 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 text-[10px] font-bold">
                        {o.gateway_id}
                      </span>
                      <span className="text-slate-300 text-[11px]">
                        {secondsToHHMM(o.start_s)} — {secondsToHHMM(o.end_s)}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        ({formatDurationHuman(o.end_s - o.start_s)})
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveGatewayOutage(idx)}
                      className="text-slate-400 hover:text-rose-400 p-0.5 cursor-pointer"
                      title="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

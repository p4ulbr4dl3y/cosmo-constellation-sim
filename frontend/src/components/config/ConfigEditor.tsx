import React, { useState, useMemo } from 'react'
import {
  Trash2,
  ChevronDown,
} from 'lucide-react'
import type { Scenario, Failure, GatewayOutage, GroundSite } from '../../types/scenario'
import { Button, Badge } from '../ui'
import {
  secondsToTimeInputValue,
  secondsToHHMM,
  hhmmToSeconds,
  formatDurationHuman,
} from '../../lib/formatters'

interface ConfigEditorProps {
  scenario: Scenario
  onUpdateScenario: (updated: Scenario) => void
  onResetScenario: () => void
  activeRouteSats: string[]
  currentTime: number
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

  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedUpdateScenario = (next: Scenario) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      onUpdateScenario(next)
    }, 150)
  }

  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

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
    debouncedUpdateScenario(next)
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
    debouncedUpdateScenario(next)
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
    <div className="h-full flex flex-col gap-2 font-sans text-xs overflow-y-auto max-w-[1500px] mx-auto w-full">
      {/* Top Action Bar */}
      <div className="bg-[#0b1017] px-3 py-2 rounded-md border border-[#1a2636] flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-200">
            Конфигурация симуляции
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Stress test */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleKillActiveRouteSat}
            disabled={activeRouteSats.length === 0}
            className={`font-mono transition-colors ${
              activeRouteSats.length > 0
                ? 'border-rose-500/30 text-rose-300 hover:bg-rose-500/15 hover:border-rose-500/60'
                : 'opacity-50'
            }`}
          >
            <span>Отказ {activeRouteSats[0] || 'нет КА'} (4ч)</span>
          </Button>

          {/* Reset */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResetScenario}
          >
            <span>Сброс</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 flex-1 min-h-0">
        {/* Left: Constellation Geometry & Planes */}
        <div className="flex flex-col gap-2 overflow-y-auto">
          {/* Launch Stage & Environment */}
          <div className="bg-[#0b1017] p-3 rounded-md border border-[#1a2636] flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-zinc-200">
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
                    className={`py-1.5 px-2 rounded border text-xs font-semibold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-[#070b10] border-[#1a2636] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span>Этап {stg}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-zinc-300' : 'text-zinc-400'}`}>
                      {activeSatsCount} КА
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="h-px bg-[#1a2636] my-0.5" />

            {/* Environment Parameters */}
            <span className="text-xs font-semibold text-zinc-200">
              Параметры окружения и ISL
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-zinc-400 text-[10px] block mb-1">
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
                        : 'bg-[#070b10] border-[#1a2636] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {val} км
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-zinc-400 text-[10px] block mb-1">
                  Мин. угол места:
                </label>
                <div className="flex items-center bg-[#070b10] border border-[#1a2636] rounded-md overflow-hidden h-7 focus-within:border-cyan-400/40">
                  <button
                    type="button"
                    onClick={() => handleEnvChange('min_elevation_deg', Math.max(0, draft.environment.min_elevation_deg - 1))}
                    className="px-2.5 h-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs font-mono select-none"
                    title="Уменьшить"
                  >
                    −
                  </button>
                  <div className="flex-1 flex items-center justify-center">
                    <input
                      type="number"
                      min="0"
                      max="45"
                      step="1"
                      value={draft.environment.min_elevation_deg}
                      onChange={(e) => handleEnvChange('min_elevation_deg', Math.max(0, Math.min(45, Number(e.target.value))))}
                      className="w-8 bg-transparent text-center text-xs font-mono font-bold text-cyan-300 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-zinc-500 text-xs select-none font-mono">°</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEnvChange('min_elevation_deg', Math.min(45, draft.environment.min_elevation_deg + 1))}
                    className="px-2.5 h-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs font-mono select-none"
                    title="Увеличить"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Plane Orientation & RAAN / Phase Shift */}
          <div className="bg-[#0b1017] p-3 rounded-md border border-[#1a2636] flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-zinc-200">
              Орбитальные плоскости (RAAN и фаза)
            </span>

            <div className="flex flex-col gap-2">
              {draft.design.planes.map((p) => (
                <div
                  key={p.id}
                  className="bg-[#070b10] p-2 rounded border border-[#1a2636] flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-cyan-300">
                      Плоскость {p.id}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {draft.design.satellites.filter((s) => s.plane_id === p.id).length} КА
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                    <div>
                      <div className="flex items-center justify-between text-zinc-400 mb-0.5">
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
                      <div className="flex items-center justify-between text-zinc-400 mb-0.5">
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
          <div className="bg-[#0b1017] p-3 rounded-md border border-[#1a2636] flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
              <span>Отказы спутников ({draft.failures.length})</span>
            </span>

            {/* Add failure row */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#070b10] p-1.5 rounded border border-[#1a2636] text-xs">
              <div className="relative">
                <select
                  value={newFailSat}
                  onChange={(e) => setNewFailSat(e.target.value)}
                  className="h-7 pl-2 pr-7 bg-[#070b10] hover:bg-[#0c131c] border border-[#1a2636] text-zinc-200 text-xs font-mono rounded-md appearance-none focus:outline-none focus:border-[#2a3c54] transition-colors cursor-pointer"
                >
                  {draft.design.satellites.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#070b10] text-zinc-200">
                      {s.id} ({s.plane_id})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <div className="flex items-center bg-[#070b10] border border-[#1a2636] rounded-md px-1.5 h-7 focus-within:border-cyan-400/40">
                  <span className="text-zinc-500 text-[10px] mr-1.5 select-none font-sans">с</span>
                  <input
                    type="time"
                    value={secondsToTimeInputValue(newFailStart)}
                    onChange={(e) => setNewFailStart(hhmmToSeconds(e.target.value))}
                    className="bg-transparent text-zinc-200 text-xs font-mono focus:outline-none"
                  />
                </div>
                <div className="flex items-center bg-[#070b10] border border-[#1a2636] rounded-md px-1.5 h-7 focus-within:border-cyan-400/40">
                  <span className="text-zinc-500 text-[10px] mr-1.5 select-none font-sans">по</span>
                  <input
                    type="time"
                    value={secondsToTimeInputValue(newFailEnd)}
                    onChange={(e) => setNewFailEnd(hhmmToSeconds(e.target.value))}
                    className="bg-transparent text-zinc-200 text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddFailure}
                className="ml-auto hover:border-cyan-400/40 hover:text-cyan-300"
              >
                <span>Добавить</span>
              </Button>
            </div>

            {/* Failures list */}
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-0.5">
              {draft.failures.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-5 px-3 rounded-md border border-dashed border-[#1a2636] bg-[#070b10]/40 text-center">
                  <span className="text-zinc-300 text-xs font-medium">Штатное функционирование КА</span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 font-sans">Активных отказов в симуляции нет</span>
                </div>
              ) : (
                draft.failures.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-[#070b10] px-2.5 py-1.5 rounded-md border border-[#1a2636] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="red">{f.satellite_id}</Badge>
                      <span className="text-zinc-300 text-[11px]">
                        {secondsToHHMM(f.start_s)} — {secondsToHHMM(f.end_s)}
                      </span>
                      <span className="text-zinc-400 text-[10px]">
                        ({formatDurationHuman(f.end_s - f.start_s)})
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFailure(idx)}
                      className="w-6 h-6 p-0 text-zinc-400 hover:text-rose-400"
                      title="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Gateway Outages */}
          <div className="bg-[#0b1017] p-3 rounded-md border border-[#1a2636] flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
              <span>Окна обслуживания наземных шлюзов ({draft.gateway_outages.length})</span>
            </span>

            {/* Add gateway outage row */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#070b10] p-1.5 rounded border border-[#1a2636] text-xs">
              {gateways.length > 1 && (
                <div className="relative">
                  <select
                    value={newGwId}
                    onChange={(e) => setNewGwId(e.target.value)}
                    className="h-7 pl-2 pr-7 bg-[#070b10] hover:bg-[#0c131c] border border-[#1a2636] text-zinc-200 text-xs font-mono rounded-md appearance-none focus:outline-none focus:border-[#2a3c54] transition-colors cursor-pointer"
                  >
                    {gateways.map((g) => (
                      <option key={g.id} value={g.id} className="bg-[#070b10] text-zinc-200">
                        {g.id} ({g.name || 'Шлюз'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}

              <div className="flex items-center gap-1.5 text-xs">
                <div className="flex items-center bg-[#070b10] border border-[#1a2636] rounded-md px-1.5 h-7 focus-within:border-cyan-400/40">
                  <span className="text-zinc-500 text-[10px] mr-1.5 select-none font-sans">с</span>
                  <input
                    type="time"
                    value={secondsToTimeInputValue(newGwStart)}
                    onChange={(e) => setNewGwStart(hhmmToSeconds(e.target.value))}
                    className="bg-transparent text-zinc-200 text-xs font-mono focus:outline-none"
                  />
                </div>
                <div className="flex items-center bg-[#070b10] border border-[#1a2636] rounded-md px-1.5 h-7 focus-within:border-cyan-400/40">
                  <span className="text-zinc-500 text-[10px] mr-1.5 select-none font-sans">по</span>
                  <input
                    type="time"
                    value={secondsToTimeInputValue(newGwEnd)}
                    onChange={(e) => setNewGwEnd(hhmmToSeconds(e.target.value))}
                    className="bg-transparent text-zinc-200 text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddGatewayOutage}
                className="ml-auto hover:border-cyan-400/40 hover:text-cyan-300"
              >
                <span>Добавить</span>
              </Button>
            </div>

            {/* Outages list */}
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-0.5">
              {draft.gateway_outages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-5 px-3 rounded-md border border-dashed border-[#1a2636] bg-[#070b10]/40 text-center">
                  <span className="text-zinc-300 text-xs font-medium">Шлюзы доступны 24/7</span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 font-sans">Окна регламентного обслуживания не назначены</span>
                </div>
              ) : (
                draft.gateway_outages.map((o, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-[#070b10] px-2.5 py-1.5 rounded-md border border-[#1a2636] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="amber">{o.gateway_id}</Badge>
                      <span className="text-zinc-300 text-[11px]">
                        {secondsToHHMM(o.start_s)} — {secondsToHHMM(o.end_s)}
                      </span>
                      <span className="text-zinc-400 text-[10px]">
                        ({formatDurationHuman(o.end_s - o.start_s)})
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveGatewayOutage(idx)}
                      className="w-6 h-6 p-0 text-zinc-400 hover:text-rose-400"
                      title="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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

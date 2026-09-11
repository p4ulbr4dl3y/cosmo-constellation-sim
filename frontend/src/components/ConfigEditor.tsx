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
  const [draft, setDraft] = useState<Scenario>(() => JSON.parse(JSON.stringify(scenario)))
  const [prevScenario, setPrevScenario] = useState(scenario)
  if (scenario !== prevScenario) {
    setPrevScenario(scenario)
    setDraft(JSON.parse(JSON.stringify(scenario)))
  }

  // New failure form inputs
  const [newFailSat, setNewFailSat] = useState<string>(draft.design.satellites[0]?.id || 'S01')
  const [newFailStart, setNewFailStart] = useState<number>(21600)
  const [newFailEnd, setNewFailEnd] = useState<number>(43200)

  // New gateway outage form inputs
  const [newGwStart, setNewGwStart] = useState<number>(10800)
  const [newGwEnd, setNewGwEnd] = useState<number>(21600)

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
    const targetSat = activeRouteSats[0] // pick first sat on route
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
    <div className="flex flex-col gap-3 p-3.5 bg-[#080d17] border border-[#162238] rounded-lg shadow-xl max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#162238] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#0d1424] border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-mono font-bold text-slate-100 uppercase tracking-wider">
              КОНФИГУРАЦИЯ ГРУППИРОВКИ // ORBITAL DESIGN ENGINE
            </h2>
            <p className="text-[10px] font-mono text-slate-500">
              Настройка очередей развертывания, орбитальных плоскостей (RAAN / фаза), дальности ISL и окон отказов
            </p>
          </div>
        </div>

        <button
          onClick={onResetScenario}
          className="px-2.5 py-1 rounded bg-[#0d1424] hover:bg-[#141f36] border border-[#1c2a44] text-[11px] font-mono font-medium text-slate-300 hover:text-cyan-300 flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>СБРОС</span>
        </button>
      </div>

      {/* 1-Click Fast Failure Button */}
      <div className="bg-gradient-to-r from-red-950/30 via-[#0d1424] to-red-950/30 p-2.5 rounded border border-red-900/40 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
          <div>
            <span className="text-xs font-mono font-bold text-red-200 block">
              СТРЕСС-ТЕСТИРОВАНИЕ СВЯЗИ (INJECTION TEST)
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Мгновенный ввод 4-часового отказа первого активного аппарата на сквозном пути
            </span>
          </div>
        </div>
        <button
          onClick={handleKillActiveRouteSat}
          disabled={activeRouteSats.length === 0}
          className={`px-3 py-1.5 rounded font-mono font-bold text-xs flex items-center gap-2 transition-all ${
            activeRouteSats.length > 0
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-sm cursor-pointer'
              : 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-700/50'
          }`}
        >
          <ZapOff className="w-3.5 h-3.5" />
          <span>ОТКЛЮЧИТЬ КА НА МАРШРУТЕ ({activeRouteSats[0] || 'NONE'})</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Launch Stage & Environment */}
        <div className="bg-[#050810] p-3 rounded border border-[#162238] flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
            <Rocket className="w-3.5 h-3.5 text-cyan-400" />
            <span>ОЧЕРЕДЬ РАЗВЕРТЫВАНИЯ (LAUNCH STAGE)</span>
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
                  className={`py-2 px-2 rounded-lg border text-xs font-mono font-bold flex flex-col items-center gap-1 transition-all ${
                    isSelected
                      ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg shadow-cyan-600/30'
                      : 'bg-[#141d2e] border-[#223552] text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span>Этап {stg}</span>
                  <span className="text-[10px] font-normal opacity-80">
                    {activeSatsCount} КА
                  </span>
                </button>
              )
            })}
          </div>

          <div className="h-px bg-[#1d2a40] my-1" />

          {/* Environment Parameters */}
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Параметры окружения и связи</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 text-[11px] block mb-1">
                Предельная дальность ISL (км):
              </label>
              <div className="flex gap-2">
                {[2000, 3000].map((val) => (
                  <button
                    key={val}
                    onClick={() => handleEnvChange('isl_range_km', val)}
                    className={`flex-1 py-1.5 px-2 rounded font-mono text-xs font-bold border transition-colors ${
                      draft.environment.isl_range_km === val
                        ? 'bg-cyan-600 border-cyan-400 text-white'
                        : 'bg-[#141d2e] border-[#223552] text-slate-300 hover:bg-[#1a2842]'
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
                className="w-full bg-[#141d2e] border border-[#223552] rounded py-1.5 px-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>
          </div>
        </div>

        {/* Plane Orientation & RAAN / Phase Shift */}
        <div className="bg-[#0e1524] p-3.5 rounded-xl border border-[#1e2c44] flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>Орбитальные плоскости (RAAN & Фазовый сдвиг)</span>
          </div>

          <div className="flex flex-col gap-2.5">
            {draft.design.planes.map((p) => (
              <div
                key={p.id}
                className="bg-[#121a2c] p-2.5 rounded-lg border border-[#223552] flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-cyan-300">
                    Плоскость {p.id}
                  </span>
                  <span className="text-[10px] text-slate-400">16 аппаратов</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>
                    <div className="flex justify-between text-slate-400 mb-0.5">
                      <span>RAAN (Ω):</span>
                      <span className="text-slate-200">{p.raan_deg.toFixed(1)}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="359"
                      step="1"
                      value={p.raan_deg}
                      onChange={(e) => handlePlaneChange(p.id, 'raan_deg', Number(e.target.value))}
                      className="w-full h-1 bg-[#1c2940] rounded accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 mb-0.5">
                      <span>Фазовый сдвиг:</span>
                      <span className="text-slate-200">{p.phase_deg.toFixed(1)}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="359"
                      step="0.5"
                      value={p.phase_deg}
                      onChange={(e) => handlePlaneChange(p.id, 'phase_deg', Number(e.target.value))}
                      className="w-full h-1 bg-[#1c2940] rounded accent-purple-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Failures & Gateway Outages Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Satellite Outages */}
        <div className="bg-[#0e1524] p-3.5 rounded-xl border border-[#1e2c44] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-300 uppercase tracking-wider flex items-center gap-1.5">
              <ZapOff className="w-3.5 h-3.5 text-red-400" />
              Отказы спутников ({draft.failures.length})
            </span>
          </div>

          {/* Add failure row */}
          <div className="flex flex-wrap items-center gap-2 bg-[#121a2c] p-2 rounded-lg border border-[#223552] text-xs">
            <select
              value={newFailSat}
              onChange={(e) => setNewFailSat(e.target.value)}
              className="bg-[#18243b] border border-[#2a3f63] text-slate-200 py-1 px-1.5 rounded font-mono text-xs focus:outline-none"
            >
              {draft.design.satellites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} ({s.plane_id})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 font-mono text-[11px]">
              <span className="text-slate-400">С:</span>
              <input
                type="number"
                min="0"
                max="86400"
                step="120"
                value={newFailStart}
                onChange={(e) => setNewFailStart(Number(e.target.value))}
                className="w-16 bg-[#18243b] border border-[#2a3f63] px-1 py-0.5 rounded text-slate-200 font-mono text-xs"
              />
              <span className="text-slate-400">До:</span>
              <input
                type="number"
                min="0"
                max="86400"
                step="120"
                value={newFailEnd}
                onChange={(e) => setNewFailEnd(Number(e.target.value))}
                className="w-16 bg-[#18243b] border border-[#2a3f63] px-1 py-0.5 rounded text-slate-200 font-mono text-xs"
              />
            </div>

            <button
              onClick={handleAddFailure}
              className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white font-semibold text-xs flex items-center gap-1 ml-auto"
            >
              <Plus className="w-3 h-3" />
              <span>Добавить</span>
            </button>
          </div>

          {/* Failures list */}
          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
            {draft.failures.length === 0 ? (
              <span className="text-xs text-slate-500 font-mono italic p-2">
                Нет активных периодов отказов
              </span>
            ) : (
              draft.failures.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-[#121927] p-2 rounded border border-[#1e2a3f] text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-400">{f.satellite_id}</span>
                    <span className="text-slate-400 text-[11px]">
                      [{f.start_s}с .. {f.end_s}с]
                    </span>
                    <span className="text-slate-500 text-[10px]">
                      ({Math.round((f.end_s - f.start_s) / 60)} мин)
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveFailure(idx)}
                    className="text-slate-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Gateway Outages */}
        <div className="bg-[#0e1524] p-3.5 rounded-xl border border-[#1e2c44] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              Недоступность шлюза Murmansk ({draft.gateway_outages.length})
            </span>
          </div>

          {/* Add gateway outage */}
          <div className="flex flex-wrap items-center gap-2 bg-[#121a2c] p-2 rounded-lg border border-[#223552] text-xs">
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <span className="text-slate-400">С:</span>
              <input
                type="number"
                min="0"
                max="86400"
                step="120"
                value={newGwStart}
                onChange={(e) => setNewGwStart(Number(e.target.value))}
                className="w-16 bg-[#18243b] border border-[#2a3f63] px-1 py-0.5 rounded text-slate-200 font-mono text-xs"
              />
              <span className="text-slate-400">До:</span>
              <input
                type="number"
                min="0"
                max="86400"
                step="120"
                value={newGwEnd}
                onChange={(e) => setNewGwEnd(Number(e.target.value))}
                className="w-16 bg-[#18243b] border border-[#2a3f63] px-1 py-0.5 rounded text-slate-200 font-mono text-xs"
              />
            </div>

            <button
              onClick={handleAddGatewayOutage}
              className="px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white font-semibold text-xs flex items-center gap-1 ml-auto"
            >
              <Plus className="w-3 h-3" />
              <span>Добавить окно</span>
            </button>
          </div>

          {/* Outages list */}
          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
            {draft.gateway_outages.length === 0 ? (
              <span className="text-xs text-slate-500 font-mono italic p-2">
                Шлюз работает без запланированных остановок
              </span>
            ) : (
              draft.gateway_outages.map((o, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-[#121927] p-2 rounded border border-[#1e2a3f] text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-400">{o.gateway_id}</span>
                    <span className="text-slate-400 text-[11px]">
                      [{o.start_s}с .. {o.end_s}с]
                    </span>
                    <span className="text-slate-500 text-[10px]">
                      ({Math.round((o.end_s - o.start_s) / 60)} мин)
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveGatewayOutage(idx)}
                    className="text-slate-500 hover:text-red-400 p-1"
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
  )
}

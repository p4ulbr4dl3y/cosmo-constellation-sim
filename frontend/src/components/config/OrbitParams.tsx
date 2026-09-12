import React from 'react'
import type { Design, Environment, Plane, Satellite } from '../../types/scenario'

export interface OrbitParamsProps {
  design: Design
  environment: Environment
  onLaunchStageChange: (stage: number) => void
  onPlaneChange: (planeId: string, field: 'raan_deg' | 'phase_deg', value: number) => void
  onEnvChange: (field: 'isl_range_km' | 'min_elevation_deg' | 'altitude_km', value: number) => void
}

export const OrbitParams: React.FC<OrbitParamsProps> = ({
  design,
  environment,
  onLaunchStageChange,
  onPlaneChange,
  onEnvChange,
}) => {
  return (
    <div className="flex flex-col gap-2 lg:overflow-y-auto">
      {/* Launch Stage & Environment */}
      <div className="bg-[#0b1017] p-3 rounded-md border border-[#1a2636] flex flex-col gap-2.5">
        <span className="text-xs font-semibold text-zinc-200">
          Очередь развертывания
        </span>

        {/* Stage buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          {[1, 2, 3].map((stg) => {
            const activeSatsCount =
              design.satellites.filter((s: Satellite) => s.launch_batch <= stg).length || stg * 16
            const isSelected = design.launch_stage === stg
            return (
              <button
                key={stg}
                type="button"
                onClick={() => onLaunchStageChange(stg)}
                className={`py-1.5 px-2 rounded border text-xs font-semibold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'bg-[#070b10] border-[#1a2636] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>Этап {stg}</span>
                <span className={`text-xs ${isSelected ? 'text-zinc-300' : 'text-zinc-400'}`}>
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
            <label className="text-zinc-400 text-xs block mb-1">
              Дальность ISL:
            </label>
            <div className="flex gap-1.5 h-7">
              {[2000, 3000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onEnvChange('isl_range_km', val)}
                  className={`flex-1 h-full flex items-center justify-center rounded-md text-xs font-mono font-medium border transition-colors cursor-pointer ${
                    environment.isl_range_km === val
                      ? 'bg-white/15 border-white/30 text-white shadow-sm'
                      : 'bg-[#070b10] border-[#1a2636] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {val} км
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-zinc-400 text-xs block mb-1">
              Мин. угол места:
            </label>
            <div className="flex items-center bg-[#070b10] border border-[#1a2636] rounded-md overflow-hidden h-7 focus-within:border-cyan-400/40">
              <button
                type="button"
                onClick={() => onEnvChange('min_elevation_deg', Math.max(0, environment.min_elevation_deg - 1))}
                className="w-7 h-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs font-mono select-none"
                title="Уменьшить"
              >
                −
              </button>
              <div className="flex-1 flex items-center justify-center gap-0.5">
                <input
                  type="number"
                  min="0"
                  max="45"
                  step="1"
                  value={environment.min_elevation_deg}
                  onChange={(e) => onEnvChange('min_elevation_deg', Math.max(0, Math.min(45, Number(e.target.value))))}
                  className="w-7 text-right bg-transparent text-xs font-mono font-bold text-cyan-300 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-zinc-400 text-xs select-none font-mono">°</span>
              </div>
              <button
                type="button"
                onClick={() => onEnvChange('min_elevation_deg', Math.min(45, environment.min_elevation_deg + 1))}
                className="w-7 h-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs font-mono select-none"
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
          {design.planes.map((p: Plane) => (
            <div
              key={p.id}
              className="bg-[#070b10] p-2 rounded border border-[#1a2636] flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-cyan-300">
                  Плоскость {p.id}
                </span>
                <span className="text-xs text-zinc-400">
                  {design.satellites.filter((s: Satellite) => s.plane_id === p.id).length} КА
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
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
                    onChange={(e) => onPlaneChange(p.id, 'raan_deg', Number(e.target.value))}
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
                    onChange={(e) => onPlaneChange(p.id, 'phase_deg', Number(e.target.value))}
                    className="w-full h-1 bg-[#161c28] rounded appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

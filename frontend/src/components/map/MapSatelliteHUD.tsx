import React from 'react'
import type { SatelliteSnapshot } from '../../types/scenario'

export interface MapSatelliteHUDProps {
  satellite: SatelliteSnapshot | null
  islDegree: number
  onClose: () => void
  onToggleFailure: (satId: string) => void
}

export const MapSatelliteHUD: React.FC<MapSatelliteHUDProps> = ({
  satellite,
  islDegree,
  onClose,
  onToggleFailure,
}) => {
  if (!satellite) return null

  return (
    <div className="absolute bottom-3 left-3 z-20 bg-[#0b1017]/95 backdrop-blur p-3 rounded-md border border-[#1a2636] max-w-xs text-xs font-mono shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-[#1a2636] pb-1.5 mb-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              satellite.failed
                ? 'bg-rose-500'
                : satellite.active
                ? 'bg-emerald-400'
                : 'bg-zinc-500'
            }`}
          />
          <span className="font-semibold text-xs text-white">КА {satellite.id}</span>
          <span className="text-[10px] bg-[#070b10] text-zinc-400 border border-[#1a2636] px-1.5 py-0.2 rounded">
            {satellite.plane_id}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white text-sm leading-none px-1 cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1 text-[10px] text-zinc-300">
        <div className="flex justify-between">
          <span className="text-zinc-400">СТАТУС:</span>
          <span
            className={
              satellite.failed
                ? 'text-rose-400 font-bold'
                : satellite.active
                ? 'text-emerald-400 font-semibold'
                : 'text-zinc-400'
            }
          >
            {satellite.failed ? 'Отказ' : satellite.active ? 'В работе' : 'Резерв'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Партия:</span>
          <span>№{satellite.launch_batch}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Шир / Долг:</span>
          <span>
            {Math.abs(satellite.lat_deg).toFixed(1)}°{satellite.lat_deg >= 0 ? ' с.ш.' : ' ю.ш.'},{' '}
            {Math.abs(satellite.lon_deg).toFixed(1)}°{satellite.lon_deg >= 0 ? ' в.д.' : ' з.д.'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Связи (ISL):</span>
          <span className="text-cyan-400 font-bold">{islDegree} линков</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">ECEF:</span>
          <span className="text-[9px] text-zinc-400">
            [{Math.round(satellite.x_km)}, {Math.round(satellite.y_km)}, {Math.round(satellite.z_km)}]{' '}
            км
          </span>
        </div>
      </div>

      {/* Action button */}
      <div className="mt-2 pt-2 border-t border-[#1a2636]">
        <button
          onClick={() => onToggleFailure(satellite.id)}
          className={`w-full h-7 px-2 rounded text-xs font-mono font-medium flex items-center justify-center transition-all cursor-pointer border ${
              satellite.failed
                ? 'bg-emerald-600/30 hover:bg-emerald-600/50 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/20 border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/60'
          }`}
        >
          {satellite.failed ? 'Восстановить связь' : 'Имитировать отказ КА'}
        </button>
      </div>
    </div>
  )
}

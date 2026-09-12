import React from 'react'
import { X, RotateCcw, ZapOff } from 'lucide-react'
import type { SatelliteSnapshot } from '../../types/scenario'
import { Button } from '../ui'

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
    <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 z-20 bg-[#0b1017]/95 backdrop-blur p-2.5 sm:p-3 rounded-md border border-[#1a2636] max-w-[calc(100%-1rem)] sm:max-w-xs text-xs font-mono shadow-2xl">
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
          type="button"
          onClick={onClose}
          aria-label="✕"
          title="Закрыть"
          className="w-7 h-7 -mr-1.5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
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
      </div>

      {/* Action button */}
      <div className="mt-2 pt-2 border-t border-[#1a2636]">
        <Button
          type="button"
          variant={satellite.failed ? 'success' : 'danger'}
          size="sm"
          onClick={() => onToggleFailure(satellite.id)}
          className="w-full font-sans"
        >
          {satellite.failed ? (
            <>
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Восстановить связь</span>
            </>
          ) : (
            <>
              <ZapOff className="w-3.5 h-3.5 shrink-0" />
              <span>Имитировать отказ КА</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

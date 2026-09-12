import React from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import type { MapViewMode } from './types'
import { SegmentedControl, Button } from '../ui'

export interface MapControlsProps {
  viewMode: MapViewMode
  onSetViewMode: (mode: MapViewMode) => void
  onFocusArctic: () => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  showIsl: boolean
  onToggleIsl: () => void
  showGroundLinks: boolean
  onToggleGroundLinks: () => void
  showLabels: boolean
  onToggleLabels: () => void
  showUnlaunched: boolean
  onToggleUnlaunched: () => void
}

export const MapControls: React.FC<MapControlsProps> = ({
  viewMode,
  onSetViewMode,
  onFocusArctic,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  showIsl,
  onToggleIsl,
  showGroundLinks,
  onToggleGroundLinks,
  showLabels,
  onToggleLabels,
  showUnlaunched,
  onToggleUnlaunched,
}) => {
  const isMinZoom = viewMode === '2d' ? zoom <= 1.0 : zoom <= 0.8
  const isMaxZoom = viewMode === '2d' ? zoom >= 4.0 : zoom >= 3.0

  return (
    <div className="absolute inset-0 pointer-events-none p-2 sm:p-2.5 flex flex-col justify-between z-20 font-sans text-xs select-none">
      {/* Top Controls: Mode & Layers */}
      <div className="flex items-start justify-between gap-1.5 w-full">
        {/* Top-Left: 2D/3D & Arctic */}
        <div className="pointer-events-auto flex items-center gap-1 bg-[#0b1017]/90 backdrop-blur-md p-0.5 sm:p-1 rounded-md border border-[#1a2636] shadow-lg shrink-0">
          <SegmentedControl
            options={[
              { value: '2d', label: '2D' },
              { value: '3d', label: '3D' },
            ]}
            value={viewMode}
            onChange={onSetViewMode}
            size="sm"
          />

          <div className="h-3 w-px bg-white/10 mx-0.5" />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onFocusArctic}
            aria-label="Арктика"
            title="Сфокусировать 3D-глобус на Арктике"
            className="h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs font-medium"
          >
            <span className="hidden sm:inline">Арктика</span>
            <span className="sm:hidden">Арк</span>
          </Button>
        </div>

        {/* Top-Right: Layers & Legend */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Layer Toggles */}
          <div className="flex items-center bg-[#0b1017]/90 backdrop-blur-md p-0.5 sm:p-1 rounded-md border border-[#1a2636] shadow-lg gap-0.5">
            <button
              type="button"
              onClick={onToggleIsl}
              title="Межспутниковые линии (ISL)"
              className={`h-6 sm:h-7 px-1.5 sm:px-2 flex items-center justify-center rounded transition-all cursor-pointer text-[10px] sm:text-xs ${
                showIsl ? 'bg-white/20 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              ISL
            </button>

            <button
              type="button"
              onClick={onToggleGroundLinks}
              title="Линии Земля-Спутник (GSL)"
              className={`h-6 sm:h-7 px-1.5 sm:px-2 flex items-center justify-center rounded transition-all cursor-pointer text-[10px] sm:text-xs ${
                showGroundLinks
                  ? 'bg-white/20 text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              GSL
            </button>

            <button
              type="button"
              onClick={onToggleLabels}
              title="Номера спутников (ID)"
              className={`h-6 sm:h-7 px-1.5 sm:px-2 flex items-center justify-center rounded transition-all cursor-pointer text-[10px] sm:text-xs ${
                showLabels
                  ? 'bg-white/20 text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              ID
            </button>

            <button
              type="button"
              onClick={onToggleUnlaunched}
              aria-label="Резерв"
              title="Спутники последующих этапов"
              className={`h-6 sm:h-7 px-1.5 sm:px-2 flex items-center justify-center rounded transition-all cursor-pointer text-[10px] sm:text-xs ${
                showUnlaunched
                  ? 'bg-white/20 text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="hidden sm:inline">Резерв</span>
              <span className="sm:hidden">Рез</span>
            </button>
          </div>

          {/* Orbit Plane Legend on md+ */}
          <div className="hidden md:flex items-center gap-1.5 sm:gap-2 bg-[#0b1017]/90 backdrop-blur-md px-1.5 sm:px-2 py-1 rounded-md border border-[#1a2636] shadow-lg font-mono text-[9px] sm:text-[10px] shrink-0">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
              <span className="text-zinc-400">P1</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa]" />
              <span className="text-zinc-400">P2</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24]" />
              <span className="text-zinc-400">P3</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span className="text-zinc-400">ОТКАЗ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls: Bottom-Right Zoom HUD */}
      <div className="flex justify-end w-full pointer-events-none">
        <div className="pointer-events-auto flex items-center bg-[#0b1017]/90 backdrop-blur-md p-0.5 sm:p-1 rounded-md border border-[#1a2636] shadow-lg gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onZoomOut}
            disabled={isMinZoom}
            title="Отдалить карту"
            className={`w-6 h-6 sm:w-7 sm:h-7 p-0.5 ${
              isMinZoom
                ? 'text-zinc-600 cursor-not-allowed'
                : 'text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer'
            }`}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <button
            type="button"
            onClick={onResetView}
            title="Сбросить масштаб и положение (100%)"
            className={`px-1 py-0.5 text-[10px] sm:text-[11px] min-w-[32px] sm:min-w-[38px] text-center font-mono font-medium rounded transition-colors cursor-pointer ${
              Math.round(zoom * 100) !== 100
                ? 'text-sky-400 hover:text-sky-300 hover:bg-sky-500/10'
                : 'text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onZoomIn}
            disabled={isMaxZoom}
            title="Приблизить карту"
            className={`w-6 h-6 sm:w-7 sm:h-7 p-0.5 ${
              isMaxZoom
                ? 'text-zinc-600 cursor-not-allowed'
                : 'text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer'
            }`}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

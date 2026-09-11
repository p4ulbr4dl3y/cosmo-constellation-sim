import React from 'react'
import { Compass, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import type { MapViewMode } from './types'

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
    <div className="flex-shrink-0 flex items-center justify-between gap-2 bg-[#0c1017] px-2.5 py-1.5 border-b border-white/[0.08] font-sans text-xs z-10">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* 2D / 3D Mode Switcher */}
        <div className="flex items-center bg-white/[0.04] p-0.5 rounded-md border border-white/[0.08]">
          <button
            onClick={() => onSetViewMode('2d')}
            className={`px-2 py-0.5 font-medium rounded text-xs transition-all cursor-pointer ${
              viewMode === '2d' ? 'bg-white/15 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2D
          </button>
          <button
            onClick={() => onSetViewMode('3d')}
            className={`px-2 py-0.5 font-medium rounded text-xs transition-all cursor-pointer ${
              viewMode === '3d' ? 'bg-white/15 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3D
          </button>
        </div>

        <div className="h-3 w-px bg-white/10 mx-0.5" />

        {/* Arctic Focus */}
        <button
          onClick={onFocusArctic}
          title="Сфокусировать 3D-глобус на Арктике"
          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white transition-colors cursor-pointer text-xs"
        >
          <Compass className="w-3 h-3 text-sky-400" />
          <span>Арктика</span>
        </button>

        <div className="h-3 w-px bg-white/10 mx-0.5" />

        {/* Zoom Controls */}
        <div className="flex items-center bg-white/[0.04] p-0.5 rounded-md border border-white/[0.08] gap-0.5">
          <button
            onClick={onZoomOut}
            disabled={isMinZoom}
            title="Отдалить карту"
            className={`p-1 rounded transition-colors ${
              isMinZoom
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer'
            }`}
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <span className="px-1 text-[10px] text-slate-300 min-w-[32px] text-center font-mono font-medium">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={onZoomIn}
            disabled={isMaxZoom}
            title="Приблизить карту"
            className={`p-1 rounded transition-colors ${
              isMaxZoom
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer'
            }`}
          >
            <ZoomIn className="w-3 h-3" />
          </button>
          <button
            onClick={onResetView}
            title="Сбросить масштаб и положение (100%)"
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        <div className="h-3 w-px bg-white/10 mx-0.5" />

        {/* Layer Toggles */}
        <div className="flex items-center bg-black/50 p-0.5 rounded-lg border border-white/10 gap-0.5">
          <button
            onClick={onToggleIsl}
            title="Межспутниковые линии (ISL)"
            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
              showIsl ? 'bg-white/20 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ISL
          </button>

          <button
            onClick={onToggleGroundLinks}
            title="Линии Земля-Спутник (GSL)"
            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
              showGroundLinks
                ? 'bg-white/20 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            GSL
          </button>

          <button
            onClick={onToggleLabels}
            title="Номера спутников (ID)"
            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
              showLabels
                ? 'bg-white/20 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ID
          </button>

          <button
            onClick={onToggleUnlaunched}
            title="Спутники последующих этапов"
            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
              showUnlaunched
                ? 'bg-white/20 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Резерв
          </button>
        </div>
      </div>

      {/* Orbit Plane Legend in Header */}
      <div className="hidden sm:flex items-center gap-2 bg-black/40 px-2 py-1 rounded-md border border-white/10 font-mono text-[10px]">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff]" />
          <span className="text-slate-400">P1</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c084fc]" />
          <span className="text-slate-400">P2</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
          <span className="text-slate-400">P3</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          <span className="text-slate-400">ОТКАЗ</span>
        </div>
      </div>
    </div>
  )
}

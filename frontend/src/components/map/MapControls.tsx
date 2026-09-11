import React from 'react'
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
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
    <div className="flex-shrink-0 flex items-center justify-between gap-2 bg-[#0b1017] px-2.5 py-1.5 border-b border-[#1a2636] font-sans text-xs z-10">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* 2D / 3D Mode Switcher */}
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

        {/* Arctic Focus */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onFocusArctic}
          title="Сфокусировать 3D-глобус на Арктике"
          className="h-6 px-2 text-xs"
        >
          <span>Арктика</span>
        </Button>

        <div className="h-3 w-px bg-white/10 mx-0.5" />

        {/* Zoom Controls */}
        <div className="flex items-center bg-[#070b10] p-0.5 rounded border border-[#1a2636] gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onZoomOut}
            disabled={isMinZoom}
            title="Отдалить карту"
            className={`w-6 h-6 p-1 ${
              isMinZoom
                ? 'text-zinc-600 cursor-not-allowed'
                : 'text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer'
            }`}
          >
            <ZoomOut className="w-3 h-3" />
          </Button>
          <span className="px-1 text-[10px] text-zinc-300 min-w-[32px] text-center font-mono font-medium">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onZoomIn}
            disabled={isMaxZoom}
            title="Приблизить карту"
            className={`w-6 h-6 p-1 ${
              isMaxZoom
                ? 'text-zinc-600 cursor-not-allowed'
                : 'text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer'
            }`}
          >
            <ZoomIn className="w-3 h-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onResetView}
            title="Сбросить масштаб и положение (100%)"
            className="w-6 h-6 p-1 hover:bg-white/10 text-zinc-400 hover:text-white"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        </div>

        <div className="h-3 w-px bg-white/10 mx-0.5" />

        {/* Layer Toggles */}
        <div className="flex items-center bg-[#070b10] p-0.5 rounded border border-[#1a2636] gap-0.5">
          <button
            type="button"
            onClick={onToggleIsl}
            title="Межспутниковые линии (ISL)"
            className={`px-2 py-0.5 rounded transition-all cursor-pointer text-xs ${
              showIsl ? 'bg-white/20 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ISL
          </button>

          <button
            type="button"
            onClick={onToggleGroundLinks}
            title="Линии Земля-Спутник (GSL)"
            className={`px-2 py-0.5 rounded transition-all cursor-pointer text-xs ${
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
            className={`px-2 py-0.5 rounded transition-all cursor-pointer text-xs ${
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
            title="Спутники последующих этапов"
            className={`px-2 py-0.5 rounded transition-all cursor-pointer text-xs ${
              showUnlaunched
                ? 'bg-white/20 text-white font-medium'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Резерв
          </button>
        </div>
      </div>

      {/* Orbit Plane Legend in Header */}
      <div className="hidden sm:flex items-center gap-2 bg-[#070b10] px-2 py-1 rounded border border-[#1a2636] font-mono text-[10px]">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff]" />
          <span className="text-zinc-400">P1</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c084fc]" />
          <span className="text-zinc-400">P2</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
          <span className="text-zinc-400">P3</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          <span className="text-zinc-400">ОТКАЗ</span>
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import type { HoveredNodeInfo } from './types'

export interface MapTooltipProps {
  hoveredNode: HoveredNodeInfo | null
}

export const MapTooltip: React.FC<MapTooltipProps> = ({ hoveredNode }) => {
  if (!hoveredNode) return null

  return (
    <div
      style={{
        left: `${hoveredNode.x + 12}px`,
        top: `${hoveredNode.y + 12}px`,
      }}
      className="pointer-events-none absolute z-30 -translate-y-1/2 rounded bg-[#121215]/90 px-2 py-1 font-mono text-[10px] text-zinc-200 shadow-md border border-zinc-800 backdrop-blur"
    >
      <span className="font-semibold text-cyan-400">
        {hoveredNode.type === 'sat' ? `КА ${hoveredNode.id}` : `Наземный пункт ${hoveredNode.id}`}
      </span>
    </div>
  )
}

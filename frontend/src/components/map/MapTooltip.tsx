import React from 'react'
import type { HoveredNodeInfo } from './types'

export interface MapTooltipProps {
  hoveredNode: HoveredNodeInfo | null
}

export const MapTooltip: React.FC<MapTooltipProps> = ({ hoveredNode }) => {
  if (!hoveredNode) return null

  const isRightSide = hoveredNode.x > 220

  return (
    <div
      style={{
        left: `${isRightSide ? hoveredNode.x - 12 : hoveredNode.x + 12}px`,
        top: `${hoveredNode.y + 12}px`,
        transform: isRightSide ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
      }}
      className="pointer-events-none absolute z-30 rounded bg-[#0b1017]/95 px-2 py-1 font-mono text-[10px] text-zinc-200 shadow-md border border-[#1a2636] backdrop-blur whitespace-nowrap"
    >
      <span className="font-semibold text-cyan-400">
        {hoveredNode.type === 'sat' ? `КА ${hoveredNode.id}` : `Наземный пункт ${hoveredNode.id}`}
      </span>
    </div>
  )
}

import React from 'react'
import type { ClientTimeline } from '../../types/scenario'

export interface ClientItem {
  id: string
  name?: string
}

export interface ClientSelectorProps {
  clients: ClientItem[]
  selectedClientId: string
  onSelectClient: (id: string) => void
  timelines?: Record<string, ClientTimeline>
  targetAvailability?: number
  routes?: Record<string, string[]>
  variant?: 'pills' | 'grid'
  direction?: 'horizontal' | 'vertical'
  size?: 'sm' | 'md'
  showMetrics?: boolean
  className?: string
}

export const ClientSelector: React.FC<ClientSelectorProps> = ({
  clients,
  selectedClientId,
  onSelectClient,
  timelines,
  targetAvailability = 0.9,
  routes,
  variant = 'pills',
  direction = 'horizontal',
  size = 'md',
  showMetrics = true,
  className = '',
}) => {
  if (variant === 'grid') {
    return (
      <div
        className={`grid grid-cols-3 gap-1 p-1 bg-[#0b1017] border border-[#1a2636] rounded-md shrink-0 ${className}`}
      >
        {clients.map((c) => {
          const tl = timelines?.[c.id]
          const m = tl?.metrics
          const isSelected = c.id === selectedClientId
          const clientAvail = m ? (m.availability_ratio * 100).toFixed(1) : '0.0'
          const clientMeetsTarget = m ? m.availability_ratio >= targetAvailability : false
          const clientRoute = routes?.[c.id] || []
          const hasRoute = routes ? clientRoute.length > 0 : undefined

          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectClient(c.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-md transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white/12 text-white border border-white/20 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                {hasRoute !== undefined && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      hasRoute ? 'bg-emerald-400' : 'bg-rose-500'
                    }`}
                  />
                )}
                <span className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                  {c.id}
                </span>
              </div>
              {showMetrics && (
                <span
                  className={`text-[10px] font-mono font-medium ${
                    clientMeetsTarget ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {clientAvail}%
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  const isVertical = direction === 'vertical'

  return (
    <div
      aria-label="Client Terminals"
      className={`flex ${isVertical ? 'flex-col gap-1.5 w-14 shrink-0' : 'flex-wrap items-center gap-1.5'} ${className}`}
    >
      {clients.map((c) => {
        const isSelected = c.id === selectedClientId
        const tl = timelines?.[c.id]
        const availRatio = tl ? (tl.metrics.availability_ratio * 100).toFixed(1) : undefined
        const meetsTarget = tl ? tl.metrics.availability_ratio >= targetAvailability : false

        if (isVertical) {
          return (
            <button
              key={c.id}
              aria-pressed={isSelected}
              type="button"
              onClick={() => onSelectClient(c.id)}
              className={`h-4.5 px-1 rounded text-[10px] flex items-center justify-between border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white/15 border-white/30 text-white font-medium shadow-xs'
                  : 'bg-[#0b1017] border-[#1a2636]/80 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>{c.id}</span>
              {showMetrics && availRatio !== undefined && (
                <span
                  className={`text-[9px] font-mono ${
                    meetsTarget ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {availRatio}%
                </span>
              )}
            </button>
          )
        }

        const sizeStyles = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1 text-xs'

        return (
          <button
            key={c.id}
            aria-pressed={isSelected}
            type="button"
            onClick={() => onSelectClient(c.id)}
            className={`flex items-center gap-1.5 rounded-md border font-sans font-medium transition-all cursor-pointer select-none ${sizeStyles} ${
              isSelected
                ? 'bg-white/15 border-white/30 text-white shadow-xs'
                : 'bg-white/[0.03] border-[#1a2636] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
          >
            <span>{c.id}</span>
            {showMetrics && availRatio !== undefined && (
              <span
                className={`text-[10px] font-mono ${
                  meetsTarget ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {availRatio}%
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

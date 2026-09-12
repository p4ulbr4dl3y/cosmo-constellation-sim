import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  sublabel?: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  variant?: 'default' | 'accent' | 'compact'
  badge?: React.ReactNode
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  sublabel,
  value,
  trend,
  trendLabel,
  variant = 'default',
  badge,
  className = '',
  ...props
}) => {
  if (variant === 'accent') {
    return (
      <div
        className={`bg-sky-950/20 text-zinc-100 rounded-md p-3 sm:p-3.5 flex flex-col justify-between border border-sky-500/30 transition-all ${className}`}
        {...props}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-medium text-sky-300 block font-sans">
              {label}
            </span>
            {sublabel && (
              <span className="text-[11px] text-sky-200/70 font-mono mt-0.5 block">
                {sublabel}
              </span>
            )}
          </div>
          {badge}
        </div>
        <div className="mt-2.5 flex items-baseline justify-between gap-2">
          <span className="text-xl sm:text-2xl font-bold tracking-tight font-mono text-white">
            {value}
          </span>
          {trend && (
            <div className="flex items-center gap-1 text-sky-300 text-xs font-medium">
              {trend === 'up' && <TrendingUp className="w-4 h-4 stroke-[2]" />}
              {trend === 'down' && <TrendingDown className="w-4 h-4 stroke-[2]" />}
              {trend === 'neutral' && <Minus className="w-4 h-4 stroke-[2]" />}
              {trendLabel && <span>{trendLabel}</span>}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div
        className={`bg-[#070b10] border border-[#1a2636] rounded p-2 font-sans ${className}`}
        {...props}
      >
        <div className="text-[9px] text-zinc-400 block mb-0.5 font-medium truncate">
          {label}
        </div>
        <div className="flex items-baseline justify-between gap-1 flex-wrap">
          <span className="text-xs font-bold text-zinc-100 font-mono">{value}</span>
          {sublabel && <span className="text-[9px] text-zinc-500 font-mono">{sublabel}</span>}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`bg-[#0b1017] border border-[#1a2636] rounded-md p-3 sm:p-3.5 flex flex-col justify-between hover:border-zinc-700 transition-all ${className}`}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs font-medium text-zinc-400 font-sans block">
            {label}
          </span>
          {sublabel && (
            <span className="text-[11px] text-zinc-500 font-mono mt-0.5 block">
              {sublabel}
            </span>
          )}
        </div>
        {badge}
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <span className="text-xl sm:text-2xl font-semibold tracking-tight font-mono text-zinc-100">
          {value}
        </span>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-mono font-medium ${
              trend === 'up'
                ? 'text-sky-400'
                : trend === 'down'
                ? 'text-rose-400'
                : 'text-zinc-400'
            }`}
          >
            {trend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
            {trend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
            {trend === 'neutral' && <Minus className="w-3.5 h-3.5" />}
            {trendLabel && <span>{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

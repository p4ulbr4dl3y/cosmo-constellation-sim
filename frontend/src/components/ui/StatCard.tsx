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
        className={`bg-[#00f0ff] text-black rounded-xl p-3 sm:p-4 flex flex-col justify-between border border-[#00f0ff] transition-all ${className}`}
        {...props}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-semibold tracking-tight text-neutral-900 block font-mono uppercase">
              {label}
            </span>
            {sublabel && (
              <span className="text-[11px] text-neutral-800 font-mono mt-0.5 block">
                {sublabel}
              </span>
            )}
          </div>
          {badge}
        </div>
        <div className="mt-2.5 flex items-baseline justify-between gap-2">
          <span className="text-2xl font-bold tracking-tight font-mono text-black">
            {value}
          </span>
          {trend && (
            <div className="flex items-center gap-1 text-black text-xs font-semibold">
              {trend === 'up' && <TrendingUp className="w-4 h-4 stroke-[2.5]" />}
              {trend === 'down' && <TrendingDown className="w-4 h-4 stroke-[2.5]" />}
              {trend === 'neutral' && <Minus className="w-4 h-4 stroke-[2.5]" />}
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
        className={`bg-[#080b11] border border-[#141b26] rounded-lg p-2 font-mono ${className}`}
        {...props}
      >
        <div className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">
          {label}
        </div>
        <div className="flex items-baseline justify-between gap-1">
          <span className="text-xs font-bold text-slate-100">{value}</span>
          {sublabel && <span className="text-[9px] text-slate-500">{sublabel}</span>}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`bg-[#0c1017] border border-[#182232] rounded-xl p-3 sm:p-4 flex flex-col justify-between hover:border-slate-700 transition-all ${className}`}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs font-medium text-slate-400 font-mono uppercase tracking-wider block">
            {label}
          </span>
          {sublabel && (
            <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
              {sublabel}
            </span>
          )}
        </div>
        {badge}
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold tracking-tight font-mono text-slate-100">
          {value}
        </span>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-mono font-medium ${
              trend === 'up'
                ? 'text-[#00f0ff]'
                : trend === 'down'
                ? 'text-rose-400'
                : 'text-slate-400'
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

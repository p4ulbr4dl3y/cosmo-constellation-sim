import React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'cyan' | 'lime' | 'emerald' | 'amber' | 'red' | 'blue' | 'neutral'
}

export const Badge: React.FC<BadgeProps> = ({
  className = '',
  variant = 'neutral',
  children,
  ...props
}) => {
  const variantStyles = {
    cyan: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    lime: 'bg-lime-500/10 text-lime-300 border-lime-500/30',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    red: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    blue: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    neutral: 'bg-white/[0.04] text-zinc-300 border-white/10',
  }[variant]

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}

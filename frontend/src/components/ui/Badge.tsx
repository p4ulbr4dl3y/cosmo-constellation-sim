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
    cyan: 'bg-[#00f0ff]/12 text-[#00f0ff] border-[#00f0ff]/35',
    lime: 'bg-[#00f0ff]/12 text-[#00f0ff] border-[#00f0ff]/35',
    emerald: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60',
    amber: 'bg-amber-950/60 text-amber-300 border-amber-700/60',
    red: 'bg-rose-950/60 text-rose-300 border-rose-700/60',
    blue: 'bg-blue-950/60 text-blue-300 border-blue-700/60',
    neutral: 'bg-white/5 text-slate-300 border-white/10',
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

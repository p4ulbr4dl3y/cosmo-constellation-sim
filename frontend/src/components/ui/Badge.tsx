import React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'lime' | 'emerald' | 'amber' | 'red' | 'blue' | 'neutral'
}

export const Badge: React.FC<BadgeProps> = ({
  className = '',
  variant = 'neutral',
  children,
  ...props
}) => {
  const variantStyles = {
    lime: 'bg-[#c4f042]/15 text-[#c4f042] border-[#c4f042]/40',
    emerald: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60',
    amber: 'bg-amber-950/60 text-amber-300 border-amber-700/60',
    red: 'bg-red-950/60 text-red-300 border-red-700/60',
    blue: 'bg-blue-950/60 text-blue-300 border-blue-700/60',
    neutral: 'bg-[#121824] text-slate-300 border-[#1d273a]',
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

import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'outline', size = 'md', children, disabled, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-mono font-medium select-none transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer'

    const sizeStyles = {
      sm: 'text-xs px-2.5 py-1 rounded-lg gap-1.5 h-7',
      md: 'text-xs px-3 py-1.5 rounded-lg gap-2 h-8',
      lg: 'text-sm px-4 py-2 rounded-xl gap-2 h-10',
      icon: 'p-1.5 rounded-lg w-8 h-8 flex items-center justify-center',
    }[size]

    const variantStyles = {
      primary:
        'bg-[#00f0ff] text-black font-semibold hover:bg-[#38bdf8] shadow-sm shadow-[#00f0ff]/20 border border-[#00f0ff]',
      secondary:
        'bg-[#121824] hover:bg-[#182030] text-slate-200 border border-[#1d273a]',
      outline:
        'bg-[#0c1017] hover:bg-[#121824] hover:border-slate-600 text-slate-300 hover:text-white border border-[#1d273a]',
      ghost:
        'bg-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200 border border-transparent',
      danger:
        'bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60',
    }[variant]

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`${base} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

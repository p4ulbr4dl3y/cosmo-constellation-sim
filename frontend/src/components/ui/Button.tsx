import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent' | 'success'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'outline', size = 'md', children, disabled, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-medium select-none transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none cursor-pointer'

    const sizeStyles = {
      sm: 'text-xs px-2.5 py-1 rounded-md gap-1.5 h-7',
      md: 'text-xs px-3 py-1.5 rounded-md gap-2 h-8',
      lg: 'text-sm px-4 py-2 rounded-lg gap-2 h-9',
      icon: 'p-1.5 rounded-md w-7 h-7',
    }[size]

    const variantStyles = {
      primary:
        'bg-white/12 hover:bg-white/18 text-white font-medium border border-white/20 shadow-sm',
      secondary:
        'bg-white/[0.06] hover:bg-white/10 text-zinc-200 border border-white/12',
      outline:
        'bg-white/[0.03] hover:bg-white/[0.07] text-zinc-300 hover:text-white border border-[#1a2636]',
      ghost:
        'bg-transparent hover:bg-white/[0.05] text-zinc-400 hover:text-zinc-200 border border-transparent',
      accent:
        'bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border border-sky-500/35 shadow-sm',
      danger:
        'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30',
      success:
        'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30',
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

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
      sm: 'text-xs px-2.5 py-1 rounded-md gap-1.5 h-7',
      md: 'text-xs px-3 py-1.5 rounded-lg gap-2 h-8',
      lg: 'text-sm px-4 py-2 rounded-xl gap-2 h-10',
      icon: 'p-1.5 rounded-md w-7 h-7 flex items-center justify-center',
    }[size]

    const variantStyles = {
      primary:
        'bg-white/15 hover:bg-white/20 text-white font-semibold border border-white/20',
      secondary:
        'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15',
      outline:
        'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10',
      ghost:
        'bg-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200 border border-transparent',
      danger:
        'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60',
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

import React from 'react'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'accent'
  noPadding?: boolean
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', noPadding = false, children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-[#0c1017] border-white/[0.08] text-slate-100',
      subtle: 'bg-[#090d14] border-white/[0.05] text-slate-200',
      accent: 'bg-sky-500/10 border-sky-500/30 text-slate-100',
    }[variant]

    return (
      <div
        ref={ref}
        className={`rounded-lg border transition-colors ${noPadding ? '' : 'p-3 sm:p-4'} ${variantStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = 'Card'

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader: React.FC<CardHeaderProps> = ({ className = '', children, ...props }) => (
  <div className={`flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-white/[0.08] ${className}`} {...props}>
    {children}
  </div>
)

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle: React.FC<CardTitleProps> = ({ className = '', children, ...props }) => (
  <h3 className={`text-xs font-medium uppercase tracking-wider text-slate-300 flex items-center gap-2 ${className}`} {...props}>
    {children}
  </h3>
)

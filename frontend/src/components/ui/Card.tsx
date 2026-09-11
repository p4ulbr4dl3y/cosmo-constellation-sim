import React from 'react'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'accent'
  noPadding?: boolean
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', noPadding = false, children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-[#0c1017] border-[#182232] text-slate-100 shadow-sm',
      subtle: 'bg-[#080b11] border-[#141b26] text-slate-200',
      accent: 'bg-[#c4f042] border-[#c4f042] text-black shadow-lg shadow-[#c4f042]/10',
    }[variant]

    return (
      <div
        ref={ref}
        className={`rounded-xl border transition-colors ${noPadding ? '' : 'p-3 sm:p-4'} ${variantStyles} ${className}`}
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
  <div className={`flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[#182232] ${className}`} {...props}>
    {children}
  </div>
)

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle: React.FC<CardTitleProps> = ({ className = '', children, ...props }) => (
  <h3 className={`text-xs font-mono font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2 ${className}`} {...props}>
    {children}
  </h3>
)

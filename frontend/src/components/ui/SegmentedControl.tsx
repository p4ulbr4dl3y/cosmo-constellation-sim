import React from 'react'

export interface SegmentedOption<T extends string | number> {
  value: T
  label: React.ReactNode
  title?: string
  icon?: React.ReactNode
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string | number> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: SegmentedControlProps<T>) {
  const sizeStyles = {
    sm: 'text-[11px] h-6 p-0.5 rounded-md gap-0.5',
    md: 'text-xs h-7 p-0.5 rounded-lg gap-1',
  }[size]

  const itemSizeStyles = {
    sm: 'px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-[11px]',
    md: 'px-1.5 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs',
  }[size]

  return (
    <div
      role="group"
      className={`inline-flex items-center bg-[#070b10] border border-[#1a2636] font-sans select-none shrink-0 ${sizeStyles} ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value
        return (
          <button
            key={String(opt.value)}
            type="button"
            disabled={opt.disabled}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center justify-center gap-1 font-medium transition-all cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none ${itemSizeStyles} ${
              isSelected
                ? 'bg-white/15 text-white shadow-xs font-medium'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

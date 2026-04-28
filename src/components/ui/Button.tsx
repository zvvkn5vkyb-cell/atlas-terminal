import type { ReactNode, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'default' | 'ghost' | 'amber' | 'danger'
  size?: 'sm' | 'xs' | 'md'
}

const variantClasses: Record<string, string> = {
  default: 'bg-terminalElevated border border-terminalBorder text-terminalText hover:border-terminalStrongBorder hover:bg-terminalPanel',
  ghost: 'bg-transparent border border-transparent text-terminalSubtext hover:text-terminalText hover:bg-terminalElevated',
  amber: 'bg-terminalAmber/10 border border-terminalAmber/30 text-terminalAmber hover:bg-terminalAmber/20',
  danger: 'bg-terminalRed/10 border border-terminalRed/30 text-terminalRed hover:bg-terminalRed/20',
}

const sizeClasses: Record<string, string> = {
  xs: 'text-xs px-2 py-0.5',
  sm: 'text-xs px-2.5 py-1',
  md: 'text-sm px-3 py-1.5',
}

export function Button({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-1 font-mono rounded-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

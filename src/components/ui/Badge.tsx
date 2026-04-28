import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'green' | 'red' | 'amber' | 'blue' | 'muted' | 'cyan'
  size?: 'sm' | 'xs'
  className?: string
}

const variantClasses: Record<string, string> = {
  default: 'bg-terminalBorder text-terminalSubtext',
  green: 'bg-terminalGreen/10 text-terminalGreen border border-terminalGreen/20',
  red: 'bg-terminalRed/10 text-terminalRed border border-terminalRed/20',
  amber: 'bg-terminalAmber/10 text-terminalAmber border border-terminalAmber/20',
  blue: 'bg-terminalBlue/10 text-terminalBlue border border-terminalBlue/20',
  muted: 'bg-terminalMuted/10 text-terminalMuted border border-terminalMuted/20',
  cyan: 'bg-terminalCyan/10 text-terminalCyan border border-terminalCyan/20',
}

export function Badge({ children, variant = 'default', size = 'sm', className = '' }: BadgeProps) {
  const sizeClass = size === 'xs' ? 'text-2xs px-1 py-0' : 'text-xs px-1.5 py-0.5'
  return (
    <span className={`inline-flex items-center font-mono uppercase tracking-wide rounded-sm ${sizeClass} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  )
}

import type { ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  action?: ReactNode
  className?: string
}

export function SectionHeader({ title, action, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between px-3 py-1.5 border-b border-terminalBorder ${className}`}>
      <span className="text-2xs text-terminalMuted uppercase tracking-widest font-mono">{title}</span>
      {action && <div className="text-xs text-terminalSubtext">{action}</div>}
    </div>
  )
}

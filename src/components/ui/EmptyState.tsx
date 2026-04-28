interface EmptyStateProps {
  message?: string
  subMessage?: string
  className?: string
}

export function EmptyState({ message = 'No data available', subMessage, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-8 gap-1 ${className}`}>
      <span className="text-xs text-terminalMuted font-mono">{message}</span>
      {subMessage && <span className="text-2xs text-terminalMuted/60 font-mono">{subMessage}</span>}
    </div>
  )
}

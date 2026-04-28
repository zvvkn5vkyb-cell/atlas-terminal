interface LoadingStateProps {
  message?: string
  className?: string
}

export function LoadingState({ message = 'Loading...', className = '' }: LoadingStateProps) {
  return (
    <div className={`flex items-center justify-center py-8 text-terminalMuted text-xs font-mono ${className}`}>
      <span className="animate-pulse">{message}</span>
    </div>
  )
}

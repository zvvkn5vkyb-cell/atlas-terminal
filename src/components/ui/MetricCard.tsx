interface MetricCardProps {
  label: string
  value: string
  subvalue?: string
  subvalueClass?: string
  note?: string
  className?: string
}

export function MetricCard({ label, value, subvalue, subvalueClass, note, className = '' }: MetricCardProps) {
  return (
    <div className={`bg-terminalElevated border border-terminalBorder p-2.5 ${className}`}>
      <div className="text-2xs text-terminalMuted uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm font-mono text-terminalText">{value}</div>
      {subvalue && (
        <div className={`text-xs font-mono mt-0.5 ${subvalueClass ?? 'text-terminalSubtext'}`}>
          {subvalue}
        </div>
      )}
      {note && (
        <div className="text-2xs text-terminalMuted mt-1">{note}</div>
      )}
    </div>
  )
}

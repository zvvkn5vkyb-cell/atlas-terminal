import type { TrustMode } from '@/types/market'
import { trustModeLabel, trustModeBgClass } from '@/lib/analytics/trustMode'

interface DegradedDataBadgeProps {
  trustMode: TrustMode
  className?: string
}

export function DegradedDataBadge({ trustMode, className = '' }: DegradedDataBadgeProps) {
  if (trustMode === 'TRUSTED') return null
  return (
    <span
      className={`inline-flex items-center text-2xs font-mono uppercase tracking-wide px-1 py-0 border rounded-sm ${trustModeBgClass(trustMode)} ${className}`}
    >
      {trustModeLabel(trustMode)}
    </span>
  )
}

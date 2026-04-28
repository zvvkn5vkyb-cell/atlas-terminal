import { usePortfolioRisk } from '@/hooks/usePortfolioRisk'
import { SectionHeader } from '@/components/ui/SectionHeader'
import type { RiskFlag } from '@/types/portfolio'

const severityClass: Record<string, string> = {
  CRITICAL: 'text-terminalRed border-terminalRed/40 bg-terminalRed/10',
  HIGH: 'text-terminalRed border-terminalRed/30 bg-terminalRed/8',
  MEDIUM: 'text-terminalAmber border-terminalAmber/30 bg-terminalAmber/8',
  LOW: 'text-terminalMuted border-terminalMuted/30 bg-terminalMuted/8',
}

function RiskFlagRow({ flag }: { flag: RiskFlag }) {
  return (
    <div className="flex items-start gap-2 px-3 py-1.5 border-b border-terminalBorder/40 last:border-0">
      <span
        className={`text-2xs font-mono uppercase px-1 py-0 border rounded-sm shrink-0 mt-0.5 ${severityClass[flag.severity]}`}
      >
        {flag.severity}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-2xs text-terminalMuted font-mono uppercase">{flag.category}</div>
        <div className="text-xs text-terminalText font-mono leading-tight">{flag.message}</div>
      </div>
    </div>
  )
}

export function RiskFlagsBlock() {
  const { riskFlags } = usePortfolioRisk()

  return (
    <div className="bg-terminalPanel border border-terminalBorder">
      <SectionHeader
        title="Risk Flags"
        action={
          <span className={riskFlags.length > 0 ? 'text-terminalAmber' : 'text-terminalGreen'}>
            {riskFlags.length} active
          </span>
        }
      />
      {riskFlags.length === 0 ? (
        <div className="px-3 py-3 text-xs text-terminalGreen font-mono">No active risk flags</div>
      ) : (
        riskFlags.map(flag => <RiskFlagRow key={flag.id} flag={flag} />)
      )}
    </div>
  )
}

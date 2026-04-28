import { usePortfolioRisk } from '@/hooks/usePortfolioRisk'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { trustModeLabel, trustModeBgClass } from '@/lib/analytics/trustMode'

export function IntegrityBlock() {
  const risk = usePortfolioRisk()
  const { volatility, beta, drawdown, overallTrustMode } = risk

  const metrics = [
    { label: 'Volatility', trustMode: volatility.trustMode, note: `${volatility.dailyReturnsUsed} days` },
    { label: 'Beta', trustMode: beta.trustMode, note: `${beta.overlapDays} overlap days` },
    { label: 'Drawdown', trustMode: drawdown.trustMode, note: '' },
    { label: 'Overall', trustMode: overallTrustMode, note: '' },
  ]

  return (
    <div className="bg-terminalPanel border border-terminalBorder">
      <SectionHeader title="Data Integrity" />
      {metrics.map(m => (
        <div key={m.label} className="flex items-center px-3 py-1.5 border-b border-terminalBorder/40 last:border-0">
          <span className="text-xs font-mono text-terminalSubtext flex-1">{m.label}</span>
          {m.note && (
            <span className="text-2xs font-mono text-terminalMuted mr-2">{m.note}</span>
          )}
          <span
            className={`text-2xs font-mono uppercase px-1.5 py-0.5 border rounded-sm ${trustModeBgClass(m.trustMode)}`}
          >
            {trustModeLabel(m.trustMode)}
          </span>
        </div>
      ))}
    </div>
  )
}

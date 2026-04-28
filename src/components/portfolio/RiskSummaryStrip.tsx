import { usePortfolioRisk } from '@/hooks/usePortfolioRisk'
import { formatPct, pnlClass } from '@/lib/format'
import { DegradedDataBadge } from '@/components/ui/DegradedDataBadge'

export function RiskSummaryStrip() {
  const risk = usePortfolioRisk()
  const { concentration, drawdown, volatility, beta } = risk

  const concClass =
    concentration.level === 'HIGH'
      ? 'text-terminalRed'
      : concentration.level === 'MEDIUM'
        ? 'text-terminalAmber'
        : 'text-terminalGreen'

  return (
    <div className="flex items-stretch border-b border-terminalBorder bg-terminalPanel divide-x divide-terminalBorder">
      <div className="px-3 py-1.5">
        <div className="text-2xs text-terminalMuted font-mono uppercase mb-0.5">Concentration</div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-medium ${concClass}`}>
            {concentration.level}
          </span>
          <span className="text-2xs font-mono text-terminalMuted">
            T3: {formatPct(concentration.top3Pct * 100, 1)}
          </span>
        </div>
      </div>

      <div className="px-3 py-1.5">
        <div className="text-2xs text-terminalMuted font-mono uppercase mb-0.5">Drawdown</div>
        {drawdown.trustMode === 'TRUSTED' ? (
          <span className={`text-xs font-mono font-medium ${pnlClass(drawdown.currentDrawdown)}`}>
            {formatPct(drawdown.currentDrawdown * 100)}
          </span>
        ) : (
          <DegradedDataBadge trustMode={drawdown.trustMode} />
        )}
      </div>

      <div className="px-3 py-1.5">
        <div className="text-2xs text-terminalMuted font-mono uppercase mb-0.5">Ann. Vol</div>
        {volatility.trustMode === 'TRUSTED' && volatility.annualizedVol != null ? (
          <span className="text-xs font-mono text-terminalCyan">
            {formatPct(volatility.annualizedVol * 100)}
          </span>
        ) : (
          <DegradedDataBadge trustMode={volatility.trustMode} />
        )}
      </div>

      <div className="px-3 py-1.5">
        <div className="text-2xs text-terminalMuted font-mono uppercase mb-0.5">Beta (SPY)</div>
        {beta.trustMode === 'TRUSTED' && beta.beta != null ? (
          <span className="text-xs font-mono text-terminalCyan">
            {beta.beta.toFixed(2)}
          </span>
        ) : (
          <DegradedDataBadge trustMode={beta.trustMode} />
        )}
      </div>

      <div className="px-3 py-1.5">
        <div className="text-2xs text-terminalMuted font-mono uppercase mb-0.5">Risk Flags</div>
        <span className={`text-xs font-mono font-medium ${risk.riskFlags.length > 0 ? 'text-terminalAmber' : 'text-terminalGreen'}`}>
          {risk.riskFlags.length} active
        </span>
      </div>

      <div className="px-3 py-1.5 ml-auto">
        <DegradedDataBadge trustMode={risk.overallTrustMode} />
      </div>
    </div>
  )
}

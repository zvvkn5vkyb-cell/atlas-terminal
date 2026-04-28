import { usePortfolioAnalytics } from '@/hooks/usePortfolioAnalytics'
import { formatCurrency, formatPct, pnlClass } from '@/lib/format'

export function SummaryStrip() {
  const { summary } = usePortfolioAnalytics()

  return (
    <div className="flex items-stretch border-b border-terminalBorder bg-terminalPanel divide-x divide-terminalBorder">
      <div className="px-3 py-1.5">
        <div className="text-2xs text-terminalMuted font-mono uppercase">Total Value</div>
        <div className="text-sm font-mono text-terminalText">
          {formatCurrency(summary.totalValue)}
        </div>
      </div>

      <div className="px-3 py-1.5">
        <div className="text-2xs text-terminalMuted font-mono uppercase">Total Cost</div>
        <div className="text-sm font-mono text-terminalSubtext">
          {formatCurrency(summary.totalCost)}
        </div>
      </div>

      <div className="px-3 py-1.5">
        <div className="text-2xs text-terminalMuted font-mono uppercase">Unrealized P&amp;L</div>
        <div className={`text-sm font-mono font-medium ${pnlClass(summary.totalUnrealizedPnL)}`}>
          {formatCurrency(summary.totalUnrealizedPnL, 'USD', true)}{' '}
          <span className="text-xs">({formatPct(summary.totalUnrealizedPnLPct * 100)})</span>
        </div>
      </div>

      <div className="px-3 py-1.5">
        <div className="text-2xs text-terminalMuted font-mono uppercase">Day Change</div>
        <div className={`text-sm font-mono font-medium ${pnlClass(summary.totalDayChange)}`}>
          {formatCurrency(summary.totalDayChange, 'USD', true)}{' '}
          <span className="text-xs">({formatPct(summary.totalDayChangePct * 100)})</span>
        </div>
      </div>

      <div className="px-3 py-1.5">
        <div className="text-2xs text-terminalMuted font-mono uppercase">Cash</div>
        <div className="text-sm font-mono text-terminalSubtext">
          {formatCurrency(summary.cashTotal, 'USD', true)}{' '}
          <span className="text-xs text-terminalMuted">({formatPct(summary.cashPct * 100, 1)})</span>
        </div>
      </div>

      <div className="px-3 py-1.5">
        <div className="text-2xs text-terminalMuted font-mono uppercase">Holdings</div>
        <div className="text-sm font-mono text-terminalSubtext">{summary.holdingCount}</div>
      </div>
    </div>
  )
}

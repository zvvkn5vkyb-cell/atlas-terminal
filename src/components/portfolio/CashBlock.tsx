import { usePortfolioStore } from '@/store/portfolioStore'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { formatCurrency, formatPct } from '@/lib/format'

export function CashBlock() {
  const { cashPositions, summary } = usePortfolioStore()

  return (
    <div className="bg-terminalPanel border border-terminalBorder">
      <SectionHeader title="Cash" action={<span>{formatPct(summary.cashPct * 100, 1)} of NAV</span>} />
      {cashPositions.map(c => (
        <div
          key={c.currency}
          className="flex items-center px-3 py-2 border-b border-terminalBorder/40 last:border-0"
        >
          <span className="text-xs font-mono text-terminalAmber w-10 shrink-0">{c.currency}</span>
          <span className="text-xs font-mono text-terminalText tabular-nums">
            {formatCurrency(c.amount, c.currency)}
          </span>
          <span className="text-xs font-mono text-terminalMuted ml-auto tabular-nums">
            ≈ {formatCurrency(c.usdEquivalent, 'USD', true)}
          </span>
        </div>
      ))}
      <div className="flex items-center px-3 py-2 bg-terminalElevated">
        <span className="text-xs font-mono text-terminalMuted">Total Cash (USD eq.)</span>
        <span className="text-xs font-mono text-terminalText tabular-nums ml-auto">
          {formatCurrency(summary.cashTotal)}
        </span>
      </div>
    </div>
  )
}

import { usePortfolioStore } from '@/store/portfolioStore'
import { usePortfolioAnalytics } from '@/hooks/usePortfolioAnalytics'
import { formatPct, formatCurrency, pnlClass } from '@/lib/format'
import { DegradedDataBadge } from '@/components/ui/DegradedDataBadge'
import type { Timeframe } from '@/types/portfolio'

const TIMEFRAMES: Timeframe[] = ['1D', '7D', '30D', '90D', 'YTD', 'SI']

export function PerformanceStrip() {
  const { activeTimeframe, setActiveTimeframe } = usePortfolioStore()
  const { performance, summary } = usePortfolioAnalytics()

  return (
    <div className="flex items-stretch border-b border-terminalBorder bg-terminalPanel">
      {/* Timeframe selector */}
      <div className="flex items-center border-r border-terminalBorder px-1 gap-0.5">
        {TIMEFRAMES.map(tf => (
          <button
            key={tf}
            onClick={() => setActiveTimeframe(tf)}
            className={`px-2 py-1 text-xs font-mono transition-colors ${
              activeTimeframe === tf
                ? 'text-terminalAmber bg-terminalAmber/10 border-b border-terminalAmber'
                : 'text-terminalMuted hover:text-terminalText'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Metrics */}
      <div className="flex items-center divide-x divide-terminalBorder flex-1">
        <div className="px-3 py-1">
          <div className="text-2xs text-terminalMuted font-mono uppercase">Portfolio Return</div>
          <div className={`text-sm font-mono font-medium ${pnlClass(performance.portfolioReturn)}`}>
            {formatPct(performance.portfolioReturn * 100)}
          </div>
        </div>

        <div className="px-3 py-1">
          <div className="text-2xs text-terminalMuted font-mono uppercase">vs SPY</div>
          <div className={`text-sm font-mono font-medium ${pnlClass(performance.alpha)}`}>
            {formatPct(performance.alpha * 100)} alpha
          </div>
        </div>

        <div className="px-3 py-1">
          <div className="text-2xs text-terminalMuted font-mono uppercase">Benchmark (SPY)</div>
          <div className={`text-sm font-mono font-medium ${pnlClass(performance.benchmarkReturn)}`}>
            {formatPct(performance.benchmarkReturn * 100)}
          </div>
        </div>

        <div className="px-3 py-1">
          <div className="text-2xs text-terminalMuted font-mono uppercase">Total NAV</div>
          <div className="text-sm font-mono text-terminalText">
            {formatCurrency(summary.totalValue, 'USD', true)}
          </div>
        </div>

        <div className="px-3 py-1">
          <div className="text-2xs text-terminalMuted font-mono uppercase">Day P&amp;L</div>
          <div className={`text-sm font-mono font-medium ${pnlClass(summary.totalDayChange)}`}>
            {formatCurrency(summary.totalDayChange, 'USD', true)}
          </div>
        </div>

        {performance.trustMode !== 'TRUSTED' && (
          <div className="px-3 py-1 ml-auto">
            <DegradedDataBadge trustMode={performance.trustMode} />
          </div>
        )}
      </div>
    </div>
  )
}

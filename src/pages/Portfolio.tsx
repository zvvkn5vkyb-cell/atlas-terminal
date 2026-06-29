import { usePortfolioStore } from '@/store/portfolioStore'
import { PerformanceStrip } from '@/components/portfolio/PerformanceStrip'
import { RiskSummaryStrip } from '@/components/portfolio/RiskSummaryStrip'
import { SummaryStrip } from '@/components/portfolio/SummaryStrip'
import { HoldingsTable } from '@/components/portfolio/HoldingsTable'
import { TopContributors } from '@/components/portfolio/TopContributors'
import { AllocationBlock } from '@/components/portfolio/AllocationBlock'
import { CashBlock } from '@/components/portfolio/CashBlock'
import { IntegrityBlock } from '@/components/portfolio/IntegrityBlock'
import { RiskFlagsBlock } from '@/components/portfolio/RiskFlagsBlock'
import { ReconciliationPanel } from '@/components/portfolio/ReconciliationPanel'
import { formatDateTime } from '@/lib/format'

function PriceRefreshBar() {
  const { isRefreshing, lastPriceRefresh, priceSourceMap, refreshPrices, holdings } =
    usePortfolioStore()

  const total = holdings.length
  const liveCount = Object.values(priceSourceMap).filter(s => s === 'LIVE').length
  const fallbackCount = Object.values(priceSourceMap).filter(s => s === 'FALLBACK').length
  const canadaCount = Object.values(priceSourceMap).filter(s => s === 'CANADA').length
  const hasRefreshed = lastPriceRefresh !== null
  const hasLive = liveCount > 0
  const dataMode = hasLive ? 'HYBRID' : 'MOCK'

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-terminalBorder bg-terminalElevated shrink-0 overflow-x-auto">
      <button
        onClick={() => void refreshPrices()}
        disabled={isRefreshing}
        className="shrink-0 text-2xs font-mono text-terminalAmber border border-terminalAmber/40 px-2 py-0.5 hover:bg-terminalAmber/10 disabled:opacity-40 transition-colors"
      >
        {isRefreshing ? '↻ Refreshing…' : '↺ Refresh Prices'}
      </button>

      <span className="text-terminalBorder shrink-0">|</span>

      {!hasRefreshed ? (
        <span className="text-2xs font-mono text-terminalMuted">
          Prices are mock — click Refresh to fetch live quotes
        </span>
      ) : (
        <>
          <span className="text-2xs font-mono text-terminalMuted shrink-0">
            Last: <span className="text-terminalSubtext">{formatDateTime(lastPriceRefresh!)}</span>
          </span>

          <span className="text-terminalBorder shrink-0">|</span>

          <span className="text-2xs font-mono text-terminalMuted shrink-0">
            {liveCount > 0 && (
              <span className="text-terminalGreen">{liveCount} LIVE</span>
            )}
            {liveCount > 0 && (fallbackCount > 0 || canadaCount > 0) && <span> · </span>}
            {fallbackCount > 0 && (
              <span className="text-terminalAmber">{fallbackCount} FALLBACK</span>
            )}
            {fallbackCount > 0 && canadaCount > 0 && <span> · </span>}
            {canadaCount > 0 && (
              <span className="text-terminalAmber">{canadaCount} CANADA N/C</span>
            )}
            {liveCount === 0 && fallbackCount === 0 && canadaCount === 0 && (
              <span className="text-terminalMuted">{total} MOCK</span>
            )}
            <span className="text-terminalMuted"> / {total}</span>
          </span>

          <span className="text-terminalBorder shrink-0">|</span>

          <span className="text-2xs font-mono text-terminalMuted shrink-0">
            DATA MODE:{' '}
            <span className={hasLive ? 'text-terminalCyan' : 'text-terminalAmber'}>
              {dataMode}
            </span>
          </span>

          {canadaCount > 0 && (
            <>
              <span className="text-terminalBorder shrink-0">|</span>
              <span className="text-2xs font-mono text-terminalMuted/60 shrink-0">
                Canadian provider not configured — {canadaCount} holding{canadaCount !== 1 ? 's' : ''} using mock fallback
              </span>
            </>
          )}
        </>
      )}
    </div>
  )
}

export function Portfolio() {
  return (
    <div className="flex flex-col h-full">
      <PerformanceStrip />
      <RiskSummaryStrip />
      <SummaryStrip />
      <PriceRefreshBar />

      <div className="flex-1 flex flex-col gap-2 p-2 overflow-y-auto">
        <HoldingsTable />

        <div className="grid grid-cols-3 gap-2">
          <TopContributors />
          <AllocationBlock />
          <div className="flex flex-col gap-2">
            <CashBlock />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <IntegrityBlock />
          <RiskFlagsBlock />
        </div>

        <ReconciliationPanel />
      </div>
    </div>
  )
}

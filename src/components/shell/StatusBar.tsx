import { useSystemStore } from '@/store/systemStore'
import { usePortfolioStore } from '@/store/portfolioStore'
import { useMarketStore } from '@/store/marketStore'
import { formatCurrency, formatDateTime } from '@/lib/format'

export function StatusBar() {
  const { status, providerHealth } = useSystemStore()
  const { summary } = usePortfolioStore()
  const { dataSource } = useMarketStore()

  const upCount = providerHealth.filter(p => p.status === 'UP').length
  const totalCount = providerHealth.length

  return (
    <footer className="flex items-center h-6 px-3 border-t border-terminalBorder bg-terminalSidebar shrink-0 gap-4 overflow-hidden">
      <span className="text-2xs font-mono text-terminalMuted">
        ATLAS TERMINAL v0.1
      </span>

      <span className="text-terminalBorder">|</span>

      <span className="text-2xs font-mono text-terminalMuted">
        PROVIDERS: {upCount}/{totalCount}
      </span>

      <span className="text-terminalBorder">|</span>

      <span className="text-2xs font-mono text-terminalMuted">
        NAV: <span className="text-terminalText">{formatCurrency(summary.totalValue, 'USD', true)}</span>
      </span>

      <span className="text-terminalBorder">|</span>

      <span className="text-2xs font-mono text-terminalMuted">
        HOLDINGS: <span className="text-terminalText">{summary.holdingCount}</span>
      </span>

      <div className="flex-1" />

      {dataSource === 'HYBRID' ? (
        <>
          <span className="text-2xs font-mono text-terminalMuted">
            DATA MODE: <span className="text-terminalCyan">HYBRID</span>
          </span>
          <span className="text-terminalBorder">|</span>
          <span className="text-2xs font-mono text-terminalMuted">
            US EQUITIES: <span className="text-terminalGreen">POLYGON</span>
          </span>
          <span className="text-terminalBorder">|</span>
          <span className="text-2xs font-mono text-terminalMuted">
            CANADA: <span className="text-terminalAmber">NOT CONFIGURED</span>
          </span>
          <span className="text-terminalBorder">|</span>
          <span className="text-2xs font-mono text-terminalMuted">
            OTHER FEEDS: <span className="text-terminalAmber">MOCK</span>
          </span>
        </>
      ) : dataSource === 'LIVE' ? (
        <span className="text-2xs font-mono text-terminalMuted">
          DATA MODE: <span className="text-terminalGreen">LIVE</span>
        </span>
      ) : (
        <>
          <span className="text-2xs font-mono text-terminalMuted">
            DATA MODE: <span className="text-terminalAmber">MOCK</span>
          </span>
          <span className="text-terminalBorder">|</span>
          <span className="text-2xs font-mono text-terminalMuted">
            US EQUITIES: <span className="text-terminalAmber">MOCK</span>
          </span>
          <span className="text-terminalBorder">|</span>
          <span className="text-2xs font-mono text-terminalMuted">
            CANADA: <span className="text-terminalAmber">NOT CONFIGURED</span>
          </span>
          <span className="text-terminalBorder">|</span>
          <span className="text-2xs font-mono text-terminalMuted">
            OTHER FEEDS: <span className="text-terminalAmber">MOCK</span>
          </span>
        </>
      )}

      <span className="text-terminalBorder">|</span>

      <span className="text-2xs font-mono text-terminalMuted">
        AS OF: {formatDateTime(status.dataAsOf)}
      </span>
    </footer>
  )
}

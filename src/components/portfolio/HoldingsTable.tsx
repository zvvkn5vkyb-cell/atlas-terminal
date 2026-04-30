import { usePortfolioStore } from '@/store/portfolioStore'
import type { PriceSource } from '@/store/portfolioStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { DataTable } from '@/components/ui/DataTable'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { formatCurrency, formatPct, formatNumber, pnlClass } from '@/lib/format'
import type { Holding } from '@/types/portfolio'
import type { Column } from '@/components/ui/DataTable'

function PriceSourceBadge({ source }: { source: PriceSource }) {
  if (source === 'LIVE') {
    return (
      <span className="text-2xs font-mono text-terminalGreen border border-terminalGreen/40 px-1 py-0">
        LIVE
      </span>
    )
  }
  if (source === 'CANADA') {
    return (
      <span className="text-2xs font-mono text-terminalAmber border border-terminalAmber/40 px-1 py-0">
        CANADA N/C
      </span>
    )
  }
  if (source === 'FALLBACK') {
    return (
      <span className="text-2xs font-mono text-terminalAmber border border-terminalAmber/40 px-1 py-0">
        FALLBACK
      </span>
    )
  }
  return (
    <span className="text-2xs font-mono text-terminalMuted border border-terminalMuted/30 px-1 py-0">
      MOCK
    </span>
  )
}

export function HoldingsTable() {
  const { holdings, priceSourceMap } = usePortfolioStore()
  const { navigateToSymbol } = useWorkspaceStore()

  const columns: Column<Holding>[] = [
    {
      key: 'symbol',
      header: 'Symbol',
      render: (h) => (
        <span className="text-terminalAmber font-mono font-medium">{h.symbol}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (h) => (
        <span className="text-terminalSubtext truncate max-w-36 block">{h.name}</span>
      ),
    },
    {
      key: 'currency',
      header: 'Ccy',
      render: (h) => <span className="text-terminalMuted">{h.currency}</span>,
    },
    {
      key: 'sector',
      header: 'Sector',
      render: (h) => <span className="text-terminalSubtext">{h.sector}</span>,
    },
    {
      key: 'shares',
      header: 'Shares',
      align: 'right',
      render: (h) => <span className="tabular-nums">{formatNumber(h.shares, 0)}</span>,
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      render: (h) => <span className="tabular-nums">{formatNumber(h.currentPrice, 2)}</span>,
    },
    {
      key: 'value',
      header: 'Market Value',
      align: 'right',
      render: (h) => (
        <span className="tabular-nums">{formatCurrency(h.currentValue, h.currency)}</span>
      ),
    },
    {
      key: 'weight',
      header: 'Weight',
      align: 'right',
      render: (h) => (
        <span className="tabular-nums text-terminalSubtext">{formatPct(h.weight * 100, 1)}</span>
      ),
    },
    {
      key: 'dayChange',
      header: 'Day Chg',
      align: 'right',
      render: (h) => (
        <span className={`tabular-nums ${pnlClass(h.dayChange)}`}>
          {formatPct(h.dayChangePct, 2)}
        </span>
      ),
    },
    {
      key: 'unrealized',
      header: 'Unrealized',
      align: 'right',
      render: (h) => (
        <div className="text-right">
          <div className={`tabular-nums ${pnlClass(h.unrealizedPnL)}`}>
            {formatCurrency(h.unrealizedPnL, h.currency, true)}
          </div>
          <div className={`text-2xs ${pnlClass(h.unrealizedPnLPct)}`}>
            {formatPct(h.unrealizedPnLPct, 1)}
          </div>
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Src',
      render: (h) => <PriceSourceBadge source={priceSourceMap[h.symbol] ?? 'MOCK'} />,
    },
  ]

  return (
    <div className="bg-terminalPanel border border-terminalBorder">
      <SectionHeader title="Holdings" action={<span>{holdings.length} positions</span>} />
      <DataTable
        columns={columns}
        rows={holdings}
        rowKey={(h) => h.id}
        onRowClick={(h) => navigateToSymbol(h.symbol)}
      />
    </div>
  )
}

import { useEffect } from 'react'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useMarketStore } from '@/store/marketStore'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { MetricCard } from '@/components/ui/MetricCard'
import { formatNumber, formatCompact, formatDateTime, pnlClass, formatPct } from '@/lib/format'
import type { Quote } from '@/types/market'

const CANADIAN_SUFFIX = /\.(TO|TSX|V)$/i

function QuoteProvenanceBadge({ quote, symbol }: { quote: Quote; symbol: string }) {
  const isLive = quote.trustMode === 'TRUSTED' && quote.exchange === 'Polygon.io'
  const isCanadian = CANADIAN_SUFFIX.test(symbol)

  if (isLive) {
    return (
      <span className="text-2xs font-mono text-terminalGreen border border-terminalGreen/40 px-1.5 py-0.5">
        QUOTE: LIVE
      </span>
    )
  }

  if (quote.trustMode === 'DEGRADED' && isCanadian) {
    return (
      <span className="text-2xs font-mono text-terminalAmber border border-terminalAmber/40 px-1.5 py-0.5">
        QUOTE: FALLBACK
      </span>
    )
  }

  if (quote.trustMode === 'DEGRADED') {
    return (
      <span className="text-2xs font-mono text-terminalAmber border border-terminalAmber/40 px-1.5 py-0.5">
        QUOTE: DEGRADED
      </span>
    )
  }

  return (
    <span className="text-2xs font-mono text-terminalMuted border border-terminalMuted/30 px-1.5 py-0.5">
      QUOTE: MOCK
    </span>
  )
}

function FallbackReason({ quote, symbol }: { quote: Quote; symbol: string }) {
  if (quote.trustMode !== 'DEGRADED') return null

  if (CANADIAN_SUFFIX.test(symbol)) {
    return (
      <div className="text-2xs font-mono text-terminalMuted/70 mt-0.5">
        Polygon US equities endpoint does not support this symbol
      </div>
    )
  }

  return null
}

export function SecurityDetail() {
  const { activeSymbol } = useWorkspaceStore()
  const { quoteCache, loadQuote } = useMarketStore()

  useEffect(() => {
    loadQuote(activeSymbol)
  }, [activeSymbol, loadQuote])

  const quote = quoteCache[activeSymbol]

  if (!quote) {
    return (
      <div className="p-4 text-xs font-mono text-terminalMuted">
        Loading {activeSymbol}…
      </div>
    )
  }

  return (
    <div className="p-2 flex flex-col gap-2">
      {/* Symbol header */}
      <div className="bg-terminalPanel border border-terminalBorder px-4 py-3">
        <div className="flex items-start gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl font-mono font-bold text-terminalAmber">{quote.symbol}</span>
              <span className="text-xs font-mono text-terminalMuted">{quote.exchange}</span>
            </div>
            <div className="text-sm font-mono text-terminalSubtext mb-1">{quote.name}</div>
            <div className="flex items-center gap-2">
              <QuoteProvenanceBadge quote={quote} symbol={activeSymbol} />
              <FallbackReason quote={quote} symbol={activeSymbol} />
            </div>
          </div>

          <div className="ml-auto text-right">
            <div className="text-2xl font-mono font-bold text-terminalText tabular-nums">
              {formatNumber(quote.price, 2)}
            </div>
            <div className={`text-sm font-mono tabular-nums ${pnlClass(quote.change)}`}>
              {quote.change >= 0 ? '+' : ''}{formatNumber(quote.change, 2)} ({formatPct(quote.changePct)})
            </div>
            <div className="text-2xs text-terminalMuted font-mono mt-0.5">{quote.currency}</div>
            <div className="text-2xs text-terminalMuted/60 font-mono">
              {formatDateTime(quote.lastUpdated)}
            </div>
          </div>
        </div>
      </div>

      {/* Price metrics */}
      <div className="grid grid-cols-4 gap-2">
        <MetricCard label="Volume" value={formatCompact(quote.volume)} />
        <MetricCard label="Market Cap" value={quote.marketCap ? formatCompact(quote.marketCap) : '—'} />
        <MetricCard label="52W High" value="—" note="Requires price history" />
        <MetricCard label="52W Low" value="—" note="Requires price history" />
      </div>

      {/* Chart placeholder */}
      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader title="Price Chart" action={
          <div className="flex gap-1">
            {['1D', '1W', '1M', '3M', '1Y'].map(tf => (
              <button key={tf} className="text-2xs font-mono text-terminalMuted hover:text-terminalAmber px-1">{tf}</button>
            ))}
          </div>
        } />
        <div className="relative h-48 flex items-center justify-center bg-terminalBg/40 border-t border-terminalBorder">
          <div className="text-center z-10">
            <div className="text-xs font-mono text-terminalMuted">Chart placeholder</div>
            <div className="text-2xs text-terminalMuted/60 font-mono mt-1">Requires price history data</div>
          </div>
          <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#4da3ff" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-terminalPanel border border-terminalBorder">
          <SectionHeader title="Technical Indicators" />
          {[
            { label: 'RSI (14)', value: '—' },
            { label: 'MACD', value: '—' },
            { label: 'SMA 20', value: '—' },
            { label: 'SMA 50', value: '—' },
            { label: 'SMA 200', value: '—' },
            { label: 'ATR (14)', value: '—' },
          ].map(row => (
            <div key={row.label} className="flex items-center px-3 py-1.5 border-b border-terminalBorder/40 last:border-0">
              <span className="text-xs font-mono text-terminalSubtext flex-1">{row.label}</span>
              <span className="text-xs font-mono text-terminalMuted tabular-nums">{row.value}</span>
            </div>
          ))}
          <div className="px-3 py-1.5 text-2xs text-terminalMuted font-mono">Requires price history</div>
        </div>

        <div className="bg-terminalPanel border border-terminalBorder">
          <SectionHeader title="Valuation" />
          {[
            { label: 'P/E Ratio', value: '—' },
            { label: 'P/B Ratio', value: '—' },
            { label: 'P/S Ratio', value: '—' },
            { label: 'EV/EBITDA', value: '—' },
            { label: 'Dividend Yield', value: '—' },
            { label: 'EPS', value: '—' },
            { label: 'Beta', value: '—' },
          ].map(row => (
            <div key={row.label} className="flex items-center px-3 py-1.5 border-b border-terminalBorder/40 last:border-0">
              <span className="text-xs font-mono text-terminalSubtext flex-1">{row.label}</span>
              <span className="text-xs font-mono text-terminalMuted tabular-nums">{row.value}</span>
            </div>
          ))}
          <div className="px-3 py-1.5 text-2xs text-terminalMuted font-mono">Requires fundamentals feed</div>
        </div>
      </div>

      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader title={`News & Filings — ${quote.symbol}`} />
        <div className="px-3 py-4 text-center text-xs text-terminalMuted font-mono">
          News and filings feed — requires live data provider
        </div>
      </div>
    </div>
  )
}

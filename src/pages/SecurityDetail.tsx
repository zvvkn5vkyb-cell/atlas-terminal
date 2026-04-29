import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useMarketStore } from '@/store/marketStore'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { MetricCard } from '@/components/ui/MetricCard'
import { formatNumber, formatCompact, formatDateTime, pnlClass, formatPct } from '@/lib/format'
import type { Quote } from '@/types/market'
import type { OHLCVBar, HistoricalPricesResult, PriceRange } from '@/services/market/types'

const RANGES: PriceRange[] = ['1D', '1W', '1M', '3M', '1Y']
const CANADIAN_RE = /\.(TO|TSX|V)$/i

// ─── Chart component ──────────────────────────────────────────────────────────

function PriceLineChart({ bars }: { bars: OHLCVBar[] }) {
  if (bars.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-xs font-mono text-terminalMuted">
        No price data available for this range
      </div>
    )
  }

  const closes = bars.map(b => b.close)
  const minC = Math.min(...closes)
  const maxC = Math.max(...closes)
  const range = maxC - minC || 1
  const isUp = closes[closes.length - 1] >= closes[0]
  const lineColor = isUp ? '#00c853' : '#ff4d57'
  const fillColor = isUp ? 'rgba(0,200,83,0.06)' : 'rgba(255,77,87,0.06)'

  const pts = closes.map((c, i) => ({
    x: (i / (closes.length - 1)) * 100,
    y: 100 - ((c - minC) / range) * 96 - 2, // 2% padding top/bottom
  }))

  const linePts = pts.map(p => `${p.x},${p.y}`).join(' ')
  const fillPath =
    `M ${pts[0].x},100 ` +
    pts.map(p => `L ${p.x},${p.y}`).join(' ') +
    ` L ${pts[pts.length - 1].x},100 Z`

  const firstDate = bars[0].timestamp.slice(0, 10)
  const lastDate = bars[bars.length - 1].timestamp.slice(0, 10)

  return (
    <div className="relative h-full">
      {/* Y-axis price labels */}
      <div className="absolute top-1 left-1 text-2xs font-mono text-terminalMuted/60 tabular-nums z-10">
        {formatNumber(maxC, 2)}
      </div>
      <div className="absolute bottom-5 left-1 text-2xs font-mono text-terminalMuted/60 tabular-nums z-10">
        {formatNumber(minC, 2)}
      </div>

      {/* SVG chart */}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        {/* Horizontal grid lines */}
        {[25, 50, 75].map(y => (
          <line key={y} x1="0" y1={y} x2="100" y2={y}
            stroke="#2a2d31" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        ))}
        {/* Area fill */}
        <path d={fillPath} fill={fillColor} />
        {/* Price line */}
        <polyline points={linePts} fill="none" stroke={lineColor}
          strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        {/* Current price dot */}
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y}
          r="1.2" fill={lineColor} vectorEffect="non-scaling-stroke" />
      </svg>

      {/* X-axis date range */}
      <div className="absolute bottom-0 left-1 right-1 flex justify-between text-2xs font-mono text-terminalMuted/50">
        <span>{firstDate}</span>
        <span>{lastDate}</span>
      </div>
    </div>
  )
}

// ─── Chart provenance badge ───────────────────────────────────────────────────

function ChartBadge({ result }: { result: HistoricalPricesResult }) {
  if (result.trustMode === 'TRUSTED') {
    return (
      <span className="text-2xs font-mono text-terminalGreen border border-terminalGreen/40 px-1.5 py-0.5">
        CHART: POLYGON
      </span>
    )
  }
  return (
    <span className="text-2xs font-mono text-terminalAmber border border-terminalAmber/40 px-1.5 py-0.5">
      CHART: MOCK FALLBACK
    </span>
  )
}

// ─── Quote provenance badge ───────────────────────────────────────────────────

function QuoteBadge({ quote, symbol }: { quote: Quote; symbol: string }) {
  if (quote.trustMode === 'TRUSTED' && quote.exchange === 'Polygon.io') {
    return (
      <span className="text-2xs font-mono text-terminalGreen border border-terminalGreen/40 px-1.5 py-0.5">
        QUOTE: LIVE
      </span>
    )
  }
  if (quote.trustMode === 'DEGRADED' && CANADIAN_RE.test(symbol)) {
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

// ─── 52W metric ───────────────────────────────────────────────────────────────

function week52Value(yearResult: HistoricalPricesResult | undefined, type: 'high' | 'low'): string {
  if (!yearResult || yearResult.bars.length === 0) return '—'
  if (yearResult.trustMode === 'DEGRADED') return '—'
  const val = type === 'high'
    ? Math.max(...yearResult.bars.map(b => b.high))
    : Math.min(...yearResult.bars.map(b => b.low))
  return formatNumber(val, 2)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SecurityDetail() {
  const { activeSymbol } = useWorkspaceStore()
  const { quoteCache, priceHistoryCache, loadQuote, loadPriceHistory } = useMarketStore()
  const [activeRange, setActiveRange] = useState<PriceRange>('1M')

  // Load quote + default chart range + 1Y for 52W calc
  useEffect(() => {
    void loadQuote(activeSymbol)
    void loadPriceHistory(activeSymbol, activeRange)
    void loadPriceHistory(activeSymbol, '1Y')
  }, [activeSymbol]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load new range when user switches
  useEffect(() => {
    void loadPriceHistory(activeSymbol, activeRange)
  }, [activeRange, activeSymbol]) // eslint-disable-line react-hooks/exhaustive-deps

  const quote = quoteCache[activeSymbol]
  const chartResult = priceHistoryCache[`${activeSymbol}::${activeRange}`]
  const yearResult = priceHistoryCache[`${activeSymbol}::1Y`]

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
            <div className="text-sm font-mono text-terminalSubtext mb-1.5">{quote.name}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <QuoteBadge quote={quote} symbol={activeSymbol} />
              {quote.trustMode === 'DEGRADED' && CANADIAN_RE.test(activeSymbol) && (
                <span className="text-2xs font-mono text-terminalMuted/70">
                  Polygon US equities endpoint does not support this symbol
                </span>
              )}
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
            <div className="text-2xs text-terminalMuted/60 font-mono">{formatDateTime(quote.lastUpdated)}</div>
          </div>
        </div>
      </div>

      {/* Price metrics */}
      <div className="grid grid-cols-4 gap-2">
        <MetricCard label="Volume" value={formatCompact(quote.volume)} />
        <MetricCard label="Market Cap" value={quote.marketCap ? formatCompact(quote.marketCap) : '—'} />
        <MetricCard
          label="52W High"
          value={week52Value(yearResult, 'high')}
          note={!yearResult || yearResult.trustMode === 'DEGRADED' ? 'Requires 1Y price history' : undefined}
        />
        <MetricCard
          label="52W Low"
          value={week52Value(yearResult, 'low')}
          note={!yearResult || yearResult.trustMode === 'DEGRADED' ? 'Requires 1Y price history' : undefined}
        />
      </div>

      {/* Chart */}
      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader
          title="Price Chart"
          action={
            <div className="flex items-center gap-3">
              {chartResult && <ChartBadge result={chartResult} />}
              <div className="flex gap-0.5">
                {RANGES.map(r => (
                  <button
                    key={r}
                    onClick={() => setActiveRange(r)}
                    className={`px-2 py-0.5 text-2xs font-mono transition-colors ${
                      activeRange === r
                        ? 'text-terminalAmber bg-terminalAmber/10 border-b border-terminalAmber'
                        : 'text-terminalMuted hover:text-terminalText'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          }
        />
        <div className="h-48 bg-terminalBg/40 border-t border-terminalBorder p-1">
          {!chartResult ? (
            <div className="h-full flex items-center justify-center text-xs font-mono text-terminalMuted">
              Loading…
            </div>
          ) : (
            <PriceLineChart bars={chartResult.bars} />
          )}
        </div>
        {chartResult?.fallbackReason && (
          <div className="px-3 py-1 border-t border-terminalBorder/40 text-2xs font-mono text-terminalMuted/70">
            Fallback: {chartResult.fallbackReason}
          </div>
        )}
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

import { useEffect, useState, useRef, useMemo } from 'react'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useMarketStore } from '@/store/marketStore'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { MetricCard } from '@/components/ui/MetricCard'
import { formatNumber, formatCompact, formatDateTime, pnlClass, formatPct } from '@/lib/format'
import type { Quote } from '@/types/market'
import type { OHLCVBar, HistoricalPricesResult, PriceRange } from '@/services/market/types'
import { computeTechnicalIndicators } from '@/lib/analytics/technicalIndicators'

const RANGES: PriceRange[] = ['1D', '1W', '1M', '3M', '1Y']
const CANADIAN_RE = /\.(TO|TSX|V)$/i

// ─── Chart ────────────────────────────────────────────────────────────────────

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
  const priceRange = maxC - minC || 1
  const isUp = closes[closes.length - 1] >= closes[0]
  const lineColor = isUp ? '#00c853' : '#ff4d57'
  const fillColor = isUp ? 'rgba(0,200,83,0.06)' : 'rgba(255,77,87,0.06)'

  const pts = closes.map((c, i) => ({
    x: (i / (closes.length - 1)) * 100,
    y: 100 - ((c - minC) / priceRange) * 92 - 4,
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
      <div className="absolute top-1 left-1 text-2xs font-mono text-terminalMuted/60 tabular-nums z-10 pointer-events-none">
        {formatNumber(maxC, 2)}
      </div>
      <div className="absolute bottom-5 left-1 text-2xs font-mono text-terminalMuted/60 tabular-nums z-10 pointer-events-none">
        {formatNumber(minC, 2)}
      </div>
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none" style={{ display: 'block' }}>
        {[25, 50, 75].map(y => (
          <line key={y} x1="0" y1={y} x2="100" y2={y}
            stroke="#2a2d31" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={fillPath} fill={fillColor} />
        <polyline points={linePts} fill="none" stroke={lineColor}
          strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y}
          r="1.2" fill={lineColor} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute bottom-0 left-1 right-1 flex justify-between text-2xs font-mono text-terminalMuted/50 pointer-events-none">
        <span>{firstDate}</span>
        <span>{lastDate}</span>
      </div>
    </div>
  )
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function ProviderBadge({ quote, symbol }: { quote: Quote; symbol: string }) {
  if (quote.trustMode === 'TRUSTED' && quote.exchange === 'Polygon.io') {
    return (
      <span className="text-2xs font-mono text-terminalGreen border border-terminalGreen/40 px-1.5 py-0.5">
        PROVIDER: POLYGON
      </span>
    )
  }
  if (CANADIAN_RE.test(symbol)) {
    return (
      <span className="text-2xs font-mono text-terminalAmber border border-terminalAmber/40 px-1.5 py-0.5">
        PROVIDER: CANADIAN PLACEHOLDER
      </span>
    )
  }
  return (
    <span className="text-2xs font-mono text-terminalMuted border border-terminalMuted/30 px-1.5 py-0.5">
      PROVIDER: MOCK FALLBACK
    </span>
  )
}

function ChartBadge({ result }: { result: HistoricalPricesResult }) {
  if (result.trustMode === 'TRUSTED') {
    return (
      <span className="text-2xs font-mono text-terminalGreen border border-terminalGreen/40 px-1.5 py-0.5">
        CHART: POLYGON{result.isStale ? ' (DELAYED)' : ''}
      </span>
    )
  }
  return (
    <span className="text-2xs font-mono text-terminalAmber border border-terminalAmber/40 px-1.5 py-0.5">
      CHART: MOCK FALLBACK
    </span>
  )
}

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

// ─── 52W helpers ──────────────────────────────────────────────────────────────

function week52Value(yearResult: HistoricalPricesResult | undefined, type: 'high' | 'low'): string {
  if (!yearResult || yearResult.bars.length === 0 || yearResult.trustMode !== 'TRUSTED') return '—'
  const val = type === 'high'
    ? Math.max(...yearResult.bars.map(b => b.high))
    : Math.min(...yearResult.bars.map(b => b.low))
  return formatNumber(val, 2)
}

function week52Note(yearResult: HistoricalPricesResult | undefined): string | undefined {
  if (!yearResult) return 'Loading…'
  if (yearResult.bars.length === 0) return 'No 1Y data'
  if (yearResult.trustMode !== 'TRUSTED') return 'Requires live 1Y data'
  return undefined
}

// ─── Symbol input ─────────────────────────────────────────────────────────────

interface SymbolInputProps {
  currentSymbol: string
  onCommit: (symbol: string) => void
}

function SymbolInput({ currentSymbol, onCommit }: SymbolInputProps) {
  const [value, setValue] = useState(currentSymbol)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync if external symbol changes (e.g. via command palette)
  useEffect(() => {
    setValue(currentSymbol)
  }, [currentSymbol])

  const commit = () => {
    const sym = value.toUpperCase().trim()
    if (sym && sym !== currentSymbol) {
      onCommit(sym)
    } else {
      setValue(currentSymbol) // reset on empty/unchanged
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-terminalBorder bg-terminalPanel">
      <span className="text-2xs font-mono text-terminalMuted uppercase tracking-wider shrink-0">Symbol</span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => setValue(e.target.value.toUpperCase())}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { e.preventDefault(); setValue(currentSymbol); inputRef.current?.blur() }
        }}
        onBlur={commit}
        className="w-28 bg-terminalBg border border-terminalBorder px-2 py-0.5 text-xs font-mono text-terminalAmber outline-none focus:border-terminalAmber/60 tabular-nums"
        placeholder="AAPL"
        spellCheck={false}
        autoCapitalize="characters"
      />
      <span className="text-2xs font-mono text-terminalMuted/60">Enter to load · ESC to cancel</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SecurityDetail() {
  const { activeSymbol, setActiveSymbol } = useWorkspaceStore()
  const { quoteCache, priceHistoryCache, loadQuote, loadPriceHistory } = useMarketStore()
  const [activeRange, setActiveRange] = useState<PriceRange>('1M')

  // Load on symbol or range change
  useEffect(() => {
    void loadQuote(activeSymbol)
    void loadPriceHistory(activeSymbol, activeRange)
    void loadPriceHistory(activeSymbol, '1Y')
  }, [activeSymbol]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadPriceHistory(activeSymbol, activeRange)
  }, [activeRange, activeSymbol]) // eslint-disable-line react-hooks/exhaustive-deps

  const quote = quoteCache[activeSymbol]
  const chartResult = priceHistoryCache[`${activeSymbol}::${activeRange}`]
  const yearResult = priceHistoryCache[`${activeSymbol}::1Y`]

  // Compute indicators from the longest available price history (1Y preferred).
  // Uses yearResult regardless of trust mode so mock-data symbols still show indicators.
  const indicators = useMemo(() => {
    if (!yearResult || yearResult.bars.length < 15) return null
    return computeTechnicalIndicators(yearResult.bars)
  }, [yearResult])

  const handleSymbolCommit = (sym: string) => {
    setActiveSymbol(sym)
  }

  return (
    <div className="p-2 flex flex-col gap-2">
      {/* Symbol input bar */}
      <SymbolInput currentSymbol={activeSymbol} onCommit={handleSymbolCommit} />

      {/* Loading state */}
      {!quote ? (
        <div className="bg-terminalPanel border border-terminalBorder px-4 py-6 text-center">
          <div className="text-xs font-mono text-terminalMuted">Loading {activeSymbol}…</div>
        </div>
      ) : (
        <>
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
                  <ProviderBadge quote={quote} symbol={activeSymbol} />
                  <QuoteBadge quote={quote} symbol={activeSymbol} />
                  {quote.trustMode === 'DEGRADED' && CANADIAN_RE.test(activeSymbol) && (
                    <span className="text-2xs font-mono text-terminalMuted/70">
                      Canadian market provider not configured
                    </span>
                  )}
                  {quote.trustMode === 'DEGRADED' && !CANADIAN_RE.test(activeSymbol) && (
                    <span className="text-2xs font-mono text-terminalMuted/70">
                      Live data unavailable — showing mock fallback
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
              note={week52Note(yearResult)}
            />
            <MetricCard
              label="52W Low"
              value={week52Value(yearResult, 'low')}
              note={week52Note(yearResult)}
            />
          </div>
        </>
      )}

      {/* Chart — always render so range buttons are available */}
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

      {/* Technical + Valuation */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-terminalPanel border border-terminalBorder">
          <SectionHeader title="Technical Indicators" />
          {!yearResult ? (
            <div className="px-3 py-3 text-2xs font-mono text-terminalMuted">Loading…</div>
          ) : !indicators ? (
            <div className="px-3 py-3 text-2xs font-mono text-terminalMuted">
              Insufficient data — need 15+ bars ({yearResult.bars.length} available)
            </div>
          ) : (
            <>
              {/* RSI(14) */}
              <div className="flex items-center px-3 py-1.5 border-b border-terminalBorder/40">
                <span className="text-xs font-mono text-terminalSubtext flex-1">RSI (14)</span>
                {indicators.rsi14 !== null ? (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1 bg-terminalBorder rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${indicators.rsi14 >= 70 ? 'bg-terminalRed' : indicators.rsi14 <= 30 ? 'bg-terminalGreen' : 'bg-terminalCyan'}`}
                        style={{ width: `${Math.min(indicators.rsi14, 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono tabular-nums ${indicators.rsi14 >= 70 ? 'text-terminalRed' : indicators.rsi14 <= 30 ? 'text-terminalGreen' : 'text-terminalCyan'}`}>
                      {indicators.rsi14.toFixed(1)}
                      <span className="text-terminalMuted text-2xs ml-1">
                        {indicators.rsi14 >= 70 ? 'OB' : indicators.rsi14 <= 30 ? 'OS' : ''}
                      </span>
                    </span>
                  </div>
                ) : <span className="text-xs font-mono text-terminalMuted">—</span>}
              </div>

              {/* MACD */}
              <div className="flex items-center px-3 py-1.5 border-b border-terminalBorder/40">
                <span className="text-xs font-mono text-terminalSubtext flex-1">MACD (12,26,9)</span>
                {indicators.macd !== null ? (
                  <div className="text-right">
                    <div className={`text-xs font-mono tabular-nums ${indicators.macd.histogram > 0 ? 'text-terminalGreen' : 'text-terminalRed'}`}>
                      {indicators.macd.value > 0 ? '+' : ''}{indicators.macd.value.toFixed(3)}
                    </div>
                    <div className="text-2xs font-mono text-terminalMuted tabular-nums">
                      sig {indicators.macd.signal.toFixed(3)}
                    </div>
                  </div>
                ) : <span className="text-xs font-mono text-terminalMuted">—</span>}
              </div>

              {/* SMAs */}
              {([
                ['SMA 20', indicators.sma20],
                ['SMA 50', indicators.sma50],
                ['SMA 200', indicators.sma200],
              ] as [string, number | null][]).map(([label, val]) => (
                <div key={label} className="flex items-center px-3 py-1.5 border-b border-terminalBorder/40 last:border-0">
                  <span className="text-xs font-mono text-terminalSubtext flex-1">{label}</span>
                  {val !== null && quote ? (
                    <span className={`text-xs font-mono tabular-nums ${quote.price > val ? 'text-terminalGreen' : quote.price < val ? 'text-terminalRed' : 'text-terminalSubtext'}`}>
                      {formatNumber(val, 2)}
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-terminalMuted">
                      {val === null ? `< ${label === 'SMA 20' ? 20 : label === 'SMA 50' ? 50 : 200} bars` : '—'}
                    </span>
                  )}
                </div>
              ))}

              {/* ATR(14) */}
              <div className="flex items-center px-3 py-1.5">
                <span className="text-xs font-mono text-terminalSubtext flex-1">ATR (14)</span>
                {indicators.atr14 !== null ? (
                  <span className="text-xs font-mono text-terminalSubtext tabular-nums">
                    {formatNumber(indicators.atr14, 2)}
                  </span>
                ) : <span className="text-xs font-mono text-terminalMuted">—</span>}
              </div>

              <div className="px-3 py-1 border-t border-terminalBorder/40 text-2xs font-mono text-terminalMuted/60">
                {indicators.barsAvailable} bars · {yearResult.trustMode === 'TRUSTED' ? 'Polygon.io' : 'mock data'}
              </div>
            </>
          )}
        </div>
        <div className="bg-terminalPanel border border-terminalBorder">
          <SectionHeader title="Valuation" />
          {['P/E Ratio', 'P/B Ratio', 'P/S Ratio', 'EV/EBITDA', 'Dividend Yield', 'EPS', 'Beta'].map(label => (
            <div key={label} className="flex items-center px-3 py-1.5 border-b border-terminalBorder/40 last:border-0">
              <span className="text-xs font-mono text-terminalSubtext flex-1">{label}</span>
              <span className="text-xs font-mono text-terminalMuted tabular-nums">—</span>
            </div>
          ))}
          <div className="px-3 py-1.5 text-2xs text-terminalMuted font-mono">Requires fundamentals feed</div>
        </div>
      </div>

      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader title={`News & Filings — ${activeSymbol}`} />
        <div className="px-3 py-4 text-center text-xs text-terminalMuted font-mono">
          News and filings feed — requires live data provider
        </div>
      </div>
    </div>
  )
}

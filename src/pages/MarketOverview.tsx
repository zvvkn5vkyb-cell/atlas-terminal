import { useMockMarketData } from '@/hooks/useMockMarketData'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { DegradedDataBadge } from '@/components/ui/DegradedDataBadge'
import { formatNumber, formatPct, pnlClass } from '@/lib/format'

export function MarketOverview() {
  const { indices, fxRates, commodities, rates, moversUp, moversDown, breadth } = useMockMarketData()

  return (
    <div className="p-2 flex flex-col gap-2">
      {/* Data provenance disclosure */}
      <div className="flex items-center gap-2 px-3 py-1 bg-terminalPanel border border-terminalAmber/20 text-2xs font-mono">
        <span className="text-terminalAmber">MOCK DATA</span>
        <span className="text-terminalMuted">— indices, FX, rates, commodities, movers, and breadth are simulated. Live provider not yet connected for these feeds.</span>
      </div>

      {/* Index Cards */}
      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader title="Global Indices" />
        <div className="grid grid-cols-4">
          {indices.map(idx => (
            <div key={idx.symbol} className="px-3 py-2 border-r border-b border-terminalBorder [&:nth-child(4n)]:border-r-0 [&:nth-child(n+5)]:border-b-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-mono text-terminalAmber">{idx.symbol}</span>
                <DegradedDataBadge trustMode={idx.trustMode} />
              </div>
              <div className="text-sm font-mono text-terminalText tabular-nums">
                {formatNumber(idx.value, 2)}
              </div>
              <div className={`text-xs font-mono tabular-nums ${pnlClass(idx.changePct)}`}>
                {formatPct(idx.changePct)} ({formatNumber(idx.change, 2)})
              </div>
              <div className="text-2xs text-terminalMuted font-mono">{idx.region}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* FX */}
        <div className="bg-terminalPanel border border-terminalBorder">
          <SectionHeader title="FX Rates" />
          {fxRates.map(fx => (
            <div key={fx.pair} className="flex items-center px-3 py-1.5 border-b border-terminalBorder/40 last:border-0">
              <span className="text-xs font-mono text-terminalAmber w-20">{fx.pair}</span>
              <span className="text-xs font-mono text-terminalText tabular-nums ml-auto">{formatNumber(fx.rate, 4)}</span>
              <span className={`text-xs font-mono tabular-nums ml-3 w-16 text-right ${pnlClass(fx.changePct)}`}>
                {formatPct(fx.changePct)}
              </span>
              <DegradedDataBadge trustMode={fx.trustMode} className="ml-2" />
            </div>
          ))}
        </div>

        {/* Rates */}
        <div className="bg-terminalPanel border border-terminalBorder">
          <SectionHeader title="Yields" />
          {rates.map(r => (
            <div key={r.tenor} className="flex items-center px-3 py-1.5 border-b border-terminalBorder/40 last:border-0">
              <span className="text-xs font-mono text-terminalSubtext w-20">{r.name}</span>
              <span className="text-xs font-mono text-terminalText tabular-nums ml-auto">{formatNumber(r.yield, 2)}%</span>
              <span className={`text-xs font-mono tabular-nums ml-3 w-14 text-right ${pnlClass(r.change)}`}>
                {r.change >= 0 ? '+' : ''}{formatNumber(r.change * 100, 1)}bp
              </span>
            </div>
          ))}
        </div>

        {/* Commodities */}
        <div className="bg-terminalPanel border border-terminalBorder">
          <SectionHeader title="Commodities" />
          {commodities.map(c => (
            <div key={c.symbol} className="flex items-center px-3 py-1.5 border-b border-terminalBorder/40 last:border-0">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-mono text-terminalAmber">{c.name}</span>
                <span className="text-2xs text-terminalMuted ml-1">{c.unit}</span>
              </div>
              <span className="text-xs font-mono text-terminalText tabular-nums">{formatNumber(c.price, 2)}</span>
              <span className={`text-xs font-mono tabular-nums ml-3 w-16 text-right ${pnlClass(c.changePct)}`}>
                {formatPct(c.changePct)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Movers */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-terminalPanel border border-terminalBorder">
          <SectionHeader title="Top Movers — Up" />
          {moversUp.map(m => (
            <div key={m.symbol} className="flex items-center px-3 py-1.5 border-b border-terminalBorder/40 last:border-0">
              <span className="text-xs font-mono text-terminalAmber w-20">{m.symbol}</span>
              <span className="text-xs font-mono text-terminalSubtext truncate flex-1">{m.name}</span>
              <span className="text-xs font-mono text-terminalText tabular-nums ml-3">{formatNumber(m.price, 2)}</span>
              <span className="text-xs font-mono text-terminalGreen tabular-nums ml-3 w-16 text-right">
                {formatPct(m.changePct)}
              </span>
            </div>
          ))}
        </div>

        <div className="bg-terminalPanel border border-terminalBorder">
          <SectionHeader title="Top Movers — Down" />
          {moversDown.map(m => (
            <div key={m.symbol} className="flex items-center px-3 py-1.5 border-b border-terminalBorder/40 last:border-0">
              <span className="text-xs font-mono text-terminalAmber w-20">{m.symbol}</span>
              <span className="text-xs font-mono text-terminalSubtext truncate flex-1">{m.name}</span>
              <span className="text-xs font-mono text-terminalText tabular-nums ml-3">{formatNumber(m.price, 2)}</span>
              <span className="text-xs font-mono text-terminalRed tabular-nums ml-3 w-16 text-right">
                {formatPct(m.changePct)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Market Breadth */}
      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader title="Market Breadth — S&P 500" />
        <div className="flex items-center divide-x divide-terminalBorder">
          <div className="px-4 py-2 text-center">
            <div className="text-2xs text-terminalMuted font-mono uppercase">Advancing</div>
            <div className="text-sm font-mono text-terminalGreen tabular-nums">{breadth.advancing}</div>
          </div>
          <div className="px-4 py-2 text-center">
            <div className="text-2xs text-terminalMuted font-mono uppercase">Declining</div>
            <div className="text-sm font-mono text-terminalRed tabular-nums">{breadth.declining}</div>
          </div>
          <div className="px-4 py-2 text-center">
            <div className="text-2xs text-terminalMuted font-mono uppercase">Unchanged</div>
            <div className="text-sm font-mono text-terminalSubtext tabular-nums">{breadth.unchanged}</div>
          </div>
          <div className="px-4 py-2 text-center">
            <div className="text-2xs text-terminalMuted font-mono uppercase">New Highs</div>
            <div className="text-sm font-mono text-terminalGreen tabular-nums">{breadth.newHighs}</div>
          </div>
          <div className="px-4 py-2 text-center">
            <div className="text-2xs text-terminalMuted font-mono uppercase">New Lows</div>
            <div className="text-sm font-mono text-terminalRed tabular-nums">{breadth.newLows}</div>
          </div>
          <div className="px-4 py-2 text-center flex-1">
            <div className="w-full bg-terminalBorder h-2">
              <div
                className="bg-terminalGreen h-2"
                style={{ width: `${(breadth.advancing / (breadth.advancing + breadth.declining)) * 100}%` }}
              />
            </div>
            <div className="text-2xs text-terminalMuted font-mono mt-1">
              {((breadth.advancing / (breadth.advancing + breadth.declining)) * 100).toFixed(0)}% advancing
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { usePortfolioAnalytics } from '@/hooks/usePortfolioAnalytics'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { formatPct, pnlClass } from '@/lib/format'

export function TopContributors() {
  const { contributions } = usePortfolioAnalytics()
  const { topPositive, topNegative } = contributions

  return (
    <div className="bg-terminalPanel border border-terminalBorder">
      <SectionHeader title="Contributors (Day)" />
      <div className="grid grid-cols-2 divide-x divide-terminalBorder">
        {/* Positive */}
        <div>
          <div className="px-2 py-1 text-2xs text-terminalGreen font-mono uppercase border-b border-terminalBorder">
            Positive
          </div>
          {topPositive.map(item => (
            <div key={item.symbol} className="flex items-center px-2 py-1 border-b border-terminalBorder/40 last:border-0">
              <span className="text-xs font-mono text-terminalAmber w-16 shrink-0">{item.symbol}</span>
              <span className="text-xs font-mono text-terminalGreen ml-auto tabular-nums">
                {formatPct(item.contribution * 100, 3)}
              </span>
            </div>
          ))}
        </div>

        {/* Negative */}
        <div>
          <div className="px-2 py-1 text-2xs text-terminalRed font-mono uppercase border-b border-terminalBorder">
            Negative
          </div>
          {topNegative.map(item => (
            <div key={item.symbol} className="flex items-center px-2 py-1 border-b border-terminalBorder/40 last:border-0">
              <span className="text-xs font-mono text-terminalAmber w-16 shrink-0">{item.symbol}</span>
              <span className={`text-xs font-mono ml-auto tabular-nums ${pnlClass(item.contribution)}`}>
                {formatPct(item.contribution * 100, 3)}
              </span>
            </div>
          ))}
          {topNegative.length === 0 && (
            <div className="px-2 py-2 text-2xs text-terminalMuted font-mono">None</div>
          )}
        </div>
      </div>
    </div>
  )
}

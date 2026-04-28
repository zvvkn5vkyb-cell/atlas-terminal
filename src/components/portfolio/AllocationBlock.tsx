import { usePortfolioRisk } from '@/hooks/usePortfolioRisk'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { formatPct } from '@/lib/format'

export function AllocationBlock() {
  const { sectorExposure, currencyExposure } = usePortfolioRisk()

  return (
    <div className="bg-terminalPanel border border-terminalBorder">
      <SectionHeader title="Allocation" />
      <div className="grid grid-cols-2 divide-x divide-terminalBorder">
        {/* Sectors */}
        <div>
          <div className="px-2 py-1 text-2xs text-terminalMuted font-mono uppercase border-b border-terminalBorder">
            Sector
          </div>
          {sectorExposure.map(s => (
            <div key={s.label} className="flex items-center px-2 py-1 border-b border-terminalBorder/40 last:border-0">
              <span className="text-xs font-mono text-terminalSubtext truncate flex-1">{s.label}</span>
              <span className="text-xs font-mono text-terminalCyan tabular-nums ml-2">
                {formatPct(s.pct * 100, 1)}
              </span>
            </div>
          ))}
        </div>

        {/* Currency */}
        <div>
          <div className="px-2 py-1 text-2xs text-terminalMuted font-mono uppercase border-b border-terminalBorder">
            Currency
          </div>
          {currencyExposure.map(c => (
            <div key={c.label} className="flex items-center px-2 py-1 border-b border-terminalBorder/40 last:border-0">
              <span className="text-xs font-mono text-terminalSubtext w-12 shrink-0">{c.label}</span>
              <div className="flex-1 mx-2 bg-terminalBorder h-1 rounded-none">
                <div
                  className="bg-terminalBlue h-1"
                  style={{ width: `${Math.min(c.pct * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs font-mono text-terminalCyan tabular-nums">
                {formatPct(c.pct * 100, 1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

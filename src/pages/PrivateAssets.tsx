import { MOCK_PRIVATE_ASSETS, MOCK_DISTRIBUTIONS, MOCK_CASH_FLOWS } from '@/lib/mockData'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { DegradedDataBadge } from '@/components/ui/DegradedDataBadge'
import { formatCurrency, formatNumber, formatDate, pnlClass, formatPct } from '@/lib/format'

export function PrivateAssets() {
  const totalNAV = MOCK_PRIVATE_ASSETS.reduce((s, a) => s + a.nav, 0)

  return (
    <div className="p-2 flex flex-col gap-2">
      {/* Summary */}
      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader title="Private Asset Portfolio" />
        <div className="flex divide-x divide-terminalBorder">
          <div className="px-4 py-2">
            <div className="text-2xs text-terminalMuted font-mono uppercase">Total NAV</div>
            <div className="text-sm font-mono text-terminalText tabular-nums">{formatCurrency(totalNAV, 'USD', true)}</div>
          </div>
          <div className="px-4 py-2">
            <div className="text-2xs text-terminalMuted font-mono uppercase">Positions</div>
            <div className="text-sm font-mono text-terminalText">{MOCK_PRIVATE_ASSETS.length}</div>
          </div>
          <div className="px-4 py-2">
            <div className="text-2xs text-terminalMuted font-mono uppercase">Data Quality</div>
            <div className="text-xs font-mono text-terminalAmber">Lagged valuations</div>
          </div>
        </div>
      </div>

      {/* Asset list */}
      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader title="Holdings" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-terminalBorder">
                {['Fund', 'Type', 'Vintage', 'Commitment', 'Called', 'NAV', 'Distributions', 'TVPI', 'DPI', 'IRR', 'Liquidity', 'Last Val', ''].map(h => (
                  <th key={h} className="px-2 py-1.5 text-2xs text-terminalMuted uppercase tracking-wide text-left font-normal whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_PRIVATE_ASSETS.map(a => (
                <tr key={a.id} className="border-b border-terminalBorder/40 hover:bg-terminalAmber/5">
                  <td className="px-2 py-1.5">
                    <div className="text-terminalText">{a.name}</div>
                    <div className="text-2xs text-terminalMuted">{a.manager}</div>
                  </td>
                  <td className="px-2 py-1.5 text-terminalSubtext whitespace-nowrap">{a.type.replace('_', ' ')}</td>
                  <td className="px-2 py-1.5 text-terminalSubtext tabular-nums">{a.vintage}</td>
                  <td className="px-2 py-1.5 tabular-nums text-right">{formatCurrency(a.commitment, a.currency, true)}</td>
                  <td className="px-2 py-1.5 tabular-nums text-right text-terminalSubtext">{formatCurrency(a.called, a.currency, true)}</td>
                  <td className="px-2 py-1.5 tabular-nums text-right text-terminalText">{formatCurrency(a.nav, a.currency, true)}</td>
                  <td className="px-2 py-1.5 tabular-nums text-right text-terminalGreen">{formatCurrency(a.distributions, a.currency, true)}</td>
                  <td className="px-2 py-1.5 tabular-nums text-right">{formatNumber(a.tvpi, 2)}x</td>
                  <td className="px-2 py-1.5 tabular-nums text-right text-terminalSubtext">{formatNumber(a.dpi, 2)}x</td>
                  <td className="px-2 py-1.5 tabular-nums text-right">
                    {a.irr != null ? <span className={pnlClass(a.irr)}>{formatPct(a.irr, 1)}</span> : <span className="text-terminalMuted">—</span>}
                  </td>
                  <td className="px-2 py-1.5 text-terminalSubtext whitespace-nowrap">{a.liquidity}</td>
                  <td className="px-2 py-1.5 text-terminalMuted whitespace-nowrap">{formatDate(a.lastValuationDate)}</td>
                  <td className="px-2 py-1.5"><DegradedDataBadge trustMode={a.trustMode} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Distributions */}
        <div className="bg-terminalPanel border border-terminalBorder">
          <SectionHeader title="Recent Distributions" />
          {MOCK_DISTRIBUTIONS.slice(0, 6).map((d, i) => (
            <div key={i} className="flex items-center px-3 py-1.5 border-b border-terminalBorder/40 last:border-0">
              <span className="text-xs font-mono text-terminalMuted w-24">{d.date}</span>
              <span className="text-xs font-mono text-terminalSubtext flex-1 truncate">
                {MOCK_PRIVATE_ASSETS.find(a => a.id === d.assetId)?.name?.split(' ')[0]}
              </span>
              <span className="text-xs font-mono text-terminalGreen tabular-nums">{formatCurrency(d.amount, d.currency, true)}</span>
              <span className="text-2xs font-mono text-terminalMuted ml-2">{d.type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>

        {/* Cash flows */}
        <div className="bg-terminalPanel border border-terminalBorder">
          <SectionHeader title="Cash Flow Timeline" />
          {MOCK_CASH_FLOWS.slice(0, 6).map((cf, i) => (
            <div key={i} className="flex items-center px-3 py-1.5 border-b border-terminalBorder/40 last:border-0">
              <span className="text-xs font-mono text-terminalMuted w-24">{cf.date}</span>
              <span className={`text-2xs font-mono uppercase px-1 mr-2 ${cf.type === 'CALL' ? 'text-terminalRed' : 'text-terminalGreen'}`}>
                {cf.type}
              </span>
              <span className="text-xs font-mono text-terminalSubtext flex-1 truncate">{cf.assetName.split(' ')[0]}</span>
              <span className={`text-xs font-mono tabular-nums ${cf.type === 'CALL' ? 'text-terminalRed' : 'text-terminalGreen'}`}>
                {formatCurrency(Math.abs(cf.amount), cf.currency, true)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* NAV Reconciliation placeholder */}
      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader title="NAV Reconciliation" />
        <div className="px-3 py-4 text-center text-xs text-terminalMuted font-mono">
          NAV reconciliation mode — requires fund administrator data feed
        </div>
      </div>

      {/* Audit trail placeholder */}
      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader title="Audit Trail" />
        <div className="px-3 py-4 text-center text-xs text-terminalMuted font-mono">
          Audit trail — requires persistence layer
        </div>
      </div>
    </div>
  )
}

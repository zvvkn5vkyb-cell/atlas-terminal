import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/Button'

const FILTER_GROUPS = [
  { label: 'Universe', options: ['S&P 500', 'TSX 60', 'NASDAQ 100', 'Russell 2000', 'Global'] },
  { label: 'Sector', options: ['Technology', 'Financials', 'Energy', 'Healthcare', 'Materials'] },
  { label: 'Market Cap', options: ['Large (>$10B)', 'Mid ($2B–$10B)', 'Small (<$2B)'] },
]

const PLACEHOLDER_COLUMNS = [
  'Symbol', 'Name', 'Price', 'P/E', 'P/B', 'EV/EBITDA', 'Div Yield', 'Rev Growth', 'Margin', 'Beta', 'Mkt Cap',
]

const PLACEHOLDER_ROWS = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: '189.30', pe: '30.1', pb: '46.2', ev: '22.4', div: '0.5%', rev: '+8%', margin: '26%', beta: '1.2', cap: '$2.95T' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: '415.50', pe: '37.4', pb: '14.8', ev: '28.1', div: '0.7%', rev: '+17%', margin: '41%', beta: '0.9', cap: '$3.10T' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: '175.20', pe: '27.3', pb: '7.1', ev: '16.2', div: '—', rev: '+13%', margin: '25%', beta: '1.1', cap: '$2.20T' },
  { symbol: 'RY.TO', name: 'Royal Bank', price: '135.80', pe: '13.1', pb: '2.0', ev: '—', div: '3.8%', rev: '+5%', margin: '30%', beta: '0.8', cap: 'C$190B' },
  { symbol: 'TD.TO', name: 'TD Bank', price: '79.15', pe: '11.2', pb: '1.5', ev: '—', div: '4.9%', rev: '+2%', margin: '28%', beta: '0.7', cap: 'C$142B' },
]

export function Screener() {
  return (
    <div className="p-2 flex flex-col gap-2">
      {/* Filter controls */}
      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader title="Screener Filters" action={
          <div className="flex gap-2">
            <Button variant="ghost" size="xs">Reset</Button>
            <Button variant="amber" size="xs">Run Screen</Button>
          </div>
        } />
        <div className="p-3 grid grid-cols-3 gap-4">
          {FILTER_GROUPS.map(group => (
            <div key={group.label}>
              <div className="text-2xs text-terminalMuted font-mono uppercase mb-1">{group.label}</div>
              <div className="flex flex-wrap gap-1">
                {group.options.map(opt => (
                  <button
                    key={opt}
                    className="text-2xs font-mono px-1.5 py-0.5 border border-terminalBorder text-terminalSubtext hover:border-terminalAmber hover:text-terminalAmber transition-colors"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-terminalBorder p-3 flex gap-4">
          {[
            { label: 'P/E Max', placeholder: '35' },
            { label: 'Div Yield Min', placeholder: '2%' },
            { label: 'Rev Growth Min', placeholder: '5%' },
            { label: 'Beta Max', placeholder: '1.5' },
          ].map(f => (
            <div key={f.label} className="flex flex-col gap-1">
              <label className="text-2xs text-terminalMuted font-mono uppercase">{f.label}</label>
              <input
                type="text"
                placeholder={f.placeholder}
                className="bg-terminalBg border border-terminalBorder text-xs font-mono text-terminalText px-2 py-1 w-24 outline-none focus:border-terminalAmber"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader title="Results" action={<span className="text-xs font-mono text-terminalMuted">{PLACEHOLDER_ROWS.length} matches (mock)</span>} />
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-terminalBorder">
                {PLACEHOLDER_COLUMNS.map(col => (
                  <th key={col} className="px-2 py-1.5 text-2xs text-terminalMuted uppercase tracking-wide text-left font-normal whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLACEHOLDER_ROWS.map(row => (
                <tr key={row.symbol} className="border-b border-terminalBorder/40 hover:bg-terminalAmber/5">
                  <td className="px-2 py-1.5 text-terminalAmber">{row.symbol}</td>
                  <td className="px-2 py-1.5 text-terminalSubtext">{row.name}</td>
                  <td className="px-2 py-1.5 tabular-nums text-right text-terminalText">{row.price}</td>
                  <td className="px-2 py-1.5 tabular-nums text-right">{row.pe}</td>
                  <td className="px-2 py-1.5 tabular-nums text-right">{row.pb}</td>
                  <td className="px-2 py-1.5 tabular-nums text-right">{row.ev}</td>
                  <td className="px-2 py-1.5 tabular-nums text-right text-terminalGreen">{row.div}</td>
                  <td className="px-2 py-1.5 tabular-nums text-right text-terminalGreen">{row.rev}</td>
                  <td className="px-2 py-1.5 tabular-nums text-right text-terminalCyan">{row.margin}</td>
                  <td className="px-2 py-1.5 tabular-nums text-right text-terminalSubtext">{row.beta}</td>
                  <td className="px-2 py-1.5 tabular-nums text-right text-terminalSubtext">{row.cap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

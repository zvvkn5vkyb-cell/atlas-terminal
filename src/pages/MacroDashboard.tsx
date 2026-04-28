import {
  MOCK_MACRO_INDICATORS,
  MOCK_YIELD_CURVE,
  MOCK_CENTRAL_BANKS,
  MOCK_ECONOMIC_EVENTS,
} from '@/lib/mockData'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { DegradedDataBadge } from '@/components/ui/DegradedDataBadge'
import { formatNumber, formatDate, pnlClass } from '@/lib/format'

function trendArrow(trend: string) {
  if (trend === 'RISING') return <span className="text-terminalRed">↑</span>
  if (trend === 'FALLING') return <span className="text-terminalGreen">↓</span>
  return <span className="text-terminalMuted">→</span>
}

export function MacroDashboard() {
  const keyIndicators = MOCK_MACRO_INDICATORS.slice(0, 4)
  const extraIndicators = MOCK_MACRO_INDICATORS.slice(4)

  return (
    <div className="p-2 flex flex-col gap-2">
      {/* Key cards */}
      <div className="grid grid-cols-4 gap-2">
        {keyIndicators.map(ind => (
          <div key={ind.id} className="bg-terminalPanel border border-terminalBorder p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xs text-terminalMuted font-mono uppercase">{ind.name}</span>
              <DegradedDataBadge trustMode={ind.trustMode} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-mono text-terminalText tabular-nums">
                {formatNumber(ind.value, 1)}{ind.unit}
              </span>
              <span className="text-lg">{trendArrow(ind.trend)}</span>
            </div>
            <div className={`text-xs font-mono tabular-nums mt-1 ${pnlClass(ind.change)}`}>
              {ind.change >= 0 ? '+' : ''}{formatNumber(ind.change, 2)}{ind.unit} vs prior
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xs text-terminalMuted font-mono">{ind.source}</span>
              <span className="text-2xs text-terminalMuted font-mono">{formatDate(ind.reportDate)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* More indicators */}
        <div className="bg-terminalPanel border border-terminalBorder">
          <SectionHeader title="Economic Indicators" />
          {extraIndicators.map(ind => (
            <div key={ind.id} className="flex items-center px-3 py-1.5 border-b border-terminalBorder/40 last:border-0">
              <span className="text-xs font-mono text-terminalSubtext flex-1">{ind.name}</span>
              <span className="text-xs font-mono text-terminalText tabular-nums">{formatNumber(ind.value, 2)}{ind.unit}</span>
              <span className="ml-2">{trendArrow(ind.trend)}</span>
              <span className="text-2xs text-terminalMuted font-mono ml-3">{ind.source}</span>
            </div>
          ))}
        </div>

        {/* Central banks */}
        <div className="bg-terminalPanel border border-terminalBorder">
          <SectionHeader title="Central Banks" />
          {MOCK_CENTRAL_BANKS.map(cb => (
            <div key={cb.bank} className="px-3 py-2 border-b border-terminalBorder/40 last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-terminalAmber">{cb.bank}</span>
                <span className={`text-2xs font-mono uppercase ${
                  cb.bias === 'HAWKISH' ? 'text-terminalRed' :
                  cb.bias === 'DOVISH' ? 'text-terminalGreen' : 'text-terminalMuted'
                }`}>{cb.bias}</span>
              </div>
              <div className="flex items-center mt-0.5">
                <span className="text-xs font-mono text-terminalText tabular-nums">{formatNumber(cb.policyRate, 2)}%</span>
                <span className="text-2xs text-terminalMuted font-mono ml-2">next: {cb.nextMeetingDate ?? '—'}</span>
                <DegradedDataBadge trustMode={cb.trustMode} className="ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Yield curve */}
      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader title="US Treasury Yield Curve" />
        <div className="flex items-end gap-3 px-4 py-4 h-32">
          {MOCK_YIELD_CURVE.map(p => (
            <div key={p.tenor} className="flex flex-col items-center flex-1">
              <span className={`text-xs font-mono tabular-nums mb-1 ${pnlClass(p.change)}`}>
                {formatNumber(p.yield, 2)}
              </span>
              <div
                className="w-full bg-terminalBlue/30 border border-terminalBlue/50 relative"
                style={{ height: `${(p.yield / 6) * 100}%`, minHeight: 4 }}
              />
              <span className="text-2xs text-terminalMuted font-mono mt-1">{p.tenor}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Economic calendar */}
      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader title="Economic Calendar" />
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-terminalBorder">
              {['Date', 'Country', 'Event', 'Importance', 'Forecast', 'Previous'].map(h => (
                <th key={h} className="px-3 py-1.5 text-2xs text-terminalMuted uppercase tracking-wide text-left font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_ECONOMIC_EVENTS.map(ev => (
              <tr key={ev.id} className="border-b border-terminalBorder/40 hover:bg-terminalAmber/5">
                <td className="px-3 py-1.5 text-terminalSubtext whitespace-nowrap">{ev.date}</td>
                <td className="px-3 py-1.5">
                  <span className="px-1 bg-terminalElevated text-terminalSubtext">{ev.country}</span>
                </td>
                <td className="px-3 py-1.5 text-terminalText">{ev.indicator}</td>
                <td className="px-3 py-1.5">
                  <span className={`text-2xs uppercase ${
                    ev.importance === 'HIGH' ? 'text-terminalRed' :
                    ev.importance === 'MEDIUM' ? 'text-terminalAmber' : 'text-terminalMuted'
                  }`}>{ev.importance}</span>
                </td>
                <td className="px-3 py-1.5 tabular-nums text-terminalCyan">
                  {ev.forecast != null ? formatNumber(ev.forecast, 2) : '—'}
                </td>
                <td className="px-3 py-1.5 tabular-nums text-terminalSubtext">
                  {ev.previous != null ? formatNumber(ev.previous, 2) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

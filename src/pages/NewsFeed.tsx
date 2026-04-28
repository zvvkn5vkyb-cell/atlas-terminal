import { MOCK_NEWS } from '@/lib/mockData'
import { MOCK_HOLDINGS } from '@/lib/mockData'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Badge } from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/format'

const signalVariant: Record<string, 'green' | 'amber' | 'muted' | 'red'> = {
  HIGH_SIGNAL: 'green',
  MEDIUM_SIGNAL: 'amber',
  LOW_SIGNAL: 'muted',
  NOISE: 'muted',
}

const sentimentVariant: Record<string, 'green' | 'red' | 'muted'> = {
  POSITIVE: 'green',
  NEGATIVE: 'red',
  NEUTRAL: 'muted',
}

const holdingSymbols = new Set(MOCK_HOLDINGS.map(h => h.symbol))

function getPortfolioImpact(affectedSymbols: string[]): 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' {
  const hits = affectedSymbols.filter(s => holdingSymbols.has(s))
  if (hits.length === 0) return 'NONE'
  if (hits.length >= 2) return 'HIGH'
  return 'MEDIUM'
}

export function NewsFeed() {
  const sortedNews = [...MOCK_NEWS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )

  return (
    <div className="p-2 flex flex-col gap-2">
      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader title="Portfolio-Aware News Queue" action={
          <div className="flex gap-2">
            <span className="text-2xs font-mono text-terminalMuted">{sortedNews.length} items</span>
          </div>
        } />

        {sortedNews.map(item => {
          const impact = getPortfolioImpact(item.affectedSymbols)
          const affectedHoldings = item.affectedSymbols.filter(s => holdingSymbols.has(s))

          return (
            <div
              key={item.id}
              className={`px-3 py-2.5 border-b border-terminalBorder/60 last:border-0 ${
                item.isStale ? 'opacity-60' : ''
              } hover:bg-terminalAmber/5`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant={signalVariant[item.signal]} size="xs">{item.signal.replace('_', ' ')}</Badge>
                    <Badge variant={sentimentVariant[item.sentiment]} size="xs">{item.sentiment}</Badge>
                    {impact !== 'NONE' && (
                      <Badge variant={impact === 'HIGH' ? 'amber' : 'blue'} size="xs">
                        PORTFOLIO {impact}
                      </Badge>
                    )}
                    {item.isStale && <Badge variant="muted" size="xs">STALE</Badge>}
                    {affectedHoldings.length > 0 && (
                      <div className="flex gap-1">
                        {affectedHoldings.map(sym => (
                          <span key={sym} className="text-2xs font-mono text-terminalAmber">{sym}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-xs font-mono text-terminalText leading-snug mb-1">
                    {item.headline}
                  </div>

                  <div className="text-2xs font-mono text-terminalMuted leading-snug line-clamp-2">
                    {item.summary}
                  </div>
                </div>

                <div className="text-right shrink-0 ml-2">
                  <div className="text-2xs font-mono text-terminalAmber">{item.source}</div>
                  <div className="text-2xs font-mono text-terminalMuted whitespace-nowrap">
                    {formatDateTime(item.publishedAt)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

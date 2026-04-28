export type NewsSignal = 'HIGH_SIGNAL' | 'MEDIUM_SIGNAL' | 'LOW_SIGNAL' | 'NOISE'

export type NewsSentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'

export interface NewsItem {
  id: string
  headline: string
  summary: string
  source: string
  publishedAt: string
  url?: string
  signal: NewsSignal
  sentiment: NewsSentiment
  affectedSymbols: string[]
  tags: string[]
  isStale: boolean
  staleReasonCode?: string
}

export interface NewsQueueEntry {
  item: NewsItem
  relevanceScore: number
  affectedHoldings: string[]
  portfolioImpact: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
}

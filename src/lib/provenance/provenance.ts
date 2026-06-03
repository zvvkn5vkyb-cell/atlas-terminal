import type {
  DataProvenance,
  DataQualityStatus,
  MarketDataSource,
} from '@/types/provenance'

/**
 * Default age (ms) beyond which an otherwise-live value is considered STALE.
 * Chosen to sit well past the typical ~15-minute delayed-feed window so a
 * knowingly-delayed quote is classified DELAYED, while a multi-hour-old value
 * is classified STALE. See ENGINEERING_BASELINE R3.
 */
export const DEFAULT_STALENESS_THRESHOLD_MS = 60 * 60 * 1000 // 1 hour

export interface ClassifyDataQualityParams {
  /** Concrete upstream origin of the value. */
  source: MarketDataSource
  /** ISO string / epoch ms / Date the value represents; used for staleness. */
  asOf?: string | number | Date | null
  /** Known-delayed feed (e.g. Polygon free tier). */
  isDelayed?: boolean
  /** A fetch error occurred. */
  hasError?: boolean
  /** A live attempt failed and degraded/substituted data is being served. */
  isFallback?: boolean
  /** Reference "now" for staleness comparison (defaults to Date.now()). */
  now?: number
  /** Override the staleness threshold in ms. */
  stalenessThresholdMs?: number
}

function toEpochMs(value: string | number | Date | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * Pure classification of a value's quality/freshness from observable signals.
 *
 * Precedence (first match wins):
 *   ERROR → MOCK → MANUAL → UNKNOWN → FALLBACK → STALE(age) → DELAYED → LIVE
 *
 * Source identity dominates because it is the strongest signal: a value from the
 * MOCK source is MOCK regardless of age. Staleness is only evaluated for values
 * that would otherwise be live.
 */
export function classifyDataQuality(params: ClassifyDataQualityParams): DataQualityStatus {
  const {
    source,
    asOf,
    isDelayed,
    hasError,
    isFallback,
    now = Date.now(),
    stalenessThresholdMs = DEFAULT_STALENESS_THRESHOLD_MS,
  } = params

  if (hasError) return 'ERROR'
  if (source === 'MOCK') return 'MOCK'
  if (source === 'MANUAL') return 'MANUAL'
  if (source === 'UNKNOWN') return 'UNKNOWN'
  if (isFallback || source === 'CANADIAN_PLACEHOLDER') return 'FALLBACK'

  const asOfMs = toEpochMs(asOf)
  if (asOfMs != null && now - asOfMs > stalenessThresholdMs) return 'STALE'

  if (isDelayed) return 'DELAYED'
  return 'LIVE'
}

const STATUS_LABELS: Record<DataQualityStatus, string> = {
  LIVE: 'LIVE',
  DELAYED: 'DELAYED',
  STALE: 'STALE',
  FALLBACK: 'FALLBACK',
  MOCK: 'MOCK',
  MANUAL: 'MANUAL',
  ERROR: 'ERROR',
  UNKNOWN: 'UNKNOWN',
}

const SOURCE_LABELS: Record<MarketDataSource, string> = {
  POLYGON: 'Polygon.io',
  TWELVE_DATA: 'Twelve Data',
  FMP: 'FMP',
  MOCK: 'Mock',
  CANADIAN_PLACEHOLDER: 'Canadian Placeholder',
  MANUAL: 'Manual',
  UNKNOWN: 'Unknown',
}

/**
 * Short human-readable label for a provenance envelope, e.g.
 * "LIVE · Polygon.io" or "MOCK · Mock". Prefers an explicit `provider` name,
 * falling back to a label derived from the source.
 */
export function formatProvenanceLabel(provenance: DataProvenance): string {
  const status = STATUS_LABELS[provenance.status] ?? provenance.status
  const origin = provenance.provider ?? SOURCE_LABELS[provenance.source] ?? provenance.source
  return origin ? `${status} · ${origin}` : status
}

function toStatus(input: DataProvenance | DataQualityStatus): DataQualityStatus {
  return typeof input === 'string' ? input : input.status
}

const TRADING_USABLE: ReadonlySet<DataQualityStatus> = new Set<DataQualityStatus>(['LIVE'])

const ANALYTICS_USABLE: ReadonlySet<DataQualityStatus> = new Set<DataQualityStatus>([
  'LIVE',
  'DELAYED',
  'STALE',
  'MANUAL',
])

/**
 * Whether a value is fresh enough to drive a trading decision. Strict: only
 * genuinely LIVE data qualifies — delayed/stale/mock/fallback data does not.
 */
export function isDataUsableForTrading(input: DataProvenance | DataQualityStatus): boolean {
  return TRADING_USABLE.has(toStatus(input))
}

/**
 * Whether a value is reliable enough for analytics (risk, performance, etc.).
 * Tolerates DELAYED/STALE/MANUAL real data; excludes synthetic (MOCK),
 * substituted (FALLBACK), errored (ERROR), and unidentified (UNKNOWN) values.
 */
export function isDataUsableForAnalytics(input: DataProvenance | DataQualityStatus): boolean {
  return ANALYTICS_USABLE.has(toStatus(input))
}

export interface LiveProvenanceParams {
  source?: MarketDataSource
  provider?: string
  /** ISO timestamp the value represents (drives DELAYED/STALE downgrade). */
  asOf?: string
  /** ISO timestamp of retrieval; defaults to now. */
  fetchedAt?: string
  latencyMs?: number
  /** Known-delayed feed; downgrades status to DELAYED. */
  isDelayed?: boolean
  now?: number
  stalenessThresholdMs?: number
}

/**
 * Build provenance for a value fetched from a live source. The status is not
 * forced to LIVE — it is derived via {@link classifyDataQuality}, so an old
 * `asOf` yields STALE and `isDelayed` yields DELAYED automatically.
 */
export function createLiveProvenance(params: LiveProvenanceParams = {}): DataProvenance {
  const {
    source = 'UNKNOWN',
    provider,
    asOf,
    fetchedAt = new Date().toISOString(),
    latencyMs,
    isDelayed,
    now,
    stalenessThresholdMs,
  } = params

  const status = classifyDataQuality({
    source,
    asOf,
    isDelayed,
    now,
    stalenessThresholdMs,
  })

  return { source, status, fetchedAt, asOf, provider, latencyMs }
}

export interface MockProvenanceParams {
  provider?: string
  fetchedAt?: string
  asOf?: string
}

/** Build provenance for deterministic mock data (no live attempt made). */
export function createMockProvenance(params: MockProvenanceParams = {}): DataProvenance {
  const { provider = 'Mock', fetchedAt = new Date().toISOString(), asOf } = params
  return { source: 'MOCK', status: 'MOCK', fetchedAt, asOf, provider }
}

export interface ErrorProvenanceParams {
  error: string
  source?: MarketDataSource
  provider?: string
  fetchedAt?: string
  fallbackReason?: string
}

/**
 * Build provenance for a failed fetch. Marks status ERROR and records the
 * error/fallback reason; any value carried alongside should be treated as a
 * placeholder or substituted fallback.
 */
export function createErrorProvenance(params: ErrorProvenanceParams): DataProvenance {
  const {
    error,
    source = 'UNKNOWN',
    provider,
    fetchedAt = new Date().toISOString(),
    fallbackReason,
  } = params
  return { source, status: 'ERROR', fetchedAt, provider, error, fallbackReason }
}

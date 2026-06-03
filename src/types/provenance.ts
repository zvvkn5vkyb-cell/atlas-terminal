// Data provenance foundation (Phase 0B).
//
// Provenance answers "where did this number come from, how fresh is it, and can
// I rely on it?" — questions the existing `TrustMode` quality tier does not.
// TrustMode is intentionally left untouched: provenance sits alongside it and is
// additive. Nothing here wraps existing fields yet (see DataPoint<T>, which is
// provided for future use but not applied broadly in this phase).

/**
 * Identity of the upstream source that produced a value.
 * Distinct from the market `DataSource` ('MOCK' | 'LIVE' | 'HYBRID') in
 * services/market/types.ts, which describes a provider's *mode*, not the
 * concrete origin of a single value.
 */
export type MarketDataSource =
  | 'POLYGON'
  | 'TWELVE_DATA'
  | 'FMP'
  | 'MOCK'
  | 'CANADIAN_PLACEHOLDER'
  | 'MANUAL'
  | 'UNKNOWN'

/**
 * Quality/freshness classification of a value at the moment it was produced.
 *
 * - LIVE     — real, current data from a trusted source
 * - DELAYED  — real data, but knowingly delayed (e.g. Polygon free tier)
 * - STALE    — real data that is too old to be relied upon
 * - FALLBACK — a live attempt failed; this is substituted (degraded) data
 * - MOCK     — synthetic/deterministic data; no live attempt was made
 * - MANUAL   — entered or overridden by a human
 * - ERROR    — an error occurred fetching; any value present is a placeholder
 * - UNKNOWN  — provenance could not be determined
 */
export type DataQualityStatus =
  | 'LIVE'
  | 'DELAYED'
  | 'STALE'
  | 'FALLBACK'
  | 'MOCK'
  | 'MANUAL'
  | 'ERROR'
  | 'UNKNOWN'

/**
 * The provenance envelope attached to a value (or a collection of values).
 * Every field except `source` and `status` is optional so the envelope can be
 * built incrementally as more is known.
 */
export interface DataProvenance {
  /** Concrete upstream origin of the value. */
  source: MarketDataSource
  /** Quality/freshness classification (see DataQualityStatus). */
  status: DataQualityStatus
  /** ISO timestamp of when Atlas retrieved the value. */
  fetchedAt: string
  /** ISO timestamp the value itself represents (e.g. a quote's last-trade time). */
  asOf?: string
  /** Human-readable provider name, e.g. 'Polygon.io'. */
  provider?: string
  /** Round-trip latency of the fetch, if measured. */
  latencyMs?: number
  /** Why fallback/degraded data was served, if applicable. */
  fallbackReason?: string
  /** Error message, if the fetch errored. */
  error?: string
}

/**
 * A value paired with its provenance. Provided as the canonical wrapper for
 * future phases. Phase 0B intentionally does NOT wrap existing fields in this —
 * the quote/history layer carries `provenance` as a sibling field instead.
 */
export interface DataPoint<T> {
  value: T
  provenance: DataProvenance
}

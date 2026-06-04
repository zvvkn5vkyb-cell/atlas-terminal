// Security Master Foundation (Phase 0C).
//
// A local, additive reference-data layer so Atlas no longer relies *only* on raw
// ticker strings. Securities gain a canonical, stable internal identity
// (`securityId`) while raw symbol strings remain fully backward-compatible:
// nothing here changes provider/router/store/page behavior. The master is
// consulted for identity, validation, and (later) enrichment — it never forces
// existing string-based code paths to adopt it.
//
// Distinct from market `DataSource`/provenance (which describe *price* origin),
// this layer describes *what an instrument is*. The two axes are intentionally
// kept separate.

/**
 * ISO-3166-ish alpha-2 country code of the security's primary listing.
 * Deliberately a flexible string union (not a closed enum) so non-North-American
 * securities can be added later without a type refactor. Known values are listed
 * for editor autocomplete; any string is accepted.
 */
export type CountryCode = 'US' | 'CA' | 'GB' | 'DE' | 'JP' | 'AU' | 'FR' | (string & {})

/**
 * Trading venue of the listing. Known venues are enumerated for autocomplete;
 * any string is accepted so new venues need no type change. Use the optional
 * `exchangeMic` field on `Security` when a precise ISO-10383 MIC is known.
 */
export type Exchange =
  | 'NASDAQ'
  | 'NYSE'
  | 'NYSE_ARCA'
  | 'TSX'
  | 'TSXV'
  | 'OTC'
  | 'INDEX'
  | 'OTHER'
  | (string & {})

/**
 * Coarse asset class. Superset-compatible with the inline union on
 * `Holding.assetClass` (EQUITY | FIXED_INCOME | ETF | CASH | DERIVATIVE | OTHER)
 * so a future unification is non-breaking.
 */
export type AssetClass =
  | 'EQUITY'
  | 'FIXED_INCOME'
  | 'ETF'
  | 'FUND'
  | 'CASH'
  | 'DERIVATIVE'
  | 'INDEX'
  | 'COMMODITY'
  | 'FX'
  | 'OTHER'

/** Finer instrument classification within an asset class. */
export type SecurityType =
  | 'COMMON_STOCK'
  | 'PREFERRED_STOCK'
  | 'ADR'
  | 'ETF'
  | 'MUTUAL_FUND'
  | 'INDEX'
  | 'BOND'
  | 'OPTION'
  | 'FUTURE'
  | 'CASH'
  | 'OTHER'

/**
 * Origin of a reference record. Deliberately separate from the market-data
 * `MarketDataSource` — reference-record provenance is a different axis from the
 * provenance of a price.
 */
export type SecurityDataSource = 'SEED' | 'MANUAL' | 'IMPORT'

export interface Security {
  /**
   * Canonical internal identifier. STABLE and OPAQUE: assigned once at inception
   * in the seed and never recomputed by runtime code. May be human-readable
   * (e.g. "US:AAPL", "CA:RY.TO") but must be treated as an opaque key — no
   * service logic derives an id from a symbol. The future transaction ledger
   * keys on this, so it must never change even if the ticker does.
   */
  securityId: string
  /** Canonical routing symbol; backward-compatible with existing strings ("AAPL", "RY.TO"). */
  symbol: string
  /** Human-facing presentation symbol. */
  displaySymbol: string
  name: string
  assetClass: AssetClass
  securityType: SecurityType
  exchange: Exchange
  /** ISO currency code, e.g. 'USD' | 'CAD'. */
  currency: string
  /** Primary listing country of this record. */
  country: CountryCode
  /** Optional GICS-ish sector (freeform for now; matches Holding.sector). */
  sector?: string
  industry?: string
  isin?: string
  cusip?: string
  figi?: string
  /** Optional ISO-10383 Market Identifier Code; not yet required in all seed records. */
  exchangeMic?: string
  /** Optional issuer key for future issuer-level exposure grouping (no logic yet). */
  issuerId?: string
  /** Alternate or historical symbols — the continuity hook for ticker changes. */
  aliases?: string[]
  /** Whether the security currently exists (not delisted). */
  isActive: boolean
  /** Whether the security can be held as a position (indices: active but not tradable). */
  isTradable: boolean
  dataSources?: SecurityDataSource[]
  /** ISO timestamp of last verification (seed date for now). */
  lastVerified?: string
}

/**
 * Result of resolving a raw query to a security. A discriminated union so that
 * "silently resolved an ambiguous symbol" is unrepresentable as success: an
 * under-qualified input that matches multiple securities yields AMBIGUOUS, never
 * an arbitrary RESOLVED.
 */
export type SecurityResolution =
  | { status: 'RESOLVED'; security: Security }
  | { status: 'AMBIGUOUS'; query: string; candidates: Security[] }
  | { status: 'UNKNOWN'; query: string }

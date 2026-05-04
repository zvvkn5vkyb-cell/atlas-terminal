export type CanadianExchange = 'TSX' | 'TSXV'

export interface ParsedCanadianSymbol {
  ticker: string
  exchange: CanadianExchange
}

// Ticker: 1–8 uppercase alphanumeric chars; suffix: .TO, .TSX, or .V (case-insensitive)
const CANADIAN_RE = /^([A-Z0-9]{1,8})\.(TO|TSX|V)$/i

const SUFFIX_TO_EXCHANGE: Record<string, CanadianExchange> = {
  TO: 'TSX',
  TSX: 'TSX',
  V: 'TSXV',
}

// Canonical suffix per exchange used for round-trip output
const EXCHANGE_TO_SUFFIX: Record<CanadianExchange, string> = {
  TSX: 'TO',
  TSXV: 'V',
}

export function isCanadianSymbol(symbol: string): boolean {
  return CANADIAN_RE.test(symbol.trim())
}

export function parseCanadianSymbol(symbol: string): ParsedCanadianSymbol | null {
  const m = symbol.trim().match(CANADIAN_RE)
  if (!m) return null
  const exchange = SUFFIX_TO_EXCHANGE[m[2].toUpperCase()]
  if (!exchange) return null
  return { ticker: m[1].toUpperCase(), exchange }
}

/** Returns the bare ticker Twelve Data expects (e.g. "RY"), or null for non-Canadian symbols. */
export function toTwelveDataSymbol(symbol: string): string | null {
  return parseCanadianSymbol(symbol)?.ticker ?? null
}

/** Returns the exchange string Twelve Data expects (e.g. "TSX" or "TSXV"), or null. */
export function toTwelveDataExchange(symbol: string): string | null {
  return parseCanadianSymbol(symbol)?.exchange ?? null
}

/**
 * Reconstructs a canonical Canadian symbol from a Twelve Data ticker + exchange.
 * TSX → <TICKER>.TO, TSXV → <TICKER>.V. Returns null for unknown exchanges or invalid tickers.
 */
export function fromTwelveDataSymbol(ticker: string, exchange: string): string | null {
  const suffix = EXCHANGE_TO_SUFFIX[exchange as CanadianExchange]
  if (!suffix) return null
  const clean = ticker.trim().toUpperCase()
  if (!clean || !/^[A-Z0-9]{1,8}$/.test(clean)) return null
  return `${clean}.${suffix}`
}

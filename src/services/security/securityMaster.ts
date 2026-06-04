import type { Security, SecurityResolution } from '@/types/security'
import { SECURITY_MASTER_SEED } from './securityMasterSeed'
import { isCanadianSymbol, parseCanadianSymbol, fromTwelveDataSymbol } from '@/services/market/canadianSymbol'

// ─── Security Master service (Phase 0C) ────────────────────────────────────────
//
// Pure, in-memory, additive. Indexes are built once from the seed at module
// load. No side effects, no fetches, no store/UI coupling. `securityId` is
// treated as opaque — nothing here derives an id from a symbol.

// ─── Normalization (reuses Canadian symbol helpers) ────────────────────────────

/**
 * Canonicalizes a raw symbol/query: trim + uppercase, and fold Canadian forms to
 * their canonical suffix (e.g. "ry.to" / "RY.TSX" → "RY.TO", "ab.v" → "AB.V").
 * Reuses the existing market-layer parser rather than adding another regex.
 */
function normalizeSymbol(raw: string): string {
  const trimmed = raw.trim().toUpperCase()
  if (!trimmed) return ''
  const parsed = parseCanadianSymbol(trimmed)
  if (parsed) return fromTwelveDataSymbol(parsed.ticker, parsed.exchange) ?? trimmed
  return trimmed
}

/** Root ticker, stripped of any Canadian exchange suffix (e.g. "RY.TO" → "RY"). */
function rootOf(normalizedSymbol: string): string {
  const parsed = parseCanadianSymbol(normalizedSymbol)
  return parsed ? parsed.ticker : normalizedSymbol
}

// ─── Index construction (once, at module load) ─────────────────────────────────

const byId = new Map<string, Security>()
const bySymbol = new Map<string, Security>()
const byAlias = new Map<string, Security>()
const byRoot = new Map<string, Security[]>()

for (const security of SECURITY_MASTER_SEED) {
  byId.set(security.securityId, security)
  bySymbol.set(normalizeSymbol(security.symbol), security)
  for (const alias of security.aliases ?? []) {
    byAlias.set(normalizeSymbol(alias), security)
  }
  const root = rootOf(normalizeSymbol(security.symbol))
  const bucket = byRoot.get(root)
  if (bucket) bucket.push(security)
  else byRoot.set(root, [security])
}

/** Deterministic ordering for multi-candidate results (by securityId). */
function sortCandidates(candidates: Security[]): Security[] {
  return [...candidates].sort((a, b) => a.securityId.localeCompare(b.securityId))
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Read-only snapshot of all seeded securities. */
export function getAllSecurities(): Security[] {
  return [...SECURITY_MASTER_SEED]
}

/** Exact lookup by canonical (opaque) security id. */
export function getSecurityById(securityId: string): Security | undefined {
  return byId.get(securityId)
}

/**
 * Exact lookup by canonical symbol (after normalization).
 *
 * **Internal/trusted data only.** This is a raw map lookup — it returns
 * whichever security has that exact normalized symbol, ignoring cross-listing
 * ambiguity. `getSecurityByExactSymbol('RY')` returns the U.S. listing (`US:RY`)
 * even though a Canadian listing (`CA:RY.TO`) also exists.
 *
 * **Do NOT pass user-entered input here.** Any symbol that originates from:
 * the command palette, a ticker-search field, a file import, or a transaction
 * ledger entry must go through {@link resolveSecurity} instead, which surfaces
 * AMBIGUOUS and requires the caller to handle it explicitly.
 *
 * Use cases for this function: looking up a symbol you already resolved, reading
 * from internal state keyed on canonical symbols (e.g. mock holdings, provider
 * outputs where the symbol is already trusted/normalized).
 */
export function getSecurityByExactSymbol(symbol: string): Security | undefined {
  const norm = normalizeSymbol(symbol)
  if (!norm) return undefined
  return bySymbol.get(norm)
}

/**
 * Alias for {@link getSecurityByExactSymbol}. Retained for the required Phase 0C
 * API surface and backward compatibility with any future callers that adopted this
 * name. Carries the same caveats — see that function's JSDoc.
 *
 * @see getSecurityByExactSymbol
 * @see resolveSecurity — use this instead for any user-originated input
 */
export function getSecurityBySymbol(symbol: string): Security | undefined {
  return getSecurityByExactSymbol(symbol)
}

/**
 * Candidate securities for an under-qualified query, or an empty array when the
 * query is unambiguous (resolves to ≤ 1 security) or fully qualified. A return
 * length ≥ 2 means the caller must NOT silently pick one.
 */
export function detectAmbiguousSymbol(query: string): Security[] {
  const norm = normalizeSymbol(query)
  if (!norm || isCanadianSymbol(norm)) return []
  const candidates = byRoot.get(rootOf(norm)) ?? []
  return candidates.length > 1 ? sortCandidates(candidates) : []
}

/**
 * Safe, ambiguity-aware resolution of a raw query.
 *
 * Precedence:
 *   1. Fully-qualified Canadian symbol (.TO/.V) → exact match (never ambiguous).
 *   2. Bare/non-Canadian input → governed by root collision:
 *        - root shared by ≥ 2 securities → AMBIGUOUS (does not guess)
 *        - root held by exactly 1 security → RESOLVED
 *        - else exact alias match → RESOLVED
 *        - else → UNKNOWN
 *
 * A bare root such as "RY" is AMBIGUOUS even though it equals the U.S. listing's
 * symbol, because the bare form cannot disambiguate the U.S. vs Canadian listing.
 */
export function resolveSecurity(query: string): SecurityResolution {
  const norm = normalizeSymbol(query)
  if (!norm) return { status: 'UNKNOWN', query }

  if (isCanadianSymbol(norm)) {
    const security = bySymbol.get(norm)
    return security ? { status: 'RESOLVED', security } : { status: 'UNKNOWN', query }
  }

  const candidates = byRoot.get(rootOf(norm)) ?? []
  if (candidates.length > 1) {
    return { status: 'AMBIGUOUS', query, candidates: sortCandidates(candidates) }
  }
  if (candidates.length === 1) {
    return { status: 'RESOLVED', security: candidates[0] }
  }

  const alias = byAlias.get(norm)
  if (alias) return { status: 'RESOLVED', security: alias }

  return { status: 'UNKNOWN', query }
}

/**
 * Case-insensitive search over symbol, displaySymbol, name and aliases. Ranked
 * exact > symbol-prefix/alias-exact > name-prefix > substring, with a stable
 * securityId tie-break. Intended for a future command-palette integration.
 */
export function searchSecurities(query: string, limit = 10): Security[] {
  const q = query.trim().toUpperCase()
  if (!q) return []

  const scored: { security: Security; score: number }[] = []
  for (const security of SECURITY_MASTER_SEED) {
    const symbol = security.symbol.toUpperCase()
    const display = security.displaySymbol.toUpperCase()
    const name = security.name.toUpperCase()
    const aliases = (security.aliases ?? []).map(a => a.toUpperCase())

    let score: number
    if (symbol === q || display === q) score = 0
    else if (aliases.includes(q)) score = 1
    else if (symbol.startsWith(q) || display.startsWith(q)) score = 2
    else if (name.startsWith(q)) score = 3
    else if (symbol.includes(q) || display.includes(q) || name.includes(q)) score = 4
    else if (aliases.some(a => a.includes(q))) score = 5
    else continue

    scored.push({ security, score })
  }

  scored.sort((a, b) =>
    a.score !== b.score ? a.score - b.score : a.security.securityId.localeCompare(b.security.securityId),
  )

  return scored.slice(0, Math.max(0, limit)).map(s => s.security)
}

// ─── Backward-compatible accessors (exact, best-effort, never throw) ───────────

/** Display name for a symbol, falling back to the raw symbol if unknown. */
export function getSecurityDisplayName(symbol: string): string {
  return getSecurityBySymbol(symbol)?.name ?? symbol
}

/** Currency for a symbol, or undefined if unknown. */
export function getSecurityCurrency(symbol: string): string | undefined {
  return getSecurityBySymbol(symbol)?.currency
}

/** Exchange for a symbol, or undefined if unknown. */
export function getSecurityExchange(symbol: string): string | undefined {
  return getSecurityBySymbol(symbol)?.exchange
}

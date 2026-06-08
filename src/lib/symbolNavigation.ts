import { resolveSecurity } from '@/services/security/securityMaster'
import type { Security } from '@/types/security'

// ─── Symbol navigation resolution (Phase 0C-3) ────────────────────────────────
//
// Single shared policy for translating user-entered raw symbols into navigation
// intent. Both SecurityDetail's SymbolInput and the command palette use this
// so the AMBIGUOUS rule is enforced in one place.
//
// RESOLVED  → navigate to the canonical symbol from the master
// AMBIGUOUS → return candidates so the caller shows a chooser (never guess)
// UNKNOWN   → pass the uppercased input through unchanged (provider fallback)

export type SymbolNavigationResult =
  | { action: 'navigate'; symbol: string }
  | { action: 'choose'; candidates: Security[] }

/**
 * Resolves a user-entered raw symbol for navigation purposes.
 *
 * - **RESOLVED**: navigate to `security.symbol` (canonical, normalized form).
 * - **AMBIGUOUS**: caller must show a disambiguation chooser; never silently picks.
 * - **UNKNOWN**: navigate to the uppercased/trimmed input as-is — the market
 *   data provider handles unseeded symbols just as it always has.
 *
 * This function is the correct entry point for **all user-originated symbols**:
 * command palette, ticker input, future imports. Use `getSecurityByExactSymbol`
 * only for internal, already-canonical data.
 */
export function resolveSymbolForNavigation(rawInput: string): SymbolNavigationResult {
  const res = resolveSecurity(rawInput)
  if (res.status === 'AMBIGUOUS') {
    return { action: 'choose', candidates: res.candidates }
  }
  const sym = rawInput.toUpperCase().trim()
  return {
    action: 'navigate',
    symbol: res.status === 'RESOLVED' ? res.security.symbol : sym,
  }
}

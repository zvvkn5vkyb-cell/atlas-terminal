import { resolveSecurity } from '@/services/security/securityMaster'

// ─── Security identity resolution boundary ────────────────────────────────────
// Thin wrapper around the Phase 0C security master. Translates a raw symbol
// (user-entered or imported) into a canonical securityId plus denormalized
// display fields. Callers must handle all three outcomes explicitly.
//
// The ledger engine itself never calls this — resolution happens at *entry*
// time (UI/import boundary), not in the reducer.

export type SecurityIdentityStatus = 'RESOLVED' | 'AMBIGUOUS' | 'UNKNOWN'

export interface SecurityIdentityResult {
  status: SecurityIdentityStatus
  securityId?: string
  symbol?: string
  displaySymbol?: string
  name?: string
  currency?: string
  candidates?: Array<{ securityId: string; symbol: string; displaySymbol: string; name: string }>
}

export function attachSecurityIdentity(rawSymbol: string): SecurityIdentityResult {
  const resolution = resolveSecurity(rawSymbol)

  if (resolution.status === 'RESOLVED') {
    const { security } = resolution
    return {
      status: 'RESOLVED',
      securityId: security.securityId,
      symbol: security.symbol,
      displaySymbol: security.displaySymbol,
      name: security.name,
      currency: security.currency,
    }
  }

  if (resolution.status === 'AMBIGUOUS') {
    return {
      status: 'AMBIGUOUS',
      candidates: resolution.candidates.map(s => ({
        securityId: s.securityId,
        symbol: s.symbol,
        displaySymbol: s.displaySymbol,
        name: s.name,
      })),
    }
  }

  return { status: 'UNKNOWN' }
}

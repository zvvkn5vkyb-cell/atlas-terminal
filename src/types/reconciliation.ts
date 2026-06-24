// Read-Only Ledger-to-Portfolio Reconciliation types (Phase 1-3).
//
// All types are pure data structures — no logic, no side effects.
// ReconciliationResult is never persisted; it is computed on demand and discarded.

import type { Holding, CashPosition } from './portfolio'
import type { DerivedPosition, CashBalance } from './ledger'

// ─── Tolerances ───────────────────────────────────────────────────────────────

export interface ReconciliationTolerance {
  /** Absolute quantity delta permitted for a MATCH. */
  quantityAbsolute: number
  /** Relative quantity delta (fraction of portfolio quantity) permitted for a MATCH. */
  quantityRelative: number
  /** Absolute cash delta permitted for a cash MATCH. */
  cashAbsolute: number
  /** Relative cash delta (fraction of portfolio cash amount) permitted for a cash MATCH. */
  cashRelative: number
}

export const DEFAULT_RECONCILIATION_TOLERANCE: ReconciliationTolerance = {
  quantityAbsolute: 0.0001,
  quantityRelative: 0.0001,
  cashAbsolute: 0.01,
  cashRelative: 0,
}

// ─── Status ───────────────────────────────────────────────────────────────────

export type ReconciliationStatus =
  | 'MATCH'             // quantity and currency match within tolerance
  | 'QUANTITY_MISMATCH' // same identity and currency; quantities differ beyond tolerance
  | 'CURRENCY_MISMATCH' // same resolved identity; native currencies differ
  | 'IDENTITY_MISMATCH' // symbols match; both sides canonical; securityIds differ — consumes both
  | 'ONLY_IN_PORTFOLIO' // holding exists; ledger has no counterpart
  | 'ONLY_IN_LEDGER'    // ledger position exists; portfolio has no counterpart
  | 'AMBIGUOUS'         // portfolio symbol resolves to multiple securities
  | 'UNRESOLVED'        // portfolio symbol unknown to master AND no raw-symbol fallback matched
  | 'DUPLICATE'         // same identity on ≥2 records on the same side
  | 'NOT_COMPARABLE'    // position exists but cannot be meaningfully compared

export type ReconciliationIssueSeverity = 'ERROR' | 'WARNING' | 'INFO'

export interface ReconciliationIssue {
  code: string
  message: string
  severity: ReconciliationIssueSeverity
}

// ─── Normalized forms ─────────────────────────────────────────────────────────

export interface NormalizedPortfolioPosition {
  holdingId: string
  symbol: string                    // trim + uppercase of Holding.symbol
  securityId?: string               // canonical id from resolveSecurity (RESOLVED only)
  currency: string
  quantity: number                  // Holding.shares
  averageCost: number               // Holding.costBasis (per share)
  totalCost: number                 // Holding.costBasis × Holding.shares
  resolutionStatus: 'RESOLVED' | 'AMBIGUOUS' | 'UNKNOWN'
  resolutionCandidates?: Array<{ securityId: string; symbol: string; name: string }>
}

export interface NormalizedLedgerPosition {
  positionKey: string               // trim + uppercase of DerivedPosition.securityId
  resolvedSecurityId?: string       // canonical id if positionKey is known to master
  symbol?: string                   // trim + uppercase of DerivedPosition.symbol
  currency: string
  quantity: number
  averageCost: number
  totalCost: number
  isCanonical: boolean              // true iff getSecurityById(positionKey) resolves
}

// ─── Per-position row ─────────────────────────────────────────────────────────

export interface PositionReconciliationRow {
  status: ReconciliationStatus
  matchKey?: string
  portfolioPosition?: NormalizedPortfolioPosition
  ledgerPosition?: NormalizedLedgerPosition
  quantityDelta?: number            // portfolio.quantity - ledger.quantity (when both present)
  costBasisDelta?: number           // portfolio.totalCost - ledger.totalCost (INFO only)
  currencyMismatch?: { portfolioCurrency: string; ledgerCurrency: string }
  issues: ReconciliationIssue[]
}

// ─── Cash comparison row ──────────────────────────────────────────────────────

export type CashReconciliationStatus =
  | 'MATCH'
  | 'MISMATCH'
  | 'ONLY_IN_PORTFOLIO'
  | 'ONLY_IN_LEDGER'

export interface CashReconciliationRow {
  currency: string
  portfolioAmount?: number          // CashPosition.amount (native currency only — never usdEquivalent/pct)
  ledgerAmount?: number             // CashBalance.amount
  delta?: number                    // portfolioAmount - ledgerAmount (when both present)
  status: CashReconciliationStatus
  issues: ReconciliationIssue[]
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export interface ReconciliationSummary {
  totalPortfolioPositions: number
  totalLedgerPositions: number
  /** Rows where both sides are present and status is MATCH, QUANTITY_MISMATCH, or CURRENCY_MISMATCH. */
  comparablePositionCount: number
  /**
   * true when comparablePositionCount > 0 OR at least one cash row compares both sides.
   * When false alongside isFullyReconciled: true, the result means "nothing to reconcile"
   * (both inputs were empty), NOT "reconciled successfully."
   */
  hasComparableData: boolean
  matchCount: number
  quantityMismatchCount: number
  currencyMismatchCount: number
  identityMismatchCount: number
  onlyInPortfolioCount: number
  onlyInLedgerCount: number
  ambiguousCount: number
  unresolvedCount: number
  duplicateCount: number
  notComparableCount: number
  /**
   * true only when:
   *   - every position row has status MATCH
   *   - every cash row (when cash was compared) has status MATCH
   *   - no row carries an ERROR or WARNING issue
   * INFO issues alone do not prevent full reconciliation.
   * UNVERIFIED_RAW_SYMBOL_MATCH is WARNING — it prevents full reconciliation.
   * NONCANONICAL_LEDGER_SYMBOL_MATCH is INFO — it does not prevent full reconciliation.
   */
  isFullyReconciled: boolean
  isCashCompared: boolean
  /** Copied verbatim from ReconciliationInput.reconciledAt — never generated internally. */
  reconciledAt: string
}

// ─── Top-level result ─────────────────────────────────────────────────────────

export interface ReconciliationResult {
  positions: PositionReconciliationRow[]
  cash?: CashReconciliationRow[]
  summary: ReconciliationSummary
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface ReconciliationInput {
  portfolioHoldings: Holding[]
  ledgerPositions: DerivedPosition[]
  /** Cash compared only when BOTH portfolioCash and ledgerCash are supplied. */
  portfolioCash?: CashPosition[]
  ledgerCash?: CashBalance[]
  tolerance?: ReconciliationTolerance
  /** Required — caller-supplied ISO timestamp. No function generates a timestamp internally. */
  reconciledAt: string
}

// Transaction Ledger Foundation (Phase 1).
//
// All numeric fields on LedgerTransaction are POSITIVE MAGNITUDES.
// The transaction type determines cash and position direction; sign is never
// encoded in the field value. This eliminates sign-error bugs at the entry
// boundary and makes validation trivial.
//
// Positions and cash balances are currency-segregated. There is no
// cross-currency NAV consolidation in this phase.

// ─── Transaction types ────────────────────────────────────────────────────────

export type TransactionType =
  | 'BUY'
  | 'SELL'
  | 'DIVIDEND'
  | 'DISTRIBUTION'
  | 'INTEREST'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'FEE'
  | 'TAX'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'FX_CONVERSION'
  | 'SPLIT'
  | 'RETURN_OF_CAPITAL'
  | 'ADJUSTMENT'

export type LedgerTransactionSource = 'MANUAL' | 'IMPORT' | 'SEED'

// FIFO is typed for future use; only AVERAGE is implemented in Phase 1.
export type CostBasisMethod = 'AVERAGE' | 'FIFO'

// ─── LedgerTransaction ────────────────────────────────────────────────────────

export interface LedgerTransaction {
  transactionId: string
  type: TransactionType
  tradeDate: string              // ISO date 'YYYY-MM-DD'
  settlementDate?: string

  // Security identity — required for security-bearing types (BUY/SELL/SPLIT/ROC).
  // Engine groups positions by securityId when present, falls back to symbol.
  securityId?: string            // canonical Phase 0C id ('US:AAPL', 'CA:RY.TO')
  symbol?: string                // denormalized snapshot at entry time
  displaySymbol?: string

  // Quantities and money — POSITIVE MAGNITUDES; type determines direction.
  quantity?: number              // shares for equity transactions
  price?: number                 // per-share in `currency`
  amount?: number                // gross cash for cash-type transactions
  fees?: number                  // transaction fees in `currency`
  tax?: number                   // withholding tax in `currency`

  currency: string               // settlement currency ('USD', 'CAD')
  fxRate?: number                // base-per-currency at trade time; STORED but NOT used by engine

  splitRatio?: { numerator: number; denominator: number }
  linkedTransactionId?: string   // FX_CONVERSION pair; TRANSFER pair

  accountId?: string
  source: LedgerTransactionSource
  note?: string
  createdAt?: string
  updatedAt?: string
}

// ─── Derived position (price-free) ───────────────────────────────────────────

export interface DerivedPosition {
  securityId: string             // position key (securityId ?? symbol fallback)
  symbol?: string
  displaySymbol?: string
  currency: string
  quantity: number
  totalCost: number
  averageCost: number            // = totalCost / quantity, or 0 when flat
  realizedPnL: number            // cumulative realized in `currency`
  lastTransactionDate: string
}

// Returned by valuePositions() — only produced when caller supplies a price.
export interface ValuedPosition extends DerivedPosition {
  marketPrice: number
  marketValue: number
  unrealizedPnL: number
  unrealizedPnLPct: number
}

// ─── Cash ─────────────────────────────────────────────────────────────────────

export interface CashBalance {
  currency: string
  amount: number                 // may go negative; flagged by validation, not blocked
}

// ─── Realized gains ──────────────────────────────────────────────────────────

export interface RealizedGainEntry {
  transactionId: string
  securityId: string
  date: string
  currency: string
  quantitySold: number
  proceeds: number
  costRemoved: number
  gain: number                   // proceeds - costRemoved
}

// ─── Income ───────────────────────────────────────────────────────────────────

export type IncomeType = 'DIVIDEND' | 'DISTRIBUTION' | 'INTEREST'

export interface IncomeEntry {
  transactionId: string
  type: IncomeType
  securityId?: string
  symbol?: string
  currency: string
  gross: number
  taxWithheld: number
  net: number                    // = gross - taxWithheld
  date: string
}

// ─── Warnings ─────────────────────────────────────────────────────────────────

export interface LedgerWarning {
  transactionId: string
  code: string
  message: string
}

// ─── Ledger state (output of deriveLedgerState) ───────────────────────────────

export interface LedgerState {
  positions: DerivedPosition[]
  cashBalances: CashBalance[]
  realizedGains: RealizedGainEntry[]
  income: IncomeEntry[]
  totalFees: Record<string, number>   // currency → cumulative fees
  totalTax: Record<string, number>    // currency → cumulative standalone tax
  warnings: LedgerWarning[]
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface LedgerOptions {
  costBasisMethod?: CostBasisMethod   // default: 'AVERAGE'
  accountId?: string
}

// ─── Validation ───────────────────────────────────────────────────────────────

export type LedgerIssueSeverity = 'ERROR' | 'WARNING'

export interface LedgerIssue {
  field?: string
  code: string
  message: string
  severity: LedgerIssueSeverity
}

export interface TransactionValidationResult {
  transactionId: string
  valid: boolean
  issues: LedgerIssue[]
}

// ─── Mutation results (Phase 1-2) ─────────────────────────────────────────────

export type LedgerMutationErrorCode = 'VALIDATION_ERROR' | 'DUPLICATE_ID' | 'NOT_FOUND'

export interface LedgerMutationResult {
  success: boolean
  transactionId?: string
  issues: LedgerIssue[]
  errorCode?: LedgerMutationErrorCode
}

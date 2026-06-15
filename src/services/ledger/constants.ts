import type { CostBasisMethod, LedgerState, TransactionType } from '@/types/ledger'

export const DEFAULT_ACCOUNT_ID = 'DEFAULT_ACCOUNT'
export const LEDGER_BASE_CURRENCY = 'USD'
export const DEFAULT_COST_BASIS_METHOD: CostBasisMethod = 'AVERAGE'

// Audit action constants for Phase 1-2 wiring
export const AUDIT_ACTION_TRANSACTION_CREATE = 'TRANSACTION.CREATE'
export const AUDIT_ACTION_TRANSACTION_UPDATE = 'TRANSACTION.UPDATE'
export const AUDIT_ACTION_TRANSACTION_DELETE = 'TRANSACTION.DELETE'
export const AUDIT_ACTION_TRANSACTION_IMPORT = 'TRANSACTION.IMPORT'
export const AUDIT_ACTION_TRANSACTION_CLEAR = 'TRANSACTION.CLEAR'

// Empty ledger state — the dormant store's initial value and the result of
// clearTransactions(). Matches deriveLedgerState([]).
export const EMPTY_LEDGER_STATE: LedgerState = {
  positions: [],
  cashBalances: [],
  realizedGains: [],
  income: [],
  totalFees: {},
  totalTax: {},
  warnings: [],
}

// Types that require a security identity (securityId or symbol) and a quantity.
export const SECURITY_QUANTITY_TYPES: ReadonlySet<TransactionType> = new Set<TransactionType>([
  'BUY', 'SELL', 'SPLIT',
])

// Types that require an amount (gross cash value).
export const AMOUNT_REQUIRED_TYPES: ReadonlySet<TransactionType> = new Set<TransactionType>([
  'DIVIDEND', 'DISTRIBUTION', 'INTEREST',
  'DEPOSIT', 'WITHDRAWAL',
  'FEE', 'TAX',
  'RETURN_OF_CAPITAL',
  'FX_CONVERSION',
])

// Income-generating types (affect income ledger and cash).
export const INCOME_TYPES: ReadonlySet<TransactionType> = new Set<TransactionType>([
  'DIVIDEND', 'DISTRIBUTION', 'INTEREST',
])

// Types that require linkedTransactionId for pairing.
export const LINKED_REQUIRED_TYPES: ReadonlySet<TransactionType> = new Set<TransactionType>([
  'FX_CONVERSION',
])

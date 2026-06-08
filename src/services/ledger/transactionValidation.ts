import type { LedgerTransaction, LedgerIssue, TransactionValidationResult } from '@/types/ledger'
import {
  SECURITY_QUANTITY_TYPES,
  AMOUNT_REQUIRED_TYPES,
  LINKED_REQUIRED_TYPES,
} from './constants'

// ─── Single-transaction validation ───────────────────────────────────────────
// Returns structured issues; never throws.

export function validateTransaction(txn: LedgerTransaction): TransactionValidationResult {
  const issues: LedgerIssue[] = []

  // transactionId
  if (!txn.transactionId || !txn.transactionId.trim()) {
    issues.push({ field: 'transactionId', code: 'MISSING_ID', message: 'transactionId is required', severity: 'ERROR' })
  }

  // tradeDate
  if (!txn.tradeDate || !/^\d{4}-\d{2}-\d{2}$/.test(txn.tradeDate)) {
    issues.push({ field: 'tradeDate', code: 'INVALID_DATE', message: 'tradeDate must be YYYY-MM-DD', severity: 'ERROR' })
  }

  // currency
  if (!txn.currency || !txn.currency.trim()) {
    issues.push({ field: 'currency', code: 'MISSING_CURRENCY', message: 'currency is required', severity: 'ERROR' })
  }

  // Security identity for quantity-bearing types (BUY, SELL, SPLIT)
  if (SECURITY_QUANTITY_TYPES.has(txn.type)) {
    if (!txn.securityId && !txn.symbol) {
      issues.push({ field: 'securityId', code: 'MISSING_SECURITY', message: `${txn.type} requires securityId or symbol`, severity: 'ERROR' })
    }
    if (txn.quantity === undefined || txn.quantity === null) {
      issues.push({ field: 'quantity', code: 'MISSING_QUANTITY', message: `${txn.type} requires quantity`, severity: 'ERROR' })
    } else if (txn.quantity <= 0) {
      issues.push({ field: 'quantity', code: 'INVALID_QUANTITY', message: 'quantity must be greater than zero', severity: 'ERROR' })
    }
  }

  // Price for BUY/SELL
  if (txn.type === 'BUY' || txn.type === 'SELL') {
    if (txn.price === undefined || txn.price === null) {
      issues.push({ field: 'price', code: 'MISSING_PRICE', message: `${txn.type} requires price`, severity: 'ERROR' })
    } else if (txn.price < 0) {
      issues.push({ field: 'price', code: 'INVALID_PRICE', message: 'price must be >= 0', severity: 'ERROR' })
    }
  }

  // RETURN_OF_CAPITAL: needs securityId/symbol and amount
  if (txn.type === 'RETURN_OF_CAPITAL') {
    if (!txn.securityId && !txn.symbol) {
      issues.push({ field: 'securityId', code: 'MISSING_SECURITY', message: 'RETURN_OF_CAPITAL requires securityId or symbol', severity: 'ERROR' })
    }
    if (txn.amount === undefined || txn.amount === null) {
      issues.push({ field: 'amount', code: 'MISSING_AMOUNT', message: 'RETURN_OF_CAPITAL requires amount', severity: 'ERROR' })
    } else if (txn.amount <= 0) {
      issues.push({ field: 'amount', code: 'INVALID_AMOUNT', message: 'RETURN_OF_CAPITAL amount must be > 0', severity: 'ERROR' })
    }
  }

  // Amount for cash-centric types
  if (AMOUNT_REQUIRED_TYPES.has(txn.type) && txn.type !== 'RETURN_OF_CAPITAL') {
    if (txn.amount === undefined || txn.amount === null) {
      issues.push({ field: 'amount', code: 'MISSING_AMOUNT', message: `${txn.type} requires amount`, severity: 'ERROR' })
    } else if (txn.amount <= 0) {
      issues.push({ field: 'amount', code: 'INVALID_AMOUNT', message: 'amount must be > 0', severity: 'ERROR' })
    }
  }

  // SPLIT ratio
  if (txn.type === 'SPLIT') {
    if (!txn.splitRatio) {
      issues.push({ field: 'splitRatio', code: 'MISSING_SPLIT_RATIO', message: 'SPLIT requires splitRatio', severity: 'ERROR' })
    } else {
      if (txn.splitRatio.numerator <= 0) {
        issues.push({ field: 'splitRatio.numerator', code: 'INVALID_SPLIT_RATIO', message: 'splitRatio.numerator must be > 0', severity: 'ERROR' })
      }
      if (txn.splitRatio.denominator <= 0) {
        issues.push({ field: 'splitRatio.denominator', code: 'INVALID_SPLIT_RATIO', message: 'splitRatio.denominator must be > 0', severity: 'ERROR' })
      }
    }
  }

  // Linked transaction required for FX_CONVERSION
  if (LINKED_REQUIRED_TYPES.has(txn.type) && !txn.linkedTransactionId) {
    issues.push({ field: 'linkedTransactionId', code: 'MISSING_LINKED_ID', message: `${txn.type} requires linkedTransactionId`, severity: 'ERROR' })
  }

  // ADJUSTMENT: must have a note
  if (txn.type === 'ADJUSTMENT' && (!txn.note || !txn.note.trim())) {
    issues.push({ field: 'note', code: 'MISSING_NOTE', message: 'ADJUSTMENT requires a note explaining the correction', severity: 'ERROR' })
  }

  // TRANSFER_IN security: if quantity is present, securityId/symbol required; also cost basis (price) required
  if (txn.type === 'TRANSFER_IN' && txn.quantity !== undefined) {
    if (!txn.securityId && !txn.symbol) {
      issues.push({ field: 'securityId', code: 'MISSING_SECURITY', message: 'TRANSFER_IN with quantity requires securityId or symbol', severity: 'ERROR' })
    }
    if (txn.price === undefined || txn.price === null) {
      issues.push({ field: 'price', code: 'MISSING_COST_BASIS', message: 'TRANSFER_IN with quantity requires price (cost basis per share)', severity: 'ERROR' })
    }
  }

  // Non-negative fee/tax
  if (txn.fees !== undefined && txn.fees < 0) {
    issues.push({ field: 'fees', code: 'INVALID_FEES', message: 'fees must be >= 0', severity: 'ERROR' })
  }
  if (txn.tax !== undefined && txn.tax < 0) {
    issues.push({ field: 'tax', code: 'INVALID_TAX', message: 'tax must be >= 0', severity: 'ERROR' })
  }

  const hasError = issues.some(i => i.severity === 'ERROR')
  return { transactionId: txn.transactionId ?? '', valid: !hasError, issues }
}

// ─── Batch validation ─────────────────────────────────────────────────────────

export function validateTransactions(txns: LedgerTransaction[]): TransactionValidationResult[] {
  return txns.map(validateTransaction)
}

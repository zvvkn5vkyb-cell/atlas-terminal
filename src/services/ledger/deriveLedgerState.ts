import type {
  LedgerTransaction,
  LedgerState,
  LedgerOptions,
  DerivedPosition,
  CashBalance,
  RealizedGainEntry,
  IncomeEntry,
  LedgerWarning,
  ValuedPosition,
} from '@/types/ledger'
import { DEFAULT_COST_BASIS_METHOD, INCOME_TYPES } from './constants'
import type { ACBState } from './costBasis'
import { ZERO_ACB, applyBuy, applySell, applySplit, applyReturnOfCapital } from './costBasis'

// ─── Sorting ──────────────────────────────────────────────────────────────────
// Deterministic: (tradeDate ASC, transactionId ASC)

export function sortTransactions(txns: LedgerTransaction[]): LedgerTransaction[] {
  return [...txns].sort((a, b) => {
    const dateCmp = a.tradeDate.localeCompare(b.tradeDate)
    return dateCmp !== 0 ? dateCmp : a.transactionId.localeCompare(b.transactionId)
  })
}

// ─── Internal accumulator helpers ─────────────────────────────────────────────

interface PositionAccum extends ACBState {
  symbol?: string
  displaySymbol?: string
  currency: string
  realizedPnL: number
  lastTransactionDate: string
}

function positionKey(txn: LedgerTransaction): string | null {
  return txn.securityId ?? txn.symbol ?? null
}

function addCash(cashMap: Map<string, number>, currency: string, delta: number): void {
  cashMap.set(currency, (cashMap.get(currency) ?? 0) + delta)
}

// ─── deriveLedgerState ────────────────────────────────────────────────────────
// Pure reducer over a LedgerTransaction[]. Returns an immutable LedgerState.
// Never throws; warnings accumulate in state.warnings.

export function deriveLedgerState(
  transactions: LedgerTransaction[],
  options: LedgerOptions = {},
): LedgerState {
  const { costBasisMethod = DEFAULT_COST_BASIS_METHOD } = options

  if (costBasisMethod === 'FIFO') {
    // FIFO is typed but deferred — fall back to AVERAGE with a note.
    // This branch will never be reached by tested code paths in Phase 1.
    options = { ...options, costBasisMethod: 'AVERAGE' }
  }

  const sorted = sortTransactions(transactions)

  const posMap = new Map<string, PositionAccum>()
  const cashMap = new Map<string, number>()
  const realizedGains: RealizedGainEntry[] = []
  const income: IncomeEntry[] = []
  const totalFees: Record<string, number> = {}
  const totalTax: Record<string, number> = {}
  const warnings: LedgerWarning[] = []

  // For FX_CONVERSION pair tracking: first-seen processes both sides.
  const fxProcessed = new Set<string>()
  // Build a lookup from transactionId → transaction for FX linking.
  const txnById = new Map<string, LedgerTransaction>()
  for (const txn of sorted) txnById.set(txn.transactionId, txn)

  function warn(transactionId: string, code: string, message: string): void {
    warnings.push({ transactionId, code, message })
  }

  function getOrInitPosition(key: string, txn: LedgerTransaction): PositionAccum {
    if (!posMap.has(key)) {
      posMap.set(key, {
        ...ZERO_ACB,
        symbol: txn.symbol,
        displaySymbol: txn.displaySymbol,
        currency: txn.currency,
        realizedPnL: 0,
        lastTransactionDate: txn.tradeDate,
      })
    }
    return posMap.get(key)!
  }

  for (const txn of sorted) {
    const { transactionId: id, type, currency, tradeDate } = txn

    // Skip FX_CONVERSION transactions already processed as the linked side.
    if (type === 'FX_CONVERSION' && fxProcessed.has(id)) continue

    switch (type) {

      // ─── BUY ──────────────────────────────────────────────────────────────
      case 'BUY': {
        const key = positionKey(txn)
        if (!key) { warn(id, 'MISSING_SECURITY_KEY', 'BUY has no securityId or symbol; skipped'); break }
        const qty = txn.quantity ?? 0
        const price = txn.price ?? 0
        const fees = txn.fees ?? 0
        const pos = getOrInitPosition(key, txn)
        const next = applyBuy(pos, qty, price, fees)
        pos.quantity = next.quantity
        pos.totalCost = next.totalCost
        pos.averageCost = next.averageCost
        pos.lastTransactionDate = tradeDate
        addCash(cashMap, currency, -(qty * price + fees + (txn.tax ?? 0)))
        break
      }

      // ─── SELL ─────────────────────────────────────────────────────────────
      case 'SELL': {
        const key = positionKey(txn)
        if (!key) { warn(id, 'MISSING_SECURITY_KEY', 'SELL has no securityId or symbol; skipped'); break }
        const qty = txn.quantity ?? 0
        const price = txn.price ?? 0
        const fees = txn.fees ?? 0
        const tax = txn.tax ?? 0
        const pos = getOrInitPosition(key, txn)
        const result = applySell(pos, qty, price, fees, tax)
        if (result.wasOversell) {
          warn(id, 'OVERSELL', `SELL quantity ${qty} exceeds held ${pos.quantity}; clamped to ${result.actualQuantitySold}`)
        }
        pos.quantity = result.newState.quantity
        pos.totalCost = result.newState.totalCost
        pos.averageCost = result.newState.averageCost
        pos.realizedPnL += result.gain
        pos.lastTransactionDate = tradeDate
        addCash(cashMap, currency, result.proceeds)
        realizedGains.push({
          transactionId: id,
          securityId: key,
          date: tradeDate,
          currency,
          quantitySold: result.actualQuantitySold,
          proceeds: result.proceeds,
          costRemoved: result.costRemoved,
          gain: result.gain,
        })
        break
      }

      // ─── DIVIDEND / DISTRIBUTION / INTEREST ───────────────────────────────
      case 'DIVIDEND':
      case 'DISTRIBUTION':
      case 'INTEREST': {
        if (!INCOME_TYPES.has(type)) break
        const gross = txn.amount ?? 0
        const taxWithheld = txn.tax ?? 0
        const net = gross - taxWithheld
        income.push({
          transactionId: id,
          type: type as 'DIVIDEND' | 'DISTRIBUTION' | 'INTEREST',
          securityId: txn.securityId,
          symbol: txn.symbol,
          currency,
          gross,
          taxWithheld,
          net,
          date: tradeDate,
        })
        addCash(cashMap, currency, net)
        if (taxWithheld > 0) totalTax[currency] = (totalTax[currency] ?? 0) + taxWithheld
        break
      }

      // ─── DEPOSIT ──────────────────────────────────────────────────────────
      case 'DEPOSIT':
        addCash(cashMap, currency, txn.amount ?? 0)
        break

      // ─── WITHDRAWAL ───────────────────────────────────────────────────────
      case 'WITHDRAWAL':
        addCash(cashMap, currency, -(txn.amount ?? 0))
        break

      // ─── FEE ──────────────────────────────────────────────────────────────
      case 'FEE': {
        const amount = txn.amount ?? 0
        addCash(cashMap, currency, -amount)
        totalFees[currency] = (totalFees[currency] ?? 0) + amount
        break
      }

      // ─── TAX ──────────────────────────────────────────────────────────────
      case 'TAX': {
        const amount = txn.amount ?? 0
        addCash(cashMap, currency, -amount)
        totalTax[currency] = (totalTax[currency] ?? 0) + amount
        break
      }

      // ─── TRANSFER_IN ──────────────────────────────────────────────────────
      case 'TRANSFER_IN': {
        if (txn.quantity !== undefined) {
          // Security in-kind transfer — add position at supplied cost basis
          const key = positionKey(txn)
          if (!key) { warn(id, 'MISSING_SECURITY_KEY', 'TRANSFER_IN has quantity but no securityId or symbol; skipped'); break }
          const qty = txn.quantity
          const costPerShare = txn.price ?? 0
          const pos = getOrInitPosition(key, txn)
          const next = applyBuy(pos, qty, costPerShare, 0)
          pos.quantity = next.quantity
          pos.totalCost = next.totalCost
          pos.averageCost = next.averageCost
          pos.lastTransactionDate = tradeDate
        } else {
          // Cash transfer
          addCash(cashMap, currency, txn.amount ?? 0)
        }
        break
      }

      // ─── TRANSFER_OUT ─────────────────────────────────────────────────────
      case 'TRANSFER_OUT': {
        if (txn.quantity !== undefined) {
          // Security in-kind transfer out — remove position at average cost
          const key = positionKey(txn)
          if (!key) { warn(id, 'MISSING_SECURITY_KEY', 'TRANSFER_OUT has quantity but no securityId or symbol; skipped'); break }
          const qty = txn.quantity
          const pos = getOrInitPosition(key, txn)
          const result = applySell(pos, qty, pos.averageCost, 0, 0)
          if (result.wasOversell) {
            warn(id, 'OVERSELL', `TRANSFER_OUT quantity ${qty} exceeds held ${pos.quantity}; clamped`)
          }
          pos.quantity = result.newState.quantity
          pos.totalCost = result.newState.totalCost
          pos.averageCost = result.newState.averageCost
          pos.lastTransactionDate = tradeDate
          // No cash effect; no realized gain (transfer out is not a sale)
        } else {
          addCash(cashMap, currency, -(txn.amount ?? 0))
        }
        break
      }

      // ─── FX_CONVERSION ────────────────────────────────────────────────────
      // First-encountered side reduces its currency; linked side adds its currency.
      case 'FX_CONVERSION': {
        addCash(cashMap, currency, -(txn.amount ?? 0))
        const linkedId = txn.linkedTransactionId
        if (linkedId) {
          const linked = txnById.get(linkedId)
          if (linked) {
            addCash(cashMap, linked.currency, linked.amount ?? 0)
            fxProcessed.add(linkedId)
          } else {
            warn(id, 'MISSING_LINKED_TXN', `FX_CONVERSION linkedTransactionId '${linkedId}' not found; buy side not applied`)
          }
        } else {
          warn(id, 'MISSING_LINKED_ID', 'FX_CONVERSION has no linkedTransactionId; buy side not applied')
        }
        break
      }

      // ─── SPLIT ────────────────────────────────────────────────────────────
      case 'SPLIT': {
        const key = positionKey(txn)
        if (!key) { warn(id, 'MISSING_SECURITY_KEY', 'SPLIT has no securityId or symbol; skipped'); break }
        const ratio = txn.splitRatio
        if (!ratio || ratio.numerator <= 0 || ratio.denominator <= 0) {
          warn(id, 'INVALID_SPLIT_RATIO', 'SPLIT has invalid or missing splitRatio; skipped')
          break
        }
        const pos = getOrInitPosition(key, txn)
        const next = applySplit(pos, ratio.numerator, ratio.denominator)
        pos.quantity = next.quantity
        pos.totalCost = next.totalCost
        pos.averageCost = next.averageCost
        pos.lastTransactionDate = tradeDate
        break
      }

      // ─── RETURN_OF_CAPITAL ────────────────────────────────────────────────
      case 'RETURN_OF_CAPITAL': {
        const key = positionKey(txn)
        if (!key) { warn(id, 'MISSING_SECURITY_KEY', 'RETURN_OF_CAPITAL has no securityId or symbol; skipped'); break }
        const amount = txn.amount ?? 0
        const pos = getOrInitPosition(key, txn)
        const result = applyReturnOfCapital(pos, amount)
        pos.totalCost = result.newState.totalCost
        pos.averageCost = result.newState.averageCost
        pos.lastTransactionDate = tradeDate
        addCash(cashMap, currency, amount)
        if (result.excessGain > 0) {
          pos.realizedPnL += result.excessGain
          realizedGains.push({
            transactionId: id,
            securityId: key,
            date: tradeDate,
            currency,
            quantitySold: 0,
            proceeds: result.excessGain,
            costRemoved: 0,
            gain: result.excessGain,
          })
        }
        break
      }

      // ─── ADJUSTMENT ───────────────────────────────────────────────────────
      // Explicit manual correction. May adjust quantity, totalCost, or cash.
      // Always generates an informational warning for traceability.
      case 'ADJUSTMENT': {
        warn(id, 'ADJUSTMENT_APPLIED', `ADJUSTMENT applied: ${txn.note ?? '(no note)'}`)
        const key = positionKey(txn)
        if (key && txn.quantity !== undefined) {
          const pos = getOrInitPosition(key, txn)
          const price = txn.price ?? pos.averageCost
          if (txn.quantity >= 0) {
            const next = applyBuy(pos, txn.quantity, price, 0)
            pos.quantity = next.quantity
            pos.totalCost = next.totalCost
            pos.averageCost = next.averageCost
          } else {
            warn(id, 'ADJUSTMENT_NEGATIVE_QTY', 'ADJUSTMENT with negative quantity not supported; use SELL or TRANSFER_OUT')
          }
          pos.lastTransactionDate = tradeDate
        }
        if (txn.amount !== undefined) {
          addCash(cashMap, currency, txn.amount)
        }
        break
      }

      default: break
    }
  }

  // ─── Materialise output ───────────────────────────────────────────────────

  const positions: DerivedPosition[] = []
  for (const [key, acc] of posMap) {
    if (acc.quantity !== 0 || acc.totalCost !== 0 || acc.realizedPnL !== 0) {
      positions.push({
        securityId: key,
        symbol: acc.symbol,
        displaySymbol: acc.displaySymbol,
        currency: acc.currency,
        quantity: acc.quantity,
        totalCost: acc.totalCost,
        averageCost: acc.averageCost,
        realizedPnL: acc.realizedPnL,
        lastTransactionDate: acc.lastTransactionDate,
      })
    }
  }

  const cashBalances: CashBalance[] = []
  for (const [cur, amount] of cashMap) {
    cashBalances.push({ currency: cur, amount })
  }

  return { positions, cashBalances, realizedGains, income, totalFees, totalTax, warnings }
}

// ─── valuePositions ───────────────────────────────────────────────────────────
// Optional enrichment layer. Only positions with a matching price in the lookup
// are returned. The engine itself remains price-free.

export function valuePositions(
  positions: DerivedPosition[],
  priceLookup: Record<string, number>,
): ValuedPosition[] {
  const result: ValuedPosition[] = []
  for (const pos of positions) {
    const marketPrice = priceLookup[pos.securityId] ?? priceLookup[pos.symbol ?? '']
    if (marketPrice === undefined) continue
    const marketValue = pos.quantity * marketPrice
    const unrealizedPnL = marketValue - pos.totalCost
    const unrealizedPnLPct = pos.totalCost > 0 ? unrealizedPnL / pos.totalCost : 0
    result.push({ ...pos, marketPrice, marketValue, unrealizedPnL, unrealizedPnLPct })
  }
  return result
}

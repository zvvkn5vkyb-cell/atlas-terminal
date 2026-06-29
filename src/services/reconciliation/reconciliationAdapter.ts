// Pure snapshot adapter — assembles ReconciliationInput from caller-supplied values.
// No store, React, Date, audit, browser, network, provider, or storage imports.

import type { Holding, CashPosition } from '@/types/portfolio'
import type { LedgerState } from '@/types/ledger'
import type { ReconciliationInput } from '@/types/reconciliation'

export function buildReconciliationInput(
  holdings: Holding[],
  cashPositions: CashPosition[],
  ledgerState: LedgerState,
  reconciledAt: string,
): ReconciliationInput {
  return {
    portfolioHoldings: [...holdings],
    ledgerPositions: [...ledgerState.positions],
    portfolioCash: [...cashPositions],
    ledgerCash: [...ledgerState.cashBalances],
    reconciledAt,
  }
}

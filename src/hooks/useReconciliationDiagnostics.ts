// Point-in-time reconciliation diagnostics hook.
// Reads from both stores exactly once via getState() — no live subscriptions.
// result and ledgerWasEmpty are derived from the same atomic store snapshot and
// stored together as a single ReconciliationDiagnosticSnapshot object.
//
// Snapshot shape: exactly { result, ledgerWasEmpty } — no runAt field.
// The run timestamp is carried inside result.summary.reconciledAt, which is
// set by reconcilePositions from ReconciliationInput.reconciledAt.
//
// ledgerWasEmpty definition: ls.transactions.length === 0
// A ledger is "empty" when no raw transactions have ever been entered.
// A fully-liquidated ledger (all positions sold) has transactions but no open
// positions — it is NOT empty and produces a real diagnostic result.

import { useState, useCallback } from 'react'
import { usePortfolioStore } from '@/store/portfolioStore'
import { useLedgerStore } from '@/store/ledgerStore'
import { reconcilePositions } from '@/services/reconciliation/reconciliation'
import { buildReconciliationInput } from '@/services/reconciliation/reconciliationAdapter'
import type { ReconciliationResult } from '@/types/reconciliation'
import type { LedgerState, LedgerTransaction } from '@/types/ledger'
import type { Holding, CashPosition } from '@/types/portfolio'
import type { ReconciliationDiagnosticSnapshot } from '@/lib/reconciliation/diagnosticsViewModel'

// Re-export so callers can import from one place.
export type { ReconciliationDiagnosticSnapshot }

// ─── Pure runner — exported for Node tests without jsdom or store access ──────
//
// reconciledAt is passed through ReconciliationInput → summary.reconciledAt.
// It is not stored separately — read from result.summary.reconciledAt.
// ledgerWasEmpty = transactions.length === 0 (see module docblock above).

export function runReconciliation(
  holdings: Holding[],
  cashPositions: CashPosition[],
  ledgerState: LedgerState,
  transactions: LedgerTransaction[],
  reconciledAt: string,
): { result: ReconciliationResult; ledgerWasEmpty: boolean } {
  const ledgerWasEmpty = transactions.length === 0
  const input = buildReconciliationInput(holdings, cashPositions, ledgerState, reconciledAt)
  const result = reconcilePositions(input)
  return { result, ledgerWasEmpty }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useReconciliationDiagnostics() {
  const [snapshot, setSnapshot] = useState<ReconciliationDiagnosticSnapshot | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const run = useCallback(() => {
    setIsRunning(true)
    try {
      // Atomic point-in-time read — both stores read at the same instant; no subscriptions
      const ps = usePortfolioStore.getState()
      const ls = useLedgerStore.getState()

      // reconciledAt is passed through to result.summary.reconciledAt; not stored separately
      const reconciledAt = new Date().toISOString()

      // ledgerWasEmpty and result both derived from the same ls snapshot
      const { result, ledgerWasEmpty } = runReconciliation(
        ps.holdings,
        ps.cashPositions,
        ls.ledgerState,
        ls.transactions,
        reconciledAt,
      )

      // Exactly { result, ledgerWasEmpty } — no runAt field
      setSnapshot({ result, ledgerWasEmpty })
    } finally {
      setIsRunning(false)
    }
  }, [])

  return { snapshot, isRunning, run }
}

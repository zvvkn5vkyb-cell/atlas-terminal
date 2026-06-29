// Pure diagnostics view model.
// buildDiagnosticsViewModel is a pure function: no stores, no side effects, no Date().
//
// Status classification order (exact):
//   1. snapshot === null                              → NOT_RUN
//   2. snapshot.ledgerWasEmpty                       → LEDGER_EMPTY
//   3. summary.isFullyReconciled                     → RECONCILED
//   4. any position or cash row has status !== MATCH → MISMATCHES
//   5. otherwise                                     → REVIEW_REQUIRED
//
// REVIEW_REQUIRED applies only when all position and cash statuses are MATCH
// but isFullyReconciled is false because a matched row carries a WARNING or ERROR issue.
// INFO issues alone cannot block full reconciliation and never trigger REVIEW_REQUIRED.
//
// visiblePositionRows includes a row only when:
//   row.status !== 'MATCH'
//   OR row.issues contains severity WARNING or ERROR
// Clean MATCH rows and MATCH rows with only INFO issues are excluded.
// Equivalent filtering applies to visibleCashRows.
//
// Timestamps: there is no runAt field anywhere in this module.
// All timestamps are read from snapshot.result.summary.reconciledAt,
// which is set by reconcilePositions from ReconciliationInput.reconciledAt.

import type {
  ReconciliationResult,
  ReconciliationSummary,
  PositionReconciliationRow,
  CashReconciliationRow,
} from '@/types/reconciliation'

// ReconciliationDiagnosticSnapshot is defined here so the hook can import it,
// keeping the type co-located with its consumer.
// Exactly two fields — no runAt, no separate timestamp.
// The run timestamp is read from result.summary.reconciledAt.
export interface ReconciliationDiagnosticSnapshot {
  result: ReconciliationResult
  ledgerWasEmpty: boolean
}

export type DiagnosticsOverallStatus =
  | 'NOT_RUN'
  | 'LEDGER_EMPTY'
  | 'RECONCILED'
  | 'MISMATCHES'
  | 'REVIEW_REQUIRED'

export interface DiagnosticsViewModel {
  overallStatus: DiagnosticsOverallStatus
  visiblePositionRows: PositionReconciliationRow[]
  visibleCashRows: CashReconciliationRow[]
  summary: ReconciliationSummary | null  // null only when NOT_RUN
  hasWarnings: boolean
}

function hasIssueOfSeverity(row: PositionReconciliationRow | CashReconciliationRow): boolean {
  return row.issues.some(i => i.severity === 'WARNING' || i.severity === 'ERROR')
}

export function buildDiagnosticsViewModel(
  snapshot: ReconciliationDiagnosticSnapshot | null,
): DiagnosticsViewModel {
  if (!snapshot) {
    return {
      overallStatus: 'NOT_RUN',
      visiblePositionRows: [],
      visibleCashRows: [],
      summary: null,
      hasWarnings: false,
    }
  }

  const { result, ledgerWasEmpty } = snapshot
  const { summary, positions, cash = [] } = result

  // Classification in exact order per spec
  let overallStatus: DiagnosticsOverallStatus
  if (ledgerWasEmpty) {
    overallStatus = 'LEDGER_EMPTY'
  } else if (summary.isFullyReconciled) {
    overallStatus = 'RECONCILED'
  } else if (positions.some(r => r.status !== 'MATCH') || cash.some(r => r.status !== 'MATCH')) {
    overallStatus = 'MISMATCHES'
  } else {
    // All statuses are MATCH; isFullyReconciled is false only because a MATCH row
    // carries a WARNING or ERROR issue (INFO alone cannot block full reconciliation).
    overallStatus = 'REVIEW_REQUIRED'
  }

  // visiblePositionRows: non-MATCH or MATCH with WARNING/ERROR (clean and INFO-only MATCH excluded)
  const visiblePositionRows = positions.filter(
    r => r.status !== 'MATCH' || hasIssueOfSeverity(r),
  )

  // visibleCashRows: same filter applied to cash rows
  const visibleCashRows = cash.filter(
    r => r.status !== 'MATCH' || hasIssueOfSeverity(r),
  )

  // hasWarnings: true when ANY row in the full result carries WARNING or ERROR
  const hasWarnings =
    positions.some(hasIssueOfSeverity) || cash.some(hasIssueOfSeverity)

  return {
    overallStatus,
    visiblePositionRows,
    visibleCashRows,
    summary,
    hasWarnings,
  }
}

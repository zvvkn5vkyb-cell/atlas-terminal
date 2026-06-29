import { describe, it, expect } from 'vitest'
import { buildDiagnosticsViewModel } from './diagnosticsViewModel'
import type { ReconciliationDiagnosticSnapshot } from './diagnosticsViewModel'
import type {
  ReconciliationResult,
  PositionReconciliationRow,
  CashReconciliationRow,
  ReconciliationSummary,
} from '@/types/reconciliation'

// ─── Factories ────────────────────────────────────────────────────────────────

function makeSummary(overrides: Partial<ReconciliationSummary> = {}): ReconciliationSummary {
  return {
    totalPortfolioPositions: 0,
    totalLedgerPositions: 0,
    comparablePositionCount: 0,
    hasComparableData: false,
    matchCount: 0,
    quantityMismatchCount: 0,
    currencyMismatchCount: 0,
    identityMismatchCount: 0,
    onlyInPortfolioCount: 0,
    onlyInLedgerCount: 0,
    ambiguousCount: 0,
    unresolvedCount: 0,
    duplicateCount: 0,
    notComparableCount: 0,
    isFullyReconciled: false,
    isCashCompared: false,
    reconciledAt: '2026-06-29T12:00:00.000Z',
    ...overrides,
  }
}

function makeResult(overrides: {
  positions?: PositionReconciliationRow[]
  cash?: CashReconciliationRow[]
  summary?: ReconciliationSummary
} = {}): ReconciliationResult {
  return {
    positions: overrides.positions ?? [],
    cash: overrides.cash,
    summary: overrides.summary ?? makeSummary(),
  }
}

function makeSnapshot(
  positions: PositionReconciliationRow[] = [],
  cash?: CashReconciliationRow[],
  summary?: ReconciliationSummary,
  ledgerWasEmpty = false,
): ReconciliationDiagnosticSnapshot {
  return {
    result: makeResult({ positions, cash, summary }),
    ledgerWasEmpty,
  }
}

// ─── Snapshot shape ───────────────────────────────────────────────────────────

describe('ReconciliationDiagnosticSnapshot shape', () => {
  it('has exactly { ledgerWasEmpty, result } — no runAt', () => {
    const snap = makeSnapshot()
    expect(Object.keys(snap).sort()).toEqual(['ledgerWasEmpty', 'result'])
  })

  it('timestamp is read from result.summary.reconciledAt — no separate runAt required', () => {
    const ts = '2026-06-15T10:00:00.000Z'
    const snap = makeSnapshot([], [], makeSummary({ reconciledAt: ts }))
    expect(snap.result.summary.reconciledAt).toBe(ts)
    // No runAt property exists
    expect(Object.prototype.hasOwnProperty.call(snap, 'runAt')).toBe(false)
  })

  it('view model summary.reconciledAt carries the run timestamp', () => {
    const ts = '2026-06-15T09:30:00.000Z'
    const snap = makeSnapshot(
      [],
      [],
      makeSummary({ reconciledAt: ts, isFullyReconciled: true, hasComparableData: true }),
    )
    const vm = buildDiagnosticsViewModel(snap)
    expect(vm.summary?.reconciledAt).toBe(ts)
  })
})

// ─── NOT_RUN ──────────────────────────────────────────────────────────────────

describe('buildDiagnosticsViewModel — NOT_RUN', () => {
  it('returns NOT_RUN when snapshot is null', () => {
    expect(buildDiagnosticsViewModel(null).overallStatus).toBe('NOT_RUN')
  })

  it('returns empty visible rows when NOT_RUN', () => {
    const vm = buildDiagnosticsViewModel(null)
    expect(vm.visiblePositionRows).toHaveLength(0)
    expect(vm.visibleCashRows).toHaveLength(0)
  })

  it('returns null summary when NOT_RUN', () => {
    expect(buildDiagnosticsViewModel(null).summary).toBeNull()
  })

  it('returns hasWarnings=false when NOT_RUN', () => {
    expect(buildDiagnosticsViewModel(null).hasWarnings).toBe(false)
  })
})

// ─── LEDGER_EMPTY ─────────────────────────────────────────────────────────────

describe('buildDiagnosticsViewModel — LEDGER_EMPTY', () => {
  it('returns LEDGER_EMPTY when ledgerWasEmpty=true', () => {
    const snap = makeSnapshot([], [], makeSummary(), true)
    expect(buildDiagnosticsViewModel(snap).overallStatus).toBe('LEDGER_EMPTY')
  })

  it('LEDGER_EMPTY takes precedence over isFullyReconciled=true', () => {
    const snap = makeSnapshot(
      [],
      [],
      makeSummary({ isFullyReconciled: true, hasComparableData: true }),
      true,
    )
    expect(buildDiagnosticsViewModel(snap).overallStatus).toBe('LEDGER_EMPTY')
  })

  it('LEDGER_EMPTY takes precedence over MISMATCHES', () => {
    const snap = makeSnapshot(
      [{ status: 'QUANTITY_MISMATCH', issues: [] }],
      [],
      makeSummary({ quantityMismatchCount: 1 }),
      true,
    )
    expect(buildDiagnosticsViewModel(snap).overallStatus).toBe('LEDGER_EMPTY')
  })
})

// ─── RECONCILED ───────────────────────────────────────────────────────────────

describe('buildDiagnosticsViewModel — RECONCILED', () => {
  it('returns RECONCILED when isFullyReconciled=true and ledger not empty', () => {
    const snap = makeSnapshot(
      [{ status: 'MATCH', issues: [] }],
      [],
      makeSummary({ isFullyReconciled: true, matchCount: 1, hasComparableData: true }),
    )
    expect(buildDiagnosticsViewModel(snap).overallStatus).toBe('RECONCILED')
  })

  it('MATCH rows with INFO-only issues → RECONCILED when isFullyReconciled=true', () => {
    const snap = makeSnapshot(
      [{ status: 'MATCH', issues: [{ code: 'COST_BASIS_DELTA', message: 'delta 0.01', severity: 'INFO' }] }],
      [],
      makeSummary({ isFullyReconciled: true, matchCount: 1, hasComparableData: true }),
    )
    expect(buildDiagnosticsViewModel(snap).overallStatus).toBe('RECONCILED')
  })
})

// ─── MISMATCHES ───────────────────────────────────────────────────────────────

describe('buildDiagnosticsViewModel — MISMATCHES', () => {
  it('quantity mismatch → MISMATCHES', () => {
    const snap = makeSnapshot(
      [{ status: 'QUANTITY_MISMATCH', issues: [], quantityDelta: 50 }],
      [],
      makeSummary({ hasComparableData: true, quantityMismatchCount: 1, comparablePositionCount: 1 }),
    )
    expect(buildDiagnosticsViewModel(snap).overallStatus).toBe('MISMATCHES')
  })

  it('currency mismatch → MISMATCHES', () => {
    const snap = makeSnapshot(
      [{ status: 'CURRENCY_MISMATCH', issues: [] }],
      [],
      makeSummary({ hasComparableData: true, currencyMismatchCount: 1 }),
    )
    expect(buildDiagnosticsViewModel(snap).overallStatus).toBe('MISMATCHES')
  })

  it('only-in-portfolio → MISMATCHES', () => {
    const snap = makeSnapshot(
      [{ status: 'ONLY_IN_PORTFOLIO', issues: [] }],
      [],
      makeSummary({ onlyInPortfolioCount: 1 }),
    )
    expect(buildDiagnosticsViewModel(snap).overallStatus).toBe('MISMATCHES')
  })

  it('only-in-ledger → MISMATCHES', () => {
    const snap = makeSnapshot(
      [{ status: 'ONLY_IN_LEDGER', issues: [] }],
      [],
      makeSummary({ onlyInLedgerCount: 1 }),
    )
    expect(buildDiagnosticsViewModel(snap).overallStatus).toBe('MISMATCHES')
  })

  it('cash mismatch → MISMATCHES', () => {
    const snap = makeSnapshot(
      [],
      [{ currency: 'USD', portfolioAmount: 1000, ledgerAmount: 900, delta: 100, status: 'MISMATCH', issues: [] }],
      makeSummary({ hasComparableData: true, isCashCompared: true }),
    )
    expect(buildDiagnosticsViewModel(snap).overallStatus).toBe('MISMATCHES')
  })

  it('mixed MATCH and non-MATCH rows → MISMATCHES', () => {
    const snap = makeSnapshot(
      [
        { status: 'MATCH', issues: [] },
        { status: 'QUANTITY_MISMATCH', issues: [] },
      ],
      [],
      makeSummary({ hasComparableData: true, matchCount: 1, quantityMismatchCount: 1 }),
    )
    expect(buildDiagnosticsViewModel(snap).overallStatus).toBe('MISMATCHES')
  })
})

// ─── REVIEW_REQUIRED ──────────────────────────────────────────────────────────

describe('buildDiagnosticsViewModel — REVIEW_REQUIRED', () => {
  it('all MATCH statuses with WARNING issue → REVIEW_REQUIRED (isFullyReconciled=false)', () => {
    const snap = makeSnapshot(
      [
        {
          status: 'MATCH',
          issues: [{ code: 'UNVERIFIED_RAW_SYMBOL_MATCH', message: 'test', severity: 'WARNING' }],
        },
      ],
      [],
      makeSummary({
        hasComparableData: true,
        matchCount: 1,
        comparablePositionCount: 1,
        isFullyReconciled: false,
      }),
    )
    expect(buildDiagnosticsViewModel(snap).overallStatus).toBe('REVIEW_REQUIRED')
  })

  it('multiple MATCH rows all with warnings → REVIEW_REQUIRED', () => {
    const warning = { code: 'W', message: 'm', severity: 'WARNING' as const }
    const snap = makeSnapshot(
      [
        { status: 'MATCH', issues: [warning] },
        { status: 'MATCH', issues: [warning] },
      ],
      [],
      makeSummary({ hasComparableData: true, matchCount: 2, isFullyReconciled: false }),
    )
    expect(buildDiagnosticsViewModel(snap).overallStatus).toBe('REVIEW_REQUIRED')
  })
})

// ─── visiblePositionRows filtering ───────────────────────────────────────────

describe('buildDiagnosticsViewModel — visiblePositionRows filtering', () => {
  it('clean MATCH row is excluded', () => {
    const clean: PositionReconciliationRow = { status: 'MATCH', issues: [] }
    const snap = makeSnapshot([clean], [], makeSummary({ isFullyReconciled: true, matchCount: 1, hasComparableData: true }))
    const vm = buildDiagnosticsViewModel(snap)
    expect(vm.visiblePositionRows).not.toContain(clean)
    expect(vm.visiblePositionRows).toHaveLength(0)
  })

  it('MATCH row with INFO-only issue is excluded', () => {
    const matchInfo: PositionReconciliationRow = {
      status: 'MATCH',
      issues: [{ code: 'COST_BASIS_DELTA', message: 'delta 0.50', severity: 'INFO' }],
    }
    const snap = makeSnapshot([matchInfo], [], makeSummary({ isFullyReconciled: true, matchCount: 1 }))
    expect(buildDiagnosticsViewModel(snap).visiblePositionRows).not.toContain(matchInfo)
  })

  it('MATCH row with WARNING is included', () => {
    const matchWarning: PositionReconciliationRow = {
      status: 'MATCH',
      issues: [{ code: 'UNVERIFIED_RAW_SYMBOL_MATCH', message: 'test', severity: 'WARNING' }],
    }
    expect(buildDiagnosticsViewModel(makeSnapshot([matchWarning])).visiblePositionRows).toContain(matchWarning)
  })

  it('MATCH row with ERROR is included', () => {
    const matchError: PositionReconciliationRow = {
      status: 'MATCH',
      issues: [{ code: 'SOME_ERROR', message: 'test', severity: 'ERROR' }],
    }
    expect(buildDiagnosticsViewModel(makeSnapshot([matchError])).visiblePositionRows).toContain(matchError)
  })

  it('non-MATCH row is included regardless of issue list', () => {
    const onlyInPort: PositionReconciliationRow = { status: 'ONLY_IN_PORTFOLIO', issues: [] }
    expect(buildDiagnosticsViewModel(makeSnapshot([onlyInPort])).visiblePositionRows).toContain(onlyInPort)
  })

  it('non-MATCH row with only INFO issues is included', () => {
    const row: PositionReconciliationRow = {
      status: 'QUANTITY_MISMATCH',
      issues: [{ code: 'COST_BASIS_DELTA', message: 'm', severity: 'INFO' }],
    }
    expect(buildDiagnosticsViewModel(makeSnapshot([row])).visiblePositionRows).toContain(row)
  })

  it('mixes correctly — non-MATCH and warning MATCH included; clean MATCH excluded', () => {
    const clean: PositionReconciliationRow = { status: 'MATCH', issues: [] }
    const mismatch: PositionReconciliationRow = { status: 'QUANTITY_MISMATCH', issues: [] }
    const warningMatch: PositionReconciliationRow = {
      status: 'MATCH',
      issues: [{ code: 'W', message: 'm', severity: 'WARNING' }],
    }
    const vm = buildDiagnosticsViewModel(makeSnapshot([clean, mismatch, warningMatch]))
    expect(vm.visiblePositionRows).not.toContain(clean)
    expect(vm.visiblePositionRows).toContain(mismatch)
    expect(vm.visiblePositionRows).toContain(warningMatch)
    expect(vm.visiblePositionRows).toHaveLength(2)
  })
})

// ─── visibleCashRows filtering ────────────────────────────────────────────────

describe('buildDiagnosticsViewModel — visibleCashRows filtering', () => {
  it('clean MATCH cash row is excluded', () => {
    const clean: CashReconciliationRow = {
      currency: 'USD', portfolioAmount: 1000, ledgerAmount: 1000, delta: 0, status: 'MATCH', issues: [],
    }
    expect(buildDiagnosticsViewModel(makeSnapshot([], [clean])).visibleCashRows).not.toContain(clean)
  })

  it('MATCH cash row with INFO-only issue is excluded', () => {
    const matchInfo: CashReconciliationRow = {
      currency: 'USD', portfolioAmount: 1000, ledgerAmount: 1000, delta: 0, status: 'MATCH',
      issues: [{ code: 'I', message: 'm', severity: 'INFO' }],
    }
    expect(buildDiagnosticsViewModel(makeSnapshot([], [matchInfo])).visibleCashRows).not.toContain(matchInfo)
  })

  it('MATCH cash row with WARNING is included', () => {
    const matchWarning: CashReconciliationRow = {
      currency: 'USD', portfolioAmount: 1000, ledgerAmount: 1000, delta: 0, status: 'MATCH',
      issues: [{ code: 'W', message: 'm', severity: 'WARNING' }],
    }
    expect(buildDiagnosticsViewModel(makeSnapshot([], [matchWarning])).visibleCashRows).toContain(matchWarning)
  })

  it('non-MATCH cash row is included regardless of issue list', () => {
    const mismatch: CashReconciliationRow = {
      currency: 'USD', portfolioAmount: 1000, ledgerAmount: 900, delta: 100, status: 'MISMATCH', issues: [],
    }
    expect(buildDiagnosticsViewModel(makeSnapshot([], [mismatch])).visibleCashRows).toContain(mismatch)
  })

  it('returns empty array when cash is undefined in result', () => {
    expect(buildDiagnosticsViewModel(makeSnapshot([], undefined)).visibleCashRows).toHaveLength(0)
  })
})

// ─── hasWarnings ─────────────────────────────────────────────────────────────

describe('buildDiagnosticsViewModel — hasWarnings', () => {
  it('false when all rows have no issues', () => {
    expect(buildDiagnosticsViewModel(makeSnapshot([{ status: 'MATCH', issues: [] }])).hasWarnings).toBe(false)
  })

  it('false when all rows have only INFO issues', () => {
    expect(buildDiagnosticsViewModel(makeSnapshot([
      { status: 'MATCH', issues: [{ code: 'C', message: 'm', severity: 'INFO' }] },
    ])).hasWarnings).toBe(false)
  })

  it('true when a position row has WARNING', () => {
    expect(buildDiagnosticsViewModel(makeSnapshot([
      { status: 'MATCH', issues: [{ code: 'W', message: 'm', severity: 'WARNING' }] },
    ])).hasWarnings).toBe(true)
  })

  it('true when a position row has ERROR', () => {
    expect(buildDiagnosticsViewModel(makeSnapshot([
      { status: 'QUANTITY_MISMATCH', issues: [{ code: 'E', message: 'm', severity: 'ERROR' }] },
    ])).hasWarnings).toBe(true)
  })

  it('true when a cash row has WARNING', () => {
    expect(buildDiagnosticsViewModel(makeSnapshot([], [
      { currency: 'USD', portfolioAmount: 1000, ledgerAmount: 900, delta: 100, status: 'MISMATCH',
        issues: [{ code: 'W', message: 'm', severity: 'WARNING' }] },
    ])).hasWarnings).toBe(true)
  })
})

// ─── summary passthrough ──────────────────────────────────────────────────────

describe('buildDiagnosticsViewModel — passthrough', () => {
  it('passes summary by reference', () => {
    const summary = makeSummary({ matchCount: 3 })
    expect(buildDiagnosticsViewModel(makeSnapshot([], [], summary)).summary).toBe(summary)
  })

  it('summary.reconciledAt is the sole source of the run timestamp', () => {
    const ts = '2026-06-15T09:30:00.000Z'
    const snap = makeSnapshot([], [], makeSummary({ reconciledAt: ts }))
    const vm = buildDiagnosticsViewModel(snap)
    // No vm.runAt; timestamp is always via vm.summary!.reconciledAt
    expect(vm.summary?.reconciledAt).toBe(ts)
    expect(Object.prototype.hasOwnProperty.call(vm, 'runAt')).toBe(false)
  })
})

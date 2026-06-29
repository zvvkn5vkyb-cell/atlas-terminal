import type { DiagnosticsViewModel, DiagnosticsOverallStatus } from '@/lib/reconciliation/diagnosticsViewModel'
import { formatDateTime } from '@/lib/format'

function statusLabel(s: DiagnosticsOverallStatus): string {
  switch (s) {
    case 'NOT_RUN': return 'NOT RUN'
    case 'LEDGER_EMPTY': return 'LEDGER EMPTY'
    case 'RECONCILED': return 'RECONCILED'
    case 'MISMATCHES': return 'MISMATCHES'
    case 'REVIEW_REQUIRED': return 'REVIEW REQUIRED'
  }
}

function statusColorClass(s: DiagnosticsOverallStatus): string {
  switch (s) {
    case 'NOT_RUN': return 'text-terminalMuted border-terminalBorder'
    case 'LEDGER_EMPTY': return 'text-terminalMuted border-terminalBorder'
    case 'RECONCILED': return 'text-terminalGreen border-terminalGreen/40'
    case 'MISMATCHES': return 'text-terminalRed border-terminalRed/40'
    case 'REVIEW_REQUIRED': return 'text-terminalAmber border-terminalAmber/40'
  }
}

function CountChip({ label, count, colorClass }: { label: string; count: number; colorClass: string }) {
  if (count === 0) return null
  return (
    <span className={`text-2xs font-mono px-1.5 py-0.5 border ${colorClass}`}>
      {count} {label}
    </span>
  )
}

interface ReconciliationSummaryBarProps {
  vm: DiagnosticsViewModel
}

export function ReconciliationSummaryBar({ vm }: ReconciliationSummaryBarProps) {
  const { overallStatus, summary } = vm
  if (!summary) return null

  // Timestamp is read from summary.reconciledAt — no separate runAt prop or field
  const runTimestamp = summary.reconciledAt

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-terminalBorder">
      <span className={`text-2xs font-mono border px-2 py-0.5 uppercase shrink-0 ${statusColorClass(overallStatus)}`}>
        {statusLabel(overallStatus)}
      </span>

      <span className="text-terminalBorder text-2xs shrink-0">|</span>

      <CountChip label="MATCH" count={summary.matchCount} colorClass="text-terminalGreen border-terminalGreen/30" />
      <CountChip label="QTY MISMATCH" count={summary.quantityMismatchCount} colorClass="text-terminalRed border-terminalRed/30" />
      <CountChip label="CCY MISMATCH" count={summary.currencyMismatchCount} colorClass="text-terminalRed border-terminalRed/30" />
      <CountChip label="ID MISMATCH" count={summary.identityMismatchCount} colorClass="text-terminalAmber border-terminalAmber/30" />
      <CountChip label="ONLY PORT" count={summary.onlyInPortfolioCount} colorClass="text-terminalAmber border-terminalAmber/30" />
      <CountChip label="ONLY LEDGER" count={summary.onlyInLedgerCount} colorClass="text-terminalAmber border-terminalAmber/30" />
      <CountChip label="AMBIGUOUS" count={summary.ambiguousCount} colorClass="text-terminalPurple border-terminalPurple/30" />
      <CountChip label="UNRESOLVED" count={summary.unresolvedCount} colorClass="text-terminalMuted border-terminalBorder" />
      <CountChip label="DUPLICATE" count={summary.duplicateCount} colorClass="text-terminalRed border-terminalRed/30" />

      <span className="text-2xs font-mono text-terminalMuted shrink-0 ml-auto">
        Run at <span className="text-terminalSubtext">{formatDateTime(runTimestamp)}</span>
      </span>
    </div>
  )
}

import type { CashReconciliationRow, CashReconciliationStatus } from '@/types/reconciliation'
import { formatNumber } from '@/lib/format'
import { ReconciliationIssueList } from './ReconciliationIssueList'

function cashStatusBadge(status: CashReconciliationStatus) {
  const colorMap: Record<CashReconciliationStatus, string> = {
    MATCH: 'text-terminalGreen border-terminalGreen/30',
    MISMATCH: 'text-terminalRed border-terminalRed/30',
    ONLY_IN_PORTFOLIO: 'text-terminalAmber border-terminalAmber/30',
    ONLY_IN_LEDGER: 'text-terminalAmber border-terminalAmber/30',
  }
  return (
    <span className={`text-2xs font-mono border px-1 py-0 ${colorMap[status]}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

interface ReconciliationCashTableProps {
  rows: CashReconciliationRow[]
}

export function ReconciliationCashTable({ rows }: ReconciliationCashTableProps) {
  return (
    <div>
      <div className="px-3 py-1 text-2xs font-mono text-terminalMuted uppercase tracking-widest border-b border-terminalBorder/60">
        Cash Balances
      </div>
      <div className="grid grid-cols-[60px_1fr_1fr_80px_1fr] text-2xs font-mono text-terminalMuted uppercase px-3 py-1 border-b border-terminalBorder/60">
        <span>Ccy</span>
        <span className="text-right">Portfolio</span>
        <span className="text-right">Ledger</span>
        <span className="text-right">Delta</span>
        <span className="pl-2">Status / Issues</span>
      </div>
      {rows.map((row) => {
        const deltaAbs = row.delta !== undefined ? Math.abs(row.delta) : 0
        return (
          <div
            key={row.currency}
            className="grid grid-cols-[60px_1fr_1fr_80px_1fr] items-start px-3 py-1 border-b border-terminalBorder/30 last:border-0 hover:bg-terminalElevated"
          >
            <span className="text-2xs font-mono text-terminalAmber">{row.currency}</span>
            <span className="text-2xs font-mono text-terminalSubtext text-right">
              {row.portfolioAmount !== undefined ? formatNumber(row.portfolioAmount, 2) : '—'}
            </span>
            <span className="text-2xs font-mono text-terminalSubtext text-right">
              {row.ledgerAmount !== undefined ? formatNumber(row.ledgerAmount, 2) : '—'}
            </span>
            <span
              className={`text-2xs font-mono text-right ${deltaAbs > 0.01 ? 'text-terminalRed' : 'text-terminalMuted'}`}
            >
              {row.delta !== undefined ? formatNumber(row.delta, 2) : '—'}
            </span>
            <div className="pl-2 flex flex-col gap-0.5">
              {cashStatusBadge(row.status)}
              {row.issues.length > 0 && <ReconciliationIssueList issues={row.issues} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

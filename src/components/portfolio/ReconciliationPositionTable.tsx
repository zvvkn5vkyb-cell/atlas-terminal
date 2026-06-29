import type { PositionReconciliationRow, ReconciliationStatus } from '@/types/reconciliation'
import { formatNumber } from '@/lib/format'
import { ReconciliationIssueList } from './ReconciliationIssueList'

function statusBadge(status: ReconciliationStatus) {
  const colorMap: Record<ReconciliationStatus, string> = {
    MATCH: 'text-terminalGreen border-terminalGreen/30',
    QUANTITY_MISMATCH: 'text-terminalRed border-terminalRed/30',
    CURRENCY_MISMATCH: 'text-terminalRed border-terminalRed/30',
    IDENTITY_MISMATCH: 'text-terminalAmber border-terminalAmber/30',
    ONLY_IN_PORTFOLIO: 'text-terminalAmber border-terminalAmber/30',
    ONLY_IN_LEDGER: 'text-terminalAmber border-terminalAmber/30',
    AMBIGUOUS: 'text-terminalPurple border-terminalPurple/30',
    UNRESOLVED: 'text-terminalMuted border-terminalBorder',
    DUPLICATE: 'text-terminalRed border-terminalRed/30',
    NOT_COMPARABLE: 'text-terminalMuted border-terminalBorder',
  }
  return (
    <span className={`text-2xs font-mono border px-1 py-0 ${colorMap[status]}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

interface ReconciliationPositionTableProps {
  rows: PositionReconciliationRow[]
}

export function ReconciliationPositionTable({ rows }: ReconciliationPositionTableProps) {
  return (
    <div className="border-b border-terminalBorder">
      <div className="grid grid-cols-[1fr_80px_80px_80px_1fr] text-2xs font-mono text-terminalMuted uppercase px-3 py-1 border-b border-terminalBorder/60">
        <span>Symbol / Key</span>
        <span className="text-right">Port Qty</span>
        <span className="text-right">Ledger Qty</span>
        <span className="text-right">Delta</span>
        <span className="pl-2">Status / Issues</span>
      </div>
      {rows.map((row, idx) => {
        const key =
          row.matchKey ??
          row.portfolioPosition?.holdingId ??
          row.ledgerPosition?.positionKey ??
          String(idx)
        const pQty = row.portfolioPosition?.quantity
        const lQty = row.ledgerPosition?.quantity
        const deltaAbs = row.quantityDelta !== undefined ? Math.abs(row.quantityDelta) : 0
        return (
          <div
            key={key}
            className="grid grid-cols-[1fr_80px_80px_80px_1fr] items-start px-3 py-1 border-b border-terminalBorder/30 last:border-0 hover:bg-terminalElevated"
          >
            <span className="text-2xs font-mono text-terminalAmber truncate">{key}</span>
            <span className="text-2xs font-mono text-terminalSubtext text-right">
              {pQty !== undefined ? formatNumber(pQty, 4) : '—'}
            </span>
            <span className="text-2xs font-mono text-terminalSubtext text-right">
              {lQty !== undefined ? formatNumber(lQty, 4) : '—'}
            </span>
            <span
              className={`text-2xs font-mono text-right ${deltaAbs > 0.0001 ? 'text-terminalRed' : 'text-terminalMuted'}`}
            >
              {row.quantityDelta !== undefined ? formatNumber(row.quantityDelta, 4) : '—'}
            </span>
            <div className="pl-2 flex flex-col gap-0.5">
              {statusBadge(row.status)}
              {row.issues.length > 0 && <ReconciliationIssueList issues={row.issues} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

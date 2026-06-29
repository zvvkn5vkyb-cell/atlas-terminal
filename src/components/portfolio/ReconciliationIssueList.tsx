import type { ReconciliationIssue, ReconciliationIssueSeverity } from '@/types/reconciliation'

function severityColorClass(severity: ReconciliationIssueSeverity): string {
  switch (severity) {
    case 'ERROR': return 'text-terminalRed'
    case 'WARNING': return 'text-terminalAmber'
    case 'INFO': return 'text-terminalMuted'
  }
}

interface ReconciliationIssueListProps {
  issues: ReconciliationIssue[]
}

export function ReconciliationIssueList({ issues }: ReconciliationIssueListProps) {
  return (
    <div className="flex flex-col gap-0.5 mt-0.5">
      {issues.map((issue, idx) => (
        <div key={`${issue.code}-${idx}`} className="flex items-start gap-1">
          <span className={`text-2xs font-mono shrink-0 ${severityColorClass(issue.severity)}`}>
            [{issue.severity}]
          </span>
          <span className="text-2xs font-mono text-terminalMuted break-all">{issue.message}</span>
        </div>
      ))}
    </div>
  )
}

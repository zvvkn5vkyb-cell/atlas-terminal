import { useReconciliationDiagnostics } from '@/hooks/useReconciliationDiagnostics'
import { buildDiagnosticsViewModel } from '@/lib/reconciliation/diagnosticsViewModel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { ReconciliationSummaryBar } from './ReconciliationSummaryBar'
import { ReconciliationPositionTable } from './ReconciliationPositionTable'
import { ReconciliationCashTable } from './ReconciliationCashTable'

export function ReconciliationPanel() {
  const { snapshot, isRunning, run } = useReconciliationDiagnostics()
  const vm = buildDiagnosticsViewModel(snapshot)

  const runAction = (
    <button
      onClick={run}
      disabled={isRunning}
      className="text-2xs font-mono text-terminalAmber border border-terminalAmber/40 px-2 py-0.5 hover:bg-terminalAmber/10 disabled:opacity-40 transition-colors"
    >
      {isRunning ? '↻ Running…' : 'Run'}
    </button>
  )

  return (
    <div className="bg-terminalPanel border border-terminalBorder flex flex-col">
      <SectionHeader title="Reconciliation Diagnostics" action={runAction} />

      {vm.overallStatus === 'NOT_RUN' && (
        <div className="px-3 py-4 text-2xs font-mono text-terminalMuted">
          {isRunning
            ? 'Running reconciliation…'
            : 'No reconciliation has been run. Click Run to compare the portfolio against the ledger.'}
        </div>
      )}

      {vm.overallStatus !== 'NOT_RUN' && (
        <div className="flex flex-col">
          <ReconciliationSummaryBar vm={vm} />

          {vm.visiblePositionRows.length > 0 && (
            <ReconciliationPositionTable rows={vm.visiblePositionRows} />
          )}

          {vm.visibleCashRows.length > 0 && (
            <ReconciliationCashTable rows={vm.visibleCashRows} />
          )}

          {vm.visiblePositionRows.length === 0 && vm.visibleCashRows.length === 0 && (
            <div className="px-3 py-3 text-2xs font-mono text-terminalMuted">
              {vm.overallStatus === 'LEDGER_EMPTY'
                ? 'Ledger is empty — add transactions to enable position reconciliation.'
                : 'All positions and cash balances reconciled. No items require review.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

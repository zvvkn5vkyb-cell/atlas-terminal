import { useWorkspaceStore } from '@/store/workspaceStore'
import { useSystemStore } from '@/store/systemStore'
import { useMarketStore } from '@/store/marketStore'
import { getModuleTitle } from '@/lib/routes'
import { formatDateTime } from '@/lib/format'
import { Button } from '@/components/ui/Button'

export function Header() {
  const { activeModule, sidebarCollapsed, toggleSidebar, setCommandPaletteOpen } =
    useWorkspaceStore()
  const { status } = useSystemStore()
  const { dataSource } = useMarketStore()

  // True failure overrides everything; partial coverage is not a failure.
  const isFailure =
    status.providerStatus === 'DOWN' ||
    status.providerStatus === 'DEGRADED'

  const statusLabel = isFailure
    ? `● ${status.providerStatus}`
    : dataSource === 'HYBRID'
      ? '● HYBRID DATA'
      : dataSource === 'LIVE'
        ? '● LIVE'
        : '● MOCK DATA'

  const statusColor = isFailure
    ? 'text-terminalRed'
    : dataSource === 'HYBRID'
      ? 'text-terminalCyan'
      : dataSource === 'LIVE'
        ? 'text-terminalGreen'
        : 'text-terminalAmber'

  return (
    <header className="flex items-center h-8 px-3 border-b border-terminalBorder bg-terminalPanel shrink-0 gap-3">
      <button
        onClick={toggleSidebar}
        title="Toggle sidebar (Alt+S)"
        className="text-terminalMuted hover:text-terminalText font-mono text-xs"
      >
        {sidebarCollapsed ? '›' : '‹'}
      </button>

      <span className="text-xs font-mono text-terminalText tracking-wide">
        {getModuleTitle(activeModule)}
      </span>

      <div className="flex-1" />

      <span className={`text-2xs font-mono ${statusColor}`}>
        {statusLabel}
      </span>

      <span className="text-2xs font-mono text-terminalMuted">
        {formatDateTime(status.dataAsOf)}
      </span>

      <Button
        variant="ghost"
        size="xs"
        onClick={() => setCommandPaletteOpen(true)}
        className="text-2xs"
      >
        Ctrl+K
      </Button>
    </header>
  )
}

import { useWorkspaceStore } from '@/store/workspaceStore'
import { useSystemStore } from '@/store/systemStore'
import { getModuleTitle } from '@/lib/routes'
import { formatDateTime } from '@/lib/format'
import { Button } from '@/components/ui/Button'

export function Header() {
  const { activeModule, sidebarCollapsed, toggleSidebar, setCommandPaletteOpen } =
    useWorkspaceStore()
  const { status } = useSystemStore()

  const statusColor =
    status.providerStatus === 'ALL_UP'
      ? 'text-terminalGreen'
      : status.providerStatus === 'DEGRADED' || status.providerStatus === 'PARTIAL'
        ? 'text-terminalAmber'
        : 'text-terminalRed'

  return (
    <header className="flex items-center h-8 px-3 border-b border-terminalBorder bg-terminalPanel shrink-0 gap-3">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        title="Toggle sidebar (Alt+S)"
        className="text-terminalMuted hover:text-terminalText font-mono text-xs"
      >
        {sidebarCollapsed ? '›' : '‹'}
      </button>

      {/* Module title */}
      <span className="text-xs font-mono text-terminalText tracking-wide">
        {getModuleTitle(activeModule)}
      </span>

      <div className="flex-1" />

      {/* Status */}
      <span className={`text-2xs font-mono ${statusColor}`}>
        {status.providerStatus === 'ALL_UP' ? '● LIVE' : `● ${status.providerStatus}`}
      </span>

      <span className="text-2xs font-mono text-terminalMuted">
        {formatDateTime(status.dataAsOf)}
      </span>

      {/* Command palette trigger */}
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

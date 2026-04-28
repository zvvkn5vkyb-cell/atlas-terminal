import { useWorkspaceStore } from '@/store/workspaceStore'
import { NAV_MODULES } from '@/lib/constants'
import type { ModuleId } from '@/types/system'

const MODULE_ICONS: Record<string, string> = {
  market: 'MKT',
  security: 'SEC',
  portfolio: 'PRT',
  'private-assets': 'PRV',
  macro: 'MCR',
  news: 'NWS',
  screener: 'SCN',
  intelligence: 'INT',
}

export function Sidebar() {
  const { activeModule, sidebarCollapsed, setActiveModule } = useWorkspaceStore()

  return (
    <aside
      className={`flex flex-col h-full bg-terminalSidebar border-r border-terminalBorder transition-all duration-150 ${
        sidebarCollapsed ? 'w-10' : 'w-40'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center border-b border-terminalBorder px-2 py-2 ${sidebarCollapsed ? 'justify-center' : 'gap-2'}`}>
        <span className="text-terminalAmber font-mono font-bold text-xs tracking-widest">
          {sidebarCollapsed ? 'AT' : 'ATLAS'}
        </span>
        {!sidebarCollapsed && (
          <span className="text-terminalMuted font-mono text-2xs tracking-widest">TERMINAL</span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-1 overflow-y-auto">
        {NAV_MODULES.map((module, idx) => {
          const isActive = activeModule === module.id
          return (
            <button
              key={module.id}
              onClick={() => setActiveModule(module.id as ModuleId)}
              title={sidebarCollapsed ? `${module.label} (Alt+${module.altKey})` : undefined}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors border-l-2 ${
                isActive
                  ? 'border-terminalAmber bg-terminalAmber/8 text-terminalAmber'
                  : 'border-transparent text-terminalSubtext hover:text-terminalText hover:bg-terminalElevated/60'
              }`}
            >
              <span className={`font-mono text-2xs w-6 shrink-0 ${isActive ? 'text-terminalAmber' : 'text-terminalMuted'}`}>
                {sidebarCollapsed ? MODULE_ICONS[module.id] : String(idx + 1).padStart(2, '0')}
              </span>
              {!sidebarCollapsed && (
                <span className="font-mono text-xs truncate">{module.label}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Shortcut hint */}
      {!sidebarCollapsed && (
        <div className="border-t border-terminalBorder px-2 py-2">
          <div className="text-2xs text-terminalMuted font-mono">Ctrl+K palette</div>
          <div className="text-2xs text-terminalMuted font-mono">Alt+S sidebar</div>
        </div>
      )}
    </aside>
  )
}

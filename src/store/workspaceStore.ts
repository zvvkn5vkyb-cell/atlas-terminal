import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ModuleId } from '@/types/system'

export const WORKSPACE_STORAGE_KEY = 'atlas-workspace'
export const PORTFOLIO_STORAGE_KEY = 'atlas-portfolio'

interface WorkspaceState {
  activeModule: ModuleId
  sidebarCollapsed: boolean
  commandPaletteOpen: boolean
  activeSymbol: string
  recentSymbols: string[]
  setActiveModule: (module: ModuleId) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  setActiveSymbol: (symbol: string) => void
  navigateToSymbol: (symbol: string) => void
  resetLocalState: () => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeModule: 'portfolio',
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      activeSymbol: 'AAPL',
      recentSymbols: ['AAPL', 'MSFT', 'SPY'],

      setActiveModule: (module) => set({ activeModule: module }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

      setActiveSymbol: (symbol) =>
        set((state) => {
          const sym = symbol.toUpperCase().trim()
          if (!sym) return {}
          const recent = [sym, ...state.recentSymbols.filter(s => s !== sym)].slice(0, 8)
          return { activeSymbol: sym, recentSymbols: recent }
        }),

      navigateToSymbol: (symbol) =>
        set((state) => {
          const sym = symbol.toUpperCase().trim()
          if (!sym) return {}
          const recent = [sym, ...state.recentSymbols.filter(s => s !== sym)].slice(0, 8)
          return { activeSymbol: sym, activeModule: 'security' as ModuleId, recentSymbols: recent }
        }),

      resetLocalState: () => {
        localStorage.removeItem(WORKSPACE_STORAGE_KEY)
        localStorage.removeItem(PORTFOLIO_STORAGE_KEY)
        window.location.reload()
      },
    }),
    {
      name: WORKSPACE_STORAGE_KEY,
      version: 1,
      // Only persist user workflow state — never volatile flags
      partialize: (state) => ({
        activeSymbol: state.activeSymbol,
        recentSymbols: state.recentSymbols,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      migrate: (persisted, _version) => {
        // v1 is the initial persisted version — no migration needed yet.
        // Return safe defaults merged with whatever was stored.
        const p = (persisted ?? {}) as Record<string, unknown>
        return {
          activeSymbol: typeof p.activeSymbol === 'string' ? p.activeSymbol : 'AAPL',
          recentSymbols: Array.isArray(p.recentSymbols) ? (p.recentSymbols as string[]) : ['AAPL', 'MSFT', 'SPY'],
          sidebarCollapsed: typeof p.sidebarCollapsed === 'boolean' ? p.sidebarCollapsed : false,
        }
      },
    }
  )
)

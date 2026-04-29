import { create } from 'zustand'
import type { ModuleId } from '@/types/system'

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
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeModule: 'portfolio',
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  activeSymbol: 'AAPL',
  recentSymbols: ['AAPL', 'MSFT', 'SPY'],

  setActiveModule: (module) => set({ activeModule: module }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  setActiveSymbol: (symbol) => set((state) => {
    const sym = symbol.toUpperCase().trim()
    if (!sym) return {}
    const recent = [sym, ...state.recentSymbols.filter(s => s !== sym)].slice(0, 8)
    return { activeSymbol: sym, recentSymbols: recent }
  }),

  // Convenience: set symbol + switch to Security Detail in one action
  navigateToSymbol: (symbol) => set((state) => {
    const sym = symbol.toUpperCase().trim()
    if (!sym) return {}
    const recent = [sym, ...state.recentSymbols.filter(s => s !== sym)].slice(0, 8)
    return { activeSymbol: sym, activeModule: 'security' as ModuleId, recentSymbols: recent }
  }),
}))

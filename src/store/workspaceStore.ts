import { create } from 'zustand'
import type { ModuleId } from '@/types/system'

interface WorkspaceState {
  activeModule: ModuleId
  sidebarCollapsed: boolean
  commandPaletteOpen: boolean
  activeSymbol: string
  setActiveModule: (module: ModuleId) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  setActiveSymbol: (symbol: string) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeModule: 'portfolio',
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  activeSymbol: 'AAPL',

  setActiveModule: (module) => set({ activeModule: module }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),
}))

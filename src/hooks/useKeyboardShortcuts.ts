import { useEffect } from 'react'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { NAV_MODULES } from '@/lib/constants'
import type { ModuleId } from '@/types/system'

export function useKeyboardShortcuts() {
  const { setActiveModule, setCommandPaletteOpen, toggleSidebar } = useWorkspaceStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey

      if (isCtrlOrCmd && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
        return
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const num = parseInt(e.key)
        if (num >= 1 && num <= 8) {
          e.preventDefault()
          const module = NAV_MODULES.find(m => m.altKey === num)
          if (module) setActiveModule(module.id as ModuleId)
          return
        }
        if (e.key === 's') {
          e.preventDefault()
          toggleSidebar()
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setActiveModule, setCommandPaletteOpen, toggleSidebar])
}

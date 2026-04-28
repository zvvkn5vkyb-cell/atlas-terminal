import { useMemo, useState } from 'react'
import { useWorkspaceStore } from '@/store/workspaceStore'
import type { CommandItem } from '@/types/system'
import type { ModuleId } from '@/types/system'
import { NAV_MODULES, COMMAND_PALETTE_SYMBOLS } from '@/lib/constants'

export function useCommandPalette() {
  const { setCommandPaletteOpen, setActiveModule, setActiveSymbol } = useWorkspaceStore()
  const [query, setQuery] = useState('')

  const commands: CommandItem[] = useMemo(() => {
    const navCommands: CommandItem[] = NAV_MODULES.map(m => ({
      id: `nav-${m.id}`,
      label: m.label,
      category: 'navigation' as const,
      action: () => {
        setActiveModule(m.id as ModuleId)
        setCommandPaletteOpen(false)
      },
      keywords: [m.label.toLowerCase(), m.id],
    }))

    const symbolCommands: CommandItem[] = COMMAND_PALETTE_SYMBOLS.map(sym => ({
      id: `sym-${sym}`,
      label: sym,
      category: 'symbol' as const,
      action: () => {
        setActiveSymbol(sym)
        setActiveModule('security')
        setCommandPaletteOpen(false)
      },
      keywords: [sym.toLowerCase()],
    }))

    const actionCommands: CommandItem[] = [
      {
        id: 'action-portfolio',
        label: 'Open Portfolio',
        category: 'action',
        action: () => { setActiveModule('portfolio'); setCommandPaletteOpen(false) },
      },
      {
        id: 'action-news',
        label: 'Open News',
        category: 'action',
        action: () => { setActiveModule('news'); setCommandPaletteOpen(false) },
      },
      {
        id: 'action-macro',
        label: 'Open Macro',
        category: 'action',
        action: () => { setActiveModule('macro'); setCommandPaletteOpen(false) },
      },
    ]

    return [...navCommands, ...symbolCommands, ...actionCommands]
  }, [setActiveModule, setCommandPaletteOpen, setActiveSymbol])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands.slice(0, 10)
    const q = query.toLowerCase()
    return commands.filter(
      c =>
        c.label.toLowerCase().includes(q) ||
        c.keywords?.some(k => k.includes(q))
    ).slice(0, 10)
  }, [commands, query])

  return { query, setQuery, filtered }
}

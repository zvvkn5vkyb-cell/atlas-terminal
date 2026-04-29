import { useMemo, useState } from 'react'
import { useWorkspaceStore } from '@/store/workspaceStore'
import type { CommandItem } from '@/types/system'
import type { ModuleId } from '@/types/system'
import { NAV_MODULES } from '@/lib/constants'

// Matches valid ticker patterns: 1-12 chars, letters + digits + dot
const TICKER_RE = /^[A-Za-z][A-Za-z0-9.]{0,11}$/

export function useCommandPalette() {
  const { setCommandPaletteOpen, setActiveModule, navigateToSymbol, recentSymbols } =
    useWorkspaceStore()
  const [query, setQuery] = useState('')

  const allCommands: CommandItem[] = useMemo(() => {
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

    const actionCommands: CommandItem[] = [
      {
        id: 'action-portfolio',
        label: 'Open Portfolio',
        category: 'action',
        action: () => { setActiveModule('portfolio'); setCommandPaletteOpen(false) },
        keywords: ['portfolio', 'prt'],
      },
      {
        id: 'action-news',
        label: 'Open News',
        category: 'action',
        action: () => { setActiveModule('news'); setCommandPaletteOpen(false) },
        keywords: ['news', 'feed'],
      },
      {
        id: 'action-macro',
        label: 'Open Macro',
        category: 'action',
        action: () => { setActiveModule('macro'); setCommandPaletteOpen(false) },
        keywords: ['macro', 'economy'],
      },
    ]

    return [...navCommands, ...actionCommands]
  }, [setActiveModule, setCommandPaletteOpen])

  const filtered = useMemo(() => {
    const trimmed = query.trim()

    // Empty query — show recent symbols first, then nav
    if (!trimmed) {
      const recentCommands: CommandItem[] = recentSymbols.map(sym => ({
        id: `recent-${sym}`,
        label: sym,
        category: 'symbol' as const,
        action: () => {
          navigateToSymbol(sym)
          setCommandPaletteOpen(false)
        },
        keywords: [sym.toLowerCase()],
      }))
      return [...recentCommands, ...allCommands].slice(0, 12)
    }

    const q = trimmed.toLowerCase()
    const results: CommandItem[] = allCommands.filter(
      c =>
        c.label.toLowerCase().includes(q) ||
        c.keywords?.some(k => k.includes(q))
    )

    // If the query looks like a ticker, prepend a direct "View SYMBOL" action
    if (TICKER_RE.test(trimmed)) {
      const sym = trimmed.toUpperCase()
      const viewCmd: CommandItem = {
        id: `sym-view-${sym}`,
        label: `View ${sym}`,
        category: 'symbol' as const,
        action: () => {
          navigateToSymbol(sym)
          setCommandPaletteOpen(false)
        },
        keywords: [sym.toLowerCase()],
      }
      return [viewCmd, ...results].slice(0, 10)
    }

    return results.slice(0, 10)
  }, [query, allCommands, recentSymbols, navigateToSymbol, setCommandPaletteOpen])

  return { query, setQuery, filtered }
}

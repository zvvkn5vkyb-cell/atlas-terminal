import { useMemo, useState } from 'react'
import { useWorkspaceStore } from '@/store/workspaceStore'
import type { CommandItem } from '@/types/system'
import type { ModuleId } from '@/types/system'
import { NAV_MODULES } from '@/lib/constants'
import { resolveSymbolForNavigation } from '@/lib/symbolNavigation'

// Matches valid ticker patterns: 1-12 chars, letters + digits + dot
const TICKER_RE = /^[A-Za-z][A-Za-z0-9.]{0,11}$/

export function useCommandPalette() {
  const { setCommandPaletteOpen, setActiveModule, navigateToSymbol, recentSymbols, resetLocalState } =
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

    const systemCommands: CommandItem[] = [
      {
        id: 'action-reset-state',
        label: 'Reset Local State',
        category: 'action',
        action: () => {
          setCommandPaletteOpen(false)
          // Small delay so the palette closes before reload
          setTimeout(() => resetLocalState(), 80)
        },
        keywords: ['reset', 'clear', 'local', 'state', 'storage', 'localStorage'],
      },
    ]

    return [...navCommands, ...actionCommands, ...systemCommands]
  }, [setActiveModule, setCommandPaletteOpen, resetLocalState])

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

    // If the query looks like a ticker, resolve it before creating the action.
    // AMBIGUOUS symbols (e.g. bare "RY") expand into one item per candidate so
    // the user explicitly picks a listing rather than silently landing on one.
    if (TICKER_RE.test(trimmed)) {
      const sym = trimmed.toUpperCase()
      const navResult = resolveSymbolForNavigation(sym)

      if (navResult.action === 'choose') {
        const candidateItems: CommandItem[] = navResult.candidates.map(c => ({
          id: `sym-ambiguous-${c.securityId}`,
          label: `View ${c.symbol}  ·  ${c.exchange}  ${c.currency}`,
          category: 'symbol' as const,
          action: () => {
            navigateToSymbol(c.symbol)
            setCommandPaletteOpen(false)
          },
          keywords: [c.symbol.toLowerCase(), sym.toLowerCase()],
        }))
        return [...candidateItems, ...results].slice(0, 10)
      }

      // RESOLVED (canonical symbol) or UNKNOWN (pass-through to provider)
      const viewCmd: CommandItem = {
        id: `sym-view-${sym}`,
        label: `View ${navResult.symbol}`,
        category: 'symbol' as const,
        action: () => {
          navigateToSymbol(navResult.symbol)
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

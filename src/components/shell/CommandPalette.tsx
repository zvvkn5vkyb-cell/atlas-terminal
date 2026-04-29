import { useEffect, useRef, useState } from 'react'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useCommandPalette } from '@/hooks/useCommandPalette'

const CATEGORY_LABELS: Record<string, string> = {
  symbol: 'SYMBOL',
  navigation: 'NAV',
  action: 'ACTION',
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useWorkspaceStore()
  const { query, setQuery, filtered } = useCommandPalette()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)

  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setSelectedIdx(0)
    }
  }, [commandPaletteOpen, setQuery])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIdx(0)
  }, [filtered])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!commandPaletteOpen) return
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx(i => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selectedIdx]) filtered[selectedIdx].action()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, setCommandPaletteOpen, filtered, selectedIdx])

  if (!commandPaletteOpen) return null

  const hasQuery = query.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-28 bg-black/60"
      onClick={(e) => e.target === e.currentTarget && setCommandPaletteOpen(false)}
    >
      <div className="w-full max-w-lg bg-terminalPanel border border-terminalStrongBorder shadow-2xl">
        {/* Input */}
        <div className="flex items-center border-b border-terminalBorder px-3 py-2 gap-2">
          <span className="text-terminalAmber font-mono text-xs">›</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a symbol (AAPL, RY.TO) or search modules…"
            className="flex-1 bg-transparent text-sm font-mono text-terminalText placeholder-terminalMuted outline-none"
          />
          <span className="text-2xs font-mono text-terminalMuted">ESC close · ↑↓ · ↵ select</span>
        </div>

        {/* Section hint when no query */}
        {!hasQuery && (
          <div className="px-3 py-1 border-b border-terminalBorder/40 text-2xs font-mono text-terminalMuted uppercase tracking-wider">
            Recent symbols
          </div>
        )}

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-terminalMuted text-xs font-mono">
              No results
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIdx
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left border-b border-terminalBorder/30 last:border-0 transition-colors ${
                    isSelected
                      ? 'bg-terminalAmber/10 text-terminalAmber'
                      : 'hover:bg-terminalAmber/8 text-terminalText'
                  }`}
                >
                  <span className="text-2xs font-mono text-terminalMuted w-5 text-right shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className={`text-xs font-mono flex-1 ${isSelected ? 'text-terminalAmber' : ''}`}>
                    {item.label}
                  </span>
                  <span className="text-2xs font-mono text-terminalMuted uppercase">
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </span>
                </button>
              )
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-terminalBorder/40 px-3 py-1 text-2xs font-mono text-terminalMuted">
          Type any ticker symbol and press Enter to open Security Detail
        </div>
      </div>
    </div>
  )
}

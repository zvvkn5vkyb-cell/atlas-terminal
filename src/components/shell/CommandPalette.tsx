import { useEffect, useRef } from 'react'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useCommandPalette } from '@/hooks/useCommandPalette'

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useWorkspaceStore()
  const { query, setQuery, filtered } = useCommandPalette()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
    }
  }, [commandPaletteOpen, setQuery])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCommandPaletteOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setCommandPaletteOpen])

  if (!commandPaletteOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/60"
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
            placeholder="Search modules, symbols, actions..."
            className="flex-1 bg-transparent text-sm font-mono text-terminalText placeholder-terminalMuted outline-none"
          />
          <span className="text-2xs font-mono text-terminalMuted">ESC to close</span>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-terminalMuted text-xs font-mono">
              No results
            </div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                onClick={item.action}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-terminalAmber/8 border-b border-terminalBorder/30 last:border-0 group"
              >
                <span className="text-2xs font-mono text-terminalMuted w-5 text-right shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="text-xs font-mono text-terminalText group-hover:text-terminalAmber">
                  {item.label}
                </span>
                <span className="text-2xs font-mono text-terminalMuted ml-auto uppercase">
                  {item.category}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

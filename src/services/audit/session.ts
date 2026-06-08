let _sessionId: string | null = null

export function createSessionId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof (crypto as { randomUUID?: unknown }).randomUUID === 'function'
  ) {
    return (crypto as { randomUUID: () => string }).randomUUID()
  }
  // Non-crypto fallback for environments that lack crypto.randomUUID.
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return `${ts}-${rand}`
}

// Returns the same session ID for the lifetime of the current page load.
// Module-level memory is the source of truth so Node tests work without DOM.
export function getSessionId(): string {
  if (_sessionId === null) {
    _sessionId = createSessionId()
  }
  return _sessionId
}

// Resets the singleton. Exported for test use only (underscore prefix signals this).
export function _resetSessionId(): void {
  _sessionId = null
}

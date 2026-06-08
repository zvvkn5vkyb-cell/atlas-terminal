import type { AuditLogEnvelope } from '@/types/audit'
import { AUDIT_SCHEMA_VERSION } from './constants'

export interface AuditStorage {
  read(): string | null
  write(value: string): boolean  // returns false on failure, never throws
  remove(): void
}

// ─── Backends ─────────────────────────────────────────────────────────────────

function probeLocalStorage(): boolean {
  try {
    const key = '__atlas_audit_probe__'
    localStorage.setItem(key, '1')
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function createLocalStorageBackend(key: string): AuditStorage {
  const available =
    typeof window !== 'undefined' &&
    typeof localStorage !== 'undefined' &&
    probeLocalStorage()

  return {
    read(): string | null {
      if (!available) return null
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    write(value: string): boolean {
      if (!available) return false
      try {
        localStorage.setItem(key, value)
        return true
      } catch {
        return false
      }
    },
    remove(): void {
      if (!available) return
      try {
        localStorage.removeItem(key)
      } catch {
        // ignore — removal failure is non-fatal
      }
    },
  }
}

export function createMemoryBackend(): AuditStorage {
  let stored: string | null = null
  return {
    read(): string | null { return stored },
    write(value: string): boolean { stored = value; return true },
    remove(): void { stored = null },
  }
}

// Always returns null/false — used in tests to simulate quota/unavailability.
export function createFailingBackend(): AuditStorage {
  return {
    read(): string | null { return null },
    write(_value: string): boolean { return false },
    remove(): void {},
  }
}

// ─── Envelope read/write ──────────────────────────────────────────────────────

const EMPTY_ENVELOPE: AuditLogEnvelope = {
  schemaVersion: AUDIT_SCHEMA_VERSION,
  entries: [],
}

function emptyEnvelope(): AuditLogEnvelope {
  return { schemaVersion: AUDIT_SCHEMA_VERSION, entries: [] }
}

export function readEnvelope(storage: AuditStorage): AuditLogEnvelope {
  const raw = storage.read()
  if (raw === null) return emptyEnvelope()

  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as Record<string, unknown>).entries)
    ) {
      storage.remove()
      return emptyEnvelope()
    }
    const envelope = parsed as AuditLogEnvelope
    return {
      schemaVersion:
        typeof envelope.schemaVersion === 'number'
          ? envelope.schemaVersion
          : AUDIT_SCHEMA_VERSION,
      entries: envelope.entries,
    }
  } catch {
    storage.remove()
    return emptyEnvelope()
  }
}

export function writeEnvelope(
  storage: AuditStorage,
  envelope: AuditLogEnvelope,
): boolean {
  try {
    return storage.write(JSON.stringify(envelope))
  } catch {
    return false
  }
}

// Satisfy TypeScript: EMPTY_ENVELOPE is referenced to keep the export visible
// in declarations even though emptyEnvelope() is used at runtime.
void EMPTY_ENVELOPE

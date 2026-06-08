export const AUDIT_STORAGE_KEY = 'atlas-audit-log'

// Ring-buffer cap for the localStorage backend. Justified reduction from the
// 10,000-entry default: localStorage (~5 MB) is shared with atlas-portfolio and
// atlas-workspace. At ~300–500 B/entry, 10,000 entries ≈ 3–5 MB and could
// alone exhaust the budget. 2,000 ≈ 0.6–1 MB leaves headroom. This is a
// local-only default — if storage moves to IndexedDB or a backend, raise it.
export const AUDIT_MAX_ENTRIES = 2000

export const AUDIT_SCHEMA_VERSION = 1

export const AUDIT_DEFAULT_USER_ID = 'local'

// Keys whose values are redacted from before/after/metadata payloads before
// writing. Case-sensitive exact match only; nested objects are walked.
export const AUDIT_REDACTED_KEYS: ReadonlySet<string> = new Set([
  'apiKey',
  'api_key',
  'token',
  'accessToken',
  'access_token',
  'password',
  'secret',
  'secretKey',
  'secret_key',
  'authorization',
  'Authorization',
])

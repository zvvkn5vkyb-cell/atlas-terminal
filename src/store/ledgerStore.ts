import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LedgerTransaction, LedgerState, LedgerMutationResult } from '@/types/ledger'
import type { AuditSource } from '@/types/audit'
import { deriveLedgerState } from '@/services/ledger/deriveLedgerState'
import {
  EMPTY_LEDGER_STATE,
  AUDIT_ACTION_TRANSACTION_CLEAR,
} from '@/services/ledger/constants'
import {
  buildTransactionAuditParams,
  AUDIT_ACTION_TRANSACTION_CREATE,
  AUDIT_ACTION_TRANSACTION_UPDATE,
  AUDIT_ACTION_TRANSACTION_DELETE,
} from '@/services/ledger/ledgerAudit'
import { recordAudit } from '@/services/audit/auditLog'
import {
  generateTransactionId,
  applyAddTransaction,
  applyUpdateTransaction,
  applyDeleteTransaction,
  applyClearTransactions,
} from './ledgerActions'

// ─── Dormant ledger store (Phase 1-2) ──────────────────────────────────────────
//
// Starts empty and stays empty until a future migration/seed phase. No
// reconciliation with portfolioStore. Recompute of `ledgerState` happens after
// every successful mutation and on rehydration — never on read.

export const LEDGER_STORAGE_KEY = 'atlas-ledger'

// transactionId is optional on input; generated via generateTransactionId() if absent.
export type NewLedgerTransaction = Omit<LedgerTransaction, 'transactionId'> & {
  transactionId?: string
}

interface LedgerStoreState {
  transactions: LedgerTransaction[]
  lastMutationAt: string | null
  ledgerState: LedgerState
  lastMutationResult: LedgerMutationResult | null

  addTransaction: (input: NewLedgerTransaction) => LedgerMutationResult
  updateTransaction: (transactionId: string, updates: Partial<LedgerTransaction>) => LedgerMutationResult
  deleteTransaction: (transactionId: string) => LedgerMutationResult
  clearTransactions: (source?: AuditSource) => LedgerMutationResult
  getTransactions: () => LedgerTransaction[]
  getLedgerState: () => LedgerState
}

// Audit persistence must never block a ledger mutation.
function recordAuditSafe(...args: Parameters<typeof recordAudit>): void {
  try {
    recordAudit(...args)
  } catch {
    // ignored — audit failure is non-blocking
  }
}

export const useLedgerStore = create<LedgerStoreState>()(
  persist(
    (set, get) => ({
      transactions: [],
      lastMutationAt: null,
      ledgerState: EMPTY_LEDGER_STATE,
      lastMutationResult: null,

      addTransaction: (input) => {
        const transactionId = input.transactionId ?? generateTransactionId()
        const txn: LedgerTransaction = { ...input, transactionId }
        const outcome = applyAddTransaction(get().transactions, txn)

        if (outcome.result.success && outcome.added) {
          set({
            transactions: outcome.transactions,
            ledgerState: deriveLedgerState(outcome.transactions),
            lastMutationAt: new Date().toISOString(),
            lastMutationResult: outcome.result,
          })
          recordAuditSafe(buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_CREATE, outcome.added))
        } else {
          set({ lastMutationResult: outcome.result })
        }

        return outcome.result
      },

      updateTransaction: (transactionId, updates) => {
        const outcome = applyUpdateTransaction(get().transactions, transactionId, updates)

        if (outcome.result.success && outcome.after && outcome.before) {
          set({
            transactions: outcome.transactions,
            ledgerState: deriveLedgerState(outcome.transactions),
            lastMutationAt: new Date().toISOString(),
            lastMutationResult: outcome.result,
          })
          recordAuditSafe(
            buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_UPDATE, outcome.after, outcome.before),
          )
        } else {
          set({ lastMutationResult: outcome.result })
        }

        return outcome.result
      },

      deleteTransaction: (transactionId) => {
        const outcome = applyDeleteTransaction(get().transactions, transactionId)

        if (outcome.result.success && outcome.before) {
          set({
            transactions: outcome.transactions,
            ledgerState: deriveLedgerState(outcome.transactions),
            lastMutationAt: new Date().toISOString(),
            lastMutationResult: outcome.result,
          })
          recordAuditSafe(buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_DELETE, outcome.before))
        } else {
          set({ lastMutationResult: outcome.result })
        }

        return outcome.result
      },

      clearTransactions: (source = 'UI') => {
        const outcome = applyClearTransactions(get().transactions)

        // Already empty — no-op: no state write, no audit entry.
        if (outcome.clearedCount === 0) {
          return outcome.result
        }

        set({
          transactions: outcome.transactions,
          ledgerState: EMPTY_LEDGER_STATE,
          lastMutationAt: new Date().toISOString(),
          lastMutationResult: outcome.result,
        })

        recordAuditSafe({
          category: 'TRANSACTION',
          action: AUDIT_ACTION_TRANSACTION_CLEAR,
          entityType: 'TRANSACTION',
          source,
          severity: 'INFO',
          reason: 'Transaction ledger cleared',
          metadata: { clearedCount: outcome.clearedCount },
        })

        return outcome.result
      },

      getTransactions: () => get().transactions,
      getLedgerState: () => get().ledgerState,
    }),
    {
      name: LEDGER_STORAGE_KEY,
      version: 1,
      // Persist only the transaction log and mutation timestamp. Derived
      // ledgerState and lastMutationResult are recomputed, never persisted.
      partialize: (state) => ({
        transactions: state.transactions,
        lastMutationAt: state.lastMutationAt,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        try {
          state.ledgerState = deriveLedgerState(state.transactions)
        } catch {
          // Corrupt persisted transactions — recover to an empty ledger.
          state.transactions = []
          state.lastMutationAt = null
          state.ledgerState = EMPTY_LEDGER_STATE
        }
      },
      migrate: (persisted, _version) => {
        const p = (persisted ?? {}) as Record<string, unknown>
        return {
          transactions: Array.isArray(p.transactions) ? (p.transactions as LedgerTransaction[]) : [],
          lastMutationAt: typeof p.lastMutationAt === 'string' ? p.lastMutationAt : null,
        }
      },
    },
  ),
)

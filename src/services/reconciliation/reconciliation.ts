// Read-Only Ledger-to-Portfolio Reconciliation (Phase 1-3).
//
// Pure, deterministic, read-only. No Zustand, no stores, no audit, no
// localStorage, no new Date(), no Math.random(), no market-data provider,
// no canadianSymbol.ts import. Symbol normalization is trim + uppercase only;
// all canonical resolution is delegated to the security master.

import type { Holding, CashPosition } from '@/types/portfolio'
import type { DerivedPosition, CashBalance } from '@/types/ledger'
import type {
  ReconciliationTolerance,
  ReconciliationStatus,
  ReconciliationIssue,
  NormalizedPortfolioPosition,
  NormalizedLedgerPosition,
  PositionReconciliationRow,
  CashReconciliationRow,
  CashReconciliationStatus,
  ReconciliationSummary,
  ReconciliationResult,
  ReconciliationInput,
} from '@/types/reconciliation'
import { DEFAULT_RECONCILIATION_TOLERANCE } from '@/types/reconciliation'
import {
  resolveSecurity,
  getSecurityById,
  getSecurityByExactSymbol,
} from '@/services/security/securityMaster'

// ─── Symbol normalization ─────────────────────────────────────────────────────
// Conservative: trim + uppercase only. No provider-specific suffix folding.
// Canadian resolution (RY.TO → CA:RY.TO) and alias resolution (FB → US:META)
// are handled entirely by resolveSecurity / getSecurityById / getSecurityByExactSymbol.

function normSym(raw: string | undefined): string {
  if (!raw) return ''
  return raw.trim().toUpperCase()
}

// ─── Status ordering (lower index = earlier in sorted output) ─────────────────

const STATUS_ORDER: Record<ReconciliationStatus, number> = {
  MATCH: 0,
  QUANTITY_MISMATCH: 1,
  CURRENCY_MISMATCH: 2,
  IDENTITY_MISMATCH: 3,
  ONLY_IN_PORTFOLIO: 4,
  ONLY_IN_LEDGER: 5,
  AMBIGUOUS: 6,
  UNRESOLVED: 7,
  DUPLICATE: 8,
  NOT_COMPARABLE: 9,
}

// ─── normalizePortfolioHolding ────────────────────────────────────────────────

export function normalizePortfolioHolding(holding: Holding): NormalizedPortfolioPosition {
  const symbol = normSym(holding.symbol)
  const resolution = symbol ? resolveSecurity(holding.symbol.trim()) : null

  if (resolution?.status === 'RESOLVED') {
    const s = resolution.security
    return {
      holdingId: holding.id,
      symbol,
      securityId: s.securityId,
      currency: holding.currency,
      quantity: holding.shares,
      averageCost: holding.costBasis,
      totalCost: holding.costBasis * holding.shares,
      resolutionStatus: 'RESOLVED',
    }
  }

  if (resolution?.status === 'AMBIGUOUS') {
    return {
      holdingId: holding.id,
      symbol,
      currency: holding.currency,
      quantity: holding.shares,
      averageCost: holding.costBasis,
      totalCost: holding.costBasis * holding.shares,
      resolutionStatus: 'AMBIGUOUS',
      resolutionCandidates: resolution.candidates.map(c => ({
        securityId: c.securityId,
        symbol: c.symbol,
        name: c.name,
      })),
    }
  }

  return {
    holdingId: holding.id,
    symbol,
    currency: holding.currency,
    quantity: holding.shares,
    averageCost: holding.costBasis,
    totalCost: holding.costBasis * holding.shares,
    resolutionStatus: 'UNKNOWN',
  }
}

// ─── normalizeLedgerPosition ──────────────────────────────────────────────────
// DerivedPosition.securityId is a position KEY that may be a canonical securityId
// like 'US:AAPL' or a raw symbol fallback like 'AAPL'. Never assume it is canonical.

export function normalizeLedgerPosition(position: DerivedPosition): NormalizedLedgerPosition {
  const positionKey = normSym(position.securityId)
  const sym = normSym(position.symbol)

  // Step 1: try canonical id lookup
  const byId = positionKey ? getSecurityById(positionKey) : undefined
  if (byId) {
    return {
      positionKey,
      resolvedSecurityId: byId.securityId,
      symbol: sym || undefined,
      currency: position.currency,
      quantity: position.quantity,
      averageCost: position.averageCost,
      totalCost: position.totalCost,
      isCanonical: true,
    }
  }

  // Step 2: positionKey is a raw symbol — try exact symbol lookup
  const bySymbol = positionKey ? getSecurityByExactSymbol(positionKey) : undefined
  return {
    positionKey,
    resolvedSecurityId: bySymbol?.securityId,
    symbol: sym || undefined,
    currency: position.currency,
    quantity: position.quantity,
    averageCost: position.averageCost,
    totalCost: position.totalCost,
    isCanonical: false,
  }
}

// ─── matchSecurityIdentity ────────────────────────────────────────────────────
// Collect ALL candidates at the strongest applicable tier before choosing.
// Never select candidates[0] when multiple exist at a tier.
//
// Match tiers (in precedence order):
//   PRIMARY  — canonical securityId on both sides, same id
//   FALLBACK — symbol text match; issue code assigned by caller based on portfolio.resolutionStatus
//
// Between PRIMARY and FALLBACK, we detect IDENTITY_CONFLICT (both sides have canonical
// ids but they differ) and return kind: 'IDENTITY_CONFLICT'.

type MatchKind = 'MATCH' | 'IDENTITY_CONFLICT' | 'MULTIPLE_CONFLICTS' | 'NONE'
type MatchTier = 'PRIMARY' | 'FALLBACK'

interface MatchOutcome {
  kind: MatchKind
  match?: NormalizedLedgerPosition
  matchKey?: string
  matchTier?: MatchTier
  conflicting?: NormalizedLedgerPosition         // single conflict → IDENTITY_CONFLICT
  multipleConflicts?: NormalizedLedgerPosition[] // sorted; multiple conflicts → MULTIPLE_CONFLICTS
}

export function matchSecurityIdentity(
  portfolio: NormalizedPortfolioPosition,
  ledgerPositions: NormalizedLedgerPosition[],
): MatchOutcome {
  const pSecId = portfolio.securityId
  const pSym = portfolio.symbol

  // ── PRIMARY: canonical securityId match ──────────────────────────────────
  if (pSecId) {
    const primaryCandidates = ledgerPositions.filter(
      l => l.resolvedSecurityId !== undefined && l.resolvedSecurityId === pSecId,
    )
    if (primaryCandidates.length === 1) {
      return { kind: 'MATCH', match: primaryCandidates[0], matchKey: pSecId, matchTier: 'PRIMARY' }
    }
    if (primaryCandidates.length > 1) {
      // Multiple primary candidates — ledger-side duplicates; caller handles
      return { kind: 'NONE' }
    }

    // No primary match — check for canonical identity conflict before fallback.
    // Conflict: both sides have a resolved canonical securityId, they differ, and symbols match.
    if (pSym) {
      const conflictCandidates = ledgerPositions.filter(l => {
        if (!l.resolvedSecurityId) return false               // ledger has no canonical id → no conflict
        if (l.resolvedSecurityId === pSecId) return false     // same id → already handled as primary
        const ledgerSym = normSym(l.symbol ?? l.positionKey)
        return ledgerSym === pSym
      })
      if (conflictCandidates.length === 1) {
        return { kind: 'IDENTITY_CONFLICT', conflicting: conflictCandidates[0], matchKey: pSym }
      }
      if (conflictCandidates.length > 1) {
        // Multiple candidates at this tier — must not select one.
        // Return all sorted for deterministic consumption by the caller.
        const sorted = [...conflictCandidates].sort((a, b) =>
          (a.resolvedSecurityId!).localeCompare(b.resolvedSecurityId!),
        )
        return { kind: 'MULTIPLE_CONFLICTS', multipleConflicts: sorted, matchKey: pSym }
      }
    }
  }

  // ── FALLBACK: symbol text match ───────────────────────────────────────────
  // For RESOLVED portfolio: only match ledger positions with NO resolvedSecurityId.
  //   (positions with resolvedSecurityId were already handled by PRIMARY or IDENTITY_CONFLICT)
  // For UNKNOWN portfolio: match any ledger position by symbol (canonical or not),
  //   since there is no portfolio canonical id to conflict with.
  if (pSym) {
    const fallbackCandidates = ledgerPositions.filter(l => {
      if (portfolio.resolutionStatus === 'RESOLVED' && l.resolvedSecurityId !== undefined) {
        return false  // canonical ledger positions already handled above for RESOLVED portfolios
      }
      const ledgerSym = normSym(l.symbol ?? l.positionKey)
      return ledgerSym === pSym
    })
    if (fallbackCandidates.length === 1) {
      return { kind: 'MATCH', match: fallbackCandidates[0], matchKey: pSym, matchTier: 'FALLBACK' }
    }
    // Multiple fallback candidates — cannot determine which one; caller gets NONE
  }

  return { kind: 'NONE' }
}

// ─── classifyReconciliationStatus ────────────────────────────────────────────

export function classifyReconciliationStatus(
  portfolio: NormalizedPortfolioPosition | undefined,
  ledger: NormalizedLedgerPosition | undefined,
  tolerance: ReconciliationTolerance,
): {
  status: ReconciliationStatus
  issues: ReconciliationIssue[]
  quantityDelta?: number
  costBasisDelta?: number
  currencyMismatch?: { portfolioCurrency: string; ledgerCurrency: string }
} {
  if (!portfolio && !ledger) {
    return { status: 'NOT_COMPARABLE', issues: [] }
  }
  if (!portfolio) {
    return { status: 'ONLY_IN_LEDGER', issues: [] }
  }
  if (!ledger) {
    return { status: 'ONLY_IN_PORTFOLIO', issues: [] }
  }

  const issues: ReconciliationIssue[] = []

  // NOT_COMPARABLE: zero or negative portfolio shares
  if (portfolio.quantity <= 0) {
    issues.push({
      code: 'ZERO_OR_NEGATIVE_PORTFOLIO_QUANTITY',
      message: `Portfolio holding ${portfolio.holdingId} has non-positive shares (${portfolio.quantity})`,
      severity: 'WARNING',
    })
    return { status: 'NOT_COMPARABLE', issues }
  }

  // NOT_COMPARABLE: flat ledger position (quantity 0 with nonzero cost)
  if (ledger.quantity === 0 && ledger.totalCost !== 0) {
    issues.push({
      code: 'FLAT_LEDGER_POSITION',
      message: `Ledger position ${ledger.positionKey} has quantity 0 with nonzero cost`,
      severity: 'INFO',
    })
    return { status: 'NOT_COMPARABLE', issues }
  }

  // NOT_COMPARABLE: ledger quantity is 0 (and cost is 0 — fully sold with realizedPnL only)
  if (ledger.quantity === 0) {
    issues.push({
      code: 'ZERO_LEDGER_QUANTITY',
      message: `Ledger position ${ledger.positionKey} has quantity 0`,
      severity: 'INFO',
    })
    return { status: 'NOT_COMPARABLE', issues }
  }

  // Cost basis delta — informational only; never changes status
  const costBasisDelta = portfolio.totalCost - ledger.totalCost
  if (Math.abs(costBasisDelta) > 0.005) {
    issues.push({
      code: 'COST_BASIS_DELTA',
      message: `Cost basis delta ${costBasisDelta.toFixed(4)} (portfolio ${portfolio.totalCost.toFixed(4)}, ledger ${ledger.totalCost.toFixed(4)})`,
      severity: 'INFO',
    })
  }

  // Currency: exact string compare, evaluated before quantity
  if (portfolio.currency !== ledger.currency) {
    return {
      status: 'CURRENCY_MISMATCH',
      issues,
      currencyMismatch: { portfolioCurrency: portfolio.currency, ledgerCurrency: ledger.currency },
    }
  }

  // Quantity tolerance
  const delta = portfolio.quantity - ledger.quantity
  const threshold = Math.max(
    tolerance.quantityAbsolute,
    portfolio.quantity * tolerance.quantityRelative,
  )

  if (Math.abs(delta) <= threshold) {
    return { status: 'MATCH', issues, quantityDelta: delta, costBasisDelta }
  }

  return { status: 'QUANTITY_MISMATCH', issues, quantityDelta: delta, costBasisDelta }
}

// ─── reconcileCashBalances ────────────────────────────────────────────────────

export function reconcileCashBalances(
  portfolioCash: CashPosition[],
  ledgerCash: CashBalance[],
  tolerance: ReconciliationTolerance,
): CashReconciliationRow[] {
  const portfolioMap = new Map<string, number>()
  const ledgerMap = new Map<string, number>()

  for (const p of portfolioCash) {
    const key = normSym(p.currency)
    portfolioMap.set(key, (portfolioMap.get(key) ?? 0) + p.amount)
  }
  for (const l of ledgerCash) {
    const key = normSym(l.currency)
    ledgerMap.set(key, (ledgerMap.get(key) ?? 0) + l.amount)
  }

  // Sort currencies for deterministic output
  const currencies = [...new Set([...portfolioMap.keys(), ...ledgerMap.keys()])].sort()
  const rows: CashReconciliationRow[] = []

  for (const currency of currencies) {
    const pAmt = portfolioMap.get(currency)
    const lAmt = ledgerMap.get(currency)

    if (pAmt !== undefined && lAmt !== undefined) {
      const delta = pAmt - lAmt
      const threshold = Math.max(
        tolerance.cashAbsolute,
        Math.abs(pAmt) * tolerance.cashRelative,
      )
      const status: CashReconciliationStatus = Math.abs(delta) <= threshold ? 'MATCH' : 'MISMATCH'
      rows.push({ currency, portfolioAmount: pAmt, ledgerAmount: lAmt, delta, status, issues: [] })
    } else if (pAmt !== undefined) {
      rows.push({ currency, portfolioAmount: pAmt, status: 'ONLY_IN_PORTFOLIO', issues: [] })
    } else {
      rows.push({ currency, ledgerAmount: lAmt, status: 'ONLY_IN_LEDGER', issues: [] })
    }
  }

  return rows
}

// ─── summarizeReconciliation ──────────────────────────────────────────────────

export function summarizeReconciliation(
  positions: PositionReconciliationRow[],
  cash: CashReconciliationRow[] | undefined,
  reconciledAt: string,
): ReconciliationSummary {
  let matchCount = 0
  let quantityMismatchCount = 0
  let currencyMismatchCount = 0
  let identityMismatchCount = 0
  let onlyInPortfolioCount = 0
  let onlyInLedgerCount = 0
  let ambiguousCount = 0
  let unresolvedCount = 0
  let duplicateCount = 0
  let notComparableCount = 0
  let comparablePositionCount = 0
  let hasWarningOrError = false

  for (const row of positions) {
    switch (row.status) {
      case 'MATCH':             matchCount++;             comparablePositionCount++; break
      case 'QUANTITY_MISMATCH': quantityMismatchCount++;  comparablePositionCount++; break
      case 'CURRENCY_MISMATCH': currencyMismatchCount++;  comparablePositionCount++; break
      case 'IDENTITY_MISMATCH': identityMismatchCount++;  break
      case 'ONLY_IN_PORTFOLIO': onlyInPortfolioCount++;   break
      case 'ONLY_IN_LEDGER':    onlyInLedgerCount++;      break
      case 'AMBIGUOUS':         ambiguousCount++;          break
      case 'UNRESOLVED':        unresolvedCount++;         break
      case 'DUPLICATE':         duplicateCount++;          break
      case 'NOT_COMPARABLE':    notComparableCount++;      break
    }
    for (const issue of row.issues) {
      if (issue.severity === 'WARNING' || issue.severity === 'ERROR') {
        hasWarningOrError = true
      }
    }
  }

  let isCashCompared = false
  let cashAllMatch = true
  let hasCashBothSides = false

  if (cash) {
    for (const row of cash) {
      if (row.portfolioAmount !== undefined && row.ledgerAmount !== undefined) {
        hasCashBothSides = true
        isCashCompared = true
        if (row.status !== 'MATCH') cashAllMatch = false
      }
      for (const issue of row.issues) {
        if (issue.severity === 'WARNING' || issue.severity === 'ERROR') {
          hasWarningOrError = true
        }
      }
    }
  }

  const hasComparableData = comparablePositionCount > 0 || hasCashBothSides
  const allPositionsMatch = positions.every(r => r.status === 'MATCH')
  const isFullyReconciled =
    allPositionsMatch &&
    (!isCashCompared || cashAllMatch) &&
    !hasWarningOrError

  return {
    totalPortfolioPositions: positions.filter(r => r.portfolioPosition !== undefined).length,
    totalLedgerPositions: positions.filter(r => r.ledgerPosition !== undefined).length,
    comparablePositionCount,
    hasComparableData,
    matchCount,
    quantityMismatchCount,
    currencyMismatchCount,
    identityMismatchCount,
    onlyInPortfolioCount,
    onlyInLedgerCount,
    ambiguousCount,
    unresolvedCount,
    duplicateCount,
    notComparableCount,
    isFullyReconciled,
    isCashCompared,
    reconciledAt,
  }
}

// ─── reconcilePositions ───────────────────────────────────────────────────────

export function reconcilePositions(input: ReconciliationInput): ReconciliationResult {
  const tolerance = { ...DEFAULT_RECONCILIATION_TOLERANCE, ...input.tolerance }
  const { reconciledAt } = input

  // ── 1. Normalize ─────────────────────────────────────────────────────────
  const normPortfolio = input.portfolioHoldings.map(normalizePortfolioHolding)
  const normLedger = input.ledgerPositions.map(normalizeLedgerPosition)

  // ── 2. Duplicate detection — portfolio side ───────────────────────────────
  // Key: canonical securityId (RESOLVED) or normalized symbol (UNKNOWN).
  // AMBIGUOUS positions are excluded from deduplication (each is independently AMBIGUOUS).
  const portfolioDupMap = new Map<string, NormalizedPortfolioPosition[]>()
  for (const p of normPortfolio) {
    if (p.resolutionStatus === 'AMBIGUOUS') continue
    const key = p.securityId ?? p.symbol
    if (!key) continue
    const bucket = portfolioDupMap.get(key)
    if (bucket) bucket.push(p)
    else portfolioDupMap.set(key, [p])
  }
  const portfolioDupSet = new Set<string>()
  for (const bucket of portfolioDupMap.values()) {
    if (bucket.length >= 2) {
      for (const p of bucket) portfolioDupSet.add(p.holdingId)
    }
  }

  // ── 3. Duplicate detection — ledger side ──────────────────────────────────
  // Key hierarchy (first available): resolvedSecurityId → normalized symbol → normalized positionKey
  const ledgerDupMap = new Map<string, NormalizedLedgerPosition[]>()
  for (const l of normLedger) {
    const key = l.resolvedSecurityId ?? l.symbol ?? l.positionKey
    if (!key) continue
    const bucket = ledgerDupMap.get(key)
    if (bucket) bucket.push(l)
    else ledgerDupMap.set(key, [l])
  }
  const ledgerDupSet = new Set<string>()
  for (const bucket of ledgerDupMap.values()) {
    if (bucket.length >= 2) {
      for (const l of bucket) ledgerDupSet.add(l.positionKey)
    }
  }

  // ── 4. Build matching pools (non-duplicate) ───────────────────────────────
  // Use positionKey as the map key; it is unique per NormalizedLedgerPosition
  // unless two positions share the same positionKey (caught by ledgerDupSet above).
  const unconsumedLedger = new Map<string, NormalizedLedgerPosition>()
  for (const l of normLedger) {
    if (!ledgerDupSet.has(l.positionKey)) {
      unconsumedLedger.set(l.positionKey, l)
    }
  }

  const rows: PositionReconciliationRow[] = []

  // ── 5. DUPLICATE rows — portfolio side ───────────────────────────────────
  // Sort for deterministic output before emitting
  const portfolioDups = normPortfolio
    .filter(p => portfolioDupSet.has(p.holdingId))
    .sort((a, b) => (a.securityId ?? a.symbol).localeCompare(b.securityId ?? b.symbol) || a.holdingId.localeCompare(b.holdingId))
  for (const p of portfolioDups) {
    rows.push({
      status: 'DUPLICATE',
      matchKey: p.securityId ?? p.symbol,
      portfolioPosition: p,
      issues: [{
        code: 'DUPLICATE_PORTFOLIO_IDENTITY',
        message: `Duplicate portfolio identity: ${p.securityId ?? p.symbol}`,
        severity: 'WARNING',
      }],
    })
  }

  // ── 6. DUPLICATE rows — ledger side ──────────────────────────────────────
  const ledgerDups = normLedger
    .filter(l => ledgerDupSet.has(l.positionKey))
    .sort((a, b) =>
      (a.resolvedSecurityId ?? a.symbol ?? a.positionKey).localeCompare(
        b.resolvedSecurityId ?? b.symbol ?? b.positionKey,
      ) || a.positionKey.localeCompare(b.positionKey),
    )
  for (const l of ledgerDups) {
    rows.push({
      status: 'DUPLICATE',
      matchKey: l.resolvedSecurityId ?? l.symbol ?? l.positionKey,
      ledgerPosition: l,
      issues: [{
        code: 'DUPLICATE_LEDGER_IDENTITY',
        message: `Duplicate ledger identity: ${l.resolvedSecurityId ?? l.symbol ?? l.positionKey}`,
        severity: 'WARNING',
      }],
    })
  }

  // ── 7. Match non-duplicate portfolio positions ────────────────────────────
  // Sort by identity key for deterministic processing order (order-independent output)
  const matchablePortfolio = normPortfolio
    .filter(p => !portfolioDupSet.has(p.holdingId))
    .sort((a, b) => (a.securityId ?? a.symbol).localeCompare(b.securityId ?? b.symbol) || a.holdingId.localeCompare(b.holdingId))

  for (const p of matchablePortfolio) {
    // AMBIGUOUS — emit immediately without attempting a match
    if (p.resolutionStatus === 'AMBIGUOUS') {
      rows.push({
        status: 'AMBIGUOUS',
        matchKey: p.symbol,
        portfolioPosition: p,
        issues: [{
          code: 'AMBIGUOUS_PORTFOLIO_SYMBOL',
          message: `Portfolio symbol '${p.symbol}' resolves to multiple securities`,
          severity: 'WARNING',
        }],
      })
      continue
    }

    const available = [...unconsumedLedger.values()]
    const outcome = matchSecurityIdentity(p, available)

    if (outcome.kind === 'IDENTITY_CONFLICT') {
      // Exactly one conflict candidate — consume both records into one IDENTITY_MISMATCH row
      const conflicting = outcome.conflicting!
      unconsumedLedger.delete(conflicting.positionKey)
      rows.push({
        status: 'IDENTITY_MISMATCH',
        matchKey: outcome.matchKey,
        portfolioPosition: p,
        ledgerPosition: conflicting,
        issues: [{
          code: 'CANONICAL_IDENTITY_CONFLICT',
          message: `Portfolio securityId '${p.securityId}' conflicts with ledger '${conflicting.resolvedSecurityId}' on symbol '${outcome.matchKey}'`,
          severity: 'WARNING',
        }],
      })
      continue
    }

    if (outcome.kind === 'MULTIPLE_CONFLICTS') {
      // Multiple canonical ledger positions conflict on the same symbol — cannot select one.
      // Consume all affected records; emit AMBIGUOUS for portfolio + DUPLICATE for each ledger.
      const conflicts = outcome.multipleConflicts!  // pre-sorted by resolvedSecurityId
      for (const c of conflicts) {
        unconsumedLedger.delete(c.positionKey)
      }
      rows.push({
        status: 'AMBIGUOUS',
        matchKey: outcome.matchKey,
        portfolioPosition: p,
        issues: [{
          code: 'MULTIPLE_CANONICAL_CONFLICTS',
          message: `Portfolio symbol '${outcome.matchKey}' matches ${conflicts.length} ledger positions with different canonical identities`,
          severity: 'WARNING',
        }],
      })
      for (const c of conflicts) {
        rows.push({
          status: 'DUPLICATE',
          matchKey: outcome.matchKey,
          ledgerPosition: c,
          issues: [{
            code: 'MULTIPLE_CANONICAL_CONFLICTS',
            message: `Ledger position '${c.resolvedSecurityId}' is one of ${conflicts.length} positions conflicting on symbol '${outcome.matchKey}'`,
            severity: 'WARNING',
          }],
        })
      }
      continue
    }

    if (outcome.kind === 'MATCH' && outcome.match) {
      const ledger = outcome.match
      unconsumedLedger.delete(ledger.positionKey)

      const fallbackIssues: ReconciliationIssue[] = []

      if (outcome.matchTier === 'FALLBACK') {
        if (p.resolutionStatus === 'UNKNOWN') {
          // UNKNOWN portfolio matched only through raw symbol text → WARNING
          fallbackIssues.push({
            code: 'UNVERIFIED_RAW_SYMBOL_MATCH',
            message: `UNKNOWN portfolio symbol '${p.symbol}' matched to ledger only through raw symbol text`,
            severity: 'WARNING',
          })
        } else {
          // RESOLVED portfolio matched to ledger position with no canonical id → INFO
          fallbackIssues.push({
            code: 'NONCANONICAL_LEDGER_SYMBOL_MATCH',
            message: `RESOLVED portfolio '${p.securityId}' matched to noncanonical ledger position by symbol '${outcome.matchKey}'`,
            severity: 'INFO',
          })
        }
      }

      const classification = classifyReconciliationStatus(p, ledger, tolerance)

      rows.push({
        status: classification.status,
        matchKey: outcome.matchKey,
        portfolioPosition: p,
        ledgerPosition: ledger,
        quantityDelta: classification.quantityDelta,
        costBasisDelta: classification.costBasisDelta,
        currencyMismatch: classification.currencyMismatch,
        issues: [...fallbackIssues, ...classification.issues],
      })
      continue
    }

    // NONE — no match
    if (p.resolutionStatus === 'RESOLVED') {
      rows.push({
        status: 'ONLY_IN_PORTFOLIO',
        matchKey: p.securityId ?? p.symbol,
        portfolioPosition: p,
        issues: [],
      })
    } else {
      // UNKNOWN with no symbol match → UNRESOLVED
      rows.push({
        status: 'UNRESOLVED',
        matchKey: p.symbol,
        portfolioPosition: p,
        issues: [{
          code: 'UNRESOLVED_PORTFOLIO_SYMBOL',
          message: `Portfolio symbol '${p.symbol}' is unknown to the security master and has no raw-symbol ledger match`,
          severity: 'WARNING',
        }],
      })
    }
  }

  // ── 8. Remaining unconsumed ledger positions → ONLY_IN_LEDGER ─────────────
  const remainingLedger = [...unconsumedLedger.values()].sort((a, b) =>
    (a.resolvedSecurityId ?? a.symbol ?? a.positionKey).localeCompare(
      b.resolvedSecurityId ?? b.symbol ?? b.positionKey,
    ),
  )
  for (const l of remainingLedger) {
    rows.push({
      status: 'ONLY_IN_LEDGER',
      matchKey: l.resolvedSecurityId ?? l.symbol ?? l.positionKey,
      ledgerPosition: l,
      issues: [],
    })
  }

  // ── 9. Deterministic sort ─────────────────────────────────────────────────
  rows.sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (statusDiff !== 0) return statusDiff
    const aKey = a.matchKey ?? ''
    const bKey = b.matchKey ?? ''
    const keyDiff = aKey.localeCompare(bKey)
    if (keyDiff !== 0) return keyDiff
    // Stable tie-break: holdingId then positionKey
    const aId = a.portfolioPosition?.holdingId ?? a.ledgerPosition?.positionKey ?? ''
    const bId = b.portfolioPosition?.holdingId ?? b.ledgerPosition?.positionKey ?? ''
    return aId.localeCompare(bId)
  })

  // ── 10. Cash (optional) ───────────────────────────────────────────────────
  let cash: CashReconciliationRow[] | undefined
  if (input.portfolioCash !== undefined && input.ledgerCash !== undefined) {
    cash = reconcileCashBalances(input.portfolioCash, input.ledgerCash, tolerance)
  }

  const summary = summarizeReconciliation(rows, cash, reconciledAt)

  return { positions: rows, cash, summary }
}

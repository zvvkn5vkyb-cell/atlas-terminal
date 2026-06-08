// ─── Average Cost Basis (ACB) primitives ─────────────────────────────────────
// Pure functions over an explicit ACBState record. No side effects.
// FIFO is typed in ledger.ts but deferred — these functions cover AVERAGE only.

export interface ACBState {
  quantity: number
  totalCost: number
  averageCost: number   // = totalCost / quantity when quantity > 0, else 0
}

export const ZERO_ACB: ACBState = { quantity: 0, totalCost: 0, averageCost: 0 }

function averageCostOf(totalCost: number, quantity: number): number {
  return quantity > 0 ? totalCost / quantity : 0
}

// ─── BUY ─────────────────────────────────────────────────────────────────────
// Increases quantity and totalCost. averageCost is recomputed.
// fees are added to totalCost (they raise the cost basis).

export function applyBuy(state: ACBState, quantity: number, price: number, fees = 0): ACBState {
  const addedCost = quantity * price + fees
  const newQty = state.quantity + quantity
  const newTotal = state.totalCost + addedCost
  return { quantity: newQty, totalCost: newTotal, averageCost: averageCostOf(newTotal, newQty) }
}

// ─── SELL ─────────────────────────────────────────────────────────────────────
// Calculates realized gain/loss using average cost.
// If quantitySold > held, clamps to held and sets wasOversell = true.
// Proceeds = quantity × price − fees − tax.
// costRemoved = averageCost × quantitySold.

export interface SellResult {
  newState: ACBState
  proceeds: number
  costRemoved: number
  gain: number
  actualQuantitySold: number   // <= requested quantity (clamped on oversell)
  wasOversell: boolean
}

export function applySell(
  state: ACBState,
  requestedQuantity: number,
  price: number,
  fees = 0,
  tax = 0,
): SellResult {
  const wasOversell = requestedQuantity > state.quantity
  const actualQuantitySold = wasOversell ? state.quantity : requestedQuantity

  const proceeds = actualQuantitySold * price - fees - tax
  const costRemoved = state.averageCost * actualQuantitySold
  const gain = proceeds - costRemoved

  const newQty = state.quantity - actualQuantitySold
  const newTotal = Math.max(0, state.totalCost - costRemoved)

  return {
    newState: { quantity: newQty, totalCost: newTotal, averageCost: averageCostOf(newTotal, newQty) },
    proceeds,
    costRemoved,
    gain,
    actualQuantitySold,
    wasOversell,
  }
}

// ─── SPLIT ────────────────────────────────────────────────────────────────────
// Adjusts quantity and averageCost; totalCost is preserved.
// e.g. 2:1 split: quantity doubles, averageCost halves, totalCost unchanged.

export function applySplit(state: ACBState, numerator: number, denominator: number): ACBState {
  const factor = numerator / denominator
  const newQty = state.quantity * factor
  const newTotal = state.totalCost                           // totalCost unchanged
  return { quantity: newQty, totalCost: newTotal, averageCost: averageCostOf(newTotal, newQty) }
}

// ─── RETURN OF CAPITAL ────────────────────────────────────────────────────────
// Reduces totalCost by `amount`.
// If amount > totalCost, the excess becomes a realized capital gain and
// totalCost floors at zero (ACB cannot go negative).

export interface ROCResult {
  newState: ACBState
  excessGain: number   // > 0 only when amount > totalCost; realized immediately
}

export function applyReturnOfCapital(state: ACBState, amount: number): ROCResult {
  const excess = Math.max(0, amount - state.totalCost)
  const newTotal = Math.max(0, state.totalCost - amount)
  return {
    newState: { quantity: state.quantity, totalCost: newTotal, averageCost: averageCostOf(newTotal, state.quantity) },
    excessGain: excess,
  }
}

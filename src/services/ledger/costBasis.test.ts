import { describe, it, expect } from 'vitest'
import {
  ZERO_ACB,
  applyBuy,
  applySell,
  applySplit,
  applyReturnOfCapital,
  type ACBState,
} from './costBasis'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeState(quantity: number, totalCost: number): ACBState {
  return { quantity, totalCost, averageCost: quantity > 0 ? totalCost / quantity : 0 }
}

// ─── ZERO_ACB ─────────────────────────────────────────────────────────────────

describe('ZERO_ACB', () => {
  it('has quantity 0, totalCost 0, averageCost 0', () => {
    expect(ZERO_ACB).toEqual({ quantity: 0, totalCost: 0, averageCost: 0 })
  })
})

// ─── applyBuy ─────────────────────────────────────────────────────────────────

describe('applyBuy', () => {
  it('sets quantity and totalCost from zero', () => {
    const s = applyBuy(ZERO_ACB, 100, 10)
    expect(s.quantity).toBe(100)
    expect(s.totalCost).toBe(1000)
    expect(s.averageCost).toBe(10)
  })

  it('accumulates cost on second buy at different price', () => {
    const s1 = applyBuy(ZERO_ACB, 100, 10)    // 100 @ 10 = 1000
    const s2 = applyBuy(s1, 100, 20)            // 100 @ 20 = 2000
    expect(s2.quantity).toBe(200)
    expect(s2.totalCost).toBe(3000)
    expect(s2.averageCost).toBe(15)
  })

  it('adds fees to totalCost (raises basis)', () => {
    const s = applyBuy(ZERO_ACB, 100, 10, 50)
    expect(s.totalCost).toBe(1050)
    expect(s.averageCost).toBe(10.5)
  })

  it('zero fees does not affect totalCost', () => {
    expect(applyBuy(ZERO_ACB, 100, 10, 0).totalCost).toBe(1000)
  })

  it('does not mutate the input state', () => {
    const original = { ...ZERO_ACB }
    applyBuy(ZERO_ACB, 100, 10)
    expect(ZERO_ACB).toEqual(original)
  })
})

// ─── applySell ────────────────────────────────────────────────────────────────

describe('applySell — partial sell', () => {
  it('reduces quantity and totalCost proportionally', () => {
    const s = makeState(100, 1000)   // avg 10
    const r = applySell(s, 40, 15)
    expect(r.newState.quantity).toBe(60)
    expect(r.newState.totalCost).toBeCloseTo(600)
    expect(r.newState.averageCost).toBeCloseTo(10)
  })

  it('calculates proceeds = quantity × price − fees − tax', () => {
    const s = makeState(100, 1000)
    const r = applySell(s, 50, 12, 10, 5)
    expect(r.proceeds).toBe(50 * 12 - 10 - 5)   // 585
  })

  it('calculates costRemoved = averageCost × quantitySold', () => {
    const s = makeState(100, 1000)   // avg 10
    const r = applySell(s, 40, 15)
    expect(r.costRemoved).toBeCloseTo(400)
  })

  it('calculates realized gain correctly', () => {
    const s = makeState(100, 1000)   // avg 10
    const r = applySell(s, 40, 15)
    // proceeds = 40×15 = 600, costRemoved = 400, gain = 200
    expect(r.gain).toBeCloseTo(200)
  })

  it('calculates realized loss correctly', () => {
    const s = makeState(100, 2000)   // avg 20
    const r = applySell(s, 50, 15)
    // proceeds = 750, costRemoved = 1000, gain = -250
    expect(r.gain).toBeCloseTo(-250)
  })

  it('wasOversell is false for exact quantity', () => {
    const s = makeState(100, 1000)
    const r = applySell(s, 100, 10)
    expect(r.wasOversell).toBe(false)
    expect(r.actualQuantitySold).toBe(100)
    expect(r.newState.quantity).toBe(0)
  })

  it('does not mutate the input state', () => {
    const s = makeState(100, 1000)
    const original = { ...s }
    applySell(s, 50, 15)
    expect(s).toEqual(original)
  })
})

describe('applySell — full sell (flat position)', () => {
  it('results in quantity 0 and totalCost 0', () => {
    const s = makeState(100, 1000)
    const r = applySell(s, 100, 12)
    expect(r.newState.quantity).toBe(0)
    expect(r.newState.totalCost).toBe(0)
    expect(r.newState.averageCost).toBe(0)
  })
})

describe('applySell — oversell', () => {
  it('clamps quantity to held and sets wasOversell', () => {
    const s = makeState(50, 500)   // holds 50
    const r = applySell(s, 100, 10)
    expect(r.wasOversell).toBe(true)
    expect(r.actualQuantitySold).toBe(50)
    expect(r.newState.quantity).toBe(0)
  })

  it('calculates proceeds using clamped quantity', () => {
    const s = makeState(50, 500)
    const r = applySell(s, 100, 12)
    expect(r.proceeds).toBe(50 * 12)  // only 50 sold
  })

  it('oversell on empty position clamps to 0', () => {
    const r = applySell(ZERO_ACB, 10, 15)
    expect(r.wasOversell).toBe(true)
    expect(r.actualQuantitySold).toBe(0)
    expect(r.proceeds).toBe(0)
  })
})

// ─── applySplit ───────────────────────────────────────────────────────────────

describe('applySplit', () => {
  it('2:1 split doubles quantity and halves averageCost', () => {
    const s = makeState(100, 1000)   // avg 10
    const r = applySplit(s, 2, 1)
    expect(r.quantity).toBe(200)
    expect(r.averageCost).toBeCloseTo(5)
    expect(r.totalCost).toBe(1000)   // totalCost preserved
  })

  it('3:2 split adjusts quantity by factor 1.5', () => {
    const s = makeState(100, 1500)   // avg 15
    const r = applySplit(s, 3, 2)
    expect(r.quantity).toBe(150)
    expect(r.averageCost).toBeCloseTo(10)
    expect(r.totalCost).toBe(1500)
  })

  it('1:2 reverse split halves quantity and doubles averageCost', () => {
    const s = makeState(200, 2000)   // avg 10
    const r = applySplit(s, 1, 2)
    expect(r.quantity).toBe(100)
    expect(r.averageCost).toBeCloseTo(20)
    expect(r.totalCost).toBe(2000)
  })

  it('preserves totalCost regardless of ratio', () => {
    const s = makeState(300, 9000)
    const r = applySplit(s, 5, 3)
    expect(r.totalCost).toBe(9000)
  })

  it('does not mutate the input state', () => {
    const s = makeState(100, 1000)
    const original = { ...s }
    applySplit(s, 2, 1)
    expect(s).toEqual(original)
  })
})

// ─── applyReturnOfCapital ─────────────────────────────────────────────────────

describe('applyReturnOfCapital', () => {
  it('reduces totalCost and recomputes averageCost (below basis)', () => {
    const s = makeState(100, 1000)   // avg 10
    const r = applyReturnOfCapital(s, 300)
    expect(r.newState.totalCost).toBe(700)
    expect(r.newState.averageCost).toBeCloseTo(7)
    expect(r.excessGain).toBe(0)
  })

  it('ROC equal to totalCost floors to zero with no excess', () => {
    const s = makeState(100, 1000)
    const r = applyReturnOfCapital(s, 1000)
    expect(r.newState.totalCost).toBe(0)
    expect(r.excessGain).toBe(0)
  })

  it('ROC above basis: excess becomes realized gain, totalCost floors at 0', () => {
    const s = makeState(100, 500)
    const r = applyReturnOfCapital(s, 800)
    expect(r.newState.totalCost).toBe(0)
    expect(r.excessGain).toBeCloseTo(300)
  })

  it('quantity is unchanged', () => {
    const s = makeState(100, 1000)
    const r = applyReturnOfCapital(s, 400)
    expect(r.newState.quantity).toBe(100)
  })

  it('does not mutate the input state', () => {
    const s = makeState(100, 1000)
    const original = { ...s }
    applyReturnOfCapital(s, 300)
    expect(s).toEqual(original)
  })
})

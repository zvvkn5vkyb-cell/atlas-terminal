import { describe, it, expect } from 'vitest'
import { resolveSymbolForNavigation } from './symbolNavigation'

describe('resolveSymbolForNavigation', () => {
  it('returns navigate for an unambiguous U.S. symbol', () => {
    const result = resolveSymbolForNavigation('AAPL')
    expect(result.action).toBe('navigate')
    if (result.action === 'navigate') expect(result.symbol).toBe('AAPL')
  })

  it('returns navigate for a fully-qualified Canadian symbol', () => {
    const result = resolveSymbolForNavigation('RY.TO')
    expect(result.action).toBe('navigate')
    if (result.action === 'navigate') expect(result.symbol).toBe('RY.TO')
  })

  it('returns choose for ambiguous bare "RY" with both listings as candidates', () => {
    const result = resolveSymbolForNavigation('RY')
    expect(result.action).toBe('choose')
    if (result.action === 'choose') {
      const symbols = result.candidates.map(c => c.symbol)
      expect(symbols).toContain('RY')
      expect(symbols).toContain('RY.TO')
      expect(result.candidates.length).toBe(2)
    }
  })

  it('returns choose for ambiguous bare "TD"', () => {
    expect(resolveSymbolForNavigation('TD').action).toBe('choose')
  })

  it('does NOT navigate silently to US:RY when input is bare "RY"', () => {
    const result = resolveSymbolForNavigation('RY')
    expect(result.action).not.toBe('navigate')
  })

  it('returns navigate for an unknown symbol without throwing', () => {
    const result = resolveSymbolForNavigation('ZZZZ')
    expect(result.action).toBe('navigate')
    if (result.action === 'navigate') expect(result.symbol).toBe('ZZZZ')
  })

  it('normalizes case and whitespace for known symbols', () => {
    const result = resolveSymbolForNavigation('  aapl  ')
    expect(result.action).toBe('navigate')
    if (result.action === 'navigate') expect(result.symbol).toBe('AAPL')
  })

  it('normalizes Canadian suffix variants', () => {
    const result = resolveSymbolForNavigation('ry.tsx')
    expect(result.action).toBe('navigate')
    if (result.action === 'navigate') expect(result.symbol).toBe('RY.TO')
  })

  it('does not throw on empty or whitespace-only input', () => {
    expect(() => resolveSymbolForNavigation('')).not.toThrow()
    expect(() => resolveSymbolForNavigation('   ')).not.toThrow()
    const result = resolveSymbolForNavigation('')
    expect(result.action).toBe('navigate')
  })
})

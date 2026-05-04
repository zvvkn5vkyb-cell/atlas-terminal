import { describe, it, expect } from 'vitest'
import {
  isCanadianSymbol,
  parseCanadianSymbol,
  toTwelveDataSymbol,
  toTwelveDataExchange,
  fromTwelveDataSymbol,
} from './canadianSymbol'

// ─── isCanadianSymbol ─────────────────────────────────────────────────────────

describe('isCanadianSymbol', () => {
  it('returns true for .TO suffix', () => {
    expect(isCanadianSymbol('RY.TO')).toBe(true)
    expect(isCanadianSymbol('TD.TO')).toBe(true)
    expect(isCanadianSymbol('ENB.TO')).toBe(true)
  })

  it('returns true for .TSX suffix', () => {
    expect(isCanadianSymbol('SU.TSX')).toBe(true)
  })

  it('returns true for .V suffix', () => {
    expect(isCanadianSymbol('ABC.V')).toBe(true)
  })

  it('returns true for lowercase input', () => {
    expect(isCanadianSymbol('ry.to')).toBe(true)
    expect(isCanadianSymbol('su.tsx')).toBe(true)
    expect(isCanadianSymbol('abc.v')).toBe(true)
  })

  it('returns false for U.S. symbols with no suffix', () => {
    expect(isCanadianSymbol('AAPL')).toBe(false)
    expect(isCanadianSymbol('MSFT')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isCanadianSymbol('')).toBe(false)
  })

  it('returns false for malformed symbols', () => {
    expect(isCanadianSymbol('.TO')).toBe(false)        // no ticker
    expect(isCanadianSymbol('RY.')).toBe(false)         // no suffix
    expect(isCanadianSymbol('RY.XX')).toBe(false)       // unrecognised suffix
    expect(isCanadianSymbol('RY.TO.TO')).toBe(false)    // double suffix
    expect(isCanadianSymbol('TOOLONGNAME.TO')).toBe(false) // ticker > 8 chars
  })
})

// ─── parseCanadianSymbol ──────────────────────────────────────────────────────

describe('parseCanadianSymbol — .TO suffix', () => {
  it('parses RY.TO → ticker RY, exchange TSX', () => {
    expect(parseCanadianSymbol('RY.TO')).toEqual({ ticker: 'RY', exchange: 'TSX' })
  })

  it('parses TD.TO → ticker TD, exchange TSX', () => {
    expect(parseCanadianSymbol('TD.TO')).toEqual({ ticker: 'TD', exchange: 'TSX' })
  })

  it('parses ENB.TO → ticker ENB, exchange TSX', () => {
    expect(parseCanadianSymbol('ENB.TO')).toEqual({ ticker: 'ENB', exchange: 'TSX' })
  })
})

describe('parseCanadianSymbol — .TSX suffix', () => {
  it('parses SU.TSX → ticker SU, exchange TSX', () => {
    expect(parseCanadianSymbol('SU.TSX')).toEqual({ ticker: 'SU', exchange: 'TSX' })
  })
})

describe('parseCanadianSymbol — .V suffix', () => {
  it('parses ABC.V → ticker ABC, exchange TSXV', () => {
    expect(parseCanadianSymbol('ABC.V')).toEqual({ ticker: 'ABC', exchange: 'TSXV' })
  })
})

describe('parseCanadianSymbol — lowercase normalisation', () => {
  it('normalises ry.to to uppercase ticker', () => {
    expect(parseCanadianSymbol('ry.to')).toEqual({ ticker: 'RY', exchange: 'TSX' })
  })

  it('normalises su.tsx', () => {
    expect(parseCanadianSymbol('su.tsx')).toEqual({ ticker: 'SU', exchange: 'TSX' })
  })

  it('normalises abc.v', () => {
    expect(parseCanadianSymbol('abc.v')).toEqual({ ticker: 'ABC', exchange: 'TSXV' })
  })
})

describe('parseCanadianSymbol — rejection', () => {
  it('returns null for AAPL', () => {
    expect(parseCanadianSymbol('AAPL')).toBeNull()
  })

  it('returns null for MSFT', () => {
    expect(parseCanadianSymbol('MSFT')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseCanadianSymbol('')).toBeNull()
  })

  it('returns null for bare dot suffix', () => {
    expect(parseCanadianSymbol('.TO')).toBeNull()
  })

  it('returns null for unrecognised suffix', () => {
    expect(parseCanadianSymbol('RY.XX')).toBeNull()
  })

  it('returns null for double suffix', () => {
    expect(parseCanadianSymbol('RY.TO.TO')).toBeNull()
  })

  it('returns null for ticker longer than 8 characters', () => {
    expect(parseCanadianSymbol('TOOLONGNAME.TO')).toBeNull()
  })
})

// ─── toTwelveDataSymbol ───────────────────────────────────────────────────────

describe('toTwelveDataSymbol', () => {
  it('extracts ticker for .TO symbol', () => {
    expect(toTwelveDataSymbol('RY.TO')).toBe('RY')
  })

  it('extracts ticker for .TSX symbol', () => {
    expect(toTwelveDataSymbol('SU.TSX')).toBe('SU')
  })

  it('extracts ticker for .V symbol', () => {
    expect(toTwelveDataSymbol('ABC.V')).toBe('ABC')
  })

  it('returns null for U.S. symbol', () => {
    expect(toTwelveDataSymbol('AAPL')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(toTwelveDataSymbol('')).toBeNull()
  })
})

// ─── toTwelveDataExchange ─────────────────────────────────────────────────────

describe('toTwelveDataExchange', () => {
  it('returns TSX for .TO symbol', () => {
    expect(toTwelveDataExchange('RY.TO')).toBe('TSX')
  })

  it('returns TSX for .TSX symbol', () => {
    expect(toTwelveDataExchange('SU.TSX')).toBe('TSX')
  })

  it('returns TSXV for .V symbol', () => {
    expect(toTwelveDataExchange('ABC.V')).toBe('TSXV')
  })

  it('returns null for U.S. symbol', () => {
    expect(toTwelveDataExchange('MSFT')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(toTwelveDataExchange('')).toBeNull()
  })
})

// ─── fromTwelveDataSymbol ─────────────────────────────────────────────────────

describe('fromTwelveDataSymbol', () => {
  it('reconstructs TSX symbol as .TO canonical form', () => {
    expect(fromTwelveDataSymbol('RY', 'TSX')).toBe('RY.TO')
    expect(fromTwelveDataSymbol('TD', 'TSX')).toBe('TD.TO')
    expect(fromTwelveDataSymbol('SU', 'TSX')).toBe('SU.TO')
  })

  it('reconstructs TSXV symbol as .V canonical form', () => {
    expect(fromTwelveDataSymbol('ABC', 'TSXV')).toBe('ABC.V')
  })

  it('normalises lowercase ticker input', () => {
    expect(fromTwelveDataSymbol('ry', 'TSX')).toBe('RY.TO')
  })

  it('returns null for unknown exchange', () => {
    expect(fromTwelveDataSymbol('AAPL', 'NASDAQ')).toBeNull()
    expect(fromTwelveDataSymbol('RY', 'NYSE')).toBeNull()
  })

  it('returns null for empty ticker', () => {
    expect(fromTwelveDataSymbol('', 'TSX')).toBeNull()
  })

  it('returns null for ticker longer than 8 characters', () => {
    expect(fromTwelveDataSymbol('TOOLONGNAME', 'TSX')).toBeNull()
  })
})

// ─── Round-trip ───────────────────────────────────────────────────────────────

describe('round-trip translation', () => {
  it('RY.TO round-trips through Twelve Data and back', () => {
    const ticker = toTwelveDataSymbol('RY.TO')!
    const exchange = toTwelveDataExchange('RY.TO')!
    expect(fromTwelveDataSymbol(ticker, exchange)).toBe('RY.TO')
  })

  it('ABC.V round-trips through Twelve Data and back', () => {
    const ticker = toTwelveDataSymbol('ABC.V')!
    const exchange = toTwelveDataExchange('ABC.V')!
    expect(fromTwelveDataSymbol(ticker, exchange)).toBe('ABC.V')
  })

  it('SU.TSX round-trips to canonical .TO form', () => {
    // .TSX and .TO both map to TSX exchange; canonical output is .TO
    const ticker = toTwelveDataSymbol('SU.TSX')!
    const exchange = toTwelveDataExchange('SU.TSX')!
    expect(fromTwelveDataSymbol(ticker, exchange)).toBe('SU.TO')
  })

  it('parseCanadianSymbol + fromTwelveDataSymbol round-trips ENB.TO', () => {
    const parsed = parseCanadianSymbol('ENB.TO')!
    expect(fromTwelveDataSymbol(parsed.ticker, parsed.exchange)).toBe('ENB.TO')
  })
})

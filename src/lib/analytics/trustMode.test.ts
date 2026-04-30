import { describe, it, expect } from 'vitest'
import {
  combineTrustModes,
  trustModeLabel,
  trustModeClass,
  trustModeBgClass,
} from './trustMode'

describe('combineTrustModes', () => {
  it('returns TRUSTED when all modes are TRUSTED', () => {
    expect(combineTrustModes(['TRUSTED', 'TRUSTED'])).toBe('TRUSTED')
  })

  it('returns TRUSTED for empty array', () => {
    expect(combineTrustModes([])).toBe('TRUSTED')
  })

  it('returns DEGRADED when any mode is DEGRADED', () => {
    expect(combineTrustModes(['TRUSTED', 'DEGRADED', 'TRUSTED'])).toBe('DEGRADED')
  })

  it('returns INSUFFICIENT_DATA over DEGRADED', () => {
    expect(combineTrustModes(['DEGRADED', 'INSUFFICIENT_DATA'])).toBe('INSUFFICIENT_DATA')
  })

  it('returns UNTRUSTED over everything', () => {
    expect(combineTrustModes(['TRUSTED', 'INSUFFICIENT_DATA', 'DEGRADED', 'UNTRUSTED'])).toBe('UNTRUSTED')
  })

  it('returns INSUFFICIENT_DATA when only that mode is present', () => {
    expect(combineTrustModes(['INSUFFICIENT_DATA'])).toBe('INSUFFICIENT_DATA')
  })
})

describe('trustModeLabel', () => {
  it('returns correct labels for each mode', () => {
    expect(trustModeLabel('TRUSTED')).toBe('TRUSTED')
    expect(trustModeLabel('DEGRADED')).toBe('DEGRADED')
    expect(trustModeLabel('INSUFFICIENT_DATA')).toBe('INSUFFICIENT DATA')
    expect(trustModeLabel('UNTRUSTED')).toBe('UNTRUSTED')
  })
})

describe('trustModeClass', () => {
  it('returns a CSS class string for each mode', () => {
    expect(trustModeClass('TRUSTED')).toContain('Green')
    expect(trustModeClass('DEGRADED')).toContain('Amber')
    expect(trustModeClass('INSUFFICIENT_DATA')).toContain('Muted')
    expect(trustModeClass('UNTRUSTED')).toContain('Red')
  })
})

describe('trustModeBgClass', () => {
  it('returns a CSS string for each mode', () => {
    expect(trustModeBgClass('TRUSTED')).toBeTruthy()
    expect(trustModeBgClass('DEGRADED')).toBeTruthy()
    expect(trustModeBgClass('INSUFFICIENT_DATA')).toBeTruthy()
    expect(trustModeBgClass('UNTRUSTED')).toBeTruthy()
  })
})

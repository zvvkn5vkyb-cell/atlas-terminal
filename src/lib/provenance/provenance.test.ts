import { describe, it, expect } from 'vitest'
import {
  classifyDataQuality,
  formatProvenanceLabel,
  isDataUsableForTrading,
  isDataUsableForAnalytics,
  createLiveProvenance,
  createMockProvenance,
  createFallbackProvenance,
  createErrorProvenance,
  DEFAULT_STALENESS_THRESHOLD_MS,
} from './provenance'
import type { DataProvenance } from '@/types/provenance'

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0) // fixed reference "now"

describe('classifyDataQuality', () => {
  it('classifies a fresh value from a live source as LIVE', () => {
    expect(classifyDataQuality({ source: 'POLYGON', asOf: NOW, now: NOW })).toBe('LIVE')
  })

  it('classifies a delayed live value as DELAYED', () => {
    expect(
      classifyDataQuality({ source: 'POLYGON', asOf: NOW, isDelayed: true, now: NOW }),
    ).toBe('DELAYED')
  })

  it('classifies an old value as STALE based on the threshold', () => {
    const asOf = NOW - DEFAULT_STALENESS_THRESHOLD_MS - 1
    expect(classifyDataQuality({ source: 'POLYGON', asOf, now: NOW })).toBe('STALE')
  })

  it('does not classify a value within the staleness threshold as STALE', () => {
    const asOf = NOW - (DEFAULT_STALENESS_THRESHOLD_MS - 1)
    expect(classifyDataQuality({ source: 'POLYGON', asOf, now: NOW })).toBe('LIVE')
  })

  it('honours a custom staleness threshold', () => {
    const asOf = NOW - 2000
    expect(
      classifyDataQuality({ source: 'POLYGON', asOf, now: NOW, stalenessThresholdMs: 1000 }),
    ).toBe('STALE')
  })

  it('STALE wins over DELAYED when a delayed value is also too old', () => {
    const asOf = NOW - DEFAULT_STALENESS_THRESHOLD_MS - 1
    expect(
      classifyDataQuality({ source: 'POLYGON', asOf, isDelayed: true, now: NOW }),
    ).toBe('STALE')
  })

  it('ERROR takes precedence over everything', () => {
    expect(
      classifyDataQuality({ source: 'POLYGON', asOf: NOW, hasError: true, now: NOW }),
    ).toBe('ERROR')
  })

  it('classifies the MOCK source as MOCK regardless of age', () => {
    const asOf = NOW - DEFAULT_STALENESS_THRESHOLD_MS - 1
    expect(classifyDataQuality({ source: 'MOCK', asOf, now: NOW })).toBe('MOCK')
  })

  it('classifies the MANUAL source as MANUAL', () => {
    expect(classifyDataQuality({ source: 'MANUAL', now: NOW })).toBe('MANUAL')
  })

  it('classifies the UNKNOWN source as UNKNOWN', () => {
    expect(classifyDataQuality({ source: 'UNKNOWN', now: NOW })).toBe('UNKNOWN')
  })

  it('classifies the Canadian placeholder source as FALLBACK', () => {
    expect(classifyDataQuality({ source: 'CANADIAN_PLACEHOLDER', now: NOW })).toBe('FALLBACK')
  })

  it('classifies an explicit fallback flag as FALLBACK', () => {
    expect(classifyDataQuality({ source: 'POLYGON', isFallback: true, now: NOW })).toBe('FALLBACK')
  })

  it('treats a missing asOf as not stale', () => {
    expect(classifyDataQuality({ source: 'POLYGON', now: NOW })).toBe('LIVE')
  })

  it('ignores an unparseable asOf for staleness', () => {
    expect(classifyDataQuality({ source: 'POLYGON', asOf: 'not-a-date', now: NOW })).toBe('LIVE')
  })

  it('accepts ISO string and Date forms of asOf', () => {
    const old = new Date(NOW - DEFAULT_STALENESS_THRESHOLD_MS - 1)
    expect(classifyDataQuality({ source: 'POLYGON', asOf: old.toISOString(), now: NOW })).toBe('STALE')
    expect(classifyDataQuality({ source: 'POLYGON', asOf: old, now: NOW })).toBe('STALE')
  })
})

describe('formatProvenanceLabel', () => {
  it('combines status and explicit provider name', () => {
    const p: DataProvenance = {
      source: 'POLYGON',
      status: 'LIVE',
      fetchedAt: new Date(NOW).toISOString(),
      provider: 'Polygon.io',
    }
    expect(formatProvenanceLabel(p)).toBe('LIVE · Polygon.io')
  })

  it('derives an origin label from the source when no provider is set', () => {
    const p: DataProvenance = {
      source: 'MOCK',
      status: 'MOCK',
      fetchedAt: new Date(NOW).toISOString(),
    }
    expect(formatProvenanceLabel(p)).toBe('MOCK · Mock')
  })
})

describe('isDataUsableForTrading', () => {
  it('accepts only LIVE data', () => {
    expect(isDataUsableForTrading('LIVE')).toBe(true)
  })

  it('rejects delayed, stale, mock, fallback, error and unknown data', () => {
    for (const status of ['DELAYED', 'STALE', 'MOCK', 'FALLBACK', 'MANUAL', 'ERROR', 'UNKNOWN'] as const) {
      expect(isDataUsableForTrading(status)).toBe(false)
    }
  })

  it('accepts a full provenance object', () => {
    const p = createLiveProvenance({ source: 'POLYGON', asOf: new Date(NOW).toISOString(), now: NOW })
    expect(isDataUsableForTrading(p)).toBe(true)
  })
})

describe('isDataUsableForAnalytics', () => {
  it('accepts LIVE, DELAYED, STALE and MANUAL data', () => {
    for (const status of ['LIVE', 'DELAYED', 'STALE', 'MANUAL'] as const) {
      expect(isDataUsableForAnalytics(status)).toBe(true)
    }
  })

  it('rejects MOCK, FALLBACK, ERROR and UNKNOWN data', () => {
    for (const status of ['MOCK', 'FALLBACK', 'ERROR', 'UNKNOWN'] as const) {
      expect(isDataUsableForAnalytics(status)).toBe(false)
    }
  })
})

describe('createLiveProvenance', () => {
  it('produces LIVE provenance for a fresh value', () => {
    const p = createLiveProvenance({
      source: 'POLYGON',
      provider: 'Polygon.io',
      asOf: new Date(NOW).toISOString(),
      now: NOW,
    })
    expect(p.source).toBe('POLYGON')
    expect(p.status).toBe('LIVE')
    expect(p.provider).toBe('Polygon.io')
    expect(p.fetchedAt).toBeTruthy()
  })

  it('downgrades to DELAYED when isDelayed is set', () => {
    const p = createLiveProvenance({ source: 'POLYGON', isDelayed: true, now: NOW })
    expect(p.status).toBe('DELAYED')
  })

  it('downgrades to STALE when asOf is too old', () => {
    const p = createLiveProvenance({
      source: 'POLYGON',
      asOf: new Date(NOW - DEFAULT_STALENESS_THRESHOLD_MS - 1).toISOString(),
      now: NOW,
    })
    expect(p.status).toBe('STALE')
  })

  it('defaults the source to UNKNOWN', () => {
    expect(createLiveProvenance().status).toBe('UNKNOWN')
  })
})

describe('createMockProvenance', () => {
  it('produces MOCK provenance', () => {
    const p = createMockProvenance({ provider: 'MockMarketDataProvider' })
    expect(p.source).toBe('MOCK')
    expect(p.status).toBe('MOCK')
    expect(p.provider).toBe('MockMarketDataProvider')
    expect(p.fetchedAt).toBeTruthy()
  })
})

describe('createErrorProvenance', () => {
  it('produces ERROR provenance with the supplied message and reason', () => {
    const p = createErrorProvenance({
      source: 'POLYGON',
      provider: 'Polygon.io',
      error: 'HTTP 500',
      fallbackReason: 'served mock bars',
    })
    expect(p.status).toBe('ERROR')
    expect(p.source).toBe('POLYGON')
    expect(p.error).toBe('HTTP 500')
    expect(p.fallbackReason).toBe('served mock bars')
  })

  it('defaults the source to UNKNOWN', () => {
    expect(createErrorProvenance({ error: 'boom' }).source).toBe('UNKNOWN')
  })
})

describe('createFallbackProvenance', () => {
  it('produces FALLBACK provenance for substituted data', () => {
    const p = createFallbackProvenance({
      source: 'CANADIAN_PLACEHOLDER',
      provider: 'Twelve Data (not configured)',
      fallbackReason: 'Twelve Data API key not configured',
    })
    expect(p.status).toBe('FALLBACK')
    expect(p.source).toBe('CANADIAN_PLACEHOLDER')
    expect(p.fallbackReason).toBe('Twelve Data API key not configured')
    expect(p.fetchedAt).toBeTruthy()
  })

  it('defaults the source to UNKNOWN', () => {
    expect(createFallbackProvenance().source).toBe('UNKNOWN')
  })

  it('is not usable for trading or analytics', () => {
    const p = createFallbackProvenance({ source: 'CANADIAN_PLACEHOLDER' })
    expect(isDataUsableForTrading(p)).toBe(false)
    expect(isDataUsableForAnalytics(p)).toBe(false)
  })
})

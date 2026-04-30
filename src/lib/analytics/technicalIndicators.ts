import type { OHLCVBar } from '@/services/market/types'

export interface TechnicalIndicators {
  rsi14: number | null
  macd: { value: number; signal: number; histogram: number } | null
  sma20: number | null
  sma50: number | null
  sma200: number | null
  atr14: number | null
  barsAvailable: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null
  const slice = values.slice(values.length - period)
  return slice.reduce((a, b) => a + b, 0) / period
}

// Builds a full EMA series. Returns NaN for indices before the first valid point.
function emaSeries(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(NaN)
  if (values.length < period) return result
  const k = 2 / (period + 1)

  // Seed with simple average of first `period` values
  let sum = 0
  for (let i = 0; i < period; i++) sum += values[i]
  result[period - 1] = sum / period

  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * k + result[i - 1] * (1 - k)
  }
  return result
}

// ─── RSI (Wilder's smoothing) ─────────────────────────────────────────────────

function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null

  const changes = closes.slice(1).map((c, i) => c - closes[i])
  const gains = changes.map(c => (c > 0 ? c : 0))
  const losses = changes.map(c => (c < 0 ? -c : 0))

  // Seed: simple average of first `period` values
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period

  // Wilder smoothing for remaining periods
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

// ─── MACD (12, 26, 9) ─────────────────────────────────────────────────────────

function computeMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): { value: number; signal: number; histogram: number } | null {
  const minBars = slow + signal
  if (closes.length < minBars) return null

  const ema12 = emaSeries(closes, fast)
  const ema26 = emaSeries(closes, slow)

  // MACD line = ema12 - ema26, valid from index (slow - 1) onwards
  const macdLine: number[] = []
  for (let i = slow - 1; i < closes.length; i++) {
    macdLine.push(ema12[i] - ema26[i])
  }

  if (macdLine.length < signal) return null

  const signalSeries = emaSeries(macdLine, signal)
  const lastMacd = macdLine[macdLine.length - 1]
  const lastSignal = signalSeries[signalSeries.length - 1]

  if (isNaN(lastSignal)) return null

  return {
    value: Math.round(lastMacd * 10000) / 10000,
    signal: Math.round(lastSignal * 10000) / 10000,
    histogram: Math.round((lastMacd - lastSignal) * 10000) / 10000,
  }
}

// ─── ATR (Wilder's smoothing) ─────────────────────────────────────────────────

function computeATR(bars: OHLCVBar[], period = 14): number | null {
  if (bars.length < period + 1) return null

  const trueRanges: number[] = []
  for (let i = 1; i < bars.length; i++) {
    const { high, low } = bars[i]
    const prevClose = bars[i - 1].close
    trueRanges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)))
  }

  // Seed with simple average
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period
  }

  return Math.round(atr * 100) / 100
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeTechnicalIndicators(bars: OHLCVBar[]): TechnicalIndicators {
  const closes = bars.map(b => b.close)

  return {
    rsi14: computeRSI(closes),
    macd: computeMACD(closes),
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    atr14: computeATR(bars),
    barsAvailable: bars.length,
  }
}

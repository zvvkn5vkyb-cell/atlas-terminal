import type { Holding, AllocationBucket } from '@/types/portfolio'

export function calculateAssetClassAllocation(holdings: Holding[]): AllocationBucket[] {
  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0)
  if (totalValue === 0) return []

  const map = new Map<string, number>()
  for (const h of holdings) {
    map.set(h.assetClass, (map.get(h.assetClass) ?? 0) + h.currentValue)
  }

  return [...map.entries()]
    .map(([label, value]) => ({ label, value, pct: value / totalValue }))
    .sort((a, b) => b.pct - a.pct)
}

export function calculateHoldingWeights(holdings: Holding[]): Map<string, number> {
  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0)
  const weights = new Map<string, number>()
  if (totalValue === 0) return weights
  for (const h of holdings) {
    weights.set(h.symbol, h.currentValue / totalValue)
  }
  return weights
}

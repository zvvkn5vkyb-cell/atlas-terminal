export function formatCurrency(
  value: number,
  currency = 'USD',
  compact = false,
): string {
  if (compact && Math.abs(value) >= 1_000_000) {
    const m = value / 1_000_000
    return `${currency === 'USD' ? '$' : currency + ' '}${m.toFixed(2)}M`
  }
  if (compact && Math.abs(value) >= 1_000) {
    const k = value / 1_000
    return `${currency === 'USD' ? '$' : currency + ' '}${k.toFixed(1)}K`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPct(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function formatPctPlain(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return value.toFixed(2)
}

export function formatDate(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function pnlClass(value: number): string {
  if (value > 0) return 'text-terminalGreen'
  if (value < 0) return 'text-terminalRed'
  return 'text-terminalSubtext'
}

export function pnlSign(value: number): string {
  return value >= 0 ? '+' : ''
}

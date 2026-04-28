import type { TrustMode } from '@/types/market'

export function combineTrustModes(modes: TrustMode[]): TrustMode {
  if (modes.includes('UNTRUSTED')) return 'UNTRUSTED'
  if (modes.includes('INSUFFICIENT_DATA')) return 'INSUFFICIENT_DATA'
  if (modes.includes('DEGRADED')) return 'DEGRADED'
  return 'TRUSTED'
}

export function trustModeLabel(mode: TrustMode): string {
  switch (mode) {
    case 'TRUSTED': return 'TRUSTED'
    case 'DEGRADED': return 'DEGRADED'
    case 'INSUFFICIENT_DATA': return 'INSUFFICIENT DATA'
    case 'UNTRUSTED': return 'UNTRUSTED'
  }
}

export function trustModeClass(mode: TrustMode): string {
  switch (mode) {
    case 'TRUSTED': return 'text-terminalGreen'
    case 'DEGRADED': return 'text-terminalAmber'
    case 'INSUFFICIENT_DATA': return 'text-terminalMuted'
    case 'UNTRUSTED': return 'text-terminalRed'
  }
}

export function trustModeBgClass(mode: TrustMode): string {
  switch (mode) {
    case 'TRUSTED': return 'bg-terminalGreen/10 text-terminalGreen border-terminalGreen/30'
    case 'DEGRADED': return 'bg-terminalAmber/10 text-terminalAmber border-terminalAmber/30'
    case 'INSUFFICIENT_DATA': return 'bg-terminalMuted/10 text-terminalMuted border-terminalMuted/30'
    case 'UNTRUSTED': return 'bg-terminalRed/10 text-terminalRed border-terminalRed/30'
  }
}

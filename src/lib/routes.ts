import type { ModuleId } from '@/types/system'

export function getModuleTitle(id: ModuleId): string {
  const titles: Record<ModuleId, string> = {
    market: 'Market Overview',
    security: 'Security Detail',
    portfolio: 'Portfolio',
    'private-assets': 'Private Assets',
    macro: 'Macro Dashboard',
    news: 'News Feed',
    screener: 'Screener',
    intelligence: 'Intelligence',
  }
  return titles[id] ?? id
}

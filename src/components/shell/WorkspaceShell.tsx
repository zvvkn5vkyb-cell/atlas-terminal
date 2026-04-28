import { useWorkspaceStore } from '@/store/workspaceStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { StatusBar } from './StatusBar'
import { CommandPalette } from './CommandPalette'
import { MarketOverview } from '@/pages/MarketOverview'
import { SecurityDetail } from '@/pages/SecurityDetail'
import { Portfolio } from '@/pages/Portfolio'
import { PrivateAssets } from '@/pages/PrivateAssets'
import { MacroDashboard } from '@/pages/MacroDashboard'
import { NewsFeed } from '@/pages/NewsFeed'
import { Screener } from '@/pages/Screener'
import { Intelligence } from '@/pages/Intelligence'

function ActiveModule() {
  const { activeModule } = useWorkspaceStore()

  switch (activeModule) {
    case 'market': return <MarketOverview />
    case 'security': return <SecurityDetail />
    case 'portfolio': return <Portfolio />
    case 'private-assets': return <PrivateAssets />
    case 'macro': return <MacroDashboard />
    case 'news': return <NewsFeed />
    case 'screener': return <Screener />
    case 'intelligence': return <Intelligence />
    default: return <Portfolio />
  }
}

export function WorkspaceShell() {
  useKeyboardShortcuts()

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-terminalBg text-terminalText">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-terminalBg">
          <ActiveModule />
        </main>
      </div>
      <StatusBar />
      <CommandPalette />
    </div>
  )
}

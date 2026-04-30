import { WorkspaceShell } from '@/components/shell/WorkspaceShell'
import { ErrorBoundary } from '@/components/system/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceShell />
    </ErrorBoundary>
  )
}

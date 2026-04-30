import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  caught: boolean
  message: string
  stack: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { caught: false, message: '', stack: '' }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? (error.stack ?? '') : ''
    return { caught: true, message, stack }
  }

  componentDidCatch(_error: unknown, info: ErrorInfo) {
    // Surface component stack to console in any environment so it shows in
    // server logs and browser devtools without leaking into the rendered UI.
    console.error('[ErrorBoundary]', info.componentStack)
  }

  private handleReset = () => {
    this.setState({ caught: false, message: '', stack: '' })
  }

  render() {
    if (!this.state.caught) return this.props.children

    const isDev = import.meta.env.DEV

    return (
      <div className="flex items-center justify-center h-screen w-screen bg-terminalBg text-terminalText font-mono">
        <div className="border border-terminalRed/60 bg-terminalRed/5 p-6 max-w-2xl w-full mx-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-terminalRed text-xs tracking-widest uppercase">
              ██ SYSTEM FAULT
            </span>
          </div>

          <div className="text-sm text-terminalText mb-1">
            An unhandled error crashed this module.
          </div>
          <div className="text-xs text-terminalMuted mb-4">
            Other modules and your portfolio data are unaffected.
            Reload the page or click Reset to recover.
          </div>

          {isDev && this.state.message && (
            <div className="mb-4 border border-terminalBorder bg-terminalPanel px-3 py-2">
              <div className="text-2xs text-terminalMuted uppercase tracking-wider mb-1">
                Error (dev only)
              </div>
              <pre className="text-xs text-terminalAmber whitespace-pre-wrap break-all">
                {this.state.message}
              </pre>
              {this.state.stack && (
                <pre className="text-2xs text-terminalMuted/70 whitespace-pre-wrap break-all mt-2 max-h-40 overflow-y-auto">
                  {this.state.stack}
                </pre>
              )}
            </div>
          )}

          <button
            onClick={this.handleReset}
            className="text-xs font-mono text-terminalAmber border border-terminalAmber/40 px-3 py-1 hover:bg-terminalAmber/10 transition-colors"
          >
            ↺ Reset module
          </button>
        </div>
      </div>
    )
  }
}

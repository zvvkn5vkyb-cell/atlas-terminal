import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/Button'

export function Intelligence() {
  return (
    <div className="p-2 flex flex-col gap-2">
      {/* Investment memo */}
      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader title="Investment Memo Drafting" action={
          <Button variant="amber" size="xs">New Memo</Button>
        } />
        <div className="p-4">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Security (e.g. AAPL) or thesis topic..."
              className="flex-1 bg-terminalBg border border-terminalBorder text-xs font-mono text-terminalText px-2 py-1.5 outline-none focus:border-terminalAmber"
            />
            <Button variant="default" size="sm">Analyze</Button>
          </div>
          <div className="bg-terminalBg border border-terminalBorder p-3 min-h-24 text-xs font-mono text-terminalMuted">
            Investment memo drafting requires AI provider configuration.
            <br /><br />
            <span className="text-terminalSubtext">Placeholder: memo content will appear here once an AI provider (e.g. OpenAI, Anthropic) is connected.</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Risk extraction */}
        <div className="bg-terminalPanel border border-terminalBorder">
          <SectionHeader title="Risk Extraction" />
          <div className="p-3">
            <div className="text-xs font-mono text-terminalMuted mb-2">
              Extract structured risk factors from text
            </div>
            <textarea
              placeholder="Paste earnings transcript, news article, filing excerpt..."
              className="w-full bg-terminalBg border border-terminalBorder text-xs font-mono text-terminalText px-2 py-1.5 outline-none focus:border-terminalAmber resize-none h-24"
            />
            <div className="mt-2">
              <Button variant="ghost" size="xs">Extract Risks</Button>
            </div>
            <div className="mt-3 border-t border-terminalBorder pt-2 text-2xs text-terminalMuted font-mono">
              Risk extraction requires AI provider
            </div>
          </div>
        </div>

        {/* Earnings / news summary */}
        <div className="bg-terminalPanel border border-terminalBorder">
          <SectionHeader title="Earnings & News Summary" />
          <div className="p-3">
            {[
              { symbol: 'AAPL', event: 'Q1 FY2024 Earnings', date: '2024-02-01', summary: 'Beat estimates on revenue and EPS. Services record high.' },
              { symbol: 'MSFT', event: 'Q2 FY2024 Earnings', date: '2024-01-30', summary: 'Azure +28% YoY. Copilot adoption accelerating.' },
              { symbol: 'TD.TO', event: 'Regulatory Update', date: '2024-01-25', summary: 'AML investigation ongoing. Provisions increased.' },
            ].map(item => (
              <div key={item.symbol} className="border-b border-terminalBorder/40 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-terminalAmber">{item.symbol}</span>
                  <span className="text-2xs font-mono text-terminalMuted">{item.date}</span>
                </div>
                <div className="text-2xs font-mono text-terminalSubtext font-medium">{item.event}</div>
                <div className="text-2xs font-mono text-terminalMuted leading-snug mt-0.5">{item.summary}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Source traceability */}
      <div className="bg-terminalPanel border border-terminalBorder">
        <SectionHeader title="Source Traceability" />
        <div className="p-3">
          <div className="text-xs font-mono text-terminalMuted mb-3">
            All AI-generated content must cite sources. Source metadata will be tracked here.
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Sources Tracked', value: '0', note: 'Requires AI provider' },
              { label: 'Verified Citations', value: '0', note: 'Requires AI provider' },
              { label: 'Unverified Claims', value: '0', note: 'Requires AI provider' },
            ].map(m => (
              <div key={m.label} className="bg-terminalBg border border-terminalBorder p-2">
                <div className="text-2xs text-terminalMuted font-mono uppercase">{m.label}</div>
                <div className="text-lg font-mono text-terminalText tabular-nums">{m.value}</div>
                <div className="text-2xs text-terminalMuted font-mono">{m.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

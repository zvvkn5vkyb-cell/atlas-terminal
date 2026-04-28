import { PerformanceStrip } from '@/components/portfolio/PerformanceStrip'
import { RiskSummaryStrip } from '@/components/portfolio/RiskSummaryStrip'
import { SummaryStrip } from '@/components/portfolio/SummaryStrip'
import { HoldingsTable } from '@/components/portfolio/HoldingsTable'
import { TopContributors } from '@/components/portfolio/TopContributors'
import { AllocationBlock } from '@/components/portfolio/AllocationBlock'
import { CashBlock } from '@/components/portfolio/CashBlock'
import { IntegrityBlock } from '@/components/portfolio/IntegrityBlock'
import { RiskFlagsBlock } from '@/components/portfolio/RiskFlagsBlock'

export function Portfolio() {
  return (
    <div className="flex flex-col h-full">
      <PerformanceStrip />
      <RiskSummaryStrip />
      <SummaryStrip />

      <div className="flex-1 flex flex-col gap-2 p-2 overflow-y-auto">
        {/* Holdings — full width anchor */}
        <HoldingsTable />

        {/* Bottom row widgets */}
        <div className="grid grid-cols-3 gap-2">
          <TopContributors />
          <AllocationBlock />
          <div className="flex flex-col gap-2">
            <CashBlock />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <IntegrityBlock />
          <RiskFlagsBlock />
        </div>
      </div>
    </div>
  )
}

import { TopBar } from '../../components/layout/TopBar'
import { Panel } from '../../components/common/Panel'
import { Activity, Terminal } from 'lucide-react'
import { Card } from '../../components/common/Card'
import React from 'react'
import { EmptyWorkspace } from '../../components/common/EmptyWorkspace'

export function DeviceMonitor(): React.JSX.Element {
  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar />
      <div className="flex-1 p-24 md:p-32 flex flex-col gap-24 overflow-hidden w-full">
        <div className="grid grid-cols-3 gap-24 shrink-0">
          <Card className="p-24 flex items-center gap-20">
            <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center text-text-secondary border border-border shadow-sm">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[13px] text-text-secondary font-medium tracking-wide uppercase">
                Status
              </div>
              <div className="text-[16px] font-semibold text-text-primary tracking-tight mt-2">
                Waiting for hardware
              </div>
            </div>
          </Card>
          <Card className="p-24 flex items-center gap-20">
            <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center text-text-secondary border border-border shadow-sm">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[13px] text-text-secondary font-medium tracking-wide uppercase">
                Baud Rate
              </div>
              <div className="text-[16px] font-semibold text-text-primary tracking-tight mt-2">
                ---
              </div>
            </div>
          </Card>
          <Card className="p-24 flex items-center justify-center text-text-secondary/70 text-[14px] font-medium border-2 border-dashed bg-transparent shadow-none border-border hover:bg-border/30 cursor-not-allowed transition-colors">
            + Add Sensor Widget
          </Card>
        </div>
        <Panel className="flex-1" title="Serial Console">
          <EmptyWorkspace
            title="Waiting for device..."
            description="Connect a board to start monitoring serial output and viewing live sensor data."
            icon={<Terminal className="w-10 h-10 text-text-secondary/60" />}
          />
        </Panel>
      </div>
    </div>
  )
}

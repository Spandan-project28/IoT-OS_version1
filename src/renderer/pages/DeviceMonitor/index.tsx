import { TopBar } from '../../components/layout/TopBar'
import { Panel } from '../../components/common/Panel'
import { Activity, Terminal } from 'lucide-react'
import { Card } from '../../components/common/Card'
import React from 'react'
import { EmptyWorkspace } from '../../components/common/EmptyWorkspace'

export function DeviceMonitor(): React.JSX.Element {
  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar>
        <span className="font-semibold text-text-primary text-[14px] tracking-tight">
          Device Monitor
        </span>
      </TopBar>
      <div className="flex-1 p-24 flex flex-col gap-16 overflow-hidden max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-3 gap-16 shrink-0">
          <Card className="p-20 flex items-center gap-16 opacity-50">
            <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center text-text-secondary border border-border">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[12px] text-text-secondary font-medium tracking-wide">
                Status
              </div>
              <div className="text-[15px] font-semibold text-text-primary tracking-tight mt-2">
                Waiting for hardware
              </div>
            </div>
          </Card>
          <Card className="p-20 flex items-center gap-16 opacity-50">
            <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center text-text-secondary border border-border">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[12px] text-text-secondary font-medium tracking-wide">
                Baud Rate
              </div>
              <div className="text-[15px] font-semibold text-text-primary tracking-tight mt-2">
                ---
              </div>
            </div>
          </Card>
          <Card className="p-20 flex items-center justify-center text-text-secondary/50 text-[13px] border-dashed bg-transparent shadow-none border-border-strong cursor-not-allowed">
            + Add Sensor Widget
          </Card>
        </div>
        <Panel className="flex-1 shadow-sm border-border-strong rounded-2xl" title="Serial Console">
          <EmptyWorkspace
            title="Waiting for device..."
            description="Connect a board to start monitoring serial output and viewing live sensor data."
            icon={<Terminal className="w-10 h-10 text-text-secondary/50" />}
          />
        </Panel>
      </div>
    </div>
  )
}

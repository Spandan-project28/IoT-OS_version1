import { TopBar } from '../../components/layout/TopBar'
import { Panel } from '../../components/common/Panel'
import { Settings as SettingsIcon, Shield, Cpu } from 'lucide-react'
import { Button } from '../../components/common/Button'
import React from 'react'

export function Settings(): React.JSX.Element {
  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar>
        <span className="font-semibold text-text-primary text-[14px] tracking-tight">Settings</span>
      </TopBar>
      <div className="flex-1 p-32 md:p-48 overflow-y-auto">
        <div className="max-w-[800px] mx-auto flex flex-col gap-40">
          <div>
            <h2 className="text-[15px] font-semibold text-text-primary mb-12 flex items-center gap-8">
              <SettingsIcon className="w-[18px] h-[18px] text-text-secondary" /> General
            </h2>
            <Panel className="p-0 shadow-sm border-border-strong rounded-2xl">
              <div className="p-20 border-b border-border flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-medium text-text-primary">Theme Preference</div>
                  <div className="text-[13px] text-text-secondary mt-[2px]">
                    Select your interface color scheme.
                  </div>
                </div>
                <div className="text-[13px] font-medium text-text-primary bg-surface-elevated border border-border px-12 py-6 rounded-lg">
                  Dark
                </div>
              </div>
              <div className="p-20 flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-medium text-text-primary">Telemetry</div>
                  <div className="text-[13px] text-text-secondary mt-[2px]">
                    Help us improve by sending anonymous usage data.
                  </div>
                </div>
                <Button variant="secondary" size="sm" disabled>
                  Disabled
                </Button>
              </div>
            </Panel>
          </div>

          <div>
            <h2 className="text-[15px] font-semibold text-text-primary mb-12 flex items-center gap-8">
              <Shield className="w-[18px] h-[18px] text-text-secondary" /> AI Configuration
            </h2>
            <Panel className="p-20 shadow-sm border-border-strong rounded-2xl">
              <div className="text-[14px] font-medium text-text-primary mb-12">AI Provider</div>
              <div className="flex gap-12">
                <input
                  type="text"
                  value=""
                  placeholder="(Not configured)"
                  disabled
                  className="flex-1 bg-background border border-border rounded-lg px-12 py-[6px] text-[13px] text-text-primary focus:outline-none placeholder:text-text-secondary/50 cursor-not-allowed"
                />
                <Button variant="secondary" size="sm" disabled>
                  Configure
                </Button>
              </div>
            </Panel>
          </div>

          <div>
            <h2 className="text-[15px] font-semibold text-text-primary mb-12 flex items-center gap-8">
              <Cpu className="w-[18px] h-[18px] text-text-secondary" /> Hardware Options
            </h2>
            <Panel className="p-20 shadow-sm border-border-strong rounded-2xl">
              <div className="text-[14px] font-medium text-text-primary mb-12">
                Arduino CLI Path
              </div>
              <div className="flex gap-12">
                <input
                  type="text"
                  value=""
                  placeholder="(Not configured)"
                  disabled
                  className="flex-1 bg-background border border-border rounded-lg px-12 py-[6px] text-[13px] text-text-primary focus:outline-none placeholder:text-text-secondary/50 cursor-not-allowed"
                />
                <Button variant="secondary" size="sm" disabled>
                  Browse
                </Button>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}

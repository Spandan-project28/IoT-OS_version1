import { TopBar } from '../../components/layout/TopBar'
import { Panel } from '../../components/common/Panel'
import { Settings as SettingsIcon, Shield, Cpu } from 'lucide-react'
import { Button } from '../../components/common/Button'
import React from 'react'

export function Settings(): React.JSX.Element {
  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar />
      <div className="flex-1 p-24 md:p-32 overflow-y-auto">
        <div className="max-w-[800px] flex flex-col gap-48">
          <div>
            <h2 className="text-[18px] font-semibold text-text-primary mb-16 flex items-center gap-10">
              <SettingsIcon className="w-6 h-6 text-text-secondary" /> General
            </h2>
            <Panel className="p-0">
              <div className="p-24 border-b border-border flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-semibold text-text-primary">
                    Theme Preference
                  </div>
                  <div className="text-[14px] text-text-secondary mt-4">
                    Select your interface color scheme.
                  </div>
                </div>
                <div className="text-[14px] font-medium text-text-primary bg-surface border border-border px-16 py-8 rounded-xl shadow-sm">
                  Light
                </div>
              </div>
              <div className="p-24 flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-semibold text-text-primary">Telemetry</div>
                  <div className="text-[14px] text-text-secondary mt-4">
                    Help us improve by sending anonymous usage data.
                  </div>
                </div>
                <Button variant="secondary" disabled>
                  Disabled
                </Button>
              </div>
            </Panel>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-text-primary mb-16 flex items-center gap-10">
              <Shield className="w-6 h-6 text-text-secondary" /> AI Configuration
            </h2>
            <Panel className="p-24">
              <div className="text-[15px] font-semibold text-text-primary mb-16">AI Provider</div>
              <div className="flex gap-16">
                <input
                  type="text"
                  value=""
                  placeholder="(Not configured)"
                  disabled
                  className="flex-1 bg-surface border border-border rounded-xl px-16 py-10 text-[14px] text-text-primary focus:outline-none placeholder:text-text-secondary/50 cursor-not-allowed shadow-sm"
                />
                <Button variant="secondary" disabled>
                  Configure
                </Button>
              </div>
            </Panel>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-text-primary mb-16 flex items-center gap-10">
              <Cpu className="w-6 h-6 text-text-secondary" /> Hardware Options
            </h2>
            <Panel className="p-24">
              <div className="text-[15px] font-semibold text-text-primary mb-16">
                Arduino CLI Path
              </div>
              <div className="flex gap-16">
                <input
                  type="text"
                  value=""
                  placeholder="(Not configured)"
                  disabled
                  className="flex-1 bg-surface border border-border rounded-xl px-16 py-10 text-[14px] text-text-primary focus:outline-none placeholder:text-text-secondary/50 cursor-not-allowed shadow-sm"
                />
                <Button variant="secondary" disabled>
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

import { TopBar } from '../../components/layout/TopBar'
import { Panel } from '../../components/common/Panel'
import { Sparkles, Code2, Cpu, Cable, BookOpen, AlertCircle } from 'lucide-react'
import React from 'react'
import { ScrollContainer } from '../../components/common/ScrollContainer'

export function Editor(): React.JSX.Element {
  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar>
        <div className="flex items-center gap-10">
          <span className="font-semibold text-text-primary text-[14px] tracking-tight">
            (No Project Open)
          </span>
          <span className="px-6 py-[2px] rounded-md bg-surface-elevated border border-border text-[10px] text-text-secondary uppercase tracking-wider font-mono">
            Unsaved
          </span>
        </div>
      </TopBar>
      <div className="flex-1 flex gap-16 p-16 overflow-hidden">
        <Panel className="flex-[2] shadow-sm border-border-strong rounded-2xl" title="sketch.ino">
          <div className="flex flex-col items-center justify-center h-full text-text-secondary bg-surface text-[13px]">
            <AlertCircle className="w-8 h-8 mb-12 text-border-strong" />
            <div className="text-text-primary font-medium mb-4">No code to display</div>
            <div className="max-w-[300px] text-center text-text-secondary/70">
              Open a project or describe your idea to the Firmware Assistant to generate code.
            </div>
          </div>
        </Panel>

        <Panel
          className="flex-1 shadow-sm border-border-strong rounded-2xl"
          title="Firmware Assistant"
        >
          <ScrollContainer className="p-16 flex flex-col gap-16">
            <div className="flex items-start gap-12 p-16 rounded-xl bg-surface-elevated border border-border">
              <Sparkles className="w-5 h-5 text-text-secondary mt-[2px] shrink-0" />
              <div>
                <div className="text-[13px] font-medium text-text-primary mb-4">
                  Project Description
                </div>
                <div className="text-[12px] text-text-secondary leading-relaxed">
                  Provide a detailed description of the IoT functionality you want to build. The
                  assistant will analyze your requirements and generate production-ready firmware.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-12 p-16 rounded-xl bg-background border border-border/50 opacity-60">
              <Code2 className="w-5 h-5 text-text-secondary mt-[2px] shrink-0" />
              <div>
                <div className="text-[13px] font-medium text-text-primary mb-4">Generated Code</div>
                <div className="text-[12px] text-text-secondary leading-relaxed">
                  Awaiting description...
                </div>
              </div>
            </div>

            <div className="flex items-start gap-12 p-16 rounded-xl bg-background border border-border/50 opacity-60">
              <Cpu className="w-5 h-5 text-text-secondary mt-[2px] shrink-0" />
              <div>
                <div className="text-[13px] font-medium text-text-primary mb-4">Components</div>
                <div className="text-[12px] text-text-secondary leading-relaxed">
                  Awaiting description...
                </div>
              </div>
            </div>

            <div className="flex items-start gap-12 p-16 rounded-xl bg-background border border-border/50 opacity-60">
              <Cable className="w-5 h-5 text-text-secondary mt-[2px] shrink-0" />
              <div>
                <div className="text-[13px] font-medium text-text-primary mb-4">Wiring</div>
                <div className="text-[12px] text-text-secondary leading-relaxed">
                  Awaiting description...
                </div>
              </div>
            </div>

            <div className="flex items-start gap-12 p-16 rounded-xl bg-background border border-border/50 opacity-60">
              <BookOpen className="w-5 h-5 text-text-secondary mt-[2px] shrink-0" />
              <div>
                <div className="text-[13px] font-medium text-text-primary mb-4">Documentation</div>
                <div className="text-[12px] text-text-secondary leading-relaxed">
                  Awaiting description...
                </div>
              </div>
            </div>
          </ScrollContainer>
        </Panel>
      </div>
    </div>
  )
}

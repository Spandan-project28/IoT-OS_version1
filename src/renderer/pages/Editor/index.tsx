import { TopBar } from '../../components/layout/TopBar'
import { Panel } from '../../components/common/Panel'
import { Sparkles, Code2, Cpu, Cable, BookOpen, AlertCircle } from 'lucide-react'
import React from 'react'
import { ScrollContainer } from '../../components/common/ScrollContainer'

export function Editor(): React.JSX.Element {
  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar>
        <div className="flex items-center gap-12">
          <span className="font-semibold text-white text-[14px] tracking-tight">
            (No Project Open)
          </span>
          <span className="px-8 py-2 rounded-md bg-dark-surface border border-dark-border-strong text-[11px] text-disabled uppercase tracking-wider font-mono font-bold">
            Unsaved
          </span>
        </div>
      </TopBar>
      <div className="flex-1 flex gap-24 p-24 md:p-32 overflow-hidden w-full">
        <Panel className="flex-[2]" title="sketch.ino">
          <div className="flex flex-col items-center justify-center h-full text-text-secondary bg-surface text-[14px]">
            <AlertCircle className="w-10 h-10 mb-16 text-disabled" />
            <div className="text-text-primary font-semibold mb-6">No code to display</div>
            <div className="max-w-[340px] text-center text-text-secondary leading-relaxed">
              Open a project or describe your idea to the Firmware Assistant to generate code.
            </div>
          </div>
        </Panel>

        <Panel className="flex-1" title="Firmware Assistant">
          <ScrollContainer className="p-24 flex flex-col gap-20">
            <div className="flex items-start gap-16 p-20 rounded-2xl bg-surface border-2 border-primary/20 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <Sparkles className="w-6 h-6 text-primary mt-2 shrink-0" />
              <div>
                <div className="text-[15px] font-semibold text-text-primary mb-6">
                  Project Description
                </div>
                <div className="text-[14px] text-text-secondary leading-relaxed">
                  Provide a detailed description of the IoT functionality you want to build. The
                  assistant will analyze your requirements and generate production-ready firmware.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-16 p-20 rounded-2xl bg-surface border border-border shadow-sm">
              <Code2 className="w-6 h-6 text-text-secondary mt-2 shrink-0" />
              <div>
                <div className="text-[15px] font-semibold text-text-primary mb-6">
                  Generated Code
                </div>
                <div className="text-[14px] text-text-secondary leading-relaxed">
                  Awaiting description...
                </div>
              </div>
            </div>

            <div className="flex items-start gap-16 p-20 rounded-2xl bg-surface border border-border shadow-sm">
              <Cpu className="w-6 h-6 text-text-secondary mt-2 shrink-0" />
              <div>
                <div className="text-[15px] font-semibold text-text-primary mb-6">Components</div>
                <div className="text-[14px] text-text-secondary leading-relaxed">
                  Awaiting description...
                </div>
              </div>
            </div>

            <div className="flex items-start gap-16 p-20 rounded-2xl bg-surface border border-border shadow-sm">
              <Cable className="w-6 h-6 text-text-secondary mt-2 shrink-0" />
              <div>
                <div className="text-[15px] font-semibold text-text-primary mb-6">Wiring</div>
                <div className="text-[14px] text-text-secondary leading-relaxed">
                  Awaiting description...
                </div>
              </div>
            </div>

            <div className="flex items-start gap-16 p-20 rounded-2xl bg-surface border border-border shadow-sm">
              <BookOpen className="w-6 h-6 text-text-secondary mt-2 shrink-0" />
              <div>
                <div className="text-[15px] font-semibold text-text-primary mb-6">
                  Documentation
                </div>
                <div className="text-[14px] text-text-secondary leading-relaxed">
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

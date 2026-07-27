/**
 * Editor/index.tsx
 *
 * The Firmware Editor page.
 *
 * Reads selectedTemplate from Zustand. When a template is active:
 *   - Passes selectedTemplate.firmware to TopBar as firmwareSource, which
 *     activates the Upload button via its existing eligibility guards.
 *   - Replaces the Firmware Assistant placeholder sections with real template
 *     metadata: description, components list, wiring notes, expected output.
 *
 * When no template is selected (selectedTemplate === null):
 *   - TopBar receives no firmwareSource → Upload button stays disabled.
 *   - Firmware Assistant shows the same placeholder text as before.
 *   - Sketch panel shows the same "No code to display" state as before.
 *
 * No AI generation.
 * No IPC.
 * No async code.
 * TopBar is NOT modified.
 */

import { TopBar } from '../../components/layout/TopBar'
import { Panel } from '../../components/common/Panel'
import { ScrollContainer } from '../../components/common/ScrollContainer'
import { useAppStore } from '../../store/useAppStore'
import { Sparkles, Code2, Cpu, Cable, BookOpen, AlertCircle, CheckSquare } from 'lucide-react'
import React from 'react'

// ---------------------------------------------------------------------------
// Firmware Assistant section component
//
// Reuses the exact same card shape already in the existing placeholder sections
// to stay consistent with the design without any layout changes.
// ---------------------------------------------------------------------------

interface AssistantSectionProps {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  highlighted?: boolean
}

function AssistantSection({
  icon,
  title,
  children,
  highlighted = false
}: AssistantSectionProps): React.JSX.Element {
  if (highlighted) {
    return (
      <div className="flex items-start gap-16 p-20 rounded-2xl bg-surface border-2 border-primary/20 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
        <div className="text-primary mt-2 shrink-0">{icon}</div>
        <div>
          <div className="text-[15px] font-semibold text-text-primary mb-6">{title}</div>
          <div className="text-[14px] text-text-secondary leading-relaxed">{children}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-16 p-20 rounded-2xl bg-surface border border-border shadow-sm">
      <div className="text-text-secondary mt-2 shrink-0">{icon}</div>
      <div>
        <div className="text-[15px] font-semibold text-text-primary mb-6">{title}</div>
        <div className="text-[14px] text-text-secondary leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editor page
// ---------------------------------------------------------------------------

export function Editor(): React.JSX.Element {
  const { selectedTemplate } = useAppStore()

  // The firmware source passed to TopBar. When a template is active this
  // activates the Upload button; when null the button stays disabled.
  const firmwareSource = selectedTemplate?.firmware ?? undefined

  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar firmwareSource={firmwareSource}>
        {selectedTemplate ? (
          <div className="flex items-center gap-12">
            <span className="font-semibold text-white text-[14px] tracking-tight">
              {selectedTemplate.name}
            </span>
            <span className="px-8 py-2 rounded-md bg-dark-surface border border-dark-border-strong text-[11px] text-disabled uppercase tracking-wider font-mono font-bold">
              Template
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-12">
            <span className="font-semibold text-white text-[14px] tracking-tight">
              (No Project Open)
            </span>
            <span className="px-8 py-2 rounded-md bg-dark-surface border border-dark-border-strong text-[11px] text-disabled uppercase tracking-wider font-mono font-bold">
              Unsaved
            </span>
          </div>
        )}
      </TopBar>

      <div className="flex-1 flex gap-24 p-24 md:p-32 overflow-hidden w-full">
        {/* ---------------------------------------------------------------- */}
        {/* Left panel — sketch / firmware viewer                             */}
        {/* ---------------------------------------------------------------- */}
        <Panel
          className="flex-[2]"
          title={selectedTemplate ? `${selectedTemplate.name}.ino` : 'sketch.ino'}
        >
          {selectedTemplate ? (
            <ScrollContainer className="p-0 h-full">
              <pre className="p-24 text-[13px] font-mono text-text-primary leading-relaxed whitespace-pre-wrap break-words">
                {selectedTemplate.firmware}
              </pre>
            </ScrollContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-text-secondary bg-surface text-[14px]">
              <AlertCircle className="w-10 h-10 mb-16 text-disabled" />
              <div className="text-text-primary font-semibold mb-6">No code to display</div>
              <div className="max-w-[340px] text-center text-text-secondary leading-relaxed">
                Open a project or describe your idea to the Firmware Assistant to generate code.
              </div>
            </div>
          )}
        </Panel>

        {/* ---------------------------------------------------------------- */}
        {/* Right panel — Firmware Assistant                                  */}
        {/* ---------------------------------------------------------------- */}
        <Panel className="flex-1" title="Firmware Assistant">
          <ScrollContainer className="p-24 flex flex-col gap-20">
            {selectedTemplate ? (
              <>
                {/* Project Description */}
                <AssistantSection
                  icon={<Sparkles className="w-6 h-6" />}
                  title={selectedTemplate.name}
                  highlighted
                >
                  {selectedTemplate.description}
                </AssistantSection>

                {/* Components */}
                <AssistantSection icon={<Cpu className="w-6 h-6" />} title="Components">
                  <ul className="flex flex-col gap-8">
                    {selectedTemplate.components.map((component, index) => (
                      <li key={index} className="flex items-start gap-8">
                        <CheckSquare className="w-4 h-4 text-primary mt-[2px] shrink-0" />
                        <div>
                          <span className="font-medium text-text-primary">
                            {component.quantity}× {component.name}
                          </span>
                          {component.notes && (
                            <div className="text-[12px] text-text-secondary mt-2">
                              {component.notes}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </AssistantSection>

                {/* Wiring */}
                <AssistantSection icon={<Cable className="w-6 h-6" />} title="Wiring">
                  <span className="whitespace-pre-line">{selectedTemplate.wiring}</span>
                </AssistantSection>

                {/* Expected Output */}
                <AssistantSection icon={<BookOpen className="w-6 h-6" />} title="Expected Output">
                  <span className="whitespace-pre-line">{selectedTemplate.expectedOutput}</span>
                </AssistantSection>

                {/* Generated Code (placeholder — Monaco coming in future) */}
                <AssistantSection icon={<Code2 className="w-6 h-6" />} title="Generated Code">
                  Template firmware loaded. Press Upload to flash this sketch to your board.
                </AssistantSection>
              </>
            ) : (
              <>
                {/* Original placeholder sections — unchanged when no template selected */}
                <div className="flex items-start gap-16 p-20 rounded-2xl bg-surface border-2 border-primary/20 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  <Sparkles className="w-6 h-6 text-primary mt-2 shrink-0" />
                  <div>
                    <div className="text-[15px] font-semibold text-text-primary mb-6">
                      Project Description
                    </div>
                    <div className="text-[14px] text-text-secondary leading-relaxed">
                      Provide a detailed description of the IoT functionality you want to build. The
                      assistant will analyze your requirements and generate production-ready
                      firmware.
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
                    <div className="text-[15px] font-semibold text-text-primary mb-6">
                      Components
                    </div>
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
              </>
            )}
          </ScrollContainer>
        </Panel>
      </div>
    </div>
  )
}

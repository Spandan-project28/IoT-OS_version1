/**
 * Editor/index.tsx
 *
 * The Firmware Editor page — Phase 6, Slice 26.
 *
 * This page reads exclusively from `currentProjectDoc` (IProjectDocument | null).
 * It is completely agnostic to whether the active project came from a template
 * or AI generation — both origins produce identical IProjectDocument shapes and
 * are rendered through exactly the same pipeline.
 *
 * State consumed from Zustand:
 * - currentProjectDoc : IProjectDocument | null — the active project data source
 * - aiLoading         : boolean                 — true while generation is in progress
 * - aiError           : string | null            — error from last failed generation
 * - generateAiProject : action                  — the only permitted path to window.api.ai
 * - hardware          : IHardwareState           — used to derive the boardHint for the request
 *
 * Architectural rules:
 * - window.api.ai is NEVER called from this component.
 * - All AI operations flow through useAppStore.generateAiProject().
 * - No business logic lives in React. The component is a pure display layer.
 * - The Generate button is wired through Zustand, not through direct IPC.
 */

import { TopBar } from '../../components/layout/TopBar'
import { Panel } from '../../components/common/Panel'
import { ScrollContainer } from '../../components/common/ScrollContainer'
import { MonacoEditorPanel } from '../../components/editor/MonacoEditorPanel'
import { useAppStore } from '../../store/useAppStore'
import {
  Sparkles,
  Code2,
  Cpu,
  Cable,
  BookOpen,
  AlertCircle,
  CheckSquare,
  Loader2,
  XCircle
} from 'lucide-react'
import React from 'react'
import type { IAIGenerateRequest } from '@shared/types/ai'

// ---------------------------------------------------------------------------
// AssistantSection — reusable info card
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
// AssistantSectionSkeleton — loading placeholder that matches AssistantSection
// ---------------------------------------------------------------------------

function AssistantSectionSkeleton(): React.JSX.Element {
  return (
    <div className="flex items-start gap-16 p-20 rounded-2xl bg-surface border border-border shadow-sm animate-pulse">
      <div className="w-6 h-6 rounded bg-surface-elevated mt-2 shrink-0" />
      <div className="flex-1">
        <div className="h-[15px] w-32 rounded bg-surface-elevated mb-8" />
        <div className="h-[14px] w-full rounded bg-surface-elevated mb-4" />
        <div className="h-[14px] w-3/4 rounded bg-surface-elevated" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PromptInput — the AI generation form
//
// Reads aiLoading/aiError from the store. Calls generateAiProject through
// Zustand — never through window.api directly.
// ---------------------------------------------------------------------------

interface PromptInputProps {
  boardHint: IAIGenerateRequest['boardHint']
  onGenerate: (request: IAIGenerateRequest) => void
  isLoading: boolean
  error: string | null
}

function PromptInput({
  boardHint,
  onGenerate,
  isLoading,
  error
}: PromptInputProps): React.JSX.Element {
  const [prompt, setPrompt] = React.useState('')

  function handleGenerate(): void {
    const trimmed = prompt.trim()
    if (!trimmed || isLoading) return

    const request: IAIGenerateRequest = {
      prompt: trimmed,
      boardHint,
      // context is always undefined for V0.1 Generate — future operations populate it
      context: undefined
    }

    onGenerate(request)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    // Ctrl+Enter or Cmd+Enter submits the prompt
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleGenerate()
    }
  }

  const canSubmit = prompt.trim().length > 0 && !isLoading

  return (
    <div className="flex flex-col gap-12 p-20 rounded-2xl bg-surface border-2 border-primary/20 shadow-sm relative overflow-hidden">
      {/* Left accent bar — same as highlighted AssistantSection */}
      <div className="absolute top-0 left-0 w-1 h-full bg-primary" />

      {/* Header */}
      <div className="flex items-center gap-10">
        <Sparkles className="w-5 h-5 text-primary shrink-0" />
        <div className="text-[15px] font-semibold text-text-primary">Describe Your Project</div>
      </div>

      {/* Prompt textarea */}
      <textarea
        id="ai-prompt-input"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        placeholder={
          'e.g. "Blink an LED every 500ms on pin 13" or "Read temperature from DHT11 and send to Serial Monitor"'
        }
        rows={4}
        className={[
          'w-full resize-none rounded-xl px-16 py-12 text-[13px] leading-relaxed',
          'bg-background border border-border',
          'text-text-primary placeholder:text-text-secondary',
          'focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors'
        ].join(' ')}
      />

      {/* Error banner */}
      {error && !isLoading && (
        <div className="flex items-start gap-10 px-14 py-10 rounded-xl bg-error/10 border border-error/20 text-error text-[13px]">
          <XCircle className="w-4 h-4 shrink-0 mt-[1px]" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* Generate button + keyboard hint */}
      <div className="flex items-center justify-between gap-12">
        <span className="text-[11px] text-disabled font-mono hidden sm:block">
          {isLoading ? 'Generating...' : 'Ctrl+Enter to generate'}
        </span>

        <button
          id="ai-generate-btn"
          onClick={handleGenerate}
          disabled={!canSubmit}
          className={[
            'flex items-center gap-8 px-16 py-8 rounded-lg text-[13px] font-semibold',
            'transition-all duration-200',
            canSubmit
              ? 'bg-primary text-white hover:bg-primary/90 shadow-sm hover:shadow-md'
              : 'bg-surface-elevated text-disabled cursor-not-allowed border border-border'
          ].join(' ')}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Firmware
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editor page
// ---------------------------------------------------------------------------

export function Editor(): React.JSX.Element {
  const { currentProjectDoc, aiLoading, aiError, generateAiProject, hardware, updateFirmware } =
    useAppStore()

  // Derive the board hint from the connected board, if any.
  // IBoard.type is 'arduino' | 'esp32' | 'unknown'. We map it to the SupportedBoard
  // literal that PromptBuilder understands. For 'arduino' we use the FQBN to
  // distinguish Uno from Nano; unknown types produce null (generic prompt context).
  const connectedBoard = hardware.connectedBoards[0] ?? null
  let boardHint: IAIGenerateRequest['boardHint'] = null
  if (connectedBoard) {
    if (connectedBoard.type === 'esp32') {
      boardHint = 'esp32'
    } else if (connectedBoard.type === 'arduino') {
      const fqbn = connectedBoard.fqbn ?? ''
      if (fqbn.includes('nano')) {
        boardHint = 'arduino-nano'
      } else {
        // Default Arduino to Uno — the most common beginner board
        boardHint = 'arduino-uno'
      }
    }
    // 'unknown' type → boardHint stays null (PromptBuilder uses generic context)
  }

  // The firmware source passed to TopBar — activates the Upload button when present.
  // Read from currentProjectDoc so both template and AI origins activate the button.
  const firmwareSource = currentProjectDoc?.firmware ?? undefined

  // Determines the origin badge text shown beside the project title.
  const originLabel = currentProjectDoc
    ? currentProjectDoc.metadata.origin === 'ai'
      ? 'AI Generated'
      : 'Template'
    : null

  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar firmwareSource={firmwareSource}>
        {currentProjectDoc ? (
          <div className="flex items-center gap-12">
            <span className="font-semibold text-white text-[14px] tracking-tight">
              {currentProjectDoc.title}
            </span>
            {originLabel && (
              <span className="px-8 py-2 rounded-md bg-dark-surface border border-dark-border-strong text-[11px] text-disabled uppercase tracking-wider font-mono font-bold">
                {originLabel}
              </span>
            )}
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
        {/* Left panel — firmware viewer                                      */}
        {/* ---------------------------------------------------------------- */}
        <Panel
          className="flex-[2]"
          title={currentProjectDoc ? `${currentProjectDoc.title}.ino` : 'sketch.ino'}
        >
          {aiLoading ? (
            /* Loading skeleton — shown while generation is in progress */
            <div className="p-24 flex flex-col gap-12 animate-pulse">
              {[80, 60, 90, 55, 70, 40, 85, 50].map((w, i) => (
                <div
                  key={i}
                  className="h-[14px] rounded bg-surface-elevated"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          ) : currentProjectDoc ? (
            /* Firmware source — rendered from IProjectDocument regardless of origin */
            <MonacoEditorPanel
              value={currentProjectDoc.firmware}
              documentId={currentProjectDoc.id}
              onChange={updateFirmware}
            />
          ) : (
            /* Empty state — no project open */
            <div className="flex flex-col items-center justify-center h-full text-text-secondary bg-surface text-[14px]">
              <AlertCircle className="w-10 h-10 mb-16 text-disabled" />
              <div className="text-text-primary font-semibold mb-6">No code to display</div>
              <div className="max-w-[340px] text-center text-text-secondary leading-relaxed">
                Open a project from the Templates gallery, or describe your idea to the Firmware
                Assistant to generate code.
              </div>
            </div>
          )}
        </Panel>

        {/* ---------------------------------------------------------------- */}
        {/* Right panel — Firmware Assistant                                  */}
        {/* ---------------------------------------------------------------- */}
        <Panel className="flex-1" title="Firmware Assistant">
          <ScrollContainer className="p-24 flex flex-col gap-20">
            {/* Prompt input — always visible so the user can generate at any time */}
            <PromptInput
              boardHint={boardHint}
              onGenerate={generateAiProject}
              isLoading={aiLoading}
              error={aiError}
            />

            {aiLoading ? (
              /* Skeleton sections — shown while generation is in progress */
              <>
                <AssistantSectionSkeleton />
                <AssistantSectionSkeleton />
                <AssistantSectionSkeleton />
                <AssistantSectionSkeleton />
              </>
            ) : currentProjectDoc ? (
              /* Project content — rendered from currentProjectDoc regardless of origin */
              <>
                {/* Project description / title */}
                <AssistantSection
                  icon={<Sparkles className="w-6 h-6" />}
                  title={currentProjectDoc.title}
                  highlighted
                >
                  {currentProjectDoc.description}
                </AssistantSection>

                {/* Components list */}
                {currentProjectDoc.components.length > 0 && (
                  <AssistantSection icon={<Cpu className="w-6 h-6" />} title="Components">
                    <ul className="flex flex-col gap-8">
                      {currentProjectDoc.components.map((component, index) => (
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
                )}

                {/* Wiring */}
                {currentProjectDoc.wiring && (
                  <AssistantSection icon={<Cable className="w-6 h-6" />} title="Wiring">
                    <span className="whitespace-pre-line">{currentProjectDoc.wiring}</span>
                  </AssistantSection>
                )}

                {/* How it works / explanation */}
                {currentProjectDoc.explanation && (
                  <AssistantSection icon={<Code2 className="w-6 h-6" />} title="How It Works">
                    <span className="whitespace-pre-line">{currentProjectDoc.explanation}</span>
                  </AssistantSection>
                )}

                {/* Expected output */}
                <AssistantSection icon={<BookOpen className="w-6 h-6" />} title="Expected Output">
                  <span className="whitespace-pre-line">{currentProjectDoc.expectedOutput}</span>
                </AssistantSection>
              </>
            ) : (
              /* Empty state placeholder sections — no project open */
              <>
                <div className="flex items-start gap-16 p-20 rounded-2xl bg-surface border border-border shadow-sm">
                  <Code2 className="w-6 h-6 text-text-secondary mt-2 shrink-0" />
                  <div>
                    <div className="text-[15px] font-semibold text-text-primary mb-6">
                      Generated Code
                    </div>
                    <div className="text-[14px] text-text-secondary leading-relaxed">
                      Describe your project above and press Generate, or select a template from the
                      Projects gallery.
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
                      Awaiting project…
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-16 p-20 rounded-2xl bg-surface border border-border shadow-sm">
                  <Cable className="w-6 h-6 text-text-secondary mt-2 shrink-0" />
                  <div>
                    <div className="text-[15px] font-semibold text-text-primary mb-6">Wiring</div>
                    <div className="text-[14px] text-text-secondary leading-relaxed">
                      Awaiting project…
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-16 p-20 rounded-2xl bg-surface border border-border shadow-sm">
                  <BookOpen className="w-6 h-6 text-text-secondary mt-2 shrink-0" />
                  <div>
                    <div className="text-[15px] font-semibold text-text-primary mb-6">
                      Expected Output
                    </div>
                    <div className="text-[14px] text-text-secondary leading-relaxed">
                      Awaiting project…
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

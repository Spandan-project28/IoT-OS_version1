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
 * - currentProjectDoc  : IProjectDocument | null — the active project data source
 * - aiLoading          : boolean                 — true while generation is in progress
 * - aiError            : string | null            — error from last failed generation
 * - aiErrorCode        : AIErrorCode | null       — structured error code (Phase 8, Slice 35);
 *                                                    drives the "Go to Settings" link
 * - pendingAiCandidate     : IProjectDocument | null — a successful generation/improvement awaiting
 *                                                       explicit Accept/Discard (Phase 8, Slice 36);
 *                                                       never applied to currentProjectDoc automatically
 * - pendingAiCandidateMode : 'new' | 'improve' | null — which kind of candidate is pending
 *                                                        (Phase 8, Slice 37); drives whether the
 *                                                        Review card shows a diff or a summary
 * - generateAiProject      : action                  — the only permitted path to window.api.ai
 *                                                        for a fresh generation
 * - improveAiProject       : action                  — the only permitted path to window.api.ai
 *                                                        for revising the active project (Slice 37)
 * - acceptAiCandidate      : action                  — applies pendingAiCandidate to currentProjectDoc
 * - discardAiCandidate     : action                  — discards pendingAiCandidate without applying it
 * - cancelAiGeneration     : action                  — soft-cancels an in-flight generation, resetting
 *                                                        aiLoading immediately without waiting for the
 *                                                        Main process (Phase 8, Slice 39)
 * - hardware               : IHardwareState           — used to derive the boardHint for the request
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
import { IntegratedTerminal } from '../../components/terminal/IntegratedTerminal'
import { DiffEditor } from '@monaco-editor/react'
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
import { NavLink } from 'react-router-dom'
import type { IAIGenerateRequest, AIErrorCode } from '@shared/types/ai'
import type { IProjectDocument, ProjectOrigin } from '@shared/types/project'

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
      <div className="flex items-start gap-16 p-20 rounded-2xl bg-surface border-2 border-primary/20 shadow-sm relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
        <div className="text-primary mt-2 shrink-0">{icon}</div>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-text-primary mb-6">{title}</div>
          <div className="text-[14px] text-text-secondary leading-relaxed">{children}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-16 p-20 rounded-2xl bg-surface border border-border shadow-sm shrink-0">
      <div className="text-text-secondary mt-2 shrink-0">{icon}</div>
      <div className="min-w-0">
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
// ProjectDetailSections — components/wiring/how-it-works/expected-output
//
// Extracted (Phase 8, Slice 36) so the same rendering can be reused for both
// the active project (currentProjectDoc) and a pending AI candidate awaiting
// review (pendingAiCandidate) without duplicating this block. Purely
// presentational — renders identically to the previously-inline version for
// any IProjectDocument.
// ---------------------------------------------------------------------------

function ProjectDetailSections({ document }: { document: IProjectDocument }): React.JSX.Element {
  return (
    <>
      {/* Components list */}
      {document.components.length > 0 && (
        <AssistantSection icon={<Cpu className="w-6 h-6" />} title="Components">
          <ul className="flex flex-col gap-8">
            {document.components.map((component, index) => (
              <li key={index} className="flex items-start gap-8">
                <CheckSquare className="w-4 h-4 text-primary mt-[2px] shrink-0" />
                <div>
                  <span className="font-medium text-text-primary">
                    {component.quantity}× {component.name}
                  </span>
                  {component.notes && (
                    <div className="text-[12px] text-text-secondary mt-2">{component.notes}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </AssistantSection>
      )}

      {/* Wiring */}
      {document.wiring && (
        <AssistantSection icon={<Cable className="w-6 h-6" />} title="Wiring">
          <span className="whitespace-pre-line">{document.wiring}</span>
        </AssistantSection>
      )}

      {/* How it works / explanation */}
      {document.explanation && (
        <AssistantSection icon={<Code2 className="w-6 h-6" />} title="How It Works">
          <span className="whitespace-pre-line">{document.explanation}</span>
        </AssistantSection>
      )}

      {/* Expected output */}
      <AssistantSection icon={<BookOpen className="w-6 h-6" />} title="Expected Output">
        <span className="whitespace-pre-line">{document.expectedOutput}</span>
      </AssistantSection>
    </>
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
  /**
   * Called with the raw instruction text when the user submits in 'improve'
   * mode (Phase 8, Slice 37) — the only permitted path to
   * useAppStore.improveAiProject().
   */
  onImprove: (prompt: string) => void
  /**
   * True when a project is currently open. Gates whether the 'Improve' mode
   * option is offered at all (Phase 8, Slice 37) — there is nothing to
   * improve without an active project.
   */
  hasActiveProject: boolean
  /**
   * Called when the user clicks Cancel while a generation is in progress
   * (Phase 8, Slice 39) — the only permitted path to
   * useAppStore.cancelAiGeneration().
   */
  onCancel: () => void
  isLoading: boolean
  error: string | null
  /**
   * Structured error code from the last failed generation (Phase 8, Slice 35).
   * Drives the conditional "Go to Settings" link below the error banner for
   * 'not_configured' / 'invalid_api_key' — the two codes a misconfigured or
   * missing AI provider can surface.
   */
  errorCode: AIErrorCode | null
  /**
   * True while a generated candidate is pending review (Phase 8, Slice 36).
   * Distinct from isLoading — nothing is in flight, but a new generation
   * must not start until the pending candidate is accepted or discarded.
   */
  disabled: boolean
}

function PromptInput({
  boardHint,
  onGenerate,
  onImprove,
  hasActiveProject,
  onCancel,
  isLoading,
  error,
  errorCode,
  disabled
}: PromptInputProps): React.JSX.Element {
  const [prompt, setPrompt] = React.useState('')
  const [mode, setMode] = React.useState<'generate' | 'improve'>('generate')

  // The 'improve' option only ever makes sense while a project is open — if
  // it disappears mid-selection (e.g. the active project is cleared), fall
  // back to treating this submission as 'generate' rather than silently
  // no-opping through improveAiProject()'s own currentProjectDoc guard.
  const effectiveMode = hasActiveProject ? mode : 'generate'

  function handleSubmit(): void {
    const trimmed = prompt.trim()
    if (!trimmed || isLoading || disabled) return

    if (effectiveMode === 'improve') {
      onImprove(trimmed)
      return
    }

    const request: IAIGenerateRequest = {
      prompt: trimmed,
      boardHint,
      // context is always undefined for Generate — improveAiProject() populates it separately
      context: undefined
    }

    onGenerate(request)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    // Ctrl+Enter or Cmd+Enter submits the prompt
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const canSubmit = prompt.trim().length > 0 && !isLoading && !disabled

  return (
    <div className="flex flex-col gap-12 p-20 rounded-2xl bg-surface border-2 border-primary/20 shadow-sm relative overflow-hidden shrink-0">
      {/* Left accent bar — same as highlighted AssistantSection */}
      <div className="absolute top-0 left-0 w-1 h-full bg-primary" />

      {/* Header */}
      <div className="flex items-center gap-10">
        <Sparkles className="w-5 h-5 text-primary shrink-0" />
        <div className="text-[15px] font-semibold text-text-primary">Describe Your Project</div>
      </div>

      {/* Generate/Improve mode toggle — only offered when a project is open (Phase 8, Slice 37) */}
      {hasActiveProject && (
        <div className="flex items-center gap-4 p-4 rounded-lg bg-background border border-border w-fit">
          <button
            id="ai-mode-generate-btn"
            onClick={() => setMode('generate')}
            disabled={isLoading || disabled}
            aria-pressed={effectiveMode === 'generate'}
            className={[
              'px-12 py-6 rounded-md text-[12px] font-semibold transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              effectiveMode === 'generate'
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:text-text-primary'
            ].join(' ')}
          >
            Generate
          </button>
          <button
            id="ai-mode-improve-btn"
            onClick={() => setMode('improve')}
            disabled={isLoading || disabled}
            aria-pressed={effectiveMode === 'improve'}
            className={[
              'px-12 py-6 rounded-md text-[12px] font-semibold transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              effectiveMode === 'improve'
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:text-text-primary'
            ].join(' ')}
          >
            Improve
          </button>
        </div>
      )}

      {/* Prompt textarea */}
      <textarea
        id="ai-prompt-input"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading || disabled}
        placeholder={
          effectiveMode === 'improve'
            ? 'e.g. "Add a button on pin 4 that turns the LED off" or "Slow the blink down to once per second"'
            : 'e.g. "Blink an LED every 500ms on pin 13" or "Read temperature from DHT11 and send to Serial Monitor"'
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
        <div className="flex flex-col gap-8 px-14 py-10 rounded-xl bg-error/10 border border-error/20 text-error text-[13px]">
          <div className="flex items-start gap-10">
            <XCircle className="w-4 h-4 shrink-0 mt-[1px]" />
            <span className="leading-relaxed">{error}</span>
          </div>
          {(errorCode === 'not_configured' || errorCode === 'invalid_api_key') && (
            <NavLink to="/settings" className="ml-14 underline hover:no-underline w-fit">
              Go to Settings
            </NavLink>
          )}
        </div>
      )}

      {/* Generate/Improve button + keyboard hint */}
      <div className="flex items-center justify-between gap-12">
        <span className="text-[11px] text-disabled font-mono hidden sm:block">
          {isLoading
            ? effectiveMode === 'improve'
              ? 'Improving...'
              : 'Generating...'
            : effectiveMode === 'improve'
              ? 'Ctrl+Enter to improve'
              : 'Ctrl+Enter to generate'}
        </span>

        <div className="flex items-center gap-8">
          {isLoading && (
            <button
              id="ai-cancel-btn"
              onClick={onCancel}
              className="px-16 py-8 rounded-lg text-[13px] font-semibold text-text-secondary border border-border hover:text-text-primary hover:bg-border/50 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Cancel
            </button>
          )}

          <button
            id="ai-generate-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={[
              'flex items-center gap-8 px-16 py-8 rounded-lg text-[13px] font-semibold',
              'transition-all duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              canSubmit
                ? 'bg-primary text-white hover:bg-primary/90 shadow-sm hover:shadow-md'
                : 'bg-surface-elevated text-disabled cursor-not-allowed border border-border'
            ].join(' ')}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {effectiveMode === 'improve' ? 'Improving…' : 'Generating…'}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {effectiveMode === 'improve' ? 'Improve Firmware' : 'Generate Firmware'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editor page
// ---------------------------------------------------------------------------

// Exhaustive over ProjectOrigin — adding a new origin without a label here
// fails typecheck instead of silently falling through.
const ORIGIN_LABELS: Record<ProjectOrigin, string> = {
  template: 'Template',
  ai: 'AI Generated',
  manual: 'Manual'
}

export function Editor(): React.JSX.Element {
  const {
    currentProjectDoc,
    aiLoading,
    aiError,
    aiErrorCode,
    pendingAiCandidate,
    pendingAiCandidateMode,
    acceptAiCandidate,
    discardAiCandidate,
    generateAiProject,
    improveAiProject,
    cancelAiGeneration,
    hardware,
    updateFirmware
  } = useAppStore()

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
  const originLabel = currentProjectDoc ? ORIGIN_LABELS[currentProjectDoc.metadata.origin] : null

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
              onImprove={improveAiProject}
              hasActiveProject={currentProjectDoc !== null}
              onCancel={cancelAiGeneration}
              isLoading={aiLoading}
              error={aiError}
              errorCode={aiErrorCode}
              disabled={pendingAiCandidate !== null}
            />

            {aiLoading ? (
              /* Skeleton sections — shown while generation is in progress */
              <>
                <AssistantSectionSkeleton />
                <AssistantSectionSkeleton />
                <AssistantSectionSkeleton />
                <AssistantSectionSkeleton />
              </>
            ) : pendingAiCandidate ? (
              /* Pending AI candidate — awaiting explicit Accept/Discard
                 (Phase 8, Slice 36). currentProjectDoc is deliberately not
                 rendered here; the candidate has not been applied yet. */
              <>
                <AssistantSection
                  icon={<Sparkles className="w-6 h-6" />}
                  title={pendingAiCandidate.title}
                  highlighted
                >
                  {pendingAiCandidate.description}
                </AssistantSection>

                {pendingAiCandidateMode === 'improve' && currentProjectDoc ? (
                  /* Firmware diff — original (active project) vs. candidate
                     (Phase 8, Slice 37). Replaces the plain summary only for
                     'improve'-mode candidates; 'new'-mode candidates keep
                     Slice 36's unchanged ProjectDetailSections view below. */
                  <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
                    <DiffEditor
                      height="400px"
                      language="cpp"
                      theme="vs-dark"
                      original={currentProjectDoc.firmware}
                      modified={pendingAiCandidate.firmware}
                      options={{
                        readOnly: true,
                        renderSideBySide: true,
                        minimap: { enabled: false },
                        fontSize: 13
                      }}
                    />
                  </div>
                ) : (
                  <ProjectDetailSections document={pendingAiCandidate} />
                )}

                <div className="flex items-center gap-12">
                  <button
                    id="ai-candidate-accept-btn"
                    onClick={acceptAiCandidate}
                    className="flex-1 flex items-center justify-center gap-8 px-16 py-10 rounded-lg text-[13px] font-semibold bg-primary text-white hover:bg-primary/90 shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <CheckSquare className="w-4 h-4" />
                    Accept
                  </button>
                  <button
                    id="ai-candidate-discard-btn"
                    onClick={discardAiCandidate}
                    className="flex-1 flex items-center justify-center gap-8 px-16 py-10 rounded-lg text-[13px] font-semibold bg-surface-elevated text-text-primary border border-border hover:bg-border/50 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <XCircle className="w-4 h-4" />
                    Discard
                  </button>
                </div>
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

                <ProjectDetailSections document={currentProjectDoc} />
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

      <IntegratedTerminal />
    </div>
  )
}

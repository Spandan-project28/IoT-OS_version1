/**
 * Editor/index.tsx
 *
 * The Firmware Editor page — Phase 6, Slice 26. Assistant panel rewritten in
 * Phase 11 to auto-write generated firmware into Monaco and drop the
 * review/accept-discard gate — see useAppStore.ts's AI state lifecycle doc
 * comment for the full rationale.
 *
 * This page reads exclusively from `currentProjectDoc` (IProjectDocument | null).
 * It is completely agnostic to whether the active project came from a template
 * or AI generation — both origins produce identical IProjectDocument shapes and
 * are rendered through exactly the same pipeline.
 *
 * State consumed from Zustand:
 * - currentProjectDoc     : IProjectDocument | null — the active project data source
 * - aiLoading             : boolean                 — true while generation is in progress
 * - aiError               : string | null            — short failure summary (Phase 11: the
 *                                                        full technical detail lives in the
 *                                                        Integrated Terminal, never here)
 * - aiSuccessMessage      : string | null            — confirmation after a successful
 *                                                        generation/improvement (Phase 11)
 * - aiLastAppliedRevision : number                   — bumped by improveAiProject() on every
 *                                                        in-place apply; watched here to push
 *                                                        the new firmware into the live Monaco
 *                                                        model via executeEdits(), preserving
 *                                                        undo/redo
 * - generateAiProject     : action                   — the only permitted path to window.api.ai
 *                                                        for a fresh generation
 * - improveAiProject      : action                   — the only permitted path to window.api.ai
 *                                                        for revising the active project
 * - cancelAiGeneration    : action                   — soft-cancels an in-flight generation,
 *                                                        resetting aiLoading immediately without
 *                                                        waiting for the Main process
 * - hardware              : IHardwareState            — used to derive the boardHint for the request
 *
 * Architectural rules:
 * - window.api.ai is NEVER called from this component.
 * - All AI operations flow through useAppStore.generateAiProject() / improveAiProject().
 * - No business logic lives in React. The component is a pure display layer.
 * - The Generate button is wired through Zustand, not through direct IPC.
 * - The assistant panel renders ONLY: prompt input, Generate/Improve buttons,
 *   a loading indicator, and an optional success/failure message. No provider
 *   error detail is ever rendered here — see IntegratedTerminal for that.
 */

import { TopBar } from '../../components/layout/TopBar'
import { Panel } from '../../components/common/Panel'
import { ScrollContainer } from '../../components/common/ScrollContainer'
import { MonacoEditorPanel, type MonacoEditorPanelHandle } from '../../components/editor/MonacoEditorPanel'
import { IntegratedTerminal } from '../../components/terminal/IntegratedTerminal'
import { useAppStore } from '../../store/useAppStore'
import { Sparkles, AlertCircle, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import React from 'react'
import type { IAIGenerateRequest } from '@shared/types/ai'
import type { ProjectOrigin } from '@shared/types/project'

// ---------------------------------------------------------------------------
// PromptInput — the AI generation form
//
// Reads aiLoading from the store. Calls generateAiProject/improveAiProject
// through Zustand — never through window.api directly. Renders no error or
// success state itself — that lives in the Editor page, below this form,
// as a single minimal status line (Phase 11).
// ---------------------------------------------------------------------------

interface PromptInputProps {
  boardHint: IAIGenerateRequest['boardHint']
  onGenerate: (request: IAIGenerateRequest) => void
  /**
   * Called with the raw instruction text when the user submits in 'improve'
   * mode — the only permitted path to useAppStore.improveAiProject().
   */
  onImprove: (prompt: string) => void
  /**
   * True when a project is currently open. Gates whether the 'Improve' mode
   * option is offered at all — there is nothing to improve without an
   * active project.
   */
  hasActiveProject: boolean
  /**
   * Called when the user clicks Cancel while a generation is in progress —
   * the only permitted path to useAppStore.cancelAiGeneration().
   */
  onCancel: () => void
  isLoading: boolean
}

function PromptInput({
  boardHint,
  onGenerate,
  onImprove,
  hasActiveProject,
  onCancel,
  isLoading
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
    if (!trimmed || isLoading) return

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

  const canSubmit = prompt.trim().length > 0 && !isLoading

  return (
    <div className="flex flex-col gap-12 p-20 rounded-2xl bg-surface border-2 border-primary/20 shadow-sm relative overflow-hidden shrink-0">
      {/* Left accent bar */}
      <div className="absolute top-0 left-0 w-1 h-full bg-primary" />

      {/* Header */}
      <div className="flex items-center gap-10">
        <Sparkles className="w-5 h-5 text-primary shrink-0" />
        <div className="text-[15px] font-semibold text-text-primary">Describe Your Project</div>
      </div>

      {/* Generate/Improve mode toggle — only offered when a project is open */}
      {hasActiveProject && (
        <div className="flex items-center gap-4 p-4 rounded-lg bg-background border border-border w-fit">
          <button
            id="ai-mode-generate-btn"
            onClick={() => setMode('generate')}
            disabled={isLoading}
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
            disabled={isLoading}
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
        disabled={isLoading}
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
    aiSuccessMessage,
    aiLastAppliedRevision,
    generateAiProject,
    improveAiProject,
    cancelAiGeneration,
    hardware,
    updateFirmware
  } = useAppStore()

  // Imperative handle into the live Monaco model — used only to push an
  // improveAiProject() result into the SAME document (id unchanged, so
  // MonacoEditorPanel does not remount) as an undoable edit. A fresh
  // generateAiProject() result gets a new id, which remounts Monaco via
  // key={documentId} and needs no imperative call.
  const editorRef = React.useRef<MonacoEditorPanelHandle>(null)
  const lastAppliedRevisionRef = React.useRef(aiLastAppliedRevision)

  React.useEffect(() => {
    if (aiLastAppliedRevision !== lastAppliedRevisionRef.current) {
      lastAppliedRevisionRef.current = aiLastAppliedRevision
      if (currentProjectDoc) {
        editorRef.current?.replaceContent(currentProjectDoc.firmware)
      }
    }
  }, [aiLastAppliedRevision, currentProjectDoc])

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
          {aiLoading && !currentProjectDoc ? (
            /* Loading skeleton — shown only while generating a brand new
               project (no prior document to keep displaying). An improve
               in progress keeps showing the existing firmware below. */
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
              ref={editorRef}
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
        {/*                                                                    */}
        {/* Contains ONLY: prompt input, Generate/Improve/Cancel buttons, a   */}
        {/* loading indicator, and an optional success/failure message. No   */}
        {/* provider error detail is ever rendered here — see the Integrated */}
        {/* Terminal for the complete, live stream of every AI event.        */}
        {/* ---------------------------------------------------------------- */}
        <Panel className="flex-1" title="Firmware Assistant">
          <ScrollContainer className="p-24 flex flex-col gap-20">
            <PromptInput
              boardHint={boardHint}
              onGenerate={generateAiProject}
              onImprove={improveAiProject}
              hasActiveProject={currentProjectDoc !== null}
              onCancel={cancelAiGeneration}
              isLoading={aiLoading}
            />

            {aiLoading ? (
              <div className="flex items-center gap-10 px-16 py-14 rounded-xl bg-surface border border-border text-text-secondary text-[13px] shrink-0">
                <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                Generating firmware...
              </div>
            ) : aiSuccessMessage ? (
              <div className="flex items-center gap-10 px-16 py-14 rounded-xl bg-success/10 border border-success/20 text-success text-[13px] font-medium shrink-0">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {aiSuccessMessage}
              </div>
            ) : aiError ? (
              <div className="flex items-start gap-10 px-16 py-14 rounded-xl bg-error/10 border border-error/20 text-error text-[13px] shrink-0">
                <XCircle className="w-4 h-4 shrink-0 mt-[1px]" />
                <span className="leading-relaxed">
                  Generation failed.
                  <br />
                  See Integrated Terminal for details.
                </span>
              </div>
            ) : null}
          </ScrollContainer>
        </Panel>
      </div>

      <IntegratedTerminal />
    </div>
  )
}

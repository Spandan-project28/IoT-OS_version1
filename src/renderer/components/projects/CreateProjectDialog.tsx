/**
 * CreateProjectDialog
 *
 * The Create New Project dialog on the Projects page (Phase 9, Slice 4 —
 * PHASES.md bundles the "+" menu and this dialog into one slice).
 *
 * Architectural rules:
 * - Owns only its own local form state (project name, selected board),
 *   validation, keyboard shortcuts, focus management, and visual
 *   presentation — consistent with DeleteConfirmModal, the existing
 *   confirmation-dialog pattern this component matches visually.
 * - Owns NO project creation logic, persistence, or navigation. It reports
 *   exactly one validated outcome via onCreate(name, boardHint); the caller
 *   (Projects/index.tsx) is responsible for calling createManualProject()
 *   and navigating.
 * - Has no isOpen prop — the caller mounts this component only while the
 *   dialog should be visible, which guarantees every open starts from a
 *   fresh, empty form with no explicit reset logic required.
 */

import React from 'react'
import { FolderPlus, X } from 'lucide-react'
import { Button } from '../common/Button'
import type { SupportedBoard } from '@shared/types/template'

// No existing reusable enumeration of SupportedBoard values was found
// elsewhere in the repository (only per-template `boards` compatibility
// arrays, not a canonical list) — a local list is used per this slice's
// specification.
const BOARD_OPTIONS: ReadonlyArray<{ value: SupportedBoard; label: string }> = [
  { value: 'arduino-uno', label: 'Arduino Uno' },
  { value: 'arduino-nano', label: 'Arduino Nano' },
  { value: 'esp32', label: 'ESP32 DevKit V1' }
]

export interface CreateProjectDialogProps {
  /** Called when the user cancels via Cancel, the close control, Escape, or the backdrop. No project is created. */
  onCancel: () => void
  /** Called once, only when the form is valid and the user submits. `name` is trimmed and non-empty; `boardHint` is a selected board. */
  onCreate: (name: string, boardHint: SupportedBoard) => void
}

export function CreateProjectDialog({
  onCancel,
  onCreate
}: CreateProjectDialogProps): React.JSX.Element {
  const [projectName, setProjectName] = React.useState('')
  const [selectedBoard, setSelectedBoard] = React.useState<SupportedBoard | ''>('')
  const dialogRef = React.useRef<HTMLDivElement>(null)

  const isValid = projectName.trim().length > 0 && selectedBoard !== ''

  // Focus management: move focus into the dialog on mount (Project Name)
  // and trap Tab within it while mounted. Escape cancels.
  React.useEffect(() => {
    document.getElementById('create-project-name-input')?.focus()

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onCancel()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    if (!isValid) return
    onCreate(projectName.trim(), selectedBoard as SupportedBoard)
  }

  return (
    /* Overlay */
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      {/* Modal card */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-dialog-title"
        className="relative bg-dark-surface border border-dark-border rounded-2xl shadow-2xl p-24 w-full max-w-[420px] mx-16 flex flex-col gap-20"
      >
        {/* Close button */}
        <button
          type="button"
          aria-label="Cancel and close"
          onClick={onCancel}
          className="absolute top-16 right-16 text-disabled hover:text-white transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dark-surface"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon + title */}
        <div className="flex items-center gap-12">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <FolderPlus className="w-5 h-5 text-primary" />
          </div>
          <h2
            id="create-project-dialog-title"
            className="text-[16px] font-semibold text-text-primary"
          >
            Create New Project
          </h2>
        </div>

        {/* Form */}
        <form className="flex flex-col gap-16" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-6">
            <label
              htmlFor="create-project-name-input"
              className="text-[13px] font-medium text-text-primary"
            >
              Project Name
            </label>
            <input
              id="create-project-name-input"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Living Room Temperature Monitor"
              className="bg-dark-bg border border-dark-border rounded-xl px-16 py-10 text-[14px] text-white placeholder:text-disabled focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex flex-col gap-6">
            <label
              htmlFor="create-project-board-select"
              className="text-[13px] font-medium text-text-primary"
            >
              Target Board
            </label>
            <select
              id="create-project-board-select"
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value as SupportedBoard)}
              className="bg-dark-bg border border-dark-border rounded-xl px-16 py-10 text-[14px] text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="" disabled>
                Select a board
              </option>
              {BOARD_OPTIONS.map((board) => (
                <option key={board.value} value={board.value}>
                  {board.label}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-10 mt-4">
            <Button
              id="create-project-cancel-btn"
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCancel}
            >
              Cancel
            </Button>

            <Button
              id="create-project-create-btn"
              type="submit"
              variant="primary"
              size="sm"
              disabled={!isValid}
            >
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

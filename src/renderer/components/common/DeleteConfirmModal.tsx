/**
 * DeleteConfirmModal
 *
 * A focused confirmation dialog for destructive project deletion.
 *
 * Architectural rules (Phase 7, Slice 33):
 * - This component owns NO async state beyond a local isDeleting flag.
 * - Confirmation state (open/closed, which project to delete) is local React
 *   state managed by the caller — NOT in the Zustand store (Slice 33
 *   refinement: pendingDeleteProject was explicitly removed from global state).
 * - The component receives an onDelete callback from the caller. The caller
 *   is responsible for calling deleteProject() from useAppStore and passing
 *   the result through onSuccess/onError. This keeps the modal generic and
 *   avoids direct store coupling inside a common component.
 * - No business logic lives here — all side effects are delegated up.
 */

import React from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './Button'
import type { IProjectDeleteResult } from '@shared/types/project-persistence'

export interface DeleteConfirmModalProps {
  /**
   * Controls visibility. When false the modal is not mounted.
   * Managed entirely by the caller — this component is uncontrolled.
   */
  isOpen: boolean

  /**
   * The human-readable project title shown in the confirmation body.
   */
  projectTitle: string

  /**
   * Called when the user clicks Cancel or the close button.
   * The caller is responsible for resetting its own open state.
   */
  onCancel: () => void

  /**
   * Called when the user confirms deletion. The caller executes the actual
   * delete operation (deleteProject() from useAppStore) and must return the
   * typed result. The modal uses this result to call onSuccess or onError.
   */
  onDelete: () => Promise<IProjectDeleteResult>

  /**
   * Called after a successful deletion. The caller should navigate or
   * update its own state (e.g. navigate away from Editor, close modal).
   */
  onSuccess: () => void

  /**
   * Called after a failed deletion with the error message string.
   * The caller may display this in their own error presentation.
   */
  onError?: (message: string) => void
}

/**
 * DeleteConfirmModal
 *
 * Renders a modal overlay with:
 * - A warning icon and destructive-action copy
 * - The project title highlighted in the body
 * - Cancel (ghost) and Delete (destructive) action buttons
 * - A local isDeleting flag that disables both buttons during the async call
 *
 * Escape key triggers onCancel (unless a delete is in-flight).
 * Clicking the backdrop triggers onCancel.
 */
export function DeleteConfirmModal({
  isOpen,
  projectTitle,
  onCancel,
  onDelete,
  onSuccess,
  onError
}: DeleteConfirmModalProps): React.JSX.Element | null {
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Keyboard handler: Escape → cancel
  React.useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape' && !isDeleting) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isDeleting, onCancel])

  if (!isOpen) return null

  async function handleConfirmDelete(): Promise<void> {
    if (isDeleting) return

    setIsDeleting(true)

    try {
      const result = await onDelete()

      if (result.status === 'success') {
        onSuccess()
      } else {
        onError?.(result.error)
        setIsDeleting(false)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete failed unexpectedly.'
      onError?.(message)
      setIsDeleting(false)
    }
  }

  return (
    /* Overlay */
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        // Click outside the modal card → cancel (unless delete is in-flight)
        if (e.target === e.currentTarget && !isDeleting) onCancel()
      }}
    >
      {/* Modal card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-body"
        className="relative bg-dark-surface border border-dark-border rounded-2xl shadow-2xl p-24 w-full max-w-[420px] mx-16 flex flex-col gap-20"
      >
        {/* Close button */}
        <button
          type="button"
          aria-label="Cancel and close"
          disabled={isDeleting}
          onClick={onCancel}
          className="absolute top-16 right-16 text-disabled hover:text-white transition-colors disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon + title */}
        <div className="flex items-center gap-12">
          <div className="w-10 h-10 rounded-full bg-error/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-error" />
          </div>
          <h2 id="delete-modal-title" className="text-[16px] font-semibold text-text-primary">
            Delete Project?
          </h2>
        </div>

        {/* Body */}
        <p id="delete-modal-body" className="text-[13px] text-text-secondary leading-relaxed">
          <span className="font-medium text-text-primary">{projectTitle}</span> will be permanently
          deleted from disk. This action cannot be undone.
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-10">
          <Button
            id="delete-modal-cancel-btn"
            variant="ghost"
            size="sm"
            disabled={isDeleting}
            onClick={onCancel}
          >
            Cancel
          </Button>

          <Button
            id="delete-modal-confirm-btn"
            variant="destructive"
            size="sm"
            isLoading={isDeleting}
            disabled={isDeleting}
            onClick={() => void handleConfirmDelete()}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * NewProjectMenu
 *
 * The "+" action and its popup menu on the Projects page (Phase 9, Slice 4).
 *
 * Architectural rules:
 * - This component is deliberately presentation-only, mirroring TemplateCard's
 *   documented precedent — it owns no Zustand state and calls no store action.
 * - It owns only local UI state: whether the popup menu is open, keyboard
 *   navigation within it, click-outside dismissal, and focus restoration.
 * - All behaviour is delegated to the parent via onSelectCreateNew and
 *   onSelectOpenExisting. The parent (Projects/index.tsx) is responsible for
 *   calling createManualProject() / openExistingProject() and navigating.
 */

import React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../common/Button'

const MENU_ITEM_SELECTOR = '[role="menuitem"]:not([disabled])'

export interface NewProjectMenuProps {
  onSelectCreateNew: () => void
  onSelectOpenExisting: () => void
  /** Disables only the "Open Existing Project" item while a picker/open is already in flight. */
  isOpeningProject: boolean
}

export function NewProjectMenu({
  onSelectCreateNew,
  onSelectOpenExisting,
  isOpeningProject
}: NewProjectMenuProps): React.JSX.Element {
  const [isOpen, setIsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)

  function closeMenu(restoreFocus: boolean): void {
    setIsOpen(false)
    if (restoreFocus) {
      containerRef.current?.querySelector<HTMLButtonElement>(':scope > button')?.focus()
    }
  }

  // Click-outside dismissal.
  React.useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeMenu(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  // Escape dismissal + focus restoration, and initial focus on open.
  React.useEffect(() => {
    if (!isOpen) return

    const firstItem = menuRef.current?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR)
    firstItem?.focus()

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMenu(true)
        return
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = menuRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)
        if (!items || items.length === 0) return
        const currentIndex = Array.from(items).indexOf(document.activeElement as HTMLElement)
        const nextIndex =
          e.key === 'ArrowDown'
            ? (currentIndex + 1) % items.length
            : (currentIndex - 1 + items.length) % items.length
        items[nextIndex]?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  function handleCreateNewClick(): void {
    closeMenu(false)
    onSelectCreateNew()
  }

  function handleOpenExistingClick(): void {
    closeMenu(false)
    onSelectOpenExisting()
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="secondary"
        size="sm"
        className="!h-[32px] !py-0 !px-12 shrink-0 whitespace-nowrap"
        leftIcon={<Plus className="w-4 h-4" />}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="New Project"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        New
      </Button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="New Project options"
          className="absolute right-0 top-[calc(100%+4px)] z-20 w-[220px] rounded-xl border border-border bg-surface shadow-lg py-6"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-16 py-8 text-[13px] text-text-primary hover:bg-border/50 focus:outline-none focus-visible:bg-border/50"
            onClick={handleCreateNewClick}
          >
            Create New Project
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={isOpeningProject}
            className="w-full text-left px-16 py-8 text-[13px] text-text-primary hover:bg-border/50 focus:outline-none focus-visible:bg-border/50 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleOpenExistingClick}
          >
            Open Existing Project
          </button>
        </div>
      )}
    </div>
  )
}

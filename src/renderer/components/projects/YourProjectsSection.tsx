/**
 * YourProjectsSection
 *
 * The "Your Projects" section on the Projects page (Phase 9, Slice 6).
 *
 * Architectural rules:
 * - Presentation only — owns row layout, truncation, per-row "opening"
 *   spinner display, date formatting, and the empty state. Reports exactly
 *   one interaction via onSelectProject(filePath).
 * - Owns NO Zustand access, NO call to openProject(), NO navigation, NO
 *   delete/rename logic — mirrors the established "presentation-only,
 *   delegates via callback prop" convention already set by TemplateCard.tsx
 *   and NewProjectMenu.tsx for this page's satellite components.
 * - A dedicated component rather than one shared with Home.tsx's Recent
 *   Projects list (see the Slice 6 implementation report for the reasoning
 *   recorded at implementation time).
 */

import React from 'react'
import { FolderOpen, FolderClock, Loader2 } from 'lucide-react'
import { Card } from '../common/Card'
import { Badge } from '../common/Badge'
import type { IRecentProject } from '@shared/types/project-persistence'

export interface YourProjectsSectionProps {
  projects: IRecentProject[]
  /** The specific project currently being opened, for a per-row spinner. */
  openingFilePath: string | null
  /** True while any open is in flight — disables every row. */
  isOpening: boolean
  onSelectProject: (filePath: string) => void
}

/**
 * Formats an IRecentProject.savedAt ISO string for display. savedAt is
 * always present (non-optional on IRecentProject), but this still guards
 * against an unparseable value rather than risking "Invalid Date" text.
 */
function formatSavedAt(savedAt: string): string | null {
  const date = new Date(savedAt)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function YourProjectsSection({
  projects,
  openingFilePath,
  isOpening,
  onSelectProject
}: YourProjectsSectionProps): React.JSX.Element {
  if (projects.length === 0) {
    return (
      <Card className="p-32 flex flex-col items-center justify-center gap-12 text-center mb-24">
        <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center border border-border">
          <FolderClock className="w-6 h-6 text-text-secondary/60" />
        </div>
        <div>
          <div className="text-[15px] font-semibold text-text-primary">Your Projects</div>
          <div className="text-[13px] text-text-secondary mt-4 max-w-[420px]">
            You haven&apos;t saved a project yet. Create a new project or save one to see it here.
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-0 overflow-hidden mb-24">
      <div className="px-20 py-14 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-[14px] text-text-primary tracking-tight">
          Your Projects
        </h2>
        <Badge variant="default">{projects.length}</Badge>
      </div>

      <div className="divide-y divide-border">
        {projects.map((project) => {
          const savedAtLabel = formatSavedAt(project.savedAt)
          const isRowOpening = openingFilePath === project.filePath

          return (
            <button
              key={project.filePath}
              type="button"
              disabled={isOpening}
              onClick={() => onSelectProject(project.filePath)}
              className="w-full flex items-center gap-12 px-20 py-14 text-left hover:bg-surface-elevated transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {isRowOpening ? (
                <Loader2 className="w-4 h-4 shrink-0 text-text-secondary animate-spin" />
              ) : (
                <FolderOpen className="w-4 h-4 shrink-0 text-text-secondary" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-text-primary truncate">
                  {project.title}
                </div>
                <div className="flex items-center gap-8 mt-2">
                  <Badge variant="default">{project.origin}</Badge>
                  {savedAtLabel && (
                    <span className="text-[12px] text-text-secondary">Saved {savedAtLabel}</span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

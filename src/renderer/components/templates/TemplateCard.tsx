/**
 * TemplateCard.tsx
 *
 * A single project template selection card displayed in the Template Gallery
 * on the Projects page.
 *
 * Responsibilities:
 * - Render template metadata: name, difficulty, description, boards, components.
 * - Call onSelect(template) when the user clicks the card or the action button.
 * - Apply a hover elevation and primary accent border for interactive affordance.
 *
 * This component is deliberately presentation-only:
 * - It does NOT call selectTemplate() from Zustand.
 * - It does NOT navigate.
 * - All behaviour is delegated to the parent via onSelect.
 */

import React from 'react'
import { Card } from '../common/Card'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Cpu, Layers, ChevronRight } from 'lucide-react'
import type { ITemplateDefinition, TemplateDifficulty } from '@shared/types/template'

// ---------------------------------------------------------------------------
// Supporting helpers
// ---------------------------------------------------------------------------

/**
 * Maps a TemplateDifficulty to the correct Badge variant.
 * Beginner → success (green), Intermediate → warning (amber), Advanced → error (red).
 */
function difficultyVariant(difficulty: TemplateDifficulty): 'success' | 'warning' | 'error' {
  switch (difficulty) {
    case 'beginner':
      return 'success'
    case 'intermediate':
      return 'warning'
    case 'advanced':
      return 'error'
  }
}

/**
 * Maps a SupportedBoard string to a short display label.
 */
function boardLabel(board: string): string {
  switch (board) {
    case 'arduino-uno':
      return 'Uno'
    case 'arduino-nano':
      return 'Nano'
    case 'esp32':
      return 'ESP32'
    default:
      return board
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TemplateCardProps {
  template: ITemplateDefinition
  onSelect: (template: ITemplateDefinition) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateCard({ template, onSelect }: TemplateCardProps): React.JSX.Element {
  function handleSelect(): void {
    onSelect(template)
  }

  return (
    <Card
      className={[
        'p-24 flex flex-col gap-16 cursor-pointer',
        'hover:shadow-lg hover:border-primary/50 hover:-translate-y-[2px]',
        'transition-all duration-200'
      ].join(' ')}
      onClick={handleSelect}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header: name + difficulty badge                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start justify-between gap-12">
        <h3 className="text-[16px] font-semibold text-text-primary leading-tight">
          {template.name}
        </h3>
        <Badge variant={difficultyVariant(template.difficulty)} className="shrink-0 capitalize">
          {template.difficulty}
        </Badge>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Description                                                          */}
      {/* ------------------------------------------------------------------ */}
      <p className="text-[13px] text-text-secondary leading-relaxed line-clamp-3 flex-1">
        {template.description}
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* Supported boards                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap gap-6">
        {template.boards.map((board) => (
          <span
            key={board}
            className="inline-flex items-center gap-4 px-8 py-3 rounded-md bg-surface-elevated border border-border text-[11px] font-mono text-text-secondary"
          >
            <Cpu className="w-[10px] h-[10px]" />
            {boardLabel(board)}
          </span>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Footer: component count + action button                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <span className="inline-flex items-center gap-6 text-[12px] text-text-secondary">
          <Layers className="w-[13px] h-[13px]" />
          {template.components.length}{' '}
          {template.components.length === 1 ? 'component' : 'components'}
        </span>

        <Button
          variant="ghost"
          size="sm"
          rightIcon={<ChevronRight className="w-[14px] h-[14px]" />}
          className="text-primary hover:text-primary hover:!bg-primary/10 px-10"
          onClick={(e) => {
            // Prevent the card's own onClick from firing twice.
            e.stopPropagation()
            handleSelect()
          }}
        >
          Use Template
        </Button>
      </div>
    </Card>
  )
}

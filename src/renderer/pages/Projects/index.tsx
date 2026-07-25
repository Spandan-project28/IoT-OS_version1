/**
 * Projects/index.tsx
 *
 * The Project Templates Gallery page.
 *
 * Displays all entries from the static templateRegistry as a responsive grid
 * of TemplateCards. When the user selects a card:
 *   1. selectTemplate(template) is called — stores the selection in Zustand.
 *   2. navigate("/editor")       — transitions directly to the Editor page.
 *
 * No modal. No confirmation. No intermediate step.
 *
 * Architecture:
 * - Reads templateRegistry (static import — zero IPC, zero async).
 * - Writes to Zustand via selectTemplate (pure synchronous action).
 * - Uses useNavigate from react-router-dom for navigation.
 */

import { TopBar } from '../../components/layout/TopBar'
import { TemplateCard } from '../../components/templates/TemplateCard'
import { templateRegistry } from '../../domain/templates/registry'
import { useAppStore } from '../../store/useAppStore'
import { useNavigate } from 'react-router-dom'
import { Layers } from 'lucide-react'
import React from 'react'
import type { ITemplateDefinition } from '@shared/types/template'

export function Projects(): React.JSX.Element {
  const { selectTemplate } = useAppStore()
  const navigate = useNavigate()

  function handleSelectTemplate(template: ITemplateDefinition): void {
    selectTemplate(template)
    void navigate('/editor')
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar />

      <div className="flex-1 overflow-y-auto">
        <div className="p-24 md:p-32 w-full max-w-[1200px] mx-auto">
          {/* ---------------------------------------------------------------- */}
          {/* Page header                                                       */}
          {/* ---------------------------------------------------------------- */}
          <div className="flex items-center gap-12 mb-8">
            <Layers className="w-6 h-6 text-primary" />
            <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
              Project Templates
            </h1>
          </div>
          <p className="text-[14px] text-text-secondary mb-32 leading-relaxed">
            Choose a starter project and begin building immediately.
          </p>

          {/* ---------------------------------------------------------------- */}
          {/* Template Gallery grid                                             */}
          {/* ---------------------------------------------------------------- */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-20">
            {templateRegistry.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={handleSelectTemplate}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

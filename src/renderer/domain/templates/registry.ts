/**
 * registry.ts
 *
 * The static Project Template catalogue for IoTOS AI V0.1.
 *
 * Architectural rules:
 * - This module is the single source of truth for all available templates.
 * - The exported array is the complete, ordered catalogue.
 * - Templates are presented in the UI in the order they appear here.
 * - This module performs NO filtering, sorting, searching, or transformation.
 *   That logic belongs in the components that consume the registry.
 *
 * Extending the catalogue:
 *   1. Create a new template definition file in ./data/.
 *   2. Import the definition below.
 *   3. Add it to the templateRegistry array.
 *   No other files need to change.
 */

import type { ITemplateDefinition } from '@shared/types/template'
import { blinkTemplate } from './data/blink'
import { temperatureTemplate } from './data/temperature'
import { relayTemplate } from './data/relay'

/**
 * The complete, ordered catalogue of project templates available in IoTOS AI.
 *
 * Consumed by:
 * - Projects page — renders one TemplateCard per entry
 * - Zustand store — selectTemplate() maps the chosen ITemplateDefinition into currentProjectDoc
 * - Editor page   — reads currentProjectDoc.firmware to populate the code panel
 */
export const templateRegistry: ITemplateDefinition[] = [
  blinkTemplate,
  temperatureTemplate,
  relayTemplate
]

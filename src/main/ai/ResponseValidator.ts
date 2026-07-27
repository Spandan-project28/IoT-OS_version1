/**
 * ResponseValidator
 *
 * Responsible only for validating that a parsed JSON object conforms to
 * the IAIRawResponse schema.
 *
 * Architectural rules:
 * - Single responsibility: structural validation only.
 * - No parsing. Expects a pre-parsed `unknown` value from ResponseParser.
 * - No project mapping. Does not produce IProjectDocument.
 * - Narrows `unknown → IAIRawResponse | null`.
 * - Returns a typed validation result so AIService can log a meaningful
 *   error without parsing the raw text again.
 * - Never throws.
 *
 * Validation rules:
 * - Checks that all required string fields are non-empty strings.
 * - Checks that components is an array with at least one entry.
 * - Checks each component: name (string), quantity (positive integer), notes (string | null).
 * - Coerces null notes to null (LLMs sometimes emit undefined for optional fields).
 *
 * Public API:
 * - validate(parsed) → IValidationResult
 */

import type { IAIRawResponse, IAIRawComponent } from '@shared/types/ai'

// ---------------------------------------------------------------------------
// Validation result type
// ---------------------------------------------------------------------------

/**
 * The result of ResponseValidator.validate().
 *
 * On success: typed IAIRawResponse ready for AIService to map to IProjectDocument.
 * On failure: a human-readable reason for the validation failure, suitable for
 *             inclusion in an AIErrorCode 'schema_validation' IAIResult error.
 *
 * Internal to src/main/ai/ — never crosses the IPC boundary.
 */
export type IValidationResult =
  | { readonly status: 'valid'; readonly response: IAIRawResponse }
  | { readonly status: 'invalid'; readonly reason: string }

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates a parsed JSON object against the IAIRawResponse schema.
 *
 * Accepts `unknown` (the output of ResponseParser.parse()) and returns either
 * a typed IAIRawResponse or a failure reason.
 *
 * Validation is deliberately strict for required fields and lenient for
 * optional or coercible values (e.g. undefined notes → null).
 *
 * @param parsed - The parsed object from ResponseParser.parse().
 * @returns IValidationResult — never throws.
 */
function validate(parsed: unknown): IValidationResult {
  // Guard: must be a non-null object, not an array
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { status: 'invalid', reason: 'Response is not a JSON object.' }
  }

  const obj = parsed as Record<string, unknown>

  // Validate required string fields
  const stringFields = [
    'title',
    'description',
    'firmware',
    'explanation',
    'wiring',
    'expectedOutput'
  ] as const

  for (const field of stringFields) {
    const value = obj[field]
    if (typeof value !== 'string' || value.trim() === '') {
      return {
        status: 'invalid',
        reason: `Required field "${field}" is missing or empty. Got: ${JSON.stringify(value)}`
      }
    }
  }

  // Validate components array
  if (!Array.isArray(obj.components)) {
    return {
      status: 'invalid',
      reason: `Required field "components" must be an array. Got: ${JSON.stringify(obj.components)}`
    }
  }

  if (obj.components.length === 0) {
    return {
      status: 'invalid',
      reason: '"components" array must contain at least one entry.'
    }
  }

  // Validate each component
  const validatedComponents: IAIRawComponent[] = []

  for (let i = 0; i < obj.components.length; i++) {
    const item = obj.components[i] as Record<string, unknown>
    const componentResult = validateComponent(item, i)

    if (componentResult.status === 'invalid') {
      return componentResult
    }

    validatedComponents.push(componentResult.component)
  }

  // All fields validated — construct the typed response
  const response: IAIRawResponse = {
    title: (obj.title as string).trim(),
    description: (obj.description as string).trim(),
    firmware: obj.firmware as string,
    explanation: (obj.explanation as string).trim(),
    components: validatedComponents,
    wiring: (obj.wiring as string).trim(),
    expectedOutput: (obj.expectedOutput as string).trim()
  }

  return { status: 'valid', response }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

type ComponentValidationResult =
  | { readonly status: 'valid'; readonly component: IAIRawComponent }
  | { readonly status: 'invalid'; readonly reason: string }

/**
 * Validates a single component entry from the components array.
 *
 * Coercion rules:
 * - notes: undefined or null → null (both are valid "no note" values from LLMs)
 * - quantity: must be a finite positive integer; fractional values are rejected
 */
function validateComponent(
  item: Record<string, unknown>,
  index: number
): ComponentValidationResult {
  if (typeof item !== 'object' || item === null) {
    return {
      status: 'invalid',
      reason: `components[${index}] must be an object. Got: ${JSON.stringify(item)}`
    }
  }

  // Validate name
  if (typeof item.name !== 'string' || item.name.trim() === '') {
    return {
      status: 'invalid',
      reason: `components[${index}].name must be a non-empty string. Got: ${JSON.stringify(item.name)}`
    }
  }

  // Validate quantity
  if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
    return {
      status: 'invalid',
      reason: `components[${index}].quantity must be a positive integer. Got: ${JSON.stringify(item.quantity)}`
    }
  }

  // Coerce notes: undefined → null, string stays string, null stays null
  const rawNotes = item.notes
  const notes: string | null =
    rawNotes === null || rawNotes === undefined
      ? null
      : typeof rawNotes === 'string'
        ? rawNotes
        : null

  const component: IAIRawComponent = {
    name: item.name.trim(),
    quantity: item.quantity,
    notes
  }

  return { status: 'valid', component }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const ResponseValidator = Object.freeze({
  validate
})

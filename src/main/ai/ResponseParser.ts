/**
 * ResponseParser
 *
 * Responsible only for extracting a JSON object from raw LLM response text.
 *
 * Architectural rules:
 * - Single responsibility: text extraction only.
 * - No validation. Does not check field names or types.
 * - No project mapping. Does not produce IProjectDocument.
 * - Returns `unknown` — the caller (ResponseValidator) is responsible for
 *   narrowing the type to IAIRawResponse.
 * - Never throws — all errors produce a null return.
 *
 * Extraction strategy (attempted in order):
 * 1. Strip markdown code fences (```json ... ``` or ``` ... ```).
 * 2. Attempt JSON.parse on the trimmed result.
 * 3. If step 2 fails, search the raw text for the first '{' and the last '}'.
 *    This handles responses where prose precedes or follows the JSON object.
 * 4. Return null if no valid JSON object can be extracted.
 *
 * Rationale for the fallback strategy:
 * - LLMs instructed to return raw JSON sometimes wrap it in markdown fences.
 * - Some providers inject a preamble ("Sure, here is the JSON:") before the object.
 * - Handling these cases here keeps the logic testable and isolated from AIService.
 *
 * Public API:
 * - parse(rawText) → unknown | null
 */

// ---------------------------------------------------------------------------
// Regex constants
// ---------------------------------------------------------------------------

/**
 * Matches an opening markdown code fence optionally followed by a language tag.
 * Handles: ```json, ```JSON, ``` (no language), ~~~json, ~~~
 * Capture group 1: the content between the fences.
 */
const CODE_FENCE_REGEX = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i

/**
 * Alternative fence style with tildes.
 */
const TILDE_FENCE_REGEX = /^~~~(?:json)?\s*\n?([\s\S]*?)\n?~~~\s*$/i

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attempts to extract a JSON object from the raw LLM response text.
 *
 * Returns the parsed object as `unknown` on success so the caller can
 * apply type narrowing without this module knowing about IAIRawResponse.
 *
 * Returns null if:
 * - rawText is an empty string.
 * - No JSON object can be extracted by any strategy.
 * - JSON.parse throws on all attempted substrings.
 *
 * @param rawText - The raw text content from the LLM response.
 * @returns The parsed object as `unknown`, or null if extraction failed.
 */
function parse(rawText: string): unknown | null {
  if (!rawText || rawText.trim() === '') {
    return null
  }

  const trimmed = rawText.trim()

  // Strategy 1: try stripping markdown code fences first
  const fenceContent = extractFenceContent(trimmed)
  if (fenceContent !== null) {
    const parsed = tryParse(fenceContent.trim())
    if (parsed !== null) return parsed
  }

  // Strategy 2: try parsing the trimmed text directly (ideal case: LLM returned raw JSON)
  const direct = tryParse(trimmed)
  if (direct !== null) return direct

  // Strategy 3: extract from first '{' to last '}' to handle surrounding prose
  const extracted = extractJsonSubstring(trimmed)
  if (extracted !== null) {
    const parsed = tryParse(extracted)
    if (parsed !== null) return parsed
  }

  return null
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Attempts to extract content from a markdown code fence.
 * Returns the inner content string, or null if no fence is found.
 */
function extractFenceContent(text: string): string | null {
  const backtickMatch = CODE_FENCE_REGEX.exec(text)
  if (backtickMatch && backtickMatch[1] !== undefined) {
    return backtickMatch[1]
  }

  const tildeMatch = TILDE_FENCE_REGEX.exec(text)
  if (tildeMatch && tildeMatch[1] !== undefined) {
    return tildeMatch[1]
  }

  return null
}

/**
 * Attempts to find the substring from the first '{' to the last '}'.
 * Returns the extracted substring, or null if no valid range is found.
 */
function extractJsonSubstring(text: string): string | null {
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    return null
  }

  return text.slice(firstBrace, lastBrace + 1)
}

/**
 * Attempts JSON.parse on a string.
 * Returns the parsed value on success, null if JSON.parse throws.
 */
function tryParse(text: string): unknown | null {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const ResponseParser = Object.freeze({
  parse
})

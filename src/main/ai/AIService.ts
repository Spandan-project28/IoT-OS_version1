/**
 * AIService
 *
 * The single orchestration boundary for the AI Firmware Generation pipeline.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SYSTEM ARCHITECTURE FLOW  (Renderer ↔ Main process round-trip)
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   Editor (React)
 *       ↓  generateAiProject(request)      ← Zustand action
 *   Zustand (useAppStore)
 *       ↓  window.api.ai.generate(request) ← Preload bridge
 *   Preload (contextBridge)
 *       ↓  ipcRenderer.invoke('ai:generate')
 *   IPC boundary
 *       ↓  ipcMain.handle('ai:generate')   ← aiIpcHandlers.ts
 *   AIService.generate(request)            ← THIS MODULE
 *       ↓  IAIResult
 *   IPC boundary
 *       ↓  IPC response → Preload → Zustand
 *   currentProjectDoc                      ← set() atomically in store
 *       ↓
 *   Editor (React)                         ← re-renders from currentProjectDoc
 *
 * AIService is the single orchestration boundary. PromptBuilder, AIClient,
 * ResponseParser, and ResponseValidator are internal implementation details
 * of this module — the Renderer never communicates with them directly.
 * currentProjectDoc is the only object that crosses back into the Renderer
 * after a successful generation.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * INTERNAL AISERVICE FLOW  (execution sequence inside generate())
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   IAIGenerateRequest
 *       ↓  resolveProviderConfig()         ← reads env vars; never sent to Renderer
 *   IAIProviderConfig | null (mock)
 *       ↓  PromptBuilder.buildGenerate()
 *   { system, user } prompt pair
 *       ↓  AIClient.send() / MockAIClient.send()
 *   IAIClientResult (raw LLM text)
 *       ↓  ResponseParser.parse()
 *   unknown | null
 *       ↓  ResponseValidator.validate()
 *   IAIRawResponse
 *       ↓  mapToProjectDocument()          ← ONLY place this mapping occurs
 *   IProjectDocument
 *       ↓
 *   IAIResult { status: 'success', project }
 *
 * On any failure at any step: IAIResult { status: 'error', code, error }.
 * The outer try/catch is a last-resort guard — every step returns a typed
 * result rather than throwing, so this guard should never fire in practice.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Architectural rules
 * ─────────────────────────────────────────────────────────────────────────
 *
 * - Single responsibility: orchestrate the generation pipeline only.
 * - Never communicates with the Renderer, IPC, or UI directly.
 * - Never throws to callers — all errors are typed IAIResult values.
 * - IAIProviderConfig (apiKey, apiUrl, model) is never transmitted to the
 *   Renderer. The Renderer only ever receives IAIResult.
 * - Metadata (origin, createdAt, generator, provider, model) is populated
 *   here and is immutable once set (ADR-016).
 * - Chooses MockAIClient when AI_API_KEY is absent or AI_PROVIDER === 'mock'.
 *
 * Public API:
 * - generate(request) → IAIResult   (never throws)
 */

import { PromptBuilder, PROMPT_VERSION } from './PromptBuilder'
import { AIClient } from './AIClient'
import { MockAIClient } from './MockAIClient'
import { ResponseParser } from './ResponseParser'
import { ResponseValidator } from './ResponseValidator'
import { nanoid } from 'nanoid'
import type { IAIGenerateRequest, IAIProviderConfig, IAIResult } from '@shared/types/ai'
import type { IProjectDocument, IProjectMetadata } from '@shared/types/project'

// ---------------------------------------------------------------------------
// Environment variable names
// ---------------------------------------------------------------------------

const ENV_API_KEY = 'AI_API_KEY'
const ENV_API_URL = 'AI_API_URL'
const ENV_MODEL = 'AI_MODEL'
const ENV_PROVIDER = 'AI_PROVIDER'
const ENV_TIMEOUT_MS = 'AI_TIMEOUT_MS'
const ENV_TEMPERATURE = 'AI_TEMPERATURE'
const ENV_MAX_TOKENS = 'AI_MAX_TOKENS'

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_API_URL = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_TEMPERATURE = 0.2
const DEFAULT_MAX_TOKENS = 4096

// ---------------------------------------------------------------------------
// Private: provider configuration resolution
// ---------------------------------------------------------------------------

/**
 * Resolves IAIProviderConfig from environment variables.
 *
 * All values are read from process.env at call time. For V0.1 (Electron), env
 * vars are set at process start and do not change at runtime, so this is
 * equivalent to reading them once at module load.
 *
 * Returns null when AI_API_KEY is absent — signals to the caller that
 * MockAIClient should be used.
 */
function resolveProviderConfig(): IAIProviderConfig | null {
  const apiKey = process.env[ENV_API_KEY]

  if (!apiKey || apiKey.trim() === '') {
    return null
  }

  const apiUrl = (process.env[ENV_API_URL] ?? DEFAULT_API_URL).replace(/\/$/, '')
  const model = process.env[ENV_MODEL] ?? DEFAULT_MODEL
  const timeoutMs = parseEnvInt(process.env[ENV_TIMEOUT_MS], DEFAULT_TIMEOUT_MS)
  const temperature = parseEnvFloat(process.env[ENV_TEMPERATURE], DEFAULT_TEMPERATURE)
  const maxTokens = parseEnvInt(process.env[ENV_MAX_TOKENS], DEFAULT_MAX_TOKENS)

  return {
    apiKey: apiKey.trim(),
    apiUrl,
    model,
    timeoutMs,
    temperature,
    maxTokens
  }
}

/**
 * Returns the provider identifier string for inclusion in IProjectDocument.metadata.
 * Resolved from AI_PROVIDER env var, defaulting to 'openai' when not set.
 */
function resolveProviderName(usingMock: boolean): string {
  if (usingMock) return 'mock'
  return process.env[ENV_PROVIDER] ?? 'openai'
}

// ---------------------------------------------------------------------------
// Private: IProjectDocument mapping
// ---------------------------------------------------------------------------

/**
 * Maps a validated IAIRawResponse to an immutable IProjectDocument.
 *
 * This is the ONLY place this mapping occurs in the application.
 * Any change to the IProjectDocument shape requires only this function to change.
 *
 * Metadata is populated here and cannot be modified after construction (ADR-016).
 *
 * @param response  - Validated IAIRawResponse from ResponseValidator.
 * @param request   - Original IAIGenerateRequest from the Renderer.
 * @param config    - Resolved provider config, or null if using mock.
 * @param usingMock - Whether MockAIClient was used for this request.
 * @returns A new, fully-populated IProjectDocument instance.
 */
function mapToProjectDocument(
  response: import('@shared/types/ai').IAIRawResponse,
  request: IAIGenerateRequest,
  config: IAIProviderConfig | null,
  usingMock: boolean
): IProjectDocument {
  const metadata: IProjectMetadata = {
    origin: 'ai',
    createdAt: new Date().toISOString(),
    generator: `PromptBuilder v${PROMPT_VERSION}`,
    provider: resolveProviderName(usingMock),
    model: config?.model ?? DEFAULT_MODEL
  }

  const document: IProjectDocument = {
    id: nanoid(),
    schemaVersion: 1,
    title: response.title,
    description: response.description,
    firmware: response.firmware,
    explanation: response.explanation,
    components: response.components,
    wiring: response.wiring || null,
    expectedOutput: response.expectedOutput,
    boardHint: request.boardHint,
    metadata
  }

  return document
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates firmware from a natural-language prompt.
 *
 * Executes the internal AIService flow documented in the module header:
 *   resolveProviderConfig → PromptBuilder → AIClient/MockAIClient
 *   → ResponseParser → ResponseValidator → mapToProjectDocument → IAIResult
 *
 * On any failure at any step: IAIResult { status: 'error', code, error }.
 * The outer try/catch is a last-resort guard — every step returns a typed
 * result rather than throwing, so this guard should never fire in practice.
 *
 * @param request - The IAIGenerateRequest received from the Renderer via IPC.
 * @returns IAIResult — never throws.
 */
async function generate(request: IAIGenerateRequest): Promise<IAIResult> {
  try {
    // Step 1: Resolve provider configuration.
    // effectiveMock is true when:
    //   - AI_API_KEY is absent or empty (no real provider configured), OR
    //   - AI_PROVIDER is explicitly set to 'mock' (developer override).
    const config = resolveProviderConfig()
    const effectiveMock = config === null || process.env[ENV_PROVIDER] === 'mock'

    // Step 2: Build prompt
    const prompt = PromptBuilder.buildGenerate(request)

    // Step 3: Call the appropriate client.
    // MockAIClient requires a valid IAIProviderConfig signature even though it
    // ignores all fields — provide a safe placeholder when config is null.
    const clientConfig: IAIProviderConfig = config ?? {
      apiKey: '',
      apiUrl: DEFAULT_API_URL,
      model: DEFAULT_MODEL,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: DEFAULT_MAX_TOKENS
    }

    const clientResult = effectiveMock
      ? await MockAIClient.send(prompt.system, prompt.user, clientConfig)
      : await AIClient.send(prompt.system, prompt.user, clientConfig)

    if (clientResult.status === 'error') {
      return {
        status: 'error',
        code: clientResult.code,
        error: clientResult.message
      }
    }

    // Step 4: Parse the raw text
    const parsed = ResponseParser.parse(clientResult.rawText)

    if (parsed === null) {
      return {
        status: 'error',
        code: 'invalid_json',
        error:
          'The AI provider returned a response that could not be parsed as JSON. ' +
          'The model may have included unexpected formatting or exceeded the token limit.'
      }
    }

    // Step 5: Validate the parsed object
    const validation = ResponseValidator.validate(parsed)

    if (validation.status === 'invalid') {
      return {
        status: 'error',
        code: 'schema_validation',
        error:
          `The AI response was missing required fields. ${validation.reason} ` +
          'Try rephrasing your prompt with more detail about the hardware and expected behaviour.'
      }
    }

    // Step 6: Map to IProjectDocument
    const project = mapToProjectDocument(validation.response, request, config, effectiveMock)

    // Step 7: Return success
    return { status: 'success', project }
  } catch (err: unknown) {
    // Last-resort guard — should never be reached because every step above
    // returns typed results rather than throwing. Documented here for clarity.
    const message = err instanceof Error ? err.message : String(err)
    console.error('[AIService] Unexpected error in generate():', message)

    return {
      status: 'error',
      code: 'unknown',
      error:
        'An unexpected error occurred while generating firmware. ' +
        'Please try again or check the application logs for details.'
    }
  }
}

// ---------------------------------------------------------------------------
// Private utilities
// ---------------------------------------------------------------------------

/**
 * Parses an environment variable string as an integer.
 * Returns the default value if the variable is absent, empty, or not a valid integer.
 */
function parseEnvInt(value: string | undefined, defaultValue: number): number {
  if (!value || value.trim() === '') return defaultValue
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue
}

/**
 * Parses an environment variable string as a floating-point number.
 * Returns the default value if the variable is absent, empty, or not a valid number.
 */
function parseEnvFloat(value: string | undefined, defaultValue: number): number {
  if (!value || value.trim() === '') return defaultValue
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : defaultValue
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const AIService = Object.freeze({
  generate
})

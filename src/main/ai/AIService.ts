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
 *       ↓  generateAiProject(request) / improveAiProject(prompt)  ← Zustand actions
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
 *   pendingAiCandidate                     ← set() atomically in store, awaiting explicit
 *       ↓                                     Accept/Discard (Phase 8, Slice 36) — never
 *   Editor (React)                         ← currentProjectDoc directly
 *
 * AIService is the single orchestration boundary. PromptBuilder, AIClient,
 * ResponseParser, and ResponseValidator are internal implementation details
 * of this module — the Renderer never communicates with them directly.
 * A successful generation crosses back into the Renderer as a pendingAiCandidate
 * (Phase 8, Slice 36) — AIService itself has no knowledge of the review gate;
 * that decision belongs entirely to useAppStore.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * INTERNAL AISERVICE FLOW  (execution sequence inside generate())
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   IAIGenerateRequest
 *       ↓  resolveProviderConfig()         ← reads env vars; never sent to Renderer
 *   IAIProviderConfig | null (mock)
 *       ↓  PromptBuilder.buildGenerate() / buildImprove()  ← branches on context.currentFirmware
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
 * - Chooses MockAIClient when no API key is resolvable (from an environment
 *   variable or persisted settings) or AI_PROVIDER === 'mock'.
 * - Never reads SettingsService directly (Phase 8, Slice 35) — the resolved
 *   persisted settings are passed in by aiIpcHandlers.ts, the sole
 *   coordination point between the AI and Settings domains.
 *
 * Public API:
 * - generate(request, persisted) → IAIResult   (never throws)
 */

import { PromptBuilder, PROMPT_VERSION } from './PromptBuilder'
import { AIClient } from './AIClient'
import { MockAIClient } from './MockAIClient'
import { ResponseParser } from './ResponseParser'
import { ResponseValidator } from './ResponseValidator'
import { AiEventBus } from './AiEventBus'
import { nanoid } from 'nanoid'
import type { IAIGenerateRequest, IAIProviderConfig, IAIResult } from '@shared/types/ai'
import type { IProjectDocument, IProjectMetadata } from '@shared/types/project'
import type { IResolvedAiSettings } from '@shared/types/settings'

// ---------------------------------------------------------------------------
// Integrated Terminal streaming (Phase 11)
// ---------------------------------------------------------------------------

/**
 * Emits a single Integrated Terminal log entry to AiEventBus, stamped with
 * the moment it was produced. The IPC layer forwards this to the Renderer
 * in real time via the ai:log push channel — see aiIpcHandlers.ts.
 */
function emitLog(stream: 'command' | 'stdout' | 'stderr', text: string): void {
  AiEventBus.emit('ai:log', { stream, text, timestamp: Date.now() })
}

/**
 * Formats a complete technical error block for the Integrated Terminal,
 * matching the "ERROR / <message> / URL: / <url> / Body: / <body>" shape —
 * never a paraphrase, always the full provider response as received.
 */
function formatErrorBlock(message: string, url?: string, body?: string): string {
  const lines = ['ERROR', message]
  if (url) {
    lines.push('', 'URL:', url)
  }
  if (body) {
    lines.push('', 'Body:', body)
  }
  return lines.join('\n')
}

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
 * Resolves IAIProviderConfig from environment variables and/or persisted
 * settings (Phase 8, Slice 35).
 *
 * Precedence per field: environment variable (if set) → persisted setting
 * (if set) → hardcoded default. apiKey has no hardcoded default — if
 * neither an environment variable nor a persisted setting supplies one,
 * this returns null, signalling to the caller that MockAIClient should be
 * used. This preserves the pre-Slice-35 developer workflow: an environment
 * variable always takes precedence over whatever is saved in Settings.
 *
 * `persisted` is supplied by the caller (aiIpcHandlers.ts), which fetches it
 * from SettingsService — this function never reads SettingsService itself.
 *
 * timeoutMs / temperature / maxTokens remain environment-variable/default
 * only, unchanged by Slice 35 — they are not part of the persisted Settings
 * surface (see settings.ts's IResolvedAiSettings).
 */
function resolveProviderConfig(persisted: IResolvedAiSettings | null): IAIProviderConfig | null {
  const envApiKey = process.env[ENV_API_KEY]
  const apiKey =
    envApiKey && envApiKey.trim() !== '' ? envApiKey.trim() : persisted?.apiKey

  if (!apiKey) {
    return null
  }

  const apiUrl = (process.env[ENV_API_URL] ?? persisted?.apiUrl ?? DEFAULT_API_URL).replace(
    /\/$/,
    ''
  )
  const model = process.env[ENV_MODEL] ?? persisted?.model ?? DEFAULT_MODEL
  const timeoutMs = parseEnvInt(process.env[ENV_TIMEOUT_MS], DEFAULT_TIMEOUT_MS)
  const temperature = parseEnvFloat(process.env[ENV_TEMPERATURE], DEFAULT_TEMPERATURE)
  const maxTokens = parseEnvInt(process.env[ENV_MAX_TOKENS], DEFAULT_MAX_TOKENS)

  return {
    apiKey,
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
 * @param request   - The IAIGenerateRequest received from the Renderer via IPC.
 * @param persisted - The resolved persisted AI settings (Phase 8, Slice 35),
 *   fetched by aiIpcHandlers.ts from SettingsService and passed through
 *   unchanged. Null if no settings are persisted (or no key is stored) —
 *   in that case only environment variables (and the mock fallback) apply,
 *   exactly as before Slice 35.
 * @returns IAIResult — never throws.
 */
async function generate(
  request: IAIGenerateRequest,
  persisted: IResolvedAiSettings | null
): Promise<IAIResult> {
  const isImprove = !!request.context?.currentFirmware

  try {
    emitLog('command', isImprove ? 'Starting AI improvement...' : 'Starting AI generation...')

    // Step 1: Resolve provider configuration.
    // effectiveMock is true when:
    //   - Neither an environment variable nor a persisted setting supplies
    //     an API key (no real provider configured), OR
    //   - AI_PROVIDER is explicitly set to 'mock' (developer override).
    const config = resolveProviderConfig(persisted)
    const effectiveMock = config === null || process.env[ENV_PROVIDER] === 'mock'
    const providerName = resolveProviderName(effectiveMock)

    emitLog('stdout', `Provider: ${providerName}`)
    emitLog('stdout', `Model: ${config?.model ?? DEFAULT_MODEL}`)
    emitLog('stdout', `Prompt: ${request.prompt}`)

    // Step 2: Build prompt. Branches to buildImprove() when the request
    // carries existing firmware to revise (Phase 8, Slice 37) — otherwise
    // builds a fresh-generation prompt exactly as before.
    const prompt = isImprove
      ? PromptBuilder.buildImprove(request)
      : PromptBuilder.buildGenerate(request)

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

    const endpoint = `${clientConfig.apiUrl}/chat/completions`

    if (effectiveMock) {
      emitLog('stdout', 'Using local mock response (no network request).')
    } else {
      emitLog('stdout', 'Sending request...')
      emitLog('stdout', `URL: ${endpoint}`)
    }

    const requestStartedAt = Date.now()
    const clientResult = effectiveMock
      ? await MockAIClient.send(prompt.system, prompt.user, clientConfig)
      : await AIClient.send(prompt.system, prompt.user, clientConfig)
    const requestDurationMs = Date.now() - requestStartedAt

    if (clientResult.status === 'error') {
      const detail = formatErrorBlock(
        clientResult.message,
        effectiveMock ? undefined : endpoint,
        clientResult.body
      )
      emitLog('stderr', detail)
      return {
        status: 'error',
        code: clientResult.code,
        error: clientResult.message
      }
    }

    const statusPart = clientResult.httpStatus ? `HTTP ${clientResult.httpStatus}, ` : ''
    emitLog('stdout', `Response received. (${statusPart}${requestDurationMs}ms)`)

    // Step 4: Parse the raw text
    emitLog('stdout', 'Parsing firmware...')
    const parsed = ResponseParser.parse(clientResult.rawText)

    if (parsed === null) {
      const message =
        'The AI provider returned a response that could not be parsed as JSON. ' +
        'The model may have included unexpected formatting or exceeded the token limit.'
      emitLog('stderr', formatErrorBlock(message, undefined, clientResult.rawText))
      return {
        status: 'error',
        code: 'invalid_json',
        error: message
      }
    }

    // Step 5: Validate the parsed object
    emitLog('stdout', 'Validating response...')
    const validation = ResponseValidator.validate(parsed)

    if (validation.status === 'invalid') {
      const message =
        `The AI response was missing required fields. ${validation.reason} ` +
        'Try rephrasing your prompt with more detail about the hardware and expected behaviour.'
      emitLog('stderr', formatErrorBlock(message, undefined, clientResult.rawText))
      return {
        status: 'error',
        code: 'schema_validation',
        error: message
      }
    }

    // Step 6: Map to IProjectDocument
    const project = mapToProjectDocument(validation.response, request, config, effectiveMock)

    const sizeBytes = Buffer.byteLength(project.firmware, 'utf-8')
    const lineCount = project.firmware.split('\n').length
    emitLog(
      'stdout',
      `Firmware generation completed. Generated "${project.title}" (${sizeBytes} bytes, ${lineCount} lines).`
    )

    // Step 7: Return success
    return { status: 'success', project }
  } catch (err: unknown) {
    // Last-resort guard — should never be reached because every step above
    // returns typed results rather than throwing. Documented here for clarity.
    const message = err instanceof Error ? err.message : String(err)
    console.error('[AIService] Unexpected error in generate():', message)
    emitLog('stderr', formatErrorBlock(message))

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

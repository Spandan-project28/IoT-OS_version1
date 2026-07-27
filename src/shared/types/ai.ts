/**
 * ai.ts
 *
 * Shared type definitions for the AI Firmware Generation domain.
 *
 * Intentionally separated from hardware.ts, upload.ts, serial.ts, template.ts,
 * and project.ts to keep each domain self-contained as domains are introduced
 * across phases.
 *
 * These types define the contract between:
 * - The Renderer (sends IAIGenerateRequest via IPC invoke)
 * - AIService    (resolves the request, returns IAIResult)
 * - The Zustand store (stores IAIResult fields in renderer state)
 *
 * Architectural rules:
 * - IAIRawResponse is an internal type. It must never cross the IPC boundary.
 *   AIService maps IAIRawResponse → IProjectDocument before returning IAIResult.
 * - The Renderer always receives IAIResult, never IAIRawResponse.
 * - IAIProviderConfig is a Main-process-only type. It must never be transmitted
 *   to or accessible by the Renderer. The Renderer never knows which provider
 *   or model was used — it only sees IAIResult.
 * - AIErrorCode allows callers to branch on error category without parsing the
 *   error string. This mirrors UploadErrorCode and SerialErrorCode conventions.
 *
 * Consumers (V0.1):
 * - AIService           (Main process — receives IAIGenerateRequest, returns IAIResult)
 * - aiIpcHandlers       (Slice 24 — serialises IAIGenerateRequest and IAIResult over IPC)
 * - Zustand store       (Slice 25 — stores IAIResult.project in currentProject)
 * - Editor page         (Slice 26 — calls generateAiFirmware, reads aiLoading / aiError)
 *
 * Future consumers (out of scope for V0.1):
 * - ImproveService      (future — sends IAIGenerateRequest with context.currentFirmware populated)
 * - SettingsService     (future — persists and restores IAIProviderConfig from disk)
 */

import type { IProjectDocument } from './project'
import type { SupportedBoard } from './template'

// ---------------------------------------------------------------------------
// Request types (Renderer → Main via IPC invoke)
// ---------------------------------------------------------------------------

/**
 * Optional context provided to the AI alongside the user's prompt.
 *
 * Populated by future AI operations (Improve, Debug, Explain, Refactor, etc.).
 * V0.1 Generate always leaves context undefined — the field exists now to
 * ensure the IPC contract does not need to change when those operations land.
 *
 * Design intent (approved in architecture review):
 * - Adding context? now does not implement any future feature.
 * - It is an optional field that V0.1 always sends as undefined.
 * - Without it, a future ai:improve channel would require a separate request
 *   type or a breaking IPC contract change.
 * - With it, all future operations share the same ai:generate channel
 *   by populating context appropriately.
 */
export interface IAIGenerateContext {
  /**
   * The current firmware in the editor at the time of the request.
   *
   * Populated by Improve, Debug, Refactor, Optimize, Translate, and Review.
   * Undefined for initial Generate (no existing firmware to improve).
   */
  readonly currentFirmware?: string

  /**
   * The current AI-generated explanation displayed in the assistant panel.
   *
   * Populated when the operation benefits from knowing the previous explanation
   * (e.g. Explain might refine an existing one rather than starting fresh).
   * Undefined when no previous explanation exists.
   */
  readonly currentExplanation?: string
}

/**
 * Input contract for the ai:generate IPC invoke channel.
 *
 * Naming is intentionally generic — not specific to any single AI operation —
 * to accommodate future operations (Improve, Explain, Debug) without changing
 * the IPC contract.
 *
 * This type is serialised across the IPC boundary. All fields must be
 * JSON-serialisable (no functions, no class instances, no Promises).
 */
export interface IAIGenerateRequest {
  /**
   * The natural-language prompt describing the firmware to generate.
   *
   * For Generate: the user's raw input (e.g. 'Blink an LED every 500ms')
   * For future Improve: instruction describing the improvement to make
   * For future Explain: a request for explanation (can be an empty string
   *   with context.currentFirmware provided to trigger explanation mode)
   */
  readonly prompt: string

  /**
   * Target board hint provided by the Renderer.
   *
   * The Main process uses this to include board-specific context in the
   * system prompt (FQBN, chip family, available memory, etc.).
   * Null when no board is connected or the user has not selected one.
   */
  readonly boardHint: SupportedBoard | null

  /**
   * Optional context from the current editor state.
   *
   * Always undefined in V0.1 Generate. Populated by future operations.
   * Undefined when context is not applicable to the current operation.
   */
  readonly context?: IAIGenerateContext
}

// ---------------------------------------------------------------------------
// Provider configuration
//
// Main-process-only type. Never transmitted to or accessible by the Renderer.
// Resolved from environment variables at application startup by AIService.
// ---------------------------------------------------------------------------

/**
 * Configuration for the active AI provider.
 *
 * Resolved once from environment variables and used for every generation request.
 * All fields are required — AIService validates their presence and falls back
 * to MockAIClient if required fields are absent.
 *
 * Supported providers (all use the OpenAI chat completions format):
 * - OpenAI      — api.openai.com/v1
 * - OpenRouter  — openrouter.ai/api/v1
 * - Ollama      — localhost:11434/v1
 * - LM Studio   — localhost:1234/v1
 * - Gemini      — generativelanguage.googleapis.com/v1beta/openai (compat endpoint)
 *
 * Main-process-only: never exposed to the Renderer via preload or IPC.
 *
 * Environment variables:
 * - AI_API_KEY      → apiKey
 * - AI_API_URL      → apiUrl
 * - AI_MODEL        → model
 * - AI_TIMEOUT_MS   → timeoutMs   (default: 30000)
 * - AI_TEMPERATURE  → temperature (default: 0.2)
 * - AI_MAX_TOKENS   → maxTokens   (default: 4096)
 * - AI_PROVIDER     → (resolved separately by AIService for mock selection)
 */
export interface IAIProviderConfig {
  /**
   * API key for authenticating with the provider.
   *
   * Sent as 'Authorization: Bearer <apiKey>' on every request.
   * Never logged, never transmitted to the Renderer.
   */
  readonly apiKey: string

  /**
   * Base URL for the provider's OpenAI-compatible chat completions endpoint.
   *
   * AIClient appends '/chat/completions' to this value.
   * Must not have a trailing slash.
   *
   * Examples:
   * - 'https://api.openai.com/v1'
   * - 'http://localhost:11434/v1'
   * - 'https://openrouter.ai/api/v1'
   */
  readonly apiUrl: string

  /**
   * The model identifier to pass in the chat completions request body.
   *
   * Must exactly match the provider's model identifier.
   *
   * Examples: 'gpt-4o', 'gpt-4o-mini', 'llama3.1', 'gemini-1.5-pro'
   */
  readonly model: string

  /**
   * Maximum time in milliseconds to wait for a response before aborting.
   *
   * AIClient uses AbortController with this value. The abort fires in a
   * setTimeout cleared in the finally block — no timeout leak is possible.
   *
   * Default: 30000 (30 seconds)
   * Increase for slow local models (Ollama, LM Studio).
   */
  readonly timeoutMs: number

  /**
   * Sampling temperature for the LLM response.
   *
   * Controls the probability distribution over tokens:
   * - 0.0 → fully deterministic (same prompt produces identical output)
   * - 1.0 → highly varied (creative but potentially inconsistent)
   *
   * For firmware generation, predictable and compilable output is required.
   * Default: 0.2 (consistent output with slight variation for naturalness)
   *
   * Configurable because some providers/models have different optimal ranges.
   */
  readonly temperature: number

  /**
   * Maximum number of tokens to generate in the response.
   *
   * Firmware + explanation + wiring + components can produce 1500–3000 tokens.
   * Without a configured limit, some providers default to 256–512 tokens,
   * silently truncating the response mid-JSON — mapping to schema_validation error.
   *
   * Default: 4096
   * Increase for complex projects with verbose wiring or long component lists.
   */
  readonly maxTokens: number
}

// ---------------------------------------------------------------------------
// Internal LLM response schema
//
// IAIRawResponse is the shape AIService expects to parse and validate from
// the raw LLM output string. It is an internal type that:
// - ResponseParser.parse() produces (as unknown | null)
// - ResponseValidator.validate() narrows to (IAIRawResponse | null)
// - AIService maps to IProjectDocument (the only mapping site)
//
// It must never cross the IPC boundary. The Renderer never sees this type.
// ---------------------------------------------------------------------------

/**
 * A single component entry in the raw LLM response.
 *
 * Matches the ITemplateComponent shape so AIService can copy it directly
 * into IProjectDocument.components without transformation.
 *
 * ResponseValidator checks:
 * - name is a non-empty string
 * - quantity is a positive integer
 * - notes is a string or null
 */
export interface IAIRawComponent {
  readonly name: string
  readonly quantity: number
  readonly notes: string | null
}

/**
 * The expected schema of the parsed JSON object from the LLM response.
 *
 * AIService instructs the LLM (via PromptBuilder) to return this exact shape.
 * ResponseValidator validates every field before AIService maps it to IProjectDocument.
 *
 * Internal type — never transmitted outside src/main/ai/.
 * Future additions: add optional fields here first, then update ResponseValidator
 * and the AIService mapping without changing the IPC contract.
 */
export interface IAIRawResponse {
  /** Project title derived from the user's prompt */
  readonly title: string
  /** Beginner-friendly explanation of what the firmware does */
  readonly description: string
  /** Complete, compilable Arduino/ESP32 firmware source code */
  readonly firmware: string
  /** How-it-works explanation of the firmware logic */
  readonly explanation: string
  /** Physical components required, in order of importance */
  readonly components: IAIRawComponent[]
  /** Step-by-step wiring instructions in plain language */
  readonly wiring: string
  /** Description of expected hardware behaviour and Serial Monitor output */
  readonly expectedOutput: string
}

// ---------------------------------------------------------------------------
// Error codes
//
// Follows the UploadErrorCode and SerialErrorCode convention from upload.ts
// and serial.ts. Callers branch on the code without parsing the error string.
// ---------------------------------------------------------------------------

/**
 * Structured error codes for AI generation failures.
 *
 * Allows callers (IPC, Zustand, UI) to branch on error category without
 * parsing the user-facing message string.
 *
 * - invalid_api_key   — provider rejected the API key (HTTP 401 / 403)
 * - rate_limit        — provider rate limit exceeded (HTTP 429)
 * - timeout           — request exceeded IAIProviderConfig.timeoutMs
 * - network_error     — fetch() failed before a response was received
 * - invalid_json      — ResponseParser could not extract valid JSON from the response
 * - schema_validation — ResponseValidator found the parsed JSON did not match IAIRawResponse
 * - provider_error    — provider returned a non-200 HTTP status not covered above
 * - not_configured    — required provider configuration (API key / URL) is absent
 * - unknown           — catch-all for unexpected errors not covered by the codes above
 */
export type AIErrorCode =
  | 'invalid_api_key' //   HTTP 401 or 403 from provider
  | 'rate_limit' //         HTTP 429 — request quota exceeded
  | 'timeout' //            AbortController fired before response received
  | 'network_error' //      fetch() rejected before HTTP response
  | 'invalid_json' //       ResponseParser found no valid JSON in LLM output
  | 'schema_validation' //  ResponseValidator found missing or wrong-typed fields
  | 'provider_error' //     non-200 HTTP status not covered by specific codes above
  | 'not_configured' //     AI_API_KEY or AI_API_URL absent; mock was used as fallback
  | 'unknown' //            unexpected error with no matching category

// ---------------------------------------------------------------------------
// Result types
//
// Follows the discriminated union convention from ICompileResult, IUploadResult,
// and ISerialResult. Callers branch on `status` without casting.
// ---------------------------------------------------------------------------

/**
 * Result of AIService.generate() and the ai:generate IPC invoke channel.
 *
 * On success:
 * - project carries the fully constructed, immutable IProjectDocument.
 * - The Zustand store replaces currentProject with project atomically.
 *
 * On error:
 * - code identifies the error category for UI branching.
 * - error is a user-friendly message suitable for display.
 *   It never contains stack traces, raw LLM output, or API keys.
 *
 * This type is serialised across the IPC boundary. Both variants must be
 * JSON-serialisable — IProjectDocument is a plain object with no class instances.
 */
export type IAIResult =
  | {
      readonly status: 'success'
      /** The fully constructed, immutable project document */
      readonly project: IProjectDocument
    }
  | {
      readonly status: 'error'
      /** Structured error category for UI branching without string parsing */
      readonly code: AIErrorCode
      /** User-friendly error message. Never contains implementation details. */
      readonly error: string
    }

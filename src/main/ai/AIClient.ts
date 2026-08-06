/**
 * AIClient
 *
 * Responsible only for performing the HTTP request to an OpenAI-compatible
 * chat completions endpoint.
 *
 * Architectural rules:
 * - Single responsibility: HTTP call only.
 * - No parsing logic. No validation logic. No project mapping.
 * - Returns raw response text — the caller is responsible for parsing.
 * - Uses native fetch() (available in Node.js 18+ and Electron's renderer runtime).
 * - Uses AbortController for timeout management. The timeout is always cleared in
 *   a finally block — no timeout leak is possible.
 * - Never throws to callers — all errors are returned as typed IAIClientResult values.
 * - Timeout is configurable via IAIProviderConfig.timeoutMs (not a hard-coded constant).
 * - The Authorization header is the only place the API key is used — it is never
 *   logged, never stored in a result, and never transmitted to the Renderer.
 *
 * Provider compatibility:
 * - All providers using the OpenAI chat completions format are supported by
 *   configuring apiUrl and apiKey in IAIProviderConfig.
 * - OpenAI:      api.openai.com/v1
 * - OpenRouter:  openrouter.ai/api/v1
 * - Ollama:      localhost:11434/v1
 * - LM Studio:   localhost:1234/v1
 * - Gemini:      generativelanguage.googleapis.com/v1beta/openai  (compat endpoint)
 *
 * Public API:
 * - send(system, user, config) → IAIClientResult
 */

import type { IAIProviderConfig } from '@shared/types/ai'

// ---------------------------------------------------------------------------
// Internal result type
//
// Not exported from the ai barrel — it is only consumed by AIService, which
// unwraps the result and maps it to IAIResult.
// ---------------------------------------------------------------------------

/**
 * The result of an AIClient.send() call.
 *
 * On success: the raw text response from the LLM (not yet parsed or validated).
 * On error:   a structured error code and user-facing message.
 *
 * Internal to src/main/ai/ — never crosses the IPC boundary.
 */
export type IAIClientResult =
  | { readonly status: 'success'; readonly rawText: string; readonly httpStatus?: number }
  | {
      readonly status: 'error'
      readonly code: AIClientErrorCode
      readonly message: string
      /** HTTP status code, present only when a response was actually received. */
      readonly httpStatus?: number
      /** Raw response body text, present only when a response was actually received. */
      readonly body?: string
    }

/**
 * Error codes for AIClient.send() failures.
 *
 * A subset of the full AIErrorCode union in ai.ts — AIService maps these to
 * the canonical AIErrorCode values when constructing IAIResult.
 */
export type AIClientErrorCode =
  | 'timeout' //         AbortController fired before response received
  | 'network_error' //   fetch() rejected (e.g. DNS failure, connection refused)
  | 'invalid_api_key' // HTTP 401 or 403 returned by provider
  | 'rate_limit' //      HTTP 429 returned by provider
  | 'provider_error' //  any other non-200 HTTP status

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Performs a single chat completions request to the configured provider.
 *
 * Request format:
 * - POST {config.apiUrl}/chat/completions
 * - Content-Type: application/json
 * - Authorization: Bearer {config.apiKey}
 * - Body: { model, messages: [{role: 'system', content: system}, {role: 'user', content: user}],
 *            temperature, max_tokens }
 *
 * Timeout behaviour:
 * - AbortController fires after config.timeoutMs milliseconds.
 * - The setTimeout ID is cleared in a finally block whether the fetch succeeds or fails.
 *   No timer can leak if the function exits for any reason.
 *
 * @param system - The system prompt from PromptBuilder.buildGenerate().system
 * @param user   - The user prompt from PromptBuilder.buildGenerate().user
 * @param config - Provider configuration resolved by AIService from env vars.
 * @returns IAIClientResult — never throws.
 */
async function send(
  system: string,
  user: string,
  config: IAIProviderConfig
): Promise<IAIClientResult> {
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    // Set up timeout — cleared in finally whether we succeed or fail
    timeoutId = setTimeout(() => {
      controller.abort()
    }, config.timeoutMs)

    const endpoint = `${config.apiUrl}/chat/completions`

    const body = JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens
    })

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body,
      signal: controller.signal
    })

    if (!response.ok) {
      const code = httpStatusToErrorCode(response.status)
      const statusText = response.statusText || String(response.status)
      let bodyText = ''
      try {
        bodyText = await response.text()
      } catch {
        // Body already consumed or unreadable — proceed without it.
      }
      return {
        status: 'error',
        code,
        message: `Provider returned HTTP ${response.status}: ${statusText}`,
        httpStatus: response.status,
        body: bodyText
      }
    }

    const responseText = await response.text()
    const json = responseText
      ? (JSON.parse(responseText) as { choices?: { message?: { content?: string } }[] })
      : {}
    const rawText = json?.choices?.[0]?.message?.content ?? ''

    if (!rawText) {
      return {
        status: 'error',
        code: 'provider_error',
        message:
          'Provider returned an empty response. The model may not have generated any content.',
        httpStatus: response.status,
        body: responseText
      }
    }

    return { status: 'success', rawText, httpStatus: response.status }
  } catch (err: unknown) {
    // AbortController.abort() causes fetch to throw a DOMException with name 'AbortError'
    if (isAbortError(err)) {
      return {
        status: 'error',
        code: 'timeout',
        message: `Request timed out after ${config.timeoutMs}ms. The provider took too long to respond.`
      }
    }

    const message = err instanceof Error ? err.message : String(err)
    return {
      status: 'error',
      code: 'network_error',
      message: `Network error: ${message}`
    }
  } finally {
    // Always clear the timer — prevents a leaked setTimeout after the Promise settles
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Maps an HTTP status code to the most appropriate AIClientErrorCode.
 */
function httpStatusToErrorCode(status: number): AIClientErrorCode {
  if (status === 401 || status === 403) return 'invalid_api_key'
  if (status === 429) return 'rate_limit'
  return 'provider_error'
}

/**
 * Returns true if the error is an AbortError thrown by the Fetch API when
 * AbortController.abort() is called.
 *
 * Node.js and browser environments both name the error 'AbortError'.
 * The DOMException check is a belt-and-suspenders guard for Node.js 18+ environments.
 */
function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AbortError') return true
  // Node.js fetch throws a plain Error with name 'AbortError' in some versions
  if (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError') {
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const AIClient = Object.freeze({
  send
})

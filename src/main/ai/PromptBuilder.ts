/**
 * PromptBuilder
 *
 * Responsible only for constructing AI prompts from IAIGenerateRequest.
 *
 * Architectural rules:
 * - Pure module. No network, no parsing, no validation, no side effects.
 * - No imports beyond shared types.
 * - All functions are deterministic: identical input produces identical output.
 * - PROMPT_VERSION allows future prompt changes to be tracked in project metadata.
 *   Increment PROMPT_VERSION when the system or user prompt template changes in a
 *   way that would produce materially different output from the same request.
 *
 * Future methods (out of scope for V0.1):
 * - buildImprove(request)  — wraps existing firmware with improvement instructions
 * - buildExplain(request)  — asks for a code walkthrough of existing firmware
 * - buildDebug(request)    — asks for diagnosis of a reported problem
 *
 * Public API:
 * - buildGenerate(request) → { system, user }  (constructs a generate prompt pair)
 * - PROMPT_VERSION         → number            (current prompt schema version)
 */

import type { IAIGenerateRequest } from '@shared/types/ai'

// ---------------------------------------------------------------------------
// Prompt version
//
// Recorded in IProjectDocument.metadata.generator by AIService.
// Increment this constant when the prompt template changes in a way that
// would produce materially different firmware from the same user request.
// ---------------------------------------------------------------------------

/**
 * The current version of the PromptBuilder prompt template.
 *
 * Stored in IProjectDocument.metadata.generator as "PromptBuilder v{PROMPT_VERSION}".
 * Allows future debugging: if a generated project is incorrect, the generator
 * version recorded in metadata identifies which prompt produced it.
 *
 * V0.1 initial value: 1.
 */
export const PROMPT_VERSION = 1

// ---------------------------------------------------------------------------
// Board context helpers
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable description of the target board for inclusion in
 * the system prompt. Gives the LLM accurate technical context so it can
 * generate board-appropriate firmware (correct pin numbers, libraries, etc.).
 *
 * Returns a generic description when boardHint is null (no board connected).
 */
function boardContext(boardHint: IAIGenerateRequest['boardHint']): string {
  switch (boardHint) {
    case 'arduino-uno':
      return (
        'Target board: Arduino Uno (ATmega328P, 5V, 14 digital pins, 6 analog pins, ' +
        '32KB flash, 2KB SRAM, FQBN: arduino:avr:uno). ' +
        'Use Arduino standard library (Arduino.h). Do not use ESP32-specific APIs.'
      )
    case 'arduino-nano':
      return (
        'Target board: Arduino Nano (ATmega328P, 5V, 14 digital pins, 8 analog pins, ' +
        '32KB flash, 2KB SRAM, FQBN: arduino:avr:nano). ' +
        'Use Arduino standard library (Arduino.h). Do not use ESP32-specific APIs.'
      )
    case 'esp32':
      return (
        'Target board: ESP32 DevKit V1 (Xtensa LX6 dual-core, 3.3V logic, 240MHz, ' +
        '30 I/O pins, built-in WiFi + Bluetooth, 4MB flash, 320KB SRAM, ' +
        'FQBN: esp32:esp32:esp32). ' +
        'Use ESP32 Arduino Core libraries. analogWrite() is not available on ESP32 — ' +
        'use ledcWrite() for PWM. Pin 2 is the onboard LED.'
      )
    case null:
    default:
      return (
        'Target board: unspecified. Generate firmware compatible with Arduino Uno ' +
        'using the Arduino standard library (Arduino.h) as a safe default. ' +
        'Do not use ESP32-specific APIs.'
      )
  }
}

// ---------------------------------------------------------------------------
// JSON response schema description
//
// Embedded inline in the system prompt so the LLM knows exactly what shape
// to produce. Kept as a function to allow future parameterisation by operation.
// ---------------------------------------------------------------------------

/**
 * Returns the JSON schema description embedded in the system prompt.
 * Defines every field the LLM must include in its response.
 */
function jsonSchema(): string {
  return `{
  "title": "string — concise project title derived from the user request",
  "description": "string — one or two sentences describing what the project does, written for a beginner",
  "firmware": "string — complete, compilable Arduino/ESP32 sketch source code with setup() and loop()",
  "explanation": "string — beginner-friendly explanation of how the firmware works, paragraph form",
  "components": [
    {
      "name": "string — human-readable component name (e.g. 'LED', 'DHT11 Sensor')",
      "quantity": "integer — number of this component required",
      "notes": "string or null — optional assembly note (e.g. '220Ω resistor in series'), null if none"
    }
  ],
  "wiring": "string — step-by-step wiring instructions in plain language, one step per line",
  "expectedOutput": "string — description of what the user will observe after a successful upload"
}`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The output of PromptBuilder — a system/user message pair ready for the
 * OpenAI-compatible chat completions API.
 */
export interface IAIPrompt {
  /** System instruction that sets the LLM's role and response format */
  readonly system: string
  /** User message carrying the specific request */
  readonly user: string
}

/**
 * Constructs a system + user prompt pair for firmware generation.
 *
 * The system prompt:
 * - Establishes the LLM as an embedded systems firmware expert.
 * - Specifies the target board with technical accuracy.
 * - Instructs the LLM to respond with valid JSON matching the defined schema.
 * - Prohibits prose, markdown wrappers, and explanations outside JSON.
 *
 * The user prompt:
 * - Carries the natural-language request from the user.
 * - Appends context (current firmware) when provided for future Improve operations.
 *
 * @param request - The generate request from the Renderer via IPC.
 * @returns A { system, user } pair ready to pass to AIClient.send().
 */
function buildGenerate(request: IAIGenerateRequest): IAIPrompt {
  const board = boardContext(request.boardHint)
  const schema = jsonSchema()

  const system = [
    'You are an expert embedded systems firmware engineer specialising in Arduino and ESP32 development.',
    'Your responses help beginners build real hardware projects.',
    '',
    board,
    '',
    'Your task: generate complete, compilable firmware and supporting documentation.',
    '',
    'RESPONSE FORMAT:',
    'Respond with ONLY a single valid JSON object. No markdown, no code fences, no prose outside JSON.',
    'The JSON object must match this exact schema:',
    schema,
    '',
    'FIRMWARE REQUIREMENTS:',
    '- Include both setup() and loop() functions.',
    '- Add inline comments explaining each meaningful line.',
    '- Use only libraries available in the standard Arduino IDE or the specified board core.',
    '- Do not use placeholder functions — all code must compile and run.',
    '- Keep the code beginner-readable: prefer clear variable names over terse code.',
    '',
    'COMPONENTS REQUIREMENTS:',
    '- List every physical component the user must connect.',
    '- Include resistors, capacitors, and power rails if required.',
    '- Use common beginner-friendly component names.',
    '',
    'WIRING REQUIREMENTS:',
    '- Write one concrete wiring step per line.',
    '- Use pin numbers matching the target board exactly.',
    '- Assume the user has only a breadboard, jumper wires, and the listed components.'
  ].join('\n')

  // Build the user message, appending context when present
  const userParts: string[] = [request.prompt.trim()]

  if (request.context?.currentFirmware) {
    userParts.push('')
    userParts.push('Current firmware (for context):')
    userParts.push('```')
    userParts.push(request.context.currentFirmware)
    userParts.push('```')
  }

  if (request.context?.currentExplanation) {
    userParts.push('')
    userParts.push('Current explanation (for context):')
    userParts.push(request.context.currentExplanation)
  }

  const user = userParts.join('\n')

  return { system, user }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const PromptBuilder = Object.freeze({
  buildGenerate
})

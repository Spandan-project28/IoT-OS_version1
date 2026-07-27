/**
 * MockAIClient
 *
 * A deterministic test double for AIClient.
 *
 * Architectural rules:
 * - Implements the identical calling convention as AIClient.send().
 * - Returns a valid IAIRawResponse JSON string — no internal marker fields.
 * - No _isMock, no test-only flags, no contamination of the data contract.
 * - If logging is needed, log inside send() before returning — not via a field
 *   that AIService would have to strip.
 * - AIService is completely unaware that a mock was used; it processes the
 *   returned JSON through the same ResponseParser → ResponseValidator pipeline
 *   as a real provider response.
 * - Returns a JSON string (not a parsed object) to exercise the full pipeline.
 *
 * Selection: AIService chooses MockAIClient when AI_API_KEY is absent or
 * AI_PROVIDER is set to 'mock'. The selection is documented in the returned
 * IAIResult.project.metadata.provider field ('mock').
 *
 * Public API:
 * - send(system, user, config) → IAIClientResult   (always succeeds)
 */

import type { IAIProviderConfig, IAIRawResponse } from '@shared/types/ai'
import type { IAIClientResult } from './AIClient'

// ---------------------------------------------------------------------------
// Mock response data
//
// Represents a complete, valid IAIRawResponse for a "Blink LED" project.
// Chosen as the mock because:
// - It is the simplest complete Arduino project (every beginner knows it).
// - It exercises all fields in IAIRawResponse including components and wiring.
// - The firmware is compilable on all supported boards with zero modification.
// - It validates the full parsing and mapping pipeline on every invocation.
// ---------------------------------------------------------------------------

/**
 * The mock firmware response object.
 *
 * Must remain valid against the IAIRawResponse type. If IAIRawResponse fields
 * change, update this object to match — the TypeScript type annotation below
 * enforces this at compile time.
 */
const MOCK_RESPONSE: IAIRawResponse = {
  title: 'Blink LED (Mock)',
  description:
    'A simple project that blinks the onboard LED on and off in a one-second cycle. ' +
    'This is the classic first Arduino project used to verify that the board is working correctly.',
  firmware: [
    '// Blink LED — Classic Arduino starter project',
    '// Blinks the built-in LED on pin 13 at a 1-second interval.',
    '',
    'const int LED_PIN = 13; // Built-in LED on most Arduino boards',
    '',
    'void setup() {',
    '  // Configure LED pin as an output',
    '  pinMode(LED_PIN, OUTPUT);',
    '}',
    '',
    'void loop() {',
    '  digitalWrite(LED_PIN, HIGH); // Turn LED on',
    '  delay(1000);                 // Wait 1 second',
    '  digitalWrite(LED_PIN, LOW);  // Turn LED off',
    '  delay(1000);                 // Wait 1 second',
    '}'
  ].join('\n'),
  explanation:
    'The setup() function runs once when the board powers on. It configures pin 13 as an output ' +
    'so the board can control the LED. The loop() function runs continuously in a cycle: it turns ' +
    'the LED on by sending a HIGH signal to pin 13, waits one second, turns the LED off by sending ' +
    'a LOW signal, and waits another second before repeating.',
  components: [
    {
      name: 'Arduino Uno (or compatible board)',
      quantity: 1,
      notes: 'Uses the built-in LED — no external LED required for this project.'
    }
  ],
  wiring:
    'No external wiring required.\n' +
    'The built-in LED on pin 13 is used directly.\n' +
    'Simply connect the Arduino to your computer via USB.',
  expectedOutput:
    'The onboard LED will blink on and off every second. ' +
    'You will see it light up for one second, then turn off for one second, repeating continuously.'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a valid IAIRawResponse JSON string without making any network call.
 *
 * Always succeeds — the result is always { status: 'success', rawText }.
 * AIService processes the returned JSON through the same ResponseParser →
 * ResponseValidator → mapping pipeline as a real provider response.
 *
 * The system and user prompts are accepted but ignored — the mock returns
 * the same deterministic Blink LED response regardless of the input.
 *
 * Logs a console warning so developers can identify mock usage during testing.
 *
 * @param _system  - System prompt (accepted, ignored).
 * @param _user    - User prompt (accepted, ignored).
 * @param _config  - Provider config (accepted, ignored).
 * @returns Always { status: 'success', rawText: JSON.stringify(MOCK_RESPONSE) }.
 */
async function send(
  // These parameters match AIClient.send()'s signature exactly.
  // They are intentionally ignored — MockAIClient returns a fixed response.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _system: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _user: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _config: IAIProviderConfig
): Promise<IAIClientResult> {
  console.warn(
    '[MockAIClient] Using mock AI response. ' +
      'Set AI_API_KEY and AI_API_URL environment variables to use a real provider.'
  )

  return {
    status: 'success',
    rawText: JSON.stringify(MOCK_RESPONSE)
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const MockAIClient = Object.freeze({
  send
})

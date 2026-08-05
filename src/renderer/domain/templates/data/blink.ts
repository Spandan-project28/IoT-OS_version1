/**
 * blink.ts
 *
 * Template definition for the "Blink LED" project.
 *
 * The classic first Arduino sketch. Blinks the onboard LED every second and
 * prints the current state to the Serial Monitor so the user can verify that
 * both the hardware and the serial connection are working.
 *
 * Compatible with Arduino Uno, Arduino Nano, and ESP32 DevKit.
 */

import type { ITemplateDefinition } from '@shared/types/template'

export const blinkTemplate: ITemplateDefinition = Object.freeze({
  id: 'blink-led',
  name: 'Blink LED',
  description:
    'The classic first Arduino project. Blinks the onboard LED on and off every second ' +
    'and prints the current state to the Serial Monitor so you can confirm everything is working.',
  difficulty: 'beginner',
  tags: ['gpio', 'led', 'blink', 'output', 'beginner'],
  boards: ['arduino-uno', 'arduino-nano', 'esp32'] as const,

  components: [
    {
      name: 'Arduino Uno, Nano, or ESP32 DevKit',
      quantity: 1,
      notes: 'The built-in LED is used — no external components required.'
    }
  ],

  wiring:
    'No external wiring required. ' +
    'Connect your board to the computer via USB. ' +
    'The built-in LED is located next to the "L" label on Arduino boards, ' +
    'or next to the EN button on ESP32 DevKit boards.',

  firmware: `// Blink LED
// Blinks the onboard LED every second and prints the state to Serial Monitor.
// Compatible with Arduino Uno, Arduino Nano, and ESP32 DevKit.
//
// LED_BUILTIN is defined by Arduino Uno's and Nano's board package (pin 13),
// but some ESP32 board variants (e.g. the generic esp32:esp32:esp32 FQBN)
// don't define it at all. LED_PIN resolves to LED_BUILTIN wherever the
// board package defines it, and falls back to GPIO2 (the ESP32 DevKit's
// conventional onboard LED pin) otherwise — resolved by the preprocessor
// per-board at compile time, not guessed ahead of time.
#ifdef LED_BUILTIN
const int LED_PIN = LED_BUILTIN;
#else
const int LED_PIN = 2;
#endif

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Blink LED started");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED ON");
  delay(1000);

  digitalWrite(LED_PIN, LOW);
  Serial.println("LED OFF");
  delay(1000);
}
`,

  expectedOutput:
    'The onboard LED will turn on and off every second. ' +
    'In the Serial Monitor you will see "LED ON" and "LED OFF" printed ' +
    'alternately once per second, confirming that both the board and the ' +
    'serial connection are working correctly.'
})

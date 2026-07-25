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

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Blink LED started");
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  Serial.println("LED ON");
  delay(1000);

  digitalWrite(LED_BUILTIN, LOW);
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

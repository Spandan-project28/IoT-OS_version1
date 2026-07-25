/**
 * relay.ts
 *
 * Template definition for the "Relay Control" project.
 *
 * Controls a 5V relay module to switch an external load on and off every
 * two seconds. Demonstrates digital output to a relay and prints the current
 * relay state to the Serial Monitor.
 *
 * Compatible with Arduino Uno, Arduino Nano, and ESP32 DevKit.
 *
 * Safety note: This template only controls the relay coil (low-voltage side).
 * Do NOT connect mains voltage (AC) to the relay contacts without proper
 * electrical safety knowledge. For beginners, connect only a low-voltage DC
 * load such as an LED strip or a small DC motor.
 */

import type { ITemplateDefinition } from '@shared/types/template'

export const relayTemplate: ITemplateDefinition = Object.freeze({
  id: 'relay-control',
  name: 'Relay Control',
  description:
    'Control a 5V relay module to switch an external device on and off every two seconds. ' +
    'A safe introduction to controlling higher-power loads with a microcontroller.',
  difficulty: 'beginner',
  tags: ['relay', 'output', 'switching', 'gpio', 'actuator', 'beginner'],
  boards: ['arduino-uno', 'arduino-nano', 'esp32'] as const,

  components: [
    {
      name: '5V Relay Module',
      quantity: 1,
      notes:
        'Use a pre-built relay module with an onboard transistor and flyback diode. ' +
        'Do NOT connect a bare relay coil directly to the Arduino without protection circuitry.'
    },
    {
      name: 'Jumper Wires',
      quantity: 3,
      notes: 'Male-to-male or male-to-female depending on your relay module.'
    },
    {
      name: 'External Load (optional)',
      quantity: 1,
      notes:
        'Connect a small DC LED strip, buzzer, or DC motor to the relay NO/COM terminals ' +
        'to observe the switching effect. Beginners should avoid mains voltage connections.'
    }
  ],

  wiring:
    'Connect the relay module as follows:\n' +
    '  VCC → 5V (Arduino) or 5V (ESP32 — use the VIN/5V pin, not 3.3V)\n' +
    '  GND → GND\n' +
    '  IN  → Digital Pin 7\n' +
    'Most 5V relay modules are active-LOW: the relay activates when the IN pin is LOW ' +
    'and deactivates when HIGH. This firmware accounts for that behaviour. ' +
    'If your relay activates in reverse, swap HIGH and LOW in the firmware.',

  firmware: `// Relay Control
// Toggles a relay module on and off every 2 seconds.
// Compatible with Arduino Uno, Arduino Nano, and ESP32 DevKit.
//
// Wiring:
//   Relay VCC → 5V
//   Relay GND → GND
//   Relay IN  → Digital Pin 7
//
// Most relay modules are active-LOW (LOW = relay ON, HIGH = relay OFF).
// Adjust RELAY_ON / RELAY_OFF definitions below if your module behaves differently.

#define RELAY_PIN 7

// Active-LOW relay module: LOW energises the coil (relay ON).
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_OFF); // Ensure relay starts in the OFF state.
  Serial.begin(9600);
  Serial.println("Relay Control started");
}

void loop() {
  digitalWrite(RELAY_PIN, RELAY_ON);
  Serial.println("Relay ON");
  delay(2000);

  digitalWrite(RELAY_PIN, RELAY_OFF);
  Serial.println("Relay OFF");
  delay(2000);
}
`,

  expectedOutput:
    'The relay will click on and off every two seconds. ' +
    'The Serial Monitor will print:\n' +
    '  Relay ON\n' +
    '  Relay OFF\n' +
    'alternately. If you have connected a load to the relay NO/COM terminals, ' +
    'it will switch in sync with the serial output. ' +
    'If the relay is toggling in reverse (ON when it should be OFF), ' +
    'check whether your module is active-LOW or active-HIGH and adjust the ' +
    'RELAY_ON and RELAY_OFF definitions in the firmware accordingly.'
})

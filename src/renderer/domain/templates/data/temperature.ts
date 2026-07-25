/**
 * temperature.ts
 *
 * Template definition for the "Temperature Monitor" project.
 *
 * Uses a DHT11 sensor to read temperature and humidity values and prints them
 * to the Serial Monitor every second. Demonstrates sensor integration, library
 * usage, and formatted Serial output — a natural next step after Blink LED.
 *
 * Compatible with Arduino Uno, Arduino Nano, and ESP32 DevKit.
 *
 * Requires the DHT sensor library by Adafruit.
 * Install via Arduino IDE: Sketch → Include Library → Manage Libraries → search "DHT sensor library"
 */

import type { ITemplateDefinition } from '@shared/types/template'

export const temperatureTemplate: ITemplateDefinition = Object.freeze({
  id: 'temperature-monitor',
  name: 'Temperature Monitor',
  description:
    'Read temperature and humidity from a DHT11 sensor and display the values in the ' +
    'Serial Monitor every second. A great first sensor project.',
  difficulty: 'beginner',
  tags: ['sensor', 'dht11', 'temperature', 'humidity', 'serial', 'beginner'],
  boards: ['arduino-uno', 'arduino-nano', 'esp32'] as const,

  components: [
    {
      name: 'DHT11 Temperature & Humidity Sensor',
      quantity: 1,
      notes: 'Available as a 3-pin module with built-in resistor, or as a 4-pin bare component.'
    },
    {
      name: 'Jumper Wires',
      quantity: 3,
      notes: 'Male-to-male or male-to-female depending on whether you are using a module or breadboard.'
    },
    {
      name: '10kΩ Pull-up Resistor',
      quantity: 1,
      notes: 'Required only if using the bare 4-pin DHT11 component. Not needed with a pre-built module.'
    }
  ],

  wiring:
    'Connect the DHT11 sensor as follows:\n' +
    '  VCC  → 5V (Arduino) or 3.3V (ESP32)\n' +
    '  GND  → GND\n' +
    '  DATA → Digital Pin 2\n' +
    'If using the bare 4-pin DHT11 (not a module), also connect a 10kΩ resistor ' +
    'between VCC and the DATA pin to pull the signal high.',

  firmware: `// Temperature Monitor
// Reads temperature and humidity from a DHT11 sensor every second.
// Compatible with Arduino Uno, Arduino Nano, and ESP32 DevKit.
//
// Library required: DHT sensor library by Adafruit
// Install: Sketch → Include Library → Manage Libraries → "DHT sensor library"

#include <DHT.h>

#define DHT_PIN  2
#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);

void setup() {
  Serial.begin(9600);
  dht.begin();
  Serial.println("Temperature Monitor started");
  Serial.println("Reading DHT11 sensor on pin 2...");
}

void loop() {
  delay(1000);

  float humidity    = dht.readHumidity();
  float temperature = dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("Error: Failed to read from DHT11 sensor.");
    Serial.println("Check wiring and ensure the sensor is connected to pin 2.");
    return;
  }

  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.println(" °C");

  Serial.print("Humidity:    ");
  Serial.print(humidity);
  Serial.println(" %");

  Serial.println("---");
}
`,

  expectedOutput:
    'The Serial Monitor will print temperature (°C) and humidity (%) readings once per second. ' +
    'For example:\n' +
    '  Temperature: 25.00 °C\n' +
    '  Humidity:    55.00 %\n' +
    '  ---\n' +
    'If the sensor is not wired correctly, you will see an error message instead. ' +
    'Ensure the DATA pin is connected to Digital Pin 2 and the sensor is powered.'
})

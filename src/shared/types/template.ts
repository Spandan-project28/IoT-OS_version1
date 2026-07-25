/**
 * template.ts
 *
 * Shared type definitions for the Project Templates domain.
 *
 * Intentionally separated from hardware.ts, upload.ts, and serial.ts to keep
 * each domain self-contained as additional domains are introduced across phases.
 *
 * Consumers (V0.1):
 * - templateRegistry   (Renderer — static catalogue of ITemplateDefinition objects)
 * - useAppStore        (Renderer — selectedTemplate state and selectTemplate action)
 * - Projects page      (Renderer — reads the registry to render the Template Gallery)
 * - Editor page        (Renderer — reads selectedTemplate to populate firmware content)
 *
 * Future consumers (out of scope for V0.1):
 * - AIService          (Phase 6 — generates firmware that conforms to this shape)
 * - ProjectService     (Phase 7 — persists ITemplateDefinition to disk as a project)
 * - TemplateIpcHandlers (future — if community templates are fetched from a remote source)
 */

// ---------------------------------------------------------------------------
// Supporting union types
// ---------------------------------------------------------------------------

/**
 * The difficulty level of a template.
 *
 * Used in the UI to visually categorise templates so beginners can identify
 * appropriate starting points at a glance.
 *
 * - 'beginner'     — requires no prior Arduino knowledge; single component
 * - 'intermediate' — requires basic wiring knowledge; multiple components
 * - 'advanced'     — requires understanding of protocols or libraries
 */
export type TemplateDifficulty = 'beginner' | 'intermediate' | 'advanced'

/**
 * The set of hardware boards supported by IoTOS AI V0.1.
 *
 * Used inside ITemplateDefinition.boards to declare which boards a given
 * template's firmware is compatible with.
 *
 * - 'arduino-uno'  — Arduino Uno (ATmega328P, FQBN: arduino:avr:uno)
 * - 'arduino-nano' — Arduino Nano (ATmega328P, FQBN: arduino:avr:nano)
 * - 'esp32'        — ESP32 DevKit V1 (FQBN: esp32:esp32:esp32)
 */
export type SupportedBoard = 'arduino-uno' | 'arduino-nano' | 'esp32'

// ---------------------------------------------------------------------------
// Component definition
// ---------------------------------------------------------------------------

/**
 * A single physical component required to run a template's firmware.
 *
 * Displayed in the Editor's template info panel to guide the user in
 * assembling the correct hardware before uploading.
 */
export interface ITemplateComponent {
  /**
   * Human-readable component name.
   *
   * Examples: 'LED', 'DHT11 Sensor', '5V Relay Module', '220Ω Resistor'
   */
  name: string

  /**
   * Number of this component required.
   *
   * Most beginner templates use exactly 1 of each component.
   */
  quantity: number

  /**
   * Optional additional information the beginner needs to know about this component.
   *
   * Examples: '220Ω resistor required in series', 'Connect to 5V rail, not 3.3V'
   * Null when no additional notes are needed.
   */
  notes: string | null
}

// ---------------------------------------------------------------------------
// Template definition
// ---------------------------------------------------------------------------

/**
 * A complete, self-contained project template definition.
 *
 * Every field is required and fully populated at definition time — there are
 * no optional fields in V0.1. Future fields (e.g. wiringImagePath, schemaVersion)
 * may be added as optional extensions without breaking existing consumers.
 *
 * Templates are read-only static data in V0.1. The user selects one and the
 * firmware is copied into the Editor — the original definition is never mutated.
 */
export interface ITemplateDefinition {
  /**
   * Unique, stable identifier for this template.
   *
   * Used as a React key and as a future persistence key in ProjectService.
   * Must be kebab-case and must never change once published, as it may be
   * stored in saved project files.
   *
   * Examples: 'blink-led', 'temperature-monitor', 'relay-control'
   */
  id: string

  /**
   * Human-readable display name shown on the Template Card and in the Editor.
   *
   * Should be short, descriptive, and title-cased.
   *
   * Examples: 'Blink LED', 'Temperature Monitor', 'Relay Control'
   */
  name: string

  /**
   * One to two sentence beginner-friendly description of what this template does.
   *
   * Displayed on the Template Card (truncated) and in the Editor info panel (full).
   * Must not contain technical jargon — the target audience is a first-year student.
   */
  description: string

  /**
   * The difficulty classification of this template.
   *
   * Used to render the difficulty badge on the Template Card.
   */
  difficulty: TemplateDifficulty

  /**
   * Categorisation tags for this template.
   *
   * Used in future filtering and search features. Not displayed in V0.1 UI
   * beyond board compatibility badges. Values are lowercase, singular nouns.
   *
   * Examples: ['gpio', 'led', 'blink'], ['sensor', 'dht11', 'temperature']
   */
  tags: string[]

  /**
   * The set of hardware boards this template's firmware is compatible with.
   *
   * Displayed as board badges on the Template Card. Used in future board
   * filtering to grey out incompatible templates.
   *
   * ReadonlyArray because template definitions are immutable static data.
   */
  boards: ReadonlyArray<SupportedBoard>

  /**
   * The physical components the user must assemble before uploading.
   *
   * Displayed as a checklist in the Editor template info panel.
   * Ordered from most essential to most supplementary.
   */
  components: ITemplateComponent[]

  /**
   * Human-readable wiring instructions for this template.
   *
   * Written in plain language, step by step. Assumes the user has the board
   * connected to the computer via USB.
   *
   * Displayed in the Editor template info panel under "Wiring".
   */
  wiring: string

  /**
   * Complete, compilable Arduino/ESP32 firmware source code for this template.
   *
   * Must compile without errors using arduino-cli and the appropriate board core.
   * This string is passed directly to UploadService as the firmware source —
   * it is never transformed, generated, or parsed by the template system.
   */
  firmware: string

  /**
   * A beginner-friendly description of what the user should observe after uploading.
   *
   * Displayed in the Editor template info panel under "Expected Output".
   * Describes both visual hardware behaviour and any Serial Monitor output.
   */
  expectedOutput: string
}

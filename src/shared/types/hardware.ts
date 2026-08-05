export interface ISerialPort {
  path: string
  vendorId?: string
  productId?: string
  manufacturer?: string
}

/**
 * Capabilities declared by a board definition.
 * Used by future services (Upload, Serial, AI) to branch behaviour
 * without needing to interrogate the board type directly.
 */
export interface IBoardCapabilities {
  /** Board can be targeted by Arduino CLI compile + upload */
  arduinoCli: boolean
  /** Board exposes a USB-serial interface for monitoring */
  serialMonitor: boolean
  /** Board supports OTA updates (deferred, V0.1 excluded) */
  ota: boolean
}

/**
 * Immutable descriptor for a single supported board model.
 * Defined entirely inside HardwareRegistry — never mutated at runtime.
 */
export interface IBoardDefinition {
  /** Unique stable identifier used throughout the application */
  id: string
  /** Human-readable display name shown in the UI */
  name: string
  /** Board family for grouping and AI context */
  type: 'arduino' | 'esp32' | 'unknown'
  /** Manufacturer name for display and driver guidance */
  manufacturer: string
  /** Primary chip family (e.g. AVR, Xtensa LX6) */
  chipFamily: string
  /** USB-to-Serial bridge chip (e.g. CH340, CP210x, FTDI) used for driver advice */
  protocol: string
  /** Arduino CLI Fully Qualified Board Name — required for compile + upload */
  fqbn?: string
  /**
   * Explicit (VID, PID) pairs this board is known to expose (lowercase hex
   * strings). Each entry represents one real hardware/bridge-chip variant —
   * VID and PID are never matched as independent sets.
   */
  identifiers: { vid: string; pid: string }[]
  /** Feature flags consumed by future services */
  capabilities: IBoardCapabilities
}

export interface IBoard extends IBoardDefinition {
  port: string
}

/**
 * The result of attempting to identify a serial port as a known board.
 *
 * Three outcomes are possible:
 *
 * - `identified`: A single unambiguous registry match was found.
 *   The `board` field contains the full IBoard with port attached.
 *
 * - `unknown`: No registry entry matched the VID/PID. The device
 *   is a serial port but not a supported board in this version.
 *
 * - `ambiguous`: Multiple registry entries matched (e.g. CH340 clone
 *   shared by Arduino Nano and ESP32 DevKit). The `candidates` field
 *   lists all matching definitions. A future phase or user action
 *   is required to resolve this — the system must not guess.
 */
export type IIdentificationResult =
  | {
      status: 'identified'
      board: IBoard
    }
  | {
      status: 'unknown'
      port: ISerialPort
    }
  | {
      status: 'ambiguous'
      port: ISerialPort
      candidates: IBoardDefinition[]
    }

export interface IArduinoCLI {
  isInstalled: boolean
  version: string | null
  installedCores: string[]
  error?: string
}

export interface IHardwareState {
  cli: IArduinoCLI
  ports: ISerialPort[]
  connectedBoards: IBoard[]
  selectedBoardId: string | null
  isScanning: boolean
  lastScanTimestamp: number
}

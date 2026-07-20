# Changelog

All notable changes to the IoTOS AI prototype will be documented in this file.

## Phase 2: Hardware Detection

### Slice 1

- Added shared hardware models (`IBoard`, `ISerialPort`, `IArduinoCLI`, `IHardwareState`).
- Configured `@shared` path aliases across Node, Web, and Vite environments for seamless type sharing.

### Slice 2

- Introduced `HardwareRegistry` as the immutable single source of truth for board metadata.
- Extended `IBoardDefinition` with production metadata (`manufacturer`, `chipFamily`, `protocol`, `capabilities`).
- Implemented ambiguity-aware VID/PID lookup (`findBoardsByVidPid`) to handle cases where multiple clones share hardware identifiers (e.g., CH340).

### Slice 3

- Implemented `ArduinoCLIService` for detecting the `arduino-cli` binary, version, and installed cores without exposing IPC or UI logic.
- Implemented `SerialPortService` using a polling pattern on `SerialPort.list()` for cross-platform OS discovery without requiring native USB driver bindings.
- Implemented `BoardIdentificationService` with manufacturer string heuristics to resolve ambiguous VID/PID collisions and a discriminated union (`IIdentificationResult`) to explicitly model `identified`, `unknown`, and `ambiguous` states.

### Slice 4

- Created strongly typed `HardwareEventBus` utilizing Node.js `EventEmitter` for internal communication without Electron or IPC dependencies.
- Implemented `HardwareManager` as a pure orchestrator managing hardware services lifecycle and assembling state snapshots.
- Applied vertical slicing principles by explicitly removing premature board selection functionality, deferring it to later IPC and UI slices.

## Phase 1: Application Shell

- Initialized Electron + React + TypeScript monorepo using `@quick-start/electron`.
- Configured native Tailwind CSS v4 via `@tailwindcss/vite` for a highly optimized styling pipeline.
- Established a hybrid theme architecture (Light Workspace / Dark Sidebar & Topbar).
- Refactored UI from hardcoded hex values to semantic CSS tokens.
- Implemented foundational UI components (`Button`, `Card`, `Badge`, `EmptyWorkspace`).
- Created Zustand state store scaffolding for future hardware/upload statuses.
- Defined main process and preload IPC bridging architecture.

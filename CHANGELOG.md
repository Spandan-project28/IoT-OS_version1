# Changelog

All notable changes to the IoTOS AI prototype will be documented in this file.

## Phase 4: Serial Monitor

### Slice 15

- Created `src/main/ipc/serialIpcHandlers.ts` — registers `serial:open`, `serial:close`, `serial:write` invoke handlers and subscribes to `SerialEventBus` to push `serial:data` and `serial:statusChanged` to the Renderer via `webContents.send()`. Push is guarded against destroyed windows.
- Extended `src/shared/types/ipc.ts` with `SerialIpcChannels` constant and documentation-only serial payload type aliases, following the identical pattern of `HardwareIpcChannels` and `UploadIpcChannels`.
- Extended `src/preload/index.ts` with `serialApi` exposing `open()`, `close()`, `write()`, `onData()`, `onStatusChanged()` on `window.api.serial`. Callback methods return unsubscribe functions matching the hardware API pattern.
- Extended `src/preload/index.d.ts` with `ISerialApi` interface and added `serial: ISerialApi` to `IApi`.
- Updated `src/main/index.ts` to register `serialIpcHandlers` at startup with the window reference, on macOS re-creation, and to call `serialIpcHandlers.remove()` (which closes all sessions) during `before-quit`.
- No Zustand, UI, or React changes in this slice.

### Slice 14

- Created `src/main/serial/` directory as the Serial Monitor backend module boundary.
- Implemented `SerialEventBus` — typed event bus for the serial domain, mirroring `HardwareEventBus` pattern. Emits `serial:line`, `serial:statusChanged`, and `serial:error`.
- Defined `ISerialParser` interface — decouples `SerialSession` from `ReadlineParser` to allow future binary, JSON, or custom parsers.
- Implemented `ReadlineSerialParser` — default parser wrapping `@serialport/parser-readline`, strips trailing `\r`, emits one line per event.
- Implemented `createDefaultParser()` factory function for parser injection without importing the concrete class.
- Implemented `SerialSession` — owns one active port connection, delegates to `ISerialParser`, emits typed events, handles OS-level disconnect gracefully, never throws to callers.
- Implemented `SerialService` — singleton registry of `SerialSession` instances keyed by port path; exposes `open()`, `close()`, `write()`, `closeAll()`, `hasSession()`; all operations return typed `ISerialResult`.
- No IPC, preload, Zustand, or UI changes in this slice.

### Slice 13

- Created `src/shared/types/serial.ts` as the authoritative domain model for the Serial Monitor subsystem.
- Introduced `ISerialSettings` as a standalone configuration model (baud rate, newline mode), separated from runtime session state.
- Introduced `ISerialSessionState` with a typed `SerialStatus` discriminant (`closed`, `connecting`, `connected`, `error`).
- Introduced `ISerialDataPayload` carrying one parsed line per event (port-keyed for multi-board routing).
- Introduced `ISerialStatusPayload` for push lifecycle events (connected, closed, error).
- Introduced `ISerialResult` as a discriminated union consistent with `ICompileResult` / `IUploadResult`.
- Introduced `SerialErrorCode` structured error codes for all serial failure categories.
- No runtime behavior added. Zero changes to IPC, preload, Zustand, or UI.

## Phase 3: Firmware Upload

### Slice 10

- Added Upload Zustand state slice to the global store without duplicating hardware or IPC state.
- Implemented typed compile and upload actions delegating safely to the preload API.
- Added typed `lastCompileResult` and `lastUploadResult` to store response artifacts.
- Implemented `uploadLoading` and `uploadError` fields using try/finally for consistent error handling and state lifecycle.

### Slice 11

- Wired existing TopBar Upload button to `compileAndUploadFirmware` via Zustand — no new component required.
- Added `firmwareSource` prop to `TopBar` so only the Editor page activates the upload flow; all other pages remain in placeholder state.
- Upload button guards: disabled when no board, no FQBN, no CLI, or upload already in progress; primary variant when actionable.
- Added a lightweight status strip below the TopBar using existing design tokens — shows success or human-readable error after upload completes; auto-clears on next upload.
- Seeded `Editor` page with a `DEMO_FIRMWARE_SOURCE` Blink sketch for V0.1 testability pending Monaco integration.

### Slice 12

- Stabilization: removed stale future-tense forecast comments from `UploadService.ts` header.
- Simplified `createTempBuild` to return only `buildPath`; `sketchDir` is re-derived at point of use in `compile()`.
- Updated `ipc.ts` header to accurately reflect that both hardware and upload channels are live.
- Clarified upload payload type aliases in `ipc.ts` as documentation-only contracts.
- Renamed `uploadFailed` → `hasUploadError` in `TopBar.tsx` to accurately describe the IPC-transport-failure case.

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

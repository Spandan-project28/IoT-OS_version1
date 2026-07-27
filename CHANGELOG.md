# Changelog

All notable changes to the IoTOS AI prototype will be documented in this file.

## Phase 6: AI Firmware Generation

### Slice 22 — Shared AI Domain Types

- Created `src/shared/types/project.ts` — canonical immutable `IProjectDocument` runtime model with metadata (`origin`, `createdAt`, `generator`, `provider`, `model`), `schemaVersion: 1 as const` literal, firmware, assistant explanation, components, wiring, and target board hint per ADR-010, ADR-013, and ADR-016.
- Created `src/shared/types/ai.ts` — AI domain contracts: `IAIGenerateRequest` (with optional `context?` for future operations), `IAIProviderConfig` (Main process config for timeout, temperature, maxTokens), `IAIRawResponse` (internal LLM JSON output schema), `AIErrorCode` (9-code union for error branching), and `IAIResult` discriminated union.
- Updated `src/shared/types/ipc.ts` — added `AiIpcChannels` constant (`ai:generate`) and `AiGenerateRequest`/`AiGenerateResult` payload documentation aliases matching `UploadIpcChannels` and `SerialIpcChannels` conventions.
- Zero runtime logic, zero IPC handlers, zero Preload, zero Zustand, zero UI changes in this slice.

### Slice 23 — AI Main Process Backend

- Created `src/main/ai/PromptBuilder.ts` — pure module with no network, no parsing, no side effects. Exports `PROMPT_VERSION = 1` and `buildGenerate(request)` which produces a `{ system, user }` prompt pair. Board context is tailored per `SupportedBoard` literal with board-specific technical detail (FQBN, chip, pin count, memory). System prompt embeds the exact JSON response schema so the LLM knows the required output shape.
- Created `src/main/ai/AIClient.ts` — HTTP-only module. Calls OpenAI-compatible `/chat/completions` endpoint via native `fetch()`. Uses `AbortController` for configurable timeout (always cleared in `finally`). Maps HTTP status codes to typed `AIClientErrorCode` discriminated errors. Never transmits the API key outside the `Authorization` header. Returns `IAIClientResult` — never throws.
- Created `src/main/ai/MockAIClient.ts` — deterministic test double for `AIClient`. Returns a valid Blink LED `IAIRawResponse` JSON string. No test-only marker fields; AIService processes it through the identical `ResponseParser → ResponseValidator` pipeline as a real provider response. Activated when `AI_API_KEY` is absent or `AI_PROVIDER=mock`.
- Created `src/main/ai/ResponseParser.ts` — text-extraction-only module. Three extraction strategies in priority order: (1) strip markdown code fences, (2) direct `JSON.parse`, (3) first-`{`-to-last-`}` substring fallback to handle LLM preamble prose. Returns `unknown | null` — no knowledge of `IAIRawResponse`.
- Created `src/main/ai/ResponseValidator.ts` — structural validation only. Narrows `unknown → IAIRawResponse`. Validates required string fields, components array (min 1 entry), component shape (name, positive-integer quantity, coerced nullable notes). Returns typed `IValidationResult` discriminated union.
- Created `src/main/ai/AIService.ts` — the only orchestration layer. Pipeline: `resolveProviderConfig → PromptBuilder.buildGenerate → AIClient/MockAIClient.send → ResponseParser.parse → ResponseValidator.validate → mapToProjectDocument`. Maps `IAIRawResponse → IProjectDocument` in one place. Populates `metadata.origin`, `createdAt`, `generator`, `provider`, `model`. Never throws — every error path returns a typed `IAIResult`. Last-resort `catch` guards against unexpected pipeline failures. Provider config (apiKey) is never transmitted to the Renderer.

### Slice 24 — AI IPC Bridge & Preload

- Updated `src/shared/types/ipc.ts` — added `AiIpcChannels.generate = 'ai:generate'` constant following `HardwareIpcChannels`/`UploadIpcChannels`/`SerialIpcChannels` conventions exactly.
- Created `src/main/ipc/aiIpcHandlers.ts` — registers `ipcMain.handle('ai:generate')` which delegates exclusively to `AIService.generate(request)` and returns the typed `IAIResult` to the Renderer. Performs no business logic, no validation, no mapping. Exposes `register()` and `remove()` following the established IPC handler pattern. No push events in V0.1.
- Updated `src/main/index.ts` — calls `aiIpcHandlers.register()` at app startup and `aiIpcHandlers.remove()` during `before-quit`.
- Updated `src/preload/index.ts` — added `aiApi` object exposing `generate(request): Promise<IAIResult>` via `ipcRenderer.invoke(AiIpcChannels.generate, request)`. Added `ai: aiApi` to the `contextBridge.exposeInMainWorld` call.
- Updated `src/preload/index.d.ts` — added `IAiApi` interface with `generate` method and added `ai: IAiApi` to `IApi`.

### Slice 25 — Zustand AI State

- Extended `src/renderer/store/useAppStore.ts` with the AI Zustand slice.
- Added `currentProjectDoc: IProjectDocument | null` (initial `null`) — the single runtime source of truth for the active project, regardless of origin (template or AI).
- Added `aiLoading: boolean` (initial `false`) — true while `generateAiProject()` awaits the IPC response.
- Added `aiError: string | null` (initial `null`) — the user-facing error message from the last failed generation.
- Implemented `generateAiProject(request)` — follows the standardized async lifecycle: `set({ aiLoading: true, aiError: null })` → `try/await/catch` → `finally(set({ aiLoading: false }))`. On success sets `currentProjectDoc`; on error sets `aiError`. Never throws to callers.
- Implemented `clearProject()` — atomically resets `currentProjectDoc`, `selectedTemplate`, and `aiError` to null. Retained `clearTemplate()` as a `@deprecated` backward-compatible shim that calls the same reset logic.
- Updated `selectTemplate(template)` — now maps `ITemplateDefinition → IProjectDocument` before storing in state. Dual-writes `currentProjectDoc` and `selectedTemplate` for backward compatibility. Clears `aiError` so stale errors do not persist when a template is selected.

### Slice 26 — Editor UI Integration

- Rewrote `src/renderer/pages/Editor/index.tsx` to read exclusively from `currentProjectDoc`. All runtime reads of `selectedTemplate` removed from the Editor.
- Added `PromptInput` sub-component: textarea for the natural-language prompt, Generate button with `Loader2` spinner during `aiLoading`, Ctrl+Enter keyboard shortcut, and inline error banner using `aiError`.
- Added `AssistantSectionSkeleton` sub-component: animated `pulse` placeholder card shown while `aiLoading` is true — four skeletons replace the assistant panel content during generation; eight line skeletons replace the firmware panel content.
- Left panel (firmware viewer) renders `currentProjectDoc.firmware` in `<pre>` when a project is active, an 8-line code skeleton while `aiLoading`, or the original "No code to display" empty state.
- Right panel (assistant) renders `currentProjectDoc` fields (title, description, components, wiring, explanation, expectedOutput) when a project is active, four `AssistantSectionSkeleton` cards while `aiLoading`, or the original placeholder cards with descriptive guidance text.
- Origin badge derives text from `currentProjectDoc.metadata.origin`: `'ai'` → "AI Generated", `'template'` → "Template", null → "Unsaved".
- `boardHint` derived from `hardware.connectedBoards[0]?.type`: `'esp32'` → `'esp32'`, `'arduino'` with `nano` FQBN → `'arduino-nano'`, other `'arduino'` → `'arduino-uno'`, `'unknown'` → `null`.
- `window.api.ai` is never called from React. All AI operations flow exclusively through `useAppStore.generateAiProject()`.

### Slice 27 — Production Readiness, Stabilization & Final Audit

- **Bug fix (`AIService.generate`):** Removed unreachable dead code block (the `if (usingMock && config !== null && ...)` branch that only contained a comment). Consolidated mock selection into a single `effectiveMock` expression: `config === null || AI_PROVIDER === 'mock'`. This also fixes the `AI_PROVIDER=mock` developer override which previously had no effect (the old `effectiveMock = config === null` ignored the env var).
- **Stale comment fix (`useAppStore.ts`):** Updated the `selectedTemplate` JSDoc to reflect that the Editor now reads exclusively from `currentProjectDoc` (Slice 26 migration). Added `@deprecated` tag documenting that `selectedTemplate` is a backward-compatibility field for removal in Phase 7.
- **Documentation (`CHANGELOG.md`):** Added missing entries for Slices 23–27.
- **Documentation (`memory.md`):** Updated Current Status to reflect Phase 6 complete. Added journal entries for Slices 23–27. Updated Technical Debt table with the `selectedTemplate`/`currentProject` compatibility layers. Added ADR-010, ADR-013, and ADR-016 to the ADR register.

## Phase 5: Project Templates

### Slice 21 — Template Gallery UI & Editor Integration

- Created `src/renderer/components/templates/TemplateCard.tsx` — presentational card component. Displays template name, difficulty badge (success/warning/error variant), description, supported board chips, and component count. Calls `onSelect(template)` on click. No routing, no Zustand access — pure presentation.
- Replaced EmptyWorkspace placeholder in `src/renderer/pages/Projects/index.tsx` with the Template Gallery. Reads `templateRegistry` (static import), renders one `TemplateCard` per entry in a responsive 1/2/3-column grid. On card click: calls `selectTemplate(template)` then `navigate('/editor')`. No modal, no confirmation, direct navigation.
- Updated `src/renderer/pages/Editor/index.tsx` to read `selectedTemplate` from Zustand.
  - When a template is selected: `firmwareSource={selectedTemplate.firmware}` is passed to `TopBar`, activating the existing Upload button pipeline without any changes to `TopBar`, `UploadService`, or IPC.
  - The sketch panel renders the firmware source in a monospace `<pre>` block.
  - The Firmware Assistant panel replaces its placeholder sections with live template metadata: name/description (highlighted primary card), components checklist, wiring notes, and expected output.
  - The `DEMO_FIRMWARE_SOURCE` constant is removed — superseded by the template system.
  - When no template is selected, the original placeholder UI is preserved exactly.
- No IPC changes. No preload changes. No Main process changes. No new dependencies.

### Slice 20 — Template Registry & Zustand Integration

- Created `src/renderer/domain/templates/data/blink.ts` — Blink LED template definition (`Object.freeze`).
- Created `src/renderer/domain/templates/data/temperature.ts` — DHT11 Temperature Monitor template definition.
- Created `src/renderer/domain/templates/data/relay.ts` — Relay Control template definition with active-LOW documentation and beginner safety note.
- Created `src/renderer/domain/templates/registry.ts` — `templateRegistry: ITemplateDefinition[]` array; only export; no helpers. Future templates require one new file, one import, one array entry.
- Extended `src/renderer/store/useAppStore.ts` with the Template Zustand slice: `selectedTemplate: ITemplateDefinition | null` (initial `null`), `selectTemplate(template)` pure set, `clearTemplate()` resets to null. Zero side effects.

### Slice 19 — Shared Template Types

- Created `src/shared/types/template.ts` as the authoritative domain model for the Project Templates subsystem.
- Introduced `ITemplateDefinition` with full JSDoc on every field (id, name, description, difficulty, tags, boards, components, wiring, firmware, expectedOutput).
- Introduced `ITemplateComponent` (name, quantity, notes).
- Introduced `TemplateDifficulty` union: `'beginner' | 'intermediate' | 'advanced'`.
- Introduced `SupportedBoard` union: `'arduino-uno' | 'arduino-nano' | 'esp32'`.
- `boards` field typed as `ReadonlyArray<SupportedBoard>` — immutable by design.
- No runtime behavior. Zero IPC, preload, Zustand, or UI changes in this slice.

## Phase 4: Serial Monitor

### Slice 18 — Stabilization, Architecture Audit & Production Readiness

**Bug fix (SerialService.closeAll):**

- Fixed a logic error in `SerialService.closeAll()` where `_sessions.clear()` was called before the async `.map()` that read sessions back from `_sessions.get(port)`. Because the map was already cleared, every `session` lookup returned `undefined` and `session.close()` was never called. All OS serial port handles were silently leaked at app shutdown. Fixed by capturing `[..._sessions.values()]` before clearing.

**Dead code removal (main/index.ts):**

- Removed the leftover `ipcMain.on('ping', ...)` scaffold handler inherited from the electron-vite template. It registered an `ipcMain` listener that was never removed during `before-quit`, creating a dangling resource. Removed the now-unused `ipcMain` import from the electron destructure.

**Architecture audit — findings (no code changes required):**

- Serial domain follows Hardware domain conventions exactly: module-level singleton service with `Object.freeze` export, event bus with typed `ISerialEventMap`, IPC handlers with `register`/`remove` pattern, preload bridge returning unsubscribe functions, Zustand handles at module scope.
- All IPC channel names are unique across all three domains (hardware, upload, serial) with no collisions.
- `preload/index.d.ts` matches `preload/index.ts` exactly — every method, parameter type, and return type is consistent.
- Push event guards (`!webContents.isDestroyed()`) are present in both `hardwareIpcHandlers.ts` and `serialIpcHandlers.ts`.
- `SerialSession` is correctly single-use; `SerialService` creates a new instance for every `open()` call.
- Parser lifecycle is correct: `ReadlineSerialParser.close()` removes all listeners and nulls internal references before `_closePort()` runs.
- The `_closed` flag in `SerialSession` prevents the `close` event handler from firing again after an explicit `close()` call.
- `closeSerial` in Zustand does not optimistically update `serialState` — correct, because the `serial:statusChanged (closed)` push event is the authoritative source of truth.
- Bounded log buffer (1000 lines) uses `slice(1)` which is O(n) per line. This is intentional for V0.1; batching and ring-buffer optimisations are deferred to a future performance phase.

**React audit — findings (no code changes required):**

- `DeviceMonitor` uses `useMemo` to stabilise `currentLogs` and prevent stale dependency array in `useEffect` auto-scroll.
- `logEndRef` uses `scrollIntoView` rather than `scrollTop` manipulation — compatible with Panel's `overflow-auto` inner div.
- Baud rate selector is correctly disabled while `isConnected || isConnecting` to prevent mid-session reconfiguration.
- No unnecessary re-renders identified.

### Slice 17 — Serial Monitor UI Integration

- Wired `src/renderer/pages/DeviceMonitor/index.tsx` entirely to the Zustand serial store. Zero direct `window.api.serial.*` calls in any React component.
- Added `initializeSerial()` and `disposeSerial()` lifecycle calls to `src/renderer/components/common/AppProviders.tsx`.
- Implemented Baud Rate Selector (9600–115200), Connect/Disconnect button, live Serial Console log output, Auto-scroll toggle, Clear Logs button, and message input with Send.
- `selectedPortPath` prefers identified board's port and falls back to first detected port.
- Added Active Session badge to the Detected Ports table per-port.
- Unified error banner displays both `hardwareError` and `serialError`.
- `useMemo` wraps `currentLogs` derivation to stabilise the `useEffect` auto-scroll dependency array.

- Extended `src/renderer/store/useAppStore.ts` with the serial Zustand slice.
- Added serial type imports: `ISerialOpenRequest`, `ISerialCloseRequest`, `ISerialWriteRequest`, `ISerialSessionState`, `ISerialDataPayload`, `ISerialStatusPayload`.
- Added 5 state fields to `AppState`: `serialState` (`Record<string, ISerialSessionState>`), `serialLogs` (`Record<string, string[]>`), `serialAutoScroll` (boolean, default `true`), `serialError` (`string | null`), `serialLoading` (boolean).
- Added 2 private module-level runtime handles: `_serialDataUnsubscribe`, `_serialStatusUnsubscribe` — not stored in Zustand, following the established hardware pattern.
- Added 7 actions: `initializeSerial`, `disposeSerial`, `openSerial`, `closeSerial`, `writeSerial`, `clearSerialLogs`, `toggleSerialAutoScroll`.
- `initializeSerial` guards against duplicate subscription using null checks on private handles.
- `serial:data` handler appends one line per event to the correct port's log buffer with a hard 1000-line bounded cap (oldest entry discarded when full).
- `serial:statusChanged` handler updates only the affected port's `ISerialSessionState`, preserving existing settings via a safe fallback.
- `openSerial` optimistically sets `status: 'connecting'` before the IPC call; errors update `serialState` directly since no push event is emitted on failure.
- No IPC, backend, preload, or UI changes in this slice.

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

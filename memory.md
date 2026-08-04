# MEMORY.md

**Project:** IoTOS AI  
**Document:** Project Memory & Engineering Journal  
**Version:** 2.1  
**Status:** Living Document

---

# Purpose

This document preserves the long-term memory of the IoTOS AI project.
Unlike the PRD, Architecture, Rules, Design, and Phases documents, which define what the project should be, this document records what actually happened during development.
It exists so that no important engineering knowledge is ever lost.

# Objectives

Record:

- Architectural decisions
- Lessons learned
- Technical discoveries
- Known issues
- Technical debt
- Milestones
- AI collaboration history
- Future ideas
- Historical context

Never duplicate information from the other documentation. Record changes and reasoning instead.

---

# Project Snapshot

**Project:** IoTOS AI  
**Tagline:** The AI Copilot for Arduino & ESP32 Development  
**Prototype:** V0.1

## Core Promise

> **Describe → Generate → Upload → Run**

## Documentation Relationships

| Document        | Purpose               |
| --------------- | --------------------- |
| PRD.md          | Product vision        |
| ARCHITECTURE.md | System architecture   |
| RULES.md        | Engineering standards |
| DESIGN.md       | Design system         |
| PHASES.md       | Execution roadmap     |
| MEMORY.md       | Historical knowledge  |

---

# Architecture Decision Records (ADR)

### ADR-001

- **Status:** Accepted
- **Decision:** Electron is the desktop framework.
- **Reason:**
  - Mature ecosystem
  - Native hardware support
  - Excellent Node.js integration
- **Alternatives:**
  - Tauri
  - Flutter

### ADR-002

- Arduino CLI is the official firmware toolchain.

### ADR-003

- Monaco Editor provides the firmware editing experience.

### ADR-004

- Prototype V0.1 is local-first.
- Cloud infrastructure is intentionally excluded.

### ADR-005

- **Status:** Accepted
- **Decision:** Use official `@tailwindcss/vite` plugin for Tailwind CSS v4 integration.
- **Reason:**
  - Integrates directly with the Vite compiler.
  - Eliminates the need for external `postcss.config.js` and `tailwind.config.js`.
  - Enables configuring theme overrides declaratively inside `main.css` via the `@theme` directive.
  - Highly optimized compiler-first build performance.

### ADR-006

- **Status:** Accepted
- **Decision:** Use polling via `SerialPort.list()` for Phase 2 hardware discovery instead of attempting native streaming immediately.
- **Reason:**
  - Phase 2 uses `SerialPort.list()` exclusively for device enumeration. Native port opening and streaming will be introduced in Phase 4 once the required Windows build environment is available. This is a phased implementation decision rather than a change in architecture.
  - A 2-second polling interval via the built-in listing mechanism is sufficient for the Phase 2 discovery requirements.

### ADR-008

- **Status:** Accepted
- **Decision:** Typed IPC Boundary. All communication between the Electron Main process and Renderer must pass through a typed IPC contract located in `src/shared/types/ipc.ts`.
- **Reason:**
  - Single source of truth for IPC contracts
  - Compile-time safety
  - Elimination of magic IPC channel strings
  - Strong separation between Main and Renderer
  - Easier future extension without breaking API compatibility
- **Consequences:**
  - Every new IPC channel must be defined in `src/shared/types/ipc.ts`
  - Preload remains a thin bridge
  - Renderer depends only on typed APIs

### ADR-009

- **Status:** Accepted
- **Decision:** Project Templates are renderer-only static data — no IPC, no Main process service, no filesystem reads.
- **Reason:**
  - Templates are bundled at build time as TypeScript modules; the Renderer can import them directly.
  - No round-trip latency, no async complexity, no IPC channel proliferation.
  - All three template definitions fit comfortably in the renderer bundle.
- **Consequences:**
  - Adding a new template requires one new data file + one registry import (zero runtime changes).
  - Community/remote templates (future) would require a new IPC channel and a dedicated fetch service — deferred to a future phase.

### ADR-010

- **Status:** Accepted
- **Decision:** `IProjectDocument` is the single runtime model for all active project content — both template-sourced and AI-generated projects map into this shape before reaching the Editor.
- **Reason:** Unifies the Editor rendering path. The Editor is completely agnostic to project origin; both sources produce identical `IProjectDocument` shapes rendered through the same pipeline.
- **Consequences:** `selectTemplate()` maps `ITemplateDefinition → IProjectDocument` at the action boundary. `AIService.mapToProjectDocument()` is the only other mapping point.

### ADR-013

- **Status:** Accepted
- **Decision:** Provider configuration (`IAIProviderConfig`, including `apiKey`) is resolved in the Main process from environment variables and is never transmitted to the Renderer.
- **Reason:** The Renderer only receives `IAIResult` — the typed outcome of the pipeline. API keys must not appear in IPC messages, Zustand state, or React component trees.
- **Consequences:** `AIService` is the only module that reads environment variables. Future key rotation requires only `AIService` changes.

### ADR-016

- **Status:** Accepted
- **Decision:** `IProjectDocument` is strictly immutable. Atomic state replacement via `set()` is mandatory; no in-place mutation is permitted.
- **Reason:** Zustand's selector optimisation depends on referential equality. Mutating nested properties bypasses Zustand's change detection, causing stale UI.
- **Consequences:** Every action that updates `currentProjectDoc` must replace the entire object. No property can be updated in isolation.

### ADR-017

- **Status:** Accepted
- **Decision:** IoTOS AI evolves from a template-first application to a project-centric one. The project (`IProjectDocument`) is the primary editable unit; a template is one of three ways to create one, alongside AI generation and manual creation.
- **Reason:**
  - Template-only creation limited every new project to one of three fixed starting points.
  - Treating the project as the primary unit lets the product add new creation paths without inventing a new document shape or a divergent Editor code path — every path still terminates at the same `IProjectDocument` established by ADR-010.
- **Trade-offs considered:**
  - Keeping templates as the primary unit and treating manual and AI creation as template variants was rejected — it would have required inventing a "no-op template," an awkward fit for a project with no starting content.
- **Consequences:** Extends ADR-010. `IProjectDocument` remains the single runtime model; only the number of paths that construct one grows.

### ADR-018

- **Status:** Accepted
- **Decision:** `ProjectOrigin` (`template` | `ai` | `manual`) is assigned automatically at project creation, is immutable, and is metadata only. It may be shown as a presentation label but must never gate behavior, capability, or permission.
- **Reason:**
  - A project-centric model with multiple creation paths needs a way to record provenance for display (for example, an origin badge) without letting that provenance fragment the product into per-origin feature sets.
  - Making it immutable and behavior-inert keeps every project's capabilities identical after creation, regardless of how it started.
- **Trade-offs considered:**
  - Allowing `ProjectOrigin` to gate future behavior (for example, origin-specific tooling) was explicitly rejected — this would recreate the same fragmentation the project-centric model was designed to avoid.
- **Consequences:** No subsystem — Renderer, IPC, or Service — may branch on `ProjectOrigin` unless a future specification explicitly introduces such behavior.

### ADR-019

- **Status:** Accepted
- **Decision:** Manual project creation and Open Existing Project both reuse existing pipelines rather than introducing new ones. Manual creation follows the same Renderer-side construction and atomic state-replacement pattern already established by `selectTemplate()`; Open Existing Project reuses the existing `project:open` IPC channel and `ProjectService.open()`, adding only a Main-process-only native file picker as a new entry point.
- **Reason:**
  - Every project, regardless of origin, must converge on the same `IProjectDocument` before reaching the Editor and pass through the same Save / Autosave / Upload / Monitor pipeline — a second construction or opening pipeline for any origin would duplicate logic the product already has.
  - Reusing `project:open` meant Open Existing Project required no new persistence path — it is a new discovery entry point (a file picker on the Projects page), not a new capability.
- **Trade-offs considered:**
  - Constructing manual and template projects via a new Main-process IPC channel (a `project:new` handler) was considered and rejected in favor of the existing Renderer-only construction pattern — the binding requirement is that every path converges on the same document, not which layer performs the construction; that mechanism may still evolve later without breaking the invariant.
- **Consequences:** No `project:new` channel exists or is needed. `ProjectService` gained zero new methods for Phase 9.

---

# Phase 9 — Project-Centric Evolution

This section records the historical context and product reasoning behind Phase 9. It is a summary of decisions already made and frozen in the Product Vision, PRD.md, ARCHITECTURE.md, DESIGN.md, and PHASES.md — not a restatement of their specifications.

## From the Original V0.1 Roadmap

PHASES.md's original Phase 9 targeted stabilization testing for the V0.1 investor demo. Development continued past that scope — Project Persistence (the real Phase 7) and AI Settings, Review, and Improve (the real Phase 8) shipped first, each closing with its own stabilization slice, fulfilling the original Phase 9 intent without a standalone testing phase. The current Phase 9, the project-centric workflow, is the next evolution beyond that point, not a renumbering of the same work. PHASES.md retitles the original section "(Original V0.1 Roadmap — Superseded)" and preserves it in full for historical continuity.

## Why Templates Remain Unchanged

The Product Vision, PRD.md, and DESIGN.md all preserve the existing template gallery and selection flow exactly as it was — the fastest path for a beginner remains exactly as fast and exactly unchanged. Beginners are the product's primary audience, and the template path is the product's proven, lowest-friction entry point. Project-centricity was designed to add optionality around that path, not to alter or gate it.

## Why Manual Project Creation Was Added

A project-centric model requires that a project can exist without first going through a template or an AI prompt. Manual creation gives a user who already knows what they want to build — or who simply wants an empty starting point — a direct way to create a project, without a template or an AI round trip standing in the way.

## Why Open Existing Project Became a First-Class Entry Point

Before Phase 9, opening a previously saved project was reachable only through the Recent Projects list, which requires the project to already be in that history. Open Existing Project promotes the underlying, already-existing `project:open` capability to a discoverable, first-class action on the Projects page, so a user can browse for and open any project file directly, including ones outside their recent history.

## Why Template, AI, and Manual Projects Converge into the Same Lifecycle

All three origins construct the same `IProjectDocument` and, from that point forward, are indistinguishable to Save, Autosave, Upload, and Device Monitor. Maintaining separate lifecycles per origin would have duplicated logic the product already had working reliably for template and AI projects, and would have made the Editor origin-aware in a way ADR-010 already ruled out.

## Why the Following Were Intentionally Excluded from Phase 9

- User Templates
- Template Editing
- Git
- Cloud
- Import Systems
- Workspace Manager
- Multiple Projects

Each would expand the product beyond a single, local, project-centric workflow — into template authorship, version control, remote infrastructure, third-party project formats, multi-root workspace management, or multi-project sessions. None were necessary to let a project be created three ways and opened directly. Consistent with PRD.md's Product Philosophy ("Does this make embedded development easier for beginners?") and RULES.md's Scope Discipline ("Feature creep is considered a defect"), they were deferred rather than bundled into Phase 9.

---

# Locked Decisions

Do not revisit during V0.1:

- No Authentication
- No Cloud Backend
- No Database
- No OTA
- No Cloud Dashboard
- No Collaboration
- No Marketplace
- No Mobile App

## Phase 9

Do not revisit during Phase 9:

- No User Templates or Template Editing
- No Git-based project workflows
- No Cloud-hosted projects
- No Import Systems (Arduino Sketch, PlatformIO)
- No Workspace Manager
- No Multiple simultaneously open projects

---

# Current Status

- **Current Phase:** Phase 8: AI Settings, Review & Improve — **COMPLETE**
- **Current Milestone:** M8 complete — Full AI Settings, Review & Improve pipeline (Slices 35–40), following M7 — Project Persistence (Slices 28–34)
- **Overall Progress:** Phase 1 (100%), Phase 2 (100%), Phase 3 (100%), Phase 4 (100%), Phase 5 (100%), Phase 6 (100%), Phase 7 (100%), Phase 8 (100%)
- **Last Updated:** August 5, 2026

---

# Technology Snapshot

- **Desktop:** Electron
- **Frontend:** React, TypeScript, Tailwind CSS, Monaco Editor
- **State:** Zustand
- **Hardware:** Arduino CLI, SerialPort
- **AI:** OpenAI Compatible API
- **Supported Hardware:** Arduino Uno, Arduino Nano, ESP32 DevKit

---

| Date       | Objective                                                                                                                      | Completed | Decisions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Problems                                                                                                                                                                     | Solutions                                                                                                                                                                                                                   | Next Session                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 2026-07-18 | Scaffold Electron + React + TS project, structure folders, and configure Tailwind v4, Zustand, Monaco, and preload IPC bridge. | Yes       | - Refactored default nested `src/renderer/src` to flat `src/renderer` matching `ARCHITECTURE.md`. <br> - Used Tailwind v4 Vite plugin.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | - electron-vite template placed React code inside `src/renderer/src`. <br> - Tailwind v4 caused build failure with standard PostCSS setup.                                   | - Updated tsconfig.web.json, aliases, and index.html to target direct `src/renderer/` root. <br> - Switched to native `@tailwindcss/vite` plugin and removed postcss/tailwind config files.                                 | Begin Phase 1 (Application Shell, Sidebar navigation, page layout mockups). |
| 2026-07-19 | Implement Phase 1: Application Shell                                                                                           | Yes       | - Hybrid Theme (Light workspace, Dark Sidebar/TopBar) instead of Dark-first.<br>- Premium visual language inspired by Cursor/Arc.<br>- CSS variables in `main.css` for semantic styling.<br>- Topbar/Sidebar specific styling conventions.<br>- Shared UI components (`Button`, `Card`, `Badge`, `EmptyWorkspace`).                                                                                                                                                                                                                                                                                                                                              | - UI initially felt like a generic Tailwind dashboard.<br>- Hardcoded hex values caused technical debt.                                                                      | - Redesigned to use a Hybrid Theme.<br>- Refactored hardcoded hex codes into semantic CSS tokens and Tailwind v4 variables.                                                                                                 | Begin Phase 2 (Hardware Detection & Serial Communication).                  |
| 2026-07-19 | Phase 2, Slices 1-3: Hardware Abstraction & Services                                                                           | Yes       | - Rejected monolithic service pattern for a decoupled `HardwareManager` + pure domain services.<br>- Created static, immutable `HardwareRegistry`.<br>- Resolved CH340 ambiguity by returning multiple candidates instead of guessing.<br>- Adopted discriminated union `IIdentificationResult`.                                                                                                                                                                                                                                                                                                                                                                 | - `serialport` native bindings failed to rebuild locally on Windows due to missing VS Build Tools.<br>- Multiple clone boards share the exact same VID/PID (e.g. CH340).     | - Deferred native port opening to Phase 4; used `SerialPort.list()` for Phase 2 enumeration.<br>- Designed `HardwareRegistry.findBoardsByVidPid` to surface ambiguity, letting `BoardIdentificationService` use heuristics. | Phase 2, Slice 4 (HardwareManager & EventBus).                              |
| 2026-07-19 | Phase 2, Slice 4: HardwareManager & EventBus                                                                                   | Yes       | - Implemented `HardwareManager` as a pure orchestrator with dependency injection.<br>- Removed premature `selectBoard` functionality to respect the vertical slice philosophy.<br>- Created strongly typed `HardwareEventBus` using Node.js `EventEmitter`.                                                                                                                                                                                                                                                                                                                                                                                                      | - Premature board selection logic was introduced without a legitimate caller.                                                                                                | - Removed `selectBoard` and `selectedBoardId` state from this slice, deferring it to Slice 5 (IPC), 6 (Zustand), and 7 (UI).                                                                                                | Phase 2, Slice 5 (IPC Bridge).                                              |
| 2026-07-20 | Phase 2, Slices 5 & 6: IPC Bridge & Renderer State                                                                             | Yes       | - Created typed IPC boundary.<br>- Extended `useAppStore` with hardware slice.<br>- Runtime subscription handles (`_hardwareUnsubscribe`) intentionally kept outside Zustand state (in module scope) to keep store strictly serializable.                                                                                                                                                                                                                                                                                                                                                                                                                        | - `hardware:refresh` was originally identical to `getState` and not triggering real I/O.<br>- Unsubscribe handle initially placed inside Zustand state.                      | - Fixed `refresh` IPC handler to invoke actual re-scan.<br>- Moved subscription handle to private module-level variable.                                                                                                    | Phase 2, Slice 7 (UI Integration).                                          |
| 2026-07-20 | Phase 3, Slices 8-10: Upload Backend, IPC Bridge, & Renderer State                                                             | Yes       | - Split upload into independent `compile` and `upload` operations, using `ICompiledFirmware` as intermediate artifact.<br>- Delegated via pure `UploadIpcChannels`.<br>- Extended global Zustand store with upload actions delegating to preload API, preserving serializable state.                                                                                                                                                                                                                                                                                                                                                                             | - Duplicate firmware compilations could occur on retries.<br>- Combining domains would bloat IPC / State files.                                                              | - Redesigned UploadService to produce and consume `ICompiledFirmware`.<br>- Kept upload IPC and Zustand state separate from hardware domains.                                                                               | Phase 3, Slice 11 (Upload UI).                                              |
| 2026-07-20 | Phase 3, Slice 11: Upload UI Integration                                                                                       | Yes       | - Wired TopBar Upload button to `compileAndUploadFirmware` via Zustand.<br>- Added `firmwareSource` prop to TopBar so only the Editor page can trigger upload.<br>- Used demo Blink sketch as placeholder until Monaco editor is wired.                                                                                                                                                                                                                                                                                                                                                                                                                          | - No Monaco editor yet, needed a real firmware source for testing.                                                                                                           | - Added `DEMO_FIRMWARE_SOURCE` const in Editor with a clear TODO comment. Status strip reuses existing design tokens — no new components.                                                                                   | Phase 3, Slice 12 (Stabilization).                                          |
| 2026-07-20 | Phase 3, Slice 12: End-to-End Upload Stabilization                                                                             | Yes       | - Removed stale future-tense forecasts from UploadService and ipc.ts headers.<br>- Simplified `createTempBuild` to return only `buildPath` (not the derivable `sketchDir`).<br>- Renamed `uploadFailed` to `hasUploadError` in TopBar for precision.<br>- Clarified ipc.ts payload type aliases as documentation-only.                                                                                                                                                                                                                                                                                                                                           | - Stale comments persisted from implementation phase.<br>- `createTempBuild` had an unused return value.                                                                     | - Targeted surgical cleanup only; no architectural changes.                                                                                                                                                                 | Phase 4 planning.                                                           |
| 2026-07-21 | Phase 4, Slice 13: Serial Monitor Shared Types                                                                                 | Yes       | - Created `src/shared/types/serial.ts` as the authoritative Serial domain model.<br>- Introduced `ISerialSettings` as a standalone config model separate from session state.<br>- Used discriminated union `ISerialResult` consistent with `ICompileResult` / `IUploadResult`.<br>- Designed per-port payloads to support future multi-board monitoring without redesign.                                                                                                                                                                                                                                                                                        | - Debated generalized EventBus vs. dedicated `SerialEventBus`; deferred consolidation to future modernization phase.                                                         | - No runtime behavior added. Zero IPC, preload, Zustand, or UI changes in this slice.                                                                                                                                       | Phase 4, Slice 14 (Serial Backend).                                         |
| 2026-07-21 | Phase 4, Slice 14: Serial Backend                                                                                              | Yes       | - Created `SerialEventBus` mirroring `HardwareEventBus` pattern exactly.<br>- Introduced `ISerialParser` abstraction; `ReadlineSerialParser` is the default implementation wrapping `@serialport/parser-readline`.<br>- `SerialSession` owns one port connection; delegates to parser; emits typed events; never throws.<br>- `SerialService` manages session registry keyed by port path; all ops return typed results.                                                                                                                                                                                                                                         | - `SerialPortService` handles enumeration; `SerialService` handles communication — domains intentionally separate.                                                           | - New directory `src/main/serial/` created for all serial backend modules.<br>- No IPC, preload, Zustand, or UI changes in this slice.                                                                                      | Phase 4, Slice 15 (IPC Bridge).                                             |
| 2026-07-21 | Phase 4, Slice 15: Serial IPC Bridge                                                                                           | Yes       | - Created `serialIpcHandlers.ts` registering `serial:open`, `serial:close`, `serial:write` invoke handlers.<br>- Push events `serial:data` and `serial:statusChanged` forwarded to renderer via `webContents.send()` guarded against destroyed windows.<br>- Extended preload with typed `ISerialApi` matching hardware pattern exactly.                                                                                                                                                                                                                                                                                                                         | - Push events required guarding to prevent crashes if renderer window closed mid-session.                                                                                    | - Null-check on `webContents.isDestroyed()` before every `send()` call. `serialIpcHandlers.remove()` called on `before-quit` to close all open sessions.                                                                    | Phase 4, Slice 16 (Renderer State).                                         |
| 2026-07-21 | Phase 4, Slice 16: Serial Renderer State (Zustand)                                                                             | Yes       | - Extended `useAppStore` with 5 serial state fields and 7 serial actions.<br>- Per-port log buffers bounded at 1000 lines (oldest discarded when full).<br>- Push subscription handles stored at module scope — not in Zustand state — consistent with hardware pattern.<br>- `openSerial` sets status `connecting` optimistically before IPC call.                                                                                                                                                                                                                                                                                                              | - Zustand state must remain fully serializable; runtime subscription handles cannot live inside the store.                                                                   | - Module-level `_serialDataUnsubscribe` / `_serialStatusUnsubscribe` variables mirror the hardware `_hardwareUnsubscribe` pattern.                                                                                          | Phase 4, Slice 17 (UI Integration).                                         |
| 2026-07-25 | Phase 4, Slice 18: Stabilization, Architecture Audit & Production Readiness                                                    | Yes       | - Serial domain verified to follow Hardware/Upload conventions exactly (Object.freeze exports, IPC register/remove pattern, module-scope subscription handles, webContents guard, discriminated union results).<br>- Scaffold `ipcMain.on('ping')` removed — dangling listener with no cleanup.<br>- `SerialService.closeAll()` bug fixed — sessions were captured by key but looked up after `_sessions.clear()`, so all OS port handles leaked at shutdown.                                                                                                                                                                                                    | - `closeAll()` bug was silent — no error, no warning, just leaked OS port handles. Discovered during lifecycle audit by tracing the capture-then-clear-then-lookup sequence. | - Changed to capture `[..._sessions.values()]` before `_sessions.clear()` so each session reference is directly available for `close()` calls inside the async map.                                                         | Phase 5 (Project Templates).                                                |
| 2026-07-25 | Phase 5, Slices 19–21: Project Templates (Types, Registry, UI)                                                                 | Yes       | - Templates are renderer-only static data — no IPC, no Main process, no async code required.<br>- `ITemplateDefinition.boards` typed as `ReadonlyArray<SupportedBoard>` because `Object.freeze` widens literal array types; `as const` was tried first but produced a readonly tuple that was not assignable to the mutable `SupportedBoard[]` field. `ReadonlyArray` is the correct solution.<br>- `DEMO_FIRMWARE_SOURCE` in Editor removed and replaced by `selectedTemplate?.firmware`.<br>- `TemplateCard` is purely presentational; Projects page owns selection and navigation.                                                                            | - `Object.freeze` + `as const` produced `readonly ["arduino-uno", ...]` which TypeScript would not assign to `SupportedBoard[]`.                                             | - Changed field type to `ReadonlyArray<SupportedBoard>` in shared types — immutable by design, semantically accurate.                                                                                                       | Phase 6 (AI Firmware Generation).                                           |
| 2026-07-27 | Phase 6, Slice 22: Shared AI Domain Types                                                                                      | Yes       | - Created `project.ts` for canonical `IProjectDocument` runtime model with `schemaVersion: 1 as const` literal and `IProjectMetadata` provenance.<br>- Created `ai.ts` defining `IAIGenerateRequest` (with optional `context?`), `IAIProviderConfig`, `IAIRawResponse`, `AIErrorCode`, and `IAIResult` discriminated union.<br>- Updated `ipc.ts` with `AiIpcChannels` (`ai:generate`).<br>- All models immutable by design (ADR-010, ADR-013, ADR-016).                                                                                                                                                                                                         | None. Types designed cleanly per frozen architecture.                                                                                                                        | N/A                                                                                                                                                                                                                         | Phase 6, Slice 23 (AI Main Backend).                                        |
| 2026-07-27 | Phase 6, Slice 23: AI Main Process Backend                                                                                     | Yes       | - `PromptBuilder` is pure — no network, no imports beyond shared types, deterministic output.<br>- `AIClient` uses native `fetch()` + `AbortController`; timeout always cleared in `finally`.<br>- `MockAIClient` returns a real IAIRawResponse JSON string — processed through the full pipeline, not bypassed.<br>- `ResponseParser` implements three fallback strategies to handle LLM formatting variance.<br>- `ResponseValidator` coerces `undefined notes → null` to handle LLM optional field variance.<br>- `AIService` is the only orchestration layer; maps `IAIRawResponse → IProjectDocument` in one place. Provider config never reaches Renderer. | None. Clean separation of concerns enforced by SRP at every module boundary.                                                                                                 | N/A                                                                                                                                                                                                                         | Phase 6, Slice 24 (IPC Bridge).                                             |
| 2026-07-27 | Phase 6, Slice 24: AI IPC Bridge & Preload                                                                                     | Yes       | - `aiIpcHandlers` follows `register()`/`remove()` pattern identical to hardware, upload, and serial handlers.<br>- No push events in V0.1 — invoke/response only.<br>- Preload `aiApi` exposes only `generate()`. API key never visible to Renderer.                                                                                                                                                                                                                                                                                                                                                                                                             | None.                                                                                                                                                                        | N/A                                                                                                                                                                                                                         | Phase 6, Slice 25 (Zustand AI State).                                       |
| 2026-07-27 | Phase 6, Slice 25: Zustand AI State                                                                                            | Yes       | - Single-store architecture preserved — AI state added to `useAppStore`, no second store created.<br>- `currentProjectDoc` is the authoritative runtime model; `selectedTemplate` retained as backward-compatibility shim.<br>- `selectTemplate()` dual-writes `currentProjectDoc` + `selectedTemplate` to avoid breaking existing consumers.<br>- `clearProject()` atomically resets all three fields. `clearTemplate()` retained as a deprecated shim calling `clearProject()`.                                                                                                                                                                                | - Previous `multi_replace_file_content` attempts on `useAppStore.ts` produced partial updates due to file size (>900 lines). Verified line content before every target.      | - Used `view_file` with exact line ranges before every edit; confirmed target strings verbatim.                                                                                                                             | Phase 6, Slice 26 (Editor UI).                                              |
| 2026-07-27 | Phase 6, Slice 26: Editor UI Integration                                                                                       | Yes       | - Editor now reads exclusively from `currentProjectDoc` — completely agnostic to project origin.<br>- `PromptInput` sub-component wires textarea → `generateAiProject()` through Zustand. `window.api.ai` never called from React.<br>- Skeleton loaders fill both panels during `aiLoading`.<br>- `boardHint` derived from `IBoard.type` + FQBN because `IBoard` has no `boardHint` field. Mapping documented for Phase 7 review.<br>- Both template and AI origins render through the same `currentProjectDoc` pipeline — the Editor cannot distinguish between them.                                                                                          | - `IBoard` does not have a `boardHint` field — derivation required mapping from `type` + FQBN substring.                                                                     | - Implemented `type`-based mapping in the Editor; documented the derivation for future extraction to the hardware domain.                                                                                                   | Phase 6, Slice 27 (Stabilization).                                          |
| 2026-07-27 | Phase 6, Slice 27: Production Readiness, Stabilization & Final Audit                                                           | Yes       | - `AIService.generate()` dead code block removed; `AI_PROVIDER=mock` override now correctly activates `MockAIClient`.<br>- `selectedTemplate` JSDoc updated to `@deprecated` with migration guidance.<br>- `CHANGELOG.md` and `memory.md` brought fully current for Slices 23–27.<br>- Full audit: architecture, SRP, IPC boundary, Renderer/Main boundary, no window.api.ai in React, no throws from AIService, all discriminated unions typed, no unused imports, no dead code remaining.                                                                                                                                                                      | - `AI_PROVIDER=mock` override was silently broken: old `effectiveMock = config === null` ignored the env var.                                                                | - Consolidated into a single expression: `effectiveMock = config === null \|\| AI_PROVIDER === 'mock'`.                                                                                                                     | Phase 7 planning.                                                           |

---

# Lessons Learned

### Template

| Date | Observation | Root Cause | Resolution | Recommendation |
| ---- | ----------- | ---------- | ---------- | -------------- |
|      |             |            |            |                |

---

# Known Issues

| Issue | Priority | Status | Workaround | Owner |
| ----- | -------- | ------ | ---------- | ----- |
|       |          |        |            |       |

---

# Technical Debt

| Debt                                                             | Reason                                                                                                                                        | Risk                                                                                                                                   | Planned Fix                                                                |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `selectedTemplate: ITemplateDefinition \| null` in Zustand state | Retained for backward compatibility after Slice 26 Editor migration. `selectTemplate()` dual-writes `currentProjectDoc` + `selectedTemplate`. | Low — no active consumer reads `selectedTemplate` in the Editor. Risk is confusion for future contributors who see two project fields. | Remove in Phase 7. Migrate any remaining consumers to `currentProjectDoc`. |
| `clearTemplate()` action in `useAppStore.ts`                     | Marked `@deprecated`; delegates to `clearProject()`. Retained to avoid breaking any external caller that may reference the name.              | Very low — only internal code uses this action.                                                                                        | Remove in Phase 7 along with `selectedTemplate`.                           |
| `currentProject: IProject \| null` in Zustand state              | Phase 1 placeholder. No React component reads it. Retained to avoid a breaking rename mid-phase.                                              | Very low — inert state field.                                                                                                          | Remove in Phase 7 once confirmed zero consumers.                           |
| `boardHint` derivation in `Editor/index.tsx`                     | Maps `IBoard.type` + FQBN to `SupportedBoard` locally in the Editor component. Should live in the hardware domain, not the UI layer.          | Low — logic is small and correct. Risk is drift if `SupportedBoard` values change.                                                     | Extract to a utility in `src/renderer/domain/hardware/` in Phase 7.        |

---

# Future Ideas

Store ideas without committing to implementation.
Examples:

- AI Circuit Verification
- Cloud Sync
- Plugin Marketplace
- Simulation

---

# Deferred Features

- OTA
- Cloud Dashboard
- Authentication
- Collaboration
- Institution Portal
- Multi-device Management

---

| Dependency             | Purpose                              | Added In | Notes                                                                   |
| ---------------------- | ------------------------------------ | -------- | ----------------------------------------------------------------------- |
| `zustand`              | State management                     | Phase 0  | Global store structure created                                          |
| `react-router-dom`     | Layout navigation & Routing          | Phase 0  | Clean page structure                                                    |
| `@monaco-editor/react` | Embedded editor component            | Phase 0  | Verified rendering                                                      |
| `lucide-react`         | Semantic icons library               | Phase 0  | Icons in UI                                                             |
| `@tailwindcss/vite`    | Tailwind CSS v4 compiler integration | Phase 0  | Replaced PostCSS                                                        |
| `serialport`           | Cross-platform serial port access    | Phase 2  | Used for listing ports in Phase 2; native streaming deferred to Phase 4 |

---

# Breaking Changes

| Version | Change | Reason | Migration |
| ------- | ------ | ------ | --------- |
|         |        |        |           |

---

# Phase 1 Conventions & Artifacts

- **Routing Architecture:** React Router DOM configured via `AppRouter.tsx` mapping to `AppLayout.tsx`.
- **Zustand Conventions:** `useAppStore.ts` stores pure UI state (`sidebarCollapsed`, `currentTheme`) alongside future placeholders (`boardStatus`, `uploadStatus`).
- **CSS Variables:** All visual values are driven by `--color-*`, `--shadow-*`, and `--radius-*` definitions in `main.css`.
- **Hybrid Theme:** Workspace uses Light Theme, while navigation (Top Bar, Sidebar) uses Dark Theme.
- **Top Bar:** Contains breadcrumbs, command search (Ctrl K), and global action buttons (Generate, Upload, Run).
- **Sidebar:** Contains navigation links, toggle state (Collapse/Expand), and active indicators using the primary accent color (`#5DD62C`).
- **Empty States:** The `EmptyWorkspace` component provides a consistent visual fallback for unoccupied screens.
- **Component Naming:** PascalCase for React components, semantic descriptive names (e.g., `IconButton`, `SkeletonLoader`).

---

# Phase 2 Prerequisites

Phase 1 technical debt (hardcoded colors) has been cleared. The UI is completely isolated from business logic. The application is ready to accept Node.js integration for Phase 2:

- Connect Arduino CLI
- Implement device detection
- Display real-time serial output

---

# Performance Notes

Track:

- Startup time
- Upload speed
- Memory usage
- CPU usage
- Serial performance

---

# AI Collaboration Log

After every AI implementation record:

- Prompt summary
- Files changed
- Decisions
- New dependencies
- Remaining work

---

# Contributor Checklist

Before major changes read:

- PRD.md
- ARCHITECTURE.md
- RULES.md
- DESIGN.md
- PHASES.md
- MEMORY.md

---

# Success Criteria

A new contributor should understand:

1. Why previous decisions were made.
2. Current project state.
3. Outstanding work.
4. Next priorities.

---

# Final Principle

> **Never allow important project knowledge to exist only in someone's memory.**

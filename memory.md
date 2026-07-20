# MEMORY.md

**Project:** IoTOS AI  
**Document:** Project Memory & Engineering Journal  
**Version:** 2.0  
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

---

# Current Status

- **Current Phase:** Phase 3: Firmware Upload (Slices 8-12 complete)
- **Current Milestone:** M2: Upload Pipeline Validated & Stabilized
- **Overall Progress:** Phase 1 (100%), Phase 2 (100%), Phase 3 (100%)
- **Last Updated:** July 20, 2026

---

# Technology Snapshot

- **Desktop:** Electron
- **Frontend:** React, TypeScript, Tailwind CSS, Monaco Editor
- **State:** Zustand
- **Hardware:** Arduino CLI, SerialPort
- **AI:** OpenAI Compatible API
- **Supported Hardware:** Arduino Uno, Arduino Nano, ESP32 DevKit

---

| Date       | Objective                                                                                                                      | Completed | Decisions                                                                                                                                                                                                                                                                                                              | Problems                                                                                                                                                                 | Solutions                                                                                                                                                                                                                   | Next Session                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 2026-07-18 | Scaffold Electron + React + TS project, structure folders, and configure Tailwind v4, Zustand, Monaco, and preload IPC bridge. | Yes       | - Refactored default nested `src/renderer/src` to flat `src/renderer` matching `ARCHITECTURE.md`. <br> - Used Tailwind v4 Vite plugin.                                                                                                                                                                                 | - electron-vite template placed React code inside `src/renderer/src`. <br> - Tailwind v4 caused build failure with standard PostCSS setup.                               | - Updated tsconfig.web.json, aliases, and index.html to target direct `src/renderer/` root. <br> - Switched to native `@tailwindcss/vite` plugin and removed postcss/tailwind config files.                                 | Begin Phase 1 (Application Shell, Sidebar navigation, page layout mockups). |
| 2026-07-19 | Implement Phase 1: Application Shell                                                                                           | Yes       | - Hybrid Theme (Light workspace, Dark Sidebar/TopBar) instead of Dark-first.<br>- Premium visual language inspired by Cursor/Arc.<br>- CSS variables in `main.css` for semantic styling.<br>- Topbar/Sidebar specific styling conventions.<br>- Shared UI components (`Button`, `Card`, `Badge`, `EmptyWorkspace`).    | - UI initially felt like a generic Tailwind dashboard.<br>- Hardcoded hex values caused technical debt.                                                                  | - Redesigned to use a Hybrid Theme.<br>- Refactored hardcoded hex codes into semantic CSS tokens and Tailwind v4 variables.                                                                                                 | Begin Phase 2 (Hardware Detection & Serial Communication).                  |
| 2026-07-19 | Phase 2, Slices 1-3: Hardware Abstraction & Services                                                                           | Yes       | - Rejected monolithic service pattern for a decoupled `HardwareManager` + pure domain services.<br>- Created static, immutable `HardwareRegistry`.<br>- Resolved CH340 ambiguity by returning multiple candidates instead of guessing.<br>- Adopted discriminated union `IIdentificationResult`.                       | - `serialport` native bindings failed to rebuild locally on Windows due to missing VS Build Tools.<br>- Multiple clone boards share the exact same VID/PID (e.g. CH340). | - Deferred native port opening to Phase 4; used `SerialPort.list()` for Phase 2 enumeration.<br>- Designed `HardwareRegistry.findBoardsByVidPid` to surface ambiguity, letting `BoardIdentificationService` use heuristics. | Phase 2, Slice 4 (HardwareManager & EventBus).                              |
| 2026-07-19 | Phase 2, Slice 4: HardwareManager & EventBus                                                                                   | Yes       | - Implemented `HardwareManager` as a pure orchestrator with dependency injection.<br>- Removed premature `selectBoard` functionality to respect the vertical slice philosophy.<br>- Created strongly typed `HardwareEventBus` using Node.js `EventEmitter`.                                                            | - Premature board selection logic was introduced without a legitimate caller.                                                                                            | - Removed `selectBoard` and `selectedBoardId` state from this slice, deferring it to Slice 5 (IPC), 6 (Zustand), and 7 (UI).                                                                                                | Phase 2, Slice 5 (IPC Bridge).                                              |
| 2026-07-20 | Phase 2, Slices 5 & 6: IPC Bridge & Renderer State                                                                             | Yes       | - Created typed IPC boundary.<br>- Extended `useAppStore` with hardware slice.<br>- Runtime subscription handles (`_hardwareUnsubscribe`) intentionally kept outside Zustand state (in module scope) to keep store strictly serializable.                                                                              | - `hardware:refresh` was originally identical to `getState` and not triggering real I/O.<br>- Unsubscribe handle initially placed inside Zustand state.                  | - Fixed `refresh` IPC handler to invoke actual re-scan.<br>- Moved subscription handle to private module-level variable.                                                                                                    | Phase 2, Slice 7 (UI Integration).                                          |
| 2026-07-20 | Phase 3, Slices 8-10: Upload Backend, IPC Bridge, & Renderer State                                                             | Yes       | - Split upload into independent `compile` and `upload` operations, using `ICompiledFirmware` as intermediate artifact.<br>- Delegated via pure `UploadIpcChannels`.<br>- Extended global Zustand store with upload actions delegating to preload API, preserving serializable state.                                   | - Duplicate firmware compilations could occur on retries.<br>- Combining domains would bloat IPC / State files.                                                          | - Redesigned UploadService to produce and consume `ICompiledFirmware`.<br>- Kept upload IPC and Zustand state separate from hardware domains.                                                                               | Phase 3, Slice 11 (Upload UI).                                              |
| 2026-07-20 | Phase 3, Slice 11: Upload UI Integration                                                                                       | Yes       | - Wired TopBar Upload button to `compileAndUploadFirmware` via Zustand.<br>- Added `firmwareSource` prop to TopBar so only the Editor page can trigger upload.<br>- Used demo Blink sketch as placeholder until Monaco editor is wired.                                                                                | - No Monaco editor yet, needed a real firmware source for testing.                                                                                                       | - Added `DEMO_FIRMWARE_SOURCE` const in Editor with a clear TODO comment. Status strip reuses existing design tokens — no new components.                                                                                   | Phase 3, Slice 12 (Stabilization).                                          |
| 2026-07-20 | Phase 3, Slice 12: End-to-End Upload Stabilization                                                                             | Yes       | - Removed stale future-tense forecasts from UploadService and ipc.ts headers.<br>- Simplified `createTempBuild` to return only `buildPath` (not the derivable `sketchDir`).<br>- Renamed `uploadFailed` to `hasUploadError` in TopBar for precision.<br>- Clarified ipc.ts payload type aliases as documentation-only. | - Stale comments persisted from implementation phase.<br>- `createTempBuild` had an unused return value.                                                                 | - Targeted surgical cleanup only; no architectural changes.                                                                                                                                                                 | Phase 4 planning.                                                           |

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

| Debt | Reason | Risk | Planned Fix |
| ---- | ------ | ---- | ----------- |
|      |        |      |             |

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

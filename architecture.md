# ARCHITECTURE.md

**Project:** IoTOS AI

**Version:** 1.2

**Status:** Source of Truth

---

# 1. Purpose

This document defines the technical architecture of IoTOS AI.

It answers:

- How the application is structured.
- How modules communicate.
- Where code belongs.
- How future features should be added.
- What boundaries must never be crossed.

This document is intentionally long-lived. Features may change, but the
architecture should remain stable.

---

# 2. Architecture Goals

The architecture must:

- Remain modular.
- Support future product growth.
- Keep hardware isolated from the UI.
- Allow AI providers to be replaced without affecting other modules.
- Minimize coupling between services.
- Support additional embedded platforms in future versions.

---

# 3. Architectural Non-Goals

Prototype V0.1 intentionally avoids:

- Microservices
- Distributed systems
- Cloud-first design
- Plugin loading
- Remote synchronization
- Complex networking infrastructure

---

# 4. Engineering Philosophy

> **Build for tomorrow. Ship today.**

The architecture must support the future product while implementing only
the Investor Demo (V0.1).

Future features influence architecture.

They **must not** influence implementation scope.

---

# 5. Architectural Principles

1. Separation of Concerns
2. Single Responsibility
3. Modular Services
4. IPC-first Communication
5. Local-first Application
6. AI is a Service, Never the Controller
7. Hardware Abstraction
8. Extensibility over Shortcuts
9. Predictability over Cleverness
10. Reliability before Features

---

# 6. System Overview

```
React UI
    │
Renderer Process
    │
Preload Bridge
    │
Electron IPC
    │
Main Process
    │
Core Services
    │
├── Arduino CLI
├── SerialPort
└── AI Provider
```

---

# 7. Data Flow

```
User
 ↓
React UI
 ↓
IPC
 ↓
Main Process
 ↓
BoardService
 ↓
Arduino CLI
 ↓
Hardware
 ↓
SerialPort
 ↓
Main Process
 ↓
IPC
 ↓
Device Monitor
```

---

# 8. Layer Responsibilities

## Presentation Layer

- User Interface
- Navigation
- User Interaction

## Application Layer

- Workflow Coordination
- IPC
- Service Orchestration

## Service Layer

- Business Logic
- Board Management
- AI
- Upload
- Projects

## Infrastructure Layer

- Hardware
- File System
- Arduino CLI
- Serial Communication
- AI Provider

---

# 9. Technology Stack

| Technology            | Purpose                |
| --------------------- | ---------------------- |
| Electron              | Desktop runtime        |
| React                 | User Interface         |
| TypeScript            | Type safety            |
| Vite                  | Build tool             |
| Tailwind CSS          | Styling                |
| Zustand               | State management       |
| Monaco Editor         | Firmware editor        |
| Arduino CLI           | Compile & Upload       |
| serialport            | USB communication      |
| OpenAI-compatible API | AI firmware generation |

---

# 10. Repository Structure

```
docs/

src/
 ├── main/
 │    ├── services/
 │    ├── ipc/
 │    ├── hardware/
 │    └── ai/
 │
 ├── preload/
 │
 ├── renderer/
 │    ├── pages/
 │    ├── components/
 │    ├── layouts/
 │    ├── store/
 │    ├── hooks/
 │    └── styles/
 │
 └── shared/

templates/

assets/

tests/
 ├── unit/
 ├── integration/
 └── e2e/
```

Every directory has one owner and one purpose.

---

# 11. Electron Responsibilities

## Renderer

Owns:

- UI
- Navigation
- Editor
- Forms
- Rendering

Never owns:

- Hardware
- Serial
- Filesystem
- CLI
- AI secrets

## Main Process

Owns:

- Hardware
- AI
- CLI
- Files
- IPC

## Preload

Exposes a minimal, typed bridge.

---

# 12. Core Services

## BoardService

- Detect boards
- Detect ports
- Monitor connect/disconnect

## UploadService

- Compile
- Upload
- Progress
- Friendly errors

## SerialService

- Open port
- Read stream
- Auto reconnect
- Clear logs

## AIService

Responsibilities:

- Prompt templates
- Prompt versioning
- Provider abstraction
- Retry strategy
- Response validation
- Response sanitization

Returns:

- Firmware
- Explanation
- Wiring
- Components

## TemplateService

Provides:

- Blink LED
- Temperature Monitor
- Relay Control

## ProjectService

- Save
- Load
- Recent Projects
- Workspace Management

## SettingsService

Stores:

- Theme
- Baud Rate
- Preferences

---

# 13. IPC Contracts

```
board:getConnected
board:watch

upload:start
upload:cancel

serial:start
serial:stop
serial:clear

ai:generate

project:new
project:open
project:save

settings:get
settings:set
```

IPC contracts are treated as stable public APIs.

---

# 14. State Management

## Global State

- Current board
- Current project
- Upload status
- AI status
- Serial status

## Persisted State

- Theme
- Preferences
- Recent projects

## Component State

- Dialogs
- Forms
- Selection

---

# 15. Configuration

Application configuration is stored separately from user projects.

Includes:

- Theme
- AI Provider
- Serial Defaults
- CLI Paths
- Preferences

---

# 16. Logging

Development:

- Verbose logging

Production:

- Warnings
- Errors only

Sensitive information is never logged.

---

# 17. Upload Flow

```
Editor
 ↓
Temporary Sketch
 ↓
Compile
 ↓
Upload
 ↓
Reconnect Serial
 ↓
Live Output
```

---

# 18. AI Flow

```
Prompt
 ↓
Prompt Builder
 ↓
LLM
 ↓
Validator
 ↓
Structured Response
 ↓
Editor
```

The UI never parses raw LLM output.

---

# 19. Project Model

There is exactly one editable project model: `IProjectDocument`.

- Templates are reusable project definitions. They are read-only and are
  never themselves edited.
- Projects are editable working copies of `IProjectDocument`. Every
  project — however it was created — is the same runtime model.
- No project-creation path introduces a second document shape, a
  specialized service, or a specialized persistence format.
- Selecting a template, generating with AI, and creating a project
  manually all produce the same `IProjectDocument`. They differ only in
  how its initial fields are populated — never in shape, lifecycle, or
  the services that operate on it.

---

# 20. Project Origin

`ProjectOrigin`: `template` | `ai` | `manual`

- Assigned automatically at the moment a project is created.
- Immutable — never changed after creation.
- Metadata only. It records how a project came to exist; it never gates
  what a project can do.
- No subsystem may change behavior because of `ProjectOrigin` unless a
  future specification explicitly introduces such behavior.
- The only permitted observable use is presentation (for example, an
  origin badge in the Editor) — a Renderer/UI concern, never a Service
  or IPC-layer branch.

---

# 21. Project Creation Flows

Every project — however it is created — converges on the same
`IProjectDocument` before it reaches the Editor.

## Template → Project (unchanged)

```
Template Definition (static, Renderer-owned)
 ↓
selectTemplate()
 ↓
IProjectDocument (origin: template)
 ↓
Editor
```

## AI → Project (unchanged — see § AI Flow)

```
Prompt → AIService → Structured Response → IProjectDocument (origin: ai) → Editor
```

## Manual → Project (new)

```
Create New Project form (name, board, storage location)
 ↓
Construction into IProjectDocument
 ↓
IProjectDocument (origin: manual)
 ↓
Editor
```

Today this construction happens in the Renderer, following the existing
template-selection pattern. That is a description of the current
implementation, not a permanent constraint — the binding rule is the
invariant below, not the mechanism.

## Open Existing → Project (new entry point)

```
Native file picker (Main Process)
 ↓
project:open (existing IPC channel, unchanged)
 ↓
ProjectService.open()
 ↓
Reconstructed IProjectDocument (origin: as stored)
 ↓
Editor
```

## Notes

- **The invariant is convergence, not mechanism.** Every creation path
  must produce the same runtime `IProjectDocument` before the project
  enters the Editor. How that document is constructed today (in the
  Renderer, without an IPC round trip, for Template and Manual creation)
  is the current implementation — it may evolve in future revisions
  without breaking Phase 9's design, as long as the invariant holds.
- Manual creation follows the current template-selection pattern. It
  introduces no new project model, no new persistence model, and no new
  service ownership — it does not use `project:new`, and no such handler
  is implemented. Project creation for every origin (template, AI,
  manual) reaches the Editor before any file exists on disk, and is
  persisted only through the existing save pipeline (see § Project
  Lifecycle).
- Open Existing Project reuses the existing `project:open` channel and
  `ProjectService.open()` unchanged. The only new element is obtaining a
  file path via a Main-process-only native picker, consistent with the
  existing filesystem-access rules in § Security — not a new
  persistence system.

---

# 22. Project Lifecycle

```
Creation
 ↓
Editing
 ↓
Saving
 ↓
Reopening
 ↓
Uploading
 ↓
Monitoring
```

> **A project may exist entirely in memory before it exists on disk.**

This is an architectural invariant, not an implementation detail. It
applies equally to template projects, AI-generated projects, and
manually created projects. All three begin their lifecycle unsaved and
in-memory in the Editor, and become persisted only through the existing
save pipeline — never through an eager or origin-specific write at
creation time.

This lifecycle is identical regardless of `ProjectOrigin`. Save,
Autosave, Upload, and Device Monitor all operate on `IProjectDocument`
alone — none of them read or branch on `ProjectOrigin`.

For manually-created projects specifically: the storage location chosen
during creation is the destination the existing save pipeline writes to
on first save, not an eager write at creation time — keeping persistence
timing identical across all three origins.

---

# 23. Phase 9 Ownership

Phase 9 introduces no new ownership boundaries. It adds two new callers
of existing, unchanged ownership.

- **Renderer** — constructs every `IProjectDocument`, regardless of
  origin. The new manual-creation action follows the same pattern as
  template selection: construction happens entirely in the Renderer,
  followed by a single atomic state replacement.
- **Preload** — exposes the existing `project:*` bridge; unchanged.
- **IPC** — remains orchestration only. The existing `project:open`
  channel gains a second caller (the new "+" entry point) but no new
  channel, payload shape, or business logic.
- **ProjectService** — remains the sole owner of reading and writing a
  project file on disk. Phase 9 requires zero new methods on this
  service.
- **SettingsService** — untouched by Phase 9.
- **AIService** — untouched by Phase 9.
- **Template assets** — remain Renderer-owned, static, read-only data,
  unchanged by Phase 9.
- **Project persistence** — remains entirely within ProjectService.
  Phase 9 adds no new persistence path, file format, or storage
  mechanism beyond the existing save pipeline.
- **Current project** — remains Renderer/Zustand global state (see §
  State Management), populated identically regardless of origin.

---

# 24. Phase 9 — Out of Scope

Do not introduce:

- User templates
- Template editing
- Import systems
- Git
- Cloud
- Workspaces (beyond the existing single workspace root)
- Multiple simultaneously open projects

---

# 25. Error Strategy

## Developer Errors

- Logged with details

## User Errors

- Friendly messages
- Actionable guidance

## Recovery

- Retry where possible
- Prevent crashes

---

# 26. Security

Only the Main Process can:

- Spawn processes
- Access filesystem
- Open serial ports
- Execute Arduino CLI
- Access API keys

Renderer remains sandboxed.

---

# 27. Dependency Rules

- UI never imports hardware libraries.
- Services never import React.
- No circular dependencies.
- AIService cannot upload firmware.
- UploadService cannot call AIService.
- Hardware layer never knows about the UI.
- No subsystem branches on ProjectOrigin.

---

# 28. Testing Strategy

## Unit Tests

Business logic

## Integration Tests

IPC and services

## End-to-End Tests

Complete investor workflow

---

# 29. Future Extension Points

Reserved placeholders:

- OTAService
- DashboardService
- CloudSyncService
- PluginManager
- CircuitVerificationService

These remain unimplemented in V0.1.

---

# 30. Performance Targets

- Startup < 3 seconds
- Board Detection < 2 seconds
- Responsive UI during upload
- Asynchronous operations throughout

---

# 31. Version Compatibility

Architecture Version: 1.2

Prototype: V0.1

Future versions should extend existing modules rather than breaking
public interfaces.

---

# 32. Definition of Good Architecture

A new engineer should locate the correct place for any feature in under
five minutes.

New functionality should require adding modules instead of rewriting
existing ones.

---

# 33. Final Engineering Rule

Every architectural decision must strengthen one experience:

> **Describe → Generate → Upload → Run**

If a feature does not improve that workflow, defer it to a future
version.

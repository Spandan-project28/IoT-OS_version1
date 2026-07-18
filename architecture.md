# ARCHITECTURE.md

**Project:** IoTOS AI

**Version:** 1.1

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

# 19. Error Strategy

## Developer Errors

- Logged with details

## User Errors

- Friendly messages
- Actionable guidance

## Recovery

- Retry where possible
- Prevent crashes

---

# 20. Security

Only the Main Process can:

- Spawn processes
- Access filesystem
- Open serial ports
- Execute Arduino CLI
- Access API keys

Renderer remains sandboxed.

---

# 21. Dependency Rules

- UI never imports hardware libraries.
- Services never import React.
- No circular dependencies.
- AIService cannot upload firmware.
- UploadService cannot call AIService.
- Hardware layer never knows about the UI.

---

# 22. Testing Strategy

## Unit Tests

Business logic

## Integration Tests

IPC and services

## End-to-End Tests

Complete investor workflow

---

# 23. Future Extension Points

Reserved placeholders:

- OTAService
- DashboardService
- CloudSyncService
- PluginManager
- CircuitVerificationService

These remain unimplemented in V0.1.

---

# 24. Performance Targets

- Startup < 3 seconds
- Board Detection < 2 seconds
- Responsive UI during upload
- Asynchronous operations throughout

---

# 25. Version Compatibility

Architecture Version: 1.1

Prototype: V0.1

Future versions should extend existing modules rather than breaking
public interfaces.

---

# 26. Definition of Good Architecture

A new engineer should locate the correct place for any feature in under
five minutes.

New functionality should require adding modules instead of rewriting
existing ones.

---

# 27. Final Engineering Rule

Every architectural decision must strengthen one experience:

> **Describe → Generate → Upload → Run**

If a feature does not improve that workflow, defer it to a future
version.

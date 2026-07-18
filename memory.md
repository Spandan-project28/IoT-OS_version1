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

- **Current Phase:** Phase 1: Application Shell (Phase 0: Foundation complete)
- **Current Milestone:** M0: Foundation Bootstrapped, Verified, and Audited
- **Overall Progress:** Phase 0 (100% complete)
- **Last Updated:** July 18, 2026

---

# Technology Snapshot

- **Desktop:** Electron
- **Frontend:** React, TypeScript, Tailwind CSS, Monaco Editor
- **State:** Zustand
- **Hardware:** Arduino CLI, SerialPort
- **AI:** OpenAI Compatible API
- **Supported Hardware:** Arduino Uno, Arduino Nano, ESP32 DevKit

---

| Date       | Objective                                                                                                                      | Completed | Decisions                                                                                                                              | Problems                                                                                                                                   | Solutions                                                                                                                                                                                   | Next Session                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 2026-07-18 | Scaffold Electron + React + TS project, structure folders, and configure Tailwind v4, Zustand, Monaco, and preload IPC bridge. | Yes       | - Refactored default nested `src/renderer/src` to flat `src/renderer` matching `ARCHITECTURE.md`. <br> - Used Tailwind v4 Vite plugin. | - electron-vite template placed React code inside `src/renderer/src`. <br> - Tailwind v4 caused build failure with standard PostCSS setup. | - Updated tsconfig.web.json, aliases, and index.html to target direct `src/renderer/` root. <br> - Switched to native `@tailwindcss/vite` plugin and removed postcss/tailwind config files. | Begin Phase 1 (Application Shell, Sidebar navigation, page layout mockups). |

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

| Dependency             | Purpose                              | Added In | Notes                          |
| ---------------------- | ------------------------------------ | -------- | ------------------------------ |
| `zustand`              | State management                     | Phase 0  | Global store structure created |
| `react-router-dom`     | Layout navigation & Routing          | Phase 0  | Clean page structure           |
| `@monaco-editor/react` | Embedded editor component            | Phase 0  | Verified rendering             |
| `lucide-react`         | Semantic icons library               | Phase 0  | Icons in UI                    |
| `@tailwindcss/vite`    | Tailwind CSS v4 compiler integration | Phase 0  | Replaced PostCSS               |

---

# Breaking Changes

| Version | Change | Reason | Migration |
| ------- | ------ | ------ | --------- |
|         |        |        |           |

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

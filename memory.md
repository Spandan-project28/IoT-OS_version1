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

| Document | Purpose |
| --- | --- |
| PRD.md | Product vision |
| ARCHITECTURE.md | System architecture |
| RULES.md | Engineering standards |
| DESIGN.md | Design system |
| PHASES.md | Execution roadmap |
| MEMORY.md | Historical knowledge |

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

- **Current Phase:** To be updated
- **Current Milestone:** To be updated
- **Overall Progress:** To be updated
- **Last Updated:** To be updated

---

# Technology Snapshot

- **Desktop:** Electron
- **Frontend:** React, TypeScript, Tailwind CSS, Monaco Editor
- **State:** Zustand
- **Hardware:** Arduino CLI, SerialPort
- **AI:** OpenAI Compatible API
- **Supported Hardware:** Arduino Uno, Arduino Nano, ESP32 DevKit

---

# Development Journal

### Template
| Date | Objective | Completed | Decisions | Problems | Solutions | Next Session |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

---

# Lessons Learned

### Template
| Date | Observation | Root Cause | Resolution | Recommendation |
| --- | --- | --- | --- | --- |
| | | | | |

---

# Known Issues

| Issue | Priority | Status | Workaround | Owner |
| --- | --- | --- | --- | --- |
| | | | | |

---

# Technical Debt

| Debt | Reason | Risk | Planned Fix |
| --- | --- | --- | --- |
| | | | |

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

# Dependency Log

| Dependency | Purpose | Added In | Notes |
| --- | --- | --- | --- |
| | | | |

---

# Breaking Changes

| Version | Change | Reason | Migration |
| --- | --- | --- | --- |
| | | | |

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

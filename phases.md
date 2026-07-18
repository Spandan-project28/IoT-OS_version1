# Phases.md

**Version:** 1.0

**Current Target:** Investor Demo (Prototype V0.1)

**Deadline:** July 27

---

# Purpose

This document defines the implementation roadmap for IoTOS AI.

It determines:

- what should be built
- in which order
- dependencies
- completion criteria
- deferred functionality

This document controls implementation scope.

If a feature does not belong to the current phase, it must not be implemented.

---

# Development Philosophy

The project is built using **vertical slices**, not isolated frontend or backend development.

Every completed phase should produce a working improvement to the application.

Avoid building disconnected systems.

---

# Phase 0

## Foundation

### Goal

Create the project's technical foundation.

### Deliverables

- Electron
- React
- TypeScript
- Vite
- Tailwind CSS
- Monaco Editor
- React Router
- Zustand
- Folder structure
- IPC scaffold
- Build system
- Project configuration

### Completion Criteria

- Application launches successfully.
- Five-page navigation works.
- Dark theme implemented.
- Zero TypeScript errors.
- Zero lint errors.

Status:

✅ Complete before feature development begins.

---

# Phase 1

## Application Shell

### Goal

Build the complete interface without business logic.

### Pages

- Home
- Projects
- Editor
- Serial Monitor
- Settings

### Deliverables

- Navigation
- Sidebar
- Header
- Responsive layout
- Empty states
- Loading placeholders

### Do Not

- Detect hardware
- Generate AI
- Upload firmware

### Completion Criteria

User can navigate through the entire application.

---

# Phase 2

## Hardware Detection

### Goal

Detect supported boards automatically.

### Deliverables

- BoardService
- USB monitoring
- COM port detection
- Board identification
- Connection status

Supported Boards

- Arduino Uno
- Arduino Nano
- ESP32 DevKit

### Completion Criteria

Connecting or disconnecting a board updates the UI automatically.

---

# Phase 3

## Firmware Upload

### Goal

Upload firmware reliably.

### Deliverables

- UploadService
- Arduino CLI integration
- Progress reporting
- Friendly errors

### Completion Criteria

A hardcoded Blink sketch uploads successfully with one click.

---

# Phase 4

## Serial Monitor

### Goal

Display live device output.

### Deliverables

- SerialService
- Auto-scroll
- Clear logs
- Reconnect handling
- Connection status

### Completion Criteria

Device output appears immediately after upload.

---

# Phase 5

## Project Templates

### Goal

Provide beginner-friendly starting points.

### Templates

- Blink LED
- Temperature Monitor
- Relay Control

Each template includes:

- Firmware
- Description
- Components
- Expected Output

### Completion Criteria

Templates load directly into the editor.

---

# Phase 6

## AI Firmware Generation

### Goal

Generate Arduino and ESP32 firmware from natural language.

### Deliverables

- AIService
- Prompt builder
- Firmware generation
- Code explanation
- Wiring notes
- Component recommendations

### Completion Criteria

User enters a prompt and receives editable firmware.

---

# Phase 7

## Editor Integration

### Goal

Create a productive editing experience.

### Deliverables

- Monaco Editor
- Syntax highlighting
- Upload button
- AI Generate button

### Completion Criteria

Generated code can be edited and uploaded.

---

# Phase 8

## User Experience Polish

### Goal

Prepare for investor demonstration.

### Deliverables

- Animations
- Icons
- Empty states
- Friendly errors
- Progress indicators
- Loading animations
- UI refinements

### Completion Criteria

Application feels polished and responsive.

---

# Phase 9

## Testing & Stabilization

### Goal

Remove instability before demonstration.

### Testing Checklist

- Arduino Uno
- Arduino Nano
- ESP32 DevKit

Verify:

- Detection
- Upload
- Serial Monitor
- Templates
- AI generation
- Error handling

Fix bugs before adding features.

### Completion Criteria

The complete workflow succeeds repeatedly without crashes.

---

# Investor Demo Definition

Prototype V0.1 succeeds when a first-year student can:

1. Launch IoTOS AI.
2. Connect an Arduino or ESP32.
3. See automatic board detection.
4. Choose a template or describe a project.
5. Generate firmware.
6. Upload firmware.
7. Observe working hardware.
8. Read live Serial Monitor output.

No manual Arduino IDE.

No confusing setup.

No crashes.

---

# Deferred Features

The following belong to future versions:

- Cloud Dashboard
- OTA Updates
- Authentication
- Team Collaboration
- Plugin Marketplace
- Institution Portal
- AI Circuit Debugging
- AI Wiring Verification
- Component Recognition
- Cloud Synchronization
- Multi-device Management
- Simulation
- Mobile Application

These features must not be implemented during V0.1.

---

# Development Rules

Each phase must satisfy the following before moving forward:

- Builds successfully
- No TypeScript errors
- No lint errors
- Existing features remain functional
- Documentation updated
- Architecture respected
- Scope unchanged

Never proceed by leaving known issues unresolved.

---

# Final Principle

The objective of Prototype V0.1 is **not** to demonstrate the maximum number of features.

It is to demonstrate one seamless, dependable workflow that proves the core vision of IoTOS AI.

Every completed phase should bring the product one step closer to making this promise a reality:

> **Describe → Generate → Upload → Run**
> 

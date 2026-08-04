# rules.md

**Document:** rules.md

**Version:** 1.2

**Status:** Mandatory

**Applies To:** Every contributor (Human or AI)

---

# 1. Purpose

This document defines the engineering principles, implementation rules,
coding standards, and development philosophy of IoTOS AI.

Every implementation must comply with these rules.

If implementation conflicts with this document, these rules take
precedence unless intentionally revised.

---

# 2. Mission

IoTOS AI exists to simplify Arduino and ESP32 development through
AI-assisted tooling.

Prototype V0.1 is focused on delivering **one polished, reliable
end-to-end workflow** for the investor demonstration.

Success is measured by user experience, not feature count.

---

# 3. Engineering Values

Engineering decisions must prioritize:

1. Reliability
2. Simplicity
3. Beginner Experience
4. Maintainability
5. Extensibility
6. Performance

Never sacrifice reliability for additional features.

---

# 4. Scope Discipline

Only implement features listed in the active development phase.

Future roadmap items must never be implemented early.

If a requested feature belongs to a later version:

- Explain that it is out of scope.
- Prepare extension points if appropriate.
- Do not implement it.

**Feature creep is considered a defect.**

---

# 5. Architecture Rules

All implementation must comply with `architecture.md`.

Mandatory rules:

- Renderer never communicates directly with hardware.
- Renderer never accesses Node.js APIs.
- All privileged operations use IPC.
- Services never import React.
- Hardware modules never know about UI components.
- AI never uploads firmware.
- UploadService never generates firmware.
- Each module owns one responsibility.

Architectural boundaries must never be bypassed for convenience.

---

# 6. Service Design Rules

Every service must:

- Have one responsibility.
- Be independently testable.
- Expose a predictable public API.
- Hide implementation details.
- Minimize side effects.

Services should depend only on what they genuinely require.

---

# 7. Code Quality Standards

Code should optimize for:

1. Correctness
2. Readability
3. Maintainability
4. Performance
5. Cleverness

Prefer simple code over clever code.

Duplicate logic should be refactored.

---

# 8. TypeScript Standards

- Enable strict mode.
- Avoid `any`.
- Prefer interfaces for public contracts.
- Use descriptive names.
- Remove all TypeScript errors before merging.

---

# 9. Component Rules

React components must:

- Have one responsibility.
- Remain reusable.
- Stay reasonably small.
- Receive data through props or state.
- Avoid business logic.

Business logic belongs in services.

---

# 10. State Management

Global state contains only application-wide information.

Local UI state remains local.

Persist only information that must survive application restarts.

---

# 11. Error Handling

Every recoverable error must provide:

- A clear explanation.
- An actionable next step.
- A graceful recovery path.

Never expose:

- Stack traces
- Internal exceptions
- Arduino CLI output
- Implementation details

---

# 12. Logging

Development logs may contain technical information.

User-facing messages must remain simple.

Sensitive information must never be logged.

Production logs should prioritize warnings and errors.

---

# 13. AI Rules

AI is responsible only for:

- Firmware generation
- Code explanation
- Wiring guidance
- Component recommendations

AI must never:

- Upload firmware
- Detect hardware
- Manage serial communication
- Execute operating system commands
- Modify project architecture automatically

Every AI response must be validated before use.

---

# 14. UI Philosophy

The interface should feel:

- Calm
- Modern
- Minimal
- Predictable

Every screen should have one primary purpose.

Reduce cognitive load wherever possible.

---

# 15. User Experience Rules

Always:

- Automate repetitive work.
- Provide sensible defaults.
- Reduce clicks.
- Reduce configuration.
- Prefer guidance over documentation.

Beginners are the primary audience.

---

# 16. Performance Rules

The application must remain responsive during all operations.

- Long-running tasks must be asynchronous.
- UI should never freeze.
- Expensive work belongs outside the Renderer.

---

# 17. Security Rules

Secrets must never be hardcoded.

Only the Main Process may:

- Execute CLI commands
- Access the filesystem
- Access API keys
- Communicate with hardware

Renderer remains sandboxed.

---

# 18. Dependency Rules

Before adding a dependency, verify:

- It solves a real problem.
- Existing tools cannot solve it.
- It is actively maintained.
- Documentation is adequate.
- It does not unnecessarily increase complexity.

Avoid dependency bloat.

---

# 19. File Organization

Every file must have a single purpose.

Avoid:

- Utility dumping grounds
- Oversized files
- Duplicate logic
- Circular dependencies

Follow the folder structure defined in `architecture.md`.

---

# 20. Documentation Rules

Architecture changes require documentation updates in the same commit.

Documentation is treated as production code.

Comments should explain _why_, not _what_.

---

# 21. Git Standards

Every commit should:

- Represent one logical change.
- Build successfully.
- Avoid unrelated modifications.

Use clear, meaningful commit messages.

---

# 22. Testing Definition of Done

Before any feature is complete:

- Project builds successfully.
- TypeScript passes.
- Lint passes.
- No console errors.
- UI remains responsive.
- Error handling is verified.
- Existing functionality remains unaffected.

---

# 23. Out of Scope (Prototype V0.1)

Do not implement:

- Cloud Dashboard
- OTA Updates
- Authentication
- Collaboration
- Marketplace
- Institution Portal
- Plugin System
- AI Circuit Debugging
- Device Synchronization

These belong to future versions.

---

# 24. Decision Framework

Before implementing anything, ask:

1. Does this improve the beginner experience?
2. Does this improve reliability?
3. Does this respect the architecture?
4. Does this belong to the current phase?
5. Is there a simpler solution?

If any answer is “No”, reconsider the implementation.

---

# 25. Definition of Engineering Success

Engineering success means:

- Stable software
- Predictable architecture
- Clear code
- Happy beginners
- Minimal friction

Features alone are not success.

---

# 26. Phase 9 — Project Governance Rules

This section governs implementation of the project-centric workflow
defined in the frozen Phase 9 Product Vision, PRD.md, ARCHITECTURE.md,
DESIGN.md, and PHASES.md. It supplements the rules above; it does not
replace or relax any of them.

## Project Model

- There must always be exactly one editable project model:
  `IProjectDocument`. No creation path may introduce a second document
  shape, a specialized service, or a specialized persistence format.
- Templates are never editable. A template is a reusable definition;
  selecting one produces an independent, editable project. The template
  itself is never opened or modified.

## Project Origin

- `ProjectOrigin` is assigned automatically at creation and is
  immutable. No code path may set, change, or expose it as
  user-editable.
- Runtime behavior must never branch on `ProjectOrigin`, in any layer,
  unless a future approved specification explicitly introduces such
  behavior. Its only permitted observable use is a presentation label
  (for example, an origin badge) in the Renderer.

## Manual, Template, and AI-Generated Projects

- Manual, Template, and AI-generated projects must converge into the
  same `IProjectDocument` model, differing only in how their initial
  fields are populated — never in shape, lifecycle, persistence, or
  service ownership.
- No duplicate project-creation pipelines: a new origin must reuse the
  existing construction-and-atomic-state-replacement pattern already
  established by template selection, not introduce a parallel one.
- The existing template workflow (gallery, selection, and its current
  behavior) must remain unchanged by Phase 9 work.
- Open Existing Project must reuse the existing project-opening
  pipeline (`project:open` → `ProjectService.open()`) unchanged. It may
  add a new, Main-process-only entry point for obtaining a file path
  (a native picker); it must not introduce a second opening pipeline.

## Project Lifecycle

- A project may exist entirely in memory before it exists on disk. No
  origin may perform an eager or origin-specific write at creation
  time; persistence happens only through the existing save pipeline.
- Save, Autosave, Upload, and Device Monitor operate on
  `IProjectDocument` alone and must never read or branch on
  `ProjectOrigin`.

## Project Ownership, UI Ownership, and Responsibilities

- **Renderer** constructs every `IProjectDocument`, regardless of
  origin, and owns temporary UI state — for example, popup-menu open
  state and dialog form fields — as local component state, never
  Zustand, consistent with § State Management.
- **Zustand** holds only application-wide project state (the current
  document, dirty flag, current path). It never holds transient UI
  state belonging to a single component.
- **IPC** remains orchestration only. A handler that obtains a file
  path or any other OS-level value must do exactly that and nothing
  else — it must never embed business logic or call a service on the
  Renderer's behalf beyond what was explicitly requested.
- **Services** own all business logic. `ProjectService` remains the
  sole owner of reading and writing project files; no new persistence
  path, file format, or storage mechanism may be introduced.
- No service may call another service directly — this generalizes the
  same service-isolation principle already present in § Architecture
  Rules ("AI never uploads firmware," "UploadService never generates
  firmware") and applies equally to `ProjectService` and every other
  service.

## Out of Scope

The Phase 9 exclusion list is defined once, in PHASES.md, and is
authoritative there. Do not implement anything on that list on the
belief that this document permits it.

---

# 27. Final Rule

Every engineering decision must strengthen one promise:

> **Describe → Generate → Upload → Run**

If a feature, dependency, abstraction, or architectural decision does
not strengthen that workflow, postpone it.

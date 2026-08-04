# Phases.md

**Version:** 1.1

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

# Phase 9 (Original V0.1 Roadmap — Superseded)

## Testing & Stabilization

This phase, as originally planned, targeted stabilization of the V0.1
investor-demo scope described above. Actual development continued well
beyond that scope — real Phase 7 (Project Persistence) and real Phase 8
(AI Settings, Review, and Improve) shipped first, each ending in its own
stabilization slice. This phase's original intent was fulfilled by that
work, not by a standalone testing phase. Its content is retained below
for historical continuity of the original roadmap. The current, active
Phase 9 is defined in the section immediately following.

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

# Phase 9

## Project-Centric Workflow

### Goal

Implement the approved project-centric workflow: a "+" action on the
Projects page offering Create New Project and Open Existing Project,
while the existing built-in template workflow and every other existing
feature remain unchanged.

This phase implements the frozen Phase 9 Product Vision, PRD.md,
ARCHITECTURE.md, and DESIGN.md. Those four documents are the source of
truth for *what* is being built and *why*; this roadmap defines only
*in what order* and *in what shape*.

### Preserves (must remain unaffected)

- Built-in Project Templates and the existing template-selection flow
- AI Generation, AI Review, AI Improve
- Save / Save As
- Recent Projects
- Upload
- Device Monitor
- Settings
- The existing Editor workflow

### Out of Scope

Do not implement, in this phase or any slice within it:

- User Templates
- Template Editing
- Git
- Cloud
- Import Systems
- Workspace Manager
- Multiple Projects

### Slices

Five slices. Slices 2 and 3 may be built in either order, or in
parallel, once Slice 1 is complete. Slice 4 requires both Slice 2 and
Slice 3 to be complete. Slice 5 requires Slices 1–4 to be complete.

---

#### Slice 1 — Project Origin Foundation

**Objective**
Extend `ProjectOrigin` to include `manual`, and correct the Editor's
origin-label logic so it explicitly handles all three origins — closing
a known defect (a two-way ternary that assumes only two origins exist)
before any code can produce a `manual`-origin document.

**Scope**
A type-level change plus its one existing consumer. No new capability
is exposed. No new UI, IPC, or service.

**Files Created**
None.

**Files Modified**

- `src/shared/types/project.ts`
- `src/renderer/pages/Editor/index.tsx`

**Responsibility of Every Modified File**

- `project.ts` — widen `ProjectOrigin` from `'template' | 'ai'` to
  `'template' | 'ai' | 'manual'`. No other change.
- `Editor/index.tsx` — replace the two-way `originLabel` ternary with an
  explicit mapping covering all three origins (`template` → "Template",
  `ai` → "AI Generated", `manual` → "Manual"). No other change.

**Runtime Flow**
Unchanged for existing users. Template- and AI-origin projects render
the identical badge text as before. No new runtime path exists yet —
nothing in the running application can construct a `manual`-origin
document until Slice 2.

**Acceptance Criteria**

- `ProjectOrigin` is a three-member union; every existing usage still
  compiles without a cast.
- The Editor's origin badge is correct for `template` and `ai`
  (regression) and for a synthetic `manual` value (new).
- A repository-wide search confirms no other file assumes exactly two
  `ProjectOrigin` members.

**Manual Verification**

- `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- Select a template — badge still reads "Template." Generate with AI —
  badge still reads "AI Generated." (Regression check.)
- Using an isolated verification script (the project's established
  pattern for exercising store/UI logic outside the browser), construct
  a synthetic `IProjectDocument` with `origin: 'manual'` and confirm the
  label-resolution logic returns "Manual."

**Definition of Done**
Typecheck, lint, and build are clean; both existing origin badges are
unchanged; the label logic is provably correct for all three origins,
even though `manual` is not yet reachable by a real user action.

---

#### Slice 2 — Manual Project Construction

**Objective**
Add the Renderer-only capability to construct a brand-new, empty
`IProjectDocument` with origin `manual`, mirroring the existing
`selectTemplate()` pattern exactly, per ARCHITECTURE.md § Project
Creation Flows.

**Scope**
One new Zustand store action. No IPC, no Main-process change, no UI
trigger. This slice delivers a complete, correct, independently
verifiable capability that Slice 4 wires into the interface — the same
"state before UI" sequencing already used historically in this
repository (AI state landed before Editor UI integration).

**Files Created**
None.

**Files Modified**

- `src/renderer/store/useAppStore.ts`

**Responsibility of Every Modified File**

- `useAppStore.ts` — add one new action, `createManualProject(name,
  boardHint)`, that constructs a fresh `IProjectDocument`: a new id,
  `schemaVersion: 1`, the given title, empty firmware / description /
  explanation / components / wiring / expectedOutput, the given
  boardHint, and `metadata.origin: 'manual'`. It then performs the same
  atomic state replacement `selectTemplate()` already performs: cancels
  any pending autosave, clears `pendingAiCandidate` /
  `pendingAiCandidateMode` and `aiError`, and sets `projectDirty: false`
  and `currentProjectPath: null`. No other action's behavior changes.

**Runtime Flow**
Entirely in-memory, entirely in the Renderer. Calling the new action
synchronously replaces `currentProjectDoc` — no network, no filesystem,
no IPC round trip — consistent with the frozen architectural invariant
that a project may exist entirely in memory before it exists on disk.

**Acceptance Criteria**

- The new action produces an `IProjectDocument` satisfying the exact
  same shape every other origin already satisfies.
- `currentProjectPath` is `null` and `projectDirty` is `false`
  immediately after the call, identical to a freshly selected template.
- Calling the action while an AI candidate is pending discards that
  candidate, matching `selectTemplate()`'s existing behavior.
- No existing action, selector, or component changes behavior.

**Manual Verification**

- `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- An isolated verification script imports the store, calls the new
  action directly, and asserts: origin is `manual`; firmware,
  components, and wiring are empty; `currentProjectPath` is `null`;
  `projectDirty` is `false`; any previously-set `pendingAiCandidate` is
  cleared.
- Existing regression scripts for `selectTemplate()` and
  `generateAiProject()` are re-run and still pass, confirming no shared
  logic was disturbed.

**Definition of Done**
The action exists, is fully correct, and is verified end-to-end at the
store layer. It is not yet reachable from the UI — expected, and
completed in Slice 4.

---

#### Slice 3 — Open Existing Project Backend

**Objective**
Add the one new Main-process capability ARCHITECTURE.md calls for — a
native "Open File" picker — and a Renderer action that uses it to feed
the existing, unchanged `project:open` pipeline.

**Scope**
One new invoke channel whose entire responsibility is showing a native
file picker and returning a path or a cancelled result. Zero changes to
`ProjectService`, `WorkspaceService`, or the existing `project:open`
contract. One new Renderer action that calls the picker, then calls the
existing `openProject(filePath)` action on success and no-ops on
cancellation.

**Files Created**
None.

**Files Modified**

- `src/shared/types/ipc.ts`
- `src/shared/types/project-persistence.ts`
- `src/main/ipc/projectIpcHandlers.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/renderer/store/useAppStore.ts`

**Responsibility of Every Modified File**

- `ipc.ts` — add one new channel name to the existing
  `ProjectIpcChannels` object. No other channel changes.
- `project-persistence.ts` — add one new result type for the picker
  outcome: a discriminated union of a chosen path and a cancelled
  outcome, matching the existing `IProjectSaveAsResult` convention where
  cancellation is a distinct, non-error outcome. No existing type
  changes.
- `projectIpcHandlers.ts` — register one new `ipcMain.handle` for the
  new channel; its entire body calls `dialog.showOpenDialog` and
  returns the result. No filesystem read, no call to `ProjectService`.
  The existing `project:open` handler is untouched.
- `preload/index.ts` — expose the new method on the existing
  `window.api.project` surface.
- `preload/index.d.ts` — declare the new method's type on
  `IProjectApi`.
- `useAppStore.ts` — add one new action, `openExistingProject()`, that
  calls the new preload method. On a chosen path, it delegates entirely
  to the existing `openProject(filePath)` action. On cancellation, it
  does nothing and sets no error state — cancellation is not an error,
  consistent with the existing Save As precedent.

**Runtime Flow**
Renderer calls the new action → IPC invoke → Main process shows the
native OS picker → a path or cancellation returns to the Renderer → on
a path, the existing, unmodified `project:open` flow runs exactly as it
already does today for Recent Projects.

**Acceptance Criteria**

- The new IPC handler never touches `ProjectService` or the filesystem
  beyond showing the OS dialog.
- Cancelling the native picker leaves `currentProjectDoc`,
  `projectOpenError`, and every other field exactly as they were before
  the call.
- Choosing a valid file produces the identical result
  `openProject(filePath)` already produces today when called from
  Recent Projects.
- No existing IPC channel, handler, or preload method changes shape or
  behavior.

**Manual Verification**

- `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- From the running app's developer console, invoke the new preload
  method directly; confirm the native OS picker appears, and confirm
  cancelling it resolves to the cancelled result with no side effects.
- Choosing a real, valid project file through the same console call
  correctly populates `currentProjectDoc`, matching the outcome of
  opening the same file from Recent Projects.
- Existing regression scripts covering `openProject()`,
  `saveAsProject()`, and the recents list are re-run and still pass.

**Definition of Done**
The new channel and action exist, are fully correct, and are verified
end-to-end without any UI entry point. The "+" menu wiring that exposes
this to users is completed in Slice 4.

---

#### Slice 4 — Projects Page "+" Action, Popup Menu, and Create New Project Dialog

**Objective**
Deliver the complete, user-facing entry point described in DESIGN.md
§§ 42–45: the "+" action, its two-item popup menu, and the Create New
Project dialog — wired to the two complete backends built in Slices 2
and 3.

**Scope**
UI only. No new store logic, no new IPC, no new service. Both menu
items are wired and fully functional the moment this slice ships — per
the frozen DESIGN.md, the menu is never exposed to users with fewer
than its exact two working items, which is why this slice is sequenced
after both Slice 2 and Slice 3 are complete.

**Files Created**

- `src/renderer/components/projects/NewProjectMenu.tsx`
- `src/renderer/components/projects/CreateProjectDialog.tsx`

**Files Modified**

- `src/renderer/pages/Projects/index.tsx`

**Responsibility of Every Modified/Created File**

- `NewProjectMenu.tsx` (new) — the "+" action and its popup menu
  (DESIGN.md §§ 43–44): placement, icon, label, popup positioning,
  keyboard interaction (Arrow keys, Enter/Space, Escape), focus
  restoration, and the two menu items' click handlers. Owns only its
  own open/closed local state — no Zustand.
- `CreateProjectDialog.tsx` (new) — the Create New Project dialog
  (DESIGN.md § 45): Project Name, Target Board, and Storage Location
  fields; Cancel / Create / close-control buttons; validation gating
  Create; documented focus order; the discard-and-reset-on-close
  invariant. On submit, calls the Slice 2 action, then closes and lets
  the existing Editor route render the new project. Owns only its own
  form-field local state — no Zustand.
- `Projects/index.tsx` — renders `NewProjectMenu` in the page header,
  alongside the existing, completely unmodified Template Gallery;
  renders `CreateProjectDialog` conditionally on local "dialog open"
  state; wires the popup menu's "Open Existing Project" item directly
  to the Slice 3 action.

**Runtime Flow**

- Template path: entirely unchanged from today.
- Create New Project: "+" → menu → "Create New Project" → dialog opens
  → user fills the form → Create → the Slice 2 action runs → dialog
  closes → Editor renders the new, empty project.
- Open Existing Project: "+" → menu → "Open Existing Project" → the
  Slice 3 action runs → native picker → on a chosen file, Editor
  renders the opened project; on cancellation, the user is back on the
  Projects page exactly as before.

**Acceptance Criteria**

- The Template Gallery's markup, styling, and click-through behavior
  are unchanged.
- The popup menu always shows exactly two items; neither can be
  triggered independently of the other's availability.
- Every interaction, keyboard path, and focus behavior specified in
  DESIGN.md §§ 43–49 is implemented as written.
- Creating a project and opening an existing project both land in the
  Editor with the correct project active, using only the actions built
  in Slices 2 and 3 — no new business logic is introduced in this
  slice.

**Manual Verification**

- `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- Walk all three journeys from DESIGN.md § 48 by hand: template path,
  create-new path, open-existing path — each ends in the Editor with
  the correct project.
- Keyboard-only pass: reach "+" by Tab, open the menu with Enter,
  navigate items with Arrow keys, open the dialog, Tab through every
  field in the documented order, submit with Enter, and separately
  confirm Escape / Cancel / the close control all discard the form and
  return focus correctly.
- Confirm Recent Projects, Save / Save As, Autosave, Upload, and Device
  Monitor are all unaffected by manually exercising each one after
  using the new entry points.

**Definition of Done**
Phase 9's user-facing goal is fully realized; every existing feature
listed under Preserves continues to work exactly as before.

---

#### Slice 5 — Stabilization & Final Audit

**Objective**
Verify Phase 9 is complete, correct, and has not regressed anything
from Phase 8 or earlier, matching this project's established
end-of-phase stabilization precedent.

**Scope**
Verification, and — only if genuinely required by the audit — minor
non-behavioral corrections (stale comments, doc-comment accuracy). No
new functionality.

**Files Created**
None.

**Files Modified**
Only if a genuine stale-comment or doc-comment issue is found during
the audit (for example, a preload doc comment still describing a
channel this phase just implemented as unhandled). None are
pre-determined; this slice's scope is the audit itself, not a
pre-planned diff.

**Responsibility of Every Modified File**
Determined by audit findings, and limited strictly to comment or
documentation-string accuracy — never behavior.

**Runtime Flow**
Unchanged. This slice verifies; it does not add flow.

**Acceptance Criteria**

- A full regression pass across every isolated verification script from
  Slices 1–4, plus every pre-existing script from Phase 7 and Phase 8,
  passes.
- Zero TypeScript errors, zero lint errors, a successful production
  build.
- A manual walkthrough of every journey in DESIGN.md § 48, plus every
  Phase 8 feature (AI Generate / Review / Improve, Save / Save As,
  Recent Projects, Upload, Device Monitor, Settings), confirms zero
  regressions.
- No architecture violation, ownership ambiguity, or IPC violation is
  found anywhere across Slices 1–4.

**Manual Verification**

- Run the complete regression suite established across Phases 6–8, plus
  the new Slice 1–3 scripts.
- `npm run typecheck`, `npm run lint`, `npm run build`.
- A full manual pass through all three Phase 9 journeys and every
  preserved Phase 8 feature.

**Definition of Done**
Phase 9 is confirmed complete, stable, and non-regressive. The
roadmap's stated goal — implement the approved project-centric workflow
while preserving every existing feature — is verified true, not merely
assumed.

### Completion Criteria

A user can create a project from a template (unchanged), create a
blank project manually, or open an existing project file — all three
land in the same Editor, behave identically from that point forward,
and every feature present before Phase 9 still works exactly as it did
before Phase 9.

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
- User Templates
- Template Editing
- Git-based project workflows
- Import Systems (Arduino Sketch, PlatformIO)
- Workspace Manager
- Multiple simultaneously open projects

These features must not be implemented during V0.1 or Phase 9.

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

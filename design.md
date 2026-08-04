# DESIGN.md

**Project:** IoTOS AI

**Document:** Design System & UX Specification

**Version:** 2.1

**Status:** Source of Truth

> This document defines the complete visual language, interaction model,
> and user experience principles of IoTOS AI. Every UI decision must
> align with this document.

---

# 1. Vision

Design the most approachable desktop experience for Arduino and ESP32
development.

Users should feel like they are using a modern creative tool—not an
engineering utility.

---

# 2. Product Personality

IoTOS AI is:

- Friendly
- Intelligent
- Calm
- Professional
- Minimal
- Trustworthy
- Encouraging
- Predictable

Never intimidating.

---

# 3. Emotional Goals

Every session should make users feel:

- Curious
- Confident
- In control
- Productive
- Successful
- Motivated to continue learning

---

# 4. Brand Identity

**Positioning**

AI Copilot for Embedded Development.

**Brand Promise**

> Describe → Generate → Upload → Run

**Brand Attributes**

- Simple
- Reliable
- Educational
- Modern
- Human-centered

---

# 5. Design Philosophy

Every interface decision should optimize for:

1. Simplicity
2. Clarity
3. Consistency
4. Learnability
5. Speed
6. Accessibility

Visual beauty must never reduce usability.

---

# 6. Visual Language

Inspired by:

- Cursor
- Linear
- Raycast
- Vercel
- VS Code

Characteristics:

- Desktop-first
- Hybrid Theme (Light workspace, Dark Sidebar/TopBar)
- Spacious
- Soft elevation
- Rounded corners
- Minimal chrome
- Low visual noise

---

# 7. Color System

Semantic colors only.

Core tokens:

- Background
- Surface
- Elevated Surface
- Border
- Dark Background
- Dark Surface
- Dark Border
- Primary Accent
- Dark Accent
- Success
- Warning
- Error
- Info
- Text Primary
- Text Secondary
- Disabled

Never communicate state using color alone.

---

# 7.1 Hybrid Theme Philosophy

The application defaults to a hybrid aesthetic for high-contrast usability:

- **Workspace:** Light (#F8F8F8)
- **Sidebar:** Dark (#0F0F0F)
- **Top Bar:** Dark (#0F0F0F)
- **Floating UI/Badges (Dark Areas):** Dark Surface (#202020)
- **Panels & Cards (Light Areas):** Light Surface (#FFFFFF)
- **Primary Accent:** Green (#5DD62C) - Used sparingly for active states and glows.
- **Dark Accent:** Deep Green (#337418)

Green is an accent color. It must not be used as a dominant background.

---

# 8. CSS Variables

All visual values must use design tokens.

Examples:

- --color-primary
- --color-surface
- --font-body
- --space-4
- --radius-lg
- --shadow-md
- --duration-fast

Hardcoded visual values are prohibited.

---

# 9. Typography

Fonts

Primary: Inter

Monospace: JetBrains Mono

Hierarchy

- Display
- H1
- H2
- H3
- H4
- Body
- Caption
- Label
- Code

Maximum line length: ~75 characters.

---

# 10. Spacing System

Use an 8-point spacing scale.

Valid spacing:

4, 8, 16, 24, 32, 40, 48, 64, 80

---

# 11. Grid System

Desktop optimized.

Layout:

Sidebar | Workspace | Utility Panel (optional)

Maintain consistent gutters and alignment.

---

# 12. Layout Rules

Every page contains:

- Sidebar
- Top Bar
- Main Workspace

One primary task per screen.

Avoid nested scrolling.

---

# 13. Window Structure

Home

Projects

Editor

Device Monitor

Settings

Future pages must integrate into the existing navigation.

---

# 14. Navigation

Persistent left sidebar.

Current location always visible.

Maximum navigation depth: 2.

Keyboard shortcuts encouraged.

---

# 15. Sidebar

Contains:

- Home
- Projects
- Editor
- Device Monitor
- Settings

Collapsed and expanded modes supported.

---

# 16. Top Bar

Displays:

- Current Project
- Connected Board
- Connection Status
- Primary Actions

Never overcrowd the top bar.

---

# 17. Cards

Cards present:

- Projects
- Devices
- Templates
- AI Suggestions
- Status

Consistent padding, border radius, and elevation.

---

# 18. Buttons

Types:

- Primary
- Secondary
- Ghost
- Destructive

Every button defines:

- Default
- Hover
- Focus
- Active
- Disabled
- Loading

---

# 19. Inputs

Requirements:

- Labels
- Helpful placeholders
- Validation
- Error text
- Keyboard friendly

---

# 20. Dropdowns

- Searchable where appropriate
- Keyboard accessible
- Predictable ordering

---

# 21. Modals

Reserved for destructive or high-impact actions.

Never stack modals.

---

# 22. Tables

Readable.

Responsive.

Sortable only when beneficial.

---

# 23. Lists

Consistent spacing.

Selection states.

Optional icons.

---

# 24. Device Monitor

Contains:

- Board Status
- Live Sensor Values
- Upload Status
- Serial Console
- Connection Information

Prioritize readability during continuous updates.

---

# 25. Code Editor

Use Monaco Editor.

Features:

- Syntax Highlighting
- Line Numbers
- Auto Formatting (future)
- Copy
- Undo
- Redo

---

# 26. AI Assistant

Focus on one task:

Generate firmware.

Sections:

- Prompt
- Response
- Explanation
- Components
- Wiring

No chatbot distractions.

---

# 27. Project Cards

Display:

- Name
- Board
- Template
- Modified Date

Quick actions:

- Open
- Duplicate
- Delete

---

# 28. Status Indicators

Every status uses:

- Icon
- Color
- Text

States:

- Connected
- Disconnected
- Uploading
- Success
- Warning
- Error

---

# 29. Icons

Lucide Icons only.

Icons support labels; they do not replace text.

---

# 30. Illustration Style

Flat.

Minimal.

Technical.

Friendly.

Educational.

---

# 31. Comic Art Language

Used only for:

- Onboarding
- Tutorials
- Empty States

Never during critical workflows.

---

# 32. Motion System

Animation exists to communicate state.

Allowed:

- Fade
- Slide
- Scale

Avoid decorative animation.

---

# 33. Micro Interactions

Provide feedback for:

- Hover
- Click
- Upload
- AI Generation
- Success
- Error
- Connection changes

---

# 34. Empty States

Every empty screen explains:

- What this page does
- Why it is empty
- What to do next

---

# 35. Error States

Every error should:

- Explain the issue
- Suggest a solution
- Avoid technical jargon

---

# 36. Loading States

Use:

- Skeleton loaders
- Progress indicators
- Button loading states

Never leave users waiting without feedback.

---

# 37. Accessibility

Support:

- Keyboard navigation
- Visible focus
- WCAG-friendly contrast
- Screen readers
- Reduced motion preferences

Accessibility is mandatory.

---

# 38. Future Design

Reserved for:

- Cloud Dashboard
- OTA
- Collaboration
- Plugin Marketplace

Visual placeholders only.

---

# 39. Design Tokens

Centralize:

- Colors
- Typography
- Spacing
- Radius
- Borders
- Shadows
- Motion

Single source of truth.

---

# 40. Responsive Strategy

Primary target:

- Desktop (required)

Secondary:

- Large laptop

Mobile is out of scope for V0.1.

---

# 41. Complete Do’s & Don’ts

## Do

- Keep interfaces calm.
- Guide beginners.
- Reuse components.
- Prefer whitespace.
- Use semantic colors.
- Keep workflows obvious.

## Don’t

- Overload screens.
- Hide primary actions.
- Add unnecessary settings.
- Use inconsistent spacing.
- Use decorative animations.
- Expose implementation details.

---

# 42. Phase 9 — Projects Page Extension

Phase 9 extends the Projects page. It does not redesign it.

The existing Template Gallery is unchanged:

- Same grid, same cards, same spacing, same visual language.
- Selecting a template still opens a new editable project in the Editor
  immediately — no dialog, no confirmation.

One new control is added to the page header: a "+" action.

---

# 43. Phase 9 — "+" Action

Placement:

- Page header, aligned opposite the page title, at the same vertical
  position as the existing header row.

Size:

- Matches the existing compact button size already used for header-row
  actions elsewhere in the application.

Iconography:

- A Plus icon (Lucide), paired with the visible label "New." Per §
  Icons, icons support labels; they never replace them.

Interaction states:

- Default, Hover, Focus, Active — identical to the existing Button
  states already defined in § Buttons.
- No Disabled state. The action is always available on the Projects
  page.
- No Loading state. Opening the menu is instantaneous.

Accessibility:

- Accessible name: "New Project."
- Announces that it controls a popup, and whether that popup is
  currently open.
- Operable with Enter and Space, like any button.

Keyboard navigation:

- Reachable by Tab in the page's natural header order.
- A visible focus ring, matching every other interactive control in the
  application.

---

# 44. Phase 9 — Popup Menu

A lightweight, non-blocking popup — not a modal (§ Modals). It never
dims or blocks the rest of the page.

Contents: exactly two items.

- Create New Project
- Open Existing Project

No further items. No submenus.

Positioning:

- Anchored directly below the "+" action, aligned so it never overflows
  the page edge.

Spacing:

- Uses the existing spacing scale (§ Spacing System) and the existing
  list and card surface language (§ Lists, § Cards) — rounded corners,
  soft elevation, consistent item padding. No new visual style is
  introduced.

Dismissal:

- Selecting an item closes the menu and performs that action.
- Clicking outside the menu closes it without any action.
- Escape closes it without any action.

Keyboard interaction:

- Arrow Down / Arrow Up moves between the two items.
- Enter or Space activates the focused item.
- Escape closes the menu.

Focus restoration:

- Escape or click-outside returns focus to the "+" action.
- Choosing an item moves focus into what opens next — the Create New
  Project dialog, or the native file picker — not back to "+" first.

---

# 45. Phase 9 — Create New Project Dialog

A modal, per § Modals: reserved for high-impact actions. The popup menu
always fully closes before this dialog opens — dialogs are never
stacked.

Visually consistent with the existing confirmation-dialog pattern
already used elsewhere in the application: a centered card over a
dimmed backdrop, a close control, a clear title, form content, and two
footer actions (Cancel, Create).

Fields, in order:

1. **Project Name** — a text field. Empty by default, with a helpful
   placeholder example. Required.
2. **Target Board** — a dropdown of the supported boards (§ Dropdowns:
   keyboard accessible, predictable ordering; not search-enabled, since
   the list is short). No board is pre-selected. Required.
3. **Storage Location** — pre-filled with the default project location.
   An adjacent action lets the user choose a different location via the
   platform's native picker. Always has a value; never empty.

Buttons:

- **Cancel** — secondary style, positioned first.
- **Create** — primary style, positioned second. Disabled until Project
  Name is non-empty and Target Board has a selection.
- A dialog close control (matching the existing close-control pattern
  already used by the application's other dialogs) is also present and
  behaves identically to Cancel.

Validation:

- Project Name: required, non-empty.
- Target Board: required, must be one of the supported boards.
- Storage Location: always valid; the default requires no user action.

Empty states:

- Project Name shows a placeholder example, not a pre-filled value.
- Target Board shows a neutral "Select a board" prompt until chosen.

Default values:

- Storage Location defaults to the standard project location.
- Project Name and Target Board have no default; both require explicit
  input.

Keyboard shortcuts:

- Enter submits when the form is valid.
- Escape cancels and closes the dialog, identical in effect to Cancel.

Closing behavior (UX invariant):

- Cancel, Escape, and the dialog close control all close the dialog
  identically: every entered value is discarded, without a confirmation
  step.
- Opening the dialog again always starts from a fresh, empty form. No
  previously entered value is ever retained or restored.

Error presentation (§ Error States):

- If creation cannot complete, an inline message appears inside the
  dialog: what went wrong, in plain language, with a suggested next
  step. The dialog stays open so the user can correct the problem
  without re-entering their other fields.

Loading state:

- Creating a project does not involve a lengthy operation, so no
  loading spinner is needed for the Create action itself. Only the
  native location picker, if opened, has its own, platform-owned
  transition.

Focus order:

- Project Name (focused automatically when the dialog opens) → Target
  Board → Storage Location / its picker action → Cancel → Create. The
  dialog close control participates in the same cycle; focus never
  escapes the dialog while it is open.

Responsive behavior:

- Fixed, centered dialog width appropriate for desktop and large-laptop
  targets, matching § Responsive Strategy. No mobile-specific layout is
  defined.

On success:

- The dialog closes and the Editor opens immediately with the new,
  empty project active — the same transition as opening a template.

---

# 46. Phase 9 — Open Existing Project

UX only. No persistence or file-format detail belongs in this document.

Menu interaction:

- Selecting "Open Existing Project" closes the popup menu and
  immediately presents the platform's native file picker. No
  intermediate IoTOS dialog appears first.

Native picker transition:

- The native picker is owned by the operating system. IoTOS shows no
  custom loading state while it is open.

Cancellation:

- Dismissing the native picker without choosing a file is not an error.
  The user returns to the Projects page exactly as they left it — no
  message, no side effect.

Successful open:

- Choosing a valid project file opens the Editor with that project
  active — the same transition already used when opening a project from
  Recent Projects.

Unsuccessful open:

- If the chosen file cannot be opened, the user remains on the Projects
  page and sees an inline error message following § Error States: what
  went wrong, in plain language, with a suggested next step.

---

# 47. Phase 9 — Official Template Cards

The existing Template Gallery cards are unchanged by Phase 9.

Do not:

- Redesign the card layout, spacing, or visual style.
- Introduce user-created or user-saved templates.
- Introduce categories.
- Introduce search.
- Introduce filtering.

The "+" action and its menu are the only additions to this page. (The
separately-scoped § Project Cards section describes a different,
existing card concept and is unaffected by Phase 9.)

---

# 48. Phase 9 — User Journeys

Template path (unchanged):

```
Projects Page
 ↓
Template
 ↓
Editor
```

New project path:

```
Entry
 ↓
Projects Page
 ↓
+
 ↓
Menu
 ↓
Create New Project
 ↓
Editor
```

Open existing path:

```
Projects Page
 ↓
+
 ↓
Open Existing
 ↓
Editor
```

All three journeys end at the same place: the Editor, with an active
project. From the Editor onward, nothing about the experience differs
by how the project was created.

---

# 49. Phase 9 Accessibility

Applies § Accessibility concretely to the new controls.

Keyboard navigation:

- Every new control ("+", popup menu, dialog) is fully operable without
  a mouse.

Focus order:

- "+" → popup menu items → dialog fields (see § Create New Project
  Dialog) or the native picker, which is platform-controlled.

Tab order:

- Follows visual order at every step; never skips or traps focus,
  except while the dialog is open, where Tab cycles only within that
  dialog until it closes.

Screen reader labels:

- "+" announces as "New Project."
- Each menu item announces its full label: "Create New Project," "Open
  Existing Project."
- The dialog announces its title and is identified as a dialog when it
  opens.
- The dialog close control has its own accessible name, matching the
  existing close-control pattern already used by the application's
  other dialogs.

Escape behavior:

- Closes the popup menu, or the dialog, and returns focus to the
  control that opened it.

Enter behavior:

- Activates the focused menu item, or submits the dialog when valid.

---

# 50. Phase 9 — Out of Scope

Do not introduce:

- User Templates
- Template Editing
- Import Systems
- Git
- Cloud
- Workspace Manager
- Multiple Projects
- Recent Project redesign
- Project Explorer redesign

---

# Definition of Great Design

A first-time user should understand what to do within 30 seconds without
reading documentation.

Every screen should answer:

- Where am I?
- What can I do?
- What should I do next?

---

# Final Design Principle

Every visual decision must strengthen one experience:

> **Describe → Generate → Upload → Run**

If a design element does not improve that journey, simplify it or remove
it.

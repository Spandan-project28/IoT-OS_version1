# DESIGN.md

**Project:** IoTOS AI

**Document:** Design System & UX Specification

**Version:** 2.0

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
- Dark-first
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
- Primary
- Secondary
- Accent
- Success
- Warning
- Error
- Info
- Text Primary
- Text Secondary
- Disabled

Never communicate state using color alone.

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

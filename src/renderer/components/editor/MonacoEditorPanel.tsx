/**
 * MonacoEditorPanel.tsx
 *
 * The firmware editor surface — Phase 7, Slice 29.
 *
 * Owns Monaco <Editor> instantiation and the key={documentId} remount
 * strategy. Renders firmware source for the active project and reports
 * every edit back to the caller via onChange — it never touches Zustand or
 * window.api directly (narrow-props pattern, matching PromptInput in
 * Editor/index.tsx).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Local-first Monaco loading (Slice 29, Ambiguity A — resolved)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * @monaco-editor/react's default loader fetches the Monaco AMD bundle from
 * https://cdn.jsdelivr.net at runtime unless explicitly told otherwise. That
 * is blocked by this app's CSP (script-src 'self') and violates the
 * Local-first Application principle (architecture.md section 5) regardless
 * of CSP. This module eliminates the CDN path entirely:
 *
 * - `monaco-editor` is imported directly (a direct dependency as of this
 *   slice, pinned to 0.55.1) and handed to loader.config({ monaco }) at
 *   module scope, before any <Editor> renders. @monaco-editor/loader sees a
 *   pre-supplied monaco instance and never injects the CDN <script> tag.
 * - The one worker Monaco needs for cpp syntax highlighting (the base
 *   editor worker — cpp is a Monarch grammar tokenized on the main thread,
 *   so no language-service worker is required) is wired via Vite's native
 *   `?worker` import, which bundles it as a same-origin asset. No Monaco
 *   Vite plugin is used.
 * - `monaco-editor`'s root entry point (`import * as monaco from
 *   'monaco-editor'`) eagerly bundles every basic language plus the
 *   css/html/json/typescript language services (and their workers,
 *   including a ~13MB ts.worker) — none of which this editor uses. Importing
 *   the narrower `editor.api` entry point plus only the `cpp` language
 *   contribution keeps the bundle to the core editor and the one language
 *   actually needed.
 *
 * Net effect: zero network requests, fully offline, no CSP changes.
 */

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { Editor, loader } from '@monaco-editor/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Module-scope setup — runs exactly once, before any <Editor> renders.
// ---------------------------------------------------------------------------

self.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker()
  }
}

loader.config({ monaco })

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface MonacoEditorPanelProps {
  /** Initial firmware source for this document. Uncontrolled after mount. */
  value: string
  /**
   * The active project's IProjectDocument.id. Used as the React key so
   * Monaco fully remounts (fresh cursor/selection/undo history) exactly
   * when project identity changes — never on every keystroke.
   */
  documentId: string
  /** Called with the complete firmware source on every edit. */
  onChange: (value: string) => void
}

export function MonacoEditorPanel({
  value,
  documentId,
  onChange
}: MonacoEditorPanelProps): React.JSX.Element {
  return (
    <Editor
      key={documentId}
      height="100%"
      defaultLanguage="cpp"
      defaultValue={value}
      theme="vs-dark"
      onChange={(newValue) => onChange(newValue ?? '')}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        automaticLayout: true
      }}
    />
  )
}

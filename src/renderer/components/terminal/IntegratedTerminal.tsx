/**
 * IntegratedTerminal
 *
 * Bottom-docked, collapsible terminal for the Run/Upload workflow (Phase 10).
 *
 * Architectural rules:
 * - Pure presentational — reads terminalLogs/terminalExpanded/terminalAutoScroll
 *   and the compile/upload action state from useAppStore; never calls
 *   window.api directly (the store owns all IPC via initializeUploadTerminal()
 *   and the compile/upload actions).
 * - Auto-expand/auto-clear on a new Run/Upload is handled entirely by the
 *   store's compileFirmware/uploadFirmware/compileAndUploadFirmware actions —
 *   this component only ever reflects terminalExpanded, never sets it except
 *   via the user's own Collapse/Expand click.
 * - Visual language matches DeviceMonitor's Serial Console panel (font-mono,
 *   bg-dark-bg/60, timestamped lines) — the closest existing terminal-style
 *   component in this codebase — rather than inventing a new style.
 */

import React, { useEffect, useMemo, useRef } from 'react'
import {
  Terminal as TerminalIcon,
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  ArrowDown,
  Loader2
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { IUploadLogPayload } from '@shared/types/upload'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB', { hour12: false })
}

/**
 * Scans the most recent stdout entries for an arduino-cli/avrdude/esptool
 * upload percentage (e.g. "50 %", "100%") and returns the last one found.
 * Returns null when no percentage has appeared — the caller simply omits
 * the progress badge in that case ("if available", per spec).
 */
function findLatestPercent(logs: IUploadLogPayload[]): number | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const entry = logs[i]
    if (entry.stream !== 'stdout') continue
    const match = entry.text.match(/(\d{1,3})\s?%/)
    if (match) {
      const value = Number(match[1])
      if (value >= 0 && value <= 100) return value
    }
  }
  return null
}

function streamClassName(stream: IUploadLogPayload['stream'], text: string): string {
  switch (stream) {
    case 'command':
      return 'text-primary font-semibold'
    case 'stderr':
      return 'text-error'
    case 'system':
      return text.startsWith('✗') ? 'text-error font-semibold' : 'text-success font-semibold'
    case 'stdout':
    default:
      return 'text-text-primary'
  }
}

function streamPrefix(stream: IUploadLogPayload['stream']): string {
  return stream === 'command' ? '$ ' : ''
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IntegratedTerminal(): React.JSX.Element {
  const {
    terminalLogs,
    terminalExpanded,
    terminalAutoScroll,
    uploadLoading,
    setTerminalExpanded,
    clearTerminal,
    toggleTerminalAutoScroll
  } = useAppStore()

  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (terminalAutoScroll && terminalExpanded && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [terminalLogs, terminalAutoScroll, terminalExpanded])

  const latestPercent = useMemo(
    () => (uploadLoading ? findLatestPercent(terminalLogs) : null),
    [terminalLogs, uploadLoading]
  )

  function handleCopyAll(): void {
    const text = terminalLogs
      .map(
        (entry) =>
          `[${formatTimestamp(entry.timestamp)}] ${streamPrefix(entry.stream)}${entry.text}`
      )
      .join('\n')
    void navigator.clipboard.writeText(text)
  }

  return (
    <div className="shrink-0 border-t border-dark-border bg-dark-bg flex flex-col select-none">
      {/* Header — always visible, toggles expand/collapse */}
      <div className="h-36 px-16 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => setTerminalExpanded(!terminalExpanded)}
          className="flex items-center gap-8 text-[12px] font-medium text-disabled hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          <TerminalIcon className="w-4 h-4" />
          Terminal
          {uploadLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
          {latestPercent !== null && (
            <span className="text-[11px] font-mono text-primary">{latestPercent}%</span>
          )}
        </button>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleTerminalAutoScroll}
            aria-pressed={terminalAutoScroll}
            title="Toggle Auto Scroll"
            className={`p-6 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              terminalAutoScroll ? 'text-primary' : 'text-disabled hover:text-white'
            }`}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleCopyAll}
            disabled={terminalLogs.length === 0}
            title="Copy All Logs"
            className="p-6 rounded-lg text-disabled hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={clearTerminal}
            disabled={terminalLogs.length === 0}
            title="Clear"
            className="p-6 rounded-lg text-disabled hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setTerminalExpanded(!terminalExpanded)}
            title={terminalExpanded ? 'Collapse' : 'Expand'}
            className="p-6 rounded-lg text-disabled hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {terminalExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Body — only rendered while expanded */}
      {terminalExpanded && (
        <div className="h-[260px] border-t border-dark-border overflow-y-auto bg-black/40 px-16 py-10 font-mono text-[12px] leading-relaxed">
          {terminalLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-disabled">
              Click Run or Upload to see live output here.
            </div>
          ) : (
            <>
              {terminalLogs.map((entry, idx) => (
                <div
                  key={idx}
                  className={`whitespace-pre-wrap break-all py-1 ${streamClassName(entry.stream, entry.text)}`}
                >
                  <span className="text-disabled">[{formatTimestamp(entry.timestamp)}]</span>{' '}
                  {streamPrefix(entry.stream)}
                  {entry.text}
                </div>
              ))}
              <div ref={logEndRef} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

import { TopBar } from '../../components/layout/TopBar'
import { Panel } from '../../components/common/Panel'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { SkeletonLoader } from '../../components/common/SkeletonLoader'
import { useAppStore } from '../../store/useAppStore'
import {
  Activity,
  Terminal,
  Cpu,
  Usb,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Play,
  Square,
  Trash2,
  Send,
  ArrowDown
} from 'lucide-react'
import React, { useState, useEffect, useRef, useMemo } from 'react'

// ---------------------------------------------------------------------------
// Supported baud rates — standard embedded development values.
// ---------------------------------------------------------------------------
const BAUD_RATES = [9600, 19200, 38400, 57600, 115200]

export function DeviceMonitor(): React.JSX.Element {
  const {
    hardware,
    hardwareLoading,
    hardwareError,
    hardwareInitialized,
    serialState,
    serialLogs,
    serialAutoScroll,
    serialError,
    serialLoading,
    lastUploadedPort,
    openSerial,
    closeSerial,
    writeSerial,
    clearSerialLogs,
    toggleSerialAutoScroll
  } = useAppStore()

  // Prefer the most recently uploaded port (Phase 8, Slice 38) — only if it
  // is still present in hardware.ports, so a since-unplugged port is never
  // silently preselected. Otherwise fall back to the first identified
  // board's port, then the first detected port, so the UI is useful even
  // when the board is not fully identified yet.
  const connectedBoard = hardware.connectedBoards[0] ?? null
  const uploadedPortStillPresent =
    lastUploadedPort !== null && hardware.ports.some((p) => p.path === lastUploadedPort)
      ? lastUploadedPort
      : null
  const selectedPortPath =
    uploadedPortStillPresent ?? connectedBoard?.port ?? hardware.ports[0]?.path ?? null

  const [baudRate, setBaudRate] = useState<number>(9600)
  const [inputText, setInputText] = useState<string>('')
  const logEndRef = useRef<HTMLDivElement>(null)

  const currentSession = selectedPortPath ? serialState[selectedPortPath] : undefined
  const currentLogs = useMemo(
    () => (selectedPortPath ? (serialLogs[selectedPortPath] ?? []) : []),
    [selectedPortPath, serialLogs]
  )

  const isConnected = currentSession?.status === 'connected'
  const isConnecting = currentSession?.status === 'connecting'

  // Auto-scroll: whenever logs update or the preference is toggled on, jump to bottom.
  useEffect(() => {
    if (serialAutoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [currentLogs, serialAutoScroll])

  // Connect / Disconnect toggle handler.
  const handleConnectToggle = (): void => {
    if (!selectedPortPath) return

    if (isConnected) {
      closeSerial({ port: selectedPortPath })
    } else {
      openSerial({
        port: selectedPortPath,
        settings: {
          baudRate,
          newline: 'lf'
        }
      })
    }
  }

  // Send handler — writes inputText to the active serial session.
  const handleSend = (e?: React.FormEvent): void => {
    if (e) e.preventDefault()
    if (!selectedPortPath || !inputText.trim() || !isConnected) return

    writeSerial({
      port: selectedPortPath,
      text: inputText,
      newline: 'lf'
    })
    setInputText('')
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar />
      <div className="flex-1 p-24 md:p-32 flex flex-col gap-24 overflow-y-auto">
        {/* Error banner — shows hardware errors and serial errors */}
        {(hardwareError || serialError) && (
          <div className="flex items-center gap-12 px-16 py-12 rounded-xl bg-error/10 border border-error/20 text-error text-[13px] shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {hardwareError || serialError}
          </div>
        )}

        {/* ----------------------------------------------------------------
            Stat cards row
        ---------------------------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-24 shrink-0">
          {/* Board status card */}
          <Card className="p-24 flex items-center gap-20">
            <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center text-text-secondary border border-border shadow-sm shrink-0">
              <Cpu className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] text-text-secondary font-medium tracking-wide uppercase">
                Board
              </div>
              {hardwareLoading && !connectedBoard ? (
                <SkeletonLoader className="h-[18px] w-28 rounded mt-2" />
              ) : connectedBoard ? (
                <>
                  <div className="text-[15px] font-semibold text-text-primary tracking-tight mt-2 truncate">
                    {connectedBoard.name}
                  </div>
                  <div className="text-[12px] text-text-secondary font-mono mt-1 truncate">
                    {connectedBoard.port}
                  </div>
                </>
              ) : (
                <div className="text-[15px] font-semibold text-text-primary tracking-tight mt-2">
                  No device
                </div>
              )}
            </div>
          </Card>

          {/* Ports card */}
          <Card className="p-24 flex items-center gap-20">
            <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center text-text-secondary border border-border shadow-sm shrink-0">
              <Usb className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[13px] text-text-secondary font-medium tracking-wide uppercase">
                Ports
              </div>
              {hardwareLoading && hardware.ports.length === 0 ? (
                <SkeletonLoader className="h-[24px] w-12 rounded mt-2" />
              ) : (
                <div className="text-[22px] font-bold text-text-primary tracking-tight mt-2">
                  {hardware.ports.length}
                </div>
              )}
            </div>
          </Card>

          {/* Arduino CLI card */}
          <Card className="p-24 flex items-center gap-20">
            <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center text-text-secondary border border-border shadow-sm shrink-0">
              <Terminal className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] text-text-secondary font-medium tracking-wide uppercase">
                Arduino CLI
              </div>
              {hardwareLoading && !hardwareInitialized ? (
                <SkeletonLoader className="h-[18px] w-24 rounded mt-2" />
              ) : hardware.cli.isInstalled ? (
                <div className="flex items-center gap-8 mt-2">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <span className="text-[14px] font-semibold text-text-primary font-mono">
                    v{hardware.cli.version}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-8 mt-2">
                  <XCircle className="w-4 h-4 text-error shrink-0" />
                  <span className="text-[14px] text-text-secondary">Not installed</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ----------------------------------------------------------------
            Detected Ports panel
        ---------------------------------------------------------------- */}
        <Panel
          title="Detected Ports"
          action={
            hardware.ports.length > 0 ? (
              <Badge variant="default">{hardware.ports.length}</Badge>
            ) : undefined
          }
          className="shrink-0"
        >
          {hardwareLoading && hardware.ports.length === 0 ? (
            <div className="p-20 flex flex-col gap-12">
              <SkeletonLoader className="h-[40px] rounded-xl" />
              <SkeletonLoader className="h-[40px] rounded-xl" />
            </div>
          ) : hardware.ports.length === 0 ? (
            <div className="p-24 text-center text-[14px] text-text-secondary">
              No serial ports detected. Connect a device and click Scan.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {hardware.ports.map((port) => {
                const matchingBoard = hardware.connectedBoards.find((b) => b.port === port.path)
                const portSession = serialState[port.path]
                const portConnected = portSession?.status === 'connected'

                return (
                  <div key={port.path} className="flex items-center justify-between px-20 py-14">
                    <div className="flex items-center gap-12">
                      <Activity
                        className={`w-4 h-4 shrink-0 ${matchingBoard ? 'text-success' : 'text-text-secondary'}`}
                      />
                      <div>
                        <span className="text-[14px] font-medium text-text-primary font-mono">
                          {port.path}
                        </span>
                        {port.manufacturer && (
                          <span className="text-[12px] text-text-secondary ml-12">
                            {port.manufacturer}
                          </span>
                        )}
                        {port.vendorId && port.productId && (
                          <span className="text-[11px] text-text-secondary/60 font-mono ml-12">
                            {port.vendorId}:{port.productId}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      {matchingBoard ? (
                        <>
                          <span className="text-[12px] text-text-secondary truncate max-w-[140px]">
                            {matchingBoard.name}
                          </span>
                          <Badge variant="success">Identified</Badge>
                        </>
                      ) : (
                        <Badge variant="default">Unknown</Badge>
                      )}
                      {portConnected && <Badge variant="success">Active Session</Badge>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        {/* ----------------------------------------------------------------
            Serial Console panel — live terminal output + message input.
            The page outer div uses overflow-y-auto so the whole page scrolls
            naturally. The console itself renders all logs inline so the page
            scroll serves as the terminal scroll, keeping layout simple and
            compatible with the existing Panel component structure.
        ---------------------------------------------------------------- */}
        <Panel
          title="Serial Console"
          action={
            <div className="flex items-center gap-12 flex-wrap justify-end">
              {/* Baud Rate selector — disabled while a session is open */}
              <select
                className="bg-surface border border-border rounded-lg px-8 py-4 text-[12px] font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                value={baudRate}
                onChange={(e) => setBaudRate(Number(e.target.value))}
                disabled={isConnected || isConnecting}
              >
                {BAUD_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate} baud
                  </option>
                ))}
              </select>

              {/* Connect / Disconnect toggle */}
              <Button
                variant={isConnected ? 'destructive' : 'primary'}
                size="sm"
                isLoading={serialLoading || isConnecting}
                disabled={!selectedPortPath}
                onClick={handleConnectToggle}
                leftIcon={
                  isConnected ? (
                    <Square className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )
                }
              >
                {isConnected ? 'Disconnect' : 'Connect'}
              </Button>

              {/* Auto-scroll toggle */}
              <Button
                variant={serialAutoScroll ? 'secondary' : 'ghost'}
                size="sm"
                onClick={toggleSerialAutoScroll}
                title="Toggle Auto Scroll"
                aria-pressed={serialAutoScroll}
                leftIcon={
                  <ArrowDown className={`w-3.5 h-3.5 ${serialAutoScroll ? 'text-primary' : ''}`} />
                }
              >
                Auto Scroll
              </Button>

              {/* Clear logs */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => selectedPortPath && clearSerialLogs(selectedPortPath)}
                disabled={!selectedPortPath || currentLogs.length === 0}
                title="Clear Logs"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Clear
              </Button>
            </div>
          }
        >
          {/* Terminal output area */}
          <div className="bg-dark-bg/60 p-16 font-mono text-[13px] leading-relaxed text-text-primary min-h-[200px]">
            {currentLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-12 text-center py-40 text-text-secondary/60">
                <Terminal className="w-8 h-8 opacity-40" />
                {isConnected ? (
                  <span>Connected to {selectedPortPath}. Waiting for serial data&hellip;</span>
                ) : selectedPortPath ? (
                  <span>
                    Click &ldquo;Connect&rdquo; to open serial port on {selectedPortPath}.
                  </span>
                ) : (
                  <span>No board or port selected. Connect a hardware device.</span>
                )}
              </div>
            ) : (
              <>
                {currentLogs.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap break-all py-0.5">
                    {line}
                  </div>
                ))}
                {/* Invisible scroll anchor for auto-scroll */}
                <div ref={logEndRef} />
              </>
            )}
          </div>

          {/* Input bar */}
          <form
            onSubmit={handleSend}
            className="p-12 border-t border-border flex items-center gap-12 bg-surface/50"
          >
            <input
              type="text"
              placeholder={isConnected ? 'Send message to board\u2026' : 'Connect to send messages'}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={!isConnected || serialLoading}
              className="flex-1 bg-surface border border-border rounded-xl px-16 py-8 text-[13px] text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 font-mono"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!isConnected || !inputText.trim() || serialLoading}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Send
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  )
}

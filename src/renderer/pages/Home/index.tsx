import { TopBar } from '../../components/layout/TopBar'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { SkeletonLoader } from '../../components/common/SkeletonLoader'
import { DeleteConfirmModal } from '../../components/common/DeleteConfirmModal'
import { useAppStore } from '../../store/useAppStore'
import {
  Cpu,
  Activity,
  Usb,
  Terminal,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  FolderOpen,
  Loader2,
  Trash2
} from 'lucide-react'
import { Button } from '../../components/common/Button'
import { useNavigate } from 'react-router-dom'
import React from 'react'

export function Home(): React.JSX.Element {
  const {
    hardware,
    hardwareLoading,
    hardwareError,
    hardwareInitialized,
    refreshHardware,
    recentProjects,
    projectOpening,
    openProject,
    deleteProject
  } = useAppStore()
  const navigate = useNavigate()

  // ---------------------------------------------------------------------------
  // Local state: deletion modal
  //
  // The pending-delete target is local component state, not Zustand global
  // state (Slice 33 refinement: pendingDeleteProject was explicitly removed
  // from the store). The modal reads this state and delegates the actual
  // delete operation to useAppStore.deleteProject().
  // ---------------------------------------------------------------------------
  const [pendingDelete, setPendingDelete] = React.useState<{
    filePath: string
    title: string
  } | null>(null)

  // Tracks which specific recent-project row is being opened, purely for
  // display — projectOpening (global) still gates the actual disabled state
  // so a second open cannot start mid-flight. Without this, every row would
  // show a spinner while only one project is actually being opened.
  const [openingPath, setOpeningPath] = React.useState<string | null>(null)

  const connectedBoard = hardware.connectedBoards[0] ?? null
  const portCount = hardware.ports.length

  // ---------------------------------------------------------------------------
  // Open from Recent Projects
  //
  // Navigates to the Editor only after a successful open — openProject()
  // clears projectOpenError on success and leaves it set on failure, so
  // re-checking the store's own state after the await (rather than trusting
  // a local return value) is the same pattern used for staleness checks
  // elsewhere in this store.
  // ---------------------------------------------------------------------------
  async function handleOpenRecent(filePath: string): Promise<void> {
    setOpeningPath(filePath)
    try {
      await openProject(filePath)
      if (useAppStore.getState().projectOpenError === null) {
        void navigate('/editor')
      }
    } finally {
      setOpeningPath(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar />
      <div className="flex-1 p-24 md:p-32 overflow-y-auto">
        <div className="w-full max-w-[900px] mx-auto flex flex-col gap-24">
          {/* Page header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[22px] font-bold text-text-primary tracking-tight">Dashboard</h1>
              <p className="text-[14px] text-text-secondary mt-4">
                Hardware overview for your active session
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshHardware}
              disabled={hardwareLoading}
              leftIcon={
                <RefreshCw className={`w-4 h-4 ${hardwareLoading ? 'animate-spin' : ''}`} />
              }
            >
              {hardwareLoading ? 'Scanning...' : 'Scan'}
            </Button>
          </div>

          {/* Error banner */}
          {hardwareError && (
            <div className="flex items-center gap-12 px-16 py-12 rounded-xl bg-error/10 border border-error/20 text-error text-[13px]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {hardwareError}
            </div>
          )}

          {/* Status cards row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            {/* Connected Board card */}
            <Card className="p-24 flex items-center gap-20">
              <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center border border-border shadow-sm shrink-0">
                <Cpu className="w-6 h-6 text-text-secondary" />
              </div>
              <div className="min-w-0">
                <div className="text-[12px] text-text-secondary font-medium tracking-wide uppercase mb-4">
                  Connected Board
                </div>
                {hardwareLoading && !connectedBoard ? (
                  <SkeletonLoader className="h-[18px] w-32 rounded" />
                ) : connectedBoard ? (
                  <>
                    <div className="text-[15px] font-semibold text-text-primary tracking-tight truncate">
                      {connectedBoard.name}
                    </div>
                    <div className="text-[12px] text-text-secondary font-mono mt-2 truncate">
                      {connectedBoard.port}
                    </div>
                  </>
                ) : (
                  <div className="text-[14px] text-text-secondary">No device detected</div>
                )}
              </div>
            </Card>

            {/* Detected Ports card */}
            <Card className="p-24 flex items-center gap-20">
              <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center border border-border shadow-sm shrink-0">
                <Usb className="w-6 h-6 text-text-secondary" />
              </div>
              <div>
                <div className="text-[12px] text-text-secondary font-medium tracking-wide uppercase mb-4">
                  Detected Ports
                </div>
                {hardwareLoading && portCount === 0 ? (
                  <SkeletonLoader className="h-[18px] w-16 rounded" />
                ) : (
                  <div className="text-[22px] font-bold text-text-primary tracking-tight">
                    {portCount}
                  </div>
                )}
              </div>
            </Card>

            {/* Arduino CLI card */}
            <Card className="p-24 flex items-center gap-20">
              <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center border border-border shadow-sm shrink-0">
                <Terminal className="w-6 h-6 text-text-secondary" />
              </div>
              <div className="min-w-0">
                <div className="text-[12px] text-text-secondary font-medium tracking-wide uppercase mb-4">
                  Arduino CLI
                </div>
                {hardwareLoading && !hardwareInitialized ? (
                  <SkeletonLoader className="h-[18px] w-24 rounded" />
                ) : hardware.cli.isInstalled ? (
                  <div className="flex items-center gap-8">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    <span className="text-[14px] font-semibold text-text-primary font-mono truncate">
                      v{hardware.cli.version}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-8">
                    <XCircle className="w-4 h-4 text-error shrink-0" />
                    <span className="text-[14px] text-text-secondary">Not installed</span>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Recent Projects */}
          {recentProjects.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="px-20 py-14 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-[14px] text-text-primary tracking-tight">
                  Recent Projects
                </h2>
                <Badge variant="default">{recentProjects.length}</Badge>
              </div>

              <div className="divide-y divide-border">
                {recentProjects.map((entry) => (
                  <div
                    key={entry.filePath}
                    className="flex items-center justify-between px-20 py-14 hover:bg-surface-elevated transition-colors group"
                  >
                    {/* Clickable open area */}
                    <button
                      type="button"
                      disabled={projectOpening}
                      onClick={() => void handleOpenRecent(entry.filePath)}
                      className="flex-1 flex items-center gap-12 min-w-0 text-left rounded-lg disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {openingPath === entry.filePath ? (
                        <Loader2 className="w-4 h-4 shrink-0 text-text-secondary animate-spin" />
                      ) : (
                        <FolderOpen className="w-4 h-4 shrink-0 text-text-secondary" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium text-text-primary truncate">
                          {entry.title}
                        </div>
                        <div className="text-[12px] text-text-secondary font-mono truncate">
                          {entry.filePath}
                        </div>
                      </div>
                    </button>

                    {/* Right side: origin badge + delete */}
                    <div className="flex items-center gap-10 ml-12 shrink-0">
                      <Badge variant="default">{entry.origin}</Badge>

                      <button
                        type="button"
                        id={`delete-project-btn-${entry.filePath}`}
                        aria-label={`Delete ${entry.title}`}
                        disabled={projectOpening}
                        onClick={() =>
                          setPendingDelete({ filePath: entry.filePath, title: entry.title })
                        }
                        className="text-disabled hover:text-error transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:pointer-events-none rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Port list */}
          {portCount > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="px-20 py-14 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-[14px] text-text-primary tracking-tight">
                  Serial Ports
                </h2>
                <Badge variant="default">{portCount}</Badge>
              </div>
              <div className="divide-y divide-border">
                {hardware.ports.map((port) => {
                  const isBoard = hardware.connectedBoards.some((b) => b.port === port.path)
                  return (
                    <div key={port.path} className="flex items-center justify-between px-20 py-14">
                      <div className="flex items-center gap-12">
                        <Activity
                          className={`w-4 h-4 shrink-0 ${isBoard ? 'text-success' : 'text-text-secondary'}`}
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
                        </div>
                      </div>
                      {isBoard ? (
                        <Badge variant="success">Board</Badge>
                      ) : (
                        <Badge variant="default">Port</Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Empty state when no ports and not loading */}
          {!hardwareLoading && portCount === 0 && !hardwareError && (
            <Card className="p-48 flex flex-col items-center justify-center gap-16 text-center">
              <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center border border-border">
                <Cpu className="w-8 h-8 text-text-secondary/60" />
              </div>
              <div>
                <div className="text-[16px] font-semibold text-text-primary">
                  No board connected
                </div>
                <div className="text-[14px] text-text-secondary mt-4 max-w-[400px]">
                  Connect an Arduino Uno, Arduino Nano, or ESP32 DevKit via USB and click Scan.
                </div>
              </div>
              <Button onClick={refreshHardware} disabled={hardwareLoading}>
                Scan for devices
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Delete confirmation modal — portal-mounted at the page root */}
      <DeleteConfirmModal
        isOpen={pendingDelete !== null}
        projectTitle={pendingDelete?.title ?? ''}
        onCancel={() => setPendingDelete(null)}
        onDelete={() => deleteProject(pendingDelete?.filePath ?? '')}
        onSuccess={() => {
          // clearProject() has already been called by the store action for
          // the active-project case. Close the modal — no navigation needed
          // on the Home page (we are already here).
          setPendingDelete(null)
        }}
        onError={(message) => {
          // projectError is already set in the store. Just close the modal.
          setPendingDelete(null)
          console.error('[Home] Delete failed:', message)
        }}
      />
    </div>
  )
}

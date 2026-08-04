import {
  Cpu,
  Search,
  Play,
  Upload,
  Save,
  Sparkles,
  Settings as SettingsIcon,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Activity
} from 'lucide-react'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { IconButton } from '../common/IconButton'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { navigationConfig } from '../../domain/navigation/config'
import { useAppStore } from '../../store/useAppStore'
import { SkeletonLoader } from '../common/SkeletonLoader'
import React from 'react'

export interface TopBarProps {
  children?: React.ReactNode
  /**
   * Optional firmware source to upload when the Upload button is clicked.
   * When provided, the Upload button becomes active (subject to board/CLI guards).
   * When absent (default), the Upload button remains in its disabled placeholder state.
   *
   * This prop is intentionally narrow — only the Editor page passes source code here.
   * All other pages leave it undefined, keeping the button disabled as before.
   */
  firmwareSource?: string
}

export function TopBar({ children, firmwareSource }: TopBarProps): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const currentPage = navigationConfig.find((item) => item.path === location.pathname)
  const {
    hardware,
    hardwareLoading,
    uploadLoading,
    uploadError,
    lastUploadResult,
    compileAndUploadFirmware,
    projectDirty,
    currentProjectDoc,
    projectSaving,
    lastSavedAt,
    saveProject
  } = useAppStore()

  const connectedBoard = hardware.connectedBoards[0] ?? null

  // ---------------------------------------------------------------------------
  // Save eligibility guard
  //
  // Save is actionable only when a project is active and no save is already
  // in flight. saveProject() itself decides save-vs-save-as based on
  // currentProjectPath — TopBar does not need to know which one will run.
  // ---------------------------------------------------------------------------
  const canSave = !!currentProjectDoc && !projectSaving

  function handleSave(): void {
    if (!canSave) return
    void saveProject()
  }

  // ---------------------------------------------------------------------------
  // "Saved X ago" label
  //
  // Computed from lastSavedAt — never stored. Date.now() is only ever called
  // inside the effect below (not during render, per React's purity rules);
  // `now` is refreshed every 10s so the label keeps advancing without any
  // additional store writes.
  // ---------------------------------------------------------------------------
  const [now, setNow] = React.useState<number>(() => Date.now())
  React.useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(interval)
  }, [])

  function formatSavedAgo(savedAt: string, nowMs: number): string {
    const diffSec = Math.max(0, Math.floor((nowMs - new Date(savedAt).getTime()) / 1000))
    if (diffSec < 10) return 'Saved just now'
    if (diffSec < 60) return `Saved ${diffSec}s ago`
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `Saved ${diffMin}m ago`
    const diffHour = Math.floor(diffMin / 60)
    return `Saved ${diffHour}h ago`
  }

  // ---------------------------------------------------------------------------
  // Upload eligibility guards
  //
  // The Upload button is actionable only when all three conditions hold:
  //   1. A firmware source has been passed from the parent page.
  //   2. A board with a known FQBN is connected (board identification succeeded).
  //   3. Arduino CLI is installed (without it UploadService cannot compile).
  //
  // uploadLoading also disables it to prevent concurrent uploads.
  // ---------------------------------------------------------------------------
  const canUpload =
    !!firmwareSource &&
    !!connectedBoard &&
    !!connectedBoard.fqbn &&
    hardware.cli.isInstalled &&
    !uploadLoading

  function handleUpload(): void {
    if (!canUpload || !firmwareSource || !connectedBoard || !connectedBoard.fqbn) return

    void compileAndUploadFirmware({
      port: connectedBoard.port,
      fqbn: connectedBoard.fqbn,
      source: firmwareSource
    })
  }

  // Determine the last upload outcome for the status strip.
  // uploadSucceeded: a typed success result from UploadService.
  // hasUploadError: a typed error result OR an IPC transport failure (uploadError
  //   set but lastUploadResult may still be null in the transport failure case).
  const uploadSucceeded = lastUploadResult?.status === 'success'
  const hasUploadError = lastUploadResult?.status === 'error' || !!uploadError

  return (
    <header className="border-b border-dark-border bg-dark-bg flex flex-col shrink-0 select-none">
      {/* ------------------------------------------------------------------ */}
      {/* Main bar row                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="h-20 flex items-center px-24 justify-between">
        {/* Left Section - Page Title & Breadcrumb */}
        <div className="flex items-center gap-12 flex-1 min-w-0">
          <div className="flex items-center text-disabled text-[14px] font-medium tracking-wide">
            <span className="hover:text-white cursor-pointer transition-colors">IoTOS AI</span>
            <ChevronRight className="w-4 h-4 mx-4 opacity-50" />
            <span className="text-white">{currentPage?.label || 'Dashboard'}</span>
          </div>
          {children && (
            <>
              <div className="w-[1px] h-4 bg-dark-border mx-4" />
              <div className="text-white text-[14px] font-medium">{children}</div>
              {projectDirty && (
                <span
                  className="text-primary text-[16px] leading-none select-none"
                  title="Unsaved changes"
                >
                  ●
                </span>
              )}
            </>
          )}
        </div>

        {/* Center Section - Large Command Search Bar */}
        <div className="flex-1 flex justify-center px-32 max-w-[600px] hidden md:flex">
          <div className="relative w-full group">
            <Search className="w-[16px] h-[16px] absolute left-16 top-1/2 -translate-y-1/2 text-disabled group-hover:text-white transition-colors" />
            <input
              type="text"
              placeholder="Search commands and files..."
              className="w-full bg-black border border-dark-border rounded-full pl-48 pr-64 py-[10px] text-[14px] text-white placeholder:text-text-secondary focus:outline-none focus:border-dark-border-strong focus:ring-1 focus:ring-dark-border-strong transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
              disabled
            />
            <div className="absolute right-16 top-1/2 -translate-y-1/2 flex items-center text-text-secondary text-[11px] font-mono font-medium tracking-wide">
              <kbd className="px-6 py-2 rounded bg-transparent border-none">Ctrl K</kbd>
            </div>
          </div>
        </div>

        {/* Right Section - Global Actions & Status */}
        <div className="flex items-center gap-16 flex-1 justify-end">
          {/* Device badge — driven by live Zustand hardware state */}
          {hardwareLoading && !connectedBoard ? (
            <SkeletonLoader className="h-[32px] w-[120px] rounded-lg" />
          ) : connectedBoard ? (
            <Badge
              variant="success"
              className="h-[32px] px-12 gap-8 font-mono text-[12px] uppercase tracking-wider rounded-lg flex items-center justify-center"
            >
              <Cpu className="w-[14px] h-[14px]" />
              {connectedBoard.name}
            </Badge>
          ) : (
            <Badge
              variant="default"
              className="h-[32px] px-12 gap-8 bg-dark-surface border-dark-border-strong text-disabled font-mono text-[12px] uppercase tracking-wider rounded-lg flex items-center justify-center"
            >
              <Cpu className="w-[14px] h-[14px]" />
              No Device
            </Badge>
          )}

          <div className="h-6 w-[1px] bg-dark-border" />

          <div className="flex items-center gap-8">
            {/* Save — wired to saveProject via Zustand */}
            <Button
              id="topbar-save-btn"
              variant={canSave ? 'primary' : 'ghost'}
              size="sm"
              className={
                canSave
                  ? 'h-[32px] transition-all duration-300'
                  : 'h-[32px] text-disabled hover:text-white hover:!bg-transparent hover:drop-shadow-[var(--shadow-glow)] transition-all duration-300'
              }
              leftIcon={<Save className="w-4 h-4" />}
              isLoading={projectSaving}
              disabled={!canSave}
              onClick={handleSave}
            >
              {projectSaving ? 'Saving...' : 'Save'}
            </Button>

            {lastSavedAt && !projectSaving && (
              <span className="text-[11px] text-disabled font-mono hidden lg:block">
                {formatSavedAgo(lastSavedAt, now)}
              </span>
            )}

            {/* Generate — placeholder, not yet implemented */}
            <Button
              variant="ghost"
              size="sm"
              className="h-[32px] text-disabled hover:text-white hover:!bg-transparent hover:drop-shadow-[var(--shadow-glow)] transition-all duration-300"
              leftIcon={<Sparkles className="w-4 h-4" />}
              disabled
            >
              Generate
            </Button>

            {/* Upload — wired to compileAndUploadFirmware via Zustand */}
            <Button
              id="topbar-upload-btn"
              variant={canUpload ? 'primary' : 'ghost'}
              size="sm"
              className={
                canUpload
                  ? 'h-[32px] transition-all duration-300'
                  : 'h-[32px] text-disabled hover:text-white hover:!bg-transparent hover:drop-shadow-[var(--shadow-glow)] transition-all duration-300'
              }
              leftIcon={<Upload className="w-4 h-4" />}
              isLoading={uploadLoading}
              disabled={!canUpload}
              onClick={handleUpload}
            >
              {uploadLoading ? 'Uploading...' : 'Upload'}
            </Button>

            {/* Run — placeholder, not yet implemented */}
            <Button
              variant="ghost"
              size="sm"
              className="h-[32px] text-disabled hover:text-white hover:!bg-transparent hover:drop-shadow-[var(--shadow-glow)] transition-all duration-300"
              leftIcon={<Play className="w-4 h-4" />}
              disabled
            >
              Run
            </Button>
          </div>

          <div className="h-6 w-[1px] bg-dark-border" />

          {/* CLI status indicator */}
          {hardware.cli.isInstalled && (
            <div className="flex items-center gap-6 text-[11px] text-disabled font-mono">
              <span className="w-[6px] h-[6px] rounded-full bg-primary shadow-glow-primary" />
              CLI {hardware.cli.version}
            </div>
          )}
          {hardware.isScanning && (
            <Loader2 className="w-[14px] h-[14px] text-disabled animate-spin" />
          )}

          <NavLink
            to="/settings"
            className="text-disabled hover:text-white hover:drop-shadow-[var(--shadow-glow)] transition-all duration-300"
          >
            <IconButton
              icon={<SettingsIcon className="w-5 h-5" />}
              aria-label="Settings"
              className="bg-transparent hover:!bg-transparent"
            />
          </NavLink>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Upload status strip                                                  */}
      {/*                                                                      */}
      {/* Shown only when an upload has completed and no new upload is active. */}
      {/* Cleared implicitly when a new operation starts (uploadError reset).  */}
      {/* ------------------------------------------------------------------ */}
      {(uploadSucceeded || hasUploadError) && !uploadLoading && (
        <div
          className={`px-24 py-8 flex items-center gap-10 text-[12px] font-medium border-t ${
            uploadSucceeded
              ? 'bg-success/10 border-success/20 text-success'
              : 'bg-error/10 border-error/20 text-error'
          }`}
        >
          {uploadSucceeded ? (
            <>
              <CheckCircle2 className="w-[14px] h-[14px] shrink-0" />
              Firmware uploaded successfully.
              <Button
                id="topbar-view-serial-btn"
                variant="ghost"
                size="sm"
                className="ml-auto h-[24px] text-success hover:text-white hover:!bg-transparent"
                leftIcon={<Activity className="w-3.5 h-3.5" />}
                onClick={() => navigate('/monitor')}
              >
                View Serial Output
              </Button>
            </>
          ) : (
            <>
              <AlertCircle className="w-[14px] h-[14px] shrink-0" />
              {uploadError ?? 'Upload failed. Check the board connection and try again.'}
            </>
          )}
        </div>
      )}
    </header>
  )
}

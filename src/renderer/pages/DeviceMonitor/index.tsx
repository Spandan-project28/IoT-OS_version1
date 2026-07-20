import { TopBar } from '../../components/layout/TopBar'
import { Panel } from '../../components/common/Panel'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { SkeletonLoader } from '../../components/common/SkeletonLoader'
import { useAppStore } from '../../store/useAppStore'
import { Activity, Terminal, Cpu, Usb, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import React from 'react'

export function DeviceMonitor(): React.JSX.Element {
  const { hardware, hardwareLoading, hardwareError, hardwareInitialized } = useAppStore()

  const connectedBoard = hardware.connectedBoards[0] ?? null

  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar />
      <div className="flex-1 p-24 md:p-32 flex flex-col gap-24 overflow-hidden w-full">
        {/* Error banner */}
        {hardwareError && (
          <div className="flex items-center gap-12 px-16 py-12 rounded-xl bg-error/10 border border-error/20 text-error text-[13px] shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {hardwareError}
          </div>
        )}

        {/* Stat cards row */}
        <div className="grid grid-cols-3 gap-24 shrink-0">
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

        {/* Detected ports panel */}
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
                    {matchingBoard ? (
                      <div className="flex items-center gap-8">
                        <span className="text-[12px] text-text-secondary truncate max-w-[140px]">
                          {matchingBoard.name}
                        </span>
                        <Badge variant="success">Identified</Badge>
                      </div>
                    ) : (
                      <Badge variant="default">Unknown</Badge>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        {/* Serial console placeholder — streaming is out of scope for this phase */}
        <Panel className="flex-1" title="Serial Console">
          <div className="flex flex-col items-center justify-center h-full py-48 gap-12 text-center px-24">
            <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center border border-border">
              <Terminal className="w-6 h-6 text-text-secondary/60" />
            </div>
            <div className="text-[15px] font-semibold text-text-primary">
              {connectedBoard ? `${connectedBoard.name} detected` : 'Waiting for device...'}
            </div>
            <div className="text-[13px] text-text-secondary max-w-[380px]">
              {connectedBoard
                ? 'Serial streaming will be available in a future phase.'
                : 'Connect a board to start monitoring serial output and viewing live sensor data.'}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

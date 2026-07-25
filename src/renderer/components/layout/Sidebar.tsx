import { NavLink } from 'react-router-dom'
import { navigationConfig } from '../../domain/navigation/config'
import { useAppStore } from '../../store/useAppStore'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { IconButton } from '../common/IconButton'
import { Tooltip } from '../common/Tooltip'
import { SkeletonLoader } from '../common/SkeletonLoader'
import React from 'react'

export function Sidebar(): React.JSX.Element {
  const { sidebarCollapsed, toggleSidebar, hardware, hardwareLoading } = useAppStore()

  const connectedBoard = hardware.connectedBoards[0] ?? null

  return (
    <div
      className={`flex flex-col h-full bg-dark-bg border-r border-dark-border transition-all duration-300 ease-in-out select-none ${
        sidebarCollapsed ? 'w-[76px]' : 'w-[180px]'
      }`}
    >
      <div className="flex items-center justify-between p-24 h-20 shrink-0">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-12 pl-4 overflow-hidden">
            <div className="w-6 h-6 rounded-md bg-primary shrink-0 shadow-glow-primary flex items-center justify-center">
              <div className="w-2 h-2 bg-dark-bg rounded-sm" />
            </div>
            <span className="font-bold text-white tracking-tight whitespace-nowrap text-[16px]">
              IoT-OS
            </span>
          </div>
        )}
        <IconButton
          icon={
            sidebarCollapsed ? (
              <PanelLeftOpen className="w-[16px] h-[16px] text-[#A0A0A0]" />
            ) : (
              <PanelLeftClose className="w-[16px] h-[16px] text-[#A0A0A0] hover:text-white transition-colors" />
            )
          }
          onClick={toggleSidebar}
          className={sidebarCollapsed ? 'mx-auto' : 'bg-transparent hover:bg-dark-surface'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        />
      </div>

      <div className="px-16 mt-8 mb-4">
        {!sidebarCollapsed && (
          <div className="px-12 text-[11px] font-bold tracking-[0.1em] text-[#A0A0A0] mb-6 uppercase">
            Workspace
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-4 px-16">
        {navigationConfig.map((item) => (
          <Tooltip key={item.id} content={sidebarCollapsed ? item.label : ''} position="right">
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center gap-12 px-12 py-10 rounded-xl transition-all duration-300 relative ${
                  isActive
                    ? 'text-primary drop-shadow-[var(--shadow-glow-primary)]'
                    : 'text-disabled hover:text-white hover:drop-shadow-[var(--shadow-glow)]'
                } ${sidebarCollapsed ? 'justify-center' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={`w-[18px] h-[18px] shrink-0 transition-colors duration-300 ${
                      isActive ? 'text-primary' : 'text-disabled group-hover:text-white'
                    }`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {!sidebarCollapsed && (
                    <span className="text-[14px] font-medium tracking-wide">{item.label}</span>
                  )}
                </>
              )}
            </NavLink>
          </Tooltip>
        ))}
      </nav>

      {/* Device connection status footer */}
      <div className="p-24 border-t border-dark-border shrink-0 flex items-center justify-center">
        {sidebarCollapsed ? (
          <Tooltip content={connectedBoard ? connectedBoard.name : 'No Device'} position="right">
            <div
              className={`w-8 h-8 rounded-full border ${
                connectedBoard
                  ? 'bg-primary border-primary shadow-glow-primary'
                  : 'bg-dark-surface border-dark-border-strong'
              }`}
            />
          </Tooltip>
        ) : hardwareLoading && !connectedBoard ? (
          <div className="w-full px-8 flex items-center gap-10">
            <SkeletonLoader className="w-[10px] h-[10px] rounded-full shrink-0" />
            <SkeletonLoader className="h-[12px] w-24 rounded" />
          </div>
        ) : connectedBoard ? (
          <div className="flex flex-col gap-2 text-[12px] w-full px-8 overflow-hidden">
            <div className="flex items-center gap-8">
              <span className="w-[8px] h-[8px] rounded-full bg-primary shadow-glow-primary shrink-0" />
              <span className="text-white font-medium truncate">{connectedBoard.name}</span>
            </div>
            <span className="text-disabled font-mono pl-16 truncate">{connectedBoard.port}</span>
          </div>
        ) : (
          <div className="flex items-center gap-10 text-[13px] text-disabled font-mono w-full px-8">
            <span className="w-[10px] h-[10px] rounded-full bg-dark-border-strong border border-dark-bg ring-2 ring-dark-surface" />
            No Device
          </div>
        )}
      </div>
    </div>
  )
}

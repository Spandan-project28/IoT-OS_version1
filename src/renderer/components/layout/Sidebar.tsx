import { NavLink } from 'react-router-dom'
import { navigationConfig } from '../../domain/navigation/config'
import { useAppStore } from '../../store/useAppStore'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { IconButton } from '../common/IconButton'
import { Tooltip } from '../common/Tooltip'
import React from 'react'

export function Sidebar(): React.JSX.Element {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()

  return (
    <div
      className={`flex flex-col h-full bg-surface-elevated/40 border-r border-border transition-all duration-300 ease-in-out select-none ${
        sidebarCollapsed ? 'w-[68px]' : 'w-[240px]'
      }`}
    >
      <div className="flex items-center justify-between p-16 h-14 shrink-0">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-10 pl-4 overflow-hidden">
            <div className="w-5 h-5 rounded-[4px] bg-gradient-to-br from-text-primary to-text-secondary shrink-0 shadow-sm" />
            <span className="font-semibold text-text-primary tracking-tight whitespace-nowrap text-[14px]">
              IoTOS AI
            </span>
          </div>
        )}
        <IconButton
          icon={
            sidebarCollapsed ? (
              <PanelLeftOpen className="w-[14px] h-[14px] text-text-secondary" />
            ) : (
              <PanelLeftClose className="w-[14px] h-[14px] text-text-secondary hover:text-text-primary transition-colors" />
            )
          }
          onClick={toggleSidebar}
          className={sidebarCollapsed ? 'mx-auto' : ''}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        />
      </div>

      <div className="px-12 mt-4 mb-2">
        {!sidebarCollapsed && (
          <div className="px-8 text-[11px] font-semibold tracking-wider text-text-secondary/70 mb-4 uppercase">
            Workspace
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto flex flex-col gap-[2px] px-12">
        {navigationConfig.map((item) => (
          <Tooltip key={item.id} content={sidebarCollapsed ? item.label : ''} position="right">
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center gap-10 px-8 py-[6px] rounded-md transition-all duration-150 relative ${
                  isActive
                    ? 'text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
                } ${sidebarCollapsed ? 'justify-center' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute inset-0 bg-white/[0.08] rounded-md shadow-sm border border-white/[0.05] -z-10" />
                  )}
                  {isActive && !sidebarCollapsed && (
                    <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 h-4 w-[3px] bg-text-primary rounded-r-full" />
                  )}
                  <item.icon
                    className={`w-[15px] h-[15px] shrink-0 transition-colors ${
                      isActive
                        ? 'text-text-primary'
                        : 'text-text-secondary group-hover:text-text-primary'
                    }`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {!sidebarCollapsed && (
                    <span className="text-[13px] font-medium tracking-wide">{item.label}</span>
                  )}
                </>
              )}
            </NavLink>
          </Tooltip>
        ))}
      </nav>

      {/* Footer area for version or user info later */}
      <div className="p-16 border-t border-border/50 shrink-0 flex items-center justify-center">
        {sidebarCollapsed ? (
          <div className="w-6 h-6 rounded-full bg-surface border border-border" />
        ) : (
          <div className="flex items-center gap-8 text-[12px] text-text-secondary font-mono w-full px-8">
            <span className="w-2 h-2 rounded-full bg-border-strong" />
            Disconnected
          </div>
        )}
      </div>
    </div>
  )
}

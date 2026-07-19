import {
  Cpu,
  Search,
  Play,
  Upload,
  Sparkles,
  Settings as SettingsIcon,
  ChevronRight
} from 'lucide-react'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { IconButton } from '../common/IconButton'
import { NavLink, useLocation } from 'react-router-dom'
import { navigationConfig } from '../../domain/navigation/config'
import React from 'react'

export interface TopBarProps {
  children?: React.ReactNode
}

export function TopBar({ children }: TopBarProps): React.JSX.Element {
  const location = useLocation()
  const currentPage = navigationConfig.find((item) => item.path === location.pathname)

  return (
    <header className="h-20 border-b border-dark-border bg-dark-bg flex items-center px-24 shrink-0 justify-between select-none">
      {/* Left Section - Page Title & Breadcrumb */}
      <div className="flex items-center gap-12 flex-1 min-w-0">
        <div className="flex items-center text-text-disabled text-[14px] font-medium tracking-wide">
          <span className="hover:text-white cursor-pointer transition-colors">IoTOS AI</span>
          <ChevronRight className="w-4 h-4 mx-4 opacity-50" />
          <span className="text-white">{currentPage?.label || 'Dashboard'}</span>
        </div>
        {children && (
          <>
            <div className="w-[1px] h-4 bg-dark-border mx-4" />
            <div className="text-white text-[14px] font-medium">{children}</div>
          </>
        )}
      </div>

      {/* Center Section - Large Command Search Bar */}
      <div className="flex-1 flex justify-center px-32 max-w-[600px] hidden md:flex">
        <div className="relative w-full group">
          <Search className="w-[16px] h-[16px] absolute left-16 top-1/2 -translate-y-1/2 text-text-disabled group-hover:text-white transition-colors" />
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
        <Badge
          variant="default"
          className="h-[32px] px-12 gap-8 bg-dark-surface border-dark-border-strong text-text-disabled font-mono text-[12px] uppercase tracking-wider rounded-lg flex items-center justify-center"
        >
          <Cpu className="w-[14px] h-[14px]" />
          No Device
        </Badge>

        <div className="h-6 w-[1px] bg-dark-border" />

        <div className="flex items-center gap-8">
          <Button
            variant="ghost"
            size="sm"
            className="h-[32px] text-text-disabled hover:text-white hover:!bg-transparent hover:drop-shadow-[var(--shadow-glow)] transition-all duration-300"
            leftIcon={<Sparkles className="w-4 h-4" />}
            disabled
          >
            Generate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-[32px] text-text-disabled hover:text-white hover:!bg-transparent hover:drop-shadow-[var(--shadow-glow)] transition-all duration-300"
            leftIcon={<Upload className="w-4 h-4" />}
            disabled
          >
            Upload
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-[32px] text-text-disabled hover:text-white hover:!bg-transparent hover:drop-shadow-[var(--shadow-glow)] transition-all duration-300"
            leftIcon={<Play className="w-4 h-4" />}
            disabled
          >
            Run
          </Button>
        </div>

        <div className="h-6 w-[1px] bg-dark-border" />

        <NavLink
          to="/settings"
          className="text-text-disabled hover:text-white hover:drop-shadow-[var(--shadow-glow)] transition-all duration-300"
        >
          <IconButton
            icon={<SettingsIcon className="w-5 h-5" />}
            aria-label="Settings"
            className="bg-transparent hover:!bg-transparent"
          />
        </NavLink>
      </div>
    </header>
  )
}

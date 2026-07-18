import { Cpu, Search, Play, Upload, Sparkles, Settings as SettingsIcon } from 'lucide-react'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { IconButton } from '../common/IconButton'
import { NavLink } from 'react-router-dom'
import React from 'react'

export interface TopBarProps {
  children?: React.ReactNode
}

export function TopBar({ children }: TopBarProps): React.JSX.Element {
  return (
    <header className="h-14 border-b border-border bg-background flex items-center px-16 shrink-0 justify-between select-none">
      {/* Left Section - Context */}
      <div className="flex items-center gap-12 flex-1 min-w-0">{children}</div>

      {/* Center Section - Search */}
      <div className="flex-1 flex justify-center px-24 max-w-md hidden md:flex">
        <div className="relative w-full">
          <Search className="w-[14px] h-[14px] absolute left-10 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Search commands and files..."
            className="w-full bg-surface-elevated/50 border border-border rounded-lg pl-32 pr-12 py-[5px] text-[13px] text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-border-strong focus:bg-surface-elevated transition-all"
            disabled
          />
        </div>
      </div>

      {/* Right Section - Global Actions & Status */}
      <div className="flex items-center gap-12 flex-1 justify-end">
        <Badge
          variant="default"
          className="gap-6 bg-surface-elevated/50 border-border text-text-secondary font-mono text-[11px] uppercase tracking-wider"
        >
          <Cpu className="w-3 h-3 opacity-70" />
          No Device Detected
        </Badge>

        <div className="h-4 w-[1px] bg-border mx-2" />

        <div className="flex items-center gap-6">
          <Button variant="ghost" size="sm" leftIcon={<Sparkles className="w-3 h-3" />} disabled>
            Generate
          </Button>
          <Button variant="ghost" size="sm" leftIcon={<Upload className="w-3 h-3" />} disabled>
            Upload
          </Button>
          <Button variant="ghost" size="sm" leftIcon={<Play className="w-3 h-3" />} disabled>
            Run
          </Button>
        </div>

        <div className="h-4 w-[1px] bg-border mx-2" />

        <NavLink
          to="/settings"
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          <IconButton icon={<SettingsIcon className="w-4 h-4" />} aria-label="Settings" />
        </NavLink>
      </div>
    </header>
  )
}

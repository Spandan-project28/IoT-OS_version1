import { Home, Folder, Code2, Activity, Settings } from 'lucide-react'

import React from 'react'

export interface NavigationItem {
  id: string
  label: string
  path: string
  icon: React.ElementType
}

export const navigationConfig: NavigationItem[] = [
  { id: 'home', label: 'Home', path: '/', icon: Home },
  { id: 'projects', label: 'Projects', path: '/projects', icon: Folder },
  { id: 'editor', label: 'Editor', path: '/editor', icon: Code2 },
  { id: 'monitor', label: 'Device Monitor', path: '/monitor', icon: Activity },
  { id: 'settings', label: 'Settings', path: '/settings', icon: Settings }
]

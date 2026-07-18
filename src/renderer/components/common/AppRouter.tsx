import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '../../layouts/AppLayout'
import { Home } from '../../pages/Home'
import { Projects } from '../../pages/Projects'
import { Editor } from '../../pages/Editor'
import { DeviceMonitor } from '../../pages/DeviceMonitor'
import { Settings } from '../../pages/Settings'

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="projects" element={<Projects />} />
        <Route path="editor" element={<Editor />} />
        <Route path="monitor" element={<DeviceMonitor />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

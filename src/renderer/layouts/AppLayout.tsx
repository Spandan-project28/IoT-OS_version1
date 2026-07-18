import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'

export function AppLayout(): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-text-primary font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </div>
    </div>
  )
}

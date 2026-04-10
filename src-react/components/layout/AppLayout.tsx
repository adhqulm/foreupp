import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'
import { useAppSettings } from '../../context/AppSettingsContext'

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

export default function AppLayout() {
  const { hideTitleBar } = useAppSettings()
  return (
    <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">
      {isTauri && !hideTitleBar && <TitleBar />}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 min-h-0 h-full overflow-hidden flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SpaceProvider } from './context/SpaceContext'
import { ThemeProvider } from './context/ThemeContext'
import { AppSettingsProvider } from './context/AppSettingsContext'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import CalendarPage from './pages/CalendarPage'
import TrackersPage from './pages/TrackersPage'
import CountdownsPage from './pages/CountdownsPage'
import OnboardingPage from './pages/OnboardingPage'
import SettingsPage from './pages/SettingsPage'
import KanbanPage from './pages/KanbanPage'
import MessengerPage from './pages/MessengerPage'

function PrivateRoute({ children, requireSpace = true }: { children: React.ReactNode; requireSpace?: boolean }) {
  const { user, userProfile, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen bg-bg-primary"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (requireSpace && userProfile && !userProfile.spaceId) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen bg-bg-primary"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
  if (user) return <Navigate to="/calendar" replace />
  return <>{children}</>
}

const BASE_W = 820

function ScaleWrapper({ children }: { children: React.ReactNode }) {
  const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    const update = () => setDims({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const scale = Math.min(dims.w / BASE_W, 1)

  if (scale >= 1) return <>{children}</>

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div style={{
        width: BASE_W,
        height: Math.round(dims.h / scale),
        transformOrigin: 'top left',
        transform: `scale(${scale})`,
      }}>
        {children}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ScaleWrapper>
    <ThemeProvider>
    <AppSettingsProvider>
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
          <Route path="/onboarding" element={<PrivateRoute requireSpace={false}><SpaceProvider><OnboardingPage /></SpaceProvider></PrivateRoute>} />
          <Route path="/" element={<PrivateRoute><SpaceProvider><AppLayout /></SpaceProvider></PrivateRoute>}>
            <Route index element={<Navigate to="/calendar" replace />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="trackers" element={<TrackersPage />} />
            <Route path="countdowns" element={<CountdownsPage />} />
            <Route path="kanban" element={<KanbanPage />} />
            <Route path="messenger" element={<MessengerPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/calendar" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
    </AppSettingsProvider>
    </ThemeProvider>
    </ScaleWrapper>
  )
}

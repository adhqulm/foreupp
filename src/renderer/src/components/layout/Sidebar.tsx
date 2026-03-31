import { NavLink, useNavigate } from 'react-router-dom'
import { Calendar, BarChart2, Timer, LogOut, Settings } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSpace } from '../../context/SpaceContext'
import clsx from 'clsx'

const navItems = [
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/trackers', icon: BarChart2, label: 'Trackers' },
  { to: '/countdowns', icon: Timer, label: 'Countdowns' }
]

export default function Sidebar() {
  const { user, userProfile, signOut } = useAuth()
  const { partner } = useSpace()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="w-56 flex flex-col bg-bg-secondary border-r border-border shrink-0">
      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-600/30'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Partner status */}
      {partner && (
        <div className="px-3 pb-2">
          <div className="card p-3">
            <p className="text-xs text-text-muted mb-2 uppercase tracking-wider font-semibold">Shared with</p>
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: partner.color }}
              >
                {partner.displayName?.[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="text-sm text-text-primary truncate">{partner.displayName}</span>
            </div>
          </div>
        </div>
      )}

      {/* User */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: userProfile?.color ?? '#7c3aed' }}
          >
            {userProfile?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{userProfile?.displayName ?? 'You'}</p>
            <p className="text-xs text-text-muted truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={handleSignOut} className="btn-ghost w-full flex items-center gap-2 text-xs">
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

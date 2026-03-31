import React, { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Calendar, BarChart2, Timer, Settings2, UserPlus, LogOut, ChevronUp, ChevronLeft, ChevronRight, X, LayoutGrid, Send } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSpace } from '../../context/SpaceContext'
import { useTranslation } from '../../hooks/useTranslation'
import clsx from 'clsx'

type NavEntry =
  | { spacer: true }
  | { to: string; icon: React.ElementType; key: string; label?: string }

const NAV_KEYS: NavEntry[] = [
  { to: '/calendar',   icon: Calendar,    key: 'calendar' },
  { to: '/trackers',   icon: BarChart2,   key: 'trackers' },
  { to: '/countdowns', icon: Timer,       key: 'countdowns' },
  { to: '/kanban',     icon: LayoutGrid,  key: 'kanban' },
  { spacer: true },
  { to: '/messenger',  icon: Send,        key: 'chat', label: 'Chat' },
]

interface SavedAccount { uid: string; email: string; displayName: string; photoURL?: string; _p?: string }

function loadSavedAccounts(): SavedAccount[] {
  try { return JSON.parse(localStorage.getItem('saved-accounts') ?? '[]') } catch { return [] }
}

export default function Sidebar() {
  const { user, userProfile, signIn, signOut } = useAuth()
  const { partner, members } = useSpace()
  const navigate = useNavigate()
  const t = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)

  // Auto-collapse when window is too narrow
  useEffect(() => {
    const check = () => setCollapsed(window.innerWidth < 700)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([])
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const avatarBtnRef = useRef<HTMLButtonElement>(null)
  const [popoverPos, setPopoverPos] = useState({ bottom: 0, left: 0, width: 0 })

  useEffect(() => {
    setSavedAccounts(loadSavedAccounts())
  }, [accountMenuOpen])

  const openMenu = () => {
    if (avatarBtnRef.current) {
      const rect = avatarBtnRef.current.getBoundingClientRect()
      setPopoverPos({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        width: Math.max(rect.width, 220),
      })
    }
    setAccountMenuOpen(true)
  }

  const handleSignOut = async () => { await signOut(); navigate('/login') }

  const handleSwitchAccount = async (account: SavedAccount) => {
    if (account.uid === user?.uid) { setAccountMenuOpen(false); return }
    setAccountMenuOpen(false)
    if (account._p) {
      try {
        await signOut()
        await signIn(account.email, atob(account._p))
        navigate('/calendar')
      } catch {
        // Credentials stale — fall back to login page
        navigate(`/login?email=${encodeURIComponent(account.email)}`)
      }
    } else {
      await signOut()
      navigate(`/login?email=${encodeURIComponent(account.email)}`)
    }
  }

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    setAddLoading(true)
    try {
      await signOut()
      await signIn(addEmail, addPassword)
      setShowAddAccount(false)
      setAddEmail('')
      setAddPassword('')
      navigate('/calendar')
    } catch (err: any) {
      setAddError(err.message?.includes('invalid-credential') ? 'Invalid email or password' : 'Something went wrong')
      setAddLoading(false)
    }
  }

  const avatarSrc = userProfile?.photoURL
  const initials = (userProfile?.displayName?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase()

  return (
    <>
      <aside className={clsx('flex flex-col bg-bg-secondary border-r border-border shrink-0 transition-all duration-200', collapsed ? 'w-14' : 'w-56')}>

        {/* Logo + collapse toggle */}
        <div className={clsx('px-2 pt-2 pb-1 flex items-center', collapsed ? 'justify-center' : 'justify-between')}>
          {!collapsed && (
            <div className="flex items-center gap-2 px-1">
              <div className="w-3 h-3 rounded-full bg-violet-500/60 shrink-0" />
              <span className="text-xs font-semibold text-text-secondary tracking-widest uppercase">FöreUpp</span>
            </div>
          )}
          <button onClick={() => setCollapsed(v => !v)}
            className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 pt-1 space-y-0.5">
          {NAV_KEYS.map((item, i) => {
            if ('spacer' in item) {
              return <div key={`spacer-${i}`} className="py-2.5" />
            }
            const { to, icon: Icon, key, label: itemLabel } = item
            const label = itemLabel ?? (t[key] ?? key)
            return (
              <NavLink key={to} to={to}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  collapsed ? 'justify-center' : '',
                  isActive
                    ? 'bg-violet-600/20 text-text-primary border border-violet-600/30'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                )}
                title={collapsed ? label : undefined}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && label}
              </NavLink>
            )
          })}
        </nav>

        {/* Settings */}
        <div className="px-2 pb-1">
          <NavLink to="/settings"
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
              collapsed ? 'justify-center' : '',
              isActive
                ? 'bg-violet-600/20 text-text-primary border border-violet-600/30'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            )}
            title={collapsed ? (t.settings ?? 'Settings') : undefined}
          >
            <Settings2 size={16} className="shrink-0" />
            {!collapsed && (t.settings ?? 'Settings')}
          </NavLink>
        </div>

        {/* Shared with — only shown when connected, sits below settings */}
        {partner && !collapsed && (
          <div className="px-2 pb-2 pt-1">
            <div className="card p-2.5">
              <p className="text-xs text-text-muted mb-1.5 uppercase tracking-wider font-semibold">{t.sharedWith ?? 'Shared with'}</p>
              <div className="space-y-1.5">
                {Object.values(members).filter(m => m.uid !== user?.uid).map(m => (
                  <div key={m.uid} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden shrink-0"
                      style={{ backgroundColor: m.color }}>
                      {m.photoURL
                        ? <img src={m.photoURL} alt="" className="w-full h-full object-cover" />
                        : m.displayName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className="text-sm text-text-primary truncate">{m.displayName}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* User profile button */}
        <div className="p-2 border-t border-border">
          <button ref={avatarBtnRef} onClick={openMenu}
            className={clsx('w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-hover transition-colors', collapsed && 'justify-center px-0')}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
              style={{ backgroundColor: avatarSrc ? 'transparent' : (userProfile?.color ?? '#7c3aed') }}>
              {avatarSrc
                ? <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
                : initials}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-text-primary truncate">{userProfile?.displayName ?? 'You'}</p>
                  <p className="text-xs text-text-muted truncate">{user?.email}</p>
                </div>
                <ChevronUp size={13} className={clsx('text-text-muted transition-transform shrink-0', accountMenuOpen && 'rotate-180')} />
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Account menu — fixed so it's never clipped */}
      {accountMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAccountMenuOpen(false)} />
          <div className="fixed z-50 bg-bg-secondary border border-border rounded-xl shadow-xl overflow-hidden"
            style={{ bottom: popoverPos.bottom, left: popoverPos.left, width: popoverPos.width, minWidth: 220 }}>

            {savedAccounts.length > 0 && (
              <div className="px-2 py-2 border-b border-border">
                <p className="text-xs text-text-muted font-semibold uppercase tracking-wider px-2 mb-1.5">{t.switchAccount ?? 'Accounts'}</p>
                {savedAccounts.map(account => (
                  <button key={account.uid} onClick={() => handleSwitchAccount(account)}
                    className={clsx('w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors',
                      account.uid === user?.uid ? 'bg-violet-600/15 text-text-primary' : 'text-text-secondary hover:bg-surface-hover')}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
                      style={{ backgroundColor: account.photoURL ? 'transparent' : '#7c3aed' }}>
                      {account.photoURL
                        ? <img src={account.photoURL} alt="" className="w-full h-full object-cover" />
                        : (account.displayName?.[0] ?? account.email?.[0] ?? 'U').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-medium truncate">{account.displayName || account.email}</p>
                      <p className="text-xs text-text-muted truncate">{account.email}</p>
                    </div>
                    {account.uid === user?.uid && <div className="w-2 h-2 rounded-full bg-violet-600 shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            <div className="px-2 py-2">
              <button onClick={() => { setAccountMenuOpen(false); setShowAddAccount(true) }}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-text-secondary hover:bg-surface-hover transition-colors">
                <div className="w-7 h-7 rounded-full border-2 border-dashed border-border flex items-center justify-center shrink-0">
                  <UserPlus size={13} className="text-text-muted" />
                </div>
                <span>{t.addAccount ?? 'Add account'}</span>
              </button>
            </div>

            <div className="px-2 py-2 border-t border-border">
              <button onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                <LogOut size={14} />
                <span>{t.signOut ?? 'Sign out'}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add account modal */}
      {showAddAccount && (
        <div className="modal-overlay" onClick={() => setShowAddAccount(false)}>
          <div className="modal max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-text-primary">{t.addAccount ?? 'Add account'}</h3>
              <button onClick={() => setShowAddAccount(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <form onSubmit={handleAddAccount} className="space-y-3">
              <input
                type="email"
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                className="input"
                placeholder="Email"
                required
                autoFocus
              />
              <input
                type="password"
                value={addPassword}
                onChange={e => setAddPassword(e.target.value)}
                className="input"
                placeholder="Password"
                required
              />
              {addError && (
                <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{addError}</p>
              )}
              <button type="submit" className="btn-primary w-full" disabled={addLoading}>
                {addLoading ? '...' : (t.signIn ?? 'Sign in')}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

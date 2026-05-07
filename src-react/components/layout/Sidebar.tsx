import React, { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Calendar, BarChart2, Timer, Hourglass, Settings2, UserPlus, LogOut, ChevronUp, ChevronLeft, ChevronRight, LayoutGrid, Send, ArrowLeft } from 'lucide-react'
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
  { to: '/countdowns', icon: Hourglass,   key: 'countdowns' },
  { to: '/kanban',     icon: LayoutGrid,  key: 'kanban' },
  { to: '/pomodoro',   icon: Timer,       key: 'pomodoro', label: 'Pomodoro' },
{ spacer: true },
  { to: '/messenger',  icon: Send,        key: 'chat', label: 'Chat' },
]

interface SavedAccount { uid: string; email: string; displayName: string; photoURL?: string; _p?: string }

function loadSavedAccounts(): SavedAccount[] {
  try { return JSON.parse(localStorage.getItem('saved-accounts') ?? '[]') } catch { return [] }
}

export default function Sidebar() {
  const { user, userProfile, signIn, signOut } = useAuth()
  const { partner, members, unreadCounts } = useSpace()
  const navigate = useNavigate()
  const t = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  // Auto-collapse when window is too narrow
  useEffect(() => {
    const check = () => setCollapsed(window.innerWidth < 700)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([])
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
        width: Math.max(rect.width, 320),
      })
    }
    setShowAddForm(false)
    setAddEmail('')
    setAddPassword('')
    setAddError('')
    setAccountMenuOpen(true)
  }

  const closeMenu = () => {
    setAccountMenuOpen(false)
    setShowAddForm(false)
    setAddEmail('')
    setAddPassword('')
    setAddError('')
  }

  const handleSignOut = async () => { await signOut(); navigate('/login') }

  const handleSwitchAccount = async (account: SavedAccount) => {
    if (account.uid === user?.uid) { closeMenu(); return }
    closeMenu()
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
      closeMenu()
      navigate('/calendar')
    } catch (err: any) {
      setAddError(err.message?.includes('invalid-credential') ? 'Invalid email or password' : 'Something went wrong')
      setAddLoading(false)
    }
  }

  const avatarSrc = userProfile?.photoURL
  const initials = (userProfile?.displayName?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase()
  const displayName = userProfile?.displayName ?? user?.email ?? 'You'

  return (
    <>
      <aside className={clsx('flex flex-col bg-bg-secondary border-r border-border shrink-0 transition-all duration-200', collapsed ? 'w-14' : 'w-56')}>

        {/* Logo + collapse toggle */}
        <div className={clsx('px-2 pt-2 pb-1 flex items-center', collapsed ? 'justify-center' : 'justify-between')}>
          {!collapsed && (
            <div className="flex-1 flex items-center justify-center gap-1">
              <img src="/transparentlogo.png" alt="" className="w-8 h-8 shrink-0 object-contain" />
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
            const totalUnread = key === 'chat' ? Object.values(unreadCounts).reduce((s, n) => s + n, 0) : 0
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
                <div className="relative shrink-0">
                  <Icon size={16} />
                  {totalUnread > 0 && collapsed && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                  )}
                </div>
                {!collapsed && label}
                {!collapsed && totalUnread > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
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
                {Object.values(members).filter(m => m.uid !== user?.uid).map(m => {
                  const online = m.lastSeen && (Date.now() - m.lastSeen) < 5 * 60 * 1000
                  return (
                    <div key={m.uid} className="flex items-center gap-2">
                      <div className="relative shrink-0">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden"
                          style={{ backgroundColor: m.color, lineHeight: 1 }}>
                          {m.photoURL
                            ? <img src={m.photoURL} alt="" className="w-full h-full object-cover" />
                            : m.displayName?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-bg-secondary', online ? 'bg-green-500' : 'bg-text-muted/40')} />
                      </div>
                      <span className="text-sm text-text-primary truncate">{m.displayName}</span>
                    </div>
                  )
                })}
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
              style={{ backgroundColor: avatarSrc ? 'transparent' : (userProfile?.color ?? '#7c3aed'), lineHeight: 1 }}>
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

      {/* Profile popup — fixed so it's never clipped */}
      {accountMenuOpen && (
        <>
          {/* Click-outside overlay */}
          <div className="fixed inset-0 z-40" onClick={closeMenu} />

          <div
            className="fixed z-50 bg-bg-secondary border border-border rounded-2xl shadow-xl overflow-hidden"
            style={{ bottom: popoverPos.bottom, left: popoverPos.left, width: 320 }}
          >
            {!showAddForm ? (
              <>
                {/* ── Profile header ── */}
                <div className="px-4 py-5 flex flex-col items-center text-center">
                  {/* Large avatar */}
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white overflow-hidden shrink-0"
                    style={{ backgroundColor: avatarSrc ? 'transparent' : (userProfile?.color ?? '#7c3aed'), lineHeight: 1 }}
                  >
                    {avatarSrc
                      ? <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
                      : initials}
                  </div>

                  {/* Display name */}
                  <p className="text-base font-semibold text-text-primary mt-3">{displayName}</p>

                  {/* Email */}
                  <p className="text-xs text-text-muted mt-1">{userProfile?.email ?? user?.email}</p>

                  {/* Phone (if present and not an email address) */}
                  {userProfile?.phone && !userProfile.phone.includes('@') && (
                    <p className="text-xs text-text-secondary mt-1">{userProfile.phone}</p>
                  )}

                  {/* Bio (if present) */}
                  {userProfile?.bio && (
                    <p className="text-xs text-text-muted mt-2 italic leading-relaxed max-w-[200px]">{userProfile.bio}</p>
                  )}

                  {/* Online status */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span className="text-xs text-green-500">Online</span>
                  </div>
                </div>

                {/* ── Divider ── */}
                <div className="border-t border-border" />

                {/* ── Saved accounts ── */}
                {savedAccounts.length > 0 && (
                  <>
                    <div className="px-2 py-2">
                      <p className="text-xs text-text-muted font-semibold uppercase tracking-wider px-2 py-2">
                        {t.switchAccount ?? 'Accounts'}
                      </p>
                      {savedAccounts.map(account => (
                        <button
                          key={account.uid}
                          onClick={() => handleSwitchAccount(account)}
                          className={clsx(
                            'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors',
                            account.uid === user?.uid
                              ? 'bg-violet-600/15 text-text-primary'
                              : 'text-text-secondary hover:bg-surface-hover'
                          )}
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
                            style={{ backgroundColor: account.photoURL ? 'transparent' : '#7c3aed', lineHeight: 1 }}
                          >
                            {account.photoURL
                              ? <img src={account.photoURL} alt="" className="w-full h-full object-cover" />
                              : (account.displayName?.[0] ?? account.email?.[0] ?? 'U').toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-xs font-medium truncate">{account.displayName || account.email}</p>
                            <p className="text-xs text-text-muted truncate">{account.email}</p>
                          </div>
                          {account.uid === user?.uid && (
                            <div className="w-2 h-2 rounded-full bg-violet-600 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* ── Divider ── */}
                    <div className="border-t border-border" />
                  </>
                )}

                {/* ── Add account ── */}
                <div className="px-2 py-2">
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-text-secondary hover:bg-surface-hover transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full border-2 border-dashed border-border flex items-center justify-center shrink-0">
                      <UserPlus size={13} className="text-text-muted" />
                    </div>
                    <span>{t.addAccount ?? 'Add account'}</span>
                  </button>
                </div>

                {/* ── Divider ── */}
                <div className="border-t border-border" />

                {/* ── Sign out ── */}
                <div className="px-2 py-2">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut size={14} />
                    <span>{t.signOut ?? 'Sign out'}</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* ── Inline add-account form ── */}
                <div className="px-4 py-4">
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={() => { setShowAddForm(false); setAddError('') }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors shrink-0"
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <h3 className="text-sm font-semibold text-text-primary">{t.addAccount ?? 'Add account'}</h3>
                  </div>

                  <form onSubmit={handleAddAccount} className="space-y-3">
                    <input
                      type="email"
                      value={addEmail}
                      onChange={e => setAddEmail(e.target.value)}
                      className="input w-full"
                      placeholder="Email"
                      required
                      autoFocus
                    />
                    <input
                      type="password"
                      value={addPassword}
                      onChange={e => setAddPassword(e.target.value)}
                      className="input w-full"
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
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}

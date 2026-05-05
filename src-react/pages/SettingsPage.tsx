import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { useSpace } from '../context/SpaceContext'
import { useAppSettings } from '../context/AppSettingsContext'
import HueRingPicker from '../components/HueRingPicker'
import ColorPresetPicker from '../components/ColorPresetPicker'
import clsx from 'clsx'
import { LANGUAGES, UI } from '../i18n/translations'
import { ChevronDown, ChevronRight, Check, Copy, Users, Link2Off } from 'lucide-react'

const PRESET_THEMES = [
  { label: 'White',  hue: 0,   mode: 'white' as const },
  { label: 'Beige',  hue: 30,  mode: 'light' as const },
  { label: 'Rose',   hue: 350, mode: 'light' as const },
  { label: 'Sage',   hue: 140, mode: 'light' as const },
  { label: 'Sky',    hue: 210, mode: 'light' as const },
  { label: 'Slate',  hue: 220, mode: 'dark'  as const },
  { label: 'Walnut', hue: 25,  mode: 'dark'  as const },
]

const CITY_TIMEZONES = [
  { city: 'London', timezone: 'Europe/London' },
  { city: 'Paris', timezone: 'Europe/Paris' },
  { city: 'Berlin', timezone: 'Europe/Berlin' },
  { city: 'Helsinki', timezone: 'Europe/Helsinki' },
  { city: 'Moscow', timezone: 'Europe/Moscow' },
  { city: 'Dubai', timezone: 'Asia/Dubai' },
  { city: 'Mumbai', timezone: 'Asia/Kolkata' },
  { city: 'Bangkok', timezone: 'Asia/Bangkok' },
  { city: 'Singapore', timezone: 'Asia/Singapore' },
  { city: 'Tokyo', timezone: 'Asia/Tokyo' },
  { city: 'Seoul', timezone: 'Asia/Seoul' },
  { city: 'Sydney', timezone: 'Australia/Sydney' },
  { city: 'Auckland', timezone: 'Pacific/Auckland' },
  { city: 'New York', timezone: 'America/New_York' },
  { city: 'Chicago', timezone: 'America/Chicago' },
  { city: 'Denver', timezone: 'America/Denver' },
  { city: 'Los Angeles', timezone: 'America/Los_Angeles' },
  { city: 'Toronto', timezone: 'America/Toronto' },
  { city: 'São Paulo', timezone: 'America/Sao_Paulo' },
  { city: 'Buenos Aires', timezone: 'America/Argentina/Buenos_Aires' },
  { city: 'Tbilisi', timezone: 'Asia/Tbilisi' },
  { city: 'Istanbul', timezone: 'Europe/Istanbul' },
  { city: 'Cairo', timezone: 'Africa/Cairo' },
  { city: 'Nairobi', timezone: 'Africa/Nairobi' },
  { city: 'UTC', timezone: 'UTC' },
]

function resizeImageToBase64(file: File, maxSize = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.97))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { user, userProfile, updateProfile, updatePassword, updatePhotoURL } = useAuth()
  const { partner, joinSpace, leaveSpace } = useSpace()
  const { highlightWeekends, setHighlightWeekends, language, setLanguage, timezone, setTimezone, calendarName, setCalendarName, weekendColor, setWeekendColor, use24Hour, setUse24Hour, hideTitleBar, setHideTitleBar, weekStartsOn, setWeekStartsOn } = useAppSettings()
  const t = { ...((UI as any)[language] ?? (UI as any)['en']) }

  const [displayName, setDisplayName] = useState(userProfile?.displayName ?? '')
  const [profileColor, setProfileColor] = useState(userProfile?.color ?? '#7c3aed')
  const [phone, setPhone] = useState(() => { const p = userProfile?.phone; return p && !p.includes('@') && /\d/.test(p) ? p : '' })
  const [bio, setBio] = useState(userProfile?.bio ?? '')

  // Re-sync form when the active user profile changes (e.g. after account switch)
  useEffect(() => {
    setDisplayName(userProfile?.displayName ?? '')
    setProfileColor(userProfile?.color ?? '#7c3aed')
    const p = userProfile?.phone; setPhone(p && !p.includes('@') && /\d/.test(p) ? p : '')
    setBio(userProfile?.bio ?? '')
  }, [userProfile?.uid])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [calendarNameLocal, setCalendarNameLocal] = useState(calendarName)

  // Language dropdown
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)
  const selectedLang = LANGUAGES.find(l => l.code === language)

  // FöreUpp / partner
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinSuccess, setJoinSuccess] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [stopSharingOpen, setStopSharingOpen] = useState(false)
  const [stopSharingLoading, setStopSharingLoading] = useState(false)
  const [showAvatarColor, setShowAvatarColor] = useState(false)
  const [showWeekendColor, setShowWeekendColor] = useState(false)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setJoinError('')
    setJoinLoading(true)
    const result = await joinSpace(joinCode.trim().toUpperCase())
    if (result.success) {
      setJoinSuccess(true)
      setJoinCode('')
    } else {
      setJoinError(result.error ?? 'Failed to join')
    }
    setJoinLoading(false)
  }

  const handleCopyCode = () => {
    if (userProfile?.inviteCode) {
      navigator.clipboard.writeText(userProfile.inviteCode)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    }
  }

  // Change password
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const handleSaveProfile = async () => {
    setSaving(true)
    const cleanPhone = phone.trim(); await updateProfile({ displayName: displayName.trim() || userProfile?.displayName, color: profileColor, phone: /\d/.test(cleanPhone) ? cleanPhone : '', bio: bio.trim() })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleChangePassword = async () => {
    if (!newPassword.trim()) return
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match' })
      return
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters' })
      return
    }
    setPasswordSaving(true)
    setPasswordMsg(null)
    try {
      await updatePassword(newPassword)
      setPasswordMsg({ type: 'success', text: 'Password updated successfully' })
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err?.message ?? 'Failed to update password' })
    } finally {
      setPasswordSaving(false)
    }
  }

  const handlePhotoUpload = async (file: File) => {
    if (!user) return
    setUploadingPhoto(true)
    try {
      const dataUrl = await resizeImageToBase64(file, 2048)
      await updatePhotoURL(dataUrl)
    } catch (err: any) {
      console.error('Photo upload failed:', err)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const avatarSrc = userProfile?.photoURL

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5 max-w-xl">
        <h2 className="text-xl font-bold text-text-primary mb-1">{t.settings ?? 'Settings'}</h2>
        <p className="text-text-muted text-sm mb-8">Customize your experience</p>

        {/* ── Language ─────────────────────────────────────────── */}
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">{t.language ?? 'Language'}</h3>
          <div className="card">
            <label className="block text-xs font-medium text-text-secondary mb-2">{t.appLanguage ?? 'App language'}</label>
            {/* Dropdown button */}
            <div className="relative">
              <button
                onClick={() => setLangDropdownOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary hover:bg-surface-hover transition-colors"
              >
                <span>{selectedLang?.nativeName ?? language}</span>
                <ChevronDown size={14} className={clsx('text-text-muted transition-transform', langDropdownOpen && 'rotate-180')} />
              </button>
              {langDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLangDropdownOpen(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-secondary border border-border rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
                    {LANGUAGES.map(lang => (
                      <button key={lang.code} onClick={() => { setLanguage(lang.code); setLangDropdownOpen(false) }}
                        className={clsx('w-full flex items-center justify-between px-3 py-2 text-sm transition-colors',
                          language === lang.code ? 'bg-violet-600/20 text-text-primary' : 'text-text-secondary hover:bg-surface-hover'
                        )}>
                        <span>{lang.nativeName}</span>
                        {language === lang.code && <Check size={13} className="text-violet-600" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Theme ───────────────────────────────────────────── */}
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">{t.theme ?? 'Theme'}</h3>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-5">
            {(['light', 'dark'] as const).map(m => (
              <button key={m} onClick={() => setTheme({ ...theme, mode: m })}
                className={clsx('px-4 py-2 rounded-lg text-sm font-medium border transition-all capitalize',
                  theme.mode === m
                    ? 'bg-violet-600/25 text-text-primary border-violet-600/30'
                    : 'bg-surface border-border text-text-secondary hover:bg-surface-hover'
                )}>
                {m === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>


          {/* Quick presets */}
          <div className="flex gap-2 flex-wrap mb-5">
            {PRESET_THEMES.map(p => (
              <button key={p.label} onClick={() => setTheme({ hue: p.hue, mode: p.mode })}
                className={clsx('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  theme.hue === p.hue && theme.mode === p.mode
                    ? 'border-violet-600 bg-violet-600/20 text-text-primary'
                    : 'border-border text-text-secondary hover:border-violet-500/50 hover:bg-surface-hover'
                )}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Hue ring */}
          <div className="card flex flex-col items-center gap-4 py-6">
            <p className="text-xs text-text-muted">Drag the ring to pick your colour</p>
            <HueRingPicker
              hue={theme.hue}
              size={160}
              onChange={(_, h) => setTheme({ hue: h, mode: theme.mode === 'white' ? 'light' : theme.mode })}
            />
            <p className="text-xs text-text-muted">
              Current: <span className="font-medium text-text-secondary">
                {theme.mode === 'white' ? 'White' : theme.mode === 'light' ? 'Light' : 'Dark'} · hue {Math.round(theme.hue)}°
              </span>
            </p>
          </div>
        </section>

        {/* ── Calendar ─────────────────────────────────────────── */}
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">{t.calendar ?? 'Calendar'}</h3>
          <div className="card space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">{t.calendarName ?? 'Calendar name'}</label>
              <input type="text" value={calendarNameLocal} onChange={e => setCalendarNameLocal(e.target.value)}
                onBlur={() => setCalendarName(calendarNameLocal)} className="input" placeholder="My Calendar" />
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-text-primary">{t.highlightWeekends ?? 'Highlight weekends'}</p>
                <p className="text-xs text-text-muted mt-0.5">Saturday and Sunday get a subtle background</p>
              </div>
              <div onClick={() => setHighlightWeekends(!highlightWeekends)}
                className={clsx('w-11 h-6 rounded-full transition-colors relative cursor-pointer',
                  highlightWeekends ? 'bg-violet-600' : 'bg-surface-active')}>
                <div className={clsx('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  highlightWeekends ? 'translate-x-5' : 'translate-x-0.5')} />
              </div>
            </label>
            {highlightWeekends && (
              <div>
                <button type="button" onClick={() => setShowWeekendColor(v => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-text-secondary mb-2 hover:text-text-primary transition-colors">
                  {t.weekendHighlightColor ?? 'Weekend highlight color'}
                  <ChevronRight size={12} className={clsx('transition-transform', showWeekendColor && 'rotate-90')} />
                </button>
                {showWeekendColor && <ColorPresetPicker color={weekendColor} onChange={setWeekendColor} />}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">{t.cityTimezone ?? 'City / Timezone'}</label>
              <select className="input" value={timezone} onChange={e => setTimezone(e.target.value)}>
                {CITY_TIMEZONES.map(c => (
                  <option key={c.timezone} value={c.timezone}>{c.city} ({c.timezone.replace('_', ' ')})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Week starts on</label>
              <div className="flex gap-2">
                {([{ label: 'Sunday', val: 0 }, { label: 'Monday', val: 1 }, { label: 'Saturday', val: 6 }] as { label: string; val: 0 | 1 | 6 }[]).map(opt => (
                  <button key={opt.val} onClick={() => setWeekStartsOn(opt.val)}
                    className={clsx('flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      weekStartsOn === opt.val ? 'bg-violet-600/20 border-violet-600/40 text-text-primary' : 'border-border text-text-muted hover:border-violet-500/40')}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-text-primary">{t.timeFormat ?? 'Time format'}</p>
                <p className="text-xs text-text-muted mt-0.5">{use24Hour ? '20:00 · 20:30' : '8pm · 8:30pm'}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted select-none">
                <span className={!use24Hour ? 'text-text-primary font-medium' : ''}>12h</span>
                <div onClick={() => setUse24Hour(!use24Hour)}
                  className={clsx('w-11 h-6 rounded-full transition-colors relative cursor-pointer',
                    use24Hour ? 'bg-violet-600' : 'bg-surface-active')}>
                  <div className={clsx('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                    use24Hour ? 'translate-x-5' : 'translate-x-0.5')} />
                </div>
                <span className={use24Hour ? 'text-text-primary font-medium' : ''}>24h</span>
              </div>
            </label>
          </div>

          <div className="card p-4 mt-3">
            <label className="flex items-center justify-between cursor-pointer" onClick={() => setHideTitleBar(!hideTitleBar)}>
              <div>
                <p className="text-sm font-medium text-text-primary">Hide title bar</p>
                <p className="text-xs text-text-muted mt-0.5">Hide the minimize / maximize / close buttons</p>
              </div>
              <div className={clsx('w-11 h-6 rounded-full transition-colors relative shrink-0', hideTitleBar ? 'bg-violet-600' : 'bg-surface-active')}>
                <div className={clsx('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', hideTitleBar ? 'translate-x-5' : 'translate-x-0.5')} />
              </div>
            </label>
          </div>
        </section>

        {/* ── Profile ─────────────────────────────────────────── */}
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">{t.profile ?? 'Profile'}</h3>
          <div className="card space-y-4">
            {/* Avatar preview */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0 overflow-hidden"
                  style={{ backgroundColor: avatarSrc ? 'transparent' : profileColor }}>
                  {avatarSrc
                    ? <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
                    : (displayName || userProfile?.displayName || '?')[0]?.toUpperCase()
                  }
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{displayName || userProfile?.displayName}</p>
                <p className="text-xs text-text-muted">{user?.email}</p>
              </div>
            </div>

            {/* Photo upload */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">{t.profilePhoto ?? 'Profile photo'}</label>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handlePhotoUpload(file)
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary text-xs"
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? '...' : `📷 ${t.uploadPhoto ?? 'Upload photo'}`}
                </button>
                {avatarSrc && (
                  <button
                    type="button"
                    onClick={() => updatePhotoURL(null)}
                    className="btn-ghost text-xs text-text-muted hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Display name */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">{t.displayName ?? 'Display name'}</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="input"
                placeholder={t.displayName ?? 'Your name'}
              />
            </div>

            {/* Phone number */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Phone number</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/[^\d\s+\-().]/g, ''))}
                className="input"
                placeholder="+1 234 567 8900"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Bio</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                className="input resize-none"
                placeholder="A short bio about yourself"
                maxLength={160}
                rows={3}
              />
              <p className="text-xs text-text-muted mt-1 text-right">{bio.length}/160</p>
            </div>

            {/* Avatar color */}
            <div>
              <button type="button" onClick={() => setShowAvatarColor(v => !v)}
                className="flex items-center gap-1 text-xs font-medium text-text-secondary mb-2 hover:text-text-primary transition-colors">
                {t.avatarColor ?? 'Avatar colour'}
                <ChevronRight size={12} className={clsx('transition-transform', showAvatarColor && 'rotate-90')} />
              </button>
              {showAvatarColor && <ColorPresetPicker color={profileColor} onChange={setProfileColor} />}
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="btn-primary w-full">
              {saving ? '...' : saved ? '✓' : (t.saveProfile ?? 'Save profile')}
            </button>
          </div>
        </section>

        {/* ── FöreUpp ─────────────────────────────────────────── */}
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">{t.together ?? 'FöreUpp'}</h3>
          <div className="card space-y-4">
            {partner ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden"
                    style={{ backgroundColor: partner.color }}>
                    {partner.photoURL
                      ? <img src={partner.photoURL} alt="" className="w-full h-full object-cover" />
                      : partner.displayName?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{partner.displayName}</p>
                    <p className="text-xs text-text-muted">{partner.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/15 text-green-500 text-xs font-medium">
                    <Users size={11} /> {t.connected ?? 'Connected'}
                  </div>
                </div>
                <button onClick={() => setStopSharingOpen(true)}
                  className="text-xs text-red-500 bg-red-500/10 hover:bg-red-500/20 w-full py-1.5 rounded-lg transition-colors font-medium">
                  {t.stopSharing ?? 'Stop sharing'}
                </button>
              </>
            ) : (
              <>
                {userProfile?.inviteCode && (
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">{t.yourInviteCode ?? 'Your invite code'}</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 input font-mono text-lg font-bold tracking-widest text-center text-violet-300">
                        {userProfile.inviteCode}
                      </div>
                      <button onClick={handleCopyCode} className="btn-secondary p-2.5 shrink-0">
                        {codeCopied ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
                      </button>
                    </div>
                    <p className="text-xs text-text-muted mt-1.5">{t.shareWithPartner ?? 'Share this with your partner to connect'}</p>
                  </div>
                )}
                <div className="border-t border-border/50 pt-4">
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">{t.joinPartnersSpace ?? "Join partner's space"}</label>
                  {joinSuccess ? (
                    <p className="text-sm text-green-500 bg-green-500/10 rounded-lg px-3 py-2">Joined! Refresh if your partner doesn't appear.</p>
                  ) : (
                    <form onSubmit={handleJoin} className="flex gap-2">
                      <input
                        type="text"
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value.toUpperCase())}
                        className="input flex-1 font-mono text-center tracking-widest uppercase"
                        placeholder="ABC123"
                        maxLength={6}
                      />
                      <button type="submit" className="btn-primary shrink-0" disabled={joinLoading || joinCode.length < 6}>
                        {joinLoading ? '...' : <Link2Off size={15} />}
                      </button>
                    </form>
                  )}
                  {joinError && <p className="text-xs text-red-500 mt-1.5">{joinError}</p>}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Security ─────────────────────────────────────────── */}
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">{t.security ?? 'Security'}</h3>
          <div className="card space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">{t.newPassword ?? 'New password'}</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="input"
                placeholder={t.newPassword ?? 'New password'}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">{t.confirmPassword ?? 'Confirm password'}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="input"
                placeholder={t.confirmPassword ?? 'Confirm password'}
              />
            </div>
            {passwordMsg && (
              <p className={clsx('text-sm px-3 py-2 rounded-lg border',
                passwordMsg.type === 'success'
                  ? 'text-green-700 bg-green-50 border-green-200'
                  : 'text-red-600 bg-red-50 border-red-200'
              )}>
                {passwordMsg.text}
              </p>
            )}
            <button
              onClick={handleChangePassword}
              disabled={passwordSaving || !newPassword}
              className="btn-primary w-full"
            >
              {passwordSaving ? '...' : (t.updatePassword ?? 'Update password')}
            </button>
          </div>
        </section>
      </div>

      {stopSharingOpen && (
        <div className="modal-overlay" onClick={() => setStopSharingOpen(false)}>
          <div className="modal max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-text-primary mb-2">{t.stopSharing ?? 'Stop sharing'}?</h3>
            <p className="text-sm text-text-secondary mb-6">
              Do you want to delete <span className="font-semibold text-text-primary">{partner?.displayName}</span>'s entries from this calendar, or keep them?
            </p>
            <div className="flex flex-col gap-2">
              <button
                disabled={stopSharingLoading}
                onClick={async () => {
                  setStopSharingLoading(true)
                  await leaveSpace(true)
                  setStopSharingOpen(false)
                  setStopSharingLoading(false)
                }}
                className="btn-danger w-full">
                {stopSharingLoading ? '...' : `Stop sharing & delete their entries`}
              </button>
              <button
                disabled={stopSharingLoading}
                onClick={async () => {
                  setStopSharingLoading(true)
                  await leaveSpace(false)
                  setStopSharingOpen(false)
                  setStopSharingLoading(false)
                }}
                className="btn-secondary w-full">
                {stopSharingLoading ? '...' : `Stop sharing & keep their entries`}
              </button>
              <button onClick={() => setStopSharingOpen(false)} className="btn-ghost w-full text-text-muted">
                {t.cancel ?? 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

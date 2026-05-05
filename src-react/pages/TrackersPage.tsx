import React, { useState, useEffect } from 'react'
import { format, addDays, startOfWeek, subWeeks, addWeeks, isSameWeek } from 'date-fns'
import { Plus, X, Trash2, ChevronLeft, ChevronRight, Flame, Pencil, LayoutGrid, AlignJustify } from 'lucide-react'
import { useSpace } from '../context/SpaceContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../hooks/useTranslation'
import type { Tracker, TrackerEntry } from '../types'
import ColorPresetPicker from '../components/ColorPresetPicker'
import clsx from 'clsx'

const TRACKER_EMOJIS = ['✅', '💧', '🏃', '💊', '📚', '🧘', '🍎', '😴', '🎯', '💪', '🌟', '🧠', '✍️', '🎵']
const isFuture = (date: string, today: string) => date > today

function getWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i)
    return { date: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE'), day: format(d, 'd'), month: format(d, 'MMM') }
  })
}

function calcStreak(tracker: Tracker, entries: TrackerEntry[], userId: string, today: string): number {
  const isDone = (date: string) => {
    const entry = entries.find(e => e.trackerId === tracker.id && e.date === date && e.createdBy === userId)
    if (!entry) return false
    if (tracker.type === 'checkbox') return !!entry.value
    if (tracker.type === 'number') {
      const val = entry.value as number
      return tracker.goal ? val >= tracker.goal : val > 0
    }
    if (tracker.type === 'rating') return (entry.value as number) > 0
    return false
  }

  let streak = 0
  let cursor = new Date()
  if (!isDone(today)) cursor = addDays(cursor, -1)

  while (true) {
    const d = format(cursor, 'yyyy-MM-dd')
    if (!isDone(d)) break
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export default function TrackersPage() {
  const { trackers, trackerEntries, addTracker, updateTracker, deleteTracker, setTrackerEntry } = useSpace()
  const { user } = useAuth()
  const t = useTranslation()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Tracker | null>(null)
  const [today, setToday] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

  // Advance "today" and weekStart at midnight without needing a reload
  useEffect(() => {
    const msUntilMidnight = () => {
      const now = new Date()
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()
    }
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(() => {
        const newToday = format(new Date(), 'yyyy-MM-dd')
        setToday(newToday)
        setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
        schedule()
      }, msUntilMidnight())
    }
    schedule()
    return () => clearTimeout(timer)
  }, [])
  const [viewMode, setViewMode] = useState<'individual' | 'full'>(
    () => (localStorage.getItem('trackers-view-mode') as 'individual' | 'full') ?? 'individual'
  )

  const weekDays = getWeekDays(weekStart)
  const isCurrentWeek = isSameWeek(weekStart, new Date(), { weekStartsOn: 1 })

  const getEntry = (trackerId: string, date: string, uid: string) =>
    trackerEntries.find(e => e.trackerId === trackerId && e.date === date && e.createdBy === uid)

  const handleCheck = async (tracker: Tracker, date: string) => {
    const entry = getEntry(tracker.id, date, user!.uid)
    await setTrackerEntry({ trackerId: tracker.id, date, value: !(entry?.value as boolean ?? false) })
  }
  const handleNumber = async (tracker: Tracker, date: string, value: number) => {
    await setTrackerEntry({ trackerId: tracker.id, date, value })
  }
  const handleRating = async (tracker: Tracker, date: string, value: number) => {
    const entry = getEntry(tracker.id, date, user!.uid)
    const cur = entry?.value as number ?? 0
    await setTrackerEntry({ trackerId: tracker.id, date, value: cur === value ? 0 : value })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-text-primary">{t.trackers ?? 'Trackers'}</h2>
            <p className="text-text-muted text-sm mt-0.5">Track your habits and goals together</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> {t.newTracker ?? 'New tracker'}
          </button>
        </div>

        {/* View toggle + week navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setWeekStart(w => subWeeks(w, 1))} className="btn-ghost flex items-center gap-1 text-sm">
            <ChevronLeft size={15} /> {t.prevWeek ?? 'Prev week'}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-text-secondary">
              {format(weekStart, 'MMM d')} — {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
            <div className="flex bg-bg-secondary border border-border rounded-lg p-0.5">
              <button
                onClick={() => { setViewMode('full'); localStorage.setItem('trackers-view-mode', 'full') }}
                title="Full grid view"
                className={clsx('p-1.5 rounded-md transition-all', viewMode === 'full' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary')}
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => { setViewMode('individual'); localStorage.setItem('trackers-view-mode', 'individual') }}
                title="Individual view"
                className={clsx('p-1.5 rounded-md transition-all', viewMode === 'individual' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary')}
              >
                <AlignJustify size={13} />
              </button>
            </div>
          </div>
          <button
            onClick={() => setWeekStart(w => addWeeks(w, 1))}
            disabled={isCurrentWeek}
            className={clsx('btn-ghost flex items-center gap-1 text-sm', isCurrentWeek && 'opacity-30 cursor-not-allowed')}
          >
            {t.nextWeek ?? 'Next week'} <ChevronRight size={15} />
          </button>
        </div>

        {/* Trackers */}
        {trackers.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-text-secondary font-medium">{t.noTrackers ?? 'No trackers yet'}</p>
            <p className="text-text-muted text-sm mt-1">Create your first tracker to start building habits</p>
          </div>
        ) : viewMode === 'full' ? (
          <FullGridView
            trackers={trackers}
            trackerEntries={trackerEntries}
            weekDays={weekDays}
            today={today}
            userId={user?.uid ?? ''}
            getEntry={(trackerId, date, uid) => getEntry(trackerId, date, uid)}
            onCheck={(tracker, date) => handleCheck(tracker, date)}
            onNumber={(tracker, date, val) => handleNumber(tracker, date, val)}
            onRating={(tracker, date, val) => handleRating(tracker, date, val)}
            onEdit={(tracker) => setEditing(tracker)}
          />
        ) : (
          <div className="grid gap-3">
            {trackers.map(tracker => (
              <TrackerRow
                key={tracker.id}
                tracker={tracker}
                weekDays={weekDays}
                today={today}
                streak={calcStreak(tracker, trackerEntries, user?.uid ?? '', today)}
                getEntry={(date, uid) => getEntry(tracker.id, date, uid)}
                userId={user?.uid ?? ''}
                onCheck={(date) => handleCheck(tracker, date)}
                onNumber={(date, val) => handleNumber(tracker, date, val)}
                onRating={(date, val) => handleRating(tracker, date, val)}
                onEdit={() => setEditing(tracker)}
                onDelete={() => deleteTracker(tracker.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateTrackerModal onClose={() => setShowCreate(false)} onAdd={addTracker} />}
      {editing && (
        <CreateTrackerModal
          existing={editing}
          onClose={() => setEditing(null)}
          onAdd={addTracker}
          onUpdate={(data) => updateTracker(editing.id, data)}
        />
      )}
    </div>
  )
}

// ─── Full Grid View ───────────────────────────────────────────────────────────

function FullGridView({ trackers, trackerEntries, weekDays, today, userId, getEntry, onCheck, onNumber, onRating, onEdit }: {
  trackers: Tracker[]
  trackerEntries: TrackerEntry[]
  weekDays: { date: string; label: string; day: string; month: string }[]
  today: string
  userId: string
  getEntry: (trackerId: string, date: string, uid: string) => TrackerEntry | undefined
  onCheck: (tracker: Tracker, date: string) => void
  onNumber: (tracker: Tracker, date: string, val: number) => void
  onRating: (tracker: Tracker, date: string, val: number) => void
  onEdit: (tracker: Tracker) => void
}) {
  // Each row = flex with strict 50/50 split, circles section uses grid-cols-7 within its half
  const Row = ({ left, right, border }: { left: React.ReactNode; right: React.ReactNode; border?: boolean }) => (
    <div className={clsx('flex items-center', border && 'border-b border-border/20')}>
      <div className="flex items-center gap-3 pr-4 group" style={{ width: '50%' }}>{left}</div>
      <div className="grid grid-cols-7" style={{ width: '50%' }}>{right}</div>
    </div>
  )

  return (
    <div className="card">
      {/* Header */}
      <Row
        left={<span />}
        right={weekDays.map(({ date, label, day }) => {
          const isToday = date === today
          return (
            <div key={date} className="flex flex-col items-center justify-end pb-2">
              <span className={clsx('text-xs font-bold leading-none', isToday ? 'text-violet-400' : 'text-text-secondary')}>{label[0]}</span>
              <div className={clsx('w-5 h-5 rounded-full flex items-center justify-center mt-0.5', isToday && 'bg-violet-500/20')}>
                <span className={clsx('text-[10px] leading-none', isToday ? 'text-violet-400 font-semibold' : 'text-text-muted')}>{day}</span>
              </div>
            </div>
          )
        })}
      />

      {/* Tracker rows */}
      {trackers.map((tracker, idx) => (
        <Row
          key={tracker.id}
          border={idx < trackers.length - 1}
          left={
            <>
              <span className="text-2xl shrink-0 leading-none">{tracker.emoji ?? '📊'}</span>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-text-primary text-sm truncate">{tracker.name}</span>
                  {tracker.streakEnabled !== false && (() => {
                    const streak = calcStreak(tracker, trackerEntries, userId, today)
                    return streak > 0
                      ? <span className="text-xs text-orange-400 flex items-center gap-0.5 shrink-0"><Flame size={10} />{streak}d</span>
                      : null
                  })()}
                </div>
                {tracker.description && (
                  <span className="text-xs text-text-muted truncate mt-1">{tracker.description}</span>
                )}
              </div>
              <button
                onClick={() => onEdit(tracker)}
                className="btn-ghost p-1 text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto"
              >
                <Pencil size={11} />
              </button>
            </>
          }
          right={weekDays.map(({ date }) => {
            const entry = getEntry(tracker.id, date, userId)
            const future = isFuture(date, today)
            const isToday = date === today
            const numVal = entry?.value as number ?? 0
            const filled = tracker.type === 'checkbox'
              ? !!(entry?.value)
              : tracker.goal ? numVal >= tracker.goal : numVal > 0

            return (
              <div key={date} className="flex items-center justify-center py-2.5">
                {tracker.type === 'checkbox' && (
                  <button
                    onClick={() => !future && onCheck(tracker, date)}
                    disabled={future}
                    className={clsx(
                      'w-10 h-10 rounded-full transition-all flex items-center justify-center',
                      future ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95',
                      filled ? '' : 'bg-border/60'
                    )}
                    style={filled ? { backgroundColor: tracker.color } : {}}
                  >
                    {filled && (
                      <svg viewBox="0 0 12 12" className="w-3.5 h-3.5" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                )}
                {tracker.type === 'number' && (
                  <input
                    type="number"
                    defaultValue={(entry?.value as number) || ''}
                    onBlur={e => { const v = parseFloat(e.target.value); onNumber(tracker, date, isNaN(v) ? 0 : v) }}
                    disabled={future}
                    className={clsx('w-10 h-8 text-center text-xs input px-1 py-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none', future && 'opacity-20 cursor-not-allowed')}
                    min={0}
                  />
                )}
                {tracker.type === 'rating' && (
                  <div className="flex gap-0.5">
                    {Array.from({ length: tracker.maxRating ?? 5 }, (_, i) => (
                      <button key={i} onClick={() => !future && onRating(tracker, date, i + 1)} disabled={future}
                        className={clsx('text-xs transition-transform', future ? 'opacity-20 cursor-not-allowed' : 'hover:scale-125')}>
                        <span style={{ color: !future && (entry?.value as number ?? 0) > i ? tracker.color : '#9ca3af' }}>★</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        />
      ))}
    </div>
  )
}

// ─── Individual Row ───────────────────────────────────────────────────────────

function TrackerRow({ tracker, weekDays, today, streak, getEntry, onCheck, onNumber, onRating, onEdit, onDelete, userId }: {
  tracker: Tracker
  weekDays: { date: string; label: string; day: string; month: string }[]
  today: string
  streak: number
  getEntry: (date: string, uid: string) => TrackerEntry | undefined
  userId: string
  onCheck: (date: string) => void
  onNumber: (date: string, val: number) => void
  onRating: (date: string, val: number) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { members } = useSpace()
  const t = useTranslation()
  const [showDelete, setShowDelete] = useState(false)

  const creatorName = members[tracker.createdBy]?.displayName ?? tracker.createdBy

  return (
    <div className="card overflow-hidden" style={tracker.bgColor ? { backgroundColor: tracker.bgColor } : {}}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
            style={{ backgroundColor: `${tracker.color}20` }}>
            {tracker.emoji ?? '📊'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text-primary text-sm">{tracker.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {tracker.streakEnabled !== false && streak > 0 && (
                <div className="flex items-center gap-1 text-xs font-semibold text-orange-400">
                  <Flame size={11} />
                  {streak} {t.dayStreak ?? 'day streak'}
                </div>
              )}
              {tracker.streakEnabled !== false && streak === 0 && (
                <p className="text-xs text-text-muted">{t.noStreakYet ?? 'No streak yet'}</p>
              )}
              {tracker.type === 'number' && tracker.goal && (
                <p className="text-xs text-text-muted">Goal: {tracker.goal}{tracker.unit ? ' ' + tracker.unit : ''}</p>
              )}
            </div>
          </div>
        </div>
        <span className="text-xs text-text-muted shrink-0 ml-2">{creatorName}</span>
      </div>

      {showDelete && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-600">{t.delete ?? 'Delete'}?</p>
          <div className="flex gap-2">
            <button onClick={() => setShowDelete(false)} className="btn-secondary text-xs py-1">{t.cancel ?? 'Cancel'}</button>
            <button onClick={onDelete} className="btn-danger text-xs py-1">{t.delete ?? 'Delete'}</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(({ date, label, day }) => {
          const myEntry = getEntry(date, userId)
          const isToday = date === today
          const future = isFuture(date, today)

          return (
            <div key={date} className="flex flex-col items-center gap-1">
              <p className={clsx('text-xs font-medium', isToday ? 'text-violet-400' : 'text-text-muted')}>{label}</p>
              <p className={clsx('text-xs', isToday ? 'text-violet-300' : 'text-text-muted')}>{day}</p>

              {tracker.type === 'checkbox' && (
                <button
                  onClick={() => !future && onCheck(date)}
                  disabled={future}
                  className={clsx('w-8 h-8 rounded-lg border-2 transition-all',
                    future ? 'border-border/30 opacity-25 cursor-not-allowed'
                      : myEntry?.value ? 'border-transparent'
                      : 'border-border hover:border-violet-600/50')}
                  style={!future && myEntry?.value ? { backgroundColor: tracker.color } : {}}
                />
              )}

              {tracker.type === 'number' && (
                <input type="number"
                  defaultValue={(myEntry?.value as number) ?? ''}
                  onBlur={e => { const v = parseFloat(e.target.value); onNumber(date, isNaN(v) ? 0 : v) }}
                  className={clsx('w-10 h-8 text-center text-xs input px-1 py-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none', future && 'opacity-25 cursor-not-allowed')}
                  min={0} disabled={future} />
              )}

              {tracker.type === 'rating' && (
                <div className="flex gap-0.5">
                  {Array.from({ length: tracker.maxRating ?? 5 }, (_, i) => (
                    <button key={i} onClick={() => !future && onRating(date, i + 1)} disabled={future}
                      className={clsx('text-xs transition-transform', future ? 'opacity-25 cursor-not-allowed' : 'hover:scale-125')}>
                      <span style={{ color: !future && (myEntry?.value as number ?? 0) > i ? tracker.color : '#9ca3af' }}>★</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom: description + edit/delete */}
      <div className="flex items-center gap-1 mt-3 pt-2 border-t border-border/40">
        {tracker.description
          ? <p className="text-xs text-text-muted flex-1 mr-2">{tracker.description}</p>
          : <span className="flex-1" />}
        <button onClick={onEdit} className="btn-ghost p-1.5 text-text-muted hover:text-text-primary">
          <Pencil size={13} />
        </button>
        <button onClick={() => setShowDelete(!showDelete)} className="btn-ghost p-1.5 text-text-muted hover:text-red-600">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

function CreateTrackerModal({ existing, onClose, onAdd, onUpdate }: {
  existing?: Tracker | null
  onClose: () => void
  onAdd: (t: any) => Promise<void>
  onUpdate?: (t: any) => Promise<void>
}) {
  const t = useTranslation()
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [emoji, setEmoji] = useState(existing?.emoji ?? '')
  const [color, setColor] = useState(existing?.color ?? '#7c3aed')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [bgColor, setBgColor] = useState(existing?.bgColor ?? '')
  const [showBgColorPicker, setShowBgColorPicker] = useState(false)
  const [type, setType] = useState<Tracker['type']>(existing?.type ?? 'checkbox')
  const [unit, setUnit] = useState(existing?.unit ?? '')
  const [goal, setGoal] = useState<number | ''>(existing?.goal ?? '')
  const [streakEnabled, setStreakEnabled] = useState(existing?.streakEnabled !== false)
  const [maxRating, setMaxRating] = useState(existing?.maxRating ?? 5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true); setError('')
    try {
      const payload: any = { name: name.trim(), description, emoji, color, bgColor, type, isShared: true, streakEnabled }
      if (type === 'number' && unit) payload.unit = unit
      if (type === 'number' && goal !== '') payload.goal = Number(goal)
      else payload.goal = null
      if (type === 'rating') payload.maxRating = maxRating
      if (existing && onUpdate) await onUpdate(payload)
      else await onAdd(payload)
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-text-primary">{existing ? (t.editTracker ?? 'Edit tracker') : (t.newTracker ?? 'New tracker')}</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <select value={emoji} onChange={e => setEmoji(e.target.value)} className="input w-16 text-center text-xl px-1">
              <option value="">—</option>
              {TRACKER_EMOJIS.map(em => <option key={em} value={em}>{em}</option>)}
            </select>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input flex-1" placeholder={t.newTracker ?? 'Tracker name'} required autoFocus />
          </div>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="input" placeholder={t.descriptionOptional ?? 'Description (optional)'} />
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">{t.type ?? 'Type'}</label>
            <div className="grid grid-cols-3 gap-2">
              {(['checkbox', 'number', 'rating'] as const).map(tt => (
                <button key={tt} type="button" onClick={() => setType(tt)}
                  className={clsx('py-2 px-2 rounded-lg text-xs font-medium border transition-all', type === tt ? 'bg-violet-600/20 border-violet-600/40 text-violet-300' : 'border-border text-text-secondary hover:border-violet-600/30')}>
                  {tt === 'checkbox' ? `✓ ${t.done ?? 'Done'}` : tt === 'number' ? `# ${t.number ?? 'Number'}` : `★ ${t.rating ?? 'Rating'}`}
                </button>
              ))}
            </div>
          </div>
          {type === 'number' && (
            <div className="space-y-2">
              <input type="text" value={unit} onChange={e => setUnit(e.target.value)} className="input" placeholder="Unit (e.g. glasses, km, pages)" />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={goal}
                  onChange={e => setGoal(e.target.value === '' ? '' : Number(e.target.value))}
                  className="input w-24"
                  placeholder="Goal"
                  min={1}
                />
                <span className="text-xs text-text-muted flex-1">
                  {goal !== ''
                    ? streakEnabled ? `Streak requires ≥ ${goal}${unit ? ' ' + unit : ''} per day` : `Goal: ${goal}${unit ? ' ' + unit : ''} per day`
                    : 'Daily goal (optional)'}
                </span>
              </div>
            </div>
          )}
          {type === 'rating' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">{t.maxRating ?? 'Max rating'}</label>
              <select value={maxRating} onChange={e => setMaxRating(Number(e.target.value))} className="input">
                {[3, 5, 7, 10].map(n => <option key={n} value={n}>{n} {t.stars ?? 'stars'}</option>)}
              </select>
            </div>
          )}
          <label className="flex items-center justify-between cursor-pointer select-none">
            <div>
              <p className="text-sm font-medium text-text-primary">Track streak</p>
              <p className="text-xs text-text-muted">Show consecutive day count</p>
            </div>
            <button
              type="button"
              onClick={() => setStreakEnabled(v => !v)}
              className={clsx('w-10 h-6 rounded-full transition-colors relative shrink-0', streakEnabled ? 'bg-violet-600' : 'bg-border')}
            >
              <span className={clsx('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all', streakEnabled ? 'left-[22px]' : 'left-[4px]')} />
            </button>
          </label>
          <div>
            <button type="button" onClick={() => setShowColorPicker(v => !v)}
              className="flex items-center gap-1 text-xs font-medium text-text-secondary mb-2 hover:text-text-primary transition-colors">
              {t.color ?? 'Accent colour'}
              <ChevronRight size={12} className={clsx('transition-transform', showColorPicker && 'rotate-90')} />
            </button>
            {showColorPicker && <ColorPresetPicker color={color} onChange={setColor} />}
          </div>
          <div>
            <button type="button" onClick={() => setShowBgColorPicker(v => !v)}
              className="flex items-center gap-1 text-xs font-medium text-text-secondary mb-2 hover:text-text-primary transition-colors">
              Background colour
              <ChevronRight size={12} className={clsx('transition-transform', showBgColorPicker && 'rotate-90')} />
            </button>
            {showBgColorPicker && (
              <div className="flex items-center gap-2">
                <ColorPresetPicker color={bgColor || '#ffffff'} onChange={setBgColor} />
                {bgColor && (
                  <button type="button" onClick={() => setBgColor('')} className="text-xs text-text-muted hover:text-red-500 transition-colors shrink-0">
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading || !name.trim()}>
            {loading ? (t.saving ?? 'Saving...') : existing ? (t.saveChanges ?? 'Save changes') : (t.createTracker ?? 'Create tracker')}
          </button>
        </form>
      </div>
    </div>
  )
}

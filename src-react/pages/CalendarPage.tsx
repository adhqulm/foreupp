import { useState, useRef, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, addWeeks, subWeeks,
  isSameMonth, isToday, parseISO, differenceInDays,
  addYears, getISOWeek, isSameDay, formatDistanceToNow } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, X, Check, Pencil, Trash2, MapPin, Users, RefreshCw, Clock } from 'lucide-react'
import { useSpace } from '../context/SpaceContext'
import { useAuth } from '../context/AuthContext'
import { useAppSettings } from '../context/AppSettingsContext'
import type { CalendarEvent, SubCalendar, UserProfile } from '../types'
import ColorPresetPicker from '../components/ColorPresetPicker'
import { hslToHex } from '../utils/colorUtils'
import clsx from 'clsx'
import { DAY_NAMES, MONTH_NAMES, UI } from '../i18n/translations'
import type { Lang } from '../i18n/translations'
import { useTranslation } from '../hooks/useTranslation'

const EMOJI_OPTIONS = ['📅','🎂','✈️','💊','🏃','🎬','🍕','💼','❤️','⭐','🎉','📚','🌸','🎵','🐾','☕','🌙','🎯','🏠','🎓']
const HOUR_H = 56 // px per hour in week/day view
const HOURS = Array.from({ length: 24 }, (_, i) => i)

/** Format a "HH:MM" string as 12h ("8pm", "8:30pm") or 24h ("20:00", "20:30"). */
function formatTime(time: string, use24: boolean): string {
  const [h, m] = time.split(':').map(Number)
  if (use24) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const period = h >= 12 ? 'pm' : 'am'
  const hour12 = h % 12 || 12
  return m === 0 ? `${hour12}${period}` : `${hour12}:${String(m).padStart(2, '0')}${period}`
}

type View = 'month' | 'week' | 'day' | 'scheduler' | 'agenda' | 'list' | 'table' | 'tiles'

// ── Recurring event expansion ─────────────────────────────────────────────────
function expandRecurringEvents(events: CalendarEvent[], viewStart: Date, viewEnd: Date): CalendarEvent[] {
  const result: CalendarEvent[] = []
  for (const ev of events) {
    if (!ev.recurrence) {
      result.push(ev)
      continue
    }
    const rec = ev.recurrence
    const viewStartStr = format(viewStart, 'yyyy-MM-dd')
    const viewEndStr = format(viewEnd, 'yyyy-MM-dd')
    const evDate = parseISO(ev.date)
    // Duration in days for multi-day events — applied to each occurrence
    const durationDays = ev.endDate ? differenceInDays(parseISO(ev.endDate), evDate) : 0

    const makeOccurrence = (dateStr: string): CalendarEvent => {
      const virtualId = dateStr === ev.date ? ev.id : `${ev.id}_${dateStr}`
      const occEndDate = durationDays > 0
        ? format(addDays(parseISO(dateStr), durationDays), 'yyyy-MM-dd')
        : ev.endDate
      return { ...ev, id: virtualId, date: dateStr, endDate: occEndDate }
    }

    // For weekly with specific days, iterate day by day
    if (rec.type === 'weekly' && rec.days && rec.days.length > 0) {
      // Anchor: find the Monday of the event's start week, then advance by interval weeks
      const startDow = evDate.getDay()
      let weekCursor = evDate
      let count = 0
      let safety = 0
      while (safety++ < 2000) {
        // Iterate each day in this week that matches a selected day
        for (let d = 0; d < 7; d++) {
          const day = addDays(weekCursor, d - startDow < 0 ? d : d)
          const dow = day.getDay()
          if (!rec.days.includes(dow)) continue
          if (day < evDate) continue // don't go before original start
          const dateStr = format(day, 'yyyy-MM-dd')
          if (dateStr > viewEndStr) break
          if (rec.endType === 'date' && rec.endDate && dateStr > rec.endDate) break
          if (rec.endType === 'count' && rec.endCount && count >= rec.endCount) break
          if (dateStr >= viewStartStr) result.push(makeOccurrence(dateStr))
          count++
        }
        weekCursor = addWeeks(weekCursor, rec.interval)
        const weekCursorStr = format(weekCursor, 'yyyy-MM-dd')
        if (weekCursorStr > viewEndStr) break
        if (rec.endType === 'date' && rec.endDate && weekCursorStr > rec.endDate) break
        if (rec.endType === 'count' && rec.endCount && count >= rec.endCount) break
      }
      continue
    }

    // For other types: step by interval
    let cursor = evDate
    let count = 0
    let safety = 0
    while (safety++ < 2000) {
      const dateStr = format(cursor, 'yyyy-MM-dd')
      if (dateStr > viewEndStr) break
      if (rec.endType === 'date' && rec.endDate && dateStr > rec.endDate) break
      if (rec.endType === 'count' && rec.endCount && count >= rec.endCount) break

      if (dateStr >= viewStartStr) result.push(makeOccurrence(dateStr))
      count++

      if (rec.type === 'daily') {
        cursor = addDays(cursor, rec.interval)
      } else if (rec.type === 'weekly') {
        cursor = addWeeks(cursor, rec.interval)
      } else if (rec.type === 'monthly') {
        cursor = addMonths(cursor, rec.interval)
      } else if (rec.type === 'yearly') {
        cursor = addYears(cursor, rec.interval)
      } else {
        break
      }
    }
  }
  return result
}

// ── Sub-calendar modal ────────────────────────────────────────────────────────
function SubCalendarModal({ existing, onSave, onDelete, onClose }: {
  existing?: SubCalendar | null
  onSave: (name: string, color: string, textColor: 'white' | 'black') => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}) {
  const t = useTranslation()
  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState(existing?.color ?? hslToHex(Math.random() * 360, 85, 58))
  const [textColor, setTextColor] = useState<'white' | 'black'>(existing?.textColor ?? 'white')
  const [loading, setLoading] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    await onSave(name.trim(), color, textColor)
    onClose()
  }
  const handleDelete = async () => {
    if (!onDelete) return
    setLoading(true)
    await onDelete()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-xs mx-4 p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text-primary">{existing ? (t.editCalendar ?? 'Edit calendar') : (t.newCalendar ?? 'New calendar')}</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={15} /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder={t.calendarName ?? 'Calendar name'} required autoFocus />
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">{t.color ?? 'Color'}</label>
            <ColorPresetPicker color={color} onChange={setColor} />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">{t.color ?? 'Text color'}</label>
            <div className="flex gap-2">
              {(['white', 'black'] as const).map(tc => (
                <button key={tc} type="button" onClick={() => setTextColor(tc)}
                  className={clsx('flex-1 py-1.5 rounded-lg text-xs font-medium border-2 transition-all',
                    textColor === tc ? 'border-violet-600 bg-violet-600/20 text-text-primary' : 'border-border text-text-secondary hover:border-violet-600/40')}>
                  {tc === 'white' ? '☀ White' : '✦ Black'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {existing && onDelete && (
              <button type="button" onClick={handleDelete} className="btn-danger" disabled={loading}><Trash2 size={14} /></button>
            )}
            <button type="submit" className="btn-primary flex-1" disabled={loading || !name.trim()}
              style={{ backgroundColor: color, color: textColor }}>
              {existing ? (t.save ?? 'Save') : (t.create ?? 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main calendar page ────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { events, subCalendars, addEvent, deleteEvent, updateEvent, addSubCalendar, updateSubCalendar, deleteSubCalendar } = useSpace()
  const { user, userProfile } = useAuth()
  const { highlightWeekends, weekendColor, language, calendarName } = useAppSettings()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<View>('month')

  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null)
  const [clickedDate, setClickedDate] = useState<Date | null>(null)
  const [clickedTime, setClickedTime] = useState<string>('')
  const [hiddenCals, setHiddenCals] = useState<Set<string>>(new Set())
  const [showSubCalModal, setShowSubCalModal] = useState(false)
  const [editingSubCal, setEditingSubCal] = useState<SubCalendar | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showMiniCal, setShowMiniCal] = useState(false)
  const [compactTabs, setCompactTabs] = useState(false)
  const [viewDropOpen, setViewDropOpen] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)
  // Tracks whether the user explicitly showed the sidebar — prevents resize from re-hiding it
  const userShowedSidebar = useRef(false)

  // Only control compactTabs via ResizeObserver (element width)
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setCompactTabs(entry.contentRect.width < 900)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Auto-hide sidebar on small windows, but never override a user's explicit "show" action
  useEffect(() => {
    const check = () => { if (!userShowedSidebar.current && window.innerWidth < 600) setSidebarOpen(false) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const lang = (language as Lang) in DAY_NAMES ? (language as Lang) : 'en'
  const t = UI[lang] ?? UI['en']

  // Helper: get all tag ids for an event (multi or single)
  const getEventTagIds = (e: CalendarEvent): string[] =>
    e.subCalendarIds?.length ? e.subCalendarIds : e.subCalendarId ? [e.subCalendarId] : []

  const baseVisibleEvents = events.filter(e => {
    const ids = getEventTagIds(e)
    if (ids.length === 0) return true
    return ids.some(id => !hiddenCals.has(id))
  })

  // Compute view range for recurrence expansion
  const getViewRange = (): [Date, Date] => {
    if (view === 'month') {
      return [startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }), endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 })]
    } else if (view === 'week' || view === 'scheduler' || view === 'table') {
      return [startOfWeek(currentDate, { weekStartsOn: 1 }), endOfWeek(currentDate, { weekStartsOn: 1 })]
    } else if (view === 'tiles') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
      return [ws, addDays(ws, 13)]
    } else if (view === 'agenda' || view === 'list') {
      return [startOfMonth(currentDate), addMonths(startOfMonth(currentDate), 3)]
    } else {
      return [currentDate, currentDate]
    }
  }
  const [viewStart, viewEnd] = getViewRange()
  const visibleEvents = expandRecurringEvents(baseVisibleEvents, viewStart, viewEnd)

  const getColor = (event: CalendarEvent) => {
    const ids = getEventTagIds(event)
    if (ids.length > 0) {
      const sub = subCalendars.find(s => s.id === ids[0])
      if (sub) return sub.color
    }
    return event.color ?? userProfile?.color ?? '#7c3aed'
  }

  const getTextColor = (event: CalendarEvent): string => {
    const ids = getEventTagIds(event)
    if (ids.length > 0) {
      const sub = subCalendars.find(s => s.id === ids[0])
      if (sub) return sub.textColor ?? 'white'
    }
    return 'white'
  }

  // Extra tag colors beyond the first
  const getExtraTagColors = (event: CalendarEvent): string[] => {
    const ids = getEventTagIds(event)
    return ids.slice(1).map(id => subCalendars.find(s => s.id === id)?.color).filter(Boolean) as string[]
  }

  // Returns background style — diagonal stripes if multiple tags (like Teamup)
  const getEventBg = (event: CalendarEvent): React.CSSProperties => {
    const primary = getColor(event)
    const extras = getExtraTagColors(event)
    if (extras.length === 0) return { backgroundColor: primary }
    const secondary = extras[0]
    return {
      background: `repeating-linear-gradient(-45deg, ${primary} 0px, ${primary} 30px, ${secondary} 30px, ${secondary} 60px)`,
    }
  }

  const toggleCal = (id: string) => setHiddenCals(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const openAdd = (d: Date, time = '') => {
    setClickedDate(d); setEditingEvent(null); setClickedTime(time); setShowModal(true)
  }
  const openEdit = (ev: CalendarEvent, e: React.MouseEvent) => {
    const originalId = ev.id.includes('_') ? ev.id.split('_')[0] : ev.id
    const original = events.find(e2 => e2.id === originalId) ?? ev
    e.stopPropagation(); setViewingEvent(original)
  }
  const openEditFromDetail = (ev: CalendarEvent) => {
    setViewingEvent(null); setEditingEvent(ev); setClickedDate(parseISO(ev.date)); setShowModal(true)
  }

  // Navigation label + prev/next per view
  const monthIndex = currentDate.getMonth()
  const year = currentDate.getFullYear()
  const monthNames = MONTH_NAMES[lang] ?? MONTH_NAMES['en']

  const navLabel = view === 'month'
    ? `${monthNames[monthIndex]} ${year}`
    : view === 'week' || view === 'scheduler' || view === 'table'
    ? (() => {
        const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
        const we = endOfWeek(currentDate, { weekStartsOn: 1 })
        return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`
      })()
    : view === 'tiles'
    ? (() => {
        const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
        const we = addDays(ws, 13)
        return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`
      })()
    : view === 'agenda' || view === 'list'
    ? (() => {
        const ms = startOfMonth(currentDate)
        const me = addMonths(ms, 3)
        return `${format(ms, 'MMM d')} – ${format(me, 'MMM d, yyyy')}`
      })()
    : format(currentDate, 'EEEE, MMMM d, yyyy')

  const goNext = () => {
    if (view === 'month') setCurrentDate(d => addMonths(d, 1))
    else if (view === 'week' || view === 'scheduler' || view === 'table') setCurrentDate(d => addWeeks(d, 1))
    else if (view === 'tiles') setCurrentDate(d => addWeeks(d, 2))
    else if (view === 'agenda' || view === 'list') setCurrentDate(d => addMonths(d, 3))
    else setCurrentDate(d => addDays(d, 1))
  }
  const goPrev = () => {
    if (view === 'month') setCurrentDate(d => subMonths(d, 1))
    else if (view === 'week' || view === 'scheduler' || view === 'table') setCurrentDate(d => subWeeks(d, 1))
    else if (view === 'tiles') setCurrentDate(d => subWeeks(d, 2))
    else if (view === 'agenda' || view === 'list') setCurrentDate(d => subMonths(d, 3))
    else setCurrentDate(d => addDays(d, -1))
  }

  const VIEW_OPTIONS: { value: View; label: string }[] = [
    { value: 'month', label: t.month ?? 'Month' },
    { value: 'week', label: t.week ?? 'Week' },
    { value: 'day', label: t.day ?? 'Day' },
    { value: 'scheduler', label: 'Scheduler' },
    { value: 'agenda', label: 'Agenda' },
    { value: 'list', label: 'List' },
    { value: 'table', label: 'Table' },
    { value: 'tiles', label: 'Tiles' },
  ]

  return (
    <div className="flex h-full overflow-hidden min-h-0">
      {/* ── Left panel ── */}
      {sidebarOpen ? (
        <div className="w-52 shrink-0 border-r border-border flex flex-col bg-bg-primary">
          <div className="flex items-center justify-between px-3 py-3 border-b border-border">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t.calendars ?? 'Calendars'}</span>
              {calendarName && (
                <span className="text-sm font-bold text-text-primary truncate mt-0.5">{calendarName}</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => { setEditingSubCal(null); setShowSubCalModal(true) }}
                className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors">
                <Plus size={14} />
              </button>
              <button onClick={() => { userShowedSidebar.current = false; setSidebarOpen(false) }}
                className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors">
                <ChevronLeft size={14} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {subCalendars.length === 0 && (
              <p className="px-3 py-4 text-xs text-text-muted text-center">No calendars yet.<br />Click + to create one.</p>
            )}
            {subCalendars.map(sub => {
              const hidden = hiddenCals.has(sub.id)
              return (
                <div key={sub.id} className="group flex items-center gap-2 px-3 py-2 hover:bg-surface-hover rounded mx-1 transition-colors">
                  <button onClick={() => toggleCal(sub.id)}
                    className="w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-all"
                    style={{ borderColor: sub.color, backgroundColor: hidden ? 'transparent' : sub.color }}>
                    {!hidden && <Check size={10} strokeWidth={3} color={sub.textColor ?? 'white'} />}
                  </button>
                  <span className={clsx('flex-1 text-sm truncate', hidden ? 'text-text-muted line-through' : 'text-text-primary')}>
                    {sub.name}
                  </span>
                  <button onClick={() => { setEditingSubCal(sub); setShowSubCalModal(true) }}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary transition-all">
                    <Pencil size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="w-8 shrink-0 border-r border-border flex flex-col items-center bg-bg-primary pt-2">
          <button onClick={() => { userShowedSidebar.current = true; setSidebarOpen(true) }}
            className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* ── Right: calendar ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Header */}
        <div ref={headerRef} className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0 gap-3">
          {/* Left: nav + title */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={() => window.location.reload()} className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors" title="Reload"><RefreshCw size={13} /></button>
              <button onClick={goPrev} className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"><ChevronLeft size={15} /></button>
              <button onClick={() => setCurrentDate(new Date())}
                className="px-2.5 py-1 text-xs font-medium rounded border border-border bg-surface hover:bg-surface-hover text-text-secondary transition-colors">
                {t.today ?? 'Today'}
              </button>
              <button onClick={goNext} className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"><ChevronRight size={15} /></button>
            </div>
            {/* Clickable title → mini calendar */}
            <div className="relative">
              <button onClick={() => setShowMiniCal(v => !v)}
                className="flex items-center gap-1 text-base font-bold text-text-primary hover:text-violet-600 transition-colors">
                {navLabel}
                <svg width="10" height="6" viewBox="0 0 10 6" className={clsx('text-text-muted transition-transform', showMiniCal && 'rotate-180')} fill="currentColor">
                  <path d="M0 0l5 6 5-6H0z"/>
                </svg>
              </button>
              {showMiniCal && (
                <MiniCalendar
                  selected={currentDate}
                  onSelect={d => setCurrentDate(d)}
                  onClose={() => setShowMiniCal(false)}
                />
              )}
            </div>
          </div>

          {/* Right: view tabs + add button */}
          <div className="flex items-center gap-2 shrink-0">
            {compactTabs ? (
              /* Compact: dropdown */
              <div className="relative">
                <button
                  onClick={() => setViewDropOpen(v => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-border rounded-lg bg-surface hover:bg-surface-hover text-text-secondary transition-colors">
                  {VIEW_OPTIONS.find(o => o.value === view)?.label ?? 'View'}
                  <svg width="10" height="6" viewBox="0 0 10 6" className={clsx('text-text-muted transition-transform', viewDropOpen && 'rotate-180')} fill="currentColor">
                    <path d="M0 0l5 6 5-6H0z"/>
                  </svg>
                </button>
                {viewDropOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setViewDropOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-bg-secondary border border-border rounded-xl shadow-xl overflow-hidden min-w-[110px]">
                      {VIEW_OPTIONS.map(opt => (
                        <button key={opt.value}
                          onClick={() => { setView(opt.value); setViewDropOpen(false) }}
                          className={clsx(
                            'w-full text-left px-3 py-2 text-xs font-medium transition-colors',
                            view === opt.value
                              ? 'bg-violet-600/20 text-violet-600'
                              : 'text-text-secondary hover:bg-surface-hover'
                          )}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Full: inline tabs */
              <div className="flex items-center border border-border rounded-lg overflow-hidden bg-surface">
                {VIEW_OPTIONS.map(opt => (
                  <button key={opt.value}
                    onClick={() => setView(opt.value)}
                    className={clsx(
                      'px-2.5 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0',
                      view === opt.value
                        ? 'bg-violet-600/20 text-violet-600'
                        : 'text-text-secondary hover:bg-surface-hover'
                    )}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => openAdd(currentDate)} className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus size={14} /> {t.addEvent ?? 'Add event'}
            </button>
          </div>
        </div>

        {/* View */}
        {view === 'month' && (
          <MonthView
            currentDate={currentDate}
            events={visibleEvents}
            subCalendars={subCalendars}
            getColor={getColor}
            getTextColor={getTextColor}
            getEventBg={getEventBg}
            onDayClick={d => openAdd(d)}
            onEventClick={openEdit}
            highlightWeekends={highlightWeekends}
            weekendColor={weekendColor}
            lang={lang}
          />
        )}
        {view === 'week' && (
          <WeekView
            currentDate={currentDate}
            events={visibleEvents}
            getColor={getColor}
            getTextColor={getTextColor}
            getEventBg={getEventBg}
            onSlotClick={(d, t) => openAdd(d, t)}
            onEventClick={openEdit}
          />
        )}
        {view === 'day' && (
          <DayView
            currentDate={currentDate}
            events={visibleEvents}
            getColor={getColor}
            getTextColor={getTextColor}
            onSlotClick={(d, t) => openAdd(d, t)}
            onEventClick={openEdit}
          />
        )}
        {view === 'scheduler' && (
          <SchedulerView
            currentDate={currentDate}
            events={visibleEvents}
            subCalendars={subCalendars}
            getColor={getColor}
            getTextColor={getTextColor}
            onEventClick={openEdit}
            onSlotClick={d => openAdd(d)}
          />
        )}
        {view === 'agenda' && (
          <AgendaView
            currentDate={currentDate}
            events={visibleEvents}
            getColor={getColor}
            onEventClick={openEdit}
          />
        )}
        {view === 'list' && (
          <ListView
            currentDate={currentDate}
            events={visibleEvents}
            subCalendars={subCalendars}
            getColor={getColor}
            getTextColor={getTextColor}
            onEventClick={openEdit}
          />
        )}
        {view === 'table' && (
          <TableView
            currentDate={currentDate}
            events={visibleEvents}
            subCalendars={subCalendars}
            getColor={getColor}
            onEventClick={openEdit}
          />
        )}
        {view === 'tiles' && (
          <TilesView
            currentDate={currentDate}
            events={visibleEvents}
            getColor={getColor}
            onEventClick={openEdit}
          />
        )}
      </div>

      {viewingEvent && (
        <EventDetailModal
          event={viewingEvent}
          subCalendars={subCalendars}
          userProfile={userProfile}
          onClose={() => setViewingEvent(null)}
          onEdit={() => openEditFromDetail(viewingEvent)}
          onDelete={async () => { await deleteEvent(viewingEvent.id); setViewingEvent(null) }}
        />
      )}

      {showModal && (
        <EventModal
          date={clickedDate ?? new Date()}
          initialTime={clickedTime}
          event={editingEvent}
          subCalendars={subCalendars}

          userColor={userProfile?.color ?? '#7c3aed'}
          onClose={() => setShowModal(false)}
          onAdd={addEvent}
          onUpdate={updateEvent}
          onDelete={deleteEvent}
          lang={lang}
          t={t}
        />
      )}

      {showSubCalModal && (
        <SubCalendarModal
          existing={editingSubCal}
          onSave={async (name, color, textColor) => {
            if (editingSubCal) await updateSubCalendar(editingSubCal.id, { name, color, textColor })
            else await addSubCalendar({ name, color, textColor })
          }}
          onDelete={editingSubCal ? async () => deleteSubCalendar(editingSubCal.id) : undefined}
          onClose={() => setShowSubCalModal(false)}
        />
      )}
    </div>
  )
}

// ── Month view helpers ─────────────────────────────────────────────────────────
function getWeekMultiDayPlacements(week: Date[], events: CalendarEvent[]) {
  const weekStartStr = format(week[0], 'yyyy-MM-dd')
  const weekEndStr   = format(week[6], 'yyyy-MM-dd')

  const multiDay = events.filter(ev => {
    const end = ev.endDate ?? ev.date
    return end > ev.date && ev.date <= weekEndStr && end >= weekStartStr
  })

  const placements: { ev: CalendarEvent; startCol: number; endCol: number; row: number; showTitle: boolean }[] = []
  const rowUsage: boolean[][] = []

  for (const ev of multiDay) {
    const end = ev.endDate ?? ev.date
    const sc = ev.date < weekStartStr ? 0 : week.findIndex(d => format(d, 'yyyy-MM-dd') === ev.date)
    const rawEc = week.findIndex(d => format(d, 'yyyy-MM-dd') === end)
    const ec = end > weekEndStr ? 6 : rawEc < 0 ? 6 : rawEc

    let row = 0
    while (true) {
      if (!rowUsage[row]) rowUsage[row] = Array(7).fill(false)
      if (!rowUsage[row].slice(sc, ec + 1).some(Boolean)) break
      row++
    }
    for (let c = sc; c <= ec; c++) rowUsage[row][c] = true
    placements.push({ ev, startCol: sc, endCol: ec, row, showTitle: sc === 0 ? ev.date < weekStartStr ? false : true : true })
  }

  return { placements, numRows: rowUsage.length }
}

// ── Month view ────────────────────────────────────────────────────────────────
// ── Mini calendar (date picker dropdown) ─────────────────────────────────────
function MiniCalendar({ selected, onSelect, onClose }: {
  selected: Date
  onSelect: (d: Date) => void
  onClose: () => void
}) {
  const [mini, setMini] = useState(startOfMonth(selected))
  const miniEnd = endOfMonth(mini)
  const gridStart = startOfWeek(mini, { weekStartsOn: 0 })
  const weeks: Date[][] = []
  let d = gridStart
  while (d <= miniEnd || weeks.length < 6) {
    const w: Date[] = []
    for (let i = 0; i < 7; i++) { w.push(d); d = addDays(d, 1) }
    weeks.push(w)
    if (weeks.length >= 6) break
  }
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-full mt-1 z-50 bg-bg-primary border border-border rounded-xl shadow-2xl p-3 select-none" style={{ width: 256 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setMini(m => subMonths(m, 1))} className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"><ChevronLeft size={14} /></button>
          <span className="text-sm font-semibold text-text-primary">{format(mini, 'MMMM yyyy')}</span>
          <button onClick={() => setMini(m => addMonths(m, 1))} className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"><ChevronRight size={14} /></button>
        </div>
        {/* Day names */}
        <div className="grid grid-cols-7 mb-1">
          {['S','M','T','W','T','F','S'].map((n, i) => (
            <div key={i} className="text-center text-xs font-semibold text-text-muted py-1">{n}</div>
          ))}
        </div>
        {/* Days */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day, di) => {
              const inMonth = isSameMonth(day, mini)
              const today = isToday(day)
              const sel = isSameDay(day, selected)
              return (
                <button key={di} onClick={() => { onSelect(day); onClose() }}
                  className={clsx(
                    'w-8 h-8 mx-auto flex items-center justify-center rounded-full text-xs font-medium transition-colors',
                    sel ? 'bg-violet-600 text-white' :
                    today ? 'border border-violet-600 text-violet-600' :
                    inMonth ? 'text-text-primary hover:bg-surface-hover' : 'text-text-muted hover:bg-surface-hover'
                  )}>
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}

// ── Month view ────────────────────────────────────────────────────────────────
function MonthView({ currentDate, events, subCalendars, getColor, getTextColor, getEventBg, onDayClick, onEventClick, highlightWeekends, weekendColor, lang }: {
  currentDate: Date
  events: CalendarEvent[]
  subCalendars: SubCalendar[]
  getColor: (e: CalendarEvent) => string
  getTextColor: (e: CalendarEvent) => string
  getEventBg: (e: CalendarEvent) => React.CSSProperties
  onDayClick: (d: Date) => void
  onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void
  highlightWeekends: boolean
  weekendColor: string
  lang: Lang
}) {
  const { use24Hour } = useAppSettings()
  const monthStart = startOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 })
  const weeks: Date[][] = []
  let day = calStart
  while (day <= calEnd) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) { week.push(day); day = addDays(day, 1) }
    weeks.push(week)
  }

  const dayNames = DAY_NAMES[lang] ?? DAY_NAMES['en']
  const isWeekend = (colIndex: number) => colIndex === 0 || colIndex === 6
  const BAND_H = 24
  const DAY_NUM_H = 28

  const getSingleDayEvents = (d: Date) =>
    events
      .filter(e => e.date === format(d, 'yyyy-MM-dd') && (!e.endDate || e.endDate === e.date))
      .sort((a, b) => {
        const aAllDay = a.allDay || !a.startTime ? 0 : 1
        const bAllDay = b.allDay || !b.startTime ? 0 : 1
        if (aAllDay !== bAllDay) return aAllDay - bAllDay
        return (a.startTime ?? '').localeCompare(b.startTime ?? '')
      })

  const WK_W = 32 // week number column width in px

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-bg-calendar">
      {/* Day-of-week header row */}
      <div className="flex border-b border-border shrink-0">
        <div className="shrink-0 border-r border-border" style={{ width: WK_W }}>
          <div className="py-2 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">Wk</div>
        </div>
        {dayNames.map((dn, i) => (
          <div key={dn + i} className={clsx(
            'flex-1 py-2 text-center text-xs font-semibold uppercase tracking-wider',
            highlightWeekends && isWeekend(i) ? 'text-violet-500' : 'text-text-muted'
          )}>{dn}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full flex flex-col">
          {weeks.map((week, wi) => {
            const { placements, numRows } = getWeekMultiDayPlacements(week, events)
            const weekNum = getISOWeek(week[1] ?? week[0])
            // Per-column row count: how many multi-day rows overlap each day column
            const colNumRows = Array.from({ length: 7 }, (_, col) => {
              const rows = placements.filter(p => p.startCol <= col && p.endCol >= col).map(p => p.row)
              return rows.length > 0 ? Math.max(...rows) + 1 : 0
            })
            return (
              <div key={wi} className="flex flex-1 border-b border-border last:border-b-0 min-h-0">
                {/* Week number cell */}
                <div className="shrink-0 border-r border-border flex items-start justify-center pt-2" style={{ width: WK_W }}>
                  <span className="text-xs text-text-muted font-medium">{weekNum}</span>
                </div>

                {/* 7 day columns — positioned relative for multi-day bars */}
                <div className="flex-1 relative grid grid-cols-7">
                  {/* Multi-day spanning bars */}
                  {placements.map((p, pi) => {
                    const color = getColor(p.ev)
                    const tc = getTextColor(p.ev)
                    const startsBeforeWeek = p.ev.date < format(week[0], 'yyyy-MM-dd')
                    const endsAfterWeek = (p.ev.endDate ?? p.ev.date) > format(week[6], 'yyyy-MM-dd')
                    const rL = startsBeforeWeek ? 0 : 11
                    const rR = endsAfterWeek ? 0 : 11
                    return (
                      <div key={pi}
                        onClick={e => { e.stopPropagation(); onEventClick(p.ev, e) }}
                        className="absolute text-xs font-medium cursor-pointer hover:brightness-95 z-10 flex items-center gap-1 px-2 overflow-hidden"
                        style={{
                          left: `calc(${p.startCol / 7 * 100}% + ${startsBeforeWeek ? 0 : 2}px)`,
                          width: `calc(${(p.endCol - p.startCol + 1) / 7 * 100}% - ${(startsBeforeWeek ? 0 : 2) + (endsAfterWeek ? 0 : 2)}px)`,
                          top: DAY_NUM_H + p.row * BAND_H,
                          height: BAND_H - 2,
                          color: tc,
                          borderRadius: `${rL}px ${rR}px ${rR}px ${rL}px`,
                          ...getEventBg(p.ev),
                        }}>
                        {p.showTitle && p.ev.recurrence && <RefreshCw size={9} className="shrink-0 opacity-80" />}
                        {p.showTitle && p.ev.startTime && !p.ev.allDay && <span className="opacity-75 shrink-0">{formatTime(p.ev.startTime, use24Hour)}</span>}
                        {p.showTitle && <span className="truncate">{p.ev.emoji ? `${p.ev.emoji} ` : ''}{p.ev.title}</span>}
                      </div>
                    )
                  })}

                  {/* Day cells */}
                  {week.map((d, di) => {
                    const singleEvs = getSingleDayEvents(d)
                    const inMonth = isSameMonth(d, currentDate)
                    const today = isToday(d)
                    const weekend = highlightWeekends && isWeekend(di)
                    return (
                      <div key={di} onClick={() => onDayClick(d)}
                        className={clsx(
                          'border-r border-border last:border-r-0 cursor-pointer group overflow-hidden transition-colors',
                          inMonth ? 'hover:bg-surface-hover/40' : 'opacity-40',
                          weekend && inMonth ? '' : ''
                        )}
                        style={weekend && inMonth ? { backgroundColor: weekendColor + '30' } : undefined}>
                        {/* Date number */}
                        <div className="flex justify-end px-1.5 pt-1" style={{ height: DAY_NUM_H }}>
                          <div className={clsx(
                            'w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold transition-colors',
                            today ? 'bg-violet-600 text-white' : 'text-text-secondary group-hover:text-text-primary'
                          )}>
                            {format(d, 'd')}
                          </div>
                        </div>
                        {/* Single-day events */}
                        <div className="space-y-px px-0.5 pb-1 overflow-hidden" style={{ marginTop: colNumRows[di] * BAND_H }}>
                          {singleEvs.slice(0, 3).map(ev => {
                            return (
                            <div key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev, e) }}
                              className="text-xs px-1.5 py-px rounded-full font-medium cursor-pointer hover:brightness-95 leading-5 flex items-center gap-1 overflow-hidden min-h-[1.25rem]"
                              style={{ ...getEventBg(ev), color: getTextColor(ev) }}>
                              {ev.recurrence && <RefreshCw size={9} className="shrink-0 opacity-80" />}
                              {ev.emoji && <span className="shrink-0">{ev.emoji}</span>}
                              {ev.startTime && !ev.allDay && <span className="opacity-75 shrink-0">{formatTime(ev.startTime, use24Hour)}</span>}
                              <span className="truncate">{ev.title}</span>
                            </div>
                          )})}

                          {singleEvs.length > 3 && (
                            <p className="text-xs text-text-muted pl-1.5 leading-5">+{singleEvs.length - 3} more</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Week view ─────────────────────────────────────────────────────────────────
function WeekView({ currentDate, events, getColor, getTextColor, getEventBg, onSlotClick, onEventClick }: {
  currentDate: Date
  events: CalendarEvent[]
  getColor: (e: CalendarEvent) => string
  getTextColor: (e: CalendarEvent) => string
  getEventBg: (e: CalendarEvent) => React.CSSProperties
  onSlotClick: (d: Date, time: string) => void
  onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void
}) {
  const { use24Hour } = useAppSettings()
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const scrollRef = useRef<HTMLDivElement>(null)

  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(days[6], 'yyyy-MM-dd')

  // Strip events: allDay OR multi-day (endDate > date) that overlap this week
  const stripEvents = events.filter(ev => {
    const end = ev.endDate ?? ev.date
    return (ev.allDay || end > ev.date) && end >= weekStartStr && ev.date <= weekEndStr
  })

  // Row placement for the all-day strip
  const STRIP_ROW_H = 22
  const STRIP_PAD = 4
  type StripPlacement = { ev: CalendarEvent; colStart: number; colEnd: number; row: number; continuesLeft: boolean; continuesRight: boolean }
  const stripPlacements: StripPlacement[] = []
  for (const ev of stripEvents) {
    const evEnd = ev.endDate ?? ev.date
    const continuesLeft = ev.date < weekStartStr
    const continuesRight = evEnd > weekEndStr
    const clampedStart = continuesLeft ? weekStartStr : ev.date
    const clampedEnd = continuesRight ? weekEndStr : evEnd
    const cs = days.findIndex(d => format(d, 'yyyy-MM-dd') === clampedStart)
    const ce = days.findIndex(d => format(d, 'yyyy-MM-dd') === clampedEnd)
    const colStart = cs < 0 ? 0 : cs
    const colEnd = ce < 0 ? 6 : ce
    let row = 0
    while (stripPlacements.some(p => p.row === row && p.colEnd >= colStart && p.colStart <= colEnd)) row++
    stripPlacements.push({ ev, colStart, colEnd, row, continuesLeft, continuesRight })
  }
  const numRows = stripPlacements.length === 0 ? 0 : Math.max(...stripPlacements.map(p => p.row)) + 1
  const stripHeight = numRows === 0 ? 0 : numRows * STRIP_ROW_H + STRIP_PAD * 2

  const getTimedEventsForDay = (d: Date) => {
    const dateStr = format(d, 'yyyy-MM-dd')
    return events.filter(e => e.date === dateStr && !e.allDay && e.startTime && (!e.endDate || e.endDate === e.date))
  }

  const getTimedStyle = (ev: CalendarEvent) => {
    if (ev.allDay || !ev.startTime) return null
    const [sh, sm] = ev.startTime.split(':').map(Number)
    const endT = ev.endTime ?? `${String(Math.min(sh + 1, 23)).padStart(2, '0')}:${String(sm).padStart(2, '0')}`
    const [eh, em] = endT.split(':').map(Number)
    const top = (sh * 60 + sm) / 60 * HOUR_H
    const height = Math.max(((eh * 60 + em) - (sh * 60 + sm)) / 60 * HOUR_H, HOUR_H * 0.4)
    return { top, height }
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-bg-calendar">
      {/* Day headers */}
      <div className="flex border-b border-border shrink-0">
        <div className="w-14 shrink-0 border-r border-border" />
        {days.map(day => (
          <div key={day.toISOString()} className={clsx('flex-1 text-center py-2 border-r border-border last:border-r-0',
            isToday(day) && 'bg-violet-600/10')}>
            <p className="text-xs font-medium text-text-muted uppercase">{format(day, 'EEE')}</p>
            <p className={clsx('text-base font-bold mt-0.5 w-8 h-8 mx-auto rounded-full flex items-center justify-center',
              isToday(day) ? 'bg-violet-600 text-white' : 'text-text-primary')}>
              {format(day, 'd')}
            </p>
          </div>
        ))}
      </div>

      {/* All-day / multi-day strip */}
      {stripHeight > 0 && (
        <div className="flex border-b border-border shrink-0" style={{ height: stripHeight }}>
          <div className="w-14 shrink-0 border-r border-border flex items-start justify-end pr-2 pt-1.5">
            <span className="text-xs text-text-muted leading-none">all‑day</span>
          </div>
          <div className="flex-1 relative">
            {days.map((_, i) => (
              <div key={i} className="absolute top-0 bottom-0 border-r border-border/30"
                style={{ left: `${(i + 1) / 7 * 100}%` }} />
            ))}
            {stripPlacements.map(({ ev, colStart, colEnd, row, continuesLeft, continuesRight }) => {
              const leftPct = colStart / 7 * 100
              const widthPct = (colEnd - colStart + 1) / 7 * 100
              const rTL = continuesLeft ? 0 : 4
              const rTR = continuesRight ? 0 : 4

              return (
                <div key={ev.id}
                  onClick={e => { e.stopPropagation(); onEventClick(ev, e) }}
                  className="absolute text-xs px-1.5 truncate cursor-pointer hover:opacity-90 flex items-center"
                  style={{
                    top: STRIP_PAD + row * STRIP_ROW_H,
                    height: STRIP_ROW_H - 2,
                    left: `calc(${leftPct}% + ${continuesLeft ? 0 : 2}px)`,
                    width: `calc(${widthPct}% - ${(continuesLeft ? 0 : 2) + (continuesRight ? 0 : 2)}px)`,
                    color: getTextColor(ev),
                    borderRadius: `${rTL}px ${rTR}px ${rTR}px ${rTL}px`,
                    ...getEventBg(ev),
                  }}>
                  {ev.recurrence && <RefreshCw size={9} className="shrink-0 opacity-80 mr-0.5" />}
                  {ev.emoji && !continuesLeft && <span className="mr-0.5">{ev.emoji}</span>}
                  <span className="truncate">{ev.title}</span>

                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ height: 24 * HOUR_H }}>
          {/* Hour labels */}
          <div className="w-14 shrink-0 border-r border-border relative">
            {HOURS.map(h => (
              <div key={h} className="absolute left-0 right-0 flex items-center justify-end pr-2"
                style={{ top: h * HOUR_H - 8, height: 16 }}>
                {h > 0 && <span className="text-xs text-text-muted">{String(h).padStart(2,'0')}:00</span>}
              </div>
            ))}
          </div>

          {/* Columns */}
          {days.map(day => {
            const timedEvs = getTimedEventsForDay(day)
            return (
              <div key={day.toISOString()} className="flex-1 border-r border-border last:border-r-0 relative"
                style={{ height: 24 * HOUR_H }}
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const y = e.clientY - rect.top
                  const totalMin = Math.floor(y / HOUR_H * 60)
                  const h = Math.floor(totalMin / 60), m = Math.round((totalMin % 60) / 15) * 15
                  onSlotClick(day, `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
                }}>
                {/* Hour lines */}
                {HOURS.map(h => (
                  <div key={h} className="absolute left-0 right-0 border-t border-border/30"
                    style={{ top: h * HOUR_H }} />
                ))}
                {/* Half-hour lines */}
                {HOURS.map(h => (
                  <div key={`h${h}`} className="absolute left-0 right-0 border-t border-border/15"
                    style={{ top: h * HOUR_H + HOUR_H / 2 }} />
                ))}
                {/* Timed events */}
                {timedEvs.map(ev => {
                  const s = getTimedStyle(ev)
                  if (!s) return null
                  return (
                    <div key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev, e) }}
                      className="absolute left-0.5 right-0.5 text-xs px-1 py-0.5 rounded overflow-hidden cursor-pointer hover:opacity-90 z-10"
                      style={{ top: s.top + 1, height: s.height - 2, backgroundColor: getColor(ev), color: getTextColor(ev) }}>
                      <p className="font-medium truncate flex items-center gap-1">{ev.recurrence && <RefreshCw size={9} className="shrink-0 opacity-80" />}{ev.emoji} {ev.title}</p>
                      {s.height > HOUR_H * 0.6 && ev.startTime && <p className="opacity-80">{formatTime(ev.startTime, use24Hour)}{ev.endTime ? ` – ${formatTime(ev.endTime, use24Hour)}` : ''}</p>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Day view ──────────────────────────────────────────────────────────────────
function DayView({ currentDate, events, getColor, getTextColor, onSlotClick, onEventClick }: {
  currentDate: Date
  events: CalendarEvent[]
  getColor: (e: CalendarEvent) => string
  getTextColor: (e: CalendarEvent) => string
  onSlotClick: (d: Date, time: string) => void
  onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void
}) {
  const { use24Hour } = useAppSettings()
  const dayEvs = events.filter(e => e.date === format(currentDate, 'yyyy-MM-dd'))
  const allDayEvs = dayEvs.filter(e => e.allDay || !e.startTime)
  const timedEvs = dayEvs.filter(e => !e.allDay && e.startTime)

  const getTimedStyle = (ev: CalendarEvent) => {
    if (!ev.startTime) return null
    const [sh, sm] = ev.startTime.split(':').map(Number)
    const endT = ev.endTime ?? `${String(Math.min(sh + 1, 23)).padStart(2,'0')}:${String(sm).padStart(2,'0')}`
    const [eh, em] = endT.split(':').map(Number)
    const top = (sh * 60 + sm) / 60 * HOUR_H
    const height = Math.max(((eh * 60 + em) - (sh * 60 + sm)) / 60 * HOUR_H, HOUR_H * 0.5)
    return { top, height }
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-bg-calendar">
      {/* All-day strip */}
      {allDayEvs.length > 0 && (
        <div className="flex border-b border-border shrink-0">
          <div className="w-14 shrink-0 border-r border-border flex items-center justify-end pr-2 py-1">
            <span className="text-xs text-text-muted">All day</span>
          </div>
          <div className="flex-1 flex flex-wrap gap-1 p-1">
            {allDayEvs.map(ev => (
              <div key={ev.id} onClick={e => onEventClick(ev, e)}
                className="text-xs px-2 py-0.5 rounded cursor-pointer hover:opacity-90"
                style={{ backgroundColor: getColor(ev), color: getTextColor(ev) }}>
                {ev.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex" style={{ height: 24 * HOUR_H }}>
          {/* Hour labels */}
          <div className="w-14 shrink-0 border-r border-border relative">
            {HOURS.map(h => (
              <div key={h} className="absolute left-0 right-0 flex items-center justify-end pr-2"
                style={{ top: h * HOUR_H - 8, height: 16 }}>
                {h > 0 && <span className="text-xs text-text-muted">{String(h).padStart(2,'0')}:00</span>}
              </div>
            ))}
          </div>

          {/* Day column */}
          <div className="flex-1 relative"
            style={{ height: 24 * HOUR_H }}
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect()
              const y = e.clientY - rect.top
              const totalMin = Math.floor(y / HOUR_H * 60)
              const h = Math.floor(totalMin / 60), m = Math.round((totalMin % 60) / 15) * 15
              onSlotClick(currentDate, `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
            }}>
            {HOURS.map(h => (
              <div key={h} className="absolute left-0 right-0 border-t border-border/30" style={{ top: h * HOUR_H }} />
            ))}
            {HOURS.map(h => (
              <div key={`h${h}`} className="absolute left-0 right-0 border-t border-border/15" style={{ top: h * HOUR_H + HOUR_H / 2 }} />
            ))}
            {timedEvs.map(ev => {
              const s = getTimedStyle(ev)
              if (!s) return null
              return (
                <div key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev, e) }}
                  className="absolute left-1 right-1 text-sm px-2 py-1 rounded overflow-hidden cursor-pointer hover:opacity-90 z-10"
                  style={{ top: s.top + 1, height: s.height - 2, backgroundColor: getColor(ev), color: getTextColor(ev) }}>
                  <p className="font-semibold truncate">{ev.emoji} {ev.title}</p>
                  {s.height > HOUR_H * 0.7 && ev.startTime && (
                    <p className="text-xs opacity-80">{formatTime(ev.startTime, use24Hour)}{ev.endTime ? ` – ${formatTime(ev.endTime, use24Hour)}` : ''}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Scheduler view ────────────────────────────────────────────────────────────
function SchedulerView({ currentDate, events, subCalendars, getColor, getTextColor, onEventClick, onSlotClick }: {
  currentDate: Date
  events: CalendarEvent[]
  subCalendars: SubCalendar[]
  getColor: (e: CalendarEvent) => string
  getTextColor: (e: CalendarEvent) => string
  onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void
  onSlotClick: (d: Date) => void
}) {
  const { use24Hour } = useAppSettings()
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const unassignedEvs = events.filter(e => !e.subCalendarId || !subCalendars.find(s => s.id === e.subCalendarId))

  const cellEvs = (day: Date, subId?: string) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return events.filter(e => e.date === dayStr && (subId ? e.subCalendarId === subId : (!e.subCalendarId || !subCalendars.find(s => s.id === e.subCalendarId))))
  }

  const rows = subCalendars.length > 0 ? subCalendars : []

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-bg-calendar">
      <table className="border-collapse" style={{ minWidth: '100%' }}>
        <thead>
          <tr>
            <th className="w-36 border-r border-b border-border bg-bg-primary sticky left-0 z-20" />
            {days.map(day => (
              <th key={day.toISOString()} className={clsx('border-r border-b border-border text-center p-2 min-w-[100px]', isToday(day) ? 'bg-violet-600/10' : 'bg-bg-primary')}>
                <p className="text-xs font-medium text-text-muted uppercase">{format(day, 'EEE')}</p>
                <p className={clsx('text-base font-bold w-8 h-8 mx-auto rounded-full flex items-center justify-center mt-0.5',
                  isToday(day) ? 'bg-violet-600 text-white' : 'text-text-primary')}>
                  {format(day, 'd')}
                </p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(sub => (
            <tr key={sub.id}>
              <td className="border-r border-b border-border bg-bg-primary px-3 py-2 sticky left-0 z-10">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                  <span className="text-xs font-semibold text-text-secondary truncate">{sub.name}</span>
                </div>
              </td>
              {days.map(day => {
                const evs = cellEvs(day, sub.id)
                return (
                  <td key={day.toISOString()} onClick={() => onSlotClick(day)}
                    className="border-r border-b border-border p-1 align-top cursor-pointer hover:bg-surface-hover transition-colors"
                    style={{ height: 64 }}>
                    {evs.map(ev => (
                      <div key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev, e) }}
                        className="text-xs px-1.5 py-0.5 rounded mb-0.5 truncate cursor-pointer hover:opacity-90"
                        style={{ backgroundColor: getColor(ev), color: getTextColor(ev) }}>
                        {ev.startTime && !ev.allDay && <span className="opacity-75">{formatTime(ev.startTime, use24Hour)} </span>}
                        {ev.emoji}{ev.title}
                      </div>
                    ))}
                  </td>
                )
              })}
            </tr>
          ))}
          {unassignedEvs.length > 0 && (
            <tr>
              <td className="border-r border-b border-border bg-bg-primary px-3 py-2 sticky left-0 z-10">
                <span className="text-xs font-semibold text-text-muted">Other</span>
              </td>
              {days.map(day => {
                const evs = cellEvs(day, undefined)
                return (
                  <td key={day.toISOString()} onClick={() => onSlotClick(day)}
                    className="border-r border-b border-border p-1 align-top cursor-pointer hover:bg-surface-hover transition-colors"
                    style={{ height: 64 }}>
                    {evs.map(ev => (
                      <div key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev, e) }}
                        className="text-xs px-1.5 py-0.5 rounded mb-0.5 truncate cursor-pointer hover:opacity-90"
                        style={{ backgroundColor: getColor(ev), color: getTextColor(ev) }}>
                        {ev.title}
                      </div>
                    ))}
                  </td>
                )
              })}
            </tr>
          )}
          {rows.length === 0 && unassignedEvs.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center py-16 text-text-muted text-sm">
                No calendars yet — create one in the sidebar.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Agenda view ────────────────────────────────────────────────────────────────
function AgendaView({ currentDate, events, getColor, onEventClick }: {
  currentDate: Date
  events: CalendarEvent[]
  getColor: (e: CalendarEvent) => string
  onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void
}) {
  const { use24Hour } = useAppSettings()
  const startStr = format(startOfMonth(currentDate), 'yyyy-MM-dd')
  const endStr = format(addMonths(startOfMonth(currentDate), 3), 'yyyy-MM-dd')

  const byDay: Record<string, CalendarEvent[]> = {}
  events.forEach(ev => {
    if (ev.date >= startStr && ev.date < endStr) {
      if (!byDay[ev.date]) byDay[ev.date] = []
      byDay[ev.date].push(ev)
    }
  })
  const sortedDays = Object.keys(byDay).sort()

  if (sortedDays.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-calendar">
        <p className="text-text-muted text-sm">No events in this period</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-bg-calendar">
      <div className="max-w-2xl px-6 py-5">
        {sortedDays.map(dayStr => {
          const d = parseISO(dayStr)
          const dayEvs = byDay[dayStr].sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
          const today = isToday(d)
          return (
            <div key={dayStr} className="mb-5">
              <div className="flex items-baseline gap-2 mb-2">
                <span className={clsx('text-sm font-bold uppercase tracking-wide', today ? 'text-violet-600' : 'text-text-secondary')}>
                  {format(d, 'EEE')}
                </span>
                <span className={clsx('text-2xl font-bold', today ? 'text-violet-600' : 'text-text-primary')}>
                  {format(d, 'd')}
                </span>
                <span className="text-sm text-text-muted">{format(d, 'MMMM yyyy')}</span>
                {today && <span className="text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full font-medium ml-1">Today</span>}
              </div>
              <div className="ml-12 space-y-1.5">
                {dayEvs.map(ev => (
                  <div key={ev.id} onClick={e => onEventClick(ev, e)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors border border-transparent hover:border-border">
                    <div className="w-1 self-stretch rounded-full shrink-0 min-h-[1.5rem]" style={{ backgroundColor: getColor(ev) }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{ev.emoji} {ev.title}</p>
                      {ev.description && <p className="text-xs text-text-muted truncate mt-0.5">{ev.description}</p>}
                    </div>
                    <span className="text-xs text-text-muted shrink-0">
                      {ev.allDay || !ev.startTime ? 'All day' : `${formatTime(ev.startTime, use24Hour)}${ev.endTime ? ` – ${formatTime(ev.endTime, use24Hour)}` : ''}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── List view ─────────────────────────────────────────────────────────────────
function ListView({ currentDate, events, subCalendars, getColor, getTextColor, onEventClick }: {
  currentDate: Date
  events: CalendarEvent[]
  subCalendars: SubCalendar[]
  getColor: (e: CalendarEvent) => string
  getTextColor: (e: CalendarEvent) => string
  onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void
}) {
  const { use24Hour } = useAppSettings()
  const months = Array.from({ length: 3 }, (_, i) => addMonths(startOfMonth(currentDate), i))

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-bg-calendar">
      <div className="max-w-2xl px-6 py-5">
        {months.map(monthStart => {
          const monthEndStr = format(addMonths(monthStart, 1), 'yyyy-MM-dd')
          const monthStartStr = format(monthStart, 'yyyy-MM-dd')
          const monthEvs = events
            .filter(e => e.date >= monthStartStr && e.date < monthEndStr)
            .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''))
          if (monthEvs.length === 0) return null

          // Group by day
          const byDay: Record<string, CalendarEvent[]> = {}
          monthEvs.forEach(ev => {
            if (!byDay[ev.date]) byDay[ev.date] = []
            byDay[ev.date].push(ev)
          })

          return (
            <div key={monthStartStr} className="mb-8">
              <h3 className="text-base font-bold text-text-primary mb-3 pb-2 border-b border-border">
                {format(monthStart, 'MMMM yyyy')}
              </h3>
              <div className="space-y-0">
                {Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([dayStr, dayEvs]) => (
                  <div key={dayStr} className="flex gap-4 py-2.5 border-b border-border/40 last:border-0">
                    <div className="w-24 shrink-0">
                      <p className={clsx('text-sm font-semibold', isToday(parseISO(dayStr)) ? 'text-violet-600' : 'text-text-secondary')}>
                        {format(parseISO(dayStr), 'EEE d MMM')}
                      </p>
                    </div>
                    <div className="flex-1 space-y-1">
                      {dayEvs.map(ev => {
                        const sub = subCalendars.find(s => s.id === ev.subCalendarId)
                        return (
                          <div key={ev.id} onClick={e => onEventClick(ev, e)}
                            className="flex items-center gap-2 cursor-pointer hover:bg-surface-hover rounded px-2 py-0.5 -mx-2 transition-colors">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getColor(ev) }} />
                            <span className="text-sm text-text-primary flex-1 truncate" style={{ color: getColor(ev) }}>
                              {ev.emoji} {ev.title}
                            </span>
                            {sub && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
                                style={{ backgroundColor: sub.color, color: sub.textColor ?? 'white' }}>
                                {sub.name}
                              </span>
                            )}
                            <span className="text-xs text-text-muted shrink-0">
                              {ev.allDay || !ev.startTime ? 'All day' : formatTime(ev.startTime, use24Hour)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Table view ────────────────────────────────────────────────────────────────
function TableView({ currentDate, events, subCalendars, getColor, onEventClick }: {
  currentDate: Date
  events: CalendarEvent[]
  subCalendars: SubCalendar[]
  getColor: (e: CalendarEvent) => string
  onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void
}) {
  const { use24Hour } = useAppSettings()
  const weekStartStr = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEndStr = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const weekEvs = events
    .filter(e => e.date >= weekStartStr && e.date <= weekEndStr)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''))

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-bg-calendar">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-border bg-bg-primary">
            {['Start', 'End', 'Title', 'Calendar', 'Description'].map(col => (
              <th key={col} className="text-left text-xs font-semibold text-text-secondary px-4 py-3 uppercase tracking-wider whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weekEvs.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-16 text-text-muted text-sm">No events this week</td>
            </tr>
          ) : weekEvs.map(ev => {
            const sub = subCalendars.find(s => s.id === ev.subCalendarId)
            const color = getColor(ev)
            const dateLabel = format(parseISO(ev.date), 'dd/MM/yyyy')
            return (
              <tr key={ev.id} onClick={e => onEventClick(ev, e)}
                className="border-b border-border hover:bg-surface-hover cursor-pointer transition-colors">
                <td className="px-4 py-3 text-sm text-text-primary whitespace-nowrap">
                  {dateLabel}{ev.startTime && !ev.allDay ? ` ${formatTime(ev.startTime, use24Hour)}` : ''}
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                  {dateLabel}{ev.endTime && !ev.allDay ? ` ${formatTime(ev.endTime, use24Hour)}` : ''}
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-medium hover:underline" style={{ color }}>
                    {ev.emoji} {ev.title}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {sub && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                      style={{ backgroundColor: sub.color, color: sub.textColor ?? 'white' }}>
                      {sub.name}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-text-muted max-w-xs truncate">{ev.description}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {weekEvs.length > 0 && (
        <p className="px-4 py-2 text-xs text-text-muted border-t border-border">
          {weekEvs.length} event{weekEvs.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

// ── Tiles view ────────────────────────────────────────────────────────────────
function TilesView({ currentDate, events, getColor, onEventClick }: {
  currentDate: Date
  events: CalendarEvent[]
  getColor: (e: CalendarEvent) => string
  onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void
}) {
  const { use24Hour } = useAppSettings()
  const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
  const startStr = format(ws, 'yyyy-MM-dd')
  const endStr = format(addDays(ws, 13), 'yyyy-MM-dd')

  const rangeEvs = events
    .filter(e => e.date >= startStr && e.date <= endStr)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''))

  if (rangeEvs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-calendar">
        <p className="text-text-muted text-sm">No events in this period</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-bg-calendar p-5">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
        {rangeEvs.map(ev => {
          const d = parseISO(ev.date)
          const color = getColor(ev)
          return (
            <div key={ev.id} onClick={e => onEventClick(ev, e)}
              className="card overflow-hidden cursor-pointer hover:shadow-md transition-all group p-0">
              <div className="px-4 py-3 flex items-center gap-3" style={{ borderTop: `3px solid ${color}` }}>
                <div className="flex flex-col items-center justify-center w-11 h-11 rounded-lg shrink-0"
                  style={{ backgroundColor: `${color}20` }}>
                  <span className="text-xs font-bold uppercase leading-none" style={{ color }}>{format(d, 'MMM')}</span>
                  <span className="text-xl font-bold leading-tight" style={{ color }}>{format(d, 'd')}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-text-muted font-medium">{format(d, 'EEEE')}</p>
                  <p className="text-sm font-semibold text-text-primary truncate">{ev.emoji} {ev.title}</p>
                </div>
              </div>
              <div className="px-4 pb-3">
                <p className="text-xs text-text-muted">
                  {ev.allDay || !ev.startTime ? 'All day' : `${formatTime(ev.startTime, use24Hour)}${ev.endTime ? ` – ${formatTime(ev.endTime, use24Hour)}` : ''}`}
                </p>
                {ev.description && <p className="text-xs text-text-muted mt-0.5 truncate">{ev.description}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Event detail modal ────────────────────────────────────────────────────────
function EventDetailModal({ event, subCalendars, userProfile, onClose, onEdit, onDelete }: {
  event: CalendarEvent
  subCalendars: SubCalendar[]
  userProfile: UserProfile | null
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const t = useTranslation()
  const { use24Hour } = useAppSettings()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [viewingImage, setViewingImage] = useState<string | null>(null)
  const tagIds = event.subCalendarIds?.length ? event.subCalendarIds : event.subCalendarId ? [event.subCalendarId] : []
  const tags = tagIds.map(id => subCalendars.find(s => s.id === id)).filter(Boolean) as SubCalendar[]

  const dateLabel = (() => {
    const start = format(parseISO(event.date), 'EEE d MMM yyyy')
    if (event.endDate && event.endDate !== event.date) {
      return `${start} – ${format(parseISO(event.endDate), 'd MMM yyyy')}`
    }
    return start
  })()

  const allDayLabel = t.allDay ?? 'All day'
  const timeLabel = event.allDay || !event.startTime
    ? allDayLabel
    : event.endTime
      ? `${formatTime(event.startTime, use24Hour)} – ${formatTime(event.endTime, use24Hour)}`
      : formatTime(event.startTime, use24Hour)

  const { members } = useSpace()
  const creatorName = members[event.createdBy]?.displayName ?? event.createdBy
  const createdAgo = formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })

  return (
    <>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-md mx-4 p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Color accent bar */}
        <div className="h-1 w-full" style={{ backgroundColor: tags[0]?.color ?? event.color ?? '#7c3aed' }} />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-text-primary leading-tight">
              {event.emoji && <span className="mr-1.5">{event.emoji}</span>}{event.title}
            </h2>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
                <Pencil size={13} /> {t.editEvent ?? 'Edit'}
              </button>
              <button onClick={onClose} className="btn-ghost p-1.5 ml-1"><X size={15} /></button>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            {/* Date + time */}
            <div className="flex items-center gap-2.5 text-text-secondary">
              <Clock size={14} className="shrink-0 text-text-muted" />
              <span>{dateLabel}{timeLabel !== allDayLabel ? `, ${timeLabel}` : ` · ${allDayLabel}`}</span>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex items-start gap-2.5">
                <Check size={14} className="shrink-0 text-text-muted mt-0.5" />
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => (
                    <span key={tag.id} className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: tag.color, color: tag.textColor ?? 'white' }}>
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Who */}
            {event.who && (
              <div className="flex items-center gap-2.5 text-text-secondary">
                <Users size={14} className="shrink-0 text-text-muted" />
                <span>{event.who}</span>
              </div>
            )}

            {/* Where */}
            {event.where && (
              <div className="flex items-center gap-2.5 text-text-secondary">
                <MapPin size={14} className="shrink-0 text-text-muted" />
                <span>{event.where}</span>
              </div>
            )}

            {/* Description */}
            {event.description && (
              <div className="flex items-start gap-2.5 text-text-secondary">
                <div className="w-3.5 shrink-0 mt-0.5 flex justify-center">
                  <div className="w-[3px] h-3.5 rounded-full bg-text-muted" />
                </div>
                <p className="whitespace-pre-wrap leading-relaxed">{event.description}</p>
              </div>
            )}

            {/* Attachments */}
            {event.attachments && event.attachments.length > 0 && (
              <div className="flex flex-col gap-2">
                {event.attachments.map((att, i) => (
                  <div key={i}>
                    {att.url.startsWith('data:image') ? (
                      <div className="rounded-lg overflow-hidden border border-border/40 cursor-pointer" onClick={() => setViewingImage(att.url)}>
                        <img src={att.url} alt={att.name} className="w-full max-h-48 object-cover" />
                        <p className="text-xs text-text-muted px-2 py-1 truncate">{att.name}</p>
                      </div>
                    ) : att.url.startsWith('data:') ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-text-muted">📄</span>
                        <span className="flex-1 truncate text-text-secondary">{att.name}</span>
                        <a href={att.url} download={att.name} className="text-violet-500 hover:underline shrink-0">Download</a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-text-muted">🔗</span>
                        <span className="flex-1 truncate text-text-secondary">{att.name}</span>
                        <a href={att.url} target="_blank" rel="noreferrer" className="text-violet-500 hover:underline shrink-0">Open</a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-5 pt-3 border-t border-border/40">
            <p className="text-xs text-text-muted">Created {createdAgo} by {creatorName}</p>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">{t.delete ?? 'Delete'}?</span>
                <button onClick={() => setConfirmDelete(false)} className="btn-secondary text-xs py-0.5 px-2">{t.cancel ?? 'No'}</button>
                <button onClick={onDelete} className="btn-danger text-xs py-0.5 px-2">{t.delete ?? 'Yes'}</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="btn-ghost p-1.5 text-text-muted hover:text-red-500 transition-colors">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>

    {viewingImage && (
      <div className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center" onClick={() => setViewingImage(null)}>
        <img src={viewingImage} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
        <button onClick={() => setViewingImage(null)} className="absolute top-4 right-4 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors">
          <X size={18} />
        </button>
      </div>
    )}
    </>
  )
}

// ── Event modal ───────────────────────────────────────────────────────────────
const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function EventModal({ date, initialTime, event, subCalendars, defaultSubCalId, userColor, onClose, onAdd, onUpdate, onDelete, lang, t }: {
  date: Date; initialTime?: string; event: CalendarEvent | null; subCalendars: SubCalendar[]
  defaultSubCalId?: string; userColor: string
  onClose: () => void
  onAdd: (e: any) => Promise<void>
  onUpdate: (id: string, data: any) => Promise<void>
  onDelete: (id: string) => Promise<void>
  lang: Lang
  t: Record<string, string>
}) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [eventDate, setEventDate] = useState(event?.date ?? format(date, 'yyyy-MM-dd'))
  const [startTime, setStartTime] = useState(event?.startTime ?? initialTime ?? '')
  const [endTime, setEndTime] = useState(event?.endTime ?? '')
  const [allDay, setAllDay] = useState(event?.allDay ?? !initialTime)
  const initTagIds = event?.subCalendarIds?.length ? event.subCalendarIds : event?.subCalendarId ? [event.subCalendarId] : defaultSubCalId ? [defaultSubCalId] : []
  const [subCalIds, setSubCalIds] = useState<string[]>(initTagIds)
  const toggleSubCal = (id: string) => setSubCalIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const [emoji, setEmoji] = useState(event?.emoji ?? '')
  const [eventEndDate, setEventEndDate] = useState(event?.endDate ?? event?.date ?? format(date, 'yyyy-MM-dd'))
  const [who, setWho] = useState(event?.who ?? '')
  const [where, setWhere] = useState(event?.where ?? '')
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string }>>(event?.attachments ?? [])
  const [addingLink, setAddingLink] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [viewingImage, setViewingImage] = useState<string | null>(null)

  // Recurrence
  const [repeats, setRepeats] = useState(!!event?.recurrence)
  const [recType, setRecType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>(event?.recurrence?.type ?? 'weekly')
  const [recInterval, setRecInterval] = useState(event?.recurrence?.interval ?? 1)
  const [recDays, setRecDays] = useState<number[]>(event?.recurrence?.days ?? [])
  const [recEndType, setRecEndType] = useState<'forever' | 'date' | 'count'>(event?.recurrence?.endType ?? 'forever')
  const [recEndDate, setRecEndDate] = useState(event?.recurrence?.endDate ?? '')
  const [recEndCount, setRecEndCount] = useState(event?.recurrence?.endCount ?? 10)

  const activeColor = subCalIds.length > 0 ? (subCalendars.find(s => s.id === subCalIds[0])?.color ?? userColor) : userColor

  const toggleRecDay = (dow: number) => {
    setRecDays(prev => prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const payload: any = { title: title.trim(), description, date: eventDate, endDate: eventEndDate > eventDate ? eventEndDate : null, allDay, subCalendarId: subCalIds[0] ?? null, subCalendarIds: subCalIds.length > 0 ? subCalIds : null, color: activeColor, emoji, attachments }
    if (!allDay && startTime) payload.startTime = startTime
    if (!allDay && endTime) payload.endTime = endTime
    if (who.trim()) payload.who = who.trim()
    if (where.trim()) payload.where = where.trim()
    if (repeats) {
      payload.recurrence = {
        type: recType,
        interval: recInterval,
        endType: recEndType,
        ...(recType === 'weekly' && recDays.length > 0 ? { days: recDays } : {}),
        ...(recEndType === 'date' && recEndDate ? { endDate: recEndDate } : {}),
        ...(recEndType === 'count' ? { endCount: recEndCount } : {}),
      }
    } else {
      payload.recurrence = null
    }
    if (event) await onUpdate(event.id, payload)
    else await onAdd(payload)
    onClose()
  }

  const handleDelete = async () => {
    if (!event) return
    setLoading(true); await onDelete(event.id); onClose()
  }

  const intervalLabel = recType === 'daily' ? 'day' : recType === 'weekly' ? 'week' : recType === 'monthly' ? 'month' : 'year'

  return (
    <>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-text-primary">{event ? (t.editEvent ?? 'Edit event') : (t.newEvent ?? 'New event')}</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <select value={emoji} onChange={e => setEmoji(e.target.value)} className="input w-16 text-center text-xl px-1">
              <option value="">—</option>
              {EMOJI_OPTIONS.map(em => <option key={em} value={em}>{em}</option>)}
            </select>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="input flex-1" placeholder={t.eventTitle ?? 'Event title'} autoFocus />
          </div>

          {subCalendars.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">{t.calendar ?? 'Calendars'}</label>
              <div className="flex flex-wrap gap-2">
                {subCalendars.map(sub => {
                  const active = subCalIds.includes(sub.id)
                  return (
                    <button key={sub.id} type="button" onClick={() => toggleSubCal(sub.id)}
                      className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all',
                        active ? 'border-transparent scale-105' : 'border-2 text-text-secondary bg-surface-hover hover:scale-105')}
                      style={active ? { backgroundColor: sub.color, color: sub.textColor ?? 'white' } : { borderColor: sub.color + '60' }}>
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                      {sub.name}
                      {active && <Check size={11} className="ml-0.5 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {title && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium shadow"
                style={{ backgroundColor: activeColor, color: subCalIds.length > 0 ? (subCalendars.find(s => s.id === subCalIds[0])?.textColor ?? 'white') : 'white' }}>
                {emoji && <span>{emoji}</span>}
                <span>{title}</span>
              </div>
            </div>
          )}

          {/* From / To dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">{t.from ?? 'From'}</label>
              <input type="date" value={eventDate}
                onChange={e => { setEventDate(e.target.value); if (eventEndDate < e.target.value) setEventEndDate(e.target.value) }}
                className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">{t.to ?? 'To'}</label>
              <input type="date" value={eventEndDate} min={eventDate}
                onChange={e => setEventEndDate(e.target.value)}
                className="input" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="w-4 h-4 accent-violet-500" />
              <span className="text-sm text-text-secondary">{t.allDay ?? 'All day'}</span>
            </label>
            {!allDay && (
              <div className="flex items-center gap-2 flex-1">
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="input flex-1 text-sm" />
                <span className="text-text-muted text-sm">—</span>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="input flex-1 text-sm" />
              </div>
            )}
          </div>

          {/* Who */}
          <div className="flex gap-2 items-center">
            <Users size={14} className="text-text-muted shrink-0" />
            <input type="text" value={who} onChange={e => setWho(e.target.value)}
              className="input flex-1 text-sm" placeholder={t.who ?? 'Who'} />
          </div>

          {/* Where */}
          <div className="flex gap-2 items-center">
            <MapPin size={14} className="text-text-muted shrink-0" />
            <input type="text" value={where} onChange={e => setWhere(e.target.value)}
              className="input flex-1 text-sm" placeholder={t.where ?? 'Where'} />
          </div>

          <textarea value={description} onChange={e => setDescription(e.target.value)}
            className="input resize-none" placeholder={t.addNote ?? 'Add a note...'} rows={2} />

          {/* Recurrence */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input type="checkbox" checked={repeats} onChange={e => setRepeats(e.target.checked)} className="w-4 h-4 accent-violet-500" />
              <span className="text-sm text-text-secondary flex items-center gap-1.5">
                <RefreshCw size={13} />
                {t.repeats ?? 'Repeats'}
              </span>
            </label>

            {repeats && (
              <div className="ml-6 space-y-3 border-l-2 border-violet-600/30 pl-4">
                {/* Type tabs */}
                <div className="flex gap-1 flex-wrap">
                  {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(type => (
                    <button key={type} type="button" onClick={() => setRecType(type)}
                      className={clsx('px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                        recType === type ? 'bg-violet-600/20 border-violet-600/40 text-violet-300' : 'border-border text-text-secondary hover:border-violet-600/30')}>
                      {t[type] ?? type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Interval */}
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <span>{t.every ?? 'Every'}</span>
                  <input type="number" min={1} max={99} value={recInterval}
                    onChange={e => {
                      const raw = e.target.value
                      if (raw === '' || raw === '0') { setRecInterval('' as unknown as number); return }
                      const n = parseInt(raw)
                      if (!isNaN(n)) setRecInterval(Math.min(99, Math.max(1, n)))
                    }}
                    onBlur={e => { if (!e.target.value || parseInt(e.target.value) < 1) setRecInterval(1) }}
                    className="input w-14 text-center text-sm py-1" />
                  <span>{recInterval === 1 ? intervalLabel : intervalLabel + 's'}</span>
                </div>

                {/* Weekly day checkboxes */}
                {recType === 'weekly' && (
                  <div>
                    <p className="text-xs text-text-muted mb-1.5">{t.onDays ?? 'On days'}</p>
                    <div className="flex gap-1">
                      {DOW_LABELS.map((lbl, dow) => (
                        <button key={dow} type="button" onClick={() => toggleRecDay(dow)}
                          className={clsx('w-8 h-8 rounded-full text-xs font-medium transition-all',
                            recDays.includes(dow)
                              ? 'bg-violet-600 text-white'
                              : 'border border-border text-text-secondary hover:border-violet-600/40')}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* End condition */}
                <div>
                  <p className="text-xs text-text-muted mb-1.5">{t.ending ?? 'Ending'}</p>
                  <div className="flex gap-1 flex-wrap mb-2">
                    {(['forever', 'date', 'count'] as const).map(et => (
                      <button key={et} type="button" onClick={() => setRecEndType(et)}
                        className={clsx('px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                          recEndType === et ? 'bg-violet-600/20 border-violet-600/40 text-violet-300' : 'border-border text-text-secondary hover:border-violet-600/30')}>
                        {et === 'forever' ? (t.forever ?? 'Forever') : et === 'date' ? (t.untilDate ?? 'Until date') : (t.afterNTimes ?? 'After N times')}
                      </button>
                    ))}
                  </div>
                  {recEndType === 'date' && (
                    <input type="date" value={recEndDate} onChange={e => setRecEndDate(e.target.value)} className="input text-sm" />
                  )}
                  {recEndType === 'count' && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <span>For</span>
                      <input type="number" min={1} max={999} value={recEndCount}
                        onChange={e => setRecEndCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="input w-16 text-center text-sm py-1" />
                      <span>{t.occurrences ?? 'occurrences'}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                📎 {t.attachments ?? 'Attachments'} {attachments.length > 0 && <span className="text-text-muted">({attachments.length})</span>}
              </p>
              <button type="button" onClick={() => setAddingLink(v => !v)}
                className="text-xs text-text-secondary hover:text-text-primary transition-colors">
                {t.addLink ?? 'Add link'}
              </button>
            </div>
            {addingLink && (
              <div className="flex gap-1.5 mb-2">
                <input type="url" value={linkInput} onChange={e => setLinkInput(e.target.value)}
                  className="input text-xs py-1 flex-1" placeholder="https://..." />
                <button type="button" onClick={() => {
                  if (linkInput.trim()) {
                    setAttachments(prev => [...prev, { name: linkInput.trim(), url: linkInput.trim() }])
                    setLinkInput('')
                    setAddingLink(false)
                  }
                }} className="btn-secondary text-xs py-1 px-2">Add</button>
              </div>
            )}
            <label
              className="flex flex-col items-center justify-center gap-1.5 w-full py-4 rounded-xl border-2 border-dashed border-border hover:border-violet-500/50 hover:bg-violet-500/5 transition-all cursor-pointer text-text-muted text-xs"
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-violet-500/70', 'bg-violet-500/10') }}
              onDragLeave={e => { e.currentTarget.classList.remove('border-violet-500/70', 'bg-violet-500/10') }}
              onDrop={e => {
                e.preventDefault()
                e.currentTarget.classList.remove('border-violet-500/70', 'bg-violet-500/10')
                const files = Array.from(e.dataTransfer.files)
                files.forEach(file => {
                  const reader = new FileReader()
                  reader.onload = ev => setAttachments(prev => [...prev, { name: file.name, url: ev.target?.result as string }])
                  reader.readAsDataURL(file)
                })
              }}
            >
              <input type="file" multiple className="hidden" onChange={e => {
                const files = Array.from(e.target.files ?? [])
                files.forEach(file => {
                  const reader = new FileReader()
                  reader.onload = ev => setAttachments(prev => [...prev, { name: file.name, url: ev.target?.result as string }])
                  reader.readAsDataURL(file)
                })
                e.target.value = ''
              }} />
              <span className="text-lg">📎</span>
              <span>{t.upload ?? 'Drop files here or click to upload'}</span>
            </label>
            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-surface rounded-lg text-xs">
                    <span className="flex-1 truncate text-text-secondary">
                      {att.url.startsWith('data:image') ? '🖼 ' : att.url.startsWith('data:') ? '📄 ' : '🔗 '}
                      {att.name}
                    </span>
                    {att.url.startsWith('data:image') ? (
                      <button type="button" onClick={() => setViewingImage(att.url)}
                        className="text-violet-600 hover:underline shrink-0 text-xs">View</button>
                    ) : att.url.startsWith('data:') ? (
                      <a href={att.url} download={att.name}
                        className="text-violet-600 hover:underline shrink-0 text-xs">Download</a>
                    ) : (
                      <a href={att.url} target="_blank" rel="noreferrer"
                        className="text-violet-600 hover:underline shrink-0 text-xs">Open</a>
                    )}
                    <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                      className="text-text-muted hover:text-red-500 transition-colors shrink-0">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            {event && <button type="button" onClick={handleDelete} className="btn-danger" disabled={loading}>{t.delete ?? 'Delete'}</button>}
            <button type="submit" className="btn-primary flex-1" disabled={loading}
              style={{ backgroundColor: activeColor + '40', borderColor: activeColor + '60', color: 'inherit' }}>
              {event ? (t.save ?? 'Save changes') : (t.addEvent ?? 'Add event')}
            </button>
          </div>
        </form>
      </div>
    </div>

    {viewingImage && (
      <div className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center" onClick={() => setViewingImage(null)}>
        <img src={viewingImage} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
        <button onClick={() => setViewingImage(null)} className="absolute top-4 right-4 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors">
          <X size={18} />
        </button>
      </div>
    )}
    </>
  )
}

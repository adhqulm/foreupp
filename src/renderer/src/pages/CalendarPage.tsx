import { useState } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, X, Clock, AlignLeft } from 'lucide-react'
import { useSpace } from '../context/SpaceContext'
import { useAuth } from '../context/AuthContext'
import type { CalendarEvent } from '../types'
import clsx from 'clsx'

const EMOJI_OPTIONS = ['📅', '🎂', '✈️', '💊', '🏃', '🎬', '🍕', '💼', '❤️', '⭐', '🎉', '📚']
const COLOR_OPTIONS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#14b8a6']

export default function CalendarPage() {
  const { events, addEvent, deleteEvent } = useSpace()
  const { user, userProfile } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)

  // Build calendar grid
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const weeks: Date[][] = []
  let day = calStart
  while (day <= calEnd) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(day)
      day = addDays(day, 1)
    }
    weeks.push(week)
  }

  const getEventsForDate = (date: Date) =>
    events.filter(e => e.date === format(date, 'yyyy-MM-dd'))
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))

  const openAdd = (date: Date) => {
    setSelectedDate(date)
    setEditingEvent(null)
    setShowModal(true)
  }

  const openEdit = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingEvent(event)
    setSelectedDate(parseISO(event.date))
    setShowModal(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-text-primary">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="btn-ghost p-1.5">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="btn-secondary text-xs px-3 py-1">
              Today
            </button>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="btn-ghost p-1.5">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <button onClick={() => openAdd(new Date())} className="btn-primary flex items-center gap-2">
          <Plus size={15} />
          Add event
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border shrink-0">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-rows-[repeat(auto-fill,minmax(0,1fr))] overflow-hidden">
        <div className="h-full grid" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
              {week.map((d, di) => {
                const dayEvents = getEventsForDate(d)
                const inMonth = isSameMonth(d, currentDate)
                const today = isToday(d)
                return (
                  <div
                    key={di}
                    onClick={() => openAdd(d)}
                    className={clsx(
                      'border-r border-border last:border-r-0 p-1.5 cursor-pointer group overflow-hidden',
                      'hover:bg-surface-hover transition-colors',
                      !inMonth && 'opacity-30'
                    )}
                  >
                    <div className={clsx(
                      'w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1 transition-colors',
                      today ? 'bg-violet-600 text-white' : 'text-text-secondary group-hover:text-text-primary'
                    )}>
                      {format(d, 'd')}
                    </div>
                    <div className="space-y-0.5 overflow-hidden">
                      {dayEvents.slice(0, 3).map(ev => (
                        <EventChip key={ev.id} event={ev} onEdit={openEdit} userId={user?.uid ?? ''} />
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-xs text-text-muted px-1">+{dayEvents.length - 3} more</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <EventModal
          date={selectedDate ?? new Date()}
          event={editingEvent}
          onClose={() => setShowModal(false)}
          onAdd={addEvent}
          onDelete={deleteEvent}
          userColor={userProfile?.color ?? '#7c3aed'}
        />
      )}
    </div>
  )
}

function EventChip({ event, onEdit, userId }: {
  event: CalendarEvent
  onEdit: (e: CalendarEvent, ev: React.MouseEvent) => void
  userId: string
}) {
  return (
    <div
      onClick={e => onEdit(event, e)}
      className="flex items-center gap-1 rounded px-1 py-0.5 text-xs truncate cursor-pointer hover:opacity-80 transition-opacity"
      style={{ backgroundColor: `${event.color ?? '#7c3aed'}30`, borderLeft: `2px solid ${event.color ?? '#7c3aed'}` }}
    >
      {event.emoji && <span>{event.emoji}</span>}
      <span className="truncate" style={{ color: event.color ?? '#a78bfa' }}>{event.title}</span>
    </div>
  )
}

function EventModal({ date, event, onClose, onAdd, onDelete, userColor }: {
  date: Date
  event: CalendarEvent | null
  onClose: () => void
  onAdd: (e: any) => Promise<void>
  onDelete: (id: string) => Promise<void>
  userColor: string
}) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [eventDate, setEventDate] = useState(event?.date ?? format(date, 'yyyy-MM-dd'))
  const [startTime, setStartTime] = useState(event?.startTime ?? '')
  const [endTime, setEndTime] = useState(event?.endTime ?? '')
  const [allDay, setAllDay] = useState(event?.allDay ?? true)
  const [color, setColor] = useState(event?.color ?? userColor)
  const [emoji, setEmoji] = useState(event?.emoji ?? '')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    await onAdd({ title: title.trim(), description, date: eventDate, startTime: allDay ? undefined : startTime, endTime: allDay ? undefined : endTime, allDay, color, emoji })
    onClose()
  }

  const handleDelete = async () => {
    if (!event) return
    setLoading(true)
    await onDelete(event.id)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-text-primary">{event ? 'Edit event' : 'New event'}</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Emoji + Title row */}
          <div className="flex gap-2">
            <select value={emoji} onChange={e => setEmoji(e.target.value)} className="input w-16 text-center text-xl px-1">
              <option value="">—</option>
              {EMOJI_OPTIONS.map(em => <option key={em} value={em}>{em}</option>)}
            </select>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="input flex-1" placeholder="Event title" required autoFocus />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Date</label>
            <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="input" />
          </div>

          {/* All day toggle + times */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="w-4 h-4 accent-violet-500" />
              <span className="text-sm text-text-secondary">All day</span>
            </label>
            {!allDay && (
              <div className="flex items-center gap-2 flex-1">
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="input flex-1 text-sm" />
                <span className="text-text-muted text-sm">—</span>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="input flex-1 text-sm" />
              </div>
            )}
          </div>

          {/* Description */}
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="input resize-none"
            placeholder="Add a note... (optional)"
            rows={2}
          />

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={clsx('w-7 h-7 rounded-full transition-all', color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-bg-secondary scale-110' : 'hover:scale-105')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            {event && (
              <button type="button" onClick={handleDelete} className="btn-danger" disabled={loading}>
                Delete
              </button>
            )}
            <button type="submit" className="btn-primary flex-1" disabled={loading || !title.trim()}>
              {event ? 'Save changes' : 'Add event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

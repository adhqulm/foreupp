import { useState } from 'react'
import { format, subDays, addDays, startOfWeek } from 'date-fns'
import { Plus, X, Trash2, CheckSquare, Hash, Star, Type } from 'lucide-react'
import { useSpace } from '../context/SpaceContext'
import { useAuth } from '../context/AuthContext'
import type { Tracker, TrackerEntry } from '../types'
import clsx from 'clsx'

const TRACKER_COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#e879f9', '#14b8a6']
const TRACKER_EMOJIS = ['✅', '💧', '🏃', '💊', '📚', '🧘', '🍎', '😴', '🎯', '💪', '🌟', '🧠', '✍️', '🎵']
const TODAY = format(new Date(), 'yyyy-MM-dd')
const WEEK_DAYS = Array.from({ length: 7 }, (_, i) => {
  const d = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i)
  return { date: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE'), day: format(d, 'd') }
})

export default function TrackersPage() {
  const { trackers, trackerEntries, addTracker, deleteTracker, setTrackerEntry } = useSpace()
  const { user } = useAuth()
  const [showCreate, setShowCreate] = useState(false)

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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Trackers</h2>
            <p className="text-text-muted text-sm mt-0.5">Track your habits and goals together</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} />
            New tracker
          </button>
        </div>

        {/* Week header */}
        <div className="grid gap-3">
          {trackers.length === 0 ? (
            <div className="card text-center py-16">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-text-secondary font-medium">No trackers yet</p>
              <p className="text-text-muted text-sm mt-1">Create your first tracker to start building habits</p>
            </div>
          ) : (
            trackers.map(tracker => (
              <TrackerRow
                key={tracker.id}
                tracker={tracker}
                weekDays={WEEK_DAYS}
                getEntry={(date, uid) => getEntry(tracker.id, date, uid)}
                onCheck={(date) => handleCheck(tracker, date)}
                onNumber={(date, val) => handleNumber(tracker, date, val)}
                onRating={(date, val) => handleRating(tracker, date, val)}
                onDelete={() => deleteTracker(tracker.id)}
                userId={user?.uid ?? ''}
              />
            ))
          )}
        </div>
      </div>

      {showCreate && <CreateTrackerModal onClose={() => setShowCreate(false)} onAdd={addTracker} />}
    </div>
  )
}

function TrackerRow({ tracker, weekDays, getEntry, onCheck, onNumber, onRating, onDelete, userId }: {
  tracker: Tracker
  weekDays: { date: string; label: string; day: string }[]
  getEntry: (date: string, uid: string) => TrackerEntry | undefined
  onCheck: (date: string) => void
  onNumber: (date: string, val: number) => void
  onRating: (date: string, val: number) => void
  onDelete: () => void
  userId: string
}) {
  const [showDelete, setShowDelete] = useState(false)

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: `${tracker.color}20` }}>
            {tracker.emoji ?? '📊'}
          </div>
          <div>
            <p className="font-semibold text-text-primary text-sm">{tracker.name}</p>
            {tracker.description && <p className="text-xs text-text-muted">{tracker.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrackerTypeIcon type={tracker.type} color={tracker.color} />
          <button
            onClick={() => setShowDelete(!showDelete)}
            className="btn-ghost p-1.5 text-text-muted hover:text-red-400"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {showDelete && (
        <div className="mb-3 p-3 bg-red-900/20 border border-red-900/30 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-400">Delete this tracker?</p>
          <div className="flex gap-2">
            <button onClick={() => setShowDelete(false)} className="btn-secondary text-xs py-1">Cancel</button>
            <button onClick={onDelete} className="btn-danger text-xs py-1">Delete</button>
          </div>
        </div>
      )}

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(({ date, label, day }) => {
          const myEntry = getEntry(date, userId)
          const isToday = date === TODAY

          return (
            <div key={date} className="flex flex-col items-center gap-1">
              <p className={clsx('text-xs font-medium', isToday ? 'text-violet-400' : 'text-text-muted')}>{label}</p>
              <p className={clsx('text-xs', isToday ? 'text-violet-300' : 'text-text-muted')}>{day}</p>

              {tracker.type === 'checkbox' && (
                <button
                  onClick={() => onCheck(date)}
                  className={clsx(
                    'w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all',
                    myEntry?.value
                      ? 'border-transparent'
                      : 'border-border hover:border-violet-600/50'
                  )}
                  style={myEntry?.value ? { backgroundColor: tracker.color } : {}}
                >
                  {myEntry?.value && <span className="text-white text-xs font-bold">✓</span>}
                </button>
              )}

              {tracker.type === 'number' && (
                <input
                  type="number"
                  defaultValue={(myEntry?.value as number) ?? ''}
                  onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onNumber(date, v) }}
                  className="w-10 h-8 text-center text-xs input px-1 py-0"
                  min={0}
                />
              )}

              {tracker.type === 'rating' && (
                <div className="flex gap-0.5">
                  {Array.from({ length: tracker.maxRating ?? 5 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => onRating(date, i + 1)}
                      className="text-xs transition-transform hover:scale-125"
                    >
                      <span style={{ color: (myEntry?.value as number ?? 0) > i ? tracker.color : '#374151' }}>★</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TrackerTypeIcon({ type, color }: { type: string; color: string }) {
  const Icon = type === 'checkbox' ? CheckSquare : type === 'number' ? Hash : type === 'rating' ? Star : Type
  return <Icon size={13} style={{ color }} />
}

function CreateTrackerModal({ onClose, onAdd }: {
  onClose: () => void
  onAdd: (t: any) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('')
  const [color, setColor] = useState(TRACKER_COLORS[0])
  const [type, setType] = useState<Tracker['type']>('checkbox')
  const [unit, setUnit] = useState('')
  const [maxRating, setMaxRating] = useState(5)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    await onAdd({ name: name.trim(), description, emoji, color, type, unit: type === 'number' ? unit : undefined, maxRating: type === 'rating' ? maxRating : undefined, isShared: true })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-text-primary">New tracker</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <select value={emoji} onChange={e => setEmoji(e.target.value)} className="input w-16 text-center text-xl px-1">
              <option value="">—</option>
              {TRACKER_EMOJIS.map(em => <option key={em} value={em}>{em}</option>)}
            </select>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input flex-1" placeholder="Tracker name" required autoFocus />
          </div>

          <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="input" placeholder="Description (optional)" />

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {(['checkbox', 'number', 'rating'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={clsx('py-2 px-2 rounded-lg text-xs font-medium border transition-all capitalize', type === t ? 'bg-violet-600/20 border-violet-600/40 text-violet-300' : 'border-border text-text-secondary hover:border-violet-600/30')}
                >
                  {t === 'checkbox' ? '✓ Done' : t === 'number' ? '# Number' : '★ Rating'}
                </button>
              ))}
            </div>
          </div>

          {type === 'number' && (
            <input type="text" value={unit} onChange={e => setUnit(e.target.value)} className="input" placeholder="Unit (e.g. glasses, km, pages)" />
          )}

          {type === 'rating' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Max rating</label>
              <select value={maxRating} onChange={e => setMaxRating(Number(e.target.value))} className="input">
                {[3, 5, 7, 10].map(n => <option key={n} value={n}>{n} stars</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {TRACKER_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={clsx('w-7 h-7 rounded-full transition-all', color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-bg-secondary scale-110' : 'hover:scale-105')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading || !name.trim()}>
            {loading ? 'Creating...' : 'Create tracker'}
          </button>
        </form>
      </div>
    </div>
  )
}

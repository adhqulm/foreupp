import { useState, useEffect } from 'react'
import { format, differenceInDays, parseISO, isPast, isFuture } from 'date-fns'
import { Plus, X, Trash2, Timer, TrendingUp } from 'lucide-react'
import { useSpace } from '../context/SpaceContext'
import { useAuth } from '../context/AuthContext'
import type { Countdown } from '../types'
import clsx from 'clsx'

const COUNTDOWN_COLORS = ['#7c3aed', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#e879f9', '#14b8a6']
const COUNTDOWN_EMOJIS = ['🎉', '✈️', '🎂', '💍', '🏖️', '🎓', '🏠', '💪', '🌟', '❤️', '🚀', '🎯', '🏆', '🌸', '🍾', '🔥']

export default function CountdownsPage() {
  const { countdowns, addCountdown, deleteCountdown } = useSpace()
  const { user } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [, forceUpdate] = useState(0)

  // Tick every minute to update countdowns
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  const sorted = [...countdowns].sort((a, b) => {
    const dA = Math.abs(differenceInDays(parseISO(a.targetDate), new Date()))
    const dB = Math.abs(differenceInDays(parseISO(b.targetDate), new Date()))
    return dA - dB
  })

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Countdowns</h2>
            <p className="text-text-muted text-sm mt-0.5">Count toward the things that matter</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} />
            New countdown
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-4xl mb-3">⏳</p>
            <p className="text-text-secondary font-medium">No countdowns yet</p>
            <p className="text-text-muted text-sm mt-1">Add something to look forward to, or track how far you've come</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {sorted.map(c => (
              <CountdownCard key={c.id} countdown={c} onDelete={() => deleteCountdown(c.id)} />
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateCountdownModal onClose={() => setShowCreate(false)} onAdd={addCountdown} />}
    </div>
  )
}

function CountdownCard({ countdown, onDelete }: { countdown: Countdown; onDelete: () => void }) {
  const [showDelete, setShowDelete] = useState(false)
  const target = parseISO(countdown.targetDate)
  const days = differenceInDays(target, new Date())
  const absDays = Math.abs(days)
  const isCountup = countdown.type === 'countup'
  const isArrived = days === 0

  const displayDays = isArrived ? 0 : isCountup ? absDays : days > 0 ? days : absDays

  let label = ''
  if (isArrived) label = 'Today!'
  else if (isCountup) label = `days ${isPast(target) ? 'since' : 'until'}`
  else label = days > 0 ? 'days to go' : 'days ago'

  return (
    <div
      className="card relative overflow-hidden group"
      style={{ borderColor: `${countdown.color}30` }}
    >
      {/* Accent bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: countdown.color }} />

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{countdown.emoji ?? (countdown.type === 'countdown' ? '⏳' : '📈')}</span>
          <div>
            <p className="font-semibold text-text-primary text-sm leading-tight">{countdown.title}</p>
            <p className="text-xs text-text-muted">{format(target, 'MMM d, yyyy')}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <div
            className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
            style={{ backgroundColor: `${countdown.color}20`, color: countdown.color }}
          >
            {countdown.type === 'countdown' ? <Timer size={10} /> : <TrendingUp size={10} />}
            {countdown.type}
          </div>
        </div>
      </div>

      {/* Big number */}
      <div className="text-center py-3">
        <p
          className="text-6xl font-bold tabular-nums leading-none"
          style={{ color: countdown.color }}
        >
          {displayDays.toLocaleString()}
        </p>
        <p className="text-text-muted text-sm mt-2 font-medium">{label}</p>
        {isArrived && <p className="text-lg mt-1">🎉</p>}
      </div>

      {countdown.description && (
        <p className="text-xs text-text-muted text-center mt-2 px-2">{countdown.description}</p>
      )}

      {/* Delete */}
      <button
        onClick={() => setShowDelete(!showDelete)}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 btn-ghost p-1 text-text-muted hover:text-red-400 transition-all"
      >
        <Trash2 size={12} />
      </button>

      {showDelete && (
        <div className="absolute inset-0 bg-bg-secondary/95 flex flex-col items-center justify-center gap-3 rounded-xl">
          <p className="text-sm text-text-secondary font-medium">Delete this?</p>
          <div className="flex gap-2">
            <button onClick={() => setShowDelete(false)} className="btn-secondary text-xs py-1 px-3">Cancel</button>
            <button onClick={onDelete} className="btn-danger text-xs py-1 px-3">Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CreateCountdownModal({ onClose, onAdd }: {
  onClose: () => void
  onAdd: (c: any) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('')
  const [color, setColor] = useState(COUNTDOWN_COLORS[0])
  const [type, setType] = useState<'countdown' | 'countup'>('countdown')
  const [targetDate, setTargetDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    await onAdd({ title: title.trim(), description, emoji, color, type, targetDate })
    onClose()
  }

  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-text-primary">New countdown</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <select value={emoji} onChange={e => setEmoji(e.target.value)} className="input w-16 text-center text-xl px-1">
              <option value="">—</option>
              {COUNTDOWN_EMOJIS.map(em => <option key={em} value={em}>{em}</option>)}
            </select>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="input flex-1" placeholder="e.g. Our anniversary trip" required autoFocus />
          </div>

          <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="input" placeholder="Add a note... (optional)" />

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('countdown')}
                className={clsx('py-2.5 px-3 rounded-lg text-sm font-medium border transition-all flex items-center gap-2 justify-center', type === 'countdown' ? 'bg-violet-600/20 border-violet-600/40 text-violet-300' : 'border-border text-text-secondary hover:border-violet-600/30')}
              >
                <Timer size={15} /> Countdown
              </button>
              <button
                type="button"
                onClick={() => setType('countup')}
                className={clsx('py-2.5 px-3 rounded-lg text-sm font-medium border transition-all flex items-center gap-2 justify-center', type === 'countup' ? 'bg-violet-600/20 border-violet-600/40 text-violet-300' : 'border-border text-text-secondary hover:border-violet-600/30')}
              >
                <TrendingUp size={15} /> Count up
              </button>
            </div>
            <p className="text-xs text-text-muted mt-1.5">
              {type === 'countdown' ? 'Count down TO a future date (e.g. a trip, event, or deadline)' : 'Count UP FROM a date (e.g. quitting something, a streak, an anniversary)'}
            </p>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              {type === 'countdown' ? 'Target date' : 'Start date'}
            </label>
            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="input" />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COUNTDOWN_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={clsx('w-7 h-7 rounded-full transition-all', color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-bg-secondary scale-110' : 'hover:scale-105')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading || !title.trim()}>
            {loading ? 'Creating...' : 'Create'}
          </button>
        </form>
      </div>
    </div>
  )
}

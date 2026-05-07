import { useState, useEffect } from 'react'
import { format, differenceInDays, differenceInYears, differenceInMonths, addYears, addMonths, parseISO } from 'date-fns'
import { Plus, X, Trash2, Timer, TrendingUp, Pencil, AlignStartVertical, AlignVerticalJustifyCenter } from 'lucide-react'
import ColorPresetPicker from '../components/ColorPresetPicker'
import { useSpace } from '../context/SpaceContext'
import { useTranslation } from '../hooks/useTranslation'
import type { Countdown } from '../types'
import clsx from 'clsx'

const COUNTDOWN_EMOJIS = ['🎉', '✈️', '🎂', '💍', '🏖️', '🎓', '🏠', '💪', '🌟', '❤️', '🚀', '🎯', '🏆', '🌸', '🍾', '🔥']

export default function CountdownsPage() {
  const { countdowns, addCountdown, updateCountdown, deleteCountdown } = useSpace()
  const t = useTranslation()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Countdown | null>(null)
  const [, forceUpdate] = useState(0)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [matchHeight, setMatchHeight] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  const sorted = [...countdowns].sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) return a.order - b.order
    if (a.order !== undefined) return -1
    if (b.order !== undefined) return 1
    return a.createdAt - b.createdAt
  })

  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const fromIdx = sorted.findIndex(c => c.id === dragId)
    const toIdx = sorted.findIndex(c => c.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const reordered = [...sorted]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    await Promise.all(reordered.map((c, i) => updateCountdown(c.id, { order: i })))
    setDragId(null); setDragOverId(null)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-text-primary">{t.countdowns ?? 'Countdowns'}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMatchHeight(v => !v)}
              title={matchHeight ? 'Switch to natural height' : 'Match card heights'}
              className="btn-ghost p-2 text-text-muted hover:text-text-primary"
            >
              {matchHeight ? <AlignVerticalJustifyCenter size={16} /> : <AlignStartVertical size={16} />}
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
              <Plus size={15} />
              {t.newCountdown ?? 'New countdown'}
            </button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-4xl mb-3">⏳</p>
            <p className="text-text-secondary font-medium">{t.noCountdowns ?? 'No countdowns yet'}</p>
            <p className="text-text-muted text-sm mt-1">Add something to look forward to, or track how far you've come</p>
          </div>
        ) : (
          <div className={clsx('grid grid-cols-2 gap-4', matchHeight ? 'items-stretch' : 'items-start')}>
            {sorted.map(c => (
              <div
                key={c.id}
                draggable
                onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragId(c.id) }}
                onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                onDragOver={e => { e.preventDefault(); setDragOverId(c.id) }}
                onDrop={e => { e.preventDefault(); handleDrop(c.id) }}
                className={clsx('flex flex-col transition-all', dragId === c.id ? 'opacity-40' : dragOverId === c.id ? 'ring-2 ring-violet-500/50 rounded-xl' : '')}
              >
                <CountdownCard countdown={c}
                  onEdit={() => setEditing(c)}
                  onDelete={() => deleteCountdown(c.id)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateCountdownModal onClose={() => setShowCreate(false)} onAdd={addCountdown} />}
      {editing && (
        <CreateCountdownModal
          existing={editing}
          onClose={() => setEditing(null)}
          onAdd={addCountdown}
          onUpdate={(data) => updateCountdown(editing.id, data)}
        />
      )}
    </div>
  )
}

function getDetailedDiff(target: Date) {
  const now = new Date()
  const [start, end] = target > now ? [now, target] : [target, now]
  const years = differenceInYears(end, start)
  const afterYears = addYears(start, years)
  const months = differenceInMonths(end, afterYears)
  const afterMonths = addMonths(afterYears, months)
  const days = differenceInDays(end, afterMonths)
  return { years, months, days }
}

function CountdownCard({ countdown, onEdit, onDelete }: { countdown: Countdown; onEdit: () => void; onDelete: () => void }) {
  const { members } = useSpace()
  const t = useTranslation()
  const [showDelete, setShowDelete] = useState(false)
  const target = parseISO(countdown.targetDate)
  const now = new Date()
  const rawDays = differenceInDays(target, now)
  const totalDays = Math.abs(rawDays)
  const detailed = getDetailedDiff(target)
  const isDetailed = countdown.displayFormat === 'detailed'
  const isZero = totalDays === 0
  const isPassed = countdown.type === 'countdown' && rawDays < 0

  const creatorName = members[countdown.createdBy]?.displayName ?? null

  const pl = (n: number, singular: string, plural: string) => n === 1 ? singular : plural

  return (
    <div className="card relative overflow-hidden group flex flex-col h-full !border-0">
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: countdown.color }} />

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{countdown.emoji ?? (countdown.type === 'countdown' ? '⏳' : '📈')}</span>
          <div>
            <p className="font-semibold text-text-primary text-sm leading-tight">{countdown.title}</p>
            <p className="text-xs text-text-muted">{format(target, 'MMM d, yyyy')}</p>
          </div>
        </div>
        <div className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
          style={{ backgroundColor: `${countdown.color}20`, color: countdown.color }}>
          {countdown.type === 'countdown' ? <Timer size={10} /> : <TrendingUp size={10} />}
          {countdown.type === 'countdown' ? (t.countdown ?? 'countdown') : (t.countUp ?? 'countup')}
        </div>
      </div>

      {/* Display */}
      <div className="text-center flex-1 flex flex-col items-center justify-center py-4">
        {isZero ? (
          <>
            <p className="text-6xl font-bold" style={{ color: countdown.color }}>0</p>
            <p className="text-text-muted text-sm mt-2">{t.today ?? 'Today'}! 🎉</p>
          </>
        ) : isPassed ? (
          isDetailed ? (
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Passed</p>
              <div className="flex items-end justify-center gap-3">
                {detailed.years > 0 && (
                  <div className="flex items-baseline gap-1">
                    <span className="text-6xl font-bold tabular-nums leading-none" style={{ color: countdown.color }}>{detailed.years}</span>
                    <span className="text-xs text-text-muted">{pl(detailed.years, 'year', 'years')}</span>
                  </div>
                )}
                {(detailed.years > 0 || detailed.months > 0) && (
                  <div className="flex items-baseline gap-1">
                    <span className="text-6xl font-bold tabular-nums leading-none" style={{ color: countdown.color }}>{detailed.months}</span>
                    <span className="text-xs text-text-muted">{pl(detailed.months, 'month', 'months')}</span>
                  </div>
                )}
                <div className="flex items-baseline gap-1">
                  <span className="text-6xl font-bold tabular-nums leading-none" style={{ color: countdown.color }}>{detailed.days}</span>
                  <span className="text-xs text-text-muted">{pl(detailed.days, 'day', 'days')}</span>
                </div>
              </div>
              <p className="text-text-muted text-sm mt-2 font-medium">ago</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Passed</p>
              <p className="text-6xl font-bold tabular-nums leading-none" style={{ color: countdown.color }}>
                {totalDays.toLocaleString()}
              </p>
              <p className="text-text-muted text-sm mt-2 font-medium">{pl(totalDays, 'day ago', 'days ago')}</p>
            </>
          )
        ) : isDetailed ? (
          <div className="flex items-end justify-center gap-3">
            {detailed.years > 0 && (
              <div className="flex items-baseline gap-1">
                <span className="text-6xl font-bold tabular-nums leading-none" style={{ color: countdown.color }}>{detailed.years}</span>
                <span className="text-xs text-text-muted">{pl(detailed.years, 'year', 'years')}</span>
              </div>
            )}
            {(detailed.years > 0 || detailed.months > 0) && (
              <div className="flex items-baseline gap-1">
                <span className="text-6xl font-bold tabular-nums leading-none" style={{ color: countdown.color }}>{detailed.months}</span>
                <span className="text-xs text-text-muted">{pl(detailed.months, 'month', 'months')}</span>
              </div>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-6xl font-bold tabular-nums leading-none" style={{ color: countdown.color }}>{detailed.days}</span>
              <span className="text-xs text-text-muted">
                {countdown.type === 'countdown' ? pl(detailed.days, 'day left', 'days left') : pl(detailed.days, 'day', 'days')}
              </span>
            </div>
          </div>
        ) : (
          <>
            <p className="text-6xl font-bold tabular-nums leading-none" style={{ color: countdown.color }}>
              {totalDays.toLocaleString()}
            </p>
            <p className="text-text-muted text-sm mt-2 font-medium">
              {countdown.type === 'countdown' ? pl(totalDays, 'day left', 'days left') : pl(totalDays, 'day', 'days')}
            </p>
          </>
        )}
        {countdown.description && (
          <p className="text-xs text-text-muted text-center mt-3 px-2">{countdown.description}</p>
        )}
      </div>

      {/* Creator name pinned to bottom */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/30">
        <span className="text-xs text-text-muted">{creatorName ?? ''}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button onClick={onEdit} className="btn-ghost p-1 text-text-muted hover:text-text-primary">
            <Pencil size={12} />
          </button>
          <button onClick={() => setShowDelete(!showDelete)} className="btn-ghost p-1 text-text-muted hover:text-red-600">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {showDelete && (
        <div className="absolute inset-0 bg-bg-secondary/95 flex flex-col items-center justify-center gap-3 rounded-xl">
          <p className="text-sm text-text-secondary font-medium">{t.delete ?? 'Delete'}?</p>
          <div className="flex gap-2">
            <button onClick={() => setShowDelete(false)} className="btn-secondary text-xs py-1 px-3">{t.cancel ?? 'Cancel'}</button>
            <button onClick={onDelete} className="btn-danger text-xs py-1 px-3">{t.delete ?? 'Delete'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CreateCountdownModal({ existing, onClose, onAdd, onUpdate }: {
  existing?: Countdown | null
  onClose: () => void
  onAdd: (c: any) => Promise<void>
  onUpdate?: (c: any) => Promise<void>
}) {
  const t = useTranslation()
  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [emoji, setEmoji] = useState(existing?.emoji ?? '')
  const [color, setColor] = useState(existing?.color ?? '#7c3aed')
  const [type, setType] = useState<'countdown' | 'countup'>(existing?.type ?? 'countdown')
  const [displayFormat, setDisplayFormat] = useState<'days' | 'detailed'>(existing?.displayFormat ?? 'days')
  const [targetDate, setTargetDate] = useState(existing?.targetDate ?? format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    const payload = { title: title.trim(), description, emoji, color, type, targetDate, displayFormat }
    if (existing && onUpdate) await onUpdate(payload)
    else await onAdd(payload)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-text-primary">{existing ? (t.editCountdown ?? 'Edit countdown') : (t.newCountdown ?? 'New countdown')}</h3>
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

          <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="input" placeholder={t.addNote ?? 'Add a note...'} />

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">{t.type ?? 'Type'}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('countdown')}
                className={clsx('py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center gap-2 justify-center focus-visible:outline-none', type === 'countdown' ? 'bg-violet-600/20 border border-violet-600/40 text-violet-300' : 'text-text-secondary hover:bg-surface-hover')}
              >
                <Timer size={15} /> {t.countdown ?? 'Countdown'}
              </button>
              <button
                type="button"
                onClick={() => setType('countup')}
                className={clsx('py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center gap-2 justify-center focus-visible:outline-none', type === 'countup' ? 'bg-violet-600/20 border border-violet-600/40 text-violet-300' : 'text-text-secondary hover:bg-surface-hover')}
              >
                <TrendingUp size={15} /> {t.countUp ?? 'Count up'}
              </button>
            </div>
          </div>

          {/* Display format */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">{t.displayFormat ?? 'Display format'}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDisplayFormat('days')}
                className={clsx('py-2.5 px-3 rounded-lg text-sm font-medium transition-all focus-visible:outline-none', displayFormat === 'days' ? 'bg-violet-600/20 border border-violet-600/40 text-violet-300' : 'text-text-secondary hover:bg-surface-hover')}
              >
                {t.daysOnly ?? 'Days only'}
              </button>
              <button
                type="button"
                onClick={() => setDisplayFormat('detailed')}
                className={clsx('py-2.5 px-3 rounded-lg text-sm font-medium transition-all focus-visible:outline-none', displayFormat === 'detailed' ? 'bg-violet-600/20 border border-violet-600/40 text-violet-300' : 'text-text-secondary hover:bg-surface-hover')}
              >
                {t.yearsMonthsDays ?? 'Years / months / days'}
              </button>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              {type === 'countdown' ? (t.targetDate ?? 'Target date') : (t.startDate ?? 'Start date')}
            </label>
            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="input" />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">{t.color ?? 'Color'}</label>
            <ColorPresetPicker color={color} onChange={setColor} />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading || !title.trim()}>
            {loading ? (t.saving ?? 'Saving...') : existing ? (t.saveChanges ?? 'Save changes') : (t.create ?? 'Create')}
          </button>
        </form>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Calendar, BarChart2, Timer, LayoutGrid, MessageSquare } from 'lucide-react'
import { useSpace } from '../context/SpaceContext'
import { format, parseISO } from 'date-fns'
import clsx from 'clsx'

interface Result {
  id: string
  type: 'event' | 'tracker' | 'countdown' | 'kanban' | 'chat'
  title: string
  subtitle?: string
  action: () => void
}

const TYPE_ICON: Record<Result['type'], React.ElementType> = {
  event: Calendar,
  tracker: BarChart2,
  countdown: Timer,
  kanban: LayoutGrid,
  chat: MessageSquare,
}

const TYPE_LABEL: Record<Result['type'], string> = {
  event: 'Calendar',
  tracker: 'Tracker',
  countdown: 'Countdown',
  kanban: 'Kanban',
  chat: 'Chat',
}

export default function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { events, trackers, countdowns, kanbanCards, conversations, setActiveConversationId } = useSpace()

  useEffect(() => { inputRef.current?.focus() }, [])

  const q = query.trim().toLowerCase()

  const results: Result[] = q.length < 1 ? [] : [
    ...events
      .filter(e => e.title.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(e => ({
        id: `event-${e.id}`,
        type: 'event' as const,
        title: e.title,
        subtitle: format(parseISO(e.date), 'MMM d, yyyy'),
        action: () => { navigate('/calendar'); onClose() },
      })),
    ...trackers
      .filter(t => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(t => ({
        id: `tracker-${t.id}`,
        type: 'tracker' as const,
        title: t.name,
        subtitle: t.description,
        action: () => { navigate('/trackers'); onClose() },
      })),
    ...countdowns
      .filter(c => c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(c => ({
        id: `countdown-${c.id}`,
        type: 'countdown' as const,
        title: c.title,
        subtitle: c.description,
        action: () => { navigate('/countdowns'); onClose() },
      })),
    ...kanbanCards
      .filter(k => k.title.toLowerCase().includes(q) || k.description?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(k => ({
        id: `kanban-${k.id}`,
        type: 'kanban' as const,
        title: k.title,
        subtitle: k.description,
        action: () => { navigate('/kanban'); onClose() },
      })),
    ...conversations
      .filter(c => c.name?.toLowerCase().includes(q) || c.lastMessageText?.toLowerCase().includes(q))
      .slice(0, 3)
      .map(c => ({
        id: `chat-${c.id}`,
        type: 'chat' as const,
        title: c.name ?? 'Chat',
        subtitle: c.lastMessageText,
        action: () => { setActiveConversationId(c.id); navigate('/messenger'); onClose() },
      })),
  ]

  const grouped = results.reduce<Record<string, Result[]>>((acc, r) => {
    ;(acc[r.type] ??= []).push(r)
    return acc
  }, {})

  const flat = results

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && flat[selected]) { flat[selected].action() }
    else if (e.key === 'Escape') { onClose() }
  }, [flat, selected, onClose])

  useEffect(() => { setSelected(0) }, [query])

  let globalIdx = 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/60" onClick={onClose}>
      <div className="bg-bg-secondary border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={16} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search events, trackers, cards, chats…"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-text-muted hover:text-text-primary transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {q.length > 0 && flat.length === 0 && (
            <p className="text-sm text-text-muted text-center py-8">No results for "{query}"</p>
          )}
          {q.length === 0 && (
            <p className="text-sm text-text-muted text-center py-8">Type to search across your space</p>
          )}
          {(Object.keys(grouped) as Result['type'][]).map(type => (
            <div key={type}>
              <div className="px-4 py-1.5 flex items-center gap-2">
                {(() => { const Icon = TYPE_ICON[type]; return <Icon size={12} className="text-text-muted" /> })()}
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{TYPE_LABEL[type]}</span>
              </div>
              {grouped[type].map(result => {
                const idx = globalIdx++
                return (
                  <button key={result.id} onClick={result.action}
                    onMouseEnter={() => setSelected(idx)}
                    className={clsx(
                      'w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors',
                      selected === idx ? 'bg-violet-600/15' : 'hover:bg-surface-hover'
                    )}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{result.title}</p>
                      {result.subtitle && <p className="text-xs text-text-muted truncate">{result.subtitle}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {flat.length > 0 && (
          <div className="border-t border-border px-4 py-2 flex items-center gap-3">
            <span className="text-xs text-text-muted">↑↓ navigate</span>
            <span className="text-xs text-text-muted">↵ open</span>
            <span className="text-xs text-text-muted">Esc close</span>
          </div>
        )}
      </div>
    </div>
  )
}

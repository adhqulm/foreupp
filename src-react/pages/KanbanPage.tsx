import { useState, useRef, useEffect } from 'react'
import { Plus, X, Trash2, Pencil, ChevronLeft, MoreHorizontal, Calendar, Check, ChevronRight, Kanban, BarChart3, GripVertical } from 'lucide-react'
import { useSpace } from '../context/SpaceContext'
import { useTranslation } from '../hooks/useTranslation'
import type { KanbanBoard, KanbanColumn, KanbanCard, KanbanChecklist, KanbanTaskUpdate } from '../types'
import { useAuth } from '../context/AuthContext'
import clsx from 'clsx'
import ColorPresetPicker from '../components/ColorPresetPicker'
import { format, parseISO, isPast, isToday } from 'date-fns'

const BOARD_EMOJIS = ['📋', '🚀', '💡', '🎯', '🔧', '📊', '🌟', '🏗️', '🎨', '📝', '🔥', '✅', '📦', '🌿', '💼', '🏆']

// ─── Progress helpers ─────────────────────────────────────────────────────────

function getCardProgress(card: KanbanCard): number {
  if (card.checklist && card.checklist.length > 0) {
    const done = card.checklist.filter(i => i.done).length
    return Math.round((done / card.checklist.length) * 100)
  }
  return card.progress ?? 0
}

function avgProgress(cards: KanbanCard[]): number {
  if (cards.length === 0) return 0
  return Math.round(cards.reduce((sum, c) => sum + getCardProgress(c), 0) / cards.length)
}

// ─── Progress color helper ────────────────────────────────────────────────────

function progressColor(value: number): string {
  if (value < 30) return '#ef4444'  // red
  if (value < 60) return '#eab308'  // yellow
  return '#22c55e'                  // green
}

// ─── Draggable progress bar ───────────────────────────────────────────────────

function DragProgressBar({ value, onChange }: {
  value: number
  onChange: (v: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [local, setLocal] = useState(value)

  useEffect(() => { if (!dragging) setLocal(value) }, [value, dragging])

  const calc = (clientX: number): number => {
    if (!ref.current) return local
    const rect = ref.current.getBoundingClientRect()
    return Math.max(0, Math.min(100, Math.round((clientX - rect.left) / rect.width * 100)))
  }

  const startDrag = (initialX: number, isMouse: boolean) => {
    setDragging(true)
    setLocal(calc(initialX))
    if (isMouse) {
      const onMove = (e: MouseEvent) => setLocal(calc(e.clientX))
      const onUp = (e: MouseEvent) => {
        const final = calc(e.clientX)
        setLocal(final); setDragging(false); onChange(final)
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    } else {
      const onMove = (e: TouchEvent) => { e.preventDefault(); setLocal(calc(e.touches[0].clientX)) }
      const onEnd = (e: TouchEvent) => {
        const final = calc(e.changedTouches[0].clientX)
        setLocal(final); setDragging(false); onChange(final)
        document.removeEventListener('touchmove', onMove)
        document.removeEventListener('touchend', onEnd)
      }
      document.addEventListener('touchmove', onMove, { passive: false })
      document.addEventListener('touchend', onEnd)
    }
  }

  const display = dragging ? local : value
  const color = progressColor(display)

  return (
    <div className="flex items-center gap-3 select-none">
      <div
        ref={ref}
        className="relative flex-1 h-5 rounded-full bg-border cursor-pointer overflow-hidden"
        onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, true) }}
        onTouchStart={e => startDrag(e.touches[0].clientX, false)}
      >
        <div
          className="absolute left-0 top-0 h-full"
          style={{ width: `${display}%`, backgroundColor: color, transition: dragging ? 'background-color 0.3s' : 'width 0.15s ease, background-color 0.3s' }}
        />
      </div>
      <span className="tabular-nums font-bold shrink-0 w-10 text-right text-sm transition-colors duration-300" style={{ color }}>
        {display}%
      </span>
    </div>
  )
}

// ─── Static progress bar ──────────────────────────────────────────────────────

function ProgressBar({ value, color, className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={clsx('w-full bg-border rounded-full overflow-hidden', className ?? 'h-1.5')}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${value}%`, backgroundColor: color ?? '#7c3aed' }}
      />
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function KanbanPage() {
  const [showCreateBoard, setShowCreateBoard] = useState(false)
  const [editingBoard, setEditingBoard] = useState<KanbanBoard | null>(null)
  const { kanbanBoards, deleteKanbanBoard, updateKanbanBoard } = useSpace()
  const t = useTranslation()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dragBoardId, setDragBoardId] = useState<string | null>(null)
  const [dragOverBoardId, setDragOverBoardId] = useState<string | null>(null)

  const sortedBoards = [...kanbanBoards].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const handleBoardDrop = async (targetId: string) => {
    if (!dragBoardId || dragBoardId === targetId) { setDragBoardId(null); setDragOverBoardId(null); return }
    const from = sortedBoards.findIndex(b => b.id === dragBoardId)
    const to = sortedBoards.findIndex(b => b.id === targetId)
    if (from === -1 || to === -1) return
    const reordered = [...sortedBoards]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    await Promise.all(reordered.map((b, i) => updateKanbanBoard(b.id, { order: i })))
    setDragBoardId(null); setDragOverBoardId(null)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-text-primary">{t.kanban ?? 'Kanban'}</h2>
          </div>
          <button onClick={() => setShowCreateBoard(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> New board
          </button>
        </div>

        {sortedBoards.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-text-secondary font-medium">No boards yet</p>
            <p className="text-text-muted text-sm mt-1">Create a kanban board or a task progress tracker</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedBoards.map(board => (
              <div
                key={board.id}
                draggable
                onDragStart={() => setDragBoardId(board.id)}
                onDragOver={e => { e.preventDefault(); setDragOverBoardId(board.id) }}
                onDrop={() => handleBoardDrop(board.id)}
                onDragEnd={() => { setDragBoardId(null); setDragOverBoardId(null) }}
                className={clsx(
                  'rounded-xl border overflow-hidden transition-opacity',
                  dragBoardId === board.id ? 'opacity-40' : 'opacity-100',
                  dragOverBoardId === board.id && dragBoardId !== board.id ? 'ring-2 ring-violet-500/50' : ''
                )}
                style={{ borderColor: `${board.color}40` }}
              >
                {/* Board header */}
                <div className="px-4 py-3 border-b border-border flex items-center gap-3 group" style={{ borderBottomColor: `${board.color}20` }}>
                  <GripVertical size={14} className="text-text-muted opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
                  <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: board.color }} />
                  <span className="text-xl">{board.emoji ?? '📋'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-primary">{board.title}</p>
                    {board.description && <p className="text-xs text-text-muted truncate">{board.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditingBoard(board)} className="btn-ghost p-1.5 text-text-muted hover:text-text-primary"><Pencil size={13} /></button>
                    <button onClick={() => setDeletingId(board.id)} className="btn-ghost p-1.5 text-text-muted hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                </div>

                {/* Board content */}
                {board.boardType === 'progress'
                  ? <InlineProgressBoard board={board} />
                  : <InlineKanbanBoard board={board} />}

                {/* Delete confirm */}
                {deletingId === board.id && (
                  <div className="px-4 py-3 bg-red-500/5 border-t border-red-500/20 flex items-center justify-between">
                    <p className="text-sm text-text-secondary">Delete this board and all its data?</p>
                    <div className="flex gap-2">
                      <button onClick={() => setDeletingId(null)} className="btn-secondary text-xs py-1 px-3">Cancel</button>
                      <button onClick={() => { deleteKanbanBoard(board.id); setDeletingId(null) }} className="btn-danger text-xs py-1 px-3">Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateBoard && <BoardModal onClose={() => setShowCreateBoard(false)} onSaved={() => setShowCreateBoard(false)} />}
      {editingBoard && <BoardModal existing={editingBoard} onClose={() => setEditingBoard(null)} onSaved={() => setEditingBoard(null)} />}
    </div>
  )
}

// ─── Inline Progress Board ────────────────────────────────────────────────────

function InlineProgressBoard({ board }: { board: KanbanBoard }) {
  const { kanbanCards, addKanbanCard, updateKanbanCard, deleteKanbanCard } = useSpace()
  const { members } = useSpace()
  const tasks = kanbanCards.filter(c => c.boardId === board.id).sort((a, b) => a.order - b.order)
  const overall = avgProgress(tasks)
  const memberList = Object.values(members)
  const [showAddModal, setShowAddModal] = useState(false)

  return (
    <div>
      {/* Progress header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center gap-3">
        {tasks.length > 0 && (
          <>
            <ProgressBar value={overall} color={progressColor(overall)} className="h-2 flex-1" />
            <span className="text-xs font-bold shrink-0" style={{ color: progressColor(overall) }}>{overall}%</span>
          </>
        )}
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1.5 text-xs shrink-0 ml-auto">
          <Plus size={13} /> Add task
        </button>
      </div>

      <div className="p-4 space-y-3">
        {tasks.length === 0 ? (
          <p className="text-center text-text-muted text-sm py-8">No tasks yet</p>
        ) : (
          tasks.map(task => (
            <ProgressTaskRow key={task.id} task={task} boardColor={board.color} members={members}
              onUpdate={(data) => updateKanbanCard(task.id, data)}
              onDelete={() => deleteKanbanCard(task.id)} />
          ))
        )}
      </div>

      {showAddModal && (
        <AddProgressTaskModal boardId={board.id} memberList={memberList} existingCount={tasks.length}
          onClose={() => setShowAddModal(false)} onAdd={addKanbanCard} />
      )}
    </div>
  )
}

// ─── Inline Kanban Board ──────────────────────────────────────────────────────

function InlineKanbanBoard({ board }: { board: KanbanBoard }) {
  const { kanbanColumns, kanbanCards, addKanbanColumn, updateKanbanColumn, deleteKanbanColumn,
    addKanbanCard, updateKanbanCard, deleteKanbanCard } = useSpace()

  const cols = kanbanColumns.filter(c => c.boardId === board.id).sort((a, b) => a.order - b.order)
  const boardCards = kanbanCards.filter(c => c.boardId === board.id)
  const overallProgress = avgProgress(boardCards)

  const [showAddCol, setShowAddCol] = useState(false)
  const [newColTitle, setNewColTitle] = useState('')
  const [editingCard, setEditingCard] = useState<KanbanCard | null>(null)
  const [addCardColId, setAddCardColId] = useState<string | null>(null)
  const [dragCardId, setDragCardId] = useState<string | null>(null)
  const [dragOverColId, setDragOverColId] = useState<string | null>(null)
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null)
  const [dragColId, setDragColId] = useState<string | null>(null)
  const [dragOverColIdCol, setDragOverColIdCol] = useState<string | null>(null)

  const handleAddColumn = async () => {
    const title = newColTitle.trim()
    if (!title) return
    const maxOrder = cols.length > 0 ? Math.max(...cols.map(c => c.order)) : -1
    await addKanbanColumn({ boardId: board.id, title, order: maxOrder + 1 })
    setNewColTitle(''); setShowAddCol(false)
  }

  const handleDrop = async (targetColId: string, beforeCardId?: string) => {
    if (!dragCardId) return
    const card = kanbanCards.find(c => c.id === dragCardId)
    if (!card) return
    const targetCards = kanbanCards.filter(c => c.boardId === board.id && c.columnId === targetColId).sort((a, b) => a.order - b.order)
    let newOrder: number
    if (!beforeCardId) {
      newOrder = targetCards.length > 0 ? Math.max(...targetCards.map(c => c.order)) + 1 : 0
    } else {
      const idx = targetCards.findIndex(c => c.id === beforeCardId)
      const prev = targetCards[idx - 1]; const next = targetCards[idx]
      if (prev && next) newOrder = (prev.order + next.order) / 2
      else if (!prev) newOrder = next.order - 1
      else newOrder = prev.order + 1
    }
    await updateKanbanCard(dragCardId, { columnId: targetColId, order: newOrder })
    setDragCardId(null); setDragOverColId(null); setDragOverCardId(null)
  }

  const handleColDrop = async (targetColId: string) => {
    if (!dragColId || dragColId === targetColId) { setDragColId(null); setDragOverColIdCol(null); return }
    const fromIdx = cols.findIndex(c => c.id === dragColId)
    const toIdx = cols.findIndex(c => c.id === targetColId)
    if (fromIdx === -1 || toIdx === -1) return
    const reordered = [...cols]; const [moved] = reordered.splice(fromIdx, 1); reordered.splice(toIdx, 0, moved)
    await Promise.all(reordered.map((c, i) => updateKanbanColumn(c.id, { order: i })))
    setDragColId(null); setDragOverColIdCol(null)
  }

  const liveEditingCard = editingCard ? kanbanCards.find(c => c.id === editingCard.id) ?? editingCard : null

  return (
    <div>
      {/* Overall progress bar */}
      <div className="px-4 py-2 border-b border-border/20 flex items-center gap-3">
        <button
          onClick={() => setShowAddCol(true)}
          className="w-5 h-5 rounded-full flex items-center justify-center text-text-muted hover:text-violet-500 hover:bg-surface-hover transition-colors shrink-0"
          title="Add column">
          <Plus size={13} />
        </button>
        {boardCards.length > 0 ? (
          <>
            <ProgressBar value={overallProgress} color={progressColor(overallProgress)} className="flex-1" />
            <span className="text-xs font-semibold shrink-0" style={{ color: progressColor(overallProgress) }}>{overallProgress}%</span>
          </>
        ) : (
          <div className="flex-1" />
        )}
      </div>

      {/* Columns */}
      <div className="overflow-x-auto">
        <div className="flex justify-center gap-3 p-4 items-start min-w-0" style={{ minWidth: 'fit-content', margin: '0 auto' }}>
          {showAddCol && (
            <div className="w-64 shrink-0">
              <div className="bg-bg-secondary border border-border rounded-xl p-3">
                <input autoFocus type="text" value={newColTitle} onChange={e => setNewColTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddColumn(); if (e.key === 'Escape') setShowAddCol(false) }}
                  className="input text-sm mb-2" placeholder="Column name" />
                <div className="flex gap-2">
                  <button onClick={handleAddColumn} className="btn-primary text-xs py-1.5 px-3">Add</button>
                  <button onClick={() => setShowAddCol(false)} className="btn-ghost text-xs py-1.5 px-3">Cancel</button>
                </div>
              </div>
            </div>
          )}
          {cols.map(col => {
            const cards = kanbanCards.filter(c => c.boardId === board.id && c.columnId === col.id).sort((a, b) => a.order - b.order)
            return (
              <KanbanColumnView key={col.id} col={col} cards={cards} boardColor={board.color}
                dragCardId={dragCardId} dragOverColId={dragOverColId} dragOverCardId={dragOverCardId}
                dragColId={dragColId} dragOverColIdCol={dragOverColIdCol}
                onDragStart={setDragCardId} onDragOverCol={setDragOverColId} onDragOverCard={setDragOverCardId}
                onDrop={handleDrop} onDragEnd={() => { setDragCardId(null); setDragOverColId(null); setDragOverCardId(null) }}
                onColDragStart={() => setDragColId(col.id)} onColDragOver={() => setDragOverColIdCol(col.id)}
                onColDrop={() => handleColDrop(col.id)} onColDragEnd={() => { setDragColId(null); setDragOverColIdCol(null) }}
                onAddCard={() => setAddCardColId(col.id)} onEditCard={setEditingCard}
                onUpdateCol={(data) => updateKanbanColumn(col.id, data)} onDeleteCol={() => deleteKanbanColumn(col.id)} />
            )
          })}
        </div>
      </div>

      {addCardColId && (
        <AddCardModal columnId={addCardColId} boardId={board.id}
          existingCards={kanbanCards.filter(c => c.columnId === addCardColId)}
          onClose={() => setAddCardColId(null)} onAdd={addKanbanCard} />
      )}
      {liveEditingCard && (
        <KanbanCardDetailModal card={liveEditingCard} boardColor={board.color}
          onClose={() => setEditingCard(null)}
          onUpdate={(data) => updateKanbanCard(liveEditingCard.id, data)}
          onDelete={() => { deleteKanbanCard(liveEditingCard.id); setEditingCard(null) }} />
      )}
    </div>
  )
}

// ─── Add Progress Task Modal ──────────────────────────────────────────────────

function AddProgressTaskModal({ boardId, memberList, existingCount, onClose, onAdd }: {
  boardId: string
  memberList: any[]
  existingCount: number
  onClose: () => void
  onAdd: (card: any) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    await onAdd({
      title: title.trim(),
      description: description || undefined,
      assignedTo: assignedTo || undefined,
      columnId: boardId,
      boardId,
      order: existingCount,
      progress: 0,
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-text-primary">New task</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input autoFocus type="text" value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="Task name" required />
          <textarea value={description} onChange={e => setDescription(e.target.value)} className="input resize-none" rows={2} placeholder="Description (optional)" />

          {memberList.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">Executor</label>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => setAssignedTo('')}
                  className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all', !assignedTo ? 'bg-violet-600/20 border-violet-600/40 text-violet-300' : 'border-border text-text-secondary hover:border-violet-600/30')}>
                  Unassigned
                </button>
                {memberList.map(m => (
                  <button key={m.uid} type="button" onClick={() => setAssignedTo(m.uid)}
                    className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all', assignedTo === m.uid ? 'bg-violet-600/20 border-violet-600/40 text-violet-300' : 'border-border text-text-secondary hover:border-violet-600/30')}>
                    <MemberAvatar member={m} size={16} />
                    {m.displayName}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="submit" disabled={loading || !title.trim()} className="btn-primary w-full">
            {loading ? 'Adding...' : 'Add task'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Progress Task Row ────────────────────────────────────────────────────────

function ProgressTaskRow({ task, boardColor, members, onUpdate, onDelete }: {
  task: KanbanCard
  boardColor: string
  members: Record<string, any>
  onUpdate: (data: Partial<KanbanCard>) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const { user } = useAuth()
  const [updatesOpen, setUpdatesOpen] = useState((task.updates ?? []).length > 0)
  const [newUpdate, setNewUpdate] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const accentColor = task.color ?? boardColor
  const progress = task.progress ?? 0
  const executor = task.assignedTo ? members[task.assignedTo] : null
  const creator = members[task.createdBy]
  const updates = task.updates ?? []

  const postUpdate = async () => {
    const text = newUpdate.trim()
    if (!text || !user) return
    const updated: KanbanTaskUpdate[] = [...updates, {
      id: `${Date.now()}`,
      text,
      createdBy: user.uid,
      createdAt: Date.now(),
    }]
    setNewUpdate('')
    await onUpdate({ updates: updated })
  }

  const deleteUpdate = async (id: string) => {
    await onUpdate({ updates: updates.filter(u => u.id !== id) })
  }

  return (
    <div className="card group relative transition-all" style={{ borderLeftColor: accentColor, borderLeftWidth: 3 }}>
      {/* Title row */}
      <div className="flex items-start gap-2 mb-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary flex-1 leading-snug truncate">{task.title}</p>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => setShowEdit(true)} className="btn-ghost p-1 text-text-muted hover:text-text-primary"><Pencil size={12} /></button>
          <button onClick={() => setConfirmDelete(true)} className="btn-ghost p-1 text-text-muted hover:text-red-500"><Trash2 size={12} /></button>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-text-muted mb-3 leading-relaxed">{task.description}</p>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <DragProgressBar value={progress} onChange={(v) => onUpdate({ progress: v })} />
      </div>

      {/* Meta row: creator + executor */}
      <div className="flex items-center gap-3 mb-3 text-xs text-text-muted">
        {creator && (
          <div className="flex items-center gap-1.5">
            <MemberAvatar member={creator} size={16} />
            <span>{creator.displayName}</span>
          </div>
        )}
        {executor ? (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-text-muted">Executor:</span>
            <MemberAvatar member={executor} size={16} />
            <span className="font-medium text-text-secondary">{executor.displayName}</span>
          </div>
        ) : (
          <span className="ml-auto text-text-muted/60 italic">No executor</span>
        )}
      </div>

      {/* Updates section */}
      <div className="border-t border-border/40 pt-2.5">
        <button
          type="button"
          onClick={() => setUpdatesOpen(v => !v)}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors mb-2"
        >
          <ChevronRight size={11} className={clsx('transition-transform', updatesOpen && 'rotate-90')} />
          Updates
          {updates.length > 0 && <span className="ml-1 bg-border rounded-full px-1.5 py-0.5 text-xs">{updates.length}</span>}
        </button>

        {updatesOpen && (
          <div className="space-y-3">
            {/* Posted updates */}
            {updates.map(u => {
              const author = members[u.createdBy]
              const isOwn = u.createdBy === user?.uid
              const elapsed = formatElapsed(u.createdAt)
              return (
                <div key={u.id} className="flex gap-2.5 group/update">
                  {author && <MemberAvatar member={author} size={22} className="shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-text-secondary">{author?.displayName ?? 'Unknown'}</span>
                      <span className="text-xs text-text-muted">{elapsed}</span>
                      {isOwn && (
                        <button onClick={() => deleteUpdate(u.id)}
                          className="opacity-0 group-hover/update:opacity-100 ml-auto text-text-muted hover:text-red-500 transition-all">
                          <X size={11} />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-text-primary leading-relaxed mt-0.5 whitespace-pre-wrap">{u.text}</p>
                  </div>
                </div>
              )
            })}

            {/* Post new update */}
            <div className="flex gap-2 items-end">
              <textarea
                value={newUpdate}
                onChange={e => setNewUpdate(e.target.value)}
                className="input resize-none text-sm flex-1 py-2"
                rows={2}
                placeholder="Post an update..."
              />
              <button
                onClick={postUpdate}
                disabled={!newUpdate.trim()}
                className="btn-primary text-xs px-3 py-2 shrink-0"
              >
                Post
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="absolute inset-0 bg-bg-secondary/95 flex flex-col items-center justify-center gap-3 rounded-xl z-10">
          <p className="text-sm text-text-secondary font-medium">Delete this task?</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="btn-secondary text-xs py-1 px-3">Cancel</button>
            <button onClick={onDelete} className="btn-danger text-xs py-1 px-3">Delete</button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEdit && (
        <ProgressTaskEditModal
          task={task}
          memberList={Object.values(members)}
          onClose={() => setShowEdit(false)}
          onSave={onUpdate}
        />
      )}
    </div>
  )
}

// ─── Progress Task Edit Modal ─────────────────────────────────────────────────

function ProgressTaskEditModal({ task, memberList, onClose, onSave }: {
  task: KanbanCard
  memberList: any[]
  onClose: () => void
  onSave: (data: Partial<KanbanCard>) => Promise<void>
}) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [assignedTo, setAssignedTo] = useState(task.assignedTo ?? '')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    await onSave({ title: title.trim() || task.title, description: description || undefined, assignedTo: assignedTo || undefined })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-text-primary">Edit task</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={15} /></button>
        </div>
        <div className="space-y-4">
          <input autoFocus type="text" value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="Task name" />
          <textarea value={description} onChange={e => setDescription(e.target.value)} className="input resize-none" rows={3} placeholder="Description (optional)" />

          {memberList.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">Executor</label>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => setAssignedTo('')}
                  className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all', !assignedTo ? 'bg-violet-600/20 border-violet-600/40 text-violet-300' : 'border-border text-text-secondary hover:border-violet-600/30')}>
                  Unassigned
                </button>
                {memberList.map(m => (
                  <button key={m.uid} type="button" onClick={() => setAssignedTo(m.uid)}
                    className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all', assignedTo === m.uid ? 'bg-violet-600/20 border-violet-600/40 text-violet-300' : 'border-border text-text-secondary hover:border-violet-600/30')}>
                    <MemberAvatar member={m} size={16} />
                    {m.displayName}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleSave} disabled={loading} className="btn-primary w-full">
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function MemberAvatar({ member, size = 20, className }: { member: any; size?: number; className?: string }) {
  return (
    <div
      className={clsx('rounded-full flex items-center justify-center text-white font-bold overflow-hidden shrink-0', className)}
      style={{ width: size, height: size, fontSize: size * 0.45, backgroundColor: member.color ?? '#7c3aed' }}
    >
      {member.photoURL
        ? <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
        : member.displayName?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

function formatElapsed(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return format(new Date(ts), 'MMM d')
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumnView({ col, cards, boardColor, dragCardId, dragOverColId, dragOverCardId,
  dragColId, dragOverColIdCol,
  onDragStart, onDragOverCol, onDragOverCard, onDrop, onDragEnd,
  onColDragStart, onColDragOver, onColDrop, onColDragEnd,
  onAddCard, onEditCard, onUpdateCol, onDeleteCol }: {
  col: KanbanColumn; cards: KanbanCard[]; boardColor: string
  dragCardId: string | null; dragOverColId: string | null; dragOverCardId: string | null
  dragColId: string | null; dragOverColIdCol: string | null
  onDragStart: (id: string) => void; onDragOverCol: (id: string) => void; onDragOverCard: (id: string | null) => void
  onDrop: (colId: string, beforeCardId?: string) => void; onDragEnd: () => void
  onColDragStart: () => void; onColDragOver: () => void; onColDrop: () => void; onColDragEnd: () => void
  onAddCard: () => void; onEditCard: (card: KanbanCard) => void
  onUpdateCol: (data: any) => void; onDeleteCol: () => void
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal] = useState(col.title)
  const [showMenu, setShowMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isDragOver = dragOverColId === col.id
  const isColDragOver = dragOverColIdCol === col.id && dragColId !== col.id
  const isColDragging = dragColId === col.id
  const colColor = col.color ?? boardColor
  const colProgress = avgProgress(cards)

  const handleTitleSave = () => {
    if (titleVal.trim() && titleVal.trim() !== col.title) onUpdateCol({ title: titleVal.trim() })
    setEditingTitle(false)
  }

  return (
    <div
      className={clsx('relative w-64 shrink-0 flex flex-col rounded-xl border transition-all',
        isColDragging ? 'opacity-40 border-border bg-bg-secondary' :
        isColDragOver ? 'border-violet-500/60 bg-violet-500/8 ring-1 ring-violet-500/30' :
        isDragOver && !dragOverCardId ? 'border-violet-500/50 bg-violet-500/5' : 'border-border bg-bg-secondary')}
      style={{ maxHeight: 'calc(100vh - 140px)' }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); if (dragColId) onColDragOver(); else onDragOverCol(col.id) }}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); if (dragColId) onColDrop(); else onDrop(col.id) }}
    >
      <div
        className="px-3 pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing"
        draggable={!editingTitle}
        onDragStart={e => { e.stopPropagation(); onColDragStart() }}
        onDragEnd={onColDragEnd}
      >
        <div className="flex items-center gap-2 mb-2">
          {col.color && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />}
          {editingTitle ? (
            <input autoFocus value={titleVal} onChange={e => setTitleVal(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false) }}
              className="input text-xs py-0.5 px-1.5 flex-1" />
          ) : (
            <span className="text-sm font-semibold text-text-primary flex-1 truncate cursor-pointer"
              onDoubleClick={() => { setTitleVal(col.title); setEditingTitle(true) }}>{col.title}</span>
          )}
          <span className="text-xs text-text-muted shrink-0">{cards.length}</span>
          <div className="relative shrink-0">
            <button onClick={() => setShowMenu(v => !v)} className="btn-ghost p-1 text-text-muted hover:text-text-primary"><MoreHorizontal size={13} /></button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-7 z-50 bg-bg-secondary border border-border rounded-xl shadow-xl w-40 py-1 overflow-hidden">
                  <button onClick={() => { setShowMenu(false); setTitleVal(col.title); setEditingTitle(true) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-hover">
                    <Pencil size={12} /> Rename
                  </button>
                  <button onClick={() => { setShowMenu(false); setConfirmDelete(true) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10">
                    <Trash2 size={12} /> Delete column
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        {cards.length > 0 && (
          <div className="flex items-center gap-2">
            <ProgressBar value={colProgress} color={progressColor(colProgress)} className="h-1 flex-1" />
            <span className="text-xs text-text-muted shrink-0 w-7 text-right">{colProgress}%</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-0">
        {cards.map(card => (
          <KanbanCardView key={card.id} card={card} boardColor={boardColor}
            isDragging={dragCardId === card.id} isDragOver={!dragColId && dragOverCardId === card.id}
            onDragStart={() => { if (!dragColId) onDragStart(card.id) }} onDragEnd={onDragEnd}
            onDragOver={() => { if (!dragColId) { onDragOverCard(card.id); onDragOverCol(col.id) } }}
            onDrop={() => { if (!dragColId) onDrop(col.id, card.id) }} onClick={() => onEditCard(card)} />
        ))}
        {dragCardId && isDragOver && (
          <div className="h-2 rounded-lg bg-violet-500/30"
            onDragOver={e => { e.preventDefault(); onDragOverCard(null) }}
            onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop(col.id) }} />
        )}
      </div>

      <div className="px-2 pb-2 shrink-0">
        <button onClick={onAddCard}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors">
          <Plus size={13} /> Add card
        </button>
      </div>

      {confirmDelete && (
        <div className="absolute inset-0 bg-bg-secondary/95 flex flex-col items-center justify-center gap-3 rounded-xl z-10">
          <p className="text-sm text-text-secondary font-medium text-center px-4">Delete column and all its cards?</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="btn-secondary text-xs py-1 px-3">Cancel</button>
            <button onClick={onDeleteCol} className="btn-danger text-xs py-1 px-3">Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Kanban Card (in column) ──────────────────────────────────────────────────

function KanbanCardView({ card, boardColor, isDragging, isDragOver, onDragStart, onDragEnd, onDragOver, onDrop, onClick }: {
  card: KanbanCard; boardColor: string; isDragging: boolean; isDragOver: boolean
  onDragStart: () => void; onDragEnd: () => void; onDragOver: () => void; onDrop: () => void; onClick: () => void
}) {
  const { members } = useSpace()
  const progress = getCardProgress(card)
  const isDone = progress === 100
  const duePast = !isDone && (card.dueDate ? isPast(parseISO(card.dueDate)) && !isToday(parseISO(card.dueDate)) : false)
  const dueToday = !isDone && (card.dueDate ? isToday(parseISO(card.dueDate)) : false)
  const assignee = card.assignedTo ? members[card.assignedTo] : null
  const hasChecklist = card.checklist && card.checklist.length > 0
  const checklistDone = hasChecklist ? card.checklist!.filter(i => i.done).length : 0
  const accentColor = card.color ?? boardColor

  return (
    <div
      draggable
      onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragEnd={e => { e.stopPropagation(); onDragEnd() }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); onDragOver() }}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop() }}
      onClick={onClick}
      className={clsx('group rounded-lg border bg-bg-primary px-3 py-2.5 cursor-pointer transition-all select-none overflow-hidden',
        isDragging ? 'opacity-40' : 'hover:border-violet-500/40',
        isDragOver ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border')}
      style={card.color ? { borderLeftColor: card.color, borderLeftWidth: 3 } : {}}
    >
      <div className="flex items-start gap-1 min-w-0">
        {card.emoji && <span className="text-sm shrink-0 mt-0.5">{card.emoji}</span>}
        <p className="text-sm text-text-primary leading-snug flex-1 truncate">{card.title}</p>
      </div>
      {card.description && <p className="text-xs text-text-muted mt-1 line-clamp-2">{card.description}</p>}
      {hasChecklist && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <Check size={11} className={checklistDone === card.checklist!.length ? 'text-emerald-400' : 'text-text-muted'} />
          <span className="text-xs text-text-muted">{checklistDone}/{card.checklist!.length}</span>
        </div>
      )}
      {progress > 0 && <ProgressBar value={progress} color={progressColor(progress)} className="mt-2 h-1" />}
      {(card.dueDate || assignee) && (
        <div className="flex items-center gap-2 mt-2">
          {card.dueDate && (
            <span className={clsx('flex items-center gap-1 text-xs rounded px-1.5 py-0.5',
              duePast ? 'bg-red-500/15 text-red-400' : dueToday ? 'bg-amber-500/15 text-amber-400' : 'bg-surface-hover text-text-muted')}>
              <Calendar size={10} />{format(parseISO(card.dueDate), 'MMM d')}
            </span>
          )}
          {assignee && (
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden ml-auto"
              style={{ backgroundColor: assignee.color ?? '#7c3aed' }} title={assignee.displayName}>
              {assignee.photoURL ? <img src={assignee.photoURL} alt="" className="w-full h-full object-cover" /> : assignee.displayName?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Add Card Modal ───────────────────────────────────────────────────────────

function AddCardModal({ columnId, boardId, existingCards, onClose, onAdd }: {
  columnId: string; boardId: string; existingCards: KanbanCard[]
  onClose: () => void; onAdd: (card: any) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    const maxOrder = existingCards.length > 0 ? Math.max(...existingCards.map(c => c.order)) : -1
    await onAdd({ title: title.trim(), columnId, boardId, order: maxOrder + 1 })
    onClose()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-text-primary">Add card</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input autoFocus type="text" value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="Card title" />
          <button type="submit" className="btn-primary w-full" disabled={loading || !title.trim()}>{loading ? 'Adding...' : 'Add card'}</button>
        </form>
      </div>
    </div>
  )
}

// ─── Kanban Card Detail Modal ─────────────────────────────────────────────────

function KanbanCardDetailModal({ card, boardColor, onClose, onUpdate, onDelete }: {
  card: KanbanCard; boardColor: string
  onClose: () => void; onUpdate: (data: Partial<KanbanCard>) => Promise<void>; onDelete: () => void
}) {
  const { members } = useSpace()
  const [editing, setEditing] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  // Edit form state
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description ?? '')
  const [notes, setNotes] = useState(card.notes ?? '')
  const [dueDate, setDueDate] = useState(card.dueDate ?? '')
  const [assignedTo, setAssignedTo] = useState(card.assignedTo ?? '')
  const [color, setColor] = useState(card.color ?? '')
  const [emoji, setEmoji] = useState(card.emoji ?? '')
  const [checklist, setChecklist] = useState<KanbanChecklist[]>(card.checklist ?? [])
  const [newCheckItem, setNewCheckItem] = useState('')
  const [loading, setLoading] = useState(false)
  const [showColor, setShowColor] = useState(false)
  const [showChecklist, setShowChecklist] = useState((card.checklist ?? []).length > 0)

  const memberList = Object.values(members)
  const hasChecklist = checklist.length > 0
  const accentColor = card.color || boardColor
  const assignee = card.assignedTo ? members[card.assignedTo] : null
  const cardProgress = getCardProgress(card)

  const toggleItem = (id: string) => {
    const updated = checklist.map(i => i.id === id ? { ...i, done: !i.done } : i)
    setChecklist(updated)
    onUpdate({ checklist: updated })
  }
  const addCheckItem = () => {
    const text = newCheckItem.trim()
    if (!text) return
    const updated = [...checklist, { id: `${Date.now()}`, text, done: false }]
    setChecklist(updated); setNewCheckItem('')
    onUpdate({ checklist: updated })
  }
  const removeCheckItem = (id: string) => {
    const updated = checklist.filter(i => i.id !== id)
    setChecklist(updated)
    onUpdate({ checklist: updated })
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await onUpdate({
        title: title.trim() || card.title,
        description: description || undefined,
        notes: notes || undefined,
        dueDate: dueDate || undefined,
        assignedTo: assignedTo || undefined,
        color: color || undefined,
        emoji: emoji || undefined,
        checklist: checklist.length > 0 ? checklist : undefined,
      })
      setEditing(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {showDelete ? (
          <div className="text-center py-4">
            <p className="text-sm text-text-secondary mb-4">Delete this card?</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setShowDelete(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={onDelete} className="btn-danger text-sm">Delete</button>
            </div>
          </div>
        ) : !editing ? (
          /* ── VIEW MODE ── */
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {card.emoji && <span className="text-xl shrink-0">{card.emoji}</span>}
                <h3 className="text-lg font-semibold text-text-primary leading-tight break-words">{card.title}</h3>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button onClick={() => setEditing(true)} className="btn-ghost p-1.5 text-text-muted hover:text-text-primary"><Pencil size={14} /></button>
                <button onClick={() => setShowDelete(true)} className="btn-ghost p-1.5 text-text-muted hover:text-red-500"><Trash2 size={14} /></button>
                <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
              </div>
            </div>

            {card.color && (
              <div className="w-full h-1 rounded-full mb-4" style={{ backgroundColor: card.color }} />
            )}

            {card.description && (
              <p className="text-sm text-text-secondary mb-4 leading-relaxed">{card.description}</p>
            )}

            {/* Checklist (interactive even in view mode) */}
            {card.checklist && card.checklist.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-text-secondary">Checklist</span>
                  <span className="text-xs text-text-muted">{card.checklist.filter(i=>i.done).length}/{card.checklist.length}</span>
                </div>
                <ProgressBar value={cardProgress} color={progressColor(cardProgress)} className="h-1.5 mb-2" />
                <div className="space-y-1.5">
                  {checklist.map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleItem(item.id)}
                        className={clsx('w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all',
                          item.done ? 'bg-emerald-500 border-emerald-500' : 'border-border hover:border-violet-500')}>
                        {item.done && <Check size={10} className="text-white" />}
                      </button>
                      <span className={clsx('text-sm flex-1', item.done && 'line-through text-text-muted')}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 text-xs text-text-muted">
              {card.dueDate && (
                <span className={clsx('flex items-center gap-1 rounded px-2 py-1',
                  cardProgress === 100 ? 'bg-surface-hover'
                  : isPast(parseISO(card.dueDate)) && !isToday(parseISO(card.dueDate)) ? 'bg-red-500/15 text-red-400'
                  : isToday(parseISO(card.dueDate)) ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-surface-hover')}>
                  <Calendar size={11} /> {format(parseISO(card.dueDate), 'MMM d, yyyy')}
                </span>
              )}
              {assignee && (
                <div className="flex items-center gap-1.5 bg-surface-hover rounded px-2 py-1">
                  <MemberAvatar member={assignee} size={16} />
                  <span>{assignee.displayName}</span>
                </div>
              )}
            </div>

            {card.notes && (
              <div className="mt-4 p-3 bg-surface-hover rounded-lg">
                <p className="text-xs font-medium text-text-muted mb-1">Notes</p>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">{card.notes}</p>
              </div>
            )}
          </div>
        ) : (
          /* ── EDIT MODE ── */
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-text-primary">Edit card</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => setEditing(false)} className="btn-ghost p-1.5 text-text-muted hover:text-text-primary"><ChevronLeft size={15} /></button>
                <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <input type="text" value={emoji} onChange={e => setEmoji(e.target.value)} className="input w-12 text-center text-xl px-1" placeholder="—" maxLength={2} />
                <input autoFocus type="text" value={title} onChange={e => setTitle(e.target.value)} className="input flex-1" placeholder="Card title" />
              </div>

              <div>
                <button type="button" onClick={() => setShowChecklist(v => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors mb-2">
                  Checklist
                  {hasChecklist && <span className="ml-1 text-text-muted">({checklist.filter(i => i.done).length}/{checklist.length})</span>}
                  <ChevronRight size={12} className={clsx('transition-transform', showChecklist && 'rotate-90')} />
                </button>
                {showChecklist && (
                  <div className="space-y-1.5">
                    {checklist.map(item => (
                      <div key={item.id} className="flex items-center gap-2 group/item">
                        <button type="button" onClick={() => toggleItem(item.id)}
                          className={clsx('w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all',
                            item.done ? 'bg-emerald-500 border-emerald-500' : 'border-border hover:border-violet-500')}>
                          {item.done && <Check size={10} className="text-white" />}
                        </button>
                        <span className={clsx('text-sm flex-1', item.done && 'line-through text-text-muted')}>{item.text}</span>
                        <button type="button" onClick={() => removeCheckItem(item.id)}
                          className="opacity-0 group-hover/item:opacity-100 btn-ghost p-0.5 text-text-muted hover:text-red-500"><X size={12} /></button>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <input type="text" value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem() } }}
                        className="input text-sm flex-1 py-1.5" placeholder="Add a task..." />
                      <button type="button" onClick={addCheckItem} className="btn-secondary text-xs px-3">Add</button>
                    </div>
                  </div>
                )}
                {!showChecklist && (
                  <button type="button" onClick={() => setShowChecklist(true)}
                    className="text-xs text-text-muted hover:text-text-secondary flex items-center gap-1">
                    <Plus size={11} /> Add checklist
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="input resize-none" rows={2} placeholder="Short description..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input resize-none" rows={3} placeholder="Notes, links, context..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Due date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input" />
              </div>
              {memberList.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Assign to</label>
                  <div className="flex gap-2 flex-wrap">
                    <button type="button" onClick={() => setAssignedTo('')}
                      className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all', !assignedTo ? 'bg-violet-600/20 border-violet-600/40 text-violet-300' : 'border-border text-text-secondary hover:border-violet-600/30')}>No one</button>
                    {memberList.map(m => (
                      <button key={m.uid} type="button" onClick={() => setAssignedTo(m.uid)}
                        className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all', assignedTo === m.uid ? 'bg-violet-600/20 border-violet-600/40 text-violet-300' : 'border-border text-text-secondary hover:border-violet-600/30')}>
                        <MemberAvatar member={m} size={16} />
                        {m.displayName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <button type="button" onClick={() => setShowColor(v => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors mb-2">
                  Card color
                  {color && <span className="w-3 h-3 rounded-full ml-1 shrink-0" style={{ backgroundColor: color }} />}
                  <ChevronRight size={12} className={clsx('transition-transform', showColor && 'rotate-90')} />
                </button>
                {showColor && <ColorPresetPicker color={color || '#7c3aed'} onChange={setColor} />}
              </div>
              <button onClick={handleSave} disabled={loading} className="btn-primary w-full">{loading ? 'Saving...' : 'Save changes'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Board Modal ──────────────────────────────────────────────────────────────

function BoardModal({ existing, onClose, onSaved }: {
  existing?: KanbanBoard | null
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const { addKanbanBoard, updateKanbanBoard } = useSpace()
  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [emoji, setEmoji] = useState(existing?.emoji ?? '')
  const [color, setColor] = useState(existing?.color ?? '#7c3aed')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [boardType, setBoardType] = useState<'kanban' | 'progress'>(existing?.boardType ?? 'kanban')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    if (existing) {
      await updateKanbanBoard(existing.id, { title: title.trim(), description, emoji, color, boardType })
      onSaved(existing.id)
    } else {
      const id = await addKanbanBoard({ title: title.trim(), description, emoji, color, boardType })
      onSaved(id)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-text-primary">{existing ? 'Edit board' : 'New board'}</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Board type — only shown when creating */}
          {!existing && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">Board type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBoardType('kanban')}
                  className={clsx('flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                    boardType === 'kanban' ? 'bg-violet-600/15 border-violet-600/50 text-violet-300' : 'border-border text-text-secondary hover:border-violet-600/30')}
                >
                  <Kanban size={22} />
                  <div className="text-center">
                    <p className="text-xs font-semibold">Kanban</p>
                    <p className="text-xs text-text-muted mt-0.5 leading-tight">Columns &amp; cards, drag to reorder</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setBoardType('progress')}
                  className={clsx('flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                    boardType === 'progress' ? 'bg-violet-600/15 border-violet-600/50 text-violet-300' : 'border-border text-text-secondary hover:border-violet-600/30')}
                >
                  <BarChart3 size={22} />
                  <div className="text-center">
                    <p className="text-xs font-semibold">Progress</p>
                    <p className="text-xs text-text-muted mt-0.5 leading-tight">Tasks with draggable progress bars</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <select value={emoji} onChange={e => setEmoji(e.target.value)} className="input w-16 text-center text-xl px-1">
              <option value="">—</option>
              {BOARD_EMOJIS.map(em => <option key={em} value={em}>{em}</option>)}
            </select>
            <input autoFocus type="text" value={title} onChange={e => setTitle(e.target.value)} className="input flex-1" placeholder="Board name" required />
          </div>

          <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="input" placeholder="Description (optional)" />

          <div>
            <button type="button" onClick={() => setShowColorPicker(v => !v)}
              className="flex items-center gap-1 text-xs font-medium text-text-secondary mb-2 hover:text-text-primary transition-colors">
              Color
              <ChevronRight size={12} className={clsx('transition-transform', showColorPicker && 'rotate-90')} />
            </button>
            {showColorPicker && <ColorPresetPicker color={color} onChange={setColor} />}
          </div>

          <button type="submit" disabled={loading || !title.trim()} className="btn-primary w-full">
            {loading ? 'Saving...' : existing ? 'Save changes' : 'Create board'}
          </button>
        </form>
      </div>
    </div>
  )
}

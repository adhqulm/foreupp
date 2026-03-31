import { useRef, useState, useEffect, useCallback } from 'react'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '../lib/firebase'
import { useSpace } from '../context/SpaceContext'
import { useAuth } from '../context/AuthContext'
import {
  Send, Paperclip, X, Check, CheckCheck, Smile, Trash2, Image, Users, SquarePen,
  Bell, BellOff, LogOut, UserPlus, MoreHorizontal, ChevronLeft, Link, FileText, Camera
} from 'lucide-react'
import type { Message, MessageAttachment, Conversation } from '../types'
import clsx from 'clsx'

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏']

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatConvTime(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (msgDay.getTime() === today.getTime()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatDateLabel(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (msgDay.getTime() === today.getTime()) return 'Today'
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatLastSeen(lastSeen?: number): string {
  if (!lastSeen) return 'last seen a while ago'
  const now = Date.now()
  const diff = now - lastSeen
  if (diff < 5 * 60 * 1000) return 'Online'
  const d = new Date(lastSeen)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today.getTime() - 86400000)
  const msgDay = new Date(d); msgDay.setHours(0, 0, 0, 0)
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  if (msgDay.getTime() === today.getTime()) return `last seen today at ${timeStr}`
  if (msgDay.getTime() === yesterday.getTime()) return `last seen yesterday at ${timeStr}`
  const daysDiff = Math.floor((today.getTime() - msgDay.getTime()) / 86400000)
  if (daysDiff < 7) {
    const dayName = d.toLocaleDateString([], { weekday: 'long' })
    return `last seen on ${dayName} at ${timeStr}`
  }
  return `last seen on ${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
}

function isSameDay(a: number, b: number): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatMonthLabel(ts: number): string {
  return new Date(ts).toLocaleDateString([], { month: 'long', year: 'numeric' })
}

interface PendingFile {
  file: File
  previewUrl: string | null
  type: 'image' | 'file'
}

interface ReactionPickerProps {
  messageId: string
  onReact: (id: string, emoji: string) => void
  onClose: () => void
}

function ReactionPicker({ messageId, onReact, onClose }: ReactionPickerProps) {
  return (
    <div
      className="absolute z-20 bottom-full mb-1 left-0 flex gap-1 bg-bg-secondary border border-border rounded-xl px-2 py-1.5 shadow-lg"
      onMouseLeave={onClose}
    >
      {REACTION_EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => { onReact(messageId, emoji); onClose() }}
          className="text-base hover:scale-125 transition-transform"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

interface MessageBubbleProps {
  msg: Message
  isOwn: boolean
  senderColor: string
  senderInitial: string
  showAvatar: boolean
  partnerUid: string | null
  currentUid: string
  onDelete: (id: string) => void
  onReact: (id: string, emoji: string) => void
}

function MessageBubble({ msg, isOwn, senderColor, senderInitial, showAvatar, partnerUid, currentUid, onDelete, onReact }: MessageBubbleProps) {
  const [hovering, setHovering] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const reactionMap: Record<string, string[]> = {}
  Object.entries(msg.reactions ?? {}).forEach(([uid, emoji]) => {
    if (!reactionMap[emoji]) reactionMap[emoji] = []
    reactionMap[emoji].push(uid)
  })

  const isRead = partnerUid ? msg.readBy.includes(partnerUid) : false

  return (
    <div className={clsx('flex items-end gap-2 group', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar placeholder slot — always take up space to align bubbles */}
      <div className="w-7 shrink-0">
        {!isOwn && showAvatar && (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: senderColor }}
          >
            {senderInitial}
          </div>
        )}
      </div>

      <div className={clsx('flex flex-col max-w-[68%]', isOwn ? 'items-end' : 'items-start')}>
        <div
          className="relative"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => { setHovering(false); setPickerOpen(false) }}
        >
          {/* Reaction picker */}
          {(hovering || pickerOpen) && (
            <ReactionPicker
              messageId={msg.id}
              onReact={onReact}
              onClose={() => setPickerOpen(false)}
            />
          )}

          {/* Delete button — own messages only */}
          {isOwn && hovering && (
            <button
              onClick={() => onDelete(msg.id)}
              className="absolute top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-red-400 transition-colors"
              style={{ left: '-3.5rem' }}
            >
              <Trash2 size={13} />
            </button>
          )}

          {/* Reaction picker trigger */}
          {hovering && (
            <button
              onClick={() => setPickerOpen(v => !v)}
              className={clsx(
                'absolute top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-text-primary transition-colors',
                isOwn ? '-left-7' : '-right-7'
              )}
            >
              <Smile size={13} />
            </button>
          )}

          {/* Bubble */}
          <div
            className={clsx(
              'px-3 py-2 rounded-2xl text-sm leading-relaxed',
              isOwn
                ? 'bg-violet-600 text-white rounded-br-sm'
                : 'bg-bg-secondary border border-border text-text-primary rounded-bl-sm'
            )}
          >
            {/* Attachments */}
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="mb-1 space-y-1">
                {msg.attachments.map((att, i) => (
                  att.type === 'image' ? (
                    <img
                      key={i}
                      src={att.url}
                      alt={att.name}
                      className="max-w-[220px] rounded-xl cursor-pointer object-cover"
                      onClick={() => window.open(att.url, '_blank')}
                    />
                  ) : (
                    <a
                      key={i}
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className={clsx(
                        'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors',
                        isOwn
                          ? 'bg-white/10 hover:bg-white/20 text-white'
                          : 'bg-surface-hover hover:bg-surface-hover/80 text-text-primary'
                      )}
                    >
                      <Paperclip size={12} className="shrink-0" />
                      <span className="truncate max-w-[150px]">{att.name}</span>
                      {att.size && (
                        <span className={clsx('shrink-0', isOwn ? 'text-white/60' : 'text-text-muted')}>
                          {formatFileSize(att.size)}
                        </span>
                      )}
                    </a>
                  )
                ))}
              </div>
            )}

            {msg.text && <span>{msg.text}</span>}
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(reactionMap).length > 0 && (
          <div className={clsx('flex flex-wrap gap-1 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
            {Object.entries(reactionMap).map(([emoji, uids]) => {
              const isMine = uids.includes(currentUid)
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(msg.id, emoji)}
                  className={clsx(
                    'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors',
                    isMine
                      ? 'bg-violet-600/20 border-violet-600/40 text-text-primary'
                      : 'bg-bg-secondary border-border text-text-secondary hover:border-violet-600/30'
                  )}
                >
                  <span>{emoji}</span>
                  {uids.length > 1 && <span className="text-text-muted">{uids.length}</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* Timestamp + read receipt */}
        <div className={clsx('flex items-center gap-1 mt-0.5', isOwn ? 'flex-row-reverse' : 'flex-row')}>
          <span className="text-xs text-text-muted">{formatTime(msg.createdAt)}</span>
          {isOwn && (
            isRead
              ? <CheckCheck size={12} className="text-violet-400" />
              : <Check size={12} className="text-text-muted" />
          )}
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-7 shrink-0" />
      <div className="bg-bg-secondary border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

// ─── New Group Modal ──────────────────────────────────────────────────────────

interface NewGroupModalProps {
  members: Record<string, { uid: string; displayName: string; color: string }>
  currentUid: string
  onClose: () => void
  onCreate: (name: string, memberIds: string[]) => Promise<void>
}

function NewGroupModal({ members, currentUid, onClose, onCreate }: NewGroupModalProps) {
  const [groupName, setGroupName] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const otherMembers = Object.values(members).filter(m => m.uid !== currentUid)

  const toggleMember = (uid: string) => {
    setSelectedIds(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    )
  }

  const handleCreate = async () => {
    if (!groupName.trim() || selectedIds.length === 0) return
    setCreating(true)
    try {
      await onCreate(groupName.trim(), selectedIds)
      onClose()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-bg-secondary border border-border rounded-2xl p-5 w-80 shadow-2xl flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">New Group Chat</p>
          <button onClick={onClose} className="p-1 rounded text-text-muted hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Group name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-text-muted">Group name</label>
          <input
            type="text"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="e.g. Weekend plans"
            className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-600/50 transition-colors"
          />
        </div>

        {/* Member checkboxes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-text-muted">Members</label>
          {otherMembers.length === 0 ? (
            <p className="text-xs text-text-muted italic">No other members in this space yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {otherMembers.map(m => (
                <label
                  key={m.uid}
                  className={clsx(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                    selectedIds.includes(m.uid)
                      ? 'bg-violet-600/15 border border-violet-600/30'
                      : 'bg-bg-primary border border-border hover:border-violet-600/20'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.uid)}
                    onChange={() => toggleMember(m.uid)}
                    className="accent-violet-600 w-3.5 h-3.5"
                  />
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: m.color }}
                  >
                    {(m.displayName?.[0] ?? '?').toUpperCase()}
                  </div>
                  <span className="text-sm text-text-primary">{m.displayName}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={!groupName.trim() || selectedIds.length === 0 || creating}
          className={clsx(
            'w-full py-2 rounded-xl text-sm font-medium transition-all',
            groupName.trim() && selectedIds.length > 0 && !creating
              ? 'bg-violet-600 text-white hover:bg-violet-700'
              : 'bg-surface-hover text-text-muted cursor-not-allowed'
          )}
        >
          {creating ? 'Creating...' : 'Create group'}
        </button>
      </div>
    </div>
  )
}

// ─── Conversation list item ───────────────────────────────────────────────────

interface ConvItemProps {
  conv: Conversation
  isActive: boolean
  members: Record<string, { uid: string; displayName: string; color: string; photoURL?: string }>
  currentUid: string
  onClick: () => void
}

function ConvItem({ conv, isActive, members, currentUid, onClick }: ConvItemProps) {
  if (conv.type === 'dm') {
    const partnerUid = conv.memberIds.find(id => id !== currentUid)
    const partnerProfile = partnerUid ? members[partnerUid] : null
    const color = partnerProfile?.color ?? '#7c3aed'
    const initial = (partnerProfile?.displayName?.[0] ?? '?').toUpperCase()
    const name = partnerProfile?.displayName ?? 'Unknown'

    return (
      <button
        onClick={onClick}
        className={clsx(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
          isActive
            ? 'bg-violet-600/15 border border-violet-600/25'
            : 'hover:bg-surface-hover border border-transparent'
        )}
      >
        {/* Avatar */}
        <div className="shrink-0 relative">
          {partnerProfile && (partnerProfile as { photoURL?: string }).photoURL ? (
            <img
              src={(partnerProfile as { photoURL?: string }).photoURL}
              alt=""
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {initial}
            </div>
          )}
        </div>
        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-1">
            <span className="text-sm font-medium text-text-primary truncate">{name}</span>
            <span className="text-xs text-text-muted shrink-0">{formatConvTime(conv.lastMessageAt)}</span>
          </div>
          <p className="text-xs text-text-muted truncate">{conv.lastMessageText || 'No messages yet'}</p>
        </div>
      </button>
    )
  }

  // Group
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
        isActive
          ? 'bg-violet-600/15 border border-violet-600/25'
          : 'hover:bg-surface-hover border border-transparent'
      )}
    >
      {/* Group icon or photo */}
      {conv.photoURL ? (
        <img src={conv.photoURL} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-violet-600/20 border border-violet-600/30 flex items-center justify-center shrink-0">
          <Users size={16} className="text-violet-400" />
        </div>
      )}
      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <span className="text-sm font-medium text-text-primary truncate">{conv.name ?? 'Group'}</span>
          <span className="text-xs text-text-muted shrink-0">{formatConvTime(conv.lastMessageAt)}</span>
        </div>
        <p className="text-xs text-text-muted truncate">{conv.lastMessageText || 'No messages yet'}</p>
      </div>
    </button>
  )
}

// ─── Group Info Panel ─────────────────────────────────────────────────────────

function getFileExtColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'bg-orange-500'
  if (ext === 'doc' || ext === 'docx') return 'bg-blue-500'
  if (ext === 'xls' || ext === 'xlsx') return 'bg-green-600'
  if (ext === 'zip' || ext === 'rar' || ext === '7z') return 'bg-yellow-500'
  return 'bg-text-muted'
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/g
  return text.match(urlRegex) ?? []
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

interface GroupInfoPanelProps {
  conv: Conversation
  members: Record<string, any>
  currentUid: string
  messages: Message[]
  muted: boolean
  onClose: () => void
  onMuteToggle: () => void
  onLeave: () => void
  onUpdateConversation: (id: string, data: Partial<Conversation>) => Promise<void>
  spaceId: string | null
}

function GroupInfoPanel({
  conv,
  members,
  currentUid,
  messages,
  muted,
  onClose,
  onMuteToggle,
  onLeave,
  onUpdateConversation,
  spaceId,
}: GroupInfoPanelProps) {
  const [expandedSection, setExpandedSection] = useState<'photos' | 'files' | 'links' | null>(null)
  const [uploadingGroupPhoto, setUploadingGroupPhoto] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(conv.name ?? '')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const groupPhotoInputRef = useRef<HTMLInputElement>(null)

  // Collect media from messages
  const imageAttachments = messages.flatMap(m =>
    (m.attachments ?? []).filter(a => a.type === 'image').map(a => ({ att: a, msg: m }))
  )
  const fileAttachments = messages.flatMap(m =>
    (m.attachments ?? []).filter(a => a.type === 'file').map(a => ({ att: a, msg: m }))
  )
  const linkMessages = messages.flatMap(m => {
    const urls = extractUrls(m.text)
    return urls.map(url => ({ url, msg: m }))
  })

  // Group items by month
  function groupByMonth<T extends { msg: Message }>(items: T[]): { month: string; items: T[] }[] {
    const map: Record<string, T[]> = {}
    for (const item of items) {
      const key = formatMonthLabel(item.msg.createdAt)
      if (!map[key]) map[key] = []
      map[key].push(item)
    }
    return Object.entries(map).map(([month, items]) => ({ month, items }))
  }

  const photoGroups = groupByMonth(imageAttachments)
  const fileGroups = groupByMonth(fileAttachments)
  const linkGroups = groupByMonth(linkMessages)

  const handleGroupPhotoUpload = async (file: File) => {
    if (!spaceId) return
    setUploadingGroupPhoto(true)
    try {
      const path = `spaces/${spaceId}/groups/${conv.id}_photo`
      const sRef = storageRef(storage, path)
      await new Promise<void>((resolve, reject) => {
        const task = uploadBytesResumable(sRef, file)
        task.on('state_changed', null, reject, resolve)
      })
      const url = await getDownloadURL(sRef)
      await onUpdateConversation(conv.id, { photoURL: url })
    } finally {
      setUploadingGroupPhoto(false)
    }
  }

  const handleNameSave = async () => {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== conv.name) {
      await onUpdateConversation(conv.id, { name: trimmed })
    }
    setEditingName(false)
  }

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-bg-secondary border-l border-border z-10 flex flex-col shadow-xl">
      {/* Hidden file input for group photo */}
      <input
        ref={groupPhotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleGroupPhotoUpload(file)
          e.target.value = ''
        }}
      />

      {/* Header row */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-text-primary flex-1">Group Info</span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* Avatar + name section */}
        <div className="flex flex-col items-center gap-3 pt-6 pb-5 px-4">
          {/* Group avatar with upload overlay */}
          <div className="relative group/avatar">
            <button
              onClick={() => groupPhotoInputRef.current?.click()}
              className="relative w-16 h-16 rounded-full overflow-hidden focus:outline-none"
            >
              {uploadingGroupPhoto ? (
                <div className="w-16 h-16 rounded-full bg-violet-600/20 border border-violet-600/30 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : conv.photoURL ? (
                <img src={conv.photoURL} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-violet-600/20 border border-violet-600/30 flex items-center justify-center">
                  <Users size={28} className="text-violet-400" />
                </div>
              )}
              {/* Camera overlay on hover */}
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                <Camera size={18} className="text-white" />
              </div>
            </button>

            {/* Remove photo button */}
            {conv.photoURL && !uploadingGroupPhoto && (
              <button
                onClick={e => { e.stopPropagation(); onUpdateConversation(conv.id, { photoURL: '' }) }}
                className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-bg-primary border border-border flex items-center justify-center text-text-muted hover:text-red-400 transition-colors"
                title="Remove photo"
              >
                <X size={10} />
              </button>
            )}
          </div>

          {/* Group name — editable */}
          {editingName ? (
            <div className="flex items-center gap-2 w-full max-w-[200px]">
              <input
                autoFocus
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleNameSave()
                  if (e.key === 'Escape') { setNameValue(conv.name ?? ''); setEditingName(false) }
                }}
                className="flex-1 bg-bg-primary border border-violet-600/50 rounded-lg px-2 py-1 text-sm text-text-primary focus:outline-none text-center"
              />
              <button onClick={handleNameSave} className="p-1 rounded text-violet-400 hover:text-violet-300 transition-colors">
                <Check size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex items-center gap-1.5 group/name"
              title="Edit group name"
            >
              <span className="text-base font-semibold text-text-primary">{conv.name ?? 'Group'}</span>
              <SquarePen size={13} className="text-text-muted opacity-0 group-hover/name:opacity-100 transition-opacity" />
            </button>
          )}

          <span className="text-xs text-text-muted">{conv.memberIds.length} members</span>
        </div>

        {/* Action buttons row */}
        <div className="flex items-start justify-center gap-2 px-4 pb-5">
          {/* Mute */}
          <button
            onClick={onMuteToggle}
            className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl bg-bg-primary border border-border hover:border-violet-600/30 hover:bg-surface-hover transition-colors min-w-[58px]"
          >
            {muted
              ? <BellOff size={18} className="text-violet-400" />
              : <Bell size={18} className="text-text-secondary" />
            }
            <span className="text-[10px] text-text-muted">{muted ? 'Unmute' : 'Mute'}</span>
          </button>

          {/* Add members (disabled visual) */}
          <button
            disabled
            className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl bg-bg-primary border border-border opacity-40 cursor-not-allowed min-w-[58px]"
            title="Coming soon"
          >
            <UserPlus size={18} className="text-text-secondary" />
            <span className="text-[10px] text-text-muted">Add</span>
          </button>

          {/* Leave */}
          <button
            onClick={onLeave}
            className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl bg-bg-primary border border-border hover:border-red-500/30 hover:bg-red-500/5 transition-colors min-w-[58px]"
          >
            <LogOut size={18} className="text-red-400" />
            <span className="text-[10px] text-red-400">Leave</span>
          </button>

          {/* More */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(v => !v)}
              className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl bg-bg-primary border border-border hover:border-violet-600/30 hover:bg-surface-hover transition-colors min-w-[58px]"
            >
              <MoreHorizontal size={18} className="text-text-secondary" />
              <span className="text-[10px] text-text-muted">More</span>
            </button>
            {showMoreMenu && (
              <div
                className="absolute right-0 top-full mt-1 w-44 bg-bg-secondary border border-border rounded-xl shadow-xl z-20 py-1 overflow-hidden"
                onMouseLeave={() => setShowMoreMenu(false)}
              >
                <button
                  onClick={() => setShowMoreMenu(false)}
                  className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover transition-colors"
                >
                  Add members
                </button>
                <button
                  onClick={() => setShowMoreMenu(false)}
                  className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover transition-colors"
                >
                  Export chat history
                </button>
                <button
                  onClick={() => setShowMoreMenu(false)}
                  className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-surface-hover transition-colors"
                >
                  Report
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border mx-0 mb-1" />

        {/* Media / Files / Links */}
        <div className="px-4 py-3 flex flex-col gap-1">

          {/* Photos */}
          <div>
            <button
              onClick={() => setExpandedSection(prev => prev === 'photos' ? null : 'photos')}
              className="w-full flex items-center justify-between py-2.5 text-left hover:bg-surface-hover rounded-lg px-2 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-600/15 flex items-center justify-center">
                  <Image size={15} className="text-violet-400" />
                </div>
                <span className="text-sm text-text-primary">Photos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted bg-bg-primary border border-border px-2 py-0.5 rounded-full">
                  {imageAttachments.length}
                </span>
                <ChevronLeft size={14} className={clsx('text-text-muted transition-transform', expandedSection === 'photos' ? '-rotate-90' : 'rotate-180')} />
              </div>
            </button>
            {expandedSection === 'photos' && (
              <div className="mt-1 mb-2 px-2">
                {imageAttachments.length === 0 ? (
                  <p className="text-xs text-text-muted py-2 text-center">No photos shared yet</p>
                ) : (
                  photoGroups.map(({ month, items }) => (
                    <div key={month} className="mb-3">
                      <p className="text-xs text-text-muted mb-2 font-medium">{month}</p>
                      <div className="grid grid-cols-3 gap-1">
                        {items.map(({ att }, idx) => (
                          <img
                            key={idx}
                            src={att.url}
                            alt={att.name}
                            className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => window.open(att.url, '_blank')}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Files */}
          <div>
            <button
              onClick={() => setExpandedSection(prev => prev === 'files' ? null : 'files')}
              className="w-full flex items-center justify-between py-2.5 text-left hover:bg-surface-hover rounded-lg px-2 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-600/15 flex items-center justify-center">
                  <FileText size={15} className="text-violet-400" />
                </div>
                <span className="text-sm text-text-primary">Files</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted bg-bg-primary border border-border px-2 py-0.5 rounded-full">
                  {fileAttachments.length}
                </span>
                <ChevronLeft size={14} className={clsx('text-text-muted transition-transform', expandedSection === 'files' ? '-rotate-90' : 'rotate-180')} />
              </div>
            </button>
            {expandedSection === 'files' && (
              <div className="mt-1 mb-2 px-2">
                {fileAttachments.length === 0 ? (
                  <p className="text-xs text-text-muted py-2 text-center">No files shared yet</p>
                ) : (
                  fileGroups.map(({ month, items }) => (
                    <div key={month} className="mb-3">
                      <p className="text-xs text-text-muted mb-2 font-medium">{month}</p>
                      <div className="flex flex-col gap-1">
                        {items.map(({ att, msg }, idx) => (
                          <a
                            key={idx}
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors"
                          >
                            <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-[10px] font-bold', getFileExtColor(att.name))}>
                              {(att.name.split('.').pop() ?? 'file').toUpperCase().slice(0, 4)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-text-primary truncate">{att.name}</p>
                              <p className="text-[10px] text-text-muted">
                                {att.size ? formatFileSize(att.size) : ''}{att.size ? ' · ' : ''}{formatConvTime(msg.createdAt)}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Links */}
          <div>
            <button
              onClick={() => setExpandedSection(prev => prev === 'links' ? null : 'links')}
              className="w-full flex items-center justify-between py-2.5 text-left hover:bg-surface-hover rounded-lg px-2 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-600/15 flex items-center justify-center">
                  <Link size={15} className="text-violet-400" />
                </div>
                <span className="text-sm text-text-primary">Shared Links</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted bg-bg-primary border border-border px-2 py-0.5 rounded-full">
                  {linkMessages.length}
                </span>
                <ChevronLeft size={14} className={clsx('text-text-muted transition-transform', expandedSection === 'links' ? '-rotate-90' : 'rotate-180')} />
              </div>
            </button>
            {expandedSection === 'links' && (
              <div className="mt-1 mb-2 px-2">
                {linkMessages.length === 0 ? (
                  <p className="text-xs text-text-muted py-2 text-center">No links shared yet</p>
                ) : (
                  linkGroups.map(({ month, items }) => (
                    <div key={month} className="mb-3">
                      <p className="text-xs text-text-muted mb-2 font-medium">{month}</p>
                      <div className="flex flex-col gap-1">
                        {items.map(({ url }, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex flex-col gap-0.5 px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors"
                          >
                            <span className="text-xs font-medium text-violet-400 truncate">{getDomain(url)}</span>
                            <span className="text-[10px] text-text-muted truncate">{url}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border mx-0 mb-1" />

        {/* Members section */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-3">
            {conv.memberIds.length} Members
          </p>
          <div className="flex flex-col gap-1">
            {conv.memberIds.map(uid => {
              const profile = members[uid]
              const name = profile?.displayName ?? 'Unknown'
              const color = profile?.color ?? '#7c3aed'
              const initial = (name[0] ?? '?').toUpperCase()
              const photoURL = profile?.photoURL as string | undefined
              const isOwner = conv.createdBy === uid
              const lastSeen = profile?.lastSeen as number | undefined

              return (
                <div key={uid} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors">
                  <div className="shrink-0">
                    {photoURL ? (
                      <img src={photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {initial}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{name}{uid === currentUid ? ' (you)' : ''}</p>
                    <p className="text-[10px] text-text-muted truncate">{formatLastSeen(lastSeen)}</p>
                  </div>
                  {isOwner && (
                    <span className="shrink-0 bg-violet-600/20 text-violet-400 text-xs px-2 py-0.5 rounded-full border border-violet-600/30">
                      owner
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom padding */}
        <div className="h-4" />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MessengerPage() {
  const {
    messages, partnerTyping, sendMessage, deleteMessage, reactToMessage, markMessagesRead, setTyping,
    partner, spaceId, members,
    conversations, activeConversationId, setActiveConversationId,
    getOrCreateDM, createGroup,
    updateConversation, leaveGroup
  } = useSpace()
  const { user } = useAuth()

  const [text, setText] = useState('')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [dmInitialised, setDmInitialised] = useState(false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [muted, setMuted] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingThrottleRef = useRef<number>(0)

  // On mount: auto-open DM with partner if one exists and no conversation is active
  useEffect(() => {
    if (dmInitialised) return
    if (!partner || !user || !spaceId) return
    setDmInitialised(true)
    // If we already have a DM in the list, activate it
    const existing = conversations.find(c => c.type === 'dm' && c.memberIds.includes(partner.uid))
    if (existing) {
      setActiveConversationId(existing.id)
    } else if (conversations.length === 0) {
      // Conversations haven't loaded yet — will be retried when conversations change
      setDmInitialised(false)
    } else {
      // Conversations loaded but no DM yet — create one
      getOrCreateDM(partner.uid).then(id => {
        if (id) setActiveConversationId(id)
      })
    }
  }, [partner, user, spaceId, conversations, dmInitialised])

  // Close group info panel when switching conversations
  useEffect(() => {
    setShowGroupInfo(false)
  }, [activeConversationId])

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }, [])

  useEffect(() => {
    if (isNearBottom()) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, partnerTyping])

  // Mark unread messages as read
  useEffect(() => {
    if (!user || messages.length === 0) return
    const unread = messages
      .filter(m => m.senderId !== user.uid && !m.readBy.includes(user.uid))
      .map(m => m.id)
    if (unread.length > 0) markMessagesRead(unread)
  }, [messages, user])

  const adjustTextarea = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 96) + 'px'
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    adjustTextarea()
    const now = Date.now()
    if (now - typingThrottleRef.current > 1500) {
      typingThrottleRef.current = now
      setTyping()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const mapped: PendingFile[] = files.map(file => {
      const isImage = file.type.startsWith('image/')
      return {
        file,
        type: isImage ? 'image' : 'file',
        previewUrl: isImage ? URL.createObjectURL(file) : null,
      }
    })
    setPendingFiles(prev => [...prev, ...mapped])
    e.target.value = ''
  }

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => {
      const updated = [...prev]
      const removed = updated.splice(index, 1)[0]
      if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return updated
    })
  }

  const handleSend = async () => {
    if (!activeConversationId || !spaceId || (!text.trim() && pendingFiles.length === 0) || uploading) return

    setUploading(true)
    try {
      const attachments: MessageAttachment[] = await Promise.all(
        pendingFiles.map(async (pf) => {
          const path = `spaces/${spaceId}/messages/${Date.now()}_${pf.file.name}`
          const sRef = storageRef(storage, path)
          await new Promise<void>((resolve, reject) => {
            const task = uploadBytesResumable(sRef, pf.file)
            task.on('state_changed', null, reject, resolve)
          })
          const url = await getDownloadURL(sRef)
          return {
            name: pf.file.name,
            url,
            type: pf.type,
            size: pf.file.size,
          } as MessageAttachment
        })
      )

      await sendMessage(activeConversationId, text.trim(), attachments)
      setText('')
      setPendingFiles([])
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
        }
      }, 50)
    } finally {
      setUploading(false)
    }
  }

  const handleCreateGroup = async (name: string, memberIds: string[]) => {
    const id = await createGroup(name, memberIds)
    if (id) setActiveConversationId(id)
  }

  // Derive the active conversation object
  const activeConversation = conversations.find(c => c.id === activeConversationId) ?? null

  // Derive display info for active conversation header
  const activeHeader = (() => {
    if (!activeConversation) return null
    if (activeConversation.type === 'dm') {
      const partnerUid = activeConversation.memberIds.find(id => id !== user?.uid)
      const profile = partnerUid ? members[partnerUid] : null
      return {
        name: profile?.displayName ?? 'Unknown',
        color: profile?.color ?? '#7c3aed',
        initial: (profile?.displayName?.[0] ?? '?').toUpperCase(),
        photoURL: (profile as { photoURL?: string } | null)?.photoURL,
        isGroup: false,
        partnerUid: partnerUid ?? null,
        lastSeen: (profile as any)?.lastSeen as number | undefined,
      }
    }
    return {
      name: activeConversation.name ?? 'Group',
      color: '#7c3aed',
      initial: '',
      photoURL: activeConversation.photoURL,
      isGroup: true,
      partnerUid: null,
    }
  })()

  // Sort conversations by lastMessageAt descending
  const sortedConversations = [...conversations].sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))

  // Build message list with date separators
  type ListItem =
    | { type: 'separator'; label: string }
    | { type: 'message'; msg: Message; showAvatar: boolean }

  const items: ListItem[] = []
  messages.forEach((msg, i) => {
    const prev = messages[i - 1]
    if (!prev || !isSameDay(prev.createdAt, msg.createdAt)) {
      items.push({ type: 'separator', label: formatDateLabel(msg.createdAt) })
    }
    const isConsecutive = prev && prev.senderId === msg.senderId && isSameDay(prev.createdAt, msg.createdAt)
    items.push({ type: 'message', msg, showAvatar: !isConsecutive })
  })

  const canSend = !!activeConversationId && (text.trim().length > 0 || pendingFiles.length > 0) && !uploading

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── Left panel: conversation list ── */}
        <div className="w-64 shrink-0 h-full flex flex-col border-r border-border bg-bg-secondary">

          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <span className="text-sm font-semibold text-text-primary">Messages</span>
            <button
              onClick={() => setShowGroupModal(true)}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
              title="New group chat"
            >
              <SquarePen size={15} />
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto min-h-0 px-2 py-2 space-y-0.5">
            {sortedConversations.length === 0 && (
              <div className="flex flex-col gap-0.5">
                {Object.values(members)
                  .filter(m => m.uid !== user?.uid)
                  .map(m => (
                    <button
                      key={m.uid}
                      onClick={() => getOrCreateDM(m.uid).then(id => { if (id) setActiveConversationId(id) })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-surface-hover border border-transparent transition-colors"
                    >
                      <div className="shrink-0">
                        {(m as any).photoURL ? (
                          <img src={(m as any).photoURL} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: m.color }}>
                            {(m.displayName?.[0] ?? '?').toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{m.displayName}</p>
                        <p className="text-xs text-text-muted">Start a conversation</p>
                      </div>
                    </button>
                  ))
                }
              </div>
            )}
            {sortedConversations.map(conv => (
              <ConvItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === activeConversationId}
                members={members}
                currentUid={user?.uid ?? ''}
                onClick={() => setActiveConversationId(conv.id)}
              />
            ))}
          </div>
        </div>

        {/* ── Right panel: active chat ── */}
        <div className="flex-1 h-full flex flex-col min-h-0 min-w-0 relative">
          {!activeConversation ? (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center mx-auto">
                  <Send size={20} className="text-text-muted" />
                </div>
                <p className="text-sm font-medium text-text-primary">Select a conversation</p>
                <p className="text-xs text-text-muted">Choose from the list or start a new group chat</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-secondary shrink-0">
                {activeHeader?.isGroup ? (
                  <button
                    onClick={() => setShowGroupInfo(true)}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    {activeConversation.photoURL ? (
                      <img src={activeConversation.photoURL} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-600/30 flex items-center justify-center shrink-0">
                        <Users size={15} className="text-violet-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-text-primary leading-tight">{activeHeader.name}</p>
                      <p className="text-xs text-text-muted leading-tight">
                        {activeConversation.memberIds.length} members
                      </p>
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden"
                      style={{ backgroundColor: activeHeader?.photoURL ? 'transparent' : (activeHeader?.color ?? '#7c3aed') }}
                    >
                      {activeHeader?.photoURL
                        ? <img src={activeHeader.photoURL} alt="" className="w-full h-full object-cover" />
                        : activeHeader?.initial}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary leading-tight">{activeHeader?.name}</p>
                      <p className="text-xs text-text-muted leading-tight">
                        {formatLastSeen(activeHeader?.lastSeen)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Messages area */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
                <div className="flex flex-col justify-end min-h-full px-4 py-4 space-y-1.5">
                  {messages.length === 0 && (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-text-muted text-sm">No messages yet.</p>
                    </div>
                  )}

                  {items.map((item, idx) => {
                    if (item.type === 'separator') {
                      return (
                        <div key={`sep-${idx}`} className="flex items-center gap-3 py-2">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-xs text-text-muted shrink-0">{item.label}</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )
                    }
                    const { msg, showAvatar } = item
                    const isOwn = msg.senderId === user?.uid
                    const senderProfile = members[msg.senderId]
                    const senderColor = senderProfile?.color ?? '#7c3aed'
                    const senderInitial = (senderProfile?.displayName?.[0] ?? '?').toUpperCase()
                    return (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isOwn={isOwn}
                        senderColor={senderColor}
                        senderInitial={senderInitial}
                        showAvatar={showAvatar}
                        partnerUid={activeHeader?.partnerUid ?? null}
                        currentUid={user?.uid ?? ''}
                        onDelete={deleteMessage}
                        onReact={reactToMessage}
                      />
                    )
                  })}

                  {partnerTyping && <TypingIndicator />}
                </div>
              </div>

              {/* Pending file previews */}
              {pendingFiles.length > 0 && (
                <div className="px-4 py-2 border-t border-border flex flex-wrap gap-2 shrink-0 bg-bg-secondary">
                  {pendingFiles.map((pf, i) => (
                    <div key={i} className="relative group">
                      {pf.type === 'image' && pf.previewUrl ? (
                        <img src={pf.previewUrl} alt={pf.file.name} className="w-14 h-14 object-cover rounded-lg border border-border" />
                      ) : (
                        <div className="flex items-center gap-1.5 bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-xs text-text-secondary max-w-[140px]">
                          <Paperclip size={11} className="shrink-0" />
                          <span className="truncate">{pf.file.name}</span>
                        </div>
                      )}
                      <button
                        onClick={() => removePendingFile(i)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-bg-primary border border-border flex items-center justify-center text-text-muted hover:text-red-400 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input bar */}
              <div className="px-4 py-3 border-t border-border bg-bg-secondary shrink-0">
                <div className="flex items-end gap-2">
                  {/* File buttons */}
                  <div className="flex items-center gap-1 pb-1">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!activeConversationId}
                      className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Attach image"
                    >
                      <Image size={16} />
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!activeConversationId}
                      className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Attach file"
                    >
                      <Paperclip size={16} />
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.csv"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  {/* Textarea */}
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    disabled={!activeConversationId}
                    placeholder={activeConversationId ? 'Write a message...' : 'Select a conversation'}
                    rows={1}
                    className="flex-1 resize-none bg-bg-primary border border-border rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-600/50 transition-colors leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ minHeight: '38px', maxHeight: '96px' }}
                  />

                  {/* Send button */}
                  <button
                    onClick={handleSend}
                    disabled={!canSend}
                    className={clsx(
                      'p-2 rounded-xl transition-all shrink-0 pb-1',
                      canSend
                        ? 'bg-violet-600 text-white hover:bg-violet-700'
                        : 'bg-surface-hover text-text-muted cursor-not-allowed'
                    )}
                  >
                    {uploading ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Group info panel overlay */}
          {showGroupInfo && activeConversation?.type === 'group' && (
            <GroupInfoPanel
              conv={activeConversation}
              members={members}
              currentUid={user?.uid ?? ''}
              messages={messages}
              muted={muted}
              onClose={() => setShowGroupInfo(false)}
              onMuteToggle={() => setMuted(v => !v)}
              onLeave={async () => {
                await leaveGroup(activeConversation.id)
                setShowGroupInfo(false)
              }}
              onUpdateConversation={updateConversation}
              spaceId={spaceId}
            />
          )}
        </div>
      </div>

      {/* New Group Modal */}
      {showGroupModal && (
        <NewGroupModal
          members={members}
          currentUid={user?.uid ?? ''}
          onClose={() => setShowGroupModal(false)}
          onCreate={handleCreateGroup}
        />
      )}
    </div>
  )
}

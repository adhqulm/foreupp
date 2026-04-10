import { useRef, useState, useEffect, useCallback } from 'react'
import { useSpace } from '../context/SpaceContext'
import { useAuth } from '../context/AuthContext'
import {
  Send, Paperclip, X, Check, CheckCheck, Trash2, Image, Users, SquarePen,
  Bell, BellOff, LogOut, UserPlus, MoreHorizontal, ChevronLeft, Link, FileText, Camera,
  Video, Phone, Pin, Reply, Forward, CheckSquare, ChevronRight
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

function isVideoFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)
}

interface PendingFile {
  file: File
  previewUrl: string | null
  type: 'image' | 'file'
}

interface ReactionPickerProps {
  messageId: string
  isOwn: boolean
  onReact: (id: string, emoji: string) => void
  onClose: () => void
}

function ReactionPicker({ messageId, isOwn, onReact, onClose }: ReactionPickerProps) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div
        className={clsx('absolute z-20 bottom-full mb-1 flex gap-1 bg-bg-secondary border border-border rounded-xl px-2 py-1.5 shadow-lg', isOwn ? 'right-0' : 'left-0')}
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
    </>
  )
}

// ─── Message context menu ─────────────────────────────────────────────────────

function MessageContextMenu({ msg, x, y, isOwn, currentUid, members, onClose, onReply, onPin, onForward, onSelect, onDelete, onReact, onSaveAttachment }: {
  msg: Message; x: number; y: number; isOwn: boolean; currentUid: string
  members: Record<string, any>
  onClose: () => void
  onReply: () => void
  onPin: (forBoth: boolean) => void
  onForward: () => void
  onSelect: () => void
  onDelete: (forBoth: boolean) => void
  onReact: (emoji: string) => void
  onSaveAttachment?: () => void
}) {
  const [pinOpen, setPinOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const isPinned = msg.pinnedBy?.includes(currentUid)

  const readBy = msg.readBy.filter(u => u !== currentUid)
  const readByNames = readBy.map(u => members[u]?.displayName ?? 'Someone').join(', ')

  // Clamp to viewport
  const menuW = 220
  const menuH = 380
  const cx = Math.min(x, window.innerWidth - menuW - 8)
  const cy = Math.min(y, window.innerHeight - menuH - 8)

  const item = (onClick: () => void, icon: React.ReactNode, label: string, danger = false) => (
    <button onClick={onClick} className={clsx(
      'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
      danger ? 'text-red-500 hover:bg-red-500/10' : 'text-text-secondary hover:bg-surface-hover'
    )}>
      {icon}
      <span>{label}</span>
    </button>
  )

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose() }} />
      <div className="fixed z-50 bg-bg-secondary border border-border rounded-xl shadow-xl overflow-hidden py-1"
        style={{ left: cx, top: cy, width: menuW }}>

        {/* Emoji row */}
        <div className="flex gap-0.5 px-2 py-2 border-b border-border">
          {REACTION_EMOJIS.map(emoji => (
            <button key={emoji} onClick={() => { onReact(emoji); onClose() }}
              className="text-base hover:scale-125 transition-transform flex-1 text-center">{emoji}</button>
          ))}
        </div>

        {item(() => { onReply(); onClose() }, <Reply size={14} />, 'Reply')}

        {/* Pin / Unpin */}
        {isPinned ? (
          item(() => { onPin(false); onClose() }, <Pin size={14} />, 'Unpin')
        ) : (
          <>
            <button onClick={() => setPinOpen(v => !v)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover transition-colors">
              <Pin size={14} />
              <span className="flex-1 text-left">Pin message</span>
              <ChevronRight size={12} className={clsx('transition-transform', pinOpen && 'rotate-90')} />
            </button>
            {pinOpen && (
              <>
                <button onClick={() => { onPin(false); onClose() }} className="w-full flex items-center gap-2.5 pl-8 pr-3 py-1.5 text-xs text-text-muted hover:bg-surface-hover">Only for me</button>
                <button onClick={() => { onPin(true); onClose() }} className="w-full flex items-center gap-2.5 pl-8 pr-3 py-1.5 text-xs text-text-muted hover:bg-surface-hover">For both</button>
              </>
            )}
          </>
        )}

        {item(() => { onForward(); onClose() }, <Forward size={14} />, 'Forward')}
        {item(() => { onSelect(); onClose() }, <CheckSquare size={14} />, 'Select')}
        {onSaveAttachment && item(() => { onSaveAttachment(); onClose() }, <Paperclip size={14} />, 'Save as')}

        <div className="border-t border-border my-1" />

        {/* Delete */}
        <button onClick={() => setDeleteOpen(v => !v)}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
          <Trash2 size={14} />
          <span className="flex-1 text-left">Delete</span>
          <ChevronRight size={12} className={clsx('transition-transform', deleteOpen && 'rotate-90')} />
        </button>
        {deleteOpen && (
          <>
            <button onClick={() => { onDelete(false); onClose() }} className="w-full flex items-center gap-2.5 pl-8 pr-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">Delete for me</button>
            {isOwn && <button onClick={() => { onDelete(true); onClose() }} className="w-full flex items-center gap-2.5 pl-8 pr-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">Delete for both</button>}
          </>
        )}

        {/* Read receipt */}
        {isOwn && readBy.length > 0 && (
          <div className="border-t border-border mt-1 px-3 py-2 text-xs text-text-muted">
            Read by {readByNames}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Conversation context menu ─────────────────────────────────────────────────

function ConvContextMenu({ conv, x, y, currentUid, onClose, onPin, onMute, onMarkUnread, onClearHistory, onExport }: {
  conv: Conversation; x: number; y: number; currentUid: string
  onClose: () => void
  onPin: () => void
  onMute: () => void
  onMarkUnread: () => void
  onClearHistory: (forBoth: boolean) => void
  onExport: () => void
}) {
  const [clearOpen, setClearOpen] = useState(false)
  const isPinned = conv.pinnedBy?.includes(currentUid)
  const isMuted = conv.mutedBy?.includes(currentUid)
  const isUnread = conv.unreadFor?.includes(currentUid)

  const menuW = 200
  const cx = Math.min(x, window.innerWidth - menuW - 8)
  const cy = Math.min(y, window.innerHeight - 200)

  const item = (onClick: () => void, label: string, danger = false) => (
    <button onClick={onClick} className={clsx(
      'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left',
      danger ? 'text-red-500 hover:bg-red-500/10' : 'text-text-secondary hover:bg-surface-hover'
    )}>{label}</button>
  )

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose() }} />
      <div className="fixed z-50 bg-bg-secondary border border-border rounded-xl shadow-xl overflow-hidden py-1"
        style={{ left: cx, top: cy, width: menuW }}>
        {item(() => { onPin(); onClose() }, isPinned ? 'Unpin chat' : 'Pin chat')}
        {item(() => { onMute(); onClose() }, isMuted ? 'Unmute' : 'Mute')}
        {item(() => { onMarkUnread(); onClose() }, isUnread ? 'Mark as read' : 'Mark as unread')}
        {item(() => { onExport(); onClose() }, 'Export chat')}
        <div className="border-t border-border my-1" />
        <button onClick={() => setClearOpen(v => !v)}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
          <span className="flex-1 text-left">Clear history</span>
          <ChevronRight size={12} className={clsx('transition-transform', clearOpen && 'rotate-90')} />
        </button>
        {clearOpen && (
          <>
            <button onClick={() => { onClearHistory(false); onClose() }} className="w-full flex items-center pl-8 pr-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">Only for me</button>
            <button onClick={() => { onClearHistory(true); onClose() }} className="w-full flex items-center pl-8 pr-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">For both</button>
          </>
        )}
      </div>
    </>
  )
}

// ─── Forward modal ─────────────────────────────────────────────────────────────

function ForwardModal({ conversations, members, currentUid, onClose, onForward }: {
  conversations: Conversation[]
  members: Record<string, any>
  currentUid: string
  onClose: () => void
  onForward: (convId: string) => void
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-xs mx-4 p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Forward to</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={14} /></button>
        </div>
        <div className="space-y-0.5 max-h-64 overflow-y-auto">
          {conversations.map(conv => {
            const partnerUid = conv.type === 'dm' ? conv.memberIds.find(id => id !== currentUid) : null
            const name = conv.type === 'group' ? (conv.name ?? 'Group') : (members[partnerUid ?? '']?.displayName ?? 'Unknown')
            return (
              <button key={conv.id} onClick={() => { onForward(conv.id); onClose() }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover transition-colors text-left">
                {conv.type === 'group' ? (
                  conv.photoURL
                    ? <img src={conv.photoURL} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    : <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center shrink-0"><Users size={14} className="text-violet-400" /></div>
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: members[partnerUid ?? '']?.color ?? '#7c3aed' }}>
                    {(name[0] ?? '?').toUpperCase()}
                  </div>
                )}
                <span className="text-sm text-text-primary truncate">{name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Chat export ──────────────────────────────────────────────────────────────

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

function buildExportHtml(
  chatName: string,
  msgs: Message[],
  members: Record<string, any>,
  includePhotos: boolean,
  includeVideos: boolean,
  includeFiles: boolean
): string {
  const isVideo = (url: string) => /\.(mp4|mov|webm|avi|mkv)$/i.test(url)

  const rows = msgs.map(msg => {
    const sender = members[msg.senderId]
    const name = sender?.displayName ?? 'Unknown'
    const color = sender?.color ?? '#7c3aed'
    const initial = name[0]?.toUpperCase() ?? '?'
    const time = new Date(msg.createdAt).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

    let mediaHtml = ''
    if (msg.attachments) {
      for (const att of msg.attachments) {
        if (att.type === 'image' && includePhotos) {
          if (isVideo(att.url) && includeVideos) {
            mediaHtml += `<video controls src="${att.url}" style="max-width:320px;border-radius:8px;display:block;margin:4px 0"></video>`
          } else {
            mediaHtml += `<img src="${att.url}" alt="${att.name}" style="max-width:320px;border-radius:8px;display:block;margin:4px 0">`
          }
        } else if (att.type === 'file' && includeFiles) {
          mediaHtml += `<a href="${att.url}" style="color:#a78bfa;display:block;margin:4px 0">📎 ${att.name}</a>`
        }
      }
    }

    const replyHtml = msg.replyTo
      ? `<div style="border-left:2px solid #7c3aed;padding:2px 8px;margin-bottom:4px;opacity:0.7;font-size:12px"><b>${msg.replyTo.senderName}</b><br>${msg.replyTo.text}</div>`
      : ''

    const fwdHtml = msg.forwardedFrom ? `<div style="font-size:11px;color:#9ca3af;margin-bottom:2px">↪ Forwarded</div>` : ''

    return `
    <div style="display:flex;gap:10px;margin-bottom:12px;align-items:flex-start">
      <div style="width:36px;height:36px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">${initial}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:3px">
          <span style="font-weight:600;font-size:13px;color:${color}">${name}</span>
          <span style="font-size:11px;color:#6b7280">${time}</span>
        </div>
        ${fwdHtml}${replyHtml}
        ${msg.text ? `<div style="font-size:14px;color:#e5e7eb;line-height:1.5;word-break:break-word">${msg.text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>` : ''}
        ${mediaHtml}
      </div>
    </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${chatName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#111827;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px}
  .header{text-align:center;padding:24px 0 32px;border-bottom:1px solid #374151;margin-bottom:24px}
  .header h1{font-size:22px;font-weight:700;color:#fff}
  .header p{font-size:13px;color:#6b7280;margin-top:4px}
  .messages{max-width:760px;margin:0 auto}
  .date-sep{text-align:center;font-size:11px;color:#6b7280;margin:20px 0;position:relative}
  .date-sep::before,.date-sep::after{content:'';position:absolute;top:50%;width:42%;height:1px;background:#374151}
  .date-sep::before{left:0}.date-sep::after{right:0}
</style>
</head>
<body>
<div class="header">
  <h1>${chatName}</h1>
  <p>Exported ${new Date().toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}</p>
</div>
<div class="messages">${rows}</div>
</body>
</html>`
}

function ExportChatModal({ conv, members, onClose, onExport }: {
  conv: Conversation
  members: Record<string, any>
  onClose: () => void
  onExport: (opts: { photos: boolean; videos: boolean; files: boolean }) => Promise<void>
}) {
  const [photos, setPhotos] = useState(true)
  const [videos, setVideos] = useState(false)
  const [files, setFiles] = useState(false)
  const [loading, setLoading] = useState(false)

  const partnerName = conv.type === 'group'
    ? (conv.name ?? 'Group')
    : (Object.values(members).find((m: any) => !conv.memberIds.includes(m.uid) || conv.memberIds.length === 1) as any)?.displayName ?? 'Chat'

  const toggle = (setter: React.Dispatch<React.SetStateAction<boolean>>) => setter(v => !v)

  const check = (checked: boolean, label: string, setter: React.Dispatch<React.SetStateAction<boolean>>) => (
    <label className="flex items-center gap-3 py-2 cursor-pointer select-none" onClick={() => toggle(setter)}>
      <div className={clsx('w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
        checked ? 'bg-violet-600 border-violet-600' : 'border-border')}>
        {checked && <Check size={11} className="text-white" />}
      </div>
      <span className="text-sm text-text-primary">{label}</span>
    </label>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-text-primary">Chat export settings</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={15} /></button>
        </div>

        <p className="text-xs text-text-muted mb-4">All text messages are always included. Choose what else to embed:</p>

        <div className="space-y-0.5 mb-6">
          {check(photos, 'Photos', setPhotos)}
          {check(videos, 'Videos', setVideos)}
          {check(files, 'Files', setFiles)}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm px-4">Cancel</button>
          <button
            onClick={async () => { setLoading(true); await onExport({ photos, videos, files }); setLoading(false); onClose() }}
            disabled={loading}
            className="btn-primary text-sm px-4"
          >
            {loading ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AttachmentItem({ att, isOwn, imageOnly }: { att: MessageAttachment; isOwn: boolean; imageOnly?: boolean }) {
  const [lightbox, setLightbox] = useState(false)
  return att.type === 'image' ? (
    <>
      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={() => setLightbox(false)}>
          <button onClick={() => setLightbox(false)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <X size={20} className="text-white" />
          </button>
          <img
            src={att.url}
            alt={att.name}
            className="shadow-2xl rounded-2xl"
            style={{ width: '60vmin', height: '60vmin', objectFit: 'contain' }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
      <img
        src={att.url}
        alt={att.name}
        className={clsx('cursor-pointer object-cover', imageOnly ? 'max-w-[260px] w-full block' : 'max-w-[220px] rounded-xl')}
        onClick={e => { e.stopPropagation(); setLightbox(true) }}
      />
    </>
  ) : (
    <div
      className={clsx(
        'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer',
        isOwn ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-surface-hover hover:bg-surface-hover/80 text-text-primary'
      )}
    >
      <Paperclip size={12} className="shrink-0" />
      <span className="truncate max-w-[150px]">{att.name}</span>
      {att.size && (
        <span className={clsx('shrink-0', isOwn ? 'text-white/60' : 'text-text-muted')}>
          {formatFileSize(att.size)}
        </span>
      )}
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
  members: Record<string, { uid: string; displayName?: string; color?: string; photoURL?: string }>
  selectMode: boolean
  selected: boolean
  highlighted?: boolean
  onContextMenu: (e: React.MouseEvent, msg: Message) => void
  onToggleSelect: (id: string) => void
  onDelete: (id: string, forBoth: boolean) => void
  onReact: (id: string, emoji: string) => void
}

function MessageBubble({ msg, isOwn, senderColor, senderInitial, showAvatar, partnerUid, currentUid, members, selectMode, selected, highlighted, onContextMenu, onToggleSelect, onDelete, onReact }: MessageBubbleProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showActions, setShowActions] = useState(false)

  const reactionMap: Record<string, string[]> = {}
  Object.entries(msg.reactions ?? {}).forEach(([uid, emoji]) => {
    if (!reactionMap[emoji]) reactionMap[emoji] = []
    reactionMap[emoji].push(uid)
  })

  const isRead = partnerUid ? msg.readBy.includes(partnerUid) : false

  return (
    <div id={`msg-${msg.id}`} className={clsx('flex items-end gap-2 group rounded-xl transition-colors duration-300', isOwn ? 'flex-row-reverse' : 'flex-row', selectMode && 'cursor-pointer', highlighted && 'bg-violet-500/15')}
      onClick={selectMode ? () => onToggleSelect(msg.id) : undefined}>
      {/* Select checkbox */}
      {selectMode && (
        <div className={clsx('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 self-center',
          selected ? 'bg-violet-600 border-violet-600' : 'border-border')}>
          {selected && <Check size={10} className="text-white" />}
        </div>
      )}

      {/* Avatar placeholder slot */}
      <div className="w-7 shrink-0">
        {!isOwn && showAvatar && (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: senderColor }}>
            {senderInitial}
          </div>
        )}
      </div>

      <div className={clsx('flex flex-col max-w-[68%]', isOwn ? 'items-end' : 'items-start')}>
        {/* Forwarded label */}
        {msg.forwardedFrom && (
          <p className="text-[10px] text-text-muted mb-0.5 flex items-center gap-1">
            <Forward size={10} /> Forwarded
          </p>
        )}

        <div
          className="relative"
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
          onContextMenu={selectMode ? undefined : e => { e.preventDefault(); onContextMenu(e, msg) }}
        >
          {/* Pin indicator */}
          {msg.pinnedBy?.includes(currentUid) && (
            <Pin size={10} className={clsx('mb-0.5', isOwn ? 'text-violet-200 ml-auto' : 'text-violet-400')} />
          )}

          {/* Bubble */}
          {(() => {
            const hasImage = !!(msg.attachments?.some(a => a.type === 'image'))
            const imageOnly = !msg.text && !msg.replyTo && hasImage && msg.attachments?.length === 1
            // When any image is present, bubble has no padding — image is edge-to-edge
            const noBubblePad = imageOnly || hasImage
            return (
              <div
                className={clsx(
                  'rounded-2xl text-sm leading-relaxed overflow-hidden',
                  noBubblePad ? '' : 'px-3 py-2',
                  isOwn
                    ? 'bg-violet-600 text-white rounded-br-sm'
                    : 'bg-bg-secondary border border-border text-text-primary rounded-bl-sm'
                )}
              >
                {/* Reply preview */}
                {msg.replyTo && (
                  <div className={clsx('mb-1.5 rounded-lg px-2 py-1 border-l-2 text-xs opacity-75',
                    hasImage ? 'mx-3 mt-2' : '',
                    isOwn ? 'bg-white/10 border-white/40' : 'bg-surface-hover border-violet-400')}>
                    <p className={clsx('font-medium', isOwn ? 'text-white' : 'text-violet-400')}>{msg.replyTo.senderName}</p>
                    <p className="truncate">{msg.replyTo.text}</p>
                  </div>
                )}

                {/* Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className={clsx(imageOnly ? '' : !hasImage ? 'mb-1 space-y-1' : '')}>
                    {msg.attachments.map((att, i) => (
                      <AttachmentItem key={i} att={att} isOwn={isOwn} imageOnly={imageOnly} />
                    ))}
                  </div>
                )}

                {/* Caption text — always padded when image is present */}
                {msg.text && <span className={hasImage ? 'px-3 py-2 block' : ''}>{msg.text}</span>}
              </div>
            )
          })()}
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
                    'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors',
                    isMine
                      ? 'bg-violet-600/20 border-violet-600/40 text-text-primary'
                      : 'bg-bg-secondary border-border text-text-secondary hover:border-violet-600/30'
                  )}
                >
                  <span>{emoji}</span>
                  <div className="flex -space-x-1">
                    {uids.map(uid => {
                      const m = members[uid]
                      return m?.photoURL ? (
                        <img key={uid} src={m.photoURL} alt="" className="w-3.5 h-3.5 rounded-full object-cover ring-1 ring-bg-secondary" />
                      ) : (
                        <div key={uid} className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ring-1 ring-bg-secondary shrink-0"
                          style={{ backgroundColor: m?.color ?? '#7c3aed' }}>
                          {(m?.displayName?.[0] ?? '?').toUpperCase()}
                        </div>
                      )
                    })}
                  </div>
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
  onContextMenu: (e: React.MouseEvent) => void
}

function ConvItem({ conv, isActive, members, currentUid, onClick, onContextMenu }: ConvItemProps) {
  const isPinned = conv.pinnedBy?.includes(currentUid)
  const isUnread = conv.unreadFor?.includes(currentUid)
  if (conv.type === 'dm') {
    const partnerUid = conv.memberIds.find(id => id !== currentUid)
    const partnerProfile = partnerUid ? members[partnerUid] : null
    const color = partnerProfile?.color ?? '#7c3aed'
    const initial = (partnerProfile?.displayName?.[0] ?? '?').toUpperCase()
    const name = partnerProfile?.displayName ?? 'Unknown'

    return (
      <button onClick={onClick} onContextMenu={e => { e.preventDefault(); onContextMenu(e) }}
        className={clsx('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
          isActive ? 'bg-violet-600/15 border border-violet-600/25' : 'hover:bg-surface-hover border border-transparent'
        )}>
        <div className="shrink-0 relative">
          {partnerProfile && (partnerProfile as any).photoURL ? (
            <img src={(partnerProfile as any).photoURL} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: color }}>{initial}</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-1">
            <span className="text-sm font-medium text-text-primary truncate">{name}</span>
            <div className="flex items-center gap-1 shrink-0">
              {isPinned && <Pin size={10} className="text-text-muted" />}
              <span className="text-xs text-text-muted">{formatConvTime(conv.lastMessageAt)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-1">
            <p className="text-xs text-text-muted truncate">{conv.lastMessageText || 'No messages yet'}</p>
            {isUnread && <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />}
          </div>
        </div>
      </button>
    )
  }

  // Group
  return (
    <button onClick={onClick} onContextMenu={e => { e.preventDefault(); onContextMenu(e) }}
      className={clsx('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
        isActive ? 'bg-violet-600/15 border border-violet-600/25' : 'hover:bg-surface-hover border border-transparent'
      )}>
      {conv.photoURL ? (
        <img src={conv.photoURL} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-violet-600/20 border border-violet-600/30 flex items-center justify-center shrink-0">
          <Users size={16} className="text-violet-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <span className="text-sm font-medium text-text-primary truncate">{conv.name ?? 'Group'}</span>
          <div className="flex items-center gap-1 shrink-0">
            {isPinned && <Pin size={10} className="text-text-muted" />}
            <span className="text-xs text-text-muted">{formatConvTime(conv.lastMessageAt)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs text-text-muted truncate">{conv.lastMessageText || 'No messages yet'}</p>
          {isUnread && <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />}
        </div>
      </div>
    </button>
  )
}

// ─── Shared media helpers ─────────────────────────────────────────────────────

function getFileExtColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'bg-orange-500'
  if (ext === 'doc' || ext === 'docx') return 'bg-blue-500'
  if (ext === 'xls' || ext === 'xlsx') return 'bg-green-600'
  if (ext === 'zip' || ext === 'rar' || ext === '7z') return 'bg-yellow-500'
  return 'bg-text-muted'
}

function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return text.match(urlRegex) ?? []
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function groupByMonth<T extends { msg: Message }>(items: T[]): { month: string; items: T[] }[] {
  const map: Record<string, T[]> = {}
  for (const item of items) {
    const key = formatMonthLabel(item.msg.createdAt)
    if (!map[key]) map[key] = []
    map[key].push(item)
  }
  return Object.entries(map).map(([month, items]) => ({ month, items }))
}

// ─── Shared media sections (reusable inside both panels) ──────────────────────

type MediaSection = 'photos' | 'videos' | 'files' | 'links'

interface SharedMediaProps {
  messages: Message[]
  expandedSection: MediaSection | null
  setExpandedSection: (s: MediaSection | null) => void
}

function SharedMediaSections({ messages, expandedSection, setExpandedSection }: SharedMediaProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const imageAttachments = messages.flatMap(m =>
    (m.attachments ?? []).filter(a => a.type === 'image').map(a => ({ att: a, msg: m }))
  )
  const videoAttachments = messages.flatMap(m =>
    (m.attachments ?? []).filter(a => a.type === 'file' && isVideoFile(a.name)).map(a => ({ att: a, msg: m }))
  )
  const fileAttachments = messages.flatMap(m =>
    (m.attachments ?? []).filter(a => a.type === 'file' && !isVideoFile(a.name)).map(a => ({ att: a, msg: m }))
  )
  const linkMessages = messages.flatMap(m => {
    const urls = extractUrls(m.text)
    return urls.map(url => ({ url, msg: m }))
  })

  const photoGroups = groupByMonth(imageAttachments)
  const videoGroups = groupByMonth(videoAttachments)
  const fileGroups = groupByMonth(fileAttachments)
  const linkGroups = groupByMonth(linkMessages)

  const toggle = (s: MediaSection) => setExpandedSection(expandedSection === s ? null : s)

  return (
    <div className="px-4 py-3 flex flex-col gap-1">
      {lightboxUrl && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={() => setLightboxUrl(null)}>
          <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <X size={20} className="text-white" />
          </button>
          <img src={lightboxUrl} alt="" className="shadow-2xl rounded-2xl" style={{ width: '60vmin', height: '60vmin', objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Photos */}
      <div>
        <button
          onClick={() => toggle('photos')}
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
                        onClick={() => setLightboxUrl(att.url)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Videos */}
      <div>
        <button
          onClick={() => toggle('videos')}
          className="w-full flex items-center justify-between py-2.5 text-left hover:bg-surface-hover rounded-lg px-2 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600/15 flex items-center justify-center">
              <Video size={15} className="text-violet-400" />
            </div>
            <span className="text-sm text-text-primary">Videos</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted bg-bg-primary border border-border px-2 py-0.5 rounded-full">
              {videoAttachments.length}
            </span>
            <ChevronLeft size={14} className={clsx('text-text-muted transition-transform', expandedSection === 'videos' ? '-rotate-90' : 'rotate-180')} />
          </div>
        </button>
        {expandedSection === 'videos' && (
          <div className="mt-1 mb-2 px-2">
            {videoAttachments.length === 0 ? (
              <p className="text-xs text-text-muted py-2 text-center">No videos shared yet</p>
            ) : (
              videoGroups.map(({ month, items }) => (
                <div key={month} className="mb-3">
                  <p className="text-xs text-text-muted mb-2 font-medium">{month}</p>
                  <div className="grid grid-cols-3 gap-1">
                    {items.map(({ att }, idx) => (
                      <button
                        key={idx}
                        onClick={() => setLightboxUrl(att.url)}
                        className="w-full aspect-square rounded-lg bg-bg-primary border border-border flex items-center justify-center hover:border-violet-600/30 hover:bg-surface-hover transition-colors"
                        title={att.name}
                      >
                        <Video size={20} className="text-violet-400" />
                      </button>
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
          onClick={() => toggle('files')}
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
          onClick={() => toggle('links')}
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
  )
}

// ─── Group Info Panel ─────────────────────────────────────────────────────────

interface GroupInfoPanelProps {
  conv: Conversation
  members: Record<string, any>
  currentUid: string
  messages: Message[]
  muted: boolean
  onClose: () => void
  onMuteToggle: () => void
  onLeave: () => void
  onRequestLeave: () => void
  onExport: () => void
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
  onRequestLeave,
  onExport,
  onUpdateConversation,
  spaceId,
}: GroupInfoPanelProps) {
  const [expandedSection, setExpandedSection] = useState<MediaSection | null>(null)
  const [uploadingGroupPhoto, setUploadingGroupPhoto] = useState(false)
  const [groupPhotoError, setGroupPhotoError] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(conv.name ?? '')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const groupPhotoInputRef = useRef<HTMLInputElement>(null)

  const handleGroupPhotoUpload = (file: File) => {
    setUploadingGroupPhoto(true)
    setGroupPhotoError('')
    console.log('[GroupPhoto] reading file:', file.name, file.size)

    const reader = new FileReader()
    reader.onload = async (e) => {
      console.log('[GroupPhoto] FileReader loaded')
      try {
        const dataUrl = e.target?.result as string
        console.log('[GroupPhoto] dataUrl length:', dataUrl?.length)
        await onUpdateConversation(conv.id, { photoURL: dataUrl })
        console.log('[GroupPhoto] updateConversation done')
      } catch (err: any) {
        console.error('[GroupPhoto] updateConversation failed:', err)
        setGroupPhotoError(err?.message ?? 'Upload failed')
      } finally {
        setUploadingGroupPhoto(false)
      }
    }
    reader.onerror = (err) => {
      console.error('[GroupPhoto] FileReader error:', err)
      setGroupPhotoError('Failed to read file')
      setUploadingGroupPhoto(false)
    }
    reader.readAsDataURL(file)
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

          {groupPhotoError && (
            <p className="text-xs text-red-500 text-center max-w-[200px]">{groupPhotoError}</p>
          )}

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
            onClick={onRequestLeave}
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
                  onClick={() => { setShowMoreMenu(false); onExport() }}
                  className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover transition-colors"
                >
                  Export chat history
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border mx-0 mb-1" />

        {/* Media / Files / Links */}
        <SharedMediaSections
          messages={messages}
          expandedSection={expandedSection}
          setExpandedSection={setExpandedSection}
        />

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

// ─── DM Profile Panel ─────────────────────────────────────────────────────────

function DMProfilePanel({
  profile,
  messages,
  muted,
  onClose,
  onMuteToggle,
  onExport,
}: {
  profile: { uid: string; displayName: string; color: string; photoURL?: string; phone?: string; email?: string; bio?: string; lastSeen?: number }
  messages: Message[]
  muted: boolean
  onClose: () => void
  onMuteToggle: () => void
  onExport: () => void
}) {
  const [expandedSection, setExpandedSection] = useState<MediaSection | null>(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  return (
    <>
    {lightbox && profile.photoURL && (
      <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={() => setLightbox(false)}>
        <button onClick={() => setLightbox(false)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
          <X size={20} className="text-white" />
        </button>
        <img
          src={profile.photoURL}
          alt=""
          className="shadow-2xl rounded-2xl"
          style={{ width: '60vmin', height: '60vmin', objectFit: 'cover', imageRendering: 'auto' }}
          onClick={e => e.stopPropagation()}
        />
      </div>
    )}
    <div className="absolute right-0 top-0 h-full w-80 bg-bg-secondary border-l border-border z-10 flex flex-col overflow-y-auto">
      {/* Close button */}
      <div className="flex items-center justify-end px-3 pt-3 shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Profile info */}
      <div className="flex flex-col items-center py-6 px-4">
        {/* Avatar */}
        <div
          onClick={() => profile.photoURL && setLightbox(true)}
          className={clsx('w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0 overflow-hidden', profile.photoURL && 'cursor-pointer hover:opacity-90 transition-opacity')}
          style={{ backgroundColor: profile.photoURL ? 'transparent' : profile.color }}
        >
          {profile.photoURL
            ? <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
            : (profile.displayName?.[0] ?? '?').toUpperCase()
          }
        </div>

        {/* Display name */}
        <p className="text-lg font-bold text-text-primary text-center mt-3">{profile.displayName}</p>

        {/* Last seen */}
        <p className="text-xs text-text-muted text-center">{formatLastSeen(profile.lastSeen)}</p>

        {/* Phone */}
        {profile.phone && /\d/.test(profile.phone) && (
          <div className="flex items-center gap-2 mt-3 text-text-secondary">
            <Phone size={14} className="shrink-0" />
            <span className="text-sm">{profile.phone}</span>
          </div>
        )}

        {/* Email */}
        {profile.email && (
          <div className="flex items-center gap-2 mt-1.5 text-text-secondary">
            <span className="text-sm">{profile.email}</span>
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm italic text-text-muted mt-2 text-center">{profile.bio}</p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Action buttons row */}
      <div className="flex items-start justify-center gap-2 px-4 py-5">
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
                onClick={() => { setShowMoreMenu(false); onExport() }}
                className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover transition-colors"
              >
                Export chat history
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Media sections */}
      <SharedMediaSections
        messages={messages}
        expandedSection={expandedSection}
        setExpandedSection={setExpandedSection}
      />

      {/* Bottom padding */}
      <div className="h-4 shrink-0" />
    </div>
    </>
  )
}

// ─── Leave Group Confirm Modal ────────────────────────────────────────────────

function LeaveGroupConfirmModal({
  groupName,
  groupPhotoURL,
  onCancel,
  onConfirm,
}: {
  groupName: string
  groupPhotoURL?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div className="bg-bg-secondary border border-border rounded-2xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          {groupPhotoURL ? (
            <img src={groupPhotoURL} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-violet-600/20 border border-violet-600/30 flex items-center justify-center shrink-0">
              <Users size={18} className="text-violet-400" />
            </div>
          )}
          <p className="text-sm font-semibold text-text-primary">{groupName}</p>
        </div>
        <p className="text-sm text-text-secondary mb-6">Are you sure you want to leave this group?</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">Leave</button>
        </div>
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
    updateConversation, leaveGroup,
    pinMessage, forwardMessage, pinConversation, muteConversation, markConversationUnread, clearHistory,
    getMessagesForConversation
  } = useSpace()
  const { user } = useAuth()

  const [text, setText] = useState('')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [dmInitialised, setDmInitialised] = useState(false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [showDMProfile, setShowDMProfile] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [muted, setMuted] = useState(false)

  // Export
  const [exportConv, setExportConv] = useState<Conversation | null>(null)

  // Message context menu
  const [msgCtx, setMsgCtx] = useState<{ msg: Message; x: number; y: number } | null>(null)
  // Conversation context menu
  const [convCtx, setConvCtx] = useState<{ conv: Conversation; x: number; y: number } | null>(null)
  // Reply
  const [replyTo, setReplyTo] = useState<{ id: string; text: string; senderName: string } | null>(null)
  // Forward
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null)
  const [forwardBulkIds, setForwardBulkIds] = useState<string[] | null>(null)
  // Select mode
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteMenu, setDeleteMenu] = useState(false)
  const [pinnedIdx, setPinnedIdx] = useState(0)
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null)
  const [showPinnedList, setShowPinnedList] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingThrottleRef = useRef<number>(0)

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const s = new Set(prev)
    s.has(id) ? s.delete(id) : s.add(id)
    return s
  })

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()) }

  const handleBulkDelete = async (forBoth: boolean) => {
    await Promise.all([...selectedIds].map(id => deleteMessage(id, forBoth)))
    exitSelectMode()
  }

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

  // Close panels when switching conversations
  useEffect(() => {
    setShowGroupInfo(false)
    setShowDMProfile(false)
    setShowLeaveConfirm(false)
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
          if (pf.type === 'image') {
            const url = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = e => {
                const dataUrl = e.target?.result as string
                const img = new window.Image()
                img.onload = () => {
                  const canvas = document.createElement('canvas')
                  canvas.width = img.width
                  canvas.height = img.height
                  canvas.getContext('2d')!.drawImage(img, 0, 0)
                  resolve(canvas.toDataURL('image/jpeg', 0.97))
                }
                img.onerror = reject
                img.src = dataUrl
              }
              reader.onerror = reject
              reader.readAsDataURL(pf.file)
            })
            return { name: pf.file.name, url, type: 'image', size: pf.file.size } as MessageAttachment
          } else {
            // Non-image: store as base64 data URL directly
            const url = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = e => resolve(e.target?.result as string)
              reader.onerror = reject
              reader.readAsDataURL(pf.file)
            })
            return { name: pf.file.name, url, type: 'file', size: pf.file.size } as MessageAttachment
          }
        })
      )

      await sendMessage(activeConversationId, text.trim(), attachments, replyTo ?? undefined)
      setText('')
      setPendingFiles([])
      setReplyTo(null)
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

  const handleExport = async (conv: Conversation, opts: { photos: boolean; videos: boolean; files: boolean }) => {
    const msgs = await getMessagesForConversation(conv.id)
    const chatName = conv.type === 'group'
      ? (conv.name ?? 'Group')
      : (members[conv.memberIds.find(id => id !== uid) ?? ''] as any)?.displayName ?? 'Chat'
    const html = buildExportHtml(chatName, msgs, members, opts.photos, opts.videos, opts.files)
    const filename = `${chatName.replace(/[^a-zA-Z0-9_\- ]/g, '_')}_export.html`

    if (isTauri) {
      const { save } = await import('@tauri-apps/api/dialog')
      const { writeTextFile } = await import('@tauri-apps/api/fs')
      const path = await save({ defaultPath: filename, filters: [{ name: 'HTML', extensions: ['html'] }] })
      if (path) await writeTextFile(path, html)
    } else {
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
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

  // Sort: pinned first, then by lastMessageAt descending
  const uid = user?.uid ?? ''
  const sortedConversations = [...conversations].sort((a, b) => {
    const aPinned = a.pinnedBy?.includes(uid) ? 1 : 0
    const bPinned = b.pinnedBy?.includes(uid) ? 1 : 0
    if (bPinned !== aPinned) return bPinned - aPinned
    return (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0)
  })

  // Build message list with date separators
  type ListItem =
    | { type: 'separator'; label: string }
    | { type: 'message'; msg: Message; showAvatar: boolean }

  const visibleMessages = messages.filter(m => !m.deletedFor?.includes(uid))

  const items: ListItem[] = []
  visibleMessages.forEach((msg, i) => {
    const prev = visibleMessages[i - 1]
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
                currentUid={uid}
                onClick={() => {
                  setActiveConversationId(conv.id)
                  // clear unread dot when opening — only call if currently marked unread
                  if (conv.unreadFor?.includes(uid)) {
                    updateConversation(conv.id, { unreadFor: conv.unreadFor.filter(u => u !== uid) })
                  }
                }}
                onContextMenu={e => setConvCtx({ conv, x: e.clientX, y: e.clientY })}
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
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity text-left"
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
                  <button
                    onClick={() => setShowDMProfile(true)}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity text-left"
                  >
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
                  </button>
                )}
              </div>

              {/* Pinned message banner */}
              {(() => {
                const pinned = visibleMessages
                  .filter(m => m.pinnedBy?.includes(uid))
                  .sort((a, b) => b.createdAt - a.createdAt)
                if (pinned.length === 0) return null
                const safeIdx = pinnedIdx % pinned.length
                const current = pinned[safeIdx]
                const preview = current.text
                  ? current.text.slice(0, 80) + (current.text.length > 80 ? '…' : '')
                  : current.attachments?.[0]?.type === 'image' ? 'Photo' : 'Attachment'
                return (
                  <>
                  <div className="flex items-center border-b border-border bg-bg-secondary shrink-0">
                    {/* Telegram-style vertical segment indicators */}
                    <div className="flex flex-col gap-px py-2 pl-3 pr-2 shrink-0" style={{ height: 40 }}>
                      {pinned.map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-full transition-colors"
                          style={{ width: 2, minHeight: 2, backgroundColor: i === safeIdx ? '#7c3aed' : 'var(--color-border)' }}
                        />
                      ))}
                    </div>
                    {/* Clickable message preview */}
                    <div
                      className="flex-1 min-w-0 py-2 cursor-pointer"
                      onClick={() => {
                        const el = document.getElementById(`msg-${current.id}`)
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        setHighlightedMsgId(current.id)
                        setTimeout(() => setHighlightedMsgId(null), 1000)
                        setPinnedIdx(i => (i + 1) % pinned.length)
                      }}
                    >
                      <p className="text-[10px] font-semibold text-violet-400 leading-none mb-0.5">Pinned message</p>
                      <p className="text-xs text-text-secondary truncate">{preview}</p>
                    </div>
                    {/* Open pinned list button */}
                    <button
                      onClick={e => { e.stopPropagation(); setShowPinnedList(v => !v) }}
                      className="p-2 mr-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors shrink-0"
                    >
                      <Pin size={14} />
                    </button>
                  </div>

                  {/* Pinned messages list panel */}
                  {showPinnedList && (
                    <div className="border-b border-border bg-bg-primary shrink-0 max-h-64 overflow-y-auto">
                      <div className="px-4 py-2 flex items-center justify-between sticky top-0 bg-bg-primary border-b border-border">
                        <span className="text-xs font-semibold text-text-primary">{pinned.length} pinned message{pinned.length !== 1 ? 's' : ''}</span>
                        <button onClick={() => setShowPinnedList(false)} className="p-1 rounded text-text-muted hover:text-text-primary transition-colors"><X size={14} /></button>
                      </div>
                      {pinned.map((m, i) => {
                        const prev = m.text ? m.text.slice(0, 100) + (m.text.length > 100 ? '…' : '') : m.attachments?.[0]?.type === 'image' ? 'Photo' : 'Attachment'
                        return (
                          <div
                            key={m.id}
                            className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-surface-hover cursor-pointer border-b border-border/40 last:border-0"
                            onClick={() => {
                              setShowPinnedList(false)
                              const el = document.getElementById(`msg-${m.id}`)
                              el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              setHighlightedMsgId(m.id)
                              setTimeout(() => setHighlightedMsgId(null), 1000)
                              setPinnedIdx(i)
                            }}
                          >
                            <div className="flex flex-col gap-px pt-1 shrink-0" style={{ width: 2 }}>
                              <div className="rounded-full flex-1" style={{ width: 2, height: 32, backgroundColor: '#7c3aed' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-semibold text-violet-400 leading-none mb-0.5">Pinned message #{pinned.length - i}</p>
                              <p className="text-xs text-text-secondary line-clamp-2">{prev}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  </>
                )
              })()}

              {/* Messages area */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
                <div className="flex flex-col justify-end min-h-full px-4 py-4 space-y-1.5">
                  {visibleMessages.length === 0 && (
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
                        currentUid={uid}
                        members={members}
                        selectMode={selectMode}
                        selected={selectedIds.has(msg.id)}
                        highlighted={highlightedMsgId === msg.id}
                        onContextMenu={(e, m) => setMsgCtx({ msg: m, x: e.clientX, y: e.clientY })}
                        onToggleSelect={toggleSelect}
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

              {/* Select mode action bar */}
              {selectMode && (
                <div className="px-4 py-2 border-t border-border bg-bg-secondary shrink-0 flex items-center gap-2">
                  <span className="text-xs text-text-muted flex-1">{selectedIds.size} selected</span>
                  {selectedIds.size > 0 && (
                    <>
                    <button
                      onClick={() => { setForwardBulkIds([...selectedIds]); exitSelectMode() }}
                      className="btn-ghost text-xs py-1"
                    >Forward</button>
                    <div className="relative">
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteMenu(v => !v) }}
                        className="btn-ghost text-xs text-red-500 py-1"
                      >Delete</button>
                      {deleteMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setDeleteMenu(false)} />
                          <div className="absolute bottom-full right-0 mb-1 z-50 bg-bg-secondary border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px]">
                            <button onClick={() => { handleBulkDelete(false); setDeleteMenu(false) }} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10">Delete for me</button>
                            <button onClick={() => { handleBulkDelete(true); setDeleteMenu(false) }} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10">Delete for both</button>
                          </div>
                        </>
                      )}
                    </div>
                    </>
                  )}
                  <button onClick={exitSelectMode} className="btn-ghost text-xs py-1">Cancel</button>
                </div>
              )}

              {/* Reply preview bar */}
              {replyTo && (
                <div className="px-4 py-2 border-t border-border bg-bg-secondary shrink-0 flex items-center gap-2">
                  <div className="flex-1 min-w-0 border-l-2 border-violet-500 pl-2">
                    <p className="text-xs font-medium text-violet-400">{replyTo.senderName}</p>
                    <p className="text-xs text-text-muted truncate">{replyTo.text}</p>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="p-1 text-text-muted hover:text-text-primary">
                    <X size={13} />
                  </button>
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
                      'p-2 rounded-xl transition-all shrink-0 self-center',
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
              onRequestLeave={() => setShowLeaveConfirm(true)}
              onExport={() => setExportConv(activeConversation)}
              onUpdateConversation={updateConversation}
              spaceId={spaceId}
            />
          )}

          {/* DM profile panel */}
          {showDMProfile && activeConversation?.type === 'dm' && (
            <DMProfilePanel
              profile={{
                uid: activeHeader?.partnerUid ?? '',
                displayName: activeHeader?.name ?? '',
                color: activeHeader?.color ?? '#7c3aed',
                photoURL: activeHeader?.photoURL,
                phone: (members[activeHeader?.partnerUid ?? ''] as any)?.phone,
                email: (members[activeHeader?.partnerUid ?? ''] as any)?.email,
                bio: (members[activeHeader?.partnerUid ?? ''] as any)?.bio,
                lastSeen: (activeHeader as any)?.lastSeen,
              }}
              messages={messages}
              muted={muted}
              onClose={() => setShowDMProfile(false)}
              onMuteToggle={() => setMuted(v => !v)}
              onExport={() => setExportConv(activeConversation)}
            />
          )}

          {/* Leave group confirm modal */}
          {showLeaveConfirm && activeConversation?.type === 'group' && (
            <LeaveGroupConfirmModal
              groupName={activeConversation.name ?? 'Group'}
              groupPhotoURL={activeConversation.photoURL}
              onCancel={() => setShowLeaveConfirm(false)}
              onConfirm={async () => {
                await leaveGroup(activeConversation.id)
                setShowLeaveConfirm(false)
                setShowGroupInfo(false)
              }}
            />
          )}
        </div>
      </div>

      {/* New Group Modal */}
      {showGroupModal && (
        <NewGroupModal
          members={members}
          currentUid={uid}
          onClose={() => setShowGroupModal(false)}
          onCreate={handleCreateGroup}
        />
      )}

      {/* Message context menu */}
      {msgCtx && (
        <MessageContextMenu
          msg={msgCtx.msg}
          x={msgCtx.x}
          y={msgCtx.y}
          isOwn={msgCtx.msg.senderId === uid}
          currentUid={uid}
          members={members}
          onClose={() => setMsgCtx(null)}
          onReply={() => {
            const senderName = members[msgCtx.msg.senderId]?.displayName ?? 'Unknown'
            setReplyTo({ id: msgCtx.msg.id, text: msgCtx.msg.text, senderName })
            textareaRef.current?.focus()
          }}
          onPin={(forBoth) => pinMessage(msgCtx.msg.id, forBoth)}
          onForward={() => setForwardMsg(msgCtx.msg)}
          onSelect={() => { setSelectMode(true); toggleSelect(msgCtx.msg.id) }}
          onDelete={(forBoth) => deleteMessage(msgCtx.msg.id, forBoth)}
          onReact={(emoji) => reactToMessage(msgCtx.msg.id, emoji)}
          onSaveAttachment={msgCtx.msg.attachments?.length ? async () => {
            const att = msgCtx.msg.attachments![0]
            if (isTauri) {
              const { save } = await import('@tauri-apps/api/dialog')
              const { writeBinaryFile } = await import('@tauri-apps/api/fs')
              const path = await save({ defaultPath: att.name })
              if (!path) return
              const base64 = att.url.split(',')[1]
              const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
              await writeBinaryFile(path, binary)
            } else {
              const a = document.createElement('a'); a.href = att.url; a.download = att.name; a.click()
            }
          } : undefined}
        />
      )}

      {/* Conversation context menu */}
      {convCtx && (
        <ConvContextMenu
          conv={convCtx.conv}
          x={convCtx.x}
          y={convCtx.y}
          currentUid={uid}
          onClose={() => setConvCtx(null)}
          onPin={() => pinConversation(convCtx.conv.id)}
          onMute={() => muteConversation(convCtx.conv.id)}
          onMarkUnread={() => markConversationUnread(convCtx.conv.id)}
          onClearHistory={(forBoth) => clearHistory(convCtx.conv.id, forBoth)}
          onExport={() => setExportConv(convCtx.conv)}
        />
      )}

      {/* Export modal */}
      {exportConv && (
        <ExportChatModal
          conv={exportConv}
          members={members}
          onClose={() => setExportConv(null)}
          onExport={(opts) => handleExport(exportConv, opts)}
        />
      )}

      {/* Forward modal */}
      {(forwardMsg || forwardBulkIds) && (
        <ForwardModal
          conversations={conversations}
          members={members}
          currentUid={uid}
          onClose={() => { setForwardMsg(null); setForwardBulkIds(null) }}
          onForward={async (convId) => {
            if (forwardBulkIds) {
              for (const id of forwardBulkIds) await forwardMessage(id, convId)
            } else if (forwardMsg) {
              await forwardMessage(forwardMsg.id, convId)
            }
          }}
        />
      )}
    </div>
  )
}

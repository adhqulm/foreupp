import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'
import { useAppSettings } from '../../context/AppSettingsContext'
import { useSpace } from '../../context/SpaceContext'
import { useAuth } from '../../context/AuthContext'
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

interface Toast {
  id: string
  senderName: string
  senderColor: string
  senderInitial: string
  text: string
  convId: string
}

function NotificationManager() {
  const { conversations, members, setActiveConversationId } = useSpace()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const prevLastMsgAt = useRef<Record<string, number>>({})
  const initialised = useRef(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const timerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    if (!user || conversations.length === 0) return

    if (!initialised.current) {
      conversations.forEach(c => { prevLastMsgAt.current[c.id] = c.lastMessageAt ?? 0 })
      initialised.current = true
      return
    }

    const onMessenger = location.pathname === '/messenger'

    for (const conv of conversations) {
      const lastAt = conv.lastMessageAt ?? 0
      const prev = prevLastMsgAt.current[conv.id] ?? 0

      // New message arrived, not sent by us, and we're not already on messenger
      const senderIsUs = conv.lastMessageSenderId === user.uid
      if (lastAt > prev && !onMessenger && !senderIsUs) {
        const senderId = conv.lastMessageSenderId
          ?? conv.memberIds?.find(id => id !== user.uid)
        const senderProfile = senderId ? members[senderId] : null
        const senderName = senderProfile?.displayName ?? conv.name ?? 'New message'
        const senderColor = senderProfile?.color ?? '#7c3aed'
        const senderInitial = (senderName[0] ?? '?').toUpperCase()
        const toastId = `${conv.id}-${lastAt}`

        setToasts(p => {
          if (p.some(t => t.id === toastId)) return p
          return [...p.slice(-3), { id: toastId, senderName, senderColor, senderInitial, text: conv.lastMessageText ?? '', convId: conv.id }]
        })

        const timer = setTimeout(() => {
          setToasts(p => p.filter(t => t.id !== toastId))
          delete timerRefs.current[toastId]
        }, 5000)
        timerRefs.current[toastId] = timer
      }

      prevLastMsgAt.current[conv.id] = lastAt
    }
  }, [conversations, user, location.pathname, members])

  const dismiss = (id: string) => {
    clearTimeout(timerRefs.current[id])
    delete timerRefs.current[id]
    setToasts(p => p.filter(t => t.id !== id))
  }

  const openConv = (convId: string, toastId: string) => {
    setActiveConversationId(convId)
    navigate('/messenger')
    dismiss(toastId)
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id}
          className="pointer-events-auto flex items-start gap-3 bg-bg-primary border border-border rounded-xl shadow-lg px-3 py-2.5 w-72 animate-scale-in">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ backgroundColor: toast.senderColor }}>
            {toast.senderInitial}
          </div>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openConv(toast.convId, toast.id)}>
            <p className="text-sm font-medium text-text-primary">{toast.senderName}</p>
            <p className="text-xs text-text-muted truncate">{toast.text || '📎 Attachment'}</p>
          </div>
          <button onClick={() => dismiss(toast.id)} className="shrink-0 text-text-muted hover:text-text-primary transition-colors mt-0.5">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

export default function AppLayout() {
  const { hideTitleBar } = useAppSettings()
  return (
    <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">
      {isTauri && !hideTitleBar && <TitleBar />}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 min-h-0 h-full overflow-hidden flex flex-col">
          <Outlet />
        </main>
      </div>
      <NotificationManager />
    </div>
  )
}

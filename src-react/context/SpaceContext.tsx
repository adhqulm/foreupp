import { createContext, useContext, useEffect, useState, useRef } from 'react'
import {
  collection, doc, onSnapshot, query, where,
  addDoc, updateDoc, getDocs, getDoc, arrayUnion, deleteField
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './AuthContext'
import { readCache, writeCache, invalidateCache, clearSpaceCache } from '../lib/cache'
import type { CalendarEvent, SubCalendar, Tracker, TrackerEntry, Countdown, UserProfile, Space, KanbanBoard, KanbanColumn, KanbanCard, Message, MessageAttachment, Conversation } from '../types'

interface SpaceContextValue {
  spaceId: string | null
  partner: UserProfile | null
  members: Record<string, UserProfile>
  events: CalendarEvent[]
  subCalendars: SubCalendar[]
  trackers: Tracker[]
  trackerEntries: TrackerEntry[]
  countdowns: Countdown[]
  addEvent: (event: Omit<CalendarEvent, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => Promise<void>
  updateEvent: (id: string, data: Partial<CalendarEvent>) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  addSubCalendar: (sub: Omit<SubCalendar, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => Promise<void>
  updateSubCalendar: (id: string, data: Partial<SubCalendar>) => Promise<void>
  deleteSubCalendar: (id: string) => Promise<void>
  addTracker: (tracker: Omit<Tracker, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => Promise<void>
  updateTracker: (id: string, data: Partial<Tracker>) => Promise<void>
  deleteTracker: (id: string) => Promise<void>
  setTrackerEntry: (entry: Omit<TrackerEntry, 'id' | 'spaceId' | 'createdBy'>) => Promise<void>
  addCountdown: (countdown: Omit<Countdown, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => Promise<void>
  updateCountdown: (id: string, data: Partial<Countdown>) => Promise<void>
  deleteCountdown: (id: string) => Promise<void>
  kanbanBoards: KanbanBoard[]
  kanbanColumns: KanbanColumn[]
  kanbanCards: KanbanCard[]
  addKanbanBoard: (board: Omit<KanbanBoard, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => Promise<string>
  updateKanbanBoard: (id: string, data: Partial<KanbanBoard>) => Promise<void>
  deleteKanbanBoard: (id: string) => Promise<void>
  addKanbanColumn: (col: Omit<KanbanColumn, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => Promise<void>
  updateKanbanColumn: (id: string, data: Partial<KanbanColumn>) => Promise<void>
  deleteKanbanColumn: (id: string) => Promise<void>
  addKanbanCard: (card: Omit<KanbanCard, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => Promise<void>
  updateKanbanCard: (id: string, data: Partial<KanbanCard>) => Promise<void>
  deleteKanbanCard: (id: string) => Promise<void>
  joinSpace: (inviteCode: string) => Promise<{ success: boolean; error?: string }>
  leaveSpace: (deleteOthersEntries: boolean) => Promise<void>
  createSpace: () => Promise<void>
  messages: Message[]
  partnerTyping: boolean
  conversations: Conversation[]
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  getOrCreateDM: (partnerUid: string) => Promise<string>
  createGroup: (name: string, memberIds: string[]) => Promise<string>
  sendMessage: (conversationId: string, text: string, attachments?: MessageAttachment[]) => Promise<void>
  deleteMessage: (id: string) => Promise<void>
  reactToMessage: (id: string, emoji: string) => Promise<void>
  markMessagesRead: (messageIds: string[]) => Promise<void>
  setTyping: () => Promise<void>
  updateConversation: (id: string, data: Partial<Conversation>) => Promise<void>
  leaveGroup: (conversationId: string) => Promise<void>
}

const SpaceContext = createContext<SpaceContextValue | null>(null)

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const { user, userProfile } = useAuth()
  const [spaceId, setSpaceId] = useState<string | null>(null)
  const [partner, setPartner] = useState<UserProfile | null>(null)
  const [members, setMembers] = useState<Record<string, UserProfile>>({})

  // Initialise state from localStorage cache for instant render, then
  // onSnapshot will overwrite with live data as soon as it arrives.
  const [events, setEvents] = useState<CalendarEvent[]>(() =>
    readCache<CalendarEvent[]>('events', userProfile?.spaceId ?? '') ?? [])
  const [subCalendars, setSubCalendars] = useState<SubCalendar[]>(() =>
    readCache<SubCalendar[]>('subCalendars', userProfile?.spaceId ?? '') ?? [])
  const [trackers, setTrackers] = useState<Tracker[]>(() =>
    readCache<Tracker[]>('trackers', userProfile?.spaceId ?? '') ?? [])
  const [trackerEntries, setTrackerEntries] = useState<TrackerEntry[]>(() =>
    readCache<TrackerEntry[]>('trackerEntries', userProfile?.spaceId ?? '') ?? [])
  const [countdowns, setCountdowns] = useState<Countdown[]>(() =>
    readCache<Countdown[]>('countdowns', userProfile?.spaceId ?? '') ?? [])
  const [kanbanBoards, setKanbanBoards] = useState<KanbanBoard[]>(() =>
    readCache<KanbanBoard[]>('kanbanBoards', userProfile?.spaceId ?? '') ?? [])
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>(() =>
    readCache<KanbanColumn[]>('kanbanColumns', userProfile?.spaceId ?? '') ?? [])
  const [kanbanCards, setKanbanCards] = useState<KanbanCard[]>(() =>
    readCache<KanbanCard[]>('kanbanCards', userProfile?.spaceId ?? '') ?? [])
  const [messages, setMessages] = useState<Message[]>([])
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resolve space and partner
  useEffect(() => {
    if (!user || !userProfile) return
    const sid = userProfile.spaceId
    if (!sid) { setSpaceId(null); return }
    setSpaceId(sid)

    // Fetch all space members' profiles
    const spaceRef = doc(db, 'spaces', sid)
    getDoc(spaceRef).then(async (snap) => {
      if (!snap.exists()) return
      const space = snap.data() as Space
      const profiles: Record<string, UserProfile> = {}
      await Promise.all(space.members.map(async (uid) => {
        const pSnap = await getDoc(doc(db, 'users', uid))
        if (pSnap.exists()) profiles[uid] = pSnap.data() as UserProfile
      }))
      setMembers(profiles)
      // Keep partner pointing to the first non-self member for UI that needs it
      const partnerProfile = Object.values(profiles).find(p => p.uid !== user.uid)
      setPartner(partnerProfile ?? null)
    })
  }, [user, userProfile?.spaceId])

  // Update lastSeen on mount and when window regains focus
  useEffect(() => {
    if (!user) return
    const update = () => updateDoc(doc(db, 'users', user.uid), { lastSeen: Date.now() })
    update()
    window.addEventListener('focus', update)
    return () => window.removeEventListener('focus', update)
  }, [user])

  // Real-time events — write to cache on every snapshot
  useEffect(() => {
    if (!spaceId) { setEvents([]); return }
    const q = query(collection(db, 'events'), where('spaceId', '==', spaceId))
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent))
      setEvents(data)
      writeCache('events', spaceId, data)
    })
  }, [spaceId])

  // Real-time sub-calendars
  useEffect(() => {
    if (!spaceId) { setSubCalendars([]); return }
    const q = query(collection(db, 'subCalendars'), where('spaceId', '==', spaceId))
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as SubCalendar))
      setSubCalendars(data)
      writeCache('subCalendars', spaceId, data)
    })
  }, [spaceId])

  // Real-time trackers
  useEffect(() => {
    if (!spaceId) { setTrackers([]); return }
    const q = query(collection(db, 'trackers'), where('spaceId', '==', spaceId))
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tracker))
      setTrackers(data)
      writeCache('trackers', spaceId, data)
    })
  }, [spaceId])

  // Real-time tracker entries
  useEffect(() => {
    if (!spaceId) { setTrackerEntries([]); return }
    const q = query(collection(db, 'trackerEntries'), where('spaceId', '==', spaceId))
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as TrackerEntry))
      setTrackerEntries(data)
      writeCache('trackerEntries', spaceId, data)
    })
  }, [spaceId])

  // Real-time countdowns
  useEffect(() => {
    if (!spaceId) { setCountdowns([]); return }
    const q = query(collection(db, 'countdowns'), where('spaceId', '==', spaceId))
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Countdown))
      setCountdowns(data)
      writeCache('countdowns', spaceId, data)
    })
  }, [spaceId])

  // Real-time kanban boards
  useEffect(() => {
    if (!spaceId) { setKanbanBoards([]); return }
    const q = query(collection(db, 'kanbanBoards'), where('spaceId', '==', spaceId))
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as KanbanBoard))
      setKanbanBoards(data)
      writeCache('kanbanBoards', spaceId, data)
    })
  }, [spaceId])

  // Real-time kanban columns
  useEffect(() => {
    if (!spaceId) { setKanbanColumns([]); return }
    const q = query(collection(db, 'kanbanColumns'), where('spaceId', '==', spaceId))
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as KanbanColumn))
      setKanbanColumns(data)
      writeCache('kanbanColumns', spaceId, data)
    })
  }, [spaceId])

  // Real-time kanban cards
  useEffect(() => {
    if (!spaceId) { setKanbanCards([]); return }
    const q = query(collection(db, 'kanbanCards'), where('spaceId', '==', spaceId))
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as KanbanCard))
      setKanbanCards(data)
      writeCache('kanbanCards', spaceId, data)
    })
  }, [spaceId])

  // Real-time conversations
  useEffect(() => {
    if (!spaceId || !user) { setConversations([]); return }
    const q = query(
      collection(db, 'conversations'),
      where('spaceId', '==', spaceId),
      where('memberIds', 'array-contains', user.uid)
    )
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Conversation))
      setConversations(data)
    })
  }, [spaceId, user])

  // Real-time messages — scoped to active conversation
  useEffect(() => {
    if (!activeConversationId) { setMessages([]); return }
    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', activeConversationId)
    )
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message))
      data.sort((a, b) => a.createdAt - b.createdAt)
      setMessages(data)
    })
  }, [activeConversationId])

  // Typing indicator
  useEffect(() => {
    if (!spaceId || !user) return
    return onSnapshot(doc(db, 'spaces', spaceId), (snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      const typing = data.typing ?? {}
      const now = Date.now()
      const isPartnerTyping = Object.entries(typing).some(
        ([uid, ts]) => uid !== user.uid && (now - (ts as number)) < 4000
      )
      if (isPartnerTyping) {
        setPartnerTyping(true)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 4000)
      } else {
        setPartnerTyping(false)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      }
    })
  }, [spaceId, user])

  const createSpace = async () => {
    if (!user) return
    const spaceRef = await addDoc(collection(db, 'spaces'), {
      members: [user.uid],
      createdAt: Date.now()
    })
    await updateDoc(doc(db, 'users', user.uid), { spaceId: spaceRef.id })
    await addDoc(collection(db, 'subCalendars'), {
      name: 'My Calendar',
      color: '#7c3aed',
      spaceId: spaceRef.id,
      createdBy: user.uid,
      createdAt: Date.now()
    })
  }

  const addKanbanBoard = async (board: Omit<KanbanBoard, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => {
    if (!user || !spaceId) return ''
    invalidateCache('kanbanBoards', spaceId)
    const ref = await addDoc(collection(db, 'kanbanBoards'), { ...board, spaceId, createdBy: user.uid, createdAt: Date.now() })
    return ref.id
  }

  const updateKanbanBoard = async (id: string, data: Partial<KanbanBoard>) => {
    if (spaceId) invalidateCache('kanbanBoards', spaceId)
    await updateDoc(doc(db, 'kanbanBoards', id), data)
  }

  const deleteKanbanBoard = async (id: string) => {
    if (spaceId) invalidateCache('kanbanBoards', spaceId)
    const { deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'kanbanBoards', id))
  }

  const addKanbanColumn = async (col: Omit<KanbanColumn, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => {
    if (!user || !spaceId) return
    invalidateCache('kanbanColumns', spaceId)
    await addDoc(collection(db, 'kanbanColumns'), { ...col, spaceId, createdBy: user.uid, createdAt: Date.now() })
  }

  const updateKanbanColumn = async (id: string, data: Partial<KanbanColumn>) => {
    if (spaceId) invalidateCache('kanbanColumns', spaceId)
    await updateDoc(doc(db, 'kanbanColumns', id), data)
  }

  const deleteKanbanColumn = async (id: string) => {
    if (spaceId) invalidateCache('kanbanColumns', spaceId)
    const { deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'kanbanColumns', id))
  }

  const addKanbanCard = async (card: Omit<KanbanCard, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => {
    if (!user || !spaceId) return
    invalidateCache('kanbanCards', spaceId)
    await addDoc(collection(db, 'kanbanCards'), { ...card, spaceId, createdBy: user.uid, createdAt: Date.now() })
  }

  const updateKanbanCard = async (id: string, data: Partial<KanbanCard>) => {
    if (spaceId) invalidateCache('kanbanCards', spaceId)
    await updateDoc(doc(db, 'kanbanCards', id), data)
  }

  const deleteKanbanCard = async (id: string) => {
    if (spaceId) invalidateCache('kanbanCards', spaceId)
    const { deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'kanbanCards', id))
  }

  const joinSpace = async (inviteCode: string) => {
    if (!user) return { success: false, error: 'Not authenticated' }
    const code = inviteCode.trim().toUpperCase()
    const q = query(collection(db, 'users'), where('inviteCode', '==', code))
    const snap = await getDocs(q)
    if (snap.empty) return { success: false, error: 'Invalid invite code' }
    const partnerDoc = snap.docs[0]
    if (partnerDoc.id === user.uid) return { success: false, error: "That's your own invite code!" }
    const partnerData = partnerDoc.data() as UserProfile
    if (!partnerData.spaceId) return { success: false, error: 'Partner has not set up their space yet' }
    const spaceSnap = await getDoc(doc(db, 'spaces', partnerData.spaceId))
    if (!spaceSnap.exists()) return { success: false, error: 'Space not found' }
    const spaceData = spaceSnap.data() as Space
    if (spaceData.members.length >= 2) return { success: false, error: 'Space is already full' }
    await updateDoc(doc(db, 'spaces', partnerData.spaceId), { members: arrayUnion(user.uid) })
    await updateDoc(doc(db, 'users', user.uid), { spaceId: partnerData.spaceId })
    return { success: true }
  }

  const leaveSpace = async (deleteOthersEntries: boolean) => {
    if (!user || !spaceId) return
    const { deleteDoc, arrayRemove } = await import('firebase/firestore')

    if (deleteOthersEntries) {
      // Delete all data in this space NOT created by the current user
      const collections = ['events', 'subCalendars', 'trackers', 'trackerEntries', 'countdowns']
      await Promise.all(collections.map(async (col) => {
        const q = query(collection(db, col), where('spaceId', '==', spaceId), where('createdBy', '!=', user.uid))
        const snap = await getDocs(q)
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
      }))
    }

    // Remove user from space members and clear their spaceId
    await updateDoc(doc(db, 'spaces', spaceId), { members: arrayRemove(user.uid) })
    await updateDoc(doc(db, 'users', user.uid), { spaceId: null })
    clearSpaceCache(spaceId)
  }

  const addEvent = async (event: Omit<CalendarEvent, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => {
    if (!user || !spaceId) return
    invalidateCache('events', spaceId)
    await addDoc(collection(db, 'events'), {
      ...event,
      spaceId,
      createdBy: user.uid,
      createdAt: Date.now()
    })
  }

  const updateEvent = async (id: string, data: Partial<CalendarEvent>) => {
    if (spaceId) invalidateCache('events', spaceId)
    await updateDoc(doc(db, 'events', id), data)
  }

  const deleteEvent = async (id: string) => {
    if (spaceId) invalidateCache('events', spaceId)
    const { deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'events', id))
  }

  const addSubCalendar = async (sub: Omit<SubCalendar, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => {
    if (!user || !spaceId) return
    invalidateCache('subCalendars', spaceId)
    await addDoc(collection(db, 'subCalendars'), { ...sub, spaceId, createdBy: user.uid, createdAt: Date.now() })
  }

  const updateSubCalendar = async (id: string, data: Partial<SubCalendar>) => {
    if (spaceId) invalidateCache('subCalendars', spaceId)
    await updateDoc(doc(db, 'subCalendars', id), data)
  }

  const deleteSubCalendar = async (id: string) => {
    if (spaceId) invalidateCache('subCalendars', spaceId)
    const { deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'subCalendars', id))
  }

  const addTracker = async (tracker: Omit<Tracker, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => {
    if (!user || !spaceId) return
    invalidateCache('trackers', spaceId)
    await addDoc(collection(db, 'trackers'), {
      ...tracker,
      spaceId,
      createdBy: user.uid,
      createdAt: Date.now()
    })
  }

  const updateTracker = async (id: string, data: Partial<Tracker>) => {
    if (spaceId) invalidateCache('trackers', spaceId)
    await updateDoc(doc(db, 'trackers', id), data)
  }

  const deleteTracker = async (id: string) => {
    if (spaceId) invalidateCache('trackers', spaceId)
    const { deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'trackers', id))
  }

  const setTrackerEntry = async (entry: Omit<TrackerEntry, 'id' | 'spaceId' | 'createdBy'>) => {
    if (!user || !spaceId) return
    invalidateCache('trackerEntries', spaceId)
    const q = query(
      collection(db, 'trackerEntries'),
      where('spaceId', '==', spaceId),
      where('trackerId', '==', entry.trackerId),
      where('date', '==', entry.date),
      where('createdBy', '==', user.uid)
    )
    const snap = await getDocs(q)
    if (!snap.empty) {
      await updateDoc(doc(db, 'trackerEntries', snap.docs[0].id), { value: entry.value, note: entry.note ?? null })
    } else {
      await addDoc(collection(db, 'trackerEntries'), {
        ...entry,
        spaceId,
        createdBy: user.uid
      })
    }
  }

  const addCountdown = async (countdown: Omit<Countdown, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => {
    if (!user || !spaceId) return
    invalidateCache('countdowns', spaceId)
    await addDoc(collection(db, 'countdowns'), {
      ...countdown,
      spaceId,
      createdBy: user.uid,
      createdAt: Date.now()
    })
  }

  const updateCountdown = async (id: string, data: Partial<Countdown>) => {
    if (spaceId) invalidateCache('countdowns', spaceId)
    await updateDoc(doc(db, 'countdowns', id), data)
  }

  const deleteCountdown = async (id: string) => {
    if (spaceId) invalidateCache('countdowns', spaceId)
    const { deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'countdowns', id))
  }

  const getOrCreateDM = async (partnerUid: string): Promise<string> => {
    if (!user || !spaceId) return ''
    // Look for an existing DM conversation between these two users in this space
    const q = query(
      collection(db, 'conversations'),
      where('spaceId', '==', spaceId),
      where('type', '==', 'dm'),
      where('memberIds', 'array-contains', user.uid)
    )
    const snap = await getDocs(q)
    const existing = snap.docs.find(d => {
      const data = d.data() as Conversation
      return data.memberIds.includes(partnerUid)
    })
    if (existing) return existing.id
    // Create a new DM conversation
    const ref = await addDoc(collection(db, 'conversations'), {
      spaceId,
      type: 'dm',
      memberIds: [user.uid, partnerUid],
      lastMessageAt: Date.now(),
      lastMessageText: ''
    })
    return ref.id
  }

  const createGroup = async (name: string, memberIds: string[]): Promise<string> => {
    if (!user || !spaceId) return ''
    // Always include current user in the group
    const allMembers = Array.from(new Set([user.uid, ...memberIds]))
    const ref = await addDoc(collection(db, 'conversations'), {
      spaceId,
      type: 'group',
      name,
      memberIds: allMembers,
      createdBy: user.uid,
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      lastMessageText: ''
    })
    return ref.id
  }

  const updateConversation = async (id: string, data: Partial<Conversation>) => {
    await updateDoc(doc(db, 'conversations', id), data)
  }

  const leaveGroup = async (conversationId: string) => {
    if (!user) return
    const conv = conversations.find(c => c.id === conversationId)
    if (!conv) return
    const newMembers = conv.memberIds.filter(uid => uid !== user.uid)
    if (newMembers.length === 0) {
      const { deleteDoc } = await import('firebase/firestore')
      await deleteDoc(doc(db, 'conversations', conversationId))
    } else {
      await updateDoc(doc(db, 'conversations', conversationId), { memberIds: newMembers })
    }
    if (activeConversationId === conversationId) setActiveConversationId(null)
  }

  const sendMessage = async (conversationId: string, text: string, attachments?: MessageAttachment[]) => {
    if (!user || !spaceId || !conversationId) return
    const now = Date.now()
    await addDoc(collection(db, 'messages'), {
      spaceId,
      conversationId,
      senderId: user.uid,
      text,
      createdAt: now,
      readBy: [user.uid],
      reactions: {},
      ...(attachments && attachments.length > 0 ? { attachments } : {})
    })
    // Update conversation's last message info
    await updateDoc(doc(db, 'conversations', conversationId), {
      lastMessageAt: now,
      lastMessageText: text.slice(0, 60)
    })
  }

  const deleteMessage = async (id: string) => {
    if (!spaceId) return
    const { deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'messages', id))
  }

  const reactToMessage = async (id: string, emoji: string) => {
    if (!user) return
    const msg = messages.find(m => m.id === id)
    if (!msg) return
    if (msg.reactions[user.uid] === emoji) {
      await updateDoc(doc(db, 'messages', id), { [`reactions.${user.uid}`]: deleteField() })
    } else {
      await updateDoc(doc(db, 'messages', id), { [`reactions.${user.uid}`]: emoji })
    }
  }

  const markMessagesRead = async (messageIds: string[]) => {
    if (!user || messageIds.length === 0) return
    await Promise.all(messageIds.map(id =>
      updateDoc(doc(db, 'messages', id), { readBy: arrayUnion(user.uid) })
    ))
  }

  const setTyping = async () => {
    if (!user || !spaceId) return
    await updateDoc(doc(db, 'spaces', spaceId), { [`typing.${user.uid}`]: Date.now() })
  }

  // Clear all cached space data on sign-out
  useEffect(() => {
    if (!user && spaceId) {
      clearSpaceCache(spaceId)
    }
  }, [user])

  return (
    <SpaceContext.Provider value={{
      spaceId, partner, members, events, subCalendars, trackers, trackerEntries, countdowns,
      addEvent, updateEvent, deleteEvent,
      addSubCalendar, updateSubCalendar, deleteSubCalendar,
      addTracker, updateTracker, deleteTracker, setTrackerEntry,
      addCountdown, updateCountdown, deleteCountdown,
      kanbanBoards, kanbanColumns, kanbanCards,
      addKanbanBoard, updateKanbanBoard, deleteKanbanBoard,
      addKanbanColumn, updateKanbanColumn, deleteKanbanColumn,
      addKanbanCard, updateKanbanCard, deleteKanbanCard,
      joinSpace, leaveSpace, createSpace,
      messages, partnerTyping,
      conversations, activeConversationId, setActiveConversationId,
      getOrCreateDM, createGroup,
      sendMessage, deleteMessage, reactToMessage, markMessagesRead, setTyping,
      updateConversation, leaveGroup
    }}>
      {children}
    </SpaceContext.Provider>
  )
}

export function useSpace() {
  const ctx = useContext(SpaceContext)
  if (!ctx) throw new Error('useSpace must be used within SpaceProvider')
  return ctx
}

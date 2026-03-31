import { createContext, useContext, useEffect, useState } from 'react'
import {
  collection, doc, onSnapshot, query, where,
  addDoc, updateDoc, getDocs, getDoc, arrayUnion
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './AuthContext'
import type { CalendarEvent, Tracker, TrackerEntry, Countdown, UserProfile, Space } from '../types'

interface SpaceContextValue {
  spaceId: string | null
  partner: UserProfile | null
  events: CalendarEvent[]
  trackers: Tracker[]
  trackerEntries: TrackerEntry[]
  countdowns: Countdown[]
  addEvent: (event: Omit<CalendarEvent, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => Promise<void>
  updateEvent: (id: string, data: Partial<CalendarEvent>) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  addTracker: (tracker: Omit<Tracker, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => Promise<void>
  deleteTracker: (id: string) => Promise<void>
  setTrackerEntry: (entry: Omit<TrackerEntry, 'id' | 'spaceId' | 'createdBy'>) => Promise<void>
  addCountdown: (countdown: Omit<Countdown, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => Promise<void>
  deleteCountdown: (id: string) => Promise<void>
  joinSpace: (inviteCode: string) => Promise<{ success: boolean; error?: string }>
  createSpace: () => Promise<void>
}

const SpaceContext = createContext<SpaceContextValue | null>(null)

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const { user, userProfile } = useAuth()
  const [spaceId, setSpaceId] = useState<string | null>(null)
  const [partner, setPartner] = useState<UserProfile | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [trackers, setTrackers] = useState<Tracker[]>([])
  const [trackerEntries, setTrackerEntries] = useState<TrackerEntry[]>([])
  const [countdowns, setCountdowns] = useState<Countdown[]>([])

  // Resolve space and partner
  useEffect(() => {
    if (!user || !userProfile) return
    const sid = userProfile.spaceId
    if (!sid) { setSpaceId(null); return }
    setSpaceId(sid)

    // Get partner
    const spaceRef = doc(db, 'spaces', sid)
    getDoc(spaceRef).then((snap) => {
      if (!snap.exists()) return
      const space = snap.data() as Space
      const partnerId = space.members.find(id => id !== user.uid)
      if (!partnerId) return
      getDoc(doc(db, 'users', partnerId)).then((pSnap) => {
        if (pSnap.exists()) setPartner(pSnap.data() as UserProfile)
      })
    })
  }, [user, userProfile?.spaceId])

  // Real-time events
  useEffect(() => {
    if (!spaceId) { setEvents([]); return }
    const q = query(collection(db, 'events'), where('spaceId', '==', spaceId))
    return onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent)))
    })
  }, [spaceId])

  // Real-time trackers
  useEffect(() => {
    if (!spaceId) { setTrackers([]); return }
    const q = query(collection(db, 'trackers'), where('spaceId', '==', spaceId))
    return onSnapshot(q, (snap) => {
      setTrackers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tracker)))
    })
  }, [spaceId])

  // Real-time tracker entries (last 90 days)
  useEffect(() => {
    if (!spaceId) { setTrackerEntries([]); return }
    const q = query(collection(db, 'trackerEntries'), where('spaceId', '==', spaceId))
    return onSnapshot(q, (snap) => {
      setTrackerEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as TrackerEntry)))
    })
  }, [spaceId])

  // Real-time countdowns
  useEffect(() => {
    if (!spaceId) { setCountdowns([]); return }
    const q = query(collection(db, 'countdowns'), where('spaceId', '==', spaceId))
    return onSnapshot(q, (snap) => {
      setCountdowns(snap.docs.map(d => ({ id: d.id, ...d.data() } as Countdown)))
    })
  }, [spaceId])

  const createSpace = async () => {
    if (!user) return
    const spaceRef = await addDoc(collection(db, 'spaces'), {
      members: [user.uid],
      createdAt: Date.now()
    })
    await updateDoc(doc(db, 'users', user.uid), { spaceId: spaceRef.id })
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

  const addEvent = async (event: Omit<CalendarEvent, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => {
    if (!user || !spaceId) return
    await addDoc(collection(db, 'events'), {
      ...event,
      spaceId,
      createdBy: user.uid,
      createdAt: Date.now()
    })
  }

  const updateEvent = async (id: string, data: Partial<CalendarEvent>) => {
    await updateDoc(doc(db, 'events', id), data)
  }

  const deleteEvent = async (id: string) => {
    const { deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'events', id))
  }

  const addTracker = async (tracker: Omit<Tracker, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => {
    if (!user || !spaceId) return
    await addDoc(collection(db, 'trackers'), {
      ...tracker,
      spaceId,
      createdBy: user.uid,
      createdAt: Date.now()
    })
  }

  const deleteTracker = async (id: string) => {
    const { deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'trackers', id))
  }

  const setTrackerEntry = async (entry: Omit<TrackerEntry, 'id' | 'spaceId' | 'createdBy'>) => {
    if (!user || !spaceId) return
    // Check if entry for this tracker+date+user already exists
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
    await addDoc(collection(db, 'countdowns'), {
      ...countdown,
      spaceId,
      createdBy: user.uid,
      createdAt: Date.now()
    })
  }

  const deleteCountdown = async (id: string) => {
    const { deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'countdowns', id))
  }

  return (
    <SpaceContext.Provider value={{
      spaceId, partner, events, trackers, trackerEntries, countdowns,
      addEvent, updateEvent, deleteEvent,
      addTracker, deleteTracker, setTrackerEntry,
      addCountdown, deleteCountdown,
      joinSpace, createSpace
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

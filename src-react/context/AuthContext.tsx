import { createContext, useContext, useEffect, useState } from 'react'
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updatePassword as firebaseUpdatePassword
} from 'firebase/auth'
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { UserProfile } from '../types'

const USER_COLORS = [
  '#7c3aed', '#6d28d9', '#ec4899', '#db2777',
  '#8b5cf6', '#a78bfa', '#f472b6', '#e879f9'
]

interface AuthContextValue {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (data: { displayName?: string; color?: string }) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  updatePhotoURL: (url: string | null) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (!firebaseUser) {
        setUserProfile(null)
        setLoading(false)
        return
      }
      // Listen to profile in real time
      const profileRef = doc(db, 'users', firebaseUser.uid)
      const unsubProfile = onSnapshot(profileRef, (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile)
        }
        setLoading(false)
      })
      return () => unsubProfile()
    })
    return () => unsubAuth()
  }, [])

  const signUp = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const color = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email,
      displayName,
      color,
      inviteCode
    })
    // Save to saved-accounts list
    try {
      const saved = JSON.parse(localStorage.getItem('saved-accounts') ?? '[]')
      const entry = { uid: cred.user.uid, email, displayName, photoURL: '', _p: btoa(password) }
      const filtered = saved.filter((a: any) => a.uid !== cred.user.uid)
      localStorage.setItem('saved-accounts', JSON.stringify([...filtered, entry]))
    } catch {}
  }

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    try {
      const profileSnap = await getDoc(doc(db, 'users', cred.user.uid))
      const profile = profileSnap.exists() ? profileSnap.data() : {}
      const saved = JSON.parse(localStorage.getItem('saved-accounts') ?? '[]')
      const entry = { uid: cred.user.uid, email, displayName: profile.displayName ?? email, photoURL: profile.photoURL ?? '', _p: btoa(password) }
      const filtered = saved.filter((a: any) => a.uid !== cred.user.uid)
      localStorage.setItem('saved-accounts', JSON.stringify([...filtered, entry]))
    } catch {}
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  const updateProfile = async (data: { displayName?: string; color?: string }) => {
    if (!user) return
    await updateDoc(doc(db, 'users', user.uid), data)
    // Update saved-accounts
    try {
      const saved = JSON.parse(localStorage.getItem('saved-accounts') ?? '[]')
      const updated = saved.map((a: any) => a.uid === user.uid ? { ...a, ...data } : a)
      localStorage.setItem('saved-accounts', JSON.stringify(updated))
    } catch {}
  }

  const updatePassword = async (newPassword: string) => {
    if (!user) return
    await firebaseUpdatePassword(user, newPassword)
  }

  const updatePhotoURL = async (url: string | null) => {
    if (!user) return
    await updateDoc(doc(db, 'users', user.uid), { photoURL: url ?? '' })
    // Update saved-accounts
    try {
      const saved = JSON.parse(localStorage.getItem('saved-accounts') ?? '[]')
      const updated = saved.map((a: any) => a.uid === user.uid ? { ...a, photoURL: url ?? '' } : a)
      localStorage.setItem('saved-accounts', JSON.stringify(updated))
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signUp, signIn, signOut, updateProfile, updatePassword, updatePhotoURL }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

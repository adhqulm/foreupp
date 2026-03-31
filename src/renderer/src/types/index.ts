export interface UserProfile {
  uid: string
  email: string
  displayName: string
  color: string
  spaceId?: string
  inviteCode?: string
}

export interface Space {
  id: string
  members: string[] // uid array (max 2)
  createdAt: number
}

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  date: string // ISO date string YYYY-MM-DD
  startTime?: string // HH:mm
  endTime?: string // HH:mm
  allDay: boolean
  color?: string
  createdBy: string // uid
  spaceId: string
  createdAt: number
  emoji?: string
}

export interface Tracker {
  id: string
  name: string
  description?: string
  emoji?: string
  color: string
  type: 'checkbox' | 'number' | 'rating' | 'text'
  unit?: string // for number type (e.g. "glasses", "km")
  maxRating?: number // for rating type
  createdBy: string
  spaceId: string
  createdAt: number
  isShared: boolean
}

export interface TrackerEntry {
  id: string
  trackerId: string
  date: string // YYYY-MM-DD
  value: boolean | number | string
  createdBy: string
  spaceId: string
  note?: string
}

export interface Countdown {
  id: string
  title: string
  emoji?: string
  color: string
  type: 'countdown' | 'countup'
  targetDate: string // ISO date string YYYY-MM-DD
  description?: string
  createdBy: string
  spaceId: string
  createdAt: number
}

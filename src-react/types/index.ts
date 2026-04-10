export interface UserProfile {
  uid: string
  email: string
  displayName: string
  color: string
  spaceId?: string
  inviteCode?: string
  photoURL?: string
  lastSeen?: number
  phone?: string
  bio?: string
}

export interface Space {
  id: string
  members: string[] // uid array (max 2)
  createdAt: number
}

export interface SubCalendar {
  id: string
  name: string
  color: string
  textColor?: 'white' | 'black'
  createdBy: string
  spaceId: string
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
  subCalendarId?: string
  subCalendarIds?: string[]
  createdBy: string // uid
  spaceId: string
  createdAt: number
  emoji?: string
  who?: string
  where?: string
  endDate?: string   // multi-day: inclusive end date YYYY-MM-DD (if different from date)
  attachments?: Array<{ name: string; url: string }>
  recurrence?: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly'
    interval: number
    days?: number[]
    endType: 'forever' | 'date' | 'count'
    endDate?: string
    endCount?: number
  }
}

export interface Tracker {
  id: string
  name: string
  description?: string
  emoji?: string
  color: string
  bgColor?: string
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
  displayFormat: 'days' | 'detailed'
  targetDate: string // ISO date string YYYY-MM-DD
  description?: string
  order?: number
  createdBy: string
  spaceId: string
  createdAt: number
}

export interface KanbanBoard {
  id: string
  title: string
  emoji?: string
  color: string
  description?: string
  boardType: 'kanban' | 'progress'
  createdBy: string
  spaceId: string
  createdAt: number
  order?: number
}

export interface KanbanColumn {
  id: string
  boardId: string
  title: string
  color?: string
  order: number
  createdBy: string
  spaceId: string
  createdAt: number
}

export interface KanbanChecklist {
  id: string
  text: string
  done: boolean
}

export interface KanbanTaskUpdate {
  id: string
  text: string
  createdBy: string
  createdAt: number
}

export interface KanbanCard {
  id: string
  columnId: string
  boardId: string
  title: string
  description?: string
  notes?: string
  order: number
  color?: string
  assignedTo?: string // uid — executor for progress tasks, assignee for kanban cards
  dueDate?: string // YYYY-MM-DD
  emoji?: string
  labels?: string[]
  progress?: number // 0-100
  checklist?: KanbanChecklist[]
  updates?: KanbanTaskUpdate[] // activity/update feed for progress tasks
  createdBy: string
  spaceId: string
  createdAt: number
}

export interface MessageAttachment {
  name: string
  url: string
  type: 'image' | 'file'
  size?: number
}

export interface Message {
  id: string
  spaceId: string
  conversationId: string
  senderId: string
  text: string
  createdAt: number
  readBy: string[]
  reactions: Record<string, string> // { [uid]: emoji }
  attachments?: MessageAttachment[]
  replyTo?: { id: string; text: string; senderName: string }
  pinnedBy?: string[]     // uids who have pinned this message
  deletedFor?: string[]   // uids for whom this message is deleted
  forwardedFrom?: string  // original message id if forwarded
}

export interface Conversation {
  id: string
  spaceId: string
  type: 'dm' | 'group'
  memberIds: string[]
  name?: string
  lastMessageAt?: number
  lastMessageText?: string
  createdBy?: string
  photoURL?: string
  pinnedBy?: string[]   // uids who pinned this chat
  mutedBy?: string[]    // uids who muted this chat
  unreadFor?: string[]  // uids who marked this chat as unread
}

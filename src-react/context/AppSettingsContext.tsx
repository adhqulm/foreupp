import { createContext, useContext, useState } from 'react'

interface AppSettings {
  highlightWeekends: boolean
  language: string
  timezone: string
  calendarName: string
  weekendColor: string
  use24Hour: boolean
  setHighlightWeekends: (v: boolean) => void
  setLanguage: (v: string) => void
  setTimezone: (v: string) => void
  setCalendarName: (v: string) => void
  setWeekendColor: (v: string) => void
  setUse24Hour: (v: boolean) => void
}

const STORAGE_KEY = 'app-settings'

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

function saveSettings(partial: Record<string, unknown>) {
  try {
    const existing = loadSettings()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...partial }))
  } catch {}
}

const AppSettingsContext = createContext<AppSettings | null>(null)

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const stored = loadSettings()

  const [highlightWeekends, setHighlightWeekendsState] = useState<boolean>(
    stored.highlightWeekends !== undefined ? stored.highlightWeekends : true
  )
  const [language, setLanguageState] = useState<string>(stored.language ?? 'en')
  const [timezone, setTimezoneState] = useState<string>(stored.timezone ?? 'UTC')
  const [calendarName, setCalendarNameState] = useState<string>(stored.calendarName ?? 'My Calendar')
  const [weekendColor, setWeekendColorState] = useState<string>(stored.weekendColor ?? '#dbeafe')
  const [use24Hour, setUse24HourState] = useState<boolean>(stored.use24Hour ?? false)

  const setHighlightWeekends = (v: boolean) => {
    setHighlightWeekendsState(v)
    saveSettings({ highlightWeekends: v })
  }
  const setLanguage = (v: string) => {
    setLanguageState(v)
    saveSettings({ language: v })
  }
  const setTimezone = (v: string) => {
    setTimezoneState(v)
    saveSettings({ timezone: v })
  }
  const setCalendarName = (v: string) => {
    setCalendarNameState(v)
    saveSettings({ calendarName: v })
  }
  const setWeekendColor = (v: string) => {
    setWeekendColorState(v)
    saveSettings({ weekendColor: v })
  }
  const setUse24Hour = (v: boolean) => {
    setUse24HourState(v)
    saveSettings({ use24Hour: v })
  }

  return (
    <AppSettingsContext.Provider value={{
      highlightWeekends, language, timezone, calendarName, weekendColor, use24Hour,
      setHighlightWeekends, setLanguage, setTimezone, setCalendarName, setWeekendColor, setUse24Hour
    }}>
      {children}
    </AppSettingsContext.Provider>
  )
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext)
  if (!ctx) throw new Error('useAppSettings must be used within AppSettingsProvider')
  return ctx
}

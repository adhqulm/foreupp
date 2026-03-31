import { createContext, useContext, useEffect, useState } from 'react'

export interface Theme {
  hue: number
  mode: 'light' | 'dark' | 'white'
}

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(hue: number, mode: 'light' | 'dark' | 'white') {
  const h = Math.round(hue)
  const root = document.documentElement
  const set = (k: string, v: string) => root.style.setProperty(k, v)

  if (mode === 'white') {
    set('--bg-primary',      '0 0% 100%')
    set('--bg-secondary',    '0 0% 96%')
    set('--bg-tertiary',     '0 0% 92%')
    set('--bg-calendar',     '0 0% 100%')
    set('--surface',         '0 0% 94%')
    set('--surface-hover',   '0 0% 89%')
    set('--surface-active',  '0 0% 84%')
    set('--border',          '0 0% 78%')
    set('--border-subtle',   '0 0% 88%')
    set('--text-primary',    '0 0% 8%')
    set('--text-secondary',  '0 0% 35%')
    set('--text-muted',      '0 0% 52%')
    set('--accent-50',       '0 0% 97%')
    set('--accent-100',      '0 0% 92%')
    set('--accent-200',      '0 0% 82%')
    set('--accent-300',      '0 0% 68%')
    set('--accent-400',      '0 0% 55%')
    set('--accent-500',      '0 0% 42%')
    set('--accent-600',      '0 0% 32%')
    set('--accent-700',      '0 0% 24%')
    set('--accent-800',      '0 0% 16%')
    set('--accent-900',      '0 0% 10%')
    return
  }

  if (mode === 'light') {
    set('--bg-primary',      `${h} 28% 97%`)
    set('--bg-secondary',    `${h} 24% 93%`)
    set('--bg-tertiary',     `${h} 20% 88%`)
    set('--bg-calendar',     `${h} 12% 99%`)
    set('--surface',         `${h} 22% 91%`)
    set('--surface-hover',   `${h} 22% 86%`)
    set('--surface-active',  `${h} 22% 81%`)
    set('--border',          `${h} 30% 68%`)
    set('--border-subtle',   `${h} 24% 82%`)
    set('--text-primary',    `${h} 45% 10%`)
    set('--text-secondary',  `${h} 38% 35%`)
    set('--text-muted',      `${h} 28% 52%`)
    set('--accent-50',       `${h} 42% 96%`)
    set('--accent-100',      `${h} 44% 90%`)
    set('--accent-200',      `${h} 46% 78%`)
    set('--accent-300',      `${h} 48% 65%`)
    set('--accent-400',      `${h} 50% 53%`)
    set('--accent-500',      `${h} 53% 43%`)
    set('--accent-600',      `${h} 55% 34%`)
    set('--accent-700',      `${h} 55% 27%`)
    set('--accent-800',      `${h} 52% 20%`)
    set('--accent-900',      `${h} 48% 14%`)
  } else {
    set('--bg-primary',      `${h} 20% 8%`)
    set('--bg-secondary',    `${h} 18% 12%`)
    set('--bg-tertiary',     `${h} 16% 16%`)
    set('--bg-calendar',     `${h} 16% 20%`)
    set('--surface',         `${h} 17% 14%`)
    set('--surface-hover',   `${h} 17% 19%`)
    set('--surface-active',  `${h} 17% 23%`)
    set('--border',          `${h} 20% 27%`)
    set('--border-subtle',   `${h} 18% 19%`)
    set('--text-primary',    `${h} 15% 92%`)
    set('--text-secondary',  `${h} 12% 62%`)
    set('--text-muted',      `${h} 10% 42%`)
    set('--accent-50',       `${h} 42% 97%`)
    set('--accent-100',      `${h} 44% 90%`)
    set('--accent-200',      `${h} 48% 80%`)
    set('--accent-300',      `${h} 52% 68%`)
    set('--accent-400',      `${h} 56% 62%`)
    set('--accent-500',      `${h} 60% 58%`)
    set('--accent-600',      `${h} 62% 58%`)
    set('--accent-700',      `${h} 60% 48%`)
    set('--accent-800',      `${h} 55% 34%`)
    set('--accent-900',      `${h} 50% 23%`)
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('app-theme')
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return { hue: 30, mode: 'light' }
  })

  useEffect(() => {
    applyTheme(theme.hue, theme.mode)
    localStorage.setItem('app-theme', JSON.stringify(theme))
  }, [theme.hue, theme.mode])

  const setTheme = (t: Theme) => setThemeState(t)

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

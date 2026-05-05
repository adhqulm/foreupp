import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, RotateCcw, SkipForward, Settings, X, Check } from 'lucide-react'
import clsx from 'clsx'

type Mode = 'focus' | 'short' | 'long'

interface Session { mode: Mode; completedAt: number; duration: number }

const DEFAULT_DURATIONS: Record<Mode, number> = { focus: 25, short: 5, long: 15 }
const MODE_LABELS: Record<Mode, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' }
const ACCENT = 'hsl(var(--accent-500))'

function pad(n: number) { return String(n).padStart(2, '0') }
function formatTime(s: number) { return `${pad(Math.floor(s / 60))}:${pad(s % 60)}` }

export default function PomodoroPage() {
  const [durations, setDurations] = useState<Record<Mode, number>>(() => {
    try { return JSON.parse(localStorage.getItem('pomodoro-durations') ?? 'null') || DEFAULT_DURATIONS } catch { return DEFAULT_DURATIONS }
  })
  const [mode, setMode] = useState<Mode>('focus')
  const [secondsLeft, setSecondsLeft] = useState(durations.focus * 60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState<Session[]>(() => {
    try { return JSON.parse(localStorage.getItem('pomodoro-sessions') ?? '[]') } catch { return [] }
  })
  const [showSettings, setShowSettings] = useState(false)
  const [settingDraft, setSettingDraft] = useState(durations)
  const [focusCount, setFocusCount] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const modeRef = useRef(mode)
  modeRef.current = mode
  // endTime: absolute timestamp when the current session will finish
  const endTimeRef = useRef<number | null>(null)

  const stopTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    endTimeRef.current = null
    localStorage.removeItem('pomodoro-running')
  }, [])

  const total = durations[mode] * 60
  const progress = 1 - secondsLeft / total

  // Restore running timer after navigation
  useEffect(() => {
    const saved = localStorage.getItem('pomodoro-running')
    if (!saved) return
    try {
      const { endTime, mode: savedMode } = JSON.parse(saved)
      const remaining = Math.ceil((endTime - Date.now()) / 1000)
      if (remaining > 0) {
        endTimeRef.current = endTime
        setMode(savedMode)
        setSecondsLeft(remaining)
        setRunning(true)
      } else {
        localStorage.removeItem('pomodoro-running')
      }
    } catch { localStorage.removeItem('pomodoro-running') }
  }, []) // only on mount

  const complete = useCallback(() => {
    stopTimer()
    setRunning(false)
    const session: Session = { mode: modeRef.current, completedAt: Date.now(), duration: durations[modeRef.current] }
    setSessions(prev => {
      const next = [session, ...prev].slice(0, 50)
      localStorage.setItem('pomodoro-sessions', JSON.stringify(next))
      return next
    })
    if (Notification.permission === 'granted') {
      new Notification(modeRef.current === 'focus' ? 'Focus session complete' : 'Break over', {
        body: modeRef.current === 'focus' ? 'Time for a break.' : 'Back to focus!'
      })
    }
    setFocusCount(prev => {
      const next = modeRef.current === 'focus' ? prev + 1 : prev
      const nextMode: Mode = modeRef.current === 'focus' ? (next % 4 === 0 ? 'long' : 'short') : 'focus'
      setMode(nextMode)
      setSecondsLeft(durations[nextMode] * 60)
      return next
    })
  }, [durations, stopTimer])

  const switchMode = useCallback((m: Mode) => {
    stopTimer()
    setRunning(false)
    setMode(m)
    setSecondsLeft(durations[m] * 60)
  }, [durations, stopTimer])

  // Wall-clock interval — survives background-tab throttling
  useEffect(() => {
    if (!running) return

    const tick = () => {
      if (!endTimeRef.current) return
      const remaining = Math.ceil((endTimeRef.current - Date.now()) / 1000)
      if (remaining <= 0) { complete() } else { setSecondsLeft(remaining) }
    }

    intervalRef.current = setInterval(tick, 500)
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [running, complete])

  const toggle = () => {
    if (!running) {
      endTimeRef.current = Date.now() + secondsLeft * 1000
      localStorage.setItem('pomodoro-running', JSON.stringify({ endTime: endTimeRef.current, mode }))
      if (Notification.permission === 'default') Notification.requestPermission()
    } else {
      stopTimer()
    }
    setRunning(r => !r)
  }

  const reset = () => {
    stopTimer()
    setRunning(false)
    setSecondsLeft(durations[mode] * 60)
  }

  const skip = () => { complete() }

  const saveSettings = () => {
    stopTimer()
    setDurations(settingDraft)
    localStorage.setItem('pomodoro-durations', JSON.stringify(settingDraft))
    setSecondsLeft(settingDraft[mode] * 60)
    setRunning(false)
    setShowSettings(false)
  }

  const todaySessions = sessions.filter(s => new Date(s.completedAt).toDateString() === new Date().toDateString())
  const todayFocus = todaySessions.filter(s => s.mode === 'focus')
  const totalFocusMin = todayFocus.reduce((a, s) => a + s.duration, 0)

  const radius = 110
  const circumference = 2 * Math.PI * radius
  const strokeDash = circumference * (1 - progress)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main timer area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
        {/* Mode tabs */}
        <div className="flex gap-1 bg-bg-secondary border border-border rounded-xl p-1">
          {(['focus', 'short', 'long'] as Mode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)}
              className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-all',
                mode === m ? 'text-white shadow-sm' : 'text-text-muted hover:text-text-secondary')}
              style={mode === m ? { backgroundColor: ACCENT } : {}}>
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Circle timer */}
        <div className="relative flex items-center justify-center">
          <svg width={280} height={280} className="-rotate-90">
            <circle cx={140} cy={140} r={radius} fill="none" stroke="currentColor" strokeWidth={8} className="text-border" />
            <circle cx={140} cy={140} r={radius} fill="none" strokeWidth={8}
              strokeLinecap="round"
              stroke={ACCENT}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDash}
              style={{ transition: running ? 'stroke-dashoffset 0.5s linear' : undefined }}
            />
          </svg>
          <div className="absolute flex flex-col items-center gap-1">
            <span className="text-6xl font-bold font-mono text-text-primary tabular-nums">
              {formatTime(secondsLeft)}
            </span>
            <span className="text-sm text-text-muted">{MODE_LABELS[mode]}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <button onClick={reset} className="w-11 h-11 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors">
            <RotateCcw size={18} />
          </button>
          <button onClick={toggle}
            className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-95 hover:opacity-90"
            style={{ backgroundColor: ACCENT }}>
            {running ? <Pause size={26} fill="white" /> : <Play size={26} fill="white" className="ml-1" />}
          </button>
          <button onClick={skip} className="w-11 h-11 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors">
            <SkipForward size={18} />
          </button>
        </div>

        {/* Settings button */}
        <button onClick={() => { setSettingDraft(durations); setShowSettings(true) }}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors">
          <Settings size={13} /> Timer settings
        </button>
      </div>

      {/* Right panel — today's log */}
      <div className="w-64 shrink-0 border-l border-border flex flex-col bg-bg-secondary">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-text-primary">Today</p>
          <p className="text-xs text-text-muted mt-0.5">{todayFocus.length} session{todayFocus.length !== 1 ? 's' : ''} · {totalFocusMin} min focused</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {todaySessions.length === 0 && (
            <p className="text-xs text-text-muted text-center py-8">No sessions yet today</p>
          )}
          {todaySessions.map((s, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-bg-primary">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ACCENT }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary">{MODE_LABELS[s.mode]}</p>
                <p className="text-xs text-text-muted">{s.duration} min</p>
              </div>
              <span className="text-xs text-text-muted shrink-0">
                {new Date(s.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
        {sessions.length > 0 && (
          <div className="p-3 border-t border-border">
            <button onClick={() => { setSessions([]); localStorage.removeItem('pomodoro-sessions') }}
              className="w-full text-xs text-text-muted hover:text-red-400 transition-colors text-center py-1">
              Clear history
            </button>
          </div>
        )}
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowSettings(false)}>
          <div className="bg-bg-secondary border border-border rounded-2xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-text-primary">Timer settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-1 text-text-muted hover:text-text-primary transition-colors"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              {(['focus', 'short', 'long'] as Mode[]).map(m => (
                <div key={m} className="flex items-center justify-between">
                  <label className="text-sm text-text-secondary">{MODE_LABELS[m]} (min)</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSettingDraft(d => ({ ...d, [m]: Math.max(1, d[m] - 1) }))}
                      className="w-7 h-7 rounded-lg bg-surface border border-border text-text-primary flex items-center justify-center hover:bg-surface-hover transition-colors text-sm">−</button>
                    <span className="w-8 text-center text-sm font-mono text-text-primary">{settingDraft[m]}</span>
                    <button onClick={() => setSettingDraft(d => ({ ...d, [m]: Math.min(120, d[m] + 1) }))}
                      className="w-7 h-7 rounded-lg bg-surface border border-border text-text-primary flex items-center justify-center hover:bg-surface-hover transition-colors text-sm">+</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={saveSettings} className="btn-primary w-full mt-6 flex items-center justify-center gap-2">
              <Check size={14} /> Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

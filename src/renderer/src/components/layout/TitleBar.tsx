import { Minus, Square, X } from 'lucide-react'

export default function TitleBar() {
  const minimize = () => window.api?.minimize()
  const maximize = () => window.api?.maximize()
  const close = () => window.api?.close()

  return (
    <div
      className="h-10 flex items-center justify-between px-4 bg-bg-primary border-b border-border/50 shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-violet-500/60" />
        <span className="text-xs font-semibold text-text-secondary tracking-widest uppercase">FöreUpp</span>
      </div>
      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button onClick={minimize} className="w-8 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-muted hover:text-text-secondary transition-colors">
          <Minus size={12} />
        </button>
        <button onClick={maximize} className="w-8 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-muted hover:text-text-secondary transition-colors">
          <Square size={11} />
        </button>
        <button onClick={close} className="w-8 h-7 flex items-center justify-center rounded hover:bg-red-900/40 text-text-muted hover:text-red-400 transition-colors">
          <X size={12} />
        </button>
      </div>
    </div>
  )
}

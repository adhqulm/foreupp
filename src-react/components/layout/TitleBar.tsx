import { Minus, Square, X } from 'lucide-react'
import { appWindow } from '@tauri-apps/api/window'

export default function TitleBar() {
  return (
    <div
      className="h-10 flex items-center justify-between px-4 bg-bg-primary border-b border-border/50 shrink-0"
      data-tauri-drag-region
    >
      <div data-tauri-drag-region className="flex-1" />
      <div className="flex items-center gap-1">
        <button onClick={() => appWindow.minimize()} className="w-8 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-muted hover:text-text-secondary transition-colors">
          <Minus size={12} />
        </button>
        <button onClick={() => appWindow.toggleMaximize()} className="w-8 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-muted hover:text-text-secondary transition-colors">
          <Square size={11} />
        </button>
        <button onClick={() => appWindow.close()} className="w-8 h-7 flex items-center justify-center rounded hover:bg-red-100 text-text-muted hover:text-red-600 transition-colors">
          <X size={12} />
        </button>
      </div>
    </div>
  )
}

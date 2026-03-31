/// <reference types="vite/client" />

interface Window {
  api: {
    minimize: () => void
    maximize: () => void
    close: () => void
  }
  electron: any
}

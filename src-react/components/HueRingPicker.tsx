import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'

function hsvToHex(h: number, s: number, v: number): string {
  s /= 100; v /= 100
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(Math.min(k, 4 - k, 1), 0)
  }
  return `#${[f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`
}

function hexToHs(hex: string): [number, number] {
  if (!hex || hex.length < 7) return [0, 100]
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [h * 360, max === 0 ? 0 : (d / max) * 100]
}

interface Props {
  color?: string
  hue?: number       // controlled hue only (theme picker)
  size?: number
  onChange: (hex: string, hue: number) => void
}

export default function ColorPicker({ color, hue: controlledHue, size = 200, onChange }: Props) {
  const [h, setH] = useState(() => controlledHue ?? (color ? hexToHs(color)[0] : 0))
  const [s, setS] = useState(() => controlledHue !== undefined ? 100 : (color ? hexToHs(color)[1] : 100))
  const [dragging, setDragging] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const radius = size / 2
  const onChangeRef = useRef(onChange)
  useLayoutEffect(() => { onChangeRef.current = onChange })

  useEffect(() => {
    if (controlledHue !== undefined) setH(controlledHue)
  }, [controlledHue])

  const updateFromPos = useCallback((cx: number, cy: number) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const dx = cx - (rect.left + radius)
    const dy = cy - (rect.top + radius)
    const dist = Math.sqrt(dx * dx + dy * dy)
    const newS = Math.min(dist / radius, 1) * 100
    const newH = ((Math.atan2(dy, dx) * 180 / Math.PI) + 90 + 360) % 360
    setH(newH); setS(newS)
    onChangeRef.current(hsvToHex(newH, newS, 100), newH)
  }, [radius])

  useEffect(() => {
    if (!dragging) return
    const mv = (e: MouseEvent) => updateFromPos(e.clientX, e.clientY)
    const up = () => setDragging(false)
    window.addEventListener('mousemove', mv)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up) }
  }, [dragging, updateFromPos])

  const dotRad = ((h - 90) * Math.PI) / 180
  const dotDist = (s / 100) * (radius - 7)
  const dotX = radius + dotDist * Math.cos(dotRad)
  const dotY = radius + dotDist * Math.sin(dotRad)

  return (
    <div
      ref={ref}
      className="rounded-full cursor-crosshair"
      style={{
        width: size, height: size,
        position: 'relative',
        userSelect: 'none',
        flexShrink: 0,
        background: `
          radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%),
          conic-gradient(
            hsl(0,100%,50%), hsl(30,100%,50%), hsl(60,100%,50%),
            hsl(90,100%,50%), hsl(120,100%,50%), hsl(150,100%,50%),
            hsl(180,100%,50%), hsl(210,100%,50%), hsl(240,100%,50%),
            hsl(270,100%,50%), hsl(300,100%,50%), hsl(330,100%,50%),
            hsl(360,100%,50%)
          )
        `
      }}
      onMouseDown={e => { setDragging(true); updateFromPos(e.clientX, e.clientY) }}
    >
      <div
        className="absolute rounded-full border-2 border-white pointer-events-none"
        style={{
          width: 14, height: 14,
          left: dotX - 7, top: dotY - 7,
          background: hsvToHex(h, s, 100),
          boxShadow: '0 0 0 1.5px rgba(0,0,0,0.35)'
        }}
      />
    </div>
  )
}

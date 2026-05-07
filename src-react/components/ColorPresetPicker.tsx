import { useState } from 'react'
import HueRingPicker from './HueRingPicker'
import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'

const COLOR_PALETTE = [
  '#7A4E28','#9E7040','#C96514','#D96520','#B82424','#BB2260','#8A2540',
  '#E83838','#F06818','#F060A8','#E83560','#C82424','#FA8530','#F7AE28',
  '#7E38E8','#8C48F0','#9B6EF7','#B09AFB','#CA98FC','#DE60F0','#FCD8EE',
  '#2658D0','#3874EF','#5890F7','#74B2FA','#A3CFFD','#BAE6FD','#E0F2FE',
  '#0A8862','#08B07C','#22C490','#46D6A4','#7CEABC','#44D9C7','#1CC8B6',
  '#3D3531','#615D59','#8F8884','#B6B0AC','#D6D3D1','#AAB0BC','#7F8794',
  '#ffffff','#000000',
]

interface Props {
  color: string
  onChange: (hex: string) => void
}

export default function ColorPresetPicker({ color, onChange }: Props) {
  const t = useTranslation()
  const [showCustom, setShowCustom] = useState(false)

  return (
    <div>
      {/* 7×6 preset grid */}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {COLOR_PALETTE.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={clsx(
              'w-7 h-7 rounded-full transition-all hover:scale-110',
              color.toLowerCase() === c.toLowerCase()
                ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-bg-secondary scale-110'
                : '',
              (c === '#ffffff' || c === '#FFFFFF') && 'border border-border'
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* Custom color toggle */}
      <button
        type="button"
        onClick={() => setShowCustom(v => !v)}
        className="mt-3 text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 transition-colors"
      >
        {t.customColor ?? 'Custom color'}
        <ChevronRight size={12} className={clsx('transition-transform', showCustom && 'rotate-90')} />
      </button>

      {showCustom && (
        <div className="flex justify-center mt-3">
          <HueRingPicker color={color} size={140} onChange={(hex) => onChange(hex)} />
        </div>
      )}
    </div>
  )
}

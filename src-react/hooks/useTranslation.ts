import { useAppSettings } from '../context/AppSettingsContext'
import { UI, type Lang } from '../i18n/translations'

export function useTranslation() {
  const { language } = useAppSettings()
  const lang = language as Lang
  return UI[lang] ?? UI['en']
}

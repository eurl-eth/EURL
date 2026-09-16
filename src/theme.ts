import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

export const THEME_ORDER: Theme[] = ['light', 'dark', 'system']

export const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Auto',
}

const THEME_KEY = 'eurl:theme'

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return theme
}

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved
    }
  } catch {
    /* ignore */
  }
  return 'system'
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const resolved = resolveTheme(theme)
  document.documentElement.setAttribute('data-theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0a0a0a' : '#fafafa')
}

export function useTheme(): {
  theme: Theme
  nextTheme: Theme
  cycleTheme: () => void
} {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      // re-resolve only when following system
      if (localStorage.getItem(THEME_KEY) === 'system') applyTheme('system')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const cycleTheme = useCallback(() => {
    const idx = THEME_ORDER.indexOf(theme)
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length]
    setTheme(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* ignore */
    }
  }, [theme])

  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]

  return { theme, nextTheme, cycleTheme }
}
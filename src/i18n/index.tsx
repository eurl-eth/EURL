import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { en } from './en'
import { zh } from './zh'

export type Lang = 'zh' | 'en'

const dictionaries: Record<Lang, typeof zh> = { zh, en }

function lookup(dict: unknown, path: string): unknown {
  let cur: unknown = dict
  for (const part of path.split('.')) {
    if (cur !== null && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return cur
}

export interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: <T = string>(key: string, params?: Record<string, string | number>) => T
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'zh',
  setLang: () => {},
  t: (key) => key as never,
})

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('eurl:lang')
    if (saved === 'zh' || saved === 'en') return saved
  } catch {
    /* ignore */
  }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')
    ? 'zh'
    : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const value = useMemo<I18nContextValue>(() => {
    const setLang = (next: Lang) => {
      setLangState(next)
      try {
        localStorage.setItem('eurl:lang', next)
      } catch {
        /* ignore */
      }
    }
    const t = <T,>(key: string, params?: Record<string, string | number>): T => {
      const found = lookup(dictionaries[lang], key) ?? lookup(dictionaries.en, key)
      if (typeof found !== 'string') {
        return (found ?? key) as T
      }
      let text = found
      if (params) {
        for (const [name, val] of Object.entries(params)) {
          text = text.replaceAll(`{${name}}`, String(val))
        }
      }
      return text as T
    }
    return { lang, setLang, t }
  }, [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}

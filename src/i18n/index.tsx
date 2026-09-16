import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { en } from './en'
import { zh } from './zh'
import { zhHant } from './zh-hant'
import { ja } from './ja'
import { ko } from './ko'

export type Lang = 'zh' | 'zhHant' | 'ja' | 'ko' | 'en'

const dictionaries: Record<Lang, typeof zh> = { zh, zhHant, ja, ko, en }

// eslint-disable-next-line react-refresh/only-export-components
export const LANG_ORDER: Lang[] = ['zh', 'zhHant', 'ja', 'ko', 'en']

// eslint-disable-next-line react-refresh/only-export-components
export const LANG_LABELS: Record<Lang, string> = {
  zh: '简体中文',
  zhHant: '繁體中文',
  ja: '日本語',
  ko: '한국어',
  en: 'English',
}

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
    if (saved && saved in dictionaries) return saved as Lang
  } catch {
    /* ignore */
  }
  const nav =
    typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : ''
  if (nav.startsWith('zh')) return nav.startsWith('zh-hant') || nav.startsWith('zh-hk') || nav.startsWith('zh-tw') ? 'zhHant' : 'zh'
  if (nav.startsWith('ja')) return 'ja'
  if (nav.startsWith('ko')) return 'ko'
  return 'en'
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

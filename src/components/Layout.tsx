import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useI18n, type Lang, LANG_ORDER, LANG_LABELS } from '../i18n'
import { useTheme } from '../theme'
import { getChainById } from '../config/chains'
import { CubeMark, IconX, IconSun, IconMoon, IconAuto } from './Icons'

export function Layout({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n()
  const { theme, cycleTheme } = useTheme()
  const { pathname } = useLocation()
  const { isConnected, address, chainId } = useAccount()
  const [showFullAddr, setShowFullAddr] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyFail, setCopyFail] = useState(false)
  const copiedTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
    }
  }, [])

  async function handleAddrClick() {
    setShowFullAddr((v) => !v)
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyFail(true)
    }
  }

  useEffect(() => {
    const base =
      lang === 'zh' ? 'EURL — 即用即走的链上短链接 | On-Chain Short Links' : 'EURL · On-Chain Short Links'
    if (pathname.startsWith('/about')) {
      document.title = lang === 'zh' ? `${base} · 关于` : `${base} · About`
    } else {
      document.title = base
    }
  }, [pathname, lang])

  const activeChain = chainId !== undefined ? getChainById(chainId) : undefined
  const activeColor = activeChain?.brandColor ?? 'var(--ok)'
  const activeChainName = activeChain?.name ?? String(chainId ?? '')

  return (
    <div className="layout">
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="brand">
            <CubeMark size={19} />
            <span>{t('common.appName')}</span>
          </Link>
          <nav className="nav">
            <NavLink to="/" end className="nav-link">
              {t('common.navCreate')}
            </NavLink>
            <NavLink to="/about" className="nav-link">
              {t('common.navAbout')}
            </NavLink>
          </nav>
          <div className="header-actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={cycleTheme}
              title={theme}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <IconMoon size={16} />
              ) : theme === 'light' ? (
                <IconSun size={16} />
              ) : (
                <IconAuto size={16} />
              )}
            </button>
            <label className="lang-toggle">
              <select
                className="lang-select"
                value={lang}
                onChange={(e) => setLang(e.target.value as Lang)}
                aria-label="Language"
              >
                {LANG_ORDER.map((l) => (
                  <option key={l} value={l}>
                    {LANG_LABELS[l]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </header>
      <main className="main">{children}</main>
      <footer className="footer">
        <div className="footer-inner">
          <span className="brand-mark brand-mark-round">
            <CubeMark size={12} />
          </span>
          <span>{t('common.appName')}</span>
          <span className="spacer" />
          {isConnected && address ? (
            <span className="footer-status">
              <span className="status-dot" style={{ background: activeColor }} />
              <button
                type="button"
                className="footer-addr"
                title={address}
                onClick={handleAddrClick}
              >
                {showFullAddr ? address : `${address.slice(0, 6)}…${address.slice(-4)}`}
              </button>
              {copied && <span className="footer-copied">{t('common.copied')}</span>}
              <span className="footer-sep">·</span>
              <span>{activeChainName}</span>
              <span className="footer-sep">·</span>
              <span>{t('common.statusConnected')}</span>
            </span>
          ) : (
            <span className="footer-tag">{t('common.footer')}</span>
          )}
        </div>
      </footer>

      {copyFail && address && (
        <div className="modal-overlay" onClick={() => setCopyFail(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="modal-title">{t('common.copyFailTitle')}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setCopyFail(false)}
                aria-label="close"
              >
                <IconX />
              </button>
            </div>
            <p className="status-sub">{t('common.copyFailHint')}</p>
            <div className="url-box center">{address}</div>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setCopyFail(false)
                  void handleAddrClick()
                }}
              >
                {t('common.copyRetry')}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setCopyFail(false)}>
                {t('common.copyClose')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

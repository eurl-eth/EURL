import { useEffect, useState } from 'react'
import { useConnect } from 'wagmi'
import { useI18n } from '../i18n'
import { IconWallet, IconWc, IconX } from './Icons'

function isUserRejected(e: unknown): boolean {
  const name = e instanceof Error ? e.name : ''
  const msg = e instanceof Error ? e.message : String(e)
  return name === 'UserRejectedRequestError' || /user rejected|user denied|rejected the request/i.test(msg)
}

function classifyError(e: unknown, t: (k: string) => string): string {
  if (isUserRejected(e)) return t('create.errRejected')
  const msg = e instanceof Error ? e.message : String(e)
  if (/not found|no provider/i.test(msg)) return t('create.noWallet')
  return msg
}

export function ConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const { connectAsync, connectors } = useConnect()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'browser' | 'wc' | null>(null)

  useEffect(() => {
    if (!open) {
      setError(null)
      setBusy(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const mm = connectors.find((c) => c.id === 'metaMask')
  const injected = connectors.find((c) => c.id === 'injected')
  const wc = connectors.find((c) => c.id === 'walletConnect')
  const hasBrowser = Boolean(mm || injected)

  async function connectBrowser() {
    setError(null)
    setBusy('browser')
    try {
      if (mm) {
        try {
          await connectAsync({ connector: mm })
          onClose()
          return
        } catch (e) {
          if (isUserRejected(e)) throw e
        }
      }
      if (injected) {
        await connectAsync({ connector: injected })
        onClose()
        return
      }
      setError(t('create.noWallet'))
    } catch (e) {
      setError(classifyError(e, t))
    } finally {
      setBusy(null)
    }
  }

  async function connectWc() {
    if (!wc) return
    setError(null)
    setBusy('wc')
    try {
      await connectAsync({ connector: wc })
      onClose()
    } catch (e) {
      setError(classifyError(e, t))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 className="modal-title">{t('wallet.title')}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="close">
            <IconX />
          </button>
        </div>

        {hasBrowser && (
          <button
            type="button"
            className="modal-option"
            onClick={connectBrowser}
            disabled={busy !== null}
          >
            <IconWallet />
            <span className="opt-text">
              <span className="opt-title">
                {t('wallet.browser')}
                {busy === 'browser' && <span className="opt-busy">…</span>}
              </span>
              <span className="opt-desc">{t('wallet.browserDesc')}</span>
            </span>
          </button>
        )}

        {wc && (
          <button type="button" className="modal-option" onClick={connectWc} disabled={busy !== null}>
            <IconWc />
            <span className="opt-text">
              <span className="opt-title">
                {t('wallet.wc')}
                {busy === 'wc' && <span className="opt-busy">…</span>}
              </span>
              <span className="opt-desc">{t('wallet.wcDesc')}</span>
            </span>
          </button>
        )}

        {error && <div className="alert alert-danger">{error}</div>}
      </div>
    </div>
  )
}

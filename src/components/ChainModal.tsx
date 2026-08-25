import { useEffect } from 'react'
import type { ChainConfig } from '../config/chains'
import { useI18n } from '../i18n'
import { IconX } from './Icons'

interface Props {
  open: boolean
  chains: ChainConfig[]
  selectedPrefix: string
  onSelect: (prefix: string) => void
  onCustom: () => void
  onClose: () => void
}

export function ChainModal({ open, chains, selectedPrefix, onSelect, onCustom, onClose }: Props) {
  const { t } = useI18n()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal chain-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 className="modal-title">{t('create.moreTitle')}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="close">
            <IconX />
          </button>
        </div>
        <div className="chain-modal-list">
          <button
            type="button"
            className={`modal-option chain-option chain-custom${selectedPrefix === '' ? ' selected' : ''}`}
            onClick={() => {
              onCustom()
              onClose()
            }}
          >
            <span className="chain-dot custom" />
            <span className="opt-text">
              <span className="opt-title">{t('create.moreCustom')}</span>
              <span className="opt-desc">{t('create.moreCustomDesc')}</span>
            </span>
          </button>
          {chains.map((c) => (
            <button
              key={c.prefix}
              type="button"
              className={`modal-option chain-option${c.prefix === selectedPrefix ? ' selected' : ''}`}
              style={
                c.brandColor
                  ? ({
                      '--brand': c.brandColor,
                      '--brand-text': c.brandTextColor ?? c.brandColor,
                    } as React.CSSProperties)
                  : undefined
              }
              onClick={() => {
                onSelect(c.prefix)
                onClose()
              }}
            >
              <span className="chain-dot" />
              <span className="opt-text">
                <span className="opt-title">
                  {c.name}
                  {c.testnet && <span className="badge">{t('create.testnetBadge')}</span>}
                </span>
                <span className="opt-desc">
                  {t('create.chainIdLabel', { id: c.chainId })} · {c.nativeSymbol}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

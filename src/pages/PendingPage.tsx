import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { getChainById, getChainByPrefix, type ChainConfig } from '../config/chains'
import { useI18n } from '../i18n'
import { backupStore } from '../lib/backup'
import { encodeTxPointer, genericChainPath } from '../lib/id'
import { pendingStore } from '../lib/pending'
import { rpcEndpointsFor, waitForReceiptRpc } from '../lib/rpc'
import { IconCheck, IconX } from '../components/Icons'

type Status = 'loading' | 'checking' | 'done' | 'error'

export default function PendingPage() {
  const { prefix, txHash } = useParams()
  const { t } = useI18n()
  const tRef = useRef(t)
  tRef.current = t

  const [status, setStatus] = useState<Status>('loading')
  const [link, setLink] = useState('')
  const [explorerTx, setExplorerTx] = useState('')
  const [chainName, setChainName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!txHash || !pendingStore.find(txHash)) {
      setStatus('error')
      setErrorMsg(tRef.current('pending.notFound'))
      return
    }
    setStatus('checking')
    void checkStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txHash])

  async function checkStatus() {
    if (!txHash) {
      setStatus('error')
      setErrorMsg(t('pending.notFound'))
      return
    }
    const rec = pendingStore.find(txHash)
    if (!rec) {
      setStatus('error')
      setErrorMsg(t('pending.notFound'))
      return
    }
    if (prefix !== (rec.prefix || String(rec.chainId))) {
      setStatus('error')
      setErrorMsg(t('pending.notFound'))
      return
    }
    const chain: ChainConfig | undefined =
      (rec.prefix ? getChainByPrefix(rec.prefix) : undefined) ?? getChainById(rec.chainId)
    if (!chain) {
      setStatus('error')
      setErrorMsg(t('pending.chainUnknown'))
      return
    }
    setStatus('checking')
    setErrorMsg('')
    try {
      const receipt = await waitForReceiptRpc(rpcEndpointsFor(chain), txHash, 20_000, 2_000)
      if (!receipt) {
        setStatus('error')
        setErrorMsg(t('pending.stillPending'))
        return
      }
      const pointer = { blockNumber: receipt.blockNumber, transactionIndex: receipt.transactionIndex }
      const id = encodeTxPointer(pointer)
      const baseOrigin = rec.linkDomain ? `https://${rec.linkDomain}` : window.location.origin
      const shortLink = rec.prefix
        ? `${baseOrigin}/${rec.prefix}/${id}`
        : `${baseOrigin}${genericChainPath(rec.chainId, id)}`
      backupStore.save({
        chainId: rec.chainId,
        prefix: rec.prefix,
        id,
        blockNumber: pointer.blockNumber.toString(),
        transactionIndex: pointer.transactionIndex,
        txHash,
        url: rec.url,
        timestamp: Date.now(),
      })
      pendingStore.remove(txHash)
      setLink(shortLink)
      setExplorerTx(chain.explorerTx.replace('{hash}', txHash))
      setChainName(chain.name)
      setStatus('done')
    } catch {
      setStatus('error')
      setErrorMsg(t('pending.checkFailed'))
    }
  }

  let body: ReactNode
  if (status === 'loading') {
    body = (
      <div className="status-panel">
        <div className="spinner" />
        <h2 className="status-title">{t('pending.title')}</h2>
        <p className="status-sub">{t('pending.sub')}</p>
      </div>
    )
  } else if (status === 'checking') {
    body = (
      <div className="status-panel">
        <div className="spinner" />
        <h2 className="status-title">{t('pending.checking')}</h2>
      </div>
    )
  } else if (status === 'done') {
    body = (
      <div className="status-panel">
        <div className="alert alert-ok">
          <IconCheck />
          <span>{t('pending.done')}</span>
        </div>
        <p className="status-sub">{t('pending.doneChain', { chain: chainName })}</p>
        <div className="url-box center">{link}</div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <a className="btn" href={link} target="_blank" rel="noreferrer">
            {t('pending.open')}
          </a>
          <a className="btn btn-outline" href={explorerTx} target="_blank" rel="noreferrer">
            {t('pending.viewExplorer')}
          </a>
        </div>
      </div>
    )
  } else {
    body = (
      <div className="status-panel">
        <h2 className="status-title">
          <IconX />
          {t('pending.errorTitle')}
        </h2>
        <p className="status-sub">{errorMsg}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn" onClick={checkStatus}>
            {t('pending.retry')}
          </button>
          <a className="btn btn-outline" href="/">
            {t('pending.backHome')}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="main-narrow center-narrow">
      <div className="card">
        <div className="card-head">
          <h2 className="card-title">{t('pending.title')}</h2>
          <p className="card-desc">{t('pending.sub')}</p>
        </div>
        {txHash && <div className="url-box center">{txHash}</div>}
        {body}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { config } from '../config/app'
import { isChainAllowed, isWalletAllowed } from '../lib/access'
import { getChainById, getChainByPrefix, type ChainConfig } from '../config/chains'
import { useI18n } from '../i18n'
import { backupStore } from '../lib/backup'
import { calldataToUrl, encodeUrl, isValidTargetUrl } from '../lib/calldata'
import { chainToConfig, discoverChain } from '../lib/chainDiscovery'
import { decodeChainIdParam, decodeTxPointer, type TxPointer } from '../lib/id'
import { getTransactionByPointer, rpcEndpointsFor } from '../lib/rpc'
import { checkUrlSafety, loadPhishingList } from '../lib/safety'
import { isShortLinkBlocked, isTargetUrlBlocked, isWalletBlocked, loadBlocklist } from '../lib/erulBlocklist'
import { IconAlert, IconShield, IconX } from '../components/Icons'

type ErrorCode = 'invalid-id' | 'unsupported-chain' | 'not-found' | 'not-url' | 'rpc'

type Stage =
  | { kind: 'querying' }
  | { kind: 'checking' }
  | { kind: 'ready'; url: string }
  | { kind: 'cancelled'; url: string }
  | { kind: 'blocked'; reason: string; url?: string }
  | { kind: 'confirm-risk'; url: string }
  | { kind: 'error'; code: ErrorCode }

interface TxMeta {
  explorerTx: string
  chainName: string
  testnet: boolean
  faucetUrl?: string
  resetNote?: string
}

const ERROR_KEYS: Record<ErrorCode, { title: string; sub: string }> = {
  'invalid-id': { title: 'resolve.errInvalidIdTitle', sub: 'resolve.errInvalidIdSub' },
  'unsupported-chain': { title: 'resolve.errUnsupportedChainTitle', sub: 'resolve.errUnsupportedChainSub' },
  'not-found': { title: 'resolve.errNotFoundTitle', sub: 'resolve.errNotFoundSub' },
  'not-url': { title: 'resolve.errNotUrlTitle', sub: 'resolve.errNotUrlSub' },
  rpc: { title: 'resolve.errRpcTitle', sub: 'resolve.errRpcSub' },
}

export default function ResolvePage({ mode }: { mode: 'prefix' | 'chainId' }) {
  const { prefix, id, chainId } = useParams()
  const { t } = useI18n()
  const tRef = useRef(t)
  tRef.current = t

  const [stage, setStage] = useState<Stage>({ kind: 'querying' })
  const [countdown, setCountdown] = useState(config.redirectCountdownSeconds)
  const [fromBackup, setFromBackup] = useState(false)
  const [txMeta, setTxMeta] = useState<TxMeta | null>(null)
  const [riskAck, setRiskAck] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null)
  const [blockedFetching, setBlockedFetching] = useState(false)
  const chainRef = useRef<ChainConfig | null>(null)
  const pointerRef = useRef<TxPointer | null>(null)

  useEffect(() => {
    let stale = false

    void loadPhishingList()
    void loadBlocklist()
    setStage({ kind: 'querying' })
    setFromBackup(false)
    setTxMeta(null)
    setRiskAck(false)
    setBlockedUrl(null)
    setBlockedFetching(false)

    async function safetyAndReady(url: string, shortPrefix?: string, shortId?: string): Promise<void> {
      if (stale) return
      setStage({ kind: 'checking' })
      if (shortPrefix && shortId && (await isShortLinkBlocked(shortPrefix, shortId))) {
        setStage({ kind: 'blocked', reason: tRef.current('resolve.blocklistShortLink'), url })
        return
      }
      if (await isTargetUrlBlocked(url)) {
        setStage({ kind: 'blocked', reason: tRef.current('resolve.blocklistTarget'), url })
        return
      }
      const verdict = await checkUrlSafety(url)
      if (stale) return
      if (verdict.status === 'blocked') {
        setStage({ kind: 'blocked', reason: verdict.reason })
      } else if (verdict.status === 'unknown') {
        setStage({ kind: 'confirm-risk', url })
      } else {
        setStage({ kind: 'ready', url })
      }
    }

    async function main(): Promise<void> {
      let chain: ChainConfig | undefined
      if (mode === 'prefix') {
        chain = getChainByPrefix(prefix)
        if (!chain || !id) {
          if (!stale) setStage({ kind: 'error', code: 'invalid-id' })
          return
        }
      } else {
        const n = chainId ? decodeChainIdParam(chainId) : undefined
        if (n === undefined) {
          if (!stale) setStage({ kind: 'error', code: 'invalid-id' })
          return
        }
        chain = getChainById(n)
        if (!chain) {
          const discovered = await discoverChain(n)
          if (!stale && discovered) chain = chainToConfig(discovered)
        }
        if (!chain || !id) {
          if (!stale) setStage({ kind: 'error', code: 'unsupported-chain' })
          return
        }
      }

      if (!stale && !isChainAllowed(chain.prefix)) {
        setStage({ kind: 'blocked', reason: tRef.current('resolve.chainDenied') })
        return
      }

      if (!stale && chain.prefix && (await isShortLinkBlocked(chain.prefix, id))) {
        chainRef.current = chain
        let ptr: TxPointer
        try {
          ptr = decodeTxPointer(id)
          pointerRef.current = ptr
        } catch {
          /* ignore */
        }
        setStage({ kind: 'blocked', reason: tRef.current('resolve.blocklistShortLink') })
        return
      }

      let pointer: TxPointer
      try {
        pointer = decodeTxPointer(id)
      } catch {
        if (!stale) setStage({ kind: 'error', code: 'invalid-id' })
        return
      }

      let rpcFailed = false
      let tx = null
      try {
        tx = await getTransactionByPointer(rpcEndpointsFor(chain), pointer.blockNumber, pointer.transactionIndex)
      } catch {
        rpcFailed = true
      }
      if (stale) return

      if (rpcFailed) {
        const rec = backupStore.find(chain.chainId, pointer.blockNumber, pointer.transactionIndex)
        if (rec && isValidTargetUrl(rec.url)) {
          setFromBackup(true)
          setTxMeta({
            explorerTx: chain.explorerTx.replace('{hash}', rec.txHash),
            chainName: chain.name,
            testnet: chain.testnet,
            faucetUrl: chain.faucetUrl,
            resetNote: chain.resetNote,
          })
          await safetyAndReady(rec.url, chain.prefix, id)
          return
        }
        setStage({ kind: 'error', code: 'rpc' })
        return
      }

      if (!tx) {
        setStage({ kind: 'error', code: 'not-found' })
        return
      }

      setTxMeta({
        explorerTx: chain.explorerTx.replace('{hash}', tx.hash),
        chainName: chain.name,
        testnet: chain.testnet,
        faucetUrl: chain.faucetUrl,
        resetNote: chain.resetNote,
      })

      let url: string
      try {
        url = calldataToUrl(tx.input)
      } catch {
        setStage({ kind: 'error', code: 'not-url' })
        return
      }
      if (!isValidTargetUrl(url)) {
        setStage({ kind: 'error', code: 'not-url' })
        return
      }
      const list = await loadBlocklist()
      if (!stale && list && isWalletBlocked(list, tx.from)) {
        setStage({ kind: 'blocked', reason: tRef.current('resolve.blocklistWallet'), url })
        return
      }
      if (!stale && !isWalletAllowed(tx.from)) {
        setStage({ kind: 'blocked', reason: tRef.current('resolve.whitelistDenied'), url })
        return
      }
      await safetyAndReady(url, chain.prefix, id)
    }

    main()
    return () => {
      stale = true
    }
  }, [prefix, id, chainId, mode, nonce])

  async function fetchBlockedTarget() {
    const chain = chainRef.current
    const pointer = pointerRef.current
    if (!chain || !pointer || blockedFetching) return
    setBlockedFetching(true)
    setBlockedUrl(null)
    try {
      const tx = await getTransactionByPointer(
        rpcEndpointsFor(chain),
        pointer.blockNumber,
        pointer.transactionIndex,
      )
      if (!tx) {
        setBlockedUrl('')
        return
      }
      const url = calldataToUrl(tx.input)
      if (isValidTargetUrl(url)) setBlockedUrl(url)
      else setBlockedUrl('')
    } catch {
      setBlockedUrl('')
    } finally {
      setBlockedFetching(false)
    }
  }

  useEffect(() => {
    if (stage.kind !== 'ready') return
    const target = stage.url
    let remaining = config.redirectCountdownSeconds
    setCountdown(remaining)
    const timer = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        clearInterval(timer)
        window.location.assign(target)
      } else {
        setCountdown(remaining)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [stage])

  let body: ReactNode

  if (stage.kind === 'querying') {
    body = (
      <div className="status-panel">
        <div className="spinner" />
        <h2 className="status-title">{t('resolve.queryingTitle')}</h2>
        <p className="status-sub">{t('resolve.queryingSub')}</p>
      </div>
    )
  } else if (stage.kind === 'checking') {
    body = (
      <div className="status-panel">
        <div className="spinner" />
        <h2 className="status-title">{t('resolve.checkingTitle')}</h2>
      </div>
    )
  } else if (stage.kind === 'error') {
    const keys = ERROR_KEYS[stage.code]
    body = (
      <div className="status-panel">
        <h2 className="status-title">
          <IconX />
          {t(keys.title)}
        </h2>
        <p className="status-sub">{t(keys.sub)}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn" onClick={() => setNonce((n) => n + 1)}>
            {t('resolve.retry')}
          </button>
          <a className="btn btn-outline" href="/">
            {t('resolve.backHome')}
          </a>
        </div>
      </div>
    )
  } else if (stage.kind === 'blocked') {
    body = (
      <div className="status-panel">
        <h2 className="status-title">
          <IconShield />
          {t('resolve.blockedTitle')}
        </h2>
        <p className="status-sub">{t('resolve.blockedSub')}</p>
        <div className="alert alert-danger" style={{ justifyContent: 'center' }}>
          <span>
            {t('resolve.blockedReason')}: {stage.reason}
          </span>
        </div>
        {!config.hideBlockedUrl &&
          (stage.url ? (
            <div className="url-box center">{encodeUrl(stage.url)}</div>
          ) : blockedUrl === null ? null : blockedUrl ? (
            <div className="url-box center">{encodeUrl(blockedUrl)}</div>
          ) : (
            <p className="field-hint">{t('resolve.blockedNoUrl')}</p>
          ))}
        <div className="row" style={{ justifyContent: 'center' }}>
          {blockedUrl === null && !config.hideBlockedUrl && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={fetchBlockedTarget}
              disabled={blockedFetching}
            >
              {blockedFetching ? t('resolve.blockedFetching') : t('resolve.blockedFetch')}
            </button>
          )}
          <a className="btn btn-outline" href="/">
            {t('resolve.backHome')}
          </a>
        </div>
      </div>
    )
  } else if (stage.kind === 'confirm-risk') {
    body = (
      <div className="status-panel">
        <h2 className="status-title">
          <IconAlert />
          {t('resolve.riskTitle')}
        </h2>
        <p className="status-sub">{t('resolve.riskSub')}</p>
        <div className="url-box">{encodeUrl(stage.url)}</div>
        <label className="checkbox-row">
          <input type="checkbox" checked={riskAck} onChange={(e) => setRiskAck(e.target.checked)} />
          <span>{t('resolve.riskConfirm')}</span>
        </label>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-danger"
            disabled={!riskAck}
            onClick={() => setStage({ kind: 'ready', url: stage.url })}
          >
            {t('resolve.riskProceed')}
          </button>
          <a className="btn btn-outline" href="/">
            {t('resolve.riskBack')}
          </a>
        </div>
      </div>
    )
  } else {
    const url = stage.url
    const cancelled = stage.kind === 'cancelled'
    body = (
      <div className="status-panel">
        {cancelled ? (
          <h2 className="status-title">{t('resolve.cancelled')}</h2>
        ) : (
          <>
            <h2 className="status-title">{t('resolve.readyTitle')}</h2>
            <div className="countdown">{countdown}</div>
            <p className="status-sub">{t('resolve.redirectIn', { s: countdown })}</p>
          </>
        )}
        <div className="url-box center">{encodeUrl(url)}</div>
        {fromBackup && <div className="alert alert-warn">{t('resolve.backupNote')}</div>}
        {txMeta?.testnet && (
          <div className="alert alert-warn">
            <span>
              {t('create.testnetWarning')}
              {txMeta.resetNote === 'monthly' && t('create.testnetResetMonthly')}
              {txMeta.faucetUrl && (
                <>
                  {' '}
                  <a
                    className="faucet-link"
                    href={txMeta.faucetUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('create.testnetFaucet')}
                  </a>
                </>
              )}
            </span>
          </div>
        )}
        {txMeta && (
          <p className="field-hint">
            {t('resolve.chainLabel')}: {txMeta.chainName}
            {txMeta.explorerTx && (
              <>
                {' '}
                ·{' '}
                <a href={txMeta.explorerTx} target="_blank" rel="noreferrer">
                  {t('resolve.viewExplorer')}
                </a>
              </>
            )}
          </p>
        )}
        <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
          {!cancelled ? (
            <>
              <button type="button" className="btn" onClick={() => window.location.assign(url)}>
                {t('resolve.goNow')}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStage({ kind: 'cancelled', url })}
              >
                {t('resolve.cancel')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn" onClick={() => setStage({ kind: 'ready', url })}>
                {t('resolve.goNow')}
              </button>
              <a className="btn btn-outline" href="/">
                {t('resolve.backHome')}
              </a>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="main-narrow center-narrow">
      <div className="card">{body}</div>
    </div>
  )
}

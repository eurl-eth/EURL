import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatEther, parseEther } from 'viem'
import {
  useAccount,
  useDisconnect,
  useSendTransaction,
  useSwitchChain,
  useWalletClient,
} from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { ConnectModal } from '../components/ConnectModal'
import { ChainModal } from '../components/ChainModal'
import { HeroBackdrop } from '../components/HeroBackdrop'
import { IconCheck } from '../components/Icons'
import { config } from '../config/app'
import { isChainAllowed, isWalletAllowed } from '../lib/access'
import { MAINNET_CHAINS, TESTNET_CHAINS, getChainById, getChainByPrefix, type ChainConfig } from '../config/chains'
import { useI18n } from '../i18n'
import { backupStore } from '../lib/backup'
import { estimateCalldataGas, isValidTargetUrl, urlToCalldata } from '../lib/calldata'
import { chainToConfig, discoverChain } from '../lib/chainDiscovery'
import { isTargetUrlBlocked, loadBlocklist } from '../lib/erulBlocklist'
import { encodeTxPointer, genericChainPath } from '../lib/id'
import { pendingStore } from '../lib/pending'
import { getChainPrice, type ChainPrice } from '../lib/price'
import punycode from 'punycode'
import { getGasPrice, rpcEndpointsFor, waitForReceiptRpc } from '../lib/rpc'
import { TIP_DEFAULT_USD, tipSliderFromUsd, tipUsdFromSlider } from '../lib/tipSlider'
import { wagmiConfig } from '../wallet'

type Phase = 'idle' | 'sending' | 'waiting' | 'done'

interface CreateResult {
  link: string
  txHash: string
  explorerTx: string
  chainName: string
}

function classifyTxError(e: unknown, t: (k: string) => string): string {
  const name = e instanceof Error ? e.name : ''
  const msg = e instanceof Error ? e.message : String(e)
  if (name === 'UserRejectedRequestError' || /user rejected|user denied|rejected the request/i.test(msg)) {
    return t('create.errRejected')
  }
  if (/timeout|timed out/i.test(msg)) return t('create.errTimeout')
  return `${t('create.errGeneric')}: ${msg}`
}

export default function CreatePage() {
  const { t, lang } = useI18n()
  const navigate = useNavigate()

  const [url, setUrl] = useState('')
  const [prefix, setPrefix] = useState(config.defaultPrefix)
  const [customMode, setCustomMode] = useState(false)
  const [tipUsd, setTipUsd] = useState(0.1)
  const [linkDomain, setLinkDomain] = useState(config.linkDomains[0] ?? '')
  const [connectOpen, setConnectOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [chainPrice, setChainPrice] = useState<ChainPrice>({ usd: null, cny: null })
  const [gasEstimate, setGasEstimate] = useState<{ gas: bigint; costWei: bigint } | null>(null)
  const [discovered, setDiscovered] = useState<ChainConfig | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)

  const formRef = useRef<HTMLDivElement>(null)

  const chain = getChainByPrefix(prefix) ?? MAINNET_CHAINS[0]
  const chains = (config.showTestnets ? [...MAINNET_CHAINS, ...TESTNET_CHAINS] : MAINNET_CHAINS).filter(
    (c) => !config.hiddenChains.includes(c.prefix) && isChainAllowed(c.prefix),
  )
  const mainChains =
    config.mainChainPrefixes.length > 0
      ? chains.filter((c) => config.mainChainPrefixes.includes(c.prefix))
      : chains
  const extraChains = chains.filter((c) => !mainChains.includes(c))
  const selectedExtra = extraChains.find((c) => !customMode && c.prefix === chain.prefix)

  const currentHost = typeof window !== 'undefined' ? window.location.host : ''
  const currentHostASCII = punycode.toASCII(currentHost).toLowerCase()
  const linkDomains = config.linkDomains.filter((d) => punycode.toASCII(d).toLowerCase() !== currentHostASCII)

  const { address, isConnected, chainId: walletChainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { sendTransactionAsync } = useSendTransaction()
  const walletClient = useWalletClient()

  const customChain =
    customMode && walletChainId !== undefined
      ? (getChainById(walletChainId) ?? discovered)
      : undefined
  const activeChain = customChain ?? chain

  const trimmedUrl = url.trim()
  const urlValid = isValidTargetUrl(trimmedUrl)
  const urlNonEmpty = trimmedUrl.length > 0
  const calldata = useMemo(() => (urlValid ? urlToCalldata(trimmedUrl) : '0x'), [urlValid, trimmedUrl])
  const dataBytes = Math.max(0, (calldata.length - 2) / 2)

  const tipWei = useMemo(() => {
    if (!chainPrice.usd || tipUsd <= 0) return 0n
    const eth = tipUsd / chainPrice.usd
    return parseEther(eth.toFixed(18))
  }, [chainPrice.usd, tipUsd])
  const tipAddress = activeChain.tipAddress
  const tipEnabled = Boolean(tipAddress)
  const wrongNetwork = isConnected && !customMode && walletChainId !== chain.chainId

  useEffect(() => {
    let cancelled = false
    setDiscovered(null)
    if (customMode && walletChainId !== undefined && !getChainById(walletChainId)) {
      void discoverChain(walletChainId).then((d) => {
        if (!cancelled && d) setDiscovered(chainToConfig(d))
      })
    }
    return () => {
      cancelled = true
    }
  }, [customMode, walletChainId])

  useEffect(() => {
    let cancelled = false
    const priceId = activeChain.priceId
    if (!priceId) {
      setChainPrice({ usd: null, cny: null })
      return
    }
    setChainPrice({ usd: null, cny: null })
    getChainPrice(priceId).then((p) => {
      if (!cancelled) setChainPrice(p)
    })
    return () => {
      cancelled = true
    }
  }, [activeChain.priceId])

  useEffect(() => {
    void loadBlocklist()
  }, [])

  useEffect(() => {
    let cancelled = false
    setGasEstimate(null)
    if (!urlValid || (activeChain.rpcs ?? []).length === 0) return
    getGasPrice(rpcEndpointsFor(activeChain)).then((gasPrice) => {
      if (cancelled || gasPrice === null) return
      const gas = 21000n + BigInt(estimateCalldataGas(calldata))
      setGasEstimate({ gas, costWei: gas * gasPrice })
    })
    return () => {
      cancelled = true
    }
  }, [urlValid, calldata, activeChain])

  function tipLabel(): string {
    const native = chainPrice.usd ? tipUsd / chainPrice.usd : 0
    if (chainPrice.usd) {
      return `≈ $${tipUsd < 0.01 ? '<0.01' : tipUsd.toFixed(2)} · ${native.toPrecision(4)} ${activeChain.nativeSymbol}`
    }
    return `$${tipUsd < 0.01 ? '<0.01' : tipUsd.toFixed(2)}`
  }

  async function handleSubmit() {
    setError(null)
    const target = customMode ? customChain : chain
    if (!address || !urlValid || !target) return
    if (!isWalletAllowed(address)) {
      setError(t('create.errWhitelist'))
      return
    }
    if (!isChainAllowed(target.prefix)) {
      setError(t('create.errChainDenied'))
      return
    }
    if (await isTargetUrlBlocked(trimmedUrl)) {
      setError(t('create.errBlocked'))
      return
    }
    const wrongNet = isConnected && !customMode && walletChainId !== target.chainId
    if (wrongNet) return
    const tipTarget =
      tipWei > 0n && tipEnabled && target.tipAddress
        ? (target.tipAddress as `0x${string}`)
        : config.dataRecipient
    try {
      setPhase('sending')
      let hash: `0x${string}`
      let blockNumber: bigint
      let transactionIndex: number

      if (customMode && !getChainById(target.chainId)) {
        if (!walletClient.data) throw new Error('wallet client unavailable')
        const tx = await walletClient.data.sendTransaction({
          account: address,
          to: tipTarget,
          value: tipWei,
          data: calldata as `0x${string}`,
        })
        hash = tx
        setPhase('waiting')
        const receipt = await waitForReceiptRpc(target.rpcs, hash, 60_000)
        if (!receipt) {
          pendingStore.save({
            txHash: hash,
            chainId: target.chainId,
            prefix: target.prefix,
            url: trimmedUrl,
            linkDomain,
            createdAt: Date.now(),
          })
          navigate(`/pending/${target.prefix || target.chainId}/${hash}`)
          return
        }
        blockNumber = receipt.blockNumber
        transactionIndex = receipt.transactionIndex
      } else {
        const sent = await sendTransactionAsync({
          chainId: target.chainId,
          to: tipTarget,
          value: tipWei,
          data: calldata as `0x${string}`,
        })
        hash = sent
        setPhase('waiting')
        try {
          const receipt = await waitForTransactionReceipt(wagmiConfig, {
            hash,
            confirmations: 1,
            timeout: 60_000,
          })
          blockNumber = receipt.blockNumber
          transactionIndex = receipt.transactionIndex
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          if (!/timeout|timed out/i.test(msg)) throw e
          pendingStore.save({
            txHash: hash,
            chainId: target.chainId,
            prefix: target.prefix,
            url: trimmedUrl,
            linkDomain,
            createdAt: Date.now(),
          })
          navigate(`/pending/${target.prefix || target.chainId}/${hash}`)
          return
        }
      }

      const id = encodeTxPointer({ blockNumber, transactionIndex })
      const baseOrigin = linkDomain ? `https://${linkDomain}` : window.location.origin
      const link = customMode
        ? `${baseOrigin}${genericChainPath(target.chainId, id)}`
        : `${baseOrigin}/${target.prefix}/${id}`
      backupStore.save({
        chainId: target.chainId,
        prefix: target.prefix,
        id,
        blockNumber: blockNumber.toString(),
        transactionIndex,
        txHash: hash,
        url: trimmedUrl,
        timestamp: Date.now(),
      })
      setResult({
        link,
        txHash: hash,
        explorerTx: target.explorerTx.replace('{hash}', hash),
        chainName: target.name,
      })
      setPhase('done')
    } catch (e) {
      setPhase('idle')
      setError(classifyTxError(e, t))
    }
  }

  async function handleCopy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  function resetForm() {
    setResult(null)
    setPhase('idle')
    setUrl('')
    setTipUsd(TIP_DEFAULT_USD)
    setError(null)
  }

  if (phase === 'done' && result) {
    return (
      <div className="main-narrow center-narrow">
        <div className="card">
          <div className="status-panel">
            <div className="alert alert-ok">
              <IconCheck />
              <span>{t('create.successTitle')}</span>
            </div>
            <div className="result-grid">
              <div className="result-item">
                <div className="k">{t('create.successLink')}</div>
                <div className="v">
                  <a href={result.link}>{result.link}</a>
                </div>
              </div>
              <div className="result-item">
                <div className="k">{t('create.chainLabel2')}</div>
                <div className="v">{result.chainName}</div>
              </div>
              <div className="result-item">
                <div className="k">{t('create.txHash')}</div>
                <div className="v">
                  <a href={result.explorerTx} target="_blank" rel="noreferrer">
                    {result.txHash}
                  </a>
                </div>
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn" onClick={handleCopy}>
                {copied ? t('create.copied') : t('create.copy')}
              </button>
              <a className="btn btn-outline" href={result.explorerTx} target="_blank" rel="noreferrer">
                {t('create.viewExplorer')}
              </a>
              <button type="button" className="btn btn-outline" onClick={resetForm}>
                {t('create.again')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const busy = phase === 'sending' || phase === 'waiting'
  const customReady = !customMode || (walletChainId !== undefined && Boolean(customChain))
  const canSubmit =
    urlValid && isConnected && customReady && !wrongNetwork && !busy && isWalletAllowed(address)

  return (
    <>
      <section className="hero">
        <div className="hero-grid" />
        <HeroBackdrop />
        <div className="hero-content">
          <div className="hero-tag">
            <span className="dot" />
            {t('hero.tag')}
          </div>
          <h1 className="display">{t('hero.title')}</h1>
          <p className="hero-lede">{t('hero.lede')}</p>
          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-lg"
              onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              {t('hero.ctaCreate')}
            </button>
            <Link to="/about" className="btn btn-lg btn-outline">
              {t('hero.ctaAbout')}
            </Link>
          </div>
          <div className="stat-strip">
            <div className="stat">
              <div className="stat-value">0%</div>
              <div className="stat-label">{t('stats.contracts')}</div>
            </div>
            <div className="stat">
              <div className="stat-value">{chains.length}+</div>
              <div className="stat-label">{t('stats.chains')}</div>
            </div>
            <div className="stat">
              <div className="stat-value">&lt;$0.002</div>
              <div className="stat-label">{t('stats.cost')}</div>
            </div>
            <div className="stat">
              <div className="stat-value">100%</div>
              <div className="stat-label">{t('stats.resolve')}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="create-section" ref={formRef} id="create">
        <div className="card create-card">
          <div className="card-head">
            <h2 className="card-title">{t('create.title')}</h2>
            <p className="card-desc">{t('create.subtitle')}</p>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="target-url">
              {t('create.urlLabel')}
            </label>
            <input
              id="target-url"
              type="url"
              className="mono"
              placeholder={t('create.urlPlaceholder')}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={busy}
            />
            {urlNonEmpty && !urlValid && <div className="field-error">{t('create.urlInvalid')}</div>}
            {urlValid && (
              <div className={`estimate-row${chain.testnet ? ' testnet' : ''}`}>
                <span>
                  {t('create.estimateBytes')}: <b>{dataBytes} B</b>
                </span>
                {gasEstimate && (
                  <>
                    <span>
                      {t('create.estimateGas')}: <b>{gasEstimate.gas.toString()}</b>
                    </span>
                    <span>
                      {t('create.estimateCost')}:{' '}
                      <b>
                        ≈ {formatEther(gasEstimate.costWei)} {activeChain.nativeSymbol}
                        {chainPrice.usd && (
                          <>
                            {' '}
                            (
                            <span className="price-strike">
                              ${(Number(formatEther(gasEstimate.costWei)) * chainPrice.usd).toFixed(4)}
                              {lang === 'zh' && chainPrice.cny
                                ? ` / ¥${(Number(formatEther(gasEstimate.costWei)) * chainPrice.cny).toFixed(4)}`
                                : ''}
                            </span>
                            )
                          </>
                        )}
                      </b>
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {config.linkDomains.length > 0 && (
            <div className="field">
              <span className="field-label">{t('create.domainLabel')}</span>
            <div className="chip-row chip-fill chip-nowrap">
                <button
                  type="button"
                  className={`chip${linkDomain === '' ? ' selected' : ''}`}
                  onClick={() => setLinkDomain('')}
                  disabled={busy}
                >
                  {currentHost}
                </button>
                {linkDomains.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`chip${linkDomain === d ? ' selected' : ''}`}
                    onClick={() => setLinkDomain(d)}
                    disabled={busy}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <span className="field-label">{t('create.chainLabel')}</span>
            <div className="chip-row chip-fill">
              {mainChains.map((c) => (
                <button
                  key={c.prefix}
                  type="button"
                  className={`chip${c.brandColor ? ' chip-brand' : ''}${!customMode && c.prefix === chain.prefix ? ' selected' : ''}`}
                  style={
                    c.brandColor
                      ? ({
                          '--brand': c.brandColor,
                          '--brand-text': c.brandTextColor ?? c.brandColor,
                        } as React.CSSProperties)
                      : undefined
                  }
                  onClick={() => {
                    setCustomMode(false)
                    setPrefix(c.prefix)
                  }}
                  disabled={busy}
                >
                  {c.name}
                  {c.testnet && <span className="badge">{t('create.testnetBadge')}</span>}
                </button>
              ))}
              {extraChains.length > 0 && (
                <button
                  type="button"
                  className={`chip${selectedExtra ? ' chip-brand selected' : ' chip-primary'}`}
                  style={
                    selectedExtra?.brandColor
                      ? ({
                          '--brand': selectedExtra.brandColor,
                          '--brand-text': selectedExtra.brandTextColor ?? selectedExtra.brandColor,
                        } as React.CSSProperties)
                      : undefined
                  }
                  onClick={() => setMoreOpen(true)}
                  disabled={busy}
                >
                  {selectedExtra ? selectedExtra.name : `${t('create.more')} +`}
                </button>
              )}
            </div>
            {customMode && (
              <div className="alert alert-warn">
                {t('create.moreHint')}
                {walletChainId !== undefined && (
                  <>
                    {' '}
                    {customChain
                      ? `${t('create.moreDetected')}: ${customChain.name} (${customChain.chainId})`
                      : `${t('create.moreDetected')}: ${walletChainId}`}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="field">
            {!isConnected ? (
              <button
                type="button"
                className="btn btn-outline btn-block"
                onClick={() => {
                  setError(null)
                  setConnectOpen(true)
                }}
              >
                {t('create.connectWallet')}
              </button>
            ) : (
              <div className="wallet-bar">
                <span className="status-dot" />
                <span className="wallet-addr">
                  {address?.slice(0, 6)}…{address?.slice(-4)}
                </span>
                <span style={{ color: 'var(--muted-fg)' }}>{activeChain.name}</span>
                {wrongNetwork && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => switchChain({ chainId: chain.chainId })}
                  >
                    {t('create.switchNetwork', { chain: chain.name })}
                  </button>
                )}
                <span style={{ flex: 1 }} />
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => disconnect()}>
                  {t('create.disconnect')}
                </button>
              </div>
            )}
            {wrongNetwork && <div className="field-error">{t('create.wrongNetwork')}</div>}
            {customMode && !customChain && walletChainId !== undefined && (
              <div className="field-error">{t('create.moreUnsupported', { chainId: walletChainId })}</div>
            )}
            {isConnected && address && !isWalletAllowed(address) && (
              <div className="field-error">{t('create.errWhitelist')}</div>
            )}
          </div>

          {tipEnabled && (
            <div className="field">
              <span className="field-label">{t('create.tipTitle')}</span>
              <div className="field-hint" style={{ marginBottom: 8 }}>
                {t('create.tipFree')}
              </div>
              <div className="tip-row">
                <input
                  type="range"
                  className="tip-range"
                  min={0}
                  max={100}
                  step={1}
                  value={tipUsd <= 0 ? 0 : tipSliderFromUsd(tipUsd)}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setTipUsd(v === 0 ? 0 : tipUsdFromSlider(v))
                  }}
                  disabled={busy || !chainPrice.usd}
                />
                <div className="tip-value">{tipLabel()}</div>
                <label className="checkbox-row tip-free">
                  <input
                    type="checkbox"
                    checked={tipUsd <= 0}
                    onChange={(e) => setTipUsd(e.target.checked ? 0 : TIP_DEFAULT_USD)}
                    disabled={busy}
                  />
                  <span>{t('create.tipZero')}</span>
                </label>
              </div>
              <div className="tip-scale">
                <span>$0.01</span>
                <span>$0.1</span>
                <span>$1</span>
                <span>$10</span>
              </div>
              <details className="advanced">
                <summary>{t('create.advanced')}</summary>
                <div className="field" style={{ marginTop: 12 }}>
                  <div className="field-hint" style={{ color: 'var(--warn)' }}>
                    {t('create.tipAddressNote', { address: tipAddress ?? '' })}
                  </div>
                </div>
                <div className="field-hint">{t('create.gasNote')}</div>
              </details>
            </div>
          )}

          {error && <div className="alert alert-danger">{error}</div>}

          <button type="button" className="btn btn-block btn-lg" onClick={handleSubmit} disabled={!canSubmit}>
            {phase === 'sending'
              ? t('create.submitting')
              : phase === 'waiting'
                ? t('create.waiting')
                : t('create.submit')}
          </button>

          {!customMode && chain.testnet && (
            <div className="alert alert-warn alert-sm" style={{ marginBottom: 0 }}>
              <span>
                {t('create.testnetWarning')}
                {chain.resetNote === 'monthly' && t('create.testnetResetMonthly')}
                {chain.faucetUrl && (
                  <>
                    {' '}
                    <a
                      className="faucet-link"
                      href={chain.faucetUrl}
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
        </div>
      </section>

      <section className="steps">
        <div className="step">
          <div className="step-num">01</div>
          <h3 className="step-title">{t('steps.s1t')}</h3>
          <p className="step-desc">{t('steps.s1d')}</p>
        </div>
        <div className="step">
          <div className="step-num">02</div>
          <h3 className="step-title">{t('steps.s2t')}</h3>
          <p className="step-desc">{t('steps.s2d')}</p>
        </div>
        <div className="step">
          <div className="step-num">03</div>
          <h3 className="step-title">{t('steps.s3t')}</h3>
          <p className="step-desc">{t('steps.s3d')}</p>
        </div>
      </section>

      <ConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} />
      <ChainModal
        open={moreOpen}
        chains={extraChains}
        selectedPrefix={chain.prefix}
        onSelect={(p) => {
          setCustomMode(false)
          setPrefix(p)
        }}
        onCustom={() => setCustomMode(true)}
        onClose={() => setMoreOpen(false)}
      />
    </>
  )
}

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD'

export interface AppConfig {
  appName: string
  callDataVersion: string
  defaultPrefix: string
  wcProjectId: string
  gsbApiKey: string
  gsbUrl: string
  mainChainPrefixes: string[]
  linkDomains: string[]
  walletWhitelist: string[]
  hiddenChains: string[]
  chainWhitelist: string[]
  chainBlacklist: string[]
  maxUrlLength: number
  redirectCountdownSeconds: number
  rpcTimeoutMs: number
  showTestnets: boolean
  rpcProxyUrl: string
  dataRecipient: `0x${string}`
  hideBlockedUrl: boolean
}

const csv = (v: string | undefined): string[] =>
  (v?.trim() ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

export const config: AppConfig = {
  appName: import.meta.env.VITE_APP_NAME?.trim() || 'EURL',
  callDataVersion: 'U1',
  defaultPrefix: 'b',
  wcProjectId: import.meta.env.VITE_WC_PROJECT_ID?.trim() ?? '',
  gsbApiKey: import.meta.env.VITE_GSB_API_KEY?.trim() ?? '',
  gsbUrl: import.meta.env.VITE_GSB_URL?.trim() ?? '',
  mainChainPrefixes: csv(import.meta.env.VITE_MAIN_CHAINS),
  linkDomains: csv(import.meta.env.VITE_LINK_DOMAINS),
  walletWhitelist: csv(import.meta.env.VITE_WALLET_WHITELIST).map((a) => a.toLowerCase()),
  hiddenChains: csv(import.meta.env.VITE_HIDDEN_CHAINS),
  chainWhitelist: csv(import.meta.env.VITE_CHAIN_WHITELIST),
  chainBlacklist: csv(import.meta.env.VITE_CHAIN_BLACKLIST),
  maxUrlLength: 2000,
  redirectCountdownSeconds: 3,
  rpcTimeoutMs: 10_000,
  showTestnets: true,
  rpcProxyUrl: '',
  dataRecipient: DEAD_ADDRESS,
  hideBlockedUrl: false,
}

const strArr = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
    : []

export async function loadRuntimeConfig(): Promise<void> {
  try {
    const res = await fetch('/config.json', { cache: 'no-store' })
    if (!res.ok) return
    const json = (await res.json()) as Partial<Record<keyof AppConfig, unknown>>
    const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

    if (s(json.appName)) config.appName = s(json.appName)
    if (s(json.callDataVersion)) config.callDataVersion = s(json.callDataVersion)
    if (s(json.defaultPrefix)) config.defaultPrefix = s(json.defaultPrefix)
    if (typeof json.wcProjectId === 'string') config.wcProjectId = json.wcProjectId.trim()
    if (typeof json.gsbApiKey === 'string') config.gsbApiKey = json.gsbApiKey.trim()
    if (typeof json.gsbUrl === 'string') config.gsbUrl = json.gsbUrl.trim()
    if (Array.isArray(json.mainChainPrefixes)) config.mainChainPrefixes = strArr(json.mainChainPrefixes)
    if (Array.isArray(json.linkDomains)) config.linkDomains = strArr(json.linkDomains)
    if (Array.isArray(json.walletWhitelist)) config.walletWhitelist = strArr(json.walletWhitelist).map((a) => a.toLowerCase())
    if (Array.isArray(json.hiddenChains)) config.hiddenChains = strArr(json.hiddenChains)
    if (Array.isArray(json.chainWhitelist)) config.chainWhitelist = strArr(json.chainWhitelist)
    if (Array.isArray(json.chainBlacklist)) config.chainBlacklist = strArr(json.chainBlacklist)
    if (typeof json.maxUrlLength === 'number' && json.maxUrlLength > 0) config.maxUrlLength = json.maxUrlLength
    if (typeof json.redirectCountdownSeconds === 'number' && json.redirectCountdownSeconds > 0) {
      config.redirectCountdownSeconds = json.redirectCountdownSeconds
    }
    if (typeof json.rpcTimeoutMs === 'number' && json.rpcTimeoutMs > 0) config.rpcTimeoutMs = json.rpcTimeoutMs
    if (typeof json.showTestnets === 'boolean') config.showTestnets = json.showTestnets
    if (typeof json.hideBlockedUrl === 'boolean') config.hideBlockedUrl = json.hideBlockedUrl
    if (typeof json.rpcProxyUrl === 'string') config.rpcProxyUrl = json.rpcProxyUrl.trim()
    if (s(json.dataRecipient) && /^0x[0-9a-fA-F]{40}$/.test(s(json.dataRecipient))) {
      config.dataRecipient = s(json.dataRecipient) as `0x${string}`
    }
  } catch {
    // keep defaults
  }
}

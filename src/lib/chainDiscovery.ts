import type { ChainConfig } from '../config/chains'

const PER_CHAIN_URL = (chainId: number) =>
  `https://raw.githubusercontent.com/ethereum-lists/chains/master/_data/chains/eip155-${chainId}.json`

const AGGREGATE_URL = 'https://chainid.network/chains.json'

const CACHE_KEY = 'eurl:chainmeta'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface RawChainMeta {
  name?: string
  chainId?: number
  nativeCurrency?: { name?: string; symbol?: string; decimals?: number }
  rpc?: string[]
  explorers?: { name?: string; url?: string }[]
}

export interface DiscoveredChain {
  chainId: number
  name: string
  nativeSymbol: string
  rpcs: string[]
  explorer: string
  explorerTx: string
}

interface Cache {
  at: number
  entries: Record<number, DiscoveredChain>
}

let memory: Cache | null = null

function httpRpcs(raw: RawChainMeta): string[] {
  const out: string[] = []
  for (const r of raw.rpc ?? []) {
    if (!r.startsWith('https://')) continue
    if (out.includes(r)) continue
    out.push(r)
  }
  return out.slice(0, 3)
}

function toDiscovered(raw: RawChainMeta): DiscoveredChain | null {
  const chainId = raw.chainId
  if (!chainId || chainId <= 0) return null
  const rpcs = httpRpcs(raw)
  if (rpcs.length === 0) return null
  const explorer = raw.explorers?.find((e) => e.url)?.url ?? ''
  return {
    chainId,
    name: raw.name ?? `Chain ${chainId}`,
    nativeSymbol: raw.nativeCurrency?.symbol ?? 'ETH',
    rpcs,
    explorer,
    explorerTx: explorer ? `${explorer.replace(/\/$/, '')}/tx/{hash}` : '',
  }
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as unknown
  } finally {
    clearTimeout(timer)
  }
}

export async function discoverChain(chainId: number): Promise<DiscoveredChain | null> {
  if (memory) {
    const hit = memory.entries[chainId]
    if (hit) return hit
    if (Date.now() - memory.at > CACHE_TTL_MS) memory = null
  }

  if (!memory) {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Cache
        if (parsed && parsed.at && parsed.entries && Date.now() - parsed.at < CACHE_TTL_MS) {
          memory = parsed
          const hit = memory.entries[chainId]
          if (hit) return hit
        }
      }
    } catch {
      /* ignore corrupt cache */
    }
  }

  try {
    const raw = (await fetchJson(PER_CHAIN_URL(chainId), 8000)) as RawChainMeta
    const found = toDiscovered(raw)
    if (!memory) memory = { at: Date.now(), entries: {} }
    if (found) memory.entries[chainId] = found
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(memory))
    } catch {
      /* quota exceeded */
    }
    return found
  } catch {
    /* per-chain file failed, fall back to aggregate */
  }

  try {
    const list = (await fetchJson(AGGREGATE_URL, 12_000)) as RawChainMeta[]
    if (!memory) memory = { at: Date.now(), entries: {} }
    for (const entry of list) {
      const d = toDiscovered(entry)
      if (d && !memory.entries[d.chainId]) memory.entries[d.chainId] = d
    }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(memory))
    } catch {
      /* quota exceeded */
    }
    return memory.entries[chainId] ?? null
  } catch {
    return null
  }
}

export function chainToConfig(chain: DiscoveredChain): ChainConfig {
  return {
    prefix: '',
    chainId: chain.chainId,
    name: chain.name,
    nativeSymbol: chain.nativeSymbol,
    rpcs: chain.rpcs,
    explorer: chain.explorer,
    explorerTx: chain.explorerTx,
    testnet: false,
  }
}

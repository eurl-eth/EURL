import { hostAndParents } from './safety'

const TREE_URL = 'https://api.github.com/repos/eurl-eth/blocklist/git/trees/main?recursive=1'
const CACHE_KEY = 'eurl:blocklist-tree'
const CACHE_TTL_MS = 60 * 60 * 1000

export interface ErulBlocklist {
  shortLinks: Map<string, string[]>
  hosts: string[]
  hostPaths: Map<string, string[]>
  wallets: string[]
}

let memoryCache: ErulBlocklist | null = null

export function parsePaths(paths: string[]): ErulBlocklist {
  const shortLinks = new Map<string, string[]>()
  const hosts: string[] = []
  const hostPaths = new Map<string, string[]>()
  const wallets: string[] = []

  for (const raw of paths) {
    if (!raw.endsWith('.json')) continue
    const path = raw.slice(0, -'.json'.length)
    if (path.startsWith('target/')) {
      const rest = path.slice('target/'.length)
      const slash = rest.indexOf('/')
      if (slash === -1) {
        hosts.push(rest.toLowerCase())
      } else {
        const host = rest.slice(0, slash).toLowerCase()
        const sub = rest.slice(slash + 1)
        const arr = hostPaths.get(host) ?? []
        arr.push(sub)
        hostPaths.set(host, arr)
      }
    } else if (path.startsWith('wallet/')) {
      const address = path.slice('wallet/'.length)
      if (/^0x[0-9a-fA-F]{40}$/.test(address)) wallets.push(address.toLowerCase())
    } else {
      const slash = path.indexOf('/')
      if (slash === -1) continue
      const prefix = path.slice(0, slash)
      const code = path.slice(slash + 1)
      const arr = shortLinks.get(prefix) ?? []
      arr.push(code)
      shortLinks.set(prefix, arr)
    }
  }
  return { shortLinks, hosts, hostPaths, wallets }
}

function readCache(): ErulBlocklist | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; paths: string[] }
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > CACHE_TTL_MS) return null
    if (!Array.isArray(parsed.paths)) return null
    return parsePaths(parsed.paths)
  } catch {
    return null
  }
}

function writeCache(paths: string[]): void {
  try {
    const serialized = JSON.stringify({ at: Date.now(), paths })
    if (serialized.length > 1_000_000) return
    localStorage.setItem(CACHE_KEY, serialized)
  } catch {
    /* storage full or unavailable */
  }
}

let inflight: Promise<ErulBlocklist | null> | null = null

export function loadBlocklist(timeoutMs = 12_000): Promise<ErulBlocklist | null> {
  if (memoryCache) return Promise.resolve(memoryCache)
  if (!inflight) {
    inflight = doLoad(timeoutMs).finally(() => {
      inflight = null
    })
  }
  return inflight
}

async function doLoad(timeoutMs: number): Promise<ErulBlocklist | null> {
  const cached = readCache()
  if (cached) {
    memoryCache = cached
    return cached
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(TREE_URL, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const json = (await res.json()) as { tree?: { path?: string; type?: string }[] }
    const paths = (json.tree ?? [])
      .filter((t) => t.type === 'blob' && typeof t.path === 'string')
      .map((t) => t.path as string)
    if (paths.length === 0) return null
    const parsed = parsePaths(paths)
    memoryCache = parsed
    writeCache(paths)
    return parsed
  } catch {
    return null
  }
}

export async function isShortLinkBlocked(prefix: string, code: string): Promise<boolean> {
  const list = await loadBlocklist()
  if (!list) return false
  return list.shortLinks.get(prefix)?.includes(code) ?? false
}

export function isHostBlocked(list: ErulBlocklist, hostname: string): boolean {
  const host = hostname.toLowerCase()
  return hostAndParents(host).some((h) => list.hosts.includes(h))
}

export function isHostPathBlocked(list: ErulBlocklist, hostname: string, pathname: string): boolean {
  const host = hostname.toLowerCase()
  const entries = list.hostPaths.get(host)
  if (!entries || entries.length === 0) return false
  const cleanPath = pathname === '' ? '/' : pathname
  return entries.some((e) => {
    if (!cleanPath.startsWith(`/${e}`)) return false
    const rest = cleanPath.slice(e.length + 1)
    return rest === '' || rest.startsWith('/')
  })
}

export async function isTargetUrlBlocked(url: string): Promise<boolean> {
  const list = await loadBlocklist()
  if (!list) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (isHostBlocked(list, parsed.hostname)) return true
  return isHostPathBlocked(list, parsed.hostname, parsed.pathname)
}

export function isWalletBlocked(list: ErulBlocklist, address: string): boolean {
  return list.wallets.includes(address.toLowerCase())
}

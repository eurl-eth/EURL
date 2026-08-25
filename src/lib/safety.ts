import { config } from '../config/app'

export type SafetyVerdict =
  | { status: 'safe' }
  | { status: 'blocked'; reason: string }
  | { status: 'unknown'; reason: string }

const METAMASK_LIST_URL =
  'https://cdn.jsdelivr.net/gh/MetaMask/eth-phishing-detect@master/src/config.json'
const CACHE_KEY = 'eurl:mm-phishing'
const CACHE_TTL_MS = 12 * 60 * 60 * 1000

interface PhishingConfig {
  blocklist: string[]
  allowlist: string[]
}

let memoryCache: PhishingConfig | null = null

export function __resetSafetyCache(): void {
  memoryCache = null
  inflight = null
}

function readLocalCache(): PhishingConfig | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; data: PhishingConfig }
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > CACHE_TTL_MS) return null
    if (!Array.isArray(parsed.data?.blocklist)) return null
    return parsed.data
  } catch {
    return null
  }
}

const MAX_CACHE_BYTES = 3_500_000

function writeLocalCache(data: PhishingConfig): void {
  try {
    const serialized = JSON.stringify({ at: Date.now(), data })
    if (serialized.length > MAX_CACHE_BYTES) return
    localStorage.setItem(CACHE_KEY, serialized)
  } catch {
    /* storage full or unavailable */
  }
}

let inflight: Promise<PhishingConfig | null> | null = null

export function loadPhishingList(timeoutMs = 12_000): Promise<PhishingConfig | null> {
  if (memoryCache) return Promise.resolve(memoryCache)
  if (!inflight) {
    inflight = doLoadPhishingList(timeoutMs).finally(() => {
      inflight = null
    })
  }
  return inflight
}

async function doLoadPhishingList(timeoutMs: number): Promise<PhishingConfig | null> {
  const cached = readLocalCache()
  if (cached) {
    memoryCache = cached
    return cached
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(METAMASK_LIST_URL, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const json = (await res.json()) as Partial<PhishingConfig> & {
      blacklist?: string[]
      whitelist?: string[]
    }
    const rawBlocklist = json.blocklist ?? json.blacklist
    if (!Array.isArray(rawBlocklist)) return null
    const rawAllowlist = json.allowlist ?? json.whitelist
    const data: PhishingConfig = {
      blocklist: rawBlocklist.map((d) => d.toLowerCase()),
      allowlist: Array.isArray(rawAllowlist) ? rawAllowlist.map((d) => d.toLowerCase()) : [],
    }
    memoryCache = data
    writeLocalCache(data)
    return data
  } catch {
    return null
  }
}

export function hostAndParents(hostname: string): string[] {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  const parts = host.split('.')
  const out: string[] = []
  for (let i = 0; i < parts.length - 1; i++) {
    out.push(parts.slice(i).join('.'))
  }
  return out
}

export function checkLocalRules(url: string): { ok: true } | { ok: false; reason: string } {
  if (typeof url !== 'string' || url.length === 0) return { ok: false, reason: 'empty url' }
  if (url.length > config.maxUrlLength) return { ok: false, reason: 'url too long' }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(url)) return { ok: false, reason: 'url contains control characters' }
  if (!/^https?:\/\//i.test(url)) return { ok: false, reason: 'scheme must be http or https' }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, reason: 'malformed url' }
  }
  if (!parsed.hostname) return { ok: false, reason: 'missing hostname' }
  if (parsed.username || parsed.password) return { ok: false, reason: 'embedded credentials are not allowed' }
  return { ok: true }
}

export function gsbUrlVariants(url: string): string[] {
  const parsed = new URL(url)
  const scheme = parsed.protocol.toLowerCase()
  const host = parsed.hostname.toLowerCase()
  const variants = new Set<string>()
  variants.add(`${scheme}//${host}/`)
  const path = parsed.pathname === '' ? '/' : parsed.pathname
  const segments = path.split('/').filter(Boolean)
  let acc = ''
  for (const seg of segments.slice(0, 4)) {
    acc += `/${seg}`
    variants.add(`${scheme}//${host}${acc}/`)
    variants.add(`${scheme}//${host}${acc}`)
  }
  variants.add(`${scheme}//${host}${path}`)
  if (parsed.search) variants.add(`${scheme}//${host}${path}${parsed.search}`)
  return [...variants]
}

async function gsbCheck(url: string): Promise<boolean> {
  const variants = gsbUrlVariants(url)
  const entries: { url: string }[] = variants.map((v) => ({ url: v }))
  const endpoint = config.gsbUrl || 'https://safebrowsing.googleapis.com/v5/threatMatches:find'
  const base =
    /threatMatches:find$/.test(endpoint) || /v[45]\//.test(endpoint)
      ? endpoint
      : `${endpoint.replace(/\/$/, '')}/v4/threatMatches:find`
  const query = config.gsbApiKey ? `?key=${encodeURIComponent(config.gsbApiKey)}` : ''
  const res = await fetch(`${base}${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      threatInfo: {
        threatTypes: [
          'MALWARE',
          'SOCIAL_ENGINEERING',
          'UNWANTED_SOFTWARE',
          'POTENTIALLY_HARMFUL_APPLICATION',
        ],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: entries,
      },
    }),
  })
  if (!res.ok) throw new Error(`GSB HTTP ${res.status}`)
  const json = (await res.json()) as { matches?: unknown[] }
  return Array.isArray(json.matches) && json.matches.length > 0
}

export async function checkUrlSafety(url: string): Promise<SafetyVerdict> {
  const local = checkLocalRules(url)
  if (!local.ok) return { status: 'blocked', reason: local.reason }

  let hostname = ''
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return { status: 'blocked', reason: 'malformed url' }
  }

  let checkedExternal = false
  let attemptedExternal = 0

  attemptedExternal++
  const list = await loadPhishingList()
  if (list) {
    checkedExternal = true
    const candidates = hostAndParents(hostname)
    const blocked = candidates.some((h) => list.blocklist.includes(h))
    if (blocked) return { status: 'blocked', reason: 'domain is on the MetaMask phishing list' }
  }

  if (config.gsbApiKey || config.gsbUrl) {
    attemptedExternal++
    try {
      const hit = await gsbCheck(url)
      checkedExternal = true
      if (hit) return { status: 'blocked', reason: 'flagged by Google Safe Browsing' }
    } catch {
      /* treated as unavailable */
    }
  }

  if (!checkedExternal && attemptedExternal > 0) {
    return { status: 'unknown', reason: 'safety check services are unreachable' }
  }
  return { status: 'safe' }
}

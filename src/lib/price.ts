const CACHE_TTL_MS = 5 * 60 * 1000

export interface ChainPrice {
  usd: number | null
  cny: number | null
}

export const PRICE_IDS = {
  ethereum: 'ethereum',
  binancecoin: 'binancecoin',
  pol: 'polygon-ecosystem-token',
  xdai: 'xdai',
  avalanche: 'avalanche-2',
  celo: 'celo',
  mantle: 'mantle',
  monad: 'monad',
  plasma: 'plasma',
} as const

let cache: { price: Record<string, ChainPrice>; at: number } | null = null

export async function getPrices(): Promise<Record<string, ChainPrice>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.price
  try {
    const ids = Object.values(PRICE_IDS).join(',')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,cny`,
      { signal: controller.signal },
    )
    clearTimeout(timer)
    if (!res.ok) return {}
    const json = (await res.json()) as Record<string, { usd?: number; cny?: number }>
    const out: Record<string, ChainPrice> = {}
    for (const [id, v] of Object.entries(json)) {
      out[id] = {
        usd: typeof v.usd === 'number' && v.usd > 0 ? v.usd : null,
        cny: typeof v.cny === 'number' && v.cny > 0 ? v.cny : null,
      }
    }
    cache = { price: out, at: Date.now() }
    return out
  } catch {
    return {}
  }
}

export async function getChainPrice(priceId: string): Promise<ChainPrice> {
  const all = await getPrices()
  return all[priceId] ?? { usd: null, cny: null }
}

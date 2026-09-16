const CHAIN_RPCS: Record<string, string[]> = {
  '8453': ['https://mainnet.base.org', 'https://base-rpc.publicnode.com', 'https://base.drpc.org', 'https://1rpc.io/base', 'https://base.meowrpc.com'],
  '42161': ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one-rpc.publicnode.com', 'https://arbitrum.drpc.org', 'https://1rpc.io/arb', 'https://arbitrum.meowrpc.com', 'https://arbitrum.publicnode.com'],
  '10': ['https://mainnet.optimism.io', 'https://optimism-rpc.publicnode.com'],
  '1': ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org', 'https://1rpc.io/eth', 'https://eth.merkle.io', 'https://mainnet.gateway.tenderly.co', 'https://ethereum.publicnode.com'],
  '84532': ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com'],
  '421614': ['https://sepolia-rollup.arbitrum.io/rpc', 'https://arbitrum-sepolia-rpc.publicnode.com'],
  '11155111': ['https://ethereum-sepolia-rpc.publicnode.com', 'https://ethereum-sepolia.publicnode.com', 'https://sepolia.gateway.tenderly.co', 'https://1rpc.io/sepolia'],
}

const ALLOWED_METHODS = new Set([
  'eth_getTransactionByBlockNumberAndIndex',
  'eth_getTransactionByHash',
  'eth_getBlockByNumber',
  'eth_chainId',
])

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
  }
}

function isImmutableCall(method: string, params: unknown): boolean {
  if (method === 'eth_getTransactionByBlockNumberAndIndex' || method === 'eth_getTransactionByHash') {
    if (method === 'eth_getTransactionByBlockNumberAndIndex') {
      const block = Array.isArray(params) ? params[0] : undefined
      return typeof block === 'string' && /^0x[0-9a-fA-F]+$/.test(block)
    }
    return true
  }
  if (method === 'eth_getBlockByNumber') {
    const block = Array.isArray(params) ? params[0] : undefined
    return typeof block === 'string' && /^0x[0-9a-fA-F]+$/.test(block)
  }
  return false
}

export default {
  async fetch(req: Request): Promise<Response> {
    const cors = corsHeaders()

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }
    if (req.method !== 'POST') {
      return new Response('method not allowed', { status: 405, headers: cors })
    }

    const url = new URL(req.url)
    const chainId = url.pathname.split('/')[1] ?? ''
    const rpcs = CHAIN_RPCS[chainId]
    if (!rpcs) {
      return new Response('unsupported chain', { status: 404, headers: cors })
    }

    const body = await req.text()
    let parsed: { id?: unknown; method?: string; params?: unknown }
    try {
      parsed = JSON.parse(body)
    } catch {
      return new Response('invalid json', { status: 400, headers: cors })
    }

    const method = parsed.method ?? ''
    if (!ALLOWED_METHODS.has(method)) {
      return new Response('method not allowed', { status: 403, headers: cors })
    }

    let lastError = 'unknown'
    for (const rpc of rpcs) {
      try {
        const upstream = await fetch(rpc, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        })
        if (!upstream.ok) {
          lastError = `HTTP ${upstream.status}`
          continue
        }
        const text = await upstream.text()
        const headers: Record<string, string> = { ...cors, 'content-type': 'application/json' }
        if (isImmutableCall(method, parsed.params)) {
          headers['cache-control'] = 'public, s-maxage=31536000, stale-while-revalidate=31536000'
        } else {
          headers['cache-control'] = 'no-store'
        }
        return new Response(text, { status: 200, headers })
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e)
      }
    }

    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: parsed.id ?? null,
        error: { code: -32000, message: `proxy upstream failed: ${lastError}` },
      }),
      { status: 502, headers: { ...cors, 'content-type': 'application/json' } },
    )
  },
}

import { config } from '../config/app'
import type { ChainConfig } from '../config/chains'

export class RpcError extends Error {
  readonly code?: number

  constructor(message: string, code?: number) {
    super(message)
    this.name = 'RpcError'
    this.code = code
  }
}

export interface ChainTransaction {
  hash: string
  input: string
  from: string
  to: string | null
  blockNumber: bigint
  transactionIndex: number
  value: bigint
}

export function rpcEndpointsFor(chain: ChainConfig): string[] {
  if (config.rpcProxyUrl) {
    return [`${config.rpcProxyUrl.replace(/\/$/, '')}/${chain.chainId}`, ...chain.rpcs]
  }
  return chain.rpcs
}

export async function rawRpcCall(
  url: string,
  method: string,
  params: unknown[],
  timeoutMs: number = config.rpcTimeoutMs,
): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    })
    if (!res.ok) throw new RpcError(`HTTP ${res.status} from ${url}`)
    const json = (await res.json()) as { result?: unknown; error?: { code?: number; message?: string } }
    if (json.error) throw new RpcError(json.error.message ?? 'rpc error', json.error.code)
    return json.result
  } catch (e) {
    if (e instanceof RpcError) throw e
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new RpcError(`timeout after ${timeoutMs}ms: ${url}`)
    }
    throw new RpcError(`network error: ${url} (${e instanceof Error ? e.message : String(e)})`)
  } finally {
    clearTimeout(timer)
  }
}

export async function rpcCall(
  rpcs: string[],
  method: string,
  params: unknown[],
  timeoutMs: number = config.rpcTimeoutMs,
): Promise<unknown> {
  if (rpcs.length === 0) throw new RpcError('no rpc endpoints configured')
  let lastError: unknown
  for (const url of rpcs) {
    try {
      return await rawRpcCall(url, method, params, timeoutMs)
    } catch (e) {
      lastError = e
    }
  }
  throw lastError instanceof Error ? lastError : new RpcError('all rpc endpoints failed')
}

export async function getTransactionByPointer(
  rpcs: string[],
  blockNumber: bigint,
  transactionIndex: number,
): Promise<ChainTransaction | null> {
  const result = await rpcCall(rpcs, 'eth_getTransactionByBlockNumberAndIndex', [
    `0x${blockNumber.toString(16)}`,
    `0x${transactionIndex.toString(16)}`,
  ])
  if (result === null || result === undefined) return null
  const tx = result as Record<string, string | null>
  if (typeof tx.hash !== 'string' || typeof tx.input !== 'string') return null
  return {
    hash: tx.hash,
    input: tx.input,
    from: tx.from ?? '',
    to: tx.to ?? null,
    blockNumber: BigInt(tx.blockNumber ?? '0x0'),
    transactionIndex: Number(BigInt(tx.transactionIndex ?? '0x0')),
    value: BigInt(tx.value ?? '0x0'),
  }
}

export async function getGasPrice(rpcs: string[]): Promise<bigint | null> {
  try {
    const result = await rpcCall(rpcs, 'eth_gasPrice', [])
    return typeof result === 'string' ? BigInt(result) : null
  } catch {
    return null
  }
}

export async function waitForReceiptRpc(
  rpcs: string[],
  hash: string,
  timeoutMs: number = 60_000,
  pollIntervalMs: number = 2_000,
): Promise<{ blockNumber: bigint; transactionIndex: number } | null> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      const result = await rpcCall(rpcs, 'eth_getTransactionReceipt', [hash])
      if (result && typeof result === 'object') {
        const r = result as Record<string, unknown>
        if (typeof r.blockNumber === 'string' && typeof r.transactionIndex === 'string') {
          return {
            blockNumber: BigInt(r.blockNumber),
            transactionIndex: Number(BigInt(r.transactionIndex)),
          }
        }
      }
    } catch (e) {
      lastError = e
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }
  if (lastError) throw lastError instanceof Error ? lastError : new Error('receipt timeout')
  return null
}

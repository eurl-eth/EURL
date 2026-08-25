import { base58Decode, base58Encode } from './base58'

export const TX_INDEX_BITS = 16n
export const TX_INDEX_MASK = (1n << TX_INDEX_BITS) - 1n

export interface TxPointer {
  blockNumber: bigint
  transactionIndex: number
}

export function encodeTxPointer(pointer: TxPointer): string {
  const txIndex = BigInt(pointer.transactionIndex)
  if (pointer.blockNumber < 0n || txIndex < 0n) {
    throw new Error('encodeTxPointer: negative value')
  }
  if (txIndex <= TX_INDEX_MASK) {
    return base58Encode((pointer.blockNumber << TX_INDEX_BITS) | txIndex)
  }
  return `${base58Encode(pointer.blockNumber)}.${base58Encode(txIndex)}`
}

export function decodeTxPointer(id: string): TxPointer {
  if (id.includes('.')) {
    const parts = id.split('.')
    if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
      throw new Error('decodeTxPointer: malformed fallback id')
    }
    const blockNumber = base58Decode(parts[0])
    const txIndex = base58Decode(parts[1])
    if (txIndex > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('decodeTxPointer: txIndex out of range')
    }
    return { blockNumber, transactionIndex: Number(txIndex) }
  }
  const packed = base58Decode(id)
  return {
    blockNumber: packed >> TX_INDEX_BITS,
    transactionIndex: Number(packed & TX_INDEX_MASK),
  }
}

export function shortPath(prefix: string, id: string): string {
  return `/${prefix}/${id}`
}

export function encodeChainId(chainId: number): string {
  if (!Number.isInteger(chainId) || chainId <= 0) throw new Error('encodeChainId: invalid chainId')
  return base58Encode(BigInt(chainId))
}

export function decodeChainIdParam(param: string): number | undefined {
  if (/^\d+$/.test(param)) {
    const n = Number(param)
    return Number.isSafeInteger(n) && n > 0 ? n : undefined
  }
  try {
    const n = base58Decode(param)
    return n > 0n && n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : undefined
  } catch {
    return undefined
  }
}

export function genericChainPath(chainId: number, id: string): string {
  return `/c/${encodeChainId(chainId)}/${id}`
}

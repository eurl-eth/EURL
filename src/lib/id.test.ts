import { describe, expect, it } from 'vitest'
import {
  decodeChainIdParam,
  decodeTxPointer,
  encodeChainId,
  encodeTxPointer,
  genericChainPath,
  shortPath,
} from './id'

describe('tx pointer id', () => {
  it('roundtrips packed ids', () => {
    const cases = [
      { blockNumber: 1n, transactionIndex: 0 },
      { blockNumber: 49_999_610n, transactionIndex: 3 },
      { blockNumber: 493_150_828n, transactionIndex: 65535 },
      { blockNumber: 1n, transactionIndex: 1 },
    ]
    for (const c of cases) {
      const id = encodeTxPointer(c)
      expect(id).not.toContain('.')
      expect(decodeTxPointer(id)).toEqual(c)
    }
  })

  it('uses dotted fallback when txIndex >= 65536', () => {
    const pointer = { blockNumber: 493_150_828n, transactionIndex: 65536 }
    const id = encodeTxPointer(pointer)
    expect(id).toContain('.')
    expect(decodeTxPointer(id)).toEqual(pointer)

    const big = { blockNumber: 493_150_828n, transactionIndex: 1_000_000 }
    expect(decodeTxPointer(encodeTxPointer(big))).toEqual(big)
  })

  it('keeps short codes short for 100-year-old Arbitrum-like chains', () => {
    const worstCaseBlock = 32_000_000_000n
    const id = encodeTxPointer({ blockNumber: worstCaseBlock, transactionIndex: 65535 })
    expect(id.length).toBeLessThanOrEqual(9)
  })

  it('rejects malformed ids', () => {
    expect(() => decodeTxPointer('abc.')).toThrow()
    expect(() => decodeTxPointer('.abc')).toThrow()
    expect(() => decodeTxPointer('a.b.c')).toThrow()
    expect(() => decodeTxPointer('')).toThrow()
    expect(() => decodeTxPointer('0OIl')).toThrow()
  })

  it('builds paths', () => {
    expect(shortPath('b', 'xyz')).toBe('/b/xyz')
    expect(genericChainPath(8453, 'xyz')).toBe('/c/3Wk/xyz')
  })

  it('encodes chain ids to compact base58', () => {
    expect(encodeChainId(8453)).toBe('3Wk')
    expect(encodeChainId(42161)).toBe('DXv')
    expect(encodeChainId(1)).toBe('2')
    expect(() => encodeChainId(0)).toThrow()
  })

  it('decodes chain id params (base58 and decimal fallback)', () => {
    expect(decodeChainIdParam('3Wk')).toBe(8453)
    expect(decodeChainIdParam('DXv')).toBe(42161)
    expect(decodeChainIdParam('8453')).toBe(8453)
    expect(decodeChainIdParam('0')).toBeUndefined()
    expect(decodeChainIdParam('!!!')).toBeUndefined()
    expect(decodeChainIdParam('')).toBeUndefined()
  })
})

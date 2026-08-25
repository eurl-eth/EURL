import { describe, expect, it } from 'vitest'
import { base58Decode, base58Encode } from './base58'

describe('base58', () => {
  it('encodes zero as "1"', () => {
    expect(base58Encode(0n)).toBe('1')
  })

  it('roundtrips assorted values', () => {
    const values = [
      1n,
      57n,
      58n,
      59n,
      12345n,
      65535n,
      493150828n,
      493150828n * 65536n + 17n,
      2n ** 128n,
      32_000_000_000n * 65536n + 65535n,
    ]
    for (const v of values) {
      expect(base58Decode(base58Encode(v))).toBe(v)
    }
  })

  it('rejects invalid characters', () => {
    expect(() => base58Decode('0OIl')).toThrow()
    expect(() => base58Decode('')).toThrow()
  })

  it('rejects negative values on encode', () => {
    expect(() => base58Encode(-1n)).toThrow()
  })

  it('produces expected known vector', () => {
    expect(base58Encode(100000000n)).toBe('9qXWw')
  })
})

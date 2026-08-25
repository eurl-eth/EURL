const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE = 58n

const CHAR_TO_VALUE = new Map<string, bigint>()
for (let i = 0; i < ALPHABET.length; i++) {
  CHAR_TO_VALUE.set(ALPHABET[i], BigInt(i))
}

export function base58Encode(num: bigint): string {
  if (num < 0n) throw new Error('base58Encode: negative value')
  if (num === 0n) return ALPHABET[0]
  let out = ''
  let n = num
  while (n > 0n) {
    out = ALPHABET[Number(n % BASE)] + out
    n /= BASE
  }
  return out
}

export function base58Decode(str: string): bigint {
  if (str.length === 0) throw new Error('base58Decode: empty string')
  let num = 0n
  for (const ch of str) {
    const v = CHAR_TO_VALUE.get(ch)
    if (v === undefined) throw new Error(`base58Decode: invalid character "${ch}"`)
    num = num * BASE + v
  }
  return num
}

import { describe, expect, it } from 'vitest'
import {
  bytesToHex,
  calldataToUrl,
  encodeUrl,
  estimateCalldataGas,
  hexToBytes,
  isValidTargetUrl,
  stripCalldataPrefix,
  urlToCalldata,
} from './calldata'

describe('hex helpers', () => {
  it('roundtrips bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 255, 16])
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes)
  })

  it('accepts hex without 0x prefix', () => {
    expect(hexToBytes('deadbeef')).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
  })

  it('rejects invalid hex', () => {
    expect(() => hexToBytes('0xzz')).toThrow()
  })
})

describe('calldata codec', () => {
  const url = 'https://example.com/path?x=1&y=中文'

  it('encodes with app prefix and decodes back', () => {
    const data = urlToCalldata(url, 'EURL', 'U1')
    expect(data.startsWith('0x')).toBe(true)
    expect(calldataToUrl(data)).toBe(url)
  })

  it('decodes plain url calldata without prefix', () => {
    const data = bytesToHex(new TextEncoder().encode(url))
    expect(calldataToUrl(data)).toBe(url)
  })

  it('decodes other app names / versions leniently', () => {
    const data = bytesToHex(new TextEncoder().encode(`OtherApp:U7:${url}`))
    expect(calldataToUrl(data)).toBe(url)
  })

  it('strips prefix only when pattern matches', () => {
    expect(stripCalldataPrefix('EURL:U1:https://a.b')).toBe('https://a.b')
    expect(stripCalldataPrefix('https://a.b')).toBe('https://a.b')
    expect(stripCalldataPrefix('EURL:UX:https://a.b')).toBe('EURL:UX:https://a.b')
  })
})

describe('url validation', () => {
  it('accepts http/https urls', () => {
    expect(isValidTargetUrl('https://example.com')).toBe(true)
    expect(isValidTargetUrl('http://example.com/a/b?c=d#e')).toBe(true)
  })

  it('rejects bad schemes', () => {
    expect(isValidTargetUrl('javascript:alert(1)')).toBe(false)
    expect(isValidTargetUrl('data:text/html,hi')).toBe(false)
    expect(isValidTargetUrl('file:///etc/passwd')).toBe(false)
    expect(isValidTargetUrl('ftp://example.com')).toBe(false)
  })

  it('rejects malformed or hostile content', () => {
    expect(isValidTargetUrl('')).toBe(false)
    expect(isValidTargetUrl('https://')).toBe(false)
    expect(isValidTargetUrl('https://example.com/\u0000evil')).toBe(false)
    expect(isValidTargetUrl('https://example.com/' + 'a'.repeat(3000))).toBe(false)
  })
})

describe('url encoding', () => {
  it('encodes non-ascii and spaces', () => {
    expect(encodeUrl('https://example.com/路径?q=中文 空格')).toBe(
      'https://example.com/%E8%B7%AF%E5%BE%84?q=%E4%B8%AD%E6%96%87%20%E7%A9%BA%E6%A0%BC',
    )
  })

  it('does not double-encode existing percent sequences', () => {
    expect(encodeUrl('https://example.com/a%20b')).toBe('https://example.com/a%20b')
  })

  it('leaves plain ascii urls unchanged', () => {
    expect(encodeUrl('https://example.com/a/b?c=1')).toBe('https://example.com/a/b?c=1')
  })

  it('encodes stray percent signs', () => {
    expect(encodeUrl('https://example.com/100%')).toBe('https://example.com/100%25')
  })
})

describe('gas estimation', () => {
  it('counts 16 per non-zero and 4 per zero byte', () => {
    expect(estimateCalldataGas('0x00ff10')).toBe(4 + 16 + 16)
    expect(estimateCalldataGas('0x')).toBe(0)
  })
})

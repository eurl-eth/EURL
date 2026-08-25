import { describe, expect, it } from 'vitest'
import {
  isHostBlocked,
  isHostPathBlocked,
  isWalletBlocked,
  loadBlocklist,
  parsePaths,
  type ErulBlocklist,
} from './erulBlocklist'

const TEST_PATHS = [
  'a/FeKbb4H6.json',
  'target/test.example.com.json',
  'target/www.example.com/test.json',
  'wallet/0x0000000000000000000000000000000000000000.json',
]

function buildList(): ErulBlocklist {
  return parsePaths(TEST_PATHS)
}

describe('erul blocklist parsing', () => {
  it('maps short links by prefix', () => {
    const list = buildList()
    expect(list.shortLinks.get('a')).toEqual(['FeKbb4H6'])
  })

  it('maps hosts and host paths', () => {
    const list = buildList()
    expect(list.hosts).toContain('test.example.com')
    expect(list.hostPaths.get('www.example.com')).toEqual(['test'])
  })

  it('maps blocked wallets', () => {
    const list = buildList()
    expect(list.wallets).toContain('0x0000000000000000000000000000000000000000')
  })
})

describe('wallet blocking', () => {
  it('blocks a listed wallet address', () => {
    expect(isWalletBlocked(buildList(), '0x0000000000000000000000000000000000000000')).toBe(true)
  })

  it('is case insensitive', () => {
    expect(isWalletBlocked(buildList(), '0x0000000000000000000000000000000000000000'.toUpperCase())).toBe(true)
  })

  it('does not block unlisted wallets', () => {
    expect(isWalletBlocked(buildList(), '0x1111111111111111111111111111111111111111')).toBe(false)
  })
})

describe('host blocking', () => {
  it('blocks the exact host', () => {
    expect(isHostBlocked(buildList(), 'test.example.com')).toBe(true)
  })

  it('blocks subdomains of a blocked host', () => {
    expect(isHostBlocked(buildList(), 'sub.test.example.com')).toBe(true)
    expect(isHostBlocked(buildList(), 'a.b.test.example.com')).toBe(true)
  })

  it('does not block unrelated hosts or parent tld', () => {
    expect(isHostBlocked(buildList(), 'example.com')).toBe(false)
    expect(isHostBlocked(buildList(), 'other.com')).toBe(false)
  })
})

describe('host path blocking', () => {
  it('blocks the exact path and subpaths', () => {
    expect(isHostPathBlocked(buildList(), 'www.example.com', '/test')).toBe(true)
    expect(isHostPathBlocked(buildList(), 'www.example.com', '/test/foo')).toBe(true)
    expect(isHostPathBlocked(buildList(), 'www.example.com', '/test/foo/bar')).toBe(true)
  })

  it('does not block sibling paths', () => {
    expect(isHostPathBlocked(buildList(), 'www.example.com', '/testing')).toBe(false)
    expect(isHostPathBlocked(buildList(), 'www.example.com', '/testx')).toBe(false)
    expect(isHostPathBlocked(buildList(), 'www.example.com', '/other')).toBe(false)
  })

  it('does not block other hosts', () => {
    expect(isHostPathBlocked(buildList(), 'example.com', '/test')).toBe(false)
  })
})

describe('loadBlocklist (stubbed fetch)', () => {
  it('returns null when fetch fails', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response('nope', { status: 500 })) as typeof fetch
    try {
      expect(await loadBlocklist(2000)).toBeNull()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('parses the tree from the GitHub API', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({ tree: TEST_PATHS.map((p) => ({ path: p, type: 'blob' })) }),
        { status: 200 },
      )
    }) as typeof fetch
    try {
      const list = await loadBlocklist(2000)
      expect(list?.hosts).toContain('test.example.com')
      expect(list?.shortLinks.get('a')).toEqual(['FeKbb4H6'])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

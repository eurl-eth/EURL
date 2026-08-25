import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkLocalRules, checkUrlSafety, gsbUrlVariants, hostAndParents, __resetSafetyCache } from './safety'

const mocks = vi.hoisted(() => ({
  config: {
    gsbApiKey: '',
    gsbUrl: '',
    maxUrlLength: 2000,
  },
}))

vi.mock('../config/app', () => ({
  config: mocks.config,
}))

beforeEach(() => {
  mocks.config.gsbApiKey = ''
  mocks.config.gsbUrl = ''
  mocks.config.maxUrlLength = 2000
})

describe('local safety rules', () => {
  it('passes normal urls', () => {
    expect(checkLocalRules('https://example.com/a')).toEqual({ ok: true })
  })

  it('blocks non-http schemes', () => {
    expect(checkLocalRules('javascript:alert(1)').ok).toBe(false)
    expect(checkLocalRules('data:text/html,x').ok).toBe(false)
    expect(checkLocalRules('file:///x').ok).toBe(false)
  })

  it('blocks control characters and overlong urls', () => {
    expect(checkLocalRules('https://a.com/\u0000').ok).toBe(false)
    expect(checkLocalRules('https://a.com/' + 'x'.repeat(3000)).ok).toBe(false)
  })

  it('blocks embedded credentials', () => {
    expect(checkLocalRules('https://user:pass@example.com/').ok).toBe(false)
  })
})

describe('host helpers', () => {
  it('lists host and parents', () => {
    expect(hostAndParents('app.example.co')).toEqual(['app.example.co', 'example.co'])
    expect(hostAndParents('example.com')).toEqual(['example.com'])
  })
})

describe('gsb variants', () => {
  it('produces scheme+host and path prefixes', () => {
    const variants = gsbUrlVariants('https://example.com/a/b/c?d=1')
    expect(variants).toContain('https://example.com/')
    expect(variants).toContain('https://example.com/a/')
    expect(variants).toContain('https://example.com/a/b')
    expect(variants).toContain('https://example.com/a/b/c?d=1')
  })
})

describe('gsb endpoint path', () => {
  it('appends the threatMatches:find path when gsbUrl is a bare host', async () => {
    mocks.config.gsbUrl = 'https://gsb.api.mili.one'
    const originalFetch = globalThis.fetch
    const requested: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('eth-phishing-detect')) {
        return new Response(JSON.stringify({ version: 1, blacklist: [] }), { status: 200 })
      }
      if (url.includes('gsb.api.mili.one')) {
        requested.push(url)
        return new Response(JSON.stringify({}), { status: 200 })
      }
      return originalFetch(input as RequestInfo)
    }) as typeof fetch
    try {
      const verdict = await checkUrlSafety('https://example.com/')
      expect(requested.length).toBeGreaterThan(0)
      for (const u of requested) {
        expect(u).toContain('/v4/threatMatches:find')
      }
      expect(verdict.status).toBe('safe')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('keeps an already-qualified gsbUrl unchanged', async () => {
    mocks.config.gsbUrl = 'https://gsb.api.mili.one/v4/threatMatches:find'
    const originalFetch = globalThis.fetch
    const requested: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('eth-phishing-detect')) {
        return new Response(JSON.stringify({ version: 1, blacklist: [] }), { status: 200 })
      }
      if (url.includes('gsb.api.mili.one')) {
        requested.push(url)
        return new Response(JSON.stringify({}), { status: 200 })
      }
      return originalFetch(input as RequestInfo)
    }) as typeof fetch
    try {
      await checkUrlSafety('https://example.com/')
      expect(requested.length).toBeGreaterThan(0)
      for (const u of requested) {
        expect(u).toBe('https://gsb.api.mili.one/v4/threatMatches:find')
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('phishing list integration (stubbed fetch)', () => {
  it('normalizes legacy blacklist/whitelist keys and blocks listed domains', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes('eth-phishing-detect')) {
        return new Response(
          JSON.stringify({
            version: 1,
            tolerance: 1,
            fuzzylist: [],
            whitelist: [],
            blacklist: ['evil.example', 'phish.example'],
          }),
          { status: 200 },
        )
      }
      return originalFetch(input as RequestInfo)
    }) as typeof fetch
    try {
      __resetSafetyCache()
      const bad = await checkUrlSafety('https://evil.example/login')
      expect(bad.status).toBe('blocked')

      const subdomain = await checkUrlSafety('https://sub.phish.example/')
      expect(subdomain.status).toBe('blocked')

      const ok = await checkUrlSafety('https://example.com/')
      expect(ok.status).toBe('safe')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

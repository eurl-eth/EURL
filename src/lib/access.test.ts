import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  config: {
    walletWhitelist: [] as string[],
    chainWhitelist: [] as string[],
    chainBlacklist: [] as string[],
  },
}))

vi.mock('../config/app', () => ({
  config: mocks.config,
}))

import { isChainAllowed, isWalletAllowed } from './access'

beforeEach(() => {
  mocks.config.walletWhitelist = []
  mocks.config.chainWhitelist = []
  mocks.config.chainBlacklist = []
})

describe('wallet whitelist', () => {
  it('allows everyone when whitelist is empty', () => {
    mocks.config.walletWhitelist = []
    expect(isWalletAllowed('0xabc')).toBe(true)
    expect(isWalletAllowed(undefined)).toBe(true)
    expect(isWalletAllowed(null)).toBe(true)
  })

  it('denies when whitelist is set and address not present', () => {
    mocks.config.walletWhitelist = ['0x1111111111111111111111111111111111111111']
    expect(isWalletAllowed('0x2222222222222222222222222222222222222222')).toBe(false)
    expect(isWalletAllowed(undefined)).toBe(false)
  })

  it('matches case-insensitively', () => {
    mocks.config.walletWhitelist = ['0xabcdef0000000000000000000000000000000000']
    expect(isWalletAllowed('0xABCDEF0000000000000000000000000000000000')).toBe(true)
  })
})

describe('chain allow/deny', () => {
  it('allows all chains when no lists are configured', () => {
    expect(isChainAllowed('b')).toBe(true)
    expect(isChainAllowed('q')).toBe(true)
    expect(isChainAllowed(undefined)).toBe(true)
  })

  it('denies chains not in the whitelist', () => {
    mocks.config.chainWhitelist = ['b', 'a']
    expect(isChainAllowed('b')).toBe(true)
    expect(isChainAllowed('a')).toBe(true)
    expect(isChainAllowed('q')).toBe(false)
    expect(isChainAllowed(undefined)).toBe(false)
  })

  it('denies chains in the blacklist', () => {
    mocks.config.chainBlacklist = ['w', 'k']
    expect(isChainAllowed('b')).toBe(true)
    expect(isChainAllowed('w')).toBe(false)
    expect(isChainAllowed('k')).toBe(false)
  })
})

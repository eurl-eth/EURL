import { config } from '../config/app'

export function isWalletAllowed(address: string | undefined | null): boolean {
  if (config.walletWhitelist.length === 0) return true
  if (!address) return false
  return config.walletWhitelist.includes(address.toLowerCase())
}

export function isChainAllowed(prefix: string | undefined): boolean {
  if (config.chainWhitelist.length > 0 && (!prefix || !config.chainWhitelist.includes(prefix))) {
    return false
  }
  if (prefix && config.chainBlacklist.includes(prefix)) {
    return false
  }
  return true
}

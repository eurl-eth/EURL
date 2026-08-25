import { config } from '../config/app'

const PREFIX_PATTERN = /^([A-Za-z0-9_-]+):(U\d+):([\s\S]*)$/

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '0x'
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

export function hexToBytes(hex: string): Uint8Array {
  let h = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex
  if (h.length % 2 !== 0) h = '0' + h
  if (!/^[0-9a-fA-F]*$/.test(h)) throw new Error('hexToBytes: invalid hex string')
  const out = new Uint8Array(h.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function urlToCalldata(
  url: string,
  appName: string = config.appName,
  version: string = config.callDataVersion,
): string {
  const payload = `${appName}:${version}:${url}`
  return bytesToHex(new TextEncoder().encode(payload))
}

export function stripCalldataPrefix(text: string): string {
  const m = PREFIX_PATTERN.exec(text)
  return m ? m[3] : text
}

export function encodeUrl(url: string): string {
  return url
    .replace(/%(?![0-9A-Fa-f]{2})/g, '%25')
    .replace(/[^\x21-\x7E]/g, (c) => encodeURIComponent(c))
}

export function calldataToUrl(input: string): string {
  const bytes = hexToBytes(input)
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  return stripCalldataPrefix(text)
}

export function isValidTargetUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0 || url.length > config.maxUrlLength) return false
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(url)) return false
  if (!/^https?:\/\//i.test(url)) return false
  try {
    const parsed = new URL(url)
    return parsed.hostname.length > 0
  } catch {
    return false
  }
}

export function estimateCalldataGas(calldata: string): number {
  const bytes = hexToBytes(calldata)
  let gas = 0
  for (const b of bytes) gas += b === 0 ? 4 : 16
  return gas
}

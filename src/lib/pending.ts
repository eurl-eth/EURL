export interface PendingRecord {
  txHash: string
  chainId: number
  prefix: string
  url: string
  linkDomain: string
  createdAt: number
}

const STORAGE_KEY = 'eurl:pending'
const MAX_RECORDS = 50
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function read(): PendingRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PendingRecord[]) : []
  } catch {
    return []
  }
}

function write(records: PendingRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-MAX_RECORDS)))
  } catch {
    /* storage unavailable */
  }
}

export const pendingStore = {
  save(record: PendingRecord): void {
    const records = read().filter((r) => r.txHash !== record.txHash)
    records.push(record)
    write(records)
  },

  find(txHash: string): PendingRecord | undefined {
    const rec = read().find((r) => r.txHash === txHash)
    if (!rec) return undefined
    if (Date.now() - rec.createdAt > MAX_AGE_MS) {
      this.remove(txHash)
      return undefined
    }
    return rec
  },

  remove(txHash: string): void {
    write(read().filter((r) => r.txHash !== txHash))
  },

  list(): PendingRecord[] {
    return read()
  },
}

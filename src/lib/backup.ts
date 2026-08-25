export interface BackupRecord {
  chainId: number
  prefix: string
  id: string
  blockNumber: string
  transactionIndex: number
  txHash: string
  url: string
  timestamp: number
}

export interface BackupStore {
  save(record: BackupRecord): void
  find(chainId: number, blockNumber: bigint, transactionIndex: number): BackupRecord | undefined
  list(): BackupRecord[]
}

const STORAGE_KEY = 'eurl:backups'
const MAX_RECORDS = 200

export class LocalBackupStore implements BackupStore {
  private read(): BackupRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as BackupRecord[]) : []
    } catch {
      return []
    }
  }

  private write(records: BackupRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-MAX_RECORDS)))
    } catch {
      /* storage unavailable */
    }
  }

  save(record: BackupRecord): void {
    const records = this.read().filter(
      (r) =>
        !(
          r.chainId === record.chainId &&
          r.blockNumber === record.blockNumber &&
          r.transactionIndex === record.transactionIndex
        ),
    )
    records.push(record)
    this.write(records)
  }

  find(chainId: number, blockNumber: bigint, transactionIndex: number): BackupRecord | undefined {
    const target = blockNumber.toString()
    return this.read().find(
      (r) =>
        r.chainId === chainId && r.blockNumber === target && r.transactionIndex === transactionIndex,
    )
  }

  list(): BackupRecord[] {
    return this.read()
  }
}

export const backupStore: BackupStore = new LocalBackupStore()

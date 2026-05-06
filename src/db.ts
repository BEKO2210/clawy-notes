// Dexie-backed IndexedDB used to persist Plume's Zustand state.
// We use a single key/value table (`kv`) so we can swap the storage
// engine later without changing the schema.

import Dexie, { type Table } from 'dexie'

interface KvRow {
  key: string
  value: string
}

class PlumeDB extends Dexie {
  kv!: Table<KvRow, string>

  constructor() {
    super('plume')
    this.version(1).stores({
      kv: '&key',
    })
  }
}

let dbInstance: PlumeDB | null = null

function getDb(): PlumeDB | null {
  // Some browser modes (private mode in older Safari/Firefox) block IndexedDB.
  // Fail gracefully — the caller falls back to localStorage.
  if (typeof indexedDB === 'undefined') return null
  if (dbInstance) return dbInstance
  try {
    dbInstance = new PlumeDB()
    return dbInstance
  } catch {
    return null
  }
}

export async function idbGet(key: string): Promise<string | null> {
  const db = getDb()
  if (!db) return null
  try {
    const row = await db.kv.get(key)
    return row?.value ?? null
  } catch {
    return null
  }
}

export async function idbSet(key: string, value: string): Promise<boolean> {
  const db = getDb()
  if (!db) return false
  try {
    await db.kv.put({ key, value })
    return true
  } catch {
    return false
  }
}

export async function idbDelete(key: string): Promise<void> {
  const db = getDb()
  if (!db) return
  try {
    await db.kv.delete(key)
  } catch {
    // ignore
  }
}

// Best-effort one-shot migration: if IndexedDB is empty for `key` but
// localStorage has data under the same key, copy it across so existing
// users do not lose their notes when the storage engine flips.
export async function migrateFromLocalStorage(key: string): Promise<string | null> {
  const existing = await idbGet(key)
  if (existing != null) return existing
  if (typeof localStorage === 'undefined') return null
  try {
    const legacy = localStorage.getItem(key)
    if (legacy != null) {
      await idbSet(key, legacy)
      return legacy
    }
  } catch {
    // ignore
  }
  return null
}

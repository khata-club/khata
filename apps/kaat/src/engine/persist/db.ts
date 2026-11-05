/**
 * Tiny IndexedDB wrapper. Stores:
 * - `projects`: project index rows (id, name, updatedAt, slot)
 * - `autosave`: two slots per project (A/B) holding serialized project JSON + checksum
 * - `handles`: FileSystemFileHandle per asset (never the file bytes: sources are not duplicated)
 * - `kv`: preferences and small state (last project, clean-exit flag)
 * - `cache`: rebuildable derived data (waveform peaks), evictable under storage pressure
 */
const DB_NAME = 'kaat'
const DB_VERSION = 1
const STORES = ['projects', 'autosave', 'handles', 'kv', 'cache'] as const
export type StoreName = (typeof STORES)[number]

let dbp: Promise<IDBDatabase> | undefined

function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await open()
  return wrap(db.transaction(store).objectStore(store).get(key)) as Promise<T | undefined>
}

export async function idbPut(store: StoreName, key: IDBValidKey, value: unknown): Promise<void> {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'))
  })
}

export async function idbDelete(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function idbAll<T>(store: StoreName): Promise<{ key: IDBValidKey; value: T }[]> {
  const db = await open()
  const os = db.transaction(store).objectStore(store)
  const [keys, values] = await Promise.all([wrap(os.getAllKeys()), wrap(os.getAll())])
  return keys.map((key, i) => ({ key, value: values[i] as T }))
}

export async function idbClear(store: StoreName): Promise<void> {
  const db = await open()
  await wrap(db.transaction(store, 'readwrite').objectStore(store).clear())
}

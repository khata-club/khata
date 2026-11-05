/**
 * Storage pressure. Data is classified: project state and autosaves are critical; waveforms,
 * proxies and temporary export files are rebuildable. When space runs low, rebuildable data goes
 * first (oldest first); critical data is never evicted and source files are never touched.
 */
import { telemetry } from '../telemetry'
import { idbAll, idbDelete } from './db'

export async function estimate(): Promise<{ usage: number; quota: number }> {
  try {
    const e = await navigator.storage.estimate()
    telemetry.storageUsage = e.usage ?? 0
    telemetry.storageQuota = e.quota ?? 0
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 }
  } catch {
    return { usage: 0, quota: 0 }
  }
}

/** Ask Chrome not to evict Kaat's storage automatically (best effort). */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    return false
  }
}

interface OpfsEntry {
  path: string
  size: number
  lastModified: number
}

async function listDir(dirName: string): Promise<OpfsEntry[]> {
  const out: OpfsEntry[] = []
  try {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle(dirName)
    for await (const [name, handle] of dir.entries() as AsyncIterable<[string, FileSystemHandle]>) {
      if (handle.kind !== 'file') continue
      const f = await (handle as FileSystemFileHandle).getFile()
      out.push({ path: `${dirName}/${name}`, size: f.size, lastModified: f.lastModified })
    }
  } catch {
    // directory missing
  }
  return out
}

async function removePath(path: string): Promise<void> {
  const [dirName, name] = path.split('/') as [string, string]
  try {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle(dirName)
    await dir.removeEntry(name)
  } catch {
    // gone already
  }
}

/**
 * Free at least `bytes` of rebuildable data. Returns removed proxy paths so the caller can mark
 * those proxies as needing a rebuild. `keep` protects files in active use (e.g. a running export).
 */
export async function evictRebuildable(
  bytes: number,
  keep: Set<string> = new Set(),
): Promise<{ freed: number; proxies: string[] }> {
  let freed = 0
  const proxies: string[] = []
  // 1. Temporary export files.
  for (const e of await listDir('exports')) {
    if (keep.has(e.path)) continue
    await removePath(e.path)
    freed += e.size
  }
  if (freed >= bytes) return { freed, proxies }
  // 2. Cached waveforms (oldest first).
  const wf = (await idbAll<{ at?: number; peaks?: Int8Array }>('cache').catch(() => [])).sort(
    (a, b) => (a.value.at ?? 0) - (b.value.at ?? 0),
  )
  for (const e of wf) {
    await idbDelete('cache', e.key)
    freed += e.value.peaks?.byteLength ?? 0
    if (freed >= bytes) return { freed, proxies }
  }
  // 3. Proxies (oldest first).
  const px = (await listDir('proxies')).sort((a, b) => a.lastModified - b.lastModified)
  for (const e of px) {
    if (keep.has(e.path)) continue
    await removePath(e.path)
    proxies.push(e.path)
    freed += e.size
    if (freed >= bytes) break
  }
  return { freed, proxies }
}

/** Make room for `bytes`; returns false if still short after evicting rebuildable data. */
export async function ensureSpace(
  bytes: number,
  keep?: Set<string>,
): Promise<{ ok: boolean; proxies: string[] }> {
  const margin = 64 * 1024 * 1024
  const { usage, quota } = await estimate()
  if (!quota || quota - usage >= bytes + margin) return { ok: true, proxies: [] }
  const r = await evictRebuildable(bytes + margin - (quota - usage), keep)
  const after = await estimate()
  return { ok: !after.quota || after.quota - after.usage >= bytes, proxies: r.proxies }
}

export async function cleanupTempExports(): Promise<void> {
  for (const e of await listDir('exports'))
    if (Date.now() - e.lastModified > 10 * 60_000) await removePath(e.path)
}

/**
 * Source file registry: asset id → the user's local file. Kaat only keeps references
 * (FileSystemFileHandle in IndexedDB); bytes are read lazily and never copied or uploaded.
 */
import { idbDelete, idbGet, idbPut } from './persist/db'

export type SourceState = 'ready' | 'permission' | 'missing'

interface Entry {
  file?: File
  handle?: FileSystemFileHandle
  state: SourceState
}

export class SourceRegistry {
  private map = new Map<string, Entry>()
  private listeners = new Set<(assetId: string) => void>()

  onChange(fn: (assetId: string) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  get(assetId: string): File | undefined {
    return this.map.get(assetId)?.file
  }

  state(assetId: string): SourceState {
    return this.map.get(assetId)?.state ?? 'missing'
  }

  hasHandle(assetId: string): boolean {
    return !!this.map.get(assetId)?.handle
  }

  /** Register a newly imported or relinked file. */
  async set(assetId: string, file: File, handle?: FileSystemFileHandle): Promise<void> {
    this.map.set(assetId, { file, handle, state: 'ready' })
    if (handle) await idbPut('handles', assetId, handle).catch(() => {})
    else await idbDelete('handles', assetId).catch(() => {})
    this.emit(assetId)
  }

  async remove(assetId: string): Promise<void> {
    this.map.delete(assetId)
    await idbDelete('handles', assetId).catch(() => {})
    this.emit(assetId)
  }

  /**
   * Restore a source after reload. Without a user gesture Chrome may only report `prompt`, which
   * becomes the `permission` state; {@link reconnect} asks for access from a click.
   */
  async restore(assetId: string): Promise<SourceState> {
    const handle = await idbGet<FileSystemFileHandle>('handles', assetId).catch(() => undefined)
    if (!handle) {
      this.map.set(assetId, { state: 'missing' })
      return 'missing'
    }
    let perm: PermissionState = 'prompt'
    try {
      perm = await handle.queryPermission({ mode: 'read' })
    } catch {
      perm = 'prompt'
    }
    if (perm !== 'granted') {
      this.map.set(assetId, { handle, state: 'permission' })
      return 'permission'
    }
    return this.load(assetId, handle)
  }

  /** Must run inside a user gesture: asks Chrome to re-grant read access. */
  async reconnect(assetIds: string[]): Promise<string[]> {
    const ok: string[] = []
    for (const id of assetIds) {
      const e = this.map.get(id)
      if (!e?.handle) continue
      try {
        const perm = await e.handle.requestPermission({ mode: 'read' })
        if (perm === 'granted' && (await this.load(id, e.handle)) === 'ready') ok.push(id)
      } catch {
        // stays in permission state
      }
    }
    return ok
  }

  private async load(assetId: string, handle: FileSystemFileHandle): Promise<SourceState> {
    try {
      const file = await handle.getFile()
      this.map.set(assetId, { file, handle, state: 'ready' })
      this.emit(assetId)
      return 'ready'
    } catch {
      this.map.set(assetId, { handle, state: 'missing' })
      this.emit(assetId)
      return 'missing'
    }
  }

  private emit(assetId: string): void {
    for (const l of this.listeners) l(assetId)
  }
}

/** Stable fingerprint of a file for derived caches (survives relinking the same file). */
export function fingerprint(name: string, size: number, lastModified: number): string {
  let h = 0x811c9dc5
  const s = `${name}|${size}|${lastModified}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36) + size.toString(36)
}

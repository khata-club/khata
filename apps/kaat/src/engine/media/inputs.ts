/**
 * Bounded pool of open Mediabunny inputs, one per source file, shared by the code in one worker.
 * Inputs read lazily from the File (BlobSource), so large files are never loaded into memory.
 */
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny'

export interface OpenInput {
  key: string
  input: Input
  file: Blob
}

/**
 * Same underlying file? Files posted to a worker arrive as new objects on every call, so object
 * identity is not enough; compare the file's identity instead.
 */
export function sameBlob(a: Blob, b: Blob): boolean {
  if (a === b) return true
  const fa = a as Partial<File>
  const fb = b as Partial<File>
  return (
    a.size === b.size &&
    a.type === b.type &&
    fa.name === fb.name &&
    fa.lastModified === fb.lastModified
  )
}

export class InputPool {
  private map = new Map<string, OpenInput>()
  constructor(private readonly limit = 8) {}

  get(key: string, file: Blob): OpenInput {
    const hit = this.map.get(key)
    if (hit && sameBlob(hit.file, file)) {
      this.map.delete(key)
      this.map.set(key, hit)
      return hit
    }
    if (hit) this.close(key)
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
    const entry = { key, input, file }
    this.map.set(key, entry)
    while (this.map.size > this.limit) this.close(this.map.keys().next().value as string)
    return entry
  }

  close(key: string): void {
    const e = this.map.get(key)
    if (!e) return
    this.map.delete(key)
    try {
      e.input.dispose()
    } catch {
      // already disposed
    }
  }

  closeAll(): void {
    for (const k of [...this.map.keys()]) this.close(k)
  }

  get size(): number {
    return this.map.size
  }
}

/** Read a file from the origin-private file system (proxies). */
export async function opfsFile(path: string): Promise<File> {
  let dir = await navigator.storage.getDirectory()
  const parts = path.split('/')
  for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p)
  const fh = await dir.getFileHandle(parts[parts.length - 1]!)
  return fh.getFile()
}

export async function opfsWritable(path: string): Promise<FileSystemWritableFileStream> {
  let dir = await navigator.storage.getDirectory()
  const parts = path.split('/')
  for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true })
  const fh = await dir.getFileHandle(parts[parts.length - 1]!, { create: true })
  return fh.createWritable()
}

export async function opfsRemove(path: string): Promise<void> {
  try {
    let dir = await navigator.storage.getDirectory()
    const parts = path.split('/')
    for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p)
    await dir.removeEntry(parts[parts.length - 1]!)
  } catch {
    // not there
  }
}

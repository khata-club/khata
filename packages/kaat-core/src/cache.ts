/**
 * Byte-bounded LRU cache. Every engine cache (decoded frames, audio blocks, thumbnails, waveforms,
 * text rasters) is one of these, so memory is explicitly limited and eviction is observable.
 */
export interface CacheStats {
  entries: number
  bytes: number
  budget: number
  hits: number
  misses: number
  evictions: number
}

interface Entry<V> {
  value: V
  size: number
}

export class LruCache<K, V> {
  private map = new Map<K, Entry<V>>()
  private bytes = 0
  private hits = 0
  private misses = 0
  private evictions = 0

  constructor(
    private budget: number,
    private readonly onEvict?: (key: K, value: V) => void,
  ) {}

  get size(): number {
    return this.map.size
  }

  get usedBytes(): number {
    return this.bytes
  }

  /** Get and mark as most recently used. */
  get(key: K): V | undefined {
    const e = this.map.get(key)
    if (!e) {
      this.misses++
      return undefined
    }
    this.hits++
    this.map.delete(key)
    this.map.set(key, e)
    return e.value
  }

  /** Get without touching recency or stats. */
  peek(key: K): V | undefined {
    return this.map.get(key)?.value
  }

  has(key: K): boolean {
    return this.map.has(key)
  }

  set(key: K, value: V, size = 1): void {
    const old = this.map.get(key)
    if (old) {
      this.map.delete(key)
      this.bytes -= old.size
      if (old.value !== value) this.onEvict?.(key, old.value)
    }
    if (size > this.budget) {
      // Too large to cache at all.
      this.onEvict?.(key, value)
      return
    }
    this.map.set(key, { value, size })
    this.bytes += size
    this.trim()
  }

  delete(key: K): boolean {
    const e = this.map.get(key)
    if (!e) return false
    this.map.delete(key)
    this.bytes -= e.size
    this.onEvict?.(key, e.value)
    return true
  }

  /** Evict every entry matching `pred` (e.g. all frames of a closed asset). */
  deleteWhere(pred: (key: K, value: V) => boolean): number {
    let n = 0
    for (const [k, e] of [...this.map]) {
      if (pred(k, e.value)) {
        this.map.delete(k)
        this.bytes -= e.size
        this.onEvict?.(k, e.value)
        n++
      }
    }
    return n
  }

  clear(): void {
    for (const [k, e] of this.map) this.onEvict?.(k, e.value)
    this.map.clear()
    this.bytes = 0
  }

  setBudget(budget: number): void {
    this.budget = budget
    this.trim()
  }

  keys(): IterableIterator<K> {
    return this.map.keys()
  }

  stats(): CacheStats {
    return {
      entries: this.map.size,
      bytes: this.bytes,
      budget: this.budget,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    }
  }

  hitRate(): number {
    const total = this.hits + this.misses
    return total ? this.hits / total : 0
  }

  private trim(): void {
    while (this.bytes > this.budget && this.map.size) {
      const [k, e] = this.map.entries().next().value as [K, Entry<V>]
      this.map.delete(k)
      this.bytes -= e.size
      this.evictions++
      this.onEvict?.(k, e.value)
    }
  }
}

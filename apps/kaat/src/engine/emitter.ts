/** Minimal typed event emitter for engine → UI signals that must not go through Vue reactivity. */
export class Emitter<E extends Record<string, unknown>> {
  private map = new Map<keyof E, Set<(p: never) => void>>()

  on<K extends keyof E>(name: K, fn: (payload: E[K]) => void): () => void {
    let set = this.map.get(name)
    if (!set) this.map.set(name, (set = new Set()))
    set.add(fn as (p: never) => void)
    return () => set!.delete(fn as (p: never) => void)
  }

  emit<K extends keyof E>(name: K, payload: E[K]): void {
    const set = this.map.get(name)
    if (set) for (const fn of set) (fn as (p: E[K]) => void)(payload)
  }
}

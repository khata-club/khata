import { type Command, applyCommand, commandLabel, isSilent, mergeKey } from './commands'
import type { Project } from './model'

export interface HistoryEntry {
  label: string
  commands: Command[]
  before: Project
  after: Project
  mergeKey?: string
  at: number
}

export interface StoreChange {
  project: Project
  previous: Project
  /** Commands just applied (empty for undo/redo/load). */
  commands: Command[]
  kind: 'apply' | 'undo' | 'redo' | 'load'
}

type Listener = (change: StoreChange) => void

export interface StoreOptions {
  /** Max undo entries kept (memory bound). Default 500. */
  historyLimit?: number
  /** Window in which mergeable commands for the same target merge into one undo step. */
  mergeWindowMs?: number
  now?: () => number
}

/**
 * Holds the current project and the undo/redo history. Snapshots share structure, so each entry
 * costs only the objects the command replaced. The history is bounded.
 */
export class ProjectStore {
  private current: Project
  private past: HistoryEntry[] = []
  private future: HistoryEntry[] = []
  private listeners = new Set<Listener>()
  private readonly limit: number
  private readonly mergeWindow: number
  private readonly now: () => number
  /** Increments on every change. Cheap reactive signal for UIs. */
  version = 0
  /** Increments on edits that change saved state (not undo-neutral loads). */
  dirtyVersion = 0
  /** Set to break merging, e.g. at pointerup, so the next gesture is a new undo step. */
  private mergeBarrier = false

  constructor(project: Project, opts: StoreOptions = {}) {
    this.current = project
    this.limit = opts.historyLimit ?? 500
    this.mergeWindow = opts.mergeWindowMs ?? 800
    this.now = opts.now ?? (() => Date.now())
  }

  get project(): Project {
    return this.current
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Apply one command (or a batch as one undo step). Returns true if anything changed. */
  dispatch(cmd: Command | Command[], label?: string): boolean {
    const cmds = Array.isArray(cmd) ? cmd : [cmd]
    const before = this.current
    let after = before
    for (const c of cmds) after = applyCommand(after, c)
    if (after === before) return false
    this.current = after
    const silent = cmds.every(isSilent)
    if (!silent) {
      const key = cmds.length === 1 ? mergeKey(cmds[0]!) : undefined
      const last = this.past[this.past.length - 1]
      const t = this.now()
      if (
        key &&
        last &&
        last.mergeKey === key &&
        !this.mergeBarrier &&
        t - last.at < this.mergeWindow
      ) {
        last.after = after
        last.commands.push(...cmds)
        last.at = t
      } else {
        this.past.push({
          label: label ?? commandLabel(cmds[0]!),
          commands: [...cmds],
          before,
          after,
          mergeKey: key,
          at: t,
        })
        if (this.past.length > this.limit) this.past.shift()
      }
      this.future = []
      this.mergeBarrier = false
    }
    this.emit({ project: after, previous: before, commands: cmds, kind: 'apply' })
    return true
  }

  /** End the current mergeable gesture. */
  breakMerge(): void {
    this.mergeBarrier = true
  }

  canUndo(): boolean {
    return this.past.length > 0
  }

  canRedo(): boolean {
    return this.future.length > 0
  }

  undoLabel(): string | undefined {
    return this.past[this.past.length - 1]?.label
  }

  redoLabel(): string | undefined {
    return this.future[this.future.length - 1]?.label
  }

  undo(): boolean {
    const e = this.past.pop()
    if (!e) return false
    const previous = this.current
    this.current = this.carryAssets(e.before, previous)
    this.future.push(e)
    this.mergeBarrier = true
    this.emit({ project: this.current, previous, commands: [], kind: 'undo' })
    return true
  }

  redo(): boolean {
    const e = this.future.pop()
    if (!e) return false
    const previous = this.current
    this.current = this.carryAssets(e.after, previous)
    this.past.push(e)
    this.mergeBarrier = true
    this.emit({ project: this.current, previous, commands: [], kind: 'redo' })
    return true
  }

  /** Replace the project (open/restore). Clears history. */
  load(project: Project): void {
    const previous = this.current
    this.current = project
    this.past = []
    this.future = []
    this.emit({ project, previous, commands: [], kind: 'load' })
  }

  historySize(): number {
    return this.past.length + this.future.length
  }

  /**
   * Asset metadata (probe results, proxy state, missing status) is not part of edit history. When
   * moving through history, keep the newest asset records for assets that still exist.
   */
  private carryAssets(target: Project, latest: Project): Project {
    let changed = false
    const assets = { ...target.assets }
    for (const id of Object.keys(assets)) {
      const fresh = latest.assets[id]
      if (fresh && fresh !== assets[id]) {
        assets[id] = fresh
        changed = true
      }
    }
    return changed ? { ...target, assets } : target
  }

  private emit(change: StoreChange): void {
    this.version++
    if (change.kind !== 'load') this.dirtyVersion++
    for (const l of this.listeners) l(change)
  }
}

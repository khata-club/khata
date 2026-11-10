/**
 * Automatic, asynchronous local save. After each edit a save is scheduled (debounced) and runs in
 * an idle callback, so editing never pauses. Two slots (A/B) alternate, each with a checksum, so a
 * crash mid-write always leaves the previous good save intact.
 */
import {
  type Project,
  type ProjectStore,
  checksum,
  parseProject,
  projectForStorage,
  serializeProject,
  toKaatError,
} from '@khata/kaat-core'

import { telemetry } from '../telemetry'
import { idbAll, idbDelete, idbGet, idbPut } from './db'
import { evictRebuildable } from './storage'

export interface ProjectIndexRow {
  id: string
  name: string
  updatedAt: number
  savedAt: number
  slot: 'a' | 'b'
  clips: number
}

interface SlotRecord {
  json: string
  sum: number
  savedAt: number
}

export interface SessionFlag {
  projectId: string
  clean: boolean
}

export type SaveState = 'saved' | 'pending' | 'saving' | 'error'

export class Autosave {
  private timer = 0
  private idle = 0
  private savedVersion = -1
  private saving?: Promise<void>
  private nextSlot: 'a' | 'b' = 'a'
  state: SaveState = 'saved'
  lastSavedAt = 0
  onState?: (s: SaveState) => void
  onError?: (e: unknown) => void

  constructor(
    private readonly store: ProjectStore,
    private readonly delayMs = 750,
  ) {}

  start(): () => void {
    return this.store.subscribe((c) => {
      if (c.kind === 'load') {
        this.savedVersion = this.store.dirtyVersion
        this.sessionFor = c.project.id
        void this.writeSession(c.project.id, false)
        return
      }
      this.schedule()
    })
  }

  private set(s: SaveState): void {
    this.state = s
    this.onState?.(s)
  }

  schedule(): void {
    if (this.store.dirtyVersion === this.savedVersion) return
    this.set('pending')
    clearTimeout(this.timer)
    this.timer = window.setTimeout(() => {
      cancelIdleCallback(this.idle)
      this.idle = requestIdleCallback(() => void this.save(), { timeout: 2000 })
    }, this.delayMs)
  }

  /** Save now (Cmd+S, before unload, before export). */
  async flush(): Promise<void> {
    clearTimeout(this.timer)
    cancelIdleCallback(this.idle)
    if (this.saving) await this.saving
    if (this.store.dirtyVersion !== this.savedVersion) await this.save()
  }

  private async save(): Promise<void> {
    if (this.saving) {
      await this.saving
      return this.schedule()
    }
    const version = this.store.dirtyVersion
    const project = this.store.project
    this.set('saving')
    this.saving = (async () => {
      const t0 = performance.now()
      const json = serializeProject(projectForStorage(project))
      const rec: SlotRecord = { json, sum: checksum(json), savedAt: Date.now() }
      telemetry.autosaveMs.push(performance.now() - t0)
      const slot = this.nextSlot
      try {
        await this.write(project, slot, rec)
      } catch (e) {
        if (toKaatError(e, 'SAVE_FAILED').code === 'OUT_OF_STORAGE') {
          // Free rebuildable caches, then retry once.
          await evictRebuildable(json.length * 4)
          await this.write(project, slot, rec)
        } else throw e
      }
      this.nextSlot = slot === 'a' ? 'b' : 'a'
      this.savedVersion = version
      this.lastSavedAt = rec.savedAt
    })()
    try {
      await this.saving
      this.set(this.store.dirtyVersion === this.savedVersion ? 'saved' : 'pending')
      if (this.store.dirtyVersion !== this.savedVersion) this.schedule()
    } catch (e) {
      this.set('error')
      telemetry.error('SAVE_FAILED', e instanceof Error ? e.message : String(e))
      this.onError?.(e)
    } finally {
      this.saving = undefined
    }
  }

  private async write(p: Project, slot: 'a' | 'b', rec: SlotRecord): Promise<void> {
    await idbPut('autosave', `${p.id}:${slot}`, rec)
    const clips = p.sequences.reduce(
      (n, s) => n + s.tracks.reduce((m, t) => m + t.clips.length, 0),
      0,
    )
    const row: ProjectIndexRow = {
      id: p.id,
      name: p.name,
      updatedAt: p.updatedAt,
      savedAt: rec.savedAt,
      slot,
      clips,
    }
    await idbPut('projects', p.id, row)
    await idbPut('kv', 'lastProject', p.id)
    // Mark the session as open (not cleanly closed) so a crash can be detected next time.
    if (this.sessionFor !== p.id) {
      this.sessionFor = p.id
      await this.writeSession(p.id, false)
    }
  }

  private sessionFor?: string

  writeSession(projectId: string, clean: boolean): Promise<void> {
    return idbPut('kv', 'session', { projectId, clean } satisfies SessionFlag).catch(() => {})
  }
}

/** Load the newest valid autosave slot for a project. */
export async function loadProject(
  id: string,
): Promise<{ project: Project; savedAt: number } | undefined> {
  const slots = await Promise.all(
    ['a', 'b'].map((s) => idbGet<SlotRecord>('autosave', `${id}:${s}`).catch(() => undefined)),
  )
  const valid = slots
    .filter((r): r is SlotRecord => !!r && checksum(r.json) === r.sum)
    .sort((a, b) => b.savedAt - a.savedAt)
  for (const r of valid) {
    try {
      return { project: parseProject(r.json), savedAt: r.savedAt }
    } catch {
      // Try the other slot.
    }
  }
  return undefined
}

export async function listProjects(): Promise<ProjectIndexRow[]> {
  const rows = await idbAll<ProjectIndexRow>('projects').catch(() => [])
  return rows.map((r) => r.value).sort((a, b) => b.savedAt - a.savedAt)
}

export async function deleteProject(id: string): Promise<void> {
  await Promise.all([
    idbDelete('projects', id),
    idbDelete('autosave', `${id}:a`),
    idbDelete('autosave', `${id}:b`),
  ])
}

export async function lastProjectId(): Promise<string | undefined> {
  return idbGet<string>('kv', 'lastProject').catch(() => undefined)
}

export async function previousSession(): Promise<SessionFlag | undefined> {
  return idbGet<SessionFlag>('kv', 'session').catch(() => undefined)
}

/**
 * Versioned, portable project files (`.kaat.json`). Independent of the UI: only the model.
 * Older files are migrated forward step by step on load.
 */
import { type Project, SCHEMA_VERSION } from './model'

export const PROJECT_FORMAT = 'kaat-project'

export interface ProjectFile {
  format: typeof PROJECT_FORMAT
  version: number
  savedAt: number
  project: Project
}

/** Migration from version `n` to `n + 1`, keyed by `n`. */
type Migration = (p: Record<string, unknown>) => Record<string, unknown>

/**
 * Version 0 was the pre-release shape (no masterGainDb, single `sequence`). Kept as the first
 * migration so the chain is exercised from day one.
 */
const MIGRATIONS: Record<number, Migration> = {
  0: (p) => {
    const q: Record<string, unknown> = { ...p }
    if (!Array.isArray(q.sequences) && q.sequence && typeof q.sequence === 'object') {
      const seq = q.sequence as { id: string }
      q.sequences = [seq]
      q.activeSequenceId = seq.id
      delete q.sequence
    }
    const settings = { ...(q.settings as Record<string, unknown>) }
    if (typeof settings.masterGainDb !== 'number') settings.masterGainDb = 0
    q.settings = settings
    return q
  },
}

export class ProjectFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectFormatError'
  }
}

export function migrateProject(raw: unknown): Project {
  if (!raw || typeof raw !== 'object') throw new ProjectFormatError('Project data is not an object')
  let p = raw as Record<string, unknown>
  let v = typeof p.schemaVersion === 'number' ? p.schemaVersion : 0
  if (v > SCHEMA_VERSION)
    throw new ProjectFormatError(
      `This project was saved by a newer version of Kaat (format ${v}). Update the app to open it.`,
    )
  while (v < SCHEMA_VERSION) {
    const m = MIGRATIONS[v]
    if (!m) throw new ProjectFormatError(`No migration from project format ${v}`)
    p = m(p)
    v++
    p.schemaVersion = v
  }
  validate(p)
  return p as unknown as Project
}

function validate(p: Record<string, unknown>): void {
  const fail = (what: string) => {
    throw new ProjectFormatError(`Invalid project: ${what}`)
  }
  if (typeof p.id !== 'string') fail('missing id')
  if (!p.settings || typeof p.settings !== 'object') fail('missing settings')
  const s = p.settings as Record<string, unknown>
  if (typeof s.width !== 'number' || typeof s.height !== 'number') fail('bad resolution')
  if (!s.fps || typeof s.fps !== 'object') fail('bad frame rate')
  if (!p.assets || typeof p.assets !== 'object') fail('missing assets')
  if (!Array.isArray(p.sequences) || !p.sequences.length) fail('missing sequences')
  for (const seq of p.sequences as Record<string, unknown>[]) {
    if (!Array.isArray(seq.tracks)) fail('sequence without tracks')
    for (const t of seq.tracks as Record<string, unknown>[]) {
      if (!Array.isArray(t.clips)) fail('track without clips')
      let prevEnd = -Infinity
      for (const c of t.clips as Record<string, unknown>[]) {
        if (typeof c.start !== 'number' || typeof c.duration !== 'number') fail('clip timing')
        if ((c.start as number) < prevEnd) fail('overlapping clips')
        prevEnd = (c.start as number) + (c.duration as number)
      }
    }
  }
}

export function serializeProject(p: Project): string {
  const file: ProjectFile = {
    format: PROJECT_FORMAT,
    version: SCHEMA_VERSION,
    savedAt: Date.now(),
    project: p,
  }
  return JSON.stringify(file)
}

/** Parse a `.kaat.json` file (or a bare project object) and migrate it. */
export function parseProject(json: string): Project {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new ProjectFormatError('The file is not valid JSON')
  }
  if (raw && typeof raw === 'object' && (raw as ProjectFile).format === PROJECT_FORMAT)
    return migrateProject((raw as ProjectFile).project)
  return migrateProject(raw)
}

/**
 * Asset status as stored: probing state is transient, so a saved project never claims to be
 * mid-probe. On restore, assets start as `missing` until their source is reconnected.
 */
export function projectForStorage(p: Project): Project {
  let changed = false
  const assets = { ...p.assets }
  for (const [id, a] of Object.entries(assets)) {
    if (a.proxy?.status === 'building') {
      assets[id] = { ...a, proxy: { status: 'recommended' } }
      changed = true
    }
  }
  return changed ? { ...p, assets } : p
}

/** Cheap 32-bit FNV-1a checksum, used to detect torn autosave writes. */
export function checksum(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

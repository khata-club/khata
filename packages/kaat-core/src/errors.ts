/**
 * Categorised engine errors. Each code maps to user-facing copy that answers:
 * what failed, is my project safe, is my source media safe, and what can I do next.
 */
export type ErrorCode =
  | 'UNSUPPORTED_MEDIA'
  | 'DECODE_FAILED'
  | 'RENDER_FAILED'
  | 'SOURCE_MISSING'
  | 'SOURCE_PERMISSION_LOST'
  | 'OUT_OF_MEMORY'
  | 'OUT_OF_STORAGE'
  | 'EXPORT_FAILED'
  | 'EXPORT_CANCELLED'
  | 'ANALYSIS_FAILED'
  | 'PROJECT_INVALID'
  | 'SAVE_FAILED'
  | 'UNSUPPORTED_BROWSER'

export class KaatError extends Error {
  readonly code: ErrorCode
  readonly detail?: string
  constructor(code: ErrorCode, message?: string, detail?: string) {
    super(message ?? code)
    this.name = 'KaatError'
    this.code = code
    this.detail = detail
  }
}

export interface ErrorCopy {
  title: string
  /** What failed. */
  what: string
  /** Is my project safe? */
  project: string
  /** Is my source media safe? */
  media: string
  /** What can I do next? */
  next: string
  severity: 'info' | 'warning' | 'danger'
}

const PROJECT_SAFE = 'Your project and edits are safe.'
const MEDIA_SAFE = 'Your original files are untouched. Kaat never modifies or uploads them.'

const COPY: Record<ErrorCode, Omit<ErrorCopy, 'what'> & { what: string }> = {
  UNSUPPORTED_MEDIA: {
    title: 'File type not supported',
    what: 'Chrome cannot decode this file’s format or codec.',
    project: PROJECT_SAFE,
    media: MEDIA_SAFE,
    next: 'Convert it to MP4 (H.264/AAC), WebM (VP9/Opus), MOV, MP3, WAV, PNG or JPEG and import again.',
    severity: 'warning',
  },
  DECODE_FAILED: {
    title: 'Could not decode media',
    what: 'A frame or audio block in this file could not be decoded.',
    project: PROJECT_SAFE,
    media: MEDIA_SAFE,
    next: 'Try building a proxy for this file, or re-encode it with another tool and relink.',
    severity: 'warning',
  },
  RENDER_FAILED: {
    title: 'Preview render failed',
    what: 'The preview could not draw this frame.',
    project: PROJECT_SAFE,
    media: MEDIA_SAFE,
    next: 'Lower the preview quality, or reload the editor. Your work is autosaved.',
    severity: 'warning',
  },
  SOURCE_MISSING: {
    title: 'Media offline',
    what: 'A source file was moved, renamed or deleted.',
    project: 'Your edits on these clips are kept and will come back when you relink.',
    media: 'Kaat never deletes source files.',
    next: 'Use “Relink” in the media panel to point to the file’s new location.',
    severity: 'warning',
  },
  SOURCE_PERMISSION_LOST: {
    title: 'Media needs permission',
    what: 'Chrome needs your permission again to read some source files.',
    project: PROJECT_SAFE,
    media: MEDIA_SAFE,
    next: 'Click “Reconnect media” and allow access.',
    severity: 'info',
  },
  OUT_OF_MEMORY: {
    title: 'Running low on memory',
    what: 'The editor reduced caches and preview quality to stay responsive.',
    project: PROJECT_SAFE,
    media: MEDIA_SAFE,
    next: 'Close other tabs, use proxies for 4K media, or set preview quality to Low.',
    severity: 'warning',
  },
  OUT_OF_STORAGE: {
    title: 'Browser storage is full',
    what: 'Kaat cleared rebuildable caches (thumbnails, waveforms, proxies) but space is still low.',
    project: 'Your latest project state is kept; new autosaves may fail until space is freed.',
    media: MEDIA_SAFE,
    next: 'Free disk space, or export your project file (File → Export project) as a backup.',
    severity: 'danger',
  },
  EXPORT_FAILED: {
    title: 'Export failed',
    what: 'The video could not be written.',
    project: PROJECT_SAFE,
    media: MEDIA_SAFE,
    next: 'Try again with a different format or resolution, or choose another save location.',
    severity: 'danger',
  },
  EXPORT_CANCELLED: {
    title: 'Export cancelled',
    what: 'The export was stopped and the partial file was discarded.',
    project: PROJECT_SAFE,
    media: MEDIA_SAFE,
    next: 'Start the export again whenever you are ready.',
    severity: 'info',
  },
  ANALYSIS_FAILED: {
    title: 'Background analysis failed',
    what: 'Thumbnails or waveforms could not be generated for a file.',
    project: PROJECT_SAFE,
    media: MEDIA_SAFE,
    next: 'Editing still works. The file may be partially corrupt; try relinking a fresh copy.',
    severity: 'info',
  },
  PROJECT_INVALID: {
    title: 'Could not open project',
    what: 'The project file is damaged or from an unknown version.',
    project: 'Your current project is unchanged.',
    media: MEDIA_SAFE,
    next: 'Choose another project file, or update Kaat if the file came from a newer version.',
    severity: 'warning',
  },
  SAVE_FAILED: {
    title: 'Autosave failed',
    what: 'The latest changes could not be saved to browser storage.',
    project: 'Your previous autosave is intact. Changes since then exist only in this tab.',
    media: MEDIA_SAFE,
    next: 'Free disk space, or export the project file now as a backup.',
    severity: 'danger',
  },
  UNSUPPORTED_BROWSER: {
    title: 'Browser not supported',
    what: 'This browser lacks features Kaat needs (WebCodecs, OffscreenCanvas, File System Access).',
    project: 'Nothing was changed.',
    media: MEDIA_SAFE,
    next: 'Open Kaat in the latest desktop Google Chrome.',
    severity: 'danger',
  },
}

export function errorCopy(code: ErrorCode, what?: string): ErrorCopy {
  const c = COPY[code]
  return { ...c, what: what ?? c.what }
}

export function toKaatError(e: unknown, fallback: ErrorCode): KaatError {
  if (e instanceof KaatError) return e
  const msg = e instanceof Error ? e.message : String(e)
  if (e instanceof Error && e.name === 'QuotaExceededError')
    return new KaatError('OUT_OF_STORAGE', msg)
  if (/out of memory|allocation failed/i.test(msg)) return new KaatError('OUT_OF_MEMORY', msg)
  return new KaatError(fallback, msg)
}

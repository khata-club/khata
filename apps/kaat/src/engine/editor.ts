/**
 * The editor: one object wiring the project store to the engine services (media, render, audio,
 * transport, autosave, export) and exposing a small reactive surface to Vue.
 *
 * Vue sees: `project` (a shallowRef replaced once per edit), `ui` (selection, panels, zoom...),
 * and a throttled `playhead`. Per-frame engine state (the precise playhead, render results) goes
 * through emitters to canvases, never through reactive state.
 */
import {
  type Asset,
  type AssetKind,
  type Clip,
  type Command,
  DEFAULT_TEXT,
  type ErrorCode,
  KaatError,
  type Project,
  ProjectStore,
  type Sequence,
  type TextProps,
  type Ticks,
  type Track,
  activeSequence,
  clipEnd,
  createClip,
  createProject,
  errorCopy,
  findClip,
  floorToFrame,
  newId,
  parseProject,
  rationalFromFloat,
  secondsToTicks,
  sequenceDuration,
  serializeProject,
  ticksToSeconds,
  toKaatError,
} from '@khata/kaat-core'
import { reactive, shallowRef } from 'vue'

import { AudioEngine } from './audio/audioEngine'
import type { CapabilityReport } from './capabilities'
import { type ExportOptions, ExportService } from './export/exportService'
import { opfsFile } from './media/inputs'
import { MediaService } from './media/mediaService'
import {
  Autosave,
  type SaveState,
  lastProjectId,
  loadProject,
  previousSession,
} from './persist/autosave'
import { ensureSpace, estimate, requestPersistence } from './persist/storage'
import { type PreviewQuality, RenderService } from './render/renderService'
import { SourceRegistry, fingerprint } from './sources'
import { telemetry } from './telemetry'
import { Transport } from './transport'

export interface Toast {
  id: number
  code?: ErrorCode
  title: string
  body: string
  severity: 'info' | 'success' | 'warning' | 'danger'
  action?: { label: string; run: () => void }
  sticky?: boolean
}

export type LeftTab = 'media' | 'text' | 'effects' | 'audio'

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|avif)$/i
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|flac|ogg|oga|opus)$/i
const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|ts|mts|m2ts)$/i

export function guessKind(f: File): AssetKind | undefined {
  if (f.type.startsWith('image/') || IMAGE_EXT.test(f.name)) return 'image'
  if (f.type.startsWith('audio/') || AUDIO_EXT.test(f.name)) return 'audio'
  if (f.type.startsWith('video/') || VIDEO_EXT.test(f.name)) return 'video'
  return undefined
}

export interface ImportItem {
  file: File
  handle?: FileSystemFileHandle
}

export class Editor {
  readonly store: ProjectStore
  readonly sources = new SourceRegistry()
  readonly media: MediaService
  readonly audio: AudioEngine
  render!: RenderService
  transport!: Transport
  readonly autosave: Autosave
  readonly exporter: ExportService
  readonly project = shallowRef<Project>()
  caps?: CapabilityReport

  readonly ui = reactive({
    selection: [] as string[],
    leftTab: 'media' as LeftTab,
    snapping: true,
    pxPerSecond: 60,
    scrollX: 0,
    quality: 'auto' as PreviewQuality,
    diagnostics: false,
    exportOpen: false,
    projectsOpen: false,
    shortcutsOpen: false,
    toasts: [] as Toast[],
    saveState: 'saved' as SaveState,
    lastSavedAt: 0,
    playing: false,
    rate: 1,
    loop: false,
    playhead: 0,
    online: navigator.onLine,
    undoLabel: '' as string | undefined,
    redoLabel: '' as string | undefined,
    missingCount: 0,
    permissionCount: 0,
    /** Set once the preview canvas is attached and the transport exists. */
    engineReady: false,
  })

  readonly prefs = reactive({ autoProxy: false })

  private toastId = 0
  private playheadTimer = 0

  constructor() {
    this.store = new ProjectStore(createProject())
    this.media = new MediaService(() => this.audio.context())
    this.audio = new AudioEngine(this.media, this.sources)
    this.autosave = new Autosave(this.store)
    this.exporter = new ExportService(() => this.caps)
    this.project.value = this.store.project
    this.store.subscribe((c) => {
      this.project.value = c.project
      this.ui.undoLabel = this.store.undoLabel()
      this.ui.redoLabel = this.store.redoLabel()
      // Selection may point at clips an undo removed.
      if (c.kind !== 'apply' && this.ui.selection.length) {
        const seq = activeSequence(c.project)
        this.ui.selection = this.ui.selection.filter((id) => findClip(seq, id))
      }
      this.render?.setProject(c.project)
      this.transport?.projectChanged(c.project)
      this.updateMissingCounts()
    })
    this.autosave.onState = (s) => {
      this.ui.saveState = s
      this.ui.lastSavedAt = this.autosave.lastSavedAt
    }
    this.autosave.onError = (e) => this.error(toKaatError(e, 'SAVE_FAILED'))
    this.autosave.start()
    this.sources.onChange(() => this.updateMissingCounts())
    this.media.on('proxy', ({ assetId, progress }) => {
      const a = this.store.project.assets[assetId]
      if (a?.proxy?.status === 'building')
        this.store.dispatch({
          type: 'updateAsset',
          id: assetId,
          patch: { proxy: { ...a.proxy, progress } },
        })
    })
    window.addEventListener('online', () => (this.ui.online = true))
    window.addEventListener('offline', () => (this.ui.online = false))
  }

  /** Attach the preview canvas (once, from the preview component). */
  attachCanvas(canvas: HTMLCanvasElement): void {
    this.render = new RenderService(canvas)
    this.transport = new Transport(this.render, this.audio)
    this.transport.bind(() => this.store.project)
    this.transport.on('state', ({ playing, rate }) => {
      this.ui.playing = playing
      this.ui.rate = rate
      // Background work yields to playback.
      this.media.scheduler.pauseBelow(playing ? 3 : null)
      this.syncPlayhead()
    })
    this.transport.on('time', () => {
      if (this.ui.playing) {
        if (!this.playheadTimer)
          this.playheadTimer = window.setTimeout(() => this.syncPlayhead(), 100)
      } else this.syncPlayhead()
    })
    this.render.setProject(this.store.project)
    for (const [id, a] of Object.entries(this.store.project.assets)) void this.pushSource(id, a)
    this.ui.engineReady = true
  }

  private syncPlayhead(): void {
    clearTimeout(this.playheadTimer)
    this.playheadTimer = 0
    this.ui.playhead = this.transport.time
  }

  get seq(): Sequence {
    return activeSequence(this.store.project)
  }

  exec(cmd: Command | Command[], label?: string): boolean {
    return this.store.dispatch(cmd, label)
  }

  // ── toasts & errors ─────────────────────────────────────────────────────────────────────────

  toast(t: Omit<Toast, 'id'>, ms = 6000): number {
    const id = ++this.toastId
    this.ui.toasts.push({ ...t, id })
    if (this.ui.toasts.length > 5) this.ui.toasts.shift()
    if (!t.sticky) setTimeout(() => this.dismiss(id), ms)
    return id
  }

  dismiss(id: number): void {
    const i = this.ui.toasts.findIndex((t) => t.id === id)
    if (i >= 0) this.ui.toasts.splice(i, 1)
  }

  error(e: KaatError, action?: Toast['action'], what?: string): void {
    const c = errorCopy(e.code, what)
    telemetry.error(e.code, e.message)
    this.toast(
      {
        code: e.code,
        title: c.title,
        body: `${c.what} ${c.project} ${c.media} ${c.next}`,
        severity:
          c.severity === 'danger' ? 'danger' : c.severity === 'warning' ? 'warning' : 'info',
        action,
      },
      c.severity === 'danger' ? 15000 : 9000,
    )
  }

  // ── startup / projects ──────────────────────────────────────────────────────────────────────

  /** Restore the last project (crash recovery included). */
  async restore(projectId?: string): Promise<boolean> {
    const prev = await previousSession()
    const id = projectId ?? prev?.projectId ?? (await lastProjectId())
    if (!id) return false
    const loaded = await loadProject(id)
    if (!loaded) return false
    await this.open(loaded.project)
    if (!projectId && prev && !prev.clean)
      this.toast({
        title: 'Project recovered',
        body: `Kaat closed unexpectedly. “${loaded.project.name}” was restored from the last autosave.`,
        severity: 'info',
      })
    return true
  }

  /** Open a project: reconnect its sources (without prompting) and reset the transport. */
  async open(p: Project): Promise<void> {
    if (this.transport?.playing) this.transport.pause()
    // Forget the previous project's sources.
    for (const id of Object.keys(this.store.project.assets)) {
      this.media.release(id)
      void this.render?.removeSource(id)
    }
    this.store.load(p)
    this.ui.selection = []
    this.transport?.seek(0)
    await Promise.all(
      Object.values(p.assets).map(async (a) => {
        const state = await this.sources.restore(a.id)
        const status = state === 'ready' ? 'ready' : 'missing'
        if (a.status !== status && a.status !== 'error')
          this.exec({ type: 'updateAsset', id: a.id, patch: { status } })
        if (state === 'ready') await this.pushSource(a.id, this.store.project.assets[a.id]!)
      }),
    )
    this.updateMissingCounts()
    if (this.ui.permissionCount)
      this.toast({
        code: 'SOURCE_PERMISSION_LOST',
        title: 'Reconnect your media',
        body: `Chrome needs permission again to read ${this.ui.permissionCount} source file(s). Your edits are safe.`,
        severity: 'info',
        action: { label: 'Reconnect', run: () => void this.reconnectMedia() },
        sticky: true,
      })
    else if (this.ui.missingCount)
      this.error(
        new KaatError('SOURCE_MISSING'),
        undefined,
        `${this.ui.missingCount} source file(s) are offline.`,
      )
  }

  newProject(): void {
    void this.autosave.flush().then(() => this.open(createProject()))
  }

  async importProjectFile(file: File): Promise<void> {
    try {
      const p = parseProject(await file.text())
      // A project file opened again must not overwrite the existing copy's autosaves.
      const copy: Project = { ...p, id: newId('prj'), name: p.name }
      await this.autosave.flush()
      await this.open(copy)
      this.toast({
        title: 'Project imported',
        body: `Opened “${copy.name}”. Relink media if it shows as offline.`,
        severity: 'success',
      })
    } catch (e) {
      this.error(
        toKaatError(e, 'PROJECT_INVALID'),
        undefined,
        e instanceof Error ? e.message : undefined,
      )
    }
  }

  exportProjectFile(): void {
    const p = this.store.project
    const blob = new Blob([serializeProject(p)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${p.name.replace(/[\\/:*?"<>|]+/g, '_') || 'project'}.kaat.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  private updateMissingCounts(): void {
    let missing = 0
    let perm = 0
    for (const a of Object.values(this.store.project.assets)) {
      const s = this.sources.state(a.id)
      if (s === 'permission') perm++
      else if (s === 'missing' && a.status !== 'probing') missing++
    }
    this.ui.missingCount = missing
    this.ui.permissionCount = perm
  }

  async reconnectMedia(): Promise<void> {
    const ids = Object.keys(this.store.project.assets).filter(
      (id) => this.sources.state(id) === 'permission',
    )
    const ok = await this.sources.reconnect(ids)
    for (const id of ok) {
      this.exec({ type: 'updateAsset', id, patch: { status: 'ready' } })
      await this.pushSource(id, this.store.project.assets[id]!)
    }
    this.updateMissingCounts()
    if (ok.length) {
      this.ui.toasts = this.ui.toasts.filter((t) => t.code !== 'SOURCE_PERMISSION_LOST')
      this.toast({
        title: 'Media reconnected',
        body: `${ok.length} file(s) are online again.`,
        severity: 'success',
      })
    }
  }

  // ── import ──────────────────────────────────────────────────────────────────────────────────

  /** Drop or pick files: assets appear immediately; metadata and derived data follow. */
  async importFiles(items: ImportItem[]): Promise<string[]> {
    const accepted: { item: ImportItem; asset: Asset }[] = []
    for (const item of items) {
      const kind = guessKind(item.file)
      if (!kind) {
        this.error(
          new KaatError('UNSUPPORTED_MEDIA'),
          undefined,
          `“${item.file.name}” is not a video, audio or image file.`,
        )
        continue
      }
      accepted.push({
        item,
        asset: {
          id: newId('ast'),
          kind,
          name: item.file.name,
          size: item.file.size,
          lastModified: item.file.lastModified,
          mime: item.file.type,
          status: 'probing',
          duration: 0,
          width: 0,
          height: 0,
          hasVideo: kind !== 'audio',
          hasAudio: kind !== 'image',
        },
      })
    }
    if (!accepted.length) return []
    this.exec({ type: 'addAssets', assets: accepted.map((a) => a.asset) })
    this.ui.leftTab = 'media'
    void requestPersistence()
    await Promise.all(
      accepted.map(({ item, asset }) => this.sources.set(asset.id, item.file, item.handle)),
    )
    // Probe in parallel; each asset becomes usable as soon as its own probe returns.
    await Promise.all(accepted.map(({ item, asset }) => this.probe(asset.id, item.file)))
    return accepted.map((a) => a.asset.id)
  }

  private async probe(assetId: string, file: File): Promise<void> {
    try {
      const r = await this.media.probe(assetId, file)
      if (r.undecodable)
        throw new KaatError(
          'UNSUPPORTED_MEDIA',
          `Codec ${r.undecodable} cannot be decoded in this browser`,
        )
      const patch: Partial<Asset> = {
        kind: r.kind,
        status: 'ready',
        duration: secondsToTicks(r.durationSeconds),
        startTime: secondsToTicks(r.startSeconds),
        width: r.width,
        height: r.height,
        hasVideo: r.hasVideo,
        hasAudio: r.hasAudio,
        sampleRate: r.sampleRate,
        channels: r.channels,
        videoCodec: r.videoCodec,
        audioCodec: r.audioCodec,
      }
      if (r.fps) patch.fps = rationalFromFloat(r.fps)
      const heavy =
        r.kind === 'video' && (r.width * r.height > 1920 * 1080 * 1.2 || (r.fps ?? 0) > 61)
      if (heavy) patch.proxy = { status: 'recommended' }
      this.exec({ type: 'updateAsset', id: assetId, patch })
      this.maybeAdoptSettings(assetId)
      await this.pushSource(assetId, this.store.project.assets[assetId]!)
      if (heavy && this.prefs.autoProxy) void this.buildProxy(assetId)
    } catch (e) {
      const err = toKaatError(e, 'UNSUPPORTED_MEDIA')
      this.exec({
        type: 'updateAsset',
        id: assetId,
        patch: { status: 'error', error: err.message },
      })
      this.error(
        err.code === 'DECODE_FAILED' ? err : new KaatError('UNSUPPORTED_MEDIA', err.message),
        undefined,
        `“${file.name}”: ${err.message}.`,
      )
    }
  }

  /** The first video into an empty project sets the project's resolution and frame rate. */
  private maybeAdoptSettings(assetId: string): void {
    const p = this.store.project
    const a = p.assets[assetId]
    if (!a || a.kind !== 'video' || !a.width) return
    const anyClips = p.sequences.some((s) => s.tracks.some((t) => t.clips.length))
    const anyOtherVideo = Object.values(p.assets).some(
      (x) => x.id !== assetId && x.kind === 'video' && x.status === 'ready',
    )
    if (anyClips || anyOtherVideo) return
    const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)
    this.exec({
      type: 'setSettings',
      patch: { width: even(a.width), height: even(a.height), fps: a.fps ?? p.settings.fps },
    })
  }

  /** Send the source (and proxy) to the render worker and kick off derived work. */
  private async pushSource(assetId: string, asset: Asset): Promise<void> {
    const file = this.sources.get(assetId)
    if (!file || !this.render) return
    let proxy: Blob | undefined
    if (asset.proxy?.status === 'ready' && asset.proxy.path)
      proxy = await opfsFile(asset.proxy.path).catch(() => undefined)
    if (asset.proxy?.status === 'ready' && !proxy)
      this.exec({ type: 'updateAsset', id: assetId, patch: { proxy: { status: 'recommended' } } })
    await this.render.setSource(assetId, file, proxy)
    if (asset.status === 'ready' && asset.hasAudio && asset.kind !== 'image')
      void this.media.ensureWaveform(
        assetId,
        fingerprint(asset.name, asset.size, asset.lastModified),
        file,
        ticksToSeconds(asset.duration),
      )
  }

  async relink(assetId: string, item: ImportItem): Promise<void> {
    const a = this.store.project.assets[assetId]
    if (!a) return
    const f = item.file
    if (a.size && f.size !== a.size)
      this.toast({
        title: 'Relinked a different file',
        body: `“${f.name}” differs in size from the original “${a.name}”. Check that the clips still line up.`,
        severity: 'warning',
      })
    this.media.release(assetId)
    await this.sources.set(assetId, f, item.handle)
    this.exec({
      type: 'updateAsset',
      id: assetId,
      patch: { status: 'probing', name: f.name, size: f.size, lastModified: f.lastModified },
    })
    await this.probe(assetId, f)
    this.toast({
      title: 'Media relinked',
      body: `“${f.name}” is online. Edits were kept.`,
      severity: 'success',
    })
  }

  /** Relink several offline assets from a set of files by matching names. */
  async relinkMany(items: ImportItem[]): Promise<number> {
    let n = 0
    for (const a of Object.values(this.store.project.assets)) {
      if (this.sources.state(a.id) === 'ready') continue
      const m =
        items.find((i) => i.file.name === a.name && (!a.size || i.file.size === a.size)) ??
        items.find((i) => i.file.name === a.name)
      if (m) {
        await this.relink(a.id, m)
        n++
      }
    }
    return n
  }

  removeAsset(assetId: string): void {
    this.media.release(assetId)
    void this.render.removeSource(assetId)
    this.exec({ type: 'removeAsset', id: assetId })
    void this.sources.remove(assetId)
  }

  // ── proxies ─────────────────────────────────────────────────────────────────────────────────

  async buildProxy(assetId: string): Promise<void> {
    const a = this.store.project.assets[assetId]
    const file = this.sources.get(assetId)
    if (!a || !file || a.proxy?.status === 'building') return
    const codec = this.caps?.encode.h264 ? 'avc' : 'vp9'
    const path = `proxies/${fingerprint(a.name, a.size, a.lastModified)}.${codec === 'avc' ? 'mp4' : 'webm'}`
    const space = await ensureSpace(Math.max(64 * 1024 * 1024, a.size / 6))
    this.handleEvictedProxies(space.proxies)
    if (!space.ok) {
      this.error(new KaatError('OUT_OF_STORAGE'))
      return
    }
    this.exec({
      type: 'updateAsset',
      id: assetId,
      patch: { proxy: { status: 'building', progress: 0 } },
    })
    try {
      await this.media.buildProxy(assetId, file, path, codec)
      this.exec({ type: 'updateAsset', id: assetId, patch: { proxy: { status: 'ready', path } } })
      await this.pushSource(assetId, this.store.project.assets[assetId]!)
      void estimate()
    } catch (e) {
      const cancelled =
        (e as Error)?.name === 'TaskCancelledError' || (e as Error)?.name === 'AbortError'
      this.exec({
        type: 'updateAsset',
        id: assetId,
        patch: { proxy: { status: cancelled ? 'recommended' : 'error' } },
      })
      if (!cancelled)
        this.error(
          toKaatError(e, 'DECODE_FAILED'),
          undefined,
          `Could not build a proxy for “${a.name}”.`,
        )
    }
  }

  cancelProxy(assetId: string): void {
    this.media.cancelProxy(assetId)
  }

  private handleEvictedProxies(paths: string[]): void {
    if (!paths.length) return
    const set = new Set(paths)
    for (const a of Object.values(this.store.project.assets))
      if (a.proxy?.path && set.has(a.proxy.path)) {
        this.exec({ type: 'updateAsset', id: a.id, patch: { proxy: { status: 'recommended' } } })
        void this.pushSource(a.id, this.store.project.assets[a.id]!)
      }
  }

  // ── timeline placement ──────────────────────────────────────────────────────────────────────

  firstTrack(kind: 'video' | 'audio'): Track | undefined {
    return this.seq.tracks.find((t) => t.kind === kind && !t.locked)
  }

  defaultDuration(a: Asset): Ticks {
    if (a.kind === 'image' || a.duration <= 0) return secondsToTicks(5)
    return floorToFrame(a.duration, this.store.project.settings.fps) || a.duration
  }

  /** Place an asset at `start` on `trackId` (or the first suitable track). Video brings linked audio. */
  placeAsset(assetId: string, start: Ticks, trackId?: string): string | undefined {
    const p = this.store.project
    const a = p.assets[assetId]
    if (!a || a.status !== 'ready') return undefined
    const seq = this.seq
    const fps = p.settings.fps
    const at = floorToFrame(Math.max(0, start), fps)
    const duration = this.defaultDuration(a)
    const wantKind = a.kind === 'audio' ? 'audio' : 'video'
    let track = trackId ? seq.tracks.find((t) => t.id === trackId) : undefined
    if (!track || track.kind !== wantKind || track.locked) track = this.firstTrack(wantKind)
    if (!track) return undefined
    const placements: { trackId: string; clip: Clip }[] = []
    const linkId = a.kind === 'video' && a.hasAudio ? newId('lnk') : undefined
    const main = createClip({ kind: 'media', name: a.name, assetId, start: at, duration, linkId })
    placements.push({ trackId: track.id, clip: main })
    if (linkId) {
      const vIndex = seq.tracks.filter((t) => t.kind === 'video').indexOf(track)
      const audios = seq.tracks.filter((t) => t.kind === 'audio' && !t.locked)
      const at2 = audios[Math.min(Math.max(0, vIndex), audios.length - 1)]
      if (at2)
        placements.push({
          trackId: at2.id,
          clip: createClip({ kind: 'media', name: a.name, assetId, start: at, duration, linkId }),
        })
      else delete main.linkId
    }
    this.exec({ type: 'addClips', placements }, 'Add clip')
    this.ui.selection = [main.id]
    return main.id
  }

  /** Append at the end of the first video (or audio) track. */
  appendAsset(assetId: string): void {
    const a = this.store.project.assets[assetId]
    if (!a) return
    const track = this.firstTrack(a.kind === 'audio' ? 'audio' : 'video')
    const last = track?.clips[track.clips.length - 1]
    this.placeAsset(assetId, last ? clipEnd(last) : 0, track?.id)
  }

  addText(
    preset: Partial<TextProps> & { name?: string; y?: number } = {},
    at = this.transport.time,
  ): string | undefined {
    const seq = this.seq
    const videos = seq.tracks.filter((t) => t.kind === 'video' && !t.locked)
    if (!videos.length) return undefined
    const duration = secondsToTicks(4)
    const start = floorToFrame(at, this.store.project.settings.fps)
    // Top-most video track with room, else a new track on top.
    let track = [...videos]
      .reverse()
      .find((t) => !t.clips.some((c) => c.start < start + duration && clipEnd(c) > start))
    const cmds: Command[] = []
    if (!track) {
      cmds.push({ type: 'addTrack', kind: 'video' })
    }
    const { name, y, ...text } = preset
    const clip = createClip({
      kind: 'text',
      name: name ?? 'Text',
      start,
      duration,
      text: { ...DEFAULT_TEXT, ...text },
      transform: { x: 0, y: y ?? 0, scale: 1, rotation: 0, opacity: 1 },
    })
    if (!track) {
      this.exec(cmds)
      const vids = this.seq.tracks.filter((t) => t.kind === 'video')
      track = vids[vids.length - 1]!
      this.store.breakMerge()
    }
    this.exec({ type: 'addClips', placements: [{ trackId: track.id, clip }] }, 'Add text')
    this.ui.selection = [clip.id]
    return clip.id
  }

  // ── editing helpers bound to shortcuts ──────────────────────────────────────────────────────

  splitAtPlayhead(): void {
    const t = floorToFrame(this.transport.time, this.store.project.settings.fps)
    const sel = this.ui.selection.filter((id) => {
      const c = findClip(this.seq, id)?.clip
      return c && c.start < t && clipEnd(c) > t
    })
    this.exec({ type: 'splitAt', t, clipIds: sel.length ? sel : undefined })
  }

  deleteSelection(ripple: boolean): void {
    if (!this.ui.selection.length) return
    this.exec({ type: 'deleteClips', clipIds: [...this.ui.selection], ripple })
    this.ui.selection = []
  }

  addMarker(): void {
    const t = floorToFrame(this.transport.time, this.store.project.settings.fps)
    const n = this.seq.markers.length + 1
    this.exec({
      type: 'addMarker',
      marker: { id: newId('mrk'), t, label: `Marker ${n}`, color: '#E0A100' },
    })
  }

  setIn(): void {
    this.exec({
      type: 'setInOut',
      inPoint: floorToFrame(this.transport.time, this.store.project.settings.fps),
    })
  }

  setOut(): void {
    this.exec({
      type: 'setInOut',
      outPoint: floorToFrame(this.transport.time, this.store.project.settings.fps),
    })
  }

  clearInOut(): void {
    this.exec({ type: 'setInOut', inPoint: null, outPoint: null })
  }

  undo(): void {
    this.store.undo()
  }

  redo(): void {
    this.store.redo()
  }

  setQuality(q: PreviewQuality): void {
    this.ui.quality = q
    this.render.setQuality(q)
  }

  toggleLoop(): void {
    this.ui.loop = !this.ui.loop
    this.transport.setLoop(this.ui.loop)
  }

  duration(): Ticks {
    return sequenceDuration(this.seq)
  }

  /** Files for export: originals only (never proxies). */
  exportFiles(): Record<string, Blob> {
    const out: Record<string, Blob> = {}
    for (const id of Object.keys(this.store.project.assets)) {
      const f = this.sources.get(id)
      if (f) out[id] = f
    }
    return out
  }

  async startExport(o: ExportOptions): Promise<void> {
    void this.autosave.flush()
    const offline = Object.values(this.store.project.assets).filter(
      (a) => !this.sources.get(a.id),
    ).length
    if (offline)
      this.toast({
        title: 'Some media is offline',
        body: `${offline} offline file(s) will render as empty. Relink them first for a complete export.`,
        severity: 'warning',
      })
    if (this.transport.playing) this.transport.pause()
    await this.exporter.start(this.store.project, this.exportFiles(), o)
  }

  /** Release memory under pressure: caches are rebuildable. */
  trimMemory(): void {
    this.media.trim()
    void this.render.api.trim()
    this.error(new KaatError('OUT_OF_MEMORY'))
  }
}

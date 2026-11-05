/**
 * Project model. Pure data: no UI or browser objects, so it serializes, diffs and migrates cleanly.
 *
 * Project
 *  ├── settings
 *  ├── assets
 *  └── sequences
 *       ├── tracks → clips (timing, transform, effects, animation)
 *       └── markers
 */
import type { Rational, Ticks } from './time'

export const SCHEMA_VERSION = 1

export type AssetKind = 'video' | 'audio' | 'image'
/**
 * - `probing`: placeholder shown immediately on drop; metadata on its way.
 * - `ready`: playable.
 * - `missing`: source file not reachable (moved, deleted, or permission lost). Edits are kept.
 * - `error`: the file could not be read or decoded.
 */
export type AssetStatus = 'probing' | 'ready' | 'missing' | 'error'

export type ProxyStatus = 'none' | 'recommended' | 'building' | 'ready' | 'error'

export interface Asset {
  id: string
  kind: AssetKind
  name: string
  /** File identity, used to relink a missing source. */
  size: number
  lastModified: number
  mime: string
  status: AssetStatus
  error?: string
  /** Media duration. 0 for images (they stretch to any length). */
  duration: Ticks
  width: number
  height: number
  fps?: Rational
  hasVideo: boolean
  hasAudio: boolean
  sampleRate?: number
  channels?: number
  videoCodec?: string
  audioCodec?: string
  /** Lower-cost editing copy in OPFS. Export always reads the original. */
  proxy?: { status: ProxyStatus; path?: string; progress?: number }
}

export type TrackKind = 'video' | 'audio'

export interface Track {
  id: string
  kind: TrackKind
  name: string
  muted: boolean
  solo: boolean
  locked: boolean
  /** Video: hide the layer. */
  hidden: boolean
  /** Track gain in dB (audio tracks). */
  gainDb: number
  /** Sorted by `start`, never overlapping. */
  clips: Clip[]
}

export type ClipKind = 'media' | 'text'

export type Interpolation = 'linear' | 'hold'

export interface Keyframe {
  /** Clip-local time (ticks from clip start). */
  t: Ticks
  v: number
  interp: Interpolation
}

export type AnimatableProp = 'x' | 'y' | 'scale' | 'rotation' | 'opacity'
export const ANIMATABLE_PROPS: readonly AnimatableProp[] = [
  'x',
  'y',
  'scale',
  'rotation',
  'opacity',
]

export interface Transform {
  /** Offset of the layer centre from the canvas centre, in project pixels. */
  x: number
  y: number
  /** 1 = media fitted (contain) into the canvas. */
  scale: number
  /** Degrees, clockwise. */
  rotation: number
  /** 0–1. */
  opacity: number
}

/** Fractions (0–1) cropped from each edge of the source. */
export interface Crop {
  left: number
  top: number
  right: number
  bottom: number
}

export interface ColorEffect {
  id: string
  type: 'color'
  enabled: boolean
  /** -1..1 */
  brightness: number
  /** -1..1 */
  contrast: number
  /** -1..1 */
  saturation: number
}

export interface BlurEffect {
  id: string
  type: 'blur'
  enabled: boolean
  /** Radius in project pixels, 0–100. */
  radius: number
}

export type Effect = ColorEffect | BlurEffect
export type EffectType = Effect['type']

export type TransitionType = 'dissolve' | 'slide' | 'wipe' | 'fadeColor'
export const TRANSITION_TYPES: readonly TransitionType[] = [
  'dissolve',
  'slide',
  'wipe',
  'fadeColor',
]

/**
 * A transition at the head of a clip. Over `[clip.start, clip.start + duration)` the previous
 * adjacent clip on the same track keeps playing (into its source handle, or held on its last frame)
 * and blends into this one. With no adjacent clip it transitions from transparent.
 */
export interface Transition {
  type: TransitionType
  duration: Ticks
  /** fadeColor only. */
  color?: string
}

export type TextAlign = 'left' | 'center' | 'right'

export interface TextProps {
  content: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  align: TextAlign
  color: string
}

export interface ClipAudio {
  gainDb: number
  fadeIn: Ticks
  fadeOut: Ticks
}

export interface Clip {
  id: string
  kind: ClipKind
  name: string
  assetId?: string
  /** Timeline start. */
  start: Ticks
  duration: Ticks
  /** Source time shown at `start` (media clips). */
  sourceIn: Ticks
  /** Clips sharing a linkId move, trim, split and delete together (a video and its audio). */
  linkId?: string
  transform: Transform
  crop: Crop
  keyframes: Partial<Record<AnimatableProp, Keyframe[]>>
  effects: Effect[]
  audio: ClipAudio
  text?: TextProps
  transitionIn?: Transition
}

export interface Marker {
  id: string
  t: Ticks
  label: string
  color: string
}

export interface Sequence {
  id: string
  name: string
  /** Video tracks first (index 0 = bottom layer), then audio tracks. */
  tracks: Track[]
  markers: Marker[]
  inPoint?: Ticks
  outPoint?: Ticks
}

export interface ProjectSettings {
  width: number
  height: number
  fps: Rational
  sampleRate: number
  background: string
  /** Master output level in dB. */
  masterGainDb: number
}

export interface Project {
  schemaVersion: number
  id: string
  name: string
  createdAt: number
  updatedAt: number
  settings: ProjectSettings
  assets: Record<string, Asset>
  sequences: Sequence[]
  activeSequenceId: string
}

let idCounter = 0
/** Short, collision-resistant id: `prefix_` + time + counter + random. */
export function newId(prefix: string): string {
  idCounter = (idCounter + 1) % 1_679_616
  const rand = Math.floor(Math.random() * 0xffffffff).toString(36)
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${rand}`
}

export const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
export const DEFAULT_CROP: Crop = { left: 0, top: 0, right: 0, bottom: 0 }
export const DEFAULT_AUDIO: ClipAudio = { gainDb: 0, fadeIn: 0, fadeOut: 0 }
export const DEFAULT_TEXT: TextProps = {
  content: 'Title',
  fontFamily: 'Quicksand',
  fontSize: 120,
  fontWeight: 700,
  align: 'center',
  color: '#ffffff',
}

export function createTrack(kind: TrackKind, name: string): Track {
  return {
    id: newId('trk'),
    kind,
    name,
    muted: false,
    solo: false,
    locked: false,
    hidden: false,
    gainDb: 0,
    clips: [],
  }
}

export function createClip(
  partial: Partial<Clip> & Pick<Clip, 'kind' | 'start' | 'duration'>,
): Clip {
  return {
    id: newId('clp'),
    name: partial.kind === 'text' ? 'Text' : 'Clip',
    sourceIn: 0,
    transform: { ...DEFAULT_TRANSFORM },
    crop: { ...DEFAULT_CROP },
    keyframes: {},
    effects: [],
    audio: { ...DEFAULT_AUDIO },
    ...partial,
  }
}

export function createProject(
  name = 'Untitled project',
  settings?: Partial<ProjectSettings>,
): Project {
  const seq: Sequence = {
    id: newId('seq'),
    name: 'Sequence 1',
    tracks: [
      createTrack('video', 'V1'),
      createTrack('video', 'V2'),
      createTrack('audio', 'A1'),
      createTrack('audio', 'A2'),
    ],
    markers: [],
  }
  const now = Date.now()
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId('prj'),
    name,
    createdAt: now,
    updatedAt: now,
    settings: {
      width: 1920,
      height: 1080,
      fps: { num: 30, den: 1 },
      sampleRate: 48000,
      background: '#000000',
      masterGainDb: 0,
      ...settings,
    },
    assets: {},
    sequences: [seq],
    activeSequenceId: seq.id,
  }
}

export function activeSequence(p: Project): Sequence {
  const s = p.sequences.find((q) => q.id === p.activeSequenceId) ?? p.sequences[0]
  if (!s) throw new Error('Project has no sequence')
  return s
}

export function clipEnd(c: Clip): Ticks {
  return c.start + c.duration
}

/** End of the last clip on any track. O(tracks). */
export function sequenceDuration(seq: Sequence): Ticks {
  let end = 0
  for (const tr of seq.tracks) {
    const last = tr.clips[tr.clips.length - 1]
    if (last) end = Math.max(end, clipEnd(last))
  }
  return end
}

export interface ClipLocation {
  track: Track
  trackIndex: number
  clip: Clip
  clipIndex: number
}

export function findClip(seq: Sequence, clipId: string): ClipLocation | undefined {
  for (let ti = 0; ti < seq.tracks.length; ti++) {
    const track = seq.tracks[ti]!
    const ci = track.clips.findIndex((c) => c.id === clipId)
    if (ci >= 0) return { track, trackIndex: ti, clip: track.clips[ci]!, clipIndex: ci }
  }
  return undefined
}

/** Index of the first clip whose end is after `t` (binary search over sorted clips). */
export function firstClipEndingAfter(clips: readonly Clip[], t: Ticks): number {
  let lo = 0
  let hi = clips.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (clipEnd(clips[mid]!) <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Clips overlapping `[from, to)`, in order. O(log n + k). */
export function clipsInRange(clips: readonly Clip[], from: Ticks, to: Ticks): Clip[] {
  const out: Clip[] = []
  for (let i = firstClipEndingAfter(clips, from); i < clips.length; i++) {
    const c = clips[i]!
    if (c.start >= to) break
    out.push(c)
  }
  return out
}

/** The clip covering `t`, if any. O(log n). */
export function clipAt(clips: readonly Clip[], t: Ticks): Clip | undefined {
  const c = clips[firstClipEndingAfter(clips, t)]
  return c && c.start <= t ? c : undefined
}

/** Longest source span a clip can show: unlimited for images and text. */
export function maxSourceDuration(clip: Clip, assets: Record<string, Asset>): Ticks {
  if (clip.kind === 'text' || !clip.assetId) return Number.POSITIVE_INFINITY
  const a = assets[clip.assetId]
  if (!a || a.kind === 'image' || a.duration <= 0) return Number.POSITIVE_INFINITY
  return a.duration
}

export function videoTracks(seq: Sequence): Track[] {
  return seq.tracks.filter((t) => t.kind === 'video')
}

export function audioTracks(seq: Sequence): Track[] {
  return seq.tracks.filter((t) => t.kind === 'audio')
}

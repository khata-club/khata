/**
 * Command-based editing. Every edit is a serializable `Command` applied by the pure function
 * {@link applyCommand}. The store keeps the snapshot before and after each command, so undo and
 * redo are exact and cheap: snapshots share structure, and only the touched track's clip array and
 * the touched clips are copied.
 */
import { upsertKeyframe } from './animation'
import { placeClip, splitClip, trimLimits, withEnd, withStart } from './clipOps'
import {
  type AnimatableProp,
  type Asset,
  type Clip,
  type ClipAudio,
  type Crop,
  type Effect,
  type Interpolation,
  type Marker,
  type Project,
  type ProjectSettings,
  type Sequence,
  type TextProps,
  type Track,
  type TrackKind,
  type Transform,
  type Transition,
  activeSequence,
  clipEnd,
  createTrack,
  newId,
} from './model'
import { type Ticks, ticksPerFrame } from './time'

export interface ClipPatch {
  name?: string
  transform?: Partial<Transform>
  crop?: Partial<Crop>
  audio?: Partial<ClipAudio>
  text?: Partial<TextProps>
}

export type TrackPatch = Partial<
  Pick<Track, 'name' | 'muted' | 'solo' | 'locked' | 'hidden' | 'gainDb'>
>

export type Command =
  | { type: 'addAssets'; assets: Asset[] }
  | { type: 'updateAsset'; id: string; patch: Partial<Asset> }
  | { type: 'removeAsset'; id: string }
  | { type: 'addClips'; placements: { trackId: string; clip: Clip }[] }
  | { type: 'moveClips'; clipIds: string[]; delta: Ticks; trackOffset?: number }
  | { type: 'trimClip'; clipId: string; edge: 'start' | 'end'; delta: Ticks }
  | { type: 'splitAt'; t: Ticks; clipIds?: string[] }
  | { type: 'deleteClips'; clipIds: string[]; ripple: boolean }
  | { type: 'setClipProps'; clipId: string; patch: ClipPatch }
  | {
      type: 'setKeyframe'
      clipId: string
      prop: AnimatableProp
      t: Ticks
      v: number
      interp?: Interpolation
    }
  | { type: 'removeKeyframe'; clipId: string; prop: AnimatableProp; t: Ticks }
  | { type: 'clearKeyframes'; clipId: string; prop: AnimatableProp }
  | { type: 'addEffect'; clipId: string; effect: Effect }
  | { type: 'updateEffect'; clipId: string; effectId: string; patch: Partial<Effect> }
  | { type: 'removeEffect'; clipId: string; effectId: string }
  | { type: 'setTransition'; clipId: string; transition: Transition | null }
  | { type: 'addTrack'; kind: TrackKind }
  | { type: 'removeTrack'; trackId: string }
  | { type: 'updateTrack'; trackId: string; patch: TrackPatch }
  | { type: 'addMarker'; marker: Marker }
  | { type: 'updateMarker'; id: string; patch: Partial<Omit<Marker, 'id'>> }
  | { type: 'removeMarker'; id: string }
  | { type: 'setInOut'; inPoint?: Ticks | null; outPoint?: Ticks | null }
  | { type: 'setSettings'; patch: Partial<ProjectSettings> }
  | { type: 'renameProject'; name: string }
  | { type: 'unlinkClips'; clipIds: string[] }
  | { type: 'linkClips'; clipIds: string[] }

export type CommandType = Command['type']

const LABELS: Record<CommandType, string> = {
  addAssets: 'Import media',
  updateAsset: 'Update media',
  removeAsset: 'Remove media',
  addClips: 'Add clip',
  moveClips: 'Move',
  trimClip: 'Trim',
  splitAt: 'Split',
  deleteClips: 'Delete',
  setClipProps: 'Change properties',
  setKeyframe: 'Set keyframe',
  removeKeyframe: 'Remove keyframe',
  clearKeyframes: 'Clear keyframes',
  addEffect: 'Add effect',
  updateEffect: 'Change effect',
  removeEffect: 'Remove effect',
  setTransition: 'Transition',
  addTrack: 'Add track',
  removeTrack: 'Remove track',
  updateTrack: 'Change track',
  addMarker: 'Add marker',
  updateMarker: 'Change marker',
  removeMarker: 'Remove marker',
  setInOut: 'Set in/out',
  setSettings: 'Project settings',
  renameProject: 'Rename project',
  unlinkClips: 'Unlink',
  linkClips: 'Link',
}

/** Human label for the undo/redo menu. */
export function commandLabel(c: Command): string {
  if (c.type === 'deleteClips' && c.ripple) return 'Ripple delete'
  return LABELS[c.type]
}

/**
 * Commands that merge into the previous history entry when issued in quick succession for the same
 * target (slider drags, nudges), so one gesture is one undo step.
 */
export function mergeKey(c: Command): string | undefined {
  switch (c.type) {
    case 'setClipProps':
      return `props:${c.clipId}:${patchShape(c.patch)}`
    case 'updateEffect':
      return `fx:${c.clipId}:${c.effectId}`
    case 'updateTrack':
      return `track:${c.trackId}:${Object.keys(c.patch).sort().join(',')}`
    case 'setKeyframe':
      return `kf:${c.clipId}:${c.prop}:${c.t}`
    case 'setSettings':
      return 'settings'
    default:
      return undefined
  }
}

function patchShape(p: ClipPatch): string {
  return Object.entries(p)
    .map(([k, v]) => (v && typeof v === 'object' ? `${k}.${Object.keys(v).sort().join('.')}` : k))
    .sort()
    .join(',')
}

/** Bookkeeping commands (background metadata) don't create undo entries. */
export function isSilent(c: Command): boolean {
  return c.type === 'updateAsset'
}

// ─── helpers ──────────────────────────────────────────────────────────────────────────────────────

function withSequence(p: Project, fn: (seq: Sequence) => Sequence): Project {
  const seq = activeSequence(p)
  const next = fn(seq)
  if (next === seq) return p
  return { ...p, sequences: p.sequences.map((s) => (s.id === seq.id ? next : s)) }
}

function mapTracks(seq: Sequence, fn: (t: Track, i: number) => Track): Sequence {
  let changed = false
  const tracks = seq.tracks.map((t, i) => {
    const n = fn(t, i)
    if (n !== t) changed = true
    return n
  })
  return changed ? { ...seq, tracks } : seq
}

function updateClip(p: Project, clipId: string, fn: (c: Clip) => Clip): Project {
  return withSequence(p, (seq) =>
    mapTracks(seq, (t) => {
      const i = t.clips.findIndex((c) => c.id === clipId)
      if (i < 0 || t.locked) return t
      const next = fn(t.clips[i]!)
      if (next === t.clips[i]) return t
      const clips = t.clips.slice()
      clips[i] = next
      return { ...t, clips }
    }),
  )
}

/** Selection plus every clip linked to it, minus clips on locked tracks. */
export function expandLinked(seq: Sequence, clipIds: Iterable<string>): Set<string> {
  const ids = new Set(clipIds)
  const links = new Set<string>()
  for (const t of seq.tracks)
    for (const c of t.clips) if (ids.has(c.id) && c.linkId) links.add(c.linkId)
  if (links.size)
    for (const t of seq.tracks)
      for (const c of t.clips) if (c.linkId && links.has(c.linkId)) ids.add(c.id)
  for (const t of seq.tracks) if (t.locked) for (const c of t.clips) ids.delete(c.id)
  return ids
}

export function minClipDuration(p: Project): Ticks {
  return Math.round(ticksPerFrame(p.settings.fps))
}

// ─── apply ────────────────────────────────────────────────────────────────────────────────────────

/** Apply a command. Returns the same object when the command is a no-op. */
export function applyCommand(p: Project, c: Command): Project {
  const next = applyInner(p, c)
  return next === p ? p : { ...next, updatedAt: Date.now() }
}

function applyInner(p: Project, c: Command): Project {
  switch (c.type) {
    case 'addAssets': {
      if (!c.assets.length) return p
      const assets = { ...p.assets }
      for (const a of c.assets) assets[a.id] = a
      return { ...p, assets }
    }
    case 'updateAsset': {
      const a = p.assets[c.id]
      if (!a) return p
      return { ...p, assets: { ...p.assets, [c.id]: { ...a, ...c.patch, id: a.id } } }
    }
    case 'removeAsset': {
      if (!p.assets[c.id]) return p
      const assets = { ...p.assets }
      delete assets[c.id]
      return withSequence({ ...p, assets }, (seq) =>
        mapTracks(seq, (t) =>
          t.clips.some((x) => x.assetId === c.id)
            ? { ...t, clips: t.clips.filter((x) => x.assetId !== c.id) }
            : t,
        ),
      )
    }
    case 'addClips':
      return withSequence(p, (seq) =>
        mapTracks(seq, (t) => {
          const mine = c.placements.filter((pl) => pl.trackId === t.id)
          if (!mine.length || t.locked) return t
          let clips: Clip[] = t.clips
          for (const pl of mine) {
            const clip = { ...pl.clip, start: Math.max(0, pl.clip.start) }
            if (clip.duration > 0) clips = placeClip(clips, clip)
          }
          return { ...t, clips }
        }),
      )
    case 'moveClips':
      return moveClips(p, c.clipIds, c.delta, c.trackOffset ?? 0)
    case 'trimClip':
      return trimClip(p, c.clipId, c.edge, c.delta)
    case 'splitAt':
      return splitAt(p, c.t, c.clipIds)
    case 'deleteClips':
      return deleteClips(p, c.clipIds, c.ripple)
    case 'setClipProps':
      return updateClip(p, c.clipId, (clip) => {
        const n: Clip = { ...clip }
        if (c.patch.name !== undefined) n.name = c.patch.name
        if (c.patch.transform) n.transform = { ...clip.transform, ...c.patch.transform }
        if (c.patch.crop) n.crop = { ...clip.crop, ...c.patch.crop }
        if (c.patch.audio) {
          const a = { ...clip.audio, ...c.patch.audio }
          a.fadeIn = Math.max(0, Math.min(a.fadeIn, clip.duration))
          a.fadeOut = Math.max(0, Math.min(a.fadeOut, clip.duration - a.fadeIn))
          n.audio = a
        }
        if (c.patch.text && clip.text) n.text = { ...clip.text, ...c.patch.text }
        return n
      })
    case 'setKeyframe':
      return updateClip(p, c.clipId, (clip) => ({
        ...clip,
        keyframes: {
          ...clip.keyframes,
          [c.prop]: upsertKeyframe(clip.keyframes[c.prop], c.t, c.v, c.interp),
        },
      }))
    case 'removeKeyframe':
      return updateClip(p, c.clipId, (clip) => {
        const list = clip.keyframes[c.prop]
        if (!list || !list.some((k) => k.t === c.t)) return clip
        const remaining = list.filter((k) => k.t !== c.t)
        const keyframes = { ...clip.keyframes }
        let transform = clip.transform
        if (remaining.length) keyframes[c.prop] = remaining
        else {
          delete keyframes[c.prop]
          // The removed keyframe's value becomes the static value, so nothing jumps.
          transform = { ...clip.transform, [c.prop]: list[0]!.v }
        }
        return { ...clip, keyframes, transform }
      })
    case 'clearKeyframes':
      return updateClip(p, c.clipId, (clip) => {
        if (!clip.keyframes[c.prop]) return clip
        const keyframes = { ...clip.keyframes }
        delete keyframes[c.prop]
        return { ...clip, keyframes }
      })
    case 'addEffect':
      return updateClip(p, c.clipId, (clip) =>
        clip.kind === 'media' || clip.kind === 'text'
          ? { ...clip, effects: [...clip.effects, c.effect] }
          : clip,
      )
    case 'updateEffect':
      return updateClip(p, c.clipId, (clip) => ({
        ...clip,
        effects: clip.effects.map((e) =>
          e.id === c.effectId ? ({ ...e, ...c.patch, id: e.id, type: e.type } as Effect) : e,
        ),
      }))
    case 'removeEffect':
      return updateClip(p, c.clipId, (clip) => ({
        ...clip,
        effects: clip.effects.filter((e) => e.id !== c.effectId),
      }))
    case 'setTransition':
      return updateClip(p, c.clipId, (clip) => {
        const n = { ...clip }
        if (c.transition)
          n.transitionIn = {
            ...c.transition,
            duration: Math.max(1, Math.min(c.transition.duration, clip.duration)),
          }
        else delete n.transitionIn
        return n
      })
    case 'addTrack':
      return withSequence(p, (seq) => {
        const count = seq.tracks.filter((t) => t.kind === c.kind).length
        const track = createTrack(c.kind, `${c.kind === 'video' ? 'V' : 'A'}${count + 1}`)
        const tracks = seq.tracks.slice()
        // Video tracks stay grouped before audio tracks; a new video track goes on top.
        if (c.kind === 'video')
          tracks.splice(seq.tracks.map((t) => t.kind).lastIndexOf('video') + 1, 0, track)
        else tracks.push(track)
        return { ...seq, tracks }
      })
    case 'removeTrack':
      return withSequence(p, (seq) => {
        const t = seq.tracks.find((x) => x.id === c.trackId)
        if (!t || seq.tracks.filter((x) => x.kind === t.kind).length <= 1) return seq
        return { ...seq, tracks: seq.tracks.filter((x) => x.id !== c.trackId) }
      })
    case 'updateTrack':
      return withSequence(p, (seq) =>
        mapTracks(seq, (t) => (t.id === c.trackId ? { ...t, ...c.patch } : t)),
      )
    case 'addMarker':
      return withSequence(p, (seq) => ({
        ...seq,
        markers: [...seq.markers, c.marker].sort((a, b) => a.t - b.t),
      }))
    case 'updateMarker':
      return withSequence(p, (seq) => ({
        ...seq,
        markers: seq.markers
          .map((m) => (m.id === c.id ? { ...m, ...c.patch } : m))
          .sort((a, b) => a.t - b.t),
      }))
    case 'removeMarker':
      return withSequence(p, (seq) =>
        seq.markers.some((m) => m.id === c.id)
          ? { ...seq, markers: seq.markers.filter((m) => m.id !== c.id) }
          : seq,
      )
    case 'setInOut':
      return withSequence(p, (seq) => {
        const n = { ...seq }
        if (c.inPoint === null) delete n.inPoint
        else if (c.inPoint !== undefined) n.inPoint = Math.max(0, c.inPoint)
        if (c.outPoint === null) delete n.outPoint
        else if (c.outPoint !== undefined) n.outPoint = Math.max(0, c.outPoint)
        if (n.inPoint !== undefined && n.outPoint !== undefined && n.outPoint <= n.inPoint) {
          // Keep a valid range: the point being set wins.
          if (c.inPoint !== undefined && c.inPoint !== null) delete n.outPoint
          else delete n.inPoint
        }
        return n
      })
    case 'setSettings':
      return { ...p, settings: { ...p.settings, ...c.patch } }
    case 'renameProject':
      return c.name === p.name ? p : { ...p, name: c.name }
    case 'unlinkClips': {
      const seq = activeSequence(p)
      const ids = new Set(c.clipIds)
      const links = new Set<string>()
      for (const t of seq.tracks)
        for (const x of t.clips) if (ids.has(x.id) && x.linkId) links.add(x.linkId)
      if (!links.size) return p
      return withSequence(p, (s) =>
        mapTracks(s, (t) =>
          t.clips.some((x) => x.linkId && links.has(x.linkId))
            ? {
                ...t,
                clips: t.clips.map((x) => {
                  if (!x.linkId || !links.has(x.linkId)) return x
                  const n = { ...x }
                  delete n.linkId
                  return n
                }),
              }
            : t,
        ),
      )
    }
    case 'linkClips': {
      if (c.clipIds.length < 2) return p
      const ids = new Set(c.clipIds)
      const linkId = newId('lnk')
      return withSequence(p, (seq) =>
        mapTracks(seq, (t) =>
          t.clips.some((x) => ids.has(x.id))
            ? { ...t, clips: t.clips.map((x) => (ids.has(x.id) ? { ...x, linkId } : x)) }
            : t,
        ),
      )
    }
  }
}

/**
 * Move clips (and their linked partners) by `delta`. `trackOffset` moves the primary selection up
 * or down among tracks of the same kind; linked partners keep their tracks. Overwrites whatever is
 * at the destination.
 */
function moveClips(p: Project, clipIds: string[], delta: Ticks, trackOffset: number): Project {
  const seq = activeSequence(p)
  const ids = expandLinked(seq, clipIds)
  if (!ids.size) return p
  const primary = new Set(clipIds)

  let minStart = Number.POSITIVE_INFINITY
  for (const t of seq.tracks)
    for (const c of t.clips) if (ids.has(c.id)) minStart = Math.min(minStart, c.start)
  const d = Math.max(delta, -minStart)

  const byKind: Record<TrackKind, number[]> = { video: [], audio: [] }
  seq.tracks.forEach((t, i) => byKind[t.kind].push(i))

  let changesTrack = false
  const moving: { target: number; clip: Clip }[] = []
  const stripped = seq.tracks.map((t, ti) => {
    if (!t.clips.some((c) => ids.has(c.id))) return t
    const keep: Clip[] = []
    for (const c of t.clips) {
      if (!ids.has(c.id)) {
        keep.push(c)
        continue
      }
      let target = ti
      if (trackOffset && primary.has(c.id)) {
        const list = byKind[t.kind]
        const pos = list.indexOf(ti)
        const candidate = list[Math.max(0, Math.min(list.length - 1, pos + trackOffset))]!
        if (!seq.tracks[candidate]!.locked) target = candidate
      }
      if (target !== ti) changesTrack = true
      moving.push({ target, clip: d ? { ...c, start: c.start + d } : c })
    }
    return { ...t, clips: keep }
  })
  if (d === 0 && !changesTrack) return p
  // Place in start order so a group never overwrites itself.
  moving.sort((a, b) => a.clip.start - b.clip.start)
  const tracks = stripped.map((t, ti) => {
    const mine = moving.filter((m) => m.target === ti)
    if (!mine.length) return t
    let clips: Clip[] = t.clips
    for (const m of mine) clips = placeClip(clips, m.clip)
    return { ...t, clips }
  })
  return withSequence(p, (s) => ({ ...s, tracks }))
}

/** Trim one edge by `delta`, clamped so every linked clip stays valid and in sync. */
function trimClip(p: Project, clipId: string, edge: 'start' | 'end', delta: Ticks): Project {
  const seq = activeSequence(p)
  const ids = expandLinked(seq, [clipId])
  if (!ids.size) return p
  const minDur = minClipDuration(p)
  let lo = Number.NEGATIVE_INFINITY
  let hi = Number.POSITIVE_INFINITY
  for (const t of seq.tracks)
    for (const c of t.clips)
      if (ids.has(c.id)) {
        const lim = trimLimits(t, c, edge, p.assets, minDur)
        lo = Math.max(lo, lim.min)
        hi = Math.min(hi, lim.max)
      }
  if (lo > hi) return p
  const d = Math.max(lo, Math.min(hi, delta))
  if (d === 0) return p
  return withSequence(p, (s) =>
    mapTracks(s, (t) => {
      if (!t.clips.some((c) => ids.has(c.id))) return t
      return {
        ...t,
        clips: t.clips.map((c) =>
          ids.has(c.id)
            ? edge === 'start'
              ? withStart(c, c.start + d)
              : withEnd(c, clipEnd(c) + d)
            : c,
        ),
      }
    }),
  )
}

/**
 * Split at `t`. With `clipIds`, only those clips (and linked partners); otherwise every clip under
 * `t` on unlocked tracks. Right halves of a linked group stay linked to each other.
 */
function splitAt(p: Project, t: Ticks, clipIds?: string[]): Project {
  const seq = activeSequence(p)
  const target = clipIds?.length ? expandLinked(seq, clipIds) : undefined
  const newLinks = new Map<string, string>()
  return withSequence(p, (s) =>
    mapTracks(s, (track) => {
      if (track.locked) return track
      const i = track.clips.findIndex((c) => c.start < t && clipEnd(c) > t)
      if (i < 0) return track
      const c = track.clips[i]!
      if (target && !target.has(c.id)) return track
      let rightLink: string | undefined
      if (c.linkId) {
        rightLink = newLinks.get(c.linkId) ?? newId('lnk')
        newLinks.set(c.linkId, rightLink)
      }
      const [left, right] = splitClip(c, t, rightLink)
      const clips = track.clips.slice()
      clips.splice(i, 1, left, right)
      return { ...track, clips }
    }),
  )
}

/** Delete clips (and linked partners). Ripple closes the gaps on each affected track. */
function deleteClips(p: Project, clipIds: string[], ripple: boolean): Project {
  const seq = activeSequence(p)
  const ids = expandLinked(seq, clipIds)
  if (!ids.size) return p
  return withSequence(p, (s) =>
    mapTracks(s, (t) => {
      if (!t.clips.some((c) => ids.has(c.id))) return t
      if (!ripple) return { ...t, clips: t.clips.filter((c) => !ids.has(c.id)) }
      const out: Clip[] = []
      let shift = 0
      for (const c of t.clips) {
        if (ids.has(c.id)) {
          shift += c.duration
          continue
        }
        out.push(shift ? { ...c, start: c.start - shift } : c)
      }
      return { ...t, clips: out }
    }),
  )
}

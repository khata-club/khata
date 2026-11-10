/**
 * Synthetic benchmark projects (spec §42). Assets are placeholders with no source file, so these
 * exercise the timeline, model, autosave and memory paths at scale without needing media.
 */
import {
  type Asset,
  type Clip,
  type Project,
  activeSequence,
  createClip,
  createProject,
  createTrack,
  newId,
} from './model'
import { secondsToTicks } from './time'

export type BenchmarkId = 'A' | 'B' | 'C' | 'D' | 'E'

export const BENCHMARKS: Record<BenchmarkId, { name: string; description: string }> = {
  A: { name: 'Basic', description: '3 × 1080p clips, 1 audio track, text, a transition' },
  B: { name: 'Heavy 1080p', description: '100 clips, 3 audio tracks, overlays, text, effects' },
  C: { name: '4K', description: '4K sources, 3 visual layers, text, colour, transitions' },
  D: { name: 'Large timeline', description: '1,200 clips across 6 tracks' },
  E: { name: 'Long form', description: '120-minute sequence' },
}

/** Deterministic PRNG so benchmark projects are identical across runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function fakeAsset(i: number, kind: Asset['kind'], seconds: number, w: number, h: number): Asset {
  return {
    id: newId('ast'),
    kind,
    name: `${kind}-${String(i).padStart(4, '0')}.${kind === 'audio' ? 'wav' : kind === 'image' ? 'png' : 'mp4'}`,
    size: 0,
    lastModified: 0,
    mime: '',
    status: 'missing',
    duration: kind === 'image' ? 0 : secondsToTicks(seconds),
    width: kind === 'audio' ? 0 : w,
    height: kind === 'audio' ? 0 : h,
    fps: { num: 30, den: 1 },
    hasVideo: kind !== 'audio',
    hasAudio: kind !== 'image',
    sampleRate: 48000,
    channels: 2,
  }
}

interface Spec {
  videoTracks: number
  audioTracks: number
  clipsPerTrack: number
  clipSeconds: [number, number]
  width: number
  height: number
  text: number
  effects: boolean
  transitions: boolean
}

const SPECS: Record<BenchmarkId, Spec> = {
  A: {
    videoTracks: 1,
    audioTracks: 1,
    clipsPerTrack: 3,
    clipSeconds: [8, 12],
    width: 1920,
    height: 1080,
    text: 1,
    effects: false,
    transitions: true,
  },
  B: {
    videoTracks: 2,
    audioTracks: 3,
    clipsPerTrack: 50,
    clipSeconds: [2, 6],
    width: 1920,
    height: 1080,
    text: 10,
    effects: true,
    transitions: true,
  },
  C: {
    videoTracks: 3,
    audioTracks: 1,
    clipsPerTrack: 8,
    clipSeconds: [5, 10],
    width: 3840,
    height: 2160,
    text: 2,
    effects: true,
    transitions: true,
  },
  D: {
    videoTracks: 3,
    audioTracks: 3,
    clipsPerTrack: 200,
    clipSeconds: [1, 4],
    width: 1920,
    height: 1080,
    text: 0,
    effects: false,
    transitions: false,
  },
  E: {
    videoTracks: 2,
    audioTracks: 2,
    clipsPerTrack: 240,
    clipSeconds: [28, 32],
    width: 1920,
    height: 1080,
    text: 20,
    effects: false,
    transitions: true,
  },
}

export function generateBenchmarkProject(id: BenchmarkId, seed = 42): Project {
  const spec = SPECS[id]
  const rnd = mulberry32(seed)
  const p = createProject(`Benchmark ${id} — ${BENCHMARKS[id].name}`, {
    width: spec.width,
    height: spec.height,
  })
  const seq = activeSequence(p)
  seq.tracks = []
  for (let i = 0; i < spec.videoTracks; i++) seq.tracks.push(createTrack('video', `V${i + 1}`))
  for (let i = 0; i < spec.audioTracks; i++) seq.tracks.push(createTrack('audio', `A${i + 1}`))
  const assets: Record<string, Asset> = {}
  let n = 0
  for (const track of seq.tracks) {
    let t = 0
    const clips: Clip[] = []
    for (let i = 0; i < spec.clipsPerTrack; i++) {
      const [lo, hi] = spec.clipSeconds
      const seconds = lo + rnd() * (hi - lo)
      const kind = track.kind === 'audio' ? 'audio' : 'video'
      const asset = fakeAsset(n++, kind, seconds + 2, spec.width, spec.height)
      assets[asset.id] = asset
      const clip = createClip({
        kind: 'media',
        name: asset.name,
        assetId: asset.id,
        start: t,
        duration: secondsToTicks(Math.floor(seconds * 30) / 30),
        sourceIn: secondsToTicks(1),
      })
      if (spec.effects && rnd() < 0.3)
        clip.effects.push({
          id: newId('fx'),
          type: 'color',
          enabled: true,
          brightness: 0.05,
          contrast: 0.1,
          saturation: 0.2,
        })
      if (spec.transitions && i > 0 && rnd() < 0.25)
        clip.transitionIn = { type: 'dissolve', duration: secondsToTicks(0.5) }
      if (track.kind === 'video' && seq.tracks.indexOf(track) > 0)
        clip.transform = { ...clip.transform, scale: 0.4, x: 500, y: -250 }
      clips.push(clip)
      t += clip.duration
    }
    track.clips = clips
  }
  // Text overlays on the top video track, spaced across the sequence.
  if (spec.text) {
    const top = seq.tracks.filter((t) => t.kind === 'video').pop()!
    const total = top.clips.length
      ? top.clips[top.clips.length - 1]!.start + top.clips[top.clips.length - 1]!.duration
      : secondsToTicks(30)
    const textTrack = createTrack('video', `V${spec.videoTracks + 1}`)
    for (let i = 0; i < spec.text; i++) {
      textTrack.clips.push(
        createClip({
          kind: 'text',
          name: `Title ${i + 1}`,
          start: Math.floor((total / spec.text) * i),
          duration: secondsToTicks(3),
          text: {
            content: `Title ${i + 1}`,
            fontFamily: 'Quicksand',
            fontSize: 96,
            fontWeight: 700,
            align: 'center',
            color: '#ffffff',
          },
          keyframes: {
            opacity: [
              { t: 0, v: 0, interp: 'linear' },
              { t: secondsToTicks(0.5), v: 1, interp: 'linear' },
            ],
          },
        }),
      )
    }
    seq.tracks.splice(spec.videoTracks, 0, textTrack)
  }
  p.assets = assets
  return p
}

export function countClips(p: Project): number {
  return activeSequence(p).tracks.reduce((n, t) => n + t.clips.length, 0)
}

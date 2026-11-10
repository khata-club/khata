import { describe, expect, it } from 'vitest'

import { countClips, generateBenchmarkProject } from './bench'
import { LruCache } from './cache'
import { audioSegmentsInRange, clipGainAt, dbToGain, mixBlock } from './mix'
import { type Asset, activeSequence, createClip, createProject } from './model'
import { resolveFrame } from './resolve'
import { PriorityScheduler, Priority, TaskCancelledError } from './scheduler'
import { checksum, parseProject, serializeProject } from './serialize'
import { SnapIndex } from './snapping'
import { secondsToTicks as s } from './time'

const asset = (id: string, patch: Partial<Asset> = {}): Asset => ({
  id,
  kind: 'video',
  name: id,
  size: 1,
  lastModified: 1,
  mime: 'video/mp4',
  status: 'ready',
  duration: s(10),
  width: 1920,
  height: 1080,
  fps: { num: 30, den: 1 },
  hasVideo: true,
  hasAudio: true,
  sampleRate: 48000,
  channels: 2,
  ...patch,
})

describe('snapping', () => {
  it('finds the nearest point within threshold', () => {
    const idx = new SnapIndex([
      { t: 100, kind: 'clip' },
      { t: 200, kind: 'marker' },
    ])
    expect(idx.nearest(195, 10)?.t).toBe(200)
    expect(idx.nearest(150, 10)).toBeUndefined()
    expect(idx.snapSpan(92, 50, 10)).toMatchObject({ start: 100 })
    expect(idx.snapSpan(145, 50, 10)).toMatchObject({ start: 150 })
  })

  it('indexes clip edges, markers, in/out and playhead', () => {
    const p = createProject()
    const seq = activeSequence(p)
    seq.tracks[0]!.clips = [createClip({ id: 'x', kind: 'media', start: 10, duration: 20 })]
    seq.markers = [{ id: 'm', t: 50, label: '', color: '' }]
    seq.inPoint = 60
    expect(SnapIndex.fromSequence(seq, { playhead: 70 }).size).toBe(6)
    expect(SnapIndex.fromSequence(seq, { excludeClipIds: new Set(['x']) }).size).toBe(3)
  })
})

describe('resolveFrame', () => {
  function project() {
    const p = createProject()
    p.assets = {
      a: asset('a'),
      b: asset('b'),
      i: asset('i', { kind: 'image', duration: 0, hasAudio: false }),
    }
    const seq = activeSequence(p)
    seq.tracks[0]!.clips = [
      createClip({
        id: 'A',
        kind: 'media',
        assetId: 'a',
        start: 0,
        duration: s(4),
        sourceIn: s(1),
      }),
      createClip({
        id: 'B',
        kind: 'media',
        assetId: 'b',
        start: s(4),
        duration: s(4),
        transitionIn: { type: 'dissolve', duration: s(1) },
      }),
    ]
    seq.tracks[1]!.clips = [
      createClip({
        id: 'T',
        kind: 'text',
        start: s(1),
        duration: s(2),
        text: {
          content: 'Hi',
          fontFamily: 'Quicksand',
          fontSize: 50,
          fontWeight: 700,
          align: 'center',
          color: '#fff',
        },
        keyframes: {
          x: [
            { t: 0, v: 0, interp: 'linear' },
            { t: s(2), v: 100, interp: 'linear' },
          ],
        },
      }),
    ]
    return p
  }

  it('orders layers bottom to top and maps source time', () => {
    const f = resolveFrame(project(), s(2))
    expect(f.layers.map((l) => l.clipId)).toEqual(['A', 'T'])
    expect(f.layers[0]!.sourceTime).toBe(s(3))
    expect(f.layers[1]!.transform.x).toBeCloseTo(50)
  })

  it('blends a dissolve using the outgoing clip handle', () => {
    const f = resolveFrame(project(), s(4.5))
    expect(f.layers.map((l) => l.key)).toEqual(['A:out', 'B'])
    expect(f.layers[0]!.sourceTime).toBe(s(5.5))
    expect(f.layers[1]!.transform.opacity).toBeCloseTo(0.5)
    expect(resolveFrame(project(), s(5)).layers.map((l) => l.key)).toEqual(['B'])
  })

  it('holds the last frame when a handle runs past the source', () => {
    const p = project()
    activeSequence(p).tracks[0]!.clips[0]!.sourceIn = s(6) // 6 + 4 = 10 = end of source
    const f = resolveFrame(p, s(4.9))
    expect(f.layers[0]!.sourceTime).toBeLessThan(s(10))
  })

  it('skips hidden tracks and missing assets', () => {
    const p = project()
    activeSequence(p).tracks[1]!.hidden = true
    expect(resolveFrame(p, s(2)).layers).toHaveLength(1)
    delete p.assets.a
    expect(resolveFrame(p, s(2)).layers).toHaveLength(0)
  })

  it('is identical for the same project and time (preview = export)', () => {
    const p = project()
    expect(resolveFrame(p, s(4.25))).toEqual(resolveFrame(p, s(4.25)))
  })

  it('produces each transition shape', () => {
    const p = project()
    const B = activeSequence(p).tracks[0]!.clips[1]!
    B.transitionIn = { type: 'slide', duration: s(1) }
    expect(resolveFrame(p, s(4.5)).layers.map((l) => l.offsetX)).toEqual([-960, 960])
    B.transitionIn = { type: 'wipe', duration: s(1) }
    expect(resolveFrame(p, s(4.25)).layers[1]!.reveal).toBeCloseTo(0.25)
    B.transitionIn = { type: 'fadeColor', duration: s(1), color: '#ffffff' }
    const early = resolveFrame(p, s(4.25)).layers
    expect(early.map((l) => [l.key, l.tint])).toEqual([['A:out', 0.5]])
    const late = resolveFrame(p, s(4.75)).layers
    expect(late.map((l) => [l.key, l.tint])).toEqual([['B', 0.5]])
  })
})

describe('audio mix', () => {
  function project() {
    const p = createProject()
    p.assets = { a: asset('a') }
    const seq = activeSequence(p)
    seq.tracks[2]!.clips = [
      createClip({
        id: 'X',
        kind: 'media',
        assetId: 'a',
        start: 0,
        duration: s(2),
        audio: { gainDb: -6, fadeIn: s(1), fadeOut: 0 },
      }),
    ]
    return p
  }

  it('applies clip, track and master gain plus fades', () => {
    const p = project()
    const seq = activeSequence(p)
    const tr = seq.tracks[2]!
    const c = tr.clips[0]!
    expect(clipGainAt(p, seq, tr, c, s(0.5))).toBeCloseTo(dbToGain(-6) * 0.5)
    expect(clipGainAt(p, seq, tr, c, s(1.5))).toBeCloseTo(dbToGain(-6))
  })

  it('honours mute and solo', () => {
    const p = project()
    const seq = activeSequence(p)
    seq.tracks[3]!.solo = true
    expect(audioSegmentsInRange(p, 0, s(2))).toHaveLength(0)
    seq.tracks[3]!.solo = false
    seq.tracks[2]!.muted = true
    expect(audioSegmentsInRange(p, 0, s(2))).toHaveLength(0)
  })

  it('mixes and resamples a block deterministically', () => {
    const p = project()
    const segs = audioSegmentsInRange(p, s(1), s(1.01))
    expect(segs).toHaveLength(1)
    const src = new Float32Array(44100 * 3).fill(0.5)
    const sources = new Map([['X', { sampleRate: 44100, startSeconds: 0, channels: [src] }]])
    const run = () => {
      const out = [new Float32Array(480), new Float32Array(480)]
      mixBlock(p, s(1), 48000, out, segs, sources)
      return out
    }
    const a = run()
    expect(a[0]![10]).toBeCloseTo(0.5 * dbToGain(-6), 4)
    expect(a[1]![10]).toBeCloseTo(a[0]![10]!, 6)
    expect(run()).toEqual(a)
  })
})

describe('serialization', () => {
  it('round-trips a project', () => {
    const p = generateBenchmarkProject('B')
    const back = parseProject(serializeProject(p))
    expect(back).toEqual(p)
  })

  it('migrates a version 0 project', () => {
    const p = createProject()
    const legacy: Record<string, unknown> = { ...p, schemaVersion: 0, sequence: p.sequences[0] }
    delete legacy.sequences
    delete legacy.activeSequenceId
    delete (legacy.settings as Record<string, unknown>).masterGainDb
    const m = parseProject(JSON.stringify(legacy))
    expect(m.schemaVersion).toBe(1)
    expect(m.sequences).toHaveLength(1)
    expect(m.settings.masterGainDb).toBe(0)
  })

  it('rejects bad input clearly', () => {
    expect(() => parseProject('nope')).toThrow(/valid JSON/)
    expect(() => parseProject(JSON.stringify({ schemaVersion: 99 }))).toThrow(/newer version/)
    expect(() => parseProject(JSON.stringify({ schemaVersion: 1, id: 'x' }))).toThrow(
      /Invalid project/,
    )
  })

  it('checksums detect changes', () => {
    expect(checksum('abc')).toBe(checksum('abc'))
    expect(checksum('abc')).not.toBe(checksum('abd'))
  })
})

describe('LruCache', () => {
  it('evicts least recently used entries past the byte budget', () => {
    const evicted: string[] = []
    const c = new LruCache<string, number>(10, (k) => evicted.push(k))
    c.set('a', 1, 4)
    c.set('b', 2, 4)
    c.get('a')
    c.set('c', 3, 4)
    expect(evicted).toEqual(['b'])
    expect(c.usedBytes).toBe(8)
    c.set('huge', 4, 100)
    expect(c.has('huge')).toBe(false)
    expect(c.stats().hits).toBe(1)
    c.clear()
    expect(c.usedBytes).toBe(0)
  })

  it('stays bounded under many inserts', () => {
    const c = new LruCache<number, number>(1000)
    for (let i = 0; i < 100_000; i++) c.set(i, i, 10)
    expect(c.size).toBe(100)
  })
})

describe('PriorityScheduler', () => {
  const defer = () => {
    let resolve!: () => void
    const promise = new Promise<void>((r) => (resolve = r))
    return { promise, resolve }
  }

  it('runs higher priority first and dedupes keys', async () => {
    const sch = new PriorityScheduler(1)
    const gate = defer()
    const order: string[] = []
    sch.schedule({ key: 'block', priority: Priority.CRITICAL }, () => gate.promise)
    sch.schedule({ key: 'idle', priority: Priority.IDLE }, async () => void order.push('idle'))
    sch.schedule({ key: 'high', priority: Priority.HIGH }, async () => void order.push('high'))
    const dup = sch.schedule(
      { key: 'low', priority: Priority.LOW },
      async () => void order.push('low'),
    )
    const dup2 = sch.schedule(
      { key: 'low', priority: Priority.MEDIUM },
      async () => void order.push('low2'),
    )
    expect(dup2).toBe(dup)
    gate.resolve()
    await sch.idle()
    expect(order).toEqual(['high', 'low', 'idle'])
  })

  it('cancels queued and running tasks via AbortSignal', async () => {
    const sch = new PriorityScheduler(1)
    let sawAbort = false
    const running = sch.schedule(
      { key: 'r', priority: Priority.LOW, group: 'g' },
      (signal) =>
        new Promise((_, rej) =>
          signal.addEventListener('abort', () => ((sawAbort = true), rej(new Error('x')))),
        ),
    )
    const queued = sch.schedule({ key: 'q', priority: Priority.LOW, group: 'g' }, async () => 1)
    sch.cancelGroup('g')
    await expect(queued).rejects.toBeInstanceOf(TaskCancelledError)
    await expect(running).rejects.toBeInstanceOf(TaskCancelledError)
    expect(sawAbort).toBe(true)
  })

  it('holds back low-priority work while paused', async () => {
    const sch = new PriorityScheduler(2)
    let ran = false
    sch.pauseBelow(Priority.HIGH)
    const t = sch.schedule({ key: 'bg', priority: Priority.IDLE }, async () => void (ran = true))
    await Promise.resolve()
    expect(ran).toBe(false)
    sch.pauseBelow(null)
    await t
    expect(ran).toBe(true)
  })
})

describe('benchmarks', () => {
  it('generates the large timeline with 1,200 clips and valid tracks', () => {
    const p = generateBenchmarkProject('D')
    expect(countClips(p)).toBe(1200)
    for (const t of activeSequence(p).tracks)
      for (let i = 1; i < t.clips.length; i++)
        expect(t.clips[i]!.start).toBeGreaterThanOrEqual(
          t.clips[i - 1]!.start + t.clips[i - 1]!.duration,
        )
  })

  it('generates a 120-minute long-form sequence', () => {
    const p = generateBenchmarkProject('E')
    const end = Math.max(
      ...activeSequence(p).tracks.map(
        (t) => (t.clips.at(-1)?.start ?? 0) + (t.clips.at(-1)?.duration ?? 0),
      ),
    )
    expect(end).toBeGreaterThan(s(110 * 60))
  })

  it('resolves frames quickly on a 1,200 clip timeline', () => {
    const p = generateBenchmarkProject('D')
    const t0 = performance.now()
    for (let i = 0; i < 10_000; i++) resolveFrame(p, (i * 7919) % s(600))
    expect((performance.now() - t0) / 10_000).toBeLessThan(0.1) // < 0.1 ms per frame
  })
})

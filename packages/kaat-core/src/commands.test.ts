import { describe, expect, it } from 'vitest'

import { type Command } from './commands'
import { type Asset, type Project, activeSequence, createClip, createProject } from './model'
import { ProjectStore } from './store'
import { secondsToTicks as s, ticksPerFrame } from './time'

function videoAsset(id: string, seconds: number): Asset {
  return {
    id,
    kind: 'video',
    name: `${id}.mp4`,
    size: 1,
    lastModified: 1,
    mime: 'video/mp4',
    status: 'ready',
    duration: s(seconds),
    width: 1920,
    height: 1080,
    fps: { num: 30, den: 1 },
    hasVideo: true,
    hasAudio: true,
  }
}

function setup(): { store: ProjectStore; v1: string; v2: string; a1: string } {
  const p = createProject()
  const seq = activeSequence(p)
  const [v1, v2, a1] = [seq.tracks[0]!.id, seq.tracks[1]!.id, seq.tracks[2]!.id]
  const store = new ProjectStore(p)
  store.dispatch({ type: 'addAssets', assets: [videoAsset('a', 10), videoAsset('b', 10)] })
  return { store, v1, v2, a1 }
}

function clipsOn(p: Project, trackId: string) {
  return activeSequence(p).tracks.find((t) => t.id === trackId)!.clips
}

function addLinked(
  store: ProjectStore,
  v: string,
  a: string,
  start: number,
  dur: number,
  id = 'c',
) {
  store.dispatch({
    type: 'addClips',
    placements: [
      {
        trackId: v,
        clip: createClip({
          id: `${id}v`,
          kind: 'media',
          assetId: 'a',
          start,
          duration: dur,
          linkId: id,
        }),
      },
      {
        trackId: a,
        clip: createClip({
          id: `${id}a`,
          kind: 'media',
          assetId: 'a',
          start,
          duration: dur,
          linkId: id,
        }),
      },
    ],
  })
}

describe('commands', () => {
  it('adds clips sorted and overwrites what is underneath', () => {
    const { store, v1 } = setup()
    store.dispatch({
      type: 'addClips',
      placements: [
        {
          trackId: v1,
          clip: createClip({ id: 'x', kind: 'media', assetId: 'a', start: s(0), duration: s(10) }),
        },
      ],
    })
    store.dispatch({
      type: 'addClips',
      placements: [
        {
          trackId: v1,
          clip: createClip({ id: 'y', kind: 'media', assetId: 'b', start: s(4), duration: s(2) }),
        },
      ],
    })
    const clips = clipsOn(store.project, v1)
    expect(clips.map((c) => [c.start, c.duration])).toEqual([
      [s(0), s(4)],
      [s(4), s(2)],
      [s(6), s(4)],
    ])
    // The right fragment continues the source where it was cut.
    expect(clips[2]!.sourceIn).toBe(s(6))
  })

  it('splits linked clips together and keeps the halves linked', () => {
    const { store, v1, a1 } = setup()
    addLinked(store, v1, a1, 0, s(10))
    store.dispatch({ type: 'splitAt', t: s(3), clipIds: ['cv'] })
    const v = clipsOn(store.project, v1)
    const a = clipsOn(store.project, a1)
    expect(v).toHaveLength(2)
    expect(a).toHaveLength(2)
    expect(v[1]!.sourceIn).toBe(s(3))
    expect(v[1]!.linkId).toBeDefined()
    expect(v[1]!.linkId).toBe(a[1]!.linkId)
    expect(v[1]!.linkId).not.toBe(v[0]!.linkId)
  })

  it('trims start and end within source and neighbour limits', () => {
    const { store, v1, a1 } = setup()
    addLinked(store, v1, a1, s(2), s(6))
    // Can't extend the head before source 0 → clamps to 0 source handle (sourceIn is 0).
    store.dispatch({ type: 'trimClip', clipId: 'cv', edge: 'start', delta: -s(5) })
    expect(clipsOn(store.project, v1)[0]!.start).toBe(s(2))
    store.dispatch({ type: 'trimClip', clipId: 'cv', edge: 'start', delta: s(1) })
    const c = clipsOn(store.project, v1)[0]!
    expect([c.start, c.duration, c.sourceIn]).toEqual([s(3), s(5), s(1)])
    // Linked audio trimmed identically.
    const a = clipsOn(store.project, a1)[0]!
    expect([a.start, a.duration, a.sourceIn]).toEqual([s(3), s(5), s(1)])
    // End can extend only until the source runs out (10 s source, sourceIn 1 → 9 s max).
    store.dispatch({ type: 'trimClip', clipId: 'cv', edge: 'end', delta: s(100) })
    expect(clipsOn(store.project, v1)[0]!.duration).toBe(s(9))
    // Minimum duration is one frame.
    store.dispatch({ type: 'trimClip', clipId: 'cv', edge: 'end', delta: -s(100) })
    expect(clipsOn(store.project, v1)[0]!.duration).toBe(ticksPerFrame({ num: 30, den: 1 }))
  })

  it('stops trims at the neighbouring clip', () => {
    const { store, v1 } = setup()
    store.dispatch({
      type: 'addClips',
      placements: [
        {
          trackId: v1,
          clip: createClip({
            id: 'l',
            kind: 'media',
            assetId: 'a',
            start: 0,
            duration: s(2),
            sourceIn: s(2),
          }),
        },
        {
          trackId: v1,
          clip: createClip({
            id: 'r',
            kind: 'media',
            assetId: 'b',
            start: s(3),
            duration: s(2),
            sourceIn: s(2),
          }),
        },
      ],
    })
    store.dispatch({ type: 'trimClip', clipId: 'r', edge: 'start', delta: -s(2) })
    expect(clipsOn(store.project, v1)[1]!.start).toBe(s(2))
    store.dispatch({ type: 'trimClip', clipId: 'l', edge: 'end', delta: s(5) })
    expect(clipsOn(store.project, v1)[0]!.duration).toBe(s(2))
  })

  it('ripple deletes, closing the gap on affected tracks only', () => {
    const { store, v1, v2 } = setup()
    store.dispatch({
      type: 'addClips',
      placements: [
        {
          trackId: v1,
          clip: createClip({ id: 'a1', kind: 'media', assetId: 'a', start: 0, duration: s(2) }),
        },
        {
          trackId: v1,
          clip: createClip({ id: 'a2', kind: 'media', assetId: 'a', start: s(2), duration: s(3) }),
        },
        {
          trackId: v1,
          clip: createClip({ id: 'a3', kind: 'media', assetId: 'a', start: s(5), duration: s(1) }),
        },
        {
          trackId: v2,
          clip: createClip({ id: 'b1', kind: 'media', assetId: 'b', start: s(6), duration: s(1) }),
        },
      ],
    })
    store.dispatch({ type: 'deleteClips', clipIds: ['a2'], ripple: true })
    expect(clipsOn(store.project, v1).map((c) => [c.id, c.start])).toEqual([
      ['a1', 0],
      ['a3', s(2)],
    ])
    expect(clipsOn(store.project, v2)[0]!.start).toBe(s(6))
    store.dispatch({ type: 'deleteClips', clipIds: ['a1'], ripple: false })
    expect(clipsOn(store.project, v1).map((c) => c.start)).toEqual([s(2)])
  })

  it('moves linked clips together, across tracks, never below 0', () => {
    const { store, v1, v2, a1 } = setup()
    addLinked(store, v1, a1, s(1), s(2))
    store.dispatch({ type: 'moveClips', clipIds: ['cv'], delta: s(3), trackOffset: 1 })
    expect(clipsOn(store.project, v1)).toHaveLength(0)
    expect(clipsOn(store.project, v2)[0]!.start).toBe(s(4))
    expect(clipsOn(store.project, a1)[0]!.start).toBe(s(4))
    store.dispatch({ type: 'moveClips', clipIds: ['cv'], delta: -s(100) })
    expect(clipsOn(store.project, v2)[0]!.start).toBe(0)
  })

  it('keeps edits on locked tracks untouched', () => {
    const { store, v1 } = setup()
    store.dispatch({
      type: 'addClips',
      placements: [
        {
          trackId: v1,
          clip: createClip({ id: 'x', kind: 'media', assetId: 'a', start: 0, duration: s(4) }),
        },
      ],
    })
    store.dispatch({ type: 'updateTrack', trackId: v1, patch: { locked: true } })
    store.dispatch({ type: 'splitAt', t: s(2) })
    store.dispatch({ type: 'deleteClips', clipIds: ['x'], ripple: true })
    expect(clipsOn(store.project, v1)).toHaveLength(1)
  })

  it('undoes and redoes exactly, and merges slider drags into one step', () => {
    const { store, v1 } = setup()
    store.dispatch({
      type: 'addClips',
      placements: [
        {
          trackId: v1,
          clip: createClip({ id: 'x', kind: 'media', assetId: 'a', start: 0, duration: s(4) }),
        },
      ],
    })
    const base = store.project
    for (let i = 1; i <= 10; i++)
      store.dispatch({
        type: 'setClipProps',
        clipId: 'x',
        patch: { transform: { scale: 1 + i / 10 } },
      })
    store.breakMerge()
    store.dispatch({ type: 'splitAt', t: s(1) })
    const after = store.project
    expect(store.undo()).toBe(true)
    expect(clipsOn(store.project, v1)[0]!.transform.scale).toBe(2)
    expect(store.undo()).toBe(true)
    expect(activeSequence(store.project)).toBe(activeSequence(base))
    expect(store.redo()).toBe(true)
    expect(store.redo()).toBe(true)
    expect(activeSequence(store.project)).toBe(activeSequence(after))
    expect(store.redo()).toBe(false)
  })

  it('keeps background asset updates through undo', () => {
    const { store, v1 } = setup()
    store.dispatch({
      type: 'addClips',
      placements: [
        {
          trackId: v1,
          clip: createClip({ kind: 'media', assetId: 'a', start: 0, duration: s(1) }),
        },
      ],
    })
    store.dispatch({ type: 'updateAsset', id: 'a', patch: { width: 1280 } })
    store.undo()
    expect(store.project.assets.a!.width).toBe(1280)
    expect(store.canRedo()).toBe(true)
  })

  it('preserves animation across split', () => {
    const { store, v1 } = setup()
    store.dispatch({
      type: 'addClips',
      placements: [
        {
          trackId: v1,
          clip: createClip({ id: 'x', kind: 'media', assetId: 'a', start: 0, duration: s(4) }),
        },
      ],
    })
    store.dispatch({ type: 'setKeyframe', clipId: 'x', prop: 'opacity', t: 0, v: 0 })
    store.dispatch({ type: 'setKeyframe', clipId: 'x', prop: 'opacity', t: s(4), v: 1 })
    store.dispatch({ type: 'splitAt', t: s(1) })
    const [l, r] = clipsOn(store.project, v1)
    expect(l!.keyframes.opacity!.at(-1)!.v).toBeCloseTo(0.25)
    expect(r!.keyframes.opacity![0]!).toEqual({ t: 0, v: 0.25, interp: 'linear' })
  })

  it('removing the last keyframe keeps its value as the static value', () => {
    const { store, v1 } = setup()
    store.dispatch({
      type: 'addClips',
      placements: [
        {
          trackId: v1,
          clip: createClip({ id: 'x', kind: 'media', assetId: 'a', start: 0, duration: s(4) }),
        },
      ],
    })
    store.dispatch({ type: 'setKeyframe', clipId: 'x', prop: 'rotation', t: 0, v: 45 })
    store.dispatch({ type: 'removeKeyframe', clipId: 'x', prop: 'rotation', t: 0 })
    const c = clipsOn(store.project, v1)[0]!
    expect(c.keyframes.rotation).toBeUndefined()
    expect(c.transform.rotation).toBe(45)
  })

  it('handles tracks, markers, in/out, transitions and effects', () => {
    const { store, v1 } = setup()
    const cmds: Command[] = [
      { type: 'addTrack', kind: 'video' },
      { type: 'addTrack', kind: 'audio' },
      { type: 'addMarker', marker: { id: 'm2', t: s(5), label: 'B', color: '#f00' } },
      { type: 'addMarker', marker: { id: 'm1', t: s(1), label: 'A', color: '#f00' } },
      { type: 'setInOut', inPoint: s(1), outPoint: s(3) },
      {
        type: 'addClips',
        placements: [
          {
            trackId: v1,
            clip: createClip({ id: 'x', kind: 'media', assetId: 'a', start: 0, duration: s(2) }),
          },
        ],
      },
      { type: 'setTransition', clipId: 'x', transition: { type: 'wipe', duration: s(5) } },
      {
        type: 'addEffect',
        clipId: 'x',
        effect: { id: 'fx', type: 'blur', enabled: true, radius: 4 },
      },
      { type: 'updateEffect', clipId: 'x', effectId: 'fx', patch: { radius: 8 } },
    ]
    for (const c of cmds) store.dispatch(c)
    const seq = activeSequence(store.project)
    expect(seq.tracks.map((t) => t.kind)).toEqual([
      'video',
      'video',
      'video',
      'audio',
      'audio',
      'audio',
    ])
    expect(seq.markers.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect([seq.inPoint, seq.outPoint]).toEqual([s(1), s(3)])
    const clip = seq.tracks[0]!.clips[0]!
    expect(clip.transitionIn!.duration).toBe(s(2))
    expect(clip.effects[0]).toMatchObject({ radius: 8 })
    store.dispatch({ type: 'setInOut', inPoint: s(4) })
    expect(activeSequence(store.project).outPoint).toBeUndefined()
  })

  it('treats no-op commands as no change', () => {
    const { store } = setup()
    const v = store.version
    expect(store.dispatch({ type: 'deleteClips', clipIds: ['nope'], ripple: true })).toBe(false)
    expect(store.version).toBe(v)
  })
})

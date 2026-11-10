/* eslint-disable @typescript-eslint/no-explicit-any -- page.evaluate bodies drive untyped in-page globals (window.kaat, kaatTimeline, kaatTelemetry). */
/**
 * Performance benchmarks (spec §41–42). Run with `pnpm --filter @khata/kaat bench`.
 * Writes docs/kaat/benchmarks.json; BENCHMARKS.md summarises a run.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

import { TPS, fx, importFiles, kaat, openEditor } from './helpers'

const OUT = fileURLToPath(new URL('../../../docs/kaat/benchmarks.json', import.meta.url))
const results: Record<string, unknown> = {}
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!
const p95 = (a: number[]) =>
  [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * 0.95))]!
const round = (n: number) => Math.round(n * 10) / 10

test.afterAll(() => {
  writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), ...results }, null, 2) + '\n')
})

test('startup and import', async ({ page }) => {
  // Cold-ish: first load. Warm: second load (HTTP/SW cache).
  const t0 = Date.now()
  await openEditor(page)
  const cold = Date.now() - t0
  const t1 = Date.now()
  await page.reload()
  await page.waitForFunction(
    () => (window as unknown as { kaat: { ui: { engineReady: boolean } } }).kaat.ui.engineReady,
  )
  const warm = Date.now() - t1
  const visible: number[] = []
  const ready: number[] = []
  for (let i = 0; i < 3; i++) {
    await kaat(page, 'k.newProject()')
    await page.waitForTimeout(300)
    const s = Date.now()
    await page.setInputFiles('[data-testid=file-input]', [fx('clip-a.webm')])
    await page.locator('[data-asset="clip-a.webm"]').waitFor()
    visible.push(Date.now() - s)
    await expect(page.locator('[data-asset="clip-a.webm"]')).toHaveAttribute('data-status', 'ready')
    ready.push(Date.now() - s)
  }
  results.startup = { coldMs: cold, warmMs: warm }
  results.import = { visibleMedianMs: median(visible), metadataMedianMs: median(ready) }
})

test('seek, scrub, playback and memory (Benchmark A-like project)', async ({ page }) => {
  await openEditor(page)
  await importFiles(page, ['clip-a.webm', 'clip-b.webm', 'tone.wav'])
  await page.dblclick('[data-asset="clip-a.webm"]')
  await page.dblclick('[data-asset="clip-b.webm"]')
  await kaat(
    page,
    `k.addText({ content: 'Bench', fontSize: 120 }, ${TPS}); const b = k.store.project.sequences[0].tracks[0].clips[1]; k.exec({ type: 'setTransition', clipId: b.id, transition: { type: 'dissolve', duration: ${TPS} } })`,
  )
  await page.waitForTimeout(1000)
  // Random seeks, one at a time: request → frame presented.
  const seek = await page.evaluate(async (TPS) => {
    const k = (window as unknown as { kaat: any }).kaat
    const lat: number[] = []
    let x = 12345
    const rnd = () => (x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    for (let i = 0; i < 120; i++) {
      const t = Math.floor(rnd() * 7.9 * 30) * (TPS / 30)
      const s = performance.now()
      await new Promise<void>((res) => {
        const off = k.render.on('frame', (f: { t: number }) => {
          if (f.t === t) {
            off()
            res()
          }
        })
        k.transport.seek(t)
      })
      lat.push(performance.now() - s)
    }
    return lat
  }, TPS)
  // Scrub: 400 seeks at ~60 Hz; then check memory/textures stay bounded.
  const scrub = await page.evaluate(async (TPS) => {
    const k = (window as unknown as { kaat: any }).kaat
    const heap = () =>
      (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
        ?.usedJSHeapSize ?? 0
    const frames: number[] = []
    const off = k.render.on('frame', () => frames.push(performance.now()))
    ;(window as unknown as { gc?: () => void }).gc?.()
    const before = heap()
    const textBefore = (await k.render.api.stats()).textureBytes
    for (let round = 0; round < 4; round++)
      for (let i = 0; i < 100; i++) {
        k.transport.seek(Math.floor((i / 100) * 7.9 * TPS), { scrub: true })
        await new Promise((r) => requestAnimationFrame(r))
      }
    await new Promise((r) => setTimeout(r, 1000))
    off()
    const after = heap()
    const stats = await k.render.api.stats()
    return {
      frames: frames.length,
      heapBeforeMB: before / 1048576,
      heapAfterMB: after / 1048576,
      textureMBBefore: textBefore / 1048576,
      textureMB: stats.textureBytes / 1048576,
      textureBudgetMB: stats.textureBudget / 1048576,
      readers: stats.readers,
    }
  }, TPS)
  // Playback 5 s.
  const play = await page.evaluate(async () => {
    const k = (window as unknown as { kaat: any }).kaat
    const tel = (window as unknown as { kaatTelemetry: any }).kaatTelemetry
    k.transport.seek(0)
    await new Promise((r) => setTimeout(r, 300))
    const dropped0 = tel.droppedFrames
    const presented0 = tel.presentedFrames
    k.transport.play(1)
    await new Promise((r) => setTimeout(r, 5000))
    const t = k.transport.time / 705_600_000
    k.transport.pause()
    return {
      fps: tel.fps(),
      presented: tel.presentedFrames - presented0,
      dropped: tel.droppedFrames - dropped0,
      clockSeconds: t,
      previewScale: tel.previewScale,
    }
  })
  results.seek = { medianMs: round(median(seek)), p95Ms: round(p95(seek)), samples: seek.length }
  results.scrub = Object.fromEntries(
    Object.entries(scrub).map(([k, v]) => [k, typeof v === 'number' ? round(v) : v]),
  )
  results.playback1080 = { ...play, fps: round(play.fps) }
  expect(scrub.textureMB).toBeLessThanOrEqual(scrub.textureBudgetMB)
})

test('Benchmark D: 1,200 clips (timeline)', async ({ page }) => {
  await openEditor(page)
  const loadMs = await page.evaluate(async () => {
    const s = performance.now()
    const w = window as unknown as { kaat: any; kaatBench: any }
    await w.kaat.open(w.kaatBench.generateBenchmarkProject('D'))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return performance.now() - s
  })
  const r = await page.evaluate(async () => {
    const v = (window as unknown as { kaatTimeline: any }).kaatTimeline
    const tel = (window as unknown as { kaatTelemetry: any }).kaatTelemetry
    const frame = () => new Promise((res) => requestAnimationFrame(res))
    const intervals: number[] = []
    let last = performance.now()
    tel.timelineDrawMs.clear()
    for (let i = 0; i < 120; i++) {
      v.scrollTo(i * 8)
      await frame()
      const now = performance.now()
      intervals.push(now - last)
      last = now
    }
    const scroll = tel.timelineDrawMs.percentile(95)
    tel.timelineDrawMs.clear()
    for (let i = 0; i < 60; i++) {
      v.setZoom(v.pps * (i % 20 < 10 ? 1.25 : 0.8))
      await frame()
    }
    const zoom = tel.timelineDrawMs.percentile(95)
    v.zoomToFit()
    await frame()
    tel.timelineDrawMs.clear()
    for (let i = 0; i < 20; i++) {
      v.invalidate()
      await frame()
    }
    const fitAll = tel.timelineDrawMs.percentile(95)
    const sorted = intervals.sort((a, b) => a - b)
    return {
      scrollDrawP95Ms: scroll,
      zoomDrawP95Ms: zoom,
      zoomedOutAll1200DrawP95Ms: fitAll,
      frameIntervalP95Ms: sorted[Math.floor(sorted.length * 0.95)],
    }
  })
  const edit = await page.evaluate(async () => {
    const k = (window as unknown as { kaat: any }).kaat
    const c = k.store.project.sequences[0].tracks[1].clips[150]
    const times: number[] = []
    for (const cmd of [
      { type: 'trimClip', clipId: c.id, edge: 'end', delta: -705_600_000 / 2 },
      { type: 'moveClips', clipIds: [c.id], delta: 705_600_000 },
      { type: 'splitAt', t: c.start + 705_600_000 / 4 },
      { type: 'deleteClips', clipIds: [c.id], ripple: true },
    ]) {
      const s = performance.now()
      k.exec(cmd)
      times.push(performance.now() - s)
    }
    const s = performance.now()
    k.undo()
    times.push(performance.now() - s)
    return Math.max(...times)
  })
  results.benchmarkD = Object.fromEntries(
    Object.entries({ openMs: loadMs, ...r, slowestEditCommandMs: edit }).map(([k, v]) => [
      k,
      round(v as number),
    ]),
  )
})

test('Benchmark E: 120-minute long-form (autosave, restore)', async ({ page }) => {
  await openEditor(page)
  await page.evaluate(async () => {
    const w = window as unknown as { kaat: any; kaatBench: any }
    await w.kaat.open(w.kaatBench.generateBenchmarkProject('E'))
  })
  const save = await page.evaluate(async () => {
    const k = (window as unknown as { kaat: any }).kaat
    const tel = (window as unknown as { kaatTelemetry: any }).kaatTelemetry
    tel.autosaveMs.clear()
    const longTasks: number[] = []
    const po = new PerformanceObserver((l) =>
      l.getEntries().forEach((e) => longTasks.push(e.duration)),
    )
    po.observe({ type: 'longtask', buffered: false })
    for (let i = 0; i < 5; i++) {
      const c = k.store.project.sequences[0].tracks[0].clips[i * 10]
      k.exec({ type: 'setClipProps', clipId: c.id, patch: { name: `edited ${i}` } })
      k.store.breakMerge()
      await k.autosave.flush()
    }
    po.disconnect()
    const json = JSON.stringify(k.store.project)
    return {
      serializeP95Ms: tel.autosaveMs.percentile(95),
      projectKB: json.length / 1024,
      longTasksOver50ms: longTasks.filter((d) => d > 50).length,
      duration: k.duration() / 705_600_000 / 60,
    }
  })
  const t0 = Date.now()
  await page.reload()
  await page.waitForFunction(() => {
    const k = (window as unknown as { kaat?: any }).kaat
    return (
      k?.ui.engineReady &&
      k.store.project.sequences[0].tracks.reduce((n: number, t: any) => n + t.clips.length, 0) > 900
    )
  })
  const restoreMs = Date.now() - t0
  results.benchmarkE = {
    minutes: round(save.duration),
    projectKB: round(save.projectKB),
    autosaveSerializeP95Ms: round(save.serializeP95Ms),
    longTasksOver50ms: save.longTasksOver50ms,
    reloadAndRestoreMs: restoreMs,
  }
})

test('export throughput (basic project, 8 s at 1280×720)', async ({ page }) => {
  await openEditor(page, '?downloadExports')
  await importFiles(page, ['clip-a.webm', 'clip-b.webm'])
  await page.dblclick('[data-asset="clip-a.webm"]')
  await page.dblclick('[data-asset="clip-b.webm"]')
  await kaat(page, `k.addText({ content: 'Export', fontSize: 120 }, ${TPS})`)
  await page.locator('[data-testid=export]').click()
  const dl = page.waitForEvent('download', { timeout: 300_000 })
  const s = Date.now()
  await page.locator('[data-testid=export-start]').click()
  await dl
  const ms = Date.now() - s
  results.export = {
    seconds: round(ms / 1000),
    framesPerSecond: round(240 / (ms / 1000)),
    realtimeFactor: round(8 / (ms / 1000)),
  }
})

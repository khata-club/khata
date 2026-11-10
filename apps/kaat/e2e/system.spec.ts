import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'

import {
  TPS,
  capture,
  importFiles,
  kaat,
  meanDiff,
  openEditor,
  readPng,
  trackClips,
} from './helpers'

const GOLDEN = fileURLToPath(new URL('./golden/', import.meta.url))

test('works offline once loaded (service worker)', async ({ page, context }) => {
  await openEditor(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // Reload once so the page is controlled, then cut the network.
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await context.setOffline(true)
  await page.reload()
  await page.waitForFunction(
    () => (window as unknown as { kaat?: { ui: { engineReady: boolean } } }).kaat?.ui.engineReady,
  )
  await importFiles(page, ['clip-a.webm'])
  await page.dblclick('[data-asset="clip-a.webm"]')
  expect((await trackClips(page))[0]![1]).toHaveLength(1)
  await expect(page.getByText('Offline', { exact: true })).toBeVisible()
  await context.setOffline(false)
})

test('media never leaves the device: no cross-origin or upload requests', async ({ page }) => {
  const requests: { url: string; method: string }[] = []
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method() }))
  await openEditor(page, '?downloadExports')
  const afterLoad = requests.length
  await importFiles(page, ['clip-a.webm', 'tone.wav'])
  await page.dblclick('[data-asset="clip-a.webm"]')
  await kaat(page, `k.transport.seek(${TPS}); k.splitAtPlayhead()`)
  await page.locator('[data-testid=play]').click()
  await page.waitForTimeout(500)
  await page.locator('[data-testid=play]').click()
  const download = page.waitForEvent('download', { timeout: 120_000 })
  await page.locator('[data-testid=export]').click()
  await page.locator('[data-testid=export-start]').click()
  await download
  const origin = new URL(page.url()).origin
  const offending = requests.filter((r) => {
    const u = new URL(r.url)
    const local = u.origin === origin || u.protocol === 'blob:' || u.protocol === 'data:'
    return !local || (r.method !== 'GET' && r.method !== 'HEAD')
  })
  expect(offending).toEqual([])
  // Editing made no requests other than (cached) app assets.
  const later = requests.slice(afterLoad).filter((r) => !r.url.startsWith('blob:'))
  for (const r of later) expect(r.method).toBe('GET')
})

/**
 * Visual regression: a fixed project rendered at fixed times must match golden images. Goldens are
 * created on the first run (commit them); set UPDATE_GOLDEN=1 to refresh after intended changes.
 */
test('visual regression: transform, text, effects, transitions, animation', async ({ page }) => {
  await openEditor(page)
  await importFiles(page, ['clip-a.webm', 'clip-b.webm', 'still.png'])
  await kaat(
    page,
    `
    const ids = Object.fromEntries(Object.values(k.store.project.assets).map((a) => [a.name, a.id]))
    const seq = k.store.project.sequences[0]
    const [v1, v2] = seq.tracks
    const S = ${TPS}
    const clip = (o) => ({ id: o.id, kind: o.kind ?? 'media', name: o.id, start: o.start, duration: o.duration, sourceIn: o.sourceIn ?? 0,
      assetId: o.assetId, transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, ...(o.transform ?? {}) },
      crop: { left: 0, top: 0, right: 0, bottom: 0, ...(o.crop ?? {}) }, keyframes: o.keyframes ?? {}, effects: o.effects ?? [],
      audio: { gainDb: 0, fadeIn: 0, fadeOut: 0 }, text: o.text, transitionIn: o.transitionIn })
    k.exec({ type: 'addClips', placements: [
      { trackId: v1.id, clip: clip({ id: 'A', assetId: ids['clip-a.webm'], start: 0, duration: 3 * S,
        effects: [{ id: 'c', type: 'color', enabled: true, brightness: 0.05, contrast: 0.2, saturation: -0.5 }] }) },
      { trackId: v1.id, clip: clip({ id: 'B', assetId: ids['clip-b.webm'], start: 3 * S, duration: 3 * S, transitionIn: { type: 'wipe', duration: S } }) },
      { trackId: v2.id, clip: clip({ id: 'P', assetId: ids['still.png'], start: 0, duration: 6 * S, crop: { left: 0.1, right: 0.1 },
        transform: { scale: 0.35, rotation: 12, x: 380, y: -180 },
        keyframes: { opacity: [{ t: 0, v: 0.2, interp: 'linear' }, { t: 2 * S, v: 1, interp: 'hold' }] },
        effects: [{ id: 'b', type: 'blur', enabled: true, radius: 6 }] }) },
    ]})
    k.exec({ type: 'addTrack', kind: 'video' })
    const v3 = k.store.project.sequences[0].tracks[2]
    k.exec({ type: 'addClips', placements: [{ trackId: v3.id, clip: clip({ id: 'T', kind: 'text', start: 0, duration: 6 * S,
      text: { content: 'Kaat\\nlocal-first', fontFamily: 'Quicksand', fontSize: 110, fontWeight: 700, align: 'center', color: '#ffffff' },
      transform: { y: 200 }, keyframes: { rotation: [{ t: 0, v: -5, interp: 'linear' }, { t: 6 * S, v: 5, interp: 'linear' }] } }) }] })
  `,
  )
  if (!existsSync(GOLDEN)) mkdirSync(GOLDEN, { recursive: true })
  const update = !!process.env.UPDATE_GOLDEN
  for (const t of [1, 3.5, 5]) {
    const png = await capture(page, t)
    const file = `${GOLDEN}composite-${t}.png`
    if (update || !existsSync(file)) {
      writeFileSync(file, PNG.sync.write(png))
      continue
    }
    const diff = meanDiff(png, readPng(file))
    expect(
      diff,
      `frame at ${t}s differs from golden (mean abs diff ${diff.toFixed(2)})`,
    ).toBeLessThan(2.5)
  }
  // Determinism: the same timestamp renders identically twice.
  expect(meanDiff(await capture(page, 3.5), await capture(page, 3.5))).toBeLessThan(0.01)
})

test('1,200-clip timeline loads, scrolls, zooms and edits', async ({ page }) => {
  await openEditor(page)
  await kaat(page, `await k.open(window.kaatBench.generateBenchmarkProject('D'))`)
  expect(
    await kaat(
      page,
      'return k.store.project.sequences[0].tracks.reduce((n, t) => n + t.clips.length, 0)',
    ),
  ).toBe(1200)
  const draw = await page.evaluate(async () => {
    const v = (
      window as unknown as {
        kaatTimeline: { scrollTo(s: number): void; setZoom(p: number): void; pps: number }
      }
    ).kaatTimeline
    const tel = (
      window as unknown as {
        kaatTelemetry: { timelineDrawMs: { clear(): void; percentile(p: number): number } }
      }
    ).kaatTelemetry
    tel.timelineDrawMs.clear()
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)))
    for (let i = 0; i < 60; i++) {
      v.scrollTo(i * 10)
      await frame()
    }
    for (let i = 0; i < 30; i++) {
      v.setZoom(v.pps * (i % 2 ? 1.3 : 0.77))
      await frame()
    }
    return tel.timelineDrawMs.percentile(95)
  })
  expect(draw).toBeLessThan(16)
  const first = await kaat<string>(
    page,
    'return k.store.project.sequences[0].tracks[0].clips[100].id',
  )
  await kaat(page, `k.exec({ type: 'deleteClips', clipIds: ['${first}'], ripple: true })`)
  expect(
    await kaat(
      page,
      'return k.store.project.sequences[0].tracks.reduce((n, t) => n + t.clips.length, 0)',
    ),
  ).toBe(1199)
})

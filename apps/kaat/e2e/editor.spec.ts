import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'

import {
  TPS,
  capture,
  fx,
  importFiles,
  kaat,
  meanLuma,
  openEditor,
  pixel,
  trackClips,
} from './helpers'

test.describe('media import', () => {
  test('assets appear immediately and become editable before derived work finishes', async ({
    page,
  }) => {
    await openEditor(page)
    const t0 = Date.now()
    await page.setInputFiles('[data-testid=file-input]', [
      fx('clip-a.webm'),
      fx('clip-b.webm'),
      fx('tone.wav'),
      fx('still.png'),
    ])
    await expect(page.locator('[data-asset="clip-a.webm"]')).toBeVisible()
    const visibleMs = Date.now() - t0
    await expect(page.locator('[data-asset="clip-a.webm"]')).toHaveAttribute('data-status', 'ready')
    const readyMs = Date.now() - t0
    // Spec §4.2: visible < 500 ms, metadata < 1 s (generous margins for CI noise).
    expect(visibleMs).toBeLessThan(500)
    expect(readyMs).toBeLessThan(1500)
    // Placement works right away, even while thumbnails/waveforms are still queued.
    await page.dblclick('[data-asset="clip-a.webm"]')
    const tracks = await trackClips(page)
    expect(tracks[0]![1]).toEqual([['clip-a.webm', 0, 4]])
    // Linked audio lands on A1.
    expect(tracks[2]![1]).toEqual([['clip-a.webm', 0, 4]])
    // Project adopts the first clip's format.
    expect(await kaat(page, 'return k.store.project.settings')).toMatchObject({
      width: 1280,
      height: 720,
      fps: { num: 30, den: 1 },
    })
  })

  test('unsupported files get a clear, categorised error', async ({ page }) => {
    await openEditor(page)
    await page.setInputFiles('[data-testid=file-input]', [fx('not-media.txt')])
    const toast = page.locator('[data-code=UNSUPPORTED_MEDIA]')
    await expect(toast).toBeVisible()
    await expect(toast).toContainText('project and edits are safe')
    await expect(toast).toContainText('original files are untouched')
  })
})

test.describe('editing', () => {
  test.beforeEach(async ({ page }) => {
    await openEditor(page)
    await importFiles(page, ['clip-a.webm', 'clip-b.webm'])
    await page.dblclick('[data-asset="clip-a.webm"]')
    await page.dblclick('[data-asset="clip-b.webm"]')
  })

  test('preview renders the composition at the playhead', async ({ page }) => {
    const a = await capture(page, 1)
    const b = await capture(page, 5)
    expect(a.width).toBe(1280)
    expect(meanLuma(a)).toBeGreaterThan(40)
    // clip-b is SMPTE bars: the left bar is light grey.
    const [r, g, bl] = pixel(b, 60, 200)
    expect(Math.min(r, g, bl)).toBeGreaterThan(150)
  })

  test('split, ripple delete, undo and redo with keyboard shortcuts', async ({ page }) => {
    await kaat(page, `k.transport.seek(${2 * TPS})`)
    await page.locator('[data-testid=timeline-canvas]').click({ position: { x: 5, y: 5 } }) // focus timeline area (ruler)
    await kaat(page, `k.transport.seek(${2 * TPS})`)
    await page.keyboard.press('s')
    expect((await trackClips(page))[0]![1]).toEqual([
      ['clip-a.webm', 0, 2],
      ['clip-a.webm', 2, 2],
      ['clip-b.webm', 4, 4],
    ])
    // Select the middle piece by clicking it on the canvas, then ripple delete.
    const pos = await page.evaluate(() => {
      const v = (
        window as unknown as {
          kaatTimeline: { xOf(t: number): number; rows(): { y: number; h: number }[] }
        }
      ).kaatTimeline
      const row = v.rows()[1]! // rows are top-down: V2, V1, …
      return { x: v.xOf(3 * 705_600_000), y: row.y + row.h / 2 }
    })
    await page.locator('[data-testid=timeline-canvas]').click({ position: pos })
    await page.keyboard.press('Shift+Delete')
    expect((await trackClips(page))[0]![1]).toEqual([
      ['clip-a.webm', 0, 2],
      ['clip-b.webm', 2, 4],
    ])
    // Linked audio rippled with it.
    expect((await trackClips(page))[2]![1].map((c) => c[1])).toEqual([0, 2])
    await page.keyboard.press('Control+z')
    expect((await trackClips(page))[0]![1]).toHaveLength(3)
    await page.keyboard.press('Control+z')
    expect((await trackClips(page))[0]![1]).toHaveLength(2)
    await page.keyboard.press('Control+Shift+z')
    expect((await trackClips(page))[0]![1]).toHaveLength(3)
  })

  test('drag moves a clip and dragging an edge trims it', async ({ page }) => {
    const canvas = page.locator('[data-testid=timeline-canvas]')
    const box = (await canvas.boundingBox())!
    const geo = await page.evaluate(() => {
      const v = (
        window as unknown as {
          kaatTimeline: { xOf(t: number): number; pps: number; rows(): { y: number; h: number }[] }
        }
      ).kaatTimeline
      const row = v.rows()[1]!
      return {
        start: v.xOf(4 * 705_600_000),
        end: v.xOf(8 * 705_600_000),
        y: row.y + row.h / 2,
        pps: v.pps,
      }
    })
    // Trim clip-b's end by 1 s.
    await page.mouse.move(box.x + geo.end - 2, box.y + geo.y)
    await page.mouse.down()
    await page.mouse.move(box.x + geo.end - 2 - geo.pps, box.y + geo.y, { steps: 5 })
    await page.mouse.up()
    expect((await trackClips(page))[0]![1][1]).toEqual(['clip-b.webm', 4, 3])
    // Move clip-b 1 s to the right (snapping off).
    await kaat(page, 'k.ui.snapping = false')
    const mid = (geo.start + geo.start + 3 * geo.pps) / 2
    await page.mouse.move(box.x + mid, box.y + geo.y)
    await page.mouse.down()
    await page.mouse.move(box.x + mid + geo.pps, box.y + geo.y, { steps: 8 })
    await page.mouse.up()
    const v1 = (await trackClips(page))[0]![1]
    expect(v1[1]![0]).toBe('clip-b.webm')
    expect(v1[1]![1]).toBeCloseTo(5, 1)
  })

  test('text layer, keyframed position and a transition', async ({ page }) => {
    await kaat(
      page,
      `k.transport.seek(0); k.addText({ content: 'KAAT', fontSize: 200, color: '#ff00ff' })`,
    )
    const textId = await kaat<string>(page, 'return k.ui.selection[0]')
    // Animate X from -300 to 300 over 2 s via the inspector's keyframe buttons.
    await page.locator('[data-testid=kf-x]').click()
    await kaat(
      page,
      `k.exec({ type: 'setKeyframe', clipId: '${textId}', prop: 'x', t: 0, v: -300 })`,
    )
    await kaat(
      page,
      `k.exec({ type: 'setKeyframe', clipId: '${textId}', prop: 'x', t: ${2 * TPS}, v: 300 })`,
    )
    // Hide V1 (its test pattern contains magenta) while measuring the text position.
    const v1 = await kaat<string>(page, 'return k.store.project.sequences[0].tracks[0].id')
    await kaat(page, `k.exec({ type: 'updateTrack', trackId: '${v1}', patch: { hidden: true } })`)
    const left = await capture(page, 0)
    const right = await capture(page, 2)
    await kaat(page, `k.exec({ type: 'updateTrack', trackId: '${v1}', patch: { hidden: false } })`)
    const magentaX = (png: Awaited<ReturnType<typeof capture>>) => {
      let sum = 0
      let n = 0
      for (let y = 300; y < 420; y += 4)
        for (let x = 0; x < png.width; x += 2) {
          const [r, g, b] = pixel(png, x, y)
          if (r > 200 && g < 60 && b > 200) {
            sum += x
            n++
          }
        }
      return n ? sum / n : -1
    }
    const lx = magentaX(left)
    const rx = magentaX(right)
    expect(lx).toBeGreaterThan(0)
    expect(rx - lx).toBeGreaterThan(500) // moved ~600 px
    // Dissolve into clip-b via the Effects panel.
    const bId = await kaat<string>(
      page,
      'return k.store.project.sequences[0].tracks[0].clips[1].id',
    )
    await kaat(page, `k.ui.selection = ['${bId}']`)
    await page.locator('[data-testid=library-tabs]').getByText('Effects').click()
    await page.locator('[data-testid=tr-dissolve]').click()
    expect(
      await kaat(page, `return k.store.project.sequences[0].tracks[0].clips[1].transitionIn.type`),
    ).toBe('dissolve')
    const mid = await capture(page, 4.5)
    const pure = await capture(page, 5.5)
    expect(Math.abs(meanLuma(mid) - meanLuma(pure))).toBeGreaterThan(3)
  })

  test('play advances in sync and J/K/L shuttle', async ({ page }) => {
    await page.locator('[data-testid=play]').click()
    await page.waitForTimeout(1200)
    await page.locator('[data-testid=play]').click()
    const t = await kaat<number>(page, `return k.transport.time / ${TPS}`)
    expect(t).toBeGreaterThan(0.7)
    expect(t).toBeLessThan(2.5)
    await page.keyboard.press('l')
    await page.keyboard.press('l')
    expect(await kaat(page, 'return k.transport.rate')).toBe(2)
    await page.keyboard.press('k')
    expect(await kaat(page, 'return k.transport.playing')).toBe(false)
    await kaat(page, `k.transport.seek(${6 * TPS})`)
    await page.keyboard.press('j')
    await page.waitForTimeout(600)
    await page.keyboard.press('k')
    expect(await kaat<number>(page, `return k.transport.time / ${TPS}`)).toBeLessThan(6)
    // Frame stepping is exact.
    await kaat(page, `k.transport.seek(${TPS})`)
    await page.keyboard.press('ArrowRight')
    expect(await kaat<number>(page, 'return k.transport.time')).toBe(TPS + TPS / 30)
  })
})

test.describe('persistence', () => {
  test('autosave restores after reload, offline media keeps edits and relinks', async ({
    page,
  }) => {
    await openEditor(page)
    await importFiles(page, ['clip-a.webm', 'clip-b.webm'])
    await page.dblclick('[data-asset="clip-a.webm"]')
    await page.dblclick('[data-asset="clip-b.webm"]')
    await kaat(page, `k.transport.seek(${3 * TPS}); k.splitAtPlayhead()`)
    await expect(page.locator('[data-testid=save-state]')).toHaveText('Saved on this device', {
      timeout: 10_000,
    })
    const before = await trackClips(page)
    await page.reload()
    await page.waitForFunction(
      () => (window as unknown as { kaat: { ui: { engineReady: boolean } } }).kaat.ui.engineReady,
    )
    await expect(page.locator('[data-asset="clip-a.webm"]')).toHaveAttribute(
      'data-status',
      'offline',
    )
    expect(await trackClips(page)).toEqual(before)
    // No crash warning after a clean reload.
    await expect(page.getByText('Project recovered')).toHaveCount(0)
    await page.setInputFiles('[data-testid=relink-input]', [fx('clip-a.webm'), fx('clip-b.webm')])
    await expect(page.locator('[data-asset="clip-a.webm"]')).toHaveAttribute('data-status', 'ready')
    await expect(page.locator('[data-asset="clip-b.webm"]')).toHaveAttribute('data-status', 'ready')
    expect(await trackClips(page)).toEqual(before)
    expect(meanLuma(await capture(page, 1))).toBeGreaterThan(40)
  })

  test('project file round-trips through export and import', async ({ page }) => {
    await openEditor(page)
    await importFiles(page, ['clip-a.webm'])
    await page.dblclick('[data-asset="clip-a.webm"]')
    await kaat(page, `k.exec({ type: 'renameProject', name: 'Round trip' })`)
    const download = page.waitForEvent('download')
    await kaat(page, 'k.exportProjectFile()')
    const d = await download
    const path = await d.path()
    expect(d.suggestedFilename()).toBe('Round trip.kaat.json')
    await page.locator('[data-testid=projects]').click()
    await page.setInputFiles('[data-testid=project-file-input]', path!)
    await expect(page.locator('[data-testid=project-name]')).toHaveText('Round trip')
    expect((await trackClips(page))[0]![1]).toEqual([['clip-a.webm', 0, 4]])
  })
})

test.describe('export', () => {
  test('exports a playable file with audio, and cancel discards cleanly', async ({
    page,
  }, info) => {
    await openEditor(page, '?downloadExports')
    await importFiles(page, ['clip-a.webm', 'clip-b.webm', 'tone.wav'])
    await page.dblclick('[data-asset="clip-a.webm"]')
    await page.dblclick('[data-asset="clip-b.webm"]')
    // Music bed on A2.
    await kaat(
      page,
      `const a = Object.values(k.store.project.assets).find((x) => x.name === 'tone.wav'); k.placeAsset(a.id, 0, k.store.project.sequences[0].tracks[3].id)`,
    )
    await kaat(page, `k.addText({ content: 'Export', fontSize: 120 }, ${TPS})`)

    // Cancel first.
    await page.locator('[data-testid=export]').click()
    await page.locator('[data-testid=export-start]').click()
    await expect(page.locator('[data-testid=export-progress]')).toBeVisible()
    await page.locator('[data-testid=export-cancel]').click()
    await expect(page.getByText('Export cancelled')).toBeVisible()
    expect(
      await kaat(
        page,
        'return (await navigator.storage.getDirectory().then((d) => d.getDirectoryHandle("exports")).then(async (d) => { let n = 0; for await (const _ of d.keys()) n++; return n }).catch(() => 0))',
      ),
    ).toBe(0)

    // Then a full export.
    const download = page.waitForEvent('download', { timeout: 120_000 })
    await page.locator('[data-testid=export-start]').click()
    const d = await download
    await expect(page.locator('[data-testid=export-done]')).toBeVisible()
    const out = info.outputPath(d.suggestedFilename())
    await d.saveAs(out)
    const probe = JSON.parse(
      execFileSync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_type,codec_name,width,height:format=duration',
        '-of',
        'json',
        out,
      ]).toString(),
    )
    const streams = probe.streams as { codec_type: string; width?: number }[]
    expect(streams.find((s) => s.codec_type === 'video')?.width).toBe(1280)
    expect(streams.some((s) => s.codec_type === 'audio')).toBe(true)
    expect(Number(probe.format.duration)).toBeGreaterThan(7.9)
    expect(Number(probe.format.duration)).toBeLessThan(8.2)
    const frames = execFileSync('ffprobe', [
      '-v',
      'error',
      '-count_frames',
      '-select_streams',
      'v',
      '-show_entries',
      'stream=nb_read_frames',
      '-of',
      'csv=p=0',
      out,
    ])
      .toString()
      .trim()
    expect(Number(frames)).toBe(240)
  })
})

test.describe('proxies', () => {
  test('heavy media is flagged, proxies build in the background, export still uses the original', async ({
    page,
  }) => {
    await openEditor(page)
    await importFiles(page, ['clip-1440.webm'])
    const asset = page.locator('[data-asset="clip-1440.webm"]')
    await expect(asset.getByRole('button', { name: /Build proxy/ })).toBeVisible()
    await page.dblclick('[data-asset="clip-1440.webm"]') // editing doesn't wait
    await asset.getByRole('button', { name: /Build proxy/ }).click()
    await expect
      .poll(() => kaat(page, `return Object.values(k.store.project.assets)[0].proxy?.status`), {
        timeout: 60_000,
      })
      .toBe('ready')
    expect(Object.keys(await kaat(page, 'return k.exportFiles()'))).toHaveLength(1)
    const files = await kaat<{ name: string }[]>(
      page,
      'return Object.values(k.exportFiles()).map((f) => ({ name: f.name }))',
    )
    expect(files[0]!.name).toBe('clip-1440.webm')
    expect(meanLuma(await capture(page, 1))).toBeGreaterThan(30)
  })
})

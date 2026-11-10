import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { type Page, expect } from '@playwright/test'
import { PNG } from 'pngjs'

export const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url))
export const TPS = 705_600_000

export const fx = (name: string) => `${FIXTURES}${name}`

/** Open a fresh editor (empty storage) and wait until the engine is ready. */
export async function openEditor(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`)
  await page.waitForFunction(
    () => (window as unknown as { kaat?: { ui: { engineReady: boolean } } }).kaat?.ui.engineReady,
  )
}

export async function importFiles(page: Page, names: string[]): Promise<void> {
  await page.setInputFiles('[data-testid=file-input]', names.map(fx))
  for (const n of names.filter((x) => !x.endsWith('.txt')))
    await expect(page.locator(`[data-asset="${n}"]`)).toHaveAttribute('data-status', 'ready')
}

/** Run a function against the editor in the page. */
export function kaat<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(`(async () => { const k = window.kaat; ${fn} })()`) as Promise<T>
}

export async function trackClips(page: Page): Promise<[string, [string, number, number][]][]> {
  return kaat(
    page,
    `return k.store.project.sequences[0].tracks.map((t) => [t.name, t.clips.map((c) => [c.name, c.start / ${TPS}, c.duration / ${TPS}])])`,
  )
}

/** Full-resolution PNG of the composition at `seconds`, rendered by the preview engine. */
export async function capture(page: Page, seconds: number): Promise<PNG> {
  const b64 = await page.evaluate(async (t) => {
    const buf = await (
      window as unknown as { kaat: { render: { capture(t: number): Promise<ArrayBuffer | null> } } }
    ).kaat.render.capture(t)
    if (!buf) return ''
    let s = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
    return btoa(s)
  }, seconds * TPS)
  return PNG.sync.read(Buffer.from(b64, 'base64'))
}

export function pixel(png: PNG, x: number, y: number): [number, number, number] {
  const i = (Math.floor(y) * png.width + Math.floor(x)) * 4
  return [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!]
}

export function meanLuma(png: PNG): number {
  let s = 0
  for (let i = 0; i < png.data.length; i += 4)
    s += 0.2126 * png.data[i]! + 0.7152 * png.data[i + 1]! + 0.0722 * png.data[i + 2]!
  return s / (png.data.length / 4)
}

/** Mean absolute per-channel difference (0–255) between two equally sized images. */
export function meanDiff(a: PNG, b: PNG): number {
  if (a.width !== b.width || a.height !== b.height) return 255
  let s = 0
  for (let i = 0; i < a.data.length; i += 4)
    s +=
      Math.abs(a.data[i]! - b.data[i]!) +
      Math.abs(a.data[i + 1]! - b.data[i + 1]!) +
      Math.abs(a.data[i + 2]! - b.data[i + 2]!)
  return s / ((a.data.length / 4) * 3)
}

export function readPng(path: string): PNG {
  return PNG.sync.read(readFileSync(path))
}

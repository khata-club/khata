import type { Project } from '@khata/kaat-core'

import type { FontSource } from './text'

export interface RenderResult {
  renderMs: number
  decodeMs: number
  missing: string[]
  layers: number
  width: number
  height: number
  hits?: number
  misses?: number
}

export interface RenderStats {
  textureBytes: number
  textureBudget: number
  textures: number
  hitRate: number
  readers: number
  inputs: number
}

export type RenderApi = {
  init(canvas: OffscreenCanvas, fonts: FontSource[], textureBudget: number): Promise<boolean>
  setProject(p: Project): Promise<void>
  setSource(assetId: string, original: Blob | null, proxy: Blob | null): Promise<void>
  removeSource(assetId: string): Promise<void>
  render(
    t: number,
    mode: 'still' | 'scrub' | 'play',
    scale: number,
    cssW: number,
    cssH: number,
  ): Promise<RenderResult>
  stopPlayback(): Promise<void>
  stats(): Promise<RenderStats>
  setBudget(bytes: number): Promise<void>
  trim(): Promise<void>
  capture(t: number): Promise<ArrayBuffer | null>
}

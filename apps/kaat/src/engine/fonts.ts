/** Bundled fonts, resolved to URLs so workers can load them (text must match in preview and export). */
import geistMono400 from '@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2?url'
import geistMono500 from '@fontsource/geist-mono/files/geist-mono-latin-500-normal.woff2?url'
import q300 from '@fontsource/quicksand/files/quicksand-latin-300-normal.woff2?url'
import q400 from '@fontsource/quicksand/files/quicksand-latin-400-normal.woff2?url'
import q500 from '@fontsource/quicksand/files/quicksand-latin-500-normal.woff2?url'
import q600 from '@fontsource/quicksand/files/quicksand-latin-600-normal.woff2?url'
import q700 from '@fontsource/quicksand/files/quicksand-latin-700-normal.woff2?url'

import type { FontSource } from './render/text'

const abs = (u: string) => new URL(u, location.href).href

export const BUNDLED_FONTS: FontSource[] = [
  { family: 'Quicksand', weight: '300', url: abs(q300) },
  { family: 'Quicksand', weight: '400', url: abs(q400) },
  { family: 'Quicksand', weight: '500', url: abs(q500) },
  { family: 'Quicksand', weight: '600', url: abs(q600) },
  { family: 'Quicksand', weight: '700', url: abs(q700) },
  { family: 'Geist Mono', weight: '400', url: abs(geistMono400) },
  { family: 'Geist Mono', weight: '500', url: abs(geistMono500) },
]

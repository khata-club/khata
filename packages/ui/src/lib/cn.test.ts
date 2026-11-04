import { describe, expect, it } from 'vitest'

import { cn } from './cn'

describe('cn', () => {
  it('lets later utilities win', () => {
    expect(cn('px-4 text-sm', 'px-6')).toBe('text-sm px-6')
  })

  it('treats Calm font sizes and shadows as conflicting groups', () => {
    expect(cn('text-sm', 'text-display')).toBe('text-display')
    expect(cn('shadow-raised-sm', 'shadow-floating')).toBe('shadow-floating')
  })

  it('keeps colour and size utilities apart', () => {
    expect(cn('text-fg-muted', 'text-sm')).toBe('text-fg-muted text-sm')
  })
})

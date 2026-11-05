import { describe, expect, it } from 'vitest'

import { cn } from './cn'

describe('cn', () => {
  it('treats Glass text styles as font sizes', () => {
    expect(cn('text-body', 'text-caption')).toBe('text-caption')
    expect(cn('text-body', 'text-label')).toBe('text-body text-label')
  })
  it('keeps one glass material', () => {
    expect(cn('glass-thin', 'glass-thick')).toBe('glass-thick')
  })
})

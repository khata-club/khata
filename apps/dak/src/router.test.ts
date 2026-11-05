import { describe, expect, it } from 'vitest'

import { router, sections } from './router'

describe('router', () => {
  it('registers a route for every dashboard section', () => {
    for (const s of sections) expect(router.hasRoute(s.name)).toBe(true)
  })

  it('redirects unknown paths to the overview', () => {
    expect(router.resolve('/nope').matched.at(-1)?.redirect).toBe('/')
  })
})

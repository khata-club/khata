import { describe, expect, it } from 'vitest'

import { BlockDocument, newBlock, renderBlocks } from './blocks.ts'
import { STARTERS } from './starters.ts'
import { checkTemplate, renderTemplate, sampleVariables, TemplateVariable } from './templates.ts'

describe('renderBlocks', () => {
  it('renders table layout with inline styles and keeps Liquid', () => {
    const html = renderBlocks({
      brand: { primaryColor: '#123456' },
      blocks: [
        { type: 'text', content: 'Hi {{ name }} <script>', size: 'heading' },
        { type: 'button', label: 'Go', href: '{{ url }}' },
      ],
    })
    expect(html).toContain('role="presentation"')
    expect(html).toContain('Hi {{ name }} &lt;script&gt;')
    expect(html).toContain('href="{{ url }}"')
    expect(html).toContain('background:#123456')
    expect(html).toMatch(/<html lang="en">/)
  })

  it('rejects unsafe links in buttons', () => {
    const r = BlockDocument.safeParse({
      blocks: [{ type: 'button', label: 'x', href: 'javascript:alert(1)' }],
    })
    expect(r.success).toBe(false)
  })

  it('renders every palette block type', () => {
    const types = [
      'text',
      'image',
      'button',
      'divider',
      'spacer',
      'header',
      'footer',
      'html',
      'columns',
    ] as const
    expect(() => renderBlocks({ blocks: types.map(newBlock) })).not.toThrow()
  })
})

describe('starters', () => {
  it('ships the ten spec starters', () => {
    expect(STARTERS.map((s) => s.id)).toEqual([
      'otp',
      'verify-email',
      'password-reset',
      'welcome',
      'invoice',
      'payment-failed',
      'invitation',
      'notification',
      'digest',
      'newsletter',
    ])
  })

  it.each(STARTERS)('$id renders with its examples and has no errors', (s) => {
    const vars = s.variables.map((v) => TemplateVariable.parse(v))
    const source = { subject: s.subject, html: renderBlocks(s.document) }
    expect(checkTemplate(source, vars).filter((c) => c.level === 'error')).toEqual([])
    const out = renderTemplate(source, vars, sampleVariables(vars))
    expect(out.subject.length).toBeGreaterThan(3)
    expect(out.html).not.toContain('{{')
  })
})

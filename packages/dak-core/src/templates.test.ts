import { describe, expect, it } from 'vitest'

import {
  checkTemplate,
  htmlToText,
  maskSensitive,
  referencedVariables,
  renderTemplate,
  TemplateError,
  TemplateVariable,
} from './templates.ts'

const vars = (xs: Partial<TemplateVariable>[]) => xs.map((x) => TemplateVariable.parse(x))

describe('renderTemplate', () => {
  const schema = vars([
    { name: 'name', required: true },
    { name: 'code', required: true, sensitive: true },
    { name: 'items', type: 'list', default: [] },
    { name: 'vip', type: 'boolean', default: false },
  ])
  const source = {
    subject: 'Hi {{ name }}',
    html: '<p>Hello {{ name }}</p>{% if vip %}<b>VIP</b>{% endif %}<ul>{% for i in items %}<li>{{ i }}</li>{% endfor %}</ul><p>{{ code }}</p>',
  }

  it('renders loops, conditionals and escapes HTML only in the body', () => {
    const out = renderTemplate(source, schema, {
      name: '<Ada & Co>',
      code: '123456',
      items: ['a', 'b'],
      vip: true,
    })
    expect(out.subject).toBe('Hi <Ada & Co>')
    expect(out.html).toBe(
      '<p>Hello &lt;Ada &amp; Co&gt;</p><b>VIP</b><ul><li>a</li><li>b</li></ul><p>123456</p>',
    )
    expect(out.text).toContain('Hello <Ada & Co>')
  })

  it('rejects missing, mistyped and undeclared variables', () => {
    try {
      renderTemplate(source, schema, { code: 1, extra: true })
      expect.unreachable()
    } catch (err) {
      expect((err as TemplateError).issues).toEqual([
        { path: 'name', message: 'Required.' },
        { path: 'code', message: 'Expected string.' },
        { path: 'extra', message: 'Not declared in the template.' },
      ])
    }
  })

  it('fails on unknown variables and filters instead of rendering blanks', () => {
    expect(() => renderTemplate({ subject: 's', html: '{{ nope }}' }, [], {})).toThrow(
      TemplateError,
    )
    expect(() => renderTemplate({ subject: 's', html: '{{ "x" | shell }}' }, [], {})).toThrow(
      TemplateError,
    )
  })

  it('forbids includes and layouts', () => {
    for (const html of ["{% include 'x' %}", "{% render 'x' %}", "{% layout 'x' %}"]) {
      try {
        renderTemplate({ subject: 's', html }, [], {})
        expect.unreachable()
      } catch (err) {
        expect((err as TemplateError).issues[0]!.message).toMatch(/not allowed/)
      }
    }
  })

  it('bounds runaway loops', () => {
    const big = vars([{ name: 'n', type: 'list' }])
    expect(() =>
      renderTemplate(
        {
          subject: 's',
          html: '{% for a in n %}{% for b in n %}{% for c in n %}x{% endfor %}{% endfor %}{% endfor %}',
        },
        big,
        {
          n: Array.from({ length: 300 }, (_, i) => i),
        },
      ),
    ).toThrow(TemplateError)
  })

  it('masks sensitive values for stored previews', () => {
    expect(maskSensitive(schema, { name: 'Ada', code: '123456' })).toEqual({
      name: 'Ada',
      code: '••••••',
    })
  })
})

describe('checkTemplate', () => {
  it('finds undeclared and unused variables', () => {
    const checks = checkTemplate(
      { subject: '{{ a }}', html: '{{ b.c }}' },
      vars([{ name: 'a' }, { name: 'z' }]),
    )
    expect(checks.map((c) => c.id).sort()).toEqual(['undeclared:b', 'unused:z'])
    expect(
      referencedVariables({ subject: '{{ a }}', html: '{% for x in list %}{{ x }}{% endfor %}' }),
    ).toEqual(['a', 'list'])
  })

  it('flags accessibility and unsafe links', () => {
    const ids = checkTemplate(
      {
        subject: 'S',
        html: '<html><img src="x.png"><a href="javascript:alert(1)">Go</a><a href="http://x.dev">click here</a><a href="https://x.dev"></a></html>',
      },
      [],
    ).map((c) => c.id)
    expect(ids).toEqual([
      'img-alt',
      'unsafe-link',
      'insecure-link',
      'vague-link',
      'empty-link',
      'html-lang',
    ])
  })

  it('reports syntax errors', () => {
    expect(checkTemplate({ subject: 'S', html: '{% if %}' }, [])[0]!.id).toBe('syntax')
  })
})

describe('htmlToText', () => {
  it('keeps links and structure', () => {
    expect(
      htmlToText('<h1>Hi</h1><p>Reset <a href="https://x.dev/r">here</a></p><ul><li>One</li></ul>'),
    ).toBe('Hi\nReset here (https://x.dev/r)\n• One')
  })
})

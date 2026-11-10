/**
 * Template engine: LiquidJS in a restricted profile (decision D5). No file system, includes,
 * layouts or custom code; unknown variables and filters are errors; output is HTML-escaped by
 * default; parse/render/memory limits bound the work a template can cause. Runs unchanged in
 * Workers (sending) and browsers (editor preview).
 */
import { Liquid, Tag, type TagToken, type TopLevelToken } from 'liquidjs'
import { z } from 'zod'

const MAX_TEMPLATE_BYTES = 512 * 1024

/** Tags that would reach outside the template; replaced by tags that fail at parse time. */
const FORBIDDEN_TAGS = ['include', 'render', 'layout', 'block']

function createEngine(escape: boolean) {
  const engine = new Liquid({
    strictVariables: true,
    strictFilters: true,
    ownPropertyOnly: true,
    outputEscape: escape ? 'escape' : undefined,
    relativeReference: false,
    dynamicPartials: false,
    parseLimit: MAX_TEMPLATE_BYTES,
    renderLimit: 1_000,
    memoryLimit: 8 * 1024 * 1024,
    jsTruthy: false,
  })
  for (const name of FORBIDDEN_TAGS) {
    engine.registerTag(
      name,
      class extends Tag {
        constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid) {
          super(token, remain, liquid)
          throw new Error(`The {% ${name} %} tag is not allowed in Dak templates.`)
        }
        *render(): Generator<unknown, void, unknown> {}
      },
    )
  }
  return engine
}

const htmlEngine = createEngine(true)
const textEngine = createEngine(false)

export const VariableType = z.enum(['string', 'number', 'boolean', 'url', 'date', 'list', 'object'])
export type VariableType = z.infer<typeof VariableType>

export const TemplateVariable = z.object({
  name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/, 'Use letters, digits and underscores.'),
  type: VariableType.default('string'),
  required: z.boolean().default(false),
  default: z.unknown().optional(),
  example: z.unknown().optional(),
  description: z.string().max(500).optional(),
  /** OTPs, reset links: masked in stored previews and logs (spec §6). */
  sensitive: z.boolean().default(false),
})
export type TemplateVariable = z.output<typeof TemplateVariable>
export const TemplateVariables = z.array(TemplateVariable).max(100)

export interface TemplateSource {
  subject: string
  html: string
  text?: string | null
}

export interface RenderedTemplate {
  subject: string
  html: string
  text: string
}

export class TemplateError extends Error {
  constructor(
    message: string,
    readonly issues: { path: string; message: string }[],
  ) {
    super(message)
    this.name = 'TemplateError'
  }
}

function typeOk(type: VariableType, v: unknown): boolean {
  switch (type) {
    case 'string':
      return typeof v === 'string'
    case 'number':
      return typeof v === 'number' && Number.isFinite(v)
    case 'boolean':
      return typeof v === 'boolean'
    case 'url':
      return typeof v === 'string' && /^https?:\/\//i.test(v)
    case 'date':
      return typeof v === 'string' && !Number.isNaN(Date.parse(v))
    case 'list':
      return Array.isArray(v)
    case 'object':
      return typeof v === 'object' && v !== null && !Array.isArray(v)
  }
}

/** Checks provided variables against the schema and fills defaults. */
export function resolveVariables(
  schema: TemplateVariable[],
  input: Record<string, unknown>,
): Record<string, unknown> {
  const issues: { path: string; message: string }[] = []
  const out: Record<string, unknown> = {}
  for (const v of schema) {
    const value = input[v.name] ?? v.default
    if (value === undefined || value === null) {
      if (v.required) issues.push({ path: v.name, message: 'Required.' })
      continue
    }
    if (!typeOk(v.type, value)) issues.push({ path: v.name, message: `Expected ${v.type}.` })
    out[v.name] = value
  }
  const known = new Set(schema.map((v) => v.name))
  for (const k of Object.keys(input)) {
    if (!known.has(k)) issues.push({ path: k, message: 'Not declared in the template.' })
  }
  if (issues.length) throw new TemplateError('Template variables are invalid.', issues)
  return out
}

/** Variables declared for every template. */
const BUILTINS = new Set<string>([])

export function referencedVariables(source: TemplateSource): string[] {
  const names = new Set<string>()
  for (const part of [source.subject, source.html, source.text ?? '']) {
    for (const v of htmlEngine.globalVariablesSync(part)) names.add(v)
  }
  return [...names].filter((n) => !BUILTINS.has(n)).sort()
}

/** Plain-text alternative from HTML: keeps structure and link targets, drops markup. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_m, href: string, label: string) => {
        const text = label.replace(/<[^>]+>/g, '').trim()
        return text && text !== href ? `${text} (${href})` : href
      },
    )
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|table|section|article|header|footer)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Renders a template version. HTML output escapes variables; subject and text do not (they
 * are not HTML). Unknown variables or filters, and forbidden tags, throw TemplateError.
 */
export function renderTemplate(
  source: TemplateSource,
  schema: TemplateVariable[],
  input: Record<string, unknown>,
): RenderedTemplate {
  const vars = resolveVariables(schema, input)
  try {
    const subject = textEngine
      .parseAndRenderSync(source.subject, vars)
      .replace(/[\r\n]+/g, ' ')
      .trim()
    const html = htmlEngine.parseAndRenderSync(source.html, vars)
    const text = source.text ? textEngine.parseAndRenderSync(source.text, vars) : htmlToText(html)
    return { subject, html, text }
  } catch (err) {
    if (err instanceof TemplateError) throw err
    const message = err instanceof Error ? err.message.split('\n')[0]! : String(err)
    throw new TemplateError('The template could not be rendered.', [{ path: 'template', message }])
  }
}

/** Replaces sensitive variable values so stored previews never contain real secrets. */
export function maskSensitive(schema: TemplateVariable[], input: Record<string, unknown>) {
  const out = { ...input }
  for (const v of schema) if (v.sensitive && v.name in out) out[v.name] = '••••••'
  return out
}

/** Sample data for previews: provided example, then default, then a type placeholder. */
export function sampleVariables(schema: TemplateVariable[]): Record<string, unknown> {
  const placeholder: Record<VariableType, unknown> = {
    string: 'Sample',
    number: 42,
    boolean: true,
    url: 'https://example.com',
    date: '2026-11-05',
    list: [],
    object: {},
  }
  return Object.fromEntries(
    schema.map((v) => [v.name, v.example ?? v.default ?? placeholder[v.type]]),
  )
}

export interface TemplateCheck {
  id: string
  level: 'error' | 'warning'
  message: string
}

/** Editor checks (spec §6): variables, accessibility, alt text and unsafe links. */
export function checkTemplate(source: TemplateSource, schema: TemplateVariable[]): TemplateCheck[] {
  const checks: TemplateCheck[] = []
  try {
    for (const part of [source.subject, source.html, source.text ?? '']) htmlEngine.parse(part)
  } catch (err) {
    checks.push({
      id: 'syntax',
      level: 'error',
      message: err instanceof Error ? err.message.split('\n')[0]! : String(err),
    })
    return checks
  }
  const declared = new Set(schema.map((v) => v.name))
  for (const name of referencedVariables(source)) {
    if (!declared.has(name))
      checks.push({
        id: `undeclared:${name}`,
        level: 'error',
        message: `“${name}” is used but not declared.`,
      })
  }
  const used = new Set(referencedVariables(source))
  for (const v of schema) {
    if (!used.has(v.name))
      checks.push({
        id: `unused:${v.name}`,
        level: 'warning',
        message: `“${v.name}” is declared but never used.`,
      })
  }
  const html = source.html
  for (const img of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (!/\balt\s*=/i.test(img))
      checks.push({
        id: 'img-alt',
        level: 'warning',
        message: `Image without alt text: ${img.slice(0, 80)}`,
      })
  }
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']\s*([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1]!.trim()
    const label = m[2]!.replace(/<[^>]+>/g, '').trim()
    if (/^(javascript|data|vbscript):/i.test(href)) {
      checks.push({
        id: 'unsafe-link',
        level: 'error',
        message: `Unsafe link: ${href.slice(0, 60)}`,
      })
    } else if (/^http:\/\//i.test(href)) {
      checks.push({
        id: 'insecure-link',
        level: 'warning',
        message: `Insecure http link: ${href.slice(0, 60)}`,
      })
    }
    if (!label && !/<img\b[^>]*alt\s*=\s*["'][^"']+/i.test(m[2]!)) {
      checks.push({
        id: 'empty-link',
        level: 'warning',
        message: `Link without text: ${href.slice(0, 60)}`,
      })
    } else if (/^(click here|here|link)$/i.test(label)) {
      checks.push({
        id: 'vague-link',
        level: 'warning',
        message: `Link text “${label}” does not describe the destination.`,
      })
    }
  }
  if (/<html\b/i.test(html) && !/<html\b[^>]*\blang=/i.test(html)) {
    checks.push({ id: 'html-lang', level: 'warning', message: 'Add a lang attribute to <html>.' })
  }
  if (!source.subject.trim())
    checks.push({ id: 'subject', level: 'error', message: 'Subject is empty.' })
  if (new TextEncoder().encode(html).length > 102 * 1024) {
    checks.push({
      id: 'clipping',
      level: 'warning',
      message: 'HTML over 102 KB is clipped by Gmail.',
    })
  }
  return checks
}

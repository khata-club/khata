/**
 * Visual-editor block document and its renderer to email-safe HTML (nested tables, inline
 * styles, no external CSS). Text is escaped but Liquid tags are kept, so the rendered HTML
 * goes through the same template engine as code templates. Rendering is deterministic and
 * runs in the browser (live canvas) and Worker (authoritative on save).
 */
import { z } from 'zod'

const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #2457d6.')
/** https, mailto or a Liquid expression; never javascript:/data:. */
const Href = z
  .string()
  .max(2048)
  .refine((v) => /^(https:\/\/|mailto:|\{\{)/i.test(v.trim()), 'Use an https:// or mailto: link.')
const Align = z.enum(['left', 'center', 'right']).default('left')

export const Brand = z.object({
  logoUrl: z.string().max(2048).optional(),
  logoAlt: z.string().max(200).default(''),
  primaryColor: Color.default('#2457d6'),
  textColor: Color.default('#1f2937'),
  mutedColor: Color.default('#6b7280'),
  backgroundColor: Color.default('#f4f6fb'),
  contentColor: Color.default('#ffffff'),
  fontFamily: z
    .string()
    .max(200)
    .default("-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"),
  contentWidth: z.number().int().min(400).max(800).default(600),
  radius: z.number().int().min(0).max(24).default(8),
})
export type Brand = z.output<typeof Brand>

const TextBlock = z.object({
  type: z.literal('text'),
  content: z.string().max(20_000),
  align: Align,
  size: z.enum(['small', 'body', 'large', 'heading']).default('body'),
})
const ImageBlock = z.object({
  type: z.literal('image'),
  src: z.string().max(2048),
  alt: z.string().max(300),
  href: Href.optional(),
  width: z.number().int().min(16).max(800).optional(),
  align: Align,
})
const ButtonBlock = z.object({
  type: z.literal('button'),
  label: z.string().max(200),
  href: Href,
  align: Align,
})
const DividerBlock = z.object({ type: z.literal('divider') })
const SpacerBlock = z.object({
  type: z.literal('spacer'),
  height: z.number().int().min(4).max(120).default(24),
})
const HeaderBlock = z.object({ type: z.literal('header'), title: z.string().max(200).optional() })
const FooterBlock = z.object({ type: z.literal('footer'), content: z.string().max(5_000) })
/** Imported or hand-written HTML kept as-is. */
const HtmlBlock = z.object({ type: z.literal('html'), content: z.string().max(100_000) })

const Leaf = z.discriminatedUnion('type', [
  TextBlock,
  ImageBlock,
  ButtonBlock,
  DividerBlock,
  SpacerBlock,
  HeaderBlock,
  FooterBlock,
  HtmlBlock,
])
const ColumnsBlock = z.object({
  type: z.literal('columns'),
  columns: z
    .array(z.object({ blocks: z.array(Leaf).max(20) }))
    .min(2)
    .max(3),
})

export const Block = z.discriminatedUnion('type', [
  TextBlock,
  ImageBlock,
  ButtonBlock,
  DividerBlock,
  SpacerBlock,
  HeaderBlock,
  FooterBlock,
  HtmlBlock,
  ColumnsBlock,
])
export type Block = z.output<typeof Block>
export type BlockType = Block['type']

export const BlockDocument = z.object({
  version: z.literal(1).default(1),
  brand: Brand.default(Brand.parse({})),
  preheader: z.string().max(200).optional(),
  blocks: z.array(Block).max(100),
})
export type BlockDocument = z.output<typeof BlockDocument>

/** Escapes HTML but leaves `{{ … }}` and `{% … %}` for the template engine. */
export function escapeKeepLiquid(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function attr(s: string) {
  return escapeKeepLiquid(s)
}

const SIZES = { small: 13, body: 16, large: 19, heading: 26 } as const

function renderLeaf(b: z.output<typeof Leaf>, brand: Brand, width: number): string {
  const cell = (inner: string, pad = '0 32px', align = 'left') =>
    `<tr><td align="${align}" style="padding:${pad};text-align:${align}">${inner}</td></tr>`
  switch (b.type) {
    case 'text': {
      const size = SIZES[b.size]
      const weight = b.size === 'heading' ? 700 : 400
      const body = escapeKeepLiquid(b.content).replace(/\n/g, '<br>')
      return cell(
        `<p style="margin:0 0 16px;font-size:${size}px;line-height:1.5;font-weight:${weight};color:${brand.textColor}">${body}</p>`,
        '0 32px',
        b.align,
      )
    }
    case 'image': {
      const w = Math.min(b.width ?? width - 64, width - 64)
      const img = `<img src="${attr(b.src)}" alt="${attr(b.alt)}" width="${w}" style="display:block;max-width:100%;height:auto;border:0">`
      return cell(b.href ? `<a href="${attr(b.href)}">${img}</a>` : img, '0 32px 16px', b.align)
    }
    case 'button':
      return cell(
        `<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table"><tr><td style="border-radius:${brand.radius}px;background:${brand.primaryColor}"><a href="${attr(b.href)}" style="display:inline-block;padding:12px 24px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:${brand.radius}px">${escapeKeepLiquid(b.label)}</a></td></tr></table>`,
        '8px 32px 24px',
        b.align,
      )
    case 'divider':
      return cell(`<hr style="border:0;border-top:1px solid #e5e7eb;margin:8px 0 24px">`)
    case 'spacer':
      return `<tr><td style="height:${b.height}px;line-height:${b.height}px;font-size:0">&nbsp;</td></tr>`
    case 'header': {
      const logo = brand.logoUrl
        ? `<img src="${attr(brand.logoUrl)}" alt="${attr(brand.logoAlt)}" height="32" style="display:block;border:0;height:32px;width:auto">`
        : ''
      const title = b.title
        ? `<p style="margin:${logo ? '16px' : '0'} 0 0;font-size:20px;font-weight:700;color:${brand.textColor}">${escapeKeepLiquid(b.title)}</p>`
        : ''
      return cell(logo + title, '32px 32px 16px')
    }
    case 'footer':
      return cell(
        `<p style="margin:0;font-size:12px;line-height:1.5;color:${brand.mutedColor}">${escapeKeepLiquid(b.content).replace(/\n/g, '<br>')}</p>`,
        '24px 32px 32px',
      )
    case 'html':
      return `<tr><td style="padding:0 32px">${b.content}</td></tr>`
  }
}

function renderBlock(b: Block, brand: Brand, width: number): string {
  if (b.type !== 'columns') return renderLeaf(b, brand, width)
  const colWidth = Math.floor((width - 32) / b.columns.length)
  const cols = b.columns
    .map(
      (c) =>
        `<td valign="top" width="${colWidth}" style="width:${colWidth}px;padding:0 0 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${c.blocks
          .map((x) => renderLeaf(x, brand, colWidth))
          .join('')}</table></td>`,
    )
    .join('')
  return `<tr><td style="padding:0 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cols}</tr></table></td></tr>`
}

export function renderBlocks(input: z.input<typeof BlockDocument>): string {
  const doc = BlockDocument.parse(input)
  const { brand } = doc
  const pre = doc.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeKeepLiquid(doc.preheader)}</div>`
    : ''
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${brand.backgroundColor}">${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.backgroundColor}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="${brand.contentWidth}" cellpadding="0" cellspacing="0" style="width:100%;max-width:${brand.contentWidth}px;background:${brand.contentColor};border-radius:${brand.radius}px;font-family:${attr(brand.fontFamily)}">
${doc.blocks.map((b) => renderBlock(b, brand, brand.contentWidth)).join('\n')}
<tr><td style="height:16px;font-size:0">&nbsp;</td></tr>
</table>
</td></tr></table>
</body>
</html>`
}

/** Fresh block of a type, as added from the editor palette. */
export function newBlock(type: BlockType): Block {
  switch (type) {
    case 'text':
      return { type, content: 'Write something…', align: 'left', size: 'body' }
    case 'image':
      return { type, src: 'https://placehold.co/600x200/png', alt: '', align: 'center' }
    case 'button':
      return { type, label: 'Open', href: 'https://example.com', align: 'left' }
    case 'divider':
      return { type }
    case 'spacer':
      return { type, height: 24 }
    case 'header':
      return { type }
    case 'footer':
      return { type, content: 'You receive this email because you have an account.' }
    case 'html':
      return { type, content: '<p>HTML</p>' }
    case 'columns':
      return {
        type,
        columns: [
          { blocks: [{ type: 'text', content: 'Left', align: 'left', size: 'body' }] },
          { blocks: [{ type: 'text', content: 'Right', align: 'left', size: 'body' }] },
        ],
      }
  }
}

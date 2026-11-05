/** Starter templates (spec §6). Each is a visual document plus its variable schema. */
import type { z } from 'zod'

import type { BlockDocument } from './blocks.ts'
import type { TemplateVariable } from './templates.ts'

export interface Starter {
  id: string
  name: string
  description: string
  stream: 'authentication' | 'transactional' | 'notifications' | 'marketing'
  subject: string
  variables: z.input<typeof import('./templates.ts').TemplateVariable>[]
  document: z.input<typeof BlockDocument>
}

const v = (name: string, extra: Partial<TemplateVariable> = {}) => ({
  name,
  type: 'string' as const,
  required: true,
  ...extra,
})
const header = { type: 'header' as const }
const footer = (
  text = 'You receive this email because you have an account with {{ product }}.',
) => ({ type: 'footer' as const, content: text })
const text = (content: string, size: 'small' | 'body' | 'large' | 'heading' = 'body') => ({
  type: 'text' as const,
  content,
  size,
  align: 'left' as const,
})
const button = (label: string, href: string) => ({
  type: 'button' as const,
  label,
  href,
  align: 'left' as const,
})
const product = v('product', { example: 'Acme' })

export const STARTERS: Starter[] = [
  {
    id: 'otp',
    name: 'One-time code',
    description: 'Sign-in or verification code; expires quickly, never tracked.',
    stream: 'authentication',
    subject: '{{ code }} is your {{ product }} code',
    variables: [
      product,
      v('code', { sensitive: true, example: '482913' }),
      v('minutes', { type: 'number', default: 10 }),
    ],
    document: {
      blocks: [
        header,
        text('Your sign-in code', 'heading'),
        text('{{ code }}', 'heading'),
        text(
          'It expires in {{ minutes }} minutes. If you did not try to sign in, you can ignore this email.',
        ),
        footer(),
      ],
    },
  },
  {
    id: 'verify-email',
    name: 'Verify email',
    description: 'Confirm a new email address.',
    stream: 'authentication',
    subject: 'Confirm your email for {{ product }}',
    variables: [
      product,
      v('url', { type: 'url', sensitive: true, example: 'https://example.com/verify?t=…' }),
    ],
    document: {
      blocks: [
        header,
        text('Confirm your email', 'heading'),
        text('Tap the button to confirm this address.'),
        button('Confirm email', '{{ url }}'),
        footer(),
      ],
    },
  },
  {
    id: 'password-reset',
    name: 'Password reset',
    description: 'Reset link with expiry and a safety note.',
    stream: 'authentication',
    subject: 'Reset your {{ product }} password',
    variables: [
      product,
      v('url', { type: 'url', sensitive: true, example: 'https://example.com/reset?t=…' }),
      v('minutes', { type: 'number', default: 30 }),
    ],
    document: {
      blocks: [
        header,
        text('Reset your password', 'heading'),
        text('The link works for {{ minutes }} minutes.'),
        button('Choose a new password', '{{ url }}'),
        text('Did not ask for this? Your password stays the same.', 'small'),
        footer(),
      ],
    },
  },
  {
    id: 'welcome',
    name: 'Welcome',
    description: 'First email after sign-up.',
    stream: 'transactional',
    subject: 'Welcome to {{ product }}, {{ name }}',
    variables: [
      product,
      v('name', { example: 'Ada' }),
      v('url', { type: 'url', example: 'https://example.com/start' }),
    ],
    document: {
      blocks: [
        header,
        text('Welcome, {{ name }}!', 'heading'),
        text('Everything is ready. Start with the getting-started guide.'),
        button('Get started', '{{ url }}'),
        footer(),
      ],
    },
  },
  {
    id: 'invoice',
    name: 'Invoice',
    description: 'Receipt with line items.',
    stream: 'transactional',
    subject: 'Invoice {{ number }} from {{ product }}',
    variables: [
      product,
      v('number', { example: 'INV-1042' }),
      v('total', { example: '₹4,999.00' }),
      v('items', { type: 'list', example: [{ name: 'Pro plan', amount: '₹4,999.00' }] }),
      v('url', { type: 'url', example: 'https://example.com/invoices/1042' }),
    ],
    document: {
      blocks: [
        header,
        text('Invoice {{ number }}', 'heading'),
        {
          type: 'html',
          content:
            '<table width="100%" style="border-collapse:collapse;font-size:15px">{% for i in items %}<tr><td style="padding:6px 0">{{ i.name }}</td><td align="right">{{ i.amount }}</td></tr>{% endfor %}<tr><td style="padding-top:10px;border-top:1px solid #e5e7eb"><b>Total</b></td><td align="right" style="padding-top:10px;border-top:1px solid #e5e7eb"><b>{{ total }}</b></td></tr></table>',
        },
        { type: 'spacer', height: 16 },
        button('View invoice', '{{ url }}'),
        footer(),
      ],
    },
  },
  {
    id: 'payment-failed',
    name: 'Payment failed',
    description: 'Ask the customer to update their card.',
    stream: 'transactional',
    subject: 'Your {{ product }} payment did not go through',
    variables: [
      product,
      v('amount', { example: '₹4,999.00' }),
      v('url', { type: 'url', example: 'https://example.com/billing' }),
    ],
    document: {
      blocks: [
        header,
        text('Payment failed', 'heading'),
        text(
          'We could not charge {{ amount }}. Update your payment method to keep your plan active.',
        ),
        button('Update payment method', '{{ url }}'),
        footer(),
      ],
    },
  },
  {
    id: 'invitation',
    name: 'Invitation',
    description: 'Invite someone to a workspace.',
    stream: 'transactional',
    subject: '{{ inviter }} invited you to {{ team }}',
    variables: [
      product,
      v('inviter', { example: 'Ada' }),
      v('team', { example: 'Acme Ops' }),
      v('url', { type: 'url', sensitive: true, example: 'https://example.com/invite/…' }),
    ],
    document: {
      blocks: [
        header,
        text('Join {{ team }}', 'heading'),
        text('{{ inviter }} invited you to collaborate on {{ product }}.'),
        button('Accept invitation', '{{ url }}'),
        footer(),
      ],
    },
  },
  {
    id: 'notification',
    name: 'Notification',
    description: 'Short activity alert.',
    stream: 'notifications',
    subject: '{{ title }}',
    variables: [
      product,
      v('title', { example: 'Your export is ready' }),
      v('body', { example: 'The CSV export you requested is ready to download.' }),
      v('url', { type: 'url', example: 'https://example.com/exports/1' }),
    ],
    document: {
      blocks: [
        header,
        text('{{ title }}', 'large'),
        text('{{ body }}'),
        button('Open', '{{ url }}'),
        footer('Change notification settings in {{ product }}.'),
      ],
    },
  },
  {
    id: 'digest',
    name: 'Digest',
    description: 'Periodic summary of updates.',
    stream: 'notifications',
    subject: 'Your weekly {{ product }} summary',
    variables: [
      product,
      v('updates', {
        type: 'list',
        example: [{ title: '3 new comments', url: 'https://example.com/c' }],
      }),
    ],
    document: {
      blocks: [
        header,
        text('This week', 'heading'),
        {
          type: 'html',
          content:
            '<ul style="padding-left:20px;margin:0 0 16px;font-size:15px;line-height:1.6">{% for u in updates %}<li><a href="{{ u.url }}">{{ u.title }}</a></li>{% endfor %}</ul>',
        },
        footer('You get this summary weekly. Change it in {{ product }} settings.'),
      ],
    },
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    description: 'Opted-in announcement with image and two columns.',
    stream: 'marketing',
    subject: '{{ headline }}',
    variables: [
      product,
      v('headline', { example: 'What is new this month' }),
      v('url', { type: 'url', example: 'https://example.com/blog' }),
    ],
    document: {
      preheader: 'Highlights from {{ product }}',
      blocks: [
        header,
        {
          type: 'image',
          src: 'https://placehold.co/600x240/png',
          alt: 'Product illustration',
          align: 'center',
        },
        text('{{ headline }}', 'heading'),
        text('A short introduction to this issue.'),
        {
          type: 'columns',
          columns: [
            { blocks: [text('Feature one', 'large'), text('One sentence about it.')] },
            { blocks: [text('Feature two', 'large'), text('One sentence about it.')] },
          ],
        },
        button('Read more', '{{ url }}'),
        footer('You subscribed to {{ product }} news.'),
      ],
    },
  },
]

export function findStarter(id: string): Starter | undefined {
  return STARTERS.find((s) => s.id === id)
}

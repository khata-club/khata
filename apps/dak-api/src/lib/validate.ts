import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodType } from 'zod'

import { HttpError } from './errors'

/** zod validation that fails with `{ error: { code: 'validation_failed', details } }`. */
export function validate<T extends ZodType, K extends keyof ValidationTargets>(
  target: K,
  schema: T,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new HttpError(422, 'validation_failed', 'The request is invalid.', {
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      })
    }
  })
}

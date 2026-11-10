import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import type { ZodType } from 'zod'

type Target = 'json' | 'query' | 'param'

/** zod validation that answers 400 with field issues the UI can show. */
export const validate = <T extends ZodType, K extends Target>(target: K, schema: T) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: 'validation',
          issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        400,
      )
    }
  })

export const notFound = (what = 'Not found') => new HTTPException(404, { message: what })
export const badRequest = (message: string) => new HTTPException(400, { message })

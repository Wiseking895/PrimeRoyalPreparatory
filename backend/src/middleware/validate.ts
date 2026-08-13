import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { ZodType } from 'zod'

/**
 * Validates `req.body` against a Zod schema (server-side). Invalid payloads
 * receive a structured 422 response with per-field errors.
 */
export function validate(schema: ZodType): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      res.status(422).json({
        success: false,
        statusCode: 422,
        message: 'Validation failed.',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'body',
          message: issue.message,
        })),
      })
      return
    }
    req.body = result.data
    next()
  }
}
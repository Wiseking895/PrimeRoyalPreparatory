import { HttpStatus, type ApiErrorResponse } from '@prps/shared'
import type { Request, Response } from 'express'

/**
 * 404 handler. Mounted after all API routes so unknown paths return a
 * structured JSON error instead of the default HTML page.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorResponse = {
    success: false,
    statusCode: HttpStatus.NotFound,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  }
  res.status(HttpStatus.NotFound).json(body)
}

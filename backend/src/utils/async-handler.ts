import type { NextFunction, Request, RequestHandler, Response } from 'express'

/**
 * Wraps an async request handler so rejected promises are forwarded to the
 * centralized error handler instead of crashing the process.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

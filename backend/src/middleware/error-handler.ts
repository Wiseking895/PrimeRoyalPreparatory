import { HttpStatus, type ApiErrorResponse } from '@prps/shared'
import type { ErrorRequestHandler } from 'express'
import { env } from '../config/env'
import { logger } from '../config/logger'
import { AppError } from '../utils/app-error'

/**
 * Centralized error handler. Maps operational errors (AppError) to their
 * status codes, hides internals from clients, and logs unexpected failures.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const isAppError = err instanceof AppError
  const statusCode = isAppError ? err.statusCode : HttpStatus.InternalServerError
  const message = isAppError ? err.message : 'An unexpected error occurred'

  if (statusCode >= HttpStatus.InternalServerError) {
    logger.error({ err, statusCode }, message)
  } else {
    logger.warn({ err, statusCode }, message)
  }

  const body: ApiErrorResponse = {
    success: false,
    statusCode,
    message,
    ...(env.nodeEnv === 'development' && !isAppError && err instanceof Error
      ? { errors: err.message }
      : {}),
  }
  res.status(statusCode).json(body)
}

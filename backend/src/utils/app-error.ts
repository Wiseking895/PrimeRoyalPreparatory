import { HttpStatus } from '../config/enums'

/**
 * Operational error carrying an HTTP status code. Controllers/services throw
 * this instead of raw errors so the centralized error handler can map them to
 * proper responses without leaking internals.
 */
export class AppError extends Error {
  readonly statusCode: HttpStatus
  readonly details?: unknown

  constructor(message: string, statusCode: HttpStatus = HttpStatus.InternalServerError, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.details = details
  }
}

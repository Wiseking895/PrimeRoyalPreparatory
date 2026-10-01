/**
 * Application environment values. Mirrors NODE_ENV conventions.
 */
export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Global HTTP status codes used by API responses and error handling.
 */
export enum HttpStatus {
  Ok = 200,
  Created = 201,
  NoContent = 204,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  Conflict = 409,
  UnprocessableEntity = 422,
  InternalServerError = 500,
  /** An upstream service (e.g. the Google OAuth endpoints) could not be reached. */
  BadGateway = 502,
  /** Required infrastructure (e.g. object storage) is not available/configured. */
  ServiceUnavailable = 503,
}
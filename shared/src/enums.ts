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
}

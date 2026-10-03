import { Environment } from './enums.js'
import { pino, type Logger } from 'pino'
import { env } from './env.js'

const level =
  env.nodeEnv === Environment.Test ? 'silent' : env.isProduction ? 'info' : 'debug'

/**
 * Credential headers that must never reach the log stream.
 *
 * `pino-http` serialises **every** incoming request header (pino-std-serializers
 * copies `req.headers` verbatim), so without redaction every authenticated
 * request would write its `Authorization: Bearer <jwt>` access token to the
 * server log in plaintext — a 12-hour session credential exposed to anyone with
 * log access. Cookies and API-key style headers are redacted for the same
 * reason.
 */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
] as const

/**
 * Structured application logger (pino). The HTTP request logger (pino-http)
 * reuses this instance so request logs carry the same formatting and level.
 */
export const logger: Logger = pino({ level, redact: { paths: [...LOG_REDACT_PATHS], censor: '[Redacted]' } })

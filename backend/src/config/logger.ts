import { Environment } from '@prps/shared'
import { pino, type Logger } from 'pino'
import { env } from './env'

const level =
  env.nodeEnv === Environment.Test ? 'silent' : env.isProduction ? 'info' : 'debug'

/**
 * Structured application logger (pino). The HTTP request logger (pino-http)
 * reuses this instance so request logs carry the same formatting and level.
 */
export const logger: Logger = pino({ level })

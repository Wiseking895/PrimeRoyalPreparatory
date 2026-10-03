import { describe, expect, it } from 'vitest'
import { pino } from 'pino'
import { LOG_REDACT_PATHS } from './logger'

/**
 * Regression coverage for credential redaction.
 *
 * pino-http logs every incoming request header (pino-std-serializers copies
 * `req.headers` verbatim), so these paths must keep `Authorization` bearer
 * tokens, cookies and API keys out of the log stream.
 */
function captureLog(record: Record<string, unknown>): string {
  let output = ''
  const stream = {
    write(chunk: string) {
      output += chunk
      return true
    },
  }
  const log = pino(
    { level: 'info', redact: { paths: [...LOG_REDACT_PATHS], censor: '[Redacted]' } },
    stream,
  )
  log.info(record, 'request completed')
  return output
}

describe('logger credential redaction', () => {
  it('redacts the Authorization bearer token from logged requests', () => {
    const output = captureLog({
      req: {
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: 'Bearer super-secret-jwt', host: 'localhost:4000' },
      },
    })

    expect(output).not.toContain('super-secret-jwt')
    expect(output).toContain('[Redacted]')
    expect(output).toContain('localhost:4000')
  })

  it('redacts cookie and API-key headers', () => {
    const output = captureLog({
      req: {
        method: 'GET',
        url: '/api/me',
        headers: { cookie: 'session=abc', 'x-api-key': 'key-123' },
      },
    })

    expect(output).not.toContain('session=abc')
    expect(output).not.toContain('key-123')
  })

  it('redacts Set-Cookie response headers', () => {
    const output = captureLog({
      res: { statusCode: 200, headers: { 'set-cookie': 'auth=tok' } },
    })

    expect(output).not.toContain('auth=tok')
  })
})

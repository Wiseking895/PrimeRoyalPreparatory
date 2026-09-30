import { afterEach, describe, expect, it, vi } from 'vitest'
import { PRODUCTION_CLIENT_URL, resolveClientOrigins, resolveJwtSecret } from './env'

/** The known development placeholder — never valid in production. */
const DEV_PLACEHOLDER = 'unsafe-default-change-me'

describe('resolveJwtSecret', () => {
  it('keeps the local development fallback when JWT_SECRET is not configured', () => {
    expect(resolveJwtSecret(false, undefined)).toBe(DEV_PLACEHOLDER)
    expect(resolveJwtSecret(false, '')).toBe(DEV_PLACEHOLDER)
    expect(resolveJwtSecret(false, '   ')).toBe(DEV_PLACEHOLDER)
  })

  it('uses an explicitly provided secret outside production', () => {
    expect(resolveJwtSecret(false, 'local-dev-secret')).toBe('local-dev-secret')
  })

  it('fails fast in production when JWT_SECRET is missing or empty', () => {
    expect(() => resolveJwtSecret(true, undefined)).toThrow(/JWT_SECRET is required/)
    expect(() => resolveJwtSecret(true, '')).toThrow(/JWT_SECRET is required/)
    expect(() => resolveJwtSecret(true, '   ')).toThrow(/JWT_SECRET is required/)
  })

  it('rejects the development placeholder secret in production', () => {
    expect(() => resolveJwtSecret(true, DEV_PLACEHOLDER)).toThrow(/development placeholder/)
    expect(() => resolveJwtSecret(true, ` ${DEV_PLACEHOLDER} `)).toThrow(/development placeholder/)
  })

  it('accepts an explicit non-placeholder secret in production', () => {
    expect(resolveJwtSecret(true, 'a-strong-production-secret')).toBe('a-strong-production-secret')
  })

  it('never leaks configured secret values through configuration errors', () => {
    const messages: string[] = []
    for (const raw of [undefined, '', DEV_PLACEHOLDER, 'a-strong-production-secret']) {
      try {
        resolveJwtSecret(true, raw)
      } catch (error) {
        messages.push((error as Error).message)
      }
    }

    expect(messages).toHaveLength(3)
    expect(messages.join(' ')).not.toContain(DEV_PLACEHOLDER)
    expect(messages.join(' ')).not.toContain('a-strong-production-secret')
  })
})

describe('resolveClientOrigins', () => {
  it('allows the deployed frontend in production even when CLIENT_URL is missing', () => {
    expect(resolveClientOrigins(undefined, true)).toEqual([PRODUCTION_CLIENT_URL])
    expect(resolveClientOrigins('', true)).toEqual([PRODUCTION_CLIENT_URL])
    expect(resolveClientOrigins('   ', true)).toEqual([PRODUCTION_CLIENT_URL])
  })

  it('keeps the deployed frontend allowed when CLIENT_URL points elsewhere', () => {
    const origins = resolveClientOrigins('https://stale-frontend.example', true)
    expect(origins).toContain(PRODUCTION_CLIENT_URL)
    expect(origins).toContain('https://stale-frontend.example')
  })

  it('supports comma-separated origins and de-duplicates them', () => {
    const origins = resolveClientOrigins(`${PRODUCTION_CLIENT_URL}, https://preview.vercel.app,`, true)
    expect(origins).toEqual([PRODUCTION_CLIENT_URL, 'https://preview.vercel.app'])
  })

  it('normalises whitespace and trailing slashes so an exact match is not required', () => {
    const origins = resolveClientOrigins(`  ${PRODUCTION_CLIENT_URL}/  `, true)
    expect(origins).toEqual([PRODUCTION_CLIENT_URL])
  })

  it('never produces a wildcard origin', () => {
    for (const origins of [resolveClientOrigins(undefined, true), resolveClientOrigins('*', true)]) {
      expect(origins).not.toContain('*')
      expect(origins.every((origin) => origin.startsWith('http'))).toBe(true)
    }
  })

  it('defaults to the local dev server outside production', () => {
    expect(resolveClientOrigins(undefined, false)).toEqual(['http://localhost:5173'])
    expect(resolveClientOrigins(undefined, false)).not.toContain(PRODUCTION_CLIENT_URL)
  })
})

describe('env configuration at startup', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalJwtSecret = process.env.JWT_SECRET

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = originalJwtSecret
    vi.resetModules()
  })

  it('throws while loading configuration in production without JWT_SECRET', async () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = ''
    vi.resetModules()

    await expect(import('./env')).rejects.toThrow(/JWT_SECRET is required/)
  })

  it('loads in production with an explicit JWT_SECRET', async () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'prps-explicit-production-secret'
    vi.resetModules()

    const loaded = await import('./env')
    expect(loaded.env.jwtSecret).toBe('prps-explicit-production-secret')
    expect(loaded.env.isProduction).toBe(true)
  })

  it('still starts local development without JWT_SECRET', async () => {
    process.env.NODE_ENV = 'development'
    process.env.JWT_SECRET = ''
    vi.resetModules()

    const loaded = await import('./env')
    expect(loaded.env.jwtSecret).toBe(DEV_PLACEHOLDER)
    expect(loaded.env.isProduction).toBe(false)
  })
})

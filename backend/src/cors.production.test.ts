import type { Express } from 'express'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * End-to-end CORS coverage for the deployed configuration.
 *
 * `createApp()` is loaded with `NODE_ENV=production` so the production branch of
 * the CORS allowlist is exercised exactly as the Vercel function runs it, then
 * the browser's preflight for `POST /api/auth/login` is replayed with supertest.
 */
const FRONTEND_ORIGIN = 'https://prime-royal-preparatory-frontend.vercel.app'
const PRODUCTION_JWT_SECRET = 'prps-cors-test-secret-not-a-real-key-0123456789'

const original = {
  nodeEnv: process.env.NODE_ENV,
  jwtSecret: process.env.JWT_SECRET,
  clientUrl: process.env.CLIENT_URL,
}

async function loadProductionApp(clientUrl: string): Promise<Express> {
  vi.resetModules()
  process.env.NODE_ENV = 'production'
  process.env.JWT_SECRET = PRODUCTION_JWT_SECRET
  process.env.CLIENT_URL = clientUrl

  const { createApp } = await import('./app')
  return createApp()
}

function preflight(app: Express, origin: string, headers = 'authorization,content-type') {
  return request(app)
    .options('/api/auth/login')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', headers)
}

function restoreEnv(): void {
  if (original.nodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = original.nodeEnv
  if (original.jwtSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = original.jwtSecret
  if (original.clientUrl === undefined) delete process.env.CLIENT_URL
  else process.env.CLIENT_URL = original.clientUrl
}

afterAll(restoreEnv)

describe('production CORS preflight for POST /api/auth/login', () => {
  let app: Express

  beforeAll(async () => {
    // Simulate the reported deployment: CLIENT_URL missing or pointing elsewhere.
    // Loading the full production module graph (env validation + createApp)
    // exceeds the default 10s hook timeout on slower machines, which surfaced
    // as flaky failures/skips in this security suite.
    app = await loadProductionApp('')
  }, 30_000)

  it('answers the preflight with the deployed frontend origin', async () => {
    const res = await preflight(app, FRONTEND_ORIGIN)

    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND_ORIGIN)
    expect(res.headers['access-control-allow-credentials']).toBe('true')
  })

  it('allows the headers the authentication client actually sends', async () => {
    const res = await preflight(app, FRONTEND_ORIGIN)

    const allowedHeaders = String(res.headers['access-control-allow-headers']).toLowerCase()
    expect(allowedHeaders).toContain('content-type')
    expect(allowedHeaders).toContain('authorization')
  })

  it('allows the HTTP methods the API already exposes', async () => {
    const res = await preflight(app, FRONTEND_ORIGIN)

    const allowedMethods = String(res.headers['access-control-allow-methods']).toUpperCase()
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(allowedMethods).toContain(method)
    }
  })

  it('rejects an origin that is not the frontend', async () => {
    const res = await preflight(app, 'https://evil.example')

    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('still sets CORS headers on the actual POST response', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Content-Type', 'application/json')
      .send('{}')

    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND_ORIGIN)
    expect(res.headers['access-control-allow-credentials']).toBe('true')
    // Validation rejects the payload before any database access.
    expect(res.status).toBe(422)
  })
})

describe('production CORS preflight with a stale CLIENT_URL', () => {
  it('keeps the deployed frontend allowed', async () => {
    const app = await loadProductionApp('https://stale-frontend-six.vercel.app')
    const res = await preflight(app, FRONTEND_ORIGIN)

    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND_ORIGIN)
  }, 30_000)

  it('never answers with a wildcard', async () => {
    const app = await loadProductionApp('*')
    const res = await preflight(app, FRONTEND_ORIGIN)

    expect(res.headers['access-control-allow-origin']).not.toBe('*')
    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND_ORIGIN)
  }, 30_000)
})

describe('development CORS', () => {
  it('reflects the requesting origin so localhost keeps working', async () => {
    vi.resetModules()
    process.env.NODE_ENV = 'development'
    process.env.CLIENT_URL = 'http://localhost:5173'

    const { createApp } = await import('./app')
    const app = createApp()
    const res = await preflight(app, 'http://localhost:5173')

    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(res.headers['access-control-allow-credentials']).toBe('true')

    restoreEnv()
  })
})

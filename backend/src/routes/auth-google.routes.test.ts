import jwt from 'jsonwebtoken'
import request from 'supertest'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'

// Must run before `../app` pulls in `config/env`, which reads the environment
// once at import time.
vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
  delete process.env.GOOGLE_REDIRECT_URI
  process.env.CLIENT_URL = 'http://localhost:5173'
})

const ownerExistsMock = vi.hoisted(() => vi.fn())
const createOwnerFromGoogleMock = vi.hoisted(() => vi.fn())
const googleConfiguredMock = vi.hoisted(() => vi.fn(() => true))

vi.mock('../services/setup.service', () => ({
  ownerExists: ownerExistsMock,
  createOwner: vi.fn(),
  createOwnerFromGoogle: createOwnerFromGoogleMock,
}))

// Only the configuration probe is stubbed so the state signing, redirect URI
// resolution and code exchange all run for real.
vi.mock('../services/google-oauth.service', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, isGoogleOAuthConfigured: googleConfiguredMock }
})

const app = createApp()
const FRONTEND = 'http://localhost:5173'

const OWNER = {
  id: 'owner-1',
  fullName: 'Ada Lovelace',
  email: 'ada@gmail.com',
  phone: null,
  profilePictureUrl: null,
  status: 'ACTIVE',
  lastLoginAt: null,
  mustChangePassword: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
}

const fetchMock = vi.fn()

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

/** Starts the flow and returns the `state` Google would be sent back with. */
async function startFlow(): Promise<string> {
  const res = await request(app).get('/api/auth/google/start').expect(302)
  const url = new URL(res.headers.location)
  expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
  const state = url.searchParams.get('state')
  if (!state) throw new Error('authorization URL is missing the state parameter')
  return state
}

describe('Google OAuth owner sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    googleConfiguredMock.mockReturnValue(true)
    ownerExistsMock.mockResolvedValue(false)
    createOwnerFromGoogleMock.mockResolvedValue(OWNER)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  afterAll(() => {
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    delete process.env.CLIENT_URL
  })

  describe('GET /api/auth/google/start', () => {
    it('redirects to Google with a signed state and the derived callback URI', async () => {
      const res = await request(app).get('/api/auth/google/start').expect(302)

      const url = new URL(res.headers.location)
      expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
      expect(url.searchParams.get('client_id')).toBe('test-client-id')
      expect(url.searchParams.get('response_type')).toBe('code')
      expect(url.searchParams.get('scope')).toBe('openid email profile')
      expect(url.searchParams.get('prompt')).toBe('select_account')
      expect(url.searchParams.get('redirect_uri')?.endsWith('/api/auth/google/callback')).toBe(true)

      const payload = jwt.decode(url.searchParams.get('state')!) as { purpose?: string } | null
      expect(payload?.purpose).toBe('owner-setup')
    })

    it('sends the visitor back to onboarding when Google OAuth is not configured', async () => {
      googleConfiguredMock.mockReturnValue(false)
      const res = await request(app).get('/api/auth/google/start').expect(302)
      expect(res.headers.location).toBe(`${FRONTEND}/setup/owner?error=unavailable`)
    })
  })

  describe('GET /api/auth/google/callback', () => {
    it('sends a missing state back to onboarding', async () => {
      const res = await request(app).get('/api/auth/google/callback?code=abc').expect(302)
      expect(res.headers.location).toBe(`${FRONTEND}/setup/owner?error=state`)
      expect(createOwnerFromGoogleMock).not.toHaveBeenCalled()
    })

    it('sends a tampered state back to onboarding', async () => {
      const res = await request(app)
        .get('/api/auth/google/callback?code=abc&state=not-a-real-state')
        .expect(302)
      expect(res.headers.location).toBe(`${FRONTEND}/setup/owner?error=state`)
    })

    it('surfaces a provider denial', async () => {
      const res = await request(app).get('/api/auth/google/callback?error=access_denied').expect(302)
      expect(res.headers.location).toBe(`${FRONTEND}/setup/owner?error=denied`)
      expect(createOwnerFromGoogleMock).not.toHaveBeenCalled()
    })

    it('exchanges the code, provisions the Owner and hands back a session token', async () => {
      const state = await startFlow()

      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'google-access-token' }))
        .mockResolvedValueOnce(
          jsonResponse({ sub: 'g-123', email: 'Ada@Gmail.com', name: ' Ada Lovelace ', email_verified: true }),
        )

      const res = await request(app)
        .get(`/api/auth/google/callback?code=auth-code&state=${encodeURIComponent(state)}`)
        .expect(302)

      expect(res.headers.location.startsWith(`${FRONTEND}/setup/owner#token=`)).toBe(true)
      const token = decodeURIComponent(res.headers.location.split('#token=')[1])
      const payload = jwt.decode(token) as { sub?: string; kind?: string } | null
      expect(payload?.sub).toBe('owner-1')
      expect(payload?.kind).toBe('staff')

      expect(createOwnerFromGoogleMock).toHaveBeenCalledWith(
        { googleId: 'g-123', email: 'ada@gmail.com', fullName: 'Ada Lovelace' },
        expect.anything(),
      )
    })

    it('never provisions when a school Owner already exists', async () => {
      ownerExistsMock.mockResolvedValue(true)
      const state = await startFlow()

      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'google-access-token' }))
        .mockResolvedValueOnce(jsonResponse({ sub: 'g-123', email: 'ada@gmail.com', name: 'Ada Lovelace' }))

      const res = await request(app)
        .get(`/api/auth/google/callback?code=auth-code&state=${encodeURIComponent(state)}`)
        .expect(302)

      expect(res.headers.location).toBe(`${FRONTEND}/login?setup=complete`)
      expect(createOwnerFromGoogleMock).not.toHaveBeenCalled()
    })

    it('reports a failed token exchange without leaking provider details', async () => {
      const state = await startFlow()
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid_grant' }, false, 400))

      const res = await request(app)
        .get(`/api/auth/google/callback?code=auth-code&state=${encodeURIComponent(state)}`)
        .expect(302)

      expect(res.headers.location).toBe(`${FRONTEND}/setup/owner?error=unavailable`)
      expect(createOwnerFromGoogleMock).not.toHaveBeenCalled()
    })

    it('rejects an unverified Google email address', async () => {
      const state = await startFlow()
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'google-access-token' }))
        .mockResolvedValueOnce(
          jsonResponse({ sub: 'g-123', email: 'ada@gmail.com', name: 'Ada Lovelace', email_verified: false }),
        )

      const res = await request(app)
        .get(`/api/auth/google/callback?code=auth-code&state=${encodeURIComponent(state)}`)
        .expect(302)

      expect(res.headers.location).toBe(`${FRONTEND}/setup/owner?error=profile`)
      expect(createOwnerFromGoogleMock).not.toHaveBeenCalled()
    })
  })
})

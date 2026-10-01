import jwt from 'jsonwebtoken'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpStatus } from '../config/enums'

const envMock = vi.hoisted(() => ({
  jwtSecret: 'unit-test-secret',
  googleClientId: 'cid',
  googleClientSecret: 'csecret',
  googleRedirectUri: '',
  googleOAuthEnabled: true,
}))

vi.mock('../config/env', () => ({ env: envMock }))

import {
  buildAuthorizationUrl,
  exchangeCodeForProfile,
  isGoogleOAuthConfigured,
  resolveRedirectUri,
  signSetupState,
  verifySetupState,
} from './google-oauth.service'

const fetchMock = vi.fn()

describe('google-oauth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    envMock.googleRedirectUri = ''
    envMock.googleOAuthEnabled = true
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('configuration', () => {
    it('reports OAuth as configured only when the flag is set', () => {
      envMock.googleOAuthEnabled = false
      expect(isGoogleOAuthConfigured()).toBe(false)
      envMock.googleOAuthEnabled = true
      expect(isGoogleOAuthConfigured()).toBe(true)
    })
  })

  describe('redirect URI', () => {
    it('derives the callback from the request origin', () => {
      expect(resolveRedirectUri('https://api.example.com')).toBe('https://api.example.com/api/auth/google/callback')
      expect(resolveRedirectUri('https://api.example.com/')).toBe('https://api.example.com/api/auth/google/callback')
    })

    it('keeps the local development callback functional', () => {
      expect(resolveRedirectUri('http://localhost:4000')).toBe('http://localhost:4000/api/auth/google/callback')
      expect(resolveRedirectUri('http://127.0.0.1:4000')).toBe('http://127.0.0.1:4000/api/auth/google/callback')
    })

    it('prefers an explicitly configured redirect URI', () => {
      envMock.googleRedirectUri = 'https://pinned.example.com/api/auth/google/callback'
      expect(resolveRedirectUri('https://other.example.com')).toBe(
        'https://pinned.example.com/api/auth/google/callback',
      )
    })

    it('uses the pinned production callback for the deployed frontend origin', () => {
      envMock.googleRedirectUri = 'https://prime-royal-preparatory.vercel.app/api/auth/google/callback'
      expect(resolveRedirectUri('https://prime-royal-preparatory-frontend.vercel.app')).toBe(
        'https://prime-royal-preparatory.vercel.app/api/auth/google/callback',
      )
    })
  })

  describe('state token', () => {
    it('accepts a state it signed itself', () => {
      expect(verifySetupState(signSetupState())).toBe(true)
    })

    it('rejects a staff session token signed with the same secret', () => {
      const sessionToken = jwt.sign({ sub: 'owner-1', kind: 'staff' }, envMock.jwtSecret, { expiresIn: '12h' })
      expect(verifySetupState(sessionToken)).toBe(false)
    })

    it('rejects an expired state', () => {
      const expired = jwt.sign({ purpose: 'owner-setup' }, envMock.jwtSecret, { expiresIn: '-10s' })
      expect(verifySetupState(expired)).toBe(false)
    })

    it('rejects missing or non-string state values', () => {
      expect(verifySetupState(undefined)).toBe(false)
      expect(verifySetupState('')).toBe(false)
      expect(verifySetupState(42)).toBe(false)
    })
  })

  describe('authorization URL', () => {
    it('builds a Google authorization request carrying the state', () => {
      const url = new URL(buildAuthorizationUrl('https://api.example.com/api/auth/google/callback', 'the-state'))
      expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
      expect(url.searchParams.get('client_id')).toBe('cid')
      expect(url.searchParams.get('redirect_uri')).toBe('https://api.example.com/api/auth/google/callback')
      expect(url.searchParams.get('state')).toBe('the-state')
      expect(url.searchParams.get('response_type')).toBe('code')
    })
  })

  describe('code exchange', () => {
    it('returns the verified identity with a normalised email and name', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at' }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sub: 'g-1', email: ' ADA@Gmail.COM ', name: '  Ada Lovelace ', email_verified: true }),
        })

      await expect(exchangeCodeForProfile('code', 'https://api.example.com/cb')).resolves.toEqual({
        googleId: 'g-1',
        email: 'ada@gmail.com',
        fullName: 'Ada Lovelace',
      })
    })

    it('falls back to the email local part when Google returns no name', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: 'g-1', email: 'owner@school.edu' }) })

      const profile = await exchangeCodeForProfile('code', 'https://api.example.com/cb')
      expect(profile.fullName).toBe('owner')
    })

    it('raises a 502 when the token endpoint rejects the code', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) })

      await expect(exchangeCodeForProfile('bad', 'https://api.example.com/cb')).rejects.toMatchObject({
        statusCode: HttpStatus.BadGateway,
      })
    })

    it('raises a 400 when the account does not share an email address', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: 'g-1' }) })

      await expect(exchangeCodeForProfile('code', 'https://api.example.com/cb')).rejects.toMatchObject({
        statusCode: HttpStatus.BadRequest,
      })
    })
  })
})

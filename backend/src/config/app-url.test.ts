import { describe, expect, it } from 'vitest'
import { DEFAULT_CLIENT_URL, PRODUCTION_CLIENT_URL, resolveAppUrl } from './app-url'

describe('resolveAppUrl', () => {
  describe('development', () => {
    it('keeps local runs on the Vite dev server', () => {
      expect(resolveAppUrl(undefined, false)).toBe('http://localhost:5173')
      expect(resolveAppUrl('', false)).toBe(DEFAULT_CLIENT_URL)
      expect(resolveAppUrl('   ', false)).toBe(DEFAULT_CLIENT_URL)
      expect(resolveAppUrl('not-a-url', false)).toBe(DEFAULT_CLIENT_URL)
      expect(resolveAppUrl('http://localhost:5173', false)).toBe('http://localhost:5173')
    })

    it('honours a locally configured CLIENT_URL', () => {
      expect(resolveAppUrl('http://localhost:5173/', false)).toBe('http://localhost:5173')
      expect(resolveAppUrl('https://staging.prps.example', false)).toBe('https://staging.prps.example')
    })
  })

  describe('production', () => {
    it('never emits a localhost link', () => {
      expect(resolveAppUrl(undefined, true)).toBe(PRODUCTION_CLIENT_URL)
      expect(resolveAppUrl('', true)).toBe(PRODUCTION_CLIENT_URL)
      expect(resolveAppUrl('   ', true)).toBe(PRODUCTION_CLIENT_URL)
      expect(resolveAppUrl('not-a-url', true)).toBe(PRODUCTION_CLIENT_URL)
      expect(resolveAppUrl('http://localhost:5173', true)).toBe(PRODUCTION_CLIENT_URL)
      expect(resolveAppUrl('http://127.0.0.1:5173', true)).toBe(PRODUCTION_CLIENT_URL)
      expect(resolveAppUrl('http://[::1]:5173', true)).toBe(PRODUCTION_CLIENT_URL)
    })

    it('uses the configured CLIENT_URL when it is a real public origin', () => {
      expect(resolveAppUrl(PRODUCTION_CLIENT_URL, true)).toBe(PRODUCTION_CLIENT_URL)
      expect(resolveAppUrl(`${PRODUCTION_CLIENT_URL}/`, true)).toBe(PRODUCTION_CLIENT_URL)
      expect(resolveAppUrl('  https://custom-domain.prps.example  ', true)).toBe(
        'https://custom-domain.prps.example',
      )
    })

    it('uses the first origin of a comma-separated CLIENT_URL', () => {
      expect(resolveAppUrl(`${PRODUCTION_CLIENT_URL}, https://preview.vercel.app`, true)).toBe(
        PRODUCTION_CLIENT_URL,
      )
      expect(resolveAppUrl('https://preview.vercel.app, http://localhost:5173', true)).toBe(
        'https://preview.vercel.app',
      )
    })
  })

  it('builds the expected application links in both environments', () => {
    expect(`${resolveAppUrl(undefined, false)}/parent/login`).toBe('http://localhost:5173/parent/login')
    expect(`${resolveAppUrl(undefined, false)}/staff/login`).toBe('http://localhost:5173/staff/login')
    expect(`${resolveAppUrl(undefined, false)}/login`).toBe('http://localhost:5173/login')

    expect(`${resolveAppUrl(undefined, true)}/parent/login`).toBe(
      'https://prime-royal-preparatory-frontend.vercel.app/parent/login',
    )
    expect(`${resolveAppUrl(undefined, true)}/staff/login`).toBe(
      'https://prime-royal-preparatory-frontend.vercel.app/staff/login',
    )
    expect(`${resolveAppUrl(undefined, true)}/login`).toBe(
      'https://prime-royal-preparatory-frontend.vercel.app/login',
    )
    expect(`${resolveAppUrl('http://localhost:5173', true)}/parent/login`).toBe(
      'https://prime-royal-preparatory-frontend.vercel.app/parent/login',
    )
  })
})

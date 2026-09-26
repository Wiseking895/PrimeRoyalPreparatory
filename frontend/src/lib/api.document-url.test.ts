import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, API_BASE_URL, DOCUMENT_REFERENCE_PREFIX, isDocumentReference } from './api'
import type { ApiError } from './api'

const STAFF_TOKEN_KEY = 'prps.portal.token'
const PARENT_TOKEN_KEY = 'prps.parent.token'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function envelope(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, message: 'ok', data }),
  }
}

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isDocumentReference', () => {
  it('recognises only internal object-store references', () => {
    expect(DOCUMENT_REFERENCE_PREFIX).toBe('/api/documents/')
    expect(isDocumentReference('/api/documents/doc-1')).toBe(true)
    expect(isDocumentReference('/api/uploads/profile-pictures/legacy.jpg')).toBe(false)
    expect(isDocumentReference('https://example.com/x.png')).toBe(false)
    expect(isDocumentReference('')).toBe(false)
    expect(isDocumentReference(null)).toBe(false)
    expect(isDocumentReference(undefined)).toBe(false)
  })
})

describe('api.resolveDocumentUrl', () => {
  it('uses the staff session endpoint when a portal token exists', async () => {
    localStorage.setItem(STAFF_TOKEN_KEY, 'staff-token')

    fetchMock.mockResolvedValue(
      envelope({ documentId: 'doc-1', url: 'https://acct.r2.test/k?sig=a', expiresInSeconds: 300 }),
    )

    const url = await api.resolveDocumentUrl('/api/documents/doc-1')

    expect(url).toBe('https://acct.r2.test/k?sig=a')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [requestUrl, init] = fetchMock.mock.calls[0]
    expect(requestUrl).toBe(`${API_BASE_URL}/api/documents/doc-1/url`)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer staff-token')
  })

  it('falls back to the parent-portal endpoint when only a parent token exists', async () => {
    localStorage.setItem(PARENT_TOKEN_KEY, 'parent-token')

    fetchMock.mockResolvedValue(
      envelope({ documentId: 'doc-1', url: 'https://acct.r2.test/k?sig=b', expiresInSeconds: 300 }),
    )

    const url = await api.resolveDocumentUrl('/api/documents/doc-1')

    expect(url).toBe('https://acct.r2.test/k?sig=b')
    const [requestUrl, init] = fetchMock.mock.calls[0]
    expect(requestUrl).toBe(`${API_BASE_URL}/api/parent/documents/doc-1/url`)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer parent-token')
  })

  it('prefers the staff session when both sessions are active', async () => {
    localStorage.setItem(STAFF_TOKEN_KEY, 'staff-token')
    localStorage.setItem(PARENT_TOKEN_KEY, 'parent-token')
    fetchMock.mockResolvedValue(envelope({ url: 'https://r2.test/x', expiresInSeconds: 300 }))

    await api.resolveDocumentUrl('/api/documents/doc-1')

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/api/documents/doc-1/url`)
  })

  it('fails clearly with 401 when no session is active', async () => {
    await expect(api.resolveDocumentUrl('/api/documents/doc-1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('encodes the document id and never returns object keys', async () => {
    localStorage.setItem(STAFF_TOKEN_KEY, 'staff-token')
    fetchMock.mockResolvedValue(envelope({ url: 'https://r2.test/x', expiresInSeconds: 300 }))

    await api.resolveDocumentUrl('/api/documents/doc id/../admin')

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_BASE_URL}/api/documents/doc%20id%2F..%2Fadmin/url`,
    )
  })

  it('propagates backend failures as ApiError', async () => {
    localStorage.setItem(STAFF_TOKEN_KEY, 'staff-token')
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: () =>
        Promise.resolve({
          success: false,
          message: 'Object storage is not configured.',
        }),
    })

    await expect(api.resolveDocumentUrl('/api/documents/doc-1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
      message: 'Object storage is not configured.',
    } satisfies Partial<ApiError>)
  })

  it('never persists the presigned URL in browser storage', async () => {
    localStorage.setItem(STAFF_TOKEN_KEY, 'staff-token')
    fetchMock.mockResolvedValue(
      envelope({ documentId: 'doc-1', url: 'https://acct.r2.test/k?sig=z', expiresInSeconds: 300 }),
    )

    await api.resolveDocumentUrl('/api/documents/doc-1')

    expect(localStorage.getItem(STAFF_TOKEN_KEY)).toBe('staff-token')
    expect(JSON.stringify(Object.fromEntries(Object.entries(localStorage)))).not.toContain(
      'acct.r2.test',
    )
  })
})

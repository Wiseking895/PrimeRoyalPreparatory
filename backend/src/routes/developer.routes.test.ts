import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'

const verifyTokenMock = vi.hoisted(() => vi.fn())
const signTokenMock = vi.hoisted(() => vi.fn())
const signImpersonationTokenMock = vi.hoisted(() => vi.fn())
const isDeveloperAccountMock = vi.hoisted(() => vi.fn())
const listImpersonatableAccountsMock = vi.hoisted(() => vi.fn())
const validateImpersonationTargetMock = vi.hoisted(() => vi.fn())
const recordImpersonationStartMock = vi.hoisted(() => vi.fn())
const recordImpersonationEndMock = vi.hoisted(() => vi.fn())
const recordImpersonationSwitchMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}))

vi.mock('../lib/jwt', () => ({
  verifyToken: verifyTokenMock,
  verifyTokenPayload: verifyTokenMock,
  signToken: signTokenMock,
  signImpersonationToken: signImpersonationTokenMock,
}))
vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('../services/developer.service', () => ({
  isDeveloperAccount: isDeveloperAccountMock,
  listImpersonatableAccounts: listImpersonatableAccountsMock,
  validateImpersonationTarget: validateImpersonationTargetMock,
  recordImpersonationStart: recordImpersonationStartMock,
  recordImpersonationEnd: recordImpersonationEndMock,
  recordImpersonationSwitch: recordImpersonationSwitchMock,
}))

const app = createApp()

const DEVELOPER_ID = 'dev-1'
const TARGET_ID = 'user-2'

function dbUser(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    fullName: id === DEVELOPER_ID ? 'PRPS Developer' : 'Ama Mensah',
    email: id === DEVELOPER_ID ? 'developer@prps.local' : 'ama@school.edu',
    phone: null,
    profilePictureUrl: null,
    status: 'ACTIVE',
    lastLoginAt: null,
    mustChangePassword: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    staffProfile:
      id === DEVELOPER_ID
        ? { userId: id, staffId: 'PRPS-DEV-001', category: 'LEADERSHIP', position: 'DEVELOPER' }
        : { userId: id, staffId: 'PRPS-HT-001', category: 'LEADERSHIP', position: 'HEADTEACHER' },
    roles: [
      {
        role: {
          id: 'role-1',
          name: id === DEVELOPER_ID ? 'OWNER' : 'HEADTEACHER',
          rolePermissions: [{ permission: { key: 'finance.view' } }],
        },
      },
    ],
    ...overrides,
  }
}

function targetRecord() {
  return dbUser(TARGET_ID)
}

describe('GET /api/developer/accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listImpersonatableAccountsMock.mockResolvedValue([])
    isDeveloperAccountMock.mockResolvedValue(true)
    signTokenMock.mockReturnValue('fresh-dev-token')
    signImpersonationTokenMock.mockReturnValue('impersonation-token')
    validateImpersonationTargetMock.mockResolvedValue(targetRecord())
  })

  it('returns 401 without a bearer token', async () => {
    const res = await request(app).get('/api/developer/accounts')
    expect(res.status).toBe(401)
  })

  it('authorizes a fresh developer login token', async () => {
    verifyTokenMock.mockReturnValue({ sub: DEVELOPER_ID, kind: 'staff' })
    prismaMock.user.findUnique.mockResolvedValue(dbUser(DEVELOPER_ID))

    const res = await request(app)
      .get('/api/developer/accounts')
      .set('Authorization', 'Bearer test-token')

    expect(res.status).toBe(200)
    expect(isDeveloperAccountMock).toHaveBeenCalledWith(DEVELOPER_ID)
  })

  it('authorizes an impersonation token by resolving the real developer id, not the acting user', async () => {
    verifyTokenMock.mockReturnValue({ sub: DEVELOPER_ID, kind: 'staff', act: TARGET_ID, imp: true })
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === TARGET_ID ? dbUser(TARGET_ID) : dbUser(DEVELOPER_ID),
    )
    listImpersonatableAccountsMock.mockResolvedValue([
      { id: TARGET_ID, fullName: 'Ama Mensah', email: 'ama@school.edu', roles: ['HEADTEACHER'] },
    ])

    const res = await request(app)
      .get('/api/developer/accounts')
      .set('Authorization', 'Bearer test-token')

    expect(res.status).toBe(200)
    // Must check the developer (token sub), never the impersonated account.
    expect(isDeveloperAccountMock).toHaveBeenCalledWith(DEVELOPER_ID)
    expect(isDeveloperAccountMock).not.toHaveBeenCalledWith(TARGET_ID)
  })

  it('returns 403 for a non-developer authenticated user', async () => {
    verifyTokenMock.mockReturnValue({ sub: TARGET_ID, kind: 'staff' })
    prismaMock.user.findUnique.mockResolvedValue(dbUser(TARGET_ID))
    isDeveloperAccountMock.mockResolvedValue(false)

    const res = await request(app)
      .get('/api/developer/accounts')
      .set('Authorization', 'Bearer test-token')

    expect(res.status).toBe(403)
    expect(res.body.message).toBe('Forbidden: developer access only.')
  })
})

describe('POST /api/developer/stop-impersonation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDeveloperAccountMock.mockResolvedValue(true)
    signTokenMock.mockReturnValue('fresh-dev-token')
  })

  it('returns a fresh developer token while impersonating', async () => {
    verifyTokenMock.mockReturnValue({ sub: DEVELOPER_ID, kind: 'staff', act: TARGET_ID, imp: true })
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === TARGET_ID ? dbUser(TARGET_ID) : dbUser(DEVELOPER_ID),
    )

    const res = await request(app)
      .post('/api/developer/stop-impersonation')
      .set('Authorization', 'Bearer test-token')

    expect(res.status).toBe(200)
    expect(isDeveloperAccountMock).toHaveBeenCalledWith(DEVELOPER_ID)
    // Fresh token must be signed for the developer, not the acting user.
    expect(signTokenMock).toHaveBeenCalledWith(DEVELOPER_ID, 'staff')
    expect(signTokenMock).not.toHaveBeenCalledWith(TARGET_ID, expect.anything())
    expect(recordImpersonationEndMock).toHaveBeenCalledWith(DEVELOPER_ID, TARGET_ID, expect.anything())
    expect(res.body.data.token).toBe('fresh-dev-token')
  })
})

describe('POST /api/developer/impersonate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDeveloperAccountMock.mockResolvedValue(true)
    signImpersonationTokenMock.mockReturnValue('impersonation-token')
    validateImpersonationTargetMock.mockResolvedValue(targetRecord())
    recordImpersonationStartMock.mockResolvedValue(undefined)
  })

  it('issues an impersonation token from the real developer identity', async () => {
    verifyTokenMock.mockReturnValue({ sub: DEVELOPER_ID, kind: 'staff' })
    prismaMock.user.findUnique.mockResolvedValue(dbUser(DEVELOPER_ID))

    const res = await request(app)
      .post('/api/developer/impersonate')
      .set('Authorization', 'Bearer test-token')
      .send({ targetUserId: TARGET_ID })

    expect(res.status).toBe(200)
    expect(signImpersonationTokenMock).toHaveBeenCalledWith(DEVELOPER_ID, TARGET_ID)
    expect(res.body.data.token).toBe('impersonation-token')
  })

  it('allows switching accounts while already impersonating', async () => {
    verifyTokenMock.mockReturnValue({ sub: DEVELOPER_ID, kind: 'staff', act: TARGET_ID, imp: true })
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === TARGET_ID ? dbUser(TARGET_ID) : dbUser(DEVELOPER_ID),
    )
    validateImpersonationTargetMock.mockResolvedValue(dbUser('user-3'))

    const res = await request(app)
      .post('/api/developer/switch-account')
      .set('Authorization', 'Bearer test-token')
      .send({ targetUserId: 'user-3' })

    expect(res.status).toBe(200)
    expect(isDeveloperAccountMock).toHaveBeenCalledWith(DEVELOPER_ID)
    expect(signImpersonationTokenMock).toHaveBeenCalledWith(DEVELOPER_ID, 'user-3')
  })
})

import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'
import { HttpStatus } from '../config/enums'
import { signToken } from '../lib/jwt'
import { AppError } from '../utils/app-error'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}))
const ownerServiceMock = vi.hoisted(() => ({
  getOwnerSummary: vi.fn(),
  getOwnerFinanceOverview: vi.fn(),
  listHeadteachers: vi.fn(),
  getHeadteacher: vi.fn(),
  createHeadteacher: vi.fn(),
  resendHeadteacherInvitation: vi.fn(),
  updateHeadteacher: vi.fn(),
  setHeadteacherStatus: vi.fn(),
  setHeadteacherPermissions: vi.fn(),
}))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('../services/owner.service', () => ownerServiceMock)

const app = createApp()

const DUPLICATE_MESSAGE = 'An active Headteacher already exists. Deactivate the current Headteacher before creating a replacement.'

function ownerUser(permissionKeys: string[]) {
  return {
    id: 'owner-1',
    fullName: 'Ada Lovelace',
    email: 'ada@school.edu',
    phone: null,
    profilePictureUrl: null,
    status: 'ACTIVE',
    lastLoginAt: null,
    mustChangePassword: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    staffProfile: null,
    roles: [
      {
        role: {
          id: 'role-owner',
          name: 'OWNER',
          rolePermissions: permissionKeys.map((key) => ({ permission: { key } })),
        },
      },
    ],
  }
}

function authHeader(userId = 'owner-1') {
  const token = signToken(userId)
  return { Authorization: `Bearer ${token}` }
}

function publicHeadteacher() {
  return {
    id: 'ht-1',
    staffId: 'PRPS-HT-001',
    fullName: 'Kofi Mensah',
    email: 'kofi@school.edu',
    status: 'ACTIVE',
    roles: ['HEADTEACHER'],
  }
}

const validBody = {
  firstName: 'Kofi',
  lastName: 'Mensah',
  email: 'kofi@school.edu',
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findUnique.mockResolvedValue(ownerUser(['owner.manage']))
})

describe('POST /api/owner/headteacher', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).post('/api/owner/headteacher').send(validBody)

    expect(res.status).toBe(HttpStatus.Unauthorized)
    expect(ownerServiceMock.createHeadteacher).not.toHaveBeenCalled()
  })

  it('rejects a non-Owner with 403 and does not reach the service', async () => {
    prismaMock.user.findUnique.mockResolvedValue(ownerUser(['staff.view']))

    const res = await request(app)
      .post('/api/owner/headteacher')
      .set(authHeader())
      .send(validBody)

    expect(res.status).toBe(HttpStatus.Forbidden)
    expect(res.body).toMatchObject({ success: false })
    expect(res.body.message).toMatch(/permission/i)
    expect(ownerServiceMock.createHeadteacher).not.toHaveBeenCalled()
  })

  it('propagates the duplicate-active-Headteacher error as HTTP 409, not 500', async () => {
    ownerServiceMock.createHeadteacher.mockRejectedValue(
      new AppError(DUPLICATE_MESSAGE, HttpStatus.Conflict),
    )

    const res = await request(app)
      .post('/api/owner/headteacher')
      .set(authHeader())
      .send(validBody)

    expect(res.status).toBe(HttpStatus.Conflict)
    expect(res.body).toMatchObject({ success: false, message: DUPLICATE_MESSAGE })
    expect(res.status).not.toBe(HttpStatus.InternalServerError)
  })

  it('creates the Headteacher for the Owner with 201', async () => {
    ownerServiceMock.createHeadteacher.mockResolvedValue({
      headteacher: publicHeadteacher(),
      invitation: { status: 'sent' },
    })

    const res = await request(app)
      .post('/api/owner/headteacher')
      .set(authHeader())
      .send(validBody)

    expect(res.status).toBe(HttpStatus.Created)
    expect(res.body).toMatchObject({ success: true })
    expect(res.body.data.headteacher.staffId).toBe('PRPS-HT-001')
    expect(ownerServiceMock.createHeadteacher).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'owner-1' }),
      expect.objectContaining(validBody),
      expect.anything(),
    )
  })
})

describe('POST /api/owner/headteacher/:id/deactivate', () => {
  it('allows only the Owner to end Headteacher service', async () => {
    ownerServiceMock.setHeadteacherStatus.mockResolvedValue(publicHeadteacher())

    const res = await request(app)
      .post('/api/owner/headteacher/ht-1/deactivate')
      .set(authHeader())

    expect(res.status).toBe(HttpStatus.Ok)
    expect(ownerServiceMock.setHeadteacherStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'owner-1' }),
      'ht-1',
      'INACTIVE',
      expect.anything(),
    )
  })

  it('rejects a non-Owner with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(ownerUser(['teachers.view']))

    const res = await request(app)
      .post('/api/owner/headteacher/ht-1/deactivate')
      .set(authHeader())

    expect(res.status).toBe(HttpStatus.Forbidden)
    expect(ownerServiceMock.setHeadteacherStatus).not.toHaveBeenCalled()
  })

  it('returns HTTP 404 from the service when the account does not exist', async () => {
    ownerServiceMock.setHeadteacherStatus.mockRejectedValue(new AppError('Headteacher not found.', HttpStatus.NotFound))

    const res = await request(app)
      .post('/api/owner/headteacher/missing/deactivate')
      .set(authHeader())

    expect(res.status).toBe(HttpStatus.NotFound)
    expect(res.body).toMatchObject({ success: false, message: 'Headteacher not found.' })
  })
})

describe('GET /api/owner/summary', () => {
  it('rejects a non-Owner with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(ownerUser(['pupils.view']))

    const res = await request(app)
      .get('/api/owner/summary')
      .set(authHeader())

    expect(res.status).toBe(HttpStatus.Forbidden)
    expect(ownerServiceMock.getOwnerSummary).not.toHaveBeenCalled()
  })

  it('returns the Owner summary for the Owner', async () => {
    ownerServiceMock.getOwnerSummary.mockResolvedValue({
      headteacher: null,
      totals: { headteachers: 1, staff: 3, pupils: 0, auditEntries: 7 },
    })

    const res = await request(app)
      .get('/api/owner/summary')
      .set(authHeader())

    expect(res.status).toBe(HttpStatus.Ok)
    expect(res.body.data.headteacher).toBeNull()
    expect(res.body.data.totals.headteachers).toBe(1)
  })
})

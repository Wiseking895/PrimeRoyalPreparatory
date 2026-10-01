import jwt from 'jsonwebtoken'
import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'
import { env } from '../config/env'
import { HttpStatus } from '../config/enums'
import { AppError } from '../utils/app-error'

// Must run before `../app` pulls in `config/env`, which reads the environment
// once at import time.
vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
  process.env.CLIENT_URL = 'http://localhost:5173'
})

const ownerExistsMock = vi.hoisted(() => vi.fn())
const createOwnerMock = vi.hoisted(() => vi.fn())
const createOwnerFromGoogleMock = vi.hoisted(() => vi.fn())

vi.mock('../services/setup.service', () => ({
  ownerExists: ownerExistsMock,
  createOwner: createOwnerMock,
  createOwnerFromGoogle: createOwnerFromGoogleMock,
}))

const app = createApp()

const OWNER = {
  id: 'owner-1',
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: null,
  profilePictureUrl: null,
  status: 'ACTIVE',
  lastLoginAt: null,
  mustChangePassword: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
}

const VALID_SETUP = {
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'secret123',
  confirmPassword: 'secret123',
}

describe('setup routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ownerExistsMock.mockResolvedValue(false)
  })

  afterAll(() => {
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    delete process.env.CLIENT_URL
  })

  describe('GET /api/setup/status', () => {
    it('reports that first-time Owner setup is still available', async () => {
      const res = await request(app).get('/api/setup/status').expect(200)

      expect(res.body).toMatchObject({ success: true, data: { ownerExists: false } })
      expect(typeof res.body.data.googleOAuthEnabled).toBe('boolean')
      expect(ownerExistsMock).toHaveBeenCalledTimes(1)
    })

    it('reports setup as complete once the school Owner exists', async () => {
      ownerExistsMock.mockResolvedValue(true)

      const res = await request(app).get('/api/setup/status').expect(200)

      expect(res.body.data.ownerExists).toBe(true)
      expect(res.body.message).toMatch(/complete/i)
    })
  })

  describe('POST /api/setup/owner', () => {
    it('creates the first Owner and returns a ready-to-use session', async () => {
      createOwnerMock.mockResolvedValue(OWNER)

      const res = await request(app).post('/api/setup/owner').send(VALID_SETUP).expect(201)

      expect(res.body.success).toBe(true)
      expect(res.body.data.user).toMatchObject({ id: 'owner-1', email: 'ada@example.com' })
      expect(createOwnerMock).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: 'Ada Lovelace', email: 'ada@example.com' }),
        expect.anything(),
      )

      const payload = jwt.verify(res.body.data.token, env.jwtSecret) as { sub?: string; kind?: string }
      expect(payload.sub).toBe('owner-1')
      expect(payload.kind).toBe('staff')
    })

    it('rejects an invalid payload with field errors and creates nothing', async () => {
      const res = await request(app)
        .post('/api/setup/owner')
        .send({ fullName: 'A', email: 'nope', password: 'short', confirmPassword: 'different' })
        .expect(422)

      expect(res.body.success).toBe(false)
      expect(Array.isArray(res.body.errors)).toBe(true)
      expect(res.body.errors.length).toBeGreaterThan(0)
      expect(createOwnerMock).not.toHaveBeenCalled()
    })

    it('propagates the first-owner-only conflict as a 409', async () => {
      createOwnerMock.mockRejectedValue(
        new AppError('Initial owner setup has already been completed.', HttpStatus.Conflict),
      )

      const res = await request(app).post('/api/setup/owner').send(VALID_SETUP).expect(409)

      expect(res.body.success).toBe(false)
      expect(res.body.message).toMatch(/already been completed/i)
      expect(res.body.data).toBeUndefined()
    })
  })
})

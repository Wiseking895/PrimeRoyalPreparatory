import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from './app'

const app = createApp()

describe('PRPS API', () => {
  it('GET /api/health returns the running payload', async () => {
    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      success: true,
      message: 'PRPS API is running',
    })
    expect(res.body.data).toBeDefined()
    expect(res.body.data.name).toBe('prps-school-management')
    expect(typeof res.body.data.uptime).toBe('number')
    expect(res.body.data.timestamp).toBeTruthy()
  })

  it('GET / returns an API banner', async () => {
    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ success: true })
  })

  it('unknown API routes return a structured 404', async () => {
    const res = await request(app).get('/api/does-not-exist')

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ success: false })
    expect(res.body.message).toContain('Route not found')
  })

  it('sends security headers via helmet', async () => {
    const res = await request(app).get('/api/health')

    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
  })

  it('responds with JSON for all routes', async () => {
    const res = await request(app).get('/api/nope')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })
})

import cors from 'cors'
import express from 'express'
import type { Express } from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { API_ROUTES } from './config/api-contracts'
import { env } from './config/env'
import { logger } from './config/logger'
import { errorHandler } from './middleware/error-handler'
import { notFoundHandler } from './middleware/not-found'
import { healthRouter } from './routes/health.routes'
import { setupRouter } from './routes/setup.routes'
import { authRouter } from './routes/auth.routes'
import { ownerRouter } from './routes/owner.routes'
import { staffRouter } from './routes/staff.routes'
import { rbacRouter } from './routes/rbac.routes'
import { auditRouter } from './routes/audit.routes'

/**
 * Builds and configures the Express application. Kept separate from the HTTP
 * server so tests can exercise the app with supertest.
 */
export function createApp(): Express {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', 1)

  // Security headers
  app.use(helmet())

  // Structured request logging
  app.use(pinoHttp({ logger }))

  // CORS — allow the configured frontend origin (comma-separated in production).
  const origins = env.isProduction ? env.clientUrl.split(',').map((o) => o.trim()) : true
  app.use(
    cors({
      origin: origins,
      credentials: true,
    }),
  )

  // Body parsing
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))

  // Basic rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 500,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { success: false, message: 'Too many requests, please try again later.' },
    }),
  )

  app.get('/', (_req, res) => {
    res.json({ success: true, message: 'PRPS API. See /api/health for status.' })
  })

  app.use(API_ROUTES.health, healthRouter)

  // Phase 2 — school set-up, authentication and administration APIs.
  app.use('/api/setup', setupRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/owner', ownerRouter)
  app.use('/api/staff', staffRouter)
  app.use('/api', rbacRouter)
  app.use('/api/audit', auditRouter)

  // 404 + centralized error handling (must be last)
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

/**
 * Vercel Functions entrypoint.
 *
 * With the "express" framework in Vercel Services, `@vercel/backends`
 * auto-detects an entrypoint among `app|index|server|main` (+ `src/` variants)
 * whose content imports `express`. `src/app.ts` matches, so it becomes the
 * deployed function and this default export (the fully configured app) is what
 * runs. Local development keeps using `src/server.ts` (`npm run dev`), which
 * bootstraps RBAC and binds the HTTP listener. No port is bound here and no
 * RBAC sync runs on serverless cold starts; the production database is migrated
 * and seeded separately, and the Owner setup flow re-ensures the RBAC catalog.
 */
export default createApp()

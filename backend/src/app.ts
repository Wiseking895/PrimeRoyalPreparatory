import path from 'node:path'
import cors from 'cors'
import express from 'express'
import type { Express } from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { API_ROUTES } from './config/api-contracts.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { errorHandler } from './middleware/error-handler.js'
import { notFoundHandler } from './middleware/not-found.js'
import { healthRouter } from './routes/health.routes.js'
import { setupRouter } from './routes/setup.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { ownerRouter } from './routes/owner.routes.js'
import { staffRouter } from './routes/staff.routes.js'
import { attendanceRouter } from './routes/attendance.routes.js'
import { pupilRouter } from './routes/pupil.routes.js'
import { classRouter } from './routes/class.routes.js'
import { rbacRouter } from './routes/rbac.routes.js'
import { auditRouter } from './routes/audit.routes.js'
import { financeRouter } from './routes/finance.routes.js'
import { feesRouter } from './routes/fees.routes.js'
import { paymentsRouter } from './routes/payments.routes.js'
import { subjectRouter } from './routes/subject.routes.js'
import { academicRouter } from './routes/academic.routes.js'
import { sbaRouter } from './routes/sba.routes.js'
import { parentRouter } from './routes/parent.routes.js'
import { guardiansRouter } from './routes/guardians.routes.js'
import { reportsRouter } from './routes/reports.routes.js'
import { notificationRouter } from './routes/notification.routes.js'
import { announcementRouter } from './routes/announcement.routes.js'
import { notificationPreferenceRouter } from './routes/notification-preference.routes.js'
import { workOutputRouter } from './routes/work-output.routes.js'
import { uploadRouter } from './routes/upload.routes.js'
import { documentRouter } from './routes/document.routes.js'
import { developerRouter } from './routes/developer.routes.js'

/**
 * Builds and configures the Express application. Kept separate from the HTTP
 * server so tests can exercise the app with supertest.
 *
 * `createApp()` is the single application construction path: `src/server.ts`
 * binds it for local development and `src/vercel.ts` wraps it as the Vercel
 * serverless handler. There is intentionally no module-level default app
 * instance, so importing this module never constructs a second application.
 */
export function createApp(): Express {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', 1)

  // Security headers
  app.use(helmet())

  // Structured request logging
  app.use(pinoHttp({ logger }))

  // CORS — allow the configured frontend origin(s) (comma-separated in
  // CLIENT_URL) plus the deployed production frontend. In development every
  // origin is reflected. Registered before rate limiting, body parsing and
  // authentication so OPTIONS preflight requests are answered here and never
  // reach an auth middleware that would reject them.
  app.use(
    cors({
      origin: env.isProduction ? env.clientOrigins : true,
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
  app.use('/api/attendance', attendanceRouter)
  app.use('/api/pupils', pupilRouter)
  app.use('/api/classes', classRouter)
  app.use('/api', rbacRouter)
  app.use('/api/audit', auditRouter)

  // Phase 5 — fees & finance management.
  app.use('/api/finance', financeRouter)
  app.use('/api/fees', feesRouter)
  app.use('/api/payments', paymentsRouter)

  // Phase 6 — academic domain (teachers, subjects, teaching assignments, SBA).
  app.use('/api/subjects', subjectRouter)
  app.use('/api/academic', academicRouter)
  app.use('/api/sba', sbaRouter)

  // Phase 7 — terminal reports, guardian parent-portal accounts and the parent portal.
  app.use('/api/reports', reportsRouter)
  app.use('/api/guardians', guardiansRouter)
  app.use('/api/parent', parentRouter)

  // Phase 9 — notifications, announcements and preferences.
  app.use('/api/notifications', notificationRouter)
  app.use('/api/announcements', announcementRouter)
  app.use('/api/notification-preferences', notificationPreferenceRouter)

  // Work Output — owner-only teacher work output monitoring.
  app.use('/api/work-output', workOutputRouter)

  // Developer impersonation — dedicated developer account only.
  app.use('/api/developer', developerRouter)

  // File uploads — profile pictures, etc.
  app.use('/api/uploads', express.static(path.resolve('uploads')))

  // Upload routes — authenticated file upload/delete.
  app.use('/api', uploadRouter)

  // Stored documents — presigned URLs for private R2 objects (+ storage health).
  app.use('/api', documentRouter)

  // 404 + centralized error handling (must be last)
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

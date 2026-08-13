import { createApp } from './app'
import { env } from './config/env'
import { logger } from './config/logger'
import { ensureInitialRbac } from './services/ensure-rbac'

/**
 * Bootstraps the RBAC catalog (roles + permissions + defaults) before serving
 * traffic so authentication and authorization always have a consistent catalog.
 * A failure here is fatal: serving traffic without RBAC would silently pretend
 * the authorization layer is initialized, which it is not.
 */
async function bootstrap(): Promise<void> {
  try {
    await ensureInitialRbac()
    logger.info('RBAC catalog ready (roles + permissions + defaults).')
  } catch (error) {
    logger.error({ error }, 'FATAL: could not initialize the RBAC catalog. Check DATABASE_URL and run migrations.')
    process.exit(1)
  }

  const app = createApp()

  const server = app.listen(env.port, () => {
    logger.info(`PRPS API listening on http://localhost:${env.port} (${env.nodeEnv})`)
  })

  function shutdown(signal: string): void {
    logger.info(`${signal} received. Shutting down gracefully...`)
    server.close(() => {
      logger.info('HTTP server closed.')
      process.exit(0)
    })
    // Safety valve in case open connections prevent a clean shutdown.
    setTimeout(() => process.exit(1), 10_000).unref()
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

void bootstrap()

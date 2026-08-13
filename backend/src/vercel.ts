import { createApp } from './app'

/**
 * Vercel Functions entrypoint for the Express app.
 *
 * Unlike `src/server.ts` (local dev), this entrypoint does NOT bootstrap the
 * RBAC catalog or bind a port. Running `ensureInitialRbac()` on every serverless
 * cold start is wasteful and `process.exit(1)` on failure would be fatal, so
 * production database initialization is handled separately: migrations are
 * applied with `db:deploy`, and the RBAC catalog is ensured by the school
 * setup and owner flows when the first Owner account is created.
 */
export default createApp()
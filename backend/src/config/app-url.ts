/**
 * Public application URL — the single origin used for every link that leaves
 * the backend (generated e-mails and the developer bootstrap script output).
 *
 * Resolution rules (`CLIENT_URL` keeps its existing comma-separated meaning,
 * the first valid origin wins):
 *
 *   - development: the configured origin, otherwise the local Vite dev server,
 *     so local runs keep producing `http://localhost:5173/...`
 *   - production: the configured origin, except that a loopback value is
 *     ignored in favour of the deployed frontend, so a stale or mistyped
 *     `CLIENT_URL` can never put `localhost` links into a real e-mail.
 *
 * This module is deliberately dependency-free and side-effect free:
 * `scripts/developer-bootstrap.ts` imports it without pulling in
 * `config/env.ts`, which validates secrets at import time and therefore
 * throws when `JWT_SECRET` is missing while running with
 * `--allow-production`.
 */

/**
 * Canonical origin of the deployed PRPS frontend.
 *
 * Production must never fall back to the localhost default: when `CLIENT_URL`
 * is missing or mistyped on Vercel, e-mail links and the CORS allowlist would
 * silently resolve to `http://localhost:5173`, every response would lose
 * `Access-Control-Allow-Origin` and the deployed frontend would be rejected at
 * the preflight stage. This origin is therefore always used in production;
 * `CLIENT_URL` still adds preview deployments or custom domains.
 */
export const PRODUCTION_CLIENT_URL = 'https://prime-royal-preparatory-frontend.vercel.app'

/** Known placeholder used only by the local development server. */
export const DEFAULT_CLIENT_URL = 'http://localhost:5173'

const HTTP_ORIGIN = /^https?:\/\//
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i

/** Trims whitespace and any trailing slashes so `…vercel.app/` still matches. */
function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

/**
 * Resolves the public application URL used to build links outside the backend.
 *
 * Returns a single origin with no trailing slash. Never returns a localhost
 * origin when `isProduction` is true.
 */
export function resolveAppUrl(clientUrl: string | undefined, isProduction: boolean): string {
  const origin = (clientUrl ?? '')
    .split(',')
    .map(normalizeOrigin)
    .find((value) => HTTP_ORIGIN.test(value))

  if (!origin) {
    return isProduction ? PRODUCTION_CLIENT_URL : DEFAULT_CLIENT_URL
  }

  if (isProduction && LOOPBACK_ORIGIN.test(origin)) {
    return PRODUCTION_CLIENT_URL
  }

  return origin
}

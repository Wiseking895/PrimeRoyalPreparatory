import { APP } from '../config/constants'
import type { HealthData } from '../config/api-contracts'

/**
 * Builds the payload for GET /api/health.
 *
 * Kept in a service so future phases can add real dependency checks (e.g.
 * database connectivity) without changing the controller shape.
 */
export function getHealth(): HealthData {
  return {
    name: APP.name,
    version: APP.version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }
}

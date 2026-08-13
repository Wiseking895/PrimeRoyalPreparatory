import type { HttpStatus } from './enums.js'

/**
 * Canonical envelope for every PRPS API response.
 *
 * Every endpoint returns `{ success, message, data?, errors? }` so that the
 * frontend can rely on a single, predictable shape.
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
  errors?: unknown
}

/**
 * A validated field error returned by request validation.
 */
export interface ApiFieldError {
  field: string
  message: string
}

/**
 * Shape of an error response body.
 */
export interface ApiErrorResponse extends ApiResponse {
  statusCode: HttpStatus
}

/**
 * Payload returned by GET /api/health.
 */
export interface HealthData {
  name: string
  version: string
  uptime: number
  timestamp: string
}

/**
 * Response for GET /api/health.
 */
export type HealthResponse = ApiResponse<HealthData>

/**
 * Route constants. Kept in shared so the frontend and backend never drift.
 */
export const API_ROUTES = {
  health: '/api/health',
  setupStatus: '/api/setup/status',
  setupOwner: '/api/setup/owner',
  login: '/api/auth/login',
  me: '/api/auth/me',
  changePassword: '/api/auth/change-password',
  ownerSummary: '/api/owner/summary',
  ownerHeadteachers: '/api/owner/headteacher',
  ownerHeadteacherById: '/api/owner/headteacher/:id',
  ownerHeadteacherPermissions: '/api/owner/headteacher/:id/permissions',
  staff: '/api/staff',
  roles: '/api/roles',
  permissions: '/api/permissions',
  audit: '/api/audit',
} as const

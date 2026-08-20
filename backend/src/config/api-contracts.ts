import type { HttpStatus } from './enums'

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
 * Route constants. The frontend mirrors these paths in its API client; the
 * backend remains authoritative.
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
  staffStats: '/api/staff/stats',
  staffResendInvitation: '/api/staff/:id/resend-invitation',
  pupils: '/api/pupils',
  pupilStats: '/api/pupils/stats',
  pupilById: '/api/pupils/:id',
  pupilActivate: '/api/pupils/:id/activate',
  pupilDeactivate: '/api/pupils/:id/deactivate',
  classes: '/api/classes',
  classById: '/api/classes/:id',
  classActivate: '/api/classes/:id/activate',
  classDeactivate: '/api/classes/:id/deactivate',
  roles: '/api/roles',
  permissions: '/api/permissions',
  audit: '/api/audit',
  financeSummary: '/api/finance/summary',
  financePupils: '/api/finance/pupils',
  financePupilById: '/api/finance/pupils/:id',
  financeSessions: '/api/finance/sessions',
  financeSessionById: '/api/finance/sessions/:id',
  financeSessionActivate: '/api/finance/sessions/:id/activate',
  financeSessionDeactivate: '/api/finance/sessions/:id/deactivate',
  financeTerms: '/api/finance/terms',
  financeTermById: '/api/finance/terms/:id',
  financeTermActivate: '/api/finance/terms/:id/activate',
  financeTermDeactivate: '/api/finance/terms/:id/deactivate',
  financeGenerateCharges: '/api/finance/generate-charges',
  fees: '/api/fees',
  feeById: '/api/fees/:id',
  feeActivate: '/api/fees/:id/activate',
  feeDeactivate: '/api/fees/:id/deactivate',
  feeAssign: '/api/fees/:id/assign',
  feeAssignments: '/api/fees/:id/assignments',
  feeGenerateCharges: '/api/fees/:id/generate-charges',
  feeAssignmentDeactivate: '/api/fees/assignments/:id/deactivate',
  payments: '/api/payments',
  paymentById: '/api/payments/:id',
  paymentVoid: '/api/payments/:id/void',
} as const
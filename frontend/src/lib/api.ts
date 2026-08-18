import type {
  AuditPage,
  CreateHeadteacherInput,
  CreateHeadteacherResult,
  CreateStaffInput,
  GroupedPermission,
  LoginResult,
  OwnerSetupInput,
  OwnerSummary,
  PublicUser,
  RoleDefinition,
  SetupStatus,
  StaffView,
  UpdateHeadteacherInput,
  UpdateStaffInput,
} from '@/types/portal'
import { clearSession, getToken } from '@/auth/storage'

/**
 * Thin, typed HTTP client for the PRPS REST API.
 *
 * Every endpoint responds with the shared `{ success, message, data?, errors? }`
 * envelope. `request` unwraps `data`, maps HTTP failures (401/403/404/409/422/500)
 * to a typed `ApiError`, and clears the session + notifies listeners when the
 * server declares the session invalid (401).
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:4000')

interface FieldError {
  field: string
  message: string
}

interface Envelope<T> {
  success: boolean
  message: string
  data?: T
  errors?: FieldError[]
}

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string>

  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

let unauthorizedHandler: (() => void) | null = null

/** Registers a callback invoked whenever the API detects a 401 response. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0)
  }

  let body: Envelope<T> | null = null
  try {
    body = (await response.json()) as Envelope<T>
  } catch {
    body = null
  }

  if (response.status === 401) {
    clearSession()
    unauthorizedHandler?.()
  }

  if (!response.ok || !body?.success) {
    const message = body?.message ?? 'Something went wrong. Please try again.'
    const fieldErrors: Record<string, string> = {}
    if (Array.isArray(body?.errors)) {
      for (const error of body.errors) {
        fieldErrors[error.field] = error.message
      }
    }
    throw new ApiError(message, response.status, fieldErrors)
  }

  return body.data as T
}

const jsonBody = (payload: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(payload),
})

export const api = {
  // Setup
  setupStatus: () => request<SetupStatus>('/api/setup/status'),
  createOwner: (input: OwnerSetupInput) =>
    request<PublicUser>('/api/setup/owner', jsonBody(input)),

  // Auth
  login: (identifier: string, password: string) =>
    request<LoginResult>('/api/auth/login', jsonBody({ identifier, password })),
  me: () => request<PublicUser>('/api/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<null>('/api/auth/change-password', jsonBody({ currentPassword, newPassword })),
  firstPasswordChange: (newPassword: string, confirmPassword: string) =>
    request<null>('/api/auth/first-password-change', jsonBody({ newPassword, confirmPassword })),

  // Owner
  ownerSummary: () => request<OwnerSummary>('/api/owner/summary'),
  listHeadteachers: () => request<StaffView[]>('/api/owner/headteacher'),
  getHeadteacher: (id: string) => request<PublicUser>(`/api/owner/headteacher/${id}`),
  createHeadteacher: (input: CreateHeadteacherInput) =>
    request<CreateHeadteacherResult>('/api/owner/headteacher', jsonBody(input)),
  resendHeadteacherInvitation: (id: string) =>
    request<CreateHeadteacherResult>(`/api/owner/headteacher/${id}/resend-invitation`, { method: 'POST' }),
  updateHeadteacher: (id: string, input: UpdateHeadteacherInput) =>
    request<PublicUser>(`/api/owner/headteacher/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  setHeadteacherStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    request<PublicUser>(`/api/owner/headteacher/${id}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`, {
      method: 'POST',
    }),
  setHeadteacherPermissions: (id: string, permissionKeys: string[]) =>
    request<PublicUser>(`/api/owner/headteacher/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissionKeys }),
    }),

  // Staff
  listStaff: (query?: string) =>
    request<StaffView[]>(`/api/staff${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  getStaff: (id: string) => request<StaffView>(`/api/staff/${id}`),
  createStaff: (input: CreateStaffInput) => request<StaffView>('/api/staff', jsonBody(input)),
  updateStaff: (id: string, input: UpdateStaffInput) =>
    request<StaffView>(`/api/staff/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  setStaffStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    request<StaffView>(`/api/staff/${id}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`, { method: 'POST' }),
  assignRole: (id: string, roleName: string) =>
    request<StaffView>(`/api/staff/${id}/role`, { method: 'PUT', body: JSON.stringify({ roleName }) }),
  removeRole: (id: string) => request<StaffView>(`/api/staff/${id}/role`, { method: 'DELETE' }),

  // Roles & permissions
  listRoles: () => request<RoleDefinition[]>('/api/roles'),
  listPermissions: () => request<GroupedPermission[]>('/api/permissions'),

  // Audit
  listAudit: (limit = 50, offset = 0) =>
    request<AuditPage>(`/api/audit?limit=${limit}&offset=${offset}`),
}

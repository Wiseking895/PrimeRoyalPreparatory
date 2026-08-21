import type {
  AcademicSessionView,
  AcademicStatsView,
  AcademicTermView,
  AnnouncementCreateInput,
  AnnouncementListResult,
  AnnouncementUpdateInput,
  AnnouncementView,
  AssignFeesResult,
  AuditPage,
  ChargeGenerateResult,
  ClassCreateInput,
  ClassTeacherAssignInput,
  ClassTeacherView,
  ClassUpdateInput,
  CreateHeadteacherInput,
  CreateHeadteacherResult,
  CreateStaffInput,
  CreateStaffResult,
  FeeAssignmentView,
  FeeCreateInput,
  FeeUpdateInput,
  FeeView,
  FinancePupilListResult,
  FinanceSummaryView,
  GroupedPermission,
  GuardianAccountView,
  GuardianListResult,
  LoginResult,
  NotificationListResult,
  NotificationPreferenceUpdateInput,
  NotificationPreferenceView,
  NotificationView,
  OwnerSetupInput,
  OwnerSummary,
  ParentAccountResult,
  ParentChildView,
  ParentLoginResult,
  ParentProfileView,
  PaymentCreateInput,
  PaymentListResult,
  PaymentVoidInput,
  PaymentView,
  PublicUser,
  PupilCreateInput,
  PupilFinanceView,
  PupilListQuery,
  PupilPage,
  PupilStats,
  PupilUpdateInput,
  PupilView,
  ReportPupilListResult,
  ReportSessionOption,
  ReportTermOption,
  RoleDefinition,
  SbaBulkResult,
  SbaBulkUpsertInput,
  SbaEntryDataView,
  SbaListQuery,
  SbaRecordView,
  SbaUpdateInput,
  SchoolClassView,
  SessionCreateInput,
  SessionUpdateInput,
  SetupStatus,
  StaffListQuery,
  StaffStats,
  StaffView,
  SubjectCreateInput,
  SubjectUpdateInput,
  SubjectView,
  TeacherAssignmentView,
  TeachingAssignmentCreateInput,
  TeachingAssignmentListQuery,
  TeacherListRow,
  TeacherPortalView,
  TeacherView,
  TermCreateInput,
  TermUpdateInput,
  TerminalReportView,
  UnreadCountResult,
  UpdateHeadteacherInput,
  UpdateStaffInput,
} from '@/types/portal'
import { clearSession, getToken } from '@/auth/storage'
import { clearParentSession, getParentToken } from '@/auth/parentStorage'

/**
 * Thin, typed HTTP client for the PRPS REST API.
 *
 * Every endpoint responds with the shared `{ success, message, data?, errors? }`
 * envelope. `request` unwraps `data`, maps HTTP failures (401/403/404/409/422/500)
 * to a typed `ApiError`, and clears the session + notifies listeners when the
 * server declares the session invalid (401).
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_URL != null
    ? import.meta.env.VITE_API_URL
    : import.meta.env.PROD
      ? ''
      : 'http://localhost:4000'

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
let parentUnauthorizedHandler: (() => void) | null = null

/** Registers a callback invoked whenever the API detects a 401 response. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

/** Registers a callback invoked when the parent-portal API detects a 401. */
export function setParentUnauthorizedHandler(handler: (() => void) | null): void {
  parentUnauthorizedHandler = handler
}

/** Requests under `/api/parent` authenticate with the Parent Portal session. */
function isParentPath(path: string): boolean {
  return path.startsWith('/api/parent')
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const parentPath = isParentPath(path)
  const token = parentPath ? getParentToken() : getToken()
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
    if (parentPath) {
      clearParentSession()
      parentUnauthorizedHandler?.()
    } else {
      clearSession()
      unauthorizedHandler?.()
    }
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
  listStaff: (params?: StaffListQuery) => {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.category) search.set('category', params.category)
    if (params?.position) search.set('position', params.position)
    if (params?.status) search.set('status', params.status)
    const query = search.toString()
    return request<StaffView[]>(`/api/staff${query ? `?${query}` : ''}`)
  },
  getStaff: (id: string) => request<StaffView>(`/api/staff/${id}`),
  staffStats: () => request<StaffStats>('/api/staff/stats'),
  createStaff: (input: CreateStaffInput) => request<CreateStaffResult>('/api/staff', jsonBody(input)),
  resendStaffInvitation: (id: string) =>
    request<CreateStaffResult>(`/api/staff/${id}/resend-invitation`, { method: 'POST' }),
  updateStaff: (id: string, input: UpdateStaffInput) =>
    request<StaffView>(`/api/staff/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  setStaffStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    request<StaffView>(`/api/staff/${id}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`, { method: 'POST' }),
  assignRole: (id: string, roleName: string) =>
    request<StaffView>(`/api/staff/${id}/role`, { method: 'PUT', body: JSON.stringify({ roleName }) }),
  removeRole: (id: string) => request<StaffView>(`/api/staff/${id}/role`, { method: 'DELETE' }),

  // Pupils
  listPupils: (params?: PupilListQuery) => {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.status) search.set('status', params.status)
    if (params?.classId) search.set('classId', params.classId)
    if (params?.sortBy) search.set('sortBy', params.sortBy)
    if (params?.order) search.set('order', params.order)
    if (params?.page) search.set('page', String(params.page))
    if (params?.pageSize) search.set('pageSize', String(params.pageSize))
    const query = search.toString()
    return request<PupilPage>(`/api/pupils${query ? `?${query}` : ''}`)
  },
  getPupil: (id: string) => request<PupilView>(`/api/pupils/${id}`),
  pupilStats: () => request<PupilStats>('/api/pupils/stats'),
  createPupil: (input: PupilCreateInput) => request<PupilView>('/api/pupils', jsonBody(input)),
  updatePupil: (id: string, input: PupilUpdateInput) =>
    request<PupilView>(`/api/pupils/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  setPupilStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    request<PupilView>(`/api/pupils/${id}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`, {
      method: 'POST',
    }),

  // Classes
  listClasses: () => request<SchoolClassView[]>('/api/classes'),
  getClass: (id: string) => request<SchoolClassView>(`/api/classes/${id}`),
  createClass: (input: ClassCreateInput) => request<SchoolClassView>('/api/classes', jsonBody(input)),
  updateClass: (id: string, input: ClassUpdateInput) =>
    request<SchoolClassView>(`/api/classes/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  setClassStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    request<SchoolClassView>(`/api/classes/${id}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`, {
      method: 'POST',
    }),

  // Roles & permissions
  listRoles: () => request<RoleDefinition[]>('/api/roles'),
  listPermissions: () => request<GroupedPermission[]>('/api/permissions'),

  // Audit
  listAudit: (limit = 50, offset = 0) =>
    request<AuditPage>(`/api/audit?limit=${limit}&offset=${offset}`),

  // Finance
  financeSummary: () => request<FinanceSummaryView>('/api/finance/summary'),
  listFinancePupils: (params?: { q?: string; page?: number; pageSize?: number }) => {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.page) search.set('page', String(params.page))
    if (params?.pageSize) search.set('pageSize', String(params.pageSize))
    const query = search.toString()
    return request<FinancePupilListResult>(`/api/finance/pupils${query ? `?${query}` : ''}`)
  },
  getPupilFinance: (id: string) => request<PupilFinanceView>(`/api/finance/pupils/${id}`),

  // Academic sessions & terms
  listSessions: () => request<AcademicSessionView[]>('/api/finance/sessions'),
  getSession: (id: string) => request<AcademicSessionView>(`/api/finance/sessions/${id}`),
  createSession: (input: SessionCreateInput) =>
    request<AcademicSessionView>('/api/finance/sessions', jsonBody(input)),
  updateSession: (id: string, input: SessionUpdateInput) =>
    request<AcademicSessionView>(`/api/finance/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  setSessionStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    request<AcademicSessionView>(`/api/finance/sessions/${id}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`, {
      method: 'POST',
    }),
  listTerms: (sessionId?: string) => {
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
    return request<AcademicTermView[]>(`/api/finance/terms${query}`)
  },
  getTerm: (id: string) => request<AcademicTermView>(`/api/finance/terms/${id}`),
  createTerm: (input: TermCreateInput) =>
    request<AcademicTermView>('/api/finance/terms', jsonBody(input)),
  updateTerm: (id: string, input: TermUpdateInput) =>
    request<AcademicTermView>(`/api/finance/terms/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  setTermStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    request<AcademicTermView>(`/api/finance/terms/${id}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`, {
      method: 'POST',
    }),
  generateSessionCharges: (sessionId: string) =>
    request<ChargeGenerateResult>('/api/finance/generate-charges', jsonBody({ sessionId })),

  // Fees
  listFees: (params?: { sessionId?: string; status?: 'ACTIVE' | 'INACTIVE' }) => {
    const search = new URLSearchParams()
    if (params?.sessionId) search.set('sessionId', params.sessionId)
    if (params?.status) search.set('status', params.status)
    const query = search.toString()
    return request<FeeView[]>(`/api/fees${query ? `?${query}` : ''}`)
  },
  getFee: (id: string) => request<FeeView>(`/api/fees/${id}`),
  createFee: (input: FeeCreateInput) => request<FeeView>('/api/fees', jsonBody(input)),
  updateFee: (id: string, input: FeeUpdateInput) =>
    request<FeeView>(`/api/fees/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  setFeeStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    request<FeeView>(`/api/fees/${id}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`, { method: 'POST' }),
  assignFee: (id: string, pupilIds: string[]) =>
    request<AssignFeesResult>(`/api/fees/${id}/assign`, jsonBody({ pupilIds })),
  listFeeAssignments: (id: string) => request<FeeAssignmentView[]>(`/api/fees/${id}/assignments`),
  deactivateAssignment: (id: string) =>
    request<FeeAssignmentView>(`/api/fees/assignments/${id}/deactivate`, { method: 'POST' }),
  generateFeeCharges: (id: string) =>
    request<ChargeGenerateResult>(`/api/fees/${id}/generate-charges`, { method: 'POST' }),

  // Payments
  listPayments: (params?: {
    q?: string
    pupilId?: string
    status?: 'ACTIVE' | 'VOIDED'
    paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CHEQUE'
    from?: string
    to?: string
    page?: number
    pageSize?: number
  }) => {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.pupilId) search.set('pupilId', params.pupilId)
    if (params?.status) search.set('status', params.status)
    if (params?.paymentMethod) search.set('paymentMethod', params.paymentMethod)
    if (params?.from) search.set('from', params.from)
    if (params?.to) search.set('to', params.to)
    if (params?.page) search.set('page', String(params.page))
    if (params?.pageSize) search.set('pageSize', String(params.pageSize))
    const query = search.toString()
    return request<PaymentListResult>(`/api/payments${query ? `?${query}` : ''}`)
  },
  getPayment: (id: string) => request<PaymentView>(`/api/payments/${id}`),
  createPayment: (input: PaymentCreateInput) => request<PaymentView>('/api/payments', jsonBody(input)),
  voidPayment: (id: string, input: PaymentVoidInput) =>
    request<PaymentView>(`/api/payments/${id}/void`, jsonBody(input)),

  // Phase 6 — Subjects
  listSubjects: (params?: { q?: string; status?: 'ACTIVE' | 'INACTIVE' }) => {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.status) search.set('status', params.status)
    const query = search.toString()
    return request<SubjectView[]>(`/api/subjects${query ? `?${query}` : ''}`)
  },
  getSubject: (id: string) => request<SubjectView>(`/api/subjects/${id}`),
  createSubject: (input: SubjectCreateInput) => request<SubjectView>('/api/subjects', jsonBody(input)),
  updateSubject: (id: string, input: SubjectUpdateInput) =>
    request<SubjectView>(`/api/subjects/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  setSubjectStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    request<SubjectView>(`/api/subjects/${id}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`, {
      method: 'POST',
    }),

  // Phase 6 — Teachers & assignments
  academicStats: () => request<AcademicStatsView>('/api/academic/stats'),
  academicMe: () => request<TeacherPortalView>('/api/academic/me'),
  listTeachers: (params?: { q?: string; status?: 'ACTIVE' | 'INACTIVE' }) => {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.status) search.set('status', params.status)
    const query = search.toString()
    return request<TeacherListRow[]>(`/api/academic/teachers${query ? `?${query}` : ''}`)
  },
  getTeacher: (id: string) => request<TeacherView>(`/api/academic/teachers/${id}`),
  listTeachingAssignments: (params?: TeachingAssignmentListQuery) => {
    const search = new URLSearchParams()
    if (params?.teacherId) search.set('teacherId', params.teacherId)
    if (params?.subjectId) search.set('subjectId', params.subjectId)
    if (params?.classId) search.set('classId', params.classId)
    if (params?.status) search.set('status', params.status)
    const query = search.toString()
    return request<TeacherAssignmentView[]>(`/api/academic/assignments${query ? `?${query}` : ''}`)
  },
  assignTeachingAssignment: (input: TeachingAssignmentCreateInput) =>
    request<TeacherAssignmentView>('/api/academic/assignments', jsonBody(input)),
  deactivateTeachingAssignment: (id: string) =>
    request<TeacherAssignmentView>(`/api/academic/assignments/${id}/deactivate`, { method: 'POST' }),
  getClassTeacher: (classId: string) =>
    request<ClassTeacherView | null>(`/api/academic/classes/${classId}/class-teacher`),
  assignClassTeacher: (classId: string, teacherId: string) =>
    request<ClassTeacherView>(`/api/academic/classes/${classId}/class-teacher`, {
      method: 'PUT',
      body: JSON.stringify({ teacherId } satisfies ClassTeacherAssignInput),
    }),
  removeClassTeacher: (classId: string) =>
    request<null>(`/api/academic/classes/${classId}/class-teacher`, { method: 'DELETE' }),

  // Phase 6 — SBA
  listSba: (params?: SbaListQuery) => {
    const search = new URLSearchParams()
    if (params?.sessionId) search.set('sessionId', params.sessionId)
    if (params?.termId) search.set('termId', params.termId)
    if (params?.classId) search.set('classId', params.classId)
    if (params?.subjectId) search.set('subjectId', params.subjectId)
    if (params?.pupilId) search.set('pupilId', params.pupilId)
    if (params?.teacherId) search.set('teacherId', params.teacherId)
    const query = search.toString()
    return request<SbaRecordView[]>(`/api/sba${query ? `?${query}` : ''}`)
  },
  getSbaRecord: (id: string) => request<SbaRecordView>(`/api/sba/${id}`),
  sbaEntryData: (params: { classId: string; subjectId: string; termId: string }) => {
    const search = new URLSearchParams()
    search.set('classId', params.classId)
    search.set('subjectId', params.subjectId)
    search.set('termId', params.termId)
    return request<SbaEntryDataView>(`/api/sba/entry-data?${search.toString()}`)
  },
  sbaBulk: (input: SbaBulkUpsertInput) => request<SbaBulkResult>('/api/sba/bulk', jsonBody(input)),
  updateSbaRecord: (id: string, input: SbaUpdateInput) =>
    request<SbaRecordView>(`/api/sba/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),

  // Phase 7 — Parent Portal
  parentLogin: (identifier: string, password: string) =>
    request<ParentLoginResult>('/api/parent/login', jsonBody({ identifier, password })),
  parentMe: () => request<ParentProfileView>('/api/parent/me'),
  parentChangePassword: (currentPassword: string, newPassword: string) =>
    request<null>('/api/parent/change-password', jsonBody({ currentPassword, newPassword })),
  parentFirstPasswordChange: (newPassword: string, confirmPassword: string) =>
    request<null>('/api/parent/first-password-change', jsonBody({ newPassword, confirmPassword })),
  myChildren: () => request<ParentChildView[]>('/api/parent/children'),
  getMyChild: (pupilId: string) => request<ParentChildView>(`/api/parent/children/${pupilId}`),
  getMyChildFinance: (pupilId: string) => request<PupilFinanceView>(`/api/parent/children/${pupilId}/finance`),
  getMyChildReports: (pupilId: string) =>
    request<ReportTermOption[]>(`/api/parent/children/${pupilId}/reports`),
  getMyChildReportSessions: (pupilId: string) =>
    request<ReportSessionOption[]>(`/api/parent/children/${pupilId}/reports/sessions`),
  getMyChildReport: (pupilId: string, termId: string) =>
    request<TerminalReportView>(`/api/parent/children/${pupilId}/reports/terms/${termId}`),

  // Phase 7 — Terminal reports (staff)
  listReportPupils: (params?: { q?: string; classId?: string }) => {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.classId) search.set('classId', params.classId)
    const query = search.toString()
    return request<ReportPupilListResult>(`/api/reports/pupils${query ? `?${query}` : ''}`)
  },
  listPupilReports: (pupilId: string, sessionId?: string) => {
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
    return request<ReportTermOption[]>(`/api/reports/pupils/${pupilId}/reports${query}`)
  },
  getPupilReport: (pupilId: string, termId: string) =>
    request<TerminalReportView>(`/api/reports/pupils/${pupilId}/reports/terms/${termId}`),

  // Phase 7 — Parent accounts (guardians administration)
  listGuardians: (params?: { q?: string; account?: 'has_account' | 'no_account'; status?: 'ACTIVE' | 'INACTIVE' }) => {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.account) search.set('account', params.account)
    if (params?.status) search.set('status', params.status)
    const query = search.toString()
    return request<GuardianListResult>(`/api/guardians${query ? `?${query}` : ''}`)
  },
  getGuardian: (id: string) => request<GuardianAccountView>(`/api/guardians/${id}`),
  createParentAccount: (guardianId: string, accountEmail?: string) =>
    request<ParentAccountResult>(`/api/guardians/${guardianId}/parent-account`, jsonBody({ accountEmail })),
  resendParentInvitation: (guardianId: string) =>
    request<ParentAccountResult>(`/api/guardians/${guardianId}/parent-account/resend`, { method: 'POST' }),
  setParentAccountStatus: (guardianId: string, status: 'ACTIVE' | 'INACTIVE') =>
    request<GuardianAccountView>(
      `/api/guardians/${guardianId}/parent-account/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`,
      { method: 'POST' },
    ),

  // Phase 9 — Notifications
  listNotifications: (params?: { limit?: number; offset?: number; unread?: boolean }) => {
    const search = new URLSearchParams()
    if (params?.limit) search.set('limit', String(params.limit))
    if (params?.offset) search.set('offset', String(params.offset))
    if (params?.unread) search.set('unread', 'true')
    const query = search.toString()
    return request<NotificationListResult>(`/api/notifications${query ? `?${query}` : ''}`)
  },
  unreadNotificationCount: () => request<UnreadCountResult>('/api/notifications/unread-count'),
  markNotificationRead: (id: string) =>
    request<NotificationView>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () =>
    request<{ updated: number }>('/api/notifications/read-all', { method: 'PATCH' }),

  // Phase 9 — Notification preferences
  getNotificationPreferences: () => request<NotificationPreferenceView>('/api/notification-preferences'),
  updateNotificationPreferences: (input: NotificationPreferenceUpdateInput) =>
    request<NotificationPreferenceView>('/api/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  // Phase 9 — Announcements
  listAnnouncements: (params?: { status?: string; audience?: string; limit?: number; offset?: number }) => {
    const search = new URLSearchParams()
    if (params?.status) search.set('status', params.status)
    if (params?.audience) search.set('audience', params.audience)
    if (params?.limit) search.set('limit', String(params.limit))
    if (params?.offset) search.set('offset', String(params.offset))
    const query = search.toString()
    return request<AnnouncementListResult>(`/api/announcements${query ? `?${query}` : ''}`)
  },
  getAnnouncement: (id: string) => request<AnnouncementView>(`/api/announcements/${id}`),
  createAnnouncement: (input: AnnouncementCreateInput) =>
    request<AnnouncementView>('/api/announcements', jsonBody(input)),
  updateAnnouncement: (id: string, input: AnnouncementUpdateInput) =>
    request<AnnouncementView>(`/api/announcements/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteAnnouncement: (id: string) =>
    request<null>(`/api/announcements/${id}`, { method: 'DELETE' }),
}

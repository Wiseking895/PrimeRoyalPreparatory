/**
 * Portal API types — mirrors the shapes returned by the PRPS backend
 * (`backend/src/services/user-mapper.ts`, controllers and catalog services).
 * The backend remains authoritative; these types exist so the frontend never
 * has to reach for `any`.
 */

export interface PublicUser {
  id: string
  fullName: string
  email: string
  phone: string | null
  profilePictureUrl: string | null
  status: 'ACTIVE' | 'INACTIVE'
  lastLoginAt: string | null
  mustChangePassword: boolean
  createdAt: string
  staffId: string | null
  category: string | null
  position: string | null
  roles: string[]
  permissions: string[]
}

export interface StaffView extends PublicUser {
  address: string | null
  dateJoined: string | null
  responsibilities: string | null
}

export interface LoginResult {
  token: string
  user: PublicUser
}

export interface SetupStatus {
  ownerExists: boolean
}

export interface OwnerSetupInput {
  fullName: string
  email: string
  phone?: string
  password: string
  confirmPassword: string
}

export interface OwnerSummary {
  headteacher: PublicUser | null
  totals: {
    staff: number
    teaching: number
    nonTeaching: number
    activeStaff: number
    inactiveStaff: number
    headteachers: number
    pupils: number
    activePupils: number
    inactivePupils: number
    classes: number
    admissions: number
    auditEntries: number
  }
  pupilsByClass: Array<{
    classId: string
    className: string
    count: number
  }>
  recentStaffActivity: Array<{
    id: string
    action: string
    createdAt: string
    actor: { id: string; fullName: string; email: string } | null
  }>
  recentPermissionChanges: Array<{
    id: string
    action: string
    metadata: Record<string, unknown> | null
    createdAt: string
    actor: { id: string; fullName: string; email: string } | null
  }>
}

export interface PermissionDefinition {
  key: string
  module: string
  moduleLabel: string
  label: string
  description?: string
}

export interface RoleDefinition {
  name: string
  label: string
  description: string
  permissions: string[]
}

export interface GroupedPermission {
  module: string
  moduleLabel: string
  permissions: Array<{
    key: string
    label: string
    description?: string
  }>
}

export interface AuditEntry {
  id: string
  action: string
  resourceType: string | null
  resourceId: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  createdAt: string
  actor: { id: string; fullName: string; email: string } | null
}

export interface AuditPage {
  entries: AuditEntry[]
  total: number
  limit: number
  offset: number
}

export interface InvitationResult {
  status: 'dev' | 'sent' | 'queued' | 'failed'
  transport?: 'dev' | 'smtp'
  messageId?: string
  error?: string
}

export interface CreateHeadteacherResult {
  headteacher: PublicUser
  invitation: InvitationResult
}

export interface CreateHeadteacherInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  address?: string
  status?: 'ACTIVE' | 'INACTIVE'
}

export interface UpdateHeadteacherInput {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
}

export interface CreateStaffInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  address?: string
  position: string
  status?: 'ACTIVE' | 'INACTIVE'
}

export interface UpdateStaffInput {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  category?: 'TEACHING' | 'NON_TEACHING'
  position?: string
  responsibilities?: string
}

export interface CreateStaffResult {
  staff: StaffView
  invitation: InvitationResult
}

export interface StaffListQuery {
  q?: string
  category?: string
  position?: string
  status?: 'ACTIVE' | 'INACTIVE'
}

export interface StaffStats {
  total: number
  teaching: number
  nonTeaching: number
  active: number
  inactive: number
  byPosition: Record<string, number>
  recentActivity: Array<{
    id: string
    action: string
    createdAt: string
    actor: { id: string; fullName: string; email: string } | null
  }>
}

export type PupilStatus = 'ACTIVE' | 'INACTIVE'
export type PupilGender = 'MALE' | 'FEMALE'

export interface SchoolClassView {
  id: string
  key: string
  name: string
  description: string | null
  sortOrder: number
  status: 'ACTIVE' | 'INACTIVE'
  pupilCount: number
  activePupilCount: number
  createdAt: string
  updatedAt: string
}

export interface GuardianView {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  address: string | null
  relationship: string | null
  isPrimary: boolean
  isEmergency: boolean
}

export interface PupilView {
  id: string
  pupilId: string
  admissionNumber: string | null
  firstName: string
  middleName: string | null
  lastName: string
  fullName: string
  dateOfBirth: string
  gender: PupilGender
  profilePictureUrl: string | null
  classId: string
  className: string
  dateAdmitted: string
  status: PupilStatus
  address: string | null
  guardians: GuardianView[]
  createdAt: string
  updatedAt: string
}

export interface PupilListQuery {
  q?: string
  status?: PupilStatus
  classId?: string
  sortBy?: 'name' | 'dateAdmitted' | 'createdAt' | 'updatedAt'
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface PupilPage {
  items: PupilView[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface PupilStats {
  total: number
  active: number
  inactive: number
  byClass: Array<{ classId: string; className: string; count: number }>
}

export interface GuardianInput {
  fullName: string
  relationship: string
  phone?: string
  email?: string
  address?: string
  isPrimary: boolean
  isEmergency: boolean
}

export interface PupilCreateInput {
  pupilId?: string
  admissionNumber?: string
  firstName: string
  middleName?: string
  lastName: string
  dateOfBirth: string
  gender: PupilGender
  classId: string
  dateAdmitted?: string
  address?: string
  status?: PupilStatus
  guardians: GuardianInput[]
}

export interface PupilUpdateInput {
  pupilId?: string
  admissionNumber?: string | null
  firstName?: string
  middleName?: string | null
  lastName?: string
  dateOfBirth?: string
  gender?: PupilGender
  classId?: string
  dateAdmitted?: string | null
  address?: string | null
  status?: PupilStatus
  guardians?: GuardianInput[]
}

export interface ClassCreateInput {
  key: string
  name: string
  description?: string
  sortOrder?: number
  status?: 'ACTIVE' | 'INACTIVE'
}

export interface ClassUpdateInput {
  key?: string
  name?: string
  description?: string
  sortOrder?: number
  status?: 'ACTIVE' | 'INACTIVE'
}

// ---------------------------------------------------------------------------
// Phase 5 — Fees & Finance. Mirrors `backend/src/services/finance-mapper.ts`.
// Money is always a fixed two-decimal-place string; the backend is the
// authoritative source of financial truth.
// ---------------------------------------------------------------------------

export type FeeTypeValue = 'TERMLY' | 'DAILY' | 'OTHER'
export type PaymentMethodValue = 'CASH' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CHEQUE'
export type AccountStatusValue = 'ACTIVE' | 'INACTIVE'
export type PaymentRecordStatusValue = 'ACTIVE' | 'VOIDED'

export interface AcademicSessionView {
  id: string
  name: string
  startDate: string
  endDate: string
  status: AccountStatusValue
  termCount: number
  feeCount: number
  createdAt: string
  updatedAt: string
}

export interface AcademicTermView {
  id: string
  sessionId: string
  name: string
  termNumber: number
  startDate: string
  endDate: string
  schoolDays: number
  status: AccountStatusValue
}

export interface FeeView {
  id: string
  sessionId: string
  sessionName: string
  name: string
  feeType: FeeTypeValue
  amount: string
  description: string | null
  status: AccountStatusValue
  assignmentCount: number
  activeAssignmentCount: number
  chargeCount: number
  createdAt: string
  updatedAt: string
}

export interface FeeAssignmentView {
  id: string
  pupilId: string
  pupilCode: string
  pupilName: string
  className: string
  feeId: string
  feeName: string
  status: AccountStatusValue
  chargeCount: number
  createdAt: string
}

export interface PaymentAllocationView {
  id: string
  chargeId: string
  feeName: string
  termName: string | null
  amount: string
}

export interface PaymentView {
  id: string
  paymentReference: string
  pupilId: string
  pupilCode: string
  pupilName: string
  amountPaid: string
  paymentMethod: PaymentMethodValue
  paymentDate: string
  note: string | null
  receivedById: string
  receivedByName: string
  status: PaymentRecordStatusValue
  voidedAt: string | null
  voidedById: string | null
  voidReason: string | null
  allocations: PaymentAllocationView[]
  createdAt: string
}

export interface PupilBalanceView {
  id: string
  pupilId: string
  fullName: string
  className: string
  status: AccountStatusValue
  totalDue: string
  totalPaid: string
  outstanding: string
  chargeCount: number
}

export interface PupilChargeView {
  id: string
  feeId: string
  feeName: string
  termId: string | null
  termName: string | null
  amount: string
  paid: string
  balance: string
}

export interface PupilFinanceView {
  pupil: { id: string; pupilId: string; fullName: string; className: string }
  totalDue: string
  totalPaid: string
  outstanding: string
  charges: PupilChargeView[]
  payments: PaymentView[]
}

export interface FeeSummaryView {
  total: number
  active: number
  byType: Record<FeeTypeValue, number>
}

export interface FinanceSummaryView {
  session: AcademicSessionView | null
  term: AcademicTermView | null
  expectedFees: string
  collected: string
  outstanding: string
  pupilsWithOutstanding: number
  paymentsThisTerm: string
  paymentsThisTermCount: number
  feeSummary: FeeSummaryView
  recentPayments: PaymentView[]
}

export interface AssignFeesResult {
  assigned: number
  skipped: number
}

export interface ChargeGenerateResult {
  created: number
}

export interface FinancePupilListResult {
  items: PupilBalanceView[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface PaymentListResult {
  items: PaymentView[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// Input payloads — mirror the Zod schemas in `backend/src/schemas/index.ts`.

export interface SessionCreateInput {
  name: string
  startDate: string
  endDate: string
  status?: AccountStatusValue
}

export interface SessionUpdateInput {
  name?: string
  startDate?: string
  endDate?: string
  status?: AccountStatusValue
}

export interface TermCreateInput {
  sessionId: string
  name: string
  termNumber: number
  startDate: string
  endDate: string
  schoolDays?: number
  status?: AccountStatusValue
}

export interface TermUpdateInput {
  name?: string
  termNumber?: number
  startDate?: string
  endDate?: string
  schoolDays?: number
  status?: AccountStatusValue
}

export interface FeeCreateInput {
  sessionId: string
  name: string
  feeType: FeeTypeValue
  amount: string
  description?: string
  status?: AccountStatusValue
}

export interface FeeUpdateInput {
  name?: string
  feeType?: FeeTypeValue
  amount?: string
  description?: string | null
  status?: AccountStatusValue
}

export interface PaymentAllocationInput {
  chargeId: string
  amount: string
}

export interface PaymentCreateInput {
  pupilId: string
  amountPaid: string
  paymentMethod: PaymentMethodValue
  paymentDate?: string
  note?: string
  allocations?: PaymentAllocationInput[]
}

export interface PaymentVoidInput {
  reason: string
}

// ---------------------------------------------------------------------------
// Phase 6 — Academic domain (teachers, subjects, teaching assignments, SBA).
// Mirrors `backend/src/services/subject.service.ts`, `academic.service.ts` and
// `sba.service.ts`. SBA scores are fixed two-decimal-place strings.
// ---------------------------------------------------------------------------

export interface SubjectView {
  id: string
  code: string
  name: string
  description: string | null
  status: AccountStatusValue
  assignmentCount: number
  createdAt: string
  updatedAt: string
}

export interface SubjectCreateInput {
  code: string
  name: string
  description?: string
  status?: AccountStatusValue
}

export interface SubjectUpdateInput {
  code?: string
  name?: string
  description?: string | null
  status?: AccountStatusValue
}

export interface TeacherAssignmentView {
  id: string
  teacherId: string
  subjectId: string
  subjectCode: string
  subjectName: string
  classId: string
  className: string
  status: AccountStatusValue
  pupilCount: number
  sbaEnteredCount: number
  createdAt: string
}

export interface TeacherListRow {
  id: string
  fullName: string
  email: string
  phone: string | null
  status: AccountStatusValue
  staffId: string
  position: string | null
  positionLabel: string
  roleNames: string[]
  assignmentCount: number
  classTeacherClassCount: number
  sbaRecordCount: number
}

export interface TeacherView extends TeacherListRow {
  category: string | null
  classesAsClassTeacher: Array<{ classId: string; className: string; pupilCount: number }>
  teachingAssignments: TeacherAssignmentView[]
  createdAt: string
}

export interface ClassTeacherView {
  id: string
  classId: string
  className: string
  teacherId: string
  teacherName: string
  createdAt: string
}

export interface TeachingAssignmentCreateInput {
  teacherId: string
  subjectId: string
  classId: string
}

export interface ClassTeacherAssignInput {
  teacherId: string
}

export interface TeachingAssignmentListQuery {
  teacherId?: string
  subjectId?: string
  classId?: string
  status?: AccountStatusValue
}

export interface TeacherPortalView {
  teacher: {
    id: string
    fullName: string
    email: string
    phone: string | null
    staffId: string
    position: string | null
    positionLabel: string
  }
  classesAsClassTeacher: Array<{ classId: string; className: string; pupilCount: number }>
  teachingAssignments: TeacherAssignmentView[]
  sba: { totalEntered: number; recordsCurrentTerm: number }
  recentSba: Array<{
    id: string
    pupilName: string
    subjectName: string
    className: string
    termName: string
    score: string
    maxScore: string
    updatedAt: string
  }>
}

export interface AcademicStatsView {
  teachers: { total: number; active: number; inactive: number }
  classes: number
  subjects: { total: number; active: number }
  assignments: { total: number; active: number }
  classTeachersAssigned: number
  sba: { total: number; recordsCurrentTerm: number }
}

export interface SbaRecordView {
  id: string
  pupilId: string
  pupilCode: string
  pupilName: string
  pupilStatus: AccountStatusValue
  subjectId: string
  subjectCode: string
  subjectName: string
  classId: string
  className: string
  sessionId: string
  sessionName: string
  termId: string
  termName: string
  termNumber: number
  teacherId: string
  teacherName: string
  score: string
  maxScore: string
  comment: string | null
  createdAt: string
  updatedAt: string
}

export interface SbaEntryDataView {
  subject: { id: string; code: string; name: string }
  class: { id: string; name: string }
  term: { id: string; name: string; sessionName: string }
  access: 'view' | 'manage'
  pupils: Array<{
    id: string
    pupilId: string
    fullName: string
    status: AccountStatusValue
    record: SbaRecordView | null
  }>
}

export interface SbaListQuery {
  sessionId?: string
  termId?: string
  classId?: string
  subjectId?: string
  pupilId?: string
  teacherId?: string
}

export interface SbaEntryInput {
  pupilId: string
  score: number
  maxScore: number
  comment?: string | null
}

export interface SbaBulkUpsertInput {
  subjectId: string
  classId: string
  termId: string
  entries: SbaEntryInput[]
}

export interface SbaBulkResult {
  upserted: number
  records: SbaRecordView[]
}

export interface SbaUpdateInput {
  score: number
  maxScore: number
  comment?: string | null
}

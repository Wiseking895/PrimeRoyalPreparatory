import { z } from 'zod'
import { STAFF_POSITION_KEYS } from '../rbac/catalog'

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(190, 'Email is too long.')

const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password is too long.')
  .regex(/[A-Za-z]/, 'Password must include at least one letter.')
  .regex(/[0-9]/, 'Password must include at least one number.')

const optionalPhone = z
  .string()
  .trim()
  .max(40, 'Phone number is too long.')
  .optional()
  .or(z.literal(''))

const optionalEmail = emailField.optional().or(z.literal(''))

const genderEnum = z.enum(['MALE', 'FEMALE'], {
  errorMap: () => ({ message: 'Please select a valid gender.' }),
})

/**
 * Optional class division (streams). Absent / null / "UNDIVIDED" all mean an
 * undivided class; otherwise one of A–D. Composed into the display name as
 * `Nursery 1` + `A` -> `Nursery 1A`.
 */
const classDivisionField = z.preprocess((value) => {
  if (value === undefined || value === null) return value
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (trimmed === '' || trimmed.toUpperCase() === 'UNDIVIDED') return null
  return trimmed.toUpperCase()
}, z.enum(['A', 'B', 'C', 'D']).nullable().optional())

const pupilIdField = z
  .string()
  .trim()
  .min(1, 'Pupil ID is required.')
  .max(40, 'Pupil ID is too long.')

const admissionNumberField = z
  .string()
  .trim()
  .min(1, 'Admission number is required.')
  .max(40, 'Admission number is too long.')

const sheetNumberField = z
  .string()
  .trim()
  .max(40, 'Sheet number is too long.')

/**
 * One-time admission fee (GHS) recorded on the admission record. Accepts
 * plain decimal money ("250", "250.50"); an empty value means "not recorded".
 * Deliberately separate from the recurring DAILY / PA / TERMLY fee structures.
 */
const admissionFeeField = z
  .string()
  .trim()
  .max(16, 'Admission fee is too long.')
  .refine((value) => value === '' || /^\d+(\.\d{1,2})?$/.test(value), {
    message: 'Enter a valid admission fee with up to 2 decimal places.',
  })

const uniformCollectionStatusEnum = z.enum(['NOT_COLLECTED', 'COLLECTED'], {
  errorMap: () => ({ message: 'Select a valid collection status.' }),
})

const dateField = z
  .string()
  .trim()
  .min(1, 'Enter a valid date.')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: 'Enter a valid date.',
  })

const optionalLongText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer.`)
    .optional()
    .or(z.literal(''))

/** One of the five "Uniforms to be Collected" items on the admission record. */
const pupilUniformInputSchema = z.object({
  slot: z
    .number({ invalid_type_error: 'Uniform slot must be a number.' })
    .int('Uniform slot must be a whole number.')
    .min(1, 'Uniform slot must be between 1 and 5.')
    .max(5, 'Uniform slot must be between 1 and 5.'),
  label: optionalLongText(80).nullable(),
  status: uniformCollectionStatusEnum.optional(),
})

const pupilUniformsField = z
  .array(pupilUniformInputSchema)
  .max(5, 'A maximum of 5 uniform items is allowed.')

const guardianInputSchema = z.object({
  fullName: z.string().trim().min(2, 'Guardian name must be at least 2 characters.').max(120),
  relationship: z.string().trim().min(1, 'Relationship is required.').max(60),
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalLongText(200),
  occupation: optionalLongText(100),
  isPrimary: z.boolean().default(false),
  isEmergency: z.boolean().default(false),
})

export const pupilCreateSchema = z.object({
  pupilId: pupilIdField.optional(),
  admissionNumber: admissionNumberField.optional(),
  sheetNumber: sheetNumberField.optional(),
  admissionFee: admissionFeeField.optional(),
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters.').max(80),
  middleName: optionalLongText(80),
  lastName: z.string().trim().min(2, 'Last name must be at least 2 characters.').max(80),
  dateOfBirth: dateField.refine((value) => new Date(value).getTime() <= Date.now(), {
    message: 'Date of birth cannot be in the future.',
  }),
  gender: genderEnum,
  classId: z.string().trim().min(1, 'Select a class.').max(100),
  dateAdmitted: dateField.optional(),
  address: optionalLongText(200),
  nationality: optionalLongText(60),
  religion: optionalLongText(60),
  admissionReason: optionalLongText(200),
  previousSchool: optionalLongText(120),
  stayWithChild: optionalLongText(120),
  declarationAcknowledged: z.boolean().default(false),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  guardians: z.array(guardianInputSchema).max(6, 'A maximum of 6 guardians is allowed.').default([]),
  uniforms: pupilUniformsField.optional(),
})

/**
 * Word import confirmation: each entry is the same shape the manual
 * registration endpoint accepts, plus the preview row number for reporting.
 */
export const pupilImportConfirmSchema = z.object({
  pupils: z
    .array(
      pupilCreateSchema.extend({
        rowNumber: z.number().int().min(1),
      }),
    )
    .min(1, 'Select at least one pupil to register.')
    .max(100, 'A maximum of 100 pupils can be imported at once.'),
})

export const pupilUpdateSchema = z.object({
  pupilId: pupilIdField.optional(),
  admissionNumber: admissionNumberField.optional().or(z.literal('')).nullable(),
  sheetNumber: sheetNumberField.nullable().optional(),
  admissionFee: admissionFeeField.nullable().optional(),
  firstName: z.string().trim().min(2).max(80).optional(),
  middleName: optionalLongText(80).nullable(),
  lastName: z.string().trim().min(2).max(80).optional(),
  dateOfBirth: dateField.optional(),
  gender: genderEnum.optional(),
  classId: z.string().trim().min(1).max(100).optional(),
  dateAdmitted: dateField.optional(),
  address: optionalLongText(200).nullable(),
  nationality: optionalLongText(60).nullable(),
  religion: optionalLongText(60).nullable(),
  admissionReason: optionalLongText(200).nullable(),
  previousSchool: optionalLongText(120).nullable(),
  stayWithChild: optionalLongText(120).nullable(),
  declarationAcknowledged: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  guardians: z.array(guardianInputSchema).max(6).optional(),
  uniforms: pupilUniformsField.optional(),
})

export const classCreateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, 'Class key is required.')
    .max(40, 'Class key is too long.')
    .toUpperCase()
    .regex(/^[A-Z0-9_]+$/, 'Use only uppercase letters, numbers and underscores.'),
  name: z.string().trim().min(1, 'Class name is required.').max(80, 'Class name is too long.'),
  division: classDivisionField,
  description: optionalLongText(200),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
})

export const classUpdateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .toUpperCase()
    .regex(/^[A-Z0-9_]+$/, 'Use only uppercase letters, numbers and underscores.')
    .optional(),
  name: z.string().trim().min(1).max(80).optional(),
  division: classDivisionField,
  description: optionalLongText(200).nullable(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

export const ownerSetupSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Full name must be at least 3 characters.').max(120),
    email: emailField,
    phone: optionalPhone,
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Email, staff ID or phone is required.'),
  password: z.string().min(1, 'Password is required.'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: passwordField,
})

export const firstPasswordChangeSchema = z
  .object({
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

export const headteacherCreateSchema = z.object({
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters.').max(80),
  lastName: z.string().trim().min(2, 'Last name must be at least 2 characters.').max(80),
  email: emailField,
  phone: optionalPhone,
  address: z.string().trim().max(200).optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
})

export const headteacherUpdateSchema = z.object({
  firstName: z.string().trim().min(2).max(80).optional(),
  lastName: z.string().trim().min(2).max(80).optional(),
  email: emailField.optional(),
  phone: optionalPhone,
  address: z.string().trim().max(200).optional().or(z.literal('')),
})

export const headteacherPermissionsSchema = z.object({
  permissionKeys: z.array(z.string().trim().min(1).max(100)).default([]),
})

export const staffCreateSchema = z.object({
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters.').max(80),
  lastName: z.string().trim().min(2, 'Last name must be at least 2 characters.').max(80),
  email: emailField,
  phone: optionalPhone,
  address: z.string().trim().max(200).optional().or(z.literal('')),
  position: z.enum(STAFF_POSITION_KEYS as [string, ...string[]], {
    errorMap: () => ({ message: 'Please select a valid staff position.' }),
  }),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
})

export const staffUpdateSchema = z.object({
  firstName: z.string().trim().min(2).max(80).optional(),
  lastName: z.string().trim().min(2).max(80).optional(),
  email: emailField.optional(),
  phone: optionalPhone,
  address: z.string().trim().max(200).optional().or(z.literal('')),
  category: z.enum(['TEACHING', 'NON_TEACHING']).optional(),
  position: z.enum(STAFF_POSITION_KEYS as [string, ...string[]]).optional(),
  responsibilities: z.string().trim().max(500).optional().or(z.literal('')),
})

export const roleAssignSchema = z.object({
  roleName: z.string().trim().min(1, 'Role is required.'),
})

const accountStatusEnum = z.enum(['ACTIVE', 'INACTIVE'], {
  errorMap: () => ({ message: 'Select a valid status.' }),
})

const moneyField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount with up to 2 decimal places.')
  .refine((value) => Number(value) > 0, { message: 'Amount must be greater than zero.' })

const feeTypeEnum = z.enum(['TERMLY', 'DAILY', 'OTHER', 'PA'], {
  errorMap: () => ({ message: 'Select a valid fee type.' }),
})

const paymentMethodEnum = z.enum(['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE'], {
  errorMap: () => ({ message: 'Select a valid payment method.' }),
})

export const sessionCreateSchema = z.object({
  name: z.string().trim().min(2, 'Academic year name must be at least 2 characters.').max(120),
  startDate: dateField,
  endDate: dateField,
  status: accountStatusEnum.default('ACTIVE'),
})

export const sessionUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  startDate: dateField.optional(),
  endDate: dateField.optional(),
  status: accountStatusEnum.optional(),
})

export const termCreateSchema = z.object({
  sessionId: z.string().trim().min(1, 'Select an academic year.').max(100),
  name: z.string().trim().min(1, 'Term name is required.').max(80),
  termNumber: z.number().int().min(1, 'Term number must be at least 1.').max(12, 'Term number is too large.'),
  startDate: dateField,
  endDate: dateField,
  schoolDays: z.number().int().min(0).max(366).optional(),
  status: accountStatusEnum.default('ACTIVE'),
})

export const termUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  termNumber: z.number().int().min(1).max(12).optional(),
  startDate: dateField.optional(),
  endDate: dateField.optional(),
  schoolDays: z.number().int().min(0).max(366).optional(),
  status: accountStatusEnum.optional(),
})

export const feeCreateSchema = z.object({
  sessionId: z.string().trim().min(1, 'Select an academic year.').max(100),
  termId: z.string().trim().min(1, 'Select a term.').max(100),
  name: z.string().trim().min(2, 'Fee name must be at least 2 characters.').max(120),
  feeType: feeTypeEnum,
  amount: moneyField,
  description: optionalLongText(300),
  status: accountStatusEnum.default('ACTIVE'),
})

export const feeUpdateSchema = z.object({
  termId: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  feeType: feeTypeEnum.optional(),
  amount: moneyField.optional(),
  description: optionalLongText(300).nullable(),
  status: accountStatusEnum.optional(),
})

export const feeAssignSchema = z.object({
  pupilIds: z
    .array(z.string().trim().min(1).max(100))
    .min(1, 'Select at least one pupil.')
    .max(500, 'A maximum of 500 pupils can be assigned at once.'),
})

export const feeBatchCreateSchema = z.object({
  sessionId: z.string().trim().min(1, 'Select an academic year.').max(100),
  termId: z.string().trim().min(1, 'Select a term.').max(100),
  fees: z
    .array(
      z.object({
        name: z.string().trim().min(2, 'Fee name must be at least 2 characters.').max(120),
        feeType: feeTypeEnum,
        amount: moneyField,
        description: optionalLongText(300),
      }),
    )
    .min(1, 'Add at least one fee.')
    .max(20, 'A maximum of 20 fees can be created at once.'),
})

export const paymentAllocationSchema = z.object({
  chargeId: z.string().trim().min(1).max(100),
  amount: moneyField,
})

export const paymentCreateSchema = z.object({
  pupilId: z.string().trim().min(1, 'Select a pupil.').max(100),
  amountPaid: moneyField,
  paymentMethod: paymentMethodEnum,
  paymentDate: dateField.optional(),
  note: optionalLongText(500),
  allocations: z
    .array(paymentAllocationSchema)
    .max(100, 'A maximum of 100 allocations is allowed.')
    .optional(),
})

export const paymentVoidSchema = z.object({
  reason: z.string().trim().min(3, 'Void reason must be at least 3 characters.').max(300),
})

export const markPaidSchema = z.object({
  pupilId: z.string().trim().min(1, 'Select a pupil.').max(100),
  paymentMethod: paymentMethodEnum.optional(),
  paymentDate: dateField.optional(),
  dailyPaid: z.boolean(),
  paPaid: z.boolean(),
  note: optionalLongText(500),
})

export const markUnpaidSchema = z.object({
  pupilId: z.string().trim().min(1, 'Select a pupil.').max(100),
  paymentDate: dateField.optional(),
  dailyUnpaid: z.boolean(),
  paUnpaid: z.boolean(),
})

export const chargeGenerateSchema = z.object({
  sessionId: z.string().trim().min(1, 'Select an academic year.').max(100),
})

// Finance Reconciliation attendance toggle — narrowly scoped upsert for the
// reconciliation table. Guarded by payments.record (same as reconciliation close),
// deliberately separate from generic /api/attendance (attendance.manage).
export const reconciliationAttendanceSchema = z.object({
  pupilId: z.string().trim().min(1, 'Select a pupil.').max(100),
  date: dateField,
  status: z.enum(['PRESENT', 'ABSENT'], {
    errorMap: () => ({ message: 'Select a valid attendance status.' }),
  }),
})

// =============================================================================
// Phase 6 — academic domain (subjects, teaching assignments, SBA)
// =============================================================================

const idField = z.string().trim().min(1, 'Required.').max(100)

const subjectCodeField = z
  .string()
  .trim()
  .min(1, 'Subject code is required.')
  .max(20, 'Subject code is too long.')
  .toUpperCase()
  .regex(/^[A-Z0-9_-]+$/, 'Use only uppercase letters, numbers, hyphens and underscores.')

const subjectNameField = z
  .string()
  .trim()
  .min(2, 'Subject name must be at least 2 characters.')
  .max(120, 'Subject name is too long.')

export const subjectCreateSchema = z.object({
  code: subjectCodeField,
  name: subjectNameField,
  description: optionalLongText(300),
  status: accountStatusEnum.default('ACTIVE'),
})

export const subjectUpdateSchema = z.object({
  code: subjectCodeField.optional(),
  name: subjectNameField.optional(),
  description: optionalLongText(300).nullable(),
  status: accountStatusEnum.optional(),
})

export const classTeacherAssignSchema = z.object({
  teacherId: idField,
})

export const teachingAssignmentCreateSchema = z.object({
  teacherId: idField,
  subjectId: idField,
  classId: idField,
})

const scoreField = z
  .number({ invalid_type_error: 'Enter a valid score.' })
  .min(0, 'Score cannot be negative.')
  .max(999.99, 'Score is too large.')

const maxScoreField = z
  .number({ invalid_type_error: 'Enter a valid maximum score.' })
  .min(0.01, 'Maximum score must be greater than zero.')
  .max(999.99, 'Maximum score is too large.')

const sbaEntrySchema = z
  .object({
    pupilId: idField,
    score: scoreField,
    maxScore: maxScoreField,
    comment: optionalLongText(500).nullable(),
  })
  .refine((entry) => entry.score <= entry.maxScore, {
    message: 'Score cannot exceed the maximum score.',
    path: ['score'],
  })

export const sbaBulkUpsertSchema = z.object({
  subjectId: idField,
  classId: idField,
  termId: idField,
  entries: z
    .array(sbaEntrySchema)
    .min(1, 'Add at least one pupil score.')
    .max(200, 'A maximum of 200 entries is allowed.'),
})

export const sbaUpdateSchema = z
  .object({
    score: scoreField,
    maxScore: maxScoreField,
    comment: optionalLongText(500).nullable(),
  })
.refine((data) => data.score <= data.maxScore, {
    message: 'Score cannot exceed the maximum score.',
    path: ['score'],
  })

// =============================================================================
// Phase 7 — Terminal reports & Parent Portal
// =============================================================================

export const parentLoginSchema = z.object({
  identifier: z.string().trim().min(1, 'Email is required.'),
  password: z.string().min(1, 'Password is required.'),
})

export const parentChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: passwordField,
})

export const parentFirstPasswordChangeSchema = z
  .object({
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

export const parentAccountCreateSchema = z.object({
  accountEmail: optionalEmail,
})

// =============================================================================
// Phase 8 — GPS Staff Attendance
// =============================================================================

export const attendanceStatusEnum = z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'], {
  errorMap: () => ({ message: 'Select a valid attendance status.' }),
})

const attendanceDateField = z
  .string()
  .trim()
  .min(1, 'Date is required.')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: 'Enter a valid date.',
  })

export const attendanceCreateSchema = z.object({
  pupilId: z.string().trim().min(1, 'Select a pupil.').max(100),
  status: attendanceStatusEnum,
  date: attendanceDateField,
  sessionId: z.string().trim().min(1, 'Select an academic year.').max(100).optional(),
  classId: z.string().trim().min(1, 'Select a class.').max(100).optional(),
  notes: z.string().trim().max(500).optional(),
})

export const attendanceUpdateSchema = z.object({
  status: attendanceStatusEnum.optional(),
  date: attendanceDateField.optional(),
  notes: z.string().trim().max(500).optional(),
})

// GPS Staff Check-In Schema
export const staffCheckInSchema = z.object({
  latitude: z.number().refine((val) => !isNaN(val) && val >= -90 && val <= 90, {
    message: 'Invalid latitude.',
  }),
  longitude: z.number().refine((val) => !isNaN(val) && val >= -180 && val <= 180, {
    message: 'Invalid longitude.',
  }),
  accuracy: z.number().int().positive('Accuracy must be a positive integer.'),
  capturedAt: z.string().refine((val) => !isNaN(new Date(val).getTime()), {
    message: 'Invalid capture timestamp.',
  }),
})

// Today's attendance lookup schema
export const todayAttendanceSchema = z.object({
  staffId: z.string().trim().min(1, 'Staff ID is required.').max(100),
})
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

const guardianInputSchema = z.object({
  fullName: z.string().trim().min(2, 'Guardian name must be at least 2 characters.').max(120),
  relationship: z.string().trim().min(1, 'Relationship is required.').max(60),
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalLongText(200),
  isPrimary: z.boolean().default(false),
  isEmergency: z.boolean().default(false),
})

export const pupilCreateSchema = z.object({
  pupilId: pupilIdField.optional(),
  admissionNumber: admissionNumberField.optional(),
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
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  guardians: z.array(guardianInputSchema).max(6, 'A maximum of 6 guardians is allowed.').default([]),
})

export const pupilUpdateSchema = z.object({
  pupilId: pupilIdField.optional(),
  admissionNumber: admissionNumberField.optional().or(z.literal('')).nullable(),
  firstName: z.string().trim().min(2).max(80).optional(),
  middleName: optionalLongText(80).nullable(),
  lastName: z.string().trim().min(2).max(80).optional(),
  dateOfBirth: dateField.optional(),
  gender: genderEnum.optional(),
  classId: z.string().trim().min(1).max(100).optional(),
  dateAdmitted: dateField.optional(),
  address: optionalLongText(200).nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  guardians: z.array(guardianInputSchema).max(6).optional(),
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
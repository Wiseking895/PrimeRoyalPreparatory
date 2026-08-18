import { z } from 'zod'

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

export const staffCreateSchema = z
  .object({
    firstName: z.string().trim().min(2, 'First name must be at least 2 characters.').max(80),
    lastName: z.string().trim().min(2, 'Last name must be at least 2 characters.').max(80),
    email: emailField,
    phone: optionalPhone,
    address: z.string().trim().max(200).optional().or(z.literal('')),
    roleName: z.string().trim().min(1).optional(),
    category: z.enum(['TEACHING', 'NON_TEACHING']).optional(),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

export const staffUpdateSchema = z.object({
  firstName: z.string().trim().min(2).max(80).optional(),
  lastName: z.string().trim().min(2).max(80).optional(),
  email: emailField.optional(),
  phone: optionalPhone,
  address: z.string().trim().max(200).optional().or(z.literal('')),
  category: z.enum(['TEACHING', 'NON_TEACHING']).optional(),
  responsibilities: z.string().trim().max(500).optional().or(z.literal('')),
})

export const roleAssignSchema = z.object({
  roleName: z.string().trim().min(1, 'Role is required.'),
})
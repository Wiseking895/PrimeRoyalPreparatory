import 'dotenv/config'
import { Environment } from './enums'

const DEFAULT_PORT = 4000
const DEFAULT_CLIENT_URL = 'http://localhost:5173'

function toNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * GPS and attendance configuration.
 * These values control the GPS-based staff attendance check-in behavior.
 * School coordinates are the authoritative PRPS school reference point.
 */
function toGpsLatitude(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= -90 && parsed <= 90 ? parsed : 6.76049
}

function toGpsLongitude(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= -180 && parsed <= 180 ? parsed : -1.60950
}

function toNumberDefault(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toEnvironment(value: string | undefined): Environment {
  if (value === Environment.Production || value === Environment.Test) {
    return value
  }
  return Environment.Development
}

/**
 * Parsed and validated environment configuration. Secrets are loaded only in
 * the backend process and are never exposed to the frontend bundle.
 */
export const env = {
  nodeEnv: toEnvironment(process.env.NODE_ENV),
  isProduction: process.env.NODE_ENV === Environment.Production,
  port: toNumber(process.env.PORT, DEFAULT_PORT),
  clientUrl: process.env.CLIENT_URL ?? DEFAULT_CLIENT_URL,
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'unsafe-default-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  passwordCost: toNumber(process.env.PASSWORD_HASH_COST, 12),
  // Email (invitations). When SMTP is not configured the mail service falls
  // back to a development transport that prints messages to the server log
  // instead of sending real email.
  emailHost: process.env.EMAIL_HOST ?? '',
  emailPort: toNumber(process.env.EMAIL_PORT, 587),
  emailSecure: process.env.EMAIL_SECURE === 'true',
  emailUser: process.env.EMAIL_USER ?? '',
  emailPassword: process.env.EMAIL_PASSWORD ?? '',
  emailFrom: process.env.EMAIL_FROM ?? '',
  emailEnabled: process.env.EMAIL_ENABLED === 'true',
  // GPS Attendance Configuration
  attendanceSchoolLatitude: toGpsLatitude(process.env.ATTENDANCE_SCHOOL_LATITUDE),
  attendanceSchoolLongitude: toGpsLongitude(process.env.ATTENDANCE_SCHOOL_LONGITUDE),
  attendanceRadiusMeters: toNumberDefault(process.env.ATTENDANCE_RADIUS_METERS, 100),
  attendanceMaxAccuracyMeters: toNumberDefault(process.env.ATTENDANCE_MAX_ACCURACY_METERS, 50),
  attendanceMaxLocationAgeSeconds: toNumberDefault(process.env.ATTENDANCE_MAX_LOCATION_AGE_SECONDS, 120),
} as const

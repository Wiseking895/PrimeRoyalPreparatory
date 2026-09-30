import 'dotenv/config'
import { Environment } from './enums.js'

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

/** Known placeholder used only as a local-development convenience. */
const DEV_JWT_SECRET_FALLBACK = 'unsafe-default-change-me'

/**
 * Resolves the JWT signing secret.
 *
 * Production never falls back: `JWT_SECRET` must be explicitly provided, and
 * the built-in development placeholder is rejected, so a misconfigured
 * deployment fails fast at startup instead of silently signing tokens with a
 * known value. Non-production keeps the development fallback so local runs and
 * tests work without extra setup. Error messages never contain the configured
 * value (or the placeholder itself).
 */
export function resolveJwtSecret(isProduction: boolean, rawSecret: string | undefined): string {
  const secret = rawSecret && rawSecret.trim() ? rawSecret : undefined

  if (!isProduction) {
    return secret ?? DEV_JWT_SECRET_FALLBACK
  }

  if (!secret) {
    throw new Error(
      'JWT_SECRET is required when NODE_ENV=production. Set a strong secret in the deployment environment before starting the backend.',
    )
  }

  if (secret.trim() === DEV_JWT_SECRET_FALLBACK) {
    throw new Error(
      'JWT_SECRET must not be the built-in development placeholder when NODE_ENV=production. Set a unique secret in the deployment environment.',
    )
  }

  return secret
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
  jwtSecret: resolveJwtSecret(process.env.NODE_ENV === Environment.Production, process.env.JWT_SECRET),
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
  // Cloudflare R2 (private object storage for documents and profile pictures).
  // Empty strings mean "not configured": storage-backed operations then fail
  // with a clear error while the rest of the application keeps working.
  // These values are server-only and must never be exposed as VITE_* vars.
  r2AccountId: process.env.R2_ACCOUNT_ID ?? '',
  r2Endpoint: process.env.R2_ENDPOINT ?? '',
  r2BucketName: process.env.R2_BUCKET_NAME ?? '',
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  /** Lifetime of a presigned object URL in seconds (default 5 minutes). */
  r2PresignExpiresInSeconds: toNumberDefault(process.env.R2_PRESIGN_EXPIRES_IN, 300),
} as const

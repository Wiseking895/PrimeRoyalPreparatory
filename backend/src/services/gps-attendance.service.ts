import { HttpStatus } from '../config/enums'
import { prisma } from '../lib/prisma'
import { recordAudit } from './audit.service'

/**
 * Geographic constants for PRPS school attendance validation.
 * School coordinates: Atimatim, Afigya Kwabre, Ashanti Region, Ghana
 * Latitude: 6.76049, Longitude: -1.60950
 */
export const SCHOOL_COORDINATES = {
  latitude: 6.76049,
  longitude: -1.60950,
}

/**
 * Default attendance configuration values.
 * These can be overridden via environment variables:
 *   - ATTENDANCE_RADIUS_METERS
 *   - ATTENDANCE_MAX_ACCURACY_METERS
 *   - ATTENDANCE_MAX_LOCATION_AGE_SECONDS
 */
export const DEFAULT_ATTENDANCE_CONFIG = {
  radiusMeters: Number(process.env.ATTENDANCE_RADIUS_METERS) || 100,
  maxAccuracyMeters: Number(process.env.ATTENDANCE_MAX_ACCURACY_METERS) || 50,
  maxLocationAgeSeconds: Number(process.env.ATTENDANCE_MAX_LOCATION_AGE_SECONDS) || 120,
}

/**
 * Calculates the great-circle distance between two points on Earth using the Haversine formula.
 * Returns distance in meters.
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3 // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Validates a GPS check-in payload and returns distance info.
 */
interface GpsValidationResult {
  valid: boolean
  distanceMeters: number
  reason?: string
  accuracyTooPoor: boolean
  staleLocation: boolean
}

export function validateGpsPayload(
  latitude: number,
  longitude: number,
  accuracy: number | null | undefined,
  capturedAt: number | string | Date | null | undefined,
  config = DEFAULT_ATTENDANCE_CONFIG,
): GpsValidationResult {
  const result: GpsValidationResult = {
    valid: false,
    distanceMeters: 0,
    accuracyTooPoor: false,
    staleLocation: false,
  }

  // 1. Validate latitude
  if (typeof latitude !== 'number' || isNaN(latitude) || latitude < -90 || latitude > 90) {
    result.reason = 'Invalid latitude.'
    return result
  }

  // 2. Validate longitude
  if (typeof longitude !== 'number' || isNaN(longitude) || longitude < -180 || longitude > 180) {
    result.reason = 'Invalid longitude.'
    return result
  }

  // 3. Validate accuracy
  if (accuracy === null || accuracy === undefined || typeof accuracy !== 'number' || isNaN(accuracy) || accuracy <= 0) {
    result.reason = 'Invalid GPS accuracy.'
    result.accuracyTooPoor = true
    return result
  }

  // 4. Validate capturedAt
  let capturedTime: number
  if (capturedAt === null || capturedAt === undefined) {
    result.reason = 'Missing capture timestamp.'
    result.staleLocation = true
    return result
  } else if (capturedAt instanceof Date) {
    capturedTime = capturedAt.getTime()
  } else if (typeof capturedAt === 'number') {
    capturedTime = capturedAt
  } else if (typeof capturedAt === 'string') {
    const parsed = new Date(capturedAt).getTime()
    if (isNaN(parsed)) {
      result.reason = 'Invalid capture timestamp format.'
      result.staleLocation = true
      return result
    }
    capturedTime = parsed
  } else {
    result.reason = 'Invalid capture timestamp type.'
    result.staleLocation = true
    return result
  }

  // 5. Check timestamp freshness
  const now = Date.now()
  const locationAge = now - capturedTime
  if (locationAge > config.maxLocationAgeSeconds * 1000) {
    result.reason = 'Location timestamp is too stale.'
    result.staleLocation = true
    return result
  }

  // For the distance calculation, we use the school coordinates as the reference point.
  // The result.distanceMeters will be computed below.

  // 6. Calculate distance from school (will be checked against radius in caller)
  // We compute this even if we return early, so the caller has the value.
  // Note: We'll compute distance after this function with the school coordinates.
  // For now, set a placeholder; the caller will recompute or we'll compute it below.
  // Actually, let's compute it here since we have the school coordinates.
  const R = 6371e3
  const φ1 = (latitude * Math.PI) / 180
  const φ2 = (SCHOOL_COORDINATES.latitude * Math.PI) / 180
  const Δφ = ((SCHOOL_COORDINATES.latitude - latitude) * Math.PI) / 180
  const Δλ = ((SCHOOL_COORDINATES.longitude - longitude) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  result.distanceMeters = R * c

  // 7. Check if accuracy meets threshold
  if (accuracy > config.maxAccuracyMeters) {
    result.accuracyTooPoor = true
    result.reason = `GPS accuracy (${accuracy}m) exceeds maximum allowed (${config.maxAccuracyMeters}m).`
    return result
  }

  // All validations passed
  result.valid = true
  return result
}

/**
 * Interface for the check-in input from the frontend.
 */
export interface StaffCheckInInput {
  latitude: number
  longitude: number
  accuracy: number
  capturedAt: string | number | Date
}

/**
 * Interface for the check-in response.
 */
export interface StaffCheckInResponse {
  success: boolean
  message: string
  attendanceId?: string
  distanceMeters?: number
  withinRadius?: boolean
}

/**
 * Performs a staff GPS check-in.
 *
 * Steps:
 * 1. Validate GPS payload (coordinates, accuracy, timestamp)
 * 2. Calculate distance from school coordinates
 * 3. Check if within configured radius
 * 4. Check for duplicate same-day check-in (database unique constraint)
 * 5. Record the attendance check-in
 * 6. Log the action via audit
 *
 * The authenticated user's identity is derived from the session (req.user),
 * NOT from the client-supplied staffId.
 */
export async function checkInStaff(
  latitude: number,
  longitude: number,
  accuracy: number,
  capturedAt: string | number | Date,
  staffUserId: string,
): Promise<StaffCheckInResponse> {
  // Step 1: Validate GPS payload
  const validation = validateGpsPayload(latitude, longitude, accuracy, capturedAt)
  if (!validation.valid) {
    const reason = validation.reason ?? 'GPS validation failed.'
    return {
      success: false,
      message: reason,
    }
  }

  const distanceMeters = validation.distanceMeters
  const config = DEFAULT_ATTENDANCE_CONFIG

  // Step 2: Check if within configured radius
  const withinRadius = distanceMeters <= config.radiusMeters
  if (!withinRadius) {
    return {
      success: false,
      message: `You are too far from the school. Distance: ${Math.round(distanceMeters)}m, Radius: ${config.radiusMeters}m.`,
      distanceMeters,
      withinRadius: false,
    }
  }

  // Step 3: Check for duplicate same-day check-in
  // The database unique constraint on (staffId, date) prevents duplicates,
  // but we check first to provide a better error message.
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0) // Start of today in server time
  const todayEnd = new Date(todayStart)
  todayEnd.setHours(23, 59, 59, 999) // End of today

  const existingAttendance = await prisma.attendance.findFirst({
    where: {
      staffId: staffUserId,
      date: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
  })

  if (existingAttendance) {
    return {
      success: false,
      message: 'You have already checked in today.',
      attendanceId: existingAttendance.id,
      distanceMeters,
      withinRadius: true,
    }
  }

  // Step 4: Record the attendance check-in
  // The attendance date is based on the server's current time,
  // NOT the client-supplied timestamp.
  const attendanceDate = new Date() // Server's current time determines the date

  try {
    const attendanceRecord = await prisma.attendance.create({
      data: {
        staffId: staffUserId,
        latitude,
        longitude,
        accuracy,
        capturedAt: new Date(capturedAt),
        date: attendanceDate,
        status: 'PRESENT',
      },
    })

    // Step 5: Log the action via audit
    await recordAudit({
      actorUserId: staffUserId,
      action: 'attendance.checkin',
      resourceType: 'attendance',
      resourceId: attendanceRecord.id,
      metadata: {
        distanceMeters: Math.round(distanceMeters),
        withinRadius: true,
        latitude,
        longitude,
        accuracy,
      },
      ip: undefined, // Will be filled by the caller if available
    })

    return {
      success: true,
      message: 'Check-in successful.',
      attendanceId: attendanceRecord.id,
      distanceMeters: Math.round(distanceMeters),
      withinRadius: true,
    }
  } catch (error: any) {
    // Handle database unique constraint violation (duplicate check-in)
    if (error.code === 'P2003' || error.message?.includes('unique constraint')) {
      return {
        success: false,
        message: 'You have already checked in today.',
      }
    }
    throw error
  }
}

/**
 * Gets the attendance record for a staff member for the current day.
 */
export async function getStaffTodayAttendance(
  staffUserId: string,
): Promise<{
  success: boolean
  attendance?: any
  message?: string
}> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setHours(23, 59, 59, 999)

  const attendance = await prisma.attendance.findFirst({
    where: {
      staffId: staffUserId,
      date: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    include: {
      staff: {
        select: {
          fullName: true,
          staffId: true,
        },
      },
    },
  })

  if (!attendance) {
    return { success: false, message: 'No attendance record found for today.' }
  }

  return {
    success: true,
    attendance: {
      id: attendance.id,
      date: attendance.date,
      status: attendance.status,
      latitude: attendance.latitude,
      longitude: attendance.longitude,
      accuracy: attendance.accuracy,
      capturedAt: attendance.capturedAt,
    },
  }
}

/**
 * Lists attendance records for administrative review.
 */
export async function listAttendanceRecordsAdmin(
  options: {
    staffId?: string
    dateFrom?: string
    dateTo?: string
  } = {},
): Promise<any[]> {
  const where: any = {}

  if (options.staffId) {
    where.staffId = options.staffId
  }
  if (options.dateFrom || options.dateTo) {
    where.date = {}
    if (options.dateFrom) {
      where.date.gte = new Date(options.dateFrom)
    }
    if (options.dateTo) {
      where.date.lte = new Date(options.dateTo)
    }
  }

  const records = await prisma.attendance.findMany({
    where,
    include: {
      staff: {
        select: {
          fullName: true,
          staffId: true,
          position: true,
        },
      },
    },
    orderBy: { date: 'desc' },
  })

  return records.map((r: any) => ({
    id: r.id,
    staffId: r.staffId,
    staffFullName: r.staff?.fullName ?? 'Unknown',
    date: r.date,
    status: r.status,
    latitude: r.latitude,
    longitude: r.longitude,
    accuracy: r.accuracy,
    capturedAt: r.capturedAt,
  }))
}

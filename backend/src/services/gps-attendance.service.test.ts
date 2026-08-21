import { describe, expect, it } from 'vitest'
import {
  validateGpsPayload,
  SCHOOL_COORDINATES,
  DEFAULT_ATTENDANCE_CONFIG,
} from './gps-attendance.service'

describe('gps-attendance.service', () => {
  describe('validateGpsPayload', () => {
    const validCoords = {
      latitude: SCHOOL_COORDINATES.latitude,
      longitude: SCHOOL_COORDINATES.longitude,
      accuracy: 10,
      capturedAt: new Date(),
    }

    it('A. accepts valid GPS check-in near school', () => {
      const result = validateGpsPayload(
        validCoords.latitude,
        validCoords.longitude,
        validCoords.accuracy,
        validCoords.capturedAt,
      )
      expect(result.valid).toBe(true)
      expect(result.distanceMeters).toBe(0)
      expect(result.accuracyTooPoor).toBe(false)
      expect(result.staleLocation).toBe(false)
      expect(result.futureTimestamp).toBe(false)
    })

    it('B1. accepts check-in at exact radius boundary', () => {
      // Place the user at exactly radiusMeters distance from school.
      // 1 meter of latitude ≈ 1/111320 degrees.
      const offsetDegrees = DEFAULT_ATTENDANCE_CONFIG.radiusMeters / 111320
      const result = validateGpsPayload(
        SCHOOL_COORDINATES.latitude + offsetDegrees,
        SCHOOL_COORDINATES.longitude,
        10,
        new Date(),
      )
      expect(result.valid).toBe(true)
      expect(result.distanceMeters).toBeLessThanOrEqual(DEFAULT_ATTENDANCE_CONFIG.radiusMeters)
    })

    it('B2. calculates distance beyond configured radius (radius check is in checkInStaff)', () => {
      // ~1.1km away from school
      const result = validateGpsPayload(
        SCHOOL_COORDINATES.latitude + 0.01,
        SCHOOL_COORDINATES.longitude,
        10,
        new Date(),
      )
      expect(result.valid).toBe(true)
      expect(result.distanceMeters).toBeGreaterThan(DEFAULT_ATTENDANCE_CONFIG.radiusMeters)
    })

    it('C. rejects poor GPS accuracy', () => {
      const result = validateGpsPayload(
        validCoords.latitude,
        validCoords.longitude,
        DEFAULT_ATTENDANCE_CONFIG.maxAccuracyMeters + 1,
        new Date(),
      )
      expect(result.valid).toBe(false)
      expect(result.accuracyTooPoor).toBe(true)
    })

    it('D. rejects missing GPS accuracy', () => {
      const result = validateGpsPayload(
        validCoords.latitude,
        validCoords.longitude,
        null,
        new Date(),
      )
      expect(result.valid).toBe(false)
      expect(result.accuracyTooPoor).toBe(true)
      expect(result.reason).toBe('Invalid GPS accuracy.')
    })

    it('E. rejects undefined GPS accuracy', () => {
      const result = validateGpsPayload(
        validCoords.latitude,
        validCoords.longitude,
        undefined,
        new Date(),
      )
      expect(result.valid).toBe(false)
      expect(result.accuracyTooPoor).toBe(true)
    })

    it('F. rejects zero GPS accuracy', () => {
      const result = validateGpsPayload(
        validCoords.latitude,
        validCoords.longitude,
        0,
        new Date(),
      )
      expect(result.valid).toBe(false)
      expect(result.accuracyTooPoor).toBe(true)
    })

    it('G. rejects negative GPS accuracy', () => {
      const result = validateGpsPayload(
        validCoords.latitude,
        validCoords.longitude,
        -5,
        new Date(),
      )
      expect(result.valid).toBe(false)
      expect(result.accuracyTooPoor).toBe(true)
    })

    it('H. rejects invalid latitude', () => {
      const result = validateGpsPayload(
        91,
        validCoords.longitude,
        validCoords.accuracy,
        new Date(),
      )
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Invalid latitude.')
    })

    it('I. rejects invalid longitude', () => {
      const result = validateGpsPayload(
        validCoords.latitude,
        181,
        validCoords.accuracy,
        new Date(),
      )
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Invalid longitude.')
    })

    it('J. rejects non-number latitude', () => {
      const result = validateGpsPayload(
        NaN,
        validCoords.longitude,
        validCoords.accuracy,
        new Date(),
      )
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Invalid latitude.')
    })

    it('K. rejects stale capturedAt', () => {
      const staleTime = new Date(Date.now() - (DEFAULT_ATTENDANCE_CONFIG.maxLocationAgeSeconds + 10) * 1000)
      const result = validateGpsPayload(
        validCoords.latitude,
        validCoords.longitude,
        validCoords.accuracy,
        staleTime,
      )
      expect(result.valid).toBe(false)
      expect(result.staleLocation).toBe(true)
      expect(result.reason).toBe('Location timestamp is too stale.')
    })

    it('L. rejects future capturedAt beyond clock-skew tolerance', () => {
      const futureTime = new Date(Date.now() + 120 * 1000) // 2 minutes in future
      const result = validateGpsPayload(
        validCoords.latitude,
        validCoords.longitude,
        validCoords.accuracy,
        futureTime,
      )
      expect(result.valid).toBe(false)
      expect(result.futureTimestamp).toBe(true)
      expect(result.reason).toBe('GPS capture timestamp is in the future.')
    })

    it('M. accepts capturedAt within clock-skew tolerance', () => {
      const slightlyFuture = new Date(Date.now() + 30 * 1000) // 30 seconds — within tolerance
      const result = validateGpsPayload(
        validCoords.latitude,
        validCoords.longitude,
        validCoords.accuracy,
        slightlyFuture,
      )
      expect(result.valid).toBe(true)
    })

    it('N. rejects missing capturedAt', () => {
      const result = validateGpsPayload(
        validCoords.latitude,
        validCoords.longitude,
        validCoords.accuracy,
        null,
      )
      expect(result.valid).toBe(false)
      expect(result.staleLocation).toBe(true)
      expect(result.reason).toBe('Missing capture timestamp.')
    })

    it('O. rejects undefined capturedAt', () => {
      const result = validateGpsPayload(
        validCoords.latitude,
        validCoords.longitude,
        validCoords.accuracy,
        undefined,
      )
      expect(result.valid).toBe(false)
      expect(result.staleLocation).toBe(true)
    })

    it('P. rejects invalid capturedAt string', () => {
      const result = validateGpsPayload(
        validCoords.latitude,
        validCoords.longitude,
        validCoords.accuracy,
        'not-a-date',
      )
      expect(result.valid).toBe(false)
      expect(result.staleLocation).toBe(true)
      expect(result.reason).toBe('Invalid capture timestamp format.')
    })

    it('Q. accepts capturedAt as epoch number', () => {
      const result = validateGpsPayload(
        validCoords.latitude,
        validCoords.longitude,
        validCoords.accuracy,
        Date.now(),
      )
      expect(result.valid).toBe(true)
    })

    it('R. accepts capturedAt as ISO string', () => {
      const result = validateGpsPayload(
        validCoords.latitude,
        validCoords.longitude,
        validCoords.accuracy,
        new Date().toISOString(),
      )
      expect(result.valid).toBe(true)
    })

    it('S. calculates distance correctly from school', () => {
      // Approximately 111 meters north of school (0.001 degree latitude ≈ 111m)
      const result = validateGpsPayload(
        SCHOOL_COORDINATES.latitude + 0.001,
        SCHOOL_COORDINATES.longitude,
        10,
        new Date(),
      )
      expect(result.valid).toBe(true)
      expect(result.distanceMeters).toBeGreaterThan(100)
      expect(result.distanceMeters).toBeLessThan(120)
    })

    it('T. returns distance even when accuracy is too poor', () => {
      const result = validateGpsPayload(
        SCHOOL_COORDINATES.latitude + 0.001,
        SCHOOL_COORDINATES.longitude,
        999,
        new Date(),
      )
      expect(result.valid).toBe(false)
      expect(result.accuracyTooPoor).toBe(true)
      expect(result.distanceMeters).toBeGreaterThan(100)
    })
  })

  describe('SCHOOL_COORDINATES', () => {
    it('has valid PRPS school coordinates', () => {
      expect(SCHOOL_COORDINATES.latitude).toBe(6.76049)
      expect(SCHOOL_COORDINATES.longitude).toBe(-1.60950)
    })
  })

  describe('DEFAULT_ATTENDANCE_CONFIG', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_ATTENDANCE_CONFIG.radiusMeters).toBeGreaterThan(0)
      expect(DEFAULT_ATTENDANCE_CONFIG.maxAccuracyMeters).toBeGreaterThan(0)
      expect(DEFAULT_ATTENDANCE_CONFIG.maxLocationAgeSeconds).toBeGreaterThan(0)
    })
  })
})

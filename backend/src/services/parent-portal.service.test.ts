import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assertGuardianOwnsPupil,
  getMyPupilFinance,
  getMyReport,
  listMyPupils,
} from './parent-portal.service'

const prismaMock = vi.hoisted(() => ({
  pupilGuardian: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  pupil: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  academicTerm: {
    findUnique: vi.fn(),
  },
  sbaRecord: {
    findMany: vi.fn(),
  },
  financeFee: { findMany: vi.fn() },
  feeCharge: { findMany: vi.fn() },
  feeAssignment: { findMany: vi.fn() },
  payment: { findMany: vi.fn() },
}))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))

function pupilLink(overrides: Record<string, unknown> = {}) {
  return {
    pupilId: 'p-1',
    guardianId: 'guardian-1',
    relationship: 'Mother',
    isPrimary: true,
    isEmergency: true,
    pupil: {
      id: 'p-1',
      pupilId: 'PRPS-PUP-0001',
      firstName: 'Ama',
      lastName: 'Owusu',
      gender: 'FEMALE',
      status: 'ACTIVE',
      dateOfBirth: new Date('2015-01-01T00:00:00.000Z'),
      class: { id: 'cls-1', name: 'Class 1' },
    },
    ...overrides,
  }
}

describe('parent-portal.service (Phase 7 — ownership-scoped parent access)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.pupilGuardian.findUnique.mockResolvedValue({ pupilId: 'p-1' })
    prismaMock.pupilGuardian.findMany.mockResolvedValue([pupilLink()])
  })

  describe('assertGuardianOwnsPupil', () => {
    it('passes for a linked pupil', async () => {
      await expect(assertGuardianOwnsPupil('guardian-1', 'p-1')).resolves.toBeUndefined()
      expect(prismaMock.pupilGuardian.findUnique).toHaveBeenCalledWith({
        select: { pupilId: true },
        where: { pupilId_guardianId: { pupilId: 'p-1', guardianId: 'guardian-1' } },
      })
    })

    it('throws 403 for an unlinked pupil (IDOR protection)', async () => {
      prismaMock.pupilGuardian.findUnique.mockResolvedValue(null)
      await expect(assertGuardianOwnsPupil('guardian-1', 'p-999')).rejects.toThrow('not linked to this pupil')
    })
  })

  describe('listMyPupils', () => {
    it('returns only the guardian’s linked pupils', async () => {
      const children = await listMyPupils('guardian-1')
      expect(children).toHaveLength(1)
      expect(children[0]).toMatchObject({
        id: 'p-1',
        fullName: 'Ama Owusu',
        className: 'Class 1',
        relationship: 'Mother',
        isPrimary: true,
      })
      expect(prismaMock.pupilGuardian.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { guardianId: 'guardian-1' } }),
      )
    })
  })

  describe('getMyPupilFinance', () => {
    it('blocks finance for an unlinked pupil before any finance query runs', async () => {
      prismaMock.pupilGuardian.findUnique.mockResolvedValue(null)
      await expect(getMyPupilFinance('guardian-1', 'p-999')).rejects.toThrow('not linked')
      expect(prismaMock.feeCharge.findMany).not.toHaveBeenCalled()
    })

    it('returns finance only after ownership is verified', async () => {
      prismaMock.pupil.findUnique.mockResolvedValue({
        id: 'p-1',
        pupilId: 'PRPS-PUP-0001',
        firstName: 'Ama',
        lastName: 'Owusu',
        class: { name: 'Class 1' },
      })
      prismaMock.feeCharge.findMany.mockResolvedValue([])
      prismaMock.payment.findMany.mockResolvedValue([])
      const finance = await getMyPupilFinance('guardian-1', 'p-1')
      expect(finance.pupil.fullName).toBe('Ama Owusu')
      expect(finance.outstanding).toBe('0.00')
    })
  })

  describe('getMyReport', () => {
    it('blocks a report for an unlinked pupil', async () => {
      prismaMock.pupilGuardian.findUnique.mockResolvedValue(null)
      await expect(getMyReport('guardian-1', 'p-999', 't-1')).rejects.toThrow('not linked')
      expect(prismaMock.sbaRecord.findMany).not.toHaveBeenCalled()
    })

    it('returns the computed report for a linked pupil', async () => {
      prismaMock.pupil.findUnique.mockResolvedValue({
        id: 'p-1',
        pupilId: 'PRPS-PUP-0001',
        firstName: 'Ama',
        lastName: 'Owusu',
        class: { id: 'cls-1', name: 'Class 1' },
      })
      prismaMock.academicTerm.findUnique.mockResolvedValue({
        id: 't-1',
        name: 'First Term',
        termNumber: 1,
        session: { id: 's-1', name: '2025/2026 Academic Year' },
      })
      prismaMock.sbaRecord.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          pupilId: 'p-1',
          subjectId: 'sub-1',
          classId: 'cls-1',
          termId: 't-1',
          score: new Prisma.Decimal('85.00'),
          maxScore: new Prisma.Decimal('100.00'),
          comment: null,
          subject: { id: 'sub-1', code: 'MATH', name: 'Mathematics' },
          class: { id: 'cls-1', name: 'Class 1' },
        },
      ])
      const report = await getMyReport('guardian-1', 'p-1', 't-1')
      expect(report.subjects[0].subjectCode).toBe('MATH')
      expect(report.subjects[0].percentage).toBe(85)
      expect(report.overallGrade).toBe('A')
    })
  })
})
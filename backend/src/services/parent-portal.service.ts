import { HttpStatus } from '../config/enums.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../utils/app-error.js'
import { getPupilFinance } from './finance.service.js'
import type { PupilFinanceView } from './finance-mapper.js'
import {
  getTerminalReport,
  listReportSessionsForPupil,
  listReportTermsForPupil,
  type ReportSessionOption,
  type ReportTermOption,
  type TerminalReportView,
} from './report.service.js'

/**
 * Phase 7 Parent Portal.
 *
 * A parent's access is derived exclusively from the Guardian → Pupil linkage
 * (`PupilGuardian`). Every endpoint resolves the authenticated guardian from
 * the token and verifies the relationship server-side — a client-supplied
 * pupil id is never trusted on its own.
 */

export interface ParentChildView {
  id: string
  pupilId: string
  fullName: string
  className: string
  gender: 'MALE' | 'FEMALE'
  status: 'ACTIVE' | 'INACTIVE'
  dateOfBirth: string
  relationship: string | null
  isPrimary: boolean
  profilePictureUrl: string | null
}

export async function assertGuardianOwnsPupil(guardianId: string, pupilId: string): Promise<void> {
  const link = await prisma.pupilGuardian.findUnique({
    where: { pupilId_guardianId: { pupilId, guardianId } },
    select: { pupilId: true },
  })
  if (!link) {
    throw new AppError('Forbidden: you are not linked to this pupil.', HttpStatus.Forbidden)
  }
}

export async function listMyPupils(guardianId: string): Promise<ParentChildView[]> {
  const links = await prisma.pupilGuardian.findMany({
    where: { guardianId },
    include: {
      pupil: {
        include: { class: { select: { id: true, name: true } } },
      },
    },
    orderBy: { pupil: { firstName: 'asc' } },
  })

  return links.map((link) => ({
    id: link.pupil.id,
    pupilId: link.pupil.pupilId,
    fullName: `${link.pupil.firstName} ${link.pupil.lastName}`.trim(),
    className: link.pupil.class.name,
    gender: link.pupil.gender,
    status: link.pupil.status,
    dateOfBirth: link.pupil.dateOfBirth.toISOString(),
    relationship: link.relationship,
    isPrimary: link.isPrimary,
    profilePictureUrl: link.pupil.profilePictureUrl,
  }))
}

export async function getMyPupil(guardianId: string, pupilId: string): Promise<ParentChildView> {
  await assertGuardianOwnsPupil(guardianId, pupilId)
  const links = await listMyPupils(guardianId)
  const child = links.find((entry) => entry.id === pupilId)
  if (!child) {
    throw new AppError('Pupil record not found.', HttpStatus.NotFound)
  }
  return child
}

export async function getMyPupilFinance(guardianId: string, pupilId: string): Promise<PupilFinanceView> {
  await assertGuardianOwnsPupil(guardianId, pupilId)
  return getPupilFinance(pupilId)
}

export async function getMyReportSessions(guardianId: string, pupilId: string): Promise<ReportSessionOption[]> {
  await assertGuardianOwnsPupil(guardianId, pupilId)
  return listReportSessionsForPupil(pupilId)
}

export async function getMyReportTerms(
  guardianId: string,
  pupilId: string,
  sessionId?: string,
): Promise<ReportTermOption[]> {
  await assertGuardianOwnsPupil(guardianId, pupilId)
  return listReportTermsForPupil(pupilId, sessionId)
}

export async function getMyReport(guardianId: string, pupilId: string, termId: string): Promise<TerminalReportView> {
  await assertGuardianOwnsPupil(guardianId, pupilId)
  return getTerminalReport(pupilId, termId)
}
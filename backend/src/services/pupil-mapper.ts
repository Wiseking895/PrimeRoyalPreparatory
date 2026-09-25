import type { Prisma } from '@prisma/client'
import { money } from './finance-mapper'

export type UniformCollectionStatus = 'NOT_COLLECTED' | 'COLLECTED'

export const ADMISSION_UNIFORM_SLOTS = [1, 2, 3, 4, 5] as const

export interface PupilUniformRecord {
  slot: number
  label: string | null
  status: UniformCollectionStatus
}

export interface PupilGuardianRecord {
  relationship: string | null
  isPrimary: boolean
  isEmergency: boolean
  guardian: {
    id: string
    fullName: string
    phone: string | null
    email: string | null
    address: string | null
    occupation: string | null
  }
}

export interface PupilRecord {
  id: string
  pupilId: string
  admissionNumber: string | null
  sheetNumber?: string | null
  admissionFee?: Prisma.Decimal | string | number | null
  firstName: string
  middleName: string | null
  lastName: string
  dateOfBirth: Date
  gender: 'MALE' | 'FEMALE'
  profilePictureUrl: string | null
  nationality: string | null
  religion: string | null
  admissionReason: string | null
  previousSchool?: string | null
  stayWithChild?: string | null
  declarationAcknowledged: boolean
  classId: string
  dateAdmitted: Date
  status: 'ACTIVE' | 'INACTIVE'
  address: string | null
  createdAt: Date
  updatedAt: Date
  class: { id: string; name: string } | null
  guardians: PupilGuardianRecord[]
  uniforms?: PupilUniformRecord[]
}

export interface GuardianView {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  address: string | null
  occupation: string | null
  relationship: string | null
  isPrimary: boolean
  isEmergency: boolean
}

export interface PupilUniformView {
  slot: number
  label: string | null
  status: UniformCollectionStatus
}

export interface PupilView {
  id: string
  pupilId: string
  admissionNumber: string | null
  sheetNumber: string | null
  /** One-time admission fee as a fixed 2-decimal GHS string, or null. */
  admissionFee: string | null
  firstName: string
  middleName: string | null
  lastName: string
  fullName: string
  dateOfBirth: string
  gender: 'MALE' | 'FEMALE'
  profilePictureUrl: string | null
  nationality: string | null
  religion: string | null
  admissionReason: string | null
  /** "SCHOOL ATTENDED" from the physical admission form. */
  previousSchool: string | null
  /** "STAY WITH THE CHILD" living arrangement from the physical form. */
  stayWithChild: string | null
  declarationAcknowledged: boolean
  classId: string
  className: string
  dateAdmitted: string
  status: 'ACTIVE' | 'INACTIVE'
  address: string | null
  guardians: GuardianView[]
  /** Always the five admission slots 1–5, padded with "Not collected". */
  uniforms: PupilUniformView[]
  createdAt: string
  updatedAt: string
}

/**
 * Pupils registered before the uniform rows existed have no stored items, so
 * the view always exposes the five admission slots with a safe default.
 */
export function toUniformViews(records?: PupilUniformRecord[]): PupilUniformView[] {
  const bySlot = new Map<number, PupilUniformView>()
  for (const record of records ?? []) {
    if (!bySlot.has(record.slot)) {
      bySlot.set(record.slot, { slot: record.slot, label: record.label, status: record.status })
    }
  }
  return ADMISSION_UNIFORM_SLOTS.map((slot) => bySlot.get(slot) ?? { slot, label: null, status: 'NOT_COLLECTED' })
}

export function toPupilView(record: PupilRecord): PupilView {
  const fullName = [record.firstName, record.middleName, record.lastName]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    id: record.id,
    pupilId: record.pupilId,
    admissionNumber: record.admissionNumber,
    sheetNumber: record.sheetNumber ?? null,
    admissionFee: record.admissionFee === undefined || record.admissionFee === null ? null : money(record.admissionFee),
    firstName: record.firstName,
    middleName: record.middleName,
    lastName: record.lastName,
    fullName,
    dateOfBirth: record.dateOfBirth.toISOString(),
    gender: record.gender,
    profilePictureUrl: record.profilePictureUrl,
    nationality: record.nationality,
    religion: record.religion,
    admissionReason: record.admissionReason,
    previousSchool: record.previousSchool ?? null,
    stayWithChild: record.stayWithChild ?? null,
    declarationAcknowledged: record.declarationAcknowledged,
    classId: record.classId,
    className: record.class?.name ?? '—',
    dateAdmitted: record.dateAdmitted.toISOString(),
    status: record.status,
    address: record.address,
    guardians: record.guardians.map((entry) => ({
      id: entry.guardian.id,
      fullName: entry.guardian.fullName,
      phone: entry.guardian.phone,
      email: entry.guardian.email,
      address: entry.guardian.address,
      occupation: entry.guardian.occupation,
      relationship: entry.relationship,
      isPrimary: entry.isPrimary,
      isEmergency: entry.isEmergency,
    })),
    uniforms: toUniformViews(record.uniforms),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

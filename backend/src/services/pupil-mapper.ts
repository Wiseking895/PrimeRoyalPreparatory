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
  }
}

export interface PupilRecord {
  id: string
  pupilId: string
  admissionNumber: string | null
  firstName: string
  middleName: string | null
  lastName: string
  dateOfBirth: Date
  gender: 'MALE' | 'FEMALE'
  profilePictureUrl: string | null
  classId: string
  dateAdmitted: Date
  status: 'ACTIVE' | 'INACTIVE'
  address: string | null
  createdAt: Date
  updatedAt: Date
  class: { id: string; name: string } | null
  guardians: PupilGuardianRecord[]
}

export interface GuardianView {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  address: string | null
  relationship: string | null
  isPrimary: boolean
  isEmergency: boolean
}

export interface PupilView {
  id: string
  pupilId: string
  admissionNumber: string | null
  firstName: string
  middleName: string | null
  lastName: string
  fullName: string
  dateOfBirth: string
  gender: 'MALE' | 'FEMALE'
  profilePictureUrl: string | null
  classId: string
  className: string
  dateAdmitted: string
  status: 'ACTIVE' | 'INACTIVE'
  address: string | null
  guardians: GuardianView[]
  createdAt: string
  updatedAt: string
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
    firstName: record.firstName,
    middleName: record.middleName,
    lastName: record.lastName,
    fullName,
    dateOfBirth: record.dateOfBirth.toISOString(),
    gender: record.gender,
    profilePictureUrl: record.profilePictureUrl,
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
      relationship: entry.relationship,
      isPrimary: entry.isPrimary,
      isEmergency: entry.isEmergency,
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

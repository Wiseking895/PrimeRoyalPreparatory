import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HeadteacherDashboardPage } from './HeadteacherDashboardPage'
import type {
  AcademicStatsView,
  AttendanceView,
  OwnerFinanceOverviewView,
  PupilStats,
  StaffView,
  TeacherListRow,
} from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listStaff: vi.fn(),
  financeOverview: vi.fn(),
  academicStats: vi.fn(),
  listTeachers: vi.fn(),
  listAttendance: vi.fn(),
  pupilStats: vi.fn(),
  ownerSummary: vi.fn(),
  staffStats: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: apiMock }))

let PERMISSIONS: string[] = []

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'ht-1',
      fullName: 'Hilda Headteacher',
      email: 'ht@school.edu',
      phone: null,
      profilePictureUrl: null,
      status: 'ACTIVE',
      lastLoginAt: null,
      mustChangePassword: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      staffId: 'PRPS-HT-001',
      category: 'ADMINISTRATION',
      position: 'Headteacher',
      roles: ['HEADTEACHER'],
      permissions: PERMISSIONS,
    },
    hasPermission: (key: string) => PERMISSIONS.includes(key),
  }),
}))

const HEADTEACHER_PERMISSIONS = [
  'staff.view',
  'pupils.view',
  'classes.view',
  'attendance.view',
  'finance.view',
  'academic.view',
  'teachers.view',
]

function pupilStatsFixture(overrides: Partial<PupilStats> = {}): PupilStats {
  return {
    total: 120,
    active: 110,
    inactive: 10,
    byClass: [
      { classId: 'class-1', className: 'Primary 1', count: 60 },
      { classId: 'class-2', className: 'Primary 2', count: 60 },
    ],
    ...overrides,
  }
}

function attendanceFixture(): AttendanceView[] {
  return [
    {
      id: 'att-1',
      pupilId: 'pupil-1',
      pupilFullName: 'Ama Mensah',
      staffId: 'staff-1',
      staffFullName: 'Class Teacher',
      date: '2026-09-24',
      status: 'PRESENT',
      classId: 'class-1',
      createdAt: '2026-09-24T08:00:00.000Z',
    },
    {
      id: 'att-2',
      pupilId: 'pupil-2',
      pupilFullName: 'Kofi Mensah',
      staffId: 'staff-1',
      staffFullName: 'Class Teacher',
      date: '2026-09-24',
      status: 'ABSENT',
      classId: 'class-1',
      createdAt: '2026-09-24T08:00:00.000Z',
    },
    {
      id: 'att-3',
      pupilId: 'pupil-3',
      pupilFullName: 'Esi Owusu',
      staffId: 'staff-2',
      staffFullName: 'Class Teacher',
      date: '2026-09-24',
      status: 'PRESENT',
      classId: 'class-2',
      createdAt: '2026-09-24T08:00:00.000Z',
    },
  ]
}

function financeFixture(): OwnerFinanceOverviewView {
  return {
    session: { id: 'session-1', name: '2026/2027 Academic Session' },
    term: { id: 'term-1', name: 'First Term' },
    totals: {
      totalExpected: '1500000.00',
      totalCollected: '500000.00',
      totalOutstanding: '1000000.00',
      totalPupils: 150,
      pupilsWithCharges: 120,
      pupilsWithPayments: 80,
    },
    dailyFees: [
      {
        classId: 'class-1',
        className: 'Primary 1',
        pupilCount: 60,
        expectedAmount: '600.00',
        collectedAmount: '400.00',
        outstandingAmount: '200.00',
        boysPresent: 20,
        boysAbsent: 5,
        girlsPresent: 18,
        girlsAbsent: 7,
      },
    ],
    ptaFees: [
      {
        classId: 'class-1',
        className: 'Primary 1',
        pupilCount: 60,
        expectedAmount: '3000.00',
        collectedAmount: '1000.00',
        outstandingAmount: '2000.00',
        boysPresent: 0,
        boysAbsent: 0,
        girlsPresent: 0,
        girlsAbsent: 0,
      },
    ],
    maintenanceFees: [],
    paFees: [],
  }
}

function academicFixture(): AcademicStatsView {
  return {
    teachers: { total: 12, active: 10, inactive: 2 },
    classes: 8,
    subjects: { total: 15, active: 14 },
    assignments: { total: 40, active: 38 },
    classTeachersAssigned: 8,
    sba: { total: 200, recordsCurrentTerm: 50 },
  }
}

function staffFixture(): StaffView[] {
  return [
    {
      id: 'staff-1',
      fullName: 'Comfort Teacher',
      email: 'comfort@school.edu',
      phone: null,
      profilePictureUrl: null,
      status: 'ACTIVE',
      lastLoginAt: null,
      mustChangePassword: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      staffId: 'PRPS-TCH-001',
      category: 'TEACHING',
      position: 'Teacher',
      roles: ['CLASS_TEACHER'],
      permissions: [],
      address: null,
      dateJoined: null,
      responsibilities: null,
    },
  ]
}

function teachersFixture(): TeacherListRow[] {
  return [
    {
      id: 't-1',
      fullName: 'Comfort Teacher',
      email: 'comfort@school.edu',
      phone: null,
      status: 'ACTIVE',
      staffId: 'PRPS-TCH-001',
      position: 'Teacher',
      positionLabel: 'Teacher',
      roleNames: ['CLASS_TEACHER'],
      assignmentCount: 3,
      classTeacherClassCount: 1,
      sbaRecordCount: 10,
    },
  ]
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/headteacher']}>
      <HeadteacherDashboardPage />
    </MemoryRouter>,
  )
}

describe('HeadteacherDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    PERMISSIONS = [...HEADTEACHER_PERMISSIONS]
    apiMock.listStaff.mockResolvedValue(staffFixture())
    apiMock.financeOverview.mockResolvedValue(financeFixture())
    apiMock.academicStats.mockResolvedValue(academicFixture())
    apiMock.listTeachers.mockResolvedValue(teachersFixture())
    apiMock.listAttendance.mockResolvedValue(attendanceFixture())
    apiMock.pupilStats.mockResolvedValue(pupilStatsFixture())
    apiMock.ownerSummary.mockRejectedValue(new Error('Forbidden'))
    apiMock.staffStats.mockRejectedValue(new Error('Forbidden'))
  })

  it('loads Total Pupils and Active Pupils from the pupil stats endpoint', async () => {
    renderPage()

    expect(await screen.findByText('Total Pupils')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('110 active · 10 inactive')).toBeInTheDocument()
    expect(screen.getByText('Active Pupils')).toBeInTheDocument()
    expect(screen.getByText('110')).toBeInTheDocument()
    expect(screen.getByText('10 inactive')).toBeInTheDocument()
  })

  it('does not call the owner-only summary endpoint', async () => {
    renderPage()

    expect(await screen.findByText('Total Pupils')).toBeInTheDocument()
    expect(apiMock.ownerSummary).not.toHaveBeenCalled()
    expect(apiMock.staffStats).not.toHaveBeenCalled()
    expect(apiMock.pupilStats).toHaveBeenCalledTimes(1)
  })

  it('requests attendance for the current school date and groups it by class', async () => {
    renderPage()

    expect(await screen.findByText('Attendance by Class')).toBeInTheDocument()
    const today = new Date().toISOString().slice(0, 10)
    expect(apiMock.listAttendance).toHaveBeenCalledWith({ dateFrom: today, dateTo: today })

    const primaryOne = await screen.findAllByText('Primary 1')
    expect(primaryOne.length).toBeGreaterThan(0)
    expect(screen.getByText('Primary 2')).toBeInTheDocument()

    const headers = screen.getAllByText('Total Present')
    expect(headers.length).toBeGreaterThan(0)
    const table = headers[0].closest('table') as HTMLElement
    const rows = Array.from(table.querySelectorAll('tbody tr'))
    const primaryOneRow = rows.find((row) => row.textContent?.includes('Primary 1'))
    expect(primaryOneRow).toBeTruthy()
    expect(primaryOneRow?.textContent).toContain('1')
    expect(primaryOneRow?.textContent).toContain('2')
    const grandTotals = await screen.findAllByText('Grand Total')
    expect(grandTotals.length).toBeGreaterThan(0)
  })

  it('shows an empty attendance state when there are no classes, without infinite loading', async () => {
    apiMock.pupilStats.mockResolvedValue(pupilStatsFixture({ total: 0, active: 0, inactive: 0, byClass: [] }))
    renderPage()

    expect(await screen.findByText('No attendance data available for today.')).toBeInTheDocument()
    expect(screen.getByText('Total Pupils')).toBeInTheDocument()
    expect(screen.getByText('0 active · 0 inactive')).toBeInTheDocument()
  })

  it('stops loading and surfaces an error when the attendance request fails', async () => {
    apiMock.listAttendance.mockRejectedValue(new Error('Attendance service unavailable'))
    renderPage()

    expect(await screen.findByText('Could not load attendance.')).toBeInTheDocument()
    expect(screen.getByText('Attendance service unavailable')).toBeInTheDocument()
    expect(screen.getByText('Total Pupils')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
  })

  it('stops loading and shows a retry error when pupil stats fail', async () => {
    apiMock.pupilStats.mockRejectedValue(new Error('Pupil stats unavailable'))
    renderPage()

    expect(await screen.findByText('Pupil stats unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('does not render PTA Fees on the headteacher dashboard', async () => {
    renderPage()

    expect(await screen.findByText('Total Expected')).toBeInTheDocument()
    expect(screen.queryByText('PTA Fees')).not.toBeInTheDocument()
    expect(screen.getByText('Daily Fees')).toBeInTheDocument()
    expect(screen.getByText('PA Fees')).toBeInTheDocument()
    expect(screen.getByText('Maintenance Fees')).toBeInTheDocument()
  })

  it('keeps the existing dashboard sections intact', async () => {
    renderPage()

    expect(await screen.findByText('School Snapshot — Today')).toBeInTheDocument()
    expect(screen.getByText('Attendance by Class')).toBeInTheDocument()
    expect(screen.getByText('Finance Overview')).toBeInTheDocument()
    expect(screen.getByText('Teachers Overview')).toBeInTheDocument()
    expect(screen.getByText('Academic Overview')).toBeInTheDocument()
    expect(screen.getByText('Staff Overview')).toBeInTheDocument()
    expect(screen.getByText('Work Output')).toBeInTheDocument()
  })
})

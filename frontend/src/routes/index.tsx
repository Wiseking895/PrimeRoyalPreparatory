import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ACCOUNTANT_ROLE, CLASS_TEACHER_ROLE, HEADTEACHER_ROLE, OWNER_ROLE, SUBJECT_TEACHER_ROLE } from '@/auth/roles'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import AboutPage from '@/pages/AboutPage'
import AcademicsPage from '@/pages/AcademicsPage'
import AdmissionsPage from '@/pages/AdmissionsPage'
import ContactPage from '@/pages/ContactPage'
import GalleryPage from '@/pages/GalleryPage'
import HomePage from '@/pages/HomePage'
import NewsPage from '@/pages/NewsPage'
import NotFoundPage from '@/pages/NotFoundPage'
import SchoolLifePage from '@/pages/SchoolLifePage'
import StaffLoginPage from '@/pages/StaffLoginPage'
import { AuditPage } from '@/pages/portal/AuditPage'
import { ClassManagementPage } from '@/pages/portal/ClassManagementPage'
import { ForbiddenPage } from '@/pages/portal/ForbiddenPage'
import { LoginPage } from '@/pages/portal/LoginPage'
import { ProfilePage } from '@/pages/portal/ProfilePage'
import { PupilManagementPage } from '@/pages/portal/PupilManagementPage'
import { PupilProfilePage } from '@/pages/portal/PupilProfilePage'
import { RolesPage } from '@/pages/portal/RolesPage'
import { StaffManagementPage } from '@/pages/portal/StaffManagementPage'
import { StaffProfilePage } from '@/pages/portal/StaffProfilePage'
import { ChangePasswordPage } from '@/pages/portal/ChangePasswordPage'
import { ChargeGenerationPage } from '@/pages/portal/finance/ChargeGenerationPage'
import { FeeAssignmentsPage } from '@/pages/portal/finance/FeeAssignmentsPage'
import { FeeStructuresPage } from '@/pages/portal/finance/FeeStructuresPage'
import { FinanceDashboardPage } from '@/pages/portal/finance/FinanceDashboardPage'
import { FinanceSummaryPage } from '@/pages/portal/finance/FinanceSummaryPage'
import { PaymentDetailPage } from '@/pages/portal/finance/PaymentDetailPage'
import { PaymentsPage } from '@/pages/portal/finance/PaymentsPage'
import { PupilFinancePage } from '@/pages/portal/finance/PupilFinancePage'
import { PupilFinanceProfilePage } from '@/pages/portal/finance/PupilFinanceProfilePage'
import { SessionsPage } from '@/pages/portal/finance/SessionsPage'
import { HeadteacherDashboardPage } from '@/pages/portal/headteacher/HeadteacherDashboardPage'
import { OwnerDashboardPage } from '@/pages/portal/owner/OwnerDashboardPage'
import { OwnerHeadteacherEditPage } from '@/pages/portal/owner/OwnerHeadteacherEditPage'
import { OwnerHeadteacherPage } from '@/pages/portal/owner/OwnerHeadteacherPage'
import { OwnerSetupPage } from '@/pages/portal/owner/OwnerSetupPage'
import { SettingsPage } from '@/pages/portal/owner/SettingsPage'
import { ClassAcademicOverviewPage } from '@/pages/portal/teacher/ClassAcademicOverviewPage'
import { SbaEntryPage } from '@/pages/portal/teacher/SbaEntryPage'
import { SbaRecordsPage } from '@/pages/portal/teacher/SbaRecordsPage'
import { SubjectManagementPage } from '@/pages/portal/teacher/SubjectManagementPage'
import { TeacherAssignmentPage } from '@/pages/portal/teacher/TeacherAssignmentPage'
import { TeacherClassesPage } from '@/pages/portal/teacher/TeacherClassesPage'
import { TeacherDashboardPage } from '@/pages/portal/teacher/TeacherDashboardPage'
import { TeacherManagementPage } from '@/pages/portal/teacher/TeacherManagementPage'
import { TeacherProfilePage } from '@/pages/portal/teacher/TeacherProfilePage'
import { NotificationsPage } from '@/pages/portal/NotificationsPage'
import { AnnouncementsPage } from '@/pages/portal/AnnouncementsPage'
import { NotificationPreferencesPage } from '@/pages/portal/NotificationPreferencesPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'academics', element: <AcademicsPage /> },
      { path: 'admissions', element: <AdmissionsPage /> },
      { path: 'school-life', element: <SchoolLifePage /> },
      { path: 'gallery', element: <GalleryPage /> },
      { path: 'news', element: <NewsPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'staff/login', element: <StaffLoginPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/setup/owner',
    element: <OwnerSetupPage />,
  },
  {
    path: '/change-password',
    element: (
      <ProtectedRoute>
        <ChangePasswordPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/owner',
    element: (
      <ProtectedRoute roles={[OWNER_ROLE]}>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/owner/dashboard" replace /> },
      { path: 'dashboard', element: <OwnerDashboardPage /> },
      { path: 'pupils', element: <PupilManagementPage /> },
      { path: 'pupils/:id', element: <PupilProfilePage /> },
      { path: 'classes', element: <ClassManagementPage /> },
      { path: 'academic/teachers', element: <TeacherManagementPage /> },
      { path: 'academic/teachers/:id', element: <TeacherProfilePage /> },
      { path: 'academic/subjects', element: <SubjectManagementPage /> },
      { path: 'academic/assignments', element: <TeacherAssignmentPage /> },
      { path: 'academic/classes/:classId', element: <ClassAcademicOverviewPage /> },
      { path: 'headteacher', element: <OwnerHeadteacherPage /> },
      { path: 'headteacher/:id', element: <OwnerHeadteacherEditPage /> },
      { path: 'staff', element: <StaffManagementPage /> },
      { path: 'staff/:id', element: <StaffProfilePage /> },
      { path: 'roles', element: <RolesPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'finance', element: <Navigate to="/owner/finance/dashboard" replace /> },
      { path: 'finance/dashboard', element: <FinanceDashboardPage /> },
      { path: 'finance/sessions', element: <SessionsPage /> },
      { path: 'finance/fees', element: <FeeStructuresPage /> },
      { path: 'finance/fees/:id/assignments', element: <FeeAssignmentsPage /> },
      { path: 'finance/charges', element: <ChargeGenerationPage /> },
      { path: 'finance/payments', element: <PaymentsPage /> },
      { path: 'finance/payments/:id', element: <PaymentDetailPage /> },
      { path: 'finance/pupils', element: <PupilFinancePage /> },
      { path: 'finance/pupils/:id', element: <PupilFinanceProfilePage /> },
      { path: 'finance/summary', element: <FinanceSummaryPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'announcements', element: <AnnouncementsPage /> },
      { path: 'notification-preferences', element: <NotificationPreferencesPage /> },
    ],
  },
  {
    path: '/headteacher',
    element: (
      <ProtectedRoute roles={[HEADTEACHER_ROLE]}>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/headteacher/dashboard" replace /> },
      { path: 'dashboard', element: <HeadteacherDashboardPage /> },
      { path: 'pupils', element: <PupilManagementPage /> },
      { path: 'pupils/:id', element: <PupilProfilePage /> },
      { path: 'classes', element: <ClassManagementPage /> },
      { path: 'academic/teachers', element: <TeacherManagementPage /> },
      { path: 'academic/teachers/:id', element: <TeacherProfilePage /> },
      { path: 'academic/subjects', element: <SubjectManagementPage /> },
      { path: 'academic/assignments', element: <TeacherAssignmentPage /> },
      { path: 'academic/classes/:classId', element: <ClassAcademicOverviewPage /> },
      { path: 'staff', element: <StaffManagementPage /> },
      { path: 'staff/:id', element: <StaffProfilePage /> },
      { path: 'roles', element: <RolesPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'finance', element: <Navigate to="/headteacher/finance/dashboard" replace /> },
      { path: 'finance/dashboard', element: <FinanceDashboardPage /> },
      { path: 'finance/sessions', element: <SessionsPage /> },
      { path: 'finance/fees', element: <FeeStructuresPage /> },
      { path: 'finance/fees/:id/assignments', element: <FeeAssignmentsPage /> },
      { path: 'finance/charges', element: <ChargeGenerationPage /> },
      { path: 'finance/payments', element: <PaymentsPage /> },
      { path: 'finance/payments/:id', element: <PaymentDetailPage /> },
      { path: 'finance/pupils', element: <PupilFinancePage /> },
      { path: 'finance/pupils/:id', element: <PupilFinanceProfilePage /> },
      { path: 'finance/summary', element: <FinanceSummaryPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'announcements', element: <AnnouncementsPage /> },
      { path: 'notification-preferences', element: <NotificationPreferencesPage /> },
    ],
  },
  {
    path: '/accountant',
    element: (
      <ProtectedRoute roles={[ACCOUNTANT_ROLE]}>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/accountant/dashboard" replace /> },
      { path: 'dashboard', element: <FinanceDashboardPage /> },
      { path: 'sessions', element: <SessionsPage /> },
      { path: 'fees', element: <FeeStructuresPage /> },
      { path: 'fees/:id/assignments', element: <FeeAssignmentsPage /> },
      { path: 'charges', element: <ChargeGenerationPage /> },
      { path: 'payments', element: <PaymentsPage /> },
      { path: 'payments/:id', element: <PaymentDetailPage /> },
      { path: 'pupils', element: <PupilFinancePage /> },
      { path: 'pupils/:id', element: <PupilFinanceProfilePage /> },
      { path: 'summary', element: <FinanceSummaryPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'announcements', element: <AnnouncementsPage /> },
      { path: 'notification-preferences', element: <NotificationPreferencesPage /> },
    ],
  },
  {
    path: '/teacher',
    element: (
      <ProtectedRoute roles={[CLASS_TEACHER_ROLE, SUBJECT_TEACHER_ROLE]}>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/teacher/dashboard" replace /> },
      { path: 'dashboard', element: <TeacherDashboardPage /> },
      { path: 'classes', element: <TeacherClassesPage /> },
      { path: 'sba', element: <SbaRecordsPage /> },
      { path: 'sba/entry', element: <SbaEntryPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'announcements', element: <AnnouncementsPage /> },
      { path: 'notification-preferences', element: <NotificationPreferencesPage /> },
    ],
  },
  {
    path: '/forbidden',
    element: <ForbiddenPage />,
  },
])
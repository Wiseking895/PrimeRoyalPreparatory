import { createBrowserRouter, Navigate } from 'react-router-dom'
import { HEADTEACHER_ROLE, OWNER_ROLE } from '@/auth/roles'
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
import { HeadteacherDashboardPage } from '@/pages/portal/headteacher/HeadteacherDashboardPage'
import { OwnerDashboardPage } from '@/pages/portal/owner/OwnerDashboardPage'
import { OwnerHeadteacherEditPage } from '@/pages/portal/owner/OwnerHeadteacherEditPage'
import { OwnerHeadteacherPage } from '@/pages/portal/owner/OwnerHeadteacherPage'
import { OwnerSetupPage } from '@/pages/portal/owner/OwnerSetupPage'
import { SettingsPage } from '@/pages/portal/owner/SettingsPage'

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
      { path: 'headteacher', element: <OwnerHeadteacherPage /> },
      { path: 'headteacher/:id', element: <OwnerHeadteacherEditPage /> },
      { path: 'staff', element: <StaffManagementPage /> },
      { path: 'staff/:id', element: <StaffProfilePage /> },
      { path: 'roles', element: <RolesPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'settings', element: <SettingsPage /> },
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
      { path: 'staff', element: <StaffManagementPage /> },
      { path: 'staff/:id', element: <StaffProfilePage /> },
      { path: 'roles', element: <RolesPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
  {
    path: '/forbidden',
    element: <ForbiddenPage />,
  },
])
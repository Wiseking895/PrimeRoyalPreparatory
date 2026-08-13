import { createBrowserRouter } from 'react-router-dom'
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
])

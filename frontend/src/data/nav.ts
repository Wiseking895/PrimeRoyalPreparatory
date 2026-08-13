import type { NavLink } from '@/types/content'

export interface MainNavChild {
  label: string
  path: string
}

export interface MainNavItem {
  label: string
  path?: string
  dropdown?: MainNavChild[]
}

/**
 * Primary site navigation (desktop). Top-level "Home" is intentionally
 * omitted — the logo + school name in the header acts as the Home link.
 *
 * Dropdowns are used sparingly and only where there are genuine submenu
 * destinations. Most items are direct links so the bar stays compact.
 */
export const mainNav: MainNavItem[] = [
  {
    label: 'About Us',
    dropdown: [
      { label: 'About PRPS', path: '/about' },
      { label: 'Mission & Vision', path: '/about#mission-vision' },
      { label: 'School Leadership', path: '/about#school-leadership' },
      { label: 'Why Choose Us', path: '/about#why-choose-us' },
    ],
  },
  {
    label: 'Academics',
    dropdown: [
      { label: 'Academic Programs', path: '/academics' },
      { label: 'Curriculum', path: '/academics#curriculum' },
      { label: 'Co-Curricular Activities', path: '/school-life#activities' },
      { label: 'Admission Process', path: '/admissions' },
    ],
  },
  {
    label: 'More',
    dropdown: [
      { label: 'Admissions', path: '/admissions' },
      { label: 'School Life', path: '/school-life' },
      { label: 'Gallery', path: '/gallery' },
      { label: 'News & Events', path: '/news' },
      { label: 'Contact Us', path: '/contact' },
    ],
  },
]

/**
 * Mobile navigation — a plain, flat list with no nested categories.
 * Staff Login and Parent Portal are appended by the mobile menu as the final
 * two entries, giving exactly eight top-level items.
 */
export const mobileNav: MainNavItem[] = [
  { label: 'About & School Life', path: '/about' },
  { label: 'Academics', path: '/academics' },
  { label: 'Admissions', path: '/admissions' },
  { label: 'Gallery', path: '/gallery' },
  { label: 'News & Events', path: '/news' },
  { label: 'Contact Us', path: '/contact' },
]

/** Quick links used by the footer (unrelated to the primary navigation). */
export const navLinks: NavLink[] = [
  { label: 'Home', path: '/' },
  { label: 'About Us', path: '/about' },
  { label: 'Academics', path: '/academics' },
  { label: 'Admissions', path: '/admissions' },
  { label: 'School Life', path: '/school-life' },
  { label: 'Gallery', path: '/gallery' },
  { label: 'News & Events', path: '/news' },
  { label: 'Contact Us', path: '/contact' },
]

export const footerProgramLinks: NavLink[] = [
  { label: 'Early Years', path: '/academics' },
  { label: 'Primary Education', path: '/academics' },
  { label: 'Core Subjects', path: '/academics' },
  { label: 'Co-curricular Activities', path: '/academics' },
  { label: 'ICT & Digital Learning', path: '/academics' },
  { label: 'Character Development', path: '/academics' },
]
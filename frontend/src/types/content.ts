/**
 * Public site content types.
 *
 * These types describe the shape of the content the public website renders.
 * In later phases the same shapes will be served by the backend API.
 */
export interface Feature {
  icon: string
  title: string
  description: string
}

export interface Program {
  icon: string
  scene: string
  title: string
  description: string
}

export interface Stat {
  value: number
  suffix: string
  label: string
}

export interface AdmissionStep {
  title: string
  description: string
}

export interface NewsItem {
  id: string
  category: string
  title: string
  excerpt: string
  date: string
  scene: string
}

export interface GalleryItem {
  title: string
  scene: string
  category: string
}

export interface NavLink {
  label: string
  path: string
}

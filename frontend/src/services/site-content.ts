import type { AdmissionStep, Feature, GalleryItem, NewsItem, Program, Stat } from '@/types/content'
import { admissionSteps } from '@/data/admissionSteps'
import { features, values } from '@/data/features'
import { galleryItems } from '@/data/gallery'
import { newsItems } from '@/data/news'
import { parentPortalFeatures } from '@/data/parentPortal'
import { programs } from '@/data/programs'
import { stats } from '@/data/stats'

/**
 * Public site content service.
 *
 * Sections consume content exclusively through these getters. Today the data
 * lives in local module files so the public website is fully self-contained.
 *
 * TODO(phase-2+): when the API and content modules are available, replace the
 * bodies of these functions with `fetch(...)` calls (typed with the same
 * shapes) — no UI changes will be required.
 */

export function getFeatures(): Feature[] {
  return features
}

export function getValues(): Feature[] {
  return values
}

export function getPrograms(): Program[] {
  return programs
}

export function getStats(): Stat[] {
  return stats
}

export function getAdmissionSteps(): AdmissionStep[] {
  return admissionSteps
}

export function getNewsItems(): NewsItem[] {
  return newsItems
}

export function getGalleryItems(): GalleryItem[] {
  return galleryItems
}

export function getParentPortalFeatures(): string[] {
  return parentPortalFeatures
}

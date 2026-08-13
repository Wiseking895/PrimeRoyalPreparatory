import type { NewsItem } from '@/types/content'

/**
 * Demo news & events content for Phase 1. The section is already wired through
 * the content service so these records can be replaced by the backend API
 * without touching the UI.
 */
export const newsItems: NewsItem[] = [
  {
    id: 'inter-house-sports-competition',
    category: 'Events',
    title: 'Inter-House Sports Competition',
    excerpt:
      'Pupils across all houses came together for a day of friendly rivalry, team spirit and sporting excellence.',
    date: '2026-03-14',
    scene: 'sports',
  },
  {
    id: 'first-term-resumes',
    category: 'Announcement',
    title: 'First Term Resumes',
    excerpt:
      'School resumes for the new academic year. We look forward to welcoming all our pupils back to campus.',
    date: '2026-09-07',
    scene: 'building',
  },
  {
    id: 'reading-week-celebration',
    category: 'School Life',
    title: 'Reading Week Celebration',
    excerpt:
      'A week-long celebration of books — storytelling, reading competitions and a dress-up parade of favourite characters.',
    date: '2026-05-22',
    scene: 'learning',
  },
  {
    id: 'science-fair',
    category: 'Academics',
    title: 'Annual Science Fair',
    excerpt:
      'Young scientists showcased creative experiments and projects, bringing classroom learning to life.',
    date: '2026-06-12',
    scene: 'core-subjects',
  },
  {
    id: 'cultural-day',
    category: 'School Life',
    title: 'Cultural Day',
    excerpt:
      'A colourful celebration of heritage through music, dance, food and traditional dress.',
    date: '2026-04-02',
    scene: 'activities',
  },
  {
    id: 'open-day',
    category: 'Admissions',
    title: 'Prospective Parents Open Day',
    excerpt:
      'Families are invited to tour the school, meet our teachers and learn about life at PRPS.',
    date: '2026-11-20',
    scene: 'primary',
  },
]

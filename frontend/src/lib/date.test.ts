import { describe, expect, it } from 'vitest'
import { formatDate } from './date'

describe('formatDate', () => {
  it('formats an ISO date as "14 Mar 2026"', () => {
    expect(formatDate('2026-03-14')).toBe('14 Mar 2026')
  })

  it('returns the input unchanged for invalid dates', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })
})

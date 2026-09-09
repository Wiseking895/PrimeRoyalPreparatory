import { describe, expect, it } from 'vitest'
import { formatDate, elapsedSchoolDays, schoolDayLabel } from './date'

describe('formatDate', () => {
  it('formats an ISO date as "14 Mar 2026"', () => {
    expect(formatDate('2026-03-14')).toBe('14 Mar 2026')
  })

  it('returns the input unchanged for invalid dates', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })
})

describe('elapsedSchoolDays', () => {
  it('CASE 1 — term starts today: Day 1', () => {
    // 8 Sep 2026 is a Tuesday — term start = Day 1
    expect(elapsedSchoolDays('2026-09-08', new Date(2026, 8, 8))).toBe(1)
  })

  it('CASE 2 — next day after term start: Day 2', () => {
    // 8 Sep = Tue (Day 1), 9 Sep = Wed (Day 2)
    expect(elapsedSchoolDays('2026-09-08', new Date(2026, 8, 9))).toBe(2)
  })

  it('CASE 3 — two days after term start: Day 3', () => {
    // 8 Sep = Tue (Day 1), 9 Wed (Day 2), 10 Thu (Day 3)
    expect(elapsedSchoolDays('2026-09-08', new Date(2026, 8, 10))).toBe(3)
  })

  it('CASE 4 — weekend does not increment counter', () => {
    // 8 Sep = Tue (Day 1), 9 Wed (2), 10 Thu (3), 11 Fri (4), 12 Sat (skip), 13 Sun (skip)
    expect(elapsedSchoolDays('2026-09-08', new Date(2026, 8, 11))).toBe(4)
    expect(elapsedSchoolDays('2026-09-08', new Date(2026, 8, 12))).toBe(4)
    expect(elapsedSchoolDays('2026-09-08', new Date(2026, 8, 13))).toBe(4)
  })

  it('CASE 5 — before term start: 0', () => {
    expect(elapsedSchoolDays('2026-09-15', new Date(2026, 8, 10))).toBe(0)
  })

  it('CASE 6 — after term end: does not exceed configured total', () => {
    // Sep 1–Dec 31 2026 inclusive = 88 weekdays; cap at 80
    expect(elapsedSchoolDays('2026-09-01', new Date(2026, 11, 31), 80)).toBe(80)
  })

  it('CASE 7 — different active term: counter starts from that term start', () => {
    // Term starts 7 Sep (Mon), today is 14 Sep (Mon)
    // Weekdays inclusive: 7(Mo),8(Tu),9(We),10(Th),11(Fr),14(Mo) = 6
    expect(elapsedSchoolDays('2026-09-07', new Date(2026, 8, 14))).toBe(6)
  })

  it('counts correctly when term starts on Saturday', () => {
    // 12 Sep = Sat (term start, skip), 13 Sun (skip), 14 Mon = Day 1
    expect(elapsedSchoolDays('2026-09-12', new Date(2026, 8, 12))).toBe(0)
    expect(elapsedSchoolDays('2026-09-12', new Date(2026, 8, 14))).toBe(1)
  })

  it('does not cap when configuredTotal is 0 or undefined', () => {
    // 8 Sep to 11 Sep inclusive = 4 weekdays (8,9,10,11)
    expect(elapsedSchoolDays('2026-09-08', new Date(2026, 8, 11), 0)).toBe(4)
    expect(elapsedSchoolDays('2026-09-08', new Date(2026, 8, 11))).toBe(4)
  })

  it('returns 0 for invalid date string', () => {
    expect(elapsedSchoolDays('not-a-date', new Date(2026, 8, 9))).toBe(0)
  })

  it('handles term spanning multiple weeks correctly', () => {
    // 1 Sep 2026 = Tue (term start = Day 1)
    // 11 Sep 2026 = Fri
    // Weekdays inclusive: 1(Tu),2(We),3(Th),4(Fr),7(Mo),8(Tu),9(We),10(Th),11(Fr) = 9
    expect(elapsedSchoolDays('2026-09-01', new Date(2026, 8, 11))).toBe(9)
  })
})

describe('schoolDayLabel', () => {
  it('uses singular for 1', () => {
    expect(schoolDayLabel(1)).toBe('1 school day')
  })

  it('uses plural for 0', () => {
    expect(schoolDayLabel(0)).toBe('0 school days')
  })

  it('uses plural for 2+', () => {
    expect(schoolDayLabel(5)).toBe('5 school days')
  })
})

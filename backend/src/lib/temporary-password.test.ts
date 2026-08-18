import { describe, expect, it } from 'vitest'
import { generateTemporaryPassword } from './temporary-password'

describe('generateTemporaryPassword', () => {
  it('returns a value of the requested length', () => {
    expect(generateTemporaryPassword()).toHaveLength(14)
    expect(generateTemporaryPassword(16)).toHaveLength(16)
  })

  it('includes at least one uppercase letter, lowercase letter and digit', () => {
    for (let index = 0; index < 50; index += 1) {
      const value = generateTemporaryPassword()
      expect(value).toMatch(/[A-Z]/)
      expect(value).toMatch(/[a-z]/)
      expect(value).toMatch(/[0-9]/)
    }
  })

  it('never emits ambiguous characters', () => {
    const AMBIGUOUS = /[0O1lIo0]/
    for (let index = 0; index < 50; index += 1) {
      expect(generateTemporaryPassword()).not.toMatch(AMBIGUOUS)
    }
  })

  it('produces varied output across calls', () => {
    const values = new Set(Array.from({ length: 25 }, () => generateTemporaryPassword()))
    expect(values.size).toBeGreaterThan(20)
  })
})
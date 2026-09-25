import { describe, expect, it } from 'vitest'
import {
  CLASS_DIVISIONS,
  formatClassName,
  getClassLevel,
  toDivisionPayload,
  toDivisionValue,
  UNDIVIDED_DIVISION,
} from './class-name'

describe('class-name', () => {
  describe('formatClassName (the single display rule)', () => {
    it('displays Creche without a division as "Creche"', () => {
      expect(formatClassName('Creche', null)).toBe('Creche')
      expect(formatClassName('Creche')).toBe('Creche')
    })

    it('displays an undivided class without any suffix', () => {
      expect(formatClassName('Nursery 1', null)).toBe('Nursery 1')
      expect(formatClassName('Nursery 1', UNDIVIDED_DIVISION)).toBe('Nursery 1')
      expect(formatClassName('KG 2', undefined)).toBe('KG 2')
      expect(formatClassName('Basic 4', null)).not.toContain('Undivided')
    })

    it('appends the division without a space', () => {
      expect(formatClassName('Nursery 1', 'A')).toBe('Nursery 1A')
      expect(formatClassName('Nursery 1', 'B')).toBe('Nursery 1B')
      expect(formatClassName('Nursery 1', 'C')).toBe('Nursery 1C')
      expect(formatClassName('Nursery 1', 'D')).toBe('Nursery 1D')
      expect(formatClassName('KG 1', 'A')).toBe('KG 1A')
      expect(formatClassName('Basic 4', 'C')).toBe('Basic 4C')
      expect(formatClassName('Basic 6', 'D')).toBe('Basic 6D')
    })

    it('normalizes lower-case division input', () => {
      expect(formatClassName('Basic 3', 'a')).toBe('Basic 3A')
    })
  })

  describe('getClassLevel', () => {
    it('recovers the level from a divided display name', () => {
      expect(getClassLevel('Nursery 1A', 'A')).toBe('Nursery 1')
      expect(getClassLevel('Basic 6D', 'D')).toBe('Basic 6')
    })

    it('keeps undivided and legacy names unchanged', () => {
      expect(getClassLevel('Nursery 1', null)).toBe('Nursery 1')
      expect(getClassLevel('Nursery 1A', null)).toBe('Nursery 1A')
    })
  })

  describe('division payload helpers', () => {
    it('maps Undivided to null and letters to themselves', () => {
      expect(toDivisionPayload(UNDIVIDED_DIVISION)).toBeNull()
      expect(toDivisionPayload('A')).toBe('A')
      expect(CLASS_DIVISIONS).toEqual(['A', 'B', 'C', 'D'])
    })

    it('maps stored divisions back to select values', () => {
      expect(toDivisionValue(null)).toBe(UNDIVIDED_DIVISION)
      expect(toDivisionValue(undefined)).toBe(UNDIVIDED_DIVISION)
      expect(toDivisionValue('B')).toBe('B')
    })
  })
})

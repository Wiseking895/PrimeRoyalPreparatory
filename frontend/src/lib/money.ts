/**
 * Money helpers. The backend is the authoritative source of financial truth
 * and always returns fixed two-decimal-place strings. The frontend only ever
 * formats and validates those strings — it never performs arithmetic on money.
 */

/** Matches the backend `moneyField` regex: digits with up to 2 decimals. */
export const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/

export function isValidMoney(value: string): boolean {
  return MONEY_PATTERN.test(value.trim()) && Number(value) > 0
}

/**
 * Formats a backend money string ("1234567.80") for display as "1,234,567.80".
 * Returns the raw string if it is not a parseable number so that odd values
 * are never silently altered.
 */
export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0.00'
  const text = String(value)
  const number = Number(text)
  if (!Number.isFinite(number)) return text
  const [whole, decimal = ''] = text.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decimal ? `${grouped}.${decimal}` : grouped
}
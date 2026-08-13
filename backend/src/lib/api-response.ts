import type { ApiResponse } from '@prps/shared'

/** Consistent API response helpers matching the shared envelope contract. */
export function ok<T>(data: T, message = 'OK'): ApiResponse<T> {
  return { success: true, message, data }
}

export function created<T>(data: T, message = 'Created'): ApiResponse<T> {
  return { success: true, message, data }
}
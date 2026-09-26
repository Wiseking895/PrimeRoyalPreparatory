/**
 * Internal reference stored in `profilePictureUrl` for objects that live in
 * the private object store. The backend resolves it to a short-lived presigned
 * URL after RBAC — object keys and credentials never reach the browser.
 *
 * Lives in its own module (not `lib/api`) so components can detect a document
 * reference even when tests mock the API client module.
 */
export const DOCUMENT_REFERENCE_PREFIX = '/api/documents/'

export function isDocumentReference(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith(DOCUMENT_REFERENCE_PREFIX)
}

/**
 * Backend HTTP multipart upload ceiling.
 *
 * Vercel serverless request bodies are capped at 4.5 MB by the gateway, so the
 * application-level limit must sit clearly below that: a 4 MB file plus the
 * multipart envelope stays under the gateway ceiling, while anything larger is
 * rejected early by multer (and again by the upload services) with a
 * structured JSON error instead of a gateway-level failure in the 4.5–5 MB
 * range.
 *
 * Single source of truth for every multipart route (profile pictures, pupil
 * pictures, DOCX admission import) and for the matching service-level size
 * checks.
 */
export const MAX_UPLOAD_FILE_BYTES = 4 * 1024 * 1024

/** `MAX_UPLOAD_FILE_BYTES` expressed in whole megabytes (4). */
export const MAX_UPLOAD_FILE_MB = MAX_UPLOAD_FILE_BYTES / (1024 * 1024)

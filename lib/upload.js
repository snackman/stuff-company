// Shared settings for chunked PDF uploads.
import { verify } from './crypto.js';
import { httpError } from './http.js';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const CHUNK_BYTES = 3 * 1024 * 1024; // stays under Vercel's ~4.5MB body cap
export const UPLOAD_TTL_MS = 30 * 60 * 1000;

/** Verify a signed upload token from /api/tax-form (mode: upload-init). */
export function readUploadToken(token) {
  const payload = verify('upload', token);
  if (!payload) throw httpError('Upload expired — please try again.', 400);
  const t = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (t.x < Date.now()) throw httpError('Upload expired — please try again.', 400);
  return t;
}

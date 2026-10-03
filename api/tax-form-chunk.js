// PUT /api/tax-form-chunk?i=<index> — one chunk of an uploaded PDF.
// Header X-Upload-Token carries the signed token from /api/tax-form
// (mode: upload-init). Each chunk is encrypted before it touches Blob.
import { savePart } from '../lib/storage.js';
import { CHUNK_BYTES, readUploadToken } from '../lib/upload.js';
import { json, handle, httpError, assertSameOrigin, clientIp, rateLimit } from '../lib/http.js';

export const PUT = handle(async (request) => {
  assertSameOrigin(request);
  rateLimit(`chunk:${clientIp(request)}`, 40, 10 * 60 * 1000);
  const t = readUploadToken(request.headers.get('x-upload-token'));
  const i = Number(new URL(request.url).searchParams.get('i'));
  if (!Number.isInteger(i) || i < 0 || i >= t.n) throw httpError('Invalid chunk.');
  const buf = Buffer.from(await request.arrayBuffer());
  const expected = i === t.n - 1 ? t.s - CHUNK_BYTES * (t.n - 1) : CHUNK_BYTES;
  if (buf.length !== expected) throw httpError('Invalid chunk size.');
  await savePart(t.u, i, buf);
  return json({ ok: true });
});

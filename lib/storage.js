// Vercel Blob storage for encrypted tax forms. Every object is AES-256-GCM
// encrypted before upload (see crypto.js) and the store is private, so a
// leaked Blob URL alone yields only ciphertext.
import { put, get, list, del } from '@vercel/blob';
import { encrypt, decrypt, encryptJson, decryptJson } from './crypto.js';

const PREFIX = 'tax-forms/';
const TMP_PREFIX = 'tax-forms-tmp/';
const ACCESS = 'private';

const pdfPath = (id) => `${PREFIX}${id}.pdf.enc`;
const indexPath = (id) => `${PREFIX}${id}.json.enc`;
const partPath = (uploadId, i) => `${TMP_PREFIX}${uploadId}/${String(i).padStart(3, '0')}.enc`;

export const isValidId = (id) => typeof id === 'string' && /^\d{13}-[0-9a-f]{12}$/.test(id);

async function putEncrypted(pathname, buf, allowOverwrite = false) {
  await put(pathname, buf, {
    access: ACCESS,
    addRandomSuffix: false,
    allowOverwrite,
    contentType: 'application/octet-stream',
    cacheControlMaxAge: 60,
  });
}

async function getBuffer(pathname) {
  const res = await get(pathname, { access: ACCESS, useCache: false });
  if (!res || !res.stream) return null;
  return Buffer.from(await new Response(res.stream).arrayBuffer());
}

/** Store a submission: encrypted PDF + encrypted index entry. */
export async function saveSubmission(id, pdfBuffer, meta) {
  await putEncrypted(pdfPath(id), encrypt(pdfBuffer, pdfPath(id)));
  await putEncrypted(indexPath(id), encryptJson({ ...meta, id }, indexPath(id)));
}

export async function listSubmissions() {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const pdfs = new Set(blobs.filter((b) => b.pathname.endsWith('.pdf.enc')).map((b) => b.pathname));
  const idx = blobs.filter((b) => b.pathname.endsWith('.json.enc'));
  const entries = await Promise.all(
    idx.map(async (b) => {
      try {
        const buf = await getBuffer(b.pathname);
        if (!buf) return null;
        const meta = decryptJson(buf, b.pathname);
        return { ...meta, hasPdf: pdfs.has(pdfPath(meta.id)) };
      } catch {
        return { id: b.pathname.slice(PREFIX.length, -'.json.enc'.length), error: 'unreadable' };
      }
    }),
  );
  return entries.filter(Boolean).sort((a, b) => String(b.id).localeCompare(String(a.id)));
}

export async function getSubmissionPdf(id) {
  const buf = await getBuffer(pdfPath(id));
  return buf ? decrypt(buf, pdfPath(id)) : null;
}

export async function getSubmissionMeta(id) {
  const buf = await getBuffer(indexPath(id));
  return buf ? decryptJson(buf, indexPath(id)) : null;
}

export async function deleteSubmission(id) {
  await del([pdfPath(id), indexPath(id)]);
}

// ---- chunked uploads (Vercel function bodies are capped at ~4.5MB) ----

export async function savePart(uploadId, i, buf) {
  const p = partPath(uploadId, i);
  await putEncrypted(p, encrypt(buf, p), true); // retries may resend a chunk
}

/** Read, decrypt and concatenate parts 0..count-1, then delete them. */
export async function assembleParts(uploadId, count) {
  const paths = Array.from({ length: count }, (_, i) => partPath(uploadId, i));
  const bufs = [];
  for (const p of paths) {
    const enc = await getBuffer(p);
    if (!enc) throw Object.assign(new Error('Upload is incomplete — please try again.'), { status: 400 });
    bufs.push(decrypt(enc, p));
  }
  return Buffer.concat(bufs);
}

export async function deleteParts(uploadId) {
  const page = await list({ prefix: `${TMP_PREFIX}${uploadId}/` });
  if (page.blobs.length) await del(page.blobs.map((b) => b.pathname));
}

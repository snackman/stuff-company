// POST /api/tax-form — public submission endpoint.
//
// Body (JSON), one of:
//   { mode: 'fill', formType, contactName, contactEmail, data, website }
//       Validate → generate the PDF → encrypt → store → email.
//   { mode: 'upload-init', formType, contactName, contactEmail, fileName, size, parts, website }
//       Returns { uploadId, token }. The browser then PUTs each chunk to
//       /api/tax-form-chunk (function bodies are capped at ~4.5MB).
//   { mode: 'upload-complete', token }
//       Reassemble the chunks → check it is a PDF → encrypt → store → email.
//
// `website` is a honeypot: humans never see it, bots fill it in.
import { generateW9PDF, generateW8BENPDF, generateW8BENEPDF, stampEsign } from '../lib/pdf.js';
import { saveSubmission, assembleParts, deleteParts } from '../lib/storage.js';
import { newId, sign } from '../lib/crypto.js';
import { MAX_UPLOAD_BYTES, CHUNK_BYTES, UPLOAD_TTL_MS, readUploadToken } from '../lib/upload.js';
import { notifySubmission } from '../lib/notify.js';
import { json, handle, httpError, assertSameOrigin, clientIp, rateLimit } from '../lib/http.js';
import { FORM_TYPES, validateForm, validateContact, payeeName, tinLast4 } from '../lib/validate.js';

const FORM_LABEL = { w9: 'W-9', w8ben: 'W-8BEN', w8bene: 'W-8BEN-E' };

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const ip = clientIp(request);
  let body;
  try {
    body = await request.json();
  } catch {
    throw httpError('Invalid request.');
  }
  const origin = new URL(request.url).origin;

  if (body.mode === 'upload-complete') {
    rateLimit(`complete:${ip}`, 10, 10 * 60 * 1000);
    return completeUpload(body, origin);
  }

  rateLimit(`submit:${ip}`, 10, 10 * 60 * 1000);
  // Honeypot: pretend success, store nothing.
  if (body.website) return json({ ok: true, id: newId() });

  if (!FORM_TYPES.includes(body.formType)) throw httpError('Please pick a form type.');
  const contact = validateContact(body);

  if (body.mode === 'fill') return fill(body, contact, origin, ip);
  if (body.mode === 'upload-init') return initUpload(body, contact);
  throw httpError('Invalid request.');
});

async function fill(body, contact, origin, ip) {
  const { formType } = body;
  const data = validateForm(formType, body.data);
  const id = newId();
  const ref = id.slice(-8);
  const gen = { w9: generateW9PDF, w8ben: generateW8BENPDF, w8bene: generateW8BENEPDF }[formType];
  const signedAt = new Date().toISOString();
  let pdf = await gen(data, ref);
  pdf = await stampEsign(
    pdf,
    `Electronically signed by "${data.signature}" (${contact.email}) at stuff.company/tax-form on ${signedAt} UTC from IP ${ip}. Ref ${ref}.`,
  );

  const meta = {
    formType,
    method: 'fill',
    name: payeeName(formType, data) || contact.name,
    contactName: contact.name,
    email: contact.email,
    submittedAt: signedAt,
    tinLast4: tinLast4(formType, data),
    size: pdf.length,
  };
  await saveSubmission(id, pdf, meta);
  await notifySubmission(meta, origin);
  return json({ ok: true, id, ref, formLabel: FORM_LABEL[formType] });
}

function initUpload(body, contact) {
  const size = Number(body.size);
  const parts = Number(body.parts);
  const fileName = String(body.fileName || 'upload.pdf').replace(/[^\w.\- ()]/g, '_').slice(0, 120);
  if (!/\.pdf$/i.test(fileName)) throw httpError('Please upload a PDF file.');
  if (!Number.isInteger(size) || size <= 0) throw httpError('The file is empty.');
  if (size > MAX_UPLOAD_BYTES) throw httpError('The PDF is larger than 10 MB.');
  if (parts !== Math.ceil(size / CHUNK_BYTES)) throw httpError('Invalid upload.');
  const uploadId = newId();
  const payload = Buffer.from(
    JSON.stringify({
      u: uploadId,
      n: parts,
      s: size,
      f: body.formType,
      nm: contact.name,
      e: contact.email,
      fn: fileName,
      x: Date.now() + UPLOAD_TTL_MS,
    }),
  ).toString('base64url');
  return json({ ok: true, uploadId, token: sign('upload', payload), chunkBytes: CHUNK_BYTES });
}

async function completeUpload(body, origin) {
  const t = readUploadToken(body.token);
  let pdf;
  try {
    pdf = await assembleParts(t.u, t.n);
  } catch (err) {
    if (err.status) throw httpError(err.message, err.status);
    throw err;
  }
  try {
    if (pdf.length !== t.s) throw httpError('Upload is incomplete — please try again.');
    const head = pdf.subarray(0, 1024).toString('latin1');
    const tail = pdf.subarray(-2048).toString('latin1');
    if (!head.includes('%PDF-') || !tail.includes('%%EOF')) {
      throw httpError("That file doesn't look like a PDF.");
    }
    const id = newId();
    const meta = {
      formType: t.f,
      method: 'upload',
      name: t.nm,
      contactName: t.nm,
      email: t.e,
      fileName: t.fn,
      submittedAt: new Date().toISOString(),
      tinLast4: '',
      size: pdf.length,
    };
    await saveSubmission(id, pdf, meta);
    await notifySubmission(meta, origin);
    return json({ ok: true, id, ref: id.slice(-8), formLabel: FORM_LABEL[t.f] });
  } finally {
    await deleteParts(t.u).catch(() => {});
  }
}

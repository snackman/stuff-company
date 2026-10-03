// POST /api/tax-form — public submission endpoint. Forms are not stored:
// each one is emailed (PDF attached) to NOTIFY_TO via Gmail SMTP.
//
// Filled + e-signed form: JSON body
//   { formType, contactName, contactEmail, data, website }
//   → validate → render the PDF with pdf-lib → email.
// Signed PDF upload: raw PDF body (Content-Type: application/pdf, max 4MB,
// since Vercel caps request bodies at ~4.5MB) with the details in headers:
//   X-Form-Type, X-Contact-Name, X-Contact-Email, X-File-Name, X-Website
//   (name/email/file name are encodeURIComponent'd).
//
// `website` / X-Website is a honeypot: humans never see it, bots fill it in.
import crypto from 'node:crypto';
import { generateW9PDF, generateW8BENPDF, generateW8BENEPDF, stampEsign } from '../lib/pdf.js';
import { sendSubmission } from '../lib/notify.js';
import { json, handle, httpError, assertSameOrigin, clientIp, rateLimit } from '../lib/http.js';
import { FORM_TYPES, validateForm, validateContact, payeeName } from '../lib/validate.js';

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const FORM_LABEL = { w9: 'W-9', w8ben: 'W-8BEN', w8bene: 'W-8BEN-E' };
const GENERATORS = { w9: generateW9PDF, w8ben: generateW8BENPDF, w8bene: generateW8BENEPDF };

const newRef = () => crypto.randomBytes(4).toString('hex');

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  rateLimit(`submit:${clientIp(request)}`, 10, 10 * 60 * 1000);
  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type === 'application/pdf') return upload(request);
  if (type === 'application/json') return fill(request);
  throw httpError('Invalid request.', 415);
});

async function fill(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw httpError('Invalid request.');
  }
  if (body.website) return json({ ok: true, ref: newRef() }); // honeypot
  const { formType } = body;
  if (!FORM_TYPES.includes(formType)) throw httpError('Please pick a form type.');
  const contact = validateContact(body);
  const data = validateForm(formType, body.data);

  const ref = newRef();
  const submittedAt = new Date().toISOString();
  let pdf = await GENERATORS[formType](data, ref);
  pdf = await stampEsign(
    pdf,
    `Electronically signed by "${data.signature}" (${contact.email}) at stuff.company/tax-form on ${submittedAt} UTC from IP ${clientIp(request)}. Ref ${ref}.`,
  );

  await sendSubmission(
    {
      formType,
      method: 'fill',
      name: payeeName(formType, data) || contact.name,
      contactName: contact.name,
      email: contact.email,
      submittedAt,
      ref,
    },
    pdf,
  );
  return json({ ok: true, ref, formLabel: FORM_LABEL[formType] });
}

function header(request, name) {
  const v = request.headers.get(name) || '';
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

async function upload(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_UPLOAD_BYTES) throw httpError('The PDF is larger than 4 MB.', 413);
  if (header(request, 'x-website')) return json({ ok: true, ref: newRef() }); // honeypot

  const formType = header(request, 'x-form-type');
  if (!FORM_TYPES.includes(formType)) throw httpError('Please pick a form type.');
  const contact = validateContact({
    contactName: header(request, 'x-contact-name'),
    contactEmail: header(request, 'x-contact-email'),
  });
  const fileName = (header(request, 'x-file-name') || 'upload.pdf').replace(/[^\w.\- ()]/g, '_').slice(0, 120);

  const pdf = Buffer.from(await request.arrayBuffer());
  if (!pdf.length) throw httpError('The file is empty.');
  if (pdf.length > MAX_UPLOAD_BYTES) throw httpError('The PDF is larger than 4 MB.', 413);
  const head = pdf.subarray(0, 1024).toString('latin1');
  const tail = pdf.subarray(-2048).toString('latin1');
  if (!head.includes('%PDF-') || !tail.includes('%%EOF')) throw httpError("That file doesn't look like a PDF.");

  const ref = newRef();
  await sendSubmission(
    {
      formType,
      method: 'upload',
      name: contact.name,
      contactName: contact.name,
      email: contact.email,
      submittedAt: new Date().toISOString(),
      ref,
      fileName,
    },
    pdf,
  );
  return json({ ok: true, ref, formLabel: FORM_LABEL[formType] });
}

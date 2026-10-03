// Delivers each submission by email (Gmail SMTP with an app password), with
// the PDF attached. Email is the only place forms go, so if SMTP isn't
// configured or sending fails we throw a 503 and the payee is told to email
// us instead. The subject and body never include a TIN.
import nodemailer from 'nodemailer';
import { httpError } from './http.js';

const FORM_LABEL = { w9: 'W-9', w8ben: 'W-8BEN', w8bene: 'W-8BEN-E' };
const UNAVAILABLE =
  "We couldn't submit your form right now. Please email it to info@stuff.company instead.";

function slug(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** e.g. w9-payee-2026-10-03.pdf (entities use the whole entity name). */
export function attachmentName(meta) {
  const words = String(meta.name || '').trim().split(/\s+/);
  const who = slug(meta.formType === 'w8bene' ? meta.name : words[words.length - 1]) || 'payee';
  return `${meta.formType}-${who}-${String(meta.submittedAt).slice(0, 10)}.pdf`;
}

const oneLine = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();

/**
 * Email the PDF to NOTIFY_TO. meta: { formType, method, name, contactName,
 * email, submittedAt, ref, fileName? }. Throws httpError(503) on failure.
 */
export async function sendSubmission(meta, pdf) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.error('tax-form: SMTP_USER / SMTP_PASS not configured');
    throw httpError(UNAVAILABLE, 503);
  }
  const to = process.env.NOTIFY_TO || 'snax.ynot@gmail.com';
  const form = FORM_LABEL[meta.formType] || meta.formType;
  const how = meta.method === 'upload' ? 'uploaded a signed PDF' : 'filled and e-signed online';
  const name = oneLine(meta.name);

  const lines = [
    `New ${form} submission from stuff.company/tax-form`,
    '',
    `Payee:      ${name}`,
  ];
  if (meta.contactName && oneLine(meta.contactName) !== name) lines.push(`Contact:    ${oneLine(meta.contactName)}`);
  lines.push(
    `Email:      ${oneLine(meta.email)}`,
    `Form:       ${form} (${how})`,
    `Submitted:  ${meta.submittedAt}`,
    `Reference:  ${meta.ref}`,
  );
  if (meta.fileName) lines.push(`File:       ${oneLine(meta.fileName)}`);
  lines.push('', 'The form is attached. It contains a taxpayer ID, so store it somewhere safe.');

  try {
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    });
    await transport.sendMail({
      from: `"Stuff Company tax forms" <${user}>`,
      to,
      replyTo: oneLine(meta.email),
      subject: `${form} from ${name} (ref ${meta.ref})`.slice(0, 180),
      text: lines.join('\n'),
      attachments: [{ filename: attachmentName(meta), content: pdf, contentType: 'application/pdf' }],
    });
  } catch (err) {
    console.error('tax-form: email failed:', err && err.message);
    throw httpError(UNAVAILABLE, 503);
  }
}

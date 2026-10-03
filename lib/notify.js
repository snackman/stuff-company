// Email notification for each submission, via Gmail SMTP (app password).
// No-ops when SMTP_USER / SMTP_PASS are unset. Never includes a TIN.
import nodemailer from 'nodemailer';

const FORM_LABEL = { w9: 'W-9', w8ben: 'W-8BEN', w8bene: 'W-8BEN-E' };

export async function notifySubmission(meta, siteOrigin) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return { sent: false, reason: 'smtp-not-configured' };
  const to = process.env.NOTIFY_TO || 'snax.ynot@gmail.com';

  const form = FORM_LABEL[meta.formType] || meta.formType;
  const how = meta.method === 'upload' ? 'uploaded a signed PDF' : 'filled and e-signed online';
  const text = [
    `New ${form} submission on stuff.company`,
    '',
    `Name:      ${meta.name}`,
    `Email:     ${meta.email}`,
    `Form:      ${form} (${how})`,
    `Submitted: ${meta.submittedAt}`,
    '',
    `Review it at ${siteOrigin}/admin/tax-forms`,
  ].join('\n');

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
      subject: `New ${form} from ${meta.name}`.replace(/[\r\n]+/g, ' ').slice(0, 150),
      text,
    });
    return { sent: true };
  } catch (err) {
    console.error('notify: email failed:', err && err.message);
    return { sent: false, reason: 'smtp-error' };
  }
}

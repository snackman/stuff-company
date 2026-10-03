// GET    /api/admin/submissions           → list (decrypted index entries)
// GET    /api/admin/submissions?id=…      → stream the decrypted PDF
// DELETE /api/admin/submissions?id=…      → delete the PDF + index entry
import { listSubmissions, getSubmissionPdf, getSubmissionMeta, deleteSubmission, isValidId } from '../../lib/storage.js';
import { json, handle, httpError, assertSameOrigin, requireAdmin } from '../../lib/http.js';

const FORM_FILE = { w9: 'W-9', w8ben: 'W-8BEN', w8bene: 'W-8BEN-E' };

export const GET = handle(async (request) => {
  requireAdmin(request);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ submissions: await listSubmissions() });
  if (!isValidId(id)) throw httpError('Not found', 404);
  const [pdf, meta] = await Promise.all([getSubmissionPdf(id), getSubmissionMeta(id).catch(() => null)]);
  if (!pdf) throw httpError('Not found', 404);
  const who = String((meta && meta.name) || 'payee').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60);
  const form = FORM_FILE[meta && meta.formType] || 'tax-form';
  const date = ((meta && meta.submittedAt) || '').slice(0, 10);
  const filename = `${form}_${who}_${date || id}.pdf`;
  const disposition = new URL(request.url).searchParams.get('download') ? 'attachment' : 'inline';
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

export const DELETE = handle(async (request) => {
  assertSameOrigin(request);
  requireAdmin(request);
  const id = new URL(request.url).searchParams.get('id');
  if (!isValidId(id)) throw httpError('Not found', 404);
  await deleteSubmission(id);
  return json({ ok: true });
});

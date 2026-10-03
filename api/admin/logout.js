// POST /api/admin/logout — clears the session cookie.
import { json, handle, assertSameOrigin, clearSessionCookie } from '../../lib/http.js';

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
});

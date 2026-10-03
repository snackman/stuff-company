// POST /api/admin/login { password } → sets an HTTP-only signed session cookie.
import { safeEqual } from '../../lib/crypto.js';
import { json, handle, httpError, assertSameOrigin, clientIp, rateLimit, sessionCookie } from '../../lib/http.js';

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  rateLimit(`login:${clientIp(request)}`, 10, 15 * 60 * 1000);
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw httpError('Admin is not configured', 503);
  let body = {};
  try {
    body = await request.json();
  } catch {}
  if (typeof body.password !== 'string' || !safeEqual(body.password, expected)) {
    await new Promise((r) => setTimeout(r, 500));
    throw httpError('Wrong password.', 401);
  }
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie() });
});

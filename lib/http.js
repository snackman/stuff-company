// Small request helpers shared by the API functions: JSON responses,
// same-origin checks and a best-effort in-memory rate limit.

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...NO_STORE, ...headers },
  });
}

export function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status, expose: true });
}

/** Wrap a handler so thrown errors become JSON responses without leaking internals. */
export function handle(fn) {
  return async (request) => {
    try {
      return await fn(request);
    } catch (err) {
      if (err && err.expose) return json({ error: err.message }, err.status || 400);
      console.error('tax-form api error:', err && err.message);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  };
}

/** Reject cross-site POST/PUT/DELETE: the Origin must match the Host. */
export function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!origin || !host) throw httpError('Forbidden', 403);
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw httpError('Forbidden', 403);
  }
  if (originHost !== host) throw httpError('Forbidden', 403);
}

export function clientIp(request) {
  return (
    request.headers.get('x-real-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

// Best-effort limiter: per function instance, so it slows abuse rather than
// guaranteeing a hard global cap.
const buckets = new Map();
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
  } else if (++b.count > max) {
    throw httpError('Too many requests — please wait a few minutes and try again.', 429);
  }
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }
}

// AES-256-GCM encryption for tax-form PDFs and index entries, plus HMAC
// helpers for signed tokens and admin sessions. The key comes from the
// TAX_FORM_KEY env var (32 random bytes, base64). Nothing here is ever logged.
import crypto from 'node:crypto';

const MAGIC = Buffer.from('TFE1'); // file format marker + version
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey() {
  const raw = process.env.TAX_FORM_KEY;
  if (!raw) throw new Error('TAX_FORM_KEY is not configured');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('TAX_FORM_KEY must be 32 bytes (base64)');
  return key;
}

/** Derive a purpose-specific sub-key so the encryption key is never reused for HMAC. */
function subKey(purpose, extra = '') {
  return crypto.createHmac('sha256', getKey()).update(`stuff-company:${purpose}:${extra}`).digest();
}

/** Encrypt a buffer. `aad` binds the ciphertext to its storage id. */
export function encrypt(plain, aad) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ct]);
}

export function decrypt(blob, aad) {
  const buf = Buffer.from(blob);
  if (!buf.subarray(0, 4).equals(MAGIC)) throw new Error('Not an encrypted tax-form blob');
  const iv = buf.subarray(4, 4 + IV_LEN);
  const tag = buf.subarray(4 + IV_LEN, 4 + IV_LEN + TAG_LEN);
  const ct = buf.subarray(4 + IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export function encryptJson(obj, aad) {
  return encrypt(Buffer.from(JSON.stringify(obj), 'utf8'), aad);
}

export function decryptJson(blob, aad) {
  return JSON.parse(decrypt(blob, aad).toString('utf8'));
}

/** Constant-time string compare (hash both sides so lengths match). */
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function hmac(purpose, extra, payload) {
  return crypto.createHmac('sha256', subKey(purpose, extra)).update(payload).digest('base64url');
}

/** Sign `payload` (string) for `purpose`; returns "payload.sig". */
export function sign(purpose, payload, extra = '') {
  return `${payload}.${hmac(purpose, extra, payload)}`;
}

/** Verify a "payload.sig" token; returns payload or null. */
export function verify(purpose, token, extra = '') {
  if (typeof token !== 'string') return null;
  const i = token.lastIndexOf('.');
  if (i <= 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  return safeEqual(sig, hmac(purpose, extra, payload)) ? payload : null;
}

export function newId() {
  // Sortable: timestamp + random suffix.
  return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}

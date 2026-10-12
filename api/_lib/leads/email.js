// Email check for the audit request: format, disposable domains, and a mail server (MX) for the domain.

import dns from 'node:dns';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const DISPOSABLE = new Set(require('disposable-email-domains'));

const FORMAT = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function normalizeEmail(input) {
  return typeof input === 'string' ? input.trim().toLowerCase() : '';
}

function isDisposable(domain) {
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) if (DISPOSABLE.has(parts.slice(i).join('.'))) return true;
  return false;
}

/**
 * @returns {Promise<{ ok: boolean, email: string, reason?: 'format'|'disposable'|'no_mx', mx?: 'ok'|'unknown' }>}
 */
export async function validateEmail(input, { resolveMx = (d) => dns.promises.resolveMx(d), timeoutMs = 3000 } = {}) {
  const email = normalizeEmail(input);
  if (!email || email.length > 254 || !FORMAT.test(email) || email.split('@')[0].length > 64) return { ok: false, email, reason: 'format' };
  const domain = email.split('@')[1];
  if (!/\.[a-z]{2,24}$/.test(domain)) return { ok: false, email, reason: 'format' };
  if (isDisposable(domain)) return { ok: false, email, reason: 'disposable' };
  try {
    const records = await Promise.race([
      resolveMx(domain),
      new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), timeoutMs))
    ]);
    const usable = (records || []).filter((r) => r && r.exchange && r.exchange !== '.');
    return usable.length ? { ok: true, email, mx: 'ok' } : { ok: false, email, reason: 'no_mx' };
  } catch (err) {
    // The domain has no mail server at all → reject. A DNS hiccup → don't punish a real person.
    if (['ENODATA', 'ENOTFOUND', 'NXDOMAIN'].includes(err.code)) return { ok: false, email, reason: 'no_mx' };
    return { ok: true, email, mx: 'unknown' };
  }
}

// Cloudflare Turnstile check on the server. Without a secret the check fails closed,
// except in local development when AI_CHECK_SKIP_TURNSTILE=1 is set outside production.

import { env } from '../config.js';

export async function verifyTurnstile(token, ip, { fetchImpl = fetch } = {}) {
  const secret = env('TURNSTILE_SECRET_KEY');
  if (!secret) {
    const dev = env('AI_CHECK_SKIP_TURNSTILE') === '1' && env('VERCEL_ENV', 'development') !== 'production';
    return dev ? { ok: true, skipped: true } : { ok: false, reason: 'not_configured' };
  }
  if (typeof token !== 'string' || !token || token.length > 4096) return { ok: false, reason: 'missing' };
  try {
    const res = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8000)
    });
    const data = await res.json();
    return { ok: data.success === true, reason: (data['error-codes'] || []).join(',') || null };
  } catch (err) {
    return { ok: false, reason: `verify_failed: ${err.message}` };
  }
}

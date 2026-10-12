// Small helpers for Web-standard (Request → Response) Vercel functions.

import crypto from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { env } from './config.js';

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
}

export function error(status, code, message, extra = {}) {
  return json({ error: code, message, ...extra }, status);
}

export async function readJson(request, maxBytes = 20000) {
  const text = await request.text();
  if (text.length > maxBytes) throw Object.assign(new Error('Body too large'), { status: 413 });
  if (!text) return {};
  try {
    const data = JSON.parse(text);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
}

export function clientIp(request) {
  const h = request.headers;
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return h.get('x-real-ip') || h.get('x-vercel-forwarded-for') || '0.0.0.0';
}

export function ipHash(ip) {
  return crypto.createHash('sha256').update(`${env('IP_HASH_SALT', 'searchwin')}|${ip}`).digest('hex').slice(0, 40);
}

export function cookies(request) {
  const out = {};
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      const k = part.slice(0, i).trim();
      try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { out[k] = part.slice(i + 1).trim(); }
    }
  }
  return out;
}

/** Path segments after a prefix: "/api/ai-check/abc/audit" with "/api/ai-check" → ["abc", "audit"]. */
export function segments(request, prefix) {
  const url = new URL(request.url);
  // Rewrites pass the original path in ?path= (see vercel.json); direct calls use the pathname.
  const fromQuery = url.searchParams.get('path');
  const rest = fromQuery != null ? fromQuery : url.pathname.slice(prefix.length);
  return rest.split('/').filter(Boolean);
}

/** Keeps work going after the response (Vercel waitUntil); errors are logged, never thrown. */
export function background(promise) {
  const safe = Promise.resolve(promise).catch((err) => console.error('[background]', err));
  try { waitUntil(safe); } catch { /* outside Vercel the promise simply runs */ }
  return safe;
}

export function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export const isUuid = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

/** Attribution fields the page sends with a request (from the first-party cookie). */
export function attributionFrom(body, request) {
  const a = body && typeof body.attribution === 'object' && body.attribution ? body.attribution : {};
  const pick = (k, max = 300) => (typeof a[k] === 'string' && a[k] ? a[k].slice(0, max) : null);
  const c = cookies(request);
  return {
    utm_source: pick('utm_source'), utm_medium: pick('utm_medium'), utm_campaign: pick('utm_campaign'),
    utm_content: pick('utm_content'), utm_term: pick('utm_term'),
    gclid: pick('gclid'), gbraid: pick('gbraid'), wbraid: pick('wbraid'), fbclid: pick('fbclid'),
    fbp: c._fbp || pick('fbp'), fbc: c._fbc || pick('fbc'),
    landing_url: pick('landing_url', 1000), referrer: pick('referrer', 1000)
  };
}

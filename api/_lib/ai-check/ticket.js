// The parse step hands the page a short-lived signed ticket with what to ask about.
// /api/ai-check/ask only works with a valid ticket, so nobody can call DataForSEO with
// arbitrary text or skip the Turnstile check on /parse. No database needed.

import crypto from 'node:crypto';
import { env, LIMITS } from '../config.js';

function secret() {
  const s = env('CHECK_TICKET_SECRET');
  if (s) return s;
  // Local runs only; on Vercel a missing secret makes every ticket invalid.
  return env('VERCEL_ENV') ? null : 'local-dev-ticket-secret';
}

const sign = (payload, key) => crypto.createHmac('sha256', key).update(payload).digest('base64url');

/** @param business { domain, name, service, city, state } */
export function issueTicket(business, now = Date.now()) {
  const key = secret();
  if (!key) throw Object.assign(new Error('CHECK_TICKET_SECRET is not set'), { code: 'config' });
  const payload = Buffer.from(JSON.stringify({
    d: business.domain, n: business.name || null, s: business.service, c: business.city, st: business.state,
    exp: now + LIMITS.ticketMs
  })).toString('base64url');
  return `${payload}.${sign(payload, key)}`;
}

/** @returns the business from the ticket, or null when it is forged, malformed or expired. */
export function readTicket(ticket, now = Date.now()) {
  const key = secret();
  if (!key || typeof ticket !== 'string' || ticket.length > 2000) return null;
  const [payload, mac] = ticket.split('.');
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  let t;
  try { t = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
  if (!t || typeof t.exp !== 'number' || t.exp < now) return null;
  return { domain: t.d, name: t.n, service: t.s, city: t.c, state: t.st };
}

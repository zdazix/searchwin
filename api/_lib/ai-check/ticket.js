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

/** @param business { domain, name, service, city, state, country, language, prompts } */
export function issueTicket(business, now = Date.now()) {
  const key = secret();
  if (!key) throw Object.assign(new Error('CHECK_TICKET_SECRET is not set'), { code: 'config' });
  const payload = Buffer.from(JSON.stringify({
    d: business.domain, n: business.name || null, s: business.service, c: business.city, st: business.state || null,
    k: business.country || 'US', l: business.language || 'en', p: business.prompts || null,
    exp: now + LIMITS.ticketMs
  })).toString('base64url');
  return `${payload}.${sign(payload, key)}`;
}

/** @returns the business from the ticket, or null when it is forged, malformed or expired. */
export function readTicket(ticket, now = Date.now()) {
  const key = secret();
  if (!key || typeof ticket !== 'string' || ticket.length > 4000) return null;
  const [payload, mac] = ticket.split('.');
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  let t;
  try { t = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
  if (!t || typeof t.exp !== 'number' || t.exp < now) return null;
  return { domain: t.d, name: t.n, service: t.s, city: t.c, state: t.st, country: t.k || 'US', language: t.l || 'en', prompts: Array.isArray(t.p) ? t.p : null };
}

/**
 * One visit is one Telegram message that is edited as the visitor gets further. The page carries this
 * signed token (the message id, and whether the answers were already posted) from step to step.
 */
const TG_TTL_MS = 47 * 3600e3;

export function issueTgToken({ id, answers = false }, now = Date.now()) {
  const key = secret();
  if (!key || !Number.isInteger(id)) return null;
  const payload = Buffer.from(JSON.stringify({ m: id, a: answers ? 1 : 0, exp: now + TG_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload, key)}`;
}

/** @returns { id, answers } or null when forged, malformed or too old to edit. */
export function readTgToken(token, now = Date.now()) {
  const key = secret();
  if (!key || typeof token !== 'string' || token.length > 400) return null;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  let t;
  try { t = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
  if (!t || !Number.isInteger(t.m) || typeof t.exp !== 'number' || t.exp < now) return null;
  return { id: t.m, answers: t.a === 1 };
}

/**
 * The answers saved with a request come back from the visitor's browser. Each one carries a signature
 * made here when the answer was fetched, so what is stored is exactly what DataForSEO returned.
 */
const answerBody = (a) => JSON.stringify([a.prompt, a.location_code, a.language_code, a.checked_at, a.answer_text, a.sources]);

export function signAnswer(a) {
  const key = secret();
  if (!key) throw Object.assign(new Error('CHECK_TICKET_SECRET is not set'), { code: 'config' });
  return sign(answerBody(a), key);
}

export function verifyAnswer(a) {
  const key = secret();
  if (!key || !a || typeof a.sig !== 'string') return false;
  const expected = Buffer.from(sign(answerBody(a), key));
  const given = Buffer.from(a.sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

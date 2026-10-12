// Admin access: one password from the environment, a signed HttpOnly cookie for 7 days.

import crypto from 'node:crypto';
import { env } from '../config.js';
import { cookies, sameSecret } from '../http.js';

const COOKIE = 'sw_admin';
const TTL_S = 7 * 24 * 3600;

function sign(payload) {
  const secret = env('ADMIN_SESSION_SECRET');
  if (!secret || secret.length < 16) throw new Error('ADMIN_SESSION_SECRET must be set (16+ characters)');
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function passwordOk(password) {
  const expected = env('ADMIN_PASSWORD');
  return !!expected && sameSecret(String(password || ''), expected);
}

export function sessionCookie(request) {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + TTL_S })).toString('base64url');
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TTL_S}${secure}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export function isAdmin(request) {
  const raw = cookies(request)[COOKIE];
  if (!raw || !raw.includes('.')) return false;
  const [payload, sig] = raw.split('.');
  try {
    if (!sameSecret(sig, sign(payload))) return false;
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

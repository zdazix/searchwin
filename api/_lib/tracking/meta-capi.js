// Meta Conversions API: the server half of each Pixel event, deduplicated by event_id.

import crypto from 'node:crypto';
import { env } from '../config.js';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const norm = {
  em: (v) => v.trim().toLowerCase(),
  ct: (v) => v.toLowerCase().replace(/[^a-z]/g, ''),
  st: (v) => v.toLowerCase().replace(/[^a-z]/g, '').slice(0, 2),
  country: (v) => v.toLowerCase().slice(0, 2)
};

/** user_data in Meta's format: identifiers hashed with SHA-256 after normalisation. */
export function userData({ email, city, state, ip, userAgent, fbp, fbc, externalId }) {
  const u = { country: [sha256('us')] };
  if (email) u.em = [sha256(norm.em(email))];
  if (city) u.ct = [sha256(norm.ct(city))];
  if (state) u.st = [sha256(norm.st(state))];
  if (externalId) u.external_id = [sha256(String(externalId))];
  if (ip && ip !== '0.0.0.0') u.client_ip_address = ip;
  if (userAgent) u.client_user_agent = userAgent.slice(0, 500);
  if (fbp) u.fbp = fbp;
  if (fbc) u.fbc = fbc;
  return u;
}

/**
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
export async function sendCapiEvent({ eventName, eventId, sourceUrl, user, customData = {} }, { fetchImpl = fetch } = {}) {
  const pixel = env('PUBLIC_META_PIXEL_ID'), token = env('META_CAPI_ACCESS_TOKEN');
  if (!pixel || !token) return { sent: false, reason: 'not_configured' };
  const version = env('META_GRAPH_API_VERSION', 'v23.0');
  const payload = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: sourceUrl,
      user_data: userData(user || {}),
      custom_data: customData
    }]
  };
  const testCode = env('META_TEST_EVENT_CODE');
  if (testCode) payload.test_event_code = testCode;
  try {
    const res = await fetchImpl(`https://graph.facebook.com/${version}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return { sent: false, reason: `HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}` };
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

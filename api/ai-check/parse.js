// POST /api/ai-check/parse — step 1 of the free check, called by the page.
// Turnstile → read the client's site (Gemini finds name, service, city, state) → the three
// questions and a short-lived ticket for /api/ai-check/ask. Nothing is stored.
// Time limit: 150 s (vercel.json).
//
// body: { website, turnstile_token, manual?: { name, service, city_state } }
//   manual with service and city_state skips reading the site (the visitor typed them in).
// → { status: 'ready', website, business, prompts, ticket }
//   { status: 'needs_input', website, business, needs: ['name' | 'service' | 'city_state'], site_unreadable }
//   { status: 'not_local' | 'not_us', website, business }

import { json, error, readJson, clientIp } from '../_lib/http.js';
import { DEFAULT_SETTINGS, MESSAGES } from '../_lib/config.js';
import { normalizeWebsite, normalizeService, parseCityState, renderPrompt } from '../_lib/ai-check/normalize.js';
import { verifyTurnstile } from '../_lib/security/turnstile.js';
import { deps } from '../_lib/ai-check/deps.js';
import { issueTicket } from '../_lib/ai-check/ticket.js';


function manualFields(body) {
  const m = body && typeof body.manual === 'object' && body.manual ? body.manual : {};
  const out = {};
  if (typeof m.name === 'string' && m.name.trim()) out.name = m.name.trim().slice(0, 120);
  if (typeof m.service === 'string' && m.service.trim()) {
    out.service = normalizeService(m.service);
    if (!out.service) return { error: 'service' };
  }
  if (typeof m.city_state === 'string' && m.city_state.trim()) {
    const cs = parseCityState(m.city_state);
    if (!cs) return { error: 'city_state' };
    Object.assign(out, cs);
  }
  return out;
}

function prompts(business, settings = DEFAULT_SETTINGS) {
  return settings.prompt_templates.slice(0, settings.query_count).map((t) => renderPrompt(t, business));
}

export async function POST(request) {
  try {
    const body = await readJson(request);
    const site = normalizeWebsite(body.website);
    if (!site.ok) return error(400, 'invalid_url', MESSAGES.invalid_url);
    const manual = manualFields(body);
    if (manual.error) return error(400, manual.error, MESSAGES[manual.error]);
    const captcha = await verifyTurnstile(body.turnstile_token, clientIp(request));
    if (!captcha.ok) return error(403, 'captcha', MESSAGES.captcha);

    const typedIn = !!(manual.service && manual.city && manual.state);
    let parse = null;
    if (!typedIn) {
      parse = await deps.parseSite(site.domain);
      if (!parse.ok) console.warn('[ai-check/parse]', site.domain, parse.reason, parse.error || '');
    }
    const d = parse?.ok ? parse.data : {};
    const business = {
      name: manual.name || d.name || null,
      service: manual.service || d.service || null,
      city: manual.city || d.city || null,
      state: manual.state || d.state || null
    };
    const base = { website: site.domain, business };

    if (!typedIn) {
      if (!parse.ok) return json({ ...base, status: 'needs_input', needs: ['name', 'service', 'city_state'], site_unreadable: true });
      if (d.is_local_business === false) return json({ ...base, status: 'not_local' });
      if (d.country && d.country !== 'US' && !manual.state) return json({ ...base, status: 'not_us' });
      const needs = [];
      if (!business.service) needs.push('service');
      if (!business.city || !business.state) needs.push('city_state');
      if (needs.length) return json({ ...base, status: 'needs_input', needs, site_unreadable: false });
    }

    const ticket = issueTicket({ domain: site.domain, ...business });
    return json({ ...base, status: 'ready', prompts: prompts(business), ticket });
  } catch (err) {
    if (err.status === 400 || err.status === 413) return error(err.status, 'bad_request', err.message);
    console.error('[ai-check/parse]', err);
    return error(500, 'server_error', MESSAGES.server);
  }
}

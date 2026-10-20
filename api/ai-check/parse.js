// POST /api/ai-check/parse — step 1 of the free check, called by the page.
// Turnstile → read the client's site (Gemini finds name, service, city, region, country, language)
// → the three questions and a short-lived ticket for /api/ai-check/ask. Nothing is stored.
// Time limit: 150 s (vercel.json).
//
// body: { website, turnstile_token, manual?: { name, service, city_state, country } }
//   manual with service, city_state and country skips reading the site (the visitor typed them in).
// → { status: 'ready', website, business, prompts, ticket }
//   { status: 'needs_input', website, business, needs: ['name' | 'service' | 'city_state' | 'country'], site_unreadable }
//   { status: 'not_local' | 'unsupported_country', website, business }
// business: { name, service, city, state, country, language }; state is the US state code, or the region elsewhere.

import { json, error, readJson, clientIp, background, attributionFrom } from '../_lib/http.js';
import { sendTelegram, startMessage } from '../_lib/notify/telegram.js';
import { MESSAGES } from '../_lib/config.js';
import { normalizeWebsite, normalizeService, parseLocation } from '../_lib/ai-check/normalize.js';
import { verifyTurnstile } from '../_lib/security/turnstile.js';
import { deps } from '../_lib/ai-check/deps.js';
import { issueTicket } from '../_lib/ai-check/ticket.js';
import { buildPrompts } from '../_lib/ai-check/prompts.js';
import { countryByIso } from '../../assets/js/ai-check-countries.js';

function manualFields(body) {
  const m = body && typeof body.manual === 'object' && body.manual ? body.manual : {};
  const out = {};
  if (typeof m.name === 'string' && m.name.trim()) out.name = m.name.trim().slice(0, 120);
  if (typeof m.service === 'string' && m.service.trim()) {
    out.service = normalizeService(m.service);
    if (!out.service) return { error: 'service' };
  }
  if (typeof m.country === 'string' && m.country.trim()) {
    const c = countryByIso(m.country);
    if (!c) return { error: 'country' };
    out.country = c.iso;
  }
  // The location is parsed once the country is known (US needs a state, other countries don't).
  if (typeof m.city_state === 'string' && m.city_state.trim()) out.location = m.city_state;
  return out;
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

    const typedIn = !!(manual.service && manual.location && manual.country);
    let parse = null;
    if (!typedIn) {
      parse = await deps.parseSite(site.domain);
      if (!parse.ok) console.warn('[ai-check/parse]', site.domain, parse.reason, parse.error || '');
    }
    const d = parse?.ok ? parse.data : {};

    // Country: what the visitor chose, else what the site says. A country DataForSEO has no location for stops here.
    const siteCountry = d.country ? String(d.country).toUpperCase() : null;
    const country = manual.country || (siteCountry && countryByIso(siteCountry) ? siteCountry : null);

    let city = d.city || null, state = d.state || null;
    if (manual.location) {
      const loc = parseLocation(manual.location, country || 'US');
      if (!loc) return error(400, 'city_state', MESSAGES[(country || 'US') === 'US' ? 'city_state' : 'city']);
      city = loc.city; state = loc.state;
    }
    const business = {
      name: manual.name || d.name || null,
      service: manual.service || d.service || null,
      city, state, country,
      language: d.language || 'en'
    };
    const base = { website: site.domain, business };
    // Telegram hears about every check that is started: the first call for a site only (not the follow-ups
    // after the visitor fills in missing fields or presses "Try again").
    const notify = (status) => {
      if (Object.keys(manual).length) return;
      background(sendTelegram(startMessage({ site: site.domain, status, business, a: attributionFrom(body, request), userAgent: request.headers.get('user-agent') || '' })));
    };

    if (!typedIn) {
      if (!parse.ok) { notify('needs_input'); return json({ ...base, status: 'needs_input', needs: ['name', 'service', 'city_state', 'country'], site_unreadable: true }); }
      if (d.is_local_business === false && !manual.service) { notify('not_local'); return json({ ...base, status: 'not_local' }); }
      if (siteCountry && !countryByIso(siteCountry) && !manual.country) { notify('unsupported_country'); return json({ ...base, status: 'unsupported_country' }); }
    }
    const needs = [];
    if (!business.service) needs.push('service');
    if (!business.country) needs.push('country');
    // Outside the US a city is enough; a US business needs its state too.
    if (!business.city || ((business.country || 'US') === 'US' && !business.state)) needs.push('city_state');
    if (needs.length) { notify('needs_input'); return json({ ...base, status: 'needs_input', needs, site_unreadable: false }); }

    const prompts = buildPrompts(business, { questions: d.questions });
    const ticket = issueTicket({ domain: site.domain, ...business, prompts });
    notify('ready');
    return json({ ...base, status: 'ready', prompts, ticket });
  } catch (err) {
    if (err.status === 400 || err.status === 413) return error(err.status, 'bad_request', err.message);
    console.error('[ai-check/parse]', err);
    return error(500, 'server_error', MESSAGES.server);
  }
}

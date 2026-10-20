// POST /api/ai-check/report — called by the page when a check has finished, whether or not the
// visitor leaves an email. Saves the check in `checks` and sends it to Telegram.
//
// body: { website, business: { name, service, city, state, country }, result: { mentions_count, total, best_position, verdict },
//         answers: [saved answers from /ask, signed], attribution }
// Only answers signed by /ask count, so a request without real answers saves and sends nothing, and the same
// check (same signatures) is stored once however many times it is reported.

import crypto from 'node:crypto';
import { json, error, readJson, background, attributionFrom } from '../_lib/http.js';
import { CONSENT_VERSION, MESSAGES, VERDICTS } from '../_lib/config.js';
import { normalizeWebsite, normalizeState, cleanRegion } from '../_lib/ai-check/normalize.js';
import { countryByIso } from '../../assets/js/ai-check-countries.js';
import { verifyAnswer } from '../_lib/ai-check/ticket.js';
import { one } from '../_lib/db.js';
import { sendTelegramLong, leadMessage } from '../_lib/notify/telegram.js';

const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const count = (v) => (Number.isInteger(v) && v >= 0 && v <= 10 ? v : null);

export async function POST(request) {
  try {
    const body = await readJson(request, 600000);
    const site = normalizeWebsite(body.website);
    if (!site.ok) return error(400, 'invalid_url', MESSAGES.invalid_url);
    const answers = Array.isArray(body.answers) ? body.answers.slice(0, 3).filter(verifyAnswer) : [];
    if (!answers.length) return error(400, 'no_answers', 'No answers to save.');
    const kept = answers.map(({ sig, ...rest }) => rest);
    const checkKey = crypto.createHash('sha256').update(answers.map((x) => x.sig).sort().join('|')).digest('hex');

    const b = body.business && typeof body.business === 'object' ? body.business : {};
    const r = body.result && typeof body.result === 'object' ? body.result : {};
    const country = countryByIso(b.country)?.iso || null;
    const verdict = typeof r.verdict === 'string' && VERDICTS[r.verdict] ? r.verdict : null;
    const a = attributionFrom(body, request);
    const userAgent = (request.headers.get('user-agent') || '').slice(0, 500);
    const business = {
      name: str(b.name, 120), service: str(b.service, 60), city: str(b.city, 60),
      state: country === 'US' || !country ? normalizeState(str(b.state, 30) || '') : cleanRegion(str(b.state, 40) || ''), country
    };

    const row = await one(
      `insert into checks (check_key, website, business_name, service, city, state, country, mentions_count, total_answers, best_position, verdict,
          answers, user_agent, landing_url, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, gbraid, wbraid, fbclid, fbp, fbc)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
       on conflict (check_key) do nothing returning id`,
      [checkKey, site.domain, business.name, business.service, business.city, business.state, country, count(r.mentions_count), count(r.total),
        count(r.best_position), verdict, JSON.stringify(kept), userAgent, a.landing_url, a.referrer, a.utm_source, a.utm_medium, a.utm_campaign,
        a.utm_content, a.utm_term, a.gclid, a.gbraid, a.wbraid, a.fbclid, a.fbp, a.fbc]
    );
    // Reported again (reload, a second tab): already stored and sent, nothing more to do.
    if (!row) return json({ ok: true, duplicate: true });

    background(sendTelegramLong(leadMessage({
      kind: 'check', id: row.id, site: site.domain, email: null, business,
      result: { mentions: count(r.mentions_count), total: count(r.total), best_position: count(r.best_position) },
      verdictLabel: verdict ? VERDICTS[verdict].label : null, a, userAgent, consent: null, answers: kept
    })));
    return json({ ok: true, id: row.id });
  } catch (err) {
    if (err.status === 400 || err.status === 413) return error(err.status, 'bad_request', err.message);
    console.error('[ai-check/report]', err);
    return error(500, 'server_error', MESSAGES.server);
  }
}

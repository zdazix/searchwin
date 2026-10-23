// POST /api/ai-check/audit — the email form under the result, and the popup for online
// businesses ("not a local business?"). Turnstile → email check → a row in `leads` → Telegram
// message. No email is sent to the visitor at this stage.
//
// body: { email, turnstile_token, website, attribution, kind?: 'local' | 'online',
//         business: { name, service, city, state }, result: { mentions_count, total, best_position, verdict } }
//   kind 'online' comes from the popup: just website and email, no check was run.
// → { ok, lead_id, event_id, due_at }

import { json, error, readJson, clientIp, attributionFrom } from '../_lib/http.js';
import { consentVersion, LIMITS, MESSAGES, VERDICTS } from '../_lib/config.js';
import { normalizeWebsite, normalizeState, cleanRegion } from '../_lib/ai-check/normalize.js';
import { countryByIso } from '../../assets/js/ai-check-countries.js';
import { verifyTurnstile } from '../_lib/security/turnstile.js';
import { verifyAnswer, issueTgToken, readTgToken } from '../_lib/ai-check/ticket.js';
import { validateEmail } from '../_lib/leads/email.js';
import { one, query } from '../_lib/db.js';
import { upsertTelegram, leadMessage } from '../_lib/notify/telegram.js';

const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const count = (v) => (Number.isInteger(v) && v >= 0 && v <= 10 ? v : null);

export async function POST(request) {
  try {
    // The saved answers can be long (full ChatGPT texts), so this body may be larger than the default.
    const body = await readJson(request, 600000);
    const site = normalizeWebsite(body.website);
    if (!site.ok) return error(400, 'invalid_url', MESSAGES.invalid_url);
    const v = await validateEmail(body.email);
    if (!v.ok) return error(400, 'email_' + v.reason, MESSAGES['email_' + v.reason]);
    const captcha = await verifyTurnstile(body.turnstile_token, clientIp(request));
    if (!captcha.ok) return error(403, 'captcha', MESSAGES.captcha);

    // What the visitor saw on the page. It only describes the lead for us, nothing is billed or decided on it.
    const kind = body.kind === 'online' ? 'online' : 'local';
    const b = kind === 'local' && body.business && typeof body.business === 'object' ? body.business : {};
    const country = kind === 'local' ? countryByIso(b.country)?.iso || null : null;
    const r = kind === 'local' && body.result && typeof body.result === 'object' ? body.result : {};
    const verdict = typeof r.verdict === 'string' && VERDICTS[r.verdict] ? r.verdict : null;
    const total = count(r.total), mentions = count(r.mentions_count);
    const a = attributionFrom(body, request);
    // Only answers signed by /ask are kept, so the stored text is what DataForSEO really returned.
    const answers = kind === 'local' && Array.isArray(body.answers)
      ? body.answers.slice(0, 3).filter(verifyAnswer).map(({ sig, ...keep }) => keep)
      : [];

    const lead = await one(
      `insert into leads (email, website, business_name, service, city, state, mentions_count, total_answers, best_position, verdict,
          consent_text_version, user_agent, landing_url, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          gclid, gbraid, wbraid, fbclid, fbp, fbc, kind, country, answers)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28::jsonb)
       returning id, created_at`,
      [v.email, site.domain, str(b.name, 120), str(b.service, 60), str(b.city, 60),
        country === 'US' || !country ? normalizeState(str(b.state, 30) || '') : cleanRegion(str(b.state, 40) || ''), mentions, total, count(r.best_position), verdict,
        consentVersion(a.ui_lang), (request.headers.get('user-agent') || '').slice(0, 500), a.landing_url, a.referrer,
        a.utm_source, a.utm_medium, a.utm_campaign, a.utm_content, a.utm_term, a.gclid, a.gbraid, a.wbraid, a.fbclid, a.fbp, a.fbc, kind, country, answers.length ? JSON.stringify(answers) : null]
    );
    const due = new Date(new Date(lead.created_at).getTime() + LIMITS.auditDueHours * 3600e3);

    // The visit's one Telegram message becomes the full lead. If the answers were already posted after the
    // check, they are not posted again.
    const prior = readTgToken(body.tg);
    const mid = await upsertTelegram(prior && prior.id, leadMessage({
      kind, id: lead.id, site: site.domain, email: v.email,
      business: { name: str(b.name, 120), service: str(b.service, 60), city: str(b.city, 60), state: str(b.state, 40), country },
      result: { mentions, total, best_position: count(r.best_position) }, verdictLabel: verdict ? VERDICTS[verdict].label : null,
      due: due.toISOString().slice(0, 16).replace('T', ' '), a, userAgent: request.headers.get('user-agent') || '',
      consent: consentVersion(a.ui_lang), answers: prior && prior.answers ? [] : answers, answersAbove: !!(prior && prior.answers)
    }));
    // Link the cookie answer of this browser to the lead (best effort: the consents table may not exist yet).
    if (a.visitor_id) await query('update consents set lead_id = $1 where visitor_id = $2 and lead_id is null', [lead.id, a.visitor_id]).catch(() => {});
    return json({ ok: true, lead_id: lead.id, event_id: `lead_${lead.id}`, due_at: due.toISOString(), kind, tg: mid ? issueTgToken({ id: mid, answers: !!(prior && prior.answers) }) : null });
  } catch (err) {
    if (err.status === 400 || err.status === 413) return error(err.status, 'bad_request', err.message);
    console.error('[ai-check/audit]', err);
    return error(500, 'server_error', MESSAGES.server);
  }
}

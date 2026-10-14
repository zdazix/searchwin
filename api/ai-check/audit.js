// POST /api/ai-check/audit — the email form under the result. Turnstile → email check →
// a row in `leads` → Telegram message. No email is sent to the visitor at this stage.
//
// body: { email, turnstile_token, website, business: { name, service, city, state },
//         result: { mentions_count, total, best_position, verdict }, attribution }
// → { ok, lead_id, event_id, due_at }

import { json, error, readJson, clientIp, background, attributionFrom } from '../_lib/http.js';
import { CONSENT_VERSION, LIMITS, MESSAGES, VERDICTS } from '../_lib/config.js';
import { normalizeWebsite, normalizeService, normalizeState, cleanCity } from '../_lib/ai-check/normalize.js';
import { verifyTurnstile } from '../_lib/security/turnstile.js';
import { validateEmail } from '../_lib/leads/email.js';
import { one } from '../_lib/db.js';
import { sendTelegram, escapeHtml } from '../_lib/notify/telegram.js';

const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const count = (v) => (Number.isInteger(v) && v >= 0 && v <= 10 ? v : null);

export async function POST(request) {
  try {
    const body = await readJson(request);
    const site = normalizeWebsite(body.website);
    if (!site.ok) return error(400, 'invalid_url', MESSAGES.invalid_url);
    const v = await validateEmail(body.email);
    if (!v.ok) return error(400, 'email_' + v.reason, MESSAGES['email_' + v.reason]);
    const captcha = await verifyTurnstile(body.turnstile_token, clientIp(request));
    if (!captcha.ok) return error(403, 'captcha', MESSAGES.captcha);

    // What the visitor saw on the page. It only describes the lead for us, nothing is billed or decided on it.
    const b = body.business && typeof body.business === 'object' ? body.business : {};
    const r = body.result && typeof body.result === 'object' ? body.result : {};
    const verdict = typeof r.verdict === 'string' && VERDICTS[r.verdict] ? r.verdict : null;
    const total = count(r.total), mentions = count(r.mentions_count);
    const a = attributionFrom(body, request);

    const lead = await one(
      `insert into leads (email, website, business_name, service, city, state, mentions_count, total_answers, best_position, verdict,
          consent_text_version, user_agent, landing_url, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          gclid, gbraid, wbraid, fbclid, fbp, fbc)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
       returning id, created_at`,
      [v.email, site.domain, str(b.name, 120), normalizeService(str(b.service, 60) || '') || null, cleanCity(str(b.city, 60) || '') || null,
        normalizeState(str(b.state, 30) || ''), mentions, total, count(r.best_position), verdict,
        CONSENT_VERSION, (request.headers.get('user-agent') || '').slice(0, 500), a.landing_url, a.referrer,
        a.utm_source, a.utm_medium, a.utm_campaign, a.utm_content, a.utm_term, a.gclid, a.gbraid, a.wbraid, a.fbclid, a.fbp, a.fbc]
    );
    const due = new Date(new Date(lead.created_at).getTime() + LIMITS.auditDueHours * 3600e3);

    const place = [str(b.city, 60), str(b.state, 30)].filter(Boolean).join(', ');
    background(sendTelegram(
      `🆕 Заявка на аудит\n<b>${escapeHtml(str(b.name, 120) || site.domain)}</b> — ${escapeHtml(site.domain)}\n` +
      `${escapeHtml(str(b.service, 60) || '')}${place ? ', ' + escapeHtml(place) : ''}\n` +
      `Email: ${escapeHtml(v.email)}\n` +
      `Итог: ${mentions ?? '?'} из ${total ?? '?'}${verdict ? ' (' + VERDICTS[verdict].label + ')' : ''}\n` +
      `Источник: ${escapeHtml([a.utm_source, a.utm_campaign].filter(Boolean).join(' / ') || (a.gclid ? 'Google Ads' : a.fbclid ? 'Meta' : 'прямой заход'))}\n` +
      `Срок: ${due.toISOString().slice(0, 16).replace('T', ' ')} UTC`
    ));
    return json({ ok: true, lead_id: lead.id, event_id: `lead_${lead.id}`, due_at: due.toISOString() });
  } catch (err) {
    if (err.status === 400 || err.status === 413) return error(err.status, 'bad_request', err.message);
    console.error('[ai-check/audit]', err);
    return error(500, 'server_error', MESSAGES.server);
  }
}

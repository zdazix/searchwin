// Public API of the free AI check.
//   GET   /api/ai-check/config        public IDs for the page (Turnstile, Pixel, Google tags)
//   POST  /api/ai-check               start a check            → { check_id }
//   GET   /api/ai-check/:id           status and finished answers (polled every 2 s)
//   PATCH /api/ai-check/:id           Edit / fill in missing fields, restarts the queries
//   POST  /api/ai-check/:id/audit     email for the full audit → saved for the admin, no emails sent

import { json, error, readJson, clientIp, ipHash, segments, background, isUuid, attributionFrom } from './_lib/http.js';
import { one, query } from './_lib/db.js';
import { env, LIMITS } from './_lib/config.js';
import { normalizeWebsite, normalizeService, parseCityState, normalizeState, cleanCity } from './_lib/ai-check/normalize.js';
import { verifyTurnstile } from './_lib/security/turnstile.js';
import { runsLast24h, recordRun, overBudget, ipDailyLimit, dailyBudgetUsd, spentTodayUsd } from './_lib/security/limits.js';
import {
  findCachedCheck, createCachedCheck, createCheck, runParse, editCheck, startQueries, watchdog, publicView, FINAL
} from './_lib/ai-check/pipeline.js';
import { validateEmail } from './_lib/leads/email.js';
import { sendCapiEvent } from './_lib/tracking/meta-capi.js';
import { logEvent } from './_lib/notify/events.js';
import { escapeHtml } from './_lib/notify/telegram.js';

export const CONSENT_VERSION = '2026-10-12';
const PREFIX = '/api/ai-check';

const MESSAGES = {
  invalid_url: 'Enter your website, e.g. yourbusiness.com',
  captcha: "We couldn't confirm you're human. Refresh the page and try again.",
  rate_limited: "You've reached today's limit of free checks from this connection. Try again tomorrow.",
  busy: "We're getting a lot of checks right now, try again in an hour",
  city_state: 'Enter a US city and state, e.g. Austin, TX',
  service: 'Tell us what you do, e.g. plumber or family dentist',
  not_found: "We couldn't find this check. Start a new one.",
  not_ready: 'Your results are still loading. Try again in a moment.'
};

// Worker calls go to the same deployment that received the request (production or preview).
const originOf = (request) => new URL(request.url).origin;
const pageUrl = (request, id) => `${new URL(request.url).origin}/ai-check/r/${id}`;

function manualFields(body) {
  const m = body && typeof body.manual === 'object' && body.manual ? body.manual : {};
  const out = {};
  if (typeof m.name === 'string' && m.name.trim()) out.name = m.name.trim().slice(0, 120);
  if (typeof m.service === 'string' && m.service.trim()) out.service = normalizeService(m.service);
  if (typeof m.city_state === 'string' && m.city_state.trim()) {
    const cs = parseCityState(m.city_state);
    if (!cs) return { error: 'city_state' };
    Object.assign(out, cs);
  }
  return out;
}

async function limitAndBudget(ipH) {
  if ((await runsLast24h(ipH)) >= ipDailyLimit()) return error(429, 'rate_limited', MESSAGES.rate_limited);
  if (await overBudget()) {
    const spent = await spentTodayUsd();
    await logEvent('warn', 'budget_exceeded', `💸 Дневной бюджет API исчерпан: $${spent.toFixed(2)} из $${dailyBudgetUsd()}. Новые проверки отклоняются до полуночи UTC.`,
      { notify: true, throttleMinutes: 720, data: { spent } });
    return error(503, 'busy', MESSAGES.busy);
  }
  return null;
}

async function start(request) {
  const body = await readJson(request);
  const site = normalizeWebsite(body.website);
  if (!site.ok) return error(400, 'invalid_url', MESSAGES.invalid_url);
  const manual = manualFields(body);
  if (manual.error) return error(400, manual.error, MESSAGES[manual.error]);
  const ip = clientIp(request);
  const captcha = await verifyTurnstile(body.turnstile_token, ip);
  if (!captcha.ok) return error(403, 'captcha', MESSAGES.captcha);

  const ipH = ipHash(ip);
  const userAgent = (request.headers.get('user-agent') || '').slice(0, 500);
  const attribution = attributionFrom(body, request);
  const ctx = { inputRaw: String(body.website).slice(0, 500), ipHash: ipH, userAgent, attribution };

  // Same site (and service) in the last 7 days: the saved result, no paid calls, not counted in the limit.
  const cached = await findCachedCheck(site.domain, manual.service || null, manual.city || null, manual.state || null);
  let id, isCached = false;
  if (cached) {
    id = await createCachedCheck(cached, ctx);
    isCached = true;
  } else {
    const refused = await limitAndBudget(ipH);
    if (refused) return refused;
    id = await createCheck({ domain: site.domain, ...ctx });
    await recordRun(ipH, id, 'start');
    background(runParse(id, { origin: originOf(request), manual }));
  }
  const eventId = `cs_${id}`;
  background(sendCapiEvent({
    eventName: 'CheckStarted', eventId, sourceUrl: attribution.landing_url || `${new URL(request.url).origin}/ai-check/`,
    user: { ip, userAgent, fbp: attribution.fbp, fbc: attribution.fbc, externalId: id },
    customData: { content_name: 'ai_check', website: site.domain, cached: isCached }
  }).then((r) => { if (!r.sent && r.reason !== 'not_configured') return logEvent('warn', 'capi_error', `CAPI CheckStarted: ${r.reason}`, { checkId: id }); }));
  return json({ check_id: id, cached: isCached, event_id: eventId }, 201);
}

async function loadCheck(id) {
  if (!isUuid(id)) return null;
  return one('select * from ai_checks where id = $1', [id]);
}

async function status(request, id) {
  let check = await loadCheck(id);
  if (!check) return error(404, 'not_found', MESSAGES.not_found);
  if (await watchdog(check)) check = await loadCheck(id);
  const view = await publicView(check);
  const ccEvent = `cc_${check.id}_${check.generation}`;
  view.events = { check_completed: ccEvent };
  // The server half of check_completed goes out when a browser first receives the finished result.
  if (view.summary && !check.capi_cc_sent && !check.is_test) {
    const claimed = await one('update ai_checks set capi_cc_sent = true where id = $1 and capi_cc_sent = false returning id', [check.id]);
    if (claimed) {
      const ip = clientIp(request);
      background(sendCapiEvent({
        eventName: 'ViewContent', eventId: ccEvent, sourceUrl: pageUrl(request, check.id),
        user: { ip, userAgent: request.headers.get('user-agent') || '', fbp: check.fbp, fbc: check.fbc, city: check.city, state: check.state, externalId: check.id },
        customData: { content_name: 'ai_check_result', verdict: check.verdict, service: check.service, mentions_count: check.mentions_count }
      }).then((r) => { if (!r.sent && r.reason !== 'not_configured') return logEvent('warn', 'capi_error', `CAPI ViewContent: ${r.reason}`, { checkId: check.id }); }));
    }
  }
  return json(view);
}

async function edit(request, id) {
  const check = await loadCheck(id);
  if (!check) return error(404, 'not_found', MESSAGES.not_found);
  if (check.status === 'parsing') return error(409, 'not_ready', MESSAGES.not_ready);
  if (check.status === 'not_local') return error(409, 'not_local', 'This check is built for local service businesses');
  const body = await readJson(request);
  const fields = {};
  if (typeof body.name === 'string' && body.name.trim()) fields.name = body.name.trim().slice(0, 120);
  if (typeof body.service === 'string') {
    fields.service = normalizeService(body.service);
    if (!fields.service) return error(400, 'service', MESSAGES.service);
  }
  if (typeof body.city_state === 'string') {
    const cs = parseCityState(body.city_state);
    if (!cs) return error(400, 'city_state', MESSAGES.city_state);
    fields.city = cs.city; fields.state = cs.state;
  } else if (typeof body.city === 'string' && typeof body.state === 'string') {
    const city = cleanCity(body.city), state = normalizeState(body.state);
    if (!city || !state) return error(400, 'city_state', MESSAGES.city_state);
    fields.city = city; fields.state = state;
  }
  if (!fields.service && !fields.city && !fields.name) return error(400, 'service', MESSAGES.service);
  if (check.status === 'not_us' && !fields.state) return error(400, 'city_state', MESSAGES.city_state);

  // Filling in what the parser couldn't find finishes the same check; a real Edit counts as a new one.
  const counted = check.status !== 'needs_input';
  const ipH = ipHash(clientIp(request));
  if (counted) {
    const refused = await limitAndBudget(ipH);
    if (refused) return refused;
  }
  const ready = await editCheck(check, fields);
  if (counted) await recordRun(ipH, check.id, 'edit');
  if (ready) background(startQueries(ready, originOf(request)));
  const fresh = await loadCheck(id);
  return json({ check_id: id, status: fresh.status });
}

const EMAIL_MESSAGES = {
  format: 'Enter a valid email, e.g. name@yourbusiness.com',
  disposable: "Please use a permanent email address. Temporary inboxes can't receive the audit.",
  no_mx: "This email domain can't receive mail. Check it for typos."
};

async function audit(request, id) {
  const check = await loadCheck(id);
  if (!check) return error(404, 'not_found', MESSAGES.not_found);
  if (!['done', 'partial'].includes(check.status)) return error(409, 'not_ready', MESSAGES.not_ready);
  const body = await readJson(request);
  const ip = clientIp(request), ipH = ipHash(ip);
  const recent = await one(
    `select count(*)::int as n from audit_requests a join leads l on l.id = a.lead_id where l.ip_hash = $1 and a.created_at > now() - interval '24 hours'`,
    [ipH]
  );
  if ((recent?.n || 0) >= 10) return error(429, 'rate_limited', 'Too many requests from this connection today. Email us at hi@searchwin.ai instead.');
  const v = await validateEmail(body.email);
  if (!v.ok) return error(400, 'email_' + v.reason, EMAIL_MESSAGES[v.reason]);

  const a = attributionFrom(body, request);
  const userAgent = (request.headers.get('user-agent') || '').slice(0, 500);
  const lead = await one(
    `insert into leads (id, email, consent_text_version, ip_hash, user_agent, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        gclid, gbraid, wbraid, fbclid, fbp, fbc, landing_url, referrer)
     values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     on conflict (email) do update set email = excluded.email returning id`,
    [v.email, CONSENT_VERSION, ipH, userAgent, a.utm_source || check.utm_source, a.utm_medium || check.utm_medium, a.utm_campaign || check.utm_campaign,
      a.utm_content || check.utm_content, a.utm_term || check.utm_term, a.gclid || check.gclid, a.gbraid || check.gbraid, a.wbraid || check.wbraid,
      a.fbclid || check.fbclid, a.fbp || check.fbp, a.fbc || check.fbc, a.landing_url || check.landing_url, a.referrer || check.referrer]
  );
  let req = await one('select * from audit_requests where lead_id = $1 and check_id = $2', [lead.id, check.id]);
  const isNew = !req;
  if (!req) {
    req = await one(
      `insert into audit_requests (id, lead_id, check_id, website, status, due_at)
       values (gen_random_uuid(), $1, $2, $3, 'new', now() + ($4 || ' hours')::interval) returning *`,
      [lead.id, check.id, check.website_domain, String(LIMITS.auditDueHours)]
    );
    await query('update ai_checks set lead_id = $2 where id = $1', [check.id, lead.id]);
  }
  const eventId = `lead_${req.id}`;
  if (isNew) {
    const admin = `${env('PUBLIC_BASE_URL', new URL(request.url).origin)}/admin/#request=${req.id}`;
    background(logEvent('info', 'audit_requested',
      `🆕 Заявка на аудит${check.is_test ? ' (тест)' : ''}\n<b>${escapeHtml(check.business_name || check.website_domain)}</b> — ${escapeHtml(check.website_domain)}\n` +
      `${escapeHtml(check.service || '')}, ${escapeHtml(check.city || '')} ${escapeHtml(check.state || '')}\n` +
      `Email: ${escapeHtml(v.email)}\nИтог: ${check.mentions_count ?? 0} из ${check.total_answers ?? 0}\nСрок: 48 ч\n${admin}`,
      { checkId: check.id, notify: true, data: { audit_request_id: req.id } }));
    if (!check.is_test) {
      background(sendCapiEvent({
        eventName: 'Lead', eventId, sourceUrl: pageUrl(request, check.id),
        user: { email: v.email, city: check.city, state: check.state, ip, userAgent, fbp: a.fbp || check.fbp, fbc: a.fbc || check.fbc, externalId: check.id },
        customData: { content_name: 'ai_check_audit', verdict: check.verdict, service: check.service }
      }).then((r) => { if (!r.sent && r.reason !== 'not_configured') return logEvent('warn', 'capi_error', `CAPI Lead: ${r.reason}`, { checkId: check.id }); }));
    }
  }
  return json({ ok: true, due_at: req.due_at, event_id: eventId, new: isNew });
}

function config() {
  return json({
    turnstile_site_key: env('PUBLIC_TURNSTILE_SITE_KEY', null),
    meta_pixel_id: env('PUBLIC_META_PIXEL_ID', null),
    google_ads_id: env('PUBLIC_GOOGLE_ADS_ID', null),
    google_ads_labels: {
      check_started: env('PUBLIC_GADS_LABEL_CHECK_STARTED', null),
      check_completed: env('PUBLIC_GADS_LABEL_CHECK_COMPLETED', null),
      audit_requested: env('PUBLIC_GADS_LABEL_AUDIT_REQUESTED', null)
    },
    ga4_id: env('PUBLIC_GA4_ID', null),
    consent_version: CONSENT_VERSION
  }, 200, { 'cache-control': 'public, max-age=300' });
}

async function handle(request, method) {
  try {
    const segs = segments(request, PREFIX);
    if (method === 'GET' && segs.length === 1 && segs[0] === 'config') return config();
    if (method === 'GET' && segs.length === 1) return await status(request, segs[0]);
    if (method === 'POST' && segs.length === 0) return await start(request);
    if (method === 'PATCH' && segs.length === 1) return await edit(request, segs[0]);
    if (method === 'POST' && segs.length === 2 && segs[1] === 'audit') return await audit(request, segs[0]);
    return error(404, 'not_found', 'Not found');
  } catch (err) {
    if (err.status === 400 || err.status === 413) return error(err.status, 'bad_request', err.message);
    console.error('[ai-check]', err);
    return error(500, 'server_error', 'Something went wrong on our side. Try again in a minute.');
  }
}

export const GET = (request) => handle(request, 'GET');
export const POST = (request) => handle(request, 'POST');
export const PATCH = (request) => handle(request, 'PATCH');

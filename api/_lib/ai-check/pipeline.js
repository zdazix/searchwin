// The check from start to finish: site parse → ChatGPT queries (each in its own function call)
// → summary. Every step is stored, so the page can poll and a closed tab doesn't stop anything.

import crypto from 'node:crypto';
import { query, one } from '../db.js';
import { mergeSettings, LIMITS, env, VERDICTS } from '../config.js';
import { parseSite, missingFields } from './site-parse.js';
import { chatgptLive } from './dataforseo.js';
import { parseAnswer } from './answer.js';
import { makeClient } from './match.js';
import { summarize } from './summary.js';
import { renderMarkdown } from './markdown.js';
import { renderPrompt } from './normalize.js';
import { logEvent } from '../notify/events.js';
import { escapeHtml } from '../notify/telegram.js';

export const FINAL = ['done', 'partial', 'failed', 'not_local', 'not_us'];
const ALL_FIELDS = ['name', 'service', 'city_state'];

let settingsCache = { at: 0, value: null };
export async function getSettings() {
  if (settingsCache.value && Date.now() - settingsCache.at < 60000) return settingsCache.value;
  const row = await one(`select value from app_settings where key = 'ai_check'`).catch(() => null);
  settingsCache = { at: Date.now(), value: mergeSettings(row?.value) };
  return settingsCache.value;
}
export function resetSettingsCache() { settingsCache = { at: 0, value: null }; }

const ATTR = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'fbp', 'fbc', 'landing_url', 'referrer'];

/** Latest finished check of the same site in the last 7 days (same service when one is given). */
export async function findCachedCheck(domain, service = null, city = null, state = null) {
  return one(
    `select * from ai_checks
      where website_domain = $1 and status in ('done', 'partial') and cache_of is null
        and created_at > now() - ($5 || ' days')::interval
        and (($2::text is null and service_edited = false) or service = $2)
        and ($3::text is null or city = $3) and ($4::text is null or state = $4)
      order by created_at desc limit 1`,
    [domain, service, city, state, String(LIMITS.checkCacheDays)]
  );
}

function attrValues(attribution) {
  return ATTR.map((k) => (attribution && attribution[k]) || null);
}

/** A new check that shows a saved result: no parsing, no paid calls. */
export async function createCachedCheck(source, { inputRaw, ipHash, userAgent, attribution, isTest = false }) {
  const id = crypto.randomUUID();
  await query(
    `insert into ai_checks (id, status, input_raw, website_domain, site_parse, business_name, service, city, state,
        mentions_count, total_answers, best_position, verdict, competitors, sources, cache_of, finished_at, is_test, ip_hash, user_agent,
        ${ATTR.join(', ')})
     values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16, now(), $17, $18, $19,
        ${ATTR.map((_, i) => '$' + (20 + i)).join(', ')})`,
    [id, source.status, inputRaw, source.website_domain, JSON.stringify(source.site_parse), source.business_name, source.service,
      source.city, source.state, source.mentions_count, source.total_answers, source.best_position, source.verdict,
      JSON.stringify(source.competitors), JSON.stringify(source.sources), source.id, isTest, ipHash, userAgent, ...attrValues(attribution)]
  );
  return id;
}

export async function createCheck({ domain, inputRaw, ipHash, userAgent, attribution, isTest = false }) {
  const id = crypto.randomUUID();
  await query(
    `insert into ai_checks (id, status, input_raw, website_domain, is_test, ip_hash, user_agent, ${ATTR.join(', ')})
     values ($1, 'parsing', $2, $3, $4, $5, $6, ${ATTR.map((_, i) => '$' + (7 + i)).join(', ')})`,
    [id, inputRaw, domain, isTest, ipHash, userAgent, ...attrValues(attribution)]
  );
  return id;
}

async function siteParseFor(domain) {
  const cached = await one(
    `select parse, emails from site_cache where domain = $1 and fetched_at > now() - ($2 || ' days')::interval`,
    [domain, String(LIMITS.siteCacheDays)]
  );
  if (cached) return { ...cached.parse, emails: cached.emails || [], cost_usd: 0, ms: 0, from_cache: true };
  const parse = await parseSite(domain);
  if (parse.ok) {
    const { emails, cost_usd, ms, ...keep } = parse;
    await query(
      `insert into site_cache (domain, parse, emails, fetched_at) values ($1, $2::jsonb, $3::jsonb, now())
       on conflict (domain) do update set parse = excluded.parse, emails = excluded.emails, fetched_at = now()`,
      [domain, JSON.stringify(keep), JSON.stringify(emails || [])]
    );
  }
  return parse;
}

/**
 * Step 1, in the background of the start request: read the site, then either ask for
 * missing fields, stop (not local / not US) or start the ChatGPT queries.
 * @param manual fields the visitor typed in ({ name, service, city, state }), override the parse
 */
export async function runParse(checkId, { origin, manual = {} } = {}) {
  const check = await one('select * from ai_checks where id = $1', [checkId]);
  if (!check || check.status !== 'parsing') return;
  const started = Date.now();
  let parse;
  try {
    parse = await siteParseFor(check.website_domain);
  } catch (err) {
    parse = { ok: false, reason: 'error', error: err.message, emails: [], cost_usd: 0 };
  }
  const d = parse.ok ? parse.data : {};
  const merged = {
    name: manual.name || d.name || null,
    service: manual.service || d.service || null,
    city: manual.city || d.city || null,
    state: manual.state || d.state || null
  };
  let status = 'running', needs = [];
  if (!parse.ok && !(manual.service && manual.city && manual.state)) {
    status = 'needs_input'; needs = ALL_FIELDS;
  } else if (parse.ok && d.is_local_business === false && !manual.service) {
    status = 'not_local';
  } else if (parse.ok && d.country && d.country !== 'US' && !manual.state) {
    status = 'not_us';
  } else {
    needs = [];
    if (!merged.service) needs.push('service');
    if (!merged.city || !merged.state) needs.push('city_state');
    if (needs.length) status = 'needs_input';
  }
  const updated = await one(
    `update ai_checks set status = $2, needs = $3::jsonb, site_parse = $4::jsonb, site_emails = $5::jsonb, site_unreadable = $6,
        business_name = $7, service = $8, city = $9, state = $10, parse_ms = $11, parse_cost_usd = $12, updated_at = now(),
        service_edited = $13, finished_at = case when $2 in ('not_local', 'not_us') then now() else null end
      where id = $1 and status = 'parsing' returning *`,
    [checkId, status, JSON.stringify(needs),
      JSON.stringify(parse.ok ? { ...d, confidence: d.confidence, pages: parse.pages, model: parse.model, from_cache: !!parse.from_cache } : { error: parse.reason, detail: parse.error || null }),
      JSON.stringify(parse.emails || []), !parse.ok, merged.name, merged.service, merged.city, merged.state,
      parse.ms || Date.now() - started, parse.cost_usd || 0, !!manual.service]
  );
  if (updated && status === 'running') await startQueries(updated, origin);
}

/** Creates this generation's query rows and hands each one to its own worker call. */
export async function startQueries(check, origin) {
  const settings = await getSettings();
  const templates = settings.prompt_templates.slice(0, settings.query_count);
  const rows = templates.map((t, i) => ({
    id: crypto.randomUUID(), idx: i + 1, prompt: renderPrompt(t, { service: check.service, city: check.city, state: check.state })
  }));
  for (const r of rows) {
    await query(
      `insert into ai_check_queries (id, check_id, generation, idx, prompt, status) values ($1, $2, $3, $4, $5, 'queued')`,
      [r.id, check.id, check.generation, r.idx, r.prompt]
    );
  }
  await Promise.all(rows.map((r) => dispatch(r.id, origin)));
}

async function dispatch(queryId, origin) {
  const secret = env('INTERNAL_JOB_SECRET');
  if (secret && origin) {
    try {
      const headers = { 'content-type': 'application/json', authorization: `Bearer ${secret}` };
      const bypass = env('VERCEL_AUTOMATION_BYPASS_SECRET');
      if (bypass) headers['x-vercel-protection-bypass'] = bypass;
      const res = await fetch(`${origin}/api/ai-check-worker`, {
        method: 'POST', headers, body: JSON.stringify({ query_id: queryId }), signal: AbortSignal.timeout(15000)
      });
      if (res.status === 202) return;
      throw new Error(`worker answered ${res.status}`);
    } catch (err) {
      await logEvent('warn', 'dispatch_fallback', `Worker call failed, running the query in the same function: ${err.message}`, { data: { query_id: queryId } });
    }
  }
  // No separate invocation available: run it here (still in the background of this request).
  await runQuery(queryId);
}

/** Step 2, in the worker: one live ChatGPT answer via DataForSEO. */
export async function runQuery(queryId, { fetchImpl } = {}) {
  const claimed = await one(
    `update ai_check_queries set status = 'running', started_at = now(), attempts = attempts + 1
      where id = $1 and status = 'queued' returning *`,
    [queryId]
  );
  if (!claimed) return;
  const check = await one('select * from ai_checks where id = $1', [claimed.check_id]);
  if (!check || check.generation !== claimed.generation || check.status !== 'running') {
    await query(`update ai_check_queries set status = 'cancelled', finished_at = now() where id = $1 and status = 'running'`, [queryId]);
    return;
  }
  const started = Date.now();
  try {
    const r = await chatgptLive(claimed.prompt, { tag: `${check.id}:${claimed.idx}`, ...(fetchImpl ? { fetchImpl } : {}) });
    await query('update ai_check_queries set cost_usd = $2, duration_ms = $3 where id = $1', [queryId, r.cost, Date.now() - started]);
    if (!r.result) throw Object.assign(new Error('DataForSEO returned no result'), { code: 'api' });
    const settings = await getSettings();
    const client = makeClient({ name: check.business_name, domain: check.website_domain, city: check.city, state: check.state }, settings);
    const a = parseAnswer(r.result, client, settings);
    await query(
      `update ai_check_queries set status = 'done', finished_at = now(), model = $2, answer_markdown = $3, answer_html = $4,
          businesses = $5::jsonb, client_found = $6, client_position = $7, match_rule = $8, sources = $9::jsonb,
          fan_out_queries = $10::jsonb, check_url = $11, answered_at = $12, raw_response = $13::jsonb, error = null
        where id = $1 and status = 'running'`,
      [queryId, a.model, a.markdown, renderMarkdown(a.markdown), JSON.stringify(a.businesses), a.client.found, a.client.position,
        a.client.match_rule, JSON.stringify(a.sources), JSON.stringify(a.fan_out_queries), a.check_url, a.datetime, JSON.stringify(r.raw)]
    );
  } catch (err) {
    const message = `${err.code || 'error'}: ${err.message}`.slice(0, 1000);
    await query(
      `update ai_check_queries set status = 'failed', finished_at = now(), error = $2, cost_usd = greatest(cost_usd, $3), duration_ms = $4
        where id = $1 and status = 'running'`,
      [queryId, message, Number(err.cost || 0), Date.now() - started]
    );
    if (err.code === 'auth' || err.code === 'config') {
      await logEvent('error', 'dataforseo_auth', `⚠️ DataForSEO не принимает ключ: ${escapeHtml(err.message)}`, { checkId: check.id, notify: true, throttleMinutes: 60 });
    } else {
      await logEvent('warn', 'query_failed', `Запрос ${claimed.idx} упал (${check.website_domain}): ${message}`, { checkId: check.id, data: { query_id: queryId } });
    }
  }
  await finalize(check.id);
}

function storedAnswer(q) {
  return {
    client: { found: !!q.client_found, position: q.client_position },
    businesses: q.businesses || [],
    sources: q.sources || []
  };
}

/** Step 3: once every query of the current generation has an outcome, the totals are written once. */
export async function finalize(checkId) {
  const check = await one('select * from ai_checks where id = $1', [checkId]);
  if (!check || check.status !== 'running') return;
  const qs = await query('select * from ai_check_queries where check_id = $1 and generation = $2 order by idx', [checkId, check.generation]);
  if (!qs.length || qs.some((q) => q.status === 'queued' || q.status === 'running')) return;
  const done = qs.filter((q) => q.status === 'done');
  const status = done.length === qs.length ? 'done' : done.length ? 'partial' : 'failed';
  const s = done.length ? summarize(done.map(storedAnswer), check.website_domain) : null;
  const updated = await one(
    `update ai_checks set status = $3, finished_at = now(), updated_at = now(), mentions_count = $4, total_answers = $5,
        best_position = $6, verdict = $7, competitors = $8::jsonb, sources = $9::jsonb, error = $10,
        cost_usd = parse_cost_usd + (select coalesce(sum(cost_usd), 0) from ai_check_queries where check_id = $1)
      where id = $1 and generation = $2 and status = 'running' returning id`,
    [checkId, check.generation, status, s?.mentions_count ?? null, s?.total ?? 0, s?.best_position ?? null, s?.verdict ?? null,
      JSON.stringify(s?.competitors || []), JSON.stringify(s?.sources || []),
      status === 'failed' ? qs.map((q) => q.error).filter(Boolean)[0] || 'All queries failed' : null]
  );
  if (updated && status === 'failed') {
    await logEvent('error', 'check_failed', `❌ Проверка упала: ${escapeHtml(check.website_domain)} — ${escapeHtml(qs.map((q) => q.error).filter(Boolean)[0] || '')}`,
      { checkId, notify: true, throttleMinutes: 10 });
  }
}

/** Polling also heals: dead workers and stuck parses are closed so the page never waits forever. */
export async function watchdog(check) {
  if (check.status === 'running') {
    const stale = await query(
      `update ai_check_queries set status = 'failed', finished_at = now(), error = 'No answer: the worker stopped before ChatGPT replied'
        where check_id = $1 and generation = $2
          and ((status = 'running' and started_at < now() - ($3 || ' seconds')::interval)
            or (status = 'queued' and created_at < now() - ($3 || ' seconds')::interval))
        returning id`,
      [check.id, check.generation, String(Math.round(LIMITS.staleQueryMs / 1000))]
    );
    if (stale.length) {
      await logEvent('warn', 'query_failed', `Воркер не ответил (${check.website_domain}), запросов: ${stale.length}`, { checkId: check.id });
      await finalize(check.id);
      return true;
    }
  }
  if (check.status === 'parsing' && Date.now() - new Date(check.created_at).getTime() > LIMITS.staleParseMs) {
    await query(
      `update ai_checks set status = 'needs_input', needs = $2::jsonb, site_unreadable = true, updated_at = now() where id = $1 and status = 'parsing'`,
      [check.id, JSON.stringify(ALL_FIELDS)]
    );
    await logEvent('warn', 'parse_stuck', `Разбор сайта завис: ${check.website_domain}`, { checkId: check.id });
    return true;
  }
  return false;
}

/**
 * Edit (or the first fill-in after needs_input): new generation and old queries cancelled.
 * Returns the updated check when it is ready for queries; the caller starts them in the background.
 * A ChatGPT call already on its way can't be stopped; its answer is ignored and its cost still counts.
 */
export async function editCheck(check, { name, service, city, state }) {
  await query(`update ai_check_queries set status = 'cancelled', finished_at = now() where check_id = $1 and status in ('queued', 'running')`, [check.id]);
  const serviceChanged = !!service && service !== (check.site_parse?.service || null);
  const updated = await one(
    `update ai_checks set generation = generation + 1, status = 'running', needs = '[]'::jsonb, finished_at = null, updated_at = now(),
        business_name = coalesce($2, business_name), service = coalesce($3, service), city = coalesce($4, city), state = coalesce($5, state),
        service_edited = service_edited or $6, mentions_count = null, total_answers = null, best_position = null, verdict = null,
        competitors = null, sources = null, error = null, capi_cc_sent = false
      where id = $1 returning *`,
    [check.id, name || null, service || null, city || null, state || null, serviceChanged]
  );
  if (!updated.service || !updated.city || !updated.state) {
    const needs = [];
    if (!updated.service) needs.push('service');
    if (!updated.city || !updated.state) needs.push('city_state');
    await query(`update ai_checks set status = 'needs_input', needs = $2::jsonb where id = $1`, [check.id, JSON.stringify(needs)]);
    return null;
  }
  return updated;
}

/** What the browser may see. No emails, IPs or raw responses. */
export async function publicView(check) {
  const source = check.cache_of ? await one('select * from ai_checks where id = $1', [check.cache_of]) : check;
  const qs = await query(
    'select idx, prompt, status, answer_html, businesses, client_found, client_position, match_rule, sources, finished_at from ai_check_queries where check_id = $1 and generation = $2 order by idx',
    [source.id, source.generation]
  );
  const final = FINAL.includes(check.status);
  const audit = check.lead_id ? await one('select due_at from audit_requests where check_id = $1 order by created_at desc limit 1', [check.id]) : null;
  return {
    id: check.id,
    status: check.status,
    final,
    cached: !!check.cache_of,
    checked_at: (check.cache_of ? source.finished_at || source.created_at : check.finished_at || check.created_at),
    website: check.website_domain,
    business: { name: check.business_name, service: check.service, city: check.city, state: check.state },
    needs: check.needs || [],
    site_unreadable: !!check.site_unreadable,
    queries: qs.map((q) => ({
      idx: q.idx,
      prompt: q.prompt,
      status: q.status === 'cancelled' ? 'failed' : q.status,
      ...(q.status === 'done' ? {
        businesses: (q.businesses || []).slice(0, 5).map((b) => ({
          name: b.name, domain: b.domain || null, rating: b.rating ?? null, reviews: b.reviews ?? null, position: b.position, is_client: !!b.is_client
        })),
        client: { found: !!q.client_found, position: q.client_position, rule: q.match_rule },
        answer_html: q.answer_html || ''
      } : {})
    })),
    summary: final && check.verdict ? {
      mentions_count: check.mentions_count,
      total: check.total_answers,
      best_position: check.best_position,
      verdict: check.verdict,
      verdict_label: VERDICTS[check.verdict]?.label || null,
      offer_title: VERDICTS[check.verdict]?.offer || null,
      competitors: check.competitors || [],
      sources: check.sources || []
    } : null,
    audit_requested: !!audit,
    audit_due_at: audit?.due_at || null
  };
}

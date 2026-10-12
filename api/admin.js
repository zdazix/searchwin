// Admin API (Russian UI at /admin/). Everything except login needs the session cookie.
//   POST  /api/admin/login · /api/admin/logout · GET /api/admin/me
//   GET   /api/admin/requests[?status=new|in_progress|sent|overdue]
//   GET   /api/admin/requests/:id · PATCH /api/admin/requests/:id · GET /api/admin/requests/:id/export
//   GET   /api/admin/checks · GET /api/admin/checks/:id · POST /api/admin/test-check
//   GET   /api/admin/events · GET|PUT /api/admin/settings

import { json, error, readJson, clientIp, ipHash, segments, background, isUuid } from './_lib/http.js';
import { query, one, num } from './_lib/db.js';
import { DEFAULT_SETTINGS, mergeSettings, validateSettings, env, VERDICTS } from './_lib/config.js';
import { passwordOk, sessionCookie, clearCookie, isAdmin } from './_lib/admin/auth.js';
import { normalizeWebsite, normalizeService, parseCityState } from './_lib/ai-check/normalize.js';
import { createCheck, runParse, resetSettingsCache } from './_lib/ai-check/pipeline.js';
import { spentTodayUsd, dailyBudgetUsd, overBudget } from './_lib/security/limits.js';
import { logEvent } from './_lib/notify/events.js';

const PREFIX = '/api/admin';
const resultUrl = (request, checkId) => `${env('PUBLIC_BASE_URL', new URL(request.url).origin)}/ai-check/r/${checkId}`;

async function login(request) {
  const ip = clientIp(request);
  const fails = await one(
    `select count(*)::int as n from system_events where kind = 'admin_login_failed' and data->>'ip' = $1 and created_at > now() - interval '15 minutes'`,
    [ipHash(ip)]
  );
  if ((fails?.n || 0) >= 10) return error(429, 'rate_limited', 'Слишком много попыток. Подождите 15 минут.');
  const body = await readJson(request);
  if (!passwordOk(body.password)) {
    await logEvent('warn', 'admin_login_failed', 'Неверный пароль админки', { data: { ip: ipHash(ip) } });
    return error(401, 'wrong_password', 'Неверный пароль');
  }
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(request) });
}

const REQUEST_LIST_SQL = `
  select a.id, a.created_at, a.status, a.due_at, a.sent_at, a.taken_at, (a.status <> 'sent' and a.due_at < now()) as overdue,
         l.email, c.id as check_id, c.website_domain, c.business_name, c.service, c.city, c.state, c.verdict,
         c.mentions_count, c.total_answers, c.is_test
    from audit_requests a join leads l on l.id = a.lead_id join ai_checks c on c.id = a.check_id`;

async function listRequests(request) {
  const status = new URL(request.url).searchParams.get('status');
  let where = '', params = [];
  if (status === 'overdue') where = `where a.status <> 'sent' and a.due_at < now()`;
  else if (['new', 'in_progress', 'sent'].includes(status)) { where = 'where a.status = $1'; params = [status]; }
  const rows = await query(`${REQUEST_LIST_SQL} ${where} order by (a.status = 'sent'), a.due_at asc limit 500`, params);
  const counts = await one(`select
      count(*) filter (where status = 'new')::int as new, count(*) filter (where status = 'in_progress')::int as in_progress,
      count(*) filter (where status = 'sent')::int as sent, count(*) filter (where status <> 'sent' and due_at < now())::int as overdue
    from audit_requests`);
  return json({ requests: rows, counts });
}

async function checkCard(request, checkId) {
  const check = await one('select * from ai_checks where id = $1', [checkId]);
  if (!check) return null;
  const sourceId = check.cache_of || check.id;
  const source = check.cache_of ? await one('select * from ai_checks where id = $1', [sourceId]) : check;
  const queries = await query(
    `select id, generation, idx, prompt, status, attempts, model, answer_html, businesses, client_found, client_position, match_rule,
            sources, fan_out_queries, check_url, answered_at, cost_usd, duration_ms, error, created_at, started_at, finished_at
       from ai_check_queries where check_id = $1 order by generation desc, idx`,
    [sourceId]
  );
  const { ip_hash, user_agent, ...safe } = check;
  return {
    ...safe,
    cost_usd: num(check.cost_usd),
    parse_cost_usd: num(check.parse_cost_usd),
    verdict_label: VERDICTS[check.verdict]?.label || null,
    total_ms: check.finished_at ? new Date(check.finished_at) - new Date(check.created_at) : null,
    source_generation: source.generation,
    result_url: resultUrl(request, check.id),
    queries: queries.map((q) => ({ ...q, cost_usd: num(q.cost_usd), current: q.generation === source.generation }))
  };
}

async function getRequest(request, id) {
  const req = await one('select * from audit_requests where id = $1', [id]);
  if (!req) return null;
  const lead = await one('select * from leads where id = $1', [req.lead_id]);
  const { ip_hash, user_agent, ...leadSafe } = lead || {};
  return { request: { ...req, overdue: req.status !== 'sent' && new Date(req.due_at) < new Date() }, lead: leadSafe, check: await checkCard(request, req.check_id) };
}

async function patchRequest(request, id) {
  const body = await readJson(request);
  const sets = [], params = [id];
  if (body.status !== undefined) {
    if (!['new', 'in_progress', 'sent'].includes(body.status)) return error(400, 'bad_status', 'Статус: new, in_progress или sent');
    params.push(body.status); sets.push(`status = $${params.length}`);
    if (body.status === 'in_progress') sets.push('taken_at = coalesce(taken_at, now())');
    if (body.status === 'sent') sets.push('sent_at = now()');
    if (body.status === 'new') sets.push('taken_at = null, sent_at = null');
  }
  for (const k of ['notes', 'extra_info']) {
    if (body[k] !== undefined) { params.push(String(body[k] || '').slice(0, 20000)); sets.push(`${k} = $${params.length}`); }
  }
  if (!sets.length) return error(400, 'nothing', 'Нечего сохранять');
  const row = await one(`update audit_requests set ${sets.join(', ')} where id = $1 returning *`, params);
  return row ? json({ ok: true, request: row }) : error(404, 'not_found', 'Заявка не найдена');
}

async function listChecks() {
  const rows = await query(`
    select c.id, c.created_at, c.finished_at, c.status, c.website_domain, c.business_name, c.service, c.city, c.state, c.verdict,
           c.mentions_count, c.total_answers, c.parse_ms, c.cost_usd, c.error, c.is_test, c.cache_of, c.generation, c.lead_id,
           (select json_agg(json_build_object('idx', q.idx, 'status', q.status, 'ms', q.duration_ms, 'error', q.error) order by q.idx)
              from ai_check_queries q where q.check_id = coalesce(c.cache_of, c.id)
               and q.generation = (select generation from ai_checks s where s.id = coalesce(c.cache_of, c.id))) as queries
      from ai_checks c order by c.created_at desc limit 150`);
  const timing = await one(`
    select percentile_cont(0.5) within group (order by extract(epoch from (finished_at - created_at)))::float as median_s,
           count(*)::int as n
      from (select finished_at, created_at from ai_checks
             where cache_of is null and status in ('done', 'partial') and generation = 1 and finished_at is not null
             order by created_at desc limit 50) t`);
  return json({
    checks: rows.map((r) => ({ ...r, cost_usd: num(r.cost_usd), total_ms: r.finished_at ? new Date(r.finished_at) - new Date(r.created_at) : null })),
    stats: { median_total_s: timing?.median_s ?? null, sample: timing?.n || 0, spent_today_usd: await spentTodayUsd(), budget_usd: dailyBudgetUsd() }
  });
}

async function testCheck(request) {
  const body = await readJson(request);
  const site = normalizeWebsite(body.website);
  if (!site.ok) return error(400, 'invalid_url', 'Введите адрес сайта, например yourbusiness.com');
  const manual = {};
  if (typeof body.service === 'string' && body.service.trim()) manual.service = normalizeService(body.service);
  if (typeof body.city_state === 'string' && body.city_state.trim()) {
    const cs = parseCityState(body.city_state);
    if (!cs) return error(400, 'city_state', 'Город и штат, например Austin, TX');
    Object.assign(manual, cs);
  }
  if (await overBudget()) return error(503, 'busy', 'Дневной бюджет API исчерпан');
  const id = await createCheck({
    domain: site.domain, inputRaw: String(body.website).slice(0, 500), ipHash: ipHash(clientIp(request)),
    userAgent: 'admin test', attribution: {}, isTest: true
  });
  background(runParse(id, { origin: new URL(request.url).origin, manual }));
  return json({ check_id: id, result_url: resultUrl(request, id) }, 201);
}

async function settings(request, method) {
  const row = await one(`select value, updated_at from app_settings where key = 'ai_check'`);
  if (method === 'GET') return json({ overrides: row?.value || {}, effective: mergeSettings(row?.value), defaults: DEFAULT_SETTINGS, updated_at: row?.updated_at || null });
  const body = await readJson(request, 200000);
  const value = body.overrides;
  const problems = validateSettings(value);
  if (problems.length) return error(400, 'invalid', problems.join('; '));
  await query(
    `insert into app_settings (key, value, updated_at) values ('ai_check', $1::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify(value)]
  );
  resetSettingsCache();
  await logEvent('info', 'settings_changed', 'Настройки проверки изменены в админке', { data: { keys: Object.keys(value) } });
  return json({ ok: true, effective: mergeSettings(value) });
}

async function handle(request, method) {
  try {
    const segs = segments(request, PREFIX);
    const [a, b, c] = segs;
    if (method === 'POST' && a === 'login') return await login(request);
    if (method === 'POST' && a === 'logout') return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
    if (!isAdmin(request)) return error(401, 'unauthorized', 'Нужно войти');
    if (method === 'GET' && a === 'me') return json({ ok: true });
    if (a === 'requests') {
      if (method === 'GET' && !b) return await listRequests(request);
      if (!isUuid(b)) return error(404, 'not_found', 'Заявка не найдена');
      if (method === 'GET' && !c) {
        const card = await getRequest(request, b);
        return card ? json(card) : error(404, 'not_found', 'Заявка не найдена');
      }
      if (method === 'GET' && c === 'export') {
        const card = await getRequest(request, b);
        if (!card) return error(404, 'not_found', 'Заявка не найдена');
        const name = `audit-${(card.check?.website_domain || 'request').replace(/[^a-z0-9.-]/gi, '')}-${b.slice(0, 8)}.json`;
        return new Response(JSON.stringify(card, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
      }
      if (method === 'PATCH' && !c) return await patchRequest(request, b);
    }
    if (a === 'checks' && method === 'GET') {
      if (!b) return await listChecks();
      if (!isUuid(b)) return error(404, 'not_found', 'Проверка не найдена');
      const card = await checkCard(request, b);
      return card ? json({ check: card }) : error(404, 'not_found', 'Проверка не найдена');
    }
    if (a === 'test-check' && method === 'POST') return await testCheck(request);
    if (a === 'events' && method === 'GET') {
      return json({ events: await query('select id, created_at, level, kind, check_id, message, data from system_events order by created_at desc limit 300') });
    }
    if (a === 'settings' && (method === 'GET' || method === 'PUT')) return await settings(request, method);
    return error(404, 'not_found', 'Не найдено');
  } catch (err) {
    if (err.status === 400 || err.status === 413) return error(err.status, 'bad_request', err.message);
    console.error('[admin]', err);
    return error(500, 'server_error', 'Ошибка сервера: ' + err.message);
  }
}

export const GET = (r) => handle(r, 'GET');
export const POST = (r) => handle(r, 'POST');
export const PATCH = (r) => handle(r, 'PATCH');
export const PUT = (r) => handle(r, 'PUT');

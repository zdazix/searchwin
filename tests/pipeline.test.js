// End-to-end through the API handlers on an in-memory Postgres (PGlite).
// DataForSEO is replaced at the fetch level by the real recorded responses; MX lookups are faked.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { setDb, query, one } from '../api/_lib/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

Object.assign(process.env, {
  AI_CHECK_SKIP_TURNSTILE: '1', DATAFORSEO_LOGIN: 'test', DATAFORSEO_PASSWORD: 'good', IP_HASH_SALT: 't',
  AI_CHECK_IP_DAILY_LIMIT: '5', AI_CHECK_DAILY_BUDGET_USD: '20'
});
delete process.env.INTERNAL_JOB_SECRET; // queries run in-process instead of a separate worker call

const fixtures = fs.readdirSync(path.join(here, 'fixtures', 'dataforseo')).map((f) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'dataforseo', f), 'utf8')));
let dfsCalls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('https://api.dataforseo.com/')) return realFetch(input, init);
  dfsCalls++;
  const auth = Buffer.from(String(init.headers.authorization).replace('Basic ', ''), 'base64').toString();
  if (auth !== 'test:good') return new Response(JSON.stringify({ status_code: 40100, status_message: 'You are not authorized to access this resource.' }), { status: 401 });
  const [{ keyword }] = JSON.parse(init.body);
  const fx = fixtures.find((f) => f._request.keyword.includes('Austin'));
  return new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: 20000, cost: 0.004, result: [fx.tasks[0].result[0]] }] }));
};
dns.promises.resolveMx = async (d) => { if (d.endsWith('.invalid')) throw Object.assign(new Error('x'), { code: 'ENOTFOUND' }); return [{ exchange: 'mx.' + d, priority: 1 }]; };

let api;
before(async () => {
  const pg = new PGlite();
  for (const f of fs.readdirSync(path.join(root, 'db', 'migrations')).sort()) await pg.exec(fs.readFileSync(path.join(root, 'db', 'migrations', f), 'utf8'));
  setDb({ query: async (t, p = []) => (await pg.query(t, p)).rows });
  await query(`insert into site_cache (domain, parse) values ('ironcladtexas.com', $1::jsonb), ('saas-demo.com', $2::jsonb)`, [
    JSON.stringify({ ok: true, data: { name: 'Ironclad Plumbing', service: 'plumber', city: 'Austin', state: 'TX', country: 'US', is_local_business: true, confidence: 0.9 } }),
    JSON.stringify({ ok: true, data: { name: 'Demo', service: 'crm software', city: null, state: null, country: 'US', is_local_business: false, confidence: 0.9 } })
  ]);
  api = await import('../api/ai-check.js');
});

const req = (method, p, body, ip = '1.1.1.1') => new Request(`http://localhost/api/ai-check${p}`, {
  method, headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: body ? JSON.stringify(body) : undefined
});
const call = async (method, p, body, ip) => { const r = await api[method](req(method, p, body, ip)); return { status: r.status, body: await r.json() }; };
async function waitFinal(id, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    const r = await call('GET', `/${id}`);
    if (r.body.final || r.body.status === 'needs_input' || Date.now() > end) return r.body;
    await new Promise((res) => setTimeout(res, 50));
  }
}

test('start → three real answers → summary → audit request saved, no email sent', async () => {
  const before = dfsCalls;
  const s = await call('POST', '', { website: 'https://www.ironcladtexas.com/', attribution: { utm_source: 'meta', fbclid: 'abc' } }, '2.2.2.2');
  assert.equal(s.status, 201);
  const v = await waitFinal(s.body.check_id);
  assert.equal(v.status, 'done');
  assert.equal(dfsCalls - before, 3);
  assert.equal(v.queries.length, 3);
  assert.ok(v.queries.every((q) => q.status === 'done' && q.client.found && q.client.position === 3 && q.answer_html.includes('<')));
  assert.equal(v.summary.verdict, 'not_first');
  assert.equal(v.summary.offer_title, 'Find out how to become the first name');
  assert.ok(!JSON.stringify(v).includes('ip_hash') && !JSON.stringify(v).includes('raw_response'));

  const bad = await call('POST', `/${v.id}/audit`, { email: 'nope@x.invalid' });
  assert.equal(bad.status, 400);
  const ok = await call('POST', `/${v.id}/audit`, { email: ' Owner@IroncladTexas.com ' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.event_id.startsWith('lead_'));
  const ar = await one(`select a.*, l.email, l.utm_source, l.fbclid from audit_requests a join leads l on l.id = a.lead_id where a.check_id = $1`, [v.id]);
  assert.equal(ar.status, 'new');
  assert.equal(ar.email, 'owner@ironcladtexas.com');
  assert.equal(ar.utm_source, 'meta');
  assert.ok(Math.abs(new Date(ar.due_at) - Date.now() - 48 * 3600e3) < 60e3);
  const again = await call('POST', `/${v.id}/audit`, { email: 'owner@ironcladtexas.com' });
  assert.equal(again.body.new, false);
});

test('the same site again within 7 days comes from the cache without DataForSEO', async () => {
  const before = dfsCalls;
  const s = await call('POST', '', { website: 'ironcladtexas.com' }, '3.3.3.3');
  assert.equal(s.body.cached, true);
  const v = await waitFinal(s.body.check_id);
  assert.equal(v.status, 'done');
  assert.equal(v.cached, true);
  assert.equal(v.queries.length, 3);
  assert.equal(dfsCalls, before);
});

test('the sixth check from one IP in a day is refused with a clear message', async () => {
  for (let i = 1; i <= 5; i++) assert.equal((await call('POST', '', { website: `limit-${i}.example.com` }, '4.4.4.4')).status, 201);
  const sixth = await call('POST', '', { website: 'limit-6.example.com' }, '4.4.4.4');
  assert.equal(sixth.status, 429);
  assert.match(sixth.body.message, /limit/);
});

test('a non-local business gets the message and no queries', async () => {
  const before = dfsCalls;
  const s = await call('POST', '', { website: 'saas-demo.com' }, '5.5.5.5');
  const v = await waitFinal(s.body.check_id);
  assert.equal(v.status, 'not_local');
  assert.equal(v.queries.length, 0);
  assert.equal(dfsCalls, before);
});

test('a broken DataForSEO key fails the check visibly and logs it for the admin', async () => {
  process.env.DATAFORSEO_PASSWORD = 'broken';
  try {
    const s = await call('POST', '', { website: 'ironclad-broken.example.com', manual: { name: 'Ironclad Plumbing', service: 'plumber', city_state: 'Austin, TX' } }, '6.6.6.6');
    const v = await waitFinal(s.body.check_id);
    assert.equal(v.status, 'failed');
    assert.ok(v.queries.every((q) => q.status === 'failed'));
    const ev = await query(`select kind, message from system_events where check_id = $1 order by id`, [v.id]);
    assert.ok(ev.some((e) => e.kind === 'dataforseo_auth'));
    assert.ok(ev.some((e) => e.kind === 'check_failed'));
  } finally {
    process.env.DATAFORSEO_PASSWORD = 'good';
  }
});

test('Edit restarts the queries and counts toward the limit', async () => {
  const s = await call('POST', '', { website: 'ironcladtexas.com', manual: { service: 'water heater repair' } }, '7.7.7.7');
  assert.equal(s.body.cached, false);
  await waitFinal(s.body.check_id);
  const e = await call('PATCH', `/${s.body.check_id}`, { service: 'Best Drain Cleaning' }, '7.7.7.7');
  assert.equal(e.status, 200);
  const v = await waitFinal(s.body.check_id);
  assert.equal(v.business.service, 'drain cleaning');
  assert.ok(v.queries.every((q) => q.prompt.includes('drain cleaning')));
  const runs = await one(`select count(*)::int as n from ai_check_runs where check_id = $1`, [s.body.check_id]);
  assert.equal(runs.n, 2);
});

test('a dead worker does not leave the page waiting forever', async () => {
  const id = crypto.randomUUID();
  await query(`insert into ai_checks (id, status, input_raw, website_domain, business_name, service, city, state) values ($1, 'running', 'x.com', 'x.com', 'X', 'plumber', 'Austin', 'TX')`, [id]);
  await query(`insert into ai_check_queries (id, check_id, generation, idx, prompt, status, started_at) values ($1, $2, 1, 1, 'p', 'running', now() - interval '10 minutes')`, [crypto.randomUUID(), id]);
  const v = await waitFinal(id, 1000);
  assert.equal(v.status, 'failed');
});

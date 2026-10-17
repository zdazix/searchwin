// The three routes end to end, the way the page calls them, on an in-memory Postgres (PGlite).
// DataForSEO is replaced at the fetch level by real recorded responses; the site reader by the
// facts Gemini would return (no network here); MX lookups are faked.

import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { setDb, one, query } from '../api/_lib/db.js';
import { deps } from '../api/_lib/ai-check/deps.js';
import { issueTicket, readTicket } from '../api/_lib/ai-check/ticket.js';
import { chatgptLive } from '../api/_lib/ai-check/dataforseo.js';
import { summarize } from '../assets/js/ai-check-core.js';
import * as parseRoute from '../api/ai-check/parse.js';
import * as askRoute from '../api/ai-check/ask.js';
import * as auditRoute from '../api/ai-check/audit.js';
import * as configRoute from '../api/ai-check/config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

Object.assign(process.env, { AI_CHECK_SKIP_TURNSTILE: '1', DATAFORSEO_LOGIN: 'test', DATAFORSEO_PASSWORD: 'good' });
delete process.env.TURNSTILE_SECRET_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;

const fixtures = fs.readdirSync(path.join(here, 'fixtures', 'dataforseo')).map((f) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'dataforseo', f), 'utf8')));
let dfsCalls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('https://api.dataforseo.com/')) return realFetch(input, init);
  const [{ keyword }] = JSON.parse(init.body);
  dfsCalls.push(keyword);
  const auth = Buffer.from(String(init.headers.authorization).replace('Basic ', ''), 'base64').toString();
  if (auth !== 'test:good') return new Response(JSON.stringify({ status_code: 40100, status_message: 'You are not authorized to access this resource.' }), { status: 401 });
  const fx = fixtures.find((f) => f._request.keyword.includes('Austin'));
  return new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: 20000, cost: 0.004, result: [fx.tasks[0].result[0]] }] }));
};
dns.promises.resolveMx = async (d) => { if (d.endsWith('.invalid')) throw Object.assign(new Error('x'), { code: 'ENOTFOUND' }); return [{ exchange: 'mx.' + d, priority: 1 }]; };

const SITES = {
  'ironcladtexas.com': { name: 'Ironclad Plumbing', service: 'plumber', city: 'Austin', state: 'TX' },
  'nocity.com': { name: 'Roam Plumbing', service: 'plumber', city: null, state: null },
  'saas-demo.com': { name: 'Demo', service: 'crm software', city: null, state: null, is_local_business: false },
  'maple.ca': { name: 'Maple Plumbing', service: 'plumber', city: 'Toronto', state: null, country: 'CA' }
};
let siteReads = [];
deps.parseSite = async (domain) => {
  siteReads.push(domain);
  const d = SITES[domain];
  if (!d) return { ok: false, reason: 'unreadable', emails: [], pages: [] };
  return { ok: true, data: { country: 'US', is_local_business: true, confidence: 0.9, ...d }, emails: [], pages: [] };
};

before(async () => {
  const pg = new PGlite();
  for (const f of fs.readdirSync(path.join(root, 'db', 'migrations')).sort()) await pg.exec(fs.readFileSync(path.join(root, 'db', 'migrations', f), 'utf8'));
  setDb({ query: async (t, p = []) => (await pg.query(t, p)).rows });
});
beforeEach(() => { dfsCalls = []; siteReads = []; process.env.DATAFORSEO_PASSWORD = 'good'; });

const post = async (route, body) => {
  const r = await route.POST(new Request('http://localhost/api/ai-check/x', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.1.1.1' }, body: JSON.stringify(body)
  }));
  return { status: r.status, body: await r.json() };
};

test('parse → three real answers → totals on the page → lead saved, no email sent', async () => {
  const p = await post(parseRoute, { website: 'https://www.ironcladtexas.com/', turnstile_token: 'x' });
  assert.equal(p.status, 200);
  assert.equal(p.body.status, 'ready');
  assert.equal(p.body.website, 'ironcladtexas.com');
  assert.deepEqual(p.body.business, { name: 'Ironclad Plumbing', service: 'plumber', city: 'Austin', state: 'TX' });
  assert.deepEqual(p.body.prompts, [
    'best plumber in Austin, TX',
    'who should I call for plumber near Austin TX? I need someone reliable',
    'top rated plumber in Austin TX with good reviews'
  ]);

  const answers = await Promise.all([1, 2, 3].map((idx) => post(askRoute, { ticket: p.body.ticket, idx })));
  assert.deepEqual(dfsCalls.sort(), p.body.prompts.slice().sort());
  for (const [i, a] of answers.entries()) {
    assert.equal(a.status, 200);
    assert.equal(a.body.idx, i + 1);
    assert.equal(a.body.prompt, p.body.prompts[i]);
    assert.ok(a.body.client.found && a.body.client.position === 3);
    assert.ok(a.body.businesses.some((b) => b.is_client && b.name === 'Ironclad Plumbing'));
    assert.ok(a.body.answer_html.includes('<') && !a.body.answer_html.includes('<script'));
    assert.ok(a.body.sources.every((s) => typeof s.domain === 'string'));
  }
  const s = summarize(answers.map((a) => a.body), p.body.website);
  assert.equal(s.verdict, 'not_first');
  assert.equal(s.offer_title, 'Find out how to become the first name');

  const bad = await post(auditRoute, { email: 'nope@x.invalid', website: 'ironcladtexas.com' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'email_no_mx');
  const ok = await post(auditRoute, {
    email: ' Owner@IroncladTexas.com ', turnstile_token: 'x', website: 'ironcladtexas.com', business: p.body.business,
    result: { mentions_count: s.mentions_count, total: s.total, best_position: s.best_position, verdict: s.verdict },
    attribution: { utm_source: 'meta', utm_campaign: 'launch', fbclid: 'abc', gclid: 'g1', landing_url: 'https://searchwin.ai/ai-check/?utm_source=meta' }
  });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.event_id.startsWith('lead_'));
  assert.ok(new Date(ok.body.due_at) > new Date(Date.now() + 47 * 3600e3));
  const lead = await one('select * from leads where id = $1', [ok.body.lead_id]);
  assert.equal(lead.email, 'owner@ironcladtexas.com');
  assert.equal(lead.website, 'ironcladtexas.com');
  assert.equal(lead.business_name, 'Ironclad Plumbing');
  assert.equal(lead.mentions_count, 3);
  assert.equal(lead.total_answers, 3);
  assert.equal(lead.verdict, 'not_first');
  assert.equal(lead.utm_source, 'meta');
  assert.equal(lead.gclid, 'g1');
  assert.equal(lead.fbclid, 'abc');
  assert.ok(lead.consent_text_version);
});

test('ask refuses a forged, changed or expired ticket without calling DataForSEO', async () => {
  const t = issueTicket({ domain: 'ironcladtexas.com', name: 'Ironclad Plumbing', service: 'plumber', city: 'Austin', state: 'TX' });
  const [payload, mac] = t.split('.');
  const changed = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), s: 'anything I want' })).toString('base64url');
  for (const ticket of ['', 'abc', `${changed}.${mac}`, issueTicket({ domain: 'a.com', service: 's', city: 'c', state: 'TX' }, Date.now() - 10 * 60000)]) {
    const r = await post(askRoute, { ticket, idx: 1 });
    assert.equal(r.status, 401);
    assert.equal(r.body.error, 'expired');
  }
  assert.equal((await post(askRoute, { ticket: t, idx: 4 })).status, 400);
  assert.equal(dfsCalls.length, 0);
  assert.equal(readTicket(t).service, 'plumber');
});

test('missing city asks for it; the typed-in fields skip reading the site again', async () => {
  const p = await post(parseRoute, { website: 'nocity.com', turnstile_token: 'x' });
  assert.equal(p.body.status, 'needs_input');
  assert.deepEqual(p.body.needs, ['city_state']);
  assert.ok(!p.body.ticket);
  siteReads = [];
  const again = await post(parseRoute, { website: 'nocity.com', turnstile_token: 'x', manual: { name: 'Roam Plumbing', service: 'plumber', city_state: 'Dallas, Texas' } });
  assert.equal(again.body.status, 'ready');
  assert.deepEqual(siteReads, []);
  assert.equal(again.body.prompts[0], 'best plumber in Dallas, TX');
  const bad = await post(parseRoute, { website: 'nocity.com', turnstile_token: 'x', manual: { service: 'plumber', city_state: 'Atlantis' } });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'city_state');
});

test('unreadable site asks for all three fields; non-local and non-US sites stop', async () => {
  const u = await post(parseRoute, { website: 'unknown-site.com', turnstile_token: 'x' });
  assert.equal(u.body.status, 'needs_input');
  assert.ok(u.body.site_unreadable);
  assert.deepEqual(u.body.needs, ['name', 'service', 'city_state']);
  assert.equal((await post(parseRoute, { website: 'saas-demo.com', turnstile_token: 'x' })).body.status, 'not_local');
  assert.equal((await post(parseRoute, { website: 'maple.ca', turnstile_token: 'x' })).body.status, 'not_us');
  assert.equal((await post(parseRoute, { website: 'not a site' })).status, 400);
  assert.equal(dfsCalls.length, 0);
});

test('Turnstile is required on parse and on the audit form once a secret is set', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  try {
    const p = await post(parseRoute, { website: 'ironcladtexas.com' });
    assert.equal(p.status, 403);
    assert.equal(p.body.error, 'captcha');
    const a = await post(auditRoute, { email: 'owner@ironcladtexas.com', website: 'ironcladtexas.com' });
    assert.equal(a.status, 403);
    assert.deepEqual(siteReads, []);
  } finally {
    delete process.env.TURNSTILE_SECRET_KEY;
  }
});

test('a broken DataForSEO key fails the answer visibly and is not retried', async () => {
  process.env.DATAFORSEO_PASSWORD = 'bad';
  const t = issueTicket({ domain: 'ironcladtexas.com', name: 'Ironclad Plumbing', service: 'plumber', city: 'Austin', state: 'TX' });
  const r = await post(askRoute, { ticket: t, idx: 2 });
  assert.equal(r.status, 502);
  assert.equal(r.body.error, 'answer_failed');
  assert.equal(r.body.prompt, 'who should I call for plumber near Austin TX? I need someone reliable');
  assert.equal(dfsCalls.length, 1);
});

test('a fast failure is retried once; a slow one is not, so the function never runs out of time', async () => {
  let calls = 0;
  const failing = async () => { calls++; return new Response(JSON.stringify({ status_code: 50000, status_message: 'Internal error' }), { status: 500 }); };
  await assert.rejects(chatgptLive('q', { fetchImpl: failing, deadline: Date.now() + 140000 }), { code: 'api' });
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(chatgptLive('q', { fetchImpl: failing, deadline: Date.now() + 30000 }), { code: 'api' });
  assert.equal(calls, 1);
  calls = 0;
  const fx = fixtures[0];
  let first = true;
  const flaky = async () => {
    calls++;
    if (first) { first = false; throw new TypeError('fetch failed'); }
    return new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: 20000, cost: 0.004, result: [fx.tasks[0].result[0]] }] }));
  };
  const ok = await chatgptLive('q', { fetchImpl: flaky });
  assert.equal(ok.attempts, 2);
  assert.ok(ok.result);
});

test('config gives the page public IDs only', async () => {
  process.env.PUBLIC_META_PIXEL_ID = '123';
  process.env.DATAFORSEO_PASSWORD = 'should-not-leak';
  const body = await (await configRoute.GET()).json();
  assert.equal(body.meta_pixel_id, '123');
  assert.ok(!JSON.stringify(body).includes('should-not-leak'));
  assert.deepEqual(Object.keys(body.google_ads_labels).sort(), ['audit_requested', 'check_completed']);
  delete process.env.PUBLIC_META_PIXEL_ID;
});

test('only the leads table exists', async () => {
  const tables = (await query(`select table_name from information_schema.tables where table_schema = 'public' order by 1`)).map((r) => r.table_name);
  assert.deepEqual(tables, ['leads']);
});

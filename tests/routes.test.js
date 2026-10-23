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
import * as reportRoute from '../api/ai-check/report.js';
import * as configRoute from '../api/ai-check/config.js';
import * as consentRoute from '../api/ai-check/consent.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

Object.assign(process.env, { AI_CHECK_SKIP_TURNSTILE: '1', DATAFORSEO_LOGIN: 'test', DATAFORSEO_PASSWORD: 'good' });
delete process.env.TURNSTILE_SECRET_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;

const fixtures = fs.readdirSync(path.join(here, 'fixtures', 'dataforseo')).map((f) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'dataforseo', f), 'utf8')));
let telegramSent = [];
let telegramEdits = [];
let telegramNextId = 100;
let dfsCalls = [];
let dfsBodies = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('https://api.telegram.org/')) {
    const b = JSON.parse(init.body);
    telegramSent.push(b.text);
    if (url.endsWith('/editMessageText')) { telegramEdits.push({ id: b.message_id, text: b.text }); return new Response('{"ok":true,"result":true}'); }
    return new Response(JSON.stringify({ ok: true, result: { message_id: ++telegramNextId } }));
  }
  if (!url.startsWith('https://api.dataforseo.com/')) return realFetch(input, init);
  const [{ keyword }] = JSON.parse(init.body);
  dfsCalls.push(keyword);
  dfsBodies.push(JSON.parse(init.body)[0]);
  const auth = Buffer.from(String(init.headers.authorization).replace('Basic ', ''), 'base64').toString();
  if (auth !== 'test:good') return new Response(JSON.stringify({ status_code: 40100, status_message: 'You are not authorized to access this resource.' }), { status: 401 });
  const city = ['Berlin', 'Manchester', 'Sydney', 'Madrid'].find((c) => keyword.includes(c)) || 'Austin';
  const fx = fixtures.find((f) => f._request.keyword.includes(city));
  return new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: 20000, cost: 0.004, result: [fx.tasks[0].result[0]] }] }));
};
dns.promises.resolveMx = async (d) => { if (d.endsWith('.invalid')) throw Object.assign(new Error('x'), { code: 'ENOTFOUND' }); return [{ exchange: 'mx.' + d, priority: 1 }]; };

const SITES = {
  'ironcladtexas.com': { name: 'Ironclad Plumbing', service: 'plumber', city: 'Austin', state: 'TX' },
  'nocity.com': { name: 'Roam Plumbing', service: 'plumber', city: null, state: null },
  'saas-demo.com': { name: 'Demo', service: 'crm software', city: null, state: null, is_local_business: false },
  'maple.ca': { name: 'Maple Plumbing', service: 'plumber', city: 'Toronto', state: null, country: 'CA' },
  'moscow-demo.ru': { name: 'Moskva Santekhnika', service: 'plumber', city: 'Moscow', state: null, country: 'RU' },
  'nocountry.com': { name: 'Roam Plumbing', service: 'plumber', city: 'Dallas', state: 'TX', country: null },
  'manchester-demo.co.uk': { name: 'Nelson Plumbing & Heating Ltd', service: 'plumber', city: 'Manchester', state: null, country: 'GB' },
  'sydney-demo.com.au': { name: 'Scott Electrics', service: 'electrician', city: 'Sydney', state: 'NSW', country: 'AU' },
  'legalcar.com': {
    name: 'Legalcar Abogados', service: 'abogado de accidentes', city: 'Madrid', state: null, country: 'ES', language: 'es',
    questions: ['mejor abogado de accidentes en Madrid', '¿a quién debería llamar para un abogado de accidentes cerca de Madrid? Necesito a alguien de confianza', 'abogado de accidentes mejor valorado en Madrid con buenas reseñas']
  },
  'madrid-demo.es': {
    name: 'Abogados Ejemplo Madrid', service: 'abogado de accidentes', city: 'Madrid', state: null, country: 'ES', language: 'es',
    questions: ['mejor abogado de accidentes en Madrid', '¿a quién debería llamar para un abogado de accidentes cerca de Madrid? Necesito a alguien de confianza', 'abogado de accidentes mejor valorado en Madrid con buenas reseñas']
  },
  'berlin-demo.de': {
    name: 'Schwalm Heizung & Sanitär GmbH', service: 'klempner', city: 'Berlin', state: null, country: 'DE', language: 'de',
    questions: ['Wer ist der beste Klempner in Berlin?', 'Wen soll ich für einen Klempner in Berlin anrufen? Ich brauche jemanden Zuverlässigen', 'Bestbewertete Klempner in Berlin mit guten Bewertungen']
  }
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
beforeEach(() => { dfsCalls = []; dfsBodies = []; siteReads = []; process.env.DATAFORSEO_PASSWORD = 'good'; });

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
  assert.deepEqual(p.body.business, { name: 'Ironclad Plumbing', service: 'plumber', city: 'Austin', state: 'TX', country: 'US', language: 'en' });
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
    answers: [...answers.map((a) => a.body.saved), { ...answers[0].body.saved, answer_text: 'edited in the browser' }],
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
  // The saved answers: exactly what was asked and what came back; the edited copy is dropped.
  assert.equal(lead.answers.length, 3);
  lead.answers.forEach((x, i) => {
    assert.equal(x.idx, i + 1);
    assert.equal(x.prompt, p.body.prompts[i]);
    assert.equal(x.location_code, 2840);
    assert.equal(x.language_code, 'en');
    assert.match(x.checked_at, /^\d{4}-\d\d-\d\dT[\d:.]+Z$/);
    assert.ok(x.answer_text.length > 200 && !x.answer_text.includes('edited in the browser'));
    assert.ok(Array.isArray(x.sources) && x.sources.every((u) => /^https?:\/\//.test(u)) && new Set(x.sources).size === x.sources.length);
    assert.equal(x.sig, undefined);
  });
  assert.equal(lead.service, 'plumber');
  assert.equal(lead.city, 'Austin');
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
  const again = await post(parseRoute, { website: 'nocity.com', turnstile_token: 'x', manual: { name: 'Roam Plumbing', service: 'plumber', city_state: 'Dallas, Texas', country: 'US' } });
  assert.equal(again.body.status, 'ready');
  assert.deepEqual(siteReads, []);
  assert.equal(again.body.prompts[0], 'best plumber in Dallas, TX');
  const bad = await post(parseRoute, { website: 'nocity.com', turnstile_token: 'x', manual: { service: 'plumber', city_state: 'Atlantis', country: 'US' } });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'city_state');
});

test('unreadable site asks for all fields; non-local sites and unsupported countries stop', async () => {
  const u = await post(parseRoute, { website: 'unknown-site.com', turnstile_token: 'x' });
  assert.equal(u.body.status, 'needs_input');
  assert.ok(u.body.site_unreadable);
  assert.deepEqual(u.body.needs, ['name', 'service', 'city_state', 'country']);
  assert.equal((await post(parseRoute, { website: 'saas-demo.com', turnstile_token: 'x' })).body.status, 'not_local');
  assert.equal((await post(parseRoute, { website: 'moscow-demo.ru', turnstile_token: 'x' })).body.status, 'unsupported_country');
  const typed = await post(parseRoute, { website: 'nocountry.com', turnstile_token: 'x' });
  assert.equal(typed.body.status, 'needs_input');
  assert.deepEqual(typed.body.needs, ['country']);
  assert.equal((await post(parseRoute, { website: 'not a site' })).status, 400);
  assert.equal(dfsCalls.length, 0);
});

test('a Canadian business needs no state; the question names only the city', async () => {
  const p = await post(parseRoute, { website: 'maple.ca', turnstile_token: 'x' });
  assert.equal(p.body.status, 'ready');
  assert.equal(p.body.business.country, 'CA');
  assert.equal(p.body.prompts[0], 'best plumber in Toronto');
  assert.equal(p.body.prompts[1], 'who should I call for plumber near Toronto? I need someone reliable');
});

test('UK: the question names the city, DataForSEO gets the UK location; the client is found without a local-business block', async () => {
  const p = await post(parseRoute, { website: 'manchester-demo.co.uk', turnstile_token: 'x' });
  assert.equal(p.body.status, 'ready');
  assert.equal(p.body.prompts[0], 'best plumber in Manchester');
  const a = await post(askRoute, { ticket: p.body.ticket, idx: 1 });
  assert.equal(a.status, 200);
  assert.deepEqual([dfsBodies[0].location_code, dfsBodies[0].language_code], [2826, 'en']);
  assert.equal(a.body.client.found, true);
  assert.equal(a.body.client.position, 2);
});

test('Germany: questions in German, German location and language, found by domain', async () => {
  const p = await post(parseRoute, { website: 'berlin-demo.de', turnstile_token: 'x' });
  assert.equal(p.body.status, 'ready');
  assert.equal(p.body.business.language, 'de');
  assert.equal(p.body.prompts[0], 'Wer ist der beste Klempner in Berlin?');
  const a = await post(askRoute, { ticket: p.body.ticket, idx: 1 });
  assert.equal(a.status, 200);
  assert.deepEqual([dfsBodies[0].keyword, dfsBodies[0].location_code, dfsBodies[0].language_code], ['Wer ist der beste Klempner in Berlin?', 2276, 'de']);
  assert.ok(a.body.businesses.length >= 3 && a.body.businesses[0].rating === 5);
  assert.deepEqual([a.body.saved.location_code, a.body.saved.language_code, a.body.saved.prompt], [2276, 'de', 'Wer ist der beste Klempner in Berlin?']);
});

test('Spain: questions in Spanish, Spanish location and language, found by domain with a Spanish answer', async () => {
  const p = await post(parseRoute, { website: 'legalcar.com', turnstile_token: 'x' });
  assert.equal(p.body.status, 'ready');
  assert.equal(p.body.business.language, 'es');
  assert.equal(p.body.prompts[0], 'mejor abogado de accidentes en Madrid');
  const a = await post(askRoute, { ticket: p.body.ticket, idx: 1 });
  assert.equal(a.status, 200);
  assert.deepEqual([dfsBodies[0].keyword, dfsBodies[0].location_code, dfsBodies[0].language_code], ['mejor abogado de accidentes en Madrid', 2724, 'es']);
  assert.equal(a.body.client.found, true);
  assert.equal(a.body.client.position, 1);
  assert.equal(a.body.businesses[0].name, 'Legalcar Abogados');
  assert.ok(a.body.answer_html.includes('Especialización') && !/<script|<img/.test(a.body.answer_html));
  const miss = await post(parseRoute, { website: 'madrid-demo.es', turnstile_token: 'x' });
  const b = await post(askRoute, { ticket: miss.body.ticket, idx: 1 });
  assert.equal(b.body.client.found, false);
  assert.ok(b.body.businesses.length >= 3);
});

test('Australia: city only in the question, Sydney electrician found at its position', async () => {
  const p = await post(parseRoute, { website: 'sydney-demo.com.au', turnstile_token: 'x' });
  assert.equal(p.body.prompts[0], 'best electrician in Sydney');
  const a = await post(askRoute, { ticket: p.body.ticket, idx: 1 });
  assert.equal(dfsBodies[0].location_code, 2036);
  assert.equal(a.body.client.position, 2);
});

test('the online-business popup saves website and email as an online lead, no check data', async () => {
  const r = await post(auditRoute, {
    kind: 'online', email: 'founder@saas-demo.com', turnstile_token: 'x', website: 'https://www.saas-demo.com/pricing',
    business: { name: 'should be ignored', city: 'Austin' }, result: { verdict: 'top_pick', mentions_count: 3, total: 3 }, attribution: { utm_source: 'google' }
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.kind, 'online');
  const lead = await one('select * from leads where id = $1', [r.body.lead_id]);
  assert.equal(lead.kind, 'online');
  assert.equal(lead.website, 'saas-demo.com');
  assert.equal(lead.email, 'founder@saas-demo.com');
  assert.equal(lead.business_name, null);
  assert.equal(lead.verdict, null);
  assert.equal(lead.utm_source, 'google');
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
  assert.equal(r.body.code, 'auth');
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
  assert.deepEqual(Object.keys(body.google_ads_labels).sort(), ['audit_requested', 'check_completed', 'check_started']);
  delete process.env.PUBLIC_META_PIXEL_ID;
});

test('only the leads, checks and consents tables exist', async () => {
  const tables = (await query(`select table_name from information_schema.tables where table_schema = 'public' order by 1`)).map((r) => r.table_name);
  assert.deepEqual(tables, ['checks', 'consents', 'leads']);
});

test('Telegram gets the full lead: online (website, email, all marketing data) and local (plus the answers)', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 't'; process.env.TELEGRAM_CHAT_ID = '1';
  try {
    telegramSent = [];
    const attribution = { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'brand', utm_content: 'ad1', utm_term: 'kw', gclid: 'G-1', fbclid: 'F-1', landing_url: 'https://searchwin.ai/ai-check/?utm_source=google', referrer: 'https://google.com/' };
    const on = await post(auditRoute, { kind: 'online', email: 'a@saas-demo.com', turnstile_token: 'x', website: 'saas-demo.com', attribution });
    await new Promise((r) => setTimeout(r, 50));
    const msg = telegramSent.join('\n');
    for (const piece of ['онлайн-бизнес', 'saas-demo.com', 'a@saas-demo.com', 'utm_campaign: brand', 'utm_term: kw', 'gclid: G-1', 'fbclid: F-1', 'https://searchwin.ai/ai-check/?utm_source=google', 'https://google.com/', 'ID заявки: ' + on.body.lead_id]) assert.ok(msg.includes(piece), piece);

    telegramSent = [];
    const p = await post(parseRoute, { website: 'ironcladtexas.com', turnstile_token: 'x' });
    const answers = await Promise.all([1, 2, 3].map((idx) => post(askRoute, { ticket: p.body.ticket, idx })));
    const loc = await post(auditRoute, { email: 'o@ironcladtexas.com', turnstile_token: 'x', website: 'ironcladtexas.com', business: p.body.business,
      result: { mentions_count: 3, total: 3, best_position: 3, verdict: 'not_first' }, answers: answers.map((a) => a.body.saved), attribution });
    await new Promise((r) => setTimeout(r, 50));
    const full = telegramSent.join('\n');
    for (const piece of ['Полный лид', 'Ironclad Plumbing', 'plumber', 'Austin, TX', 'Итог: 3 из 3', 'utm_source: google', 'gclid: G-1', 'Ответы ChatGPT', 'best plumber in Austin, TX', '2840 / en', 'ID заявки: ' + loc.body.lead_id]) assert.ok(full.includes(piece), piece);
    assert.ok(telegramSent.every((t) => t.length <= 4000));
  } finally { delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID; }
});

test('the Spanish page is told apart: its own consent version, and Telegram names the language', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 't'; process.env.TELEGRAM_CHAT_ID = '1';
  try {
    telegramSent = [];
    const es = await post(auditRoute, { kind: 'online', email: 'ana@tienda-demo.es', turnstile_token: 'x', website: 'tienda-demo.es', attribution: { ui_lang: 'es', landing_url: 'https://searchwin.ai/es/ai-check/' } });
    assert.equal(es.status, 200);
    await new Promise((r) => setTimeout(r, 50));
    const msg = telegramSent.join('\n');
    assert.ok(msg.includes('Язык страницы: 🇪🇸 испанская') && msg.includes('Версия согласия: 2026-10-14-es'), msg);
    telegramSent = [];
    await post(auditRoute, { kind: 'online', email: 'bob@tienda-demo.com', turnstile_token: 'x', website: 'tienda-demo.com', attribution: { ui_lang: 'fr' } });
    await new Promise((r) => setTimeout(r, 50));
    const en = telegramSent.join('\n');
    assert.ok(en.includes('Язык страницы: английская') && /Версия согласия: 2026-10-14$/m.test(en), en);
  } finally { delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID; }
});

test('a finished check without an email is saved once and reaches Telegram with the full data', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 't'; process.env.TELEGRAM_CHAT_ID = '1';
  try {
    telegramSent = [];
    const p = await post(parseRoute, { website: 'ironcladtexas.com', turnstile_token: 'x' });
    const ans = await Promise.all([1, 2, 3].map((idx) => post(askRoute, { ticket: p.body.ticket, idx })));
    const payload = {
      website: 'ironcladtexas.com', business: p.body.business, answers: ans.map((a) => a.body.saved),
      result: { mentions_count: 0, total: 3, best_position: null, verdict: 'not_recommended' },
      attribution: { utm_source: 'meta', utm_campaign: 'spring', fbclid: 'FB-9', landing_url: 'https://searchwin.ai/ai-check/' }
    };
    const r1 = await post(reportRoute, payload);
    assert.equal(r1.status, 200);
    await new Promise((r) => setTimeout(r, 50));
    const msg = telegramSent.join('\n');
    for (const piece of ['Мини-проверка пройдена', 'email не оставлен', 'ironcladtexas.com', 'Итог: 0 из 3', 'utm_campaign: spring', 'fbclid: FB-9', 'Ответы ChatGPT', 'best plumber in Austin, TX']) assert.ok(msg.includes(piece), piece);
    const row = await one('select * from checks where id = $1', [r1.body.id]);
    assert.equal(row.website, 'ironcladtexas.com');
    assert.equal(row.verdict, 'not_recommended');
    assert.equal(row.answers.length, 3);
    assert.equal(row.utm_source, 'meta');
    // The same check reported again: nothing new is stored or sent.
    telegramSent = [];
    const r2 = await post(reportRoute, payload);
    assert.equal(r2.body.duplicate, true);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(telegramSent.length, 0);
    assert.equal((await one('select count(*)::int as n from checks where website = $1', ['ironcladtexas.com'])).n, 1);
    // Forged or missing answers save and send nothing.
    const forged = await post(reportRoute, { ...payload, answers: payload.answers.map((a) => ({ ...a, answer_text: 'made up' })) });
    assert.equal(forged.status, 400);
    assert.equal((await post(reportRoute, { website: 'ironcladtexas.com' })).status, 400);
    assert.equal(telegramSent.length, 0);
  } finally { delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID; }
});

test('Telegram hears about a started check once: not for follow-ups with typed-in fields', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 't'; process.env.TELEGRAM_CHAT_ID = '1';
  try {
    const attribution = { utm_source: 'google', utm_campaign: 'brand', gclid: 'G-7', landing_url: 'https://searchwin.ai/ai-check/' };
    telegramSent = [];
    await post(parseRoute, { website: 'ironcladtexas.com', turnstile_token: 'x', attribution });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(telegramSent.length, 1);
    for (const piece of ['Запущена проверка', 'ironcladtexas.com', 'ждём ответы', 'Ironclad Plumbing', 'Austin, TX', 'utm_campaign: brand', 'gclid: G-7']) assert.ok(telegramSent[0].includes(piece), piece);

    telegramSent = [];
    await post(parseRoute, { website: 'saas-demo.com', turnstile_token: 'x', attribution });
    await post(parseRoute, { website: 'nocity.com', turnstile_token: 'x' });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(telegramSent.length, 2);
    assert.ok(telegramSent[0].includes('не местный') || telegramSent[1].includes('не местный'));
    assert.ok(telegramSent.some((t) => t.includes('прямой заход')));

    telegramSent = [];
    await post(parseRoute, { website: 'nocity.com', turnstile_token: 'x', manual: { name: 'Roam', service: 'plumber', city_state: 'Dallas, TX', country: 'US' } });
    await post(parseRoute, { website: 'ironcladtexas.com', turnstile_token: 'x', manual: { service: 'plumber', city_state: 'Austin, TX', country: 'US' } });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(telegramSent.length, 0);
  } finally { delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID; }
});

test('the cookie answer is saved without IP or user agent, and linked to the lead of the same browser', async () => {
  const vid = '3f2b8c1e-6d4a-4b7e-9a10-2c5d7e8f9a01';
  const ok = await post(consentRoute, { visitor_id: vid, choice: 'all', lang: 'es', banner_version: 'cb-test' });
  assert.equal(ok.status, 200);
  assert.equal((await post(consentRoute, { visitor_id: 'nope', choice: 'all' })).status, 400);
  assert.equal((await post(consentRoute, { visitor_id: vid, choice: 'maybe' })).status, 400);
  const lead = await post(auditRoute, { kind: 'online', email: 'z@consent-demo.com', turnstile_token: 'x', website: 'consent-demo.com', attribution: { visitor_id: vid } });
  assert.equal(lead.status, 200);
  const rows = await query('select * from consents where visitor_id = $1', [vid]);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].choice, rows[0].lang, rows[0].banner_version, rows[0].lead_id], ['all', 'es', 'cb-test', lead.body.lead_id]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['banner_version', 'choice', 'country', 'created_at', 'id', 'lang', 'lead_id', 'visitor_id']);
});

test('one visit is one Telegram message: started, then the check, then the full lead edit the same message', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 't'; process.env.TELEGRAM_CHAT_ID = '1';
  try {
    telegramSent = []; telegramEdits = [];
    const p = await post(parseRoute, { website: 'ironcladtexas.com', turnstile_token: 'x' });
    assert.equal(p.body.status, 'ready');
    assert.ok(p.body.tg);
    assert.equal(telegramSent.length, 1);
    assert.ok(telegramSent[0].includes('Запущена проверка'));
    const firstId = telegramNextId;

    const answers = await Promise.all([1, 2, 3].map((idx) => post(askRoute, { ticket: p.body.ticket, idx })));
    const result = { mentions_count: 3, total: 3, best_position: 3, verdict: 'not_first' };
    const rep = await post(reportRoute, { tg: p.body.tg, website: 'ironcladtexas.com', business: p.body.business, result, answers: answers.map((a) => a.body.saved) });
    assert.equal(rep.status, 200);
    assert.ok(rep.body.tg);
    assert.equal(telegramEdits.length, 1);
    assert.equal(telegramEdits[0].id, firstId);
    assert.ok(telegramEdits[0].text.includes('Мини-проверка пройдена') && !telegramEdits[0].text.includes('Запущена'));

    const sentBefore = telegramSent.length;
    const lead = await post(auditRoute, { tg: rep.body.tg, email: 'one@ironcladtexas.com', turnstile_token: 'x', website: 'ironcladtexas.com', business: p.body.business, result, answers: answers.map((a) => a.body.saved) });
    assert.equal(lead.status, 200);
    assert.equal(telegramEdits.length, 2);
    assert.equal(telegramEdits[1].id, firstId);
    assert.ok(telegramEdits[1].text.includes('Полный лид') && telegramEdits[1].text.includes('one@ironcladtexas.com'));
    assert.ok(telegramEdits[1].text.includes('уже отправлены отдельными'));
    assert.equal(telegramSent.length - sentBefore, 1, 'only the edit, no new message and the answers are not posted twice');
  } finally { delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID; }
});

test('without a valid token a stage sends its own message (forged, expired or missing token never edits)', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 't'; process.env.TELEGRAM_CHAT_ID = '1';
  try {
    telegramSent = []; telegramEdits = [];
    await post(auditRoute, { kind: 'online', tg: 'forged.token', email: 'f@saas-demo.com', turnstile_token: 'x', website: 'saas-demo.com' });
    assert.equal(telegramEdits.length, 0);
    assert.equal(telegramSent.length, 1);
    // A follow-up with typed-in fields edits the start message of the same visit
    const p = await post(parseRoute, { website: 'nocity.com', turnstile_token: 'x' });
    assert.equal(p.body.status, 'needs_input');
    const f = await post(parseRoute, { website: 'nocity.com', turnstile_token: 'x', tg: p.body.tg, manual: { service: 'plumber', city_state: 'Austin, TX', country: 'US' } });
    assert.equal(f.body.status, 'ready');
    assert.equal(telegramEdits.length, 1);
    assert.ok(telegramEdits[0].text.includes('ждём ответы'));
  } finally { delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID; }
});

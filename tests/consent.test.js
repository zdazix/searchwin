import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consentRequired, GET } from '../api/ai-check/config.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('the cookie banner is asked for in the EU, EEA, UK and Switzerland, and wherever the country is unknown', () => {
  for (const c of ['ES', 'DE', 'FR', 'IT', 'PL', 'SE', 'NO', 'IS', 'LI', 'GB', 'CH', 'es', ' de ']) assert.equal(consentRequired(c, 'eu'), true, c);
  for (const c of ['US', 'CA', 'AU', 'MX', 'BR', 'IN']) assert.equal(consentRequired(c, 'eu'), false, c);
  for (const c of [undefined, null, '', '  ']) assert.equal(consentRequired(c, 'eu'), true, String(c));
});

test('PUBLIC_CONSENT_BANNER can ask everyone or nobody', () => {
  assert.equal(consentRequired('US', 'all'), true);
  assert.equal(consentRequired('ES', 'off'), false);
  assert.equal(consentRequired(undefined, 'off'), false);
});

test('config tells the page whether to ask, from the country Vercel reports, and is not shared-cached', async () => {
  const ask = async (country) => {
    const headers = country ? { 'x-vercel-ip-country': country } : {};
    const r = await GET(new Request('http://localhost/api/ai-check/config', { headers }));
    return { body: await r.json(), cache: r.headers.get('cache-control') };
  };
  const es = await ask('ES'), us = await ask('US'), none = await ask(null);
  assert.equal(es.body.gtm_id, 'GTM-N9FM3HSM');
  assert.equal(es.body.consent_required, true);
  assert.equal(us.body.consent_required, false);
  assert.equal(none.body.consent_required, true);
  assert.match(es.cache, /^private\b/);
  assert.equal((await GET()).status, 200);
});

test('every check page has the "cookie settings" link, in its own language', () => {
  for (const f of ['ai-check/index.html', 'ai-check/thank-you/index.html']) assert.match(read(f), />Cookie settings<\/button>/, f);
  for (const f of ['es/ai-check/index.html', 'es/ai-check/thank-you/index.html']) assert.match(read(f), />Configuración de cookies<\/button>/, f);
});

test('the tracking script keeps tags and tracking cookies behind the answer', () => {
  const js = read('assets/js/ai-check-tracking.js');
  // Tags are only started from startTags(), which runs after consent or when none is needed.
  assert.equal((js.match(/fbevents\.js/g) || []).length, 1);
  assert.equal((js.match(/googletagmanager\.com\/gtag\/js/g) || []).length, 1);
  assert.ok(js.indexOf("gtag('consent', 'default'") < js.indexOf('googletagmanager.com/gtag/js'));
  assert.ok(js.includes('ad_user_data') && js.includes('ad_personalization'));
  assert.ok(!/^\s*setCookie\('sw_attr'/m.test(js.split('function persistAttr')[0]), 'sw_attr is not written at load');
});

test('the privacy draft explains the banner and the choice', () => {
  const p = read('privacy/index.html');
  for (const piece of ['only after you accept', 'sw_consent', 'Cookie settings', 'rejecting removes']) assert.ok(p.includes(piece), piece);
});

test('Google Tag Manager is pasted as Google gives it, with consent denied first, on every check page', () => {
  for (const f of ['ai-check/index.html', 'ai-check/thank-you/index.html', 'es/ai-check/index.html', 'es/ai-check/thank-you/index.html']) {
    const h = read(f);
    const head = h.slice(0, h.indexOf('</head>'));
    assert.ok(head.indexOf("gtag('consent','default'") > 0 && head.indexOf("gtag('consent','default'") < head.indexOf('googletagmanager.com/gtm.js'), f);
    assert.ok(head.includes("'dataLayer','GTM-N9FM3HSM'"), f);
    assert.match(h, /<body[^>]*>\s*<!-- Google Tag Manager \(noscript\) -->\s*<noscript><iframe src="https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-N9FM3HSM"/, f);
    assert.ok(head.includes("ad_user_data:'denied'") && head.includes("analytics_storage:'denied'"), f);
  }
});

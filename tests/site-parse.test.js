import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFacts, hasLocation, factsForModel } from '../api/_lib/ai-check/extract.js';
import { parseSite, missingFields } from '../api/_lib/ai-check/site-parse.js';
import { SafeFetchError } from '../api/_lib/security/safe-fetch.js';

const HOME = `<!doctype html><html><head><title>Bright Line Plumbing | Austin Plumber</title>
<meta name="description" content="Licensed plumbers serving Austin, TX since 2009.">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber","name":"Bright Line Plumbing LLC","telephone":"(512) 555-0142",
"address":{"@type":"PostalAddress","streetAddress":"100 Congress Ave","addressLocality":"Austin","addressRegion":"TX","postalCode":"78701","addressCountry":"US"}}</script>
<script>var secret = "do-not-read";</script></head>
<body><nav><a href="/contact-us">Contact</a> <a href="/about">About</a></nav>
<h1>Emergency plumber in Austin</h1><p>Call <a href="tel:+15125550142">(512) 555-0142</a> or email <a href="mailto:hello@brightline.com">hello@brightline.com</a></p>
<footer>Bright Line Plumbing · 100 Congress Ave, Austin, TX 78701 · logo@2x.png</footer></body></html>`;

test('facts from a typical local business home page', () => {
  const f = extractFacts(HOME, 'https://brightline.com/');
  assert.equal(f.title, 'Bright Line Plumbing | Austin Plumber');
  assert.equal(f.description, 'Licensed plumbers serving Austin, TX since 2009.');
  assert.equal(f.jsonld[0].name, 'Bright Line Plumbing LLC');
  assert.equal(f.jsonld[0].address.city, 'Austin');
  assert.deepEqual(f.emails, ['hello@brightline.com']);
  assert.ok(f.phones.includes('+15125550142') || f.phones.includes('5125550142'));
  assert.equal(f.addresses[0].state, 'TX');
  assert.equal(f.contact_link, 'https://brightline.com/contact-us');
  assert.ok(!f.text.includes('do-not-read'));
  assert.ok(hasLocation(f));
});

test('a page without an address is detected', () => {
  const f = extractFacts('<title>Mobile Dog Grooming</title><p>We come to you!</p>', 'https://groom.example/');
  assert.equal(hasLocation(f), false);
});

test('model input stays small', () => {
  const f = extractFacts(HOME + '<p>' + 'word '.repeat(5000) + '</p>', 'https://brightline.com/');
  const json = JSON.stringify(factsForModel('brightline.com', [f]));
  assert.ok(json.length < 9000, String(json.length));
});

function fetcherFrom(pages) {
  return async (url) => {
    if (!(url in pages)) throw new SafeFetchError('http_error', 'HTTP 404', { status: 404 });
    return { url, html: pages[url], status: 200 };
  };
}

test('home page without an address: the contact page is read too', async () => {
  const seen = [];
  const fetcher = async (url) => { seen.push(url); return fetcherFrom({
    'https://groom.example/': '<title>Pawfect Mobile Grooming</title><a href="/contact">Contact</a><p>Mobile dog grooming that comes to your driveway.</p>',
    'https://groom.example/contact': '<p>Serving Plano, TX 75024 and nearby. Call 972-555-0101.</p>'
  })(url); };
  const extractor = async (facts) => {
    assert.equal(facts.pages.length, 2);
    return { data: { name: 'Pawfect Mobile Grooming', service: 'Best Mobile Dog Grooming', city: 'plano', state: 'Texas', country: 'US', is_local_business: true, confidence: 0.8 }, cost_usd: 0.0003, model: 'm' };
  };
  const r = await parseSite('groom.example', { fetcher, extractor });
  assert.equal(r.ok, true);
  assert.deepEqual(seen, ['https://groom.example/', 'https://groom.example/contact']);
  assert.deepEqual([r.data.service, r.data.city, r.data.state], ['mobile dog grooming', 'Plano', 'TX']);
  assert.deepEqual(missingFields(r), []);
});

test('unreadable site asks for all fields', async () => {
  const fetcher = async () => { throw new SafeFetchError('network', 'ECONNREFUSED'); };
  const r = await parseSite('down.example', { fetcher, extractor: async () => assert.fail('no model call') });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unreadable');
  assert.deepEqual(missingFields(r), ['name', 'service', 'city_state']);
});

test('missing city or service is reported field by field', () => {
  assert.deepEqual(missingFields({ ok: true, data: { service: 'plumber', city: null, state: null } }), ['city_state']);
  assert.deepEqual(missingFields({ ok: true, data: { service: null, city: 'Austin', state: 'TX' } }), ['service']);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWebsite, normalizeService, normalizeState, parseCityState, normalizeName, renderPrompt } from '../api/_lib/ai-check/normalize.js';
import { DEFAULT_SETTINGS } from '../api/_lib/config.js';

test('website in any form becomes a bare domain', () => {
  for (const input of ['site.com', 'www.site.com', 'https://site.com/page', 'HTTP://WWW.Site.com:443/a?b=c', ' site.com/ ', 'site.com.']) {
    assert.equal(normalizeWebsite(input).domain, 'site.com', input);
  }
  assert.equal(normalizeWebsite('shop.brightline-plumbing.co.uk').domain, 'shop.brightline-plumbing.co.uk');
});

test('things that are not a website are rejected', () => {
  for (const input of ['', 'plumber', 'bob@site.com', 'my site.com', 'http://127.0.0.1', 'localhost', 'http://[::1]/', 'ftp://site.com',
    'site.localhost', 'javascript:alert(1)', 'http://user:pw@site.com', 'site.c', '-bad-.com']) {
    assert.equal(normalizeWebsite(input).ok, false, input);
  }
});

test('service is lower case without best/top', () => {
  assert.equal(normalizeService('Best Emergency Plumber'), 'emergency plumber');
  assert.equal(normalizeService('Top Rated  Roof Repair.'), 'roof repair');
  assert.equal(normalizeService('top HVAC'), 'hvac');
});

test('states: codes, names and DC; nothing else', () => {
  assert.equal(normalizeState('tx'), 'TX');
  assert.equal(normalizeState('Texas'), 'TX');
  assert.equal(normalizeState('D.C.'), 'DC');
  assert.equal(normalizeState('Ontario'), null);
  assert.equal(normalizeState('PR'), null);
});

test('city and state from one field', () => {
  assert.deepEqual(parseCityState('Austin, TX'), { city: 'Austin', state: 'TX' });
  assert.deepEqual(parseCityState('salt lake city utah'), { city: 'Salt Lake City', state: 'UT' });
  assert.deepEqual(parseCityState('New York, New York'), { city: 'New York', state: 'NY' });
  assert.equal(parseCityState('Toronto, ON'), null);
  assert.equal(parseCityState('Austin'), null);
});

test('name normalisation follows the spec', () => {
  assert.equal(normalizeName('The Baer Law Firm'), 'baer law firm');
  assert.equal(normalizeName('Integrity Air Conditioning & Heating L.L.C'), 'integrity air conditioning and heating');
  assert.equal(normalizeName("Stan's Heating, Air, Plumbing & Electrical"), 'stans heating air plumbing and electrical');
  assert.equal(normalizeName('U.S. Electric Contractors'), 'us electric contractors');
  assert.equal(normalizeName('Bright Line Plumbing Co.'), 'bright line plumbing');
});

test('prompts from the default templates', () => {
  const vars = { service: 'plumber', city: 'Austin', state: 'TX' };
  assert.deepEqual(DEFAULT_SETTINGS.prompt_templates.map((t) => renderPrompt(t, vars)), [
    'best plumber in Austin, TX',
    'who should I call for plumber near Austin TX? I need someone reliable',
    'top rated plumber in Austin TX with good reviews'
  ]);
});

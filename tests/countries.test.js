// Country list, location parsing and the three questions for any country.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES, countryByIso } from '../assets/js/ai-check-countries.js';
import { parseLocation, cleanRegion } from '../api/_lib/ai-check/normalize.js';
import { buildPrompts } from '../api/_lib/ai-check/prompts.js';
import { makeClient, findClient } from '../api/_lib/ai-check/match.js';
import { DEFAULT_SETTINGS } from '../api/_lib/config.js';
import { normalizeName } from '../assets/js/ai-check-core.js';

test('the country list is DataForSEO\'s: codes are unique and the big markets are there', () => {
  assert.ok(COUNTRIES.length > 150);
  assert.equal(new Set(COUNTRIES.map((c) => c.iso)).size, COUNTRIES.length);
  assert.equal(new Set(COUNTRIES.map((c) => c.code)).size, COUNTRIES.length);
  for (const [iso, code] of [['US', 2840], ['GB', 2826], ['CA', 2124], ['AU', 2036], ['DE', 2276], ['FR', 2250], ['ES', 2724], ['IT', 2380], ['BR', 2076], ['MX', 2484]]) {
    assert.equal(countryByIso(iso).code, code, iso);
  }
  assert.equal(countryByIso('gb').name, 'United Kingdom');
  assert.equal(countryByIso('RU'), null);
  assert.equal(countryByIso(''), null);
});

test('locations: a US state is required in the US, a city is enough elsewhere', () => {
  assert.deepEqual(parseLocation('Austin, TX', 'US'), { city: 'Austin', state: 'TX' });
  assert.equal(parseLocation('Austin', 'US'), null);
  assert.deepEqual(parseLocation('Manchester', 'GB'), { city: 'Manchester', state: null });
  assert.deepEqual(parseLocation('sydney, nsw', 'AU'), { city: 'Sydney', state: 'nsw' });
  assert.deepEqual(parseLocation('München, Bayern', 'DE'), { city: 'München', state: 'Bayern' });
  assert.deepEqual(parseLocation('São Paulo', 'BR'), { city: 'São Paulo', state: null });
  assert.equal(parseLocation('', 'GB'), null);
  assert.equal(parseLocation('<script>', 'GB')?.city, 'Script');
  assert.equal(cleanRegion('x'), null);
});

test('questions: US templates from the spec, the region or country elsewhere, the site\'s own language when given', () => {
  assert.deepEqual(buildPrompts({ service: 'plumber', city: 'Austin', state: 'TX' }), [
    'best plumber in Austin, TX',
    'who should I call for plumber near Austin TX? I need someone reliable',
    'top rated plumber in Austin TX with good reviews'
  ]);
  assert.equal(buildPrompts({ service: 'electrician', city: 'Sydney', state: 'NSW', country: 'AU' })[0], 'best electrician in Sydney, NSW');
  assert.equal(buildPrompts({ service: 'plumber', city: 'Dublin', state: null, country: 'IE' })[2], 'top rated plumber in Dublin, Ireland with good reviews');
  const de = ['Wer ist der beste Klempner in Berlin?', 'Wen soll ich für einen Klempner in Berlin anrufen? Ich brauche jemanden Zuverlässigen', 'Bestbewertete Klempner in Berlin mit guten Bewertungen'];
  assert.deepEqual(buildPrompts({ service: 'klempner', city: 'Berlin', country: 'DE' }, { questions: de }), de);
  // Questions that look wrong (too short, with links, too few) are not used.
  assert.match(buildPrompts({ service: 'klempner', city: 'Berlin', country: 'DE' }, { questions: ['hi', 'http://x.com', 'a'] })[0], /^best klempner in Berlin, Germany$/);
  assert.match(buildPrompts({ service: 'klempner', city: 'Berlin', country: 'DE' }, { questions: [de[0]] })[0], /^best klempner/);
  // The US ignores questions: the spec's wording is fixed.
  assert.equal(buildPrompts({ service: 'plumber', city: 'Austin', state: 'TX', country: 'US' }, { questions: de })[0], 'best plumber in Austin, TX');
});

test('names in other scripts and with other company suffixes still match', () => {
  assert.equal(normalizeName('Nelson Plumbing & Heating Ltd'), 'nelson plumbing and heating');
  assert.equal(normalizeName('Schwalm Heizung & Sanitär GmbH'), 'schwalm heizung and sanitar');
  assert.equal(normalizeName('Кофейня «Лето»'), 'кофейня лето');
  assert.equal(normalizeName('東京ラーメン'), '東京ラーメン');
});

test('the service words in the site\'s language never identify a business', () => {
  const client = makeClient({ name: 'Klempner Notdienst Müller', domain: 'x.de', city: 'Berlin', service: 'klempner notdienst' }, DEFAULT_SETTINGS);
  assert.equal(client.rarest, 'muller');
  const hit = findClient(client, [{ name: 'Klempner Notdienst Schmidt', domain: null, position: 1 }]);
  assert.equal(hit, null);
});

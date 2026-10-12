import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SETTINGS } from '../api/_lib/config.js';
import { makeClient, tokenSetRatio, findClient, mentionedInText } from '../api/_lib/ai-check/match.js';
import { parseAnswer, answerBusinesses, resultOf } from '../api/_lib/ai-check/answer.js';
import { nameTokens } from '../api/_lib/ai-check/normalize.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(here, 'fixtures', 'dataforseo');
const load = (name) => JSON.parse(fs.readFileSync(path.join(fixtureDir, name + '.json'), 'utf8'));
const { cases } = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'labels.json'), 'utf8'));

test('there are at least 10 real DataForSEO responses', () => {
  assert.ok(fs.readdirSync(fixtureDir).filter((f) => f.endsWith('.json')).length >= 10);
});

for (const c of cases) {
  test(`${c.fixture}: ${c.client.name} → ${c.expect.found ? `#${c.expect.position ?? 'mentioned'} via ${c.expect.rule}` : 'not named'}`, () => {
    const client = makeClient(c.client, DEFAULT_SETTINGS);
    const answer = parseAnswer(load(c.fixture), client, DEFAULT_SETTINGS);
    assert.equal(answer.client.found, c.expect.found);
    if (c.expect.found) {
      assert.equal(answer.client.position, c.expect.position);
      assert.equal(answer.client.match_rule, c.expect.rule);
      const flagged = answer.businesses.filter((b) => b.is_client);
      assert.equal(flagged.length, c.expect.position ? 1 : 0, 'exactly one business is highlighted when there is a position');
    } else {
      assert.equal(answer.businesses.filter((b) => b.is_client).length, 0, 'no business is highlighted');
    }
  });
}

test('the labelled set has both real matches and near-miss names', () => {
  assert.ok(cases.filter((c) => c.expect.found).length >= 10);
  assert.ok(cases.filter((c) => !c.expect.found).length >= 10);
});

test('every fixture yields businesses in answer order, without directories', () => {
  for (const f of fs.readdirSync(fixtureDir)) {
    const list = answerBusinesses(resultOf(load(f.replace(/\.json$/, ''))), DEFAULT_SETTINGS);
    assert.ok(list.length >= 3, f);
    list.forEach((b, i) => assert.equal(b.position, i + 1));
    assert.ok(!list.some((b) => /yelp|angi|bbb|google/i.test(b.name)), f);
  }
});

test('local business block gives rating and review count', () => {
  const list = answerBusinesses(resultOf(load('best-plumber-in-austin-tx')), DEFAULT_SETTINGS);
  assert.deepEqual(list.map((b) => b.name), ['Austin Plumbery', 'Abacus Plumbing, Air Conditioning & Electrical', 'Ironclad Plumbing']);
  assert.equal(list[0].rating, 4.8);
  assert.equal(list[0].reviews, 227);
  assert.equal(list[2].domain, 'ironcladtexas.com');
});

test('without a local block, brand entities are used in order of mention', () => {
  const list = answerBusinesses(resultOf(load('who-should-i-call-for-septic-tank-pumping-near-boise-id-i-ne')), DEFAULT_SETTINGS);
  assert.deepEqual(list.map((b) => b.name), ['ABC Pumping Service', "Mike's Septic & Drain", 'Express Septic & Drain Cleaning']);
});

test('token set ratio: subset scores 1, unrelated scores low', () => {
  assert.equal(tokenSetRatio(nameTokens('Abacus Plumbing'), nameTokens('Abacus Plumbing, Air Conditioning & Electrical')), 1);
  assert.ok(tokenSetRatio(nameTokens('Metro Dental Care'), nameTokens('Metropolitan Dental Care')) < 0.9);
});

test('a name made only of service and city words never fuzzy-matches', () => {
  const client = makeClient({ name: 'Austin Plumbing', domain: 'x.com', city: 'Austin', state: 'TX' }, DEFAULT_SETTINGS);
  assert.equal(client.rarest, null);
  assert.equal(findClient(client, [{ name: 'Austin Plumbing Pros', domain: 'y.com' }]), null);
  assert.equal(mentionedInText(client, 'Austin plumbing companies are busy.'), false);
});

test('domain rule accepts subdomains and ignores www', () => {
  const client = makeClient({ name: 'Bright Line', domain: 'www.brightline.com', city: 'Austin', state: 'TX' }, DEFAULT_SETTINGS);
  assert.deepEqual(findClient(client, [{ name: 'Other' }, { name: 'BL', domain: 'austin.brightline.com' }]), { index: 1, rule: 'domain' });
  assert.equal(findClient(client, [{ name: 'BL', domain: 'notbrightline.com' }]), null);
});

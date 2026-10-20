import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarize } from '../api/_lib/ai-check/summary.js';
import { parseAnswer } from '../api/_lib/ai-check/answer.js';
import { makeClient } from '../api/_lib/ai-check/match.js';
import { DEFAULT_SETTINGS } from '../api/_lib/config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'dataforseo', name + '.json'), 'utf8'));

const answer = (found, position, businesses = [], sources = []) => ({ client: { found, position }, businesses, sources });
const biz = (name, position, extra = {}) => ({ name, position, is_client: false, domain: null, rating: null, reviews: null, ...extra });

test('verdict table from the spec', () => {
  assert.equal(summarize([answer(false), answer(false), answer(false)]).verdict, 'not_recommended');
  assert.equal(summarize([answer(true, 2), answer(false), answer(false)]).verdict, 'sometimes');
  assert.equal(summarize([answer(true, 2), answer(true, 3), answer(true, null)]).verdict, 'not_first');
  assert.equal(summarize([answer(true, 1), answer(true, 3), answer(true, 2)]).verdict, 'top_pick');
  const s = summarize([answer(false), answer(false), answer(false)]);
  assert.equal(s.offer_title, 'Find out why AI results skip you');
  assert.equal(s.verdict_label, 'Not recommended');
});

test('two answers out of three still give a verdict over the answers we have', () => {
  const s = summarize([answer(true, 1), answer(true, 2)]);
  assert.equal(s.total, 2);
  assert.equal(s.mentions_count, 2);
  assert.equal(s.verdict, 'top_pick');
});

test('competitors: most answers first, then better average position, top 3', () => {
  const s = summarize([
    answer(false, null, [biz('Acme Plumbing', 1), biz('Beta Pipes', 2), biz('Gamma Drains', 3)]),
    answer(false, null, [biz('Beta Pipes', 1), biz('Acme Plumbing LLC', 2), biz('Delta Rooter', 3)]),
    answer(false, null, [biz('Beta Pipes', 2), biz('Delta Rooter', 1)])
  ]);
  assert.deepEqual(s.competitors.map((c) => [c.name, c.count, c.avg_position]), [
    ['Beta Pipes', 3, 1.7], ['Acme Plumbing', 2, 1.5], ['Delta Rooter', 2, 2]
  ]);
  assert.equal(s.competitors[0].label, 'named in 3 of 3 answers');
});

test('the client is never listed as a competitor', () => {
  const s = summarize([answer(true, 1, [biz('Me', 1, { is_client: true }), biz('Them', 2)])]);
  assert.deepEqual(s.competitors.map((c) => c.name), ['Them']);
});

test('sources by how many answers cite them, client site marked', () => {
  const s = summarize([
    answer(false, null, [], [{ domain: 'yelp.com' }, { domain: 'bbb.org' }, { domain: 'yelp.com' }]),
    answer(false, null, [], [{ domain: 'yelp.com' }, { domain: 'mysite.com' }]),
    answer(false, null, [], [{ domain: 'angi.com' }, { domain: 'bbb.org' }])
  ], 'mysite.com');
  assert.deepEqual(s.sources.map((x) => [x.domain, x.count, x.is_client]), [
    ['yelp.com', 2, false], ['bbb.org', 2, false], ['mysite.com', 1, true], ['angi.com', 1, false]
  ]);
});

test('summary over real answers', () => {
  const client = makeClient({ name: 'Ironclad Plumbing', domain: 'ironcladtexas.com', city: 'Austin', state: 'TX' }, DEFAULT_SETTINGS);
  const answers = ['best-plumber-in-austin-tx', 'best-ac-repair-in-phoenix-az', 'top-rated-pest-control-in-houston-tx-with-good-reviews']
    .map((f) => parseAnswer(load(f), client, DEFAULT_SETTINGS));
  const s = summarize(answers, 'ironcladtexas.com');
  assert.equal(s.mentions_count, 1);
  assert.equal(s.verdict, 'sometimes');
  assert.equal(s.best_position, 3);
  assert.equal(s.competitors.length, 3);
  assert.ok(s.sources.length <= 5 && s.sources[0].domain);
});

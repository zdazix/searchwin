// The Gemini reader: request shape, parsing and error handling, with fetch replaced (no key or network here).

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { extractBusiness } from '../api/_lib/ai-check/gemini.js';

const answer = (obj, extra = {}) => new Response(JSON.stringify({
  candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: 'STOP' }],
  usageMetadata: { promptTokenCount: 3000, candidatesTokenCount: 120 }, ...extra
}));
const good = { name: 'Ironclad Plumbing', service: 'plumber', city: 'Austin', state: 'TX', country: 'US', is_local_business: true, confidence: 0.9 };

beforeEach(() => { process.env.GEMINI_API_KEY = 'test-key'; delete process.env.GEMINI_MODEL; });

test('sends the key in a header, asks for JSON and returns the parsed data with a cost', async () => {
  let seen;
  const r = await extractBusiness({ domain: 'x.com' }, { fetchImpl: async (url, init) => { seen = { url, init }; return answer(good); } });
  assert.deepEqual(r.data, good);
  assert.equal(r.model, 'gemini-3.5-flash-lite');
  assert.ok(r.cost_usd > 0 && r.cost_usd < 0.01);
  assert.ok(seen.url.startsWith('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent'));
  assert.ok(!seen.url.includes('test-key'));
  assert.equal(seen.init.headers['x-goog-api-key'], 'test-key');
  const body = JSON.parse(seen.init.body);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.generationConfig.responseSchema.properties.state.nullable, true);
  assert.ok(body.contents[0].parts[0].text.includes('"domain":"x.com"'));
});

test('GEMINI_MODEL overrides the model', async () => {
  process.env.GEMINI_MODEL = 'gemini-2.5-flash-lite';
  let url;
  await extractBusiness({}, { fetchImpl: async (u) => { url = u; return answer(good); } });
  assert.ok(url.includes('/models/gemini-2.5-flash-lite:'));
});

test('a busy or failing service is retried once; a rejected key or model is not', async () => {
  let n = 0;
  const flaky = async () => (++n === 1 ? new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 503 }) : answer(good));
  assert.deepEqual((await extractBusiness({}, { fetchImpl: flaky })).data, good);
  assert.equal(n, 2);
  n = 0;
  const badKey = async () => { n++; return new Response(JSON.stringify({ error: { message: 'API key not valid' } }), { status: 400 }); };
  await assert.rejects(extractBusiness({}, { fetchImpl: badKey }), { code: 'llm_rejected' });
  assert.equal(n, 1);
  n = 0;
  const down = async () => { n++; throw new TypeError('fetch failed'); };
  await assert.rejects(extractBusiness({}, { fetchImpl: down }), { code: 'llm_network' });
  assert.equal(n, 2);
});

test('empty, blocked or non-JSON answers give llm_no_data; a missing key is a config error', async () => {
  const blocked = async () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }));
  await assert.rejects(extractBusiness({}, { fetchImpl: blocked }), { code: 'llm_no_data' });
  const junk = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'sorry, I cannot' }] } }] }));
  await assert.rejects(extractBusiness({}, { fetchImpl: junk }), { code: 'llm_no_data' });
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(extractBusiness({}, { fetchImpl: async () => answer(good) }), { code: 'config' });
});

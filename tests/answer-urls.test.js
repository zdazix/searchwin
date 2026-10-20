import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { answerUrls, answerMarkdown, resultOf } from '../api/_lib/ai-check/answer.js';
import { signAnswer, verifyAnswer } from '../api/_lib/ai-check/ticket.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const load = (n) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'dataforseo', n + '.json'), 'utf8'));

test('every cited source URL and every link in the text is collected, once', () => {
  const r = resultOf(load('best-plumber-in-austin-tx'));
  const md = answerMarkdown(r);
  const urls = answerUrls(r, md);
  assert.ok(urls.length >= 3);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every((u) => /^https?:\/\//.test(u)));
  for (const s of r.items.flatMap((i) => i.sources || [])) assert.ok(urls.includes(s.url), s.url);
  const linked = [...md.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map((m) => m[1]);
  for (const u of linked) assert.ok(urls.includes(u), u);
});

test('a bare URL in the text and a link to the same address count once', () => {
  assert.deepEqual(answerUrls({ items: [] }, 'see https://a.com/x and [a](https://a.com/x) or [b](https://b.com).'), ['https://a.com/x', 'https://b.com']);
});

test('a saved answer is only accepted with its own signature', () => {
  const a = { prompt: 'q', location_code: 2840, language_code: 'en', checked_at: '2026-10-20T10:00:00.000Z', answer_text: 'text', sources: ['https://a.com'] };
  const sig = signAnswer(a);
  assert.equal(verifyAnswer({ ...a, sig }), true);
  for (const change of [{ prompt: 'q2' }, { location_code: 2826 }, { language_code: 'de' }, { checked_at: '2026-10-21T10:00:00.000Z' }, { answer_text: 'other' }, { sources: [] }]) {
    assert.equal(verifyAnswer({ ...a, ...change, sig }), false, JSON.stringify(change));
  }
  assert.equal(verifyAnswer({ ...a }), false);
});

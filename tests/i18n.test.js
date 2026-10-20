import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DICT, translator, PATHS, THANKS_PATHS } from '../assets/js/ai-check-i18n.js';
import { VERDICTS } from '../assets/js/ai-check-core.js';
import { MESSAGES } from '../api/_lib/config.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('English and Spanish have the same texts, with the same placeholders', () => {
  const en = Object.keys(DICT.en), es = Object.keys(DICT.es);
  assert.deepEqual(en.filter((k) => !es.includes(k)), []);
  assert.deepEqual(es.filter((k) => !en.includes(k)), []);
  for (const k of en) {
    assert.ok(DICT.es[k].trim(), k);
    assert.equal(vars(DICT.es[k]), vars(DICT.en[k]), k);
  }
});

test('Spanish is really Spanish: no text was left in English', () => {
  const same = Object.keys(DICT.en).filter((k) => DICT.es[k] === DICT.en[k] && /[a-z]{4,}/i.test(DICT.en[k]));
  assert.deepEqual(same, []);
});

test('server error codes have a text in both languages, English matching what the server says', () => {
  for (const [code, message] of Object.entries(MESSAGES)) {
    assert.equal(DICT.en['err.' + code], message, code);
    assert.ok(DICT.es['err.' + code], code);
  }
});

test('verdict labels and offers in English match the shared core (server notices use them)', () => {
  for (const [v, x] of Object.entries(VERDICTS)) {
    assert.equal(DICT.en['verdict.' + v], x.label);
    assert.equal(DICT.en['offer.' + v], x.offer);
    assert.ok(DICT.es['verdict.' + v] && DICT.es['offer.' + v]);
  }
});

test('the translator fills placeholders and falls back to English, then to the key', () => {
  const es = translator('es');
  assert.equal(es('score.result', { mentions: 1, total: 3, biz: 'Acme' }), '1 de 3 respuestas nombran a Acme');
  assert.equal(translator('en')('score.result', { mentions: 1, total: 3, biz: 'Acme' }), '1 of 3 answers name Acme');
  assert.equal(es('no.such.key'), 'no.such.key');
  assert.equal(translator('xx')('btn.retry'), 'Try again');
  assert.equal(es.has('err.captcha'), true);
});

test('both languages have their own check and thank-you pages that point at each other', () => {
  assert.deepEqual(PATHS, { en: '/ai-check/', es: '/es/ai-check/' });
  assert.deepEqual(THANKS_PATHS, { en: '/ai-check/thank-you/', es: '/es/ai-check/thank-you/' });
  const en = read('ai-check/index.html'), es = read('es/ai-check/index.html');
  assert.match(en, /<html lang="en">/);
  assert.match(es, /<html lang="es">/);
  for (const html of [en, es]) {
    assert.ok(html.includes('<link rel="alternate" hreflang="en" href="https://searchwin.ai/ai-check/">'));
    assert.ok(html.includes('<link rel="alternate" hreflang="es" href="https://searchwin.ai/es/ai-check/">'));
    assert.ok(html.includes('<link rel="alternate" hreflang="x-default" href="https://searchwin.ai/ai-check/">'));
  }
  assert.ok(en.includes('<link rel="canonical" href="https://searchwin.ai/ai-check/">'));
  assert.ok(es.includes('<link rel="canonical" href="https://searchwin.ai/es/ai-check/">'));
  assert.ok(en.includes('href="/es/ai-check/" hreflang="es"'));
  assert.ok(es.includes('href="/ai-check/" hreflang="en"'));
  assert.ok(es.includes('data-ac-new>Analizar otra web') && es.includes('href="/es/ai-check/" data-ac-new'));
  assert.match(read('es/ai-check/thank-you/index.html'), /<html lang="es">[\s\S]*noindex/);
});

// What the script looks up on the page: every hook, id and data attribute must exist in both languages.
const hooks = (html) => [...new Set([...html.matchAll(/\b(data-ac-[\w-]+|data-thanks-[\w-]+|data-field|data-error-for)\b/g)].map((m) => m[1]))].sort();
const ids = (html) => [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]).sort();
const counts = (html, re) => (html.match(re) || []).length;

test('the Spanish check page has every hook the script needs, same structure as the English one', () => {
  const en = read('ai-check/index.html'), es = read('es/ai-check/index.html');
  assert.deepEqual(hooks(es), hooks(en));
  assert.deepEqual(ids(es), ids(en));
  for (const re of [/<section/g, /<button/g, /<input/g, /<li class="ac-biz__item"/g, /class="ac-slide"/g, /class="ac-lock/g, /<dialog/g, /<form/g, /<svg/g, /<symbol/g, /<script/g, /<h[12]/g]) {
    assert.equal(counts(es, re), counts(en, re), String(re));
  }
  assert.ok(es.includes('src="/assets/js/ai-check.js"') && es.includes('src="/assets/js/ai-check-tracking.js"'));
});

test('the Spanish thank-you page has the same hooks and scripts as the English one', () => {
  const en = read('ai-check/thank-you/index.html'), es = read('es/ai-check/thank-you/index.html');
  assert.deepEqual(hooks(es), hooks(en));
  assert.deepEqual(ids(es), ids(en));
  assert.equal(counts(es, /<li>/g), counts(en, /<li>/g));
  assert.ok(es.includes('src="/assets/js/ai-check-thanks.js"'));
});

test('the Spanish page really is in Spanish (examples are real Spanish answers, nothing English is left in the visible text)', () => {
  const es = read('es/ai-check/index.html');
  const visible = es.replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ');
  for (const word of ['Enter your', 'Get your', 'Not mentioned', 'See who', 'Check another', 'Free live report', 'Real ChatGPT answers', 'Read the full answer', 'Skip to content']) {
    assert.ok(!visible.includes(word), word);
  }
  for (const word of ['Legalcar Abogados', 'Climatron', 'Clínica EMET S.L', 'Tu negocio: no mencionado', '60 seg']) assert.ok(es.includes(word), word);
  // The example businesses are the first three of the recorded answers, with their real ratings.
  const rec = (f) => JSON.parse(read('tests/fixtures/dataforseo/' + f + '.json')).tasks[0].result[0].items.find((i) => i.type === 'chat_gpt_local_businesses').items.slice(0, 3);
  const shown = [...es.matchAll(/<span class="ac-biz__name">([^<]+)<\/span><span class="ac-biz__rate"><svg[^>]*><use[^>]*><\/use><\/svg>([\d,]+) · (\d+)</g)];
  const real = [
    ...rec('mejor-abogado-de-accidentes-en-madrid'),
    ...rec('a-quien-deberia-llamar-aire-acondicionado-cerca-de-valencia'),
    ...rec('clinica-dental-mejor-valorada-en-sevilla')
  ];
  assert.equal(shown.length, 9);
  shown.forEach((m, i) => {
    assert.equal(m[2], real[i].rating.value.toFixed(1).replace('.', ','), m[1]);
    assert.equal(Number(m[3]), real[i].reviews_count, m[1]);
  });
});

test('the English page keeps its own texts (nothing Spanish leaked in) and the chip says 60 sec', () => {
  const en = read('ai-check/index.html');
  assert.ok(en.includes('Pure value in 60 sec'));
  assert.ok(!/Analizar|auditoría|negocio/.test(en));
});

test('sitemap lists the Spanish page with its language alternates; robots keeps the thank-you pages out', () => {
  const sm = read('sitemap.xml');
  assert.match(sm, /<loc>https:\/\/searchwin\.ai\/es\/ai-check\/<\/loc>/);
  assert.match(sm, /hreflang="es" href="https:\/\/searchwin\.ai\/es\/ai-check\/"/);
  assert.match(sm, /hreflang="en" href="https:\/\/searchwin\.ai\/ai-check\/"/);
  assert.ok(read('robots.txt').includes('Disallow: /es/ai-check/thank-you/'));
});

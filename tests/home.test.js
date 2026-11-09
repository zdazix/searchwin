import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUSINESS_TYPES, CURRENCIES, allPlans, cardItems, missingItems, findPlan, lowestSprintPrice } from '../data/plans.js';
import { FAQ } from '../data/faq.js';
import { render } from '../scripts/build-home.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');
const text = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const visible = text(html);

test('16 plans: 2 business types × 2 lines × 3 tiers + Custom, with unique ids', () => {
  const plans = allPlans();
  assert.equal(plans.length, 16);
  assert.equal(new Set(plans.map((p) => p.id)).size, 16);
  for (const type of BUSINESS_TYPES) {
    for (const lineId of ['sprint', 'monthly']) {
      const line = type.lines[lineId];
      assert.equal(line.tiers.length, 4, `${type.id} ${lineId}`);
      assert.ok(line.tiers[3].custom && !line.tiers.slice(0, 3).some((t) => t.custom));
      // Only the middle tier is marked, and only as "Best place to start" until there is real data
      assert.deepEqual(line.tiers.map((t) => !!t.recommended), [false, true, false, false]);
      for (const r of line.rows) assert.equal(r.values.length, 4, `${type.id} ${lineId} ${r.label}`);
      assert.equal(line.rows.filter((r) => r.recheck).length, 1, 'one re-check row per line');
    }
  }
});

test('the prices are the ones in the brief, the same number in every currency', () => {
  const price = (id) => findPlan(id).tier.price;
  assert.deepEqual(['local-sprint-get-found', 'local-sprint-get-chosen', 'local-sprint-own-the-area'].map(price), [900, 1900, 3500]);
  assert.deepEqual(['local-monthly-keep', 'local-monthly-grow', 'local-monthly-lead'].map(price), [390, 790, 1490]);
  assert.deepEqual(['online-sprint-foundation', 'online-sprint-authority', 'online-sprint-category'].map(price), [1900, 3900, 7500]);
  assert.deepEqual(['online-monthly-track', 'online-monthly-scale', 'online-monthly-lead-the-category'].map(price), [690, 1490, 2900]);
  assert.equal(lowestSprintPrice(), 900);
  assert.deepEqual(CURRENCIES.map((c) => c.symbol), ['$', '£', '€']);
});

test('every tier card has a name, who it is for, a price, 5-7 counted deliverables, a re-check line and its exclusions', () => {
  for (const p of allPlans()) {
    const t = p.tier;
    assert.ok(t.name && t.promise && t.bestFor && t.recheck, p.id);
    if (t.custom) { assert.ok(t.cases.length >= 4 && /fixed price and a deliverables list before you pay/.test(t.promiseNote), p.id); continue; }
    assert.ok(t.price > 0, p.id);
    const items = cardItems(p);
    assert.ok(items.length >= 5 && items.length <= 7, `${p.id}: ${items.length} items`);
    assert.ok(items.some((i) => /\d/.test(i)), `${p.id} has counted items`);
    for (const i of items) assert.ok(!/\{|\}/.test(i) && !/\b1 \w+s a month\b/.test(i), `${p.id}: ${i}`);
    // A null in the table is listed as not included on the card
    for (const m of missingItems(p)) assert.ok(m.label, p.id);
  }
});

test('the pages are up to date with data/plans.js and data/faq.js (run npm run build:home after a change)', () => {
  for (const [file, expected] of Object.entries(render())) assert.equal(read(file), expected, `${file} is stale`);
});

test('prices, deliverables and FAQ are in the HTML source, for both business types', () => {
  for (const p of allPlans()) {
    assert.ok(html.includes(`data-plan="${p.id}"`), p.id);
    if (!p.tier.custom) assert.ok(html.includes(`data-cur-sym>$</span>${p.tier.price.toLocaleString('en-US')}</span>`), p.id);
    for (const item of p.tier.custom ? p.tier.cases : cardItems(p)) assert.ok(visible.includes(item), `${p.id}: ${item}`);
  }
  assert.equal((html.match(/<details class="qa" data-faq=/g) || []).length, 10);
  for (const f of FAQ) assert.ok(visible.includes(f.q.replace(/&/g, '&')), f.q);
  assert.ok(html.includes('data-type-panel="local"') && html.includes('data-type-panel="online"'));
});

test('title, description, one H1 and the JSON-LD offers match the plans', () => {
  assert.match(html, /<title>AI Search Optimization &amp; Lead Generation Service, Fixed Plans \| searchwin\.ai<\/title>/);
  assert.ok(html.includes('<meta name="description" content="Fixed-price AI search optimization and lead generation for local businesses and SMEs. 45-day sprints from $900, monthly plans, counted deliverables.">'));
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n\s*<\/script>/)[1]);
  const graph = ld['@graph'];
  assert.ok(graph.some((g) => g['@type'] === 'Organization'));
  const services = graph.filter((g) => g['@type'] === 'Service');
  assert.equal(services.length, 4);
  const offers = services.flatMap((s) => s.hasOfferCatalog.itemListElement);
  assert.equal(offers.length, 16);
  for (const p of allPlans().filter((x) => !x.tier.custom)) {
    const o = offers.find((x) => x.url.endsWith(`plan=${p.id}`));
    assert.equal(o.price, String(p.tier.price), p.id);
    assert.equal(o.priceCurrency, 'USD');
    assert.deepEqual(o.priceSpecification.map((s) => s.priceCurrency), ['USD', 'GBP', 'EUR']);
    assert.ok(o.priceSpecification.every((s) => s.price === p.tier.price));
  }
  const faq = graph.find((g) => g['@type'] === 'FAQPage');
  assert.deepEqual(faq.mainEntity.map((q) => q.name), FAQ.map((f) => f.q));
});

test('every statistic carries a linked source; made-up numbers say "Illustrative example"', () => {
  const stats = html.match(/<div class="stat"[\s\S]*?<\/div>/g) || [];
  assert.ok(stats.length >= 1 && stats.length <= 2, 'at most two statistics');
  for (const s of stats) assert.match(s, /<p class="source">Source: <a href="https:\/\/[^"]+"/);
  for (const id of ['top', 'problem', 'sample-report']) {
    const section = html.slice(html.indexOf(`id="${id}"`), html.indexOf('</section>', html.indexOf(`id="${id}"`)));
    assert.ok(section.includes('Illustrative example'), id);
  }
  const sample = html.slice(html.indexOf('id="sample-report"'), html.indexOf('</section>', html.indexOf('id="sample-report"')));
  assert.ok((sample.match(/Illustrative example/g) || []).length >= 4, 'each sample panel is labelled');
  assert.ok(!/class="case|testimonial|client-logo/i.test(html), 'no case studies, testimonials or logos yet');
});

test('no agency words, no promises of results, no competitor names or internal price research', () => {
  for (const file of ['index.html', 'start/index.html', 'llms.txt']) {
    const t = text(read(file));
    for (const w of ['bespoke', 'holistic', 'partner with us', 'unlock', 'skyrocket']) assert.ok(!new RegExp(w, 'i').test(t), `${file}: ${w}`);
    for (const w of ['Nutshell', 'WebFX', '$1,500', '$5,000', '$25,000']) assert.ok(!t.includes(w), `${file}: ${w}`);
    // "guarantee" only where we say we don't, or what the work guarantees
    const ok = /(No guarantees|No guaranteed|Guaranteed rankings or lead numbers|Guaranteed placements, mentions or revenue|Can you guarantee|What we do guarantee is the work|Sometimes guarantees|promises rankings)/i;
    for (const m of t.matchAll(/[^.]*guarantee[^.]*/gi)) assert.match(m[0], ok, `${file}: "${m[0].trim()}"`);
  }
});

test('plan buttons go to the order form with plan and currency; first steps go to the free AI check', () => {
  const ctas = [...html.matchAll(/href="\/start\/\?plan=([a-z-]+)&amp;cur=usd" data-plan-cta="([a-z-]+)"/g)];
  assert.equal(ctas.length, 16);
  for (const [, id, data] of ctas) { assert.equal(id, data); assert.ok(findPlan(id), id); }
  assert.ok((html.match(/href="\/ai-check\/"/g) || []).length >= 4);
  assert.ok(html.includes('href="https://calendar.app.google/hFXU93aX327CiGPj9"'));
  assert.ok(visible.includes(BUSINESS_TYPES[0].lines.sprint.tiers[0].name) && visible.includes('Tell us what you need'));
  assert.ok(visible.includes('Monthly plans start after a sprint, or after our free audit confirms your basics are already in place.'));
});

test('robots.txt keeps the AI search crawlers allowed', () => {
  const robots = read('robots.txt');
  for (const bot of ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Claude-SearchBot']) {
    const block = robots.slice(robots.indexOf(`User-agent: ${bot}`)).split('\n\n')[0];
    assert.match(block, /Allow: \//, bot);
    assert.ok(!/Disallow: \/\s*$/m.test(block), bot);
  }
  assert.match(robots, /User-agent: \*\nAllow: \//);
});

test('/start/ lists every plan and carries the plan data for the summary', () => {
  const start = read('start/index.html');
  for (const p of allPlans()) assert.ok(start.includes(`<option value="${p.id}">`), p.id);
  const data = JSON.parse(start.match(/<script type="application\/json" id="plans-data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(Object.keys(data).length, 16);
  assert.equal(data['local-sprint-get-found'].price, 900);
  assert.match(start, /noindex/);
});

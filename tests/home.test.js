import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOLUTIONS, AUDIENCES, CURRENCIES, AGENTS, PEOPLE, allOffers, findOffer, fromPrice, allCurrencies, money } from '../data/solutions.js';
import { FAQ } from '../data/faq.js';
import { render, HOME_TITLE, HOME_DESCRIPTION } from '../scripts/build-site.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');
const text = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const visible = text(html);
const pageOf = (s) => read(`${s.url.replace(/^\/|\/$/g, '')}/index.html`);
const ldOf = (h) => JSON.parse(h.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n\s*<\/script>/)[1])['@graph'];
// Any amount of money: "$900", "£1,200", "€ 850", "900 USD"
const MONEY = /[$£€]\s?\d|\d[\d,.]*\s?(USD|GBP|EUR)\b/;

test('three solutions, five plans, and the starting prices from the brief in dollars, euros and pounds', () => {
  assert.deepEqual(SOLUTIONS.map((s) => s.id), ['sprint', 'monthly', 'pages']);
  assert.deepEqual(SOLUTIONS.map((s) => s.url), ['/sprint/', '/monthly/', '/pages/']);
  assert.deepEqual(allOffers().map((o) => o.id), ['sprint-local', 'sprint-national', 'monthly-local', 'monthly-national', 'pages']);
  const from = (id) => findOffer(id).from;
  assert.deepEqual(from('sprint-local'), { usd: 900, eur: 850, gbp: 750 });
  assert.deepEqual(from('sprint-national'), { usd: 1500, eur: 1400, gbp: 1200 });
  assert.deepEqual(from('monthly-local'), { usd: 450, eur: 400, gbp: 350 });
  assert.deepEqual(from('monthly-national'), { usd: 850, eur: 750, gbp: 650 });
  assert.deepEqual(from('pages'), { usd: 800, eur: 700, gbp: 600 });
  assert.deepEqual(CURRENCIES.map((c) => c.symbol), ['$', '€', '£']);
  assert.equal(fromPrice(findOffer('sprint-national'), 'gbp'), 'from £1,200 one-off');
  assert.equal(fromPrice(findOffer('pages'), 'eur'), 'from €700/month');
  assert.equal(allCurrencies(findOffer('monthly-local')), '$450, €400 or £350');
  assert.equal(findOffer('sprint-local').name, 'AI Search Sprint, local business');
  assert.equal(findOffer('nope'), null);
});

test('every solution has its page copy: hero, starting scope, sections and FAQ', () => {
  for (const s of SOLUTIONS) {
    assert.ok(s.name && s.kind && s.scope && s.billing && s.priceNote, s.id);
    assert.ok(s.card.text && s.card.points.length === 4 && s.card.cta, s.id);
    assert.ok(s.hero.eyebrow && s.hero.title && s.hero.lead, s.id);
    assert.ok(s.meta.title.endsWith('| searchwin.ai') && s.meta.description.length > 80 && s.meta.description.length < 240, s.id);
    assert.ok(s.faq.length >= 5, s.id);
    for (const o of s.offers) {
      assert.ok(o.covers.length >= 5, o.id);
      assert.ok(o.audience === null || AUDIENCES[o.audience], o.id);
      for (const c of CURRENCIES) assert.ok(Number.isInteger(o.from[c.id]) && o.from[c.id] > 0, `${o.id} ${c.id}`);
    }
    for (const name of s.sections) assert.ok(name === 'offers' || name === 'sample' || name === 'team' || name === 'faq' || s[name], `${s.id}: ${name}`);
  }
  assert.equal(AGENTS.length, 6);
  assert.equal(PEOPLE.length, 4);
});

test('the pages are up to date with data/solutions.js and data/faq.js (run npm run build:home after a change)', () => {
  for (const [file, expected] of Object.entries(render())) assert.equal(read(file), expected, `${file} is stale`);
});

test('homepage: the concept, three solutions that link to their pages, the team and the FAQ are in the HTML', () => {
  assert.ok(html.includes(`<title>${HOME_TITLE}</title>`));
  assert.ok(html.includes(`<meta name="description" content="${HOME_DESCRIPTION}">`));
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.ok(visible.includes('Organic lead generation for the AI search era'));
  for (const piece of ['High-intent questions first', 'Content that sells', 'Conversion on every page']) assert.ok(visible.includes(piece), piece);
  for (const s of SOLUTIONS) {
    assert.ok(visible.includes(s.name), s.name);
    assert.ok(visible.includes(s.card.text), `${s.id} card text`);
    for (const point of s.card.points) assert.ok(visible.includes(point), `${s.id}: ${point}`);
    assert.ok(html.includes(`href="${s.url}" data-solution="${s.id}"`), `${s.id} link`);
  }
  // Pages has its own section, apart from the two solutions for the website and outside sources
  const solutions = html.slice(html.indexOf('id="solutions"'), html.indexOf('</section>', html.indexOf('id="solutions"')));
  assert.ok(solutions.includes('AI Search Sprint') && solutions.includes('AI Search Monthly') && !solutions.includes('data-solution="pages"'));
  const pages = html.slice(html.indexOf('id="pages"'), html.indexOf('</section>', html.indexOf('id="pages"')));
  assert.ok(pages.includes('data-solution="pages"') && pages.includes('Illustrative example'));
  // People + AI agents
  for (const a of AGENTS) assert.ok(visible.includes(a.name) && visible.includes(a.text), a.name);
  for (const p of PEOPLE) assert.ok(visible.includes(p.name) && visible.includes(p.text), p.name);
  assert.equal((html.match(/<details class="qa" data-faq=/g) || []).length, FAQ.length);
  for (const f of FAQ) assert.ok(visible.includes(f.q), f.q);
});

test('homepage shows no prices: not in the page, the JSON-LD or the FAQ', () => {
  assert.ok(!MONEY.test(visible), `"${(visible.match(MONEY) || [])[0]}"`);
  assert.ok(!MONEY.test(html.replace(/<svg[\s\S]*?<\/svg>/g, '')), 'no amount anywhere in the source');
  assert.ok(!/"(price|minPrice|priceCurrency|priceSpecification)":/.test(html), 'JSON-LD carries no price');
  assert.ok(!/class="(curswitch|pricebox|plan__price)/.test(html), 'no price box or currency switch');
  for (const f of FAQ) assert.ok(!MONEY.test(f.q + f.a), f.q);
  const graph = ldOf(html);
  assert.ok(graph.some((g) => g['@type'] === 'Organization'));
  const services = graph.filter((g) => g['@type'] === 'Service');
  assert.deepEqual(services.map((s) => s.url), SOLUTIONS.map((s) => `https://searchwin.ai${s.url}`));
  assert.ok(services.every((s) => !('offers' in s)));
  assert.deepEqual(graph.find((g) => g['@type'] === 'FAQPage').mainEntity.map((q) => q.name), FAQ.map((f) => f.q));
});

test('solution pages: one H1, only the starting price, in all three currencies, and a quote button for each plan', () => {
  for (const s of SOLUTIONS) {
    const page = pageOf(s);
    const t = text(page);
    assert.ok(page.includes(`<title>${s.meta.title.replace(/&/g, '&amp;')}</title>`), s.id);
    assert.ok(page.includes(`<link rel="canonical" href="https://searchwin.ai${s.url}">`), s.id);
    assert.equal((page.match(/<h1[\s>]/g) || []).length, 1, s.id);
    assert.ok(t.includes(s.hero.title) && t.includes(s.hero.lead), s.id);
    assert.ok(page.includes('class="nav__links"') && page.includes(`<a href="${s.url}" aria-current="page">`), `${s.id} nav`);
    for (const o of s.offers) {
      // Every currency is in the HTML; CSS shows one
      const spans = CURRENCIES.map((c) => `<span data-c="${c.id}">${money(c.id, o.from[c.id])}</span>`).join('<i class="price__sep"> · </i>');
      assert.ok(page.includes(spans), `${o.id} price`);
      assert.ok(page.includes(`href="/start/?plan=${o.id}&amp;cur=usd" data-plan-cta="${o.id}"`), `${o.id} button`);
      for (const line of o.covers) assert.ok(t.includes(line), `${o.id}: ${line}`);
    }
    // Only starting prices: every amount on the page is one of this solution's "from" prices
    const allowed = new Set(s.offers.flatMap((o) => CURRENCIES.map((c) => money(c.id, o.from[c.id]))));
    for (const m of t.matchAll(/[$£€]\s?\d[\d,]*/g)) assert.ok(allowed.has(m[0]), `${s.id}: unexpected amount ${m[0]}`);
    assert.ok(t.includes('from '), s.id);
    assert.equal((page.match(/data-cur-btn=/g) || []).length, 3, `${s.id} currency switch`);
    for (const f of s.faq) assert.ok(t.includes(f.q), `${s.id}: ${f.q}`);
    // JSON-LD: a Service with one offer per plan, a minimum price in each currency, and the page FAQ
    const graph = ldOf(page);
    const service = graph.find((g) => g['@type'] === 'Service');
    assert.equal(service.offers.length, s.offers.length, s.id);
    service.offers.forEach((o, i) => {
      assert.deepEqual(o.priceSpecification.map((p) => [p.priceCurrency, p.minPrice]), CURRENCIES.map((c) => [c.code, s.offers[i].from[c.id]]), s.id);
      assert.ok(!('price' in o), 'a starting price, not a fixed one');
      assert.equal(o.priceSpecification.every((p) => (s.schemaUnit ? p.unitCode === 'MON' : !('unitCode' in p))), true, s.id);
    });
    assert.deepEqual(graph.find((g) => g['@type'] === 'FAQPage').mainEntity.map((q) => q.name), s.faq.map((f) => f.q));
    assert.ok(graph.some((g) => g['@type'] === 'BreadcrumbList'));
  }
  const pages = text(pageOf(SOLUTIONS[2]));
  for (const piece of ['100+ pages published', 'Leads dashboard', 'Buyer journey tracking', 'Spam protection', 'Quality backlinks', 'Custom analytics views']) assert.ok(pages.includes(piece), piece);
  assert.ok(text(pageOf(SOLUTIONS[0])).includes('Illustrative example'), 'the sample day-45 report is labelled');
});

test('every statistic carries a linked source; made-up numbers say "Illustrative example"', () => {
  const stats = html.match(/<div class="stat"[\s\S]*?<\/div>/g) || [];
  assert.ok(stats.length >= 1 && stats.length <= 2, 'at most two statistics');
  for (const s of stats) assert.match(s, /<p class="source">Source: <a href="https:\/\/[^"]+"/);
  for (const id of ['top', 'problem', 'approach', 'pages']) {
    const section = html.slice(html.indexOf(`id="${id}"`), html.indexOf('</section>', html.indexOf(`id="${id}"`)));
    assert.ok(section.includes('Illustrative example'), id);
  }
  const sprint = pageOf(SOLUTIONS[0]);
  const sample = sprint.slice(sprint.indexOf('id="sample-report"'), sprint.indexOf('</section>', sprint.indexOf('id="sample-report"')));
  assert.ok((sample.match(/Illustrative example/g) || []).length >= 4, 'each sample panel is labelled');
  const anatomy = pageOf(SOLUTIONS[2]);
  assert.ok(anatomy.slice(anatomy.indexOf('id="anatomy"')).includes('Illustrative example'));
  for (const file of ['index.html', 'sprint/index.html', 'monthly/index.html', 'pages/index.html']) {
    assert.ok(!/class="case|testimonial|client-logo/i.test(read(file)), `${file}: no case studies, testimonials or logos yet`);
  }
});

test('no agency words, no promises of results, no competitor names', () => {
  for (const file of ['index.html', 'sprint/index.html', 'monthly/index.html', 'pages/index.html', 'start/index.html', 'llms.txt']) {
    const t = text(read(file));
    for (const w of ['bespoke', 'holistic', 'partner with us', 'unlock', 'skyrocket', 'game-chang', 'cutting-edge', 'supercharge']) assert.ok(!new RegExp(w, 'i').test(t), `${file}: ${w}`);
    for (const w of ['Gushwork', 'Nutshell', 'WebFX']) assert.ok(!new RegExp(w, 'i').test(read(file)), `${file}: ${w}`);
    // "guarantee" only where we say we don't, or what the work guarantees
    const ok = /(No guarantees|No guaranteed|Guaranteed rankings or lead numbers|Can you guarantee|What we do guarantee is the work|Sometimes guarantees|promises rankings)/i;
    for (const m of t.matchAll(/[^.?]*guarantee[^.?]*/gi)) assert.match(m[0], ok, `${file}: "${m[0].trim()}"`);
  }
});

test('first steps go to the free AI check; the nav and footer are the same on every page', () => {
  assert.ok((html.match(/href="\/ai-check\/"/g) || []).length >= 4);
  assert.ok(html.includes('href="https://calendar.app.google/hFXU93aX327CiGPj9"'));
  for (const file of ['index.html', 'sprint/index.html', 'monthly/index.html', 'pages/index.html']) {
    const page = read(file);
    for (const s of SOLUTIONS) assert.ok(page.includes(`<a href="${s.url}"`), `${file} links to ${s.url}`);
    assert.ok(page.includes('class="footer home-footer"') && page.includes('href="/llms.txt"'), file);
    assert.ok(page.includes('id="i-check"') && page.includes('id="i-user"'), `${file} has the icon sprite`);
  }
  // Solution pages link back to the homepage sections with a root-relative address
  assert.ok(pageOf(SOLUTIONS[0]).includes('href="/#platform"') && html.includes('href="#platform"'));
});

test('robots.txt keeps the AI search crawlers allowed; the sitemap lists the solution pages', () => {
  const robots = read('robots.txt');
  for (const bot of ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Claude-SearchBot']) {
    const block = robots.slice(robots.indexOf(`User-agent: ${bot}`)).split('\n\n')[0];
    assert.match(block, /Allow: \//, bot);
    assert.ok(!/Disallow: \/\s*$/m.test(block), bot);
  }
  assert.match(robots, /User-agent: \*\nAllow: \//);
  const sitemap = read('sitemap.xml');
  for (const s of SOLUTIONS) assert.ok(sitemap.includes(`<loc>https://searchwin.ai${s.url}</loc>`), s.url);
});

test('llms.txt lists the three solutions with their starting prices', () => {
  const llms = read('llms.txt');
  for (const s of SOLUTIONS) {
    assert.ok(llms.includes(`https://searchwin.ai${s.url}`), s.id);
    for (const o of s.offers) assert.ok(llms.includes(allCurrencies(o)), o.id);
  }
});

test('/start/ lists every plan and carries the data for the summary', () => {
  const start = read('start/index.html');
  for (const o of allOffers()) assert.ok(start.includes(`<option value="${o.id}">`), o.id);
  const data = JSON.parse(start.match(/<script type="application\/json" id="plans-data">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(Object.keys(data), allOffers().map((o) => o.id));
  assert.deepEqual(data['sprint-local'].from, { usd: 900, eur: 850, gbp: 750 });
  assert.equal(data['sprint-local'].sprint, true);
  assert.equal(data.pages.sprint, false);
  assert.equal(data.pages.url, '/pages/');
  assert.match(start, /noindex/);
});

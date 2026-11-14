import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontMatter, renderMarkdown, slugify, formatDate, allInsights, publishedInsights, allStories, publishedStories } from '../scripts/lib/content.mjs';
import { render } from '../scripts/build-site.mjs';
import { STORIES } from '../data/stories.js';
import { CURRENCIES, findSolution, allOffers, money } from '../data/solutions.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const text = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const ldOf = (h) => JSON.parse(h.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n\s*<\/script>/)[1])['@graph'];
const storyFile = (s) => `blog/success-stories/${s.slug}/index.html`;
const postFile = (p) => `blog/insights/${p.slug}/index.html`;

test('front matter: text, booleans, lists and a colon inside a value', () => {
  const { data, body } = parseFrontMatter('---\ntitle: One: two\ndescription: "Quoted text"\ndate: 2026-11-14\ndraft: true\ntakeaways:\n  - First point\n  - Second: with a colon\ntag: Later key\n---\n\n## Body\n\nText.\n');
  assert.deepEqual(data, { title: 'One: two', description: 'Quoted text', date: '2026-11-14', draft: true, takeaways: ['First point', 'Second: with a colon'], tag: 'Later key' });
  assert.equal(body, '## Body\n\nText.');
  assert.throws(() => parseFrontMatter('No front matter here'), /no front matter/);
  assert.throws(() => parseFrontMatter('---\n  - orphan\n---\nx'), /not under a list key/);
  assert.throws(() => parseFrontMatter('---\nthis line has no key\n---\nx'), /cannot read/);
});

test('markdown: headings get ids and a table of contents, outside links open safely, tables can scroll', () => {
  const { html, toc } = renderMarkdown('## What it is\n\nText with a [link](https://example.com/a) and an [inner one](/sprint/).\n\n### A detail\n\n## What it is\n\n| A | B |\n|---|---|\n| 1 | 2 |\n');
  assert.deepEqual(toc, [{ id: 'what-it-is', text: 'What it is' }, { id: 'what-it-is-2', text: 'What it is' }]);
  assert.ok(html.includes('<h2 id="what-it-is">What it is</h2>') && html.includes('<h3 id="a-detail">A detail</h3>'));
  assert.ok(html.includes('<a href="https://example.com/a" rel="noopener">link</a>') && html.includes('<a href="/sprint/">inner one</a>'));
  assert.ok(html.includes('<div class="prose__table"><table>') && html.includes('</table></div>'));
  assert.throws(() => renderMarkdown('# A second title'), /no # heading/);
  assert.equal(slugify('A page’s “Heading”, twice!'), 'a-pages-heading-twice');
  assert.equal(formatDate('2026-11-14'), '14 November 2026');
});

test('every article has what its page needs', () => {
  const posts = allInsights();
  assert.ok(posts.length >= 3);
  assert.equal(new Set(posts.map((p) => p.slug)).size, posts.length);
  for (const p of posts) {
    assert.ok(p.title.length > 10 && p.title.length < 90, p.slug);
    assert.ok(p.description.length > 60 && p.description.length < 220, `${p.slug} description`);
    assert.match(p.date, /^\d{4}-\d{2}-\d{2}$/, p.slug);
    assert.ok(p.takeaways.length >= 3, `${p.slug} takeaways`);
    assert.ok(p.toc.length >= 3, `${p.slug} sections`);
    assert.ok(p.minutes >= 1 && p.html.length > 1500, `${p.slug} body`);
    assert.ok(!p.solution || findSolution(p.solution), p.slug);
  }
  // Newest first
  assert.deepEqual(posts.map((p) => p.date), [...posts.map((p) => p.date)].sort().reverse());
});

test('every story has the fields the template is built on', () => {
  assert.equal(new Set(STORIES.map((s) => s.slug)).size, STORIES.length);
  for (const s of STORIES) {
    assert.match(s.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.match(s.date, /^\d{4}-\d{2}-\d{2}$/, s.slug);
    assert.ok(s.title && s.description && s.client.name && s.client.industry && s.client.location && s.period && s.engines, s.slug);
    assert.ok(['local', 'national'].includes(s.audience), s.slug);
    assert.ok(s.solutions.length >= 1 && s.solutions.every((id) => findSolution(id)), s.slug);
    assert.equal(s.metrics.length, 3, `${s.slug}: three numbers at the top`);
    assert.ok(s.quote.text && s.quote.name, s.slug);
    assert.ok(s.challenge.trim() && s.work.length >= 3 && s.results.intro && s.results.rows.length >= 2 && s.results.source, s.slug);
    assert.equal(s.takeaways.length, 3, s.slug);
    assert.ok(s.fit.length >= 3, s.slug);
    // A sample is never published as if it were a client
    if (s.sample) assert.equal(s.draft, true, `${s.slug}: a sample story stays a draft`);
  }
});

test('article page: header, takeaways, contents, the check box in the text, related solution and JSON-LD', () => {
  const out = render();
  for (const p of allInsights()) {
    const page = out[postFile(p)];
    const t = text(page);
    assert.equal((page.match(/<h1[\s>]/g) || []).length, 1, p.slug);
    assert.ok(page.includes(`<title>${p.title.replace(/&/g, '&amp;')} | searchwin.ai</title>`), p.slug);
    assert.ok(page.includes(`<link rel="canonical" href="https://searchwin.ai${p.url}">`), p.slug);
    assert.ok(page.includes('<a href="/blog/insights/" aria-current="page">Insights</a>'), `${p.slug} nav`);
    assert.ok(t.includes(p.description) && t.includes('Key takeaways') && t.includes('On this page'), p.slug);
    for (const k of p.takeaways) assert.ok(t.includes(k), `${p.slug}: ${k}`);
    for (const h of p.toc) assert.ok(page.includes(`<a href="#${h.id}">`) && page.includes(`id="${h.id}"`), `${p.slug} #${h.id}`);
    assert.ok(!page.includes('[[cta]]'), `${p.slug}: the marker became the box`);
    for (const where of ['insight-inline', 'insight-end', 'insight-aside', 'insight-final']) assert.ok(page.includes(`data-ai-check="${where}"`), `${p.slug} ${where}`);
    if (p.solution) assert.ok(page.includes(`data-solution="${p.solution}"`) && page.includes('class="solref__card"'), `${p.slug} solution`);
    const graph = ldOf(page);
    const post = graph.find((g) => g['@type'] === 'BlogPosting');
    assert.deepEqual([post.headline, post.datePublished, post.mainEntityOfPage], [p.title, p.date, `https://searchwin.ai${p.url}`], p.slug);
    assert.equal(graph.find((g) => g['@type'] === 'BreadcrumbList').itemListElement.length, 4, p.slug);
  }
});

test('story page is built to convert: results first, a next step at every stage, the solution with its starting price', () => {
  const out = render();
  for (const s of allStories()) {
    const page = out[storyFile(s)];
    const t = text(page);
    const solution = findSolution(s.solutions[0]);
    const offer = allOffers().find((o) => o.solution.id === solution.id && (o.audience === s.audience || o.audience === null));
    assert.equal((page.match(/<h1[\s>]/g) || []).length, 1, s.slug);
    // Top of the page: the outcome, three numbers and both buttons, before any story text
    const hero = page.slice(page.indexOf('class="hero story-hero"'), page.indexOf('</header>', page.indexOf('class="hero story-hero"')));
    assert.ok(hero.includes(s.title.replace(/&/g, '&amp;')), s.slug);
    assert.equal((hero.match(/class="story-metrics__value"/g) || []).length, 3, s.slug);
    assert.ok(hero.includes('data-ai-check="story-hero"') && hero.includes(`data-plan-cta="${offer.id}"`), `${s.slug} hero buttons`);
    // The order a reader needs: the client's words, the challenge, the work, the results, why it worked, the fit
    const order = ['class="story-quote"', 'id="challenge"', 'id="work"', 'data-ai-check="story-mid"', 'id="results"', 'id="why"', 'id="fit"', 'class="solref__card"', 'id="start"'].map((x) => page.indexOf(x));
    assert.ok(order.every((i) => i > 0), `${s.slug}: a part is missing`);
    assert.deepEqual(order, [...order].sort((a, b) => a - b), `${s.slug}: the parts are in order`);
    assert.ok(t.includes(s.quote.text) && t.includes(s.quote.name), s.slug);
    for (const w of s.work) assert.ok(t.includes(w), `${s.slug}: ${w}`);
    for (const r of s.results.rows) assert.ok(t.includes(r.question) && t.includes(r.engine), `${s.slug}: ${r.question}`);
    for (const k of s.takeaways) assert.ok(t.includes(k.title) && t.includes(k.text), s.slug);
    for (const f of s.fit) assert.ok(t.includes(f), s.slug);
    assert.ok(t.includes('These are this client’s results.') && t.includes(s.results.source), `${s.slug}: the numbers have a source and a caveat`);
    // A next step at every stage
    for (const where of ['story-hero', 'story-mid', 'story-fit', 'story-aside', 'story-final']) assert.ok(page.includes(`data-ai-check="${where}"`), `${s.slug} ${where}`);
    assert.ok((page.match(new RegExp(`data-plan-cta="${offer.id}"`, 'g')) || []).length >= 5, `${s.slug}: quote buttons in the hero, the side card, the solution, the end and the phone bar`);
    assert.ok(page.includes('data-stickybar') && page.includes('data-booking="story-fit"'), s.slug);
    // At a glance, and the solution behind the story with its starting price in all three currencies
    for (const fact of [s.client.name, s.client.industry, s.client.location, s.period, s.engines]) assert.ok(t.includes(fact), `${s.slug}: ${fact}`);
    assert.ok(page.includes(CURRENCIES.map((c) => `<span data-c="${c.id}">${money(c.id, offer.from[c.id])}</span>`).join('<i class="price__sep"> · </i>')), `${s.slug} price`);
    assert.ok(page.includes(`href="${solution.url}" data-solution="${solution.id}"`), s.slug);
    // The only amounts on the page are that starting price
    const allowed = new Set(CURRENCIES.map((c) => money(c.id, offer.from[c.id])));
    for (const m of t.matchAll(/[$£€]\s?\d[\d,]*/g)) assert.ok(allowed.has(m[0]), `${s.slug}: unexpected amount ${m[0]}`);
    const article = ldOf(page).find((g) => g['@type'] === 'Article');
    assert.deepEqual([article.headline, article.articleSection], [s.title, 'Success stories'], s.slug);
  }
});

test('drafts are built but hidden: not listed, not in the sitemap, the feed or llms.txt, and marked noindex', () => {
  const out = render();
  const drafts = [...allStories().filter((s) => s.draft).map((s) => [s, storyFile(s)]), ...allInsights().filter((p) => p.draft).map((p) => [p, postFile(p)])];
  assert.ok(drafts.length >= 1, 'the sample story is a draft');
  for (const [d, file] of drafts) {
    assert.ok(out[file].includes('<meta name="robots" content="noindex, follow">'), `${d.slug} noindex`);
    assert.ok(out[file].includes('class="draftnote"'), `${d.slug} banner`);
    for (const other of ['blog/index.html', 'blog/insights/index.html', 'blog/success-stories/index.html', 'blog/feed.xml', 'sitemap.xml', 'llms.txt', 'index.html']) {
      assert.ok(!out[other].includes(d.url), `${other} does not link to the draft ${d.slug}`);
    }
  }
  const sample = allStories().find((s) => s.sample);
  assert.ok(text(out[storyFile(sample)]).includes('Sample story. The business and every number on this page are illustrative.'));
});

test('published articles are listed, in the sitemap, the feed and llms.txt', () => {
  const out = render();
  for (const p of publishedInsights()) {
    for (const file of ['blog/index.html', 'blog/insights/index.html']) assert.ok(out[file].includes(`href="${p.url}"`), `${file}: ${p.slug}`);
    assert.ok(out['sitemap.xml'].includes(`<loc>https://searchwin.ai${p.url}</loc>`), `sitemap: ${p.slug}`);
    assert.ok(out['blog/feed.xml'].includes(`<link>https://searchwin.ai${p.url}</link>`), `feed: ${p.slug}`);
    assert.ok(out['llms.txt'].includes(`(https://searchwin.ai${p.url})`), `llms: ${p.slug}`);
    assert.ok(!out[postFile(p)].includes('noindex'), `${p.slug} is indexable`);
  }
  assert.ok(out['sitemap.xml'].includes('<loc>https://searchwin.ai/blog/</loc>') && out['sitemap.xml'].includes('<loc>https://searchwin.ai/blog/insights/</loc>'));
  assert.match(out['blog/feed.xml'], /^<\?xml version="1\.0"/);
  assert.equal((out['blog/feed.xml'].match(/<item>/g) || []).length, publishedInsights().length);
});

test('Success stories is linked only once a story is published; until then its page says so honestly', () => {
  assert.equal(publishedStories().length, 0, 'no client story has been approved yet');
  const before = render();
  for (const file of ['index.html', 'sprint/index.html', 'blog/index.html', 'blog/insights/index.html']) {
    assert.ok(!before[file].includes('href="/blog/success-stories/"'), `${file}: no link to an empty section`);
    assert.ok(before[file].includes('href="/blog/insights/"'), `${file}: Insights is linked`);
  }
  const empty = before['blog/success-stories/index.html'];
  assert.ok(empty.includes('<meta name="robots" content="noindex, follow">') && text(empty).includes('The first client stories are on their way.'));
  assert.ok(!before['sitemap.xml'].includes('/blog/success-stories/'));

  // Publish the first story (in memory only) and the section appears everywhere
  const story = STORIES[0];
  const was = { draft: story.draft, sample: story.sample };
  story.draft = false; story.sample = false;
  try {
    const after = render();
    const url = `/blog/success-stories/${story.slug}/`;
    for (const file of ['index.html', 'sprint/index.html', 'blog/insights/index.html']) {
      assert.ok(after[file].includes('<a href="/blog/success-stories/">Success stories</a>'), `${file}: nav link`);
    }
    for (const file of ['blog/index.html', 'blog/success-stories/index.html']) assert.ok(after[file].includes(`href="${url}"`), `${file} lists the story`);
    assert.ok(!after['blog/success-stories/index.html'].includes('noindex') && !after[storyFile(story)].includes('noindex'));
    assert.ok(!after[storyFile(story)].includes('class="draftnote"'));
    assert.ok(after['sitemap.xml'].includes(`<loc>https://searchwin.ai${url}</loc>`) && after['llms.txt'].includes(`(https://searchwin.ai${url})`));
    assert.ok(after[storyFile(story)].includes('<a href="/blog/success-stories/" aria-current="page">Success stories</a>'));
  } finally { story.draft = was.draft; story.sample = was.sample; }
  assert.deepEqual(render()['index.html'], before['index.html'], 'back to the committed state');
});

test('blog pages: one H1, the shared nav and footer, working inner links, no agency words or promises', () => {
  const out = render();
  const pages = Object.keys(out).filter((f) => f.startsWith('blog/') && f.endsWith('.html'));
  assert.ok(pages.length >= 7);
  const exists = (href) => {
    const clean = href.split('#')[0].split('?')[0];
    if (clean === '/') return true;
    const file = clean.replace(/^\//, '') + (clean.endsWith('/') ? 'index.html' : '');
    return file in out || fs.existsSync(path.join(root, file));
  };
  for (const file of pages) {
    const page = out[file];
    assert.equal((page.match(/<h1[\s>]/g) || []).length, 1, file);
    assert.ok(page.includes('class="nav__links"') && page.includes('class="footer home-footer"') && page.includes('href="/assets/css/blog.css"'), file);
    assert.ok(page.includes('<p class="footer__label">Blog</p>'), `${file} footer`);
    for (const m of page.matchAll(/href="(\/[^"]*)"/g)) assert.ok(exists(m[1]), `${file}: ${m[1]} leads nowhere`);
    const t = text(page);
    for (const w of ['bespoke', 'holistic', 'partner with us', 'unlock', 'skyrocket', 'game-chang', 'cutting-edge', 'supercharge']) assert.ok(!new RegExp(w, 'i').test(t), `${file}: ${w}`);
    for (const w of ['Gushwork', 'Nutshell', 'WebFX']) assert.ok(!new RegExp(w, 'i').test(page), `${file}: ${w}`);
    assert.ok(!/guarantee/i.test(t), `${file}: no promises of results`);
    assert.ok(!/class="(testimonial|client-logo)/i.test(page), file);
  }
});

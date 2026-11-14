// Pieces every generated page shares: escaping, icons, prices, the nav and footer, the <head> and the page shell.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, SOLUTIONS, CURRENCIES, DEFAULT_CURRENCY, BOOKING_URL, allOffers, money } from '../../data/solutions.js';
import { publishedStories } from './content.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.join(here, '..', '..');
export const partial = (name) => fs.readFileSync(path.join(here, '..', 'partials', name), 'utf8').replace(/\s+$/, '');

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const icon = (name, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} aria-hidden="true"><use href="#i-${name}"></use></svg>`;
export const ind = (s, n) => s.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');
export const pad2 = (n) => String(n).padStart(2, '0');
export const offersOf = (s) => allOffers().filter((o) => o.solution.id === s.id);
export const startUrl = (offerId) => `/start/?plan=${offerId}&amp;cur=${DEFAULT_CURRENCY}`;
export const unitWords = (s) => (s.unit.startsWith('/') ? 'a month' : s.unit);

// All three currencies are in the HTML; CSS shows the one in <html data-cur> (dollars without JS).
export const price = (from) => `<span class="price">${CURRENCIES.map((c) => `<span data-c="${c.id}">${money(c.id, from[c.id])}</span>`).join('<i class="price__sep"> · </i>')}</span>`;

export const BLOG = { hub: '/blog/', insights: '/blog/insights/', stories: '/blog/success-stories/', feed: '/blog/feed.xml' };

// "Success stories" joins the nav and the footer with the first published story: an empty section is not linked.
const hasStories = () => publishedStories().length > 0;

const NAV_LINKS = (p) => [
  ...SOLUTIONS.map((s) => ({ href: s.url, label: s.short, id: s.id })),
  { href: `${p}#platform`, label: 'Platform' },
  { href: BLOG.insights, label: 'Insights', id: 'insights' },
  ...(hasStories() ? [{ href: BLOG.stories, label: 'Success stories', id: 'stories' }] : [])
];

/** `current`: null on the homepage, otherwise the id of the nav link the page belongs to (a solution id, "insights", "stories") or any other string. */
export function navBlock(current) {
  const home = current === null;
  const p = home ? '' : '/';
  const link = (l) => `<a href="${l.href}"${l.id && l.id === current ? ' aria-current="page"' : ''}>${esc(l.label)}</a>`;
  const links = NAV_LINKS(p);
  return [
    `<header class="nav" data-nav>`,
    `  <div class="nav__bar">`,
    `    <a class="logo" href="${home ? '#top' : '/'}" aria-label="${home ? 'SearchWin.ai, back to top' : 'SearchWin.ai home'}">`,
    `      <span class="logo__word">searchwin.ai</span>`,
    `    </a>`,
    `    <nav class="nav__links" aria-label="Main">`,
    ...links.map((l) => `      ${link(l)}`),
    `    </nav>`,
    `    <a class="btn btn--primary btn--sm nav__cta" href="/ai-check/" data-ai-check="nav">`,
    `      <span class="nav__cta-long">Free AI check</span><span class="nav__cta-short">Free AI check</span>`,
    `    </a>`,
    `    <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="Open menu">`,
    `      <span></span><span></span>`,
    `    </button>`,
    `  </div>`,
    `  <div class="nav__menu" id="mobile-menu" hidden>`,
    ...links.map((l) => `    ${link(l)}`),
    `    <a class="btn btn--primary" href="/ai-check/" data-ai-check="menu">Run a free AI check</a>`,
    `  </div>`,
    `</header>`
  ].join('\n');
}

export function footerBlock(current) {
  const p = current === null ? '' : '/';
  return [
    `<footer class="footer home-footer">`,
    `  <div class="container">`,
    `    <ul class="promises promises--footer" aria-label="Our promises">`,
    ...['High-intent questions first', 'Pages that sell', 'Leads tracked to the page', 'A person edits every page', 'No lock-in', 'You own it'].map((x) => `      <li>${icon('check')}${esc(x)}</li>`),
    `    </ul>`,
    `    <div class="footer__top">`,
    `      <p class="footer__claim">Organic leads from AI search and Google.</p>`,
    `      <div class="footer__cols">`,
    `        <div>`,
    `          <p class="footer__label">Solutions</p>`,
    `          <ul>`,
    ...SOLUTIONS.map((s) => `            <li><a href="${s.url}" data-solution="${s.id}">${esc(s.name)}<span class="footer__meta"> · ${esc(s.kind.toLowerCase())}</span></a></li>`),
    `          </ul>`,
    `        </div>`,
    `        <div>`,
    `          <p class="footer__label">Platform</p>`,
    `          <ul>`,
    `            <li><a href="${p}#platform">People + AI agents</a></li>`,
    `            <li><a href="${p}#approach">Built for leads</a></li>`,
    `            <li><a href="${p}#how">How it works</a></li>`,
    `            <li><a href="${p}#who">Who it’s for</a></li>`,
    `            <li><a href="${p}#faq">FAQ</a></li>`,
    `          </ul>`,
    `        </div>`,
    `        <div>`,
    `          <p class="footer__label">Blog</p>`,
    `          <ul>`,
    `            <li><a href="${BLOG.insights}">Insights</a></li>`,
    ...(hasStories() ? [`            <li><a href="${BLOG.stories}">Success stories</a></li>`] : []),
    `            <li><a href="${BLOG.hub}">All posts</a></li>`,
    `          </ul>`,
    `        </div>`,
    `        <div>`,
    `          <p class="footer__label">Start</p>`,
    `          <ul>`,
    `            <li><a href="/ai-check/" data-ai-check="footer">Free AI check</a></li>`,
    `            <li><a href="${BOOKING_URL}" target="_blank" rel="noopener" data-booking="footer">Book a 15-minute call</a></li>`,
    `            <li><a href="mailto:hi@searchwin.ai">hi@searchwin.ai</a></li>`,
    `          </ul>`,
    `        </div>`,
    `      </div>`,
    `    </div>`,
    `    <p class="footer__word" aria-hidden="true">searchwin.ai</p>`,
    `    <div class="footer__bottom">`,
    `      <p>© 2026 SearchWin.ai. All rights reserved.</p>`,
    `      <p><a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a> · <a href="/llms.txt">llms.txt</a></p>`,
    `    </div>`,
    `  </div>`,
    `</footer>`
  ].join('\n');
}

export const headScriptBlock = () => `<script>\n${ind(partial('head.js'), 2)}\n</script>`;
export const spriteBlock = () => partial('sprite.html');

export function faqItems(list) {
  return list.map((f, i) => [
    `<details class="qa" data-faq="${i + 1}">`,
    `  <summary><span>${esc(f.q)}</span><span class="qa__icon" aria-hidden="true"></span></summary>`,
    `  <div class="qa__body"><p>${esc(f.a)}</p></div>`,
    `</details>`
  ].join('\n')).join('\n');
}

export const faqSchema = (list, id) => ({
  '@type': 'FAQPage',
  '@id': id,
  mainEntity: list.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
});

export const ld = (graph) => `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)}\n</script>`;

export const ORG = {
  '@type': 'Organization',
  '@id': `${SITE}/#org`,
  name: 'SearchWin.ai',
  url: `${SITE}/`,
  logo: `${SITE}/assets/img/apple-touch-icon.png`,
  email: 'hi@searchwin.ai',
  description: 'A human + AI agents platform for organic lead generation from AI search and Google: AI search optimization for your website and the outside sources AI reads, and hubs of organic conversion pages built around high-intent questions.',
  knowsAbout: ['Organic lead generation', 'AI search optimization', 'Generative engine optimization', 'Conversion pages', 'Local SEO', 'Google Business Profile']
};
export const WEBSITE = { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: 'SearchWin.ai' };

/**
 * A whole generated page: <head>, icon sprite, nav, <main>, footer and scripts.
 *   title, description, url (path), og (social title, without the site name)
 *   robots     defaults to index, follow
 *   css        extra stylesheets after styles.css and home.css
 *   head       extra lines for <head>
 *   schema     the JSON-LD <script>
 *   page       goes to <body data-page>, the analytics events carry it
 *   nav        which nav link is the current one
 *   main       the HTML inside <main>
 *   after      HTML between </main> and the footer
 *   source     where the content comes from, for the comment at the top
 */
export function pageShell(o) {
  const url = `${SITE}${o.url}`;
  const og = `${o.og || o.title.replace(/ \| searchwin\.ai$/, '')} | searchwin.ai`;
  return [
    `<!doctype html>`,
    `<html lang="en">`,
    `<head>`,
    `  <!-- Written by scripts/build-site.mjs from ${o.source}. Edit the source, then run npm run build:home. -->`,
    `  <meta charset="utf-8">`,
    `  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`,
    `  <title>${esc(o.title)}</title>`,
    `  <meta name="description" content="${esc(o.description)}">`,
    `  <link rel="canonical" href="${url}">`,
    `  <meta name="robots" content="${o.robots || 'index, follow, max-image-preview:large'}">`,
    `  <meta name="theme-color" content="#F6F4EF">`,
    ``,
    `  <meta property="og:type" content="${o.ogType || 'website'}">`,
    `  <meta property="og:site_name" content="SearchWin.ai">`,
    `  <meta property="og:title" content="${esc(og)}">`,
    `  <meta property="og:description" content="${esc(o.description)}">`,
    `  <meta property="og:url" content="${url}">`,
    `  <meta property="og:image" content="${SITE}/assets/img/og.png">`,
    `  <meta property="og:image:width" content="1200">`,
    `  <meta property="og:image:height" content="630">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <meta name="twitter:title" content="${esc(og)}">`,
    `  <meta name="twitter:description" content="${esc(o.description)}">`,
    `  <meta name="twitter:image" content="${SITE}/assets/img/og.png">`,
    ``,
    `  <link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">`,
    `  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">`,
    `  <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM-readable summary">`,
    ...(o.head ? o.head.split('\n').map((l) => `  ${l}`) : []),
    ``,
    `  <link rel="preload" href="/assets/fonts/source-serif-4-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>`,
    `  <link rel="stylesheet" href="/assets/css/styles.css">`,
    `  <link rel="stylesheet" href="/assets/css/home.css">`,
    ...(o.css || []).map((href) => `  <link rel="stylesheet" href="${href}">`),
    ``,
    ind(headScriptBlock(), 2),
    ``,
    ind(o.schema, 2),
    `</head>`,
    ``,
    `<body data-page="${o.page}">`,
    spriteBlock(),
    ``,
    `<a class="skip-link" href="#main">Skip to content</a>`,
    ``,
    navBlock(o.nav),
    ``,
    `<main id="main">`,
    ``,
    o.main,
    ``,
    `</main>`,
    ...(o.after ? [``, o.after] : []),
    ``,
    footerBlock(o.nav),
    ``,
    `<script src="/assets/js/ai-check-tracking.js" defer></script>`,
    `<script src="/assets/js/home.js" defer></script>`,
    `<script>`,
    `  // Motion and smooth scrolling load after the page has painted, so they never hold up the first screen.`,
    `  window.addEventListener('load', function () {`,
    `    var list = ['/assets/vendor/gsap.min.js', '/assets/vendor/ScrollTrigger.min.js', '/assets/vendor/lenis.min.js', '/assets/js/main.js'];`,
    `    (function next(i) {`,
    `      if (i >= list.length) return;`,
    `      var el = document.createElement('script');`,
    `      el.src = list[i];`,
    `      el.onload = el.onerror = function () { next(i + 1); };`,
    `      document.body.appendChild(el);`,
    `    })(0);`,
    `  });`,
    `</script>`,
    `</body>`,
    `</html>`,
    ``
  ].join('\n');
}

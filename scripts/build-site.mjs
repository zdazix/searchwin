// Renders everything that comes from data/solutions.js and data/faq.js:
//
//   index.html          blocks between <!-- build:NAME --> markers: head script, JSON-LD, icon sprite, nav,
//                       the solution cards, the Pages card, the team (AI agents and people), FAQ, footer
//   sprint/index.html   )
//   monthly/index.html  ) the three solution pages, written whole
//   pages/index.html    )
//   llms.txt            the solutions block
//   start/index.html    the plan list of the order form and its data
//
// Everything outside the markers on the homepage, llms.txt and /start/ is written by hand.
//
//   npm run build:home                     rewrite the files
//   node scripts/build-site.mjs --check    exit 1 if a file is out of date (the tests run this)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE, SOLUTIONS, AUDIENCES, CURRENCIES, DEFAULT_CURRENCY, AGENTS, PEOPLE, TEAM_BENEFITS, BOOKING_URL,
  allOffers, money, fromPrice, allCurrencies
} from '../data/solutions.js';
import { FAQ } from '../data/faq.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const partial = (name) => fs.readFileSync(path.join(here, 'partials', name), 'utf8').replace(/\s+$/, '');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const icon = (name, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const ind = (s, n) => s.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');
const pad2 = (n) => String(n).padStart(2, '0');
const offersOf = (s) => allOffers().filter((o) => o.solution.id === s.id);
const startUrl = (offerId) => `/start/?plan=${offerId}&amp;cur=${DEFAULT_CURRENCY}`;
const unitWords = (s) => (s.unit.startsWith('/') ? 'a month' : s.unit);

/* ---------------------------------------------------------------- shared pieces */

// All three currencies are in the HTML; CSS shows the one in <html data-cur> (dollars without JS).
const price = (from) => `<span class="price">${CURRENCIES.map((c) => `<span data-c="${c.id}">${money(c.id, from[c.id])}</span>`).join('<i class="price__sep"> · </i>')}</span>`;

const NAV_LINKS = (p) => [
  ...SOLUTIONS.map((s) => ({ href: s.url, label: s.short === 'Sprint' ? 'Sprint' : s.short, id: s.id })),
  { href: `${p}#platform`, label: 'Platform' },
  { href: `${p}#how`, label: 'How it works' }
];

/** `current` is a solution id on its own page, null on the homepage. */
function navBlock(current) {
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

function footerBlock(current) {
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

const headScriptBlock = () => `<script>\n${ind(partial('head.js'), 2)}\n</script>`;
const spriteBlock = () => partial('sprite.html');

function faqItems(list) {
  return list.map((f, i) => [
    `<details class="qa" data-faq="${i + 1}">`,
    `  <summary><span>${esc(f.q)}</span><span class="qa__icon" aria-hidden="true"></span></summary>`,
    `  <div class="qa__body"><p>${esc(f.a)}</p></div>`,
    `</details>`
  ].join('\n')).join('\n');
}

const faqSchema = (list, id) => ({
  '@type': 'FAQPage',
  '@id': id,
  mainEntity: list.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
});

const ld = (graph) => `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)}\n</script>`;

const ORG = {
  '@type': 'Organization',
  '@id': `${SITE}/#org`,
  name: 'SearchWin.ai',
  url: `${SITE}/`,
  logo: `${SITE}/assets/img/apple-touch-icon.png`,
  email: 'hi@searchwin.ai',
  description: 'A human + AI agents platform for organic lead generation from AI search and Google: AI search optimization for your website and the outside sources AI reads, and hubs of organic conversion pages built around high-intent questions.',
  knowsAbout: ['Organic lead generation', 'AI search optimization', 'Generative engine optimization', 'Conversion pages', 'Local SEO', 'Google Business Profile']
};
const WEBSITE = { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: 'SearchWin.ai' };

/* ---------------------------------------------------------------- homepage blocks */

const HOME_TITLE = 'Organic Lead Generation for the AI Search Era | searchwin.ai';
const HOME_DESCRIPTION = 'A human + AI agents platform that gets your business found on high-intent questions in ChatGPT, Gemini and Google, and turns those visits into calls, forms and bookings.';

function homeSchemaBlock() {
  return ld([
    ORG,
    WEBSITE,
    { '@type': 'WebPage', '@id': `${SITE}/#page`, url: `${SITE}/`, name: HOME_TITLE, description: HOME_DESCRIPTION, isPartOf: { '@id': `${SITE}/#website` }, about: { '@id': `${SITE}/#org` } },
    // No prices here: the homepage shows none. Each solution page carries its starting price.
    ...SOLUTIONS.map((s) => ({
      '@type': 'Service',
      '@id': `${SITE}${s.url}#service`,
      name: s.longName ? `${s.name}: ${s.longName.toLowerCase()}` : s.name,
      serviceType: 'Organic lead generation from AI search and Google',
      url: `${SITE}${s.url}`,
      provider: { '@id': `${SITE}/#org` },
      areaServed: ['US', 'GB', 'EU'],
      description: `${s.kind}. ${s.scope}. ${s.card.text}`
    })),
    faqSchema(FAQ, `${SITE}/#faq`)
  ]);
}

function solutionCard(s) {
  return [
    `<article class="solcard" data-reveal>`,
    `  <p class="solcard__kind">${esc(s.kind)}</p>`,
    `  <h3 class="solcard__name">${esc(s.name)}</h3>`,
    `  <p class="solcard__text">${esc(s.card.text)}</p>`,
    `  <ul class="solcard__list">`,
    ...s.card.points.map((x) => `    <li>${icon('check')}${esc(x)}</li>`),
    `  </ul>`,
    `  <a class="btn btn--dark solcard__cta" href="${s.url}" data-solution="${s.id}">${esc(s.card.cta)}${icon('arrow', 'btn__icon')}</a>`,
    `</article>`
  ].join('\n');
}

// The two solutions for "your website and the outside sources AI reads"; Pages has its own section.
const homeSolutionsBlock = () => SOLUTIONS.filter((s) => s.id !== 'pages').map(solutionCard).join('\n');

function homePagesCardBlock() {
  const s = SOLUTIONS.find((x) => x.id === 'pages');
  return [
    `<p class="lead" data-reveal>${esc(s.card.text)}</p>`,
    `<ul class="hub__list">`,
    ...s.card.points.map((x) => `  <li data-reveal>${icon('check')}${esc(x)}</li>`),
    `</ul>`,
    `<a class="btn btn--primary btn--lg" href="${s.url}" data-solution="${s.id}" data-reveal>${esc(s.card.cta)}${icon('arrow', 'btn__icon')}</a>`
  ].join('\n');
}

function homeTeamBlock() {
  return [
    `<div class="team__group">`,
    `  <p class="team__label" data-reveal>${icon('spark')}AI agents do the volume</p>`,
    `  <ul class="agents">`,
    ...AGENTS.map((a, i) => `    <li class="agent" data-reveal><p class="agent__job">${pad2(i + 1)} · ${esc(a.job)}</p><h3 class="agent__name">${esc(a.name)}</h3><p class="agent__text">${esc(a.text)}</p></li>`),
    `  </ul>`,
    `</div>`,
    `<div class="team__group">`,
    `  <p class="team__label" data-reveal>${icon('user')}People make the calls</p>`,
    `  <ul class="people">`,
    ...PEOPLE.map((p) => `    <li class="person" data-reveal><h3 class="person__name">${esc(p.name)}</h3><p class="person__text">${esc(p.text)}</p></li>`),
    `  </ul>`,
    `</div>`,
    `<div class="team__group">`,
    `  <p class="team__label" data-reveal>${icon('check')}What that gets you</p>`,
    `  <ul class="benefits">`,
    ...TEAM_BENEFITS.map((b) => `    <li class="benefit" data-reveal><h3 class="benefit__title">${esc(b.title)}</h3><p>${esc(b.text)}</p></li>`),
    `  </ul>`,
    `</div>`
  ].join('\n');
}

/* ---------------------------------------------------------------- solution pages */

const band = (bg, cls) => (bg === 'cream' ? `section ${cls}` : `band band--${bg} ${cls}`);

function head(h, id) {
  return [
    `<header class="head head--split">`,
    `  <div class="head__main">`,
    `    <p class="eyebrow" data-reveal>${esc(h.eyebrow)}</p>`,
    `    <h2 class="h2" id="${id}" data-reveal>${esc(h.title)}</h2>`,
    `  </div>`,
    `  <p class="lead" data-reveal>${esc(h.lead)}</p>`,
    `</header>`
  ].join('\n');
}

function section(bg, cls, id, inner) {
  return [`<section class="${band(bg, cls)}" id="${id}" aria-labelledby="${id}-title">`, `  <div class="container">`, ind(inner, 4), `  </div>`, `</section>`].join('\n');
}

function curSwitch() {
  return [
    `<div class="curswitch" role="group" aria-label="Currency">`,
    ...CURRENCIES.map((c) => `  <button type="button" class="curswitch__btn" data-cur-btn="${c.id}" aria-pressed="${c.id === DEFAULT_CURRENCY}" aria-label="${esc(c.name)}">${c.symbol}</button>`),
    `</div>`
  ].join('\n');
}

function priceBox(s) {
  const offers = offersOf(s);
  return [
    `<aside class="pricebox" aria-label="Starting prices">`,
    `  <div class="pricebox__top">`,
    `    <p class="pricebox__title">Starting ${offers.length > 1 ? 'prices' : 'price'}</p>`,
    ind(curSwitch(), 4),
    `  </div>`,
    `  <ul class="pricebox__rows">`,
    ...offers.map((o) => [
      `    <li class="pricebox__row">`,
      `      <p class="pricebox__who">${esc(o.audienceLabel || s.longName || s.name)}</p>`,
      `      <p class="pricebox__price"><span class="pricebox__from">from</span> ${price(o.from)}${s.unit.startsWith('/') ? '' : ' '}<span class="pricebox__unit">${esc(s.unit)}</span></p>`,
      `      <a class="btn btn--dark btn--sm pricebox__cta" href="${startUrl(o.id)}" data-plan-cta="${o.id}" aria-label="Get a quote: ${esc(o.name)}">Get a quote${icon('arrow', 'btn__icon')}</a>`,
      `    </li>`
    ].join('\n')),
    `  </ul>`,
    `  <p class="pricebox__note">${esc(s.billing)} Exact scope and price in writing before you pay.</p>`,
    `</aside>`
  ].join('\n');
}

function heroSection(s) {
  const first = offersOf(s)[0];
  return [
    `<section class="hero sol-hero" id="top" aria-labelledby="hero-title">`,
    `  <div class="container sol-hero__grid">`,
    `    <div class="sol-hero__main">`,
    `      <p class="eyebrow">${esc(s.hero.eyebrow)}</p>`,
    `      <h1 class="h1 sol-hero__title" id="hero-title">${esc(s.hero.title)}</h1>`,
    `      <p class="lead">${esc(s.hero.lead)}</p>`,
    `      <div class="sol-hero__ctas">`,
    `        <a class="btn btn--primary btn--lg" href="${startUrl(first.id)}" data-plan-cta="${first.id}">Get a fixed quote${icon('arrow', 'btn__icon')}</a>`,
    `        <a class="btn btn--outline btn--lg" href="/ai-check/" data-ai-check="hero">Run a free AI check</a>`,
    `      </div>`,
    `      <p class="sol-hero__scope">${icon('check')}<span><b>Works on:</b> ${esc(s.scope.charAt(0).toLowerCase() + s.scope.slice(1))}</span></p>`,
    `    </div>`,
    ind(priceBox(s), 4),
    `  </div>`,
    `</section>`
  ].join('\n');
}

const RENDER = {
  model(s, bg) {
    const m = s.model;
    return section(bg, 'how', 'what', [
      head(m, 'what-title'),
      `<div class="model__grid model__grid--page">`,
      ...m.steps.map((st, i) => [
        `  <article class="model__step${i === m.steps.length - 1 ? ' model__step--win' : ''}" data-reveal>`,
        `    <p class="model__n">${pad2(i + 1)} · ${esc(st.where)}</p>`,
        `    <h3 class="model__name">${esc(st.name)}</h3>`,
        `    <p class="model__lede">${esc(st.lede)}</p>`,
        `    <ul class="model__list">`,
        ...st.items.map((x) => `      <li>${esc(x)}</li>`),
        `    </ul>`,
        `  </article>`
      ].join('\n')),
      `</div>`
    ].join('\n'));
  },

  offers(s, bg) {
    const offers = offersOf(s);
    const h = {
      eyebrow: offers.length > 1 ? 'Starting prices' : 'Starting price',
      title: 'What the starting price covers.',
      lead: s.priceNote
    };
    const out = [head(h, 'price-title'), `<div class="scope__grid scope__grid--${offers.length}">`];
    for (const o of offers) {
      const a = o.audience ? AUDIENCES[o.audience] : null;
      out.push(
        `  <article class="plan scope__card" data-plan="${o.id}" data-reveal>`,
        `    <div class="scope__top">`,
        `      <h3 class="plan__name">${esc(a ? a.label : s.name)}</h3>`,
        `      <p class="plan__promise">${esc(a ? a.who : s.longName + ' on your domain.')}</p>`,
        `      <p class="plan__price"><span class="plan__from">from</span> ${price(o.from)}${s.unit.startsWith('/') ? '' : ' '}<span class="plan__unit">${esc(s.unit)}</span></p>`,
        `      <p class="plan__billing">${esc(s.billing)}</p>`,
        `      <a class="btn btn--primary btn--block plan__cta" href="${startUrl(o.id)}" data-plan-cta="${o.id}">Get a fixed quote${icon('arrow', 'btn__icon')}</a>`,
        `    </div>`,
        `    <div class="scope__body">`,
        `      <p class="scope__label">${a ? 'Starting scope' : 'Included from the start'}</p>`,
        `      <ul class="plan__list">`,
        ...o.covers.map((x) => `        <li>${icon('check')}${esc(x)}</li>`),
        `      </ul>`,
        `    </div>`,
        `  </article>`
      );
    }
    out.push(`</div>`);
    if (s.rule) out.push(`<p class="pricing__rule" data-reveal>${icon('calendar')}${esc(s.rule)}</p>`);
    if (s.excluded) {
      out.push(
        `<div class="pricing__excl" data-reveal>`,
        `  <p class="pricing__excl-title">Not included</p>`,
        `  <ul>${s.excluded.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`,
        `</div>`
      );
    }
    return section(bg, 'scope', 'price', out.join('\n'));
  },

  timeline(s, bg) {
    const t = s.timeline;
    return section(bg, 'how', 'timeline', [
      head(t, 'timeline-title'),
      `<ol class="flowsteps flowsteps--${t.steps.length}">`,
      ...t.steps.map((st, i) => [
        `  <li class="flowstep" data-reveal>`,
        `    <p class="flowstep__when">${esc(st.when)}</p>`,
        `    <h3 class="flowstep__title"><span class="flowstep__n">${i + 1}</span>${esc(st.title)}</h3>`,
        `    <p>${esc(st.text)}</p>`,
        `  </li>`
      ].join('\n')),
      `</ol>`
    ].join('\n'));
  },

  sample() {
    return partial('sample-report.html');
  },

  versus(s, bg) {
    const v = s.versus;
    return section(bg, 'who', 'versus', [
      `<header class="head head--center">`,
      `  <p class="eyebrow" data-reveal>${esc(v.eyebrow)}</p>`,
      `  <h2 class="h2" id="versus-title" data-reveal>${esc(v.title)}</h2>`,
      `</header>`,
      `<div class="who__grid">`,
      ...v.columns.map((c) => [
        `  <article class="who__col" data-reveal>`,
        `    <h3 class="who__title">${esc(c.name)}</h3>`,
        `    <p class="who__lede">${esc(c.text)}</p>`,
        `    <ul class="plan__list">`,
        ...c.items.map((x) => `      <li>${icon('check')}${esc(x)}</li>`),
        `    </ul>`,
        c.url === s.url
          ? `    <a class="btn btn--dark" href="#price">See the starting price${icon('arrow', 'btn__icon')}</a>`
          : `    <a class="btn btn--dark" href="${c.url}" data-solution="${c.url.replace(/\//g, '')}">See ${esc(c.name)}${icon('arrow', 'btn__icon')}</a>`,
        `  </article>`
      ].join('\n')),
      `</div>`
    ].join('\n'));
  },

  team(s, bg) {
    const h = {
      eyebrow: 'People + AI agents',
      title: 'Agents do the volume. People make the calls.',
      lead: 'AI agents run the research, the checks and the first drafts. A person edits every page and owns the plan, and nothing is published without your approval.'
    };
    return section(bg, 'team team--compact', 'team', [
      head(h, 'team-title'),
      `<div class="team__cols">`,
      `  <div class="team__col" data-reveal>`,
      `    <p class="team__label">${icon('spark')}AI agents</p>`,
      `    <ul class="team__list">`,
      ...AGENTS.map((a) => `      <li><b>${esc(a.name)}</b><span>${esc(a.job)}</span></li>`),
      `    </ul>`,
      `  </div>`,
      `  <div class="team__col" data-reveal>`,
      `    <p class="team__label">${icon('user')}People</p>`,
      `    <ul class="team__list">`,
      ...PEOPLE.map((p) => `      <li><b>${esc(p.name)}</b><span>${esc(p.text)}</span></li>`),
      `    </ul>`,
      `  </div>`,
      `</div>`,
      `<p class="team__more" data-reveal><a class="textlink" href="/#platform">How the platform works</a></p>`
    ].join('\n'));
  },

  why(s, bg) {
    const w = s.why;
    return section(bg, 'why', 'why', [
      head(w, 'why-title'),
      `<ol class="pcards">`,
      ...w.cards.map((c, i) => `  <li class="pcard" data-reveal><span class="pcard__n">${pad2(i + 1)}</span><h3 class="pcard__title">${esc(c.title)}</h3><p>${esc(c.text)}</p></li>`),
      `</ol>`
    ].join('\n'));
  },

  steps(s, bg) {
    const st = s.steps;
    return section(bg, 'how', 'how', [
      head(st, 'how-title'),
      `<ol class="pcards pcards--steps">`,
      ...st.items.map((c, i) => `  <li class="pcard" data-reveal><span class="flowstep__n">${i + 1}</span><h3 class="pcard__title">${esc(c.title)}</h3><p>${esc(c.text)}</p></li>`),
      `</ol>`
    ].join('\n'));
  },

  formats(s, bg) {
    const f = s.formats;
    return section(bg, 'formats', 'formats', [
      head(f, 'formats-title'),
      `<ul class="pcards pcards--4">`,
      ...f.items.map((c) => `  <li class="pcard" data-reveal>${icon('page', 'pcard__icon')}<h3 class="pcard__title">${esc(c.title)}</h3><p>${esc(c.text)}</p></li>`),
      `</ul>`
    ].join('\n'));
  },

  anatomy(s, bg) {
    const a = s.anatomy;
    const n = (i) => `<b class="pagemock__n">${i}</b>`;
    return section(bg, 'anatomy', 'anatomy', [
      head(a, 'anatomy-title'),
      `<div class="anatomy__grid">`,
      `  <div class="pagemock" aria-hidden="true" data-reveal>`,
      `    <div class="pagemock__bar"><i></i><i></i><i></i><span>yourbusiness.com/guides/dental-implants-austin</span></div>`,
      `    <div class="pagemock__body">`,
      `      <p class="illus">Illustrative example</p>`,
      `      <p class="pagemock__h">Dental implants in Austin: cost, options and how to choose</p>`,
      `      <div class="pagemock__block pagemock__block--answer">${n(1)}<p class="pagemock__label">Short answer</p><s></s><s></s><s class="short"></s></div>`,
      `      <div class="pagemock__proof">${n(2)}<span>${icon('star')}4.9 from patients</span><span>Licensed clinic</span><span>Before and after cases</span></div>`,
      `      <div class="pagemock__block">${n(3)}<p class="pagemock__label">What’s included · price range</p><s></s><s class="short"></s></div>`,
      `      <div class="pagemock__cta">${n(4)}<span class="pagemock__btn pagemock__btn--main">Book a consultation</span><span class="pagemock__btn">Call the clinic</span></div>`,
      `      <div class="pagemock__block">${n(5)}<p class="pagemock__label">Questions patients ask</p><s></s><s></s></div>`,
      `      <p class="pagemock__track">${n(6)}Enquiry tracked to this page</p>`,
      `    </div>`,
      `  </div>`,
      `  <ol class="anatomy__list">`,
      ...a.items.map((c, i) => `    <li data-reveal><b>${i + 1}</b><div><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></div></li>`),
      `  </ol>`,
      `</div>`
    ].join('\n'));
  },

  features(s, bg) {
    const f = s.features;
    return section(bg, 'features', 'features', [
      head(f, 'features-title'),
      `<ul class="pcards">`,
      ...f.items.map((c) => `  <li class="pcard" data-reveal>${icon('check', 'pcard__tick')}<h3 class="pcard__title">${esc(c.title)}</h3><p>${esc(c.text)}</p></li>`),
      `</ul>`
    ].join('\n'));
  },

  faq(s, bg) {
    return [
      `<section class="faq ${band(bg, '').trim()}" id="faq" aria-labelledby="faq-title">`,
      `  <div class="container faq__grid">`,
      `    <header class="faq__head">`,
      `      <p class="eyebrow" data-reveal>FAQ</p>`,
      `      <h2 class="h2" id="faq-title" data-reveal>Questions about ${esc(s.id === 'pages' ? 'Pages' : `the ${s.short === 'Monthly' ? 'monthly work' : 'sprint'}`)}</h2>`,
      `      <p class="lead" data-reveal>Not sure it fits? The free AI check shows where you stand today.</p>`,
      `      <a class="btn btn--dark" href="/ai-check/" data-ai-check="faq" data-reveal>Run a free AI check${icon('arrow', 'btn__icon')}</a>`,
      `    </header>`,
      `    <div class="faq__list">`,
      ind(faqItems(s.faq), 6),
      `    </div>`,
      `  </div>`,
      `</section>`
    ].join('\n');
  }
};

function finalCta(s) {
  const first = offersOf(s)[0];
  return [
    `<section class="cta band band--image home-cta" id="start" aria-labelledby="cta-title">`,
    `  <img class="band__bg" src="/assets/img/bg/bg-sunset.webp" alt="" width="1280" height="854" loading="lazy">`,
    `  <div class="container home-cta__inner">`,
    `    <p class="eyebrow" data-reveal>Next step</p>`,
    `    <h2 class="h2" id="cta-title" data-reveal>Get your scope and a fixed price in writing.</h2>`,
    `    <p class="lead" data-reveal>Tell us about your business. Nothing is charged until you approve the scope.</p>`,
    `    <div class="home-cta__actions" data-reveal>`,
    `      <a class="btn btn--primary btn--lg" href="${startUrl(first.id)}" data-plan-cta="${first.id}">Get a fixed quote${icon('arrow', 'btn__icon')}</a>`,
    `      <a class="textlink home-cta__link" href="/ai-check/" data-ai-check="final">Or run a free AI check first</a>`,
    `      <a class="textlink home-cta__link" href="${BOOKING_URL}" target="_blank" rel="noopener" data-booking="final">Book a 15-minute call</a>`,
    `    </div>`,
    `  </div>`,
    `</section>`
  ].join('\n');
}

function solutionSchema(s) {
  const url = `${SITE}${s.url}`;
  return ld([
    ORG,
    WEBSITE,
    { '@type': 'WebPage', '@id': `${url}#page`, url, name: s.meta.title, description: s.meta.description, isPartOf: { '@id': `${SITE}/#website` }, about: { '@id': `${url}#service` } },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'searchwin.ai', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: s.name, item: url }
      ]
    },
    {
      '@type': 'Service',
      '@id': `${url}#service`,
      name: s.longName ? `${s.name}: ${s.longName.toLowerCase()}` : s.name,
      serviceType: 'Organic lead generation from AI search and Google',
      url,
      provider: { '@id': `${SITE}/#org` },
      areaServed: ['US', 'GB', 'EU'],
      description: s.hero.lead,
      offers: offersOf(s).map((o) => ({
        '@type': 'Offer',
        name: o.name,
        url: `${SITE}/start/?plan=${o.id}`,
        description: `From ${allCurrencies(o)} ${unitWords(s)}. ${o.audience ? 'Starting scope' : 'Included'}: ${o.covers.join('; ')}.`,
        priceSpecification: CURRENCIES.map((c) => ({
          '@type': 'UnitPriceSpecification',
          minPrice: o.from[c.id],
          priceCurrency: c.code,
          ...(s.schemaUnit ? { unitCode: s.schemaUnit, unitText: 'month' } : {})
        }))
      }))
    },
    faqSchema(s.faq, `${url}#faq`)
  ]);
}

function solutionPage(s) {
  const url = `${SITE}${s.url}`;
  let flip = 'cream';
  const sections = s.sections.map((name) => {
    const bg = name === 'sample' || name === 'anatomy' ? 'dark' : (flip = flip === 'beige' ? 'cream' : 'beige');
    return RENDER[name](s, bg);
  });
  return [
    `<!doctype html>`,
    `<html lang="en">`,
    `<head>`,
    `  <!-- Written by scripts/build-site.mjs from data/solutions.js. Edit the data, then run npm run build:home. -->`,
    `  <meta charset="utf-8">`,
    `  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`,
    `  <title>${esc(s.meta.title)}</title>`,
    `  <meta name="description" content="${esc(s.meta.description)}">`,
    `  <link rel="canonical" href="${url}">`,
    `  <meta name="robots" content="index, follow, max-image-preview:large">`,
    `  <meta name="theme-color" content="#F6F4EF">`,
    ``,
    `  <meta property="og:type" content="website">`,
    `  <meta property="og:site_name" content="SearchWin.ai">`,
    `  <meta property="og:title" content="${esc(s.meta.og)} | searchwin.ai">`,
    `  <meta property="og:description" content="${esc(s.meta.description)}">`,
    `  <meta property="og:url" content="${url}">`,
    `  <meta property="og:image" content="${SITE}/assets/img/og.png">`,
    `  <meta property="og:image:width" content="1200">`,
    `  <meta property="og:image:height" content="630">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <meta name="twitter:title" content="${esc(s.meta.og)} | searchwin.ai">`,
    `  <meta name="twitter:description" content="${esc(s.meta.description)}">`,
    `  <meta name="twitter:image" content="${SITE}/assets/img/og.png">`,
    ``,
    `  <link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">`,
    `  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">`,
    `  <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM-readable summary">`,
    ``,
    `  <link rel="preload" href="/assets/fonts/source-serif-4-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>`,
    `  <link rel="stylesheet" href="/assets/css/styles.css">`,
    `  <link rel="stylesheet" href="/assets/css/home.css">`,
    ``,
    ind(headScriptBlock(), 2),
    ``,
    ind(solutionSchema(s), 2),
    `</head>`,
    ``,
    `<body class="solution-page" data-solution-page="${s.id}">`,
    spriteBlock(),
    ``,
    `<a class="skip-link" href="#main">Skip to content</a>`,
    ``,
    navBlock(s.id),
    ``,
    `<main id="main">`,
    ``,
    heroSection(s),
    ``,
    sections.join('\n\n'),
    ``,
    finalCta(s),
    ``,
    `</main>`,
    ``,
    footerBlock(s.id),
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

/* ---------------------------------------------------------------- llms.txt */

function llmsBlock() {
  const out = [];
  out.push('## Solutions and starting prices');
  out.push('');
  out.push('Each solution has a starting price. The exact scope and a fixed price are sent in writing before you pay, in US dollars, euros or British pounds. No solution promises rankings, leads or revenue.');
  for (const s of SOLUTIONS) {
    out.push('');
    out.push(`### ${s.longName ? `${s.name} (${s.longName.toLowerCase()})` : s.name}`);
    out.push(`${s.kind}. Works on: ${s.scope.charAt(0).toLowerCase() + s.scope.slice(1)}. Page: ${SITE}${s.url}`);
    out.push(s.card.text);
    for (const o of offersOf(s)) {
      out.push(`- ${o.audienceLabel ? `${o.audienceLabel}: from` : 'From'} ${allCurrencies(o)} ${unitWords(s)}. ${o.audience ? 'Starting scope' : 'Included'}: ${o.covers.join('; ')}.`);
    }
    out.push(s.billing);
    if (s.rule) out.push(s.rule);
  }
  return out.join('\n');
}

/* ---------------------------------------------------------------- /start/ order form */

function startOptionsBlock() {
  return SOLUTIONS.map((s) => [
    `<optgroup label="${esc(s.name)} · ${esc(s.kind.toLowerCase())}">`,
    ...offersOf(s).map((o) => `  <option value="${o.id}">${esc(o.audienceLabel ? `${s.short}: ${o.audienceLabel.toLowerCase()}` : s.name)} (${esc(fromPrice(o, DEFAULT_CURRENCY))})</option>`),
    `</optgroup>`
  ].join('\n')).join('\n');
}

function startDataBlock() {
  const data = {};
  for (const o of allOffers()) {
    const s = o.solution;
    data[o.id] = {
      solution: s.name,
      kind: s.kind,
      audience: o.audienceLabel,
      label: o.audienceLabel ? `${s.short}: ${o.audienceLabel.toLowerCase()}` : s.name,
      sprint: s.id === 'sprint',
      from: o.from,
      unit: s.unit,
      billing: s.billing,
      scopeLabel: o.audience ? 'Starting scope' : 'Included from the start',
      items: o.covers,
      url: s.url
    };
  }
  return `<script type="application/json" id="plans-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/* ---------------------------------------------------------------- write */

// Files with marker blocks
const BLOCKS = {
  'index.html': {
    'head-script': headScriptBlock,
    schema: homeSchemaBlock,
    sprite: spriteBlock,
    nav: () => navBlock(null),
    solutions: homeSolutionsBlock,
    'pages-card': homePagesCardBlock,
    team: homeTeamBlock,
    faq: () => faqItems(FAQ),
    footer: () => footerBlock(null)
  },
  'llms.txt': { solutions: llmsBlock },
  'start/index.html': { 'plan-options': startOptionsBlock, 'plans-data': startDataBlock }
};

function fill(text, name, html, file) {
  const re = new RegExp(`([ \\t]*)<!-- build:${name} -->[\\s\\S]*?<!-- /build:${name} -->`);
  const m = text.match(re);
  if (!m) throw new Error(`${file}: markers for "${name}" not found`);
  const padding = m[1];
  const body = html.split('\n').map((l) => (l ? padding + l : l)).join('\n');
  return text.replace(re, () => `${padding}<!-- build:${name} -->\n${body}\n${padding}<!-- /build:${name} -->`);
}

export { HOME_TITLE, HOME_DESCRIPTION };

export function render() {
  const out = {};
  for (const [file, blocks] of Object.entries(BLOCKS)) {
    let text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const [name, fn] of Object.entries(blocks)) text = fill(text, name, fn(), file);
    out[file] = text;
  }
  for (const s of SOLUTIONS) out[`${s.url.replace(/^\/|\/$/g, '')}/index.html`] = solutionPage(s);
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const stale = [];
  for (const [file, text] of Object.entries(render())) {
    const full = path.join(root, file);
    if (fs.existsSync(full) && fs.readFileSync(full, 'utf8') === text) continue;
    if (check) stale.push(file);
    else { fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, text); console.log('updated', file); }
  }
  if (check && stale.length) { console.error('Out of date, run npm run build:home:', stale.join(', ')); process.exit(1); }
}

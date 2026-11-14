// Writes every generated file of the site:
//
//   index.html          blocks between <!-- build:NAME --> markers: head script, JSON-LD, icon sprite, nav,
//                       the solution cards, the Pages card, the team (AI agents and people), FAQ, footer
//   sprint/, monthly/, pages/     the three solution pages, written whole (data/solutions.js)
//   blog/               the hub, Insights (content/insights/*.md) and Success stories (data/stories.js),
//                       written whole by scripts/lib/blog.mjs, plus blog/feed.xml
//   llms.txt            the solutions block and the blog block
//   sitemap.xml         the blog block
//   start/index.html    the plan list of the order form and its data
//
// Everything outside the markers on the homepage, llms.txt, sitemap.xml and /start/ is written by hand.
//
//   npm run build:home                     rewrite the files
//   node scripts/build-site.mjs --check    exit 1 if a file is out of date (the tests run this)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE, SOLUTIONS, AUDIENCES, CURRENCIES, DEFAULT_CURRENCY, AGENTS, PEOPLE, TEAM_BENEFITS, BOOKING_URL,
  allOffers, fromPrice, allCurrencies
} from '../data/solutions.js';
import { FAQ } from '../data/faq.js';
import {
  root, partial, esc, icon, ind, pad2, offersOf, startUrl, unitWords, price,
  navBlock, footerBlock, headScriptBlock, spriteBlock, faqItems, faqSchema, ld, ORG, WEBSITE, pageShell
} from './lib/shared.mjs';
import { renderBlog, sitemapBlock, llmsBlogBlock } from './lib/blog.mjs';

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
  let flip = 'cream';
  const sections = s.sections.map((name) => {
    const bg = name === 'sample' || name === 'anatomy' ? 'dark' : (flip = flip === 'beige' ? 'cream' : 'beige');
    return RENDER[name](s, bg);
  });
  return pageShell({
    title: s.meta.title,
    description: s.meta.description,
    url: s.url,
    og: s.meta.og,
    page: s.id,
    nav: s.id,
    source: 'data/solutions.js',
    schema: solutionSchema(s),
    main: [heroSection(s), ``, sections.join('\n\n'), ``, finalCta(s)].join('\n')
  });
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
  'llms.txt': { solutions: llmsBlock, blog: llmsBlogBlock },
  'sitemap.xml': { blog: sitemapBlock },
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
  Object.assign(out, renderBlog());
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

// Renders the plans (data/plans.js) and the FAQ (data/faq.js) into the pages that show them:
// pricing cards, comparison tables, FAQ, JSON-LD and footer links on the homepage, the plan list in
// llms.txt and the plan picker on /start/. Each block sits between <!-- build:NAME --> and
// <!-- /build:NAME --> markers; everything outside the markers is written by hand.
//
//   npm run build:home            rewrite the blocks
//   node scripts/build-home.mjs --check   exit 1 if a page is out of date (the tests run this)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUSINESS_TYPES, LINES, CURRENCIES, DEFAULT_CURRENCY, MONTHLY_RULE,
  allPlans, cardItems, missingItems, formatPrice, priceWithUnit, lowestSprintPrice
} from '../data/plans.js';
import { FAQ } from '../data/faq.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://searchwin.ai';
const LINE_IDS = ['sprint', 'monthly'];
const usd = CURRENCIES.find((c) => c.id === DEFAULT_CURRENCY);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const icon = (name, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const ind = (s, n) => s.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');

const plans = allPlans();
const planOf = (type, lineId, col) => plans.find((p) => p.type.id === type.id && p.lineId === lineId && p.col === col);
const startUrl = (plan, cur = DEFAULT_CURRENCY) => `/start/?plan=${plan.id}&amp;cur=${cur}`;
const price = (n) => `<span class="price"><span class="price__cur" data-cur-sym>${usd.symbol}</span>${formatPrice(n)}</span>`;

/* ---------------------------------------------------------------- pricing cards */

function card(plan) {
  const { tier, line, type } = plan;
  const cls = ['plan', tier.recommended ? 'plan--featured' : '', tier.custom ? 'plan--custom' : ''].filter(Boolean).join(' ');
  const hid = `plan-${plan.id}`;
  const out = [];
  out.push(`<article class="${cls}" data-plan="${plan.id}" aria-labelledby="${hid}">`);
  if (tier.recommended) out.push(`  <p class="plan__badge">Best place to start</p>`);
  out.push(`  <h4 class="plan__name" id="${hid}">${esc(tier.name)}</h4>`);
  out.push(`  <p class="plan__promise">${esc(tier.promise)}</p>`);
  if (tier.custom) {
    out.push(`  <p class="plan__price plan__price--quote">Fixed quote before you pay</p>`);
    out.push(`  <p class="plan__billing">${lineIdBilling(plan)}</p>`);
  } else {
    out.push(`  <p class="plan__price">${price(tier.price)}${line.unit.startsWith('/') ? '' : ' '}<span class="plan__unit">${esc(line.unit)}</span></p>`);
    out.push(`  <p class="plan__billing">${esc(line.billing)}</p>`);
  }
  out.push(`  <p class="plan__best"><b>Best for:</b> ${esc(tier.bestFor)}</p>`);
  if (tier.custom) {
    out.push(`  <ul class="plan__list plan__list--cases">`);
    for (const c of tier.cases) out.push(`    <li>${icon('check')}${esc(c)}</li>`);
    out.push(`  </ul>`);
    out.push(`  <p class="plan__note">${esc(tier.promiseNote)}</p>`);
  } else {
    out.push(`  <ul class="plan__list">`);
    for (const item of cardItems(plan)) out.push(`    <li>${icon('check')}${esc(item)}</li>`);
    out.push(`  </ul>`);
  }
  out.push(`  <p class="plan__recheck">${icon('search')}<span><b>Re-checked:</b> ${esc(tier.recheck)}</span></p>`);
  const missing = tier.custom ? [] : missingItems(plan);
  out.push(`  <details class="plan__excl" data-not-included="${plan.id}">`);
  out.push(`    <summary>Not included</summary>`);
  out.push(`    <ul>`);
  for (const m of missing) out.push(`      <li>${esc(m.label)}${m.from ? ` <span>(in ${esc(m.from)} and up)</span>` : ''}</li>`);
  for (const x of type.notIncluded) out.push(`      <li>${esc(x)}</li>`);
  out.push(`    </ul>`);
  out.push(`  </details>`);
  const btn = tier.recommended ? 'btn btn--primary' : tier.custom ? 'btn btn--outline' : 'btn btn--dark';
  const label = tier.custom ? 'Tell us what you need' : `Start with ${tier.name}`;
  out.push(`  <a class="${btn} btn--block plan__cta" href="${startUrl(plan)}" data-plan-cta="${plan.id}">${esc(label)}${icon('arrow', 'btn__icon')}</a>`);
  out.push(`</article>`);
  return out.join('\n');
}

function lineIdBilling(plan) {
  return plan.lineId === 'sprint' ? 'One-off · scoped in writing' : 'Monthly · scoped in writing';
}

function pricingBlock() {
  const out = [];
  for (const type of BUSINESS_TYPES) {
    out.push(`<div class="pricing__panel" data-type-panel="${type.id}" role="region" aria-label="${esc(type.title)}">`);
    out.push(`  <p class="pricing__type">${esc(type.title)}</p>`);
    out.push(`  <p class="pricing__who">${esc(type.who)} Questions we test look like ${type.questions.map((q) => `<q>${esc(q)}</q>`).join(', ')}.</p>`);
    for (const lineId of LINE_IDS) {
      const line = LINES[lineId];
      const rowId = `row-${type.id}-${lineId}`;
      out.push(`  <div class="pricing__row" data-row="${type.id}-${lineId}">`);
      out.push(`    <header class="pricing__row-head">`);
      out.push(`      <h3 class="pricing__row-title" id="${rowId}">${esc(line.title)}<span class="sr-only">: ${esc(type.label)}</span></h3>`);
      out.push(`      <p class="pricing__row-intro">${esc(line.intro)}</p>`);
      out.push(`    </header>`);
      out.push(`    <div class="plans" data-plans aria-labelledby="${rowId}">`);
      type.lines[lineId].tiers.forEach((_, col) => out.push(ind(card(planOf(type, lineId, col)), 6)));
      out.push(`    </div>`);
      if (lineId === 'monthly') out.push(`    <p class="pricing__rule">${icon('calendar')}${esc(MONTHLY_RULE)}</p>`);
      out.push(`  </div>`);
    }
    out.push(`  <div class="pricing__excl">`);
    out.push(`    <p class="pricing__excl-title">Not included in any ${type.id === 'local' ? 'local' : 'online'} plan</p>`);
    out.push(`    <ul>${type.notIncluded.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`);
    if (type.notIncludedNote) out.push(`    <p class="pricing__excl-note">${esc(type.notIncludedNote)}</p>`);
    out.push(`  </div>`);
    out.push(`</div>`);
  }
  return out.join('\n');
}

/* ---------------------------------------------------------------- comparison tables */

function cell(v) {
  if (v === true) return `${icon('check', 'tick')}<span class="sr-only">Included</span>`;
  if (v === null || v === undefined) return `<span class="dash" aria-hidden="true">—</span><span class="sr-only">Not included</span>`;
  return esc(v);
}

function compareBlock() {
  const out = [];
  for (const type of BUSINESS_TYPES) {
    out.push(`<div class="compare__panel" data-type-panel="${type.id}">`);
    out.push(`  <p class="pricing__type">${esc(type.title)}</p>`);
    for (const lineId of LINE_IDS) {
      const line = LINES[lineId];
      const tiers = type.lines[lineId].tiers;
      const rows = type.lines[lineId].rows;
      const tierPlans = tiers.map((_, col) => planOf(type, lineId, col));
      out.push(`  <div class="compare__table">`);
      out.push(`    <table>`);
      out.push(`      <caption>${esc(type.label)} · ${esc(line.label)}</caption>`);
      out.push(`      <thead><tr><th scope="col">What you get</th>${tiers.map((t) => `<th scope="col">${esc(t.name)}</th>`).join('')}</tr></thead>`);
      out.push(`      <tbody>`);
      out.push(`        <tr><th scope="row">Best for</th>${tiers.map((t) => `<td>${esc(t.bestFor)}</td>`).join('')}</tr>`);
      out.push(`        <tr class="compare__price"><th scope="row">Price</th>${tiers.map((t) => `<td>${t.custom ? 'Fixed quote before you pay' : `${price(t.price)}${line.unit.startsWith('/') ? '' : ' '}${esc(line.unit)}`}</td>`).join('')}</tr>`);
      for (const r of rows) out.push(`        <tr><th scope="row">${esc(r.label)}</th>${r.values.map((v) => `<td>${cell(v)}</td>`).join('')}</tr>`);
      out.push(`      </tbody>`);
      out.push(`    </table>`);
      out.push(`  </div>`);
      // Phones: one accordion per plan instead of a wide table
      out.push(`  <div class="compare__plans" aria-label="${esc(type.label)} · ${esc(line.label)}">`);
      out.push(`    <p class="compare__plans-title">${esc(type.label)} · ${esc(line.label)}</p>`);
      tierPlans.forEach((plan) => {
        const t = plan.tier;
        out.push(`    <details class="compare__plan">`);
        out.push(`      <summary><span>${esc(t.name)}</span><span class="compare__plan-price">${t.custom ? 'Fixed quote' : `${price(t.price)}${line.unit.startsWith('/') ? '' : ' '}${esc(line.unit)}`}</span></summary>`);
        out.push(`      <dl>`);
        out.push(`        <div><dt>Best for</dt><dd>${esc(t.bestFor)}</dd></div>`);
        for (const r of rows) out.push(`        <div><dt>${esc(r.label)}</dt><dd>${cell(r.values[plan.col])}</dd></div>`);
        out.push(`      </dl>`);
        out.push(`    </details>`);
      });
      out.push(`  </div>`);
    }
    out.push(`  <div class="pricing__excl">`);
    out.push(`    <p class="pricing__excl-title">Not included in any ${type.id === 'local' ? 'local' : 'online'} plan</p>`);
    out.push(`    <ul>${type.notIncluded.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`);
    if (type.notIncludedNote) out.push(`    <p class="pricing__excl-note">${esc(type.notIncludedNote)}</p>`);
    out.push(`  </div>`);
    out.push(`</div>`);
  }
  return out.join('\n');
}

/* ---------------------------------------------------------------- FAQ */

function faqBlock() {
  return FAQ.map((f, i) => [
    `<details class="qa" data-faq="${i + 1}">`,
    `  <summary><span>${esc(f.q)}</span><span class="qa__icon" aria-hidden="true"></span></summary>`,
    `  <div class="qa__body"><p>${esc(f.a)}</p></div>`,
    `</details>`
  ].join('\n')).join('\n');
}

/* ---------------------------------------------------------------- footer plan links */

function footerPlansBlock() {
  return BUSINESS_TYPES.map((type) => [
    `<div>`,
    `  <p class="footer__label">${esc(type.label)} plans</p>`,
    `  <ul>`,
    ...LINE_IDS.flatMap((lineId) => type.lines[lineId].tiers.filter((t) => !t.custom).map((t) =>
      `    <li><a href="#pricing" data-set-type="${type.id}">${esc(t.name)}<span class="footer__meta"> · ${LINES[lineId].label.toLowerCase()}</span></a></li>`)),
    `    <li><a href="#pricing" data-set-type="${type.id}">Custom</a></li>`,
    `  </ul>`,
    `</div>`
  ].join('\n')).join('\n');
}

/* ---------------------------------------------------------------- JSON-LD */

function offer(plan) {
  const { tier, line, type } = plan;
  const o = {
    '@type': 'Offer',
    name: `${tier.name} (${line.label}, ${type.label.toLowerCase()})`,
    description: tier.custom
      ? `${tier.promise} Covers: ${tier.cases.join(', ')}. ${tier.promiseNote}`
      : `${tier.promise} Best for: ${tier.bestFor}. Deliverables: ${cardItems(plan).join('; ')}. Re-checked: ${tier.recheck}.`,
    url: `${SITE}/start/?plan=${plan.id}`,
    itemOffered: { '@type': 'Service', name: `${tier.name}: ${line.label} for ${type.label.toLowerCase()}s` }
  };
  if (!tier.custom) {
    o.price = String(tier.price);
    o.priceCurrency = 'USD';
    o.priceSpecification = CURRENCIES.map((c) => ({
      '@type': 'UnitPriceSpecification',
      price: tier.price,
      priceCurrency: c.code,
      ...(line.schemaUnit ? { unitCode: line.schemaUnit, unitText: 'month' } : {})
    }));
  }
  return o;
}

function schemaBlock() {
  const services = [];
  for (const type of BUSINESS_TYPES) {
    for (const lineId of LINE_IDS) {
      const line = LINES[lineId];
      services.push({
        '@type': 'Service',
        '@id': `${SITE}/#${type.id}-${lineId}`,
        name: `${line.label}: AI search optimization and lead generation for ${type.label.toLowerCase()}s`,
        serviceType: 'AI search optimization and lead generation',
        provider: { '@id': `${SITE}/#org` },
        areaServed: ['US', 'GB', 'EU'],
        audience: { '@type': 'BusinessAudience', audienceType: type.who },
        description: `${line.intro}${lineId === 'monthly' ? ` ${MONTHLY_RULE}` : ''}`,
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: `${type.label} · ${line.label}`,
          itemListElement: type.lines[lineId].tiers.map((_, col) => offer(planOf(type, lineId, col)))
        }
      });
    }
  }
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE}/#org`,
        name: 'SearchWin.ai',
        url: `${SITE}/`,
        logo: `${SITE}/assets/img/apple-touch-icon.png`,
        email: 'hi@searchwin.ai',
        description: 'AI search optimization and lead generation as a service, with fixed plans: 45-day sprints and month-to-month plans for local businesses and online and national businesses, with prices on the page and counted deliverables.',
        knowsAbout: ['AI search optimization', 'Generative engine optimization', 'Local SEO', 'Google Business Profile', 'Lead generation']
      },
      { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: 'SearchWin.ai' },
      {
        '@type': 'WebPage',
        '@id': `${SITE}/#page`,
        url: `${SITE}/`,
        name: 'AI Search Optimization & Lead Generation Service, Fixed Plans | searchwin.ai',
        description: `Fixed-price AI search optimization and lead generation for local businesses and SMEs. 45-day sprints from $${formatPrice(lowestSprintPrice())}, monthly plans, counted deliverables.`,
        isPartOf: { '@id': `${SITE}/#website` },
        about: { '@id': `${SITE}/#org` }
      },
      ...services,
      {
        '@type': 'FAQPage',
        '@id': `${SITE}/#faq`,
        mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
      }
    ]
  };
  return `<script type="application/ld+json">\n${JSON.stringify(graph, null, 2)}\n</script>`;
}

/* ---------------------------------------------------------------- llms.txt */

function llmsBlock() {
  const out = [];
  out.push('## Plans and prices');
  out.push('');
  out.push('Prices are the same number in US dollars, British pounds and euros. Every plan lists counted deliverables; no plan promises rankings, leads or revenue.');
  for (const type of BUSINESS_TYPES) {
    out.push('');
    out.push(`### ${type.title}`);
    out.push(`${type.who} Questions we test look like: ${type.questions.map((q) => `"${q}"`).join(', ')}.`);
    for (const lineId of LINE_IDS) {
      const line = LINES[lineId];
      out.push('');
      out.push(`${line.label} (${lineId === 'sprint' ? 'one-off' : 'month to month'}):`);
      type.lines[lineId].tiers.forEach((t, col) => {
        const plan = planOf(type, lineId, col);
        if (t.custom) out.push(`- ${t.name}: fixed quote before you pay. ${t.bestFor}.`);
        else out.push(`- ${t.name}: ${priceWithUnit('$', t.price, line.unit)}. Best for: ${t.bestFor}. ${cardItems(plan).join('; ')}. Re-checked: ${t.recheck}.`);
      });
    }
    out.push('');
    out.push(`Not included in any ${type.id} plan: ${type.notIncluded.join('; ')}.${type.notIncludedNote ? ` ${type.notIncludedNote}` : ''}`);
  }
  out.push('');
  out.push(MONTHLY_RULE);
  return out.join('\n');
}

/* ---------------------------------------------------------------- /start/ plan picker */

function startOptionsBlock() {
  const out = [];
  for (const type of BUSINESS_TYPES) {
    for (const lineId of LINE_IDS) {
      out.push(`<optgroup label="${esc(type.label)} · ${esc(LINES[lineId].label)}">`);
      type.lines[lineId].tiers.forEach((t, col) => {
        const plan = planOf(type, lineId, col);
        out.push(`  <option value="${plan.id}">${esc(t.name)}${t.custom ? ' (fixed quote)' : ` (${esc(priceWithUnit('$', t.price, LINES[lineId].unit))})`}</option>`);
      });
      out.push(`</optgroup>`);
    }
  }
  return out.join('\n');
}

function startDataBlock() {
  const data = {};
  for (const plan of plans) {
    data[plan.id] = {
      name: plan.tier.name,
      type: plan.type.label,
      line: plan.line.label,
      lineId: plan.lineId,
      price: plan.tier.custom ? null : plan.tier.price,
      unit: plan.line.unit,
      billing: plan.tier.custom ? lineIdBilling(plan) : plan.line.billing,
      bestFor: plan.tier.bestFor,
      items: plan.tier.custom ? plan.tier.cases : cardItems(plan),
      recheck: plan.tier.recheck,
      custom: !!plan.tier.custom
    };
  }
  return `<script type="application/json" id="plans-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/* ---------------------------------------------------------------- write */

const BLOCKS = {
  'index.html': { schema: schemaBlock, pricing: pricingBlock, compare: compareBlock, faq: faqBlock, 'footer-plans': footerPlansBlock },
  'llms.txt': { plans: llmsBlock },
  'start/index.html': { 'plan-options': startOptionsBlock, 'plans-data': startDataBlock }
};

function fill(text, name, html, file) {
  const re = new RegExp(`([ \\t]*)<!-- build:${name} -->[\\s\\S]*?<!-- /build:${name} -->`);
  const m = text.match(re);
  if (!m) throw new Error(`${file}: markers for "${name}" not found`);
  const pad = m[1];
  const body = html.split('\n').map((l) => (l ? pad + l : l)).join('\n');
  return text.replace(re, () => `${pad}<!-- build:${name} -->\n${body}\n${pad}<!-- /build:${name} -->`);
}

export function render() {
  const out = {};
  for (const [file, blocks] of Object.entries(BLOCKS)) {
    let text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const [name, fn] of Object.entries(blocks)) text = fill(text, name, fn(), file);
    out[file] = text;
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const stale = [];
  for (const [file, text] of Object.entries(render())) {
    const full = path.join(root, file);
    if (fs.readFileSync(full, 'utf8') === text) continue;
    if (check) stale.push(file); else { fs.writeFileSync(full, text); console.log('updated', file); }
  }
  if (check && stale.length) { console.error('Out of date, run npm run build:home:', stale.join(', ')); process.exit(1); }
}

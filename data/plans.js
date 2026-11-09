// The one source of truth for the plans on the homepage and the order form.
// Cards, comparison tables, JSON-LD and the /start form are all rendered from this file by
// scripts/build-home.mjs (npm run build:home), and /api/start checks plan ids against it.
// Change a price or a deliverable here, then run the build. The test suite fails if the pages are stale.
//
// Values in `rows`: a number or text is shown as is, true is a check mark, null means "not in this plan".
// `card` is the line on the plan card ({v} is the value); rows without `card` appear only in the table.
// The column order of `values` is the order of `tiers` (three tiers, then Custom).

export const CURRENCIES = [
  { id: 'usd', code: 'USD', symbol: '$', label: '$ USD', name: 'US dollars' },
  { id: 'gbp', code: 'GBP', symbol: '£', label: '£ GBP', name: 'British pounds' },
  { id: 'eur', code: 'EUR', symbol: '€', label: '€ EUR', name: 'euros' }
];
export const DEFAULT_CURRENCY = 'usd';

export const LINES = {
  sprint: {
    label: '45-day sprint',
    title: 'Start with a 45-day sprint',
    intro: 'Build. One-off setup work: fix what stops AI from understanding and trusting you, build the missing pages and listings, set up tracking, then re-check on day 45.',
    unit: 'one-off',
    billing: 'One-off · pay upfront or 50/50',
    schemaUnit: null
  },
  monthly: {
    label: 'Monthly plan',
    title: 'Then keep it growing (monthly)',
    intro: 'Keep and grow. Ongoing work that only makes sense once the basics exist: monthly re-checks, new pages, review and listing upkeep, outreach and a monthly report.',
    unit: '/month',
    billing: 'Billed monthly · cancel any month',
    schemaUnit: 'MON'
  }
};

export const MONTHLY_RULE = 'Monthly plans start after a sprint, or after our free audit confirms your basics are already in place.';

const CUSTOM_LOCAL_CASES = ['Multiple locations', 'Franchises', 'Several markets or languages', 'Regulated niches', 'White-label for other agencies'];
const CUSTOM_ONLINE_CASES = ['Several brands or product lines', '3+ markets or languages', 'Regulated sectors', 'Marketplaces and large catalogs', 'White-label for other agencies'];
const CUSTOM_PROMISE = 'You still get a fixed price and a deliverables list before you pay.';

export const BUSINESS_TYPES = [
  {
    id: 'local',
    label: 'Local business',
    title: 'Local business plans',
    who: 'For businesses that win customers in a town or region.',
    examples: ['Trades and home services', 'Clinics and dentists', 'Law and accounting firms', 'Gyms and studios', 'Restaurants'],
    questions: ['best {service} in {city}', 'who should I call for {service} near {city}'],
    notIncluded: [
      'Ad spend',
      'Paid directory memberships (for example a Checkatrade subscription)',
      'Professional photography',
      'A full website redesign',
      'Fake or gated reviews',
      'Guaranteed rankings or lead numbers'
    ],
    notIncludedNote: null,
    lines: {
      sprint: {
        tiers: [
          { id: 'get-found', name: 'Get Found', promise: 'Fix the basics so AI can find, understand and recommend you.', bestFor: '1 location, a few core services', price: 900,
            recheck: '10 questions × 3 AI engines, on day 0 and day 45' },
          { id: 'get-chosen', name: 'Get Chosen', promise: 'Be the business AI names first in your town, and make it easy to call you.', bestFor: '1 location, wider service list, competitive town', price: 1900, recommended: true,
            recheck: '20 questions × 4 AI engines, on day 0 and day 45' },
          { id: 'own-the-area', name: 'Own the Area', promise: 'Cover every service and every area you work in.', bestFor: 'Up to 3 locations or a wide service area', price: 3500,
            recheck: '30 questions × 4 AI engines per location, on day 0 and day 45' },
          { id: 'custom', name: 'Custom', custom: true, promise: 'Many locations or a franchise? Same model, scoped for you.', bestFor: '4+ locations, franchises, several languages',
            cases: CUSTOM_LOCAL_CASES, promiseNote: CUSTOM_PROMISE, recheck: 'The questions and engines we agree, on day 0 and day 45' }
        ],
        rows: [
          { label: 'Services covered', values: ['Up to 3', 'Up to 6', 'Up to 10', 'Agreed list'], card: '{v} services covered' },
          { label: 'Google Business Profile fix-up (categories, services, hours, photos, Q&A)', values: ['1 profile', '1 profile', 'Up to 3 profiles', 'Agreed'], card: 'Google Business Profile fix-up: {v}' },
          { label: 'Google posts during the sprint', values: [null, 6, 12, 'Agreed'], card: '{v} Google post{s}' },
          { label: 'Website fixes: AI crawler access, schema, name/address/phone consistency, indexing', values: [true, true, true, true] },
          { label: 'New or rebuilt service pages', values: [3, 6, 9, 'Agreed'], card: '{v} new or rebuilt service page{s}' },
          { label: 'Area pages ("{service} in {area}")', values: [null, 2, 5, 'Agreed'], card: '{v} area page{s}' },
          { label: 'FAQ page refresh written for AI answers', values: [true, true, true, true] },
          { label: 'Directory and review-site listings set up or fixed (niche sites like Checkatrade, Angi, Healthgrades)', values: [5, 10, 15, 'Agreed'], card: '{v} directory and review-site listing{s}' },
          { label: 'Review routine: request templates, QR card, reply templates', values: [true, true, true, true] },
          { label: 'Lead capture check: click-to-call, quote form, booking link', values: ['Check + fix list', 'Fixed for you', 'Fixed for you, per location', 'Agreed'] },
          { label: 'Call and form tracking, AI-referral tracking in GA4', values: ['Basic', 'Full', 'Full, per location', 'Agreed'] },
          { label: 'Competitor gap: the businesses AI names instead of you', values: ['Top 3', "Top 5 + what they have that you don't", 'Top 5 per location', 'Agreed'] },
          { label: 'Local PR and mention outreach', values: [null, '3 pitches', '10 pitches', 'Agreed'] },
          { label: 'AI re-check, day 0 and day 45', recheck: true, values: ['10 questions × ChatGPT, Gemini, Google AI Overviews', '20 questions × the same + Google AI Mode', '30 questions × 4 engines, split by location', 'Agreed'] },
          { label: 'Day-45 report + 30-min review call', values: [true, true, true, true], card: 'Day-45 report + 30-min review call' },
          { label: 'Timeline', values: ['45 days', '45 days', '45 days', 'Agreed in writing'] }
        ]
      },
      monthly: {
        tiers: [
          { id: 'keep', name: 'Keep', promise: 'Hold what the sprint built, and see every month where you stand.', bestFor: 'Hold what the sprint built', price: 390,
            recheck: '10 questions × 3 AI engines, every month' },
          { id: 'grow', name: 'Grow', promise: 'Keep adding services and areas, and keep the reviews coming.', bestFor: 'Keep adding services and areas', price: 790, recommended: true,
            recheck: '20 questions × 4 AI engines, every month' },
          { id: 'lead', name: 'Lead', promise: 'Stay the first name across several locations.', bestFor: 'Stay first across several locations', price: 1490,
            recheck: '30 questions × 4 AI engines per location (up to 3), every month' },
          { id: 'custom', name: 'Custom', custom: true, promise: 'Groups, franchises or agencies? Same model, scoped for you.', bestFor: 'Groups, franchises, agencies',
            cases: CUSTOM_LOCAL_CASES, promiseNote: CUSTOM_PROMISE, recheck: 'The questions and engines we agree, every month' }
        ],
        rows: [
          { label: 'AI re-check every month', recheck: true, values: ['10 questions × 3 engines', '20 questions × 4 engines', '30 questions × 4 engines, per location (up to 3)', 'Agreed'] },
          { label: 'Google posts per month', values: [4, 8, 12, 'Agreed'], card: '{v} Google post{s} a month' },
          { label: 'New or refreshed pages per month', values: ['1 refreshed', '2 new (service, area or FAQ)', '4 new', 'Agreed'], card: 'Pages a month: {v}' },
          { label: 'Listings: drift fixes on existing sites', values: [true, true, true, true] },
          { label: 'New directory or review-site listings per month', values: [null, 2, 4, 'Agreed'], card: '{v} new listing{s} a month' },
          { label: 'Review monitoring + reply drafts', values: [true, true, true, true], card: 'Review monitoring + reply drafts' },
          { label: 'Review request push to recent customers', values: [null, 'Monthly', 'Monthly, per location', 'Agreed'] },
          { label: 'Competitor watch (who AI names this month)', values: [null, true, true, true] },
          { label: 'Local PR and mention outreach', values: [null, null, '4 pitches/month', 'Agreed'], card: 'Local PR outreach: {v}' },
          { label: 'Leads report: calls, forms and bookings from AI and Google, where trackable', values: [true, true, true, true], card: 'Leads report: calls, forms and bookings' },
          { label: 'Monthly report', values: ['1-page report', 'Report + 30-min call', 'Report + 30-min call + 90-day roadmap refresh', 'Agreed'], card: 'Monthly: {v}' },
          { label: 'Commitment', values: ['Cancel any month', 'Cancel any month', 'Cancel any month', 'Agreed in writing'] }
        ]
      }
    }
  },
  {
    id: 'online',
    label: 'Online & national',
    title: 'Online and national business plans',
    who: 'For B2B services, SaaS, e-commerce and national brands that sell beyond one town.',
    examples: ['B2B services', 'SaaS', 'E-commerce', 'National brands'],
    questions: ['best {category} for {use case}', '{brand} vs {competitor}', 'alternatives to {competitor}'],
    notIncluded: [
      'Ad spend',
      'Paid review-platform subscriptions',
      'Paid or sponsored placements',
      'Product changes',
      'Guaranteed placements, mentions or revenue'
    ],
    notIncludedNote: 'Outreach is counted in pitches sent, not articles won.',
    lines: {
      sprint: {
        tiers: [
          { id: 'foundation', name: 'Foundation', promise: 'Make AI understand what you sell and who it’s for.', bestFor: 'One product or service line, one market', price: 1900,
            recheck: '20 questions × 4 AI engines, on day 0 and day 45' },
          { id: 'authority', name: 'Authority', promise: 'Show up when buyers ask AI to compare options.', bestFor: 'Several lines or a crowded category', price: 3900, recommended: true,
            recheck: '40 questions × 5 AI engines, on day 0 and day 45' },
          { id: 'category', name: 'Category', promise: 'Be the name AI gives first in your category.', bestFor: 'Pushing for category leadership, up to 2 markets', price: 7500,
            recheck: '80 questions × 5 AI engines, on day 0 and day 45' },
          { id: 'custom', name: 'Custom', custom: true, promise: 'Several brands or markets? Same model, scoped for you.', bestFor: 'Multi-brand, 3+ markets, regulated sectors',
            cases: CUSTOM_ONLINE_CASES, promiseNote: CUSTOM_PROMISE, recheck: 'The questions and engines we agree, on day 0 and day 45' }
        ],
        rows: [
          { label: 'AI questions checked, day 0 and day 45', recheck: true, values: ['20 × ChatGPT, Gemini, Perplexity, Google AI Overviews', '40 × the same + Google AI Mode', '80 × 5 engines', 'Agreed'] },
          { label: 'Brand facts fixes: company facts page, Organization/Product/Service schema, matching descriptions on your public profiles', values: [true, true, true, true], card: 'Brand facts fixes: facts page, schema, public profiles' },
          { label: 'AI crawler access and indexing check', values: [true, true, true, true] },
          { label: 'New answer pages ("X vs Y", alternatives, "best for", use cases)', values: [3, 6, 12, 'Agreed'], card: '{v} new answer page{s} (vs, alternatives, best for)' },
          { label: 'Existing pages rewritten for AI answers (product, service, pricing, FAQ)', values: [3, 6, 10, 'Agreed'], card: '{v} existing page{s} rewritten for AI answers' },
          { label: 'Review platforms set up or fixed (G2, Capterra, Trustpilot, Clutch: chosen by business type)', values: [2, 4, 6, 'Agreed'], card: '{v} review platform{s} set up or fixed' },
          { label: 'Review request campaign set up', values: [true, true, true, true] },
          { label: 'Citation map: the sites AI cites in your category, and where you’re missing', values: ['Top 20', 'Top 50', 'Top 100', 'Agreed'], card: 'Citation map: {v} sites AI cites' },
          { label: 'PR and mention outreach (roundups, "best of" lists, industry sites)', values: [null, '10 pitches', '25 pitches', 'Agreed'], card: 'PR outreach: {v}' },
          { label: 'Lead path check: demo, quote, trial or checkout', values: ['Check + fix list', 'Fixed for you', 'Fixed + 1 landing page for AI visitors', 'Agreed'] },
          { label: 'AI-referral and conversion tracking in GA4', values: ['Basic', 'Full', 'Full + dashboard', 'Agreed'] },
          { label: 'Competitor gap: who AI names instead of you', values: ['Top 3', 'Top 5', 'Top 8, with share of mentions', 'Agreed'] },
          { label: 'Markets / languages', values: [1, 1, 'Up to 2', 'Agreed'] },
          { label: 'Day-45 report + 45-min review call', values: [true, true, true, true], card: 'Day-45 report + 45-min review call' },
          { label: 'Timeline', values: ['45 days', '45 days', '45 days', 'Agreed in writing'] }
        ]
      },
      monthly: {
        tiers: [
          { id: 'track', name: 'Track', promise: 'Watch your share of AI answers and hold your position.', bestFor: 'Watch and hold your position', price: 690,
            recheck: '20 questions × 4 AI engines, every month' },
          { id: 'scale', name: 'Scale', promise: 'Win more of the comparison questions buyers ask.', bestFor: 'Win more comparison questions', price: 1490, recommended: true,
            recheck: '40 questions × 5 AI engines, every month' },
          { id: 'lead-the-category', name: 'Lead the Category', promise: 'Defend first place in your category, in 2 markets.', bestFor: 'Defend first place, 2 markets', price: 2900,
            recheck: '80 questions × 5 AI engines in 2 markets, every month' },
          { id: 'custom', name: 'Custom', custom: true, promise: 'Groups, several brands or agencies? Same model, scoped for you.', bestFor: 'Groups, multi-brand, agencies',
            cases: CUSTOM_ONLINE_CASES, promiseNote: CUSTOM_PROMISE, recheck: 'The questions and engines we agree, every month' }
        ],
        rows: [
          { label: 'AI re-check every month', recheck: true, values: ['20 questions × 4 engines', '40 questions × 5 engines', '80 questions × 5 engines, 2 markets', 'Agreed'] },
          { label: 'Share of AI mentions vs named competitors', values: [true, true, true, true], card: 'Share of AI mentions vs named competitors' },
          { label: 'New answer pages per month', values: [1, 3, 6, 'Agreed'], card: '{v} new answer page{s} a month' },
          { label: 'Page refreshes per month', values: [1, 2, 4, 'Agreed'], card: '{v} page refresh{es} a month' },
          { label: 'Review platform upkeep + review requests', values: [true, true, true, true], card: 'Review platform upkeep + review requests' },
          { label: 'PR and mention outreach', values: [null, '5 pitches/month', '12 pitches/month', 'Agreed'], card: 'PR outreach: {v}' },
          { label: 'Citation map refresh', values: ['Quarterly', 'Monthly', 'Monthly', 'Agreed'] },
          { label: 'Leads report: demos, sign-ups and sales from AI referrals, where trackable', values: [true, true, true, true] },
          { label: 'Monthly report', values: ['1-page report', 'Report + 30-min call', 'Report + 30-min call + 90-day roadmap refresh', 'Agreed'], card: 'Monthly: {v}' },
          { label: 'Commitment', values: ['Cancel any month', 'Cancel any month', 'Cancel any month', 'Agreed in writing'] }
        ]
      }
    }
  }
];

/** Every plan as a flat list: { id, type, line, tier, ... } with id "{type}-{line}-{tier}". */
export function allPlans() {
  const out = [];
  for (const type of BUSINESS_TYPES) {
    for (const lineId of ['sprint', 'monthly']) {
      const line = type.lines[lineId];
      line.tiers.forEach((tier, col) => {
        out.push({
          id: `${type.id}-${lineId}-${tier.id}`,
          type, lineId, line: LINES[lineId], rows: line.rows, col, tier
        });
      });
    }
  }
  return out;
}

export function findPlan(id) {
  return allPlans().find((p) => p.id === id) || null;
}

/** "$900 one-off", "$390/month": the unit follows the price, with no space before "/month". */
export function priceWithUnit(symbol, n, unit) {
  return `${symbol}${formatPrice(n)}${unit.startsWith('/') ? '' : ' '}${unit}`;
}

/** "1,900" — the same number is shown in every currency. */
export function formatPrice(n) {
  return Number(n).toLocaleString('en-US');
}

/** Lowest sprint price, quoted in the hero ("45-day sprints from $900"). */
export function lowestSprintPrice() {
  return Math.min(...allPlans().filter((p) => p.lineId === 'sprint' && p.tier.price).map((p) => p.tier.price));
}

/** Card lines for a plan: the rows with a `card` template whose value is set for this tier. */
export function cardItems(plan) {
  return plan.rows
    .filter((r) => r.card && r.values[plan.col] !== null && r.values[plan.col] !== undefined)
    .map((r) => {
      const v = r.values[plan.col];
      if (v === true) return r.card;
      const one = v === 1;
      // Text values read mid-sentence after a colon: "fix-up: up to 3 profiles", not "fix-up: Up to 3 profiles".
      const text = typeof v === 'string' && !r.card.startsWith('{v}') ? v.charAt(0).toLowerCase() + v.slice(1) : String(v);
      return r.card.replace('{v}', text).replace('{s}', one ? '' : 's').replace('{es}', one ? '' : 'es');
    });
}

/** Rows this tier does not include (shown in the card's "Not included" list), with the first tier that has them. */
export function missingItems(plan) {
  const tiers = plan.type.lines[plan.lineId].tiers;
  return plan.rows
    .filter((r) => r.values[plan.col] === null)
    .map((r) => {
      const from = r.values.findIndex((v, i) => i > plan.col && v !== null && !tiers[i].custom);
      return { label: r.label, from: from === -1 ? null : tiers[from].name };
    });
}

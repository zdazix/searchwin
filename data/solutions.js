// The one source of truth for what searchwin.ai sells: three solutions, their starting prices in
// dollars, euros and pounds, and the copy of each solution page.
//
//   AI Search Sprint   45 days, one-off     your website and the outside sources AI reads
//   AI Search Monthly  month to month       the same two places, kept growing
//   Pages              month to month       a hub of organic conversion pages on your domain
//
// scripts/build-site.mjs (npm run build:home) renders from this file: the solution blocks, FAQ, JSON-LD,
// nav and footer of the homepage, the three solution pages (/sprint/, /monthly/, /pages/), the solutions
// list in llms.txt and the order form on /start/. /api/start checks plan ids against it.
// The homepage shows no prices. Each solution page shows only the starting price ("from").
// Change a price or a line here, then run the build. The test suite fails if a page is stale.

export const SITE = 'https://searchwin.ai';

export const CURRENCIES = [
  { id: 'usd', code: 'USD', symbol: '$', label: '$', name: 'US dollars' },
  { id: 'eur', code: 'EUR', symbol: '€', label: '€', name: 'euros' },
  { id: 'gbp', code: 'GBP', symbol: '£', label: '£', name: 'British pounds' }
];
export const DEFAULT_CURRENCY = 'usd';

export const BOOKING_URL = 'https://calendar.app.google/hFXU93aX327CiGPj9';

export const AUDIENCES = {
  local: {
    id: 'local',
    label: 'Local business',
    title: 'Local businesses',
    who: 'Businesses that win customers in a town or region.',
    examples: ['Trades and home services', 'Clinics and dentists', 'Law and accounting firms', 'Gyms and studios', 'Restaurants'],
    questions: ['best dentist near me', 'kitchen remodel company in Austin']
  },
  national: {
    id: 'national',
    label: 'National & international',
    title: 'National and international businesses',
    who: 'Businesses that sell beyond one town, in one country or several.',
    examples: ['B2B services', 'SaaS', 'E-commerce', 'Manufacturers and distributors', 'National brands'],
    questions: ['best CRM for a 20-person team', 'X vs Y', 'alternatives to X']
  }
};

export const MONTHLY_RULE = 'Monthly work starts after a sprint, or after our free audit confirms your basics are already in place.';

/* ---------------------------------------------------------------- the team: AI agents and people */

export const AGENTS = [
  { id: 'context', name: 'Context agent', job: 'Learns your business',
    text: 'Builds one fact base from your site, your profiles and your answers: services, areas, prices, proof and tone of voice. Every page and listing draws from it, so nothing reads like a template.' },
  { id: 'research', name: 'Research agent', job: 'Finds high-intent questions',
    text: 'Collects the questions, comparisons, locations and use cases buyers search in Google and ask AI before they contact anyone, then ranks them by how close they are to a purchase.' },
  { id: 'check', name: 'Answer-check agent', job: 'Re-asks the AI engines',
    text: 'Puts those questions to ChatGPT, Gemini and Google’s AI on a schedule and records who is named, in what order and which sources are cited.' },
  { id: 'content', name: 'Content agent', job: 'Drafts pages that sell',
    text: 'Drafts service, location, comparison, cost and FAQ pages from the fact base. Each one is built around a single buyer question and a single next step.' },
  { id: 'authority', name: 'Authority agent', job: 'Maps where trust comes from',
    text: 'Finds the directories, review sites and publications AI cites in your category and prepares the listings, fixes and pitches that put you there.' },
  { id: 'conversion', name: 'Conversion agent', job: 'Follows the lead',
    text: 'Checks every page for a clear path to a call, a form or a booking, filters out spam and records which pages each lead read before reaching out.' }
];

export const PEOPLE = [
  { id: 'strategist', name: 'Strategist', text: 'Picks the questions worth winning, sets the plan and signs it off with you.' },
  { id: 'editor', name: 'Editor', text: 'Fact-checks and edits every page. Nothing goes live without a human read and your approval.' },
  { id: 'outreach', name: 'Outreach specialist', text: 'Writes to real editors, directories and review platforms. No fake accounts and no paid posting.' },
  { id: 'lead', name: 'Your account lead', text: 'One person who knows your account, sends the weekly update and walks you through the results.' }
];

export const TEAM_BENEFITS = [
  { title: 'Live in days', text: 'Agents research and draft around the clock, so first pages go live in days, not months.' },
  { title: 'The same standard at scale', text: 'Page one hundred is held to the standard of page one, because every page draws from the same fact base.' },
  { title: 'Always watching', text: 'Your buyers’ questions are re-asked on a schedule, not once a quarter.' },
  { title: 'Accurate, in your voice', text: 'A person reads every page before it is published, and you approve what goes out under your name.' },
  { title: 'Minutes of your time', text: 'One kickoff, then a few minutes a week to review and approve.' },
  { title: 'A fixed price', text: 'Agents do the volume, so the work is priced like a product: a starting price on the page, the final one in writing.' }
];

/* ---------------------------------------------------------------- solutions */

const NOT_INCLUDED = [
  'Ad spend',
  'Paid directory memberships and paid media placements',
  'Professional photography or video',
  'A full website redesign',
  'Fake or gated reviews',
  'Guaranteed rankings or lead numbers'
];

export const SOLUTIONS = [
  /* ============================ AI Search Sprint ============================ */
  {
    id: 'sprint',
    url: '/sprint/',
    name: 'AI Search Sprint',
    short: 'Sprint',
    kind: '45 days · one-off',
    scope: 'Your website and the outside sources AI reads',
    unit: 'one-off',
    schemaUnit: null,
    billing: 'One-off. Pay upfront or 50/50.',
    card: {
      text: 'Fix what stops AI and Google from understanding and recommending you, build the selling pages and listings that are missing, and set up lead tracking. Re-checked on day 45 on the same questions.',
      points: ['Site fixes: AI crawler access, schema, facts', 'Selling pages built or rebuilt', 'Profiles, listings and review platforms', 'Day 0 and day 45, side by side'],
      cta: 'See the Sprint'
    },
    meta: {
      title: 'AI Search Sprint: 45-Day AI Search Optimization at a Fixed Price | searchwin.ai',
      description: 'A 45-day, fixed-scope sprint for your website and the outside sources AI reads, built around high-intent questions and re-checked on day 45. Local from $900, national and international from $1,500.',
      og: 'AI Search Sprint: 45 days to get named by AI and turn it into leads'
    },
    hero: {
      eyebrow: 'AI Search Sprint · 45 days · one-off',
      title: '45 days to get named by AI, and to turn the visit into a lead.',
      lead: 'A fixed-scope sprint for your website and the outside sources AI reads: profiles, listings, reviews and mentions. It is built around the questions buyers ask right before they choose, and re-checked on day 45.'
    },
    offers: [
      {
        id: 'sprint-local', audience: 'local', from: { usd: 900, eur: 850, gbp: 750 },
        covers: [
          '1 location, up to 3 services',
          'Website fixes: AI crawler access, schema, name, address and phone consistency, indexing',
          'Google Business Profile fix-up: categories, services, hours, photos, Q&A',
          '3 new or rebuilt service pages, each with a clear next step',
          'FAQ page refresh written for AI answers',
          '5 directory and review-site listings set up or fixed',
          'Review routine: request templates, QR card, reply templates',
          'Lead capture check (click-to-call, form, booking link) with call and form tracking',
          'Re-check: 10 questions × 3 AI engines, on day 0 and day 45',
          'Day-45 report and a 30-minute review call'
        ]
      },
      {
        id: 'sprint-national', audience: 'national', from: { usd: 1500, eur: 1400, gbp: 1200 },
        covers: [
          'One product or service line, one market',
          'Website fixes: AI crawler access, schema, indexing',
          'Brand facts fixes: facts page, schema, public profiles',
          '2 new answer pages: “X vs Y”, alternatives or “best for”',
          '3 existing pages rewritten for AI answers and for conversion',
          '2 review platforms set up or fixed (for example G2, Capterra or Trustpilot)',
          'Citation map: the top 20 sites AI cites in your category',
          'Lead path check (demo, quote, trial or checkout) with AI-referral tracking',
          'Re-check: 20 questions × 4 AI engines, on day 0 and day 45',
          'Day-45 report and a 45-minute review call'
        ]
      }
    ],
    priceNote: 'The starting price covers the scope below. More locations, services, markets, languages, pages or outreach raise it. You get the exact scope and price in writing before you pay.',
    sections: ['model', 'offers', 'timeline', 'sample', 'team', 'faq'],
    model: {
      eyebrow: 'What the sprint works on',
      title: 'Four jobs, in the order AI and buyers need them.',
      lead: 'Two of them happen on your website, one on the outside sources AI reads, and the last one wherever a buyer can reach you.',
      steps: [
        { name: 'Get understood', where: 'On your website', lede: 'AI can’t recommend a business it can’t read.',
          items: ['Website fixes: AI crawler access, schema, indexing', 'The same name, address, phone and facts everywhere', 'Google Business Profile or company facts page fixed up'] },
        { name: 'Get cited', where: 'On outside sources', lede: 'AI repeats what trusted sites say about you.',
          items: ['Directory and review-site listings set up or fixed', 'Review platforms like G2, Capterra or Trustpilot', 'PR and mention outreach, counted in pitches'] },
        { name: 'Get recommended', where: 'On your website', lede: 'Give AI a page that answers the buying question.',
          items: ['Service and area pages for local businesses', '“X vs Y”, alternatives and “best for” pages for national ones', 'An FAQ written for AI answers'] },
        { name: 'Get chosen', where: 'On every page and profile', lede: 'Turn the recommendation into a call or a booking.',
          items: ['Lead capture: click-to-call, quote form, booking link', 'A review routine: request and reply templates, QR card', 'Call, form and AI-referral tracking'] }
      ]
    },
    timeline: {
      eyebrow: 'How the 45 days run',
      title: 'A fixed start, a fixed end and a tracker in between.',
      lead: 'You sign off the deliverables list before work starts, see every item in a shared tracker and get a short update by email each week.',
      steps: [
        { when: 'Day 0', title: 'Baseline', text: 'We ask the AI engines your buyers’ questions and record who is named and which sources are cited.' },
        { when: 'Days 1–10', title: 'Fix the base', text: 'Site fixes, consistent facts, your profile or facts page, and call and form tracking.' },
        { when: 'Days 11–30', title: 'Build what sells', text: 'Pages drafted by agents, edited by people, approved by you and published. Listings and review platforms set up.' },
        { when: 'Days 31–44', title: 'Reach and convert', text: 'Outreach for mentions, the review routine goes live, lead capture fixed on the pages that get the visits.' },
        { when: 'Day 45', title: 'Proof', text: 'The same questions on the same engines, next to day 0, plus a leads report and what we would do next.' }
      ]
    },
    excluded: NOT_INCLUDED,
    faq: [
      { q: 'What does the starting price cover, and what raises it?',
        a: 'The starting price covers the scope listed on this page: one location and up to three services for a local business, or one product or service line in one market for a national one. More locations, services, markets, languages, pages or outreach raise the price. You get the exact deliverables list and the price in writing before you pay.' },
      { q: 'Can you guarantee I’ll be recommended by day 45?',
        a: 'No. AI answers change daily and no one controls them. What we do guarantee is the work: every deliverable on your list ships within the 45 days, and on day 45 you see the same questions on the same engines next to the day-0 answers.' },
      { q: 'What happens if not much changes by day 45?',
        a: 'You still get every listed deliverable, plus a report that shows what changed, what didn’t and the likely reasons. We tell you what we would do next and whether monthly work is worth it for you. If it isn’t, we say so.' },
      { q: 'Do I need a monthly plan after the sprint?',
        a: 'No. The sprint is one-off and everything it builds stays yours. Monthly work makes sense if you want a re-check every month, new pages and help keeping reviews and listings current. Pages makes sense if you want a hub that covers many more buying questions.' },
      { q: 'What do you need from me?',
        a: 'Access to your website, your Google Business Profile (for local businesses) and your analytics, and about 2 hours of your time over the 45 days: a kickoff, a few approvals and the day-45 review.' },
      { q: 'How do I pay?',
        a: 'Once: upfront, or 50/50. You get a fixed price in writing before you pay anything.' }
    ]
  },

  /* ============================ AI Search Monthly ============================ */
  {
    id: 'monthly',
    url: '/monthly/',
    name: 'AI Search Monthly',
    short: 'Monthly',
    kind: 'Month to month',
    scope: 'Your website and the outside sources AI reads',
    unit: '/month',
    schemaUnit: 'MON',
    billing: 'Billed monthly. Cancel any month.',
    card: {
      text: 'Keep your site and your outside profiles winning new questions: a re-check every month, new and refreshed pages, review and listing upkeep, outreach for mentions and a leads report.',
      points: ['Monthly re-check across AI engines', 'New and refreshed selling pages', 'Reviews, listings and mentions', 'Leads report: calls, forms, bookings'],
      cta: 'See Monthly'
    },
    meta: {
      title: 'AI Search Monthly: Ongoing AI Search Optimization, Month to Month | searchwin.ai',
      description: 'Monthly AI search optimization for your website and the outside sources AI reads: re-checks, new and refreshed pages, reviews, listings and a leads report. Local from $450 a month, national and international from $850.',
      og: 'AI Search Monthly: keep winning new questions, month after month'
    },
    hero: {
      eyebrow: 'AI Search Monthly · month to month',
      title: 'Keep winning new questions, month after month.',
      lead: 'Ongoing work on your website and the outside sources AI reads. Every month we re-ask your buyers’ questions, add or refresh the pages you are not winning yet, keep reviews and listings moving and report the leads.'
    },
    offers: [
      {
        id: 'monthly-local', audience: 'local', from: { usd: 450, eur: 400, gbp: 350 },
        covers: [
          'Re-check: 10 questions × 3 AI engines, every month',
          '1 page refreshed or added a month',
          '4 Google posts a month',
          'Review monitoring and reply drafts',
          'Listings kept consistent across directories',
          'Leads report: calls, forms and bookings',
          'A 1-page monthly report'
        ]
      },
      {
        id: 'monthly-national', audience: 'national', from: { usd: 850, eur: 750, gbp: 650 },
        covers: [
          'Re-check: 20 questions × 4 AI engines, every month',
          'Share of AI mentions against named competitors',
          '1 new answer page a month',
          '1 page refresh a month',
          'Review platform upkeep and review requests',
          'Leads report: enquiries from AI and Google, by page',
          'A 1-page monthly report'
        ]
      }
    ],
    priceNote: 'The starting price covers the scope below. More questions, engines, pages, locations, markets or outreach raise it. You get the exact scope and price in writing before you pay.',
    rule: MONTHLY_RULE,
    sections: ['model', 'offers', 'timeline', 'versus', 'team', 'faq'],
    model: {
      eyebrow: 'What happens every month',
      title: 'One loop, repeated: check, build, strengthen, report.',
      lead: 'AI answers move, competitors publish and buyers change how they ask. The monthly loop keeps your site and your outside profiles ahead of that.',
      steps: [
        { name: 'Re-check', where: 'Across AI engines', lede: 'See where you stand before deciding what to do.',
          items: ['The same questions re-asked every month', 'New questions added as buyers change their wording', 'Who is named instead of you, and which sources are cited'] },
        { name: 'Build', where: 'On your website', lede: 'Add the page that answers the question you are not winning.',
          items: ['New or refreshed service, area and answer pages', 'Google posts for local businesses', 'Each page checked for its next step'] },
        { name: 'Strengthen', where: 'On outside sources', lede: 'Keep the proof AI reads about you current.',
          items: ['Review monitoring, requests and reply drafts', 'Listings and review platforms kept consistent', 'Outreach pitches for mentions on larger plans'] },
        { name: 'Report', where: 'In your inbox', lede: 'Count leads, not impressions.',
          items: ['Calls, forms and bookings by source', 'Which pages the enquiries came from', 'What we change next month, and why'] }
      ]
    },
    timeline: {
      eyebrow: 'The monthly rhythm',
      title: 'The same four weeks, every month.',
      lead: 'No retainer hours to argue about: a counted list of work each month and a report at the end of it.',
      steps: [
        { when: 'Week 1', title: 'Re-check and plan', text: 'Questions re-asked on every engine in your plan. We pick the pages and fixes for the month and send you the list.' },
        { when: 'Weeks 2–3', title: 'Pages and profiles', text: 'Agents draft, people edit, you approve. Reviews and listings are worked through in the same weeks.' },
        { when: 'Week 4', title: 'Mentions and report', text: 'Outreach where your plan includes it, then the report: answers, leads and next month’s list.' }
      ]
    },
    versus: {
      eyebrow: 'Monthly or Pages?',
      title: 'Two different jobs. Many businesses run both.',
      columns: [
        { name: 'AI Search Monthly', url: '/monthly/', text: 'Keeps your existing website and your outside profiles winning.',
          items: ['Works on the pages and profiles you already have', 'A few new or refreshed pages a month', 'Reviews, listings and mentions kept current', 'Best when your site already covers your main services'] },
        { name: 'Pages', url: '/pages/', text: 'Builds a separate hub of conversion pages at volume.',
          items: ['A new hub on your domain, next to your main site', '100+ pages in the first 6 months', 'Covers comparisons, costs, locations and use cases', 'Best when buyers ask far more questions than your site answers'] }
      ]
    },
    excluded: NOT_INCLUDED,
    faq: [
      { q: 'Do I need a sprint before monthly work?',
        a: MONTHLY_RULE + ' Monthly work adds to a base. If AI crawlers can’t read your site or your facts differ from one listing to the next, the sprint fixes that first.' },
      { q: 'What does the starting price cover, and what raises it?',
        a: 'The starting price covers the monthly scope listed on this page. More questions and engines, more pages a month, more locations or markets and outreach for mentions raise the price. You get the exact monthly scope and price in writing before you pay.' },
      { q: 'Can I cancel?',
        a: 'Yes, any month. There is no minimum term, and every page, listing and account stays yours.' },
      { q: 'How is this different from Pages?',
        a: 'Monthly works on the website and profiles you already have, with a few new or refreshed pages a month. Pages builds a separate hub of conversion pages on your domain, at volume. Monthly keeps the base strong; Pages widens how many buying questions you answer.' },
      { q: 'How do you report leads?',
        a: 'Each month you get calls, forms and bookings by source and by page, where they can be tracked. We set up call and form tracking in the sprint, or in the first month if you start without one.' },
      { q: 'Can you guarantee a number of leads?',
        a: 'No. What we do guarantee is the work: the counted list for the month ships, and the report shows what it changed in the answers and in your enquiries.' }
    ]
  },

  /* ============================ Pages ============================ */
  {
    id: 'pages',
    url: '/pages/',
    name: 'Pages',
    longName: 'Organic conversion pages',
    short: 'Pages',
    kind: 'Month to month',
    scope: 'A hub of organic conversion pages on your domain',
    unit: '/month',
    schemaUnit: 'MON',
    billing: 'Billed monthly. Cancel any month.',
    card: {
      text: 'A separate hub on your domain with a page for each high-intent search your main site does not cover: services, locations, comparisons, costs. Written to be quoted by AI, to rank in Google and to bring the enquiry.',
      points: ['100+ pages in the first 6 months', 'Service, location, comparison and cost pages', 'Every page ends in a call, a form or a booking', 'Leads tracked back to the page'],
      cta: 'See Pages'
    },
    meta: {
      title: 'Pages: Organic Conversion Pages for AI Search and Google | searchwin.ai',
      description: 'A content hub on your domain: service, location, comparison and cost pages aimed at high-intent searches in Google and AI answers, each built to convert. 100+ pages in 6 months, leads tracked to the page. From $800 a month.',
      og: 'Pages: a page for every question buyers ask before they choose'
    },
    hero: {
      eyebrow: 'Pages · organic conversion pages',
      title: 'A page for every question buyers ask before they choose.',
      lead: 'We build a content hub on your domain: service, location, comparison and cost pages aimed at high-intent searches in Google and AI answers. Every page is written to sell and ends in a call, a form or a booking.'
    },
    offers: [
      {
        id: 'pages', audience: null, from: { usd: 800, eur: 700, gbp: 600 },
        covers: [
          'Done-for-you setup, from onboarding to launch',
          'A content hub on your domain: 100+ pages published in the first 6 months',
          'First pages live in days, not months',
          'Every agent and every feature on this page',
          'A person edits every page; you approve what is published'
        ]
      }
    ],
    priceNote: 'The starting price includes everything on this page. The final price depends on how many pages you want published, how fast you want to grow and how much outreach you add. You get it in writing before you pay.',
    sections: ['why', 'steps', 'formats', 'anatomy', 'features', 'offers', 'timeline', 'team', 'faq'],
    why: {
      eyebrow: 'Why a hub',
      title: 'Buyers ask hundreds of specific questions. Most websites answer a handful.',
      lead: 'Being found is half the job. The page a buyer lands on has to answer the question, earn trust and make the next step obvious.',
      cards: [
        { title: 'They research before they call', text: 'Comparisons, costs, locations, use cases: buyers search and ask AI about all of it before they contact a vendor.' },
        { title: 'AI answers from pages', text: 'When no page of yours answers the question, AI quotes someone else’s. A hub gives it your answer, your proof and your name.' },
        { title: 'Traffic is not the goal', text: 'Pages are picked by buying intent and built to end in an enquiry. We report leads by page, not visits.' }
      ]
    },
    steps: {
      eyebrow: 'How it works',
      title: 'From a buyer’s question to a lead in your inbox.',
      lead: 'Agents run the research, drafting and monitoring. People edit, approve and publish. You review progress for a few minutes a week.',
      items: [
        { title: 'Learn your business', text: 'Your services, areas, prices, proof and voice go into one fact base that every page is written from.' },
        { title: 'Find high-intent searches', text: 'The questions, comparisons, locations, categories and use cases buyers look up before they contact a vendor, ranked by intent.' },
        { title: 'Write pages that sell', text: 'For each search we study what Google and AI show today, then write a page that answers better and asks for the next step.' },
        { title: 'Publish to your domain', text: 'Pages go live in a hub on your site, in a folder or on a subdomain, where search engines and AI crawlers can read them.' },
        { title: 'Build trust around them', text: 'Internal links, citations and backlinks from relevant sites tell Google and AI the pages can be relied on.' },
        { title: 'Refresh and track', text: 'We watch positions, AI crawler visits and enquiries, refresh pages as answers change and report which pages bring leads.' }
      ]
    },
    formats: {
      eyebrow: 'Page types',
      title: 'Built for how buyers search, compare and decide.',
      lead: 'Different questions need different pages. The hub mixes them to match your market.',
      items: [
        { title: 'Service pages', text: 'One page per service, capability, industry or use case buyers search for.' },
        { title: 'Location pages', text: 'Your service in each town, region or country you sell in.' },
        { title: 'Comparison pages', text: '“X vs Y” and “best for” pages that help buyers weigh options, methods and vendors.' },
        { title: 'Alternatives pages', text: 'For buyers who know a competitor’s name and want to see who else there is.' },
        { title: 'Cost and pricing pages', text: 'Honest price ranges and what drives them, for people close to a decision.' },
        { title: 'Category pages', text: 'Structured pages for product groups, equipment types and catalog sections.' },
        { title: 'Guides and FAQs', text: 'Short answers to the questions buyers ask before, during and after choosing.' },
        { title: 'Visuals', text: 'Branded images, tables and diagrams that make a page easier to scan and to quote.' }
      ]
    },
    anatomy: {
      eyebrow: 'Inside every page',
      title: 'An organic conversion page answers, proves and asks.',
      lead: 'The same structure on every page, so a buyer who lands from Google or from an AI answer knows what you offer and what to do next.',
      items: [
        { title: 'The answer first', text: 'The question is answered in the opening lines, in words AI can quote.' },
        { title: 'Proof next to the claim', text: 'Reviews, credentials, cases, warranties and numbers sit where the buyer decides.' },
        { title: 'A clear offer', text: 'What is included, who it is for and a price range where you publish one.' },
        { title: 'One next step', text: 'A call, a form or a booking, in view on a phone without scrolling back.' },
        { title: 'Structured for machines', text: 'FAQ and service schema, clean headings and internal links to related pages.' },
        { title: 'Fast and tracked', text: 'Light pages that load quickly, with every enquiry tied to the page it came from.' }
      ]
    },
    features: {
      eyebrow: 'Included in every plan',
      title: 'The whole system from the first month.',
      lead: 'Pages is not sold feature by feature. Every plan gets all of it; plans differ in how many pages are published and how fast.',
      items: [
        { title: 'Content hub', text: '100+ pages published on your domain in the first 6 months.' },
        { title: 'Leads dashboard', text: 'Every enquiry, its status and where it came from, in one place.' },
        { title: 'Buyer journey tracking', text: 'See which pages each lead read before reaching out.' },
        { title: 'Spam protection', text: 'Junk enquiries are filtered out before they reach your team.' },
        { title: 'Quality backlinks', text: 'Authority signals that help search engines and AI trust your pages.' },
        { title: 'Custom analytics views', text: 'Reports built around the numbers that matter to your business.' }
      ]
    },
    timeline: {
      eyebrow: 'What to expect',
      title: 'From onboarding to steady enquiries.',
      lead: 'Search takes time to build, which is why it keeps paying once it does. We won’t promise leads in week one.',
      steps: [
        { when: 'Week 1', title: 'Research and plan', text: 'We learn your business, build the fact base and map the searches worth a page.' },
        { when: 'Weeks 2–4', title: 'First pages live', text: 'The hub is set up on your domain and the first pages are written, edited, approved and published.' },
        { when: 'Month 2', title: 'Authority', text: 'Links and citations start. Pages get indexed and picked up by AI crawlers.' },
        { when: 'Months 3–4', title: 'First enquiries', text: 'Pages rank and get cited. For most businesses this is when the first enquiries from the hub arrive.' },
        { when: 'Month 4 on', title: 'Compounding', text: 'New pages every month, older ones refreshed, and each lead tracked to the page that brought it.' }
      ]
    },
    faq: [
      { q: 'What are organic conversion pages?',
        a: 'Pages built for one high-intent search each, such as a service in a location, a comparison or a cost question. They are written to rank in Google and be quoted in AI answers, and every one ends in a clear next step: a call, a form or a booking.' },
      { q: 'Is this the same as SEO?',
        a: 'No. Classic SEO usually chases rankings and traffic. Pages starts from buying intent: we pick the searches people make right before they contact a vendor and build pages that turn those searches into enquiries.' },
      { q: 'Is the content written by AI?',
        a: 'AI agents do the research and the first draft from a fact base about your business. A person edits and fact-checks every page before it goes live, and you can approve each one. For technical or regulated niches a specialist reviews the page as well.' },
      { q: 'Where do the pages live?',
        a: 'On your domain, in a folder such as yourbusiness.com/guides/ or on a subdomain, in your design. You own every page, and they stay with you if you stop.' },
      { q: 'Do I need to write briefs or manage a content calendar?',
        a: 'No. We handle research, planning, writing, publishing, links and tracking. After a short onboarding you spend a few minutes a week reviewing progress and approving pages.' },
      { q: 'How soon will I see leads?',
        a: 'The hub is live in under 30 days. Most businesses should expect the first enquiries from it around month 3 or 4, and more from there. It depends on your market, your competition and how strong your site is today, and we don’t promise a number.' },
      { q: 'What is included at the starting price, and what changes it?',
        a: 'Everything on this page: setup, research, writing, publishing, links, tracking and support, with every agent switched on. The final price depends on how many pages you want published, how fast you want to grow and how much outreach you add.' },
      { q: 'Do I need the AI Search Sprint first?',
        a: 'Not always. If AI crawlers can read your site and your facts are consistent, Pages can start on its own. If the base is broken, the free audit says so and we recommend the sprint first, or both together.' },
      { q: 'How is success measured?',
        a: 'By qualified enquiries: calls, forms and bookings by page. Under that we report positions in Google, mentions in AI answers, AI crawler visits and how each page performs.' }
    ]
  }
];

/* ---------------------------------------------------------------- helpers */

export function findSolution(id) {
  return SOLUTIONS.find((s) => s.id === id) || null;
}

/** Every plan a visitor can ask for on /start/: one per solution and audience. */
export function allOffers() {
  return SOLUTIONS.flatMap((s) => s.offers.map((o) => ({
    ...o,
    solution: s,
    audienceLabel: o.audience ? AUDIENCES[o.audience].label : null,
    name: o.audience ? `${s.name}, ${AUDIENCES[o.audience].label.toLowerCase()}` : s.name
  })));
}

export function findOffer(id) {
  return allOffers().find((o) => o.id === id) || null;
}

/** "1,500" */
export function formatPrice(n) {
  return Number(n).toLocaleString('en-US');
}

/** "$900", "€1,400" */
export function money(currencyId, n) {
  const c = CURRENCIES.find((x) => x.id === currencyId) || CURRENCIES[0];
  return `${c.symbol}${formatPrice(n)}`;
}

/** "from $900 one-off", "from £350/month" */
export function fromPrice(offer, currencyId) {
  const unit = offer.solution.unit;
  return `from ${money(currencyId, offer.from[currencyId])}${unit.startsWith('/') ? '' : ' '}${unit}`;
}

/** "$900, €850 or £750" */
export function allCurrencies(offer) {
  const parts = CURRENCIES.map((c) => money(c.id, offer.from[c.id]));
  return `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`;
}

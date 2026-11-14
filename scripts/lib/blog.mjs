// The blog: /blog/ (hub), Insights (articles from content/insights/*.md) and Success stories (data/stories.js).
//
//   /blog/                              the hub: latest articles and stories
//   /blog/insights/                     every article
//   /blog/insights/{slug}/              an article
//   /blog/success-stories/              every published story (an honest empty state until there is one)
//   /blog/success-stories/{slug}/       a story, on a template built to move the reader to the next step
//   /blog/feed.xml                      RSS of the articles
//
// Drafts are written as pages, so they can be read at their address, but they are not listed, not in the
// sitemap or the feed, and they carry noindex.

import { SITE, AUDIENCES, BOOKING_URL, findSolution } from '../../data/solutions.js';
import { allInsights, publishedInsights, allStories, publishedStories, formatDate, prose } from './content.mjs';
import { esc, icon, ind, pad2, price, offersOf, startUrl, ld, ORG, WEBSITE, pageShell, BLOG } from './shared.mjs';

const CSS = ['/assets/css/blog.css'];
const FEED_LINK = `<link rel="alternate" type="application/rss+xml" href="${BLOG.feed}" title="searchwin.ai Insights">`;
const DISCLAIMER = 'These are this client’s results. Yours depend on your market, your competition and where you start. We don’t promise a number.';

/* ---------------------------------------------------------------- pieces */

const crumbs = (items) => [
  `<nav class="crumbs" aria-label="Breadcrumb">`,
  `  <ol>${items.map((it) => `<li><a href="${it.href}">${esc(it.label)}</a></li>`).join('')}</ol>`,
  `</nav>`
].join('\n');

const crumbSchema = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [{ label: 'searchwin.ai', href: '/' }, ...items].map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.label, item: `${SITE}${it.href}` }))
});

function postCard(p, level = 3) {
  return [
    `<article class="postcard" data-reveal>`,
    `  <p class="postcard__meta"><span class="tagchip">${esc(p.tag)}</span><span><time datetime="${p.date}">${formatDate(p.date)}</time> · ${p.minutes} min read</span></p>`,
    `  <h${level} class="postcard__title"><a href="${p.url}">${esc(p.title)}</a></h${level}>`,
    `  <p class="postcard__text">${esc(p.description)}</p>`,
    `  <p class="postcard__more" aria-hidden="true">Read the article${icon('arrow')}</p>`,
    `</article>`
  ].join('\n');
}

const solutionNames = (s) => s.solutions.map((id) => findSolution(id).name).join(' + ');

function storyCard(s, level = 3) {
  return [
    `<article class="storycard" data-reveal>`,
    `  <p class="storycard__meta">${esc(s.client.industry)} · ${esc(s.client.location)}</p>`,
    `  <h${level} class="storycard__title"><a href="${s.url}">${esc(s.title)}</a></h${level}>`,
    `  <ul class="storycard__metrics">`,
    ...s.metrics.slice(0, 2).map((m) => `    <li><b>${esc(m.value)}</b><span>${esc([m.unit, m.label].filter(Boolean).join(' '))}</span></li>`),
    `  </ul>`,
    `  <p class="storycard__foot"><span class="tagchip">${esc(solutionNames(s))}</span><span class="postcard__more" aria-hidden="true">Read the story${icon('arrow')}</span></p>`,
    `</article>`
  ].join('\n');
}

/** The "free AI check" box inside a story or an article. */
function ctaBox(title, text, location) {
  return [
    `<aside class="ctabox" aria-label="Free AI check">`,
    `  <div>`,
    `    <p class="ctabox__title">${esc(title)}</p>`,
    `    <p class="ctabox__text">${esc(text)}</p>`,
    `  </div>`,
    `  <a class="btn btn--primary" href="/ai-check/" data-ai-check="${location}">Run a free AI check${icon('arrow', 'btn__icon')}</a>`,
    `</aside>`
  ].join('\n');
}

/** The card that stays in view next to the text on a desktop. */
function sideCta(title, text, location, offerId) {
  return [
    `<div class="sidecta">`,
    `  <p class="sidecta__title">${esc(title)}</p>`,
    `  <p class="sidecta__text">${esc(text)}</p>`,
    `  <a class="btn btn--primary btn--block" href="/ai-check/" data-ai-check="${location}">Run a free AI check${icon('arrow', 'btn__icon')}</a>`,
    ...(offerId ? [`  <a class="btn btn--outline btn--block" href="${startUrl(offerId)}" data-plan-cta="${offerId}">Get a fixed quote</a>`] : []),
    `  <p class="sidecta__note">Free, 2 minutes, no email needed.</p>`,
    `</div>`
  ].join('\n');
}

/** The solution behind a story or next to an article, with its starting price and both next steps. */
function solutionRef(solution, offer, eyebrow) {
  return [
    `<section class="band band--beige solref" aria-labelledby="solref-title">`,
    `  <div class="container">`,
    `    <div class="solref__card" data-reveal>`,
    `      <div class="solref__main">`,
    `        <p class="eyebrow">${esc(eyebrow)}</p>`,
    `        <h2 class="h2" id="solref-title">${esc(solution.name)}</h2>`,
    `        <p class="solref__kind">${esc(solution.kind)} · ${esc(solution.scope.charAt(0).toLowerCase() + solution.scope.slice(1))}</p>`,
    `        <p class="solref__text">${esc(solution.card.text)}</p>`,
    `        <ul class="solcard__list">`,
    ...solution.card.points.map((x) => `          <li>${icon('check')}${esc(x)}</li>`),
    `        </ul>`,
    `      </div>`,
    `      <div class="solref__side">`,
    `        <p class="pricebox__title">Starting price</p>`,
    ...(offer.audience ? [`        <p class="pricebox__who">${esc(AUDIENCES[offer.audience].label)}</p>`] : []),
    `        <p class="pricebox__price"><span class="pricebox__from">from</span> ${price(offer.from)}${solution.unit.startsWith('/') ? '' : ' '}<span class="pricebox__unit">${esc(solution.unit)}</span></p>`,
    `        <a class="btn btn--primary btn--block" href="${startUrl(offer.id)}" data-plan-cta="${offer.id}">Get a fixed quote${icon('arrow', 'btn__icon')}</a>`,
    `        <a class="btn btn--outline btn--block" href="${solution.url}" data-solution="${solution.id}">See ${esc(solution.name)}</a>`,
    `        <p class="pricebox__note">${esc(solution.billing)} Exact scope and price in writing before you pay.</p>`,
    `      </div>`,
    `    </div>`,
    `  </div>`,
    `</section>`
  ].join('\n');
}

function finalCta(title, lead, location, offerId) {
  return [
    `<section class="cta band band--image home-cta" id="start" aria-labelledby="cta-title">`,
    `  <img class="band__bg" src="/assets/img/bg/bg-sunset.webp" alt="" width="1280" height="854" loading="lazy">`,
    `  <div class="container home-cta__inner">`,
    `    <p class="eyebrow" data-reveal>Free first step</p>`,
    `    <h2 class="h2" id="cta-title" data-reveal>${esc(title)}</h2>`,
    `    <p class="lead" data-reveal>${esc(lead)}</p>`,
    `    <div class="home-cta__actions" data-reveal>`,
    `      <a class="btn btn--primary btn--lg" href="/ai-check/" data-ai-check="${location}">Run a free AI check${icon('arrow', 'btn__icon')}</a>`,
    ...(offerId ? [`      <a class="textlink home-cta__link" href="${startUrl(offerId)}" data-plan-cta="${offerId}">Get a fixed quote</a>`] : []),
    `      <a class="textlink home-cta__link" href="${BOOKING_URL}" target="_blank" rel="noopener" data-booking="${location}">Book a 15-minute call</a>`,
    `    </div>`,
    `  </div>`,
    `</section>`
  ].join('\n');
}

/** A story on a phone: a bar that stays at the bottom once the reader is past the top of the page.
    The nav already carries the free check, so the bar offers the other step: a quote. */
const stickyBar = (text, offerId) => [
  `<div class="stickybar" data-stickybar hidden>`,
  `  <p>${esc(text)}</p>`,
  `  <a class="btn btn--primary btn--sm" href="${startUrl(offerId)}" data-plan-cta="${offerId}">Get a quote</a>`,
  `</div>`
].join('\n');

function listHero(eyebrow, title, lead, trail) {
  return [
    `<section class="hero blog-hero" id="top" aria-labelledby="hero-title">`,
    `  <div class="container blog-hero__inner">`,
    ...(trail.length ? [ind(crumbs(trail), 4)] : []),
    `    <p class="eyebrow">${esc(eyebrow)}</p>`,
    `    <h1 class="h1 blog-hero__title" id="hero-title">${esc(title)}</h1>`,
    `    <p class="lead">${esc(lead)}</p>`,
    `  </div>`,
    `</section>`
  ].join('\n');
}

const articleSchema = (type, p, url, section) => ({
  '@type': type,
  '@id': `${url}#article`,
  headline: p.title,
  description: p.description,
  datePublished: p.date,
  dateModified: p.updated || p.date,
  articleSection: section,
  inLanguage: 'en',
  mainEntityOfPage: url,
  image: `${SITE}/assets/img/og.png`,
  author: { '@id': `${SITE}/#org` },
  publisher: { '@id': `${SITE}/#org` }
});

/* ---------------------------------------------------------------- hub and lists */

const HUB = { label: 'Blog', href: BLOG.hub };
const INSIGHTS = { label: 'Insights', href: BLOG.insights };
const STORIES = { label: 'Success stories', href: BLOG.stories };

function hubPage() {
  const posts = publishedInsights();
  const stories = publishedStories();
  const title = 'Blog: Insights and Success Stories | searchwin.ai';
  const description = 'Insights on getting leads from AI search and Google: high-intent questions, pages that convert and how to measure it. Success stories from clients, with their numbers.';
  const main = [
    listHero('Blog', stories.length ? 'Insights and success stories.' : 'Insights on leads from AI search and Google.',
      'How buyers ask AI and Google who to choose, what makes a page worth quoting and how to turn the visit into an enquiry.', []),
    ``,
    `<section class="section bloglist" aria-labelledby="insights-title">`,
    `  <div class="container">`,
    `    <header class="bloglist__head">`,
    `      <h2 class="h2" id="insights-title" data-reveal>Insights</h2>`,
    `      <a class="textlink" href="${BLOG.insights}" data-reveal>All insights</a>`,
    `    </header>`,
    `    <div class="postgrid">`,
    ind(posts.slice(0, 6).map((p) => postCard(p)).join('\n'), 6),
    `    </div>`,
    `  </div>`,
    `</section>`,
    ...(stories.length ? [
      ``,
      `<section class="band band--beige bloglist" aria-labelledby="stories-title">`,
      `  <div class="container">`,
      `    <header class="bloglist__head">`,
      `      <h2 class="h2" id="stories-title" data-reveal>Success stories</h2>`,
      `      <a class="textlink" href="${BLOG.stories}" data-reveal>All success stories</a>`,
      `    </header>`,
      `    <div class="postgrid">`,
      ind(stories.slice(0, 3).map((s) => storyCard(s)).join('\n'), 6),
      `    </div>`,
      `  </div>`,
      `</section>`
    ] : []),
    ``,
    finalCta('See what AI says about your business.', 'Free, 2 minutes, no call needed.', 'blog-final')
  ].join('\n');
  return pageShell({
    title, description, url: BLOG.hub, og: 'Insights and success stories', page: 'blog', nav: 'blog', css: CSS, head: FEED_LINK,
    source: 'content/insights/ and data/stories.js',
    schema: ld([ORG, WEBSITE, { '@type': 'Blog', '@id': `${SITE}${BLOG.hub}#blog`, url: `${SITE}${BLOG.hub}`, name: 'searchwin.ai blog', description, publisher: { '@id': `${SITE}/#org` } }, crumbSchema([HUB])]),
    main
  });
}

function insightsIndex() {
  const posts = publishedInsights();
  const title = 'Insights: Leads from AI Search and Google | searchwin.ai';
  const description = 'Practical articles on organic lead generation in the AI search era: high-intent questions, organic conversion pages, AI search optimization and how to measure enquiries.';
  const main = [
    listHero('Insights', 'How to get leads from AI search and Google.', 'Practical articles on high-intent questions, pages that convert and measuring what matters: enquiries.', [HUB]),
    ``,
    `<section class="section bloglist" aria-label="Articles">`,
    `  <div class="container">`,
    `    <div class="postgrid">`,
    ind(posts.map((p) => postCard(p, 2)).join('\n'), 6),
    `    </div>`,
    `  </div>`,
    `</section>`,
    ``,
    finalCta('See what AI says about your business.', 'Free, 2 minutes, no call needed.', 'insights-final')
  ].join('\n');
  return pageShell({
    title, description, url: BLOG.insights, og: 'Insights: leads from AI search and Google', page: 'insights', nav: 'insights', css: CSS, head: FEED_LINK,
    source: 'content/insights/',
    schema: ld([ORG, WEBSITE,
      { '@type': 'CollectionPage', '@id': `${SITE}${BLOG.insights}#page`, url: `${SITE}${BLOG.insights}`, name: title, description, isPartOf: { '@id': `${SITE}/#website` } },
      { '@type': 'ItemList', itemListElement: posts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}${p.url}`, name: p.title })) },
      crumbSchema([HUB, INSIGHTS])]),
    main
  });
}

function storiesIndex() {
  const stories = publishedStories();
  const title = 'Success Stories: Leads from AI Search and Google | searchwin.ai';
  const description = 'Client stories with their numbers: where AI named them before and after, what we shipped, and the enquiries that followed.';
  const list = stories.length
    ? [
      `<section class="section bloglist" aria-label="Stories">`,
      `  <div class="container">`,
      `    <div class="postgrid">`,
      ind(stories.map((s) => storyCard(s, 2)).join('\n'), 6),
      `    </div>`,
      `    <p class="bloglist__note" data-reveal>${esc(DISCLAIMER.replace('this client’s results', 'each client’s own results'))}</p>`,
      `  </div>`,
      `</section>`
    ]
    : [
      `<section class="section bloglist" aria-label="Stories">`,
      `  <div class="container">`,
      `    <div class="blogempty">`,
      `      <h2 class="blogempty__title">The first client stories are on their way.</h2>`,
      `      <p>We publish a story only when the client has approved its name, its words and every number in it. Until then, see where your own business stands, or read how the work is done.</p>`,
      `      <div class="blogempty__actions">`,
      `        <a class="btn btn--primary" href="/ai-check/" data-ai-check="stories-empty">Run a free AI check${icon('arrow', 'btn__icon')}</a>`,
      `        <a class="textlink" href="${BLOG.insights}">Read the insights</a>`,
      `      </div>`,
      `    </div>`,
      `  </div>`,
      `</section>`
    ];
  const main = [
    listHero('Success stories', 'What changed for our clients, in their numbers.', 'Each story shows the same AI questions before and after, what we shipped and the enquiries that followed.', [HUB]),
    ``,
    ...list,
    ``,
    finalCta('See what AI says about your business.', 'Free, 2 minutes, no call needed.', 'stories-final')
  ].join('\n');
  return pageShell({
    title, description, url: BLOG.stories, og: 'Success stories', page: 'stories', nav: 'stories', css: CSS,
    // Nothing to index until the first story is published
    robots: stories.length ? undefined : 'noindex, follow',
    source: 'data/stories.js',
    schema: ld([ORG, WEBSITE,
      { '@type': 'CollectionPage', '@id': `${SITE}${BLOG.stories}#page`, url: `${SITE}${BLOG.stories}`, name: title, description, isPartOf: { '@id': `${SITE}/#website` } },
      ...(stories.length ? [{ '@type': 'ItemList', itemListElement: stories.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}${s.url}`, name: s.title })) }] : []),
      crumbSchema([HUB, STORIES])]),
    main
  });
}

/* ---------------------------------------------------------------- an article */

function insightPage(p) {
  const url = `${SITE}${p.url}`;
  const solution = p.solution ? findSolution(p.solution) : null;
  const offer = solution ? offersOf(solution)[0] : null;
  const box = ctaBox('Does AI name your business?', 'Ask ChatGPT three real questions about your business and see who it recommends. Free, 2 minutes, no email needed.', 'insight-inline');
  const body = p.html.includes('<p>[[cta]]</p>') ? p.html.replace('<p>[[cta]]</p>', box) : p.html;
  const related = publishedInsights().filter((x) => x.slug !== p.slug).slice(0, 3);
  const main = [
    `<article class="article" data-post="${p.slug}">`,
    `<header class="hero article-hero" id="top">`,
    `  <div class="container article-hero__inner">`,
    ...(p.draft ? [`    <p class="draftnote">Draft. This article is not listed on the site and search engines are asked not to index it.</p>`] : []),
    ind(crumbs([HUB, INSIGHTS]), 4),
    `    <p class="article-hero__meta"><span class="tagchip">${esc(p.tag)}</span><time datetime="${p.date}">${formatDate(p.date)}</time><span>${p.minutes} min read</span></p>`,
    `    <h1 class="h1 article-hero__title" id="hero-title">${esc(p.title)}</h1>`,
    `    <p class="lead">${esc(p.description)}</p>`,
    `    <p class="article-hero__by">By the searchwin.ai team${p.updated ? ` · Updated <time datetime="${p.updated}">${formatDate(p.updated)}</time>` : ''}</p>`,
    `  </div>`,
    `</header>`,
    ``,
    `<div class="section article__body">`,
    `  <div class="container article__grid">`,
    `    <div class="article__main">`,
    ...(p.takeaways.length ? [
      `      <aside class="takeaways" aria-labelledby="takeaways-title">`,
      `        <p class="takeaways__title" id="takeaways-title">Key takeaways</p>`,
      `        <ul>`,
      ...p.takeaways.map((t) => `          <li>${icon('check')}${esc(t)}</li>`),
      `        </ul>`,
      `      </aside>`
    ] : []),
    `      <div class="prose">`,
    ind(body, 8),
    `      </div>`,
    ind(ctaBox('See where you stand today.', 'The free AI check asks ChatGPT three real questions about your business and shows who it names. No email needed.', 'insight-end'), 6),
    `    </div>`,
    `    <aside class="article__aside">`,
    ...(p.toc.length > 1 ? [
      `      <nav class="toc" aria-label="On this page">`,
      `        <p class="toc__title">On this page</p>`,
      `        <ol>`,
      ...p.toc.map((t) => `          <li><a href="#${t.id}">${t.text}</a></li>`),
      `        </ol>`,
      `      </nav>`
    ] : []),
    ind(sideCta('Does AI name your business?', 'See what ChatGPT says when customers ask who to choose.', 'insight-aside'), 6),
    `    </aside>`,
    `  </div>`,
    `</div>`,
    `</article>`,
    ...(solution ? [``, solutionRef(solution, offer, 'The solution for this')] : []),
    ...(related.length ? [
      ``,
      `<section class="section bloglist" aria-labelledby="related-title">`,
      `  <div class="container">`,
      `    <header class="bloglist__head">`,
      `      <h2 class="h2" id="related-title" data-reveal>Keep reading</h2>`,
      `      <a class="textlink" href="${BLOG.insights}" data-reveal>All insights</a>`,
      `    </header>`,
      `    <div class="postgrid">`,
      ind(related.map((x) => postCard(x)).join('\n'), 6),
      `    </div>`,
      `  </div>`,
      `</section>`
    ] : []),
    ``,
    finalCta('See what AI says about your business.', 'Free, 2 minutes, no call needed.', 'insight-final')
  ].join('\n');
  return pageShell({
    title: `${p.title} | searchwin.ai`, description: p.description, url: p.url, og: p.title, ogType: 'article',
    page: 'insight', nav: 'insights', css: CSS, head: FEED_LINK,
    robots: p.draft ? 'noindex, follow' : undefined,
    source: `content/insights/${p.slug}.md`,
    schema: ld([ORG, WEBSITE, articleSchema('BlogPosting', p, url, 'Insights'), crumbSchema([HUB, INSIGHTS, { label: p.title, href: p.url }])]),
    main
  });
}

/* ---------------------------------------------------------------- a success story */

function storyPage(s) {
  const url = `${SITE}${s.url}`;
  const solution = findSolution(s.solutions[0]);
  const offer = offersOf(solution).find((o) => o.audience === s.audience) || offersOf(solution)[0];
  const others = publishedStories().filter((x) => x.slug !== s.slug).slice(0, 3);
  const posts = publishedInsights().slice(0, 3);
  const state = (v) => (/^not /i.test(v) ? 'ba ba--out' : 'ba ba--in');
  const glance = [
    ['Client', esc(s.client.name)],
    ['Industry', esc(s.client.industry)],
    ['Location', esc(s.client.location)],
    ...(s.client.size ? [['Size', esc(s.client.size)]] : []),
    ['Solution', s.solutions.map((id) => { const x = findSolution(id); return `<a href="${x.url}" data-solution="${x.id}">${esc(x.name)}</a>`; }).join(', ')],
    ['Timeline', esc(s.period)],
    ['Engines checked', esc(s.engines)]
  ];
  const main = [
    `<article class="story" data-story="${s.slug}">`,
    `<header class="hero story-hero" id="top">`,
    `  <div class="container story-hero__inner">`,
    ...(s.sample ? [`    <p class="draftnote"><b>Sample story.</b> The business and every number on this page are illustrative. It shows the layout of a client story and is not a real client.</p>`]
      : s.draft ? [`    <p class="draftnote"><b>Draft.</b> This story is not listed on the site and search engines are asked not to index it.</p>`] : []),
    ind(crumbs([HUB, STORIES]), 4),
    `    <ul class="story-hero__chips">`,
    `      <li>${esc(s.client.industry)}</li><li>${esc(s.client.location)}</li><li>${esc(solutionNames(s))}</li>`,
    `    </ul>`,
    `    <h1 class="h1 story-hero__title" id="hero-title">${esc(s.title)}</h1>`,
    `    <p class="lead story-hero__lead">${esc(s.description)}</p>`,
    `    <ul class="story-metrics" aria-label="Results">`,
    ...s.metrics.map((m) => `      <li><p class="story-metrics__value">${esc(m.value)}${m.unit ? `<span>${esc(m.unit)}</span>` : ''}</p><p class="story-metrics__label">${esc(m.label)}</p></li>`),
    `    </ul>`,
    `    <div class="story-hero__ctas">`,
    `      <a class="btn btn--primary btn--lg" href="/ai-check/" data-ai-check="story-hero">Run a free AI check${icon('arrow', 'btn__icon')}</a>`,
    `      <a class="btn btn--outline btn--lg" href="${startUrl(offer.id)}" data-plan-cta="${offer.id}">Get a fixed quote</a>`,
    `    </div>`,
    `    <p class="story-hero__note">The check is free, takes 2 minutes and needs no email.</p>`,
    `  </div>`,
    `</header>`,
    ``,
    `<div class="section story__body">`,
    `  <div class="container story__grid">`,
    `    <div class="story__main">`,
    `      <figure class="story-quote">`,
    `        <blockquote><p>“${esc(s.quote.text)}”</p></blockquote>`,
    `        <figcaption><b>${esc(s.quote.name)}</b>${s.quote.role ? `, ${esc(s.quote.role)}` : ''}</figcaption>`,
    `      </figure>`,
    ``,
    `      <section class="prose" aria-labelledby="challenge">`,
    `        <h2 id="challenge">The challenge</h2>`,
    ind(prose(s.challenge), 8),
    `      </section>`,
    ``,
    `      <section class="prose" aria-labelledby="work">`,
    `        <h2 id="work">What we did</h2>`,
    ...(s.workIntro ? [ind(prose(s.workIntro), 8)] : []),
    `        <ul class="plan__list story__work">`,
    ...s.work.map((x) => `          <li>${icon('check')}${esc(x)}</li>`),
    `        </ul>`,
    `      </section>`,
    ``,
    ind(ctaBox('Where does AI put your business today?', 'The first thing we did here was ask AI the questions buyers ask. You can run the same check on your business in 2 minutes.', 'story-mid'), 6),
    ``,
    `      <section class="prose" aria-labelledby="results">`,
    `        <h2 id="results">The results</h2>`,
    ind(prose(s.results.intro), 8),
    `        <div class="story-table">`,
    `          <table>`,
    `            <caption class="sr-only">The same AI questions before and after</caption>`,
    `            <thead><tr><th scope="col">Question</th><th scope="col">Engine</th><th scope="col">Before</th><th scope="col">After</th></tr></thead>`,
    `            <tbody>`,
    ...s.results.rows.map((r) => `              <tr><td>${esc(r.question)}</td><td>${esc(r.engine)}</td><td><span class="${/^not /i.test(r.before) ? 'ba ba--out' : 'ba'}">${esc(r.before)}</span></td><td><span class="${state(r.after)}">${esc(r.after)}</span></td></tr>`),
    `            </tbody>`,
    `          </table>`,
    `        </div>`,
    ...(s.results.leads && s.results.leads.length ? [
      `        <ul class="story-leads">`,
      ...s.results.leads.map((l) => `          <li><b>${esc(l.n)}</b><span>${esc(l.label)}</span></li>`),
      `        </ul>`
    ] : []),
    `        <p class="story__source">${esc(s.results.source)}</p>`,
    `        <p class="story__disclaimer">${esc(DISCLAIMER)}</p>`,
    `      </section>`,
    ``,
    `      <section class="prose" aria-labelledby="why">`,
    `        <h2 id="why">What made the difference</h2>`,
    `        <ol class="story-takeaways">`,
    ...s.takeaways.map((t, i) => `          <li><span class="story-takeaways__n">${pad2(i + 1)}</span><div><h3>${esc(t.title)}</h3><p>${esc(t.text)}</p></div></li>`),
    `        </ol>`,
    `      </section>`,
    ``,
    `      <section class="story-fit" aria-labelledby="fit">`,
    `        <h2 id="fit">Is this close to your business?</h2>`,
    `        <p>The same approach is likely to fit if:</p>`,
    `        <ul class="plan__list">`,
    ...s.fit.map((x) => `          <li>${icon('check')}${esc(x)}</li>`),
    `        </ul>`,
    `        <div class="story-fit__actions">`,
    `          <a class="btn btn--primary" href="/ai-check/" data-ai-check="story-fit">Run a free AI check${icon('arrow', 'btn__icon')}</a>`,
    `          <a class="textlink" href="${BOOKING_URL}" target="_blank" rel="noopener" data-booking="story-fit">Or book a 15-minute call</a>`,
    `        </div>`,
    `      </section>`,
    `    </div>`,
    ``,
    `    <aside class="story__aside">`,
    `      <div class="glance">`,
    `        <p class="glance__title">At a glance</p>`,
    `        <dl>`,
    ...glance.map(([k, v]) => `          <div><dt>${k}</dt><dd>${v}</dd></div>`),
    `        </dl>`,
    `      </div>`,
    ind(sideCta('Want a result like this?', 'Start by seeing what AI says about your business today.', 'story-aside', offer.id), 6),
    `    </aside>`,
    `  </div>`,
    `</div>`,
    `</article>`,
    ``,
    solutionRef(solution, offer, 'The solution behind this story'),
    ...(others.length ? [
      ``,
      `<section class="section bloglist" aria-labelledby="more-title">`,
      `  <div class="container">`,
      `    <header class="bloglist__head">`,
      `      <h2 class="h2" id="more-title" data-reveal>More success stories</h2>`,
      `      <a class="textlink" href="${BLOG.stories}" data-reveal>All success stories</a>`,
      `    </header>`,
      `    <div class="postgrid">`,
      ind(others.map((x) => storyCard(x)).join('\n'), 6),
      `    </div>`,
      `  </div>`,
      `</section>`
    ] : posts.length ? [
      ``,
      `<section class="section bloglist" aria-labelledby="more-title">`,
      `  <div class="container">`,
      `    <header class="bloglist__head">`,
      `      <h2 class="h2" id="more-title" data-reveal>How the work is done</h2>`,
      `      <a class="textlink" href="${BLOG.insights}" data-reveal>All insights</a>`,
      `    </header>`,
      `    <div class="postgrid">`,
      ind(posts.map((x) => postCard(x)).join('\n'), 6),
      `    </div>`,
      `  </div>`,
      `</section>`
    ] : []),
    ``,
    finalCta('Want a result like this for your business?', 'Start with the free AI check: 2 minutes, no call needed. Or ask for a fixed quote.', 'story-final', offer.id)
  ].join('\n');
  return pageShell({
    title: `${s.title} | searchwin.ai`, description: s.description, url: s.url, og: s.title, ogType: 'article',
    page: 'story', nav: 'stories', css: CSS,
    robots: s.draft ? 'noindex, follow' : undefined,
    source: 'data/stories.js',
    schema: ld([ORG, WEBSITE, articleSchema('Article', s, url, 'Success stories'), crumbSchema([HUB, STORIES, { label: s.title, href: s.url }])]),
    main,
    after: stickyBar('Want a result like this?', offer.id)
  });
}

/* ---------------------------------------------------------------- feed, sitemap, llms.txt */

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function feed() {
  const posts = publishedInsights();
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
    `  <channel>`,
    `    <title>searchwin.ai Insights</title>`,
    `    <link>${SITE}${BLOG.insights}</link>`,
    `    <description>Practical articles on getting leads from AI search and Google.</description>`,
    `    <language>en</language>`,
    `    <atom:link href="${SITE}${BLOG.feed}" rel="self" type="application/rss+xml"/>`,
    ...posts.map((p) => [
      `    <item>`,
      `      <title>${xml(p.title)}</title>`,
      `      <link>${SITE}${p.url}</link>`,
      `      <guid isPermaLink="true">${SITE}${p.url}</guid>`,
      `      <pubDate>${new Date(`${p.date}T09:00:00Z`).toUTCString()}</pubDate>`,
      `      <description>${xml(p.description)}</description>`,
      `    </item>`
    ].join('\n')),
    `  </channel>`,
    `</rss>`,
    ``
  ].join('\n');
}

/** <url> entries for sitemap.xml: the hub, the lists and every published article and story. */
export function sitemapBlock() {
  const posts = publishedInsights();
  const stories = publishedStories();
  const latest = (list) => list.map((x) => x.updated || x.date).sort().pop();
  const entry = (loc, lastmod, priority) => [`<url>`, `  <loc>${SITE}${loc}</loc>`, ...(lastmod ? [`  <lastmod>${lastmod}</lastmod>`] : []), `  <changefreq>monthly</changefreq>`, `  <priority>${priority}</priority>`, `</url>`].join('\n');
  return [
    entry(BLOG.hub, latest([...posts, ...stories]), '0.7'),
    entry(BLOG.insights, latest(posts), '0.7'),
    ...posts.map((p) => entry(p.url, p.updated || p.date, '0.6')),
    ...(stories.length ? [entry(BLOG.stories, latest(stories), '0.8')] : []),
    ...stories.map((s) => entry(s.url, s.updated || s.date, '0.8'))
  ].join('\n');
}

export function llmsBlogBlock() {
  const posts = publishedInsights();
  const stories = publishedStories();
  return [
    `## Blog`,
    ``,
    `- [Insights](${SITE}${BLOG.insights}): practical articles on getting leads from AI search and Google.`,
    ...posts.map((p) => `- [${p.title}](${SITE}${p.url}): ${p.description}`),
    ...(stories.length ? [`- [Success stories](${SITE}${BLOG.stories}): client stories with the same AI questions before and after and the enquiries that followed.`] : []),
    ...stories.map((s) => `- [${s.title}](${SITE}${s.url}): ${s.description}`)
  ].join('\n');
}

/** Every blog file, by path. */
export function renderBlog() {
  const out = {
    'blog/index.html': hubPage(),
    'blog/insights/index.html': insightsIndex(),
    'blog/success-stories/index.html': storiesIndex(),
    'blog/feed.xml': feed()
  };
  for (const p of allInsights()) out[`blog/insights/${p.slug}/index.html`] = insightPage(p);
  for (const s of allStories()) out[`blog/success-stories/${s.slug}/index.html`] = storyPage(s);
  return out;
}

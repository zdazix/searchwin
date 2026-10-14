// Shared by the /ai-check page and the server: verdicts, name normalisation and the totals
// across the answers. The page adds them up itself as the answers arrive, so there is no
// check record on the server. No dependencies, plain ES module.

export const VERDICTS = {
  not_recommended: { label: 'Not recommended', offer: 'Find out why ChatGPT skips you' },
  sometimes: { label: 'Sometimes recommended', offer: 'Find out how to show up every time' },
  not_first: { label: 'Recommended, not first', offer: 'Find out how to become the first name' },
  top_pick: { label: 'Top pick', offer: 'Keep it: see where competitors are catching up' }
};

/** True when host equals domain or is a subdomain of it. */
export function hostMatches(host, domain) {
  if (!host || !domain) return false;
  return host === domain || host.endsWith('.' + domain);
}

const NAME_TAILS = new Set(['llc', 'inc', 'co', 'corp', 'company', 'the']);

/**
 * Business name normalisation from the spec: lower case → & to "and" → no punctuation →
 * drop llc/inc/co/corp/company/the → collapse spaces.
 */
export function normalizeName(input) {
  if (typeof input !== 'string') return '';
  let s = input.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  s = s.replace(/&amp;/g, '&').replace(/&/g, ' and ').replace(/\+/g, ' and ');
  s = s.replace(/['’‘`]/g, '').replace(/\.(?=\S)/g, '').replace(/[^a-z0-9]+/g, ' ');
  return s.split(' ').filter((w) => w && !NAME_TAILS.has(w)).join(' ');
}

/**
 * @param answers answers that loaded: { client: { found, position }, businesses: [...], sources: [{ domain }] }
 * @param clientDomain bare domain of the client's site
 */
export function summarize(answers, clientDomain) {
  const total = answers.length;
  const mentions = answers.filter((a) => a.client.found).length;
  const positions = answers.map((a) => a.client.position).filter((p) => Number.isInteger(p));
  const bestPosition = positions.length ? Math.min(...positions) : null;

  let verdict;
  if (mentions === 0) verdict = 'not_recommended';
  else if (mentions < total) verdict = 'sometimes';
  else if (bestPosition === 1) verdict = 'top_pick';
  else verdict = 'not_first';

  return {
    total,
    mentions_count: mentions,
    best_position: bestPosition,
    verdict,
    verdict_label: VERDICTS[verdict].label,
    offer_title: VERDICTS[verdict].offer,
    competitors: competitors(answers, total),
    sources: topSources(answers, clientDomain)
  };
}

export function competitors(answers, total) {
  const byKey = new Map();
  for (const a of answers) {
    const seenHere = new Set();
    for (const b of a.businesses) {
      if (b.is_client) continue;
      const key = normalizeName(b.name);
      if (!key || seenHere.has(key)) continue;
      seenHere.add(key);
      const c = byKey.get(key) || { name: b.name, domain: b.domain || null, rating: b.rating, reviews: b.reviews, count: 0, positions: [] };
      c.count += 1;
      c.positions.push(b.position);
      if (!c.domain && b.domain) c.domain = b.domain;
      if (c.rating == null && b.rating != null) { c.rating = b.rating; c.reviews = b.reviews; }
      byKey.set(key, c);
    }
  }
  return [...byKey.values()]
    .map((c) => ({
      name: c.name, domain: c.domain, rating: c.rating, reviews: c.reviews, count: c.count,
      avg_position: Math.round((c.positions.reduce((s, p) => s + p, 0) / c.positions.length) * 10) / 10,
      label: `named in ${c.count} of ${total} answer${total === 1 ? '' : 's'}`
    }))
    .sort((x, y) => y.count - x.count || x.avg_position - y.avg_position)
    .slice(0, 3);
}

export function topSources(answers, clientDomain) {
  const byDomain = new Map();
  answers.forEach((a, idx) => {
    for (const s of a.sources) {
      if (!s.domain) continue;
      const d = byDomain.get(s.domain) || { domain: s.domain, answers: new Set(), mentions: 0 };
      d.answers.add(idx);
      d.mentions += 1;
      byDomain.set(s.domain, d);
    }
  });
  return [...byDomain.values()]
    .sort((x, y) => y.answers.size - x.answers.size || y.mentions - x.mentions)
    .slice(0, 5)
    .map((d) => ({ domain: d.domain, count: d.answers.size, is_client: !!clientDomain && hostMatches(d.domain, clientDomain) }));
}

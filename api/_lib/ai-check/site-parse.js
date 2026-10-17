// Reads the client's site (home page, then /contact or /about if the home page has no address)
// and asks Gemini for name, service, city and state.

import { safeFetch, SafeFetchError } from '../security/safe-fetch.js';
import { extractFacts, hasLocation, factsForModel } from './extract.js';
import { extractBusiness } from './gemini.js';
import { normalizeService, normalizeState, cleanCity, cleanRegion } from './normalize.js';

// Site reading stops trying more pages after this, so the check starts quickly.
const FETCH_BUDGET_MS = 20000;

async function fetchHome(domain, fetcher, started) {
  let lastError;
  for (const url of [`https://${domain}/`, `https://www.${domain}/`, `http://${domain}/`]) {
    if (lastError && Date.now() - started > FETCH_BUDGET_MS) break;
    try {
      return await fetcher(url);
    } catch (err) {
      lastError = err;
      // A blocked address or a bad port won't get better on another scheme.
      if (err instanceof SafeFetchError && ['blocked_address', 'bad_port', 'bad_url'].includes(err.code)) break;
    }
  }
  throw lastError;
}

/**
 * @returns {Promise<{ ok: boolean, reason?: string, data?: object, emails: string[], pages: string[], cost_usd: number, ms: number }>}
 *   reason: unreadable | empty | llm_failed
 */
export async function parseSite(domain, { fetcher = safeFetch, extractor = extractBusiness } = {}) {
  const started = Date.now();
  const pages = [];
  let home;
  try {
    home = await fetchHome(domain, fetcher, started);
  } catch (err) {
    return { ok: false, reason: 'unreadable', error: `${err.code || 'error'}: ${err.message}`, emails: [], pages: [], cost_usd: 0, ms: Date.now() - started };
  }
  pages.push(extractFacts(home.html, home.url));

  if (!hasLocation(pages[0])) {
    const origin = new URL(home.url).origin;
    const candidates = [pages[0].contact_link, `${origin}/contact`, `${origin}/contact-us`, pages[0].about_link, `${origin}/about`]
      .filter(Boolean).filter((u, i, all) => all.indexOf(u) === i);
    for (const url of candidates) {
      if (Date.now() - started > FETCH_BUDGET_MS) break;
      try {
        const page = await fetcher(url);
        const facts = extractFacts(page.html, page.url);
        if (facts.text.length < 40) continue;
        pages.push(facts);
        if (hasLocation(facts) || pages.length >= 3) break;
      } catch { /* missing contact pages are normal */ }
    }
  }

  const emails = [...new Set(pages.flatMap((p) => p.emails))].slice(0, 10);
  const textLength = pages.reduce((n, p) => n + p.text.length, 0);
  if (textLength < 80 && !pages.some((p) => p.jsonld.length)) {
    return { ok: false, reason: 'empty', emails, pages: pages.map((p) => p.url), cost_usd: 0, ms: Date.now() - started };
  }

  let llm;
  try {
    llm = await extractor(factsForModel(domain, pages));
  } catch (err) {
    return { ok: false, reason: 'llm_failed', error: err.message, emails, pages: pages.map((p) => p.url), cost_usd: err.cost_usd || 0, ms: Date.now() - started };
  }
  const d = llm.data || {};
  const country = typeof d.country === 'string' ? d.country.trim().toUpperCase() : null;
  return {
    ok: true,
    data: {
      name: typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 120) : null,
      service: normalizeService(d.service || '') || null,
      city: cleanCity(d.city || '') || null,
      state: country === 'US' || !country ? normalizeState(d.state || '') : cleanRegion(d.state || ''),
      country,
      language: typeof d.language === 'string' && /^[a-z]{2}$/i.test(d.language.trim()) ? d.language.trim().toLowerCase() : null,
      questions: Array.isArray(d.questions) ? d.questions.filter((q) => typeof q === 'string').slice(0, 3) : null,
      is_local_business: d.is_local_business !== false,
      confidence: typeof d.confidence === 'number' ? Math.max(0, Math.min(1, d.confidence)) : null
    },
    raw: d,
    model: llm.model,
    emails,
    pages: pages.map((p) => p.url),
    cost_usd: llm.cost_usd || 0,
    ms: Date.now() - started
  };
}

/** Which fields the visitor has to fill in by hand. */
export function missingFields(parse) {
  if (!parse.ok) return ['name', 'service', 'city_state'];
  const need = [];
  const isUS = !parse.data.country || parse.data.country === 'US';
  if (!parse.data.service) need.push('service');
  // Outside the US a city is enough; a US business needs its state too.
  if (!parse.data.city || (isUS && !parse.data.state)) need.push('city_state');
  return need;
}

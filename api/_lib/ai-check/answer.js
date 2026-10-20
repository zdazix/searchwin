// Turns one DataForSEO ChatGPT LLM Scraper result into what the page and the summary need.

import { hostOf, normalizeName } from './normalize.js';
import { findClient, mentionedInText, stripMarkdown } from './match.js';

/** tasks[0].result[0] from a raw response, or the result object itself. */
export function resultOf(raw) {
  if (raw && Array.isArray(raw.tasks)) return raw.tasks[0]?.result?.[0] || null;
  return raw || null;
}

function cleanEntityName(e) {
  // The visible text is the name; "title" is sometimes a description
  // ("Atlanta personal injury law firm" for "KIM LAW").
  const md = typeof e.markdown === 'string' ? stripMarkdown(e.markdown).replace(/[*_#`]/g, '').trim() : '';
  return md && md.length <= 120 ? md : (e.title || '').trim();
}

function entityUrls(e) {
  const list = Array.isArray(e.urls) ? e.urls : [];
  return list.map((u) => (typeof u === 'string' ? u : u?.url)).filter(Boolean);
}

function isDirectory(biz, settings) {
  const names = new Set((settings.directory_names || []).map((n) => normalizeName(n)));
  const domains = settings.directory_domains || [];
  if (names.has(normalizeName(biz.name))) return true;
  const hosts = [biz.domain, ...(biz.urls || [])].map(hostOf).filter(Boolean);
  return hosts.length > 0 && hosts.every((h) => domains.some((d) => h === d || h.endsWith('.' + d)));
}

export function answerMarkdown(result) {
  if (typeof result?.markdown === 'string' && result.markdown.trim()) return result.markdown;
  return (result?.items || [])
    .filter((i) => i.type === 'chat_gpt_text' || i.type === 'chat_gpt_table')
    .map((i) => i.markdown || '')
    .join('');
}

/** Businesses in the order ChatGPT named them: the local businesses block, else brand entities. */
export function answerBusinesses(result, settings) {
  const items = result?.items || [];
  const local = items
    .filter((i) => i.type === 'chat_gpt_local_businesses')
    .flatMap((i) => i.items || [])
    .map((b) => ({
      name: (b.title || '').trim(),
      domain: hostOf(b.domain || b.url || ''),
      url: b.url || null,
      urls: b.url ? [b.url] : [],
      rating: typeof b.rating?.value === 'number' ? b.rating.value : null,
      reviews: Number.isFinite(b.reviews_count) ? b.reviews_count : (Number.isFinite(b.rating?.votes_count) ? b.rating.votes_count : null),
      from: 'local'
    }))
    .filter((b) => b.name);
  const seen = new Set();
  const dedupe = (list) => list.filter((b) => {
    const k = normalizeName(b.name);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (local.length) return dedupe(local).map((b, i) => ({ ...b, position: i + 1 }));

  const raw = Array.isArray(result?.brand_entities) && result.brand_entities.length
    ? result.brand_entities
    : items.flatMap((i) => i.brand_entities || []);
  const text = normalizeName(stripMarkdown(answerMarkdown(result)));
  const entities = raw
    .map((e) => {
      const urls = entityUrls(e);
      return { name: cleanEntityName(e), domain: hostOf(urls[0] || ''), url: urls[0] || null, urls, rating: null, reviews: null, from: 'entity' };
    })
    .filter((b) => b.name && !isDirectory(b, settings))
    .map((b, order) => {
      const at = text.indexOf(normalizeName(b.name));
      return { ...b, at: at === -1 ? Infinity : at, order };
    })
    .sort((a, b) => a.at - b.at || a.order - b.order)
    .map(({ at, order, ...b }) => b);
  return dedupe(entities).map((b, i) => ({ ...b, position: i + 1 }));
}

/** Sources ChatGPT cited, unique by URL, in order of first appearance. */
/** Every URL the answer cites or links: the source list plus the links written in the text, in order, without repeats. */
export function answerUrls(result, markdown) {
  const out = [];
  const add = (u) => { if (typeof u === 'string' && /^https?:\/\//i.test(u) && !out.includes(u)) out.push(u); };
  for (const s of answerSources(result)) add(s.url);
  for (const m of String(markdown || '').matchAll(/\]\((https?:\/\/[^\s)]+)\)|(?<![(\w])(https?:\/\/[^\s)<>\]]+)/g)) add(m[1] || m[2]);
  return out;
}

export function answerSources(result) {
  const list = Array.isArray(result?.sources) && result.sources.length
    ? result.sources
    : (result?.items || []).flatMap((i) => i.sources || []);
  const seen = new Set();
  const out = [];
  for (const s of list) {
    const url = s?.url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ domain: hostOf(s.domain || url), url, title: s.title || s.source_name || '' });
  }
  return out;
}

/**
 * Everything stored for one answered query.
 * @param raw  DataForSEO response (or its result object)
 * @param client  output of makeClient()
 */
export function parseAnswer(raw, client, settings) {
  const result = resultOf(raw);
  const markdown = answerMarkdown(result);
  const businesses = answerBusinesses(result, settings).map((b) => ({ ...b, is_client: false, match_rule: null }));
  const hit = findClient(client, businesses);
  let found = false, position = null, rule = null;
  if (hit) {
    businesses[hit.index].is_client = true;
    businesses[hit.index].match_rule = hit.rule;
    found = true; position = businesses[hit.index].position; rule = hit.rule;
  } else if (mentionedInText(client, markdown)) {
    found = true; rule = 'text';
  }
  return {
    markdown,
    businesses,
    client: { found, position, match_rule: rule },
    sources: answerSources(result),
    fan_out_queries: Array.isArray(result?.fan_out_queries) ? result.fan_out_queries : [],
    model: result?.model || null,
    datetime: result?.datetime || null,
    check_url: result?.check_url || null
  };
}

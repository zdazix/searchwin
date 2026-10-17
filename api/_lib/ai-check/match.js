// Is the client's business one of the businesses ChatGPT named?
// Spec rules, in order: domain → exact name → fuzzy (token set ≥ 0.9 + rarest word) → name in text.
// A doubtful match is skipped: a false "you're recommended" kills the audit request.

import { normalizeName, nameTokens, stem, hostMatches, hostOf } from './normalize.js';

/** Builds what the matcher needs to know about the client once. */
export function makeClient({ name, domain, city, state, service }, settings) {
  // Generic words come from the list plus the words of the service itself, in the site's own language ("Klempner", "plombier").
  const generic = new Set([...(settings.generic_name_words || []).map((w) => stem(w.toLowerCase())), ...nameTokens(service || '')]);
  const placeWords = new Set([
    ...nameTokens(city || ''),
    ...nameTokens(state || '')
  ]);
  const tokens = nameTokens(name || '');
  const distinctive = tokens.filter((t) => !generic.has(t) && !placeWords.has(t) && t.length >= 2 && !/^\d+$/.test(t));
  // "Rarest" word: no corpus here, so the longest distinctive word stands in for the rarest one.
  const rarest = distinctive.slice().sort((a, b) => b.length - a.length)[0] || null;
  return {
    name: name || '',
    normName: normalizeName(name || ''),
    domain: hostOf(domain || ''),
    tokens,
    distinctive,
    rarest
  };
}

/** Similarity of two strings via InDel distance, 0..1 (same idea as rapidfuzz's ratio). */
export function ratio(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const lcs = lcsLength(a, b);
  return (2 * lcs) / (a.length + b.length);
}

function lcsLength(a, b) {
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : Math.max(prev[j], prev[j - 1]);
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Token set ratio: compares the shared words with each side's remainder. */
export function tokenSetRatio(tokensA, tokensB) {
  const A = new Set(tokensA), B = new Set(tokensB);
  const inter = [...A].filter((t) => B.has(t)).sort();
  const restA = [...A].filter((t) => !B.has(t)).sort();
  const restB = [...B].filter((t) => !A.has(t)).sort();
  const t0 = inter.join(' ');
  const t1 = [t0, restA.join(' ')].filter(Boolean).join(' ');
  const t2 = [t0, restB.join(' ')].filter(Boolean).join(' ');
  if (!t0) return ratio(t1, t2);
  return Math.max(ratio(t0, t1), ratio(t0, t2), ratio(t1, t2));
}

function domainRule(client, biz) {
  if (!client.domain) return false;
  const hosts = [biz.domain, ...(biz.urls || [])].map(hostOf).filter(Boolean);
  return hosts.some((h) => hostMatches(h, client.domain));
}

function exactRule(client, biz) {
  return !!client.normName && normalizeName(biz.name || '') === client.normName;
}

function fuzzyRule(client, biz) {
  if (!client.rarest || !client.tokens.length) return false;
  const other = nameTokens(biz.name || '');
  if (!other.includes(client.rarest)) return false;
  return tokenSetRatio(client.tokens, other) >= 0.9;
}

/**
 * First business that matches, trying each rule across the whole list before the next one.
 * @returns {{ index: number, rule: 'domain'|'exact'|'fuzzy' } | null}
 */
export function findClient(client, businesses) {
  const rules = [['domain', domainRule], ['exact', exactRule], ['fuzzy', fuzzyRule]];
  for (const [rule, test] of rules) {
    const index = businesses.findIndex((b) => test(client, b));
    if (index !== -1) return { index, rule };
  }
  return null;
}

/** Rule 4: the whole normalised name appears in the answer text. Needs a distinctive word. */
export function mentionedInText(client, markdown) {
  if (!client.normName || !client.distinctive.length || client.normName.length < 4) return false;
  const text = ' ' + normalizeName(stripMarkdown(markdown || '')) + ' ';
  return text.includes(' ' + client.normName + ' ');
}

/** Drops link targets and image syntax so URLs don't produce accidental matches. */
export function stripMarkdown(md) {
  return String(md)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\\([\\`*_{}[\]()#+\-.!$])/g, '$1');
}

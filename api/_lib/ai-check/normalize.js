// Input normalisation: website addresses, services, US states, business names.

export const US_STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
};

const STATE_BY_NAME = Object.fromEntries(Object.entries(US_STATES).map(([code, name]) => [name.toLowerCase(), code]));
STATE_BY_NAME['washington dc'] = 'DC';
STATE_BY_NAME['washington d.c.'] = 'DC';

/** "tx", "Texas", " TX " → "TX"; anything else → null. */
export function normalizeState(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim().replace(/\.$/, '');
  if (!s) return null;
  const up = s.toUpperCase().replace(/\./g, '');
  if (up.length === 2 && US_STATES[up]) return up;
  return STATE_BY_NAME[s.toLowerCase()] || null;
}

/** "Austin, TX" / "Austin TX" / "Austin, Texas" → { city: "Austin", state: "TX" }. */
export function parseCityState(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim().replace(/\s+/g, ' ');
  if (!s) return null;
  let m = s.match(/^(.+?),\s*([A-Za-z .]+)$/);
  if (m) {
    const state = normalizeState(m[2]);
    const city = cleanCity(m[1]);
    return state && city ? { city, state } : null;
  }
  // "Austin TX" or "Salt Lake City Utah": try the longest state suffix first.
  const words = s.split(' ');
  for (let k = Math.min(3, words.length - 1); k >= 1; k--) {
    const state = normalizeState(words.slice(-k).join(' '));
    if (state) {
      const city = cleanCity(words.slice(0, -k).join(' '));
      return city ? { city, state } : null;
    }
  }
  return null;
}

export function cleanCity(input) {
  if (typeof input !== 'string') return '';
  const s = input.replace(/[^\p{L}\p{N} .'\-]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 60) return '';
  // Title case only when the input is all lower or all upper case.
  if (s === s.toLowerCase() || s === s.toUpperCase()) {
    return s.toLowerCase().replace(/(^|[\s\-'.])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
  }
  return s;
}

/** Customer phrasing for a service: lower case, no leading "best"/"top". */
export function normalizeService(input) {
  if (typeof input !== 'string') return '';
  let s = input.toLowerCase().replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/[.,;:!?]+$/g, '');
  for (let i = 0; i < 3; i++) s = s.replace(/^(the\s+|best\s+|top[\s-]+rated\s+|top\s+)/, '');
  s = s.trim();
  if (s.length > 60) s = s.slice(0, 60).replace(/\s+\S*$/, '');
  return s;
}

/**
 * Website as typed → bare domain. Accepts "site.com", "www.site.com", "https://site.com/page".
 * Rejects IPs, localhost, single-label hosts, emails and anything with spaces.
 */
export function normalizeWebsite(input) {
  if (typeof input !== 'string') return { ok: false };
  let s = input.trim();
  if (!s || s.length > 2048 || /\s/.test(s) || /^[^/]*@/.test(s)) return { ok: false };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  let url;
  try { url = new URL(s); } catch { return { ok: false }; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false };
  if (url.username || url.password) return { ok: false };
  let host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host.startsWith('[') || /^\d+(\.\d+){3}$/.test(host)) return { ok: false };
  host = host.replace(/^www\./, '');
  const labels = host.split('.');
  if (labels.length < 2 || labels.some((l) => !l || l.length > 63 || !/^[a-z0-9-]+$/.test(l) || l.startsWith('-') || l.endsWith('-'))) {
    return { ok: false };
  }
  const tld = labels[labels.length - 1];
  if (!/^(?:[a-z]{2,24}|xn--[a-z0-9-]{2,59})$/.test(tld)) return { ok: false };
  if (['localhost', 'local', 'internal', 'test', 'invalid', 'example'].includes(tld)) return { ok: false };
  return { ok: true, domain: host, url: `https://${host}/` };
}

/** Host of any URL or domain string, lower case, without "www.". */
export function hostOf(value) {
  if (typeof value !== 'string' || !value) return '';
  let s = value.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  try { return new URL(s).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, ''); } catch { return ''; }
}

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

/** Name tokens for fuzzy comparison: normalised words with a plural "s" folded. */
export function nameTokens(input) {
  return normalizeName(input).split(' ').filter(Boolean).map(stem);
}

export function stem(word) {
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function renderPrompt(template, { service, city, state }) {
  return template.replace(/\{service\}/g, service).replace(/\{city\}/g, city).replace(/\{state\}/g, state).replace(/\s+/g, ' ').trim();
}

// Facts about a business from its HTML: title, description, JSON-LD, phones, US addresses,
// public emails and a slice of visible text for the language model.

import { parse } from 'node-html-parser';
import { US_STATES, hostOf } from './normalize.js';

const BUSINESS_TYPE = /business|organization|organisation|corporation|service|contractor|plumber|electrician|roofing|hvac|dentist|dental|attorney|legal|lawyer|clinic|physician|medical|store|repair|agent|restaurant|salon|spa|locksmith|mover|cleaning|veterinar|pest|landscap|garage|auto|insurance|realestate|accounting/i;

const STATE_CODES = Object.keys(US_STATES).join('|');
const TEXT_ADDRESS = new RegExp(`([A-Z][A-Za-z.'\\- ]{1,40}?),\\s*(${STATE_CODES})\\.?\\s+(\\d{5})(?:-\\d{4})?\\b`, 'g');
const PHONE = /(?:\+?1[\s.-]?)?\(?\b([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-](\d{4})\b/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi;
const BAD_EMAIL = /\.(png|jpe?g|gif|webp|svg|css|js)$|@(example\.|sentry|wixpress|godaddy|domain\.com|email\.com|yourdomain)|^(no-?reply|noreply)@/i;

function asArray(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }

function walkJsonLd(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((n) => walkJsonLd(n, out)); return; }
  if (node['@graph']) walkJsonLd(node['@graph'], out);
  const types = asArray(node['@type']).map(String);
  if (types.some((t) => BUSINESS_TYPE.test(t)) && (node.name || node.address)) {
    const addr = asArray(node.address).find((a) => a && typeof a === 'object') || null;
    out.push({
      type: types.join(', '),
      name: typeof node.name === 'string' ? node.name.trim() : null,
      description: typeof node.description === 'string' ? node.description.slice(0, 300) : null,
      telephone: typeof node.telephone === 'string' ? node.telephone : null,
      url: typeof node.url === 'string' ? node.url : null,
      address: addr ? {
        street: addr.streetAddress || null,
        city: addr.addressLocality || null,
        state: addr.addressRegion || null,
        postal: addr.postalCode || null,
        country: typeof addr.addressCountry === 'string' ? addr.addressCountry : addr.addressCountry?.name || null
      } : (typeof node.address === 'string' ? { text: node.address } : null),
      area_served: asArray(node.areaServed).map((a) => (typeof a === 'string' ? a : a?.name)).filter(Boolean).slice(0, 10)
    });
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') walkJsonLd(v, out);
}

function visibleText(root) {
  root.querySelectorAll('script, style, noscript, svg, template, iframe').forEach((n) => n.remove());
  return root.structuredText.replace(/[ \t\f\v]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

/** Facts from one page. Never throws on bad HTML. */
export function extractFacts(html, pageUrl) {
  const root = parse(String(html || ''), { comment: false, blockTextElements: { script: true, style: true, noscript: true, pre: true } });
  const meta = (sel) => root.querySelector(sel)?.getAttribute('content')?.trim() || null;
  const title = root.querySelector('title')?.text?.trim().replace(/\s+/g, ' ').slice(0, 200) || null;

  const jsonld = [];
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try { walkJsonLd(JSON.parse(s.text.trim()), jsonld); } catch { /* malformed JSON-LD is common */ }
  }

  const phones = new Set();
  const emails = new Set();
  const host = hostOf(pageUrl || '');
  let contactLink = null, aboutLink = null;
  for (const a of root.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || '';
    if (/^tel:/i.test(href)) phones.add(href.slice(4).replace(/[^\d+]/g, ''));
    else if (/^mailto:/i.test(href)) emails.add(decodeURIComponent(href.slice(7).split('?')[0]).trim().toLowerCase());
    else if (!contactLink || !aboutLink) {
      let u;
      try { u = new URL(href, pageUrl); } catch { continue; }
      if (!/^https?:$/.test(u.protocol) || hostOf(u.hostname) !== host) continue;
      const path = u.pathname.toLowerCase();
      if (!contactLink && /contact/.test(path)) contactLink = u.origin + u.pathname;
      if (!aboutLink && /about/.test(path)) aboutLink = u.origin + u.pathname;
    }
  }

  const text = visibleText(root);
  for (const m of text.matchAll(PHONE)) phones.add(`${m[1]}${m[2]}${m[3]}`);
  for (const m of (text + ' ' + html.slice(0, 200000)).matchAll(EMAIL)) emails.add(m[0].toLowerCase());
  const addresses = [];
  for (const m of text.matchAll(TEXT_ADDRESS)) {
    const city = m[1].trim().split(/\s{2,}|\n/).pop().trim();
    addresses.push({ city, state: m[2], postal: m[3], text: m[0].trim() });
  }

  return {
    url: pageUrl || null,
    title,
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
    site_name: meta('meta[property="og:site_name"]'),
    jsonld: jsonld.slice(0, 5),
    phones: [...phones].filter((p) => p.replace(/\D/g, '').length >= 10).slice(0, 5),
    emails: [...emails].filter((e) => !BAD_EMAIL.test(e) && e.length < 100).slice(0, 10),
    addresses: dedupeBy(addresses, (a) => a.text).slice(0, 5),
    contact_link: contactLink,
    about_link: aboutLink,
    text
  };
}

function dedupeBy(list, key) {
  const seen = new Set();
  return list.filter((x) => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Whether a page told us where the business is. */
export function hasLocation(facts) {
  return facts.addresses.length > 0 || facts.jsonld.some((j) => j.address && (j.address.city || j.address.text));
}

/** What the language model sees: compact, and with the start and end of the page text (footers hold addresses). */
export function factsForModel(domain, pages) {
  const head = (s, n) => (s.length > n ? s.slice(0, n) : s);
  return {
    domain,
    pages: pages.map((p) => ({
      url: p.url,
      title: p.title,
      description: p.description,
      site_name: p.site_name,
      structured_data: p.jsonld,
      phones: p.phones,
      addresses_found: p.addresses.map((a) => a.text),
      text_start: head(p.text, 3500),
      text_end: p.text.length > 3500 ? p.text.slice(-1500) : ''
    }))
  };
}

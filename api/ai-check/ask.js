// POST /api/ai-check/ask — one ChatGPT question, called three times in parallel by the page.
// Waits for the live answer from DataForSEO (about a minute) and returns it already read:
// the businesses ChatGPT named, whether the client is among them, the sources and the answer as safe HTML.
// Time limit: 150 s (vercel.json); a retry only starts if a full answer still fits.
//
// body: { ticket, idx }   ticket from /api/ai-check/parse, idx 1..3
// → { idx, prompt, businesses, client: { found, position, rule }, sources, answer_html, answered_at }

import { json, error, readJson, background } from '../_lib/http.js';
import { DEFAULT_SETTINGS, LIMITS, MESSAGES } from '../_lib/config.js';
import { readTicket } from '../_lib/ai-check/ticket.js';
import { chatgptLive } from '../_lib/ai-check/dataforseo.js';
import { parseAnswer } from '../_lib/ai-check/answer.js';
import { makeClient } from '../_lib/ai-check/match.js';
import { renderMarkdown } from '../_lib/ai-check/markdown.js';
import { renderPrompt } from '../_lib/ai-check/normalize.js';
import { sendTelegram, escapeHtml } from '../_lib/notify/telegram.js';


// A broken key fails every check, so it is worth a Telegram message, but not three per check.
let lastKeyAlert = 0;
function alertBadKey(err) {
  if (Date.now() - lastKeyAlert < 3600e3) return;
  lastKeyAlert = Date.now();
  background(sendTelegram(`⚠️ DataForSEO не принимает ключ, проверки не работают: ${escapeHtml(err.message)}`));
}

export async function POST(request) {
  const started = Date.now();
  let body;
  try { body = await readJson(request); } catch (err) { return error(err.status || 400, 'bad_request', err.message); }
  const business = readTicket(body.ticket);
  if (!business) return error(401, 'expired', MESSAGES.expired);
  const settings = DEFAULT_SETTINGS;
  const idx = Number(body.idx);
  if (!Number.isInteger(idx) || idx < 1 || idx > settings.query_count) return error(400, 'bad_request', 'idx must be 1..' + settings.query_count);
  const prompt = renderPrompt(settings.prompt_templates[idx - 1], business);

  try {
    const r = await chatgptLive(prompt, { tag: `${business.domain}:${idx}`, deadline: started + LIMITS.functionMs - 10000 });
    if (!r.result) throw Object.assign(new Error('DataForSEO returned no result'), { code: 'api' });
    const client = makeClient({ name: business.name, domain: business.domain, city: business.city, state: business.state }, settings);
    const a = parseAnswer(r.result, client, settings);
    console.log('[ai-check/ask]', JSON.stringify({ domain: business.domain, idx, ms: Date.now() - started, attempts: r.attempts, cost: r.cost, found: a.client.found, rule: a.client.match_rule }));
    return json({
      idx,
      prompt,
      businesses: a.businesses.map((b) => ({
        name: b.name, domain: b.domain || null, rating: b.rating ?? null, reviews: b.reviews ?? null, position: b.position, is_client: !!b.is_client
      })),
      client: { found: a.client.found, position: a.client.position, rule: a.client.match_rule },
      sources: a.sources.map((s) => ({ domain: s.domain })).filter((s) => s.domain),
      answer_html: renderMarkdown(a.markdown),
      answered_at: a.datetime || new Date().toISOString()
    });
  } catch (err) {
    console.error('[ai-check/ask]', business.domain, idx, err.code || '', err.message, `${Date.now() - started} ms`);
    if (err.code === 'auth' || err.code === 'config') alertBadKey(err);
    return error(502, 'answer_failed', MESSAGES.answer_failed, { idx, prompt });
  }
}

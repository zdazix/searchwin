// POST /api/ai-check/ask — one ChatGPT question, called three times in parallel by the page.
// Waits for the live answer from DataForSEO (about a minute) and returns it already read:
// the businesses ChatGPT named, whether the client is among them, the sources and the answer as safe HTML.
// Time limit: 150 s (vercel.json); a retry only starts if a full answer still fits.
//
// body: { ticket, idx }   ticket from /api/ai-check/parse, idx 1..3
// → { idx, prompt, businesses, client: { found, position, rule }, sources, answer_html, answered_at }

import { json, error, readJson, background } from '../_lib/http.js';
import { DEFAULT_SETTINGS, LIMITS, MESSAGES } from '../_lib/config.js';
import { countryByIso } from '../../assets/js/ai-check-countries.js';
import { buildPrompts } from '../_lib/ai-check/prompts.js';
import { readTicket, signAnswer } from '../_lib/ai-check/ticket.js';
import { chatgptLive } from '../_lib/ai-check/dataforseo.js';
import { parseAnswer, answerUrls } from '../_lib/ai-check/answer.js';
import { makeClient } from '../_lib/ai-check/match.js';
import { renderMarkdown } from '../_lib/ai-check/markdown.js';
import { sendTelegram, escapeHtml } from '../_lib/notify/telegram.js';


// A failure with a clear cause is worth a Telegram message (once an hour per cause), so a broken key
// or an empty balance is noticed on the first check and not from a visitor's complaint.
const HINTS = {
  auth: 'DataForSEO не принимает логин или пароль. Нужен API-пароль со страницы API Access (не пароль от входа в кабинет), без пробелов.',
  config: 'В Vercel не заданы DATAFORSEO_LOGIN и DATAFORSEO_PASSWORD (или не сделан Redeploy).',
  timeout: 'DataForSEO не ответил за отведённое время. Если повторяется, проверьте лимит времени функций в Vercel (нужно 150 с).',
  network: 'Сервер не достучался до DataForSEO.',
  api: 'DataForSEO вернул ошибку. Частая причина: на балансе нет денег (раздел Billing).'
};
const lastAlert = new Map();
function alertFailure(err, business, idx) {
  const code = err.code || 'error';
  if (Date.now() - (lastAlert.get(code) || 0) < 3600e3) return;
  lastAlert.set(code, Date.now());
  background(sendTelegram(
    `⚠️ Запрос к ChatGPT не удался (${escapeHtml(code)})\nСайт: ${escapeHtml(business.domain)}, вопрос ${idx}\n` +
    `Ошибка: ${escapeHtml(String(err.message).slice(0, 300))}\n${HINTS[code] || ''}`
  ));
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
  const prompts = business.prompts || buildPrompts(business, { settings });
  if (idx > prompts.length) return error(400, 'bad_request', 'idx must be 1..' + prompts.length);
  const prompt = prompts[idx - 1];
  const country = countryByIso(business.country) || countryByIso('US');

  try {
    const r = await chatgptLive(prompt, {
      tag: `${business.domain}:${idx}`, locationCode: country.code, language: business.language, deadline: started + LIMITS.functionMs - 10000
    });
    if (!r.result) throw Object.assign(new Error('DataForSEO returned no result'), { code: 'api' });
    const client = makeClient({ name: business.name, domain: business.domain, city: business.city, state: business.state, service: business.service }, settings);
    const a = parseAnswer(r.result, client, settings);
    // What goes into the lead if the visitor asks for the audit: exactly what was sent and what came back.
    const saved = {
      idx, prompt, location_code: r.locationCode, language_code: r.language, checked_at: new Date().toISOString(),
      answer_text: a.markdown, sources: answerUrls(r.result, a.markdown)
    };
    saved.sig = signAnswer(saved);
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
      answered_at: a.datetime || new Date().toISOString(),
      saved: saved
    });
  } catch (err) {
    console.error('[ai-check/ask]', business.domain, idx, err.code || '', err.message, `${Date.now() - started} ms`);
    alertFailure(err, business, idx);
    return error(502, 'answer_failed', MESSAGES.answer_failed, { idx, prompt, code: err.code || 'error' });
  }
}

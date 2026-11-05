// Telegram alerts for new audit requests and failures. Optional: silent when not configured.

import { env } from '../config.js';

export function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendTelegram(html) {
  const token = env('TELEGRAM_BOT_TOKEN'), chatId = env('TELEGRAM_CHAT_ID');
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: html.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) console.error('[telegram]', res.status, await res.text().catch(() => ''));
    return res.ok;
  } catch (err) {
    console.error('[telegram]', err.message);
    return false;
  }
}

/** Sends one message and returns its id (null when Telegram is off or refused it). */
export async function sendTelegramMessage(html) {
  const token = env('TELEGRAM_BOT_TOKEN'), chatId = env('TELEGRAM_CHAT_ID');
  if (!token || !chatId) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: html.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) { console.error('[telegram]', res.status, await res.text().catch(() => '')); return null; }
    const data = await res.json().catch(() => null);
    const id = data && data.result && data.result.message_id;
    return Number.isInteger(id) ? id : null;
  } catch (err) {
    console.error('[telegram]', err.message);
    return null;
  }
}

/** Replaces the text of a message this bot sent earlier. "Not modified" counts as done. */
export async function editTelegramMessage(id, html) {
  const token = env('TELEGRAM_BOT_TOKEN'), chatId = env('TELEGRAM_CHAT_ID');
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: id, text: html.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) return true;
    const text = await res.text().catch(() => '');
    if (/not modified/i.test(text)) return true;
    console.error('[telegram edit]', res.status, text);
    return false;
  } catch (err) {
    console.error('[telegram edit]', err.message);
    return false;
  }
}

const LIMIT = 3800;

/** Splits a long text into messages Telegram accepts, breaking at line ends. */
export function splitMessage(text, limit = LIMIT) {
  const parts = [];
  let cur = '';
  for (const line of String(text).split('\n')) {
    const piece = line.length > limit ? line.slice(0, limit) : line;
    if (cur && cur.length + piece.length + 1 > limit) { parts.push(cur); cur = piece; }
    else cur = cur ? cur + '\n' + piece : piece;
  }
  if (cur) parts.push(cur);
  return parts;
}

/** Sends a text of any length as consecutive messages. */
export async function sendTelegramLong(html) {
  let ok = true;
  for (const part of splitMessage(html)) ok = (await sendTelegram(part)) && ok;
  return ok;
}

const LANG_LABEL = { en: 'английская (/ai-check/)', es: '🇪🇸 испанская (/es/ai-check/)' };
/**
 * One message per visit: edits the visitor's earlier message when there is one, otherwise sends a new one.
 * A long text goes into the message as its first part; the rest follows as new messages unless `rest` is false.
 * @returns the id of the visit's message (null when Telegram is off)
 */
export async function upsertTelegram(id, html, { rest = true } = {}) {
  const parts = splitMessage(html);
  let mid = id;
  if (mid && !(await editTelegramMessage(mid, parts[0]))) mid = null;
  if (!mid) mid = await sendTelegramMessage(parts[0]);
  if (rest) for (const part of parts.slice(1)) await sendTelegram(part);
  return mid;
}

const clip = (s, n) => { const t = String(s ?? ''); return t.length > n ? t.slice(0, n) + '…' : t; };
const row = (label, value) => (value === null || value === undefined || value === '' ? '' : `${label}: ${escapeHtml(value)}\n`);

/**
 * The Telegram text for a new request: everything we saved, in the order a person reads it.
 * @param l { kind, id, site, business, email, result, verdictLabel, due, a (attribution), userAgent, consent, answers }
 */
export function leadMessage(l) {
  const b = l.business || {}, a = l.a || {};
  const online = l.kind === 'online', check = l.kind === 'check';
  const place = [b.city, b.state, b.country && b.country !== 'US' ? b.country : null].filter(Boolean).join(', ');
  let t = online ? '🆕 <b>Заявка: онлайн-бизнес</b> (не местный, проверка не запускалась)\n\n'
    : check ? '🔎 <b>Мини-проверка пройдена</b> (email не оставлен)\n\n'
    : '🆕 <b>Полный лид</b> (проверка пройдена, аудит запрошен)\n\n';
  t += row('Сайт', l.site) + row('Email', l.email) + row('Язык страницы', LANG_LABEL[a.ui_lang]);
  if (!online) {
    t += row('Бизнес', b.name) + row('Услуга', b.service) + row('Место', place);
    if (l.result && l.result.total) {
      t += `Итог: ${l.result.mentions ?? '?'} из ${l.result.total}` + (l.verdictLabel ? ` (${escapeHtml(l.verdictLabel)})` : '') +
        (l.result.best_position ? `, лучшая позиция #${l.result.best_position}` : '') + '\n';
    }
  }
  t += '\n<b>Источник</b>\n' + row('utm_source', a.utm_source) + row('utm_medium', a.utm_medium) + row('utm_campaign', a.utm_campaign) +
    row('utm_content', a.utm_content) + row('utm_term', a.utm_term) + row('gclid', a.gclid) + row('gbraid', a.gbraid) +
    row('wbraid', a.wbraid) + row('fbclid', a.fbclid) + row('fbp', a.fbp) + row('fbc', a.fbc);
  if (!(a.utm_source || a.utm_medium || a.utm_campaign || a.gclid || a.gbraid || a.wbraid || a.fbclid)) t += 'прямой заход или метки не переданы\n';
  t += row('Страница входа', clip(a.landing_url, 300)) + row('Реферер', clip(a.referrer, 300));
  t += '\n' + row('Устройство', clip(l.userAgent, 200)) + row('Срок (UTC)', l.due) + row('ID заявки', l.id) + row('Версия согласия', l.consent);
  if (l.answersAbove) t += '\nОтветы ChatGPT уже отправлены отдельными сообщениями после проверки (и сохранены в leads.answers).\n';
  if (!online && Array.isArray(l.answers) && l.answers.length) {
    t += '\n<b>Ответы ChatGPT</b> (полные тексты и ссылки сохранены в базе, leads.answers)\n';
    for (const x of l.answers) {
      t += `\n<b>${x.idx}. ${escapeHtml(x.prompt)}</b>\n` + row('Локация / язык', `${x.location_code} / ${x.language_code}`) + row('Проверено (UTC)', x.checked_at) +
        escapeHtml(clip(String(x.answer_text).replace(/\s+/g, ' ').trim(), 700)) + `\nИсточников: ${Array.isArray(x.sources) ? x.sources.length : 0}\n`;
    }
  }
  return t.trim();
}

const START_STATUS = {
  ready: 'вопросы к ChatGPT заданы, ждём ответы',
  needs_input: 'сайт прочитан не полностью, человека просим уточнить данные',
  not_local: 'сайт не местный, человеку показан попап для онлайн-бизнеса',
  unsupported_country: 'страна не поддерживается, человеку показан попап для онлайн-бизнеса'
};

/** A check was started: the visitor entered a site and passed the bot check; results may or may not follow. */
export function startMessage({ site, status, business, a, userAgent }) {
  const b = business || {}, at = a || {};
  const place = [b.city, b.state, b.country && b.country !== 'US' ? b.country : null].filter(Boolean).join(', ');
  let t = '▶️ <b>Запущена проверка</b> (результат придёт отдельным сообщением, если человек дождётся ответов)\n\n';
  t += row('Сайт', site) + row('Язык страницы', LANG_LABEL[at.ui_lang]) + row('Статус', START_STATUS[status] || status);
  t += row('Бизнес', b.name) + row('Услуга', b.service) + row('Место', place);
  t += '\n<b>Источник</b>\n' + row('utm_source', at.utm_source) + row('utm_medium', at.utm_medium) + row('utm_campaign', at.utm_campaign) +
    row('utm_content', at.utm_content) + row('utm_term', at.utm_term) + row('gclid', at.gclid) + row('gbraid', at.gbraid) +
    row('wbraid', at.wbraid) + row('fbclid', at.fbclid);
  if (!(at.utm_source || at.utm_medium || at.utm_campaign || at.gclid || at.gbraid || at.wbraid || at.fbclid)) t += 'прямой заход или метки не переданы\n';
  t += row('Страница входа', clip(at.landing_url, 300)) + row('Реферер', clip(at.referrer, 300)) + '\n' + row('Устройство', clip(userAgent, 200));
  return t.trim();
}

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

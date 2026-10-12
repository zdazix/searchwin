// DataForSEO ChatGPT LLM Scraper, Live mode: real ChatGPT answers with web search and local businesses.
// Docs: https://docs.dataforseo.com/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced/

import { env, LIMITS } from '../config.js';

const ENDPOINT = 'https://api.dataforseo.com/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced';

export class DataForSeoError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code; // auth | timeout | network | api | config
    Object.assign(this, extra);
  }
}

async function once({ keyword, tag, auth, timeoutMs, fetchImpl }) {
  const started = Date.now();
  let res;
  try {
    res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
      body: JSON.stringify([{ keyword, location_code: 2840, language_code: 'en', force_web_search: true, tag }]),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (err) {
    const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    throw new DataForSeoError(timeout ? 'timeout' : 'network', timeout ? `No answer in ${Math.round(timeoutMs / 1000)} s` : err.message, { ms: Date.now() - started });
  }
  let body;
  try { body = await res.json(); } catch { body = null; }
  const ms = Date.now() - started;
  if (res.status === 401 || res.status === 403 || body?.status_code === 40100 || body?.status_code === 40101) {
    throw new DataForSeoError('auth', `DataForSEO rejected the credentials (${body?.status_message || res.status})`, { ms, status_code: body?.status_code });
  }
  const task = body?.tasks?.[0];
  if (!res.ok || body?.status_code !== 20000 || !task || task.status_code !== 20000) {
    const code = task?.status_code || body?.status_code || res.status;
    const message = task?.status_message || body?.status_message || `HTTP ${res.status}`;
    throw new DataForSeoError('api', `DataForSEO ${code}: ${message}`, { ms, status_code: code, cost: Number(task?.cost || body?.cost || 0) });
  }
  return { body, task, cost: Number(task.cost ?? body.cost ?? 0), ms };
}

/**
 * One live ChatGPT answer. One retry on a network error, timeout or a status other than 20000
 * (the spec's rule); bad credentials are not retried.
 * @returns {Promise<{ raw: object, result: object, cost: number, ms: number, attempts: number }>}
 */
export async function chatgptLive(keyword, { tag, fetchImpl = fetch, timeoutMs = LIMITS.dataforseoTimeoutMs } = {}) {
  const login = env('DATAFORSEO_LOGIN'), password = env('DATAFORSEO_PASSWORD');
  if (!login || !password) throw new DataForSeoError('config', 'DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD are not set');
  const auth = Buffer.from(`${login}:${password}`).toString('base64');
  let cost = 0, ms = 0;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await once({ keyword, tag, auth, timeoutMs, fetchImpl });
      return { raw: r.body, result: r.task.result?.[0] || null, cost: cost + r.cost, ms: ms + r.ms, attempts: attempt };
    } catch (err) {
      cost += Number(err.cost || 0);
      ms += Number(err.ms || 0);
      if (err.code === 'auth' || attempt === 2) { err.cost = cost; err.ms = ms; err.attempts = attempt; throw err; }
    }
  }
  throw new DataForSeoError('api', 'unreachable');
}

// Business facts → {name, service, city, state, ...} with a fast, cheap Gemini model (REST, no SDK).

import { env } from '../config.js';

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
// List price per million tokens (third-party reports, check ai.google.dev/pricing); only used for the log line.
const PRICE_IN = 0.30 / 1e6;
const PRICE_OUT = 2.50 / 1e6;

const nullableString = (description) => ({ type: 'STRING', nullable: true, description });

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: nullableString('Business name as customers know it, without legal suffixes like LLC.'),
    service: nullableString('Main service in the words a customer would type into ChatGPT, 1-4 lower-case words, e.g. "emergency plumber", "dentist", "personal injury lawyer", "roof repair". Not marketing language.'),
    city: nullableString('Main city the business serves, e.g. "Austin".'),
    state: nullableString('Region of that city: for the US the two-letter state code (e.g. "TX"); for Canada and Australia the two-letter province or state code (e.g. "ON", "NSW"); elsewhere the region name as the site writes it, or null.'),
    country: nullableString('Two-letter ISO country code of the business, e.g. "US", "CA", "GB", "DE". Null if unknown.'),
    language: nullableString('Two-letter ISO 639-1 code of the main language of the website, e.g. "en", "de", "fr", "es".'),
    questions: { type: 'ARRAY', nullable: true, items: { type: 'STRING' }, description: 'Only when the website language is not English: exactly three natural questions in that language, how a customer would ask ChatGPT, built from the service and the city as the site writes them. Null when the site is in English.' },
    is_local_business: { type: 'BOOLEAN', description: 'True if it serves customers in a specific local area (home services, clinics, law firms, contractors, salons, restaurants, auto shops, agents). False for SaaS, online-only stores, national brands, media, directories and marketplaces.' },
    confidence: { type: 'NUMBER', description: '0 to 1: how sure you are about name, service and city together.' }
  },
  required: ['name', 'service', 'city', 'state', 'country', 'language', 'questions', 'is_local_business', 'confidence']
};

const SYSTEM = `You read what a website says about a business and fill in a small form.
Use only what the pages say. Prefer structured data and addresses for the city; if the business serves an area ("serving Greater Austin"), use that main city.
For "service", write what a customer would type when asking ChatGPT who to call: short, plain and lower case ("plumber", "emergency plumber", "family dentist", "personal injury lawyer", "ac repair"), in the language of the website. Never use slogans or phrases like "plumbing solutions".
The business can be in any country. Write the city as the website writes it. In the questions name only the city, never the region, county or country (people ask \"best plumber in Marbella\", not \"in Marbella, Málaga\").
For "questions" (only if the website is not in English) adapt these three English questions into the website's language, keeping them natural:
1. "best {service} in {city}"
2. "who should I call for {service} near {city}? I need someone reliable"
3. "top rated {service} in {city} with good reviews"
Return null for anything the pages don't show.`;

function llmError(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

async function callOnce({ model, key, facts, fetchImpl, timeoutMs }) {
  let res;
  try {
    res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: `Website pages as JSON:\n${JSON.stringify(facts)}` }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0, maxOutputTokens: 2048 }
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (err) {
    throw llmError('llm_network', `Gemini request failed: ${err.message}`, { retry: true });
  }
  let body;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) {
    const detail = body?.error?.message || `HTTP ${res.status}`;
    // 429 and 5xx are worth one more try; a bad key, a wrong model name or a bad request are not.
    throw llmError(res.status === 429 || res.status >= 500 ? 'llm_busy' : 'llm_rejected', `Gemini ${res.status}: ${detail}`, { retry: res.status === 429 || res.status >= 500 });
  }
  return body;
}

/**
 * @param facts output of factsForModel()
 * @returns {Promise<{ data: object, cost_usd: number, model: string }>}
 */
export async function extractBusiness(facts, { fetchImpl = fetch, timeoutMs = 25000 } = {}) {
  const key = env('GEMINI_API_KEY');
  if (!key) throw llmError('config', 'GEMINI_API_KEY is not set');
  const model = env('GEMINI_MODEL', DEFAULT_MODEL);
  let body;
  try {
    body = await callOnce({ model, key, facts, fetchImpl, timeoutMs });
  } catch (err) {
    if (!err.retry) throw err;
    body = await callOnce({ model, key, facts, fetchImpl, timeoutMs });
  }
  const usage = body?.usageMetadata || {};
  const cost = (usage.promptTokenCount || 0) * PRICE_IN + ((usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0)) * PRICE_OUT;
  const cand = body?.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p) => p.text || '').join('');
  let data = null;
  try { data = JSON.parse(text); } catch { /* handled below */ }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw llmError('llm_no_data', `Gemini returned no usable data (${body?.promptFeedback?.blockReason || cand?.finishReason || 'empty'})`, { cost_usd: cost });
  }
  return { data, cost_usd: cost, model };
}

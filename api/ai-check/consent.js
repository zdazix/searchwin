// POST /api/ai-check/consent — the visitor answered the cookie banner. Saves the answer as proof of consent.
//
// body: { visitor_id, choice: 'all' | 'necessary', lang: 'en' | 'es', banner_version }
// Stores the time, the choice, the language, the country Vercel reports and the random visitor id; no IP, no user agent.

import { json, error, readJson } from '../_lib/http.js';
import { query } from '../_lib/db.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request) {
  try {
    const body = await readJson(request);
    if (typeof body.visitor_id !== 'string' || !UUID.test(body.visitor_id)) return error(400, 'bad_request', 'Bad visitor id.');
    if (body.choice !== 'all' && body.choice !== 'necessary') return error(400, 'bad_request', 'Bad choice.');
    const country = String(request.headers.get('x-vercel-ip-country') || '').toUpperCase();
    await query(
      'insert into consents (visitor_id, choice, lang, country, banner_version) values ($1, $2, $3, $4, $5)',
      [body.visitor_id.toLowerCase(), body.choice, body.lang === 'es' ? 'es' : 'en', /^[A-Z]{2}$/.test(country) ? country : null,
        typeof body.banner_version === 'string' ? body.banner_version.slice(0, 40) : null]
    );
    return json({ ok: true });
  } catch (err) {
    if (err.status === 400 || err.status === 413) return error(err.status, 'bad_request', err.message);
    console.error('[ai-check/consent]', err);
    return error(500, 'server_error', 'Not saved.');
  }
}

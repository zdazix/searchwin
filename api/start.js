// POST /api/start — a quote request from /start/ (the "Get a fixed quote" buttons on the solution pages).
// Turnstile → checks the plan against data/solutions.js and the email → Telegram → a row in `orders`.
// Nothing is charged: the visitor gets the exact scope and a fixed price by email to approve.
//
// body: { plan, currency, name, email, website, message?, payment?, turnstile_token, attribution }
// → { ok, id }

import { json, error, readJson, clientIp, attributionFrom } from './_lib/http.js';
import { MESSAGES } from './_lib/config.js';
import { normalizeWebsite } from './_lib/ai-check/normalize.js';
import { verifyTurnstile } from './_lib/security/turnstile.js';
import { validateEmail } from './_lib/leads/email.js';
import { one } from './_lib/db.js';
import { sendTelegram, orderMessage } from './_lib/notify/telegram.js';
import { findOffer, CURRENCIES, fromPrice } from '../data/solutions.js';

const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export async function POST(request) {
  try {
    const body = await readJson(request);
    const offer = findOffer(String(body.plan || ''));
    if (!offer) return error(400, 'plan', 'Choose a solution.');
    const solution = offer.solution;
    const cur = CURRENCIES.find((c) => c.id === body.currency) || CURRENCIES[0];
    const name = str(body.name, 120);
    if (!name || name.length < 2) return error(400, 'name', 'Tell us what to call you.');
    const site = normalizeWebsite(body.website);
    if (!site.ok) return error(400, 'invalid_url', MESSAGES.invalid_url);
    const v = await validateEmail(body.email);
    if (!v.ok) return error(400, 'email_' + v.reason, MESSAGES['email_' + v.reason]);
    const message = str(body.message, 4000);
    // Only the sprint is paid once, so only it has the upfront / 50-50 choice
    const payment = solution.id === 'sprint' && ['upfront', 'split'].includes(body.payment) ? body.payment : null;
    const captcha = await verifyTurnstile(body.turnstile_token, clientIp(request));
    if (!captcha.ok) return error(403, 'captcha', MESSAGES.captcha);

    const a = attributionFrom(body, request);
    const userAgent = (request.headers.get('user-agent') || '').slice(0, 500);

    // Telegram first: it is how the team hears about the request, and it must not depend on the database.
    const sent = await sendTelegram(orderMessage({
      plan: offer.name, planId: offer.id, price: fromPrice(offer, cur.id), currency: cur.code,
      payment, name, email: v.email, site: site.domain, message, a, userAgent
    }));

    let row = null;
    try {
      // price: the starting price the visitor saw, in the currency they picked
      row = await one(
        `insert into orders (plan_id, plan_name, business_type, line, price, currency, payment, name, email, website, message,
            user_agent, landing_url, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, fbclid)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) returning id`,
        [offer.id, solution.name, offer.audience || 'any', solution.id, offer.from[cur.id], cur.code, payment, name, v.email,
          site.domain, message, userAgent, a.landing_url, a.referrer, a.utm_source, a.utm_medium, a.utm_campaign, a.utm_content,
          a.utm_term, a.gclid, a.fbclid]
      );
    } catch (err) {
      console.error('[start] order not stored (run db/migrations/006_orders.sql):', err.message);
    }
    // Neither channel took it: tell the visitor, so the order is not silently lost.
    if (!row && !sent) return error(500, 'server_error', 'We could not send your request. Email us at hi@searchwin.ai.');
    return json({ ok: true, id: row ? row.id : null });
  } catch (err) {
    if (err.status === 400 || err.status === 413) return error(err.status, 'bad_request', err.message);
    console.error('[start]', err);
    return error(500, 'server_error', 'We could not send your request. Email us at hi@searchwin.ai.');
  }
}

// POST /api/start — an order request from /start/ (the plan buttons on the homepage).
// Turnstile → checks the plan against data/plans.js and the email → Telegram → a row in `orders`.
// Nothing is charged: the visitor gets a fixed price and a deliverables list by email to approve.
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
import { findPlan, CURRENCIES, priceWithUnit } from '../data/plans.js';

const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export async function POST(request) {
  try {
    const body = await readJson(request);
    const plan = findPlan(String(body.plan || ''));
    if (!plan) return error(400, 'plan', 'Choose a plan.');
    const cur = CURRENCIES.find((c) => c.id === body.currency) || CURRENCIES[0];
    const name = str(body.name, 120);
    if (!name || name.length < 2) return error(400, 'name', 'Tell us what to call you.');
    const site = normalizeWebsite(body.website);
    if (!site.ok) return error(400, 'invalid_url', MESSAGES.invalid_url);
    const v = await validateEmail(body.email);
    if (!v.ok) return error(400, 'email_' + v.reason, MESSAGES['email_' + v.reason]);
    const message = str(body.message, 4000);
    if (plan.tier.custom && !message) return error(400, 'message', 'Tell us what you need, so we can scope it.');
    const payment = plan.lineId === 'sprint' && !plan.tier.custom && ['upfront', 'split'].includes(body.payment) ? body.payment : null;
    const captcha = await verifyTurnstile(body.turnstile_token, clientIp(request));
    if (!captcha.ok) return error(403, 'captcha', MESSAGES.captcha);

    const a = attributionFrom(body, request);
    const userAgent = (request.headers.get('user-agent') || '').slice(0, 500);
    const priceLabel = plan.tier.custom ? 'fixed quote' : priceWithUnit(cur.symbol, plan.tier.price, plan.line.unit);

    // Telegram first: it is how the team hears about the order, and it must not depend on the database.
    const sent = await sendTelegram(orderMessage({
      plan: `${plan.tier.name} (${plan.type.label}, ${plan.line.label})`, planId: plan.id, price: priceLabel, currency: cur.code,
      payment, name, email: v.email, site: site.domain, message, a, userAgent
    }));

    let row = null;
    try {
      row = await one(
        `insert into orders (plan_id, plan_name, business_type, line, price, currency, payment, name, email, website, message,
            user_agent, landing_url, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, fbclid)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) returning id`,
        [plan.id, plan.tier.name, plan.type.id, plan.lineId, plan.tier.custom ? null : plan.tier.price, cur.code, payment, name, v.email,
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

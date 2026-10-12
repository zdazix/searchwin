// System events: written to the database (shown in the admin) and, for the important ones, sent to Telegram.

import { query, one } from '../db.js';
import { sendTelegram } from './telegram.js';

/**
 * @param level 'info' | 'warn' | 'error'
 * @param kind e.g. check_failed, query_failed, budget_exceeded, dataforseo_auth, capi_error, audit_requested
 * @param opts.notify send to Telegram; opts.throttleMinutes skips the Telegram message if one of the same kind went out recently
 */
export async function logEvent(level, kind, message, { checkId = null, data = null, notify = false, throttleMinutes = 0 } = {}) {
  let recent = null;
  if (notify && throttleMinutes > 0) {
    recent = await one(
      `select id from system_events where kind = $1 and created_at > now() - ($2 || ' minutes')::interval and (data->>'notified')::boolean is true limit 1`,
      [kind, String(throttleMinutes)]
    ).catch(() => null);
  }
  const willNotify = notify && !recent;
  await query(
    'insert into system_events (level, kind, check_id, message, data) values ($1, $2, $3, $4, $5::jsonb)',
    [level, kind, checkId, message.slice(0, 2000), JSON.stringify({ ...(data || {}), notified: willNotify })]
  ).catch((err) => console.error('[event]', kind, message, err.message));
  if (willNotify) await sendTelegram(message);
}

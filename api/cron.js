// Daily housekeeping (Vercel Cron): close checks nobody polled after a worker died,
// drop raw DataForSEO responses after 90 days, trim old rate-limit rows.

import { json, error, sameSecret } from './_lib/http.js';
import { query } from './_lib/db.js';
import { env, LIMITS } from './_lib/config.js';
import { watchdog } from './_lib/ai-check/pipeline.js';

export async function GET(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!sameSecret(token, env('CRON_SECRET'))) return error(401, 'unauthorized', 'Unauthorized');
  const stuck = await query(
    `select * from ai_checks where status in ('running', 'parsing') and updated_at < now() - interval '10 minutes' limit 200`
  );
  let healed = 0;
  for (const check of stuck) if (await watchdog(check)) healed++;
  const purged = await query(
    `update ai_check_queries set raw_response = null where raw_response is not null and created_at < now() - ($1 || ' days')::interval returning id`,
    [String(LIMITS.rawResponseDays)]
  );
  await query(`delete from ai_check_runs where created_at < now() - interval '7 days'`);
  return json({ ok: true, stuck: stuck.length, healed, raw_purged: purged.length });
}

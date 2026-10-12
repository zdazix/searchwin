// Per-IP daily limit and the daily API budget, both enforced before any paid call.

import { one, query, num } from '../db.js';
import { numberEnv } from '../config.js';

export const ipDailyLimit = () => numberEnv('AI_CHECK_IP_DAILY_LIMIT', 5);
export const dailyBudgetUsd = () => numberEnv('AI_CHECK_DAILY_BUDGET_USD', 20);

/** Checks and Edit restarts from this IP in the last 24 hours. */
export async function runsLast24h(ipHash) {
  const row = await one(`select count(*)::int as n from ai_check_runs where ip_hash = $1 and created_at > now() - interval '24 hours'`, [ipHash]);
  return row ? row.n : 0;
}

export async function recordRun(ipHash, checkId, kind) {
  await query('insert into ai_check_runs (ip_hash, check_id, kind) values ($1, $2, $3)', [ipHash, checkId, kind]);
}

/** API money spent since midnight UTC: ChatGPT queries plus site parsing. */
export async function spentTodayUsd() {
  const row = await one(`
    select
      coalesce((select sum(cost_usd) from ai_check_queries where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'), 0)
    + coalesce((select sum(parse_cost_usd) from ai_checks where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'), 0) as spent`);
  return num(row?.spent) || 0;
}

export async function overBudget() {
  return (await spentTodayUsd()) >= dailyBudgetUsd();
}

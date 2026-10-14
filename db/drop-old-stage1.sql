-- Only if you already ran the first version of the migration (001_ai_check.sql) in Neon:
-- it created eight tables that the simplified check no longer uses. They hold no real data
-- yet (the check was not live). Run this once in the Neon SQL Editor, then run
-- db/migrations/001_leads.sql.

drop table if exists audit_requests, ai_check_queries, ai_check_runs, site_cache, system_events, app_settings cascade;
drop table if exists ai_checks cascade;
drop table if exists leads cascade;

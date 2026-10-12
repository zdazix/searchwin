-- Free AI check (stage 1): checks, ChatGPT answers, leads, audit requests and the bits around them.

create table if not exists ai_checks (
  id               uuid primary key,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  finished_at      timestamptz,
  -- parsing | needs_input | not_local | not_us | running | done | partial | failed
  status           text not null,
  generation       int not null default 1,
  needs            jsonb not null default '[]',
  input_raw        text not null,
  website_domain   text not null,
  site_parse       jsonb,
  site_emails      jsonb not null default '[]',
  site_unreadable  boolean not null default false,
  business_name    text,
  service          text,
  service_edited   boolean not null default false,
  city             text,
  state            text,
  mentions_count   int,
  total_answers    int,
  best_position    int,
  verdict          text,
  competitors      jsonb,
  sources          jsonb,
  cost_usd         numeric(10,5) not null default 0,
  parse_cost_usd   numeric(10,5) not null default 0,
  parse_ms         int,
  error            text,
  cache_of         uuid references ai_checks(id),
  is_test          boolean not null default false,
  ip_hash          text,
  user_agent       text,
  landing_url      text,
  referrer         text,
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  utm_content      text,
  utm_term         text,
  gclid            text,
  gbraid           text,
  wbraid           text,
  fbclid           text,
  fbp              text,
  fbc              text,
  capi_cc_sent     boolean not null default false,
  lead_id          uuid
);
create index if not exists ai_checks_cache_idx on ai_checks (website_domain, service, created_at desc);
create index if not exists ai_checks_created_idx on ai_checks (created_at desc);

create table if not exists ai_check_queries (
  id               uuid primary key,
  check_id         uuid not null references ai_checks(id) on delete cascade,
  generation       int not null,
  idx              int not null,
  prompt           text not null,
  -- queued | running | done | failed | cancelled
  status           text not null,
  attempts         int not null default 0,
  model            text,
  answer_markdown  text,
  answer_html      text,
  businesses       jsonb,
  client_found     boolean,
  client_position  int,
  match_rule       text,
  sources          jsonb,
  fan_out_queries  jsonb,
  check_url        text,
  answered_at      text,
  raw_response     jsonb,
  cost_usd         numeric(10,5) not null default 0,
  duration_ms      int,
  error            text,
  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  finished_at      timestamptz
);
create index if not exists ai_check_queries_check_idx on ai_check_queries (check_id, generation, idx);
create index if not exists ai_check_queries_created_idx on ai_check_queries (created_at);

create table if not exists leads (
  id                    uuid primary key,
  email                 text not null unique,
  created_at            timestamptz not null default now(),
  consent_text_version  text not null,
  ip_hash               text,
  user_agent            text,
  utm_source            text,
  utm_medium            text,
  utm_campaign          text,
  utm_content           text,
  utm_term              text,
  gclid                 text,
  gbraid                text,
  wbraid                text,
  fbclid                text,
  fbp                   text,
  fbc                   text,
  landing_url           text,
  referrer              text
);

create table if not exists audit_requests (
  id               uuid primary key,
  lead_id          uuid not null references leads(id),
  check_id         uuid not null references ai_checks(id),
  website          text not null,
  extra_info       text,
  full_audit_data  jsonb,
  -- new | in_progress | sent
  status           text not null default 'new',
  created_at       timestamptz not null default now(),
  due_at           timestamptz not null,
  taken_at         timestamptz,
  sent_at          timestamptz,
  notes            text,
  unique (lead_id, check_id)
);
create index if not exists audit_requests_status_idx on audit_requests (status, due_at);

-- One row per started check or Edit restart; the per-IP daily limit counts these.
create table if not exists ai_check_runs (
  id          bigserial primary key,
  ip_hash     text not null,
  check_id    uuid,
  kind        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists ai_check_runs_ip_idx on ai_check_runs (ip_hash, created_at);

create table if not exists site_cache (
  domain      text primary key,
  parse       jsonb not null,
  emails      jsonb not null default '[]',
  fetched_at  timestamptz not null default now()
);

create table if not exists system_events (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  level       text not null,
  kind        text not null,
  check_id    uuid,
  message     text not null,
  data        jsonb
);
create index if not exists system_events_created_idx on system_events (created_at desc);
create index if not exists system_events_kind_idx on system_events (kind, created_at desc);

create table if not exists app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

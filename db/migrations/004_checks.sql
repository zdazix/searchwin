-- Every completed check, with or without an email: who checked what, the result, the answers they saw
-- and where they came from. A request for the full audit (with an email) is a row in `leads` as before.
-- check_key is a hash of the signed answers, so the same check is stored once.

create table if not exists checks (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  check_key     text not null unique,
  website       text not null,
  business_name text,
  service       text,
  city          text,
  state         text,
  country       text,
  mentions_count int,
  total_answers  int,
  best_position  int,
  verdict       text,
  answers       jsonb,
  user_agent    text,
  landing_url   text,
  referrer      text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,
  gclid         text,
  gbraid        text,
  wbraid        text,
  fbclid        text,
  fbp           text,
  fbc           text
);
create index if not exists checks_created_idx on checks (created_at desc);

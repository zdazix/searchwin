-- Free AI check, stage 1: one table. A row per audit request from /ai-check.
-- Nothing else is stored: the check itself runs in the visitor's browser session.

create table if not exists leads (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  email                 text not null,
  website               text not null,
  business_name         text,
  service               text,
  city                  text,
  state                 text,
  -- result of the check the visitor saw: "mentions_count of total_answers"
  mentions_count        int,
  total_answers         int,
  best_position         int,
  verdict               text,
  consent_text_version  text not null,
  user_agent            text,
  landing_url           text,
  referrer              text,
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
  fbc                   text
);
create index if not exists leads_created_idx on leads (created_at desc);
create index if not exists leads_email_idx on leads (lower(email));

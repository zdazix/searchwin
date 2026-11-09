-- Order requests from the plan buttons on the homepage (/start/). Safe to run more than once.
-- If this table is missing, /api/start still sends the order to Telegram; it just isn't stored.

create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  plan_id       text not null,
  plan_name     text not null,
  business_type text not null,
  line          text not null,
  price         integer,
  currency      text not null,
  payment       text,
  name          text not null,
  email         text not null,
  website       text not null,
  message       text,
  user_agent    text,
  landing_url   text,
  referrer      text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,
  gclid         text,
  fbclid        text,
  status        text not null default 'new'
);

create index if not exists orders_created_idx on orders (created_at desc);

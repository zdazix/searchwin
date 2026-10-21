-- Proof of the cookie choice: one row per answer in the cookie banner (a later change is a new row).
-- No IP address and no user agent. visitor_id is a random id the visitor's browser made when it answered;
-- lead_id is filled in when the same visitor later asks for an audit, so a person can be found by email.
-- Safe to run more than once.

create table if not exists consents (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  visitor_id     text not null,
  choice         text not null check (choice in ('all', 'necessary')),
  lang           text,
  country        text,
  banner_version text,
  lead_id        uuid
);

create index if not exists consents_visitor_idx on consents (visitor_id, created_at desc);

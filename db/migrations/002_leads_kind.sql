-- kind: which form the lead came from, 'local' (after the check) or 'online' (the "not a local business" popup).
-- country: ISO code of the business checked (the check now works in any country).
alter table leads add column if not exists kind text not null default 'local';
alter table leads add column if not exists country text;

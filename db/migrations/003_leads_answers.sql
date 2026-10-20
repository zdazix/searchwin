-- The ChatGPT answers the visitor saw, saved with the request so the full audit can reuse them.
-- A JSON array of up to 3 objects: idx, prompt (the exact keyword sent), location_code, language_code,
-- checked_at (UTC), answer_text (full answer, markdown), sources (every URL cited or linked in the answer).
alter table leads add column if not exists answers jsonb;

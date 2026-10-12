// Applies db/migrations/*.sql in order, once each. Needs DATABASE_URL (e.g. from `vercel env pull`).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
const url = process.env.DATABASE_URL;
if (!url) { console.error('Set DATABASE_URL first (vercel env pull .env.local && export $(cat .env.local | xargs))'); process.exit(1); }
const sql = neon(url);

await sql.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
const done = new Set((await sql.query('select name from schema_migrations')).map((r) => r.name));
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  if (done.has(file)) { console.log('skip ', file); continue; }
  const text = fs.readFileSync(path.join(dir, file), 'utf8');
  const statements = text.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean);
  await sql.transaction(statements.map((s) => sql.query(s)).concat(sql.query('insert into schema_migrations (name) values ($1)', [file])));
  console.log('apply', file, `(${statements.length} statements)`);
}
console.log('done');

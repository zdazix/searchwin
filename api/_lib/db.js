// One tiny query interface. Production: Neon over HTTP. Tests and local runs swap in PGlite.

import { neon } from '@neondatabase/serverless';

let adapter = null;

export function setDb(custom) { adapter = custom; }

function db() {
  if (adapter) return adapter;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = neon(url);
  adapter = { query: (text, params = []) => sql.query(text, params) };
  return adapter;
}

/** Rows of a parameterised query ($1, $2, …). */
export async function query(text, params = []) {
  return db().query(text, params);
}

export async function one(text, params = []) {
  const rows = await query(text, params);
  return rows[0] || null;
}

/** Postgres numerics arrive as strings. */
export const num = (v) => (v == null ? null : Number(v));

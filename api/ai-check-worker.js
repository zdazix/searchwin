// Internal: runs one ChatGPT query of a check in its own function call, so each query
// gets the full time limit (DataForSEO live answers take up to 120 s, plus one retry).

import { json, error, readJson, background, sameSecret, isUuid } from './_lib/http.js';
import { env } from './_lib/config.js';
import { runQuery } from './_lib/ai-check/pipeline.js';

export async function POST(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!sameSecret(token, env('INTERNAL_JOB_SECRET'))) return error(401, 'unauthorized', 'Unauthorized');
  const body = await readJson(request).catch(() => ({}));
  if (!isUuid(body.query_id)) return error(400, 'bad_request', 'query_id required');
  background(runQuery(body.query_id));
  return json({ accepted: true }, 202);
}

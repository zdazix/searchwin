// Records a real ChatGPT answer from DataForSEO as a test fixture (costs one Live call, about $0.004).
//   DATAFORSEO_LOGIN=… DATAFORSEO_PASSWORD=… node scripts/record-fixture.mjs "best plumber in Austin, TX"
// Then add expectations for it to tests/fixtures/labels.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chatgptLive } from '../api/_lib/ai-check/dataforseo.js';

const keyword = process.argv.slice(2).join(' ').trim();
if (!keyword) { console.error('Usage: node scripts/record-fixture.mjs "<question>"'); process.exit(1); }

const r = await chatgptLive(keyword, { tag: 'fixture' });
const slug = keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'dataforseo', `${slug}.json`);
const fixture = {
  _note: 'Real DataForSEO ChatGPT LLM Scraper (live/advanced) response recorded with scripts/record-fixture.mjs.',
  _captured_at: new Date().toISOString(),
  _request: { keyword, location_code: 2840, language_code: 'en', force_web_search: true },
  ...r.raw
};
fs.writeFileSync(file, JSON.stringify(fixture, null, 1));
console.log(`saved ${path.relative(process.cwd(), file)} · ${r.ms} ms · $${r.cost}`);

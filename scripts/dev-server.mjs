// Local run of the whole site + functions for QA, on an in-memory Postgres (PGlite).
//
//   npm run dev                      → http://localhost:8787
//
// Only this script fakes the outside world, and only for hosts with no keys here:
//   - api.dataforseo.com answers with the real responses recorded in tests/fixtures/dataforseo
//     (after DEV_DFS_DELAY_MS, default 4000 ms). Credentials must be dev/dev, anything else gets
//     the same 40100 error DataForSEO returns for a bad key.
//   - the site reader knows a few demo domains (the facts Claude would return), so the parse step
//     needs no network or Claude key; any other domain behaves like an unreadable site.
//   - MX lookups answer "has a mail server" except for *.invalid domains.
// The product code has no mock mode: on Vercel these calls go to the real services.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dns from 'node:dns';
import zlib from 'node:zlib';
import { PGlite } from '@electric-sql/pglite';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8787);

Object.assign(process.env, {
  AI_CHECK_SKIP_TURNSTILE: '1',
  DATAFORSEO_LOGIN: process.env.DATAFORSEO_LOGIN || 'dev',
  DATAFORSEO_PASSWORD: process.env.DATAFORSEO_PASSWORD || 'dev'
});

// ---------- Database ----------
const pg = new PGlite();
for (const f of fs.readdirSync(path.join(root, 'db', 'migrations')).sort()) {
  await pg.exec(fs.readFileSync(path.join(root, 'db', 'migrations', f), 'utf8'));
}
const { setDb } = await import(pathToFileURL(path.join(root, 'api/_lib/db.js')).href);
setDb({ query: async (text, params = []) => (await pg.query(text, params)).rows });
// Leads saved locally: GET /__dev/leads
globalThis.__devLeads = async () => (await pg.query('select * from leads order by created_at desc')).rows;

const DEMO_SITES = {
  'ironcladtexas.com': { name: 'Ironclad Plumbing', service: 'plumber', city: 'Austin', state: 'TX' },
  'giannielectrical.net': { name: 'Gianni Electrical Service', service: 'electrician', city: 'Charlotte', state: 'NC' },
  'brightline-demo.com': { name: 'Bright Line Plumbing', service: 'plumber', city: 'Austin', state: 'TX' },
  'dovelewis.org': { name: 'DoveLewis Emergency Animal Hospital', service: 'emergency veterinarian', city: 'Portland', state: 'OR' },
  'nocity-demo.com': { name: 'Roam Plumbing', service: 'plumber', city: null, state: null },
  'saas-demo.com': { name: 'Demo SaaS', service: 'project management software', city: null, state: null, is_local_business: false },
  'toronto-demo.ca': { name: 'Maple Plumbing', service: 'plumber', city: 'Toronto', state: null, country: 'CA' }
};
const { deps } = await import(pathToFileURL(path.join(root, 'api/_lib/ai-check/deps.js')).href);
deps.parseSite = async (domain) => {
  await new Promise((r) => setTimeout(r, Number(process.env.DEV_PARSE_DELAY_MS || 1500)));
  const d = DEMO_SITES[domain];
  if (!d) return { ok: false, reason: 'unreadable', error: 'dev server: not a demo domain', emails: [], pages: [] };
  return { ok: true, data: { country: 'US', is_local_business: true, confidence: 0.9, ...d }, pages: [`https://${domain}/`], model: 'dev-demo', emails: [] };
};

// ---------- DataForSEO replay ----------
const fixtureDir = path.join(root, 'tests', 'fixtures', 'dataforseo');
const fixtures = fs.readdirSync(fixtureDir).map((f) => JSON.parse(fs.readFileSync(path.join(fixtureDir, f), 'utf8')));
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('https://api.dataforseo.com/')) return realFetch(input, init);
  const auth = Buffer.from(String(init.headers?.authorization || '').replace('Basic ', ''), 'base64').toString();
  await new Promise((r) => setTimeout(r, Number(process.env.DEV_DFS_DELAY_MS || 4000) * (0.6 + Math.random() * 0.8)));
  if (auth !== 'dev:dev') return new Response(JSON.stringify({ status_code: 40100, status_message: 'You are not authorized to access this resource.' }), { status: 401 });
  const [{ keyword }] = JSON.parse(init.body);
  const city = (keyword.match(/(?:in|near)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)?)/) || [])[1] || '';
  const fx = fixtures.find((f) => f._request.keyword.includes(city)) || fixtures[0];
  const result = { ...fx.tasks[0].result[0], keyword, model: 'recorded-fixture', datetime: fx._captured_at };
  return new Response(JSON.stringify({ status_code: 20000, cost: 0.004, tasks: [{ status_code: 20000, status_message: 'Ok.', cost: 0.004, result: [result] }] }), { status: 200 });
};

// ---------- MX lookups (this sandbox has no DNS) ----------
// Domains ending in .invalid have no mail server; everything else gets one.
dns.promises.resolveMx = async (domain) => {
  if (domain.endsWith('.invalid')) throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
  return [{ exchange: `mx.${domain}`, priority: 10 }];
};

// ---------- Functions and static files ----------
const fn = async (file) => import(pathToFileURL(path.join(root, file)).href);
const routes = [
  [/^\/api\/ai-check\/(parse|ask|audit|config)\/?$/, (m) => `api/ai-check/${m[1]}.js`]
];
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml', '.ico': 'image/x-icon' };

// Text files are gzipped like Vercel does, so local Lighthouse numbers are comparable.
function serveStatic(req, res, pathname) {
  let file = path.join(root, decodeURIComponent(pathname));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
  const type = MIME[path.extname(file)] || 'application/octet-stream';
  const gzip = /gzip/.test(req.headers['accept-encoding'] || '') && /text|javascript|json|svg|xml/.test(type);
  res.writeHead(200, { 'content-type': type, ...(gzip ? { 'content-encoding': 'gzip', vary: 'accept-encoding' } : {}) });
  const stream = fs.createReadStream(file);
  (gzip ? stream.pipe(zlib.createGzip()) : stream).pipe(res);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    for (const [re, fileOf] of routes) {
      const m = url.pathname.match(re);
      if (!m) continue;
      const mod = await fn(fileOf(m));
      const handler = mod[req.method];
      if (!handler) { res.writeHead(405).end(); return; }
      const request = new Request(url, {
        method: req.method,
        headers: { ...req.headers, 'x-forwarded-for': req.headers['x-forwarded-for'] || req.socket.remoteAddress },
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : Readable.toWeb(req),
        duplex: 'half'
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (url.pathname === '/__dev/leads') { res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(await globalThis.__devLeads(), null, 2)); return; }
    // Like on Vercel, server code and private folders are never served as files.
    if (/^\/(api|db|scripts|tests|docs|node_modules)\//.test(url.pathname) || /^\/\.env/.test(url.pathname)) { res.writeHead(404).end('Not found'); return; }
    serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error(err);
    res.writeHead(500).end(String(err.stack || err));
  }
}).listen(PORT, () => console.log(`dev server on http://localhost:${PORT}`));

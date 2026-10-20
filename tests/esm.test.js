// Every function loads on a Node that cannot require() ES modules from CommonJS packages (older Node 22
// patch versions, as on Vercel). A dependency that only works with require(esm) fails here, not in production.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const route of ['parse', 'ask', 'audit', 'config']) {
  test(`api/ai-check/${route}.js loads without require(esm)`, () => {
    const r = spawnSync(process.execPath, ['--no-experimental-require-module', '-e', `import('./api/ai-check/${route}.js').then(() => process.exit(0), (e) => { console.error(e.code, e.message); process.exit(1); })`], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });
}

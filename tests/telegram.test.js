import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitMessage, leadMessage } from '../api/_lib/notify/telegram.js';

test('long texts are split at line ends into messages Telegram accepts', () => {
  const text = Array.from({ length: 400 }, (_, i) => 'line ' + i + ' ' + 'x'.repeat(30)).join('\n');
  const parts = splitMessage(text);
  assert.ok(parts.length > 3 && parts.every((p) => p.length <= 3800));
  assert.equal(parts.join('\n'), text);
});

test('the lead text escapes HTML from visitors and skips empty fields', () => {
  const t = leadMessage({ kind: 'online', id: 'i', site: 'x.com', email: 'a<b>@x.com', a: { utm_source: '<script>' }, userAgent: 'UA' });
  assert.ok(!t.includes('<script>') && t.includes('&lt;script&gt;'));
  assert.ok(!t.includes('gclid') && !t.includes('utm_medium'));
  assert.ok(leadMessage({ kind: 'online', site: 'x.com', email: 'e@x.com', a: {} }).includes('прямой заход'));
});

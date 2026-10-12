import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMarkdown } from '../api/_lib/ai-check/markdown.js';
import { answerMarkdown, resultOf } from '../api/_lib/ai-check/answer.js';

const here = path.dirname(fileURLToPath(import.meta.url));

test('scripts, handlers and images never survive', () => {
  const html = renderMarkdown('Hi <script>alert(1)</script> <img src=x onerror=alert(1)> ![a](https://x/y.png) <a href="javascript:alert(1)">x</a> <b onclick="x()">b</b>');
  assert.ok(!/script|onerror|onclick|<img|javascript:/i.test(html), html);
});

test('links get nofollow noopener and open in a new tab', () => {
  const html = renderMarkdown('[Yelp](https://www.yelp.com/biz/x)');
  assert.match(html, /<a href="https:\/\/www\.yelp\.com\/biz\/x" rel="nofollow noopener noreferrer" target="_blank">Yelp<\/a>/);
});

test('headings are demoted below the page headings', () => {
  assert.match(renderMarkdown('# Best plumbers\n\ntext'), /<h3>Best plumbers<\/h3>/);
});

test('real answers render to safe HTML', () => {
  const dir = path.join(here, 'fixtures', 'dataforseo');
  for (const f of fs.readdirSync(dir)) {
    const md = answerMarkdown(resultOf(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))));
    const html = renderMarkdown(md);
    assert.ok(html.length > 200, f);
    assert.ok(!/<img|<script|images\.openai\.com/i.test(html), f);
  }
});

// Blog content: Insights are Markdown files in content/insights/, success stories live in data/stories.js.
//
// An article file is named after its address (content/insights/my-article.md → /blog/insights/my-article/)
// and starts with a front matter block:
//
//   ---
//   title: The headline
//   description: One or two sentences for the listing, the search result and the social card.
//   date: 2026-11-14
//   updated: 2026-12-01          (optional)
//   tag: High-intent search
//   solution: pages              (optional: sprint, monthly or pages; shows that solution under the article)
//   draft: true                  (optional: the page is built but not listed, not in the sitemap, noindex)
//   takeaways:
//     - First point
//     - Second point
//   ---
//
// The body is Markdown: ## and ### headings (the title is the only H1), lists, tables, links, quotes.
// A line with only [[cta]] places the "free AI check" box at that spot.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { SITE, findSolution } from '../../data/solutions.js';
import { STORIES } from '../../data/stories.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const INSIGHTS_DIR = path.join(here, '..', '..', 'content', 'insights');

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** "A page's Heading!" → "a-pages-heading" */
export function slugify(s) {
  return String(s).toLowerCase().replace(/&[a-z#0-9]+;/g, ' ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** "14 November 2026" */
export function formatDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Splits "---\nkey: value\nlist:\n  - item\n---\nbody" into { data, body }.
 * Values are text; "true"/"false" become booleans; a key with no value starts a list of "- item" lines.
 */
export function parseFrontMatter(text, file = 'file') {
  const m = String(text).replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no front matter (the file must start with a --- block)`);
  const data = {};
  let list = null;
  for (const raw of m[1].split('\n')) {
    if (!raw.trim()) continue;
    const item = raw.match(/^\s*-\s+(.*)$/);
    if (item) {
      if (!list) throw new Error(`${file}: "- ${item[1]}" is not under a list key`);
      list.push(item[1].trim());
      continue;
    }
    const kv = raw.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!kv) throw new Error(`${file}: cannot read the front matter line "${raw}"`);
    const [, key, rest] = kv;
    const value = rest.trim().replace(/^(["'])(.*)\1$/, '$2');
    if (value === '') { list = []; data[key] = list; continue; }
    list = null;
    data[key] = value === 'true' ? true : value === 'false' ? false : value;
  }
  return { data, body: m[2].trim() };
}

/** Markdown → HTML with ids on ## and ### headings; `toc` lists the ## headings. */
export function renderMarkdown(src) {
  const toc = [];
  const used = new Set();
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        if (depth === 1) throw new Error('an article body has no # heading: the title comes from the front matter');
        if (depth > 3) return `<h${depth}>${inner}</h${depth}>\n`;
        const plain = inner.replace(/<[^>]+>/g, '');
        let id = slugify(plain) || 'section';
        while (used.has(id)) id += '-2';
        used.add(id);
        if (depth === 2) toc.push({ id, text: plain });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href) && !href.startsWith(SITE);
        return `<a href="${escAttr(href)}"${title ? ` title="${escAttr(title)}"` : ''}${external ? ' rel="noopener"' : ''}>${inner}</a>`;
      }
    }
  });
  const html = marked.parse(src)
    .replace(/<table>/g, '<div class="prose__table"><table>')
    .replace(/<\/table>/g, '</table></div>');
  return { html: html.trim(), toc };
}

const words = (html) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

function loadInsight(file) {
  const slug = file.replace(/\.md$/, '');
  const { data, body } = parseFrontMatter(fs.readFileSync(path.join(INSIGHTS_DIR, file), 'utf8'), `content/insights/${file}`);
  for (const key of ['title', 'description', 'date', 'tag']) {
    if (typeof data[key] !== 'string' || !data[key]) throw new Error(`content/insights/${file}: "${key}" is missing`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error(`content/insights/${file}: date must look like 2026-11-14`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error(`content/insights/${file}: name the file in lowercase words joined by hyphens`);
  if (data.solution && !findSolution(data.solution)) throw new Error(`content/insights/${file}: unknown solution "${data.solution}"`);
  const { html, toc } = renderMarkdown(body);
  return {
    slug,
    url: `/blog/insights/${slug}/`,
    title: data.title,
    description: data.description,
    date: data.date,
    updated: typeof data.updated === 'string' ? data.updated : null,
    tag: data.tag,
    solution: data.solution || null,
    draft: data.draft === true,
    takeaways: Array.isArray(data.takeaways) ? data.takeaways : [],
    html,
    toc,
    minutes: Math.max(1, Math.round(words(html) / 220))
  };
}

let insights = null;

/** Every article, newest first. */
export function allInsights() {
  if (!insights) {
    const files = fs.existsSync(INSIGHTS_DIR) ? fs.readdirSync(INSIGHTS_DIR).filter((f) => f.endsWith('.md')) : [];
    insights = files.map(loadInsight).sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date)));
  }
  return insights;
}
export const publishedInsights = () => allInsights().filter((p) => !p.draft);

/** Every story, newest first, with its address. Drafts are built as pages but never listed. */
export function allStories() {
  return STORIES
    .map((s) => ({ ...s, url: `/blog/success-stories/${s.slug}/` }))
    .sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date)));
}
export const publishedStories = () => allStories().filter((s) => !s.draft);

/** Markdown for the prose fields of a story (links, bold, lists, paragraphs). */
export const prose = (text) => renderMarkdown(String(text).trim()).html;

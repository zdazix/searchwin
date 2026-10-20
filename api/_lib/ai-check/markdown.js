// ChatGPT's markdown → safe HTML for the "Show full answer" block. No images, no scripts,
// links open in a new tab with rel="nofollow noopener noreferrer".
//
// The safety comes from the renderer itself, not from a second pass: raw HTML in the answer
// never reaches the output (its tags are dropped, its text kept), images are dropped, links
// keep only http(s) addresses. No HTML sanitiser library is needed, which also keeps this
// module free of packages that older Node versions on Vercel cannot load.

import { Marked } from 'marked';

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function safeHref(href) {
  try {
    const u = new URL(String(href).trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch { return null; }
}

// Headings shift down so the answer never outranks the page's own headings.
const HEADING_LEVEL = { 1: 3, 2: 3, 3: 3, 4: 4, 5: 5, 6: 5 };

const marked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html({ text }) { return escapeHtml(String(text).replace(/<[^>]*>/g, '')); },
    image() { return ''; },
    checkbox() { return ''; },
    link({ href, tokens }) {
      const inner = this.parser.parseInline(tokens);
      const safe = safeHref(href);
      return safe ? `<a href="${escapeHtml(safe)}" rel="nofollow noopener noreferrer" target="_blank">${inner}</a>` : inner;
    },
    heading({ tokens, depth }) {
      const level = HEADING_LEVEL[depth] || 3;
      return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`;
    }
  }
});

export function renderMarkdown(md) {
  if (typeof md !== 'string' || !md.trim()) return '';
  // Image syntax is dropped before parsing as well, so no <img> can come out of any path.
  const noImages = md.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  return marked.parse(noImages).trim();
}

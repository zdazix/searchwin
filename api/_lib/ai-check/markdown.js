// ChatGPT's markdown → safe HTML for the "Show full answer" block. No images, no scripts,
// links open in a new tab with rel="nofollow noopener noreferrer".

import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const marked = new Marked({ gfm: true, breaks: false });

const OPTIONS = {
  allowedTags: ['p', 'br', 'hr', 'h3', 'h4', 'h5', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'a', 'code', 'pre',
    'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'del'],
  allowedAttributes: { a: ['href', 'rel', 'target'] },
  allowedSchemes: ['http', 'https'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  // Headings shift down so the answer never outranks the page's own headings.
  transformTags: {
    h1: 'h3', h2: 'h3', h6: 'h5',
    a: (tagName, attribs) => ({
      tagName: 'a',
      attribs: { href: attribs.href, rel: 'nofollow noopener noreferrer', target: '_blank' }
    })
  },
  exclusiveFilter: (frame) => frame.tag === 'a' && !frame.attribs.href
};

export function renderMarkdown(md) {
  if (typeof md !== 'string' || !md.trim()) return '';
  // Image syntax is dropped before parsing, so no <img> ever reaches the sanitiser.
  const noImages = md.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  return sanitizeHtml(marked.parse(noImages), OPTIONS).trim();
}

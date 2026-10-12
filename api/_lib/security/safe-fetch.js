// Fetches a stranger's website without letting it point us at our own network (SSRF).
// Only http/https on ports 80/443, every hop re-checked, at most 3 redirects, 8 s in total,
// 1 MB of HTML. DNS is resolved up front, every address must be public, and the socket
// connects to the address we checked, so a DNS answer can't change between check and connect.

import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import zlib from 'node:zlib';

export class SafeFetchError extends Error {
  constructor(code, message, extra = {}) {
    super(message || code);
    this.code = code;
    Object.assign(this, extra);
  }
}

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
]) blocked.addSubnet(addr, prefix, 'ipv4');
for (const [addr, prefix] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 32], ['2001:db8::', 32],
  ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8]
]) blocked.addSubnet(addr, prefix, 'ipv6');

/** IPv4 inside an IPv4-mapped/compatible IPv6 address, if any. */
function embeddedV4(ip) {
  const lower = ip.toLowerCase();
  let m = lower.match(/^(?:0{0,4}:){0,5}(?::|ffff:)(\d+\.\d+\.\d+\.\d+)$/) || lower.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (m) return m[1];
  m = lower.match(/^(?:0{0,4}:){0,5}(?::|ffff:)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/) || lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (m) {
    const hi = parseInt(m[1], 16), lo = parseInt(m[2], 16);
    return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
  }
  return null;
}

export function isPublicAddress(ip) {
  const kind = net.isIP(ip);
  if (kind === 4) return !blocked.check(ip, 'ipv4');
  if (kind === 6) {
    const v4 = embeddedV4(ip);
    if (v4) return net.isIP(v4) === 4 && !blocked.check(v4, 'ipv4');
    return !blocked.check(ip, 'ipv6');
  }
  return false;
}

function checkUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new SafeFetchError('bad_url', 'Not a URL'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new SafeFetchError('bad_url', 'Only http and https');
  if (url.username || url.password) throw new SafeFetchError('bad_url', 'No credentials in URLs');
  if (url.port && url.port !== '80' && url.port !== '443') throw new SafeFetchError('bad_port', 'Only ports 80 and 443');
  return url;
}

async function resolvePublic(hostname, lookup) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (!isPublicAddress(host)) throw new SafeFetchError('blocked_address', `Blocked address ${host}`);
    return { address: host, family: net.isIP(host) };
  }
  if (host === 'localhost' || host.endsWith('.localhost')) throw new SafeFetchError('blocked_address', 'localhost');
  let list;
  try { list = await lookup(host); } catch (err) { throw new SafeFetchError('dns', `DNS lookup failed for ${host}`, { cause: err }); }
  if (!list.length) throw new SafeFetchError('dns', `No address for ${host}`);
  const bad = list.find((a) => !isPublicAddress(a.address));
  if (bad) throw new SafeFetchError('blocked_address', `${host} resolves to ${bad.address}`);
  return list[0];
}

const defaultLookup = (host) => dns.promises.lookup(host, { all: true, verbatim: true });

function defaultRequest(url, { address, family, headers, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url, {
      method: 'GET',
      headers,
      timeout: timeoutMs,
      // Connect to the address that passed the check, never a fresh DNS answer.
      lookup: (_host, opts, cb) => (opts && opts.all ? cb(null, [{ address, family }]) : cb(null, address, family))
    }, (res) => resolve({ status: res.statusCode, headers: res.headers, stream: res }));
    req.on('timeout', () => req.destroy(new SafeFetchError('timeout', 'Timed out')));
    req.on('error', reject);
    req.end();
  });
}

function decodeStream(stream, encoding) {
  const enc = String(encoding || '').toLowerCase().trim();
  if (enc === 'gzip' || enc === 'x-gzip') return stream.pipe(zlib.createGunzip());
  if (enc === 'deflate') return stream.pipe(zlib.createInflate());
  if (enc === 'br') return stream.pipe(zlib.createBrotliDecompress());
  return stream;
}

async function readCapped(stream, maxBytes, deadline) {
  const chunks = [];
  let size = 0, truncated = false;
  const timer = setTimeout(() => stream.destroy(new SafeFetchError('timeout', 'Timed out')), Math.max(0, deadline - Date.now()));
  try {
    for await (const chunk of stream) {
      const left = maxBytes - size;
      if (chunk.length >= left) { chunks.push(chunk.subarray(0, left)); size = maxBytes; truncated = true; break; }
      chunks.push(chunk); size += chunk.length;
    }
  } finally {
    clearTimeout(timer);
    stream.destroy?.();
  }
  return { buffer: Buffer.concat(chunks), truncated };
}

function charsetOf(contentType) {
  const m = /charset=([^;]+)/i.exec(contentType || '');
  const cs = m ? m[1].trim().replace(/["']/g, '').toLowerCase() : 'utf-8';
  try { new TextDecoder(cs); return cs; } catch { return 'utf-8'; }
}

/**
 * @returns {Promise<{ url: string, status: number, html: string, truncated: boolean, redirects: number }>}
 * @throws {SafeFetchError} code: bad_url | bad_port | blocked_address | dns | too_many_redirects | timeout | http_error | not_html | network
 */
export async function safeFetch(rawUrl, opts = {}) {
  const {
    timeoutMs = 8000, maxBytes = 1_000_000, maxRedirects = 3,
    lookup = defaultLookup, request = defaultRequest,
    userAgent = 'Mozilla/5.0 (compatible; SearchWinBot/1.0; +https://searchwin.ai/ai-check/)'
  } = opts;
  const deadline = Date.now() + timeoutMs;
  let url = checkUrl(rawUrl);
  for (let hop = 0; ; hop++) {
    const left = deadline - Date.now();
    if (left <= 0) throw new SafeFetchError('timeout', 'Timed out');
    const { address, family } = await resolvePublic(url.hostname, lookup);
    let res;
    try {
      res = await request(url, {
        address, family, timeoutMs: left,
        headers: { 'user-agent': userAgent, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'accept-encoding': 'gzip, deflate, br', 'accept-language': 'en-US,en;q=0.8' }
      });
    } catch (err) {
      if (err instanceof SafeFetchError) throw err;
      throw new SafeFetchError('network', err.message, { cause: err });
    }
    if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.location) {
      res.stream?.resume?.();
      if (hop >= maxRedirects) throw new SafeFetchError('too_many_redirects', 'Too many redirects');
      url = checkUrl(new URL(res.headers.location, url).toString());
      continue;
    }
    if (res.status >= 400) { res.stream?.resume?.(); throw new SafeFetchError('http_error', `HTTP ${res.status}`, { status: res.status }); }
    const type = String(res.headers['content-type'] || '');
    if (type && !/text\/html|application\/xhtml\+xml/i.test(type)) { res.stream?.resume?.(); throw new SafeFetchError('not_html', `Not HTML: ${type}`); }
    const { buffer, truncated } = await readCapped(decodeStream(res.stream, res.headers['content-encoding']), maxBytes, deadline);
    const html = new TextDecoder(charsetOf(type)).decode(buffer);
    return { url: url.toString(), status: res.status, html, truncated, redirects: hop };
  }
}

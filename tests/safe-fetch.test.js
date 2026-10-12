import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Readable } from 'node:stream';
import { safeFetch, isPublicAddress, SafeFetchError } from '../api/_lib/security/safe-fetch.js';

const PUBLIC = '93.184.216.34';
// Fake DNS: everything public unless listed.
const fakeLookup = (map) => async (host) => [{ address: map[host] || PUBLIC, family: 4 }];
// Fake transport: answers by URL so redirects can be tested without the network.
function fakeRequest(routes, seen = []) {
  return async (url, { address }) => {
    seen.push({ url: url.toString(), address });
    const r = routes[url.toString()] || { status: 404 };
    return { status: r.status, headers: { 'content-type': 'text/html', ...(r.headers || {}) }, stream: Readable.from([Buffer.from(r.body || '')]) };
  };
}

async function rejects(promise, code) {
  await assert.rejects(promise, (err) => err instanceof SafeFetchError && err.code === code);
}

test('private, loopback, link-local and mapped addresses are not public', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.5.4', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0',
    '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '224.0.0.1']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111', '::ffff:8.8.8.8']) assert.equal(isPublicAddress(ip), true, ip);
});

test('localhost and IP literals are refused before any connection', async () => {
  const seen = [];
  const request = fakeRequest({}, seen);
  await rejects(safeFetch('http://localhost/', { request, lookup: fakeLookup({}) }), 'blocked_address');
  await rejects(safeFetch('http://127.0.0.1/', { request }), 'blocked_address');
  await rejects(safeFetch('http://[::1]/', { request }), 'blocked_address');
  await rejects(safeFetch('http://169.254.169.254/latest/meta-data/', { request }), 'blocked_address');
  assert.equal(seen.length, 0);
});

test('a hostname that resolves to a private address is refused', async () => {
  const seen = [];
  await rejects(safeFetch('https://intranet.example.com/', { lookup: fakeLookup({ 'intranet.example.com': '10.0.0.5' }), request: fakeRequest({}, seen) }), 'blocked_address');
  assert.equal(seen.length, 0);
});

test('one private address among several public ones is enough to refuse', async () => {
  const lookup = async () => [{ address: PUBLIC, family: 4 }, { address: '192.168.0.10', family: 4 }];
  await rejects(safeFetch('https://mixed.example.com/', { lookup, request: fakeRequest({}) }), 'blocked_address');
});

test('a redirect to a private address is refused', async () => {
  const seen = [];
  const routes = { 'https://site.example.com/': { status: 302, headers: { location: 'http://127.0.0.1/admin' } } };
  await rejects(safeFetch('https://site.example.com/', { lookup: fakeLookup({}), request: fakeRequest(routes, seen) }), 'blocked_address');
  assert.deepEqual(seen.map((s) => s.url), ['https://site.example.com/']);
});

test('a redirect to a hostname that resolves privately is refused', async () => {
  const routes = { 'https://site.example.com/': { status: 301, headers: { location: 'https://internal.example.com/' } } };
  const lookup = fakeLookup({ 'internal.example.com': '172.20.0.2' });
  await rejects(safeFetch('https://site.example.com/', { lookup, request: fakeRequest(routes) }), 'blocked_address');
});

test('other ports are refused, also after a redirect', async () => {
  await rejects(safeFetch('http://site.example.com:8080/', { lookup: fakeLookup({}), request: fakeRequest({}) }), 'bad_port');
  const routes = { 'https://site.example.com/': { status: 302, headers: { location: 'https://site.example.com:6379/' } } };
  await rejects(safeFetch('https://site.example.com/', { lookup: fakeLookup({}), request: fakeRequest(routes) }), 'bad_port');
});

test('non-http schemes are refused, also after a redirect', async () => {
  await rejects(safeFetch('file:///etc/passwd', {}), 'bad_url');
  const routes = { 'https://site.example.com/': { status: 302, headers: { location: 'file:///etc/passwd' } } };
  await rejects(safeFetch('https://site.example.com/', { lookup: fakeLookup({}), request: fakeRequest(routes) }), 'bad_url');
});

test('at most 3 redirects', async () => {
  const routes = {};
  for (let i = 0; i < 5; i++) routes[`https://site.example.com/${i}`] = { status: 302, headers: { location: `/${i + 1}` } };
  routes['https://site.example.com/3'] = { status: 200, body: '<title>ok</title>' };
  const ok = await safeFetch('https://site.example.com/0', { lookup: fakeLookup({}), request: fakeRequest(routes) });
  assert.equal(ok.redirects, 3);
  routes['https://site.example.com/3'] = { status: 302, headers: { location: '/4' } };
  await rejects(safeFetch('https://site.example.com/0', { lookup: fakeLookup({}), request: fakeRequest(routes) }), 'too_many_redirects');
});

test('the socket connects to the address that passed the check', async () => {
  const seen = [];
  await safeFetch('https://site.example.com/', { lookup: fakeLookup({}), request: fakeRequest({ 'https://site.example.com/': { status: 200, body: 'hi' } }, seen) });
  assert.equal(seen[0].address, PUBLIC);
});

test('body is capped at 1 MB and non-HTML is refused', async () => {
  const big = 'a'.repeat(1_200_000);
  const res = await safeFetch('https://site.example.com/', { lookup: fakeLookup({}), request: fakeRequest({ 'https://site.example.com/': { status: 200, body: big } }) });
  assert.equal(res.html.length, 1_000_000);
  assert.equal(res.truncated, true);
  const pdf = { 'https://site.example.com/': { status: 200, headers: { 'content-type': 'application/pdf' }, body: '%PDF' } };
  await rejects(safeFetch('https://site.example.com/', { lookup: fakeLookup({}), request: fakeRequest(pdf) }), 'not_html');
});

test('a real local server is never contacted', async () => {
  let hits = 0;
  const server = http.createServer((req, res) => { hits++; res.end('secret'); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    await rejects(safeFetch(`http://127.0.0.1:${port}/`), 'bad_port');
    await rejects(safeFetch('http://127.0.0.1/'), 'blocked_address');
    await rejects(safeFetch('http://localhost/'), 'blocked_address');
    assert.equal(hits, 0);
  } finally {
    server.close();
  }
});

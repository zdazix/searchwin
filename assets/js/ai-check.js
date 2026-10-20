/* SearchWin.ai free AI check: one field → read the site → three ChatGPT questions in parallel →
   answers one by one → result → audit request. The page drives the whole check: nothing about it
   is stored on the server, only the email form creates a lead.
   Server responses are rendered with textContent, except ChatGPT's answer, which the server
   already turned into sanitised HTML. */

import { summarize } from './ai-check-core.js';
import { COUNTRIES, countryByIso } from './ai-check-countries.js';
import { LANG, t, PATHS, THANKS_PATHS, fmtDate, fmtRating, fmtCount } from './ai-check-i18n.js';

var API = '/api/ai-check/';

var $ = function (sel, root) { return (root || document).querySelector(sel); };
var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
var track = window.acTrack || { attribution: function () { return {}; }, config: Promise.resolve({}), checkCompleted: function () {}, auditRequested: function () {} };

/* The attribution sent with every request also says which language page the visitor used. */
function attribution() {
  var a = track.attribution() || {};
  a.ui_lang = LANG;
  return a;
}

/* Text for a server error: the page's own language, never the server's English message (except in English). */
function errText(data, fallbackKey) {
  var code = data && data.error;
  if (code === 'city_state') return t(!el.country.value || el.country.value === 'US' ? 'err.city_state' : 'err.city');
  if (code && t.has('err.' + code)) return t('err.' + code);
  if (LANG === 'en' && data && data.message) return data.message;
  return t(fallbackKey || 'err.generic');
}

var el = {
  hero: $('#check'), form: $('[data-ac-form]'), website: $('#ac-website'), submit: $('[data-ac-submit]'), submitLabel: $('[data-ac-submit-label]'),
  alert: $('[data-ac-alert]'), turnstile: $('[data-ac-turnstile]'),
  run: $('[data-ac-run]'), recogText: $('[data-ac-recog-text]'),
  fields: $('[data-ac-fields]'), fieldsTitle: $('[data-ac-fields-title]'), fieldsText: $('[data-ac-fields-text]'), fieldsSubmit: $('[data-ac-fields-submit]'),
  scorebar: $('.ac-scorebar'), score: $('[data-ac-score]'), badge: $('[data-ac-badge]'), progress: $('[data-ac-progress]'), state: $('[data-ac-state]'), why: $('[data-ac-why]'),
  answers: $('[data-ac-answers]'), locked: $('[data-ac-locked]'), teasers: $('[data-ac-teasers]'),
  competitors: $('[data-ac-competitors]'), sources: $('[data-ac-sources]'), legal: $('[data-ac-legal]'), again: $('[data-ac-again]'),
  audit: $('[data-ac-audit]'), auditForm: $('[data-ac-audit-form]'), auditSubmit: $('[data-ac-audit-submit]'), offer: $('[data-ac-offer]'), biz: $('[data-ac-biz]'), email: $('#ac-email'),
  sticky: $('[data-ac-sticky]'), landing: $$('[data-ac-landing]'),
  country: $('#ac-country'), cityInput: $('#ac-city'), cityLabel: $('[data-ac-city-label]'), cityError: $('[data-ac-city-error]'),
  online: $('[data-ac-online]'), onlineForm: $('[data-ac-online-form]'), onlineSite: $('#ac-o-site'), onlineEmail: $('#ac-o-email'),
  onlineSubmit: $('[data-ac-online-submit]'), onlineAlert: $('[data-ac-online-alert]'),
  onlineTurnstile: $('[data-ac-turnstile-online]')
};

/* The check lives here and nowhere else: closing the tab ends it. */
var S = { website: '', business: {}, prompts: [], answers: {}, running: false, summary: null, reported: false };

function h(tag, attrs, children) {
  var n = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'text') n.textContent = attrs[k];
    else if (k === 'html') n.innerHTML = attrs[k];
    else n.setAttribute(k, attrs[k]);
  });
  (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return n;
}
function icon(name) {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#i-' + name);
  svg.appendChild(use);
  return svg;
}

async function api(path, body) {
  try {
    var res = await fetch(API + path, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin'
    });
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    return { ok: res.ok, status: res.status, data: data };
  } catch (e) {
    return { ok: false, status: 0, data: {} };
  }
}

/* ---------- Turnstile (invisible). Every token works once: each request gets a fresh one. ---------- */
var tsScript = null;
function loadTurnstileScript() {
  if (tsScript) return tsScript;
  tsScript = track.config.then(function (cfg) {
    if (!cfg || !cfg.turnstile_site_key) return null;
    return new Promise(function (resolve) {
      window.acTurnstileReady = function () { resolve(cfg.turnstile_site_key); };
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=acTurnstileReady';
      s.async = true; s.defer = true;
      document.head.appendChild(s);
    });
  });
  return tsScript;
}
/* One widget per container: the main form and the popup each get their own, so a challenge is always visible. */
function turnstileFor(container) {
  var st = { loading: null, widget: null, pending: null };
  function load() {
    if (st.loading) return st.loading;
    st.loading = loadTurnstileScript().then(function (siteKey) {
      if (!siteKey || !window.turnstile) return null;
      st.widget = window.turnstile.render(container, {
        sitekey: siteKey, execution: 'execute', appearance: 'interaction-only', size: 'flexible',
        callback: function (token) { if (st.pending) { st.pending(token); st.pending = null; } },
        'error-callback': function () { if (st.pending) { st.pending(''); st.pending = null; } }
      });
      return st.widget;
    });
    return st.loading;
  }
  async function token() {
    var widget = await load();
    if (widget == null || !window.turnstile) return '';
    return new Promise(function (resolve) {
      st.pending = resolve;
      try { window.turnstile.reset(widget); window.turnstile.execute(widget); } catch (e) { resolve(''); }
      setTimeout(function () { if (st.pending) { st.pending(''); st.pending = null; } }, 20000);
    });
  }
  return { load: load, token: token };
}
var tsMain = turnstileFor(el.turnstile);
var tsOnline = turnstileFor(el.onlineTurnstile);
var loadTurnstile = tsMain.load;
var turnstileToken = tsMain.token;

/* ---------- Small form helpers ---------- */
function looksLikeSite(v) {
  var s = String(v || '').trim();
  if (!s || /\s/.test(s) || /@/.test(s.split('/')[0])) return false;
  return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,24}(:\d+)?(\/.*)?$/i.test(s);
}
function setFieldError(field, on, message) {
  var wrap = field.closest('.field');
  if (!wrap) return;
  wrap.classList.toggle('is-invalid', !!on);
  var err = $('.field__error', wrap);
  if (message && err) err.textContent = message;
  var input = $('input', wrap);
  if (input) input.setAttribute('aria-invalid', on ? 'true' : 'false');
}
function formAlert(msg) {
  el.alert.hidden = !msg;
  el.alert.textContent = msg || '';
}
function busy(btn, on, label) {
  btn.disabled = !!on;
  btn.classList.toggle('is-busy', !!on);
  if (label && btn === el.submit) el.submitLabel.textContent = label;
}

/* ---------- Screen 1 ---------- */
el.website.addEventListener('focus', loadTurnstile, { once: true });
el.website.addEventListener('input', function () { setFieldError(el.website, false); formAlert(''); });

el.form.addEventListener('submit', async function (e) {
  e.preventDefault();
  var site = el.website.value.trim();
  if (!looksLikeSite(site)) {
    setFieldError(el.website, true, t('err.invalid_url'));
    el.website.focus();
    return;
  }
  busy(el.submit, true, t('btn.starting'));
  formAlert('');
  var token = await turnstileToken();
  S.website = site.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0].toLowerCase();
  S.business = {};
  setRecog();
  showRun();
  resetResult();
  setScore(t('score.reading'));
  renderProgress('running');
  var r = await api('parse', { website: site, turnstile_token: token, attribution: attribution() });
  busy(el.submit, false, t('btn.submit'));
  if (!r.ok) {
    // Nothing was checked yet: back to the form with the reason.
    hideRun();
    if (r.data.error === 'invalid_url') setFieldError(el.website, true, errText(r.data));
    else formAlert(errText(r.data, 'err.start'));
    return;
  }
  handleParse(r.data);
});

/* ---------- Screens 2 → 3 ---------- */
function showRun() {
  document.documentElement.classList.add('ac-is-result');
  el.run.hidden = false;
  el.landing.forEach(function (n) { n.hidden = true; });
  el.hero.hidden = true;
  window.scrollTo(0, 0);
}
function hideRun() {
  document.documentElement.classList.remove('ac-is-result');
  el.run.hidden = true;
  el.landing.forEach(function (n) { n.hidden = false; });
  el.hero.hidden = false;
  el.website.focus();
}

function resetResult() {
  S.reported = false;
  S.answers = {};
  S.summary = null;
  el.answers.textContent = '';
  el.progress.textContent = '';
  el.fields.hidden = true;
  el.state.hidden = true;
  el.locked.hidden = true;
  el.teasers.hidden = true;
  el.legal.hidden = true;
  el.again.hidden = true;
  el.audit.hidden = true;
  el.sticky.hidden = true;
  el.badge.hidden = true;
  el.scorebar.hidden = false;
  el.why.hidden = true;
}

function bizName() { return S.business.name || S.website || t('biz.fallback'); }
function placeOf(b) {
  if (!b.city) return '';
  if (b.state) return b.city + ', ' + b.state;
  var c = b.country && b.country !== 'US' && countryByIso(b.country);
  return c ? b.city + ', ' + countryName(c) : b.city;
}
function setRecog() {
  var b = S.business, place = placeOf(b);
  el.recogText.textContent = b.service && place ? t('recog.in', { service: b.service, place: place }) : S.website || t('site.fallback');
}
function setScore(text) { el.score.textContent = text; }

function handleParse(d) {
  S.website = d.website || S.website;
  S.business = d.business || {};
  setRecog();
  if (d.status === 'ready') return startAsks(d.prompts, d.ticket);
  el.progress.hidden = true;
  if (d.status === 'needs_input') return openFields(d.needs, d.site_unreadable ? 'unreadable' : 'missing');
  if (d.status === 'not_local') {
    el.scorebar.hidden = true;
    showState('not_local', t('notlocal.title'), t('notlocal.text', { site: S.website || t('site.fallback') }), [onlineButton(), newCheckButton()]);
  } else if (d.status === 'unsupported_country') {
    el.scorebar.hidden = true;
    showState('not_local', t('country.title'), t('country.text', { site: S.website || t('site.fallback') }), [onlineButton(), newCheckButton()]);
  }
}

/* ---------- Progress ---------- */
function renderProgress(siteStatus) {
  el.progress.textContent = '';
  el.progress.appendChild(progressItem(t('progress.read'), siteStatus));
  S.prompts.forEach(function (p, i) {
    var a = S.answers[i + 1];
    el.progress.appendChild(progressItem(t('progress.ask', { prompt: p }), a ? (a.ok ? 'done' : 'failed') : 'running'));
  });
  el.progress.hidden = false;
}
function progressItem(text, status) {
  var li = h('li', { class: 'ac-progress__item is-' + status });
  li.appendChild(h('span', { class: 'ac-progress__icon', 'aria-hidden': 'true' }, [status === 'done' ? icon('check') : status === 'failed' ? icon('x') : null]));
  li.appendChild(h('span', { text: text }));
  li.appendChild(h('span', { class: 'sr-only', text: t(status === 'done' ? 'progress.done' : status === 'failed' ? 'progress.failed' : 'progress.running') }));
  return li;
}

/* ---------- The three questions, in parallel ---------- */
async function startAsks(prompts, ticket) {
  S.prompts = prompts || [];
  S.answers = {};
  S.running = true;
  el.fields.hidden = true;
  el.state.hidden = true;
  el.scorebar.hidden = false;
  el.why.hidden = false;
  setScore(t('score.asking', { biz: bizName() }));
  renderProgress('done');
  await Promise.all(S.prompts.map(function (prompt, i) {
    var idx = i + 1;
    return api('ask', { ticket: ticket, idx: idx }).then(function (r) {
      if (!r.ok && window.console) console.warn('[ai-check] answer ' + idx + ' failed:', r.status, r.data && r.data.code);
      S.answers[idx] = r.ok ? Object.assign({ ok: true }, r.data) : { ok: false, idx: idx, prompt: prompt };
      var card = r.ok ? answerCard(S.answers[idx]) : failedCard(idx, prompt);
      insertInOrder(card, idx);
      renderProgress('done');
      var n = Object.keys(S.answers).length;
      if (n < S.prompts.length) setScore(t('score.asking_n', { biz: bizName(), n: n, total: S.prompts.length }));
    });
  }));
  S.running = false;
  finish();
}

function finish() {
  var loaded = Object.keys(S.answers).map(Number).sort().map(function (k) { return S.answers[k]; }).filter(function (a) { return a.ok; });
  el.why.hidden = true;
  el.progress.hidden = true;
  if (!loaded.length) {
    el.scorebar.hidden = true;
    showState('failed', t('failed.title'), t('failed.text'), [tryAgainButton()]);
    return;
  }
  var s = summarize(loaded, S.website);
  S.summary = s;
  setScore(t('score.result', { mentions: s.mentions_count, total: s.total, biz: bizName() }));
  el.badge.hidden = false;
  el.badge.textContent = t('verdict.' + s.verdict);
  el.badge.className = 'ac-badge ' + ({ not_recommended: 'is-miss', sometimes: 'is-some', not_first: 'is-ok', top_pick: 'is-top' }[s.verdict] || '');
  if (loaded.length < S.prompts.length) showState('partial', '', t('partial.text'), []);
  renderFinal(s);
  reportCheck(s, loaded);
}

/* Every finished check is reported once, with or without an email, so it is saved and reaches Telegram. */
function reportCheck(s, loaded) {
  if (S.reported) return;
  S.reported = true;
  var saved = loaded.map(function (a) { return a.saved; }).filter(Boolean);
  if (!saved.length) return;
  try {
    fetch(API + 'report', {
      method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true, credentials: 'same-origin',
      body: JSON.stringify({
        website: S.website, business: S.business, answers: saved,
        result: { mentions_count: s.mentions_count, total: s.total, best_position: s.best_position, verdict: s.verdict },
        attribution: attribution()
      })
    }).catch(function () { /* the visitor does not need to know */ });
  } catch (e) { /* same */ }
}

function insertInOrder(card, idx) {
  var after = $$('[data-idx]', el.answers).find(function (n) { return Number(n.getAttribute('data-idx')) > idx; });
  el.answers.insertBefore(card, after || null);
  requestAnimationFrame(function () { card.classList.add('is-in'); });
}

function answerLine(a) {
  var c = a.client || {};
  if (c.found && c.position) return h('p', { class: 'ac-answer__line ac-answer__line--hit' }, [icon('check'), t('line.at', { pos: c.position })]);
  if (c.found) return h('p', { class: 'ac-answer__line ac-answer__line--hit' }, [icon('check'), t('line.text_only')]);
  return h('p', { class: 'ac-answer__line ac-answer__line--miss' }, [icon('x'), t('line.miss')]);
}

function cardHead(idx, prompt, pill) {
  return h('div', { class: 'ui ui--dark' }, [
    h('p', { class: 'ui__prompt', text: prompt }),
    h('p', { class: 'ui__meta' }, [h('span', { class: 'ui__src', text: t('card.src') }), h('span', { class: 'ui__pill', text: pill })])
  ]);
}

function answerCard(a) {
  var art = h('article', { class: 'ac-answer', 'data-idx': String(a.idx) });
  var light = h('div', { class: 'ui ui--light' });
  light.appendChild(h('p', { class: 'ui__title', text: t('card.named') }));
  var list = (a.businesses || []).slice(0, 5);
  // The client stays visible even when ChatGPT listed them below the top five.
  var you = (a.businesses || []).find(function (b) { return b.is_client; });
  if (you && list.indexOf(you) === -1) list.push(you);
  if (list.length) {
    var ol = h('ol', { class: 'ac-biz' });
    list.forEach(function (b) {
      var li = h('li', { class: 'ac-biz__item' + (b.is_client ? ' is-client' : '') });
      li.appendChild(h('span', { class: 'ac-biz__pos', text: String(b.position) }));
      li.appendChild(h('span', { class: 'ac-biz__name', text: b.name }));
      if (b.is_client) li.appendChild(h('span', { class: 'ac-biz__you', text: t('card.you') }));
      if (b.rating != null) {
        li.appendChild(h('span', { class: 'ac-biz__rate' }, [
          icon('star'), h('span', { class: 'sr-only', text: t('card.rating') }), fmtRating(b.rating),
          b.reviews != null ? ' · ' + fmtCount(b.reviews) : '', b.reviews != null ? h('span', { class: 'sr-only', text: t('card.reviews') }) : null
        ]));
      }
      ol.appendChild(li);
    });
    light.appendChild(ol);
  } else {
    light.appendChild(h('p', { class: 'ac-answer__none', text: t('card.none') }));
  }
  light.appendChild(answerLine(a));
  if (a.answer_html) light.appendChild(answerPreview(a.answer_html));
  art.appendChild(cardHead(a.idx, a.prompt, t('card.n', { n: a.idx, total: S.prompts.length })));
  art.appendChild(light);
  return art;
}

/* ChatGPT's own words: the start of the answer, fading out, with a button for the rest. */
function answerPreview(html) {
  var wrap = h('div', { class: 'ac-preview' });
  wrap.appendChild(h('p', { class: 'ac-preview__label', text: t('card.label') }));
  var body = h('div', { class: 'ac-md ac-preview__body', html: html });
  wrap.appendChild(body);
  var btn = h('button', { class: 'ac-preview__more', type: 'button', 'aria-expanded': 'false', text: t('card.more') });
  btn.addEventListener('click', function () {
    var open = wrap.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? t('card.less') : t('card.more');
  });
  wrap.appendChild(btn);
  return wrap;
}

function failedCard(idx, prompt) {
  return h('article', { class: 'ac-answer ac-answer--failed', 'data-idx': String(idx) }, [
    cardHead(idx, prompt, t('card.failed_pill')),
    h('p', { class: 'ac-answer__note', text: t('card.failed_note') })
  ]);
}

function showState(kind, title, text, actions) {
  el.state.hidden = false;
  el.state.className = 'ac-state ac-state--' + kind;
  el.state.textContent = '';
  if (title) el.state.appendChild(h('p', { class: 'ac-state__title', text: title }));
  if (text) el.state.appendChild(h('p', { class: 'ac-state__text', text: text }));
  if (actions && actions.length) el.state.appendChild(h('div', { class: 'ac-state__actions' }, actions));
}

function newCheckButton() {
  return h('a', { class: 'btn btn--dark', href: PATHS[LANG], text: t('btn.again') });
}

function knownFields() {
  var b = S.business, m = {};
  if (b.name) m.name = b.name;
  if (b.service) m.service = b.service;
  if (b.city) m.city_state = b.state ? b.city + ', ' + b.state : b.city;
  if (b.country) m.country = b.country;
  return m;
}

/* Runs the check again with what we already know: no second visit to the site. */
function tryAgainButton() {
  var b = h('button', { class: 'btn btn--primary', type: 'button', text: t('btn.retry') });
  b.addEventListener('click', async function () {
    busy(b, true);
    var r = await api('parse', { website: S.website, manual: knownFields(), turnstile_token: await turnstileToken() });
    busy(b, false);
    if (!r.ok) { showState('failed', t('err.restart'), errText(r.data, 'err.retry_later'), [newCheckButton()]); return; }
    resetResult();
    handleParse(r.data);
  });
  return b;
}

/* ---------- Fields the site didn't give us ---------- */
/* Country names in the page's language; the list is sorted the way that language sorts. */
var regionNames = null;
try { if (LANG !== 'en' && typeof Intl.DisplayNames === 'function') regionNames = new Intl.DisplayNames([LANG], { type: 'region' }); } catch (e) { regionNames = null; }
function countryName(c) {
  var n = null;
  try { n = regionNames && regionNames.of(c.iso); } catch (e) { n = null; }
  return n && n !== c.iso ? n : c.name;
}
COUNTRIES.map(function (c) { return { iso: c.iso, name: countryName(c) }; })
  .sort(function (a, b) { return a.name.localeCompare(b.name, LANG); })
  .forEach(function (c) { el.country.appendChild(h('option', { value: c.iso, text: c.name })); });

/* The place field depends on the country: a US business needs its state, everywhere else a city is enough. */
function syncPlaceField() {
  var us = !el.country.value || el.country.value === 'US';
  el.cityLabel.textContent = t(us ? 'place.us' : 'place.other');
  el.cityInput.placeholder = t(us ? 'place.us_ph' : 'place.other_ph');
  el.cityError.textContent = t(us ? 'err.city_state' : 'err.city');
}
el.country.addEventListener('change', function () { setFieldError(el.country, false); syncPlaceField(); });

function openFields(needs, mode) {
  var show = { name: false, service: false, city_state: false, country: false };
  (needs || []).forEach(function (n) { show[n] = true; });
  // The country is always shown next to the place, so a wrong guess can be fixed.
  if (show.city_state) show.country = true;
  $$('.field', el.fields).forEach(function (f) { f.hidden = !show[f.getAttribute('data-field')]; f.classList.remove('is-invalid'); });
  var b = S.business;
  if (!$('#ac-service').value) $('#ac-service').value = b.service || '';
  if (!el.cityInput.value) el.cityInput.value = b.city ? (b.state ? b.city + ', ' + b.state : b.city) : '';
  if (!$('#ac-name').value) $('#ac-name').value = b.name || '';
  if (b.country) el.country.value = b.country;
  syncPlaceField();
  var titles = {
    unreadable: [t('fields.unreadable.title'), t('fields.unreadable.text')],
    missing: [t('fields.missing.title'), t(show.city_state && show.service ? 'fields.missing.both' : show.city_state ? 'fields.missing.city' : 'fields.missing.service')]
  }[mode];
  el.scorebar.hidden = true;
  el.fieldsTitle.textContent = titles[0];
  el.fieldsText.textContent = titles[1];
  el.fields.setAttribute('data-mode', mode);
  el.fields.hidden = false;
  var first = $$('.field', el.fields).find(function (f) { return !f.hidden; });
  if (first) $('input, select', first).focus();
}

el.fields.addEventListener('submit', async function (e) {
  e.preventDefault();
  var manual = knownFields();
  var ok = true;
  $$('.field', el.fields).forEach(function (f) {
    if (f.hidden) return;
    var input = $('input, select', f), v = input.value.trim(), key = f.getAttribute('data-field');
    var us = !el.country.value || el.country.value === 'US';
    var valid = key === 'city_state' ? (us ? /^[^,]{2,},?\s*[A-Za-z .]{2,}$/.test(v) : v.length >= 2) : key === 'name' ? true : key === 'country' ? v.length === 2 : v.length >= 2;
    setFieldError(input, !valid);
    if (!valid) ok = false; else if (v) manual[key] = v;
  });
  if (!ok) return;
  busy(el.fieldsSubmit, true);
  var r = await api('parse', { website: S.website, manual: manual, turnstile_token: await turnstileToken() });
  busy(el.fieldsSubmit, false);
  if (!r.ok) {
    var field = r.data.error && $('#ac-' + (r.data.error === 'city_state' ? 'city' : r.data.error));
    if (field) setFieldError(field, true, errText(r.data));
    else showState('limit', errText(r.data, 'err.generic'), '', []);
    return;
  }
  el.fields.hidden = true;
  handleParse(r.data);
});

/* ---------- Popup for online businesses: website + email, handled by hand ---------- */
function onlineButton() {
  var b = h('button', { class: 'btn btn--primary', type: 'button', text: t('btn.online') });
  b.addEventListener('click', openOnline);
  return b;
}
function openOnline() {
  var site = S.website || el.website.value.trim();
  if (!el.onlineSite.value && site) el.onlineSite.value = site;
  el.onlineAlert.hidden = true;
  tsOnline.load();
  if (typeof el.online.showModal === 'function') el.online.showModal(); else el.online.setAttribute('open', '');
  (el.onlineSite.value ? el.onlineEmail : el.onlineSite).focus();
}
function closeOnline() {
  if (typeof el.online.close === 'function') el.online.close(); else el.online.removeAttribute('open');
}
$$('[data-ac-online-open]').forEach(function (b) { b.addEventListener('click', openOnline); });
$$('[data-ac-online-close]').forEach(function (b) { b.addEventListener('click', closeOnline); });
el.online.addEventListener('click', function (e) { if (e.target === el.online) closeOnline(); });
el.onlineSite.addEventListener('input', function () { setFieldError(el.onlineSite, false); el.onlineAlert.hidden = true; });
el.onlineEmail.addEventListener('input', function () { setFieldError(el.onlineEmail, false); el.onlineAlert.hidden = true; });

el.onlineForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  var site = el.onlineSite.value.trim(), email = el.onlineEmail.value.trim();
  var okSite = looksLikeSite(site), okEmail = /^[^\s@]+@[^\s@]+\.[a-z]{2,24}$/i.test(email);
  setFieldError(el.onlineSite, !okSite);
  setFieldError(el.onlineEmail, !okEmail);
  if (!okSite || !okEmail) { (okSite ? el.onlineEmail : el.onlineSite).focus(); return; }
  busy(el.onlineSubmit, true);
  el.onlineAlert.hidden = true;
  var r = await api('audit', { kind: 'online', website: site, email: email, turnstile_token: await tsOnline.token(), attribution: attribution() });
  if (!r.ok) {
    busy(el.onlineSubmit, false);
    if (r.data.error === 'invalid_url') setFieldError(el.onlineSite, true, errText(r.data));
    else if (/^email_/.test(r.data.error || '')) setFieldError(el.onlineEmail, true, errText(r.data));
    else { el.onlineAlert.textContent = errText(r.data, 'err.send'); el.onlineAlert.hidden = false; }
    return;
  }
  goThanks({ kind: 'online', event_id: r.data.event_id, due_at: r.data.due_at, email: email, website: site });
});

/* ---------- Result, teasers, audit ---------- */
function renderFinal(s) {
  el.locked.hidden = false;

  el.competitors.textContent = '';
  s.competitors.forEach(function (c) {
    el.competitors.appendChild(h('li', {}, [h('b', { text: c.name }), h('span', { text: t(s.total === 1 ? 'comp.one' : 'comp.many', { count: c.count, total: s.total }) })]));
  });
  if (!s.competitors.length) el.competitors.appendChild(h('li', {}, [h('span', { text: t('final.no_comp') })]));
  el.sources.textContent = '';
  s.sources.forEach(function (src) {
    el.sources.appendChild(h('li', { class: src.is_client ? 'is-client' : '' }, [icon('globe'), h('b', { text: src.domain }), src.is_client ? h('span', { class: 'ac-src__you', text: t('final.your_site') }) : null]));
  });
  if (!s.sources.length) el.sources.appendChild(h('li', {}, [h('span', { text: t('final.no_src') })]));
  el.teasers.hidden = false;

  el.legal.hidden = false;
  el.legal.textContent = t('final.legal', { date: fmtDate() });
  el.again.hidden = false;

  el.offer.textContent = t('offer.' + s.verdict);
  el.biz.textContent = bizName();
  el.audit.hidden = false;

  track.checkCompleted('cc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    { verdict: s.verdict, service: S.business.service, mentions_count: s.mentions_count });
  setupSticky();
}

function scrollToAudit() {
  el.audit.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  setTimeout(function () { if (!el.auditForm.classList.contains('is-done')) el.email.focus({ preventScroll: true }); }, 500);
}
$$('[data-ac-to-audit]').forEach(function (b) { b.addEventListener('click', scrollToAudit); });
el.sticky.addEventListener('click', function (e) { e.preventDefault(); scrollToAudit(); });

var stickyObs = null;
function setupSticky() {
  if (stickyObs || !('IntersectionObserver' in window)) return;
  var auditVisible = false, answersVisible = false;
  function update() {
    el.sticky.hidden = auditVisible || !answersVisible || el.auditForm.classList.contains('is-done') || !matchMedia('(max-width: 760px)').matches;
  }
  stickyObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.target === el.audit) auditVisible = en.isIntersecting;
      else answersVisible = en.isIntersecting || en.boundingClientRect.top < 0;
    });
    update();
  }, { threshold: 0 });
  stickyObs.observe(el.audit);
  stickyObs.observe(el.answers);
  window.addEventListener('resize', update);
}

/* After a request the visitor lands on the thank-you page (calendar there). The conversion events
   are sent from that page, so they are not cut off by the navigation. */
function goThanks(info) {
  try { sessionStorage.setItem('ac_thanks', JSON.stringify(info)); } catch (e) { /* the page still works without it */ }
  location.assign(THANKS_PATHS[LANG]);
}

el.email.addEventListener('input', function () { setFieldError(el.email, false); });
el.auditForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  var email = el.email.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,24}$/i.test(email)) {
    setFieldError(el.email, true, t('err.email_format'));
    el.email.focus();
    return;
  }
  busy(el.auditSubmit, true);
  var s = S.summary || {};
  var r = await api('audit', {
    email: email,
    turnstile_token: await turnstileToken(),
    website: S.website,
    business: S.business,
    result: { mentions_count: s.mentions_count, total: s.total, best_position: s.best_position, verdict: s.verdict },
    answers: Object.keys(S.answers).map(Number).sort().map(function (k) { return S.answers[k]; }).filter(function (a) { return a.ok && a.saved; }).map(function (a) { return a.saved; }),
    attribution: attribution()
  });
  if (!r.ok) {
    busy(el.auditSubmit, false);
    setFieldError(el.email, true, errText(r.data, 'err.send'));
    return;
  }
  goThanks({ kind: 'local', event_id: r.data.event_id, due_at: r.data.due_at, email: email, name: bizName(), website: S.website,
    verdict: s.verdict, service: S.business.service, mentions_count: s.mentions_count, total: s.total });
});

/* Closing the tab mid-check loses the answers, so the browser asks first. */
window.addEventListener('beforeunload', function (e) {
  if (S.running) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------- Examples slider: moves by itself every 3 seconds, swipe works too ---------- */
(function () {
  var track = $('[data-ac-slides]');
  if (!track) return;
  var slides = $$('[data-ac-slide]', track);
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EVERY_MS = 3000;
  var timer = null, visible = false, hovered = false, touching = false;
  function current() {
    var best = 0, bestDist = Infinity;
    slides.forEach(function (s, i) {
      var d = Math.abs(s.offsetLeft - track.scrollLeft);
      if (d < bestDist) { best = i; bestDist = d; }
    });
    return best;
  }
  function tick() { track.scrollTo({ left: slides[(current() + 1) % slides.length].offsetLeft, behavior: 'smooth' }); }
  // It plays while the slider is on screen and nobody is pointing at it or touching it.
  function sync() {
    var play = !reduce && visible && !hovered && !touching && !document.hidden;
    if (play && !timer) timer = setInterval(tick, EVERY_MS);
    if (!play && timer) { clearInterval(timer); timer = null; }
  }
  var box = track.closest('figure') || track;
  box.addEventListener('mouseenter', function () { hovered = true; sync(); });
  box.addEventListener('mouseleave', function () { hovered = false; sync(); });
  box.addEventListener('focusin', function () { hovered = true; sync(); });
  box.addEventListener('focusout', function () { hovered = false; sync(); });
  track.addEventListener('touchstart', function () { touching = true; sync(); }, { passive: true });
  track.addEventListener('touchend', function () { touching = false; sync(); }, { passive: true });
  track.addEventListener('touchcancel', function () { touching = false; sync(); }, { passive: true });
  document.addEventListener('visibilitychange', sync);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; sync(); }, { threshold: 0.4 }).observe(box);
  }
})();

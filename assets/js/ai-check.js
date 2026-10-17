/* SearchWin.ai free AI check: one field → read the site → three ChatGPT questions in parallel →
   answers one by one → result → audit request. The page drives the whole check: nothing about it
   is stored on the server, only the email form creates a lead.
   Server responses are rendered with textContent, except ChatGPT's answer, which the server
   already turned into sanitised HTML. */

import { summarize } from './ai-check-core.js';
import { COUNTRIES, countryByIso } from './ai-check-countries.js';

var API = '/api/ai-check/';

var $ = function (sel, root) { return (root || document).querySelector(sel); };
var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
var track = window.acTrack || { attribution: function () { return {}; }, config: Promise.resolve({}), checkCompleted: function () {}, auditRequested: function () {} };

var el = {
  hero: $('#check'), form: $('[data-ac-form]'), website: $('#ac-website'), submit: $('[data-ac-submit]'), submitLabel: $('[data-ac-submit-label]'),
  alert: $('[data-ac-alert]'), turnstile: $('[data-ac-turnstile]'),
  run: $('[data-ac-run]'), recogText: $('[data-ac-recog-text]'),
  fields: $('[data-ac-fields]'), fieldsTitle: $('[data-ac-fields-title]'), fieldsText: $('[data-ac-fields-text]'), fieldsSubmit: $('[data-ac-fields-submit]'),
  scorebar: $('.ac-scorebar'), score: $('[data-ac-score]'), badge: $('[data-ac-badge]'), progress: $('[data-ac-progress]'), state: $('[data-ac-state]'), why: $('[data-ac-why]'),
  answers: $('[data-ac-answers]'), locked: $('[data-ac-locked]'), teasers: $('[data-ac-teasers]'),
  competitors: $('[data-ac-competitors]'), sources: $('[data-ac-sources]'), legal: $('[data-ac-legal]'), again: $('[data-ac-again]'),
  audit: $('[data-ac-audit]'), auditForm: $('[data-ac-audit-form]'), auditSubmit: $('[data-ac-audit-submit]'), auditDone: $('[data-ac-audit-done]'),
  auditDoneText: $('[data-ac-audit-done-text]'), offer: $('[data-ac-offer]'), biz: $('[data-ac-biz]'), email: $('#ac-email'),
  sticky: $('[data-ac-sticky]'), landing: $$('[data-ac-landing]'),
  country: $('#ac-country'), cityInput: $('#ac-city'), cityLabel: $('[data-ac-city-label]'), cityError: $('[data-ac-city-error]'),
  online: $('[data-ac-online]'), onlineForm: $('[data-ac-online-form]'), onlineSite: $('#ac-o-site'), onlineEmail: $('#ac-o-email'),
  onlineSubmit: $('[data-ac-online-submit]'), onlineAlert: $('[data-ac-online-alert]'), onlineDone: $('[data-ac-online-done]'),
  onlineTurnstile: $('[data-ac-turnstile-online]')
};

/* The check lives here and nowhere else: closing the tab ends it. */
var S = { website: '', business: {}, prompts: [], answers: {}, running: false, summary: null };

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

function fmtDate(d) {
  return (d ? new Date(d) : new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
    setFieldError(el.website, true, 'Enter your website, e.g. yourbusiness.com');
    el.website.focus();
    return;
  }
  busy(el.submit, true, 'Starting…');
  formAlert('');
  var token = await turnstileToken();
  S.website = site.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0].toLowerCase();
  S.business = {};
  setRecog();
  showRun();
  resetResult();
  setScore('Reading your website…');
  renderProgress('running');
  var r = await api('parse', { website: site, turnstile_token: token });
  busy(el.submit, false, 'See who ChatGPT picks');
  if (!r.ok) {
    // Nothing was checked yet: back to the form with the reason.
    hideRun();
    if (r.data.error === 'invalid_url') setFieldError(el.website, true, r.data.message);
    else formAlert(r.data.message || 'We could not start the check. Check your connection and try again.');
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

function bizName() { return S.business.name || S.website || 'your business'; }
function placeOf(b) {
  if (!b.city) return '';
  if (b.state) return b.city + ', ' + b.state;
  var c = b.country && b.country !== 'US' && countryByIso(b.country);
  return c ? b.city + ', ' + c.name : b.city;
}
function setRecog() {
  var b = S.business, place = placeOf(b);
  el.recogText.textContent = b.service && place ? b.service + ' in ' + place : S.website || 'your website';
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
    showState('not_local', 'This check is built for local businesses',
      'It looks like ' + (S.website || 'this site') + ' sells online or across a whole country. The instant check only works for businesses that win customers in their own area. Leave your email and we will audit your online business by hand instead.',
      [onlineButton(), newCheckButton()]);
  } else if (d.status === 'unsupported_country') {
    el.scorebar.hidden = true;
    showState('not_local', "We can't check this country yet",
      "ChatGPT location data isn't available for the country of " + (S.website || 'this site') + ". Leave your email and we will audit your business by hand instead.",
      [onlineButton(), newCheckButton()]);
  }
}

/* ---------- Progress ---------- */
function renderProgress(siteStatus) {
  el.progress.textContent = '';
  el.progress.appendChild(progressItem('Reading your website', siteStatus));
  S.prompts.forEach(function (p, i) {
    var a = S.answers[i + 1];
    el.progress.appendChild(progressItem('Asking ChatGPT: ' + p, a ? (a.ok ? 'done' : 'failed') : 'running'));
  });
  el.progress.hidden = false;
}
function progressItem(text, status) {
  var li = h('li', { class: 'ac-progress__item is-' + status });
  li.appendChild(h('span', { class: 'ac-progress__icon', 'aria-hidden': 'true' }, [status === 'done' ? icon('check') : status === 'failed' ? icon('x') : null]));
  li.appendChild(h('span', { text: text }));
  li.appendChild(h('span', { class: 'sr-only', text: status === 'done' ? ' done' : status === 'failed' ? ' failed' : ' in progress' }));
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
  setScore('Asking ChatGPT about ' + bizName() + '…');
  renderProgress('done');
  await Promise.all(S.prompts.map(function (prompt, i) {
    var idx = i + 1;
    return api('ask', { ticket: ticket, idx: idx }).then(function (r) {
      S.answers[idx] = r.ok ? Object.assign({ ok: true }, r.data) : { ok: false, idx: idx, prompt: prompt };
      var card = r.ok ? answerCard(S.answers[idx]) : failedCard(idx, prompt);
      insertInOrder(card, idx);
      renderProgress('done');
      var n = Object.keys(S.answers).length;
      if (n < S.prompts.length) setScore('Asking ChatGPT about ' + bizName() + '… ' + n + ' of ' + S.prompts.length + ' answers in');
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
    showState('failed', "We couldn't get ChatGPT's answers this time.", 'It happens when ChatGPT is slow to answer. Try again in a moment.', [tryAgainButton()]);
    return;
  }
  var s = summarize(loaded, S.website);
  S.summary = s;
  setScore(s.mentions_count + ' of ' + s.total + ' answers name ' + bizName());
  el.badge.hidden = false;
  el.badge.textContent = s.verdict_label;
  el.badge.className = 'ac-badge ' + ({ not_recommended: 'is-miss', sometimes: 'is-some', not_first: 'is-ok', top_pick: 'is-top' }[s.verdict] || '');
  if (loaded.length < S.prompts.length) showState('partial', '', "One answer didn't load — it'll be in your full audit.", []);
  renderFinal(s);
}

function insertInOrder(card, idx) {
  var after = $$('[data-idx]', el.answers).find(function (n) { return Number(n.getAttribute('data-idx')) > idx; });
  el.answers.insertBefore(card, after || null);
  requestAnimationFrame(function () { card.classList.add('is-in'); });
}

function answerLine(a) {
  var c = a.client || {};
  if (c.found && c.position) return h('p', { class: 'ac-answer__line ac-answer__line--hit' }, [icon('check'), 'You appear at #' + c.position]);
  if (c.found) return h('p', { class: 'ac-answer__line ac-answer__line--hit' }, [icon('check'), "You're mentioned in the answer, but not in ChatGPT's list of businesses"]);
  return h('p', { class: 'ac-answer__line ac-answer__line--miss' }, [icon('x'), 'Not mentioned']);
}

function cardHead(idx, prompt, pill) {
  return h('div', { class: 'ui ui--dark' }, [
    h('p', { class: 'ui__prompt', text: prompt }),
    h('p', { class: 'ui__meta' }, [h('span', { class: 'ui__src', text: 'ChatGPT / Prompt' }), h('span', { class: 'ui__pill', text: pill })])
  ]);
}

function answerCard(a) {
  var art = h('article', { class: 'ac-answer', 'data-idx': String(a.idx) });
  var light = h('div', { class: 'ui ui--light' });
  light.appendChild(h('p', { class: 'ui__title', text: 'Businesses ChatGPT named' }));
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
      if (b.is_client) li.appendChild(h('span', { class: 'ac-biz__you', text: 'You' }));
      if (b.rating != null) {
        li.appendChild(h('span', { class: 'ac-biz__rate' }, [
          icon('star'), h('span', { class: 'sr-only', text: 'Rating ' }), Number(b.rating).toFixed(1),
          b.reviews != null ? ' · ' + Number(b.reviews).toLocaleString('en-US') : '', b.reviews != null ? h('span', { class: 'sr-only', text: ' reviews' }) : null
        ]));
      }
      ol.appendChild(li);
    });
    light.appendChild(ol);
  } else {
    light.appendChild(h('p', { class: 'ac-answer__none', text: "ChatGPT didn't list specific businesses in this answer." }));
  }
  light.appendChild(answerLine(a));
  if (a.answer_html) {
    var det = h('details', { class: 'ac-full' }, [h('summary', { text: "Show ChatGPT's full answer" })]);
    det.appendChild(h('div', { class: 'ac-md', html: a.answer_html }));
    light.appendChild(det);
  }
  art.appendChild(cardHead(a.idx, a.prompt, 'Answer ' + a.idx + ' of ' + S.prompts.length));
  art.appendChild(light);
  return art;
}

function failedCard(idx, prompt) {
  return h('article', { class: 'ac-answer ac-answer--failed', 'data-idx': String(idx) }, [
    cardHead(idx, prompt, "Didn't load"),
    h('p', { class: 'ac-answer__note', text: "This answer didn't load — it'll be in your full audit." })
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
  return h('a', { class: 'btn btn--dark', href: '/ai-check/', text: 'Check another website' });
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
  var b = h('button', { class: 'btn btn--primary', type: 'button', text: 'Try again' });
  b.addEventListener('click', async function () {
    busy(b, true);
    var r = await api('parse', { website: S.website, manual: knownFields(), turnstile_token: await turnstileToken() });
    busy(b, false);
    if (!r.ok) { showState('failed', "We couldn't restart the check.", r.data.message || 'Try again in a minute.', [newCheckButton()]); return; }
    resetResult();
    handleParse(r.data);
  });
  return b;
}

/* ---------- Fields the site didn't give us ---------- */
COUNTRIES.forEach(function (c) { el.country.appendChild(h('option', { value: c.iso, text: c.name })); });

/* The place field depends on the country: a US business needs its state, everywhere else a city is enough. */
function syncPlaceField() {
  var us = !el.country.value || el.country.value === 'US';
  el.cityLabel.textContent = us ? 'City, State' : 'City, region (optional)';
  el.cityInput.placeholder = us ? 'e.g. Austin, TX' : 'e.g. Manchester';
  el.cityError.textContent = us ? 'Enter a US city and state, e.g. Austin, TX' : 'Enter a city, e.g. Manchester';
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
    unreadable: ["We couldn't read this site", 'Add a few details and we will ask ChatGPT about your business.'],
    missing: ['Almost there', show.city_state && show.service ? "We couldn't find what you do or where on your site." : show.city_state ? 'Your site works across an area. Which city should we ask about?' : "We couldn't tell what you do from your site."]
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
    if (field) setFieldError(field, true, r.data.message);
    else showState('limit', r.data.message || 'Something went wrong. Try again.', '', []);
    return;
  }
  el.fields.hidden = true;
  handleParse(r.data);
});

/* ---------- Popup for online businesses: website + email, handled by hand ---------- */
function onlineButton() {
  var b = h('button', { class: 'btn btn--primary', type: 'button', text: 'Get a free audit for your online business' });
  b.addEventListener('click', openOnline);
  return b;
}
function openOnline() {
  var site = S.website || el.website.value.trim();
  if (!el.onlineSite.value && site) el.onlineSite.value = site;
  el.onlineAlert.hidden = true;
  el.onlineDone.hidden = true;
  $$('.field, [data-ac-online-submit], .ac-consent, .ac-dialog__text, .ac-dialog__title', el.onlineForm).forEach(function (n) { n.hidden = false; });
  $('#ac-online-title').hidden = false;
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
  var r = await api('audit', { kind: 'online', website: site, email: email, turnstile_token: await tsOnline.token(), attribution: track.attribution() });
  busy(el.onlineSubmit, false);
  if (!r.ok) {
    if (r.data.error === 'invalid_url') setFieldError(el.onlineSite, true, r.data.message);
    else if (/^email_/.test(r.data.error || '')) setFieldError(el.onlineEmail, true, r.data.message);
    else { el.onlineAlert.textContent = r.data.message || 'We could not send your request. Try again.'; el.onlineAlert.hidden = false; }
    return;
  }
  track.auditRequested(r.data.event_id, { kind: 'online' }, email);
  el.onlineSite.value = ''; el.onlineEmail.value = '';
  $$('.field, [data-ac-online-submit], .ac-consent, .ac-dialog__text', el.onlineForm).forEach(function (n) { n.hidden = true; });
  $('#ac-online-title').hidden = true;
  el.onlineDone.hidden = false;
  el.onlineDone.focus();
});

/* ---------- Result, teasers, audit ---------- */
function renderFinal(s) {
  el.locked.hidden = false;

  el.competitors.textContent = '';
  s.competitors.forEach(function (c) {
    el.competitors.appendChild(h('li', {}, [h('b', { text: c.name }), h('span', { text: c.label })]));
  });
  if (!s.competitors.length) el.competitors.appendChild(h('li', {}, [h('span', { text: 'ChatGPT named no other businesses.' })]));
  el.sources.textContent = '';
  s.sources.forEach(function (src) {
    el.sources.appendChild(h('li', { class: src.is_client ? 'is-client' : '' }, [icon('globe'), h('b', { text: src.domain }), src.is_client ? h('span', { class: 'ac-src__you', text: 'your site' }) : null]));
  });
  if (!s.sources.length) el.sources.appendChild(h('li', {}, [h('span', { text: 'No sources were cited.' })]));
  el.teasers.hidden = false;

  el.legal.hidden = false;
  el.legal.textContent = 'AI answers change from one question to the next. This check shows what ChatGPT answered on ' + fmtDate() + '.';
  el.again.hidden = false;

  el.offer.textContent = s.offer_title;
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

function auditDone(dueIso) {
  var due = dueIso ? new Date(dueIso) : new Date(Date.now() + 48 * 3600e3);
  el.auditDoneText.textContent = "We'll email your full audit + roadmap by " + due.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) + '. Check your inbox (and spam folder).';
  el.auditForm.classList.add('is-done');
  $$('.field, [data-ac-audit-submit], .ac-consent, .ac-audit__price', el.auditForm).forEach(function (n) { n.hidden = true; });
  el.auditDone.hidden = false;
  el.sticky.hidden = true;
}

el.email.addEventListener('input', function () { setFieldError(el.email, false); });
el.auditForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  var email = el.email.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,24}$/i.test(email)) {
    setFieldError(el.email, true, 'Enter a valid email, e.g. name@yourbusiness.com');
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
    attribution: track.attribution()
  });
  busy(el.auditSubmit, false);
  if (!r.ok) {
    setFieldError(el.email, true, r.data.message || 'We could not send your request. Try again.');
    return;
  }
  track.auditRequested(r.data.event_id, { verdict: s.verdict, service: S.business.service }, email);
  auditDone(r.data.due_at);
  el.auditDone.focus();
});

/* Closing the tab mid-check loses the answers, so the browser asks first. */
window.addEventListener('beforeunload', function (e) {
  if (S.running) { e.preventDefault(); e.returnValue = ''; }
});

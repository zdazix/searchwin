/* SearchWin.ai free AI check: one field → live progress → answers one by one → result → audit request.
   No framework, no build. Server responses are rendered with textContent, except ChatGPT's answer,
   which the server already turned into sanitised HTML. */
(function () {
  'use strict';

  var API = '/api/ai-check';
  var POLL_MS = 2000;
  var LS_LAST = 'ac_last_check';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var track = window.acTrack || { attribution: function () { return {}; }, config: Promise.resolve({}), checkStarted: function () {}, checkCompleted: function () {}, auditRequested: function () {} };

  var el = {
    hero: $('#check'), form: $('[data-ac-form]'), website: $('#ac-website'), submit: $('[data-ac-submit]'), submitLabel: $('[data-ac-submit-label]'),
    alert: $('[data-ac-alert]'), turnstile: $('[data-ac-turnstile]'),
    run: $('[data-ac-run]'), recog: $('[data-ac-recog]'), recogText: $('[data-ac-recog-text]'), editOpen: $('[data-ac-edit-open]'),
    fields: $('[data-ac-fields]'), fieldsTitle: $('[data-ac-fields-title]'), fieldsText: $('[data-ac-fields-text]'),
    fieldsSubmit: $('[data-ac-fields-submit]'), fieldsCancel: $('[data-ac-fields-cancel]'),
    score: $('[data-ac-score]'), badge: $('[data-ac-badge]'), progress: $('[data-ac-progress]'), state: $('[data-ac-state]'), why: $('[data-ac-why]'),
    answers: $('[data-ac-answers]'), locked: $('[data-ac-locked]'), teasers: $('[data-ac-teasers]'),
    competitors: $('[data-ac-competitors]'), sources: $('[data-ac-sources]'), legal: $('[data-ac-legal]'), again: $('[data-ac-again]'),
    audit: $('[data-ac-audit]'), auditForm: $('[data-ac-audit-form]'), auditSubmit: $('[data-ac-audit-submit]'), auditDone: $('[data-ac-audit-done]'),
    auditDoneText: $('[data-ac-audit-done-text]'), offer: $('[data-ac-offer]'), biz: $('[data-ac-biz]'), email: $('#ac-email'),
    sticky: $('[data-ac-sticky]'), landing: $$('[data-ac-landing]'), robots: $('[data-ac-robots]')
  };

  var S = { id: null, data: null, timer: null, failures: 0, rendered: {}, editing: false, completedFired: false };

  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val);
    } catch (e) { /* private mode */ }
    return null;
  }

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

  function fmtDate(iso, opts) {
    var d = iso ? new Date(iso) : new Date();
    return d.toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function api(method, path, body) {
    var res = await fetch(API + path, {
      method: method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin'
    });
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    return { ok: res.ok, status: res.status, data: data };
  }

  /* ---------- Turnstile (invisible) ---------- */
  var ts = { loading: null, widget: null, pending: null };
  function loadTurnstile() {
    if (ts.loading) return ts.loading;
    ts.loading = track.config.then(function (cfg) {
      if (!cfg || !cfg.turnstile_site_key) return null;
      return new Promise(function (resolve) {
        window.acTurnstileReady = function () {
          ts.widget = window.turnstile.render(el.turnstile, {
            sitekey: cfg.turnstile_site_key, execution: 'execute', appearance: 'interaction-only', size: 'flexible',
            callback: function (token) { if (ts.pending) { ts.pending.resolve(token); ts.pending = null; } },
            'error-callback': function () { if (ts.pending) { ts.pending.resolve(''); ts.pending = null; } }
          });
          resolve(ts.widget);
        };
        var s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=acTurnstileReady';
        s.async = true; s.defer = true;
        document.head.appendChild(s);
      });
    });
    return ts.loading;
  }
  async function turnstileToken() {
    var widget = await loadTurnstile();
    if (widget == null || !window.turnstile) return '';
    return new Promise(function (resolve) {
      ts.pending = { resolve: resolve };
      try { window.turnstile.reset(widget); window.turnstile.execute(widget); } catch (e) { resolve(''); }
      setTimeout(function () { if (ts.pending) { ts.pending.resolve(''); ts.pending = null; } }, 20000);
    });
  }

  /* ---------- Screen 1 ---------- */
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
    var r = await api('POST', '', { website: site, turnstile_token: token, attribution: track.attribution() }).catch(function () { return { ok: false, status: 0, data: {} }; });
    busy(el.submit, false, 'Check my business');
    if (!r.ok) {
      if (r.data.error === 'invalid_url') setFieldError(el.website, true, r.data.message);
      else formAlert(r.data.message || 'We could not start the check. Check your connection and try again.');
      return;
    }
    track.checkStarted(r.data.event_id, { website: site });
    openCheck(r.data.check_id, true);
  });

  /* ---------- Screen 2 → 3 ---------- */
  function showRun() {
    document.documentElement.classList.add('ac-is-result');
    el.run.hidden = false;
    el.landing.forEach(function (n) { n.hidden = true; });
    el.hero.hidden = true;
    if (el.robots) el.robots.setAttribute('content', 'noindex, nofollow');
  }

  function resetResult() {
    S.rendered = {};
    S.completedFired = false;
    el.answers.textContent = '';
    el.progress.textContent = '';
    el.state.hidden = true;
    el.locked.hidden = true;
    el.teasers.hidden = true;
    el.legal.hidden = true;
    el.audit.hidden = true;
    el.sticky.hidden = true;
    el.badge.hidden = true;
  }

  function openCheck(id, isNew) {
    S.id = id;
    store(LS_LAST, id);
    if (location.pathname !== '/ai-check/r/' + id) {
      try { history.replaceState(null, '', '/ai-check/r/' + id + location.search); } catch (e) { /* file:// */ }
    }
    showRun();
    resetResult();
    if (isNew) render({ status: 'parsing', queries: [], business: {}, needs: [] });
    window.scrollTo(0, 0);
    poll();
  }

  function schedule(ms) {
    clearTimeout(S.timer);
    S.timer = setTimeout(poll, ms);
  }

  async function poll() {
    if (!S.id) return;
    var r = await api('GET', '/' + S.id).catch(function () { return { ok: false, status: 0, data: {} }; });
    if (!r.ok) {
      if (r.status === 404) {
        store(LS_LAST, null);
        showState('missing', "We couldn't find this check.", 'It may have expired. Run a new one, it takes about a minute.', [newCheckButton()]);
        return;
      }
      S.failures++;
      schedule(Math.min(15000, 2000 * S.failures));
      return;
    }
    S.failures = 0;
    S.data = r.data;
    render(r.data);
    if (!r.data.final && r.data.status !== 'needs_input') schedule(POLL_MS);
  }

  function bizName(d) { return (d.business && d.business.name) || d.website || 'your business'; }

  function recogText(d) {
    var b = d.business || {};
    if (b.service && b.city && b.state) return b.service + ' in ' + b.city + ', ' + b.state;
    return d.website || 'your website';
  }

  var VERDICT_CLASS = { not_recommended: 'is-miss', sometimes: 'is-some', not_first: 'is-ok', top_pick: 'is-top' };

  function render(d) {
    var status = d.status;
    var running = status === 'parsing' || status === 'running';
    var final = !!d.final;

    // Recognised data with Edit
    el.recogText.textContent = recogText(d);
    el.editOpen.hidden = ['running', 'done', 'partial', 'failed'].indexOf(status) === -1;

    // Score line
    if (status === 'parsing') el.score.textContent = 'Reading your website…';
    else if (status === 'needs_input') el.score.textContent = d.site_unreadable ? "We couldn't read this site" : 'Almost there';
    else if (running) el.score.textContent = 'Asking ChatGPT about ' + bizName(d) + '…';
    else if (d.summary) el.score.textContent = d.summary.mentions_count + ' of ' + d.summary.total + ' answers name ' + bizName(d);
    else if (status === 'failed') el.score.textContent = "ChatGPT's answers didn't load";
    else if (status === 'not_local') el.score.textContent = 'This check is built for local service businesses';
    else if (status === 'not_us') el.score.textContent = 'This check covers US businesses';

    if (d.summary) {
      el.badge.hidden = false;
      el.badge.textContent = d.summary.verdict_label;
      el.badge.className = 'ac-badge ' + (VERDICT_CLASS[d.summary.verdict] || '');
    } else el.badge.hidden = true;

    // These states carry their own heading in the panel or the form, so the score line steps aside.
    $('.ac-scorebar').hidden = ['needs_input', 'not_us', 'not_local', 'failed'].indexOf(status) !== -1;

    renderProgress(d);
    el.why.hidden = !running;

    // Fields the visitor has to give us
    if (status === 'needs_input' && !S.editing) openFields(d.needs, d.site_unreadable ? 'unreadable' : 'missing', d);
    else if (status === 'not_us' && !S.editing) openFields(['city_state'], 'not_us', d);
    else if (!S.editing) el.fields.hidden = true;

    // Answers as they arrive
    (d.queries || []).forEach(function (q) {
      if (S.rendered[q.idx] === q.status) return;
      if (q.status === 'done' || q.status === 'failed') {
        var card = q.status === 'done' ? answerCard(q) : failedCard(q);
        var old = $('[data-idx="' + q.idx + '"]', el.answers);
        if (old) el.answers.replaceChild(card, old); else insertInOrder(card, q.idx);
        S.rendered[q.idx] = q.status;
      }
    });

    // State panels
    if (status === 'failed') {
      showState('failed', "We couldn't get ChatGPT's answers this time.", 'It happens when ChatGPT is slow to answer. Try again in a moment.', [tryAgainButton(d)]);
    } else if (status === 'not_local') {
      showState('not_local', 'This check is built for local service businesses', 'It looks like ' + (d.website || 'this site') + ' sells online or nationally. Local customers ask ChatGPT differently, so the check would not tell you much.', [newCheckButton()]);
    } else if (status === 'partial') {
      showState('partial', '', "One answer didn't load — it'll be in your full audit.", []);
    } else if (status !== 'not_us') {
      el.state.hidden = true;
    }

    if (final && d.summary) renderFinal(d);
  }

  function insertInOrder(card, idx) {
    var after = $$('[data-idx]', el.answers).find(function (n) { return Number(n.getAttribute('data-idx')) > idx; });
    el.answers.insertBefore(card, after || null);
    requestAnimationFrame(function () { card.classList.add('is-in'); });
  }

  function renderProgress(d) {
    el.progress.textContent = '';
    var parsingDone = d.status !== 'parsing';
    el.progress.appendChild(progressItem('Reading your website', parsingDone ? 'done' : 'running'));
    (d.queries || []).forEach(function (q) {
      el.progress.appendChild(progressItem('Asking ChatGPT: ' + q.prompt, q.status));
    });
    el.progress.hidden = !!d.final || d.status === 'needs_input';
  }
  function progressItem(text, status) {
    var li = h('li', { class: 'ac-progress__item is-' + status });
    li.appendChild(h('span', { class: 'ac-progress__icon', 'aria-hidden': 'true' }, [status === 'done' ? icon('check') : status === 'failed' ? icon('x') : null]));
    li.appendChild(h('span', { text: text }));
    li.appendChild(h('span', { class: 'sr-only', text: status === 'done' ? ' done' : status === 'failed' ? ' failed' : ' in progress' }));
    return li;
  }

  function answerLine(q) {
    var c = q.client || {};
    if (c.found && c.position) return h('p', { class: 'ac-answer__line ac-answer__line--hit' }, [icon('check'), 'You appear at #' + c.position]);
    if (c.found) return h('p', { class: 'ac-answer__line ac-answer__line--hit' }, [icon('check'), "You're mentioned in the answer, but not in ChatGPT's list of businesses"]);
    return h('p', { class: 'ac-answer__line ac-answer__line--miss' }, [icon('x'), 'Not mentioned']);
  }

  function answerCard(q) {
    var art = h('article', { class: 'ac-answer', 'data-idx': String(q.idx) });
    var dark = h('div', { class: 'ui ui--dark' }, [
      h('p', { class: 'ui__prompt', text: q.prompt }),
      h('p', { class: 'ui__meta' }, [h('span', { class: 'ui__src', text: 'ChatGPT / Prompt' }), h('span', { class: 'ui__pill', text: 'Answer ' + q.idx + ' of ' + ((S.data && S.data.queries && S.data.queries.length) || 3) })])
    ]);
    var light = h('div', { class: 'ui ui--light' });
    light.appendChild(h('p', { class: 'ui__title', text: 'Businesses ChatGPT named' }));
    var list = q.businesses || [];
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
    light.appendChild(answerLine(q));
    if (q.answer_html) {
      var det = h('details', { class: 'ac-full' }, [h('summary', { text: "Show ChatGPT's full answer" })]);
      det.appendChild(h('div', { class: 'ac-md', html: q.answer_html }));
      light.appendChild(det);
    }
    art.appendChild(dark);
    art.appendChild(light);
    return art;
  }

  function failedCard(q) {
    return h('article', { class: 'ac-answer ac-answer--failed', 'data-idx': String(q.idx) }, [
      h('div', { class: 'ui ui--dark' }, [
        h('p', { class: 'ui__prompt', text: q.prompt }),
        h('p', { class: 'ui__meta' }, [h('span', { class: 'ui__src', text: 'ChatGPT / Prompt' }), h('span', { class: 'ui__pill', text: "Didn't load" })])
      ]),
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
    var a = h('a', { class: 'btn btn--dark', href: '/ai-check/?new=1', text: 'Check another website' });
    a.addEventListener('click', function () { store(LS_LAST, null); });
    return a;
  }

  function tryAgainButton(d) {
    var b = h('button', { class: 'btn btn--primary', type: 'button', text: 'Try again' });
    b.addEventListener('click', async function () {
      busy(b, true);
      var body = { service: (d.business && d.business.service) || '' };
      if (d.business && d.business.city && d.business.state) body.city_state = d.business.city + ', ' + d.business.state;
      var r = await api('PATCH', '/' + S.id, body).catch(function () { return { ok: false, data: {} }; });
      busy(b, false);
      if (!r.ok) { showState('failed', "We couldn't restart the check.", r.data.message || 'Try again in a minute.', [newCheckButton()]); return; }
      resetResult();
      poll();
    });
    return b;
  }

  /* ---------- Edit and missing fields ---------- */
  function openFields(needs, mode, d) {
    var show = { name: false, service: false, city_state: false };
    (needs || []).forEach(function (n) { show[n] = true; });
    if (mode === 'edit') { show.service = true; show.city_state = true; }
    $$('.field', el.fields).forEach(function (f) { f.hidden = !show[f.getAttribute('data-field')]; f.classList.remove('is-invalid'); });
    var b = (d && d.business) || {};
    if (mode === 'edit' || !$('#ac-service').value) $('#ac-service').value = b.service || '';
    if (mode === 'edit' || !$('#ac-city').value) $('#ac-city').value = b.city && b.state ? b.city + ', ' + b.state : '';
    if (!$('#ac-name').value) $('#ac-name').value = b.name || '';
    var titles = {
      unreadable: ["We couldn't read this site", 'Add three details and we will ask ChatGPT about your business.'],
      missing: ['Almost there', show.city_state && show.service ? "We couldn't find what you do or where on your site." : show.city_state ? 'Your site works across an area. Which city should we ask about?' : "We couldn't tell what you do from your site."],
      not_us: ['This check covers US businesses', "It looks like this business isn't in the US. If it is, enter the city and state."],
      edit: ['Change what we ask about', 'Editing starts a new check with your changes.']
    }[mode];
    el.fieldsTitle.textContent = titles[0];
    el.fieldsText.textContent = titles[1];
    el.fieldsSubmit.textContent = mode === 'edit' ? 'Re-check' : 'Check my business';
    el.fieldsCancel.hidden = mode !== 'edit';
    el.fields.setAttribute('data-mode', mode);
    el.fields.hidden = false;
  }

  el.editOpen.addEventListener('click', function () {
    S.editing = true;
    openFields([], 'edit', S.data);
    $('#ac-service').focus();
  });
  el.fieldsCancel.addEventListener('click', function () {
    S.editing = false;
    el.fields.hidden = true;
  });

  el.fields.addEventListener('submit', async function (e) {
    e.preventDefault();
    var body = {};
    var ok = true;
    $$('.field', el.fields).forEach(function (f) {
      if (f.hidden) return;
      var input = $('input', f), v = input.value.trim(), key = f.getAttribute('data-field');
      var valid = key === 'city_state' ? /^[^,]{2,},?\s*[A-Za-z .]{2,}$/.test(v) : v.length >= 2;
      setFieldError(input, !valid);
      if (!valid) ok = false; else body[key] = v;
    });
    if (!ok) return;
    busy(el.fieldsSubmit, true);
    var r = await api('PATCH', '/' + S.id, body).catch(function () { return { ok: false, data: {} }; });
    busy(el.fieldsSubmit, false);
    if (!r.ok) {
      var field = r.data.error && $('#ac-' + (r.data.error === 'city_state' ? 'city' : r.data.error));
      if (field) setFieldError(field, true, r.data.message);
      else showState('limit', r.data.message || 'Something went wrong. Try again.', '', []);
      return;
    }
    S.editing = false;
    el.fields.hidden = true;
    resetResult();
    poll();
  });

  /* ---------- Result, teasers, audit ---------- */
  function renderFinal(d) {
    var s = d.summary;
    el.locked.hidden = false;

    el.competitors.textContent = '';
    (s.competitors || []).forEach(function (c) {
      el.competitors.appendChild(h('li', {}, [h('b', { text: c.name }), h('span', { text: c.label })]));
    });
    if (!(s.competitors || []).length) el.competitors.appendChild(h('li', {}, [h('span', { text: 'ChatGPT named no other businesses.' })]));
    el.sources.textContent = '';
    (s.sources || []).forEach(function (src) {
      el.sources.appendChild(h('li', { class: src.is_client ? 'is-client' : '' }, [icon('globe'), h('b', { text: src.domain }), src.is_client ? h('span', { class: 'ac-src__you', text: 'your site' }) : null]));
    });
    if (!(s.sources || []).length) el.sources.appendChild(h('li', {}, [h('span', { text: 'No sources were cited.' })]));
    el.teasers.hidden = false;

    el.legal.hidden = false;
    el.legal.textContent = 'AI answers change from one question to the next. This check shows what ChatGPT answered on ' + fmtDate(d.checked_at) + '.' +
      (d.cached ? ' Checked on ' + fmtDate(d.checked_at, { month: 'short', day: 'numeric' }) + '; we reuse results for 7 days.' : '');
    el.again.hidden = false;

    el.offer.textContent = s.offer_title || 'Find out how to show up every time';
    el.biz.textContent = bizName(d);
    el.audit.hidden = false;
    if (d.audit_requested) auditDone(d.audit_due_at);

    if (!S.completedFired) {
      S.completedFired = true;
      track.checkCompleted(d.events && d.events.check_completed, { verdict: s.verdict, service: d.business && d.business.service, mentions_count: s.mentions_count });
    }
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
    var r = await api('POST', '/' + S.id + '/audit', { email: email, attribution: track.attribution() }).catch(function () { return { ok: false, data: {} }; });
    busy(el.auditSubmit, false);
    if (!r.ok) {
      setFieldError(el.email, true, r.data.message || 'We could not send your request. Try again.');
      return;
    }
    var s = (S.data && S.data.summary) || {};
    track.auditRequested(r.data.event_id, { verdict: s.verdict, service: S.data && S.data.business && S.data.business.service }, email);
    auditDone(r.data.due_at);
    el.auditDone.focus();
  });

  /* ---------- Start: result URL, or the last check from this browser ---------- */
  var m = location.pathname.match(/^\/ai-check\/r\/([0-9a-f-]{36})\/?$/i);
  if (m) openCheck(m[1], false);
  else if (!/[?&]new=1\b/.test(location.search) && store(LS_LAST)) openCheck(store(LS_LAST), false);
  else if (/[?&]new=1\b/.test(location.search)) { try { history.replaceState(null, '', '/ai-check/'); } catch (e) { /* ignore */ } }
})();

/* /start/: the quote form behind the "Get a fixed quote" buttons. The solution and the currency come
   from the link (?plan=sprint-local&cur=gbp); the summary card is drawn from the data the page carries
   (rendered from data/solutions.js). Sends to /api/start; nothing is charged there. */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var form = $('[data-start-form]');
  if (!form) return;
  var track = window.acTrack || { attribution: function () { return {}; }, config: Promise.resolve({}), event: function () {} };
  var PLANS = {};
  try { PLANS = JSON.parse($('#plans-data').textContent) || {}; } catch (e) { PLANS = {}; }
  var SYMBOL = { usd: '$', eur: '€', gbp: '£' };
  var el = {
    plan: form.elements.namedItem('plan'), cur: form.elements.namedItem('currency'), pay: $('[data-start-pay]'),
    msg: form.elements.namedItem('message'), summary: $('[data-start-summary]'), alert: $('[data-start-alert]'),
    submit: $('[data-start-submit]'), done: $('[data-start-done]'), doneText: $('[data-done-text]')
  };

  /* ---------- Solution and currency from the link (or the visitor's earlier choice) ---------- */
  var q = new URLSearchParams(location.search);
  var plan = q.get('plan');
  if (plan && PLANS[plan]) el.plan.value = plan;
  var cur = (q.get('cur') || '').toLowerCase();
  if (!SYMBOL[cur]) { try { cur = sessionStorage.getItem('sw_cur'); } catch (e) { cur = null; } }
  if (SYMBOL[cur]) el.cur.value = cur;

  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function text(node, value) { node.textContent = value; }
  function from(p, c) { return SYMBOL[c] + fmt(p.from[c]); }

  function render() {
    var p = PLANS[el.plan.value];
    if (!p) return;
    var c = SYMBOL[el.cur.value] ? el.cur.value : 'usd';
    // The list quotes the starting prices in the chosen currency
    $$('option', el.plan).forEach(function (o) {
      var d = PLANS[o.value];
      if (d) o.textContent = d.label + ' (from ' + from(d, c) + (d.unit.charAt(0) === '/' ? '' : ' ') + d.unit + ')';
    });
    el.summary.hidden = false;
    text($('[data-s-kind]', el.summary), p.kind);
    text($('[data-s-name]', el.summary), p.audience ? p.solution + ' · ' + p.audience : p.solution);
    text($('[data-s-price]', el.summary), from(p, c));
    text($('[data-s-unit]', el.summary), p.unit);
    text($('[data-s-billing]', el.summary), p.billing + ' Exact scope and price in writing before you pay.');
    text($('[data-s-label]', el.summary), p.scopeLabel);
    var list = $('[data-s-items]', el.summary);
    list.textContent = '';
    p.items.forEach(function (item) {
      var li = document.createElement('li');
      li.innerHTML = '<svg aria-hidden="true"><use href="#i-check"></use></svg>';
      li.appendChild(document.createTextNode(item));
      list.appendChild(li);
    });
    $('[data-s-link]', el.summary).setAttribute('href', p.url);
    // Only the sprint is paid once: upfront or 50/50
    el.pay.hidden = !p.sprint;
  }
  el.plan.addEventListener('change', render);
  el.cur.addEventListener('change', function () { try { sessionStorage.setItem('sw_cur', el.cur.value); } catch (e) { /* fine */ } render(); });
  render();

  /* ---------- Turnstile (invisible), one token per send ---------- */
  var ts = { loading: null, widget: null, pending: null };
  function loadTurnstile() {
    if (ts.loading) return ts.loading;
    ts.loading = track.config.then(function (cfg) {
      if (!cfg || !cfg.turnstile_site_key) return null;
      return new Promise(function (resolve) {
        window.swStartTurnstile = function () {
          ts.widget = window.turnstile.render($('[data-start-turnstile]'), {
            sitekey: cfg.turnstile_site_key, execution: 'execute', appearance: 'interaction-only', size: 'flexible',
            callback: function (t) { if (ts.pending) { ts.pending(t); ts.pending = null; } },
            'error-callback': function () { if (ts.pending) { ts.pending(''); ts.pending = null; } }
          });
          resolve(ts.widget);
        };
        var s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=swStartTurnstile';
        s.async = true;
        document.head.appendChild(s);
      });
    });
    return ts.loading;
  }
  function token() {
    return loadTurnstile().then(function (w) {
      if (w == null || !window.turnstile) return '';
      return new Promise(function (resolve) {
        ts.pending = resolve;
        try { window.turnstile.reset(w); window.turnstile.execute(w); } catch (e) { resolve(''); }
        setTimeout(function () { if (ts.pending) { ts.pending(''); ts.pending = null; } }, 20000);
      });
    });
  }
  form.addEventListener('focusin', loadTurnstile, { once: true });

  /* ---------- Checks and send ---------- */
  function val(n) { return (form.elements.namedItem(n).value || '').trim(); }
  function setInvalid(name, bad) {
    var input = form.elements.namedItem(name);
    var field = input.closest('.field');
    field.classList.toggle('is-invalid', bad);
    input.setAttribute('aria-invalid', bad ? 'true' : 'false');
    return bad;
  }
  function validate() {
    var bad = [];
    if (setInvalid('name', val('name').length < 2)) bad.push('name');
    if (setInvalid('email', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email')))) bad.push('email');
    if (setInvalid('website', !/^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i.test(val('website')))) bad.push('website');
    return bad;
  }
  ['name', 'email', 'website'].forEach(function (n) {
    form.elements.namedItem(n).addEventListener('input', function () { setInvalid(n, false); el.alert.hidden = true; });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = validate();
    if (bad.length) { form.elements.namedItem(bad[0]).focus(); return; }
    el.submit.disabled = true;
    el.alert.hidden = true;
    var payment = (form.querySelector('input[name="payment"]:checked') || {}).value;
    token().then(function (t) {
      return fetch('/api/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          plan: el.plan.value, currency: el.cur.value, payment: el.pay.hidden ? null : payment,
          name: val('name'), email: val('email'), website: val('website'), message: val('message'),
          turnstile_token: t, attribution: track.attribution()
        })
      });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
    }).then(function (r) {
      if (!r.ok) {
        el.submit.disabled = false;
        var field = { invalid_url: 'website', name: 'name' }[r.data.error] || (/^email_/.test(r.data.error || '') ? 'email' : null);
        if (field) { setInvalid(field, true); form.elements.namedItem(field).focus(); }
        el.alert.textContent = r.data.message || 'We could not send your request. Email us at hi@searchwin.ai.';
        el.alert.hidden = false;
        return;
      }
      track.event('order_request', { plan_id: el.plan.value, currency: el.cur.value });
      el.doneText.textContent = 'We’ll email ' + val('email') + ' the scope and the fixed price to approve. Nothing is charged until you approve it.';
      el.done.hidden = false;
      el.done.focus();
    }).catch(function () {
      el.submit.disabled = false;
      el.alert.textContent = 'We could not send your request. Check your connection, or email us at hi@searchwin.ai.';
      el.alert.hidden = false;
    });
  });

  $$('[data-booking]').forEach(function (a) {
    a.addEventListener('click', function () { track.event('booking_click', { location: a.getAttribute('data-booking') }); });
  });
})();

/* /start/: the order form behind the plan buttons. The plan and currency come from the link
   (?plan=local-sprint-get-found&cur=gbp); the summary card is drawn from the plan data the page
   carries (rendered from data/plans.js). Sends to /api/start; nothing is charged there. */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var form = $('[data-start-form]');
  if (!form) return;
  var track = window.acTrack || { attribution: function () { return {}; }, config: Promise.resolve({}), event: function () {} };
  var PLANS = {};
  try { PLANS = JSON.parse($('#plans-data').textContent) || {}; } catch (e) { PLANS = {}; }
  var SYMBOL = { usd: '$', gbp: '£', eur: '€' };
  var el = {
    plan: form.elements.namedItem('plan'), cur: form.elements.namedItem('currency'), pay: $('[data-start-pay]'),
    msgLabel: $('[data-msg-label]'), msg: form.elements.namedItem('message'), title: $('[data-start-title]'),
    summary: $('[data-start-summary]'), alert: $('[data-start-alert]'), submit: $('[data-start-submit]'),
    submitLabel: $('[data-submit-label]'), done: $('[data-start-done]'), doneText: $('[data-done-text]')
  };

  /* ---------- Plan and currency from the link (or the visitor's earlier choice) ---------- */
  var q = new URLSearchParams(location.search);
  var plan = q.get('plan');
  if (plan && PLANS[plan]) el.plan.value = plan;
  var cur = (q.get('cur') || '').toLowerCase();
  if (!SYMBOL[cur]) { try { cur = sessionStorage.getItem('sw_cur'); } catch (e) { cur = null; } }
  if (SYMBOL[cur]) el.cur.value = cur;

  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function text(node, value) { node.textContent = value; }

  function render() {
    var p = PLANS[el.plan.value];
    if (!p) return;
    var sym = SYMBOL[el.cur.value] || '$';
    // The plan list quotes prices in the chosen currency too
    $$('option', el.plan).forEach(function (o) { o.textContent = o.textContent.replace(/\(([$£€])/, '(' + sym); });
    text(el.title, p.custom ? 'Tell us what you need' : 'Start with ' + p.name);
    el.summary.hidden = false;
    text($('[data-s-line]', el.summary), p.type + ' · ' + p.line);
    text($('[data-s-name]', el.summary), p.name);
    var price = $('[data-s-price]', el.summary);
    price.classList.toggle('plan__price--quote', p.custom);
    price.textContent = '';
    if (p.custom) price.textContent = 'Fixed quote before you pay';
    else if (p.price == null) { price.classList.add('plan__price--quote'); price.textContent = p.quote || 'Fixed price'; }
    else {
      price.appendChild(document.createTextNode(sym + fmt(p.price) + (p.unit.charAt(0) === '/' ? '' : ' ')));
      var unit = document.createElement('span');
      unit.className = 'plan__unit';
      unit.textContent = p.unit;
      price.appendChild(unit);
    }
    text($('[data-s-billing]', el.summary), p.billing);
    text($('[data-s-best]', el.summary), p.bestFor);
    var list = $('[data-s-items]', el.summary);
    list.textContent = '';
    p.items.forEach(function (item) {
      var li = document.createElement('li');
      li.innerHTML = '<svg aria-hidden="true"><use href="#i-check"></use></svg>';
      li.appendChild(document.createTextNode(item));
      list.appendChild(li);
    });
    text($('[data-s-recheck]', el.summary), p.recheck);
    // Sprints are paid upfront or 50/50; monthly plans are billed monthly
    el.pay.hidden = p.lineId !== 'sprint' || p.custom;
    // Custom needs a few words to scope; for a tier the note is optional
    el.msgLabel.innerHTML = p.custom ? 'Tell us what you need' : 'Anything we should know? <span class="field__opt">Optional</span>';
    el.msg.required = !!p.custom;
    el.msg.placeholder = p.custom ? 'Locations, brands, markets or languages, deadlines' : 'Locations, services, markets, deadlines';
    text(el.submitLabel, p.custom ? 'Ask for a fixed quote' : 'Send my order request');
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
    if (setInvalid('message', el.msg.required && val('message').length < 3)) bad.push('message');
    return bad;
  }
  ['name', 'email', 'website', 'message'].forEach(function (n) {
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
        var field = { invalid_url: 'website', name: 'name', message: 'message' }[r.data.error] || (/^email_/.test(r.data.error || '') ? 'email' : null);
        if (field) { setInvalid(field, true); form.elements.namedItem(field).focus(); }
        el.alert.textContent = r.data.message || 'We could not send your request. Email us at hi@searchwin.ai.';
        el.alert.hidden = false;
        return;
      }
      track.event('order_request', { plan_id: el.plan.value, currency: el.cur.value });
      el.doneText.textContent = 'We’ll email ' + val('email') + ' the deliverables list and the fixed price to approve. Nothing is charged until you approve it.';
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

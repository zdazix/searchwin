/* Homepage: the business-type and currency switches, the plan rows on phones, the hero's
   before/after answer and the analytics events. The prices themselves are plain HTML
   (rendered from data/plans.js), so they read fine without this script. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SYMBOL = { usd: '$', gbp: '£', eur: '€' };

  function ss(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* private mode: the URL still carries it */ } }

  /* Events go to GTM / GA4 through the tracking script, after consent where it is needed. */
  function track(name, params) {
    try {
      if (window.acTrack && window.acTrack.event) window.acTrack.event(name, params || {});
    } catch (e) { /* analytics never breaks the page */ }
  }

  function type() { return doc.getAttribute('data-biz-type') === 'online' ? 'online' : 'local'; }
  function cur() { var c = doc.getAttribute('data-cur'); return SYMBOL[c] ? c : 'usd'; }

  /* The choice lives in the address too (?type=online&cur=gbp), so a link opens the same view. */
  function syncUrl() {
    try {
      var u = new URL(location.href);
      u.searchParams.set('type', type());
      u.searchParams.set('cur', cur());
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } catch (e) { /* old browsers: the session still remembers it */ }
  }

  function syncButtons() {
    $$('[data-type-btn]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-type-btn') === type())); });
    $$('[data-cur-btn]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-cur-btn') === cur())); });
    $$('[data-type-panel]').forEach(function (p) {
      var hidden = p.getAttribute('data-type-panel') !== type();
      if (p.classList.contains('pricing__panel')) {
        if (hidden) p.setAttribute('aria-hidden', 'true'); else p.removeAttribute('aria-hidden');
        // Links in the hidden panel must not take focus
        $$('a, summary, button', p).forEach(function (el) { if (hidden) el.setAttribute('tabindex', '-1'); else el.removeAttribute('tabindex'); });
      }
    });
  }

  /* Plan buttons carry the currency to the order form */
  function syncCtas() {
    $$('[data-plan-cta]').forEach(function (a) {
      a.setAttribute('href', '/start/?plan=' + a.getAttribute('data-plan-cta') + '&cur=' + cur());
    });
  }

  function setType(t, source) {
    if (t !== 'local' && t !== 'online') return;
    var changed = t !== type();
    doc.setAttribute('data-biz-type', t);
    ss('sw_type', t);
    syncButtons();
    syncUrl();
    centerRows();
    if (changed) track('business_type_switch', { business_type: t, source: source || 'switch' });
  }

  function setCur(c) {
    if (!SYMBOL[c] || c === cur()) return;
    doc.setAttribute('data-cur', c);
    ss('sw_cur', c);
    if (window.swCurSym) window.swCurSym();
    syncButtons();
    syncCtas();
    syncUrl();
    track('currency_switch', { currency: c });
  }

  $$('[data-type-btn]').forEach(function (b) {
    b.addEventListener('click', function () { setType(b.getAttribute('data-type-btn'), 'switch'); });
  });
  // "See Local plans" and the footer links: flip the switch, then the page scrolls to #pricing
  $$('[data-set-type]').forEach(function (a) {
    a.addEventListener('click', function () { setType(a.getAttribute('data-set-type'), 'link'); });
  });
  $$('[data-cur-btn]').forEach(function (b) {
    b.addEventListener('click', function () { setCur(b.getAttribute('data-cur-btn')); });
  });
  // Arrow keys move between the two business types
  $$('.bizswitch, .curswitch').forEach(function (group) {
    group.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var btns = $$('button', group);
      var i = btns.indexOf(document.activeElement);
      if (i === -1) return;
      var next = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length];
      next.focus();
      next.click();
      e.preventDefault();
    });
  });

  /* Phones: each plan row is a swipe; the middle tier ("Best place to start") is in view first. */
  function centerRows() {
    $$('[data-plans]').forEach(function (row) {
      if (row.scrollWidth <= row.clientWidth + 2) return;
      var featured = row.querySelector('.plan--featured') || row.children[1];
      if (!featured) return;
      var r = row.getBoundingClientRect(), f = featured.getBoundingClientRect();
      row.scrollLeft += (f.left + f.width / 2) - (r.left + r.width / 2);
    });
  }
  var lastWide = null;
  function onResize() {
    var wide = window.innerWidth > 1180;
    if (wide !== lastWide) { lastWide = wide; centerRows(); }
  }
  window.addEventListener('resize', onResize);
  // Measuring the rows forces a layout, so it waits until the page has painted (the rows are below the fold).
  if (document.readyState === 'complete') onResize(); else window.addEventListener('load', onResize);

  /* ---------- Analytics on links and toggles ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null;
    if (!t) return;
    var cta = t.closest('[data-plan-cta]');
    if (cta) track('plan_cta_click', { plan_id: cta.getAttribute('data-plan-cta'), currency: cur(), business_type: type() });
    var check = t.closest('[data-ai-check]');
    if (check) track('ai_check_start', { location: check.getAttribute('data-ai-check') });
    var book = t.closest('[data-booking]');
    if (book) track('booking_click', { location: book.getAttribute('data-booking') });
  });
  $$('[data-compare]').forEach(function (d) {
    d.addEventListener('toggle', function () { if (d.open) track('compare_open', { business_type: type() }); });
  });
  $$('[data-not-included]').forEach(function (d) {
    d.addEventListener('toggle', function () { if (d.open) track('not_included_open', { plan_id: d.getAttribute('data-not-included') }); });
  });
  $$('.qa[data-faq]').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) track('faq_open', { question: (d.querySelector('summary') || d).textContent.trim().slice(0, 100), index: Number(d.getAttribute('data-faq')) });
    });
  });

  /* ---------- Hero: the same AI answer on day 0 and day 45 ---------- */
  (function () {
    var fig = document.querySelector('[data-answer]');
    if (!fig) return;
    var btns = $$('[data-answer-day]', fig);
    var timer = null, visible = true, touched = false;
    function show(day) {
      fig.setAttribute('data-day', day);
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-answer-day') === day)); });
    }
    function flip() { show(fig.getAttribute('data-day') === '0' ? '45' : '0'); }
    function sync() {
      var play = !reduceMotion && !touched && visible && !document.hidden;
      if (play && !timer) timer = setInterval(flip, 3600);
      if (!play && timer) { clearInterval(timer); timer = null; }
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () { touched = true; sync(); show(b.getAttribute('data-answer-day')); });
    });
    show(fig.getAttribute('data-day') || '0');
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; sync(); }, { threshold: 0.3 }).observe(fig);
    }
    document.addEventListener('visibilitychange', sync);
    // First move after a short pause, so the visitor sees the "before" first
    setTimeout(function () { if (!touched && !reduceMotion) flip(); sync(); }, 1600);
  })();

  /* ---------- Start ---------- */
  if (window.swCurSym) window.swCurSym();
  syncButtons();
  syncCtas();
})();

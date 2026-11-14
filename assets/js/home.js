/* Homepage and the solution pages (/sprint/, /monthly/, /pages/): the currency switch next to the
   starting prices, the hero's before/after answer and the analytics events. Prices are plain HTML in all
   three currencies (rendered from data/solutions.js), so they read fine without this script. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CURRENCIES = { usd: 1, eur: 1, gbp: 1 };
  var page = document.body.getAttribute('data-solution-page') || 'home';

  function ss(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* private mode: the URL still carries it */ } }

  /* Events go to GTM / GA4 through the tracking script, after consent where it is needed. */
  function track(name, params) {
    try {
      if (window.acTrack && window.acTrack.event) window.acTrack.event(name, params || {});
    } catch (e) { /* analytics never breaks the page */ }
  }

  function cur() { var c = doc.getAttribute('data-cur'); return CURRENCIES[c] ? c : 'usd'; }

  /* ---------- Currency (solution pages) ---------- */
  var curButtons = $$('[data-cur-btn]');

  function syncButtons() {
    curButtons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-cur-btn') === cur())); });
  }

  /* Quote buttons carry the plan and the currency to the order form */
  function syncCtas() {
    $$('[data-plan-cta]').forEach(function (a) {
      a.setAttribute('href', '/start/?plan=' + a.getAttribute('data-plan-cta') + '&cur=' + cur());
    });
  }

  /* The choice lives in the address too (?cur=gbp), so a link opens with the same prices. */
  function syncUrl() {
    try {
      var u = new URL(location.href);
      u.searchParams.set('cur', cur());
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } catch (e) { /* old browsers: the session still remembers it */ }
  }

  function setCur(c) {
    if (!CURRENCIES[c] || c === cur()) return;
    doc.setAttribute('data-cur', c);
    ss('sw_cur', c);
    syncButtons();
    syncCtas();
    syncUrl();
    track('currency_switch', { currency: c, page: page });
  }

  curButtons.forEach(function (b) {
    b.addEventListener('click', function () { setCur(b.getAttribute('data-cur-btn')); });
  });
  $$('.curswitch').forEach(function (group) {
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

  /* ---------- Analytics on links and toggles ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null;
    if (!t) return;
    var cta = t.closest('[data-plan-cta]');
    if (cta) track('plan_cta_click', { plan_id: cta.getAttribute('data-plan-cta'), currency: cur(), page: page });
    var sol = t.closest('[data-solution]');
    if (sol) track('solution_click', { solution: sol.getAttribute('data-solution'), page: page });
    var check = t.closest('[data-ai-check]');
    if (check) track('ai_check_start', { location: check.getAttribute('data-ai-check'), page: page });
    var book = t.closest('[data-booking]');
    if (book) track('booking_click', { location: book.getAttribute('data-booking'), page: page });
  });
  $$('.qa[data-faq]').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) track('faq_open', { question: (d.querySelector('summary') || d).textContent.trim().slice(0, 100), index: Number(d.getAttribute('data-faq')), page: page });
    });
  });

  /* ---------- Homepage hero: the same AI answer on day 0 and day 45 ---------- */
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
  syncButtons();
  syncCtas();
})();

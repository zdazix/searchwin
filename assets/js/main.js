/* ==========================================================================
   SearchWin.ai · page behaviour
   Plain script (no modules) so the page also works when opened from disk.
   Libraries: GSAP + ScrollTrigger (animation), Lenis (smooth scroll).
   Everything degrades: without JS or with reduced motion the page is static
   and complete.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var animate = hasGSAP && !reduceMotion;

  if (animate) {
    doc.classList.add('anim');
    gsap.registerPlugin(ScrollTrigger);
  } else {
    doc.classList.remove('anim');
  }

  // Placeholder finder: ?ph or #ph outlines every stand-in text and number
  if (/[?&]ph\b/.test(location.search) || location.hash === '#ph') doc.classList.add('show-ph');

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var isMobile = function () { return window.innerWidth <= 960; };

  /* ------------------------------------------------------------------
     The hero's path from prompt to deal. Edit freely.
     ------------------------------------------------------------------ */
  var FLOW_SCENARIOS = [
    { icon: 'i-openai', src: 'ChatGPT / Prompt', prompt: 'Best sales engagement platform for a 40-rep team?', page: 'yourbrand.com/compare', event: 'Demo booked', value: 48000 },
    { icon: 'i-perplexity', src: 'Perplexity / Prompt', prompt: 'Easiest SOC 2 software for a seed-stage startup?', page: 'yourbrand.com/pricing', event: 'Sales call booked', value: 36000 },
    { icon: 'i-gemini', src: 'Gemini / Prompt', prompt: 'HR platform for 500 people in Europe?', page: 'yourbrand.com/eu-payroll', event: 'Deal closed', value: 64000 },
    { icon: 'i-google', src: 'Google / AI Mode', prompt: 'Best observability tool for a mid-size team?', page: 'yourbrand.com/vs/datadog', event: 'Trial started', value: 27000 }
  ];

  /* ------------------------------------------------------------------
     Smooth scroll (Lenis) wired into ScrollTrigger
     ------------------------------------------------------------------ */
  var lenis = null;
  if (animate && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  function navOffset() {
    var bar = $('.nav__bar');
    return bar ? bar.getBoundingClientRect().height + 20 : 90;
  }

  function scrollToTarget(target) {
    if (!target) return;
    if (lenis) {
      lenis.scrollTo(target, { offset: -navOffset() + 10, duration: 1.4 });
    } else {
      var y = target.getBoundingClientRect().top + window.pageYOffset - navOffset() + 10;
      window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id.length < 2) return;
    var target = document.getElementById(id.slice(1));
    if (!target) return;
    e.preventDefault();
    closeMenu();
    scrollToTarget(target);
    try { history.replaceState(null, '', id); } catch (err) { /* sandboxed previews may refuse */ }
    if (id === '#report') {
      setTimeout(function () { var f = $('#f-name'); if (f) f.focus({ preventScroll: true }); }, 1100);
    }
  });

  /* ------------------------------------------------------------------
     Nav
     ------------------------------------------------------------------ */
  var nav = $('[data-nav]');
  var navToggle = $('.nav__toggle');
  var navMenu = $('#mobile-menu');

  function setMenu(open) {
    if (!navMenu) return;
    navMenu.hidden = !open;
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  function closeMenu() { if (navMenu && !navMenu.hidden) setMenu(false); }
  if (navToggle) {
    navToggle.addEventListener('click', function () { setMenu(navMenu.hidden); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navMenu && !navMenu.hidden) { setMenu(false); navToggle.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 1180) closeMenu(); });
  }

  var ticking = false;
  function onScrollFrame() {
    ticking = false;
    nav.classList.toggle('is-scrolled', window.pageYOffset > 8);
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); }
  }, { passive: true });
  onScrollFrame();

  /* ------------------------------------------------------------------
     Hero: one buyer travels from an AI prompt to a won deal.
     A dot runs along the line; each stop lights up as it arrives.
     ------------------------------------------------------------------ */
  var heroVisible = true;

  function formatMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

  function whenHeroVisible() {
    if (heroVisible && !document.hidden) return Promise.resolve();
    return new Promise(function (resolve) {
      var t = setInterval(function () {
        if (heroVisible && !document.hidden) { clearInterval(t); resolve(); }
      }, 250);
    });
  }

  async function typeInto(el, text, perChar) {
    el.textContent = '';
    el.classList.add('is-typing');
    for (var i = 0; i < text.length; i++) {
      el.textContent += text[i];
      await wait(perChar + (text[i] === ' ' ? 20 : Math.random() * 18));
    }
    el.classList.remove('is-typing');
  }

  function tween(target, vars) {
    return new Promise(function (resolve) { vars.onComplete = resolve; gsap.to(target, vars); });
  }

  async function runFlow(flow) {
    var steps = $$('[data-flow-step]', flow);
    var el = {
      icon: $('[data-flow-icon] use', flow),
      src: $('[data-flow-src]', flow),
      prompt: $('[data-flow-prompt]', flow),
      page: $('[data-flow-page]', flow),
      event: $('[data-flow-event]', flow),
      value: $('[data-flow-value]', flow),
      brand: $('.flow__brand', flow)
    };
    var state = { p: 0 };
    var setP = function () { flow.style.setProperty('--p', state.p.toFixed(4)); };
    var on = function (i) { steps[i].classList.add('is-on'); };
    var travel = function (to) { return tween(state, { p: to, duration: 1.1, ease: 'power2.inOut', onUpdate: setP }); };
    var index = 0;

    flow.classList.add('is-live');
    while (true) {
      var s = FLOW_SCENARIOS[index % FLOW_SCENARIOS.length];
      await whenHeroVisible();

      // A new buyer: everything resets
      steps.forEach(function (st) { st.classList.remove('is-on'); });
      state.p = 0; setP();
      el.icon.setAttribute('href', '#' + s.icon);
      if (el.src) el.src.textContent = s.src;
      el.prompt.textContent = '';
      el.page.textContent = s.page;
      el.event.textContent = s.event;
      el.value.textContent = '$0';
      el.brand.style.setProperty('--hl', '0%');
      await wait(450);

      // 1. The buyer asks an AI assistant
      on(0);
      await typeInto(el.prompt, s.prompt, 24);
      await wait(350);

      // 2. The AI names your brand
      await travel(1 / 3);
      on(1);
      gsap.fromTo(el.brand, { '--hl': '0%' }, { '--hl': '100%', duration: 0.7, ease: 'power2.inOut' });
      await wait(700);

      // 3. The buyer lands on the page built for that answer
      await travel(2 / 3);
      on(2);
      await wait(600);

      // 4. And it ends in pipeline
      await travel(1);
      on(3);
      var o = { v: 0 };
      gsap.to(o, { v: s.value, duration: 1, ease: 'power3.out', onUpdate: function () { el.value.textContent = formatMoney(o.v); } });
      await wait(3200);
      index++;
    }
  }

  function initHero() {
    if (!animate) return;
    var flow = $('[data-flow]');

    gsap.timeline({ delay: 0.1 })
      .to('[data-hero-in]', { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09 }, 0)
      .add(function () { if (flow) runFlow(flow); }, 0.5);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        heroVisible = entries[0].isIntersecting;
      }, { threshold: 0.05 }).observe($('.hero'));
    }
  }

  /* ------------------------------------------------------------------
     The prompt: the scrolling cloud of buyer questions
     ------------------------------------------------------------------ */
  var cloudTweens = [];
  function buildCloud() {
    var rows = $$('.cloud__row');
    rows.forEach(function (row) {
      // Keep only the authored prompts, then add clones so the loop has no gap
      $$('[data-clone]', row).forEach(function (c) { c.remove(); });
      if (reduceMotion) return;
      var originals = $$('.q', row);
      var gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      var unitWidth = row.scrollWidth;
      // Make the repeating unit wider than the viewport
      while (unitWidth < window.innerWidth * 1.15) {
        originals.forEach(function (li) { row.appendChild(cloneQ(li)); });
        unitWidth = row.scrollWidth;
      }
      var unitItems = $$('.q', row);
      unitItems.forEach(function (li) { row.appendChild(cloneQ(li)); });
      row._distance = unitWidth + gap;
    });
  }
  function cloneQ(li) {
    var c = li.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    c.setAttribute('data-clone', '');
    return c;
  }

  function initCloud() {
    buildCloud();
    if (!animate) return;
    startCloud();

    var decay;
    ScrollTrigger.create({
      trigger: '.cloud',
      start: 'top bottom',
      end: 'bottom top',
      onToggle: function (self) { cloudTweens.forEach(function (t) { self.isActive ? t.play() : t.pause(); }); },
      onUpdate: function (self) {
        var boost = 1 + Math.min(Math.abs(self.getVelocity()) / 450, 3.5);
        cloudTweens.forEach(function (t) { gsap.to(t, { timeScale: boost, duration: 0.25, overwrite: true }); });
        clearTimeout(decay);
        decay = setTimeout(function () {
          cloudTweens.forEach(function (t) { gsap.to(t, { timeScale: 1, duration: 1.1, ease: 'power2.out', overwrite: true }); });
        }, 140);
      }
    });

    gsap.from('.cloud__rows', {
      opacity: 0, y: 40, duration: 1.4, ease: 'expo.out',
      scrollTrigger: { trigger: '.cloud__rows', start: 'top 92%', once: true }
    });
  }
  function startCloud() {
    cloudTweens.forEach(function (t) { t.kill(); });
    cloudTweens = $$('.cloud__row').map(function (row) {
      var reverse = row.classList.contains('cloud__row--reverse');
      var speed = parseFloat(row.getAttribute('data-speed')) || 48;
      var dist = row._distance || row.scrollWidth / 2;
      gsap.set(row, { x: reverse ? -dist : 0 });
      return gsap.to(row, { x: reverse ? 0 : -dist, duration: dist / speed, ease: 'none', repeat: -1 });
    });
  }

  /* ------------------------------------------------------------------
     Scrollytelling: a step becomes active when it crosses a band of the
     viewport. Works with or without GSAP (states are CSS transitions).
     ------------------------------------------------------------------ */
  function initScrolly(name, onStep) {
    var root = $('[data-scrolly="' + name + '"]');
    if (!root || !('IntersectionObserver' in window)) return;
    var steps = $$('.step', root);
    var current = 0;
    var observer;
    function activate(step) {
      var n = parseInt(step.getAttribute('data-step'), 10);
      if (n === current) return;
      current = n;
      steps.forEach(function (s) { s.classList.toggle('is-active', s === step); });
      onStep(n);
    }
    function observe() {
      if (observer) observer.disconnect();
      // Mobile: a step turns on as its card rises into the lower third, below the stuck graphic
      var margin = isMobile() ? '-76% 0px -23% 0px' : '-46% 0px -46% 0px';
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) activate(en.target); });
      }, { rootMargin: margin });
      steps.forEach(function (s) { observer.observe(s); });
    }
    observe();
    var wasMobile = isMobile();
    window.addEventListener('resize', function () {
      if (wasMobile !== isMobile()) { wasMobile = isMobile(); observe(); }
    });
    activate(steps[0]);
  }

  function initShortlist() {
    var scene = $('.sl');
    if (!scene) return;
    var visual = scene.closest('.scrolly__visual');
    $$('.sl__results li', scene).forEach(function (li, i) { li.style.transitionDelay = (i * 35) + 'ms'; });
    initScrolly('shortlist', function (n) {
      scene.setAttribute('data-state', String(n));
      if (visual) visual.setAttribute('data-state', String(n));
    });
  }

  /* The visit: 100 AI-referred buyers as dots */
  function seeded(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function initVisit() {
    var scene = $('.dots-scene');
    var grid = $('[data-dots]');
    if (!scene || !grid) return;
    var rand = seeded(42);
    var dots = [];
    for (var i = 0; i < 100; i++) {
      var d = document.createElement('span');
      d.className = 'd';
      d.style.setProperty('--delay', Math.round(rand() * 420) + 'ms');
      grid.appendChild(d);
      dots.push(d);
    }
    var order = dots.map(function (_, i) { return i; });
    for (var k = order.length - 1; k > 0; k--) {
      var j = Math.floor(rand() * (k + 1));
      var tmp = order[k]; order[k] = order[j]; order[j] = tmp;
    }
    var STATES = {
      1: { left: 0, demo: [], num: 100, label: 'AI-referred buyers land on your site this month' },
      2: { left: 72, demo: [], num: 72, label: 'leave within a minute' },
      3: { left: 72, demo: [72, 74], num: 2, label: 'book a demo on a typical B2B site' },
      4: { left: 46, demo: [72, 78], num: 6, label: 'book a demo after we rebuild the path' }
    };
    var numEl = $('[data-dots-num]');
    var labelEl = $('[data-dots-label]');
    var shown = { v: 100 };

    function apply(n) {
      var st = STATES[n];
      scene.setAttribute('data-state', String(n));
      order.forEach(function (idx, pos) {
        var dot = dots[idx];
        var isDemo = pos >= st.demo[0] && pos < st.demo[1];
        dot.classList.toggle('is-demo', !!st.demo.length && isDemo);
        dot.classList.toggle('is-left', pos < st.left);
      });
      labelEl.textContent = st.label;
      if (animate) {
        gsap.to(shown, {
          v: st.num, duration: 0.8, ease: 'power3.out', overwrite: true,
          onUpdate: function () { numEl.textContent = Math.round(shown.v); }
        });
      } else {
        numEl.textContent = st.num;
      }
    }
    initScrolly('visit', apply);
  }

  /* ------------------------------------------------------------------
     How it works: stacked layer cards
     ------------------------------------------------------------------ */
  function navHeight() {
    return parseFloat(getComputedStyle(doc).getPropertyValue('--nav-h')) || 72;
  }

  function initStack() {
    if (!animate) return;
    var mm = gsap.matchMedia();
    mm.add('(min-width: 961px) and (min-height: 700px)', function () {
      var layers = $$('[data-layer]');
      layers.forEach(function (layer, i) {
        var next = layers[i + 1];
        if (!next) return;
        var topNext = navHeight() + 16 + (i + 1) * 22;
        gsap.to(layer, {
          scale: 0.94, ease: 'none',
          scrollTrigger: { trigger: next, start: 'top bottom', end: 'top ' + topNext + 'px', scrub: true }
        });
        gsap.to(layer.children, {
          opacity: 0.25, ease: 'none',
          scrollTrigger: { trigger: next, start: 'top 75%', end: 'top ' + topNext + 'px', scrub: true }
        });
      });
    });

    // The brand gets highlighted inside the AI answer
    $$('.cite__a mark').forEach(function (m) {
      gsap.fromTo(m, { '--hl': '0%' }, {
        '--hl': '100%', duration: 0.9, ease: 'power2.inOut',
        scrollTrigger: { trigger: m, start: 'top 80%', once: true }
      });
    });
  }

  /* ------------------------------------------------------------------
     The deal: report toggle (visibility report vs revenue report)
     ------------------------------------------------------------------ */
  function initReport() {
    var report = $('[data-report]');
    if (!report) return;
    var buttons = $$('[data-report-btn]', report);
    var views = $$('[data-report-view]', report);
    var url = $('[data-report-url]', report);
    var touched = false;

    function setView(v) {
      report.setAttribute('data-view', v);
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-report-btn') === v)); });
      views.forEach(function (view) {
        var on = view.getAttribute('data-report-view') === v;
        view.hidden = !on;
        if (on) {
          view.classList.remove('is-entering');
          void view.offsetWidth;
          view.classList.add('is-entering');
        }
      });
      url.textContent = v === 'ours' ? 'searchwin-revenue-report.pdf' : 'visibility-report.pdf';
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () { touched = true; setView(b.getAttribute('data-report-btn')); });
    });

    // Show the switch once by itself, so nobody misses the point
    if (animate) {
      ScrollTrigger.create({
        trigger: report, start: 'top 55%', once: true,
        onEnter: function () { setTimeout(function () { if (!touched) setView('ours'); }, 2200); }
      });
    }
  }

  /* ------------------------------------------------------------------
     Methodology: six practices, one sticky viewer.
     Each practice has its own landscape and product card. Scrolling
     through the list wipes the next landscape in over the last one,
     rolls the counter and plays the card's own small animation.
     ------------------------------------------------------------------ */
  function buildOdo(el) {
    var text = el.textContent.trim();
    el.textContent = '';
    text.split('').forEach(function (ch) {
      var d = document.createElement('span');
      d.className = 'odo__d';
      var s = document.createElement('span');
      s.className = 'odo__s';
      for (var n = 0; n < 10; n++) {
        var x = document.createElement('span');
        x.textContent = n;
        s.appendChild(x);
      }
      s.style.setProperty('--n', ch);
      d.appendChild(s);
      el.appendChild(d);
    });
  }
  function setOdo(el, text) {
    $$('.odo__s', el).forEach(function (s, i) { s.style.setProperty('--n', text.charAt(i)); });
  }

  // The small animation inside each practice's card: rings fill, bars grow, charts draw
  function playCard(card) {
    if (!animate || !card) return;
    var tl = gsap.timeline();
    $$('.ui', card).forEach(function (u, i) {
      tl.fromTo(u, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', clearProps: 'transform' }, i * 0.12);
    });
    $$('.donut', card).forEach(function (d) {
      var v = parseFloat(d.style.getPropertyValue('--v')) || 0;
      tl.fromTo(d, { '--v': 0 }, { '--v': v, duration: 1.2, ease: 'power3.out' }, 0.15);
    });
    var fills = $$('.pbar__fill', card);
    if (fills.length) tl.fromTo(fills, { scaleX: 0 }, { scaleX: 1, transformOrigin: '0 50%', duration: 1, ease: 'expo.out', stagger: 0.08 }, 0.15);
    var areas = $$('.area', card);
    if (areas.length) tl.fromTo(areas, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power2.inOut', clearProps: 'clipPath' }, 0.2);
    var marks = $$('mark', card);
    if (marks.length) tl.fromTo(marks, { '--hl': '0%' }, { '--hl': '100%', duration: 0.8, ease: 'power2.inOut' }, 0.3);
  }

  function initMethod() {
    var body = $('[data-method]');
    if (!body) return;
    var rows = $$('.mrow', body);
    var viewer = $('[data-viewer]', body);
    var panels = $$('[data-vpanel]', viewer);
    var label = $('[data-viewer-label]', viewer);
    var odo = $('[data-viewer-odo]', viewer);
    var segs = $$('.viewer__progress i', viewer);
    var titles = rows.map(function (r) { return $('.mrow__title', r).textContent.trim(); });
    if (!rows.length || !panels.length) return;

    // Phones: each practice gets its own copy of the card, under its text
    rows.forEach(function (row, i) {
      var panel = panels[i];
      if (!panel) return;
      var media = document.createElement('div');
      media.className = 'mrow__media media';
      media.setAttribute('aria-hidden', 'true');
      var img = $('.vpanel__bg', panel).cloneNode(true);
      img.className = 'media__bg';
      var tag = document.createElement('span');
      tag.className = 'mrow__tag';
      tag.textContent = pad(i + 1) + ' / ' + pad(rows.length);
      media.appendChild(img);
      media.appendChild(tag);
      var copy = $('.vcard', panel).cloneNode(true);
      // Gradient ids must stay unique, or charts in the hidden copy steal the fill
      $$('[id]', copy).forEach(function (el) {
        var id = el.id;
        el.id = id + '-m';
        $$('[fill="url(#' + id + ')"]', copy).forEach(function (f) { f.setAttribute('fill', 'url(#' + id + '-m)'); });
      });
      media.appendChild(copy);
      $('.mrow__copy', row).appendChild(media);
      if (animate) {
        ScrollTrigger.create({
          trigger: media, start: 'top 82%', once: true,
          onEnter: function () { if (isMobile()) playCard($('.vcard', media)); }
        });
      }
    });

    buildOdo(odo);
    body.classList.add('is-live');

    var current = -1;
    var tl = null;
    var cards = panels.map(function (p) { return $('.vcard', p); });
    var drift = panels.map(function (p) {
      var bg = $('.vpanel__bg', p);
      return animate ? gsap.quickTo(bg, 'yPercent', { duration: 0.8, ease: 'power3' }) : null;
    });

    function setSegments(i) {
      segs.forEach(function (s, k) {
        if (k < i) s.style.setProperty('--p', 1);
        else if (k > i) s.style.setProperty('--p', 0);
        else if (!animate) s.style.setProperty('--p', 1);
      });
    }

    function show(i) {
      if (i === current || !panels[i]) return;
      var prev = current;
      current = i;
      rows.forEach(function (r, k) { r.classList.toggle('is-active', k === i); });
      label.textContent = titles[i];
      setOdo(odo, pad(i + 1));
      setSegments(i);

      var next = panels[i];
      var old = panels[prev];
      if (!animate || prev < 0 || isMobile()) {
        panels.forEach(function (p) { p.classList.toggle('is-active', p === next); });
        if (animate && prev >= 0) playCard($('.vcard', next));
        return;
      }

      // Start every switch from a clean slate, even mid-transition
      if (tl) tl.kill();
      gsap.killTweensOf(cards);
      gsap.set(cards, { clearProps: 'opacity,transform,translate,rotate,scale' });
      panels.forEach(function (p) {
        gsap.set(p, { clearProps: 'zIndex,clipPath' });
        if (p !== old) p.classList.remove('is-active');
      });
      var down = i > prev;
      var oldCard = $('.vcard', old);
      var nextCard = $('.vcard', next);
      next.classList.add('is-active');
      gsap.set(next, { zIndex: 3 });
      gsap.set(old, { zIndex: 2 });

      tl = gsap.timeline({
        onComplete: function () {
          old.classList.remove('is-active');
          gsap.set([next, old], { clearProps: 'zIndex,clipPath' });
          gsap.set(oldCard, { clearProps: 'opacity,transform' });
        }
      });
      tl.fromTo(next, { clipPath: down ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)' },
                { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.95, ease: 'expo.inOut' }, 0)
        .fromTo($('.vpanel__bg', next), { scale: 1.32 }, { scale: 1.12, duration: 1.5, ease: 'expo.out' }, 0)
        .to(oldCard, { y: down ? -48 : 48, opacity: 0, duration: 0.45, ease: 'power2.in' }, 0)
        .fromTo(nextCard, { y: down ? 70 : -70, opacity: 0, rotation: down ? 2.5 : -2.5 },
                { y: 0, opacity: 1, rotation: 0, duration: 1, ease: 'expo.out' }, 0.4)
        .fromTo(label, { opacity: 0, y: down ? 8 : -8 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.3)
        .add(function () { playCard(nextCard); }, 0.6);
    }

    show(0);

    if (animate) {
      // One trigger per practice: switches the viewer and fills its progress segment
      rows.forEach(function (row, i) {
        ScrollTrigger.create({
          trigger: row,
          start: 'top 55%',
          end: 'bottom 55%',
          onToggle: function (self) { if (self.isActive) show(i); },
          onUpdate: function (self) {
            if (i === current) {
              segs[i].style.setProperty('--p', self.progress.toFixed(3));
              drift[i]((self.progress - 0.5) * -10);
            }
          }
        });
      });
      // Play the first card when the viewer comes into view
      ScrollTrigger.create({
        trigger: viewer, start: 'top 75%', once: true,
        onEnter: function () { if (!isMobile()) playCard($('.vcard', panels[0])); }
      });
    } else if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) show(rows.indexOf(en.target)); });
      }, { rootMargin: '-45% 0px -45% 0px' });
      rows.forEach(function (r) { io.observe(r); });
    }
  }

  /* ------------------------------------------------------------------
     Process: progress line and small-multiple charts
     ------------------------------------------------------------------ */
  function initProcess() {
    var steps = $('[data-steps]');
    if (steps && animate) {
      gsap.fromTo(steps, { '--progress': 0 }, {
        '--progress': 1, ease: 'none',
        scrollTrigger: { trigger: steps, start: 'top 65%', end: 'bottom 55%', scrub: 0.4 }
      });
    }

    $$('[data-chart]').forEach(function (fig) {
      var line = $('.mini__line', fig);
      var area = $('.mini__area', fig);
      var end = $('.mini__end', fig);
      var label = $('.mini__label', fig);
      if (animate) {
        var len = line.getTotalLength();
        line.style.strokeDasharray = len;
        line.style.strokeDashoffset = len;
        gsap.set([area, end, label], { opacity: 0 });
        ScrollTrigger.create({
          trigger: fig, start: 'top 80%', once: true,
          onEnter: function () {
            gsap.timeline()
              .to(line, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' })
              .to(area, { opacity: 1, duration: 0.8 }, 1.1)
              .to([end, label], { opacity: 1, duration: 0.4 }, 1.4);
          }
        });
      }
      initChartHover(fig);
    });
  }

  var tip;
  function initChartHover(fig) {
    var svg = $('svg', fig);
    var hits = $('.mini__hits', fig);
    if (!svg || !hits) return;
    var xs = hits.getAttribute('data-xs').split(',').map(Number);
    var ys = hits.getAttribute('data-ys').split(',').map(Number);
    var points = JSON.parse(hits.getAttribute('data-points'));
    var color = getComputedStyle($('.mini__line', fig)).stroke;
    var NS = 'http://www.w3.org/2000/svg';
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tip';
      tip.hidden = true;
      document.body.appendChild(tip);
    }
    var cross = document.createElementNS(NS, 'line');
    cross.setAttribute('class', 'mini__cross');
    cross.setAttribute('y1', '16');
    cross.setAttribute('y2', '136');
    cross.style.display = 'none';
    var dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('class', 'mini__dot');
    dot.setAttribute('r', '5');
    dot.setAttribute('fill', color);
    dot.style.display = 'none';
    hits.appendChild(cross);
    hits.appendChild(dot);

    var step = xs[1] - xs[0];
    xs.forEach(function (x, i) {
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('class', 'mini__hit');
      r.setAttribute('x', String(x - step / 2));
      r.setAttribute('y', '8');
      r.setAttribute('width', String(step));
      r.setAttribute('height', '140');
      r.setAttribute('tabindex', '0');
      r.setAttribute('role', 'img');
      r.setAttribute('aria-label', points[i][0] + ': ' + points[i][1]);
      function show() {
        cross.setAttribute('x1', String(x)); cross.setAttribute('x2', String(x));
        dot.setAttribute('cx', String(x)); dot.setAttribute('cy', String(ys[i]));
        cross.style.display = ''; dot.style.display = '';
        var box = svg.getBoundingClientRect();
        var scale = box.width / 320;
        tip.textContent = points[i][0] + ' · ' + points[i][1];
        tip.style.left = (box.left + x * scale) + 'px';
        tip.style.top = (box.top + ys[i] * scale) + 'px';
        tip.hidden = false;
      }
      function hide() { cross.style.display = 'none'; dot.style.display = 'none'; tip.hidden = true; }
      r.addEventListener('pointerenter', show);
      r.addEventListener('pointerleave', hide);
      r.addEventListener('focus', show);
      r.addEventListener('blur', hide);
      hits.insertBefore(r, cross);
    });
    window.addEventListener('scroll', function () { if (tip && !tip.hidden) tip.hidden = true; }, { passive: true });
  }

  /* ------------------------------------------------------------------
     Reveals, counters and the slow drift of background images
     ------------------------------------------------------------------ */
  function initReveals() {
    if (!animate) return;

    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 90%', once: true,
      onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: 1.05, ease: 'expo.out', stagger: 0.08, overwrite: true }); }
    });

    ScrollTrigger.batch('[data-tile]', {
      start: 'top 92%', once: true,
      onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07, overwrite: true }); }
    });
  }

  function initParallax() {
    if (!animate) return;
    // Images in sticky frames stay put; the rest drift slightly behind their cards
    $$('.media__bg').forEach(function (img) {
      if (img.closest('.layer, .scrolly, .growth, .mrow__media')) return;
      gsap.fromTo(img, { yPercent: -4 }, {
        yPercent: 4, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
    var cta = $('.band--image .band__bg');
    if (cta) {
      gsap.fromTo(cta, { scale: 1.16, yPercent: -5 }, {
        scale: 1.06, yPercent: 5, ease: 'none',
        scrollTrigger: { trigger: cta.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    }
  }

  function initCounters() {
    $$('[data-count]').forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      var fmt = function (v) {
        return prefix + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
      };
      if (!animate) { el.textContent = fmt(target); return; }
      var obj = { v: 0 };
      el.textContent = fmt(0);
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: function () {
          gsap.to(obj, { v: target, duration: 1.8, ease: 'power3.out', onUpdate: function () { el.textContent = fmt(obj.v); } });
        }
      });
    });
  }

  /* ------------------------------------------------------------------
     FAQ: smooth open/close on native <details>
     ------------------------------------------------------------------ */
  function initFaq() {
    $$('.qa').forEach(function (qa) {
      var summary = $('summary', qa);
      var body = $('.qa__body', qa);
      summary.addEventListener('click', function (e) {
        if (!animate) { setTimeout(refresh, 50); return; }
        e.preventDefault();
        if (qa.open) {
          gsap.to(body, {
            height: 0, duration: 0.45, ease: 'power3.inOut',
            onComplete: function () { qa.open = false; gsap.set(body, { clearProps: 'height' }); refresh(); }
          });
        } else {
          qa.open = true;
          gsap.fromTo(body, { height: 0 }, {
            height: body.scrollHeight, duration: 0.55, ease: 'expo.out',
            onComplete: function () { gsap.set(body, { clearProps: 'height' }); refresh(); }
          });
        }
      });
    });
  }

  var refreshTimer;
  function refresh() {
    if (!hasGSAP) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () { ScrollTrigger.refresh(); }, 120);
  }

  /* ------------------------------------------------------------------
     Form: posts to data-endpoint when set (Formspree, HubSpot, your API).
     Without an endpoint it opens the visitor's email app with the request
     filled in, so a lead is never silently lost.
     ------------------------------------------------------------------ */
  function initForm() {
    var form = $('[data-form]');
    if (!form) return;
    var done = $('[data-form-done]', form);
    var doneTitle = $('[data-form-done-title]', form);
    var doneText = $('[data-form-done-text]', form);
    var CONTACT = 'hi@searchwin.ai';

    function setInvalid(name, bad) {
      var input = form.elements.namedItem(name);
      var field = input.closest('.field');
      field.classList.toggle('is-invalid', bad);
      input.setAttribute('aria-invalid', bad ? 'true' : 'false');
      var err = $('[data-error-for="' + name + '"]', form);
      if (err) {
        err.id = 'err-' + name;
        if (bad) input.setAttribute('aria-describedby', err.id); else input.removeAttribute('aria-describedby');
      }
      return bad;
    }
    function validate() {
      var name = val('name');
      var email = val('email');
      var site = val('website');
      var bad = [];
      if (setInvalid('name', name.length < 2)) bad.push('name');
      if (setInvalid('email', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))) bad.push('email');
      if (setInvalid('website', !/^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i.test(site))) bad.push('website');
      return bad;
    }
    function val(n) { return form.elements.namedItem(n).value.trim(); }
    ['name', 'email', 'website'].forEach(function (n) {
      form.elements.namedItem(n).addEventListener('blur', function () {
        if (val(n)) validate();
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = validate();
      if (bad.length) { form.elements.namedItem(bad[0]).focus(); return; }
      var data = { name: val('name'), email: val('email'), website: val('website'), prompt: val('prompt') };
      var endpoint = form.getAttribute('data-endpoint');
      var btn = $('button[type="submit"]', form);
      var first = data.name.split(' ')[0];

      // Design previews (data-preview) never send anything
      if (form.hasAttribute('data-preview')) {
        doneTitle.textContent = 'Preview only.';
        doneText.textContent = 'This is a design preview, so nothing was sent. On the live site this request goes to ' + CONTACT + '.';
        showDone();
        return;
      }

      if (endpoint) {
        btn.disabled = true;
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data)
        }).then(function (res) {
          if (!res.ok) throw new Error('Request failed');
          doneTitle.textContent = 'Request sent.';
          doneText.textContent = 'Thanks, ' + first + '. We\'re running your prompts now. Your report lands in ' + data.email + ' within 5 business days.';
          showDone();
        }).catch(function () {
          btn.disabled = false;
          doneTitle.textContent = 'The form didn\'t go through.';
          doneText.textContent = 'We couldn\'t send the form. Email us at ' + CONTACT + ' and we\'ll start your report today.';
          showDone();
        });
      } else {
        var body = 'Name: ' + data.name + '\nWork email: ' + data.email + '\nWebsite: ' + data.website +
          (data.prompt ? '\nPrompt to win: ' + data.prompt : '') + '\n\nPlease prepare my free AI visibility report and roadmap.';
        window.location.href = 'mailto:' + CONTACT + '?subject=' + encodeURIComponent('Free Report and Roadmap: ' + data.website) +
          '&body=' + encodeURIComponent(body);
        doneTitle.textContent = 'Almost there.';
        doneText.textContent = 'Your email app should open with the request filled in. Press send and your report lands in ' +
          data.email + ' within 5 business days. Nothing opened? Write to ' + CONTACT + '.';
        showDone();
      }
    });

    function showDone() {
      done.hidden = false;
      done.focus();
    }
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function safe(fn) {
    try { fn(); } catch (err) { if (window.console) console.error('[searchwin]', err); }
  }
  [initHero, initCloud, initShortlist, initVisit, initStack, initReport, initMethod, initProcess, initReveals, initParallax, initCounters, initFaq, initForm]
    .forEach(safe);
  window.__swReady = true;

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      if (animate) { buildCloud(); startCloud(); }
      refresh();
    });
  }

  var resizeTimer;
  var lastWidth = window.innerWidth;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (Math.abs(window.innerWidth - lastWidth) < 40) return;
      lastWidth = window.innerWidth;
      if (animate) { buildCloud(); startCloud(); }
      refresh();
    }, 250);
  });
})();

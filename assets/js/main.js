/* ==========================================================================
   SearchWin · page behaviour
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

  /* ------------------------------------------------------------------
     Content that animates in the hero. Edit freely.
     ------------------------------------------------------------------ */
  var HERO_SCENARIOS = [
    {
      platform: 'ChatGPT', icon: 'i-openai',
      prompt: "What's the best sales engagement platform for a 40-rep B2B team?",
      intro: 'For a 40-rep B2B team, three platforms stand out:',
      why: 'Fastest rollout, native HubSpot sync and per-seat pricing that scales.',
      toastTitle: 'Demo booked', toastMeta: 'VP Sales, 220-person SaaS · via ChatGPT', value: 48000
    },
    {
      platform: 'Perplexity', icon: 'i-perplexity',
      prompt: 'Which SOC 2 compliance software is easiest for a seed-stage startup?',
      intro: 'Startups under 50 people usually shortlist these:',
      why: 'Audit-ready in weeks, built-in auditor network, startup pricing.',
      toastTitle: 'Sales call scheduled', toastMeta: 'CTO, fintech startup · via Perplexity', value: 36000
    },
    {
      platform: 'Gemini', icon: 'i-gemini',
      prompt: 'Recommend an HR platform for a 500-person company in Europe',
      intro: 'Options with strong EU payroll and compliance:',
      why: 'GDPR-ready, local payroll in 12 countries, live in six weeks.',
      toastTitle: 'Deal closed · $64,000 ARR', toastMeta: 'First touch: a Gemini answer', value: 64000
    },
    {
      platform: 'Google AI Mode', icon: 'i-google',
      prompt: 'Best observability tool for a mid-size engineering team',
      intro: 'Based on reviews and pricing, consider:',
      why: 'Set up in an afternoon, usage-based pricing, alerting teams trust.',
      toastTitle: 'Trial started', toastMeta: 'Head of Platform, 400 engineers · via Google AI Mode', value: 27000
    }
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
    return bar ? bar.getBoundingClientRect().height + 28 : 90;
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
    if (history.replaceState) history.replaceState(null, '', id);
    if (id === '#report') {
      setTimeout(function () { var f = $('#f-name'); if (f) f.focus({ preventScroll: true }); }, 1100);
    }
  });

  /* ------------------------------------------------------------------
     Nav: theme follows the section underneath, hides on scroll down
     ------------------------------------------------------------------ */
  var nav = $('[data-nav]');
  var navToggle = $('.nav__toggle');
  var navMenu = $('#mobile-menu');
  var dock = $('[data-dock]');
  var themed = $$('[data-theme], .bridge');
  var stageSections = $$('[data-stage]');
  var hero = $('.hero');
  var lastY = window.pageYOffset;
  var ticking = false;

  function closeMenu() {
    if (!navMenu || navMenu.hidden) return;
    navMenu.hidden = true;
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open menu');
  }
  if (navToggle) {
    navToggle.addEventListener('click', function () {
      var open = navMenu.hidden;
      navMenu.hidden = !open;
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      nav.classList.remove('is-hidden');
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  function onScrollFrame() {
    ticking = false;
    var y = window.pageYOffset;
    var vh = window.innerHeight;

    // Nav state
    nav.classList.toggle('is-scrolled', y > 24);
    var probe = 40;
    var theme = 'dark';
    for (var i = 0; i < themed.length; i++) {
      var r = themed[i].getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) {
        theme = themed[i].classList.contains('bridge') ? 'light' : themed[i].getAttribute('data-theme');
        // A dark section's rounded panel is inset; its outer section can be light at the very edge.
        break;
      }
    }
    nav.classList.toggle('on-light', theme === 'light');
    var delta = y - lastY;
    if (navMenu && navMenu.hidden) {
      if (y > 640 && delta > 6) nav.classList.add('is-hidden');
      else if (delta < -6 || y < 640) nav.classList.remove('is-hidden');
    }
    lastY = y;

    // Journey dock: current stage = last stage section whose top passed 55% of the viewport
    var stage = 0;
    for (var j = 0; j < stageSections.length; j++) {
      var rr = stageSections[j].getBoundingClientRect();
      if (rr.top < vh * 0.55) stage = parseInt(stageSections[j].getAttribute('data-stage'), 10);
    }
    var heroBottom = hero ? hero.getBoundingClientRect().bottom : 0;
    var visible = heroBottom < vh * 0.35 && stage > 0 && stage < 6;
    dock.classList.toggle('is-visible', visible);
    $$('.dock__stage', dock).forEach(function (li) {
      var n = parseInt(li.getAttribute('data-dock-stage'), 10);
      li.classList.toggle('is-active', n === stage);
      li.classList.toggle('is-done', n < stage);
    });
  }
  function requestFrame() {
    if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); }
  }
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', requestFrame);
  onScrollFrame();

  /* ------------------------------------------------------------------
     Word splitting for headline reveals
     ------------------------------------------------------------------ */
  function splitWords(el) {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var parts = child.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span');
            w.className = 'w';
            w.setAttribute('aria-hidden', 'true');
            var inner = document.createElement('span');
            inner.className = 'w__i';
            inner.textContent = p;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.parentNode.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    })(el);
    return $$('.w__i', el);
  }

  /* ------------------------------------------------------------------
     Hero: intro + the AI chat that ends in a booked demo
     ------------------------------------------------------------------ */
  var chat = $('[data-chat]');
  var toast = $('[data-toast]');
  var meterEl = $('[data-meter]');
  var heroVisible = true;
  var pipelineTotal = 124000; // the meter starts here and grows with every scenario

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

  async function streamWords(el, text, perWord) {
    var words = text.split(' ');
    el.textContent = '';
    for (var i = 0; i < words.length; i++) {
      el.textContent += (i ? ' ' : '') + words[i];
      await wait(perWord);
    }
  }

  var chatEls = null;
  function getChatEls() {
    if (chatEls || !chat) return chatEls;
    chatEls = {
      user: $('.chat__user', chat),
      prompt: $('[data-chat-prompt]', chat),
      intro: $('[data-chat-intro]', chat),
      list: $('.chat__list', chat),
      why: $('[data-chat-why]', chat),
      name: $('[data-chat-platform]', chat),
      icon: $('[data-chat-icon] use', chat),
      items: $$('[data-chat-item]', chat),
      toastTitle: $('[data-toast-title]'),
      toastMeta: $('[data-toast-meta]')
    };
    return chatEls;
  }

  // Empty chat window, ready for the next buyer
  function resetChat(s) {
    var e = getChatEls();
    e.name.textContent = s.platform;
    e.icon.setAttribute('href', '#' + s.icon);
    e.prompt.textContent = '';
    e.intro.textContent = '';
    e.why.textContent = s.why;
    e.items.forEach(function (it) { it.classList.add('is-pending'); });
    e.items[0].classList.add('is-dim');
  }

  async function runChat() {
    if (!chat) return;
    var e = getChatEls();
    var parts = [e.user, e.intro, e.list];
    var index = 0;

    while (true) {
      var s = HERO_SCENARIOS[index % HERO_SCENARIOS.length];
      await whenHeroVisible();

      if (index > 0) {
        gsap.to(parts, { autoAlpha: 0, duration: 0.35, ease: 'power2.out' });
        await wait(380);
        resetChat(s);
        gsap.set(parts, { autoAlpha: 1 });
      }

      // 1. The buyer types
      await typeInto(e.prompt, s.prompt, 24);
      await wait(250);

      // 2. AI thinks, then answers
      chat.classList.add('is-thinking');
      await wait(900);
      chat.classList.remove('is-thinking');
      await streamWords(e.intro, s.intro, 55);
      for (var i = 0; i < e.items.length; i++) {
        e.items[i].classList.remove('is-pending');
        await wait(220);
      }

      // 3. Your brand gets the top spot
      await wait(350);
      e.items[0].classList.remove('is-dim');

      // 4. And the recommendation turns into pipeline
      await wait(650);
      e.toastTitle.textContent = s.toastTitle;
      e.toastMeta.textContent = s.toastMeta;
      gsap.to(toast, { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: 'expo.out' });
      var from = { v: pipelineTotal };
      pipelineTotal += s.value;
      gsap.to(from, {
        v: pipelineTotal, duration: 1.2, ease: 'power3.out',
        onUpdate: function () { meterEl.textContent = formatMoney(from.v); }
      });
      gsap.fromTo('.meter', { scale: 1 }, { scale: 1.06, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' });

      await wait(3600);
      gsap.to(toast, { autoAlpha: 0, y: 12, duration: 0.45, ease: 'power2.in' });
      await wait(500);
      index++;
    }
  }

  function initHero() {
    var title = $('.hero__title');
    if (!animate) return;

    var words = splitWords(title);
    gsap.set(words, { yPercent: 115 });
    title.classList.add('is-split');

    // Start from an empty chat: the first buyer types as the page opens
    if (chat) {
      resetChat(HERO_SCENARIOS[0]);
      gsap.set(toast, { autoAlpha: 0, y: 18, scale: 0.96 });
      meterEl.textContent = formatMoney(pipelineTotal);
    }

    var tl = gsap.timeline({ delay: 0.1 });
    var ins = $$('[data-hero-in]');
    tl.to(ins[0], { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out' }, 0)
      .to(words, { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: 0.05 }, 0.08)
      .to(ins.slice(1), { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.1 }, 0.45)
      .from('[data-hero-demo]', { opacity: 0, y: 48, duration: 1.4, ease: 'expo.out' }, 0.35)
      .add(function () { runChat(); }, 1.0);

    // Gentle depth on the way out
    gsap.to('.hero__demo', {
      yPercent: -6, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        heroVisible = entries[0].isIntersecting;
      }, { threshold: 0.05 }).observe($('.hero'));
    }
  }

  /* ------------------------------------------------------------------
     Chapter 01: the scrolling query cloud
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
      var mobile = window.innerWidth <= 960;
      // Mobile: a step turns on as its card rises into the lower third, below the stuck graphic
      var margin = mobile ? '-76% 0px -23% 0px' : '-46% 0px -46% 0px';
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) activate(en.target); });
      }, { rootMargin: margin });
      steps.forEach(function (s) { observer.observe(s); });
    }
    observe();
    var w = window.innerWidth;
    window.addEventListener('resize', function () {
      if ((w <= 960) !== (window.innerWidth <= 960)) { w = window.innerWidth; observe(); }
    });
    activate(steps[0]);
  }

  function initShortlist() {
    var scene = $('.sl');
    if (!scene) return;
    $$('.sl__results li', scene).forEach(function (li, i) { li.style.setProperty('--i', i); });
    initScrolly('shortlist', function (n) { scene.setAttribute('data-state', String(n)); });
  }

  /* Chapter 03: 100 AI-referred buyers as dots */
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
     Chapter 04: stacked layer cards
     ------------------------------------------------------------------ */
  function initStack() {
    if (!animate) return;
    var mm = gsap.matchMedia();
    mm.add('(min-width: 961px) and (min-height: 700px)', function () {
      var layers = $$('[data-layer]');
      layers.forEach(function (layer, i) {
        var next = layers[i + 1];
        if (!next) return;
        var topNext = 84 + 12 + (i + 1) * 22;
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
  }

  /* ------------------------------------------------------------------
     Chapter 05: report toggle (visibility report vs revenue report)
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
              .to(area, { opacity: 1, duration: 0.8 }, 0.6)
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
     Generic reveals, counters, bridges, tiles
     ------------------------------------------------------------------ */
  function initReveals() {
    if (!animate) return;

    $$('[data-split]').forEach(function (el) {
      if (el.closest('.hero')) return;
      var words = splitWords(el);
      gsap.set(words, { yPercent: 115 });
      el.classList.add('is-split');
      ScrollTrigger.create({
        trigger: el, start: 'top 86%', once: true,
        onEnter: function () { gsap.to(words, { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.035 }); }
      });
    });

    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 90%', once: true,
      onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: 1.05, ease: 'expo.out', stagger: 0.08, overwrite: true }); }
    });

    ScrollTrigger.batch('[data-tile]', {
      start: 'top 92%', once: true,
      onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: 'expo.out', stagger: 0.07, overwrite: true }); }
    });

    $$('[data-bridge]').forEach(function (b) {
      var line = $('.bridge__line', b);
      var text = $('.bridge__text', b);
      gsap.timeline({ scrollTrigger: { trigger: b, start: 'top 88%', end: 'center 52%', scrub: 0.6 } })
        .fromTo(line, { '--p': '0%', '--dot': 0 }, { '--p': '100%', ease: 'none', duration: 1 })
        .to(line, { '--dot': 1, ease: 'back.out(3)', duration: 0.25 })
        .fromTo(text, { opacity: 0, y: 26 }, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.7 }, 0.3);
    });

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
    var CONTACT = 'hello@searchwin.com';

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
  [initHero, initCloud, initShortlist, initVisit, initStack, initReport, initProcess, initReveals, initCounters, initFaq, initForm]
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

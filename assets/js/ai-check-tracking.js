/* SearchWin.ai free AI check: attribution, cookie consent, Meta Pixel, Google Ads and GA4.
   Where the law asks for consent (EEA, UK, Switzerland, or an unknown location) no tag loads and no
   tracking cookie is set until the visitor accepts; elsewhere they load right away. The choice is kept
   in local storage and can be changed with the "Cookie settings" link in the footer.
   Tags load after the page has rendered, so they never delay the first screen.
   Browser events only for now; each carries an event_id so a server-side Conversions API
   can be added later without double counting. */
(function () {
  'use strict';

  var preview = /[?&]preview=1\b/.test(location.search);
  var LANG = String(document.documentElement.getAttribute('lang') || 'en').slice(0, 2).toLowerCase() === 'es' ? 'es' : 'en';

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(name, value, days) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; Max-Age=' + Math.round(days * 86400) + '; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  }
  function store(key, val) { try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; } return null; }

  /* ---------- State ---------- */
  var cfg = {};
  var ready = false;     // the tags are running
  var started = false;   // startTags() has run once
  var blocked = false;   // the visitor said no: nothing is sent
  var queue = [];        // events that wait for the tags (or for the visitor's answer)
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  /* ---------- First-party attribution, 90 days (kept in memory until cookies are allowed) ---------- */
  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid', 'fbclid'];
  var CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'fbclid'];
  var params = new URLSearchParams(location.search);
  var attr = {};
  try { attr = JSON.parse(getCookie('sw_attr') || '{}') || {}; } catch (e) { attr = {}; }
  var fresh = {};
  KEYS.forEach(function (k) { var v = params.get(k); if (v) fresh[k] = v.slice(0, 300); });
  if (!attr.landing_url) {
    attr.landing_url = location.href.slice(0, 1000);
    attr.referrer = (document.referrer || '').slice(0, 1000);
    attr.first_seen = Date.now();
  }
  // UTMs stay first-touch; a new ad click replaces the click IDs so conversions go to the latest click.
  KEYS.forEach(function (k) {
    if (!fresh[k]) return;
    if (/^utm_/.test(k) && attr[k]) return;
    attr[k] = fresh[k];
  });
  if (fresh.gclid || fresh.gbraid || fresh.wbraid) attr.click_seen = Date.now();
  function persistAttr() {
    setCookie('sw_attr', JSON.stringify(attr), 90);
    if (fresh.fbclid && !getCookie('_fbc')) setCookie('_fbc', 'fb.1.' + Date.now() + '.' + fresh.fbclid, 90);
  }

  /* ---------- Consent ---------- */
  var CONSENT_KEY = 'sw_consent';
  var CONSENT_DAYS = 180;
  var BANNER_VERSION = 'cb-2026-10-21';
  var TEXT = {
    en: {
      label: 'Cookies', body: 'We use cookies and similar tools to measure visits and show you relevant ads. Accept or reject the non-essential ones; the check works either way.',
      policy: 'Privacy Policy', accept: 'Accept', reject: 'Reject'
    },
    es: {
      label: 'Cookies', body: 'Usamos cookies y herramientas similares para medir las visitas y mostrarte anuncios relevantes. Puedes aceptar o rechazar las no esenciales; la comprobación funciona igual.',
      policy: 'Política de privacidad (en inglés)', accept: 'Aceptar', reject: 'Rechazar'
    }
  }[LANG];

  function readConsent() {
    try {
      var c = JSON.parse(store(CONSENT_KEY) || 'null');
      if (c && (c.v === 'all' || c.v === 'necessary') && Date.now() - c.t < CONSENT_DAYS * 86400e3) return c.v;
    } catch (e) { /* no valid choice stored */ }
    return null;
  }
  function consentSignals(on) {
    var v = on ? 'granted' : 'denied';
    return { ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v };
  }
  function consentUpdate(on) {
    gtag('consent', 'update', consentSignals(on));
    if (window.fbq) window.fbq('consent', on ? 'grant' : 'revoke');
  }
  function clearTrackingCookies() {
    var host = location.hostname, parts = host.split('.'), domains = [''];
    for (var i = 0; i < parts.length - 1; i++) domains.push(parts.slice(i).join('.'));
    document.cookie.split('; ').forEach(function (c) {
      var name = c.split('=')[0];
      if (!/^(_ga|_gid|_gcl|_fb|sw_attr)/.test(name)) return;
      domains.forEach(function (d) { document.cookie = name + '=; Max-Age=0; Path=/' + (d ? '; Domain=' + d : ''); });
    });
  }

  var banner = null;
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function showBanner() {
    if (!banner) {
      banner = el('div', 'ac-consent-bar');
      banner.setAttribute('role', 'region');
      banner.setAttribute('aria-label', TEXT.label);
      var p = el('p', 'ac-consent-bar__text', TEXT.body + ' ');
      var a = el('a', null, TEXT.policy);
      a.href = '/privacy/';
      p.appendChild(a);
      var actions = el('div', 'ac-consent-bar__actions');
      var no = el('button', 'btn btn--sm btn--ghost', TEXT.reject);
      var yes = el('button', 'btn btn--sm btn--dark', TEXT.accept);
      no.type = yes.type = 'button';
      no.addEventListener('click', function () { applyChoice('necessary'); });
      yes.addEventListener('click', function () { applyChoice('all'); });
      actions.appendChild(no);
      actions.appendChild(yes);
      banner.appendChild(p);
      banner.appendChild(actions);
      document.body.appendChild(banner);
    }
    banner.hidden = false;
  }
  function visitorId() {
    var id = store('sw_vid');
    if (!/^[0-9a-f-]{36}$/i.test(id || '')) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, function () { return Math.floor(Math.random() * 16).toString(16); });
      store('sw_vid', id);
    }
    return id;
  }
  /* The answer is also saved on the server as proof of consent (time, choice, language; no IP). */
  function recordChoice(v) {
    try {
      fetch('/api/ai-check/consent', {
        method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true, credentials: 'same-origin',
        body: JSON.stringify({ visitor_id: visitorId(), choice: v, lang: LANG, banner_version: BANNER_VERSION })
      }).catch(function () { /* the choice still applies in this browser */ });
    } catch (e) { /* same */ }
  }
  function applyChoice(v) {
    store(CONSENT_KEY, JSON.stringify({ v: v, t: Date.now() }));
    if (!preview) recordChoice(v);
    if (v === 'all') {
      blocked = false;
      if (!started) startTags();
      else { consentUpdate(true); persistAttr(); }
    } else {
      blocked = true;
      queue = [];
      if (started) consentUpdate(false);
      clearTrackingCookies();
    }
    if (banner) banner.hidden = true;
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-ac-cookie-settings]')) showBanner();
  });

  /* ---------- Config: public IDs from the server ---------- */
  var config = fetch('/api/ai-check/config', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; });

  function fired(id) {
    var list = [];
    try { list = JSON.parse(store('ac_fired') || '[]'); } catch (e) { list = []; }
    if (list.indexOf(id) !== -1) return true;
    list.push(id);
    store('ac_fired', JSON.stringify(list.slice(-50)));
    return false;
  }

  function loadScript(src) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  /* Tags start only when tracking is allowed: consent given, or no consent needed in the visitor's region. */
  function startTags() {
    if (started) return;
    started = true;
    blocked = false;
    persistAttr();
    if (cfg.gtm_id) {
      // Google Tag Manager owns the tags; it starts only now, after consent, with Consent Mode signals set first.
      gtag('consent', 'default', consentSignals(false));
      gtag('consent', 'update', consentSignals(true));
      (function (w, d, s, l, i) {
        w[l] = w[l] || []; w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
        var f = d.getElementsByTagName(s)[0], j = d.createElement(s), dl = l !== 'dataLayer' ? '&l=' + l : '';
        j.async = true; j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl; f.parentNode.insertBefore(j, f);
      })(window, document, 'script', 'dataLayer', cfg.gtm_id);
      ready = true;
      queue.splice(0).forEach(function (fn) { fn(); });
      return;
    }
    if (cfg.meta_pixel_id) {
      /* Meta Pixel base code */
      (function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', cfg.meta_pixel_id);
      window.fbq('track', 'PageView');
    }
    var gid = cfg.google_ads_id || cfg.ga4_id;
    if (gid) {
      // Consent Mode v2: denied first, then granted, both before the tag is configured.
      gtag('consent', 'default', consentSignals(false));
      gtag('consent', 'update', consentSignals(true));
      loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gid));
      gtag('js', new Date());
      if (cfg.google_ads_id) gtag('config', cfg.google_ads_id, { allow_enhanced_conversions: true });
      if (cfg.ga4_id) gtag('config', cfg.ga4_id);
    }
    ready = true;
    queue.splice(0).forEach(function (fn) { fn(); });
  }

  function initTags(c) {
    cfg = c || {};
    if (preview) { persistAttr(); ready = true; queue = []; return; }
    var anyTag = cfg.gtm_id || cfg.meta_pixel_id || cfg.google_ads_id || cfg.ga4_id;
    var choice = readConsent();
    var needsConsent = cfg.consent_required !== false;   // unknown means ask
    if (choice === 'all' || (choice === null && !needsConsent)) startTags();
    else if (choice === null) { if (anyTag) showBanner(); }
    else { blocked = true; }
  }

  // Events wait until the tags are running (or the visitor's answer is known); a "no" drops them.
  function whenReady(fn) {
    if (blocked) return;
    if (ready) fn(); else queue.push(fn);
  }

  function start() { config.then(initTags); }
  if (document.readyState === 'complete') setTimeout(start, 1200);
  else window.addEventListener('load', function () { setTimeout(start, 1200); });

  // With Tag Manager the page only reports what happened; the tags (Meta, GA4, Ads) are set up in GTM on these events.
  function push(name, eventId, data, email) {
    var e = Object.assign({ event: name, event_id: eventId }, data || {});
    if (email) e.user_data = { email: String(email).trim().toLowerCase() };
    window.dataLayer.push(e);
  }

  function adsConversion(label, extra) {
    if (cfg.google_ads_id && label) gtag('event', 'conversion', Object.assign({ send_to: cfg.google_ads_id + '/' + label }, extra || {}));
  }

  /* ---------- Public API used by ai-check.js ---------- */
  window.acTrack = {
    config: config,
    attribution: function () {
      var a = {};
      for (var k in attr) if (Object.prototype.hasOwnProperty.call(attr, k) && typeof attr[k] === 'string') a[k] = attr[k];
      // Ad click IDs and Meta browser IDs only travel with the lead while tracking is allowed.
      if ((started && !blocked) || preview) { a.fbp = getCookie('_fbp'); a.fbc = getCookie('_fbc'); }
      else CLICK_IDS.forEach(function (k) { delete a[k]; });
      var vid = store('sw_vid');
      if (vid) a.visitor_id = vid;
      return a;
    },
    // The visitor sent a website and the server accepted it (before any answer exists): the "sent a site" audience.
    checkStarted: function (eventId, data) {
      if (!eventId) return;
      whenReady(function () {
        if (fired(eventId)) return;
        if (cfg.gtm_id) return push('check_started', eventId, data);
        if (window.fbq && cfg.meta_pixel_id) window.fbq('trackCustom', 'CheckStarted', Object.assign({ content_name: 'ai_check_site' }, data), { eventID: eventId });
        adsConversion(cfg.google_ads_labels && cfg.google_ads_labels.check_started, { transaction_id: eventId });
        if (cfg.ga4_id) gtag('event', 'check_started', data || {});
      });
    },
    checkCompleted: function (eventId, data) {
      if (!eventId) return;
      whenReady(function () {
        if (fired(eventId)) return;
        if (cfg.gtm_id) return push('check_completed', eventId, data);
        if (window.fbq && cfg.meta_pixel_id) window.fbq('track', 'ViewContent', Object.assign({ content_name: 'ai_check_result' }, data), { eventID: eventId });
        adsConversion(cfg.google_ads_labels && cfg.google_ads_labels.check_completed, { transaction_id: eventId });
        if (cfg.ga4_id) gtag('event', 'check_completed', data || {});
      });
    },
    auditRequested: function (eventId, data, email) {
      if (!eventId) return;
      whenReady(function () {
        if (fired(eventId)) return;
        if (cfg.gtm_id) return push('generate_lead', eventId, data, email);
        if (window.fbq && cfg.meta_pixel_id) {
          if (email) window.fbq('init', cfg.meta_pixel_id, { em: String(email).trim().toLowerCase() });
          window.fbq('track', 'Lead', Object.assign({ content_name: 'ai_check_audit' }, data), { eventID: eventId });
        }
        if (cfg.google_ads_id && email) gtag('set', 'user_data', { email: String(email).trim().toLowerCase() });
        adsConversion(cfg.google_ads_labels && cfg.google_ads_labels.audit_requested, { transaction_id: eventId });
        if (cfg.ga4_id) gtag('event', 'generate_lead', data || {});
      });
    }
  };
})();

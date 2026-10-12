/* SearchWin.ai free AI check: attribution cookie, Meta Pixel, Google Ads and GA4.
   Tags load after the page has rendered, so they never delay the first screen.
   Every event carries the same event_id the server sends to the Conversions API. */
(function () {
  'use strict';

  var preview = /[?&]preview=1\b/.test(location.search);

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(name, value, days) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; Max-Age=' + Math.round(days * 86400) + '; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  }
  function store(key, val) { try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; } return null; }

  /* ---------- First-party attribution, 90 days ---------- */
  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid', 'fbclid'];
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
  setCookie('sw_attr', JSON.stringify(attr), 90);
  if (fresh.fbclid && !getCookie('_fbc')) setCookie('_fbc', 'fb.1.' + Date.now() + '.' + fresh.fbclid, 90);

  /* ---------- Config: public IDs from the server ---------- */
  var config = fetch('/api/ai-check/config', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; });

  /* ---------- Queues: events wait until the tags are ready ---------- */
  var queue = [];
  var ready = false;
  var cfg = {};
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

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

  function initTags(c) {
    cfg = c || {};
    if (preview) { ready = true; queue = []; return; }
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
      loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gid));
      gtag('js', new Date());
      if (cfg.google_ads_id) gtag('config', cfg.google_ads_id, { allow_enhanced_conversions: true });
      if (cfg.ga4_id) gtag('config', cfg.ga4_id);
    }
    ready = true;
    queue.splice(0).forEach(function (fn) { fn(); });
  }

  function whenReady(fn) { if (ready) fn(); else queue.push(fn); }

  function start() { config.then(initTags); }
  if (document.readyState === 'complete') setTimeout(start, 1200);
  else window.addEventListener('load', function () { setTimeout(start, 1200); });

  function adsConversion(label, extra) {
    if (cfg.google_ads_id && label) gtag('event', 'conversion', Object.assign({ send_to: cfg.google_ads_id + '/' + label }, extra || {}));
  }

  /* ---------- Public API used by ai-check.js ---------- */
  window.acTrack = {
    config: config,
    attribution: function () {
      var a = {};
      for (var k in attr) if (Object.prototype.hasOwnProperty.call(attr, k) && typeof attr[k] === 'string') a[k] = attr[k];
      a.fbp = getCookie('_fbp');
      a.fbc = getCookie('_fbc');
      return a;
    },
    checkStarted: function (eventId, data) {
      if (!eventId || fired(eventId)) return;
      whenReady(function () {
        if (window.fbq && cfg.meta_pixel_id) window.fbq('trackCustom', 'CheckStarted', data || {}, { eventID: eventId });
        adsConversion(cfg.google_ads_labels && cfg.google_ads_labels.check_started, { transaction_id: eventId });
        if (cfg.ga4_id) gtag('event', 'check_started', data || {});
      });
    },
    checkCompleted: function (eventId, data) {
      if (!eventId || fired(eventId)) return;
      whenReady(function () {
        if (window.fbq && cfg.meta_pixel_id) window.fbq('track', 'ViewContent', Object.assign({ content_name: 'ai_check_result' }, data), { eventID: eventId });
        adsConversion(cfg.google_ads_labels && cfg.google_ads_labels.check_completed, { transaction_id: eventId });
        if (cfg.ga4_id) gtag('event', 'check_completed', data || {});
      });
    },
    auditRequested: function (eventId, data, email) {
      if (!eventId || fired(eventId)) return;
      whenReady(function () {
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

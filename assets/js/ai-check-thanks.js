/* Thank-you page after an audit request: the date, the booking calendar and the conversion events.
   The details come from the page the visitor just left (sessionStorage); without them the page still works. */
(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var info = {};
  try { info = JSON.parse(sessionStorage.getItem('ac_thanks') || '{}') || {}; } catch (e) { info = {}; }
  var track = window.acTrack || { config: Promise.resolve({}), auditRequested: function () {} };

  /* Text: the date and the business, written with textContent only */
  var due = info.due_at ? new Date(info.due_at) : new Date(Date.now() + 48 * 3600e3);
  var when = due.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  var lead = $('[data-thanks-lead]');
  if (lead) {
    lead.textContent = '';
    lead.appendChild(document.createTextNode("We'll email your AI visibility audit + 45-day roadmap" + (info.name ? ' for ' + info.name : '') + ' by '));
    var b = document.createElement('b');
    b.textContent = when;
    lead.appendChild(b);
    lead.appendChild(document.createTextNode('. Check your inbox (and the spam folder).'));
  }

  /* The conversion events go out here, once per request (acTrack remembers the event id) */
  if (info.event_id) {
    track.auditRequested(info.event_id, { verdict: info.verdict, service: info.service, kind: info.kind }, info.email);
  }

  /* Booking calendar: the address of the scheduling page comes from PUBLIC_BOOKING_URL */
  track.config.then(function (cfg) {
    var box = $('[data-thanks-calendar]');
    var url = cfg && cfg.booking_url;
    if (!box || !url) return;
    var u;
    try { u = new URL(url); } catch (e) { return; }
    if (u.protocol !== 'https:') return;
    // Google Calendar appointment pages take no prefill parameters; Calendly and Cal.com take the email.
    if (info.email && !/calendar\.google\.com$/.test(u.hostname) && !u.searchParams.has('email')) u.searchParams.set('email', info.email);
    if (/(^|\.)calendly\.com$/.test(u.hostname)) {
      u.searchParams.set('embed_domain', location.hostname);
      u.searchParams.set('embed_type', 'Inline');
      u.searchParams.set('hide_gdpr_banner', '1');
    }
    var frame = document.createElement('iframe');
    frame.src = u.href;
    frame.title = 'Book a free call';
    frame.loading = 'lazy';
    frame.setAttribute('allow', 'payment');
    box.textContent = '';
    box.classList.add('has-frame');
    box.appendChild(frame);
  });
})();

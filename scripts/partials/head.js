(function (d) {
  d.classList.add('js');
  // Animation start states apply only while JS is on its way; a failsafe shows everything if it never arrives.
  // Opened at an anchor: no fade-ins, the section is there at once.
  if (location.hash.length > 1) d.classList.add('no-anim');
  else if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    d.classList.add('anim');
    setTimeout(function () { if (!window.__swReady) d.classList.remove('anim'); }, 4000);
  }
  // The currency is settled before the first paint, so prices never jump.
  // Order: the link (?cur=gbp), then this visit's earlier choice, then the visitor's time zone.
  var q = new URLSearchParams(location.search);
  var ss = function (k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { /* private mode */ } return null; };
  var cur = (q.get('cur') || '').toLowerCase();
  if (/^(usd|gbp|eur)$/.test(cur)) ss('sw_cur', cur); else cur = ss('sw_cur');
  if (!/^(usd|gbp|eur)$/.test(cur || '')) {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { tz = ''; }
    cur = /^Europe\/(London|Belfast|Guernsey|Isle_of_Man|Jersey|Gibraltar)$/.test(tz) ? 'gbp'
      : /^(Europe\/(Amsterdam|Andorra|Athens|Berlin|Bratislava|Brussels|Bucharest|Budapest|Busingen|Copenhagen|Dublin|Helsinki|Lisbon|Ljubljana|Luxembourg|Madrid|Malta|Mariehamn|Monaco|Nicosia|Oslo|Paris|Prague|Riga|Rome|San_Marino|Sofia|Stockholm|Tallinn|Vaduz|Vatican|Vienna|Vilnius|Warsaw|Zagreb|Zurich)|Atlantic\/(Canary|Madeira|Azores|Reykjavik)|Asia\/(Nicosia|Famagusta))$/.test(tz) ? 'eur'
      : 'usd';
  }
  d.setAttribute('data-cur', cur);
})(document.documentElement);

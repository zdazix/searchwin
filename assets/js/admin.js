/* Admin for the free AI check: requests, checks with timings, events, settings.
   Server data is shown with textContent; ChatGPT answers arrive already sanitised. */
(function () {
  'use strict';

  var API = '/api/admin';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var filter = '';

  var STATUS = { new: 'Новая', in_progress: 'В работе', sent: 'Отправлена' };
  var CHECK_STATUS = { parsing: 'Разбор сайта', needs_input: 'Ждёт данных', not_local: 'Не локальный', not_us: 'Не США', running: 'Идёт', done: 'Готово', partial: 'Частично', failed: 'Упала' };
  var VERDICT = { not_recommended: 'Не рекомендует', sometimes: 'Иногда', not_first: 'Не первый', top_pick: 'Первый выбор' };
  var RULE = { domain: 'домен', exact: 'точное имя', fuzzy: 'похожее имя', text: 'упомянут в тексте' };

  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k] == null ? '' : String(attrs[k]);
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null && c !== false) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function dt(v) { return v ? new Date(v).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'; }
  function sec(ms) { return ms == null ? '—' : (ms / 1000).toFixed(1) + ' с'; }
  function money(v) { return v == null ? '—' : '$' + Number(v).toFixed(3); }
  function pill(text, kind) { return h('span', { class: 'adm-pill adm-pill--' + kind, text: text }); }
  function toast(msg) {
    var t = h('div', { class: 'adm-toast', text: msg });
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }
  function copy(text, label) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast(label + ' скопирован'); }, function () {
      window.prompt('Скопируйте:', text);
    });
  }

  async function api(method, path, body) {
    var res = await fetch(API + path, { method: method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (res.status === 401 && path !== '/login') { showLogin(); throw new Error('unauthorized'); }
    return { ok: res.ok, status: res.status, data: data };
  }

  /* ---------- Login ---------- */
  function showLogin() {
    $$('[data-view]').forEach(function (v) { v.hidden = true; });
    $('[data-tabs]').hidden = true; $('[data-logout]').hidden = true;
    $('[data-login]').hidden = false;
  }
  $('[data-login]').addEventListener('submit', async function (e) {
    e.preventDefault();
    var r = await api('POST', '/login', { password: e.target.password.value });
    if (!r.ok) { var err = $('[data-login-error]'); err.hidden = false; err.textContent = r.data.message || 'Ошибка входа'; return; }
    e.target.reset();
    $('[data-login]').hidden = true;
    route();
  });
  $('[data-logout]').addEventListener('click', async function () { await api('POST', '/logout'); showLogin(); });

  /* ---------- Router ---------- */
  function show(view) {
    $('[data-login]').hidden = true;
    $('[data-tabs]').hidden = false; $('[data-logout]').hidden = false;
    $$('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== view; });
    var tab = { request: 'requests', check: 'checks' }[view] || view;
    $$('[data-tab]').forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('data-tab') === tab); });
  }
  async function route() {
    var hash = location.hash.replace(/^#/, '');
    var m;
    try {
      if ((m = hash.match(/^request=([0-9a-f-]{36})$/))) { show('request'); await loadRequest(m[1]); }
      else if ((m = hash.match(/^check=([0-9a-f-]{36})$/))) { show('check'); await loadCheck(m[1]); }
      else if (hash === 'checks') { show('checks'); await loadChecks(); }
      else if (hash === 'events') { show('events'); await loadEvents(); }
      else if (hash === 'settings') { show('settings'); await loadSettings(); }
      else { show('requests'); await loadRequests(); }
    } catch (e) { if (e.message !== 'unauthorized') toast('Ошибка: ' + e.message); }
  }
  window.addEventListener('hashchange', route);

  /* ---------- Requests ---------- */
  $$('[data-filter]').forEach(function (b) {
    b.addEventListener('click', function () { filter = b.getAttribute('data-filter'); loadRequests(); });
  });

  async function loadRequests() {
    var r = await api('GET', '/requests' + (filter ? '?status=' + filter : ''));
    var c = r.data.counts || {};
    $$('[data-c]').forEach(function (n) { var v = c[n.getAttribute('data-c')]; n.textContent = v ? String(v) : ''; });
    $('[data-count-new]').textContent = c.new ? String(c.new) : '';
    $$('[data-filter]').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-filter') === filter); });
    var list = $('[data-requests]');
    list.textContent = '';
    if (!(r.data.requests || []).length) { list.appendChild(h('p', { class: 'adm-note', text: 'Заявок нет.' })); return; }
    r.data.requests.forEach(function (q) {
      var row = h('a', { class: 'adm-row' + (q.overdue ? ' is-overdue' : ''), href: '#request=' + q.id }, [
        h('div', { class: 'adm-row__main' }, [h('b', { text: q.business_name || q.website_domain }), h('small', { text: q.website_domain + ' · ' + (q.service || '—') + ', ' + (q.city || '—') + ' ' + (q.state || '') })]),
        h('div', {}, [h('div', { text: q.email }), h('small', { text: 'Пришла ' + dt(q.created_at) })]),
        h('div', {}, [h('div', { text: (q.mentions_count ?? 0) + ' из ' + (q.total_answers ?? 0) }), h('small', { text: VERDICT[q.verdict] || '' })]),
        h('div', { class: 'adm-actions' }, [
          q.is_test ? pill('тест', 'test') : null,
          q.overdue ? pill('просрочена', 'overdue') : null,
          pill(STATUS[q.status] || q.status, q.status),
          h('small', { text: q.status === 'sent' ? 'отправлена ' + dt(q.sent_at) : 'срок ' + dt(q.due_at) })
        ])
      ]);
      list.appendChild(row);
    });
  }

  async function loadRequest(id) {
    var box = $('[data-request-card]');
    box.textContent = 'Загрузка…';
    var r = await api('GET', '/requests/' + id);
    box.textContent = '';
    if (!r.ok) { box.appendChild(h('p', { class: 'adm-error', text: r.data.message || 'Не найдено' })); return; }
    var req = r.data.request, lead = r.data.lead || {}, check = r.data.check;
    var name = check.business_name || check.website_domain;

    var actions = h('div', { class: 'adm-actions' }, [
      h('button', { class: 'btn btn--dark', type: 'button', text: 'Скопировать email', onclick: function () { copy(lead.email, 'Email'); } }),
      h('button', { class: 'btn btn--ghost', type: 'button', text: 'Скопировать ссылку на результат', onclick: function () { copy(check.result_url, 'Ссылка'); } }),
      h('a', { class: 'btn btn--ghost', href: check.result_url + '?preview=1', target: '_blank', rel: 'noopener', text: 'Открыть результат' }),
      req.status !== 'in_progress' && req.status !== 'sent' ? h('button', { class: 'btn btn--primary', type: 'button', text: 'Взять в работу', onclick: function () { setStatus(id, 'in_progress'); } }) : null,
      req.status !== 'sent' ? h('button', { class: 'btn btn--primary', type: 'button', text: 'Отметить отправленным', onclick: function () { setStatus(id, 'sent'); } }) : null,
      req.status !== 'new' ? h('button', { class: 'btn btn--ghost', type: 'button', text: 'Вернуть в новые', onclick: function () { setStatus(id, 'new'); } }) : null,
      h('a', { class: 'btn btn--ghost', href: API + '/requests/' + id + '/export', text: 'Экспорт JSON' })
    ]);

    var head = h('div', { class: 'adm-box' }, [
      h('div', { class: 'adm-actions' }, [h('h1', { text: name }), pill(STATUS[req.status] || req.status, req.status), req.overdue ? pill('просрочена', 'overdue') : null, check.is_test ? pill('тест', 'test') : null]),
      h('p', { class: 'adm-sub', text: check.website_domain + ' · ' + lead.email + ' · пришла ' + dt(req.created_at) + ' · срок ' + dt(req.due_at) + (req.sent_at ? ' · отправлена ' + dt(req.sent_at) : '') }),
      h('div', { style: 'margin-top:12px' }, [actions])
    ]);

    var notes = h('form', { class: 'adm-box adm-grid' }, [
      h('label', {}, [h('span', { class: 'adm-label', text: 'Заметки' }), h('textarea', { name: 'notes', rows: '4', text: req.notes || '' })]),
      h('label', {}, [h('span', { class: 'adm-label', text: 'Уточнения от заявителя' }), h('textarea', { name: 'extra_info', rows: '4', text: req.extra_info || '' })]),
      h('div', { class: 'adm-actions' }, [h('button', { class: 'btn btn--dark', type: 'submit', text: 'Сохранить' })])
    ]);
    notes.addEventListener('submit', async function (e) {
      e.preventDefault();
      var s = await api('PATCH', '/requests/' + id, { notes: notes.notes.value, extra_info: notes.extra_info.value });
      toast(s.ok ? 'Сохранено' : (s.data.message || 'Ошибка'));
    });

    var leadBox = h('div', { class: 'adm-box' }, [h('h2', { text: 'Источник' }), kv([
      ['UTM', [lead.utm_source, lead.utm_medium, lead.utm_campaign, lead.utm_content, lead.utm_term].filter(Boolean).join(' / ') || '—'],
      ['gclid / gbraid / wbraid', [lead.gclid, lead.gbraid, lead.wbraid].filter(Boolean).join(' / ') || '—'],
      ['fbclid / fbc / fbp', [lead.fbclid, lead.fbc, lead.fbp].filter(Boolean).join(' / ') || '—'],
      ['Первая страница', lead.landing_url || '—'],
      ['Откуда пришёл', lead.referrer || '—'],
      ['Согласие', 'версия ' + (lead.consent_text_version || '—')]
    ])]);

    box.appendChild(h('div', { class: 'adm-card' }, [head, notes, leadBox, checkBlock(check)]));
  }

  async function setStatus(id, status) {
    var r = await api('PATCH', '/requests/' + id, { status: status });
    toast(r.ok ? 'Статус: ' + STATUS[status] : (r.data.message || 'Ошибка'));
    loadRequest(id);
  }

  function kv(rows) {
    var dl = h('dl', { class: 'adm-kv' });
    rows.forEach(function (r) { dl.appendChild(h('dt', { text: r[0] })); dl.appendChild(h('dd', { text: r[1] == null ? '—' : String(r[1]) })); });
    return dl;
  }

  /* ---------- One check: answers, matches, competitors, sources, timings ---------- */
  function checkBlock(c) {
    var parse = c.site_parse || {};
    var wrap = h('div', { class: 'adm-card' });
    wrap.appendChild(h('div', { class: 'adm-grid' }, [
      h('div', { class: 'adm-box' }, [h('h2', { text: 'Итог' }), kv([
        ['Статус', CHECK_STATUS[c.status] || c.status],
        ['Названы в ответах', c.mentions_count == null ? '—' : c.mentions_count + ' из ' + c.total_answers],
        ['Лучшая позиция', c.best_position ? '#' + c.best_position : '—'],
        ['Вердикт', c.verdict_label || '—'],
        ['Запрос', [c.service, c.city && c.city + ', ' + c.state].filter(Boolean).join(' в ') || '—'],
        ['Кэш', c.cache_of ? 'да, из проверки ' + c.cache_of.slice(0, 8) : 'нет'],
        ['Ошибка', c.error || '—']
      ])]),
      h('div', { class: 'adm-box' }, [h('h2', { text: 'Разбор сайта' }), kv([
        ['Название', c.business_name || '—'],
        ['Уверенность', parse.confidence != null ? Math.round(parse.confidence * 100) + '%' : '—'],
        ['Страницы', (parse.pages || []).join(', ') || (parse.error ? 'не прочитан: ' + parse.error : '—')],
        ['Email с сайта', (c.site_emails || []).join(', ') || '—'],
        ['Время разбора', sec(c.parse_ms)],
        ['Вся проверка', sec(c.total_ms)],
        ['Стоимость', money(c.cost_usd) + ' (разбор ' + money(c.parse_cost_usd) + ')']
      ])])
    ]));
    wrap.appendChild(h('div', { class: 'adm-grid' }, [
      h('div', { class: 'adm-box' }, [h('h2', { text: 'Кого ИИ рекомендует вместо' }), list((c.competitors || []).map(function (x) { return x.name + ' — ' + x.label + ', средняя позиция ' + x.avg_position; }))]),
      h('div', { class: 'adm-box' }, [h('h2', { text: 'Источники ChatGPT' }), list((c.sources || []).map(function (s) { return s.domain + ' — в ' + s.count + ' ответ(ах)' + (s.is_client ? ' · сайт клиента' : ''); }))])
    ]));
    (c.queries || []).forEach(function (q) { wrap.appendChild(queryBlock(q)); });
    return wrap;
  }
  function list(items) {
    if (!items.length) return h('p', { class: 'adm-note', text: '—' });
    return h('ol', { class: 'adm-biz' }, items.map(function (t, i) { return h('li', {}, [h('span', { text: String(i + 1) }), h('span', { text: t })]); }));
  }
  function queryBlock(q) {
    var head = h('div', { class: 'adm-q__head' }, [
      h('span', { class: 'adm-q__prompt', text: q.idx + '. ' + q.prompt }),
      pill(CHECK_STATUS[q.status] || q.status, q.status === 'done' ? 'done' : q.status === 'failed' ? 'failed' : 'warn'),
      h('span', { class: 'adm-sub', text: sec(q.duration_ms) + ' · ' + money(q.cost_usd) + ' · попыток ' + q.attempts + (q.model ? ' · ' + q.model : '') + (q.current ? '' : ' · старая правка') })
    ]);
    var box = h('div', { class: 'adm-q' + (q.current ? '' : ' is-old') }, [head]);
    if (q.error) box.appendChild(h('p', { class: 'adm-error', text: q.error }));
    if (q.status === 'done') {
      box.appendChild(h('p', { text: q.client_found ? 'Клиент найден' + (q.client_position ? ' на #' + q.client_position : ' без позиции') + ' — правило: ' + (RULE[q.match_rule] || q.match_rule) : 'Клиент не найден' }));
      var ol = h('ol', { class: 'adm-biz' });
      (q.businesses || []).forEach(function (b) {
        ol.appendChild(h('li', { class: b.is_client ? 'is-client' : '' }, [
          h('span', { text: '#' + b.position }),
          h('span', { text: b.name + (b.domain ? ' · ' + b.domain : '') + (b.match_rule ? ' — совпадение: ' + (RULE[b.match_rule] || b.match_rule) : '') }),
          h('span', { class: 'adm-sub', text: b.rating != null ? '★ ' + b.rating + (b.reviews != null ? ' · ' + b.reviews : '') : '' })
        ]));
      });
      box.appendChild(ol);
      if ((q.sources || []).length) box.appendChild(h('div', { class: 'adm-tags' }, q.sources.slice(0, 20).map(function (s) { return h('span', { text: s.domain }); })));
      if ((q.fan_out_queries || []).length) box.appendChild(h('p', { class: 'adm-sub', text: 'Подзапросы ChatGPT: ' + q.fan_out_queries.join(' · ') }));
      var meta = [q.answered_at && 'ответ от ' + q.answered_at, q.check_url && h('a', { href: q.check_url, target: '_blank', rel: 'noopener', text: 'проверить ответ' })].filter(Boolean);
      if (meta.length) box.appendChild(h('p', { class: 'adm-sub' }, meta.map(function (m) { return typeof m === 'string' ? m + ' ' : m; })));
      box.appendChild(h('details', {}, [h('summary', { text: 'Полный ответ ChatGPT' }), h('div', { class: 'adm-md', html: q.answer_html || '' })]));
    }
    return box;
  }

  async function loadCheck(id) {
    var box = $('[data-check-card]');
    box.textContent = 'Загрузка…';
    var r = await api('GET', '/checks/' + id);
    box.textContent = '';
    if (!r.ok) { box.appendChild(h('p', { class: 'adm-error', text: r.data.message || 'Не найдено' })); return; }
    var c = r.data.check;
    box.appendChild(h('div', { class: 'adm-box' }, [
      h('div', { class: 'adm-actions' }, [h('h1', { text: c.business_name || c.website_domain }), c.is_test ? pill('тест', 'test') : null]),
      h('p', { class: 'adm-sub', text: c.website_domain + ' · ' + dt(c.created_at) }),
      h('div', { class: 'adm-actions', style: 'margin-top:10px' }, [
        h('button', { class: 'btn btn--ghost', type: 'button', text: 'Скопировать ссылку на результат', onclick: function () { copy(c.result_url, 'Ссылка'); } }),
        h('a', { class: 'btn btn--ghost', href: c.result_url + '?preview=1', target: '_blank', rel: 'noopener', text: 'Открыть результат' })
      ])
    ]));
    box.appendChild(checkBlock(c));
  }

  /* ---------- Checks list with timings ---------- */
  async function loadChecks() {
    var r = await api('GET', '/checks');
    var s = r.data.stats || {};
    $('[data-check-stats]').textContent = 'Медиана всей проверки: ' + (s.median_total_s != null ? s.median_total_s.toFixed(1) + ' с' : '—') + ' (по ' + (s.sample || 0) + ' последним без кэша) · Расход сегодня: $' + Number(s.spent_today_usd || 0).toFixed(3) + ' из $' + s.budget_usd;
    var t = $('[data-checks]');
    t.textContent = '';
    t.appendChild(h('tr', {}, ['Время', 'Сайт', 'Статус', 'Итог', 'Разбор', 'Запрос 1', 'Запрос 2', 'Запрос 3', 'Всего', '$', 'Ошибка'].map(function (x) { return h('th', { text: x }); })));
    (r.data.checks || []).forEach(function (c) {
      var qs = c.queries || [];
      var cell = function (i) { var q = qs[i]; return h('td', { class: 'num', text: q ? (q.status === 'done' ? sec(q.ms) : (CHECK_STATUS[q.status] || q.status)) : '' }); };
      var tr = h('tr', { class: 'is-click' }, [
        h('td', { text: dt(c.created_at) }),
        h('td', {}, [h('b', { text: c.website_domain }), c.is_test ? ' ' : null, c.is_test ? pill('тест', 'test') : null, c.cache_of ? ' ' : null, c.cache_of ? pill('кэш', 'sent') : null, c.lead_id ? ' ' : null, c.lead_id ? pill('заявка', 'new') : null]),
        h('td', {}, [pill(CHECK_STATUS[c.status] || c.status, c.status === 'done' ? 'done' : c.status === 'failed' ? 'failed' : c.status === 'partial' ? 'partial' : 'sent')]),
        h('td', { text: c.mentions_count == null ? '' : c.mentions_count + ' из ' + c.total_answers + ' · ' + (VERDICT[c.verdict] || '') }),
        h('td', { class: 'num', text: sec(c.parse_ms) }), cell(0), cell(1), cell(2),
        h('td', { class: 'num', text: sec(c.total_ms) }),
        h('td', { class: 'num', text: money(c.cost_usd) }),
        h('td', { class: 'wrap', text: c.error || (qs.find(function (q) { return q.error; }) || {}).error || '' })
      ]);
      tr.addEventListener('click', function () { location.hash = 'check=' + c.id; });
      t.appendChild(tr);
    });
  }

  $('[data-test-form]').addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = e.target, out = $('[data-test-result]');
    out.textContent = 'Запускаю…';
    var r = await api('POST', '/test-check', { website: f.website.value, service: f.service.value, city_state: f.city_state.value });
    if (!r.ok) { out.textContent = r.data.message || 'Ошибка'; return; }
    out.textContent = '';
    out.appendChild(h('span', { text: 'Запущена. ' }));
    out.appendChild(h('a', { href: r.data.result_url + '?preview=1', target: '_blank', rel: 'noopener', text: 'Открыть результат' }));
    out.appendChild(h('span', { text: ' · ' }));
    out.appendChild(h('a', { href: '#check=' + r.data.check_id, text: 'карточка проверки' }));
    setTimeout(loadChecks, 1500);
  });

  /* ---------- Events ---------- */
  async function loadEvents() {
    var r = await api('GET', '/events');
    var t = $('[data-events]');
    t.textContent = '';
    t.appendChild(h('tr', {}, ['Время', 'Уровень', 'Тип', 'Сообщение', 'Проверка'].map(function (x) { return h('th', { text: x }); })));
    (r.data.events || []).forEach(function (e) {
      t.appendChild(h('tr', {}, [
        h('td', { text: dt(e.created_at) }),
        h('td', {}, [pill(e.level, e.level === 'error' ? 'error' : e.level === 'warn' ? 'warn' : 'sent')]),
        h('td', { text: e.kind }),
        h('td', { class: 'wrap', text: e.message }),
        h('td', {}, [e.check_id ? h('a', { href: '#check=' + e.check_id, text: e.check_id.slice(0, 8) }) : null])
      ]));
    });
  }

  /* ---------- Settings ---------- */
  async function loadSettings() {
    var r = await api('GET', '/settings');
    var f = $('[data-settings-form]');
    f.overrides.value = JSON.stringify(r.data.overrides || {}, null, 2);
    $('[data-settings-effective]').textContent = JSON.stringify(r.data.effective, null, 2);
    $('[data-settings-msg]').textContent = r.data.updated_at ? 'Изменено ' + dt(r.data.updated_at) : 'Используются значения по умолчанию';
  }
  $('[data-settings-form]').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msg = $('[data-settings-msg]');
    var value;
    try { value = JSON.parse(e.target.overrides.value || '{}'); } catch (err) { msg.textContent = 'Это не JSON: ' + err.message; return; }
    var r = await api('PUT', '/settings', { overrides: value });
    msg.textContent = r.ok ? 'Сохранено' : (r.data.message || 'Ошибка');
    if (r.ok) $('[data-settings-effective]').textContent = JSON.stringify(r.data.effective, null, 2);
  });

  /* ---------- Start ---------- */
  api('GET', '/me').then(function (r) { if (r.ok) route(); }).catch(function () { /* login shown */ });
})();

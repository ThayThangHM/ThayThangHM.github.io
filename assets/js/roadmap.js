// Roadmap Đội tuyển Tin — vẽ sơ đồ từ dữ liệu trong assets/data/competitive-roadmap.js.
// Sửa nội dung (chủ đề, quan hệ, bài tập, link) ở file dữ liệu; file này chỉ lo giao diện.
(function () {
  'use strict';

  var data = window.COMPETITIVE_ROADMAP;
  var root = document.getElementById('roadmap');
  if (!data || !root) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var PRIORITY = { core: 'Cần thiết', recommended: 'Nên học', optional: 'Nâng cao (tuỳ chọn)' };
  var STATUS = [['todo', 'Chưa học'], ['doing', 'Đang học'], ['done', 'Đã học']];
  var RES_TYPE = { slide: 'Slide', doc: 'Tài liệu', video: 'Video', oj: 'Online Judge' };

  /* ---------- Chuẩn hoá dữ liệu ---------- */
  var byId = {};
  function indexOf(list) { var m = {}; list.forEach(function (x) { m[x.id] = x; }); return m; }
  var stageById = indexOf(data.stages), catById = indexOf(data.categories), levelById = indexOf(data.levels);

  var nodes = data.nodes.map(function (n) {
    var c = {};
    Object.keys(n).forEach(function (k) { c[k] = n[k]; });
    c.priority = c.priority || 'core';
    ['prerequisites', 'objectives', 'topics', 'nextTopics', 'resources', 'problems'].forEach(function (k) { c[k] = c[k] || []; });
    c.next = [];
    byId[c.id] = c;
    return c;
  });
  nodes.forEach(function (n) {
    n.prerequisites = n.prerequisites.filter(function (p) {
      if (byId[p]) return true;
      console.warn('[roadmap] "' + n.id + '" cần biết trước "' + p + '" nhưng không có chủ đề này');
      return false;
    });
    n.prerequisites.forEach(function (p) { byId[p].next.push(n.id); });
  });
  nodes.forEach(function (n) {
    n.nextTopics.forEach(function (t) { if (byId[t] && n.next.indexOf(t) < 0) n.next.push(t); });
  });

  /* ---------- Tiến độ học ----------
     Hiện lưu trên trình duyệt (localStorage). Sau này có tài khoản/backend thì chỉ cần thay
     hai hàm load() và save() của Progress; phần còn lại chỉ gọi Progress.get / Progress.set. */
  var Progress = (function () {
    var KEY = 'ttRoadmapProgress.v1', map = {};
    function load() {
      try { map = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { map = {}; }
    }
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (e) { /* không lưu được: chỉ giữ trong trang */ }
    }
    load();
    return {
      get: function (id) { return map[id] === 'doing' || map[id] === 'done' ? map[id] : 'todo'; },
      set: function (id, status) {
        if (status === 'todo') delete map[id]; else map[id] = status;
        save();
      }
    };
  })();

  /* ---------- Tiện ích DOM ---------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function $(id) { return document.getElementById(id); }
  function dot(levelId) {
    var d = el('span', 'rm-dot');
    d.style.setProperty('--lv', 'var(--lv-' + levelId + ')');
    d.setAttribute('aria-hidden', 'true');
    return d;
  }
  function chip(n) {
    var b = el('button', 'rm-chip');
    b.type = 'button';
    b.appendChild(dot(n.level));
    b.appendChild(document.createTextNode(n.shortTitle || n.title));
    b.addEventListener('click', function () { openNode(n.id); });
    return b;
  }

  var state = { grade: 'all', cat: 'all', selected: null, hover: null };
  var nodeEls = {}, stageEls = {}, edgeEls = [];
  var map = $('rm-map'), svg, drawer = $('rm-drawer'), backdrop = $('rm-backdrop');
  var narrow = window.matchMedia('(max-width: 899px)');

  /* ---------- Bạn đang ở đâu? ---------- */
  function stageNodes(sid) { return nodes.filter(function (n) { return n.grade === sid; }); }
  function doneCount(list) { return list.filter(function (n) { return Progress.get(n.id) === 'done'; }).length; }

  function renderJourney() {
    var ol = $('rm-journey');
    ol.textContent = '';
    data.stages.forEach(function (s) {
      var list = stageNodes(s.id), done = doneCount(list);
      var li = el('li'), b = el('button', 'rm-step');
      b.type = 'button';
      b.appendChild(el('span', 'rm-step-label', s.label));
      b.appendChild(el('span', 'rm-step-name', s.name));
      b.appendChild(el('span', 'rm-step-count', 'Đã học ' + done + '/' + list.length + ' chủ đề'));
      var bar = el('span', 'rm-bar'), fill = el('span');
      fill.style.width = (list.length ? Math.round(done * 100 / list.length) : 0) + '%';
      bar.appendChild(fill);
      b.appendChild(bar);
      b.addEventListener('click', function () { goToStage(s.id); });
      li.appendChild(b);
      ol.appendChild(li);
    });
  }

  // Gợi ý: chủ đề chưa học mà mọi kiến thức cần biết trước đã học xong (ưu tiên đang học, rồi cần thiết).
  function renderSuggest() {
    var box = $('rm-suggest');
    box.textContent = '';
    var rank = { core: 0, recommended: 1, optional: 2 };
    var ready = nodes.filter(function (n) {
      return Progress.get(n.id) !== 'done' && n.prerequisites.every(function (p) { return Progress.get(p) === 'done'; });
    }).map(function (n, i) { return { n: n, i: i }; }).sort(function (a, b) {
      var da = Progress.get(a.n.id) === 'doing' ? 0 : 1, db = Progress.get(b.n.id) === 'doing' ? 0 : 1;
      return da - db || rank[a.n.priority] - rank[b.n.priority] || a.i - b.i;
    }).slice(0, 6);
    if (!ready.length) {
      box.appendChild(el('span', 'rm-suggest-label', '🎉 Em đã đánh dấu học xong toàn bộ roadmap.'));
      return;
    }
    box.appendChild(el('span', 'rm-suggest-label', 'Nên học tiếp:'));
    ready.forEach(function (r) { box.appendChild(chip(r.n)); });
  }

  /* ---------- Bộ lọc ---------- */
  var GRADE_TABS = [['all', 'Tất cả']].concat(data.stages.filter(function (s) { return s.id !== 'chuyen'; })
    .map(function (s) { return [s.id, s.label]; })).concat([['hsg', 'HSG'], ['chuyen', 'Chuyên']]);
  var CAT_TABS = [['all', 'Tất cả']].concat(data.categories.map(function (c) { return [c.id, c.name]; }));

  function matchGrade(n) {
    if (state.grade === 'all') return true;
    if (state.grade === 'hsg') return n.level === 'hsg' || n.level === 'hsg-nc';
    if (state.grade === 'chuyen') return n.level === 'chuyen';
    return n.grade === state.grade;
  }
  function matchCat(n) { return state.cat === 'all' || n.category === state.cat; }

  function tabRow(label, tabs, key) {
    var row = el('div', 'rm-filter-row');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', label);
    row.appendChild(el('span', 'rm-filter-name', label));
    tabs.forEach(function (t) {
      var b = el('button', 'rm-tab', t[1]);
      b.type = 'button';
      b.dataset.key = key;
      b.dataset.value = t[0];
      b.setAttribute('aria-pressed', String(state[key] === t[0]));
      b.addEventListener('click', function () { setFilter(key, t[0]); });
      row.appendChild(b);
    });
    return row;
  }
  function renderFilters() {
    var box = $('rm-filters');
    box.appendChild(tabRow('Giai đoạn', GRADE_TABS, 'grade'));
    box.appendChild(tabRow('Nhánh', CAT_TABS, 'cat'));
    var res = el('p', 'rm-result');
    res.id = 'rm-result';
    res.setAttribute('aria-live', 'polite');
    box.appendChild(res);
  }
  function setFilter(key, value) {
    state[key] = value;
    root.querySelectorAll('.rm-tab').forEach(function (b) {
      b.setAttribute('aria-pressed', String(state[b.dataset.key] === b.dataset.value));
    });
    applyFilter();
  }

  // Chủ đề khớp bộ lọc hiện đầy đủ; kiến thức cần biết trước trực tiếp của chúng hiện mờ; còn lại ẩn.
  function applyFilter() {
    var filtering = state.grade !== 'all' || state.cat !== 'all';
    var match = {}, ghost = {}, nMatch = 0, nGhost = 0;
    nodes.forEach(function (n) { if (matchGrade(n) && matchCat(n)) { match[n.id] = true; nMatch++; } });
    if (filtering) {
      nodes.forEach(function (n) {
        if (match[n.id]) n.prerequisites.forEach(function (p) { if (!match[p] && !ghost[p]) { ghost[p] = true; nGhost++; } });
      });
    }
    nodes.forEach(function (n) {
      var b = nodeEls[n.id];
      b.hidden = !(match[n.id] || ghost[n.id]);
      b.classList.toggle('is-ghost', !!ghost[n.id]);
    });
    data.stages.forEach(function (s) {
      var sec = stageEls[s.id], any = false;
      sec.querySelectorAll('.rm-cell').forEach(function (cell) {
        var has = !!cell.querySelector('.rm-node:not([hidden])');
        cell.classList.toggle('is-empty', !has);
        any = any || has;
      });
      sec.hidden = !any;
    });
    $('rm-result').textContent = filtering
      ? 'Đang hiện ' + nMatch + ' chủ đề' + (nGhost ? ' và ' + nGhost + ' kiến thức cần biết trước (ô mờ).' : '.')
      : 'Đang hiện toàn bộ ' + nMatch + ' chủ đề. Bấm vào một ô để xem chi tiết.';
    drawEdges();
  }

  /* ---------- Sơ đồ ---------- */
  function renderMap() {
    var tracks = el('div', 'rm-tracks');
    tracks.setAttribute('aria-hidden', 'true');
    data.categories.forEach(function (c) { tracks.appendChild(el('div', null, c.name)); });
    map.appendChild(tracks);

    svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'rm-edges');
    svg.setAttribute('aria-hidden', 'true');
    map.appendChild(svg);

    data.stages.forEach(function (s, i) {
      var sec = el('section', 'rm-stage');
      sec.id = 'giai-doan-' + s.id;
      sec.tabIndex = -1;
      sec.setAttribute('aria-labelledby', 'rm-stage-title-' + s.id);

      var head = el('div', 'rm-stage-head');
      head.appendChild(el('span', 'rm-stage-label', 'Giai đoạn ' + (i + 1) + ' · ' + s.label));
      var h = el('h3', 'rm-stage-title', s.name);
      h.id = 'rm-stage-title-' + s.id;
      head.appendChild(h);
      head.appendChild(el('p', 'rm-stage-goal', s.goal));
      var tools = el('div', 'rm-stage-tools');
      var count = el('span', 'rm-stage-count');
      var all = el('button', 'rm-linkbtn');
      all.type = 'button';
      all.addEventListener('click', function () {
        var list = stageNodes(s.id), allDone = doneCount(list) === list.length;
        list.forEach(function (n) { Progress.set(n.id, allDone ? 'todo' : 'done'); });
        refreshProgress();
      });
      tools.appendChild(count);
      tools.appendChild(all);
      head.appendChild(tools);
      sec.appendChild(head);

      var grid = el('div', 'rm-grid');
      data.categories.forEach(function (c) {
        var cell = el('div', 'rm-cell');
        cell.appendChild(el('span', 'rm-cell-label', c.name));
        nodes.forEach(function (n) {
          if (n.grade !== s.id || n.category !== c.id) return;
          var b = el('button', 'rm-node');
          b.type = 'button';
          b.dataset.id = n.id;
          b.appendChild(dot(n.level));
          b.appendChild(el('span', 'rm-node-title', n.shortTitle || n.title));
          var mark = el('span', 'rm-node-mark');
          mark.setAttribute('aria-hidden', 'true');
          b.appendChild(mark);
          b.addEventListener('click', function () { openNode(n.id); });
          b.addEventListener('mouseenter', function () { setHover(n.id); });
          b.addEventListener('mouseleave', function () { setHover(null); });
          b.addEventListener('focus', function () { setHover(n.id); });
          b.addEventListener('blur', function () { setHover(null); });
          nodeEls[n.id] = b;
          cell.appendChild(b);
        });
        grid.appendChild(cell);
      });
      sec.appendChild(grid);
      stageEls[s.id] = sec;
      map.appendChild(sec);
    });
  }

  function refreshProgress() {
    nodes.forEach(function (n) {
      var b = nodeEls[n.id], st = Progress.get(n.id);
      b.classList.toggle('is-optional', n.priority === 'optional');
      b.classList.toggle('is-doing', st === 'doing');
      b.classList.toggle('is-done', st === 'done');
      b.querySelector('.rm-node-mark').textContent = st === 'done' ? '✓' : st === 'doing' ? '…' : '';
      var label = (n.title || n.shortTitle) + ' — ' + levelById[n.level].name + ', ' + PRIORITY[n.priority];
      if (st !== 'todo') label += ', ' + (st === 'done' ? 'đã học' : 'đang học');
      b.setAttribute('aria-label', label);
    });
    data.stages.forEach(function (s) {
      var list = stageNodes(s.id), done = doneCount(list), sec = stageEls[s.id];
      sec.querySelector('.rm-stage-count').textContent = 'Đã học ' + done + '/' + list.length;
      sec.querySelector('.rm-linkbtn').textContent = done === list.length ? 'Bỏ đánh dấu cả giai đoạn' : 'Đánh dấu đã học cả giai đoạn';
    });
    renderJourney();
    renderSuggest();
    if (state.selected) renderStatus(byId[state.selected]);
  }

  /* ---------- Đường nối ---------- */
  function listView() { return narrow.matches && !root.classList.contains('rm-view-canvas'); }

  function marker(defs, id, cls) {
    var m = document.createElementNS(SVG_NS, 'marker');
    m.setAttribute('id', id);
    m.setAttribute('viewBox', '0 0 10 10');
    m.setAttribute('refX', '9');
    m.setAttribute('refY', '5');
    m.setAttribute('markerWidth', '7');
    m.setAttribute('markerHeight', '7');
    m.setAttribute('orient', 'auto-start-reverse');
    var p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', 'M0 0L10 5L0 10z');
    p.setAttribute('class', cls);
    m.appendChild(p);
    defs.appendChild(m);
  }

  var drawQueued = false;
  function queueDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(function () { drawQueued = false; drawEdges(); });
  }

  function drawEdges() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    edgeEls = [];
    if (listView()) return;

    var base = map.getBoundingClientRect();
    svg.setAttribute('width', map.scrollWidth);
    svg.setAttribute('height', map.scrollHeight);
    var defs = document.createElementNS(SVG_NS, 'defs');
    marker(defs, 'rm-arrow', 'rm-arrowhead');
    marker(defs, 'rm-arrow-pre', 'rm-arrowhead rm-arrowhead--pre');
    marker(defs, 'rm-arrow-next', 'rm-arrowhead rm-arrowhead--next');
    svg.appendChild(defs);

    var rect = {}, shown = [];
    nodes.forEach(function (n) {
      var b = nodeEls[n.id];
      if (b.hidden || !b.offsetParent) return;
      var r = b.getBoundingClientRect();
      rect[n.id] = { l: r.left - base.left, r: r.right - base.left, t: r.top - base.top, b: r.bottom - base.top,
                     cx: (r.left + r.right) / 2 - base.left, cy: (r.top + r.bottom) / 2 - base.top };
      shown.push(n.id);
    });

    nodes.forEach(function (n) {
      var t = rect[n.id];
      if (!t) return;
      n.prerequisites.forEach(function (p) {
        var s = rect[p];
        if (!s) return;
        var d, blocked = false, sameCol = Math.abs(s.cx - t.cx) < 8;
        if (t.t >= s.b + 4) {
          // Đích ở dưới. Cùng cột mà có ô khác chắn giữa → đi vòng theo mép phải cột.
          blocked = sameCol && shown.some(function (id) {
            var o = rect[id];
            return id !== n.id && id !== p && Math.abs(o.cx - s.cx) < 8 && o.t > s.b && o.b < t.t;
          });
          if (blocked) {
            var x = Math.max(s.r, t.r) + 9;
            d = 'M' + s.r + ' ' + s.cy + 'C' + x + ' ' + s.cy + ' ' + x + ' ' + s.cy + ' ' + x + ' ' + (s.cy + 12) +
                'L' + x + ' ' + (t.cy - 12) + 'C' + x + ' ' + t.cy + ' ' + x + ' ' + t.cy + ' ' + (t.r + 1) + ' ' + t.cy;
          } else {
            var my = (s.b + t.t) / 2;
            d = 'M' + s.cx + ' ' + s.b + 'C' + s.cx + ' ' + my + ' ' + t.cx + ' ' + my + ' ' + t.cx + ' ' + (t.t - 1);
          }
        } else {
          // Đích ngang hàng hoặc cao hơn (khác cột): nối cạnh bên.
          var right = t.cx > s.cx;
          var x1 = right ? s.r : s.l, x2 = right ? t.l - 1 : t.r + 1, mx = (x1 + x2) / 2;
          d = 'M' + x1 + ' ' + s.cy + 'C' + mx + ' ' + s.cy + ' ' + mx + ' ' + t.cy + ' ' + x2 + ' ' + t.cy;
        }
        var path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', 'rm-edge');
        svg.appendChild(path);
        // Đường nối xa (khác giai đoạn, khác cột hoặc phải đi vòng) chỉ hiện khi trỏ / chọn ô, để sơ đồ không rối
        edgeEls.push({ from: p, to: n.id, el: path, far: byId[p].grade !== n.grade && (!sameCol || blocked) });
      });
    });
    highlight();
  }

  // Làm nổi đường nối của ô đang chọn / đang trỏ: nét liền = cần biết trước, nét đứt = học tiếp.
  function highlight() {
    var hot = state.hover || state.selected;
    map.classList.toggle('has-hot', !!hot);
    edgeEls.forEach(function (e) {
      var pre = e.to === hot, next = e.from === hot;
      e.el.setAttribute('class', 'rm-edge' + (pre ? ' is-pre' : next ? ' is-next' : e.far ? ' is-far' : ''));
      e.el.setAttribute('marker-end', 'url(#' + (pre ? 'rm-arrow-pre' : next ? 'rm-arrow-next' : 'rm-arrow') + ')');
      if (pre || next) svg.appendChild(e.el);   // đưa lên trên cùng
    });
    var sel = state.selected && byId[state.selected];
    map.classList.toggle('has-selection', !!sel);
    nodes.forEach(function (n) {
      var b = nodeEls[n.id];
      b.classList.toggle('is-selected', !!sel && n.id === sel.id);
      b.classList.toggle('is-rel-pre', !!sel && sel.prerequisites.indexOf(n.id) >= 0);
      b.classList.toggle('is-rel-next', !!sel && sel.next.indexOf(n.id) >= 0);
    });
  }
  function setHover(id) {
    if (state.hover === id) return;
    state.hover = id;
    highlight();
  }

  /* ---------- Bảng chi tiết ---------- */
  function section(body, title) {
    body.appendChild(el('h3', 'rm-h3', title));
  }
  function bullets(body, title, items) {
    if (!items.length) return;
    section(body, title);
    var ul = el('ul', 'rm-list');
    items.forEach(function (t) { ul.appendChild(el('li', null, t)); });
    body.appendChild(ul);
  }
  function chips(body, title, ids, emptyText) {
    section(body, title);
    if (!ids.length) { body.appendChild(el('p', 'rm-empty', emptyText)); return; }
    var box = el('div', 'rm-chips');
    ids.forEach(function (id) { box.appendChild(chip(byId[id])); });
    body.appendChild(box);
  }
  function links(body, title, items, emptyText, tagOf) {
    section(body, title);
    var real = items.filter(function (x) { return x && x.title; });
    if (!real.length) { body.appendChild(el('p', 'rm-empty', emptyText)); return; }
    var ul = el('ul', 'rm-links');
    real.forEach(function (x) {
      var li = el('li');
      if (x.url) {
        var a = el('a', null, x.title);
        a.href = x.url;
        if (/^https?:/.test(x.url)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        li.appendChild(a);
      } else {
        li.appendChild(el('span', null, x.title));
      }
      var tag = tagOf(x);
      if (tag) li.appendChild(el('span', 'rm-tag', tag));
      ul.appendChild(li);
    });
    body.appendChild(ul);
  }

  function renderStatus(n) {
    var box = $('rm-status');
    if (!box) return;
    box.textContent = '';
    var cur = Progress.get(n.id);
    STATUS.forEach(function (s) {
      var b = el('button', 'rm-tab', s[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(cur === s[0]));
      b.addEventListener('click', function () { Progress.set(n.id, s[0]); refreshProgress(); });
      box.appendChild(b);
    });
    box.appendChild(el('span', 'rm-status-note', 'Tiến độ được lưu trên trình duyệt này.'));
  }

  function openNode(id, opts) {
    var n = byId[id];
    if (!n) return;
    opts = opts || {};
    // Ô đang bị bộ lọc ẩn → bỏ lọc để thấy được nó trên sơ đồ
    if (nodeEls[id].hidden) { state.grade = 'all'; setFilter('cat', 'all'); }
    state.selected = id;

    $('rm-drawer-title').textContent = n.title || n.shortTitle;
    var body = $('rm-drawer-body');
    body.textContent = '';
    body.scrollTop = 0;

    var badges = el('div', 'rm-badges');
    [stageById[n.grade].label, null, catById[n.category].name, PRIORITY[n.priority]].forEach(function (t, i) {
      var b = el('span', 'rm-badge');
      if (i === 1) { b.appendChild(dot(n.level)); b.appendChild(document.createTextNode(levelById[n.level].name)); }
      else b.textContent = t;
      badges.appendChild(b);
    });
    body.appendChild(badges);
    if (n.description) body.appendChild(el('p', 'rm-desc', n.description));

    var status = el('div', 'rm-status');
    status.id = 'rm-status';
    status.setAttribute('role', 'group');
    status.setAttribute('aria-label', 'Trạng thái học');
    body.appendChild(status);
    renderStatus(n);

    chips(body, 'Cần biết trước', n.prerequisites, 'Không cần — đây là điểm bắt đầu.');
    bullets(body, 'Mục tiêu', n.objectives);
    bullets(body, 'Cần thành thạo', n.topics);
    chips(body, 'Học tiếp', n.next, 'Đây là chặng cuối của nhánh này.');
    links(body, 'Tài liệu', n.resources, 'Đang cập nhật slide và tài liệu.', function (x) { return RES_TYPE[x.type] || ''; });
    links(body, 'Bài luyện tập', n.problems, 'Sẽ bổ sung link bài tập / Online Judge.', function (x) { return x.difficulty || ''; });

    drawer.hidden = false;
    backdrop.hidden = false;
    document.body.classList.add('rm-open');
    if (!opts.keepHash && location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    highlight();
    if (!listView() || opts.scroll) nodeEls[id].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    $('rm-drawer-title').focus({ preventScroll: true });
  }

  function closeNode() {
    if (!state.selected) return;
    var id = state.selected;
    state.selected = null;
    drawer.hidden = true;
    backdrop.hidden = true;
    document.body.classList.remove('rm-open');
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    highlight();
    if (nodeEls[id] && !nodeEls[id].hidden) nodeEls[id].focus({ preventScroll: true });
  }

  function goToStage(sid) {
    if (stageEls[sid].hidden) { state.cat = 'all'; setFilter('grade', 'all'); }
    stageEls[sid].scrollIntoView({ behavior: 'smooth', block: 'start' });
    stageEls[sid].focus({ preventScroll: true });
  }

  /* ---------- Khởi tạo ---------- */
  renderFilters();
  renderMap();
  refreshProgress();
  applyFilter();

  $('rm-close').addEventListener('click', closeNode);
  backdrop.addEventListener('click', closeNode);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNode(); });

  // Màn hình hẹp: đổi giữa "Danh sách" và "Sơ đồ" (cuộn ngang trong khung)
  root.querySelectorAll('[data-view]').forEach(function (b) {
    b.addEventListener('click', function () {
      root.classList.toggle('rm-view-canvas', b.dataset.view === 'canvas');
      root.querySelectorAll('[data-view]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      drawEdges();
    });
  });

  // Kích thước sơ đồ đổi (xoay máy, mở bảng chi tiết, đổi cỡ chữ) → vẽ lại đường nối
  if (window.ResizeObserver) new ResizeObserver(queueDraw).observe(map);
  window.addEventListener('resize', queueDraw);
  window.addEventListener('load', queueDraw);

  // Link trực tiếp tới một chủ đề: /doi-tuyen/#prefix-sum
  function fromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (byId[id]) openNode(id, { keepHash: true, scroll: true });
    else if (stageEls[id.replace('giai-doan-', '')]) goToStage(id.replace('giai-doan-', ''));
  }
  window.addEventListener('hashchange', fromHash);
  if (location.hash) fromHash();
})();

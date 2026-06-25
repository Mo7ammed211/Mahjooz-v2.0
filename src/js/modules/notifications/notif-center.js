/* ═══════════════════════════════════════════════════════════════
   محجوز — Notification Center  مركز الإشعارات
   Full-page notification history: search · filter · date groups
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── State ─────────────────────────────────────────────────── */
  const NC = {
    items:       [],
    filter:      'all',
    search:      '',
    loading:     false,
    selectedIds: new Set(),
  };

  const ROLE_SOURCES = {
    admin:    ['live', 'notif', 'driver'],
    staff:    ['live', 'notif'],
    vendor:   ['live', 'notif'],
    provider: ['live', 'notif'],
    driver:   ['driver', 'notif'],
    customer: ['notif'],
  };

  function _role()    { return (typeof State !== 'undefined' ? State : null)?.currentUser?.role || 'customer'; }
  function _sources() { return ROLE_SOURCES[_role()] || ['notif']; }

  /* ── Helpers ───────────────────────────────────────────────── */
  function _esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }

  function _fmtFull(ts) {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
      if (!d) return '';
      return d.toLocaleString('ar-YE', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch (e) { return ''; }
  }

  function _groupLabel(ts) {
    if (!ts) return 'أقدم';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - d) / 86400000);
    if (diff === 0) return 'اليوم';
    if (diff === 1) return 'الأمس';
    if (diff <= 7)  return 'هذا الأسبوع';
    if (diff <= 30) return 'هذا الشهر';
    return 'أقدم من ذلك';
  }

  const TYPE_MAP = {
    info:    { icon:'💬', color:'#0ea5e9' },
    success: { icon:'✅', color:'#10b981' },
    warning: { icon:'⚠️', color:'#f59e0b' },
    danger:  { icon:'🚨', color:'#ef4444' },
    order:   { icon:'📦', color:'#7c3aed' },
    payment: { icon:'💰', color:'#10b981' },
  };

  /* ── Data Loading ──────────────────────────────────────────── */
  async function _load() {
    const u = (typeof State !== 'undefined' ? State : null)?.currentUser;
    if (!u) return [];

    const sources = _sources();
    const all = [];

    /* Personal notifications (Firestore) */
    if (sources.includes('notif')) {
      try {
        const snap = await Promise.race([
          db.collection('user_notifications')
            .where('uid', '==', u.uid)
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get(),
          new Promise(r => setTimeout(() => r({ docs: [] }), 5000)),
        ]);
        (snap.docs || []).forEach(d => {
          const data = d.data() || {};
          all.push({
            id: d.id, source: data.source || 'notif',
            icon:  data.icon || TYPE_MAP[data.type]?.icon  || '🔔',
            color: TYPE_MAP[data.type]?.color || '#6b7280',
            title: data.title || '',
            body:  data.body  || '',
            time:  _fmtFull(data.createdAt),
            createdAt: data.createdAt,
            read: !!data.read,
            link: data.link || null,
            type: data.type || 'info',
            // حقول الإجراء الجديدة (Task #54)
            actionType:  data.actionType  || null,
            actionLabel: data.actionLabel || null,
            actionUrl:   data.actionUrl   || null,
            sortMs: data.createdAt?.toMillis?.() || 0,
          });
        });
      } catch (e) { console.warn('[NC] notif load error:', e); }
    }

    /* Live alerts (PH19.feed) */
    if (sources.includes('live') && window.PH19?.feed?.length) {
      window.PH19.feed.forEach((item, i) => {
        all.push({
          id: 'live_' + i, source: 'live',
          icon: item.icon || '🛎️', color: '#7c3aed',
          title: item.title || '', body: item.sub || '',
          time: item.time || '', createdAt: null,
          read: true, link: item.nav || null, type: 'live',
          sortMs: Date.now() - i * 60000,
        });
      });
    }

    /* Driver alerts (DA.feed) */
    if (sources.includes('driver') && window.DA?.feed?.length) {
      window.DA.feed.forEach((item, i) => {
        all.push({
          id: 'driver_' + i, source: 'driver',
          icon: item.icon || '🚚', color: '#0d9488',
          title: item.title || '', body: item.sub || '',
          time: item.time || '', createdAt: null,
          read: true, link: null, type: 'driver',
          sortMs: Date.now() - i * 60000,
        });
      });
    }

    all.sort((a, b) => b.sortMs - a.sortMs);
    return all;
  }

  /* ── Filter & Group ────────────────────────────────────────── */
  function _filtered() {
    return NC.items.filter(item => {
      if (NC.filter !== 'all' && item.source !== NC.filter) return false;
      if (NC.search) {
        const q = NC.search.toLowerCase();
        if (!(item.title + ' ' + item.body).toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  const GROUP_ORDER = ['اليوم', 'الأمس', 'هذا الأسبوع', 'هذا الشهر', 'أقدم من ذلك'];
  function _grouped(items) {
    const map = new Map();
    items.forEach(item => {
      const lbl = item.createdAt ? _groupLabel(item.createdAt) : 'أقدم من ذلك';
      if (!map.has(lbl)) map.set(lbl, []);
      map.get(lbl).push(item);
    });
    return GROUP_ORDER.filter(l => map.has(l)).map(l => ({ label: l, items: map.get(l) }));
  }

  /* ── Item HTML ─────────────────────────────────────────────── */
  const SOURCE_LABEL = { notif:'📨 شخصي', live:'🛎️ تنبيه مباشر', driver:'🚚 توصيل', broadcast:'📣 جماعي' };

  function _itemHtml(item) {
    const sel = NC.selectedIds.has(item.id);
    const isBroadcast = item.source === 'broadcast';
    const hasAction   = item.actionLabel && item.actionUrl && item.actionLabel !== 'null' && item.actionUrl !== 'null';
    return `
    <div class="nc-item${item.read ? '' : ' nc-unread'}${sel ? ' nc-sel' : ''}${isBroadcast ? ' nc-source-broadcast' : ''}"
         id="nc-item-${_esc(item.id)}"
         onclick="ncClick('${_esc(item.id)}','${_esc(item.link||'')}','${_esc(item.source)}')">
      <div class="nc-chk-wrap" onclick="event.stopPropagation();ncToggle('${_esc(item.id)}')">
        <div class="nc-chk${sel?' nc-chk-on':''}">${sel?'✓':''}</div>
      </div>
      <div class="nc-ico" style="background:${item.color}1a;color:${item.color}">${item.icon}</div>
      <div class="nc-body">
        <div class="nc-row1">
          <span class="nc-item-title">${_esc(item.title)}</span>
          ${!item.read ? '<span class="nc-badge-dot"></span>' : ''}
        </div>
        ${item.body ? `<div class="nc-item-body">${_esc(item.body)}</div>` : ''}
        ${hasAction ? `
          <button class="nc-action-btn" onclick="event.stopPropagation();
            typeof ph54_handleAction==='function'
              ? ph54_handleAction('${_esc(item.actionType||'url')}','${_esc(item.actionUrl)}')
              : window.open('${_esc(item.actionUrl)}','_blank')"
          >${_esc(item.actionLabel)} →</button>` : ''}
        <div class="nc-meta" style="margin-top:${hasAction?'8':'0'}px">
          <span class="nc-meta-time">🕐 ${item.time||'—'}</span>
          <span class="nc-meta-src">${SOURCE_LABEL[item.source]||''}</span>
          ${isBroadcast ? '<span class="nc-broadcast-badge">📣 إعلان</span>' : ''}
          ${item.link&&item.link!=='null' ? '<span class="nc-meta-nav">انقر للانتقال ←</span>' : ''}
        </div>
      </div>
    </div>`;
  }

  /* ── List HTML ─────────────────────────────────────────────── */
  function _listHtml() {
    const items = _filtered();
    if (NC.loading) return `
      <div class="nc-state">
        <div class="nc-spinner"></div>
        <span>جاري تحميل الإشعارات…</span>
      </div>`;
    if (!items.length) return `
      <div class="nc-state">
        <div style="font-size:60px;opacity:.4">🔕</div>
        <div class="nc-state-title">${NC.search ? 'لا توجد نتائج' : 'لا توجد إشعارات'}</div>
        <div class="nc-state-sub">${NC.search
          ? `لم يُعثر على إشعارات تحتوي على "<strong>${_esc(NC.search)}</strong>"`
          : 'ستظهر إشعاراتك هنا فور وصولها'}</div>
        ${NC.search ? `<button class="nc-btn-ghost" onclick="ncClearSearch()">مسح البحث</button>` : ''}
      </div>`;
    return _grouped(items).map(g => `
      <div class="nc-group">
        <div class="nc-group-lbl">${g.label}<span class="nc-group-cnt">${g.items.length}</span></div>
        ${g.items.map(_itemHtml).join('')}
      </div>`).join('');
  }

  /* ── Stats ─────────────────────────────────────────────────── */
  function _stats() {
    const unread  = NC.items.filter(i => i.source==='notif' && !i.read).length;
    const today   = NC.items.filter(i => {
      if (!i.createdAt) return false;
      const d = i.createdAt.toDate ? i.createdAt.toDate() : new Date(i.createdAt);
      const n = new Date();
      return d.getDate()===n.getDate() && d.getMonth()===n.getMonth();
    }).length;
    const visible = _filtered().length;
    return { total: NC.items.length, unread, today, visible };
  }

  /* ── Page HTML ─────────────────────────────────────────────── */
  function _pageHtml() {
    const sources = _sources();
    const s  = _stats();
    const hasTabs = sources.length > 1;

    const TABS = [
      { id:'all',    icon:'🔔', label:'الكل' },
      { id:'live',   icon:'🛎️', label:'حيّة' },
      { id:'notif',  icon:'📨', label:'شخصية' },
      { id:'driver', icon:'🚚', label:'توصيل' },
    ].filter(t => t.id==='all' || sources.includes(t.id));

    return `
    <div class="nc-page" id="nc-page">

      <!-- ═══ HEADER ═══ -->
      <div class="nc-hdr">
        <div class="nc-hdr-top">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <button class="nc-back" onclick="history.back()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              رجوع
            </button>
            <h1 class="nc-ttl">🔔 مركز الإشعارات</h1>
          </div>
          <div class="nc-hdr-acts" id="nc-hdr-acts">
            ${s.unread > 0 ? `<button class="nc-btn-ghost" onclick="ncMarkAll()">✓ الكل كمقروء <span class="nc-count-badge">${s.unread}</span></button>` : ''}
            ${NC.selectedIds.size > 0 ? `<button class="nc-btn-red" onclick="ncDeleteSel()">🗑️ حذف <span class="nc-count-badge">${NC.selectedIds.size}</span></button>` : ''}
          </div>
        </div>

        <!-- Stats row -->
        <div class="nc-stats-row" id="nc-stats-row">
          <div class="nc-stat"><div class="nc-stat-n">${s.total}</div><div class="nc-stat-l">إجمالي</div></div>
          <div class="nc-stat nc-stat-red"><div class="nc-stat-n">${s.unread}</div><div class="nc-stat-l">غير مقروء</div></div>
          <div class="nc-stat"><div class="nc-stat-n">${s.today}</div><div class="nc-stat-l">اليوم</div></div>
          <div class="nc-stat nc-stat-dim"><div class="nc-stat-n">${s.visible}</div><div class="nc-stat-l">يظهر الآن</div></div>
        </div>

        <!-- Search -->
        <div class="nc-srch-row">
          <div class="nc-srch-box">
            <span class="nc-srch-ic">🔍</span>
            <input class="nc-srch-inp" id="nc-srch-inp"
              placeholder="ابحث في الإشعارات بالعنوان أو المحتوى…"
              value="${_esc(NC.search)}"
              oninput="ncSearch(this.value)"
              onkeydown="if(event.key==='Escape')ncClearSearch()">
            ${NC.search ? `<button class="nc-srch-clr" onclick="ncClearSearch()">✕</button>` : ''}
          </div>
        </div>

        <!-- Filter tabs -->
        ${hasTabs ? `
        <div class="nc-tabs-row" id="nc-tabs-row">
          ${TABS.map(t => {
            const cnt = t.id==='all' ? NC.items.length : NC.items.filter(i=>i.source===t.id).length;
            return `<button class="nc-tab${NC.filter===t.id?' nc-tab-on':''}" onclick="ncFilter('${t.id}')">
              ${t.icon} ${t.label}
              ${cnt ? `<span class="nc-tab-cnt">${cnt}</span>` : ''}
            </button>`;
          }).join('')}
        </div>` : ''}
      </div>

      <!-- ═══ CONTENT ═══ -->
      <div id="nc-list">${_listHtml()}</div>

    </div>`;
  }

  /* ── DOM updaters ──────────────────────────────────────────── */
  function _refreshList() {
    const el = document.getElementById('nc-list');
    if (el) el.innerHTML = _listHtml();
  }

  function _refreshStats() {
    const s = _stats();
    const el = document.getElementById('nc-stats-row');
    if (el) el.innerHTML = `
      <div class="nc-stat"><div class="nc-stat-n">${s.total}</div><div class="nc-stat-l">إجمالي</div></div>
      <div class="nc-stat nc-stat-red"><div class="nc-stat-n">${s.unread}</div><div class="nc-stat-l">غير مقروء</div></div>
      <div class="nc-stat"><div class="nc-stat-n">${s.today}</div><div class="nc-stat-l">اليوم</div></div>
      <div class="nc-stat nc-stat-dim"><div class="nc-stat-n">${s.visible}</div><div class="nc-stat-l">يظهر الآن</div></div>`;
  }

  function _refreshActions() {
    const s = _stats();
    const el = document.getElementById('nc-hdr-acts');
    if (el) el.innerHTML = `
      ${s.unread > 0 ? `<button class="nc-btn-ghost" onclick="ncMarkAll()">✓ الكل كمقروء <span class="nc-count-badge">${s.unread}</span></button>` : ''}
      ${NC.selectedIds.size > 0 ? `<button class="nc-btn-red" onclick="ncDeleteSel()">🗑️ حذف <span class="nc-count-badge">${NC.selectedIds.size}</span></button>` : ''}`;
  }

  /* ── Global handlers ───────────────────────────────────────── */
  window.ncFilter = function (f) {
    NC.filter = f;
    document.querySelectorAll('.nc-tab').forEach(b => b.classList.toggle('nc-tab-on', b.getAttribute('onclick')===`ncFilter('${f}')`));
    _refreshList(); _refreshStats();
  };

  window.ncSearch = function (q) {
    NC.search = q || '';
    _refreshList(); _refreshStats();
    const clr = document.querySelector('.nc-srch-clr');
    const box = document.querySelector('.nc-srch-box');
    if (NC.search && !clr && box) {
      const btn = document.createElement('button');
      btn.className = 'nc-srch-clr'; btn.textContent = '✕';
      btn.onclick = () => ncClearSearch();
      box.appendChild(btn);
    } else if (!NC.search && clr) { clr.remove(); }
  };

  window.ncClearSearch = function () {
    NC.search = '';
    const inp = document.getElementById('nc-srch-inp');
    if (inp) inp.value = '';
    document.querySelector('.nc-srch-clr')?.remove();
    _refreshList(); _refreshStats();
  };

  window.ncClick = async function (id, link, source) {
    if (source === 'notif') {
      try {
        await db.collection('user_notifications').doc(id).update({ read: true });
        const item = NC.items.find(i => i.id === id);
        if (item) {
          item.read = true;
          document.getElementById('nc-item-' + id)?.classList.remove('nc-unread');
          document.querySelector(`#nc-item-${id} .nc-badge-dot`)?.remove();
          window.__unifiedNotif?.update('notif',
            NC.items.filter(i => i.source==='notif'),
            NC.items.filter(i => i.source==='notif' && !i.read).length);
          _refreshStats(); _refreshActions();
        }
      } catch (e) { console.warn('[NC] mark read:', e); }
    }
    if (link && link !== '' && link !== 'null') {
      const [page, pj] = link.split('?');
      let params = {};
      if (pj) try { params = JSON.parse(decodeURIComponent(pj)); } catch (_) {}
      navigate(page, params);
    }
  };

  window.ncToggle = function (id) {
    NC.selectedIds.has(id) ? NC.selectedIds.delete(id) : NC.selectedIds.add(id);
    const el = document.getElementById('nc-item-' + id);
    el?.classList.toggle('nc-sel', NC.selectedIds.has(id));
    const chk = el?.querySelector('.nc-chk');
    if (chk) { chk.classList.toggle('nc-chk-on', NC.selectedIds.has(id)); chk.textContent = NC.selectedIds.has(id) ? '✓' : ''; }
    _refreshActions();
  };

  window.ncMarkAll = async function () {
    const unread = NC.items.filter(i => i.source==='notif' && !i.read);
    if (!unread.length) return;
    await Promise.all(unread.map(n =>
      db.collection('user_notifications').doc(n.id).update({ read: true }).catch(() => {})));
    unread.forEach(n => { n.read = true; });
    window.__unifiedNotif?.update('notif', NC.items.filter(i=>i.source==='notif'), 0);
    _refreshList(); _refreshStats(); _refreshActions();
  };

  window.ncDeleteSel = async function () {
    const ids = [...NC.selectedIds];
    if (!ids.length) return;
    if (!confirm(`هل تريد حذف ${ids.length} إشعار؟`)) return;
    await Promise.all(ids
      .filter(id => !id.startsWith('live_') && !id.startsWith('driver_'))
      .map(id => db.collection('user_notifications').doc(id).delete().catch(() => {})));
    NC.items = NC.items.filter(i => !NC.selectedIds.has(i.id));
    NC.selectedIds.clear();
    window.__unifiedNotif?.update('notif',
      NC.items.filter(i=>i.source==='notif'),
      NC.items.filter(i=>i.source==='notif' && !i.read).length);
    _refreshList(); _refreshStats(); _refreshActions();
  };

  /* ── Register page ─────────────────────────────────────────── */
  window.ExtraPages = window.ExtraPages || {};
  window.ExtraPages['notifications'] = function () {
    NC.filter = 'all'; NC.search = ''; NC.selectedIds.clear();
    NC.loading = true; NC.items = [];

    // Load data after paint
    setTimeout(async () => {
      NC.items = await _load();
      NC.loading = false;
      _refreshList(); _refreshStats(); _refreshActions();
    }, 0);

    return _pageHtml();
  };

  /* ── CSS ────────────────────────────────────────────────────── */
  const s = document.createElement('style');
  s.id = 'nc-css';
  s.textContent = `
  .nc-page { max-width:800px; margin:0 auto; padding:20px 16px 80px; font-family:'Cairo','Tajawal',sans-serif; direction:rtl; }

  /* ── Header ── */
  .nc-hdr {
    background:var(--bg-card,#1e293b);
    border:1.5px solid var(--border,rgba(255,255,255,0.08));
    border-radius:20px; padding:20px 20px 0; margin-bottom:16px;
    box-shadow:0 4px 24px rgba(0,0,0,.15);
  }
  .nc-hdr-top { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:16px; }
  .nc-ttl { margin:0; font-size:22px; font-weight:900; color:var(--text-main,#f1f5f9); }
  .nc-back {
    display:flex; align-items:center; gap:5px;
    background:var(--bg-hover,rgba(255,255,255,0.06));
    border:1.5px solid var(--border,rgba(255,255,255,0.1));
    color:var(--text-secondary,#94a3b8); border-radius:10px;
    padding:7px 13px; font-family:'Cairo',sans-serif; font-size:13px; font-weight:700; cursor:pointer; transition:all .18s;
  }
  .nc-back:hover { background:var(--bg-secondary,rgba(255,255,255,0.12)); color:var(--text-main,#f1f5f9); }
  .nc-hdr-acts { display:flex; gap:8px; flex-wrap:wrap; }

  /* ── Action buttons ── */
  .nc-btn-ghost,.nc-btn-red {
    display:inline-flex; align-items:center; gap:6px;
    padding:7px 14px; border-radius:10px; font-family:'Cairo',sans-serif;
    font-size:12px; font-weight:800; cursor:pointer; transition:all .18s; white-space:nowrap;
  }
  .nc-btn-ghost { background:rgba(124,58,237,.1); border:1.5px solid rgba(124,58,237,.3); color:#a78bfa; }
  .nc-btn-ghost:hover { background:rgba(124,58,237,.2); }
  .nc-btn-red { background:rgba(239,68,68,.1); border:1.5px solid rgba(239,68,68,.3); color:#f87171; }
  .nc-btn-red:hover { background:rgba(239,68,68,.2); }
  .nc-count-badge {
    background:rgba(255,255,255,.15); border-radius:99px;
    padding:1px 7px; font-size:11px; font-weight:900;
  }

  /* ── Stats row ── */
  .nc-stats-row {
    display:flex; gap:0; margin:0 -20px;
    border-top:1.5px solid var(--border,rgba(255,255,255,0.07));
    border-bottom:1.5px solid var(--border,rgba(255,255,255,0.07));
  }
  .nc-stat { flex:1; text-align:center; padding:13px 8px; border-left:1.5px solid var(--border,rgba(255,255,255,0.06)); }
  .nc-stat:last-child { border-left:none; }
  .nc-stat-n { font-size:22px; font-weight:900; color:var(--text-main,#f1f5f9); line-height:1; }
  .nc-stat-l { font-size:10px; color:var(--text-muted,#64748b); margin-top:4px; font-weight:700; }
  .nc-stat-red .nc-stat-n { color:#f87171; }
  .nc-stat-dim .nc-stat-n { color:#a78bfa; }

  /* ── Search ── */
  .nc-srch-row { padding:12px 0 0; }
  .nc-srch-box { position:relative; display:flex; align-items:center; gap:8px; }
  .nc-srch-ic  { font-size:16px; flex-shrink:0; }
  .nc-srch-inp {
    flex:1; background:var(--bg-main,rgba(0,0,0,0.2));
    border:1.5px solid var(--border,rgba(255,255,255,0.08));
    border-radius:12px; padding:10px 16px; color:var(--text-main,#f1f5f9);
    font-family:'Cairo',sans-serif; font-size:14px; direction:rtl; outline:none; transition:border-color .18s;
  }
  .nc-srch-inp:focus { border-color:rgba(124,58,237,.5); box-shadow:0 0 0 3px rgba(124,58,237,.1); }
  .nc-srch-inp::placeholder { color:var(--text-muted,#64748b); }
  .nc-srch-clr {
    position:absolute; left:10px; background:none; border:none; cursor:pointer;
    color:var(--text-muted,#64748b); font-size:14px; padding:4px 6px; border-radius:6px; transition:color .18s;
  }
  .nc-srch-clr:hover { color:var(--text-main,#f1f5f9); }

  /* ── Tabs ── */
  .nc-tabs-row { display:flex; gap:4px; overflow-x:auto; scrollbar-width:none; padding:10px 0 14px; }
  .nc-tabs-row::-webkit-scrollbar { display:none; }
  .nc-tab {
    display:flex; align-items:center; gap:5px; flex-shrink:0;
    padding:6px 14px; border-radius:20px;
    border:1.5px solid var(--border,rgba(255,255,255,0.08));
    background:var(--bg-hover,rgba(255,255,255,0.04));
    color:var(--text-secondary,#94a3b8);
    font-family:'Cairo',sans-serif; font-size:12px; font-weight:700;
    cursor:pointer; transition:all .18s;
  }
  .nc-tab:hover { background:var(--bg-secondary,rgba(255,255,255,.1)); color:var(--text-main,#f1f5f9); }
  .nc-tab-on { background:rgba(124,58,237,.15)!important; border-color:rgba(124,58,237,.5)!important; color:#a78bfa!important; }
  .nc-tab-cnt { background:rgba(124,58,237,.3); color:#c4b5fd; border-radius:99px; font-size:10px; font-weight:900; padding:1px 7px; }
  .nc-tab-on .nc-tab-cnt { background:rgba(124,58,237,.5); }

  /* ── Group ── */
  .nc-group { margin-bottom:4px; }
  .nc-group-lbl {
    padding:14px 4px 8px; font-size:12px; font-weight:900;
    color:var(--text-muted,#64748b); display:flex; align-items:center; gap:8px; letter-spacing:.5px;
  }
  .nc-group-cnt {
    background:var(--bg-hover,rgba(255,255,255,.08)); color:var(--text-secondary,#94a3b8);
    border-radius:99px; font-size:10px; font-weight:900; padding:1px 8px;
  }

  /* ── Item ── */
  .nc-item {
    display:flex; align-items:flex-start; gap:12px;
    padding:14px 16px; border-radius:14px; margin-bottom:6px;
    background:var(--bg-card,#1e293b);
    border:1.5px solid var(--border,rgba(255,255,255,0.06));
    cursor:pointer; transition:all .2s;
    box-shadow:0 2px 8px rgba(0,0,0,.08);
  }
  .nc-item:hover { background:var(--bg-hover,rgba(255,255,255,0.04)); border-color:rgba(124,58,237,.25); transform:translateY(-1px); box-shadow:0 6px 20px rgba(0,0,0,.15); }
  .nc-unread { background:rgba(14,165,233,.04)!important; border-color:rgba(14,165,233,.2)!important; }
  .nc-sel   { background:rgba(124,58,237,.08)!important; border-color:rgba(124,58,237,.4)!important; }

  /* Checkbox */
  .nc-chk-wrap { flex-shrink:0; padding-top:2px; opacity:0; transition:opacity .18s; }
  .nc-item:hover .nc-chk-wrap, .nc-sel .nc-chk-wrap { opacity:1; }
  .nc-chk {
    width:18px; height:18px; border-radius:5px;
    border:2px solid var(--border,rgba(255,255,255,.2));
    display:flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:900; transition:all .18s; cursor:pointer;
  }
  .nc-chk-on { background:#7c3aed; border-color:#7c3aed; color:#fff; }

  /* Icon */
  .nc-ico {
    width:44px; height:44px; border-radius:12px; flex-shrink:0;
    display:flex; align-items:center; justify-content:center; font-size:22px;
  }

  /* Body */
  .nc-body { flex:1; min-width:0; }
  .nc-row1 { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
  .nc-item-title { font-size:14px; font-weight:800; color:var(--text-main,#f1f5f9); line-height:1.3; flex:1; min-width:0; }
  .nc-badge-dot { width:8px; height:8px; border-radius:50%; background:#0ea5e9; flex-shrink:0; box-shadow:0 0 6px rgba(14,165,233,.6); }
  .nc-item-body { font-size:13px; color:var(--text-secondary,#94a3b8); line-height:1.5; margin-bottom:6px; }
  .nc-meta { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .nc-meta-time { font-size:11px; color:var(--text-muted,#64748b); }
  .nc-meta-src { font-size:10px; font-weight:800; background:var(--bg-hover,rgba(255,255,255,.07)); color:var(--text-secondary,#94a3b8); border-radius:99px; padding:2px 8px; }
  .nc-meta-nav { font-size:11px; color:#a78bfa; font-weight:700; }

  /* ── Empty / Loading ── */
  .nc-state { text-align:center; padding:80px 20px; color:var(--text-muted,#64748b); font-size:14px; }
  .nc-state-title { font-size:18px; font-weight:900; color:var(--text-main,#f1f5f9); margin:12px 0 6px; }
  .nc-state-sub { margin-bottom:20px; line-height:1.7; }
  .nc-spinner {
    width:40px; height:40px; border-radius:50%; margin:0 auto 16px;
    border:3px solid var(--border,rgba(255,255,255,.1)); border-top-color:#7c3aed;
    animation:nc-spin .7s linear infinite;
  }
  @keyframes nc-spin { to { transform:rotate(360deg); } }

  /* ── Mobile ── */
  @media(max-width:600px){
    .nc-page { padding:10px 10px 70px; }
    .nc-hdr { padding:14px 14px 0; }
    .nc-ttl { font-size:18px; }
    .nc-stats-row { margin:0 -14px; }
    .nc-stat { padding:10px 4px; }
    .nc-stat-n { font-size:18px; }
    .nc-item { padding:12px; gap:10px; }
    .nc-ico { width:36px; height:36px; font-size:18px; border-radius:10px; }
    .nc-item-title { font-size:13px; }
  }
  `;
  document.head.appendChild(s);

  console.log('[NotifCenter] مركز الإشعارات جاهز 🔔');
})();

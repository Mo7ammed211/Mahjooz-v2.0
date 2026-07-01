/* ═══════════════════════════════════════════════════════════════
   محجوز — Unified Notification Bell  جرس الإشعارات الموحد
   v3.0 — Fixed filters, show-more, + separate error log icon
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Source definitions ─────────────────────────────────────── */
  const SOURCES = {
    live:     { label: 'تنبيهات حيّة',   color: '#7c3aed', gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)', icon: '🛎️', items: [], count: 0 },
    notif:    { label: 'إشعاراتي',        color: '#0ea5e9', gradient: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', icon: '📨', items: [], count: 0 },
    driver:   { label: 'طلبات التوصيل',  color: '#0d9488', gradient: 'linear-gradient(135deg,#0d9488,#34d399)', icon: '🚚', items: [], count: 0 },
    wallet:   { label: 'تنبيهات مالية',  color: '#f59e0b', gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)', icon: '💰', items: [], count: 0 },
    vendor:   { label: 'طلباتي',          color: '#10b981', gradient: 'linear-gradient(135deg,#10b981,#6ee7b7)', icon: '🏪', items: [], count: 0 },
    errors:   { label: 'أخطاء تقنية',    color: '#ef4444', gradient: 'linear-gradient(135deg,#ef4444,#f87171)', icon: '🚨', items: [], count: 0 },
    activity: { label: 'نشاط المنصة',    color: '#a78bfa', gradient: 'linear-gradient(135deg,#a78bfa,#c4b5fd)', icon: '📋', items: [], count: 0 },
  };

  /* ── Role → relevant sources ───────────────────────────────── */
  const ROLE_SOURCES = {
    admin:    ['live', 'notif', 'driver', 'wallet', 'errors', 'activity'],
    staff:    ['live', 'notif', 'wallet', 'errors', 'activity'],
    vendor:   ['vendor', 'notif'],
    provider: ['vendor', 'notif'],
    driver:   ['driver', 'notif'],
    customer: ['notif'],
  };

  function _getRoleSources() {
    const role = (typeof State !== 'undefined' ? State : null)?.currentUser?.role || 'customer';
    return ROLE_SOURCES[role] || ['notif'];
  }

  /* ── Error logs storage ────────────────────────────────────── */
  const _errorLog = [];
  const MAX_ERROR_LOG = 50;

  /* ── Active filter state ────────────────────────────────────── */
  let _activeFilter = 'all';
  let _panelOpen = false;

  /* ── Public API ─────────────────────────────────────────────── */
  window.__unifiedNotif = {
    update(sourceId, items, count) {
      if (!SOURCES[sourceId]) return;
      SOURCES[sourceId].items = items || [];
      SOURCES[sourceId].count = Math.max(0, count || 0);
      _updateBadge();
      if (_panelOpen) _renderPanelBody();
    },
    logError(title, detail) {
      _errorLog.unshift({ title: title || 'خطأ تقني', detail: detail || '', ts: Date.now() });
      if (_errorLog.length > MAX_ERROR_LOG) _errorLog.pop();
      _updateErrorBadge();
    },
  };

  /* ── Filter API (global, bound to window so onclick= works) ── */
  window.setUBFilter = function (filterId) {
    const allowed = _getRoleSources();
    if (filterId !== 'all' && !allowed.includes(filterId)) return;
    _activeFilter = filterId;
    // Update tab active state WITHOUT full re-render
    document.querySelectorAll('.ub-filter-tab').forEach(btn => {
      const isMatch = btn.dataset.filterId === filterId;
      btn.classList.toggle('ub-filter-active', isMatch);
    });
    _renderPanelBody();
  };

  /* ── Badge helpers ──────────────────────────────────────────── */
  function _relevantCount() {
    return _getRoleSources()
      .filter(id => id !== 'errors') // errors are shown in separate icon
      .reduce((a, id) => a + (SOURCES[id].count || 0), 0);
  }

  function _updateBadge() {
    const badge = document.getElementById('unified-bell-badge');
    if (!badge) return;
    const total = _relevantCount();
    badge.textContent = total > 99 ? '99+' : String(total);
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
  }

  function _updateErrorBadge() {
    const badge = document.getElementById('ub-error-badge');
    if (!badge) return;
    const cnt = _errorLog.length;
    badge.textContent = cnt > 99 ? '99+' : String(cnt);
    badge.style.display = cnt > 0 ? 'inline-flex' : 'none';
  }

  /* ── Escape helper ──────────────────────────────────────────── */
  function _esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  /* ── Time formatter ─────────────────────────────────────────── */
  function _fmtTime(ts) {
    if (!ts) return '';
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      const diff = Math.floor((Date.now() - d) / 60000);
      if (diff < 1)    return 'الآن';
      if (diff < 60)   return `منذ ${diff} دقيقة`;
      if (diff < 1440) return `منذ ${Math.floor(diff / 60)} ساعة`;
      return `منذ ${Math.floor(diff / 1440)} يوم`;
    } catch { return ''; }
  }

  /* ── Item renderer ──────────────────────────────────────────── */
  function _renderItem(item, sourceId) {
    const src = SOURCES[sourceId] || {};
    const nav = _esc(item.nav || item.link || '');
    const isUnread = !item.read || item.unread;
    const timeStr = item.time || (item.createdAt ? _fmtTime(item.createdAt) : '');

    let onclickAttr = '';
    if (sourceId === 'notif') {
      onclickAttr = `onclick="window.onNotifClick?.('${_esc(item.id)}',${item.link ? `'${_esc(item.link)}'` : 'null'});toggleUnifiedNotif()" style="cursor:pointer"`;
    } else if (nav) {
      onclickAttr = `onclick="navigate('${nav}');toggleUnifiedNotif()" style="cursor:pointer"`;
    }

    return `
    <div class="ub-item ${isUnread ? 'ub-unread' : ''}" ${onclickAttr}>
      <div class="ub-item-icon-wrap" style="background:${src.gradient || src.color}22">
        <span class="ub-item-icon">${item.icon || src.icon || '🔔'}</span>
      </div>
      <div class="ub-item-body">
        <div class="ub-item-title">${_esc(item.title || '')}</div>
        ${item.sub || item.body ? `<div class="ub-item-sub">${_esc(item.sub || item.body)}</div>` : ''}
        <div class="ub-item-meta">
          <span class="ub-item-time">${_esc(timeStr)}</span>
          ${nav ? `<span class="ub-item-nav-hint">← اضغط للانتقال</span>` : ''}
        </div>
      </div>
      ${isUnread ? `<div class="ub-unread-dot" style="background:${src.color}"></div>` : ''}
    </div>`;
  }

  /* ── Panel body only (items + empty state) ──────────────────── */
  function _renderPanelBody() {
    const bodyEl = document.getElementById('ub-body-container');
    if (!bodyEl) return;

    const roleSources = _getRoleSources().filter(id => id !== 'errors');
    const sourcesToShow = _activeFilter === 'all'
      ? roleSources.filter(id => SOURCES[id].items.length > 0)
      : (roleSources.includes(_activeFilter) ? [_activeFilter] : []);

    if (sourcesToShow.length === 0) {
      const totalItems = roleSources.reduce((a, id) => a + SOURCES[id].items.length, 0);
      bodyEl.innerHTML = `
      <div class="ub-empty">
        <div class="ub-empty-icon">🔕</div>
        <div class="ub-empty-title">${totalItems > 0 ? 'لا توجد إشعارات في هذا القسم' : 'لا توجد إشعارات'}</div>
        <div class="ub-empty-sub">ستظهر إشعاراتك هنا فور وصولها</div>
      </div>`;
      return;
    }

    const showSectionTitle = sourcesToShow.length > 1;
    bodyEl.innerHTML = `<div class="ub-body">
      ${sourcesToShow.map(id => {
        const src = SOURCES[id];
        const sliced = src.items.slice(0, 8);
        const extra = src.items.length - 8;
        return `
        <div class="ub-section">
          ${showSectionTitle ? `
          <div class="ub-section-hdr" style="border-right:3px solid ${src.color}">
            <span>${src.icon}</span>
            <span style="color:${src.color}">${src.label}</span>
            <span class="ub-section-cnt">${src.items.length}</span>
          </div>` : ''}
          ${sliced.map(item => _renderItem(item, id)).join('')}
          ${extra > 0 ? `
          <div class="ub-more" data-filter-id="${id}" onclick="setUBFilter('${id}')">
            + ${extra} إشعار آخر — اضغط للعرض
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }

  /* ── Full panel render (tabs + header + body) ───────────────── */
  function _renderPanel() {
    const panel = document.getElementById('unified-bell-panel');
    if (!panel) return;

    const roleSources = _getRoleSources().filter(id => id !== 'errors');
    const totalCount = roleSources.reduce((a, id) => a + (SOURCES[id].count || 0), 0);

    const hasUnreadNotif = roleSources.includes('notif') && (SOURCES.notif.items || []).some(n => !n.read);
    const hasUnreadWallet = roleSources.includes('wallet') && (SOURCES.wallet.items || []).some(i => i.unread);

    const showFilters = roleSources.length > 1;
    const filterTabsHtml = showFilters ? `
    <div class="ub-filters" id="ub-filters">
      <button class="ub-filter-tab ${_activeFilter === 'all' ? 'ub-filter-active' : ''}" data-filter-id="all" onclick="setUBFilter('all')">
        <span class="ub-ft-icon">🔔</span>
        <span class="ub-ft-label">الكل</span>
        ${totalCount > 0 ? `<span class="ub-ft-badge">${totalCount > 99 ? '99+' : totalCount}</span>` : ''}
      </button>
      ${roleSources.map(id => {
        const s = SOURCES[id];
        const cnt = s.count || 0;
        const isActive = _activeFilter === id;
        return `
        <button class="ub-filter-tab ${isActive ? 'ub-filter-active' : ''} ${!s.items.length ? 'ub-ft-empty' : ''}"
                data-filter-id="${id}"
                onclick="setUBFilter('${id}')"
                ${isActive ? `style="--ft-color:${s.color}"` : ''}>
          <span class="ub-ft-icon">${s.icon}</span>
          <span class="ub-ft-label">${s.label}</span>
          ${cnt > 0 ? `<span class="ub-ft-badge" style="background:${s.color}">${cnt > 99 ? '99+' : cnt}</span>` : ''}
        </button>`;
      }).join('')}
    </div>` : '';

    let markAllBtn = '';
    if (hasUnreadNotif) {
      markAllBtn = `<button class="ub-mark-all" onclick="markAllNotifsRead?.()">✓ تحديد الكل كمقروء</button>`;
    } else if (hasUnreadWallet) {
      markAllBtn = `<button class="ub-mark-all" onclick="wsecMarkAllAlerts?.()">✓ تحديد الكل كمقروء</button>`;
    }

    panel.innerHTML = `
      <div class="ub-header">
        <div class="ub-header-left">
          <div class="ub-header-icon">🔔</div>
          <div>
            <div class="ub-header-title">الإشعارات</div>
            ${totalCount > 0
              ? `<div class="ub-header-sub">${totalCount} إشعار غير مقروء</div>`
              : '<div class="ub-header-sub">لا توجد إشعارات جديدة</div>'}
          </div>
        </div>
        <div class="ub-header-actions">
          ${markAllBtn}
          <button class="ub-close-btn" onclick="toggleUnifiedNotif()" title="إغلاق">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      ${filterTabsHtml}
      <div id="ub-body-container"></div>
      <div class="ub-footer">
        <button class="ub-footer-btn" onclick="toggleUnifiedNotif();navigate('notifications')">
          <span>📋 مركز الإشعارات الكامل</span>
          <span class="ub-footer-arrow">←</span>
        </button>
      </div>`;

    // Render body separately so filters don't re-render the whole panel
    _renderPanelBody();
  }

  /* ── Error Log Panel ─────────────────────────────────────────── */
  function _renderErrorPanel() {
    const panel = document.getElementById('ub-error-panel');
    if (!panel) return;
    panel.innerHTML = `
      <div class="ub-header" style="background:linear-gradient(135deg,rgba(239,68,68,0.15),rgba(248,113,113,0.06));">
        <div class="ub-header-left">
          <div class="ub-header-icon" style="background:linear-gradient(135deg,#ef4444,#f87171)">🚨</div>
          <div>
            <div class="ub-header-title">سجل الأخطاء التقنية</div>
            <div class="ub-header-sub">${_errorLog.length} خطأ مسجّل</div>
          </div>
        </div>
        <div class="ub-header-actions">
          ${_errorLog.length > 0 ? `<button class="ub-mark-all" style="background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.3);color:#f87171" onclick="window.__clearErrorLog?.()">🗑️ مسح الكل</button>` : ''}
          <button class="ub-close-btn" onclick="toggleErrorPanel()" title="إغلاق">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="ub-body" style="max-height:380px">
        ${_errorLog.length === 0 ? `
        <div class="ub-empty">
          <div class="ub-empty-icon">✅</div>
          <div class="ub-empty-title">لا توجد أخطاء مسجلة</div>
          <div class="ub-empty-sub">كل شيء يعمل بشكل طبيعي</div>
        </div>` : _errorLog.map((e, i) => `
        <div class="ub-item ub-error-item" style="border-right:3px solid #ef4444">
          <div class="ub-item-icon-wrap" style="background:rgba(239,68,68,0.12);color:#ef4444">🚨</div>
          <div class="ub-item-body">
            <div class="ub-item-title" style="color:#fca5a5">${_esc(e.title)}</div>
            ${e.detail ? `<div class="ub-item-sub" style="-webkit-line-clamp:3">${_esc(e.detail)}</div>` : ''}
            <div class="ub-item-meta"><span class="ub-item-time">${_fmtTime(e.ts)}</span></div>
          </div>
          <button onclick="window.__dismissError?.(${i})" style="background:none;border:none;color:#64748b;cursor:pointer;padding:4px;font-size:14px;flex-shrink:0" title="إزالة">✕</button>
        </div>`).join('')}
      </div>`;
  }

  /* ── Bell injection ─────────────────────────────────────────── */
  function _ensureBell() {
    if (document.getElementById('unified-bell-wrap')) return;
    const target = document.getElementById('nav-notif-target');
    if (!target) return;

    const wrap = document.createElement('div');
    wrap.id = 'unified-bell-wrap';
    wrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px;position:relative';
    wrap.innerHTML = `
      <!-- Errors icon -->
      <div id="ub-error-wrap" style="position:relative;display:inline-flex;align-items:center">
        <button id="ub-error-btn" onclick="toggleErrorPanel(event)" title="سجل الأخطاء التقنية" aria-label="الأخطاء التقنية">
          <svg class="ub-bell-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span id="ub-error-badge" style="display:none;"></span>
        </button>
        <div id="ub-error-panel" class="ub-panel ub-error-panel-pos"></div>
      </div>

      <!-- Main notifications bell -->
      <div style="position:relative;display:inline-flex;align-items:center">
        <button id="unified-bell-btn" onclick="toggleUnifiedNotif(event)" title="الإشعارات" aria-label="الإشعارات">
          <svg class="ub-bell-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span id="unified-bell-badge" style="display:none;"></span>
        </button>
        <div id="unified-bell-panel" class="ub-panel"></div>
      </div>`;

    target.appendChild(wrap);
    _updateBadge();
    _updateErrorBadge();

    // Close panels on outside click
    document.addEventListener('click', e => {
      const mainWrap = document.getElementById('unified-bell-wrap');
      if (mainWrap && !mainWrap.contains(e.target)) {
        document.getElementById('unified-bell-panel')?.classList.remove('ub-open');
        document.getElementById('ub-error-panel')?.classList.remove('ub-open');
        _panelOpen = false;
      }
    });
  }

  /* ── Toggle main bell (global) ──────────────────────────────── */
  window.toggleUnifiedNotif = function (event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const panel = document.getElementById('unified-bell-panel');
    const errPanel = document.getElementById('ub-error-panel');
    if (!panel) return;

    const opening = !panel.classList.contains('ub-open');
    // Close error panel if open
    errPanel?.classList.remove('ub-open');

    panel.classList.toggle('ub-open', opening);
    _panelOpen = opening;
    if (opening) {
      _activeFilter = 'all';
      _renderPanel();
      // Reset counts
      _getRoleSources().filter(id => id !== 'errors').forEach(id => { SOURCES[id].count = 0; });
      _updateBadge();
    }
  };

  /* ── Toggle error panel (global) ────────────────────────────── */
  window.toggleErrorPanel = function (event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const panel = document.getElementById('ub-error-panel');
    const mainPanel = document.getElementById('unified-bell-panel');
    if (!panel) return;

    const opening = !panel.classList.contains('ub-open');
    // Close main panel if open
    mainPanel?.classList.remove('ub-open');
    _panelOpen = false;

    panel.classList.toggle('ub-open', opening);
    if (opening) _renderErrorPanel();
  };

  /* ── Error log helpers ───────────────────────────────────────── */
  window.__clearErrorLog = function () {
    _errorLog.length = 0;
    _updateErrorBadge();
    _renderErrorPanel();
  };
  window.__dismissError = function (idx) {
    _errorLog.splice(idx, 1);
    _updateErrorBadge();
    _renderErrorPanel();
  };

  /* ── Hook into render() ─────────────────────────────────────── */
  const _orig = window.render;
  window.render = async function (...args) {
    const result = typeof _orig === 'function' ? await _orig.apply(this, args) : undefined;
    setTimeout(_ensureBell, 80);
    return result;
  };

  document.addEventListener('DOMContentLoaded', () => setTimeout(_ensureBell, 600));

  /* ── Intercept console.error → error log for admin/staff ──── */
  const _origError = console.error;
  console.error = function (...args) {
    _origError.apply(console, args);
    const role = (typeof State !== 'undefined' ? State : null)?.currentUser?.role;
    if (role === 'admin' || role === 'staff') {
      const msg = args.map(a => (typeof a === 'object' ? (a?.message || JSON.stringify(a)) : String(a))).join(' ');
      window.__unifiedNotif.logError('خطأ تقني', msg.substring(0, 200));
    }
  };

  /* ── Styles ─────────────────────────────────────────────────── */
  const style = document.createElement('style');
  style.id = 'unified-bell-css';
  style.textContent = `
    /* ════ Bell Buttons ════ */
    #unified-bell-btn, #ub-error-btn {
      width: 40px; height: 40px; border-radius: 12px;
      background: var(--glass-bg, rgba(255,255,255,0.08));
      border: 1.5px solid var(--border, rgba(255,255,255,0.12));
      color: var(--text-main, #f1f5f9);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      position: relative; transition: all 0.2s;
      font-family: sans-serif;
    }
    #unified-bell-btn:hover {
      background: rgba(124,58,237,0.15);
      border-color: rgba(124,58,237,0.4);
      color: #a78bfa;
      transform: scale(1.05);
    }
    #ub-error-btn {
      border-color: rgba(239,68,68,0.2);
    }
    #ub-error-btn:hover {
      background: rgba(239,68,68,0.12);
      border-color: rgba(239,68,68,0.4);
      color: #f87171;
      transform: scale(1.05);
    }
    .ub-bell-svg {
      width: 18px; height: 18px; stroke: currentColor; flex-shrink: 0;
    }

    #unified-bell-badge, #ub-error-badge {
      position: absolute; top: -5px; right: -5px;
      color: #fff; border-radius: 99px;
      font-size: 9px; font-weight: 900;
      min-width: 18px; height: 18px;
      display: inline-flex;
      align-items: center; justify-content: center;
      padding: 0 4px; font-family: 'Cairo', sans-serif;
      line-height: 1; pointer-events: none;
      border: 2px solid var(--bg-main, #0f172a);
      animation: ubBadgePop 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    #unified-bell-badge {
      background: linear-gradient(135deg, #ef4444, #f87171);
      box-shadow: 0 2px 8px rgba(239,68,68,0.5);
    }
    #ub-error-badge {
      background: linear-gradient(135deg, #dc2626, #ef4444);
      box-shadow: 0 2px 8px rgba(220,38,38,0.5);
    }
    @keyframes ubBadgePop {
      from { transform: scale(0); opacity: 0; }
      to   { transform: scale(1); opacity: 1; }
    }

    /* ════ Panel ════ */
    .ub-panel {
      display: none; flex-direction: column;
      position: absolute; top: calc(100% + 12px); inset-inline-end: 0;
      width: 360px; max-height: 560px; overflow: hidden;
      background: var(--bg-card, #1e293b);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05);
      z-index: 9999; font-family: 'Cairo', sans-serif; direction: rtl;
      animation: ubSlideIn 0.25s cubic-bezier(0.22,1,0.36,1);
    }
    .ub-panel.ub-open { display: flex; }
    .ub-error-panel-pos { inset-inline-end: 0; }
    @keyframes ubSlideIn {
      from { opacity: 0; transform: translateY(-8px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* ════ Header ════ */
    .ub-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 16px 12px;
      background: linear-gradient(135deg, rgba(124,58,237,0.12), rgba(99,102,241,0.06));
      border-bottom: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0; border-radius: 20px 20px 0 0;
    }
    .ub-header-left { display: flex; align-items: center; gap: 10px; }
    .ub-header-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #7c3aed, #a78bfa);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(124,58,237,0.35);
    }
    .ub-header-title { font-weight: 900; font-size: 15px; color: var(--text-main, #f1f5f9); line-height: 1.2; }
    .ub-header-sub { font-size: 11px; color: var(--text-muted, #94a3b8); margin-top: 1px; }
    .ub-header-actions { display: flex; align-items: center; gap: 6px; }

    .ub-mark-all {
      background: rgba(124,58,237,0.12);
      border: 1px solid rgba(124,58,237,0.3);
      border-radius: 8px; color: #a78bfa;
      font-size: 11px; font-weight: 700; font-family: 'Cairo', sans-serif;
      padding: 5px 10px; cursor: pointer; transition: all 0.18s; white-space: nowrap;
    }
    .ub-mark-all:hover { background: rgba(124,58,237,0.25); }

    .ub-close-btn {
      width: 30px; height: 30px; border-radius: 8px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      color: var(--text-muted, #9ca3af);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.15s;
    }
    .ub-close-btn:hover { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.3); color: #f87171; }

    /* ════ Filter Tabs ════ */
    .ub-filters {
      display: flex; gap: 6px; padding: 10px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0; overflow-x: auto; scrollbar-width: thin;
      scrollbar-color: rgba(124,58,237,0.3) transparent;
    }
    .ub-filters::-webkit-scrollbar { height: 3px; }
    .ub-filters::-webkit-scrollbar-track { background: transparent; }
    .ub-filters::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.3); border-radius: 99px; }

    .ub-filter-tab {
      display: flex; align-items: center; gap: 5px;
      padding: 7px 14px; border-radius: 20px;
      border: 1.5px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.04);
      color: var(--text-secondary, #94a3b8);
      font-family: 'Cairo', sans-serif; font-size: 12px; font-weight: 700;
      cursor: pointer; white-space: nowrap;
      transition: all 0.18s; flex-shrink: 0;
    }
    .ub-filter-tab:hover { background: rgba(255,255,255,0.1); color: var(--text-main, #f1f5f9); }
    .ub-filter-tab.ub-ft-empty { opacity: 0.4; }
    .ub-filter-tab.ub-filter-active {
      background: rgba(124,58,237,0.18) !important;
      border-color: rgba(124,58,237,0.5) !important;
      color: #c4b5fd !important;
      box-shadow: 0 2px 10px rgba(124,58,237,0.2);
    }
    .ub-ft-icon  { font-size: 14px; }
    .ub-ft-label { font-size: 12px; }
    .ub-ft-badge {
      background: #ef4444; color: #fff; border-radius: 99px;
      font-size: 9px; font-weight: 900; min-width: 16px; height: 16px;
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0 4px; line-height: 1;
    }

    /* ════ Body & Items ════ */
    #ub-body-container { overflow-y: auto; flex: 1; }
    .ub-body { overflow-y: auto; flex: 1; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent; }
    .ub-body::-webkit-scrollbar { width: 4px; }
    .ub-body::-webkit-scrollbar-track { background: transparent; }
    .ub-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }

    .ub-section { border-bottom: 1px solid rgba(255,255,255,0.06); }
    .ub-section:last-child { border-bottom: none; }

    .ub-section-hdr {
      display: flex; align-items: center; gap: 7px;
      padding: 8px 14px 5px 14px;
      font-size: 11px; font-weight: 900; letter-spacing: 0.3px;
      color: var(--text-muted, #64748b);
    }
    .ub-section-cnt {
      margin-right: auto;
      background: rgba(255,255,255,0.08); color: var(--text-muted);
      border-radius: 99px; font-size: 10px; font-weight: 700; padding: 1px 7px;
    }

    .ub-item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 11px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      transition: background 0.15s; position: relative;
    }
    .ub-item:last-child { border-bottom: none; }
    .ub-item:hover { background: rgba(255,255,255,0.04); }
    .ub-item.ub-unread { background: rgba(14,165,233,0.05); }
    .ub-item.ub-unread:hover { background: rgba(14,165,233,0.09); }
    .ub-error-item:hover { background: rgba(239,68,68,0.04); }

    .ub-item-icon-wrap {
      width: 38px; height: 38px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 18px;
    }
    .ub-item-icon { line-height: 1; }

    .ub-item-body { flex: 1; min-width: 0; }
    .ub-item-title {
      font-size: 13px; font-weight: 700;
      color: var(--text-main, #f1f5f9); line-height: 1.3;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .ub-item-sub {
      font-size: 11.5px; color: var(--text-secondary, #94a3b8);
      margin-top: 2px; line-height: 1.45;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .ub-item-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
    .ub-item-time { font-size: 10px; color: var(--text-muted, #64748b); }
    .ub-item-nav-hint { font-size: 10px; color: #7c3aed; font-weight: 700; opacity: 0.7; }

    .ub-unread-dot {
      width: 8px; height: 8px; border-radius: 50%;
      flex-shrink: 0; margin-top: 5px; align-self: flex-start;
      box-shadow: 0 0 6px currentColor;
    }

    .ub-more {
      padding: 10px 14px; font-size: 12px; font-weight: 700;
      color: #a78bfa; text-align: center; cursor: pointer;
      background: rgba(124,58,237,0.05);
      transition: background 0.15s; border-top: 1px solid rgba(255,255,255,0.04);
    }
    .ub-more:hover { background: rgba(124,58,237,0.15); color: #c4b5fd; }

    /* ════ Empty ════ */
    .ub-empty { padding: 40px 20px; text-align: center; color: var(--text-muted, #9ca3af); }
    .ub-empty-icon { font-size: 44px; margin-bottom: 12px; opacity: 0.4; }
    .ub-empty-title { font-size: 14px; font-weight: 800; color: var(--text-secondary, #94a3b8); margin-bottom: 4px; }
    .ub-empty-sub { font-size: 12px; opacity: 0.7; }

    /* ════ Footer ════ */
    .ub-footer {
      padding: 10px 12px;
      border-top: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0; border-radius: 0 0 20px 20px;
      background: rgba(255,255,255,0.02);
    }
    .ub-footer-btn {
      width: 100%;
      background: linear-gradient(135deg, rgba(124,58,237,0.1), rgba(99,102,241,0.08));
      border: 1.5px solid rgba(124,58,237,0.25);
      border-radius: 12px; color: #c4b5fd;
      font-family: 'Cairo', sans-serif; font-size: 13px; font-weight: 800; cursor: pointer;
      padding: 10px 16px; display: flex; align-items: center; justify-content: space-between;
      transition: all 0.2s;
    }
    .ub-footer-btn:hover {
      background: linear-gradient(135deg, rgba(124,58,237,0.2), rgba(99,102,241,0.15));
      border-color: rgba(124,58,237,0.5); transform: translateY(-1px);
    }
    .ub-footer-arrow { font-size: 16px; font-weight: 900; opacity: 0.7; }

    /* ════ Hide old bells ════ */
    #da-bell,
    #notif-bell-wrap:not([data-in-nav]),
    .ph19-pill:not(.in-nav),
    .ph19-panel, #ph19-panel {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);

  /* ── Kill old bell ──────────────────────────────────────────── */
  (function _killOldBell() {
    function _remove() { document.getElementById('da-bell')?.remove(); }
    _remove();
    if (document.readyState !== 'complete') {
      document.addEventListener('DOMContentLoaded', _remove);
      window.addEventListener('load', _remove);
    }
    const obs = new MutationObserver(() => { if (document.getElementById('da-bell')) _remove(); });
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
  })();

  console.log('[UnifiedBell] جرس الإشعارات الموحد v3.0 جاهز 🔔');
})();

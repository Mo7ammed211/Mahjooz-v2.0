/* ================================================================
   item-alerts.js — نظام التنبيهات الاحترافية للمنتجات والخدمات
   Phase 48 — Mahjooz Platform
   ================================================================
   - شارات تنبيهية متحركة (كمية محدودة، عرض لفترة محدودة...)
   - حالات توفر احترافية (متاح، نفذت الكمية، موقوف...)
   - overlay "غير متاح" يمنع الطلب بشكل تلقائي
   - واجهة إدارة كاملة مضمنة في نموذج التعديل
   ================================================================ */

(function () {
  'use strict';

  /* ─────────────────── CSS ─────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `

  /* ══════════════════════════════════════════════════════════
     ALERT BADGE — الشارة التنبيهية العائمة
  ══════════════════════════════════════════════════════════ */
  .ia-badge {
    position: absolute;
    top: 10px;
    inset-inline-start: 10px;
    z-index: 12;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 800;
    font-family: var(--font, 'Cairo', sans-serif);
    letter-spacing: 0.3px;
    white-space: nowrap;
    max-width: calc(100% - 100px);
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: default;
    user-select: none;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15);
    transition: transform 0.2s ease;
    animation: ia-badge-enter 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
  }
  .ia-badge:hover { transform: scale(1.05); }

  @keyframes ia-badge-enter {
    from { opacity: 0; transform: translateY(-8px) scale(0.9); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* أنواع الشارات */
  .ia-badge-info    { background: linear-gradient(135deg,rgba(59,130,246,0.85),rgba(99,102,241,0.85)); color:#fff; border:1px solid rgba(99,102,241,0.4); }
  .ia-badge-warning { background: linear-gradient(135deg,rgba(245,158,11,0.9),rgba(239,68,68,0.8));  color:#fff; border:1px solid rgba(245,158,11,0.4); }
  .ia-badge-danger  { background: linear-gradient(135deg,rgba(239,68,68,0.9),rgba(220,38,38,0.85)); color:#fff; border:1px solid rgba(239,68,68,0.4); }
  .ia-badge-success { background: linear-gradient(135deg,rgba(16,185,129,0.9),rgba(5,150,105,0.85)); color:#fff; border:1px solid rgba(16,185,129,0.4); }
  .ia-badge-promo   {
    background: linear-gradient(135deg,rgba(251,191,36,0.95),rgba(245,158,11,0.95),rgba(239,68,68,0.85));
    color: #1a0a00;
    border: 1px solid rgba(251,191,36,0.5);
    box-shadow: 0 4px 24px rgba(245,158,11,0.4), inset 0 1px 0 rgba(255,255,255,0.3);
  }

  /* نبضة تنبيه للشارة */
  .ia-badge-warning::before,
  .ia-badge-danger::before {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: inherit;
    animation: ia-pulse-ring 2s ease-out infinite;
    opacity: 0;
  }
  .ia-badge-warning::before { background: rgba(245,158,11,0.3); }
  .ia-badge-danger::before  { background: rgba(239,68,68,0.3); }

  @keyframes ia-pulse-ring {
    0%   { opacity: 0.8; transform: scale(1); }
    100% { opacity: 0; transform: scale(1.4); }
  }

  .ia-badge-icon { font-size: 13px; flex-shrink: 0; }

  /* ══════════════════════════════════════════════════════════
     STOCK STATUS — حالة التوفر كبادج صغير
  ══════════════════════════════════════════════════════════ */
  .ia-stock-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 10.5px;
    font-weight: 700;
    font-family: var(--font, 'Cairo', sans-serif);
    white-space: nowrap;
  }
  .ia-stock-available  { background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.25); }
  .ia-stock-limited    { background:rgba(245,158,11,0.12); color:#f59e0b; border:1px solid rgba(245,158,11,0.25); }
  .ia-stock-out        { background:rgba(239,68,68,0.12);  color:#ef4444; border:1px solid rgba(239,68,68,0.25); }
  .ia-stock-paused     { background:rgba(100,116,139,0.12);color:#64748b; border:1px solid rgba(100,116,139,0.25); }
  .ia-stock-unavail    { background:rgba(239,68,68,0.12);  color:#ef4444; border:1px solid rgba(239,68,68,0.25); }
  .ia-stock-soon       { background:rgba(139,92,246,0.12); color:#8b5cf6; border:1px solid rgba(139,92,246,0.25); }

  /* ══════════════════════════════════════════════════════════
     UNAVAILABLE OVERLAY — طبقة "غير متاح" فوق الصورة
  ══════════════════════════════════════════════════════════ */
  .ia-unavail-overlay {
    position: absolute;
    inset: 0;
    z-index: 8;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: inherit;
    backdrop-filter: blur(4px) brightness(0.5) grayscale(0.7);
    -webkit-backdrop-filter: blur(4px) brightness(0.5) grayscale(0.7);
    background: rgba(0,0,0,0.45);
    pointer-events: none;
  }
  .ia-unavail-icon {
    font-size: 28px;
    filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));
    animation: ia-icon-float 2.5s ease-in-out infinite;
  }
  @keyframes ia-icon-float {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-4px); }
  }
  .ia-unavail-label {
    font-size: 12px;
    font-weight: 800;
    color: #fff;
    text-shadow: 0 1px 4px rgba(0,0,0,0.6);
    font-family: var(--font, 'Cairo', sans-serif);
    letter-spacing: 0.5px;
    background: rgba(0,0,0,0.4);
    padding: 3px 10px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.15);
  }

  /* ══════════════════════════════════════════════════════════
     DISABLED BUTTON — زر معطل بأسلوب احترافي
  ══════════════════════════════════════════════════════════ */
  .ia-btn-disabled {
    opacity: 0.45 !important;
    cursor: not-allowed !important;
    filter: grayscale(0.5) !important;
    pointer-events: none !important;
    position: relative;
  }

  /* ══════════════════════════════════════════════════════════
     ADMIN PANEL — لوحة الإدارة داخل نموذج التعديل
  ══════════════════════════════════════════════════════════ */
  .ia-admin-section {
    border: 1px solid rgba(99,102,241,0.25);
    background: linear-gradient(135deg,rgba(99,102,241,0.04),rgba(139,92,246,0.03));
    border-radius: 16px;
    padding: 16px;
    margin-top: 14px;
  }
  .ia-admin-section-title {
    font-weight: 800;
    font-size: 14px;
    color: var(--primary,#7c3aed);
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ia-admin-section-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(99,102,241,0.2);
  }

  /* شبكة الحالات */
  .ia-status-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }
  @media (max-width: 480px) { .ia-status-grid { grid-template-columns: repeat(2,1fr); } }

  .ia-status-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 6px;
    border-radius: 12px;
    border: 2px solid var(--border, rgba(255,255,255,0.1));
    background: var(--bg-card, rgba(255,255,255,0.03));
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: var(--font, 'Cairo');
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted, #94a3b8);
    text-align: center;
  }
  .ia-status-btn:hover {
    border-color: var(--primary,#7c3aed);
    background: rgba(124,58,237,0.07);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  .ia-status-btn.selected {
    border-color: var(--selected-color, #10b981);
    background: rgba(var(--selected-rgb, 16,185,129),0.1);
    color: var(--selected-color, #10b981);
    box-shadow: 0 0 0 3px rgba(var(--selected-rgb, 16,185,129),0.15);
  }
  .ia-status-icon { font-size: 22px; }

  /* الشارة التنبيهية الإدارية */
  .ia-badge-row {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 7px;
    margin-bottom: 12px;
  }
  @media (max-width: 480px) { .ia-badge-row { grid-template-columns: repeat(2,1fr); } }

  .ia-badge-type-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 10px;
    border-radius: 10px;
    border: 1.5px solid var(--border, rgba(255,255,255,0.1));
    background: transparent;
    cursor: pointer;
    font-family: var(--font,'Cairo');
    font-size: 11.5px;
    font-weight: 700;
    transition: all 0.18s;
    color: var(--text-muted);
  }
  .ia-badge-type-btn:hover { transform: scale(1.03); }
  .ia-badge-type-btn.sel-info    { background: rgba(59,130,246,0.15);  border-color:#3b82f6; color:#3b82f6; }
  .ia-badge-type-btn.sel-warning { background: rgba(245,158,11,0.15);  border-color:#f59e0b; color:#f59e0b; }
  .ia-badge-type-btn.sel-danger  { background: rgba(239,68,68,0.15);   border-color:#ef4444; color:#ef4444; }
  .ia-badge-type-btn.sel-success { background: rgba(16,185,129,0.15);  border-color:#10b981; color:#10b981; }
  .ia-badge-type-btn.sel-promo   { background: rgba(245,158,11,0.2);   border-color:#f59e0b; color:#d97706; }

  /* نصوص سريعة */
  .ia-quick-text {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }
  .ia-quick-chip {
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid var(--border,rgba(255,255,255,0.1));
    background: var(--bg-card,rgba(255,255,255,0.03));
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.18s;
    font-family: var(--font,'Cairo');
    white-space: nowrap;
  }
  .ia-quick-chip:hover {
    border-color: var(--primary,#7c3aed);
    color: var(--primary,#7c3aed);
    background: rgba(124,58,237,0.07);
    transform: scale(1.03);
  }
  .ia-quick-chip.selected {
    border-color: var(--primary,#7c3aed);
    background: rgba(124,58,237,0.15);
    color: var(--primary,#7c3aed);
  }

  /* Preview الشارة */
  .ia-preview-wrap {
    background: rgba(0,0,0,0.12);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
    min-height: 48px;
  }
  .ia-preview-label {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 600;
    flex-shrink: 0;
  }
  .ia-preview-badge-area { flex: 1; }

  /* التنسيق الجديد المضغوط والمنظم في جدول */
  .ia-admin-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    font-size: 12px;
  }
  .ia-admin-table td {
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    vertical-align: middle;
  }
  .ia-admin-table tr:last-child td {
    border-bottom: none;
  }
  .ia-table-label {
    width: 25%;
    font-weight: 800;
    color: var(--text-muted, #94a3b8);
    font-family: var(--font, 'Cairo', sans-serif);
    font-size: 11.5px;
    text-align: right;
  }
  
  .ia-status-btn-compact {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 9px;
    border-radius: 8px;
    border: 1px solid var(--border, rgba(255,255,255,0.08));
    background: var(--bg-card, rgba(255,255,255,0.02));
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: var(--font, 'Cairo');
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted, #94a3b8);
  }
  .ia-status-btn-compact:hover {
    border-color: var(--primary,#7c3aed);
    background: rgba(124,58,237,0.05);
  }
  .ia-status-btn-compact.selected {
    border-color: var(--selected-color, #10b981);
    background: rgba(var(--selected-rgb, 16,185,129), 0.08);
    color: var(--selected-color, #10b981);
  }

  .ia-badge-type-btn-compact {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 9px;
    border-radius: 8px;
    border: 1px solid var(--border, rgba(255,255,255,0.08));
    background: transparent;
    cursor: pointer;
    font-family: var(--font,'Cairo');
    font-size: 11px;
    font-weight: 700;
    transition: all 0.15s;
    color: var(--text-muted);
  }
  .ia-badge-type-btn-compact:hover {
    transform: translateY(-1px);
    border-color: rgba(255,255,255,0.15);
  }
  .ia-badge-type-btn-compact.sel-info    { background: rgba(59,130,246,0.1);  border-color:#3b82f6; color:#3b82f6; }
  .ia-badge-type-btn-compact.sel-warning { background: rgba(245,158,11,0.1);  border-color:#f59e0b; color:#f59e0b; }
  .ia-badge-type-btn-compact.sel-danger  { background: rgba(239,68,68,0.1);   border-color:#ef4444; color:#ef4444; }
  .ia-badge-type-btn-compact.sel-success { background: rgba(16,185,129,0.1);  border-color:#10b981; color:#10b981; }
  .ia-badge-type-btn-compact.sel-promo   { background: rgba(245,158,11,0.15); border-color:#f59e0b; color:#d97706; }

  .ia-quick-chip-compact {
    padding: 4px 8px;
    border-radius: 8px;
    border: 1px solid var(--border,rgba(255,255,255,0.06));
    background: var(--bg-card,rgba(255,255,255,0.02));
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--font,'Cairo');
    white-space: nowrap;
  }
  .ia-quick-chip-compact:hover {
    border-color: var(--primary,#7c3aed);
    color: var(--primary,#7c3aed);
    background: rgba(124,58,237,0.04);
  }
  .ia-quick-chip-compact.selected {
    border-color: var(--primary,#7c3aed);
    background: rgba(124,58,237,0.1);
    color: var(--primary,#7c3aed);
  }
  `;
  document.head.appendChild(style);

  /* ─────────────────────────────────────────────────────────
     حالات التوفر — الإعداد
  ───────────────────────────────────────────────────────── */
  const STOCK_STATUSES = [
    { key: 'available',  icon: '✅', label: 'متاح',             color: '#10b981', rgb: '16,185,129',  blockOrder: false },
    { key: 'limited',    icon: '⚡', label: 'كمية محدودة',      color: '#f59e0b', rgb: '245,158,11',  blockOrder: false },
    { key: 'out_of_stock',icon:'🔴', label: 'نفذت الكمية',      color: '#ef4444', rgb: '239,68,68',   blockOrder: true  },
    { key: 'paused',     icon: '⏸️', label: 'متوقف مؤقتاً',    color: '#64748b', rgb: '100,116,139', blockOrder: true  },
    { key: 'unavailable',icon: '🚫', label: 'خارج الخدمة',     color: '#ef4444', rgb: '239,68,68',   blockOrder: true  },
    { key: 'coming_soon',icon: '🕒', label: 'قريباً',           color: '#8b5cf6', rgb: '139,92,246',  blockOrder: true  },
  ];

  const QUICK_TEXTS = [
    { icon: '⚡', text: 'كمية محدودة — أطلب الآن!',    type: 'warning' },
    { icon: '🔥', text: 'عرض لفترة محدودة',             type: 'danger'  },
    { icon: '⏰', text: 'ينتهي العرض قريباً',           type: 'warning' },
    { icon: '🆕', text: 'جديد — وصل للتو',              type: 'info'    },
    { icon: '💎', text: 'منتج حصري',                    type: 'promo'   },
    { icon: '🎁', text: 'مع هدية مجانية',               type: 'success' },
    { icon: '🚚', text: 'شحن مجاني اليوم',              type: 'success' },
    { icon: '🏆', text: 'الأكثر مبيعاً',                type: 'promo'   },
    { icon: '🔖', text: 'سعر خاص للعضو',               type: 'info'    },
    { icon: '📦', text: 'آخر قطعة!',                   type: 'danger'  },
  ];

  /* ─────────────────────────────────────────────────────────
     الدوال المساعدة (Public API)
  ───────────────────────────────────────────────────────── */

  /**
   * هل العنصر متاح للطلب؟
   */
  window.ph48_isAvailable = function (item) {
    if (!item) return true;
    const s = item.stockStatus || 'available';
    const blocked = STOCK_STATUSES.find(x => x.key === s)?.blockOrder;
    return !blocked;
  };

  /**
   * HTML الشارة التنبيهية
   */
  window.ph48_badgeHtml = function (item) {
    const ab = item?.alertBadge;
    if (!ab || !ab.text) return '';

    // تحقق من تاريخ الانتهاء
    if (ab.expiresAt) {
      const exp = ab.expiresAt.toDate ? ab.expiresAt.toDate() : new Date(ab.expiresAt);
      if (exp < new Date()) return '';
    }

    const type = ab.type || 'info';
    const icon = ab.icon || '';
    return `<span class="ia-badge ia-badge-${type}" title="${escAttr(ab.text)}">
      ${icon ? `<span class="ia-badge-icon">${icon}</span>` : ''}
      <span>${escHtml(ab.text)}</span>
    </span>`;
  };

  /**
   * HTML شريحة حالة التوفر (للعرض داخل الكارد)
   */
  window.ph48_stockChipHtml = function (item) {
    const s = item?.stockStatus || 'available';
    if (s === 'available') return ''; // لا تُظهر شيئاً للمتاح
    const cfg = STOCK_STATUSES.find(x => x.key === s);
    if (!cfg) return '';
    const cls = { available:'ia-stock-available', limited:'ia-stock-limited', out_of_stock:'ia-stock-out', paused:'ia-stock-paused', unavailable:'ia-stock-unavail', coming_soon:'ia-stock-soon' }[s] || 'ia-stock-available';
    return `<span class="ia-stock-chip ${cls}">${cfg.icon} ${cfg.label}</span>`;
  };

  /**
   * HTML طبقة "غير متاح" فوق الصورة
   */
  window.ph48_unavailOverlayHtml = function (item) {
    if (ph48_isAvailable(item)) return '';
    const s = item.stockStatus;
    const cfg = STOCK_STATUSES.find(x => x.key === s) || { icon: '🚫', label: 'غير متاح' };
    return `<div class="ia-unavail-overlay">
      <div class="ia-unavail-icon">${cfg.icon}</div>
      <div class="ia-unavail-label">${cfg.label}</div>
    </div>`;
  };

  /**
   * HTML قسم إدارة التنبيهات (يُدمج داخل Modal التعديل)
   */
  window.ph48_adminSectionHtml = function (item) {
    const ab     = item?.alertBadge || {};
    const status = item?.stockStatus || 'available';
    const expVal = ab.expiresAt
      ? (() => { try { const d = ab.expiresAt.toDate ? ab.expiresAt.toDate() : new Date(ab.expiresAt); return d.toISOString().split('T')[0]; } catch(e){ return ''; } })()
      : '';

    const badgeTypes = [
      { key:'info',    icon:'ℹ️', label:'معلوماتية' },
      { key:'warning', icon:'⚠️', label:'تحذير' },
      { key:'danger',  icon:'🚨', label:'عاجل' },
      { key:'success', icon:'✅', label:'إيجابية' },
      { key:'promo',   icon:'🏷️', label:'ترويج' },
    ];

    return `
    <div class="ia-admin-section" id="ia-admin-section" style="padding: 12px; border-radius: 12px; margin-top: 10px;">
      <div class="ia-admin-section-title" style="font-size: 13px; margin-bottom: 8px;">🔔 التنبيهات وحالة التوفر</div>

      <table class="ia-admin-table">
        <tbody>
          <!-- ── حالة التوفر ── -->
          <tr>
            <td class="ia-table-label">📦 حالة التوفر</td>
            <td>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${STOCK_STATUSES.map(st => `
                  <button type="button"
                    class="ia-status-btn-compact${status === st.key ? ' selected' : ''}"
                    data-status="${st.key}"
                    style="${status === st.key ? `--selected-color:${st.color};--selected-rgb:${st.rgb}` : ''}"
                    onclick="ph48_selectStatus('${st.key}','${st.color}','${st.rgb}')">
                    <span style="font-size: 13px;">${st.icon}</span>
                    <span>${st.label}</span>
                  </button>
                `).join('')}
              </div>
              <input type="hidden" id="ia-stock-status" value="${status}">
            </td>
          </tr>

          <!-- ── الشارة التنبيهية ── -->
          <tr>
            <td class="ia-table-label">🏷️ شارة التنبيه</td>
            <td>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${badgeTypes.map(bt => `
                  <button type="button"
                    class="ia-badge-type-btn-compact${ab.type === bt.key ? ' sel-'+bt.key : ''}"
                    data-btype="${bt.key}"
                    onclick="ph48_selectBadgeType('${bt.key}')">
                    <span style="font-size: 12px;">${bt.icon}</span> ${bt.label}
                  </button>
                `).join('')}
                <button type="button"
                  class="ia-badge-type-btn-compact${!ab.type ? ' sel-info' : ''}"
                  style="color:#64748b"
                  onclick="ph48_selectBadgeType('')">
                  🚫 بلا شارة
                </button>
              </div>
              <input type="hidden" id="ia-badge-type" value="${ab.type || ''}">
            </td>
          </tr>

          <!-- ── نصوص سريعة ── -->
          <tr>
            <td class="ia-table-label">⚡ نصوص جاهزة</td>
            <td>
              <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                ${QUICK_TEXTS.map(qt => `
                  <button type="button"
                    class="ia-quick-chip-compact${ab.text === qt.text ? ' selected' : ''}"
                    onclick="ph48_pickQuickText('${escAttr(qt.icon)}','${escAttr(qt.text)}','${qt.type}')">
                    ${qt.icon} ${qt.text}
                  </button>
                `).join('')}
                <button type="button" class="ia-quick-chip-compact" onclick="document.getElementById('ia-badge-text').focus()">
                  ✏️ نص مخصص
                </button>
              </div>
            </td>
          </tr>

          <!-- ── الشارة المخصصة ── -->
          <tr>
            <td class="ia-table-label">✍️ الشارة والرمز</td>
            <td>
              <div style="display: flex; gap: 8px; align-items: center; max-width: 500px;">
                <div style="width: 70px; flex-shrink: 0;">
                  <input class="form-control form-control-sm" id="ia-badge-icon" value="${escAttr(ab.icon||'')}" placeholder="⚡" style="text-align:center; font-size:14px; height: 32px; padding: 2px 4px;">
                </div>
                <div style="flex: 1;">
                  <input class="form-control form-control-sm" id="ia-badge-text" value="${escAttr(ab.text||'')}" placeholder="مثال: كمية محدودة — أطلب الآن!" oninput="ph48_updatePreview()" style="font-size:12px; height: 32px; padding: 2px 8px;">
                </div>
              </div>
            </td>
          </tr>

          <!-- ── تاريخ انتهاء الشارة ── -->
          <tr>
            <td class="ia-table-label">⏰ تاريخ الانتهاء</td>
            <td>
              <input class="form-control form-control-sm" type="date" id="ia-badge-expires" value="${expVal}" style="max-width: 160px; height: 32px; font-size: 12px; padding: 2px 8px;">
              <span style="font-size: 11px; color: var(--text-muted); margin-inline-start: 8px;">(اتركه فارغاً لشارة دائمة)</span>
            </td>
          </tr>

          <!-- ── معاينة ── -->
          <tr>
            <td class="ia-table-label">👁️ معاينة الشارة</td>
            <td>
              <div id="ia-badge-preview">${ph48_badgeHtml(item)}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>`;
  };

  /* ─────────────────────────────────────────────────────────
     Event Handlers (global)
  ───────────────────────────────────────────────────────── */

  window.ph48_selectStatus = function (key, color, rgb) {
    document.getElementById('ia-stock-status').value = key;
    document.querySelectorAll('.ia-status-btn, .ia-status-btn-compact').forEach(btn => {
      const isSelected = btn.dataset.status === key;
      btn.classList.toggle('selected', isSelected);
      if (isSelected) {
        btn.style.setProperty('--selected-color', color);
        btn.style.setProperty('--selected-rgb', rgb);
      }
    });
  };

  window.ph48_selectBadgeType = function (type) {
    document.getElementById('ia-badge-type').value = type;
    document.querySelectorAll('.ia-badge-type-btn, .ia-badge-type-btn-compact').forEach(btn => {
      const isCompact = btn.classList.contains('ia-badge-type-btn-compact');
      const baseClass = isCompact ? 'ia-badge-type-btn-compact' : 'ia-badge-type-btn';
      const selClass = btn.dataset.btype === type ? ' sel-'+type : (type === '' && !btn.dataset.btype ? ' sel-info' : '');
      btn.className = baseClass + selClass;
    });
    ph48_updatePreview();
  };

  window.ph48_pickQuickText = function (icon, text, type) {
    const iconEl = document.getElementById('ia-badge-icon');
    const textEl = document.getElementById('ia-badge-text');
    if (iconEl) iconEl.value = icon;
    if (textEl) textEl.value = text;
    ph48_selectBadgeType(type);
    document.querySelectorAll('.ia-quick-chip, .ia-quick-chip-compact').forEach(c =>
      c.classList.toggle('selected', c.textContent.trim().includes(text.trim().slice(0,10)))
    );
    ph48_updatePreview();
  };

  window.ph48_updatePreview = function () {
    const type = document.getElementById('ia-badge-type')?.value || '';
    const text = document.getElementById('ia-badge-text')?.value || '';
    const icon = document.getElementById('ia-badge-icon')?.value || '';
    const prev = document.getElementById('ia-badge-preview');
    if (!prev) return;
    if (!text || !type) { prev.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">لا توجد شارة</span>'; return; }
    prev.innerHTML = `<span class="ia-badge ia-badge-${type}">
      ${icon ? `<span class="ia-badge-icon">${icon}</span>` : ''}
      <span>${escHtml(text)}</span>
    </span>`;
  };

  /**
   * يُستخدم في ph43_updateProduct وما يماثله لجمع بيانات التنبيه
   */
  window.ph48_collectAlertData = function () {
    const stockStatus = document.getElementById('ia-stock-status')?.value || 'available';
    const badgeType   = document.getElementById('ia-badge-type')?.value   || '';
    const badgeText   = document.getElementById('ia-badge-text')?.value?.trim()  || '';
    const badgeIcon   = document.getElementById('ia-badge-icon')?.value?.trim()  || '';
    const expiresStr  = document.getElementById('ia-badge-expires')?.value || '';

    let alertBadge = null;
    if (badgeType && badgeText) {
      alertBadge = { type: badgeType, text: badgeText, icon: badgeIcon };
      if (expiresStr) alertBadge.expiresAt = new Date(expiresStr);
    }

    return { stockStatus, alertBadge };
  };

  console.log('[ph48-alerts] نظام التنبيهات الاحترافية جاهز 🔔');

  /* ─────────────────────────────────────────────────────────
     Auto-Inject: مراقبة فتح الـ Modal وإضافة قسم التنبيهات تلقائياً
     يحل مشكلة ترتيب تحميل الملفات نهائياً
  ───────────────────────────────────────────────────────── */
  function ph48_injectIntoModal() {
    // لا تُضاف مرتين
    if (document.getElementById('ia-admin-section')) return;

    // ابحث عن modal-body
    const modalBody = document.getElementById('modal-body');
    if (!modalBody) return;

    // تحقق من أن الـ modal مفتوح لتعديل خدمة أو منتج
    const isEditSvc     = !!modalBody.querySelector('#svc-name');
    const isEditProduct = !!modalBody.querySelector('#ph43-prod-name, [id^="ph43-prod"]');
    if (!isEditSvc && !isEditProduct) return;

    // استخرج الـ item ID من زر الحفظ
    let itemObj = {};
    const saveBtn = modalBody.parentElement?.querySelector('button[onclick*="updateSvc"], button[onclick*="ph43_updateProduct"]');
    if (saveBtn) {
      const onclickStr = saveBtn.getAttribute('onclick') || '';
      const matchSvc  = onclickStr.match(/updateSvc\(['"]([^'"]+)['"]\)/);
      const matchProd = onclickStr.match(/ph43_updateProduct\(['"]([^'"]+)['"]/);
      const itemId = (matchSvc || matchProd)?.[1];
      if (itemId) {
        const allItems = [...(window.AppData?.services || []), ...(window.AppData?.products || [])];
        itemObj = allItems.find(x => x.id === itemId) || {};
      }
    }

    // إيجاد مكان الإدراج — نهاية آخر admin-modal-card
    const cards = modalBody.querySelectorAll('.admin-modal-card');
    const lastCard = cards[cards.length - 1];
    if (!lastCard) return;

    // أنشئ القسم وأدرجه
    const wrapper = document.createElement('div');
    wrapper.style.marginTop = '16px';
    wrapper.innerHTML = ph48_adminSectionHtml(itemObj);
    lastCard.appendChild(wrapper);
  }

  // راقب modal-body لأي تغيير في محتواه (فتح modal)
  const observer = new MutationObserver(function(mutations) {
    for (const m of mutations) {
      if (m.type === 'childList' && m.addedNodes.length) {
        // تأخير قصير للسماح للـ DOM بالاكتمال
        setTimeout(ph48_injectIntoModal, 80);
        break;
      }
    }
  });

  // ابدأ المراقبة عند اكتمال DOM
  function ph48_startObserver() {
    const modalBody = document.getElementById('modal-body');
    if (modalBody) {
      observer.observe(modalBody, { childList: true });
    } else {
      // إذا لم يُوجد بعد، انتظر DOMContentLoaded
      document.addEventListener('DOMContentLoaded', function() {
        const mb = document.getElementById('modal-body');
        if (mb) observer.observe(mb, { childList: true });
      });
    }
  }

  ph48_startObserver();

})();


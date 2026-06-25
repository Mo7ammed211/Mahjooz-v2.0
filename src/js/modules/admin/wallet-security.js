/* ═══════════════════════════════════════════════════════════════
   نظام أمان المحافظ المتكامل — Secure Wallet Management System
   ───────────────────────────────────────────────────────────────
   المميزات:
   • بوابة كلمة مرور قبل أي عملية على المحفظة (إعادة مصادقة Firebase)
   • تسجيل كامل لكل حركة: اسم المدير، دوره، تاريخ/وقت، قبل/بعد
   • عمليات ضمن Firestore Transaction لمنع التلاعب
   • كشف العمليات المشبوهة (مبالغ كبيرة = تأكيد مزدوج)
   • سجل التدقيق محمي من الحذف والتعديل
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── ثوابت الأمان ──────────────────────────────────────────── */
  const DEFAULT_WALLET_THRESHOLD   = 500;    // افتراضي لعمليات المحفظة الإدارية
  const DEFAULT_PURCHASE_THRESHOLD = 1000;   // افتراضي لعمليات الشراء والإيداعات
  const AUDIT_COLLECTION           = 'wallet_audit_log';
  const SESSION_AUTH_TTL           = 10 * 60 * 1000; // 10 دقائق قبل إعادة المصادقة

  /* ── حدود التنبيه الديناميكية (تُقرأ من Firestore) ── */
  let LARGE_AMOUNT_THRESHOLD   = DEFAULT_WALLET_THRESHOLD;
  let PURCHASE_ALERT_THRESHOLD = DEFAULT_PURCHASE_THRESHOLD;

  let _lastAuthTime = 0;
  let _authSessionUid = null;

  /* ── CSS ──────────────────────────────────────────────────── */
  const css = `
  /* ── بوابة كلمة المرور ── */
  .wsec-gate {
    max-width: 420px;
    margin: 60px auto;
    background: var(--card-bg, #1e1e2e);
    border: 2px solid rgba(124,58,237,0.3);
    border-radius: 20px;
    padding: 36px 32px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.35);
    font-family: 'Cairo', sans-serif;
  }
  .wsec-gate-icon { font-size: 48px; margin-bottom: 12px; }
  .wsec-gate-title { font-size: 18px; font-weight: 900; color: var(--text); margin-bottom: 6px; }
  .wsec-gate-sub { font-size: 12px; color: var(--text-muted); margin-bottom: 24px; }
  .wsec-gate-input {
    width: 100%;
    background: var(--input-bg, #12121f);
    border: 1.5px solid var(--border);
    border-radius: 12px;
    padding: 12px 16px;
    color: var(--text);
    font-size: 16px;
    font-family: 'Cairo', sans-serif;
    text-align: center;
    letter-spacing: 4px;
    outline: none;
    margin-bottom: 16px;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }
  .wsec-gate-input:focus { border-color: #7c3aed; }
  .wsec-gate-input.error { border-color: #ef4444; animation: wsec-shake 0.4s; }
  @keyframes wsec-shake {
    0%,100%{ transform: translateX(0) }
    25%    { transform: translateX(-6px) }
    75%    { transform: translateX(6px) }
  }
  .wsec-gate-btn {
    width: 100%;
    background: linear-gradient(135deg, #7c3aed, #5b21b6);
    color: #fff;
    border: none;
    border-radius: 12px;
    padding: 13px;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    font-family: 'Cairo', sans-serif;
    transition: opacity 0.2s;
  }
  .wsec-gate-btn:hover:not(:disabled) { opacity: 0.9; }
  .wsec-gate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .wsec-gate-err {
    color: #ef4444;
    font-size: 12px;
    margin-top: 10px;
    min-height: 18px;
    font-weight: 700;
  }
  .wsec-gate-attempts {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 8px;
  }

  /* ── لوحة إدارة المحافظ ── */
  .wsec-wrap {
    padding: 20px;
    max-width: 1100px;
    margin: 0 auto;
    font-family: 'Cairo', sans-serif;
  }
  .wsec-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 22px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }
  .wsec-title {
    font-size: 19px;
    font-weight: 900;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .wsec-secure-badge {
    background: rgba(16,185,129,0.12);
    color: #10b981;
    border: 1px solid rgba(16,185,129,0.25);
    border-radius: 8px;
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* ── جدول المستخدمين ── */
  .wsec-search-bar {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 14px;
    color: var(--text);
    font-size: 13px;
    font-family: 'Cairo', sans-serif;
    width: 100%;
    outline: none;
    margin-bottom: 16px;
  }
  .wsec-user-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 12px;
    margin-bottom: 30px;
  }
  .wsec-user-card {
    background: var(--card-bg);
    border: 1.5px solid var(--border);
    border-radius: 14px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: border-color 0.2s;
    cursor: pointer;
  }
  .wsec-user-card:hover { border-color: #7c3aed; }
  .wsec-user-avatar {
    width: 40px; height: 40px;
    border-radius: 50%;
    background: rgba(124,58,237,0.15);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; flex-shrink: 0;
  }
  .wsec-user-name { font-size: 13px; font-weight: 800; color: var(--text); }
  .wsec-user-role { font-size: 10.5px; color: var(--text-muted); margin-top: 1px; }
  .wsec-user-balance {
    margin-right: auto;
    font-size: 14px;
    font-weight: 900;
    color: #10b981;
    white-space: nowrap;
  }
  .wsec-user-balance.zero { color: var(--text-muted); }

  /* ── نافذة تعديل المحفظة ── */
  .wsec-modal-section {
    margin-bottom: 20px;
  }
  .wsec-modal-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
    margin-bottom: 6px;
    display: block;
  }
  .wsec-action-btns {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .wsec-action-btn {
    flex: 1;
    min-width: 90px;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 10px 8px;
    text-align: center;
    cursor: pointer;
    font-size: 13px;
    font-weight: 800;
    font-family: 'Cairo', sans-serif;
    background: var(--card-bg);
    color: var(--text);
    transition: all 0.2s;
  }
  .wsec-action-btn.sel-credit  { border-color: #10b981; background: rgba(16,185,129,0.1); color: #10b981; }
  .wsec-action-btn.sel-debit   { border-color: #ef4444; background: rgba(239,68,68,0.1);  color: #ef4444; }
  .wsec-action-btn.sel-set     { border-color: #7c3aed; background: rgba(124,58,237,0.1); color: #7c3aed; }

  .wsec-modal-input {
    width: 100%;
    background: var(--input-bg, #12121f);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 11px 14px;
    color: var(--text);
    font-size: 15px;
    font-family: 'Cairo', sans-serif;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s;
  }
  .wsec-modal-input:focus { border-color: #7c3aed; }

  .wsec-balance-display {
    background: rgba(124,58,237,0.07);
    border: 1px solid rgba(124,58,237,0.2);
    border-radius: 10px;
    padding: 12px 16px;
    text-align: center;
    margin-bottom: 16px;
  }
  .wsec-balance-num {
    font-size: 26px;
    font-weight: 900;
    color: #10b981;
  }
  .wsec-balance-label { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

  .wsec-warn-box {
    background: rgba(251,191,36,0.08);
    border: 1.5px solid rgba(251,191,36,0.3);
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 12px;
    color: #fbbf24;
    font-weight: 700;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* ── سجل التدقيق ── */
  .wsec-audit-wrap { margin-top: 30px; }
  .wsec-audit-title {
    font-size: 15px;
    font-weight: 900;
    color: var(--text);
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }
  .wsec-audit-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 14px;
    align-items: center;
  }
  .wsec-audit-filter {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted);
    cursor: pointer;
    font-family: 'Cairo', sans-serif;
    transition: all 0.2s;
  }
  .wsec-audit-filter.active { border-color: #7c3aed; color: #7c3aed; background: rgba(124,58,237,0.08); }

  .wsec-audit-table-wrap {
    overflow-x: auto;
    border-radius: 12px;
    border: 1px solid var(--border);
  }
  .wsec-audit-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .wsec-audit-table th {
    background: rgba(124,58,237,0.08);
    padding: 11px 12px;
    text-align: right;
    font-weight: 800;
    color: var(--text);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  .wsec-audit-table td {
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    color: var(--text);
    vertical-align: middle;
  }
  .wsec-audit-table tr:last-child td { border-bottom: none; }
  .wsec-audit-table tr:hover td { background: rgba(255,255,255,0.02); }

  .wsec-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 10.5px;
    font-weight: 800;
    white-space: nowrap;
  }
  .wsec-badge.credit  { background: rgba(16,185,129,0.12); color: #10b981; }
  .wsec-badge.debit   { background: rgba(239,68,68,0.12);  color: #ef4444; }
  .wsec-badge.set     { background: rgba(124,58,237,0.12); color: #a78bfa; }
  .wsec-badge.view    { background: rgba(107,114,128,0.1); color: #9ca3af; }
  .wsec-badge.admin   { background: rgba(251,191,36,0.12); color: #fbbf24; }
  .wsec-badge.staff   { background: rgba(59,130,246,0.12); color: #60a5fa; }

  .wsec-empty {
    text-align: center;
    padding: 40px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .wsec-submit-btn {
    width: 100%;
    border: none;
    border-radius: 12px;
    padding: 13px;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    font-family: 'Cairo', sans-serif;
    transition: opacity 0.2s;
    color: #fff;
  }
  .wsec-submit-btn.credit { background: linear-gradient(135deg,#10b981,#059669); }
  .wsec-submit-btn.debit  { background: linear-gradient(135deg,#ef4444,#b91c1c); }
  .wsec-submit-btn.set    { background: linear-gradient(135deg,#7c3aed,#5b21b6); }
  .wsec-submit-btn:hover:not(:disabled) { opacity: 0.9; }
  .wsec-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  @media(max-width:600px){
    .wsec-wrap { padding: 12px; }
    .wsec-user-grid { grid-template-columns: 1fr; }
  }

  /* ══ جرس الإشعارات المالية ══ */
  #wsec-alert-bell {
    position: fixed;
    bottom: 24px;
    left: 24px;
    z-index: 8500;
    width: 52px;
    height: 52px;
    background: linear-gradient(135deg,#7c3aed,#5b21b6);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(124,58,237,0.5);
    border: none;
    transition: transform 0.2s, box-shadow 0.2s;
    animation: wsec-bell-idle 4s ease-in-out infinite;
  }
  #wsec-alert-bell:hover { transform: scale(1.1); box-shadow: 0 6px 26px rgba(124,58,237,0.7); }
  #wsec-alert-bell.ringing { animation: wsec-bell-ring 0.5s ease-in-out 3; }
  @keyframes wsec-bell-idle {
    0%,90%,100% { transform: rotate(0deg); }
    93% { transform: rotate(-8deg); }
    96% { transform: rotate(8deg); }
  }
  @keyframes wsec-bell-ring {
    0%   { transform: rotate(0deg); }
    20%  { transform: rotate(-20deg); }
    40%  { transform: rotate(20deg); }
    60%  { transform: rotate(-15deg); }
    80%  { transform: rotate(10deg); }
    100% { transform: rotate(0deg); }
  }
  #wsec-bell-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #ef4444;
    color: #fff;
    font-size: 10px;
    font-weight: 900;
    font-family: 'Cairo',sans-serif;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    border: 2px solid #fff;
    animation: wsec-badge-pop 0.3s cubic-bezier(.175,.885,.32,1.275);
  }
  @keyframes wsec-badge-pop {
    from { transform: scale(0); }
    to   { transform: scale(1); }
  }

  /* ── لوحة الإشعارات المنزلقة ── */
  #wsec-alerts-panel {
    position: fixed;
    bottom: 86px;
    left: 24px;
    width: 360px;
    max-height: 520px;
    background: var(--card-bg, #1a1a2e);
    border: 1.5px solid rgba(124,58,237,0.35);
    border-radius: 18px;
    box-shadow: 0 16px 60px rgba(0,0,0,0.45);
    z-index: 8400;
    display: none;
    flex-direction: column;
    overflow: hidden;
    font-family: 'Cairo',sans-serif;
    transform: translateY(20px);
    opacity: 0;
    transition: transform 0.25s ease, opacity 0.25s ease;
  }
  #wsec-alerts-panel.open {
    display: flex;
    transform: translateY(0);
    opacity: 1;
  }
  .wsec-ap-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    background: rgba(124,58,237,0.08);
  }
  .wsec-ap-title {
    font-size: 13px;
    font-weight: 900;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .wsec-ap-actions {
    display: flex;
    gap: 6px;
  }
  .wsec-ap-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: 8px;
    padding: 4px 8px;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    font-family: 'Cairo',sans-serif;
    transition: all 0.2s;
  }
  .wsec-ap-btn:hover { background: rgba(124,58,237,0.12); color: #a78bfa; border-color: #7c3aed; }
  .wsec-ap-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .wsec-ap-empty {
    text-align: center;
    padding: 30px 10px;
    color: var(--text-muted);
    font-size: 12px;
  }

  /* ── بطاقة الإشعار الواحد ── */
  .wsec-alert-card {
    background: var(--card-bg, #1e1e2e);
    border: 1.5px solid var(--border);
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
  }
  .wsec-alert-card.unread { border-color: rgba(124,58,237,0.5); background: rgba(124,58,237,0.06); }
  .wsec-alert-card:hover { background: rgba(124,58,237,0.1); }
  .wsec-alert-icon {
    font-size: 24px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .wsec-alert-body { flex: 1; min-width: 0; }
  .wsec-alert-title {
    font-size: 12px;
    font-weight: 800;
    color: var(--text);
    margin-bottom: 3px;
  }
  .wsec-alert-meta {
    font-size: 10.5px;
    color: var(--text-muted);
    margin-bottom: 2px;
  }
  .wsec-alert-amount {
    font-size: 14px;
    font-weight: 900;
  }
  .wsec-alert-amount.credit { color: #10b981; }
  .wsec-alert-amount.debit  { color: #ef4444; }
  .wsec-alert-amount.set    { color: #a78bfa; }
  .wsec-alert-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #7c3aed;
    flex-shrink: 0;
    margin-top: 5px;
  }

  /* ── توست الإشعار المنزلق من الأسفل ── */
  .wsec-toast-alert {
    position: fixed;
    bottom: 86px;
    left: 390px;
    max-width: 340px;
    background: linear-gradient(135deg, #1e1347, #2d1a6e);
    border: 1.5px solid rgba(124,58,237,0.6);
    border-radius: 16px;
    padding: 14px 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    z-index: 9000;
    font-family: 'Cairo',sans-serif;
    color: #fff;
    direction: rtl;
    animation: wsec-toast-in 0.4s cubic-bezier(.175,.885,.32,1.275) forwards;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  @keyframes wsec-toast-in {
    from { opacity:0; transform: translateY(20px) scale(0.95); }
    to   { opacity:1; transform: translateY(0) scale(1); }
  }
  .wsec-toast-alert.removing {
    animation: wsec-toast-out 0.3s ease-in forwards;
  }
  @keyframes wsec-toast-out {
    to { opacity:0; transform: translateY(20px) scale(0.9); }
  }
  .wsec-ta-icon { font-size: 26px; flex-shrink: 0; }
  .wsec-ta-body { flex: 1; }
  .wsec-ta-title { font-size: 12px; font-weight: 900; margin-bottom: 4px; opacity: 0.85; }
  .wsec-ta-amount { font-size: 20px; font-weight: 900; }
  .wsec-ta-meta { font-size: 11px; opacity: 0.7; margin-top: 3px; }
  .wsec-ta-close {
    background: none; border: none; color: rgba(255,255,255,0.5);
    cursor: pointer; font-size: 16px; padding: 0; line-height: 1;
    align-self: flex-start;
  }
  `;


  if (!document.getElementById('wsec-styles')) {
    const el = document.createElement('style');
    el.id = 'wsec-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  /* ══════════════════════════════════════════════════════════
     أدوات مساعدة
  ══════════════════════════════════════════════════════════ */
  function _esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
    );
  }

  function _fmtTs(ts) {
    if (!ts) return '—';
    let d;
    if (ts.toDate)      d = ts.toDate();
    else if (ts.seconds) d = new Date(ts.seconds * 1000);
    else                 d = new Date(ts);
    if (isNaN(d)) return '—';
    return d.toLocaleString('ar-YE', {
      year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit'
    });
  }

  function _roleName(role) {
    return { admin:'مدير', staff:'موظف', cs:'خدمة عملاء', vendor:'مزود', driver:'مندوب', customer:'عميل' }[role] || role || '—';
  }

  function _userAvatar(u) {
    const icons = { admin:'👑', staff:'🧑‍💼', vendor:'🏪', driver:'🚗', customer:'👤' };
    return icons[u?.role] || '👤';
  }

  function _walletBalance(uid) {
    const w = AppData.wallets && AppData.wallets[uid];
    return w ? (w.balance || 0) : 0;
  }

  /* ══════════════════════════════════════════════════════════
     كتابة سجل التدقيق (محمي — كتابة فقط، لا حذف أبداً)
  ══════════════════════════════════════════════════════════ */
  async function _writeAuditLog(data) {
    try {
      const me = State.currentUser;
      const entry = {
        adminUid:         me?.uid || 'unknown',
        adminName:        me?.displayName || me?.name || me?.email || 'مجهول',
        adminRole:        me?.role || 'unknown',
        targetUid:        data.targetUid    || '',
        targetName:       data.targetName   || '',
        action:           data.action       || 'unknown',
        amount:           data.amount       || 0,
        balanceBefore:    data.balanceBefore ?? null,
        balanceAfter:     data.balanceAfter  ?? null,
        note:             data.note         || '',
        timestamp:        firebase.firestore.FieldValue.serverTimestamp(),
        userAgent:        navigator.userAgent.slice(0, 200),
        sessionId:        _sessionId,
      };
      await db.collection(AUDIT_COLLECTION).add(entry);
    } catch (e) {
      console.error('[WalletSecurity] فشل كتابة سجل التدقيق:', e);
    }
  }

  /* ── معرّف جلسة عشوائي لتتبع الجلسات ── */
  const _sessionId = Math.random().toString(36).slice(2, 10).toUpperCase();

  /* ══════════════════════════════════════════════════════════
     بوابة كلمة المرور — إعادة مصادقة Firebase
  ══════════════════════════════════════════════════════════ */
  let _gateAttempts = 0;

  function _isSessionValid() {
    const me = State.currentUser;
    return _authSessionUid === me?.uid && (Date.now() - _lastAuthTime) < SESSION_AUTH_TTL;
  }

  async function _reAuthenticate(password) {
    const user = firebase.auth().currentUser;
    if (!user || !user.email) throw new Error('لا يوجد حساب مسجّل دخوله حالياً');
    const cred = firebase.auth.EmailAuthProvider.credential(user.email, password);
    await user.reauthenticateWithCredential(cred);
    _lastAuthTime   = Date.now();
    _authSessionUid = user.uid;
    _gateAttempts   = 0;
  }

  /* ── عرض بوابة كلمة المرور ── */
  window.wsecShowGate = function (onSuccessCallback) {
    const locked = _gateAttempts >= 5;
    openModal(`
      <div class="wsec-gate">
        <div class="wsec-gate-icon">🔐</div>
        <div class="wsec-gate-title">تأكيد هويتك</div>
        <div class="wsec-gate-sub">أدخل كلمة مرور حسابك للمتابعة<br>هذه الخطوة مطلوبة لحماية المحافظ من أي تلاعب</div>
        ${locked ? `<div class="wsec-gate-err">🔒 تم تجميد الوصول بسبب محاولات متكررة. أغلق النافذة وحاول لاحقاً.</div>` : `
        <input class="wsec-gate-input" id="wsec-pwd-input" type="password"
               placeholder="••••••••"
               autocomplete="current-password"
               onkeydown="if(event.key==='Enter')wsecSubmitGate()"
               autofocus />
        <button class="wsec-gate-btn" id="wsec-gate-btn" onclick="wsecSubmitGate()">
          🔓 تأكيد والمتابعة
        </button>
        <div class="wsec-gate-err" id="wsec-gate-err"></div>
        <div class="wsec-gate-attempts" id="wsec-gate-attempts">
          ${_gateAttempts > 0 ? `محاولات خاطئة: ${_gateAttempts} / 5` : ''}
        </div>`}
      </div>`, 'sm');

    window.__wsecGateCallback = onSuccessCallback;
    if (!locked) setTimeout(() => document.getElementById('wsec-pwd-input')?.focus(), 100);
  };

  window.wsecSubmitGate = async function () {
    const pwd    = document.getElementById('wsec-pwd-input')?.value || '';
    const btn    = document.getElementById('wsec-gate-btn');
    const errEl  = document.getElementById('wsec-gate-err');
    const attEl  = document.getElementById('wsec-gate-attempts');
    const input  = document.getElementById('wsec-pwd-input');

    if (!pwd) { errEl.textContent = 'يرجى إدخال كلمة المرور'; return; }

    btn.disabled = true;
    btn.textContent = '⏳ جاري التحقق...';
    errEl.textContent = '';

    try {
      await _reAuthenticate(pwd);

      /* تسجيل دخول للوحة المحافظ */
      await _writeAuditLog({
        action: 'gate_access',
        note:   'دخول ناجح للوحة إدارة المحافظ',
      });

      closeModal();
      if (typeof window.__wsecGateCallback === 'function') {
        window.__wsecGateCallback();
        window.__wsecGateCallback = null;
      }
    } catch (err) {
      _gateAttempts++;
      input.value = '';
      input.classList.add('error');
      setTimeout(() => input?.classList.remove('error'), 500);

      const remaining = 5 - _gateAttempts;
      if (_gateAttempts >= 5) {
        errEl.textContent = '🔒 تم تجميد الوصول. أغلق النافذة وحاول بعد قليل.';
        btn.disabled = true;
        await _writeAuditLog({ action: 'gate_locked', note: 'تجاوز الحد الأقصى لمحاولات كلمة المرور' });
      } else {
        errEl.textContent = `كلمة المرور غير صحيحة — متبقي ${remaining} محاولة`;
        if (attEl) attEl.textContent = `محاولات خاطئة: ${_gateAttempts} / 5`;
        btn.disabled = false;
        btn.textContent = '🔓 تأكيد والمتابعة';
        input.focus();
      }
    }
  };

  /* ══════════════════════════════════════════════════════════
     لوحة إدارة المحافظ الرئيسية
  ══════════════════════════════════════════════════════════ */
  window.renderSecureWalletPanel = function () {
    /* إذا انتهت جلسة المصادقة أو لم تبدأ → اعرض البوابة */
    if (!_isSessionValid()) {
      return `
      <div style="padding:40px;text-align:center;font-family:'Cairo',sans-serif">
        <div style="font-size:52px;margin-bottom:16px">🔐</div>
        <div style="font-size:17px;font-weight:900;color:var(--text);margin-bottom:8px">محمي بكلمة المرور</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:24px">
          لحماية المحافظ من التلاعب، يلزم إدخال كلمة مرور حسابك لفتح هذا القسم
        </div>
        <button onclick="wsecShowGate(function(){ setAdminTab('wallet'); })"
                style="background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:none;border-radius:12px;padding:13px 30px;font-size:15px;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif">
          🔓 فتح إدارة المحافظ
        </button>
      </div>`;
    }

    const me      = State.currentUser;
    const canEdit = me?.role === 'admin' || userHasPerm(me, 'adjust_wallets');
    const users   = (AppData.users || []).filter(u => (u.uid || u.id) && u.role && !['admin', 'super_admin', 'staff', 'cs'].includes(String(u.role).toLowerCase()));
    const q       = (State.wsecSearch || '').toLowerCase();

    const filtered = users.filter(u => {
      if (!q) return true;
      const name = (u.displayName || u.name || u.email || '').toLowerCase();
      return name.includes(q);
    }).sort((a, b) => {
      const bBal = _walletBalance(b.uid || b.id);
      const aBal = _walletBalance(a.uid || a.id);
      return bBal - aBal;
    });

    /* ملخص إجمالي */
    let totalBalance = 0;
    users.forEach(u => { totalBalance += _walletBalance(u.uid || u.id); });

    const sessionLeft = Math.max(0, Math.ceil((SESSION_AUTH_TTL - (Date.now() - _lastAuthTime)) / 60000));

    return `
    <div class="wsec-wrap">

      <!-- رأس الصفحة -->
      <div class="wsec-header">
        <div class="wsec-title">
          💰 إدارة المحافظ
          <span class="wsec-secure-badge">🛡️ جلسة آمنة · ${sessionLeft} دقيقة</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button onclick="wsecShowGate(function(){ setAdminTab('wallet'); })"
                  style="background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.3);color:#a78bfa;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif">
            🔄 تجديد الجلسة
          </button>
          <button onclick="setAdminTab('wallet_audit')"
                  style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);color:#fbbf24;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif">
            📋 سجل التدقيق
          </button>
        </div>
      </div>

      <!-- ملخص -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:22px">
        <div style="background:rgba(16,185,129,0.07);border:1.5px solid rgba(16,185,129,0.2);border-radius:14px;padding:16px;text-align:center">
          <div style="font-size:24px;font-weight:900;color:#10b981">${totalBalance.toLocaleString('ar-YE')}</div>
          <div style="font-size:11px;color:var(--text-muted)">إجمالي أرصدة المحافظ (ريال)</div>
        </div>
        <div style="background:rgba(124,58,237,0.07);border:1.5px solid rgba(124,58,237,0.2);border-radius:14px;padding:16px;text-align:center">
          <div style="font-size:24px;font-weight:900;color:#a78bfa">${users.length}</div>
          <div style="font-size:11px;color:var(--text-muted)">إجمالي المستخدمين</div>
        </div>
        <div style="background:rgba(251,191,36,0.07);border:1.5px solid rgba(251,191,36,0.2);border-radius:14px;padding:16px;text-align:center">
          <div style="font-size:24px;font-weight:900;color:#fbbf24">${users.filter(u => _walletBalance(u.uid||u.id) > 0).length}</div>
          <div style="font-size:11px;color:var(--text-muted)">محافظ نشطة (رصيد > 0)</div>
        </div>
      </div>

      <!-- بحث -->
      <input class="wsec-search-bar" type="text"
             placeholder="🔍 بحث بالاسم أو البريد الإلكتروني..."
             value="${_esc(State.wsecSearch || '')}"
             oninput="State.wsecSearch=this.value;document.getElementById('wsec-list').innerHTML=wsecRenderUserList()" />

      <!-- قائمة المستخدمين -->
      <div class="wsec-user-grid" id="wsec-list">
        ${_renderUserList(filtered, canEdit)}
      </div>

    </div>`;
  };

  /* ── قائمة المستخدمين (داخلية) ── */
  function _renderUserList(filtered, canEdit) {
    if (!filtered.length) return `<div class="wsec-empty">لا يوجد مستخدمون مطابقون للبحث</div>`;
    return filtered.map(u => {
      const uid     = u.uid || u.id;
      const name    = _esc(u.displayName || u.name || u.email || '—');
      const balance = _walletBalance(uid);
      return `
      <div class="wsec-user-card" onclick="${canEdit ? `wsecOpenAdjust('${uid}')` : ''}">
        <div class="wsec-user-avatar">${_userAvatar(u)}</div>
        <div>
          <div class="wsec-user-name">${name}</div>
          <div class="wsec-user-role">${_roleName(u.role)}</div>
        </div>
        <div class="wsec-user-balance ${balance === 0 ? 'zero' : ''}">
          ${balance.toLocaleString('ar-YE')} ر.ي
        </div>
      </div>`;
    }).join('');
  }

  /* دالة معرّضة للـ HTML */
  window.wsecRenderUserList = function () {
    const me      = State.currentUser;
    const canEdit = me?.role === 'admin' || userHasPerm(me, 'adjust_wallets');
    const users   = (AppData.users || []).filter(u => (u.uid || u.id) && u.role && !['admin', 'super_admin', 'staff', 'cs'].includes(String(u.role).toLowerCase()));
    const q       = (State.wsecSearch || '').toLowerCase();
    const filtered = users.filter(u => {
      if (!q) return true;
      const name = (u.displayName || u.name || u.email || '').toLowerCase();
      return name.includes(q);
    }).sort((a, b) => _walletBalance(b.uid||b.id) - _walletBalance(a.uid||a.id));
    return _renderUserList(filtered, canEdit);
  };

  /* ══════════════════════════════════════════════════════════
     نافذة تعديل محفظة مستخدم محدد
  ══════════════════════════════════════════════════════════ */
  window.wsecOpenAdjust = function (uid) {
    if (!_isSessionValid()) {
      wsecShowGate(() => wsecOpenAdjust(uid));
      return;
    }

    const user    = (AppData.users || []).find(u => (u.uid || u.id) === uid);
    const name    = user ? (user.displayName || user.name || user.email || '—') : uid;
    const balance = _walletBalance(uid);
    const isLarge = balance >= LARGE_AMOUNT_THRESHOLD;

    openModal(`
    <div class="modal-header">
      <div>
        <h2 class="modal-title">💰 تعديل محفظة</h2>
        <p style="font-size:12px;color:var(--text-muted);margin:0">${_esc(name)}</p>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>

    <!-- الرصيد الحالي -->
    <div class="wsec-balance-display">
      <div class="wsec-balance-num">${balance.toLocaleString('ar-YE')} <span style="font-size:14px;color:var(--text-muted)">ريال</span></div>
      <div class="wsec-balance-label">الرصيد الحالي</div>
    </div>

    <!-- اختيار نوع العملية -->
    <div class="wsec-modal-section">
      <span class="wsec-modal-label">نوع العملية</span>
      <div class="wsec-action-btns">
        <button class="wsec-action-btn sel-credit" id="wa-btn-credit" onclick="wsecSelectAction('credit')">
          ➕ إضافة رصيد
        </button>
        <button class="wsec-action-btn" id="wa-btn-debit" onclick="wsecSelectAction('debit')">
          ➖ خصم رصيد
        </button>
        <button class="wsec-action-btn" id="wa-btn-set" onclick="wsecSelectAction('set')">
          ✏️ تعيين رصيد
        </button>
      </div>
    </div>

    <!-- المبلغ -->
    <div class="wsec-modal-section">
      <span class="wsec-modal-label">المبلغ (ريال)</span>
      <input class="wsec-modal-input" id="wa-amount" type="number" min="0" step="0.01"
             placeholder="0.00" oninput="wsecCheckLarge(this.value)" />
    </div>

    <!-- السبب -->
    <div class="wsec-modal-section">
      <span class="wsec-modal-label">سبب العملية (إلزامي للتدقيق)</span>
      <input class="wsec-modal-input" id="wa-note" type="text"
             placeholder="مثال: تعويض عميل، تصحيح خطأ، مكافأة..." maxlength="200" />
    </div>

    <!-- تحذير المبالغ الكبيرة -->
    <div class="wsec-warn-box" id="wa-large-warn" style="display:${isLarge?'flex':'none'}">
      ⚠️ المبلغ المطلوب كبير — سيتم تسجيل هذه العملية بشكل خاص في سجل التدقيق
    </div>

    <button class="wsec-submit-btn credit" id="wa-submit-btn"
            onclick="wsecSubmitAdjust('${uid}', '${_esc(name)}', ${balance})">
      ✅ تنفيذ العملية
    </button>
    <p style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:10px">
      🛡️ ستُسجَّل هذه العملية باسمك في سجل التدقيق الدائم
    </p>`, 'md');

    window._wsecCurrentAction = 'credit';
  };

  window.wsecSelectAction = function (action) {
    window._wsecCurrentAction = action;
    ['credit','debit','set'].forEach(a => {
      const btn = document.getElementById(`wa-btn-${a}`);
      if (btn) btn.className = `wsec-action-btn${a === action ? ` sel-${a}` : ''}`;
    });
    const submitBtn = document.getElementById('wa-submit-btn');
    if (submitBtn) {
      submitBtn.className = `wsec-submit-btn ${action}`;
      const labels = { credit:'✅ إضافة الرصيد', debit:'🗑️ خصم الرصيد', set:'✏️ تعيين الرصيد' };
      submitBtn.textContent = labels[action];
    }
  };

  window.wsecCheckLarge = function (val) {
    const warn = document.getElementById('wa-large-warn');
    if (warn) warn.style.display = (parseFloat(val) >= LARGE_AMOUNT_THRESHOLD) ? 'flex' : 'none';
  };

  window.wsecSubmitAdjust = async function (uid, userName, balanceBefore) {
    if (!_isSessionValid()) {
      closeModal();
      wsecShowGate(() => wsecOpenAdjust(uid));
      return;
    }

    const action = window._wsecCurrentAction || 'credit';
    const amount = parseFloat(document.getElementById('wa-amount')?.value || '0');
    const note   = (document.getElementById('wa-note')?.value || '').trim();
    const btn    = document.getElementById('wa-submit-btn');

    /* تحقق من المدخلات */
    if (!amount || amount <= 0)     { toast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'error'); return; }
    if (!note)                       { toast('يرجى إدخال سبب العملية — مطلوب للتدقيق', 'error'); return; }
    if (action === 'debit' && amount > balanceBefore) {
      toast(`الرصيد الحالي (${balanceBefore} ر.ي) أقل من المبلغ المطلوب خصمه`, 'error');
      return;
    }

    /* تأكيد مزدوج للمبالغ الكبيرة */
    if (amount >= LARGE_AMOUNT_THRESHOLD) {
      if (!confirm(`⚠️ تأكيد مزدوج مطلوب\n\nأنت على وشك ${action==='credit'?'إضافة':action==='debit'?'خصم':'تعيين'} ${amount} ريال\nالمستخدم: ${userName}\nالسبب: ${note}\n\nهل أنت متأكد تماماً؟`)) return;
    }

    btn.disabled    = true;
    btn.textContent = '⏳ جاري التنفيذ...';

    try {
      let balanceAfter = balanceBefore;

      await db.runTransaction(async t => {
        const ref = db.collection('wallets').doc(uid);
        const doc = await t.get(ref);
        const cur = doc.exists ? (doc.data().balance || 0) : 0;

        if (action === 'credit') {
          balanceAfter = cur + amount;
          t.set(ref, { balance: balanceAfter, uid }, { merge: true });
        } else if (action === 'debit') {
          if (cur < amount) throw new Error(`رصيد غير كافٍ: المتاح ${cur} ر.ي`);
          balanceAfter = cur - amount;
          t.set(ref, { balance: balanceAfter, uid }, { merge: true });
        } else if (action === 'set') {
          balanceAfter = amount;
          t.set(ref, { balance: balanceAfter, uid }, { merge: true });
        }
      });

      /* تسجيل في جدول transactions */
      const txType = action === 'credit' ? 'credit' : action === 'debit' ? 'debit' : 'admin_set';
      await fsAdd('transactions', {
        uid,
        type:      txType,
        amount,
        note:      `[إداري] ${note}`,
        adminUid:  State.currentUser?.uid,
        adminName: State.currentUser?.displayName || State.currentUser?.email || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      /* سجل التدقيق */
      await _writeAuditLog({
        targetUid:   uid,
        targetName:  userName,
        action,
        amount,
        balanceBefore,
        balanceAfter,
        note,
      });

      /* تحديث AppData محلياً */
      if (AppData.wallets) {
        if (!AppData.wallets[uid]) AppData.wallets[uid] = { uid };
        AppData.wallets[uid].balance = balanceAfter;
      }

      closeModal();
      const actionLabel = { credit:'✅ تمت إضافة', debit:'✅ تم خصم', set:'✅ تم تعيين' }[action];
      toast(`${actionLabel} ${amount.toLocaleString('ar-YE')} ريال من محفظة ${userName}`, 'success');

      /* إعادة رسم الصفحة */
      await render();

    } catch (err) {
      console.error('[WalletSecurity] خطأ في تعديل المحفظة:', err);
      toast(err.message || 'حدث خطأ أثناء تنفيذ العملية', 'error');
      await _writeAuditLog({
        targetUid:  uid,
        targetName: userName,
        action:     `${action}_failed`,
        amount,
        note:       `فشل: ${err.message}`,
      });
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✅ تنفيذ العملية';
      }
    }
  };

  /* ══════════════════════════════════════════════════════════
     سجل التدقيق الكامل
  ══════════════════════════════════════════════════════════ */
  let _auditLogs       = null;
  let _auditFilter     = 'all';
  let _auditLoading    = false;

  window.renderAdminWalletAudit = function () {
    if (!_isSessionValid()) {
      return `
      <div style="padding:40px;text-align:center;font-family:'Cairo',sans-serif">
        <div style="font-size:48px;margin-bottom:12px">🔐</div>
        <div style="font-size:16px;font-weight:900;color:var(--text);margin-bottom:8px">مطلوب المصادقة</div>
        <button onclick="wsecShowGate(function(){ setAdminTab('wallet_audit'); })"
                style="background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:none;border-radius:12px;padding:12px 28px;font-size:14px;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif">
          🔓 فتح سجل التدقيق
        </button>
      </div>`;
    }

    if (!_auditLogs && !_auditLoading) {
      _auditLoading = true;
      db.collection(AUDIT_COLLECTION)
        .orderBy('timestamp', 'desc')
        .limit(300)
        .get()
        .then(snap => {
          _auditLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          _auditLoading = false;
          const wrap = document.getElementById('wsec-audit-content');
          if (wrap) wrap.innerHTML = _renderAuditTable(_auditLogs, _auditFilter);
        })
        .catch(err => {
          _auditLoading = false;
          const wrap = document.getElementById('wsec-audit-content');
          if (wrap) wrap.innerHTML = `<div class="wsec-empty">⚠️ فشل تحميل السجل: ${_esc(err.message)}</div>`;
        });
    }

    return `
    <div class="wsec-wrap">
      <div class="wsec-header">
        <div class="wsec-title">📋 سجل تدقيق المحافظ</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="wsecExportAuditPDF(_auditFilter||'all')"
                  style="background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:none;border-radius:10px;padding:8px 16px;font-size:12px;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif;display:flex;align-items:center;gap:5px">
            📄 تصدير PDF
          </button>
          <button onclick="_auditLogs=null;setAdminTab('wallet_audit')"
                  style="background:var(--card-bg);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif">
            🔄 تحديث
          </button>
          <button onclick="setAdminTab('wallet')"
                  style="background:var(--card-bg);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif">
            ← إدارة المحافظ
          </button>
        </div>
      </div>

      <div class="wsec-audit-filters">
        <span style="font-size:12px;color:var(--text-muted);font-weight:700">فلترة:</span>
        <button class="wsec-audit-filter active" id="af-all"    onclick="wsecAuditFilter('all')">الكل</button>
        <button class="wsec-audit-filter"        id="af-credit" onclick="wsecAuditFilter('credit')">➕ إضافة</button>
        <button class="wsec-audit-filter"        id="af-debit"  onclick="wsecAuditFilter('debit')">➖ خصم</button>
        <button class="wsec-audit-filter"        id="af-set"    onclick="wsecAuditFilter('set')">✏️ تعيين</button>
        <button class="wsec-audit-filter"        id="af-gate_access" onclick="wsecAuditFilter('gate_access')">🔓 دخول</button>
        <button class="wsec-audit-filter"        id="af-gate_locked" onclick="wsecAuditFilter('gate_locked')">🔒 تجميد</button>
      </div>

      <div id="wsec-audit-content">
        ${_auditLogs
          ? _renderAuditTable(_auditLogs, _auditFilter)
          : `<div class="wsec-empty">⏳ جاري تحميل سجل التدقيق...</div>`
        }
      </div>
    </div>`;
  };

  window.wsecAuditFilter = function (f) {
    _auditFilter = f;
    document.querySelectorAll('.wsec-audit-filter').forEach(b => b.classList.remove('active'));
    const active = document.getElementById(`af-${f}`);
    if (active) active.classList.add('active');
    const wrap = document.getElementById('wsec-audit-content');
    if (wrap && _auditLogs) wrap.innerHTML = _renderAuditTable(_auditLogs, f);
  };

  function _renderAuditTable(logs, filter) {
    let rows = logs;
    if (filter && filter !== 'all') rows = logs.filter(l => l.action === filter || l.action === `${filter}_failed`);
    if (!rows.length) return `<div class="wsec-empty">لا توجد سجلات للعرض</div>`;

    const actionLabel = {
      credit:       '<span class="wsec-badge credit">➕ إضافة</span>',
      debit:        '<span class="wsec-badge debit">➖ خصم</span>',
      set:          '<span class="wsec-badge set">✏️ تعيين</span>',
      gate_access:  '<span class="wsec-badge view">🔓 دخول</span>',
      gate_locked:  '<span class="wsec-badge debit">🔒 تجميد</span>',
      credit_failed:'<span class="wsec-badge debit">❌ إضافة فاشلة</span>',
      debit_failed: '<span class="wsec-badge debit">❌ خصم فاشل</span>',
      set_failed:   '<span class="wsec-badge debit">❌ تعيين فاشل</span>',
    };

    const tableRows = rows.map(log => `
    <tr>
      <td style="white-space:nowrap;font-size:11px">${_fmtTs(log.timestamp)}</td>
      <td>
        <span class="wsec-badge ${log.adminRole === 'admin' ? 'admin' : 'staff'}">
          ${log.adminRole === 'admin' ? '👑' : '🧑‍💼'} ${_esc(log.adminName || '—')}
        </span>
      </td>
      <td style="font-size:11px;color:var(--text-muted)">${_roleName(log.adminRole)}</td>
      <td>${actionLabel[log.action] || `<span class="wsec-badge view">${_esc(log.action)}</span>`}</td>
      <td>${log.targetName ? _esc(log.targetName) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td style="font-weight:800;color:${log.action==='credit'?'#10b981':log.action==='debit'?'#ef4444':'#a78bfa'}">
        ${log.amount ? `${log.amount.toLocaleString('ar-YE')} ر.ي` : '—'}
      </td>
      <td style="font-size:11px;color:var(--text-muted)">
        ${log.balanceBefore != null ? log.balanceBefore.toLocaleString('ar-YE') : '—'}
        ${log.balanceAfter  != null ? ` → ${log.balanceAfter.toLocaleString('ar-YE')}` : ''}
      </td>
      <td style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(log.note)}">
        ${_esc(log.note || '—')}
      </td>
    </tr>`).join('');

    return `
    <div class="wsec-audit-table-wrap">
      <table class="wsec-audit-table">
        <thead>
          <tr>
            <th>التاريخ والوقت</th>
            <th>المدير / الموظف</th>
            <th>الدور</th>
            <th>العملية</th>
            <th>المستخدم المستهدف</th>
            <th>المبلغ</th>
            <th>الرصيد (قبل → بعد)</th>
            <th>السبب</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <p style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:12px;font-family:'Cairo',sans-serif">
      🛡️ هذا السجل دائم ومحمي — لا يمكن حذفه أو تعديله
    </p>`;
  }

  /* ══════════════════════════════════════════════════════════
     تصدير سجل التدقيق إلى PDF
  ══════════════════════════════════════════════════════════ */
  window.wsecExportAuditPDF = async function (filterKey) {
    if (!_isSessionValid()) {
      wsecShowGate(() => wsecExportAuditPDF(filterKey));
      return;
    }

    /* التحقق من وجود مكتبات PDF */
    const hasLibs = () => !!(window.html2canvas && window.jspdf?.jsPDF);
    if (!hasLibs()) {
      toast('⏳ جاري تحميل مكتبة PDF...', 'info');
      await new Promise(r => setTimeout(r, 3000));
      if (!hasLibs()) { toast('فشل تحميل مكتبة PDF', 'error'); return; }
    }

    toast('⏳ جاري إنشاء التقرير...', 'info');

    /* جلب السجلات إن لم تكن محمّلة */
    let logs = _auditLogs;
    if (!logs) {
      try {
        const snap = await db.collection(AUDIT_COLLECTION)
          .orderBy('timestamp', 'desc').limit(500).get();
        logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _auditLogs = logs;
      } catch (e) {
        toast('فشل تحميل السجلات: ' + e.message, 'error');
        return;
      }
    }

    /* فلترة */
    let rows = logs;
    if (filterKey && filterKey !== 'all') {
      rows = logs.filter(l => l.action === filterKey || l.action === `${filterKey}_failed`);
    }

    const me        = State.currentUser;
    const adminName = me?.displayName || me?.name || me?.email || '—';
    const now       = new Date();
    const nowStr    = now.toLocaleString('ar-YE', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });
    const filename  = `wallet-audit-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.pdf`;

    /* ملخصات */
    const totCredit = rows.filter(r => r.action === 'credit').reduce((s, r) => s + (r.amount || 0), 0);
    const totDebit  = rows.filter(r => r.action === 'debit') .reduce((s, r) => s + (r.amount || 0), 0);
    const totOps    = rows.filter(r => ['credit','debit','set'].includes(r.action)).length;
    const totAccess = rows.filter(r => r.action === 'gate_access').length;

    const actionText = {
      credit:       'إضافة رصيد',
      debit:        'خصم رصيد',
      set:          'تعيين رصيد',
      gate_access:  'دخول اللوحة',
      gate_locked:  'تجميد وصول',
      credit_failed:'إضافة فاشلة',
      debit_failed: 'خصم فاشل',
      set_failed:   'تعيين فاشل',
    };

    /* بناء صفوف الجدول */
    const tableRows = rows.map((log, i) => {
      const bg  = i % 2 === 0 ? '#ffffff' : '#f9fafb';
      const clr = log.action === 'credit' ? '#059669'
                : log.action === 'debit'  ? '#dc2626'
                : log.action.includes('failed') ? '#b91c1c'
                : '#374151';
      return `
      <tr style="background:${bg}">
        <td style="padding:7px 10px;font-size:11px;color:#6b7280;white-space:nowrap;border-bottom:1px solid #f3f4f6">${_fmtTs(log.timestamp)}</td>
        <td style="padding:7px 10px;font-size:12px;font-weight:700;border-bottom:1px solid #f3f4f6">${_esc(log.adminName || '—')}</td>
        <td style="padding:7px 10px;font-size:11px;color:#6b7280;border-bottom:1px solid #f3f4f6">${_roleName(log.adminRole)}</td>
        <td style="padding:7px 10px;font-size:11px;font-weight:700;color:${clr};border-bottom:1px solid #f3f4f6">${actionText[log.action] || log.action}</td>
        <td style="padding:7px 10px;font-size:12px;border-bottom:1px solid #f3f4f6">${_esc(log.targetName || '—')}</td>
        <td style="padding:7px 10px;font-size:12px;font-weight:800;color:${clr};text-align:center;border-bottom:1px solid #f3f4f6">
          ${log.amount ? log.amount.toLocaleString('ar-YE') + ' ر.ي' : '—'}
        </td>
        <td style="padding:7px 10px;font-size:11px;color:#6b7280;border-bottom:1px solid #f3f4f6">
          ${log.balanceBefore != null ? log.balanceBefore.toLocaleString('ar-YE') : '—'}
          ${log.balanceAfter  != null ? ' ← ' + log.balanceAfter.toLocaleString('ar-YE') : ''}
        </td>
        <td style="padding:7px 10px;font-size:11px;color:#374151;border-bottom:1px solid #f3f4f6;max-width:160px">${_esc(log.note || '—')}</td>
      </tr>`;
    }).join('');

    const filterLabel = filterKey && filterKey !== 'all'
      ? ` — فلترة: ${actionText[filterKey] || filterKey}`
      : '';

    const htmlContent = `
    <div style="direction:rtl;text-align:right;font-family:'Tajawal','Cairo',Tahoma,Arial,sans-serif;color:#1f2937">

      <!-- رأس التقرير -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:3px solid #7c3aed;margin-bottom:20px">
        <div>
          <div style="font-size:26px;font-weight:900;color:#7c3aed;letter-spacing:1px">محجوز</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">منصة الحجوزات والخدمات الشاملة</div>
        </div>
        <div style="text-align:left">
          <div style="font-size:16px;font-weight:800;color:#1f2937">📋 تقرير تدقيق المحافظ${filterLabel}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:3px">تاريخ الإصدار: ${nowStr}</div>
          <div style="font-size:11px;color:#6b7280">أصدره: ${_esc(adminName)}</div>
        </div>
      </div>

      <!-- بيانات التقرير -->
      <div style="background:#f8f7ff;border:1px solid #e9d5ff;border-radius:10px;padding:14px 18px;margin-bottom:20px;font-size:12px;color:#374151">
        <div style="font-weight:800;color:#7c3aed;margin-bottom:8px;font-size:13px">📊 ملخص التقرير</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;text-align:center">
          <div>
            <div style="font-size:20px;font-weight:900;color:#059669">${totCredit.toLocaleString('ar-YE')}</div>
            <div style="font-size:10px;color:#6b7280">إجمالي الإضافات (ر.ي)</div>
          </div>
          <div>
            <div style="font-size:20px;font-weight:900;color:#dc2626">${totDebit.toLocaleString('ar-YE')}</div>
            <div style="font-size:10px;color:#6b7280">إجمالي الخصومات (ر.ي)</div>
          </div>
          <div>
            <div style="font-size:20px;font-weight:900;color:#7c3aed">${totOps}</div>
            <div style="font-size:10px;color:#6b7280">عمليات مالية</div>
          </div>
          <div>
            <div style="font-size:20px;font-weight:900;color:#374151">${rows.length}</div>
            <div style="font-size:10px;color:#6b7280">إجمالي السجلات</div>
          </div>
        </div>
      </div>

      <!-- تحذير أمني -->
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin-bottom:20px;font-size:11px;color:#92400e;display:flex;align-items:center;gap:8px">
        🔒 هذا التقرير سري ومخصص للإدارة فقط — سجل التدقيق محمي من الحذف والتعديل في قاعدة البيانات
      </div>

      <!-- جدول السجلات -->
      ${rows.length === 0 ? `<div style="text-align:center;padding:40px;color:#9ca3af;font-size:14px">لا توجد سجلات للعرض</div>` : `
      <table style="width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed">
        <thead>
          <tr style="background:#7c3aed;color:#fff">
            <th style="padding:9px 10px;text-align:right;font-weight:800;width:16%">التاريخ والوقت</th>
            <th style="padding:9px 10px;text-align:right;font-weight:800;width:13%">المدير</th>
            <th style="padding:9px 10px;text-align:right;font-weight:800;width:8%">الدور</th>
            <th style="padding:9px 10px;text-align:right;font-weight:800;width:11%">العملية</th>
            <th style="padding:9px 10px;text-align:right;font-weight:800;width:13%">المستخدم</th>
            <th style="padding:9px 10px;text-align:center;font-weight:800;width:10%">المبلغ</th>
            <th style="padding:9px 10px;text-align:right;font-weight:800;width:14%">قبل → بعد</th>
            <th style="padding:9px 10px;text-align:right;font-weight:800;width:15%">السبب</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>`}

      <!-- تذييل -->
      <div style="margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;text-align:center;font-size:10px;color:#9ca3af">
        هذا التقرير صادر إلكترونياً ولا يحتاج توقيع — محجوز © ${now.getFullYear()}
        &nbsp;|&nbsp; رقم الجلسة: ${_sessionId}
        &nbsp;|&nbsp; عدد السجلات: ${rows.length}
      </div>
    </div>`;

    /* توليد PDF باستخدام html2canvas + jsPDF */
    try {
      const wrap = document.createElement('div');
      wrap.style.cssText = `
        position:fixed;top:0;left:0;
        width:1100px;min-height:1200px;
        background:#ffffff;color:#1f2937;
        direction:rtl;text-align:right;
        font-family:'Tajawal','Cairo',Tahoma,Arial,sans-serif;
        font-size:13px;line-height:1.8;
        padding:36px 40px;box-sizing:border-box;
        opacity:0;z-index:-1;
      `;
      wrap.innerHTML = htmlContent;
      document.body.appendChild(wrap);

      await new Promise(r => setTimeout(r, 400));
      wrap.style.opacity = '1';
      wrap.style.zIndex  = '9999';
      await new Promise(r => setTimeout(r, 300));

      const canvas = await window.html2canvas(wrap, {
        scale: 1.8,
        backgroundColor: '#ffffff',
        useCORS: true,
        windowWidth: wrap.scrollWidth,
        windowHeight: wrap.scrollHeight,
        logging: false,
      });

      const { jsPDF } = window.jspdf;
      const pdf   = new jsPDF('l', 'mm', 'a4'); /* landscape للجدول العريض */
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW  = pageW;
      const imgH  = (canvas.height * imgW) / canvas.width;

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH, undefined, 'FAST');

      let heightLeft = imgH - pageH;
      let position   = -pageH;
      while (heightLeft > 0) {
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH, undefined, 'FAST');
        heightLeft -= pageH;
        position   -= pageH;
      }

      pdf.save(filename);
      toast(`✅ تم تحميل التقرير — ${rows.length} سجل`, 'success');

      /* تسجيل عملية التصدير في سجل التدقيق */
      await _writeAuditLog({
        action: 'export_pdf',
        note:   `تصدير ${rows.length} سجل إلى PDF${filterLabel}`,
      });

      document.body.removeChild(wrap);
    } catch (err) {
      console.error('[WalletSecurity] خطأ في تصدير PDF:', err);
      toast('فشل إنشاء PDF: ' + (err.message || err), 'error');
      document.querySelector('[style*="z-index: 9999"]')?.remove?.();
    }
  };

  /* ══════════════════════════════════════════════════════════
     نظام إشعارات العمليات المالية الكبيرة — Real-time Alerts
  ══════════════════════════════════════════════════════════ */

  const ALERT_SEEN_KEY      = 'wsec_seen_alerts';
  let _alertsStore          = [];      /* بطاقات إشعارات المحفظة الإدارية */
  let _purchaseAlertsStore  = [];      /* بطاقات إشعارات الشراء/الإيداعات */
  let _alertWatcherUnsub    = null;    /* إلغاء مستمع عمليات المحفظة */
  let _purchaseWatcherUnsub = null;    /* إلغاء مستمع الإيداعات */
  let _panelOpen            = false;
  let _toastQueue           = [];
  let _toastActive          = false;

  /* ── المعرّفات المشاهَدة (localStorage) ── */
  function _getSeenIds() {
    try { return new Set(JSON.parse(localStorage.getItem(ALERT_SEEN_KEY) || '[]')); }
    catch { return new Set(); }
  }
  function _markSeen(id) {
    const s = _getSeenIds();
    s.add(id);
    try { localStorage.setItem(ALERT_SEEN_KEY, JSON.stringify([...s].slice(-200))); } catch {}
  }
  function _isUnseen(id) { return !_getSeenIds().has(id); }

  /* ── عدد الإشعارات غير المقروءة ── */
  function _unreadCount() {
    const seen = _getSeenIds();
    return _alertsStore.filter(a => !seen.has(a.id)).length;
  }

  /* ── إرسال بيانات المحافظ إلى الجرس الموحد ── */
  function _updateBadge() {
    /* تحديث شارة الجرس الخاص بنظام الأمان */
    const badge = document.getElementById('wsec-bell-badge');
    const totalUnread = _unreadCount() + _purchaseUnreadCount();
    if (badge) {
      badge.style.display = totalUnread > 0 ? 'flex' : 'none';
      badge.textContent   = totalUnread > 99 ? '99+' : String(totalUnread);
    }

    /* تحديث الجرس الموحد إن وُجد */
    if (typeof window.__unifiedNotif === 'undefined') return;
    const seen = _getSeenIds();
    const walletItems = _alertsStore.map(a => {
      const m = _alertMeta(a.action);
      return {
        icon:   m.icon,
        title:  `${m.label} — ${(a.amount || 0).toLocaleString('ar-YE')} ر.ي`,
        sub:    [a.targetName, a.adminName].filter(Boolean).join(' · '),
        time:   _fmtTs(a.timestamp),
        nav:    'wallet_audit',
        unread: !seen.has(a.id),
      };
    });
    const purchaseItems = _purchaseAlertsStore.map(a => ({
      icon:   '🏦',
      title:  `إيداع/شراء كبير — ${(a.amount || 0).toLocaleString('ar-YE')} ر.ي`,
      sub:    a.customerName || '—',
      time:   _fmtTs(a.createdAt || a.timestamp),
      nav:    'wallet',
      unread: !seen.has(a.id),
    }));
    const allItems    = [...purchaseItems, ...walletItems];
    const unreadCount = allItems.filter(i => i.unread).length;
    window.__unifiedNotif.update('wallet', allItems, unreadCount);
  }

  /* ── عدد الإيداعات غير المقروءة ── */
  function _purchaseUnreadCount() {
    const seen = _getSeenIds();
    return _purchaseAlertsStore.filter(a => !seen.has(a.id)).length;
  }

  /* ── الأيقونة والألوان حسب نوع العملية (محفظة إدارية) ── */
  function _alertMeta(action) {
    if (action === 'credit') return { icon:'💰', color:'#10b981', cls:'credit', label:'إضافة رصيد كبيرة' };
    if (action === 'debit')  return { icon:'🔴', color:'#ef4444', cls:'debit',  label:'خصم رصيد كبير'  };
    if (action === 'set')    return { icon:'✏️', color:'#a78bfa', cls:'set',    label:'تعيين رصيد'     };
    return { icon:'⚠️', color:'#fbbf24', cls:'set', label:'عملية مالية' };
  }

  /* ── الأيقونة والألوان لإشعارات الشراء/الإيداع ── */
  function _purchaseMeta(deposit) {
    return { icon:'🏦', color:'#3b82f6', cls:'credit', label:'إيداع / شراء كبير' };
  }

  /* ── توست الإشعار المنزلق ── */
  function _showToastAlert(alert) {
    _toastQueue.push(alert);
    if (!_toastActive) _processToastQueue();
  }

  function _processToastQueue() {
    if (!_toastQueue.length) { _toastActive = false; return; }
    _toastActive = true;
    const alert = _toastQueue.shift();
    const m     = _alertMeta(alert.action);
    const id    = 'wsta-' + Date.now();

    const div = document.createElement('div');
    div.className = 'wsec-toast-alert';
    div.id = id;
    div.innerHTML = `
      <div class="wsec-ta-icon">${m.icon}</div>
      <div class="wsec-ta-body">
        <div class="wsec-ta-title">${m.label}</div>
        <div class="wsec-ta-amount" style="color:${m.color}">
          ${alert.amount?.toLocaleString('ar-YE') || '—'} ر.ي
        </div>
        <div class="wsec-ta-meta">
          ${_esc(alert.targetName || '—')} · بواسطة: ${_esc(alert.adminName || '—')}
        </div>
        ${alert.note ? `<div class="wsec-ta-meta" style="color:rgba(255,255,255,0.6)">${_esc(alert.note)}</div>` : ''}
      </div>
      <button class="wsec-ta-close" onclick="document.getElementById('${id}')?.remove()">✕</button>
    `;
    document.body.appendChild(div);

    /* رنين الجرس */
    const bell = document.getElementById('wsec-alert-bell');
    if (bell) {
      bell.classList.remove('ringing');
      void bell.offsetWidth;
      bell.classList.add('ringing');
      setTimeout(() => bell.classList.remove('ringing'), 1600);
    }

    /* إزالة تلقائية بعد 8 ثواني */
    setTimeout(() => {
      div.classList.add('removing');
      setTimeout(() => { div.remove(); _processToastQueue(); }, 350);
    }, 8000);
  }

  /* ── رسم لوحة الإشعارات ── */
  function _renderAlertsPanel() {
    const panel = document.getElementById('wsec-alerts-panel');
    if (!panel) return;

    const seen = _getSeenIds();

    /* دمج إشعارات المحفظة والإيداعات مع تمييز النوع */
    const allAlerts = [
      ..._alertsStore.map(a => ({ ...a, _type: 'wallet' })),
      ..._purchaseAlertsStore.map(a => ({ ...a, _type: 'purchase' })),
    ].sort((a, b) => {
      const ta = a.timestamp?.seconds || a.timestamp?.getTime?.() / 1000 || 0;
      const tb = b.timestamp?.seconds || b.timestamp?.getTime?.() / 1000 || 0;
      return tb - ta;
    });

    const list = allAlerts.length === 0
      ? `<div class="wsec-ap-empty">🔕 لا توجد عمليات مالية كبيرة حتى الآن</div>`
      : allAlerts.map(a => {
          const isPurchase = a._type === 'purchase';
          const m   = isPurchase ? _purchaseMeta(a) : _alertMeta(a.action);
          const cls = seen.has(a.id) ? '' : ' unread';
          const nameRow = isPurchase
            ? `${_esc(a.customerName || '—')}`
            : `${_esc(a.targetName||'—')} · ${_esc(a.adminName||'—')}`;
          return `
          <div class="wsec-alert-card${cls}" onclick="${isPurchase ? `wsecPurchaseAlertClick('${a.id}')` : `wsecAlertCardClick('${a.id}')`}">
            <div class="wsec-alert-icon">${m.icon}</div>
            <div class="wsec-alert-body">
              <div class="wsec-alert-title">${m.label}</div>
              <div class="wsec-alert-amount ${m.cls}">${(a.amount||0).toLocaleString('ar-YE')} ر.ي</div>
              <div class="wsec-alert-meta">${nameRow}</div>
              <div class="wsec-alert-meta">${_fmtTs(a.timestamp || a.createdAt)}</div>
              ${a.note ? `<div class="wsec-alert-meta" style="color:var(--text)">${_esc(a.note)}</div>` : ''}
            </div>
            ${!seen.has(a.id) ? '<div class="wsec-alert-dot"></div>' : ''}
          </div>`;
        }).join('');

    panel.innerHTML = `
      <div class="wsec-ap-header">
        <div class="wsec-ap-title">🔔 تنبيهات المالية
          <span style="font-size:10px;color:var(--text-muted);font-weight:400;display:block;margin-top:2px">
            💰 محفظة ≥${LARGE_AMOUNT_THRESHOLD.toLocaleString('ar-YE')} · 🏦 إيداعات ≥${PURCHASE_ALERT_THRESHOLD.toLocaleString('ar-YE')} ر.ي
          </span>
        </div>
        <div class="wsec-ap-actions">
          <button class="wsec-ap-btn" onclick="wsecMarkAllAlerts()">✓ تعليم الكل مقروء</button>
          <button class="wsec-ap-btn" onclick="wsecToggleAlertsPanel()">✕</button>
        </div>
      </div>
      <div class="wsec-ap-list">${list}</div>`;
  }

  /* ── تبديل اللوحة ── */
  window.wsecToggleAlertsPanel = function () {
    let panel = document.getElementById('wsec-alerts-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'wsec-alerts-panel';
      document.body.appendChild(panel);
    }
    _panelOpen = !_panelOpen;
    if (_panelOpen) {
      _renderAlertsPanel();
      /* تأخير للـ CSS transition يعمل */
      requestAnimationFrame(() => panel.classList.add('open'));
    } else {
      panel.classList.remove('open');
      setTimeout(() => { if (!_panelOpen) panel.style.display = 'none'; }, 260);
    }
  };

  /* ── النقر على بطاقة إشعار ── */
  window.wsecAlertCardClick = function (id) {
    _markSeen(id);
    _updateBadge();
    _renderAlertsPanel();
    /* الانتقال لتبويب سجل التدقيق */
    if (typeof setAdminTab === 'function') {
      wsecToggleAlertsPanel();
      setTimeout(() => setAdminTab('wallet_audit'), 200);
    }
  };

  /* ── تعليم الكل مقروء ── */
  window.wsecMarkAllAlerts = function () {
    _alertsStore.forEach(a => _markSeen(a.id));
    _purchaseAlertsStore.forEach(a => _markSeen(a.id));
    _updateBadge();
    _renderAlertsPanel();
  };

  /* ── النقر على بطاقة إشعار إيداع/شراء ── */
  window.wsecPurchaseAlertClick = function (id) {
    _markSeen(id);
    _updateBadge();
    _renderAlertsPanel();
    if (typeof setAdminTab === 'function') {
      wsecToggleAlertsPanel();
      setTimeout(() => setAdminTab('wallet'), 200);
    }
  };

  /* ── إنشاء/تحديث جرس الجرس ── */
  function _ensureBell() {
    if (document.getElementById('wsec-alert-bell')) return;
    const btn = document.createElement('button');
    btn.id = 'wsec-alert-bell';
    btn.setAttribute('aria-label', 'إشعارات المحافظ');
    btn.innerHTML = `🔔<span id="wsec-bell-badge"></span>`;
    btn.onclick = wsecToggleAlertsPanel;
    document.body.appendChild(btn);
    _updateBadge();
  }

  /* ── بدء مراقبة عمليات المحفظة الإدارية الكبيرة ── */
  function _startLargeAmountWatcher() {
    if (_alertWatcherUnsub) {
      _alertWatcherUnsub();
      _alertWatcherUnsub = null;
      _alertsStore = [];
    }

    const startTime = firebase.firestore.Timestamp.now();

    _alertWatcherUnsub = db.collection(AUDIT_COLLECTION)
      .where('amount', '>=', LARGE_AMOUNT_THRESHOLD)
      .orderBy('amount', 'desc')
      .limit(50)
      .onSnapshot(snap => {
        snap.docChanges().forEach(change => {
          if (change.type !== 'added') return;
          const data  = change.doc.data();
          const docId = change.doc.id;

          if (!['credit','debit','set'].includes(data.action)) return;

          const ts = data.timestamp;
          const docTime = ts?.seconds ? ts.seconds : (ts instanceof Date ? ts.getTime()/1000 : 0);
          const isNew = docTime >= startTime.seconds;

          const exists = _alertsStore.some(a => a.id === docId);
          if (!exists) {
            _alertsStore.unshift({ id: docId, ...data });
            if (_alertsStore.length > 50) _alertsStore.pop();
          }

          if (isNew && _isUnseen(docId)) {
            _showToastAlert({ id: docId, ...data });
          }
        });

        _updateBadge();

      }, err => {
        console.warn('[WalletSecurity] فشل مراقبة الإشعارات:', err.message);
      });

    console.log(`[WalletSecurity] مراقب عمليات المحفظة نشط (≥${LARGE_AMOUNT_THRESHOLD} ر.ي) 🔔`);
  }

  /* ── بدء مراقبة الإيداعات والمشتريات الكبيرة ── */
  function _startPurchaseWatcher() {
    if (_purchaseWatcherUnsub) {
      _purchaseWatcherUnsub();
      _purchaseWatcherUnsub = null;
      _purchaseAlertsStore = [];
    }

    const startTime = firebase.firestore.Timestamp.now();

    _purchaseWatcherUnsub = db.collection('bank_deposits')
      .where('amount', '>=', PURCHASE_ALERT_THRESHOLD)
      .orderBy('amount', 'desc')
      .limit(50)
      .onSnapshot(snap => {
        snap.docChanges().forEach(change => {
          if (change.type !== 'added') return;
          const data  = change.doc.data();
          const docId = change.doc.id;

          /* تحقق من الوقت: فقط الإيداعات الجديدة */
          const ts = data.createdAt;
          let docTime = 0;
          if (ts?.seconds)          docTime = ts.seconds;
          else if (ts instanceof Date) docTime = ts.getTime() / 1000;
          else if (typeof ts === 'number') docTime = ts;
          const isNew = docTime >= startTime.seconds;

          const exists = _purchaseAlertsStore.some(a => a.id === docId);
          if (!exists) {
            _purchaseAlertsStore.unshift({ id: docId, ...data });
            if (_purchaseAlertsStore.length > 50) _purchaseAlertsStore.pop();
          }

          if (isNew && _isUnseen(docId)) {
            /* توست خاص بالإيداعات */
            _showToastAlert({
              id:         docId,
              action:     'purchase',
              amount:     data.amount,
              targetName: data.customerName || '—',
              adminName:  '',
              note:       data.bankName ? `إيداع بنكي — ${data.bankName}` : 'إيداع/شراء',
              timestamp:  data.createdAt,
            });
          }
        });

        _updateBadge();

      }, err => {
        console.warn('[WalletSecurity] فشل مراقبة الإيداعات:', err.message);
      });

    console.log(`[WalletSecurity] مراقب الإيداعات نشط (≥${PURCHASE_ALERT_THRESHOLD} ر.ي) 🏦`);
  }

  /* ── إعادة تحميل الحدود وإعادة تشغيل المراقبين ── */
  window.wsecReloadThresholds = function (walletThreshold, purchaseThreshold) {
    LARGE_AMOUNT_THRESHOLD   = walletThreshold   || DEFAULT_WALLET_THRESHOLD;
    PURCHASE_ALERT_THRESHOLD = purchaseThreshold || DEFAULT_PURCHASE_THRESHOLD;
    _startLargeAmountWatcher();
    _startPurchaseWatcher();
    console.log(`[WalletSecurity] تم تحديث الحدود: محفظة=${LARGE_AMOUNT_THRESHOLD}، إيداعات=${PURCHASE_ALERT_THRESHOLD}`);
  };

  /* ── تهيئة النظام عند جاهزية المستخدم الإداري ── */
  async function _initAlertSystem() {
    const me = State.currentUser;
    if (!me || !['admin','staff'].includes(me.role)) return;

    /* تحميل الحدود من Firestore قبل بدء المراقبة */
    try {
      const doc = await db.collection('platform_settings').doc('main').get();
      if (doc.exists) {
        const d = doc.data();
        if (d.walletAlertThreshold   > 0) LARGE_AMOUNT_THRESHOLD   = d.walletAlertThreshold;
        if (d.purchaseAlertThreshold > 0) PURCHASE_ALERT_THRESHOLD = d.purchaseAlertThreshold;
      }
    } catch (e) {
      console.warn('[WalletSecurity] تعذّر تحميل حدود التنبيه، سيُستخدم الافتراضي:', e.message);
    }

    _startLargeAmountWatcher();
    _startPurchaseWatcher();
  }

  /* ── انتظر حتى يصبح State.currentUser جاهزاً ── */
  let _initTries = 0;
  const _initInterval = setInterval(() => {
    _initTries++;
    const me = State.currentUser;
    if (me && me.role && me.role !== 'guest') {
      clearInterval(_initInterval);
      _initAlertSystem();
    } else if (_initTries > 60) {
      clearInterval(_initInterval);
    }
  }, 500);

  /* تنظيف المراقبين عند إغلاق الصفحة */
  window.addEventListener('beforeunload', () => {
    if (_alertWatcherUnsub)    _alertWatcherUnsub();
    if (_purchaseWatcherUnsub) _purchaseWatcherUnsub();
  });

  console.log('[WalletSecurity] نظام أمان المحافظ المتكامل جاهز 🔐');
})();

// ═══════════════════════════════════════════════════════
//  محجوز v2.3 — Phase 3
//  - Drill-down statistics (clickable stat cards)
//  - Customer Service (CS) role + permissions
//  - Manual account creation by admin
//  - Wallet enhancements (manual adjust)
//  - Send invoice via WhatsApp / Email
//  - In-app notifications bell with dropdown
// ═══════════════════════════════════════════════════════
'use strict';

// ─── Translations ─────────────────────────────────────
(function () {
  if (typeof I18N === 'undefined') return;
  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };
  add('drill_users', 'قائمة المستخدمين', 'Users list');
  add('drill_vendors', 'قائمة أصحاب الخدمات', 'Vendors list');
  add('drill_customers', 'قائمة العملاء', 'Customers list');
  add('drill_orders', 'كل الطلبات', 'All orders');
  add('drill_completed', 'الطلبات المكتملة', 'Completed orders');
  add('drill_revenue', 'تفاصيل الإيرادات', 'Revenue breakdown');
  add('cs_role', 'خدمة العملاء', 'Customer Service');
  add('permissions', 'الصلاحيات', 'Permissions');
  add('perm_view_orders', 'عرض الطلبات', 'View orders');
  add('perm_edit_orders', 'تعديل الطلبات', 'Edit orders');
  add('perm_create_users', 'إنشاء حسابات', 'Create accounts');
  add('perm_chat_customers', 'محادثة العملاء', 'Chat with customers');
  add('perm_view_wallets', 'عرض المحافظ', 'View wallets');
  add('perm_adjust_wallets', 'تعديل المحافظ', 'Adjust wallets');
  add('perm_view_reports', 'عرض التقارير', 'View reports');
  add('add_user_manual', 'إضافة مستخدم جديد', 'Add new user');
  add('adjust_wallet', 'تعديل الرصيد', 'Adjust balance');
  add('send_invoice', 'إرسال الفاتورة', 'Send invoice');
  add('send_via_whatsapp', 'واتساب', 'WhatsApp');
  add('send_via_email', 'بريد', 'Email');
  add('notifications', 'الإشعارات', 'Notifications');
  add('no_notifications', 'لا توجد إشعارات', 'No notifications');
  add('mark_all_read', 'تعليم الكل كمقروء', 'Mark all read');
  add('amount_to_credit', 'مبلغ الإضافة (ريال)', 'Amount to credit (YER)');
  add('amount_to_debit', 'مبلغ الخصم (ريال)', 'Amount to debit (YER)');
  add('reason', 'السبب', 'Reason');
  if (typeof applyLang === 'function') applyLang();
})();

// ─── Default permissions per role ─────────────────────
const DEFAULT_PERMS = {
  admin:    { view_orders:true, edit_orders:true, create_users:true, chat_customers:true, view_wallets:true, adjust_wallets:true, view_reports:true },
  cs:       { view_orders:true, edit_orders:true, create_users:false, chat_customers:true, view_wallets:true, adjust_wallets:false, view_reports:true },
  staff:    { view_orders:true, edit_orders:true, create_users:false, chat_customers:false, view_wallets:false, adjust_wallets:false, view_reports:false },
  vendor:   {},
  driver:   {},
  customer: {},
  guest:    {},
};
function userHasPerm(u, perm) {
  if (!u) return false;
  if (u.role === 'admin') return true;
  const p = u.permissions || DEFAULT_PERMS[u.role] || {};
  return !!p[perm];
}
window.userHasPerm = userHasPerm;

// getSecondaryAuth is now in core.js

// ─── Notifications collection helpers ─────────────────
async function pushNotification({ uid, title, body, type = 'info', link = null }) {
  try {
    await db.collection('user_notifications').add({
      uid, title, body, type, link, read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) { console.warn('pushNotification failed:', e); }
}
window.pushNotification = pushNotification;

async function loadMyNotifications(uid, limit = 20) {
  try {
    const snap = await Promise.race([
      db.collection('user_notifications').where('uid', '==', uid).limit(limit).get(),
      new Promise(r => setTimeout(() => r({ docs: [] }), 4000)),
    ]);
    return (snap.docs || []).map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (e) { return []; }
}

// ─── Notification bell (added to navbar) ───────────────
async function refreshNotifBell() {
  const u = State.currentUser;
  if (!u) return;
  const list = await loadMyNotifications(u.uid);
  State._notifs = list;
  const unread = list.filter(n => !n.read).length;
  window.__unifiedNotif?.update('notif', list, unread);
}

function toggleNotifPanel() {
  if (typeof window.toggleUnifiedNotif === 'function') {
    window.toggleUnifiedNotif();
  }
}

function renderNotifPanel() {
  const p = document.getElementById('notif-panel');
  if (!p) return;
  const list = State._notifs || [];
  p.innerHTML = `
    <div class="notif-head">
      <strong>${t('notifications')}</strong>
      ${list.some(n => !n.read) ? `<button class="link-btn" onclick="markAllNotifsRead()">${t('mark_all_read')}</button>` : ''}
    </div>
    <div class="notif-body">
      ${list.length ? list.map(n => `
        <div class="notif-item ${n.read ? 'read' : 'unread'}" onclick="onNotifClick('${n.id}', ${n.link ? `'${n.link}'` : 'null'})">
          <div class="notif-dot ${n.type || 'info'}"></div>
          <div style="flex:1">
            <div class="notif-title">${escHtml(n.title || '')}</div>
            ${n.body ? `<div class="notif-body-txt">${escHtml(n.body)}</div>` : ''}
            <div class="notif-time">${typeof fmtDate === 'function' ? fmtDate(n.createdAt) : ''}</div>
          </div>
        </div>`).join('') :
        `<div class="notif-empty">🔔 ${t('no_notifications')}</div>`}
    </div>`;
}

async function onNotifClick(id, link) {
  try { await db.collection('user_notifications').doc(id).update({ read: true }); } catch (e) {}
  await refreshNotifBell();
  document.getElementById('notif-panel')?.classList.remove('show');
  if (link) {
    const [page, paramsJson] = link.split('?');
    let params = {};
    if (paramsJson) try { params = JSON.parse(decodeURIComponent(paramsJson)); } catch(e) {}
    navigate(page, params);
  }
}

async function markAllNotifsRead() {
  const list = State._notifs || [];
  await Promise.all(list.filter(n => !n.read).map(n =>
    db.collection('user_notifications').doc(n.id).update({ read: true }).catch(() => {})
  ));
  await refreshNotifBell();
  renderNotifPanel();
}

document.addEventListener('click', (e) => {
  const p = document.getElementById('notif-panel');
  if (!p || !p.classList.contains('show')) return;
  if (e.target.closest('#notif-bell-wrap')) return;
  p.classList.remove('show');
});

// ─── Inject the bell into the navbar after each render ─
const __originalRender = window.render;
window.render = async function (...args) {
  let result;
  try {
    result = await __originalRender.apply(this, args);
  } catch (e) {
    console.error('render() failed:', e?.message || String(e), '\nstack:', e?.stack || '(no stack)', '\nraw:', e);
    // Surface the failure to the UI so the page is never silently blank
    try {
      const app = document.getElementById('app');
      if (app) app.innerHTML = `
        <div style="min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center">
          <div style="font-size:48px">⚠️</div>
          <h2 style="color:var(--text-main,#fff);margin:0">حدث خطأ أثناء تحميل الصفحة</h2>
          <div style="color:var(--text-secondary,#aaa);max-width:520px;font-size:14px">
            ${escHtml ? escHtml(e?.message || String(e)) : (e?.message || String(e))}
          </div>
          <button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>
          <button class="btn btn-secondary" onclick="State.currentPage='login';navigate('login')">العودة لتسجيل الدخول</button>
        </div>`;
    } catch(_) {}
  }
  try { injectNotifBell(); } catch (e) { console.warn('injectNotifBell:', e); }
  return result;
};

function injectNotifBell() {
  refreshNotifBell();
}

// ─── DRILL-DOWN STATS — override renderAdminDash ──────
function renderAdminDash() {
  const users = AppData.users || [];
  const activeOrders = AppData.orders || [];
  const archivedOrders = AppData.archivedOrders || [];
  const orders = [...activeOrders, ...archivedOrders];
  const transactions = AppData.transactions || [];
  const rechargeReqs = AppData.rechargeReqs || [];

  const stats = {
    users: users.filter(u => u.role !== 'admin'),
    vendors: users.filter(u => u.role === 'vendor'),
    customers: users.filter(u => u.role === 'customer'),
    staff: users.filter(u => u.role === 'staff'),
    drivers: users.filter(u => u.role === 'driver'),
    orders: orders,
    pendingOrders: orders.filter(o => o.status === 'pending'),
    completedOrders: orders.filter(o => o.status === 'completed'),
    cancelledOrders: orders.filter(o => o.status === 'cancelled'),
    services: AppData.services || [],
    cats: AppData.cats || [],
    revenueDebit: transactions.filter(t => t.type === 'debit'),
    pendingRecharges: rechargeReqs.filter(r => r.status === 'pending'),
  };
  const totalRevenue = stats.revenueDebit.reduce((a, t) => a + (Number(t.amount) || 0), 0);


  const card = (title, num, key, color) => `
    <button class="stat-card stat-clickable" onclick="drillStat('${key}')" style="${color ? 'border-color:' + color : ''}">
      <div class="stat-num">${num}</div>
      <div class="stat-label">${title}</div>
      <span class="stat-arrow">←</span>
    </button>`;

  return `
    <h2>لوحة الإحصائيات</h2>
    <p style="color:var(--text-muted);margin-bottom:16px">انقر على أي بطاقة لرؤية التفاصيل</p>
    <div class="stats-grid">
      ${card('المستخدمون', stats.users.length, 'users', '#7c3aed')}
      ${card('أصحاب الخدمات', stats.vendors.length, 'vendors', '#06b6d4')}
      ${card('العملاء', stats.customers.length, 'customers', '#10b981')}
      ${card('الموظفون', stats.staff.length, 'staff', '#f59e0b')}
      ${card('المندوبون', stats.drivers.length, 'drivers', '#ec4899')}
      ${card('إجمالي الطلبات', stats.orders.length, 'orders', '#7c3aed')}
      ${card('قيد الانتظار', stats.pendingOrders.length, 'pendingOrders', '#f59e0b')}
      ${card('الطلبات المكتملة', stats.completedOrders.length, 'completedOrders', '#10b981')}
      ${card('الطلبات الملغاة', stats.cancelledOrders.length, 'cancelledOrders', '#ef4444')}
      ${card('الخدمات', stats.services.length, 'services', '#06b6d4')}
      ${card('التصنيفات', stats.cats.length, 'cats', '#06b6d4')}
      ${card('إجمالي الإيرادات', totalRevenue.toLocaleString('ar') + ' ر', 'revenue', '#10b981')}
      ${card('طلبات شحن معلقة', stats.pendingRecharges.length, 'pendingRecharges', '#f59e0b')}
    </div>
    <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:var(--radius);padding:24px;margin-top:24px">
      <h3 style="margin-bottom:12px">سريعة الوصول</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="setAdminTab('cats')">إضافة تصنيف</button>
        <button class="btn btn-primary btn-sm" onclick="setAdminTab('services')">إضافة خدمة</button>
        <button class="btn btn-primary btn-sm" onclick="showAddUserModal()">إضافة مستخدم</button>
        <button class="btn btn-secondary btn-sm" onclick="setAdminTab('orders')">إدارة الطلبات</button>
        <button class="btn btn-secondary btn-sm" onclick="setAdminTab('wallet')">إدارة المحافظ</button>
      </div>
    </div>`;
}

function drillStat(key) {
  const renderers = {
    users:    () => drillUsersList(AppData.users.filter(u => u.role !== 'admin'), 'كل المستخدمين'),
    vendors:  () => drillUsersList(AppData.users.filter(u => u.role === 'vendor'), 'أصحاب الخدمات'),
    customers:() => drillUsersList(AppData.users.filter(u => u.role === 'customer'), 'العملاء'),
    staff:    () => drillUsersList(AppData.users.filter(u => u.role === 'staff'), 'الموظفون'),
    drivers:  () => drillUsersList(AppData.users.filter(u => u.role === 'driver'), 'المندوبون'),
    orders:   () => drillOrdersList(AppData.orders, 'كل الطلبات'),
    pendingOrders:   () => drillOrdersList(AppData.orders.filter(o => o.status === 'pending'), 'الطلبات قيد الانتظار'),
    completedOrders: () => drillOrdersList(AppData.orders.filter(o => o.status === 'completed'), 'الطلبات المكتملة'),
    cancelledOrders: () => drillOrdersList(AppData.orders.filter(o => o.status === 'cancelled'), 'الطلبات الملغاة'),
    services: () => drillServicesList(AppData.services, 'كل الخدمات'),
    cats:     () => drillCatsList(AppData.cats, 'كل التصنيفات'),
    revenue:  () => drillRevenue(),
    pendingRecharges: () => drillRechargesList(AppData.rechargeReqs.filter(r => r.status === 'pending')),
  };
  (renderers[key] || (() => toast('لا توجد تفاصيل', 'info')))();
}

function drillUsersList(users, title) {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">${title} (${users.length})</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="table-wrap" style="max-height:60vh;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>الاسم</th><th>الدور</th><th>البريد</th><th>الجوال</th><th>تاريخ التسجيل</th></tr></thead>
        <tbody>
          ${users.map(u => `<tr>
            <td style="font-weight:600">${escHtml(u.name || '—')}</td>
            <td><span class="badge badge-teal">${u.role}</span></td>
            <td style="font-size:13px;color:var(--text-secondary)">${escHtml(u.email || '—')}</td>
            <td>${escHtml(u.phone || '—')}</td>
            <td style="color:var(--text-muted)">${typeof fmtDate === 'function' ? fmtDate(u.createdAt) : ''}</td>
          </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد بيانات</td></tr>'}
        </tbody>
      </table>
    </div>`);
}

function drillOrdersList(orders, title) {
  const sLabel = { pending:'بانتظار', accepted:'مقبول', with_driver:'مع المندوب', delivered:'موصّل', completed:'مكتمل', cancelled:'ملغي' };
  openModal(`
    <div class="modal-header"><h2 class="modal-title">${title} (${orders.length})</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="table-wrap" style="max-height:60vh;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>رقم</th><th>الخدمة</th><th>العميل</th><th>المبلغ</th><th>التاريخ</th><th>الحالة</th></tr></thead>
        <tbody>
          ${orders.map(o => `<tr>
            <td style="font-family:monospace;font-size:12px">${escHtml(o.orderId || o.id)}</td>
            <td>${o.svcIcon || ''} ${escHtml(o.svcName || '—')}</td>
            <td>${escHtml(o.customerName || '—')}</td>
            <td style="font-weight:700">${o.total || 0} ر</td>
            <td>${escHtml(o.date || '—')}</td>
            <td><span class="badge">${sLabel[o.status] || o.status}</span></td>
          </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد بيانات</td></tr>'}
        </tbody>
      </table>
    </div>`);
}

function drillServicesList(services, title) {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">${title} (${services.length})</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="table-wrap" style="max-height:60vh;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>الاسم</th><th>التصنيف</th><th>السعر</th><th>المنطقة</th></tr></thead>
        <tbody>
          ${services.map(s => {
            const cat = AppData.cats.find(c => c.id === s.catId);
            const reg = AppData.regions?.find(r => r.id === s.regionId);
            return `<tr>
              <td style="font-weight:600">${escHtml(s.name)}</td>
              <td>${cat?.icon || ''} ${escHtml(cat?.name || '—')}</td>
              <td>${s.price ? s.price + ' ر' : '—'}</td>
              <td>${escHtml(reg?.name || '—')}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد بيانات</td></tr>'}
        </tbody>
      </table>
    </div>`);
}

function drillCatsList(cats, title) {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">${title} (${cats.length})</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="table-wrap" style="max-height:60vh;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>الاسم</th><th>القسم</th><th>عدد الخدمات</th></tr></thead>
        <tbody>
          ${cats.map(c => `<tr>
            <td style="font-weight:600">${c.icon || ''} ${escHtml(c.name)}</td>
            <td>${escHtml(c.section || '—')}</td>
            <td>${AppData.services.filter(s => s.catId === c.id).length}</td>
          </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد بيانات</td></tr>'}
        </tbody>
      </table>
    </div>`);
}

function drillRevenue() {
  const txns = AppData.transactions.filter(t => t.type === 'debit')
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const total = txns.reduce((a, t) => a + (t.amount || 0), 0);
  openModal(`
    <div class="modal-header"><h2 class="modal-title">💰 تفاصيل الإيرادات (${total.toLocaleString('ar')} ر)</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="table-wrap" style="max-height:60vh;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>المستخدم</th><th>المبلغ</th><th>الوصف</th><th>التاريخ</th></tr></thead>
        <tbody>
          ${txns.map(t => {
            const u = AppData.users.find(x => x.id === t.uid || x.uid === t.uid);
            return `<tr>
              <td>${escHtml(u?.name || t.uid)}</td>
              <td style="font-weight:700;color:#10b981">${t.amount} ر</td>
              <td style="color:var(--text-secondary)">${escHtml(t.note || '—')}</td>
              <td style="color:var(--text-muted)">${typeof fmtDate === 'function' ? fmtDate(t.createdAt) : ''}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد بيانات</td></tr>'}
        </tbody>
      </table>
    </div>`);
}

function drillRechargesList(reqs) {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">⏳ طلبات شحن معلقة (${reqs.length})</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="table-wrap" style="max-height:60vh;overflow:auto">
      <table class="admin-table">
        <thead><tr><th>المستخدم</th><th>المبلغ</th><th>الإثبات</th><th>الإجراءات</th></tr></thead>
        <tbody>
          ${reqs.map(r => `<tr>
            <td>${escHtml(r.userName || '—')}</td>
            <td style="font-weight:700">${r.amount} ر</td>
            <td>${r.proofBase64 ? `<button class="btn btn-sm btn-secondary" onclick="viewProof('${r.proofBase64}')">📸</button>` : '—'}</td>
            <td>
              <button class="btn btn-sm btn-success" onclick="approveRecharge('${r.id}','${r.userId}','${r.amount}');closeModal()">✅</button>
              <button class="btn btn-sm btn-danger" onclick="rejectRecharge('${r.id}');closeModal()">❌</button>
            </td>
          </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد بيانات</td></tr>'}
        </tbody>
      </table>
    </div>`);
}

// ─── ADMIN: Original Tab Logic (Legacy - Overridden by Phase 26) ─
const __ph3_originalRenderAdmin = typeof renderAdmin === 'function' ? renderAdmin : null;
function __legacy_renderAdmin() {
  try {
    const u = State.currentUser;
    if (!u || !['admin','cs','staff'].includes(u.role)) { navigate('home'); return ''; }
    const isAdmin = u.role === 'admin';

    // Ensure AppData is ready
    const orders = [...(AppData.orders || []), ...(AppData.archivedOrders || [])];
    const services = AppData.services || [];
    const users = AppData.users || [];

    const pendingSvcsCount = services.filter(s=>s.status==='pending_approval').length;
    const pendingOrdersCount = orders.filter(o=>o.status==='pending_admin' || o.status==='pending').length;
    const pendingUsersCount = users.filter(u=>u.status==='pending').length;

    const allTabs = [
      { k:'dashboard',    ic:'📊', l:t('admin_tab_dashboard') || 'الإحصائيات', perm:null },
      { k:'reports',      ic:'📈', l:t('admin_tab_reports') || 'التقارير', perm:'view_reports' },
      { k:'advance_stats',ic:'📊', l:'التحليلات المتقدمة', perm:null, adminOnly:true },
      { k:'advanced',     ic:'📈', l:'الإحصائيات المتقدمة', perm:null, adminOnly:true },
      { k:'users',        ic:'👥', l:t('admin_tab_users') || 'المستخدمين', perm:'view_users', adminOnly:false },
      { k:'users',        ic:'⌛', l:`حسابات معلقة${pendingUsersCount?` <span class="badge badge-gold" style="font-size:10px;padding:2px 6px">${pendingUsersCount}</span>`:''}`, perm:null, adminOnly:true },
      { k:'permissions',  ic:'🛡️', l:t('admin_tab_permissions') || 'الصلاحيات', perm:null, adminOnly:true },
      { k:'staff_performance', ic:'📊', l:'أداء الموظفين', perm:null, adminOnly:true },
      { k:'orders',       ic:'📋', l:`إدارة الطلبات${pendingOrdersCount?` <span class="badge badge-gold" style="font-size:10px;padding:2px 6px">${pendingOrdersCount}</span>`:''}`, perm:'view_orders' },
      { k:'live_tracking',ic:'📍', l:'التتبع المباشر', perm:null, adminOnly:true },
      { k:'ads',          ic:'🏷️', l:'الكوبونات والعروض', perm:null, adminOnly:true },
      { k:'sys_bookings', ic:'📅', l:'نظام الحجوزات', perm:null, adminOnly:true },
      { k:'sys_professions', ic:'🛠️', l:'نظام المهن', perm:null, adminOnly:true },
      { k:'sys_stores',   ic:'🏪', l:'نظام المتاجر', perm:null, adminOnly:true },
      { k:'sys_digital',  ic:'🛒', l:'المتاجر الرقمية', perm:null, adminOnly:true },
      { k:'sys_services', ic:'🛎️', l:'خدمات أخرى', perm:null, adminOnly:true },
      { k:'sys_offers',   ic:'🏷️', l:'العروض والخصومات', perm:null, adminOnly:true },
      { k:'provider_svcs',ic:'💼', l:`خدمات المزودين${pendingSvcsCount?` <span class="badge badge-gold" style="font-size:10px;padding:2px 6px">${pendingSvcsCount}</span>`:''}`, perm:null, adminOnly:true },
      { k:'wallet',       ic:'💰', l:'المحافظ الإلكترونية', perm:'view_wallets' },
      { k:'wallet',       ic:'📥', l:'طلبات الإيداع', perm:'view_wallets' },
      { k:'banks',        ic:'🏦', l:'الحسابات البنكية', perm:null, adminOnly:true },
      { k:'banks',        ic:'💳', l:'طرق الدفع', perm:null, adminOnly:true },
      { k:'ads',          ic:'📢', l:'الإعلانات', perm:null, adminOnly:true },
      { k:'cms_banners',  ic:'✉️', l:'إدارة الرسائل', perm:null, adminOnly:true },
      { k:'signup_settings', ic:'📝', l:'حقول التسجيل', perm:null, adminOnly:true },
      { k:'login_settings',ic:'🔑', l:'إعدادات الدخول', perm:null, adminOnly:true },
      { k:'ph17settings', ic:'⚙️', l:'الإعدادات العامة', perm:null, adminOnly:true },
      { k:'cms_texts',    ic:'🔤', l:'النصوص والأيقونات', perm:null, adminOnly:true },
      { k:'cms_pages',    ic:'📄', l:'الصفحات الثابتة', perm:null, adminOnly:true },
      { k:'delivery_pricing',   ic:'🚚', l:'أسعار التوصيل', perm:null, adminOnly:true },
      { k:'delivery_addresses', ic:'🗺️', l:'قاعدة العناوين', perm:null, adminOnly:true },
      { k:'direct_routing',     ic:'🚦', l:'التوجيه المباشر', perm:null, adminOnly:true },
    ];

    const tabs = allTabs.filter(t => {
      if (isAdmin) return true;
      if (t.adminOnly) return false;
      if (!t.perm) return true;
      if (typeof userHasPerm === 'function') return userHasPerm(u, t.perm);
      return false;
    });

    let adminTab = State.adminTab || 'dashboard';
    if (!tabs.some(t => t.k === adminTab)) adminTab = tabs[0]?.k || 'dashboard';

    let content = '';
    const fallback = (fnName) => `<div style="padding:40px;text-align:center;color:var(--text-muted)">دالة ${fnName} غير متوفرة حالياً</div>`;

    if (adminTab==='dashboard')        content = typeof renderAdminDash === 'function' ? renderAdminDash() : fallback('renderAdminDash');
    else if (adminTab==='users')       content = typeof renderAdminUsers === 'function' ? renderAdminUsers() : fallback('renderAdminUsers');
    else if (adminTab==='permissions') content = typeof renderAdminPermissions === 'function' ? renderAdminPermissions() : fallback('renderAdminPermissions');
    else if (adminTab==='staff_performance') content = typeof renderStaffPerformance === 'function' ? renderStaffPerformance() : fallback('renderStaffPerformance');
    else if (adminTab==='cats')        content = typeof renderAdminCats === 'function' ? renderAdminCats() : fallback('renderAdminCats');
    else if (adminTab==='services')    content = typeof renderAdminServices === 'function' ? renderAdminServices() : fallback('renderAdminServices');
    else if (adminTab==='sys_bookings')   content = typeof renderAdminSystem === 'function' ? renderAdminSystem('bookings') : fallback('renderAdminSystem');
    else if (adminTab==='sys_professions') content = typeof renderAdminSystem === 'function' ? renderAdminSystem('professions') : fallback('renderAdminSystem');
    else if (adminTab==='sys_stores')     content = typeof ph43_renderAdminStores === 'function' ? ph43_renderAdminStores() : (typeof renderAdminSystem === 'function' ? renderAdminSystem('stores') : fallback('renderAdminSystem'));
    else if (adminTab==='sys_digital')    content = typeof ph45_renderAdminDigitalStores === 'function' ? ph45_renderAdminDigitalStores() : fallback('ph45_renderAdminDigitalStores');
    else if (adminTab==='sys_services')   content = typeof renderAdminSystem === 'function' ? renderAdminSystem('services') : fallback('renderAdminSystem');
    else if (adminTab==='sys_offers')     content = typeof renderAdminOffers === 'function' ? renderAdminOffers() : fallback('renderAdminOffers');
    else if (adminTab==='provider_svcs') content = typeof renderAdminPendingSvcs === 'function' ? renderAdminPendingSvcs() : fallback('renderAdminPendingSvcs');
    else if (adminTab==='regions')     content = typeof renderAdminRegions === 'function' ? renderAdminRegions() : fallback('renderAdminRegions');
    else if (adminTab==='banks')       content = typeof renderAdminBanks === 'function' ? renderAdminBanks() : fallback('renderAdminBanks');
    else if (adminTab==='orders')      content = typeof renderAdminOrders === 'function' ? renderAdminOrders() : fallback('renderAdminOrders');
    else if (adminTab==='ads')         content = typeof renderAdminAds === 'function' ? renderAdminAds() : fallback('renderAdminAds');
    else if (adminTab==='wallet')      content = typeof renderAdminWallet === 'function' ? renderAdminWallet() : fallback('renderAdminWallet');
    else if (adminTab==='reports')     content = typeof renderAdminReports === 'function' ? renderAdminReports() : fallback('renderAdminReports');
    else if (adminTab==='delivery_pricing')   content = typeof renderAdminDeliveryPricing   === 'function' ? renderAdminDeliveryPricing()   : fallback('renderAdminDeliveryPricing');
    else if (adminTab==='delivery_addresses') content = typeof renderAdminDeliveryAddresses === 'function' ? renderAdminDeliveryAddresses() : fallback('renderAdminDeliveryAddresses');
    else if (adminTab==='direct_routing')       content = typeof ph18_renderLiveRouting       === 'function' ? ph18_renderLiveRouting()       : fallback('ph18_renderLiveRouting');
    else if (adminTab==='providers_database')   content = typeof renderAdminProvidersDatabase   === 'function' ? renderAdminProvidersDatabase()   : fallback('renderAdminProvidersDatabase');
    else if (adminTab==='drivers_database')     content = typeof renderAdminDriversDatabase     === 'function' ? renderAdminDriversDatabase()     : fallback('renderAdminDriversDatabase');
    else if (adminTab.startsWith('rental_stores_')) content = typeof _renderRentalStoresTab === 'function' ? _renderRentalStoresTab(adminTab.replace('rental_stores_','')) : fallback('_renderRentalStoresTab');
    else                               content = typeof renderAdminDash === 'function' ? renderAdminDash() : 'Dashboard Error';

    const roleBanner = !isAdmin ? `
      <div style="background:linear-gradient(135deg,rgba(245,158,11,.12),rgba(124,58,237,.08));border:1px solid rgba(245,158,11,.3);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--text-secondary)">
        أنت مسجّل كـ <strong>${u.role==='cs'?'خدمة عملاء':'موظف'}</strong> — تُعرض فقط التبويبات والإجراءات المسموح بها لك.
      </div>` : '';

    return `
    <div id="app-content">
      <div class="admin-layout">
        <aside class="admin-sidebar">
          <div style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:12px;padding:0 8px">${(typeof t==='function' && t('language')==='Language')?'MENU':'القائمة'}</div>
          ${tabs.map(t=>`
            <button class="admin-nav-item${adminTab===t.k?' active':''}" onclick="setAdminTab('${t.k}')">
              <span style="margin-inline-end:8px">${t.ic}</span><span>${t.l}</span>
            </button>`).join('')}
        </aside>
        <main class="admin-main">
          ${typeof renderBanners === 'function' ? renderBanners('admin') : ''}
          ${roleBanner}
          ${content}
        </main>
      </div>
    </div>`;
  } catch (err) {
    console.error("Critical Admin Render Error:", err);
    return `<div style="padding:60px;text-align:center">
      <h2 style="color:var(--danger)">حدث خطأ في عرض لوحة التحكم</h2>
      <p style="color:var(--text-secondary);margin:16px 0">${err.message}</p>
      <button class="btn btn-primary" onclick="location.reload()">تحديث الصفحة</button>
    </div>`;
  }
}
// window.renderAdmin = __legacy_renderAdmin;


// ─── Dedicated Permissions tab ────────────────────────
const ALL_PERMS = ['view_orders','edit_orders','create_users','chat_customers','view_wallets','adjust_wallets','view_reports'];

function renderAdminPermissions() {
  // Only show staff and admin users — permissions are only relevant for these roles.
  const users = (AppData.users || []).filter(u => u.role === 'staff' || u.role === 'admin');
  const roleLabel = { admin: 'مدير', staff: 'موظف' };
  const roleBadge = { admin: 'badge-rose', staff: 'badge-purple' };

  const ALL = (typeof ph17_allPerms === 'function')
    ? ph17_allPerms()
    : ALL_PERMS.slice();
  const PLABEL = (typeof PH17_PERM_LABELS !== 'undefined' && PH17_PERM_LABELS) || {};
  const labelOf = (k) => PLABEL[k] || (typeof t === 'function' ? t('perm_'+k) : k);

  // Role filter among staff/admin only
  const roleFilter = (window.__permRoleFilter === 'admin' || window.__permRoleFilter === 'staff')
    ? window.__permRoleFilter
    : 'all';
  const searchQuery = (State.adminSearch || '').toLowerCase();
  const filteredByRole = roleFilter === 'all' ? users : users.filter(u => u.role === roleFilter);
  const filtered = filteredByRole.filter(u =>
    (u.name || '').toLowerCase().includes(searchQuery) ||
    (u.email || '').toLowerCase().includes(searchQuery) ||
    (u.role || '').toLowerCase().includes(searchQuery)
  );

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <h2>🔑 إدارة الصلاحيات — الموظفون والمدراء</h2>
        <input type="text" class="form-control" id="admin-permissions-search" placeholder="ابحث بالاسم أو البريد..." value="${State.adminSearch || ''}" oninput="State.adminSearch = this.value; render();" style="width:280px">
      </div>
      <button class="btn btn-primary" onclick="ph17_openCreateUser ? ph17_openCreateUser() : showAddUserModal()">➕ إضافة موظف</button>
    </div>
    <p style="color:var(--text-muted);margin-bottom:14px">
      تُعرض هنا فقط حسابات الموظفين والمدراء. المدير يملك كل الصلاحيات تلقائياً ولا يمكن تعديلها.
    </p>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      ${['all','admin','staff'].map(r => `
        <button class="btn btn-sm ${roleFilter===r?'btn-primary':'btn-secondary'}"
          onclick="window.__permRoleFilter='${r}'; render();">
          ${r==='all'?'الكل — موظفون ومدراء':roleLabel[r]||r}
        </button>`).join('')}
    </div>

    <div style="background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.2);border-radius:12px;padding:16px;margin-bottom:20px">
      <h3 style="margin-bottom:12px;font-size:15px">الصلاحيات المتاحة للتفويض (${ALL.length})</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
        ${ALL.map(p => `
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary)">
            <span style="color:var(--accent-purple)">●</span> ${labelOf(p)}
          </div>`).join('')}
      </div>
    </div>

    <div class="table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>الاسم</th>
            <th>الدور</th>
            <th>البريد الإلكتروني</th>
            <th>الصلاحيات الفعّالة</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length ? filtered.map(u => {
            const perms = u.role === 'admin'
              ? Object.fromEntries(ALL.map(p=>[p,true]))
              : (u.permissions || {});
            const active = ALL.filter(p => perms[p]).length;
            const pct    = ALL.length ? Math.round(active / ALL.length * 100) : 0;
            return `<tr style="cursor:pointer" onclick="showStaffPermsView('${u.id}')">
              <td style="font-weight:700">${escHtml(u.name||'—')}</td>
              <td><span class="badge ${roleBadge[u.role]||'badge-purple'}">${roleLabel[u.role]||u.role||'—'}</span></td>
              <td style="font-size:12px;color:var(--text-secondary);direction:ltr;text-align:left">${escHtml(u.email||'—')}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="flex:1;height:6px;background:var(--border);border-radius:4px;overflow:hidden;min-width:60px">
                    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#7c3aed,#0d9488);border-radius:4px;transition:.3s"></div>
                  </div>
                  <span style="font-size:12px;color:var(--text-muted);flex-shrink:0"><strong style="color:var(--accent-purple)">${active}</strong>/${ALL.length}</span>
                </div>
              </td>
              <td onclick="event.stopPropagation()">
                <div style="display:flex;gap:6px;align-items:center">
                  <button class="btn btn-sm btn-secondary" onclick="showStaffPermsView('${u.id}')">👁️ عرض</button>
                  ${u.role === 'staff'
                    ? `<button class="btn btn-sm btn-primary" onclick="showPermsModal('${u.id}')">✏️ تعديل</button>`
                    : '<span style="color:var(--text-muted);font-size:11px">كاملة تلقائياً</span>'}
                </div>
              </td>
            </tr>`;
          }).join('') : `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">
            ${searchQuery ? 'لا توجد نتائج للبحث.' : 'لا يوجد موظفون أو مدراء مسجّلون حتى الآن.'}
          </td></tr>`}
        </tbody>
      </table>
    </div>`;
}

// ───────────────────────────────────────────────────────
//  ADMIN — Login settings
// ───────────────────────────────────────────────────────
function renderAdminLoginSettings() {
  const s = (AppData.appSettings) || {};
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <h2>إعدادات تسجيل الدخول</h2>
      <div style="display:flex;gap:12px;align-items:center">
        <button class="btn btn-primary" onclick="saveAdminLoginSettings()">حفظ الإعدادات</button>
      </div>
    </div>
    <div style="max-width:760px">
      <div class="form-group"><label class="form-label">تفعيل تسجيل الدخول بالبريد/كلمة المرور</label>
        <input type="checkbox" id="login-email-enabled" style="margin-left:8px" ${s.loginEmailEnabled? 'checked':''}>
      </div>
      <div class="form-group"><label class="form-label">تفعيل تسجيل الدخول بالجوال (بدون @)</label>
        <input type="checkbox" id="login-phone-enabled" style="margin-left:8px" ${s.loginPhoneEnabled? 'checked':''}>
      </div>
      <div class="form-group"><label class="form-label">تفعيل دخول العرض السريع (Quick demo)</label>
        <input type="checkbox" id="login-quick-demo" style="margin-left:8px" ${s.loginQuickDemo? 'checked':''}>
      </div>
      <div class="form-group"><label class="form-label">إجبار المصادقة الثنائية عند الدخول (2FA)</label>
        <input type="checkbox" id="login-2fa-enabled" style="margin-left:8px" ${s.login2faEnabled? 'checked':''}>
      </div>
      <p style="color:var(--text-muted);font-size:13px;margin-top:12px">ملاحظة: بعض التغييرات قد تتطلب إعادة تحميل إعدادات الخادم أو إعادة تشغيل جلسات المستخدمين لتظهر فوراً.</p>
    </div>`;
}

async function saveAdminLoginSettings() {
  const patch = {
    loginEmailEnabled: !!document.getElementById('login-email-enabled')?.checked,
    loginPhoneEnabled: !!document.getElementById('login-phone-enabled')?.checked,
    loginQuickDemo: !!document.getElementById('login-quick-demo')?.checked,
    login2faEnabled: !!document.getElementById('login-2fa-enabled')?.checked,
  };
  if (typeof ph17_saveSettings === 'function') {
    await ph17_saveSettings(patch);
    toast('✅ تم حفظ إعدادات تسجيل الدخول','success');
    await render();
  } else {
    toast('تعذّر الحفظ — وظيفة ph17 غير متاحة','error');
  }
}

// Ensure phase3 implementations override any earlier globals
try {
  if (typeof renderAdminUsers === 'function') window.renderAdminUsers = renderAdminUsers;
  if (typeof renderAdminOrders === 'function') window.renderAdminOrders = renderAdminOrders;
  if (typeof renderAdminWallet === 'function') window.renderAdminWallet = renderAdminWallet;
  if (typeof renderAdminPermissions === 'function') window.renderAdminPermissions = renderAdminPermissions;
} catch (e) { /* ignore */ }

function showAddStaffModal() {
  showAddUserModal();
  // Pre-select staff role after modal opens
  setTimeout(() => {
    const sel = document.getElementById('nu-role');
    if (sel) sel.value = 'staff';
  }, 50);
}

/* Removed renderAdminUsers and renderAdminOrders overrides. Functionality integrated into dashboards.js */

// ─── Override renderAdminWallet to gate approve/reject by perms ─
const __ph3_originalRenderAdminWallet = typeof renderAdminWallet === 'function' ? renderAdminWallet : null;
function renderAdminWallet() {
  const me = State.currentUser;
  const isAdmin = me?.role === 'admin';
  const canAdjust = isAdmin || userHasPerm(me, 'adjust_wallets');
  const pending = AppData.rechargeReqs.filter(r => r.status === 'pending');
  const approved = AppData.rechargeReqs.filter(r => r.status === 'approved');
  const searchQuery = (State.adminSearch || '').toLowerCase();
  const filteredPending = pending.filter(r =>
    (r.userName || '').toLowerCase().includes(searchQuery) ||
    (r.amount || '').toString().toLowerCase().includes(searchQuery)
  );
  const filteredApproved = approved.filter(r =>
    (r.userName || '').toLowerCase().includes(searchQuery) ||
    (r.amount || '').toString().toLowerCase().includes(searchQuery)
  );
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">
      <h2>إدارة المحافظ</h2>
      <input type="text" class="form-control" id="admin-wallet-search" placeholder="ابحث بالاسم أو المبلغ..." value="${State.adminSearch || ''}" oninput="State.adminSearch = this.value; render();" style="width:300px">
    </div>
    ${!canAdjust ? '<p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">🔒 وضع العرض فقط — لا تملك صلاحية تعديل المحافظ</p>' : ''}
    <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:var(--radius);padding:16px;margin-bottom:24px">
      <h3 style="margin-bottom:8px">⏳ طلبات الشحن المعلقة: ${filteredPending.length}</h3>
      ${filteredPending.length ? `
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>المستخدم</th><th>المبلغ</th><th>الإثبات</th>${canAdjust?'<th>الإجراءات</th>':''}</tr></thead>
          <tbody>
            ${filteredPending.map(r => `
              <tr>
                <td>${escHtml(r.userName||'—')}</td>
                <td style="font-weight:700">${r.amount} ريال</td>
                <td>${r.proofBase64 ? `<button class="btn btn-sm btn-secondary" onclick="viewProof('${r.proofBase64}')">📸</button>` : '—'}</td>
                ${canAdjust ? `<td>
                  <button class="btn btn-sm btn-success" onclick="approveRecharge('${r.id}','${r.userId}','${r.amount}')">قبول</button>
                  <button class="btn btn-sm btn-danger" onclick="rejectRecharge('${r.id}')">رفض</button>
                </td>` : ''}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<p style="color:var(--text-muted)">لا توجد طلبات معلقة</p>'}
    </div>
    <h3>✅ الطلبات الموافق عليها: ${filteredApproved.length}</h3>
    ${filteredApproved.length ? `<div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>المستخدم</th><th>المبلغ</th><th>التاريخ</th></tr></thead>
        <tbody>
          ${filteredApproved.map(r => `
            <tr>
              <td>${escHtml(r.userName||'—')}</td>
              <td>${r.amount} ريال</td>
              <td>${typeof fmtDate==='function'?fmtDate(r.createdAt):''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}`;
}

// ─── Override navbar to give CS/staff a link to the dashboard ─
// NOTE: must use assignment (not `function renderNavbar()`) so we can capture
// the ORIGINAL implementation from core.js. Function declarations hoist and
// would overwrite the global before we can grab the original — causing
// infinite recursion ("Maximum call stack size exceeded").
const __ph3_originalRenderNavbar = typeof window.renderNavbar === 'function' ? window.renderNavbar : null;
window.renderNavbar = function () {
  const u = State.currentUser;
  if (!u) return '';
  let html = __ph3_originalRenderNavbar ? __ph3_originalRenderNavbar() : '';
  // For CS, the original navbar shows nothing useful — inject a dashboard link
  // (re-injects into both the desktop nav-links pill bar AND the mobile drawer-nav)
  if (u.role === 'staff') {
    const active = State.currentPage === 'admin' ? ' active' : '';
    html = html.replace(
      /<div class="nav-links[^"]*">[\s\S]*?<\/div>/,
      `<div class="nav-links nav-links-desktop"><button class="nav-link${active}" onclick="navigate('admin')"><span>لوحة العمل</span></button></div>`
    );
    html = html.replace(
      /<nav class="drawer-nav">[\s\S]*?<\/nav>/,
      `<nav class="drawer-nav"><button class="drawer-link${active}" onclick="navigate('admin');closeDrawer()"><span>لوحة العمل</span></button></nav>`
    );
  }
  return html;
};

// Make CS users land on the admin route after login (defensive override)
const __ph3_originalNavigate = window.navigate;
window.navigate = async function(page, params) {
  try {
    const u = State.currentUser;
    if (u?.role === 'staff' && page === 'home') page = 'admin';
  } catch (e) {}
  return __ph3_originalNavigate.call(this, page, params);
};

// ─── Ultimate safety net: if app is still on the boot loader after 8s, force login.
// This guards against any future override accidentally swallowing the flow.
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (State.currentPage === 'loading' && !State.currentUser) {
      console.warn('[phase3] Boot loader exceeded 8s — forcing login page');
      try {
        State.currentPage = 'login';
        const app = document.getElementById('app');
        if (app && typeof renderLoginPage === 'function') {
          app.innerHTML = renderLoginPage();
          const nw = document.getElementById('navbar-wrap'); if (nw) nw.innerHTML = '';
          const fw = document.getElementById('footer-wrap'); if (fw) fw.innerHTML = '';
        }
      } catch (e) { console.error('Forced login failed:', e); }
    }
  }, 8000);
});

// ─── Add user modal (manual creation by admin) ─────────
function showAddUserModal() {
  const regions = AppData.regions || [];
  const u = State.currentUser;
  const isAdmin = u && u.role === 'admin';

  openModal(`
    <div class="modal-header"><h2 class="modal-title">${t('add_user_manual')}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-grid-2">
      <div class="form-group"><label class="form-label">الاسم</label><input class="form-control" id="nu-name" placeholder="الاسم الكامل"></div>
      <div class="form-group"><label class="form-label">الدور</label>
        <select class="form-control" id="nu-role">
          <option value="customer">عميل</option>
          <option value="provider">صاحب مهنة (سباك، كهربائي، إلخ)</option>
          <option value="vendor-services">مزود خدمات وحجوزات (فنادق، قاعات، إلخ)</option>
          <option value="vendor-store">مزود متاجر (مأكولات، صيدليات، إلخ)</option>
          <option value="driver">مندوب توصيل</option>
          ${isAdmin ? `
            <option value="staff">موظف عمليات</option>
            <option value="admin">مدير نظام</option>
          ` : ''}
        </select>
      </div>
      <div class="form-group"><label class="form-label">البريد</label><input class="form-control" id="nu-email" type="email" placeholder="user@example.com"></div>
      <div class="form-group"><label class="form-label">كلمة مرور مؤقتة</label><input class="form-control" id="nu-password" type="text" placeholder="على الأقل 6 أحرف"></div>
      <div class="form-group"><label class="form-label">الجوال</label><input class="form-control" id="nu-phone" type="tel" placeholder="+9677..."></div>
      <div class="form-group"><label class="form-label">المنطقة</label>
        <select class="form-control" id="nu-region">
          <option value="">— اختياري —</option>
          ${regions.filter(r => r.active !== false).map(r => `<option value="${r.id}">${escHtml(r.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">رصيد ابتدائي (ريال)</label><input class="form-control" id="nu-balance" type="number" min="0" value="0"></div>
    <div style="background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);border-radius:8px;padding:12px;font-size:13px;color:var(--text-secondary);margin-bottom:16px">
      💡 سيتم إنشاء حساب بالبريد وكلمة المرور. أبلِغ المستخدم بهما.
    </div>
    <button class="btn btn-primary btn-block" onclick="submitAddUser()">إنشاء الحساب</button>`);
}

async function submitAddUser() {
  const name = document.getElementById('nu-name').value.trim();
  const selectedRole = document.getElementById('nu-role').value;
  const email = document.getElementById('nu-email').value.trim().toLowerCase();
  const password = document.getElementById('nu-password').value;
  const phone = document.getElementById('nu-phone').value.trim();
  const regionId = document.getElementById('nu-region').value || null;
  const balance = parseFloat(document.getElementById('nu-balance').value) || 0;

  if (!name || !email || !password || password.length < 6) {
    toast('املأ الاسم والبريد وكلمة مرور (6 أحرف على الأقل)', 'error'); return;
  }

  // Use secondary auth instance so we don't log out the admin
  const sa = getSecondaryAuth();
  if (!sa) { toast('تعذّر إنشاء الحساب', 'error'); return; }

  try {
    const cred = await sa.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    let role = selectedRole;
    let vendorType = null;
    if (selectedRole === 'vendor-services') {
      role = 'vendor';
      vendorType = 'services';
    } else if (selectedRole === 'vendor-store') {
      role = 'vendor';
      vendorType = 'store';
    }

    const userData = {
      name, email, phone, role, regionId,
      permissions: DEFAULT_PERMS[role] || {},
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: State.currentUser.uid,
    };
    if (vendorType) {
      userData.vendorType = vendorType;
    }

    await db.collection('users').doc(uid).set(userData);
    if (balance > 0) await creditWallet(uid, balance, 'رصيد افتتاحي - من المدير');
    await sa.signOut().catch(() => {});
    closeModal();
    toast(`تم إنشاء حساب ${name} ✅`, 'success');
    await render();
  } catch (e) {
    console.error('Create user failed:', e);
    const msg = {
      'auth/email-already-in-use': 'البريد مستخدم بالفعل',
      'auth/invalid-email': 'بريد غير صالح',
      'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل)',
      'auth/operation-not-allowed': 'فعّل تسجيل الدخول بالبريد/كلمة المرور في Firebase أولاً',
    }[e.code] || e.message;
    toast(msg, 'error');
  }
}

// ─── Permissions modal ────────────────────────────────
function showPermsModal(userId) {
  const u = AppData.users.find(x => x.id === userId);
  if (!u) return;
  const perms = u.permissions || DEFAULT_PERMS[u.role] || {};
  const allPerms = ['view_orders', 'edit_orders', 'create_users', 'chat_customers', 'view_wallets', 'adjust_wallets', 'view_reports'];
  openModal(`
    <div class="modal-header"><h2 class="modal-title">🔑 ${t('permissions')} — ${escHtml(u.name)}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="perms-grid">
      ${allPerms.map(p => `
        <label class="perm-row">
          <input type="checkbox" id="perm-${p}" ${perms[p] ? 'checked' : ''}>
          <span>${t('perm_' + p)}</span>
        </label>`).join('')}
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:16px" onclick="savePerms('${userId}')">حفظ الصلاحيات</button>`);
}

async function savePerms(userId) {
  const allPerms = ['view_orders', 'edit_orders', 'create_users', 'chat_customers', 'view_wallets', 'adjust_wallets', 'view_reports'];
  const perms = {};
  allPerms.forEach(p => { perms[p] = document.getElementById('perm-' + p).checked; });
  await fsUpdate('users', userId, { permissions: perms });
  closeModal(); toast('تم حفظ الصلاحيات ✅', 'success'); await render();
}

// ─── Adjust wallet modal ──────────────────────────────
function showAdjustWalletModal(userId) {
  const u = AppData.users.find(x => x.id === userId);
  if (!u) return;
  if (['admin', 'super_admin', 'staff', 'cs'].includes(u.role)) {
    toast('لا يمكن تعديل محفظة مستخدم إداري أو موظف', 'error');
    return;
  }
  const w = AppData.wallets ? (AppData.wallets[u.id || u.uid]?.balance || 0) : 0;
  openModal(`
    <div class="modal-header"><h2 class="modal-title">⚖️ تعديل رصيد ${escHtml(u.name)}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="background:var(--gradient-card);padding:16px;border-radius:8px;margin-bottom:16px;text-align:center">
      <div style="color:var(--text-muted);font-size:13px">الرصيد الحالي</div>
      <div style="font-size:28px;font-weight:800;background:var(--gradient-main);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${w.toLocaleString('ar')} ر</div>
    </div>
    <div class="form-group"><label class="form-label">العملية</label>
      <select class="form-control" id="aw-type">
        <option value="credit">➕ إضافة إلى الرصيد</option>
        <option value="debit">➖ خصم من الرصيد</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">المبلغ (ريال)</label><input class="form-control" id="aw-amount" type="number" min="1" placeholder="100"></div>
    <div class="form-group"><label class="form-label">${t('reason')}</label><input class="form-control" id="aw-reason" placeholder="مثال: تعويض عن طلب ملغى"></div>
    <button class="btn btn-primary btn-block" onclick="submitAdjustWallet('${userId}')">تنفيذ</button>`);
}

async function submitAdjustWallet(userId) {
  const type = document.getElementById('aw-type').value;
  const amount = parseFloat(document.getElementById('aw-amount').value);
  const reason = document.getElementById('aw-reason').value.trim() || 'تعديل إداري';
  if (!amount || amount <= 0) { toast('أدخل مبلغاً صحيحاً', 'error'); return; }
  try {
    if (type === 'credit') {
      await creditWallet(userId, amount, `${reason} (إضافة إدارية)`);
    } else {
      const ok = await deductWallet(userId, amount, `${reason} (خصم إداري)`);
      if (!ok) { toast('رصيد غير كافٍ', 'error'); return; }
    }
    await pushNotification({
      uid: userId,
      title: type === 'credit' ? '💰 تم إضافة رصيد لمحفظتك' : '💸 تم خصم مبلغ من محفظتك',
      body: `${amount} ريال — ${reason}`,
      type: type === 'credit' ? 'success' : 'warning',
      link: 'wallet',
    });
    closeModal(); toast('✅ تم', 'success'); await render();
  } catch (e) {
    toast(e.message || 'فشل التنفيذ', 'error');
  }
}

// ─── Send invoice via WhatsApp / Email ────────────────
function buildInvoiceText(o) {
  const sLabel = { pending:'بانتظار', accepted:'مقبول', with_driver:'مع المندوب', delivered:'موصّل', completed:'مكتمل', cancelled:'ملغي' };
  return [
    `🧾 *فاتورة محجوز*`,
    ``,
    `رقم العملية: ${o.orderId}`,
    `الخدمة: ${o.svcName}`,
    `مقدم الخدمة: ${o.vendorName || '—'}`,
    `التاريخ: ${o.date || '—'}`,
    o.time ? `الوقت: ${o.time}` : null,
    o.customerAddr ? `العنوان: ${o.customerAddr}` : null,
    ``,
    `سعر الخدمة: ${o.servicePrice || 0} ريال`,
    `رسوم التوصيل: ${o.deliveryFee || 0} ريال`,
    `*الإجمالي: ${o.total || 0} ريال*`,
    ``,
    `الحالة: ${sLabel[o.status] || o.status}`,
    ``,
    `شكراً لاستخدامك محجوز 🌟`,
  ].filter(Boolean).join('\n');
}

function shareInvoiceWA(orderId) {
  const o = AppData.orders.find(x => x.id === orderId) || (AppData.archivedOrders || []).find(x => x.id === orderId);
  if (!o) return;
  const txt = encodeURIComponent(buildInvoiceText(o));
  const cust = AppData.users.find(u => u.id === o.customerId || u.uid === o.customerId);
  const phone = (cust?.phone || '').replace(/\D/g, '');
  const url = phone ? `https://wa.me/${phone}?text=${txt}` : `https://wa.me/?text=${txt}`;
  window.open(url, '_blank');
}

function shareInvoiceEmail(orderId) {
  const o = AppData.orders.find(x => x.id === orderId) || (AppData.archivedOrders || []).find(x => x.id === orderId);
  if (!o) return;
  const cust = AppData.users.find(u => u.id === o.customerId || u.uid === o.customerId);
  const subject = encodeURIComponent(`فاتورة محجوز — ${o.orderId}`);
  const body = encodeURIComponent(buildInvoiceText(o));
  const to = cust?.email ? encodeURIComponent(cust.email) : '';
  window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
}

// Override showInvoice to add the share buttons
const __originalShowInvoice = typeof showInvoice === 'function' ? showInvoice : null;
function showInvoice(orderId) {
  const o = AppData.orders.find(x => x.id === orderId) || (AppData.archivedOrders || []).find(x => x.id === orderId);
  if (!o) return;
  const sLabel = { pending:'⏳ بانتظار القبول', accepted:'✅ تم القبول', with_driver:'🚗 مع المندوب', delivered:'📦 تم التوصيل', completed:'🎉 مكتمل', cancelled:'❌ ملغي' };
  openModal(`
    <div class="modal-header"><h2 class="modal-title">🧾 فاتورة الطلب</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="invoice">
      <div class="invoice-row"><span>رقم العملية</span><strong>${o.orderId}</strong></div>
      <div class="invoice-row"><span>الخدمة</span><span>${o.svcIcon || ''} ${escHtml(o.svcName || '')}</span></div>
      ${o.tierName ? `<div class="invoice-row"><span>الفئة المختارة</span><span style="font-weight:700;color:var(--primary)">🏷️ ${escHtml(o.tierName)}</span></div>` : ''}
      <div class="invoice-row"><span>مقدم الخدمة</span><span>${escHtml(o.vendorName || '—')}</span></div>
      <div class="invoice-row"><span>التاريخ</span><span>${escHtml(o.date || '—')}</span></div>
      <div class="invoice-row"><span>سعر الخدمة</span><span>${o.servicePrice || 0} ريال</span></div>
      <div class="invoice-row"><span>رسوم التوصيل</span><span>${o.deliveryFee || 0} ريال</span></div>
      <div class="invoice-row total"><span>الإجمالي</span><strong>${o.total || 0} ريال</strong></div>
      <div class="invoice-row"><span>الحالة</span><span>${sLabel[o.status] || o.status}</span></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-sm" style="background:#25d366;color:#fff;flex:1" onclick="shareInvoiceWA('${orderId}')">${t('send_via_whatsapp')}</button>
      <button class="btn btn-secondary btn-sm" style="flex:1" onclick="shareInvoiceEmail('${orderId}')">${t('send_via_email')}</button>
    </div>
    <button class="btn btn-secondary btn-block" style="margin-top:8px" onclick="closeModal()">إغلاق</button>`);
}

// ─── Hook into order lifecycle to push notifications ──
async function notifyOrderStatusChange(o, newStatus) {
  const labels = {
    accepted:'✅ تم قبول طلبك', with_driver:'🚗 طلبك في الطريق إليك',
    delivered:'📦 تم التوصيل', completed:'🎉 اكتمل الطلب', cancelled:'❌ تم إلغاء الطلب',
  };
  if (!labels[newStatus] || !o.customerId) return;
  await pushNotification({
    uid: o.customerId,
    title: labels[newStatus],
    body: `الطلب ${o.orderId} - ${o.svcName}`,
    type: newStatus === 'cancelled' ? 'warning' : 'success',
    link: 'myorders',
  });
}
window.notifyOrderStatusChange = notifyOrderStatusChange;


// ══════════════════════════════════════════════════════════════════
//  أسعار التوصيل — واجهة لوحة المدير الاحترافية
//  الترتيب: أنواع المركبات ← المناطق ← العناوين ← المسارات
// ══════════════════════════════════════════════════════════════════

// ─── حالة التنقل بين الصفحات ─────────────────────────────────────
window.__dp_selectedVehicleType = window.__dp_selectedVehicleType || null;
window.__dp_selectedGov         = window.__dp_selectedGov         || null;
window.__dp_selectedZone        = window.__dp_selectedZone        || null;
window.__dp_selectedSubzone     = window.__dp_selectedSubzone     || null;
window.__dp_searchQuery         = window.__dp_searchQuery         || '';

// ─── ألوان وأيقونات افتراضية لأنواع المركبات ─────────────────────
const _DP_DEFAULT_ICONS  = ['🚗','🏍️','🚐','🚛','🛵','🚚','🏎️','🚜'];
const _DP_DEFAULT_COLORS = ['#3b82f6','#f97316','#8b5cf6','#10b981','#ef4444','#f59e0b','#06b6d4','#84cc16'];

// ══════════════════════════════════════════════════════════════════
//  الدالة الرئيسية: عرض صفحات نظام أسعار التوصيل
// ══════════════════════════════════════════════════════════════════
window.renderAdminDeliveryPricing = function() {
  const vehicleTypes = AppData.deliveryVehicleTypes || [];
  const govs         = AppData.deliveryGovernorates  || [];
  const zones        = AppData.deliveryZones        || [];
  const subzones     = AppData.deliverySubzones     || [];
  const routes       = AppData.deliveryRoutes       || [];

  const selVT  = window.__dp_selectedVehicleType;
  const selGov = window.__dp_selectedGov;
  const selZ   = window.__dp_selectedZone;
  const selSZ  = window.__dp_selectedSubzone;

  // ──────────────────────────────────────────────────────────────
  //  صفحة 1: أنواع المركبات
  // ──────────────────────────────────────────────────────────────
  if (!selVT) {
    const activeVTs = vehicleTypes.filter(v => v.active !== false);
    const inactiveVTs = vehicleTypes.filter(v => v.active === false);

    return `
    <style>
      .dp-vt-card {
        background: var(--glass-bg);
        border: 2px solid var(--border);
        border-radius: 20px;
        padding: 24px 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        cursor: pointer;
        transition: all 0.25s ease;
        text-align: center;
        position: relative;
      }
      .dp-vt-card:hover {
        transform: translateY(-4px);
      }
      .dp-vt-card .dp-vt-badge {
        position: absolute;
        top: 12px;
        left: 12px;
        font-size: 10px;
        padding: 3px 8px;
        border-radius: 20px;
        font-weight: 700;
      }
      .dp-vt-icon-wrap {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
      }
      .dp-add-vt-card {
        background: rgba(139,92,246,0.04);
        border: 2px dashed rgba(139,92,246,0.25);
        border-radius: 20px;
        padding: 24px 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        transition: all 0.25s ease;
        text-align: center;
      }
      .dp-add-vt-card:hover {
        border-color: var(--primary);
        background: rgba(139,92,246,0.08);
        transform: translateY(-2px);
      }
      .dp-breadcrumb {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text-muted);
        margin-bottom: 4px;
        flex-wrap: wrap;
      }
      .dp-breadcrumb span { cursor: default; }
      .dp-breadcrumb .dp-bc-link {
        cursor: pointer;
        color: var(--primary);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .dp-breadcrumb .dp-bc-link:hover { opacity: 0.8; }
    </style>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;flex-wrap:wrap;gap:12px">
      <div>
        <h2 style="margin:0;font-family:'Cairo',sans-serif;font-weight:800;font-size:22px">🚚 أسعار التوصيل</h2>
        <p style="color:var(--text-muted);font-size:13px;margin:6px 0 0">اختر نوع المركبة لإدارة مناطقها وأسعارها</p>
      </div>
    </div>

    ${vehicleTypes.length === 0 ? `
      <div style="text-align:center;padding:80px 20px;background:rgba(139,92,246,0.03);border:2px dashed rgba(139,92,246,0.15);border-radius:20px">
        <div style="font-size:56px;margin-bottom:16px">🚗</div>
        <h3 style="color:var(--text-secondary);font-family:'Cairo',sans-serif">لا توجد أنواع مركبات بعد</h3>
        <p style="color:var(--text-muted);margin-bottom:20px">أضف نوع مركبة مثل سيارة، دراجة نارية، شاحنة...</p>
        <button class="btn btn-primary" onclick="dp_openAddVehicleTypeModal()">+ إضافة أول نوع مركبة</button>
      </div>` : `

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px">

      ${activeVTs.map(vt => {
        const vtRoutes = routes.filter(r => r.vehicleTypeId === vt.id);
        const vtZonesCount = [...new Set(vtRoutes.map(r => r.zoneId))].length;
        const color = vt.color || '#3b82f6';
        const colorAlpha = color + '22';
        return `
        <div class="dp-vt-card"
             style="border-color:${color}33"
             onmouseenter="this.style.borderColor='${color}';this.style.boxShadow='0 8px 30px ${color}33'"
             onmouseleave="this.style.borderColor='${color}33';this.style.boxShadow='none'"
             onclick="window.__dp_selectedVehicleType='${vt.id}';window.__dp_selectedGov=null;window.__dp_selectedZone=null;window.__dp_selectedSubzone=null;window.__dp_searchQuery='';render()">
          <div class="dp-vt-icon-wrap" style="background:${colorAlpha};border:2px solid ${color}44">
            <span>${escHtml(vt.icon || '🚗')}</span>
          </div>
          <div>
            <div style="font-size:17px;font-weight:800;color:var(--text-main);font-family:'Cairo',sans-serif">${escHtml(vt.name)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${vtRoutes.length} مسار · ${vtZonesCount} منطقة</div>
          </div>
          <div style="display:flex;gap:6px;margin-top:4px" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-secondary" onclick="dp_openEditVehicleTypeModal('${vt.id}')" title="تعديل" style="padding:5px 10px;font-size:12px">✏️ تعديل</button>
            <button class="btn btn-sm btn-danger" onclick="dp_confirmDeleteVehicleType('${vt.id}','${escHtml(vt.name)}')" title="حذف" style="padding:5px 10px;font-size:12px">🗑️</button>
          </div>
        </div>`;
      }).join('')}

      <!-- بطاقة إضافة نوع مركبة جديد -->
      <div class="dp-add-vt-card" onclick="dp_openAddVehicleTypeModal()">
        <div style="width:72px;height:72px;border-radius:50%;background:rgba(139,92,246,0.08);border:2px dashed rgba(139,92,246,0.3);display:flex;align-items:center;justify-content:center;font-size:28px">+</div>
        <div style="font-size:14px;font-weight:700;color:var(--primary);font-family:'Cairo',sans-serif">إضافة نوع مركبة</div>
        <div style="font-size:12px;color:var(--text-muted)">سيارة، دراجة، شاحنة...</div>
      </div>
    </div>

    ${inactiveVTs.length > 0 ? `
    <div style="margin-top:24px;padding:16px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:14px">
      <div style="font-size:13px;color:var(--text-muted);font-weight:600;margin-bottom:10px">مركبات غير مفعّلة (${inactiveVTs.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${inactiveVTs.map(vt => `
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:8px 14px;display:flex;align-items:center;gap:8px">
          <span>${escHtml(vt.icon||'🚗')}</span>
          <span style="font-size:13px;color:var(--text-muted)">${escHtml(vt.name)}</span>
          <button class="btn btn-sm btn-secondary" onclick="dp_openEditVehicleTypeModal('${vt.id}')" style="padding:2px 8px;font-size:11px">✏️</button>
        </div>`).join('')}
      </div>
    </div>` : ''}
    `}
    `;
  }

  // ─── معلومات نوع المركبة المختارة ────────────────────────────
  const vt = vehicleTypes.find(v => v.id === selVT);
  if (!vt) { window.__dp_selectedVehicleType = null; return renderAdminDeliveryPricing(); }
  const vtColor = vt.color || '#3b82f6';
  const vtColorAlpha = vtColor + '18';

  // ──────────────────────────────────────────────────────────────
  //  صفحة 2 (جديدة): المحافظات
  // ──────────────────────────────────────────────────────────────
  if (!selGov) {
    const activeGovs = govs.filter(g => g.active !== false);
    const inactiveGovs = govs.filter(g => g.active === false);

    return `
    <div class="dp-breadcrumb">
      <span class="dp-bc-link" onclick="window.__dp_selectedVehicleType=null;window.__dp_selectedGov=null;window.__dp_selectedZone=null;window.__dp_selectedSubzone=null;render()">🚚 أسعار التوصيل</span>
      <span>›</span>
      <span style="color:var(--text-main);font-weight:700">${escHtml(vt.icon)} ${escHtml(vt.name)}</span>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:48px;height:48px;border-radius:14px;background:${vtColorAlpha};border:2px solid ${vtColor}44;display:flex;align-items:center;justify-content:center;font-size:22px">${escHtml(vt.icon||'🚗')}</div>
        <div>
          <h2 style="margin:0;font-family:'Cairo',sans-serif;font-weight:800">${escHtml(vt.name)}</h2>
          <p style="color:var(--text-muted);font-size:13px;margin:3px 0 0">اختر المحافظة لإدارة مناطقها وعناوينها وأسعارها</p>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="dp_openManageGovsModal()">⚙️ إدارة المحافظات</button>
        <button class="btn btn-primary" onclick="dp_openAddGovModal()">+ إضافة محافظة</button>
      </div>
    </div>

    ${activeGovs.length === 0 ? `
      <div style="text-align:center;padding:70px 20px;background:rgba(139,92,246,0.03);border:2px dashed rgba(139,92,246,0.15);border-radius:20px">
        <div style="font-size:48px;margin-bottom:14px">🏛️</div>
        <h3 style="color:var(--text-secondary);font-family:'Cairo',sans-serif">لا توجد محافظات بعد</h3>
        <p style="color:var(--text-muted)">ابدأ بإضافة محافظة مثل "حضرموت" أو "عدن"</p>
        <button class="btn btn-primary" onclick="dp_openAddGovModal()">+ إضافة أول محافظة</button>
      </div>` : `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px">
      ${activeGovs.map(g => {
        const gZones = zones.filter(z => z.govId === g.id);
        const zoneIds = gZones.map(z => z.id);
        const gRoutes = routes.filter(r => r.vehicleTypeId === selVT && zoneIds.includes(r.zoneId));
        return `
        <div style="background:var(--glass-bg);border:1px solid var(--border);border-radius:16px;padding:18px;cursor:pointer;transition:all 0.22s ease"
             onmouseenter="this.style.borderColor='${vtColor}';this.style.transform='translateY(-3px)';this.style.boxShadow='0 6px 20px ${vtColor}22'"
             onmouseleave="this.style.borderColor='var(--border)';this.style.transform='none';this.style.boxShadow='none'"
             onclick="window.__dp_selectedGov='${g.id}';window.__dp_selectedZone=null;window.__dp_selectedSubzone=null;window.__dp_searchQuery='';render()">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:14px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:38px;height:38px;border-radius:10px;background:${vtColorAlpha};display:flex;align-items:center;justify-content:center;font-size:18px">🏛️</div>
              <div>
                <div style="font-size:16px;font-weight:800;font-family:'Cairo',sans-serif;color:var(--text-main)">${escHtml(g.name)}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${gZones.length} منطقة · ${gRoutes.length} مسار</div>
              </div>
            </div>
            <div style="display:flex;gap:5px" onclick="event.stopPropagation()">
              <button class="btn btn-sm btn-secondary" onclick="dp_openEditGovModal('${g.id}')" style="padding:5px;border-radius:8px" title="تعديل">✏️</button>
              <button class="btn btn-sm btn-danger" onclick="dp_confirmDeleteGov('${g.id}','${escHtml(g.name)}')" style="padding:5px;border-radius:8px" title="حذف">🗑️</button>
            </div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-primary btn-sm" style="flex:1;font-family:'Cairo',sans-serif;font-weight:700" onclick="event.stopPropagation();window.__dp_selectedGov='${g.id}';window.__dp_selectedZone=null;render()">
              عرض المناطق الرئيسية ←
            </button>
          </div>
        </div>`;
      }).join('')}
    </div>
    ${inactiveGovs.length > 0 ? `<div style="margin-top:16px;font-size:12px;color:var(--text-muted)">+ ${inactiveGovs.length} محافظة معطّلة</div>` : ''}
    `}
    `;
  }

  const gov = govs.find(g => g.id === selGov);
  if (!gov) { window.__dp_selectedGov = null; return renderAdminDeliveryPricing(); }

  // ──────────────────────────────────────────────────────────────
  //  صفحة 3: المناطق الرئيسية
  // ──────────────────────────────────────────────────────────────
  if (!selZ) {
    const activeZones = zones.filter(z => z.govId === selGov && z.active !== false);
    const inactiveZones = zones.filter(z => z.govId === selGov && z.active === false);

    return `
    <div class="dp-breadcrumb">
      <span class="dp-bc-link" onclick="window.__dp_selectedVehicleType=null;window.__dp_selectedGov=null;window.__dp_selectedZone=null;window.__dp_selectedSubzone=null;render()">🚚 أسعار التوصيل</span>
      <span>›</span>
      <span class="dp-bc-link" onclick="window.__dp_selectedGov=null;window.__dp_selectedZone=null;window.__dp_selectedSubzone=null;render()">${escHtml(vt.icon)} ${escHtml(vt.name)}</span>
      <span>›</span>
      <span style="color:var(--text-main);font-weight:700">🏛️ ${escHtml(gov.name)}</span>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:48px;height:48px;border-radius:14px;background:${vtColorAlpha};border:2px solid ${vtColor}44;display:flex;align-items:center;justify-content:center;font-size:22px">🏛️</div>
        <div>
          <h2 style="margin:0;font-family:'Cairo',sans-serif;font-weight:800">${escHtml(gov.name)}</h2>
          <p style="color:var(--text-muted);font-size:13px;margin:3px 0 0">المناطق الرئيسية التابعة لـ ${escHtml(gov.name)} · اختر المنطقة لإدارة عناوينها</p>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="dp_openManageZonesModal()">⚙️ إدارة المناطق</button>
        <button class="btn btn-primary" onclick="dp_openAddZoneModal()">+ إضافة منطقة</button>
      </div>
    </div>

    ${activeZones.length === 0 ? `
      <div style="text-align:center;padding:70px 20px;background:rgba(139,92,246,0.03);border:2px dashed rgba(139,92,246,0.15);border-radius:20px">
        <div style="font-size:48px;margin-bottom:14px">🗺️</div>
        <h3 style="color:var(--text-secondary);font-family:'Cairo',sans-serif">لا توجد مناطق رئيسية في هذه المحافظة بعد</h3>
        <p style="color:var(--text-muted)">ابدأ بإضافة منطقة مثل "المكلا" أو "سيئون"</p>
        <button class="btn btn-primary" onclick="dp_openAddZoneModal()">+ إضافة أول منطقة</button>
      </div>` : `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px">
      ${activeZones.map(z => {
        const zRoutes   = routes.filter(r => r.zoneId === z.id && r.vehicleTypeId === selVT);
        const zSubzones = subzones.filter(s => s.zoneId === z.id && s.active !== false);
        return `
        <div style="background:var(--glass-bg);border:1px solid var(--border);border-radius:16px;padding:18px;cursor:pointer;transition:all 0.22s ease"
             onmouseenter="this.style.borderColor='${vtColor}';this.style.transform='translateY(-3px)';this.style.boxShadow='0 6px 20px ${vtColor}22'"
             onmouseleave="this.style.borderColor='var(--border)';this.style.transform='none';this.style.boxShadow='none'"
             onclick="window.__dp_selectedZone='${z.id}';window.__dp_selectedSubzone=null;window.__dp_searchQuery='';render()">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:14px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:38px;height:38px;border-radius:10px;background:${vtColorAlpha};display:flex;align-items:center;justify-content:center;font-size:18px">📍</div>
              <div>
                <div style="font-size:16px;font-weight:800;font-family:'Cairo',sans-serif;color:var(--text-main)">${escHtml(z.name)}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${zSubzones.length} عنوان · ${zRoutes.length} مسار</div>
              </div>
            </div>
            <div style="display:flex;gap:5px" onclick="event.stopPropagation()">
              <button class="btn btn-sm btn-secondary" onclick="dp_openEditZoneModal('${z.id}')" style="padding:5px;border-radius:8px" title="تعديل">✏️</button>
              <button class="btn btn-sm btn-danger" onclick="dp_confirmDeleteZone('${z.id}','${escHtml(z.name)}')" style="padding:5px;border-radius:8px" title="حذف">🗑️</button>
            </div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-primary btn-sm" style="flex:1;font-family:'Cairo',sans-serif;font-weight:700" onclick="event.stopPropagation();window.__dp_selectedZone='${z.id}';window.__dp_selectedSubzone=null;render()">
              إدارة الأسعار ←
            </button>
          </div>
        </div>`;
      }).join('')}
    </div>
    ${inactiveZones.length > 0 ? `<div style="margin-top:16px;font-size:12px;color:var(--text-muted)">+ ${inactiveZones.length} منطقة معطّلة</div>` : ''}
    `}
    `;
  }

  // ─── معلومات المنطقة المختارة ─────────────────────────────────
  const zone = zones.find(z => z.id === selZ);
  if (!zone) { window.__dp_selectedZone = null; return renderAdminDeliveryPricing(); }

  const zoneSubzones = subzones.filter(s => s.zoneId === selZ);
  const activeSubzones = zoneSubzones.filter(s => s.active !== false);

  // ──────────────────────────────────────────────────────────────
  //  صفحة 3: العناوين الفرعية
  // ──────────────────────────────────────────────────────────────
  if (!selSZ) {
    return `
    <div class="dp-breadcrumb">
      <span class="dp-bc-link" onclick="window.__dp_selectedVehicleType=null;window.__dp_selectedGov=null;window.__dp_selectedZone=null;window.__dp_selectedSubzone=null;render()">🚚 أسعار التوصيل</span>
      <span>›</span>
      <span class="dp-bc-link" onclick="window.__dp_selectedGov=null;window.__dp_selectedZone=null;window.__dp_selectedSubzone=null;render()">${escHtml(vt.icon)} ${escHtml(vt.name)}</span>
      <span>›</span>
      <span class="dp-bc-link" onclick="window.__dp_selectedZone=null;window.__dp_selectedSubzone=null;render()">🏛️ ${escHtml(gov.name)}</span>
      <span>›</span>
      <span style="color:var(--text-main);font-weight:700">📍 ${escHtml(zone.name)}</span>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div>
        <h2 style="margin:0;font-family:'Cairo',sans-serif;font-weight:800">📍 ${escHtml(zone.name)}</h2>
        <p style="color:var(--text-muted);font-size:13px;margin:3px 0 0">اختر العنوان الفرعي لإدارة مسارات التوصيل لـ ${escHtml(vt.icon)} ${escHtml(vt.name)}</p>
      </div>
      <button class="btn btn-primary" onclick="dp_openAddSubzoneModal('${selZ}')">+ إضافة عنوان فرعي</button>
    </div>

    <!-- شريط البحث -->
    <div style="position:relative;margin-bottom:20px">
      <input type="text" id="dp-subzone-search"
             placeholder="🔍 ابحث عن عنوان فرعي سريعاً..."
             value="${escAttr(window.__dp_searchQuery || '')}"
             oninput="window.__dp_searchQuery=this.value;dp_filterSubzonesList()"
             style="width:100%;padding:12px 18px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:14px;color:var(--text-main);font-family:'Cairo',sans-serif;font-size:14px;transition:all 0.2s"
             onfocus="this.style.borderColor='var(--primary)';this.style.boxShadow='0 0 0 3px rgba(139,92,246,0.15)'"
             onblur="this.style.borderColor='var(--border)';this.style.boxShadow='none'">
    </div>

    ${zoneSubzones.length === 0 ? `
      <div style="text-align:center;padding:70px 20px;background:rgba(139,92,246,0.03);border:2px dashed rgba(139,92,246,0.15);border-radius:20px">
        <div style="font-size:48px;margin-bottom:14px">🏠</div>
        <h3 style="color:var(--text-secondary);font-family:'Cairo',sans-serif">لا توجد عناوين فرعية بعد</h3>
        <p style="color:var(--text-muted)">ابدأ بإضافة عناوين مثل "روكب" أو "بويش"</p>
        <button class="btn btn-primary btn-sm" onclick="dp_openAddSubzoneModal('${selZ}')">+ إضافة أول عنوان</button>
      </div>` : `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px" id="dp-subzones-grid">
      ${zoneSubzones.map(sz => {
        const szRoutes = routes.filter(r => r.zoneId === selZ && r.vehicleTypeId === selVT && r.fromArea === sz.name);
        const isActive = sz.active !== false;
        return `
        <div class="dp-subzone-card" data-name="${escAttr(sz.name)}"
             style="background:rgba(255,255,255,0.02);border:1px solid ${isActive ? 'var(--border)' : 'rgba(239,68,68,0.2)'};border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px;cursor:pointer;transition:all 0.22s ease;${!isActive?'opacity:0.6':''}"
             onmouseenter="this.style.transform='translateY(-3px)';this.style.borderColor='${vtColor}';this.style.boxShadow='0 6px 20px ${vtColor}22'"
             onmouseleave="this.style.transform='none';this.style.borderColor='${isActive ? 'var(--border)' : 'rgba(239,68,68,0.2)'}';this.style.boxShadow='none'"
             onclick="window.__dp_selectedSubzone='${sz.id}';window.__dp_searchQuery='';render()">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:38px;height:38px;border-radius:10px;background:${vtColorAlpha};display:flex;align-items:center;justify-content:center;font-size:16px">🏠</div>
              <div>
                <div style="font-size:15px;font-weight:800;font-family:'Cairo',sans-serif;color:var(--text-main)">${escHtml(sz.name)}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${szRoutes.length} مسار مسجّل</div>
              </div>
            </div>
            <div style="display:flex;gap:4px" onclick="event.stopPropagation()">
              <span class="badge ${isActive?'badge-teal':'badge-rose'}" style="font-size:10px;cursor:default">${isActive?'مفعّل':'معطّل'}</span>
            </div>
          </div>
          <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
            <button class="btn btn-primary btn-sm" style="flex:1;font-family:'Cairo',sans-serif;font-size:12px" onclick="window.__dp_selectedSubzone='${sz.id}';window.__dp_searchQuery='';render()">المسارات ←</button>
            <button class="btn btn-sm btn-secondary" onclick="dp_openEditSubzoneModal('${sz.id}')" style="padding:5px 8px" title="تعديل">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="dp_confirmDeleteSubzone('${sz.id}','${escHtml(sz.name)}')" style="padding:5px 8px" title="حذف">🗑️</button>
          </div>
        </div>`;
      }).join('')}
    </div>
    `}
    `;
  }

  // ─── معلومات العنوان الفرعي المختار ──────────────────────────
  const subzone = zoneSubzones.find(s => s.id === selSZ);
  if (!subzone) { window.__dp_selectedSubzone = null; return renderAdminDeliveryPricing(); }

  const subzoneRoutes = routes.filter(r =>
    r.zoneId === selZ && r.vehicleTypeId === selVT && r.fromArea === subzone.name
  );

  // ──────────────────────────────────────────────────────────────
  //  صفحة 5: المسارات والأسعار
  // ──────────────────────────────────────────────────────────────
  return `
    <div class="dp-breadcrumb">
      <span class="dp-bc-link" onclick="window.__dp_selectedVehicleType=null;window.__dp_selectedGov=null;window.__dp_selectedZone=null;window.__dp_selectedSubzone=null;render()">🚚 أسعار التوصيل</span>
      <span>›</span>
      <span class="dp-bc-link" onclick="window.__dp_selectedGov=null;window.__dp_selectedZone=null;window.__dp_selectedSubzone=null;render()">${escHtml(vt.icon)} ${escHtml(vt.name)}</span>
      <span>›</span>
      <span class="dp-bc-link" onclick="window.__dp_selectedZone=null;window.__dp_selectedSubzone=null;render()">🏛️ ${escHtml(gov.name)}</span>
      <span>›</span>
      <span class="dp-bc-link" onclick="window.__dp_selectedSubzone=null;render()">📍 ${escHtml(zone.name)}</span>
      <span>›</span>
      <span style="color:var(--text-main);font-weight:700">🏠 ${escHtml(subzone.name)}</span>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <div>
        <h2 style="margin:0;font-family:'Cairo',sans-serif;font-weight:800">🏠 ${escHtml(subzone.name)}</h2>
        <p style="color:var(--text-muted);font-size:13px;margin:3px 0 0">
          المسارات المنطلقة من "${escHtml(subzone.name)}" عبر ${escHtml(vt.icon)} ${escHtml(vt.name)}
        </p>
      </div>
      <button class="btn btn-primary" onclick="dp_openAddRouteModalForSubzone('${selZ}','${selSZ}','${selVT}')">+ إضافة مسارات جديدة</button>
    </div>

    ${subzoneRoutes.length === 0 ? `
      <div style="text-align:center;padding:70px 20px;background:rgba(16,185,129,0.03);border:2px dashed rgba(16,185,129,0.15);border-radius:20px">
        <div style="font-size:48px;margin-bottom:14px">🛣️</div>
        <h3 style="color:var(--text-secondary);font-family:'Cairo',sans-serif">لا توجد مسارات من "${escHtml(subzone.name)}" بعد</h3>
        <p style="color:var(--text-muted)">ابدأ بإضافة مسار توصيل إلى العناوين المجاورة</p>
        <button class="btn btn-primary btn-sm" onclick="dp_openAddRouteModalForSubzone('${selZ}','${selSZ}','${selVT}')">+ إضافة أول مسار</button>
      </div>` : `
    <!-- شريط البحث -->
    <div style="margin-bottom:14px">
      <input type="text" id="dp-route-search"
             placeholder="🔍 ابحث عن وجهة في الجدول..."
             oninput="dp_filterRoutesTable()"
             style="width:100%;padding:10px 16px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;color:var(--text-main);font-family:'Cairo',sans-serif;font-size:13px;transition:all 0.2s"
             onfocus="this.style.borderColor='var(--primary)'"
             onblur="this.style.borderColor='var(--border)'">
    </div>

    <div class="table-wrap" style="background:rgba(255,255,255,0.01);border:1px solid var(--border);border-radius:16px;overflow:hidden">
      <table class="admin-table">
        <thead>
          <tr>
            <th style="font-family:'Cairo',sans-serif;font-weight:700">📤 من</th>
            <th style="font-family:'Cairo',sans-serif;font-weight:700">📥 إلى</th>
            <th style="font-family:'Cairo',sans-serif;font-weight:700">💰 السعر</th>
            <th style="font-family:'Cairo',sans-serif;font-weight:700">الحالة</th>
            <th style="font-family:'Cairo',sans-serif;font-weight:700">الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${subzoneRoutes.map(r => `
          <tr class="dp-route-row" data-to="${escAttr(r.toArea)}" data-from="${escAttr(r.fromArea)}">
            <td><strong style="color:${vtColor};font-size:14px">${escHtml(r.fromArea)}</strong></td>
            <td><strong style="font-size:14px">${escHtml(r.toArea)}</strong></td>
            <td><span style="font-size:15px;font-weight:800;color:#10b981">${(r.price||0).toLocaleString('ar')} ريال</span></td>
            <td><span class="badge ${r.active!==false?'badge-teal':'badge-rose'}">${r.active!==false?'فعّال':'معطّل'}</span></td>
            <td style="white-space:nowrap">
              <button class="btn btn-sm btn-secondary" onclick="dp_openEditRouteModal('${r.id}')">✏️ تعديل</button>
              <button class="btn btn-sm btn-danger" onclick="dp_confirmDeleteRoute('${r.id}','${escHtml(r.fromArea)}','${escHtml(r.toArea)}')">🗑️</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    `}
  `;
};

// ══════════════════════════════════════════════════════════════════
//  فلترة بالـ DOM (بدون إعادة رسم)
// ══════════════════════════════════════════════════════════════════
window.dp_filterSubzonesList = function() {
  const q = (document.getElementById('dp-subzone-search')?.value || '').trim().toLowerCase();
  document.querySelectorAll('.dp-subzone-card').forEach(c => {
    const name = (c.getAttribute('data-name') || '').toLowerCase();
    c.style.display = name.includes(q) ? '' : 'none';
  });
};

window.dp_filterRoutesTable = function() {
  const q = (document.getElementById('dp-route-search')?.value || '').trim().toLowerCase();
  document.querySelectorAll('.dp-route-row').forEach(r => {
    const to   = (r.getAttribute('data-to')   || '').toLowerCase();
    const from = (r.getAttribute('data-from') || '').toLowerCase();
    r.style.display = (to.includes(q) || from.includes(q)) ? '' : 'none';
  });
};

// ══════════════════════════════════════════════════════════════════
//  نوافذ: أنواع المركبات
// ══════════════════════════════════════════════════════════════════
function _buildVehicleTypeModal(vt = null) {
  const icons  = _DP_DEFAULT_ICONS;
  const colors = _DP_DEFAULT_COLORS;
  const selIcon  = vt?.icon  || '🚗';
  const selColor = vt?.color || '#3b82f6';

  return `
  <style>
    .dp-icon-pick { display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px }
    .dp-icon-btn { padding:10px;font-size:22px;border:2px solid var(--border);border-radius:10px;cursor:pointer;transition:all .15s;text-align:center;background:rgba(255,255,255,0.02) }
    .dp-icon-btn.selected { border-color:var(--primary);background:rgba(139,92,246,0.12) }
    .dp-icon-btn:hover { border-color:var(--primary) }
    .dp-color-pick { display:flex;flex-wrap:wrap;gap:8px;margin-top:8px }
    .dp-color-dot { width:32px;height:32px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:all .15s;flex-shrink:0 }
    .dp-color-dot.selected { border-color:#fff;box-shadow:0 0 0 2px var(--primary) }
  </style>
  <div class="modal-header">
    <h2 class="modal-title">${vt ? '✏️ تعديل نوع المركبة' : '🚗 إضافة نوع مركبة جديد'}</h2>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div style="padding:20px;display:flex;flex-direction:column;gap:16px;overflow-y:auto;max-height:70vh">
    <div class="form-group">
      <label class="form-label">اسم نوع المركبة <span style="color:#ef4444">*</span></label>
      <input class="form-control" id="dp-vt-name" value="${escHtml(vt?.name||'')}" placeholder="مثال: سيارة، دراجة نارية، شاحنة..." autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">الأيقونة</label>
      <div class="dp-icon-pick" id="dp-icon-grid">
        ${icons.map(ic => `
        <div class="dp-icon-btn ${ic===selIcon?'selected':''}" onclick="dp_selectVtIcon(this,'${ic}')" title="${ic}">${ic}</div>`).join('')}
      </div>
      <input type="hidden" id="dp-vt-icon" value="${escHtml(selIcon)}">
    </div>
    <div class="form-group">
      <label class="form-label">اللون</label>
      <div class="dp-color-pick" id="dp-color-grid">
        ${colors.map(c => `
        <div class="dp-color-dot ${c===selColor?'selected':''}" style="background:${c}" onclick="dp_selectVtColor(this,'${c}')" title="${c}"></div>`).join('')}
        <input type="color" id="dp-vt-color-custom" value="${selColor}"
               style="width:32px;height:32px;border-radius:50%;border:3px solid transparent;cursor:pointer;padding:0"
               oninput="dp_selectVtColorCustom(this.value)">
      </div>
      <input type="hidden" id="dp-vt-color" value="${escHtml(selColor)}">
    </div>
    <div class="form-group">
      <label class="form-label">ترتيب العرض</label>
      <input class="form-control" id="dp-vt-order" type="number" min="1" value="${vt?.order||''}" placeholder="1، 2، 3...">
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="dp_submitVehicleType(${vt?`'${vt.id}'`:'null'})">✅ حفظ</button>
    </div>
  </div>`;
}

window.dp_selectVtIcon = function(el, icon) {
  document.querySelectorAll('.dp-icon-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('dp-vt-icon').value = icon;
};
window.dp_selectVtColor = function(el, color) {
  document.querySelectorAll('.dp-color-dot').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('dp-vt-color').value = color;
  const picker = document.getElementById('dp-vt-color-custom');
  if (picker) picker.value = color;
};
window.dp_selectVtColorCustom = function(color) {
  document.querySelectorAll('.dp-color-dot').forEach(d => d.classList.remove('selected'));
  document.getElementById('dp-vt-color').value = color;
};

window.dp_openAddVehicleTypeModal  = function() { openModal(_buildVehicleTypeModal()); };
window.dp_openEditVehicleTypeModal = function(id) {
  const vt = (AppData.deliveryVehicleTypes||[]).find(v=>v.id===id);
  if (vt) openModal(_buildVehicleTypeModal(vt));
};

window.dp_submitVehicleType = async function(id=null) {
  if (window.__dp_isSavingVT) return;
  const name  = document.getElementById('dp-vt-name')?.value?.trim();
  const icon  = document.getElementById('dp-vt-icon')?.value  || '🚗';
  const color = document.getElementById('dp-vt-color')?.value || '#3b82f6';
  const order = document.getElementById('dp-vt-order')?.value;
  if (!name) { toast('يرجى إدخال اسم نوع المركبة','warning'); return; }

  window.__dp_isSavingVT = true;
  showLoader('جاري الحفظ...');
  try {
    const ok = await dp_saveVehicleType({ name, icon, color, order: order ? Number(order) : undefined }, id === 'null' ? null : id);
    if (ok) { toast('✅ تم الحفظ','success'); closeModal(); await render(); }
    else toast('فشل الحفظ','error');
  } catch(e) { toast('حدث خطأ','error'); }
  finally { window.__dp_isSavingVT = false; hideLoader(); }
};

window.dp_confirmDeleteVehicleType = function(id, name) {
  if (!confirm(`هل أنت متأكد من حذف نوع المركبة "${name}"؟\nسيتم حذف جميع المسارات المرتبطة به.`)) return;
  dp_deleteVehicleType(id).then(ok => {
    if (ok) { toast('✅ تم الحذف','success'); render(); }
    else toast('فشل الحذف','error');
  });
};

// ══════════════════════════════════════════════════════════════════
//  نوافذ: المحافظات
// ══════════════════════════════════════════════════════════════════
window.dp_openAddGovModal = function() {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">🏛️ إضافة محافظة جديدة</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
      <div class="form-group">
        <label class="form-label">اسم المحافظة <span style="color:#ef4444">*</span></label>
        <input class="form-control" id="dp-gov-name" placeholder="مثال: حضرموت، عدن، صنعاء..." autofocus>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="dp_submitGov()">✅ حفظ</button>
      </div>
    </div>`);
};

window.dp_openEditGovModal = function(id) {
  const g = (AppData.deliveryGovernorates||[]).find(gov=>gov.id===id);
  if (!g) return;
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ تعديل المحافظة</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
      <div class="form-group">
        <label class="form-label">اسم المحافظة</label>
        <input class="form-control" id="dp-gov-name" value="${escHtml(g.name||'')}">
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:14px 16px">
        <div>
          <div style="font-weight:700;font-size:14px">الحالة</div>
          <div style="font-size:12px;color:var(--text-muted)">تفعيل أو تعطيل هذه المحافظة</div>
        </div>
        <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0">
          <input type="checkbox" id="dp-gov-active" ${g.active!==false?'checked':''} style="opacity:0;width:0;height:0">
          <span onclick="this.previousElementSibling.click()" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:${g.active!==false?'var(--primary)':'rgba(255,255,255,0.1)'};border-radius:24px;transition:.25s"></span>
        </label>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="dp_submitGov('${id}')">✅ حفظ</button>
      </div>
    </div>`);
};

window.dp_submitGov = async function(id=null) {
  if (window.__dp_isSavingGov) return;
  const name   = document.getElementById('dp-gov-name')?.value?.trim();
  const active = document.getElementById('dp-gov-active')?.checked ?? true;
  if (!name) { toast('يرجى إدخال اسم المحافظة','warning'); return; }
  window.__dp_isSavingGov = true;
  showLoader('جاري الحفظ...');
  try {
    const ok = await dp_saveGovernorate({ name, active }, id);
    if (ok) { toast(`✅ تم ${id?'تعديل':'إضافة'} المحافظة`,'success'); closeModal(); await render(); }
    else toast('فشل الحفظ','error');
  } catch(e) { toast('حدث خطأ','error'); }
  finally { window.__dp_isSavingGov = false; hideLoader(); }
};

window.dp_confirmDeleteGov = function(id, name) {
  if (!confirm(`هل أنت متأكد من حذف محافظة "${name}"؟\nسيتم فصل كافة المناطق المرتبطة بها (تعيينها بلا محافظة) دون حذفها.`)) return;
  dp_deleteGovernorate(id).then(ok => {
    if (ok) { toast('✅ تم الحذف','success'); render(); }
    else toast('فشل الحذف','error');
  });
};

window.dp_openManageGovsModal = function() {
  const govs = AppData.deliveryGovernorates || [];
  openModal(`
    <div class="modal-header"><h2 class="modal-title">⚙️ إدارة المحافظات</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="padding:16px 20px;overflow-y:auto;max-height:60vh">
      ${govs.length === 0 ? '<p style="text-align:center;color:var(--text-muted)">لا توجد محافظات بعد</p>' : `
      <div style="display:flex;flex-direction:column;gap:8px">
        ${govs.map(g => `
        <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;padding:10px 14px">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge ${g.active!==false?'badge-teal':'badge-rose'}" style="font-size:10px">${g.active!==false?'فعّال':'معطّل'}</span>
            <span style="font-weight:700;font-family:'Cairo',sans-serif">${escHtml(g.name)}</span>
          </div>
          <div style="display:flex;gap:5px">
            <button class="btn btn-sm btn-secondary" onclick="closeModal();dp_openEditGovModal('${g.id}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="closeModal();dp_confirmDeleteGov('${g.id}','${escHtml(g.name)}')">🗑️</button>
          </div>
        </div>`).join('')}
      </div>`}
    </div>
    <div style="padding:12px 20px;border-top:1px solid var(--border)">
      <button class="btn btn-primary" style="width:100%" onclick="closeModal();dp_openAddGovModal()">+ إضافة محافظة جديدة</button>
    </div>`);
};

// ══════════════════════════════════════════════════════════════════
//  نوافذ: المناطق الرئيسية
// ══════════════════════════════════════════════════════════════════
window.dp_openAddZoneModal = function() {
  const govs = AppData.deliveryGovernorates || [];
  const selectedGovId = window.__dp_selectedGov || '';
  openModal(`
    <div class="modal-header"><h2 class="modal-title">🗺️ إضافة منطقة رئيسية</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
      <div class="form-group">
        <label class="form-label">المحافظة التابعة لها <span style="color:#ef4444">*</span></label>
        <select class="form-control" id="dp-zone-govid" onchange="dp_onZoneGovSelectChange(this.value)">
          <option value="">— اختر المحافظة —</option>
          ${govs.filter(g => g.active !== false).map(g => `
            <option value="${g.id}" ${g.id === selectedGovId ? 'selected' : ''}>${escHtml(g.name)}</option>
          `).join('')}
          <option value="new_gov" style="color:var(--primary); font-weight:bold;">+ إضافة محافظة جديدة...</option>
        </select>
        <div id="dp-zone-newgov-container" style="display:none; margin-top: 10px; border: 1px dashed rgba(139,92,246,0.3); padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.01);">
          <label class="form-label" style="font-size:12px; margin-bottom:4px;">اسم المحافظة الجديدة <span style="color:#ef4444">*</span></label>
          <input class="form-control" id="dp-zone-newgov-name" placeholder="مثال: حضرموت، عدن، صنعاء...">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">اسم المنطقة <span style="color:#ef4444">*</span></label>
        <input class="form-control" id="dp-zone-name" placeholder="مثال: المكلا، سيئون، مكة..." autofocus>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="dp_submitZone()">✅ حفظ</button>
      </div>
    </div>`);
};

window.dp_openEditZoneModal = function(id) {
  const z = (AppData.deliveryZones||[]).find(z=>z.id===id);
  if (!z) return;
  const govs = AppData.deliveryGovernorates || [];
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ تعديل المنطقة</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
      <div class="form-group">
        <label class="form-label">المحافظة التابعة لها <span style="color:#ef4444">*</span></label>
        <select class="form-control" id="dp-zone-govid" onchange="dp_onZoneGovSelectChange(this.value)">
          <option value="">— اختر المحافظة —</option>
          ${govs.filter(g => g.active !== false).map(g => `
            <option value="${g.id}" ${g.id === z.govId ? 'selected' : ''}>${escHtml(g.name)}</option>
          `).join('')}
          <option value="new_gov" style="color:var(--primary); font-weight:bold;">+ إضافة محافظة جديدة...</option>
        </select>
        <div id="dp-zone-newgov-container" style="display:none; margin-top: 10px; border: 1px dashed rgba(139,92,246,0.3); padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.01);">
          <label class="form-label" style="font-size:12px; margin-bottom:4px;">اسم المحافظة الجديدة <span style="color:#ef4444">*</span></label>
          <input class="form-control" id="dp-zone-newgov-name" placeholder="مثال: حضرموت، عدن...">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">اسم المنطقة</label>
        <input class="form-control" id="dp-zone-name" value="${escHtml(z.name||'')}">
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:14px 16px">
        <div>
          <div style="font-weight:700;font-size:14px">الحالة</div>
          <div style="font-size:12px;color:var(--text-muted)">تفعيل أو تعطيل هذه المنطقة</div>
        </div>
        <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0">
          <input type="checkbox" id="dp-zone-active" ${z.active!==false?'checked':''} style="opacity:0;width:0;height:0">
          <span onclick="this.previousElementSibling.click()" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:${z.active!==false?'var(--primary)':'rgba(255,255,255,0.1)'};border-radius:24px;transition:.25s"></span>
        </label>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="dp_submitZone('${id}')">✅ حفظ</button>
      </div>
    </div>`);
};

window.dp_onZoneGovSelectChange = function(val) {
  const container = document.getElementById('dp-zone-newgov-container');
  if (container) {
    container.style.display = val === 'new_gov' ? 'block' : 'none';
  }
};

window.dp_submitZone = async function(id=null) {
  if (window.__dp_isSavingZone) return;
  const name   = document.getElementById('dp-zone-name')?.value?.trim();
  let govId  = document.getElementById('dp-zone-govid')?.value || null;
  const active = document.getElementById('dp-zone-active')?.checked ?? true;
  if (!govId) { toast('يرجى تحديد المحافظة','warning'); return; }
  
  window.__dp_isSavingZone = true;
  showLoader('جاري الحفظ...');
  try {
    if (govId === 'new_gov') {
      const newGovName = document.getElementById('dp-zone-newgov-name')?.value?.trim();
      if (!newGovName) {
        toast('يرجى إدخال اسم المحافظة الجديدة','warning');
        window.__dp_isSavingZone = false;
        hideLoader();
        return;
      }
      const savedGovId = await dp_saveGovernorate({ name: newGovName, active: true }, null);
      if (!savedGovId || savedGovId === true) {
        toast('فشل حفظ المحافظة الجديدة','error');
        window.__dp_isSavingZone = false;
        hideLoader();
        return;
      }
      govId = savedGovId;
    }
    
    if (!name) { toast('يرجى إدخال اسم المنطقة','warning'); return; }
    const ok = await dp_saveZone({ name, govId, active }, id);
    if (ok) { toast(`✅ تم ${id?'تعديل':'إضافة'} المنطقة`,'success'); closeModal(); await render(); }
    else toast('فشل الحفظ','error');
  } catch(e) { toast('حدث خطأ','error'); }
  finally { window.__dp_isSavingZone = false; hideLoader(); }
};

window.dp_confirmDeleteZone = function(id, name) {
  if (!confirm(`حذف منطقة "${name}" وكافة عناوينها ومساراتها؟`)) return;
  dp_deleteZone(id).then(ok => {
    if (ok) { toast('✅ تم الحذف','success'); render(); }
    else toast('فشل الحذف','error');
  });
};

window.dp_openManageZonesModal = function() {
  const zones = AppData.deliveryZones || [];
  const selectedGovId = window.__dp_selectedGov;
  const filtered = selectedGovId ? zones.filter(z => z.govId === selectedGovId) : zones;
  openModal(`
    <div class="modal-header"><h2 class="modal-title">⚙️ إدارة المناطق الرئيسية</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="padding:16px 20px;overflow-y:auto;max-height:60vh">
      ${filtered.length === 0 ? '<p style="text-align:center;color:var(--text-muted)">لا توجد مناطق بعد</p>' : `
      <div style="display:flex;flex-direction:column;gap:8px">
        ${filtered.map(z => `
        <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;padding:10px 14px">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge ${z.active!==false?'badge-teal':'badge-rose'}" style="font-size:10px">${z.active!==false?'فعّال':'معطّل'}</span>
            <span style="font-weight:700;font-family:'Cairo',sans-serif">${escHtml(z.name)}</span>
          </div>
          <div style="display:flex;gap:5px">
            <button class="btn btn-sm btn-secondary" onclick="closeModal();dp_openEditZoneModal('${z.id}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="closeModal();dp_confirmDeleteZone('${z.id}','${escHtml(z.name)}')">🗑️</button>
          </div>
        </div>`).join('')}
      </div>`}
    </div>
    <div style="padding:12px 20px;border-top:1px solid var(--border)">
      <button class="btn btn-primary" style="width:100%" onclick="closeModal();dp_openAddZoneModal()">+ إضافة منطقة جديدة</button>
    </div>`);
};

// ══════════════════════════════════════════════════════════════════
//  نوافذ: العناوين الفرعية
// ══════════════════════════════════════════════════════════════════
window.dp_openAddSubzoneModal = function(zoneId) {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">🏠 إضافة عنوان فرعي</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
      <div class="form-group">
        <label class="form-label">اسم العنوان الفرعي <span style="color:#ef4444">*</span></label>
        <input class="form-control" id="dp-sz-name" placeholder="مثال: روكب، بويش، الديس..." autofocus>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="dp_submitSubzone('${zoneId}')">✅ حفظ</button>
      </div>
    </div>`);
};

window.dp_openEditSubzoneModal = function(id) {
  const sz = (AppData.deliverySubzones||[]).find(s=>s.id===id);
  if (!sz) return;
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ تعديل العنوان الفرعي</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
      <div class="form-group">
        <label class="form-label">الاسم</label>
        <input class="form-control" id="dp-sz-name" value="${escHtml(sz.name||'')}">
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:14px 16px">
        <div>
          <div style="font-weight:700;font-size:14px">الحالة</div>
          <div style="font-size:12px;color:var(--text-muted)">تفعيل أو تعطيل هذا العنوان</div>
        </div>
        <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0">
          <input type="checkbox" id="dp-sz-active" ${sz.active!==false?'checked':''} style="opacity:0;width:0;height:0">
          <span onclick="this.previousElementSibling.click()" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:${sz.active!==false?'var(--primary)':'rgba(255,255,255,0.1)'};border-radius:24px;transition:.25s"></span>
        </label>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="dp_submitSubzone('${sz.zoneId}','${id}')">✅ حفظ</button>
      </div>
    </div>`);
};

window.dp_submitSubzone = async function(zoneId, id=null) {
  if (window.__dp_isSavingSubzone) return;
  const name   = document.getElementById('dp-sz-name')?.value?.trim();
  const active = document.getElementById('dp-sz-active')?.checked ?? true;
  if (!name) { toast('يرجى إدخال الاسم','warning'); return; }
  window.__dp_isSavingSubzone = true;
  showLoader('جاري الحفظ...');
  try {
    const ok = await dp_saveSubzone({ zoneId, name, active }, id);
    if (ok) { toast('✅ تم الحفظ','success'); closeModal(); await render(); }
    else toast('فشل الحفظ','error');
  } catch(e) { toast('حدث خطأ','error'); }
  finally { window.__dp_isSavingSubzone = false; hideLoader(); }
};

window.dp_confirmDeleteSubzone = function(id, name) {
  if (!confirm(`حذف العنوان "${name}"؟`)) return;
  dp_deleteSubzone(id).then(ok => {
    if (ok) { toast('✅ تم الحذف','success'); render(); }
    else toast('فشل الحذف','error');
  });
};

// ══════════════════════════════════════════════════════════════════
//  نوافذ: المسارات والأسعار
// ══════════════════════════════════════════════════════════════════
function _buildRouteModal(zoneId, vehicleTypeId, r=null, fixedSubzoneId=null) {
  const subzones = (AppData.deliverySubzones||[]).filter(s => s.zoneId === zoneId && s.active !== false);
  const vt       = (AppData.deliveryVehicleTypes||[]).find(v => v.id === vehicleTypeId);

  let fromArea = r?.fromArea || '';
  if (fixedSubzoneId && !r) {
    const fixedSz = subzones.find(s => s.id === fixedSubzoneId);
    if (fixedSz) fromArea = fixedSz.name;
  }

  return `
  <style>
    .dp-sz-check { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:10px 8px;border:2px solid var(--border);border-radius:12px;cursor:pointer;transition:all .15s;text-align:center;min-height:65px;background:rgba(255,255,255,0.02);font-size:13px;font-weight:700 }
    .dp-sz-check:hover { border-color:rgba(139,92,246,0.4);transform:translateY(-2px) }
    .dp-sz-check.sel { border-color:var(--primary);background:rgba(139,92,246,0.1);color:var(--primary) }
    .dp-sz-check input { display:none }
  </style>
  <div class="modal-header">
    <h2 class="modal-title">${r?'✏️ تعديل مسار':'🛣️ إضافة مسار توصيل'}</h2>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div style="padding:20px;display:flex;flex-direction:column;gap:16px;overflow-y:auto;max-height:75vh">
    <input type="hidden" id="dp-route-vtid" value="${escAttr(vehicleTypeId)}">
    <input type="hidden" id="dp-route-zone" value="${escAttr(zoneId)}">

    ${vt ? `
    <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;padding:10px 14px;font-size:13px;color:var(--text-muted);display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">${escHtml(vt.icon||'🚗')}</span>
      <span>نوع المركبة: <strong style="color:var(--text-main)">${escHtml(vt.name)}</strong></span>
    </div>` : ''}

    <div class="form-group">
      <label class="form-label">📤 من (نقطة الاستلام) <span style="color:#ef4444">*</span></label>
      ${fixedSubzoneId && !r ? `
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:8px">
        <span style="font-size:16px">🏠</span>
        <strong style="color:var(--primary)">${escHtml(fromArea)}</strong>
        <input type="hidden" id="dp-route-from" value="${escAttr(fromArea)}">
        <span style="font-size:11px;color:var(--text-muted);margin-right:auto">(محددة مسبقاً)</span>
      </div>` : `
      ${subzones.length > 0 ? `
        <select class="form-control" id="dp-route-from">
          <option value="" disabled ${!fromArea?'selected':''}>اختر العنوان...</option>
          ${subzones.map(s=>`<option value="${escAttr(s.name)}" ${fromArea===s.name?'selected':''}>🏠 ${escHtml(s.name)}</option>`).join('')}
        </select>` : `
        <input class="form-control" id="dp-route-from" placeholder="اكتب العنوان..." value="${escHtml(fromArea)}">`}
      `}
    </div>

    <div class="form-group">
      <label class="form-label" style="display:flex;justify-content:space-between;align-items:center">
        <span>📥 إلى (وجهة العميل) <span style="color:#ef4444">*</span></span>
        ${!r && subzones.length > 0 ? `
        <div style="display:flex;gap:5px">
          <button type="button" class="btn btn-sm btn-secondary" style="font-size:11px;padding:2px 8px" onclick="dp_toggleAllRouteSubzones(true)">تحديد الكل</button>
          <button type="button" class="btn btn-sm btn-secondary" style="font-size:11px;padding:2px 8px" onclick="dp_toggleAllRouteSubzones(false)">إلغاء الكل</button>
        </div>` : ''}
      </label>
      ${r ? `
        <input class="form-control" id="dp-route-to" value="${escHtml(r.toArea||'')}" style="opacity:0.8" readonly>
      ` : `
        ${subzones.length > 0 ? `
        <div style="margin-bottom:8px">
          <input type="text" id="dp-modal-sz-search" placeholder="🔍 بحث سريع في العناوين..."
                 oninput="dp_filterModalSubzones()"
                 style="width:100%;padding:7px 12px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;color:var(--text-main);font-family:'Cairo',sans-serif;font-size:12px">
        </div>
        <div style="background:rgba(255,255,255,0.01);border:1px solid var(--border);border-radius:12px;padding:14px;max-height:200px;overflow-y:auto">
          <div id="dp-modal-sz-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px">
            ${subzones.map(s => `
            <label class="dp-sz-check" data-name="${escAttr(s.name)}"
                   onmouseenter="if(!this.querySelector('input').checked)this.style.borderColor='rgba(139,92,246,0.4)'"
                   onmouseleave="if(!this.querySelector('input').checked)this.style.borderColor='var(--border)'">
              <input type="checkbox" name="dp-to-sz" value="${escAttr(s.name)}"
                     onchange="this.parentElement.classList.toggle('sel',this.checked)">
              <span>🏠</span>
              <span>${escHtml(s.name)}</span>
            </label>`).join('')}
          </div>
        </div>` : `
        <input class="form-control" id="dp-route-to" placeholder="اكتب العنوان...">`}
      `}
    </div>

    <div class="form-group">
      <label class="form-label">💰 سعر التوصيل (ريال) <span style="color:#ef4444">*</span></label>
      <input class="form-control" id="dp-route-price" type="number" min="0" placeholder="مثال: 1000" value="${r?.price||''}">
    </div>

    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="dp_submitRoute(${r?`'${r.id}'`:'null'})">✅ حفظ المسار</button>
    </div>
  </div>`;
}

window.dp_toggleAllRouteSubzones = function(val) {
  document.getElementsByName('dp-to-sz').forEach(c => {
    c.checked = val;
    c.parentElement.classList.toggle('sel', val);
  });
};

window.dp_filterModalSubzones = function() {
  const q = (document.getElementById('dp-modal-sz-search')?.value || '').trim().toLowerCase();
  document.querySelectorAll('#dp-modal-sz-grid label').forEach(l => {
    const n = (l.getAttribute('data-name') || '').toLowerCase();
    l.style.display = n.includes(q) ? '' : 'none';
  });
};

window.dp_openAddRouteModal = function(zoneId, vehicleTypeId) {
  openModal(_buildRouteModal(zoneId, vehicleTypeId));
};

window.dp_openAddRouteModalForSubzone = function(zoneId, subzoneId, vehicleTypeId) {
  const vtid = vehicleTypeId || window.__dp_selectedVehicleType;
  openModal(_buildRouteModal(zoneId, vtid, null, subzoneId));
};

window.dp_openEditRouteModal = function(id) {
  const r = (AppData.deliveryRoutes||[]).find(r=>r.id===id);
  if (!r) return;
  openModal(_buildRouteModal(r.zoneId, r.vehicleTypeId, r));
};

window.dp_submitRoute = async function(id=null) {
  if (window.__dp_isSavingRoute) return;
  const zoneId       = document.getElementById('dp-route-zone')?.value;
  const vehicleTypeId = document.getElementById('dp-route-vtid')?.value;
  const fromArea     = document.getElementById('dp-route-from')?.value?.trim();
  const price        = document.getElementById('dp-route-price')?.value;

  let toAreas = [];
  const checks = document.getElementsByName('dp-to-sz');
  if (checks.length > 0) {
    checks.forEach(c => { if (c.checked) toAreas.push(c.value); });
  } else {
    const to = document.getElementById('dp-route-to')?.value?.trim();
    if (to) toAreas.push(to);
  }

  if (!fromArea || toAreas.length === 0) { toast('يرجى تحديد نقطة الانطلاق ووجهة واحدة على الأقل','warning'); return; }
  if (!price || Number(price) < 0) { toast('يرجى إدخال سعر صحيح','warning'); return; }

  window.__dp_isSavingRoute = true;
  showLoader('جاري حفظ المسارات...');
  try {
    if (id && id !== 'null') {
      await dp_saveRoute({ vehicleTypeId, zoneId, fromArea, toArea: toAreas[0], price, active: true }, id);
    } else {
      const existing = AppData.deliveryRoutes || [];
      const promises = [];
      toAreas.forEach(to => {
        const exists1 = existing.some(r => r.vehicleTypeId===vehicleTypeId && r.zoneId===zoneId && r.fromArea===fromArea && r.toArea===to);
        if (!exists1) promises.push(dp_saveRoute({ vehicleTypeId, zoneId, fromArea, toArea: to, price, active: true }));
        if (fromArea !== to) {
          const exists2 = existing.some(r => r.vehicleTypeId===vehicleTypeId && r.zoneId===zoneId && r.fromArea===to && r.toArea===fromArea);
          if (!exists2) promises.push(dp_saveRoute({ vehicleTypeId, zoneId, fromArea: to, toArea: fromArea, price, active: true }));
        }
      });
      await Promise.all(promises);
    }
    toast('✅ تم حفظ المسارات بنجاح','success');
    closeModal();
    await render();
  } catch(e) { toast('حدث خطأ أثناء الحفظ','error'); }
  finally { window.__dp_isSavingRoute = false; hideLoader(); }
};

window.dp_confirmDeleteRoute = function(id, from, to) {
  if (!confirm(`حذف مسار "${from} → ${to}"؟`)) return;
  dp_deleteRoute(id).then(ok => {
    if (ok) { toast('✅ تم حذف المسار','success'); render(); }
    else toast('فشل الحذف','error');
  });
};

// ══════════════════════════════════════════════════════════════════
//  قاعدة العناوين — صفحة إدارة مستقلة شاملة
// ══════════════════════════════════════════════════════════════════
window.__da_expandedZones  = window.__da_expandedZones  || {};
window.__da_searchQuery    = window.__da_searchQuery    || '';
window.__da_activeFilter   = window.__da_activeFilter   || 'all'; // 'all' | 'active' | 'inactive'

window.renderAdminDeliveryAddresses = function() {
  const govs     = AppData.deliveryGovernorates  || [];
  const zones    = AppData.deliveryZones    || [];
  const subzones = AppData.deliverySubzones || [];
  const routes   = AppData.deliveryRoutes   || [];

  const q      = (window.__da_searchQuery || '').trim().toLowerCase();
  const filter = window.__da_activeFilter || 'all';

  const totalSubzones = subzones.length;
  const totalRoutes   = routes.length;
  const activeZones   = zones.filter(z => z.active !== false).length;

  // تصفية المناطق
  let filteredZones = zones;
  if (filter === 'active')   filteredZones = zones.filter(z => z.active !== false);
  if (filter === 'inactive') filteredZones = zones.filter(z => z.active === false);
  if (q) filteredZones = filteredZones.filter(z =>
    (z.name || '').toLowerCase().includes(q) ||
    subzones.filter(s => s.zoneId === z.id).some(s => (s.name||'').toLowerCase().includes(q))
  );

  // تجميع المناطق حسب المحافظة
  const govsWithZones = govs.map(g => {
    const gZones = filteredZones.filter(z => z.govId === g.id);
    return { ...g, zones: gZones };
  }).filter(g => g.zones.length > 0 || filter === 'all');

  const legacyZones = filteredZones.filter(z => !z.govId);

  return `
  <style>
    .da-stat-card {
      background: var(--glass-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      gap: 14px;
      flex: 1;
      min-width: 140px;
    }
    .da-stat-icon {
      width: 48px; height: 48px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; flex-shrink: 0;
    }
    .da-zone-card {
      background: var(--glass-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      transition: border-color 0.2s;
    }
    .da-zone-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 18px; cursor: pointer; user-select: none;
      transition: background 0.15s;
    }
    .da-zone-header:hover { background: rgba(255,255,255,0.03); }
    .da-zone-body {
      padding: 0 16px 16px;
      border-top: 1px solid var(--border);
    }
    .da-sz-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 10px;
      font-size: 13px; font-weight: 600;
      border: 1px solid var(--border);
      background: rgba(255,255,255,0.02);
      transition: all 0.15s;
      font-family: 'Cairo', sans-serif;
    }
    .da-sz-chip:hover { border-color: var(--primary); background: rgba(139,92,246,0.06); }
    .da-filter-btn {
      padding: 7px 16px; border-radius: 10px; font-size: 13px; font-weight: 700;
      border: 1px solid var(--border); background: transparent;
      color: var(--text-muted); cursor: pointer; transition: all 0.15s;
      font-family: 'Cairo', sans-serif;
    }
    .da-filter-btn.active {
      background: var(--primary); border-color: var(--primary);
      color: #fff; box-shadow: 0 3px 12px rgba(139,92,246,0.3);
    }
  </style>

  <!-- ─── العنوان والإحصائيات ─────────────────────────── -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;flex-wrap:wrap;gap:12px">
    <div>
      <h2 style="margin:0;font-family:'Cairo',sans-serif;font-weight:800;font-size:22px">🗺️ قاعدة بيانات العناوين</h2>
      <p style="color:var(--text-muted);font-size:13px;margin:5px 0 0">إدارة موحّدة لجميع المناطق والعناوين الفرعية — مشتركة بين جميع أنواع المركبات</p>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary" onclick="dp_openManageGovsModal();window.__da_refreshOnClose=true">
        ⚙️ إدارة المحافظات
      </button>
      <button class="btn btn-secondary" onclick="dp_openAddGovModal();window.__da_refreshOnClose=true">
        + إضافة محافظة
      </button>
      <button class="btn btn-primary" onclick="dp_openAddZoneModal();window.__da_refreshOnClose=true">
        + إضافة منطقة رئيسية
      </button>
    </div>
  </div>

  <!-- إحصائيات سريعة -->
  <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px">
    <div class="da-stat-card">
      <div class="da-stat-icon" style="background:rgba(59,130,246,0.12);color:#3b82f6">🗺️</div>
      <div>
        <div style="font-size:24px;font-weight:900;font-family:'Cairo',sans-serif">${zones.length}</div>
        <div style="font-size:12px;color:var(--text-muted)">إجمالي المناطق</div>
      </div>
    </div>
    <div class="da-stat-card">
      <div class="da-stat-icon" style="background:rgba(16,185,129,0.12);color:#10b981">✅</div>
      <div>
        <div style="font-size:24px;font-weight:900;font-family:'Cairo',sans-serif">${activeZones}</div>
        <div style="font-size:12px;color:var(--text-muted)">مناطق مفعّلة</div>
      </div>
    </div>
    <div class="da-stat-card">
      <div class="da-stat-icon" style="background:rgba(139,92,246,0.12);color:#8b5cf6">🏠</div>
      <div>
        <div style="font-size:24px;font-weight:900;font-family:'Cairo',sans-serif">${totalSubzones}</div>
        <div style="font-size:12px;color:var(--text-muted)">عنوان فرعي</div>
      </div>
    </div>
    <div class="da-stat-card">
      <div class="da-stat-icon" style="background:rgba(249,115,22,0.12);color:#f97316">🛣️</div>
      <div>
        <div style="font-size:24px;font-weight:900;font-family:'Cairo',sans-serif">${totalRoutes}</div>
        <div style="font-size:12px;color:var(--text-muted)">مسار توصيل</div>
      </div>
    </div>
  </div>

  <!-- ─── شريط البحث والفلتر ──────────────────────────── -->
  <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap">
    <div style="position:relative;flex:1;min-width:200px">
      <span style="position:absolute;top:50%;transform:translateY(-50%);right:14px;font-size:15px;pointer-events:none">🔍</span>
      <input type="text" id="da-search-input"
             placeholder="ابحث عن منطقة أو عنوان فرعي..."
             value="${escHtml(window.__da_searchQuery||'')}"
             oninput="window.__da_searchQuery=this.value;da_filterInPlace()"
             style="width:100%;padding:11px 40px 11px 16px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;color:var(--text-main);font-family:'Cairo',sans-serif;font-size:14px;box-sizing:border-box;transition:all 0.2s"
             onfocus="this.style.borderColor='var(--primary)';this.style.boxShadow='0 0 0 3px rgba(139,92,246,0.12)'"
             onblur="this.style.borderColor='var(--border)';this.style.boxShadow='none'">
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      <button class="da-filter-btn ${filter==='all'?'active':''}"     onclick="window.__da_activeFilter='all';render()">الكل (${zones.length})</button>
      <button class="da-filter-btn ${filter==='active'?'active':''}"  onclick="window.__da_activeFilter='active';render()">مفعّل (${activeZones})</button>
      <button class="da-filter-btn ${filter==='inactive'?'active':''}" onclick="window.__da_activeFilter='inactive';render()">معطّل (${zones.length-activeZones})</button>
    </div>
    <button class="btn btn-secondary btn-sm" onclick="da_expandAll()" title="فتح الكل" style="padding:8px 14px">📂 فتح الكل</button>
    <button class="btn btn-secondary btn-sm" onclick="da_collapseAll()" title="طي الكل" style="padding:8px 14px">📁 طي الكل</button>
  </div>

  <!-- ─── قائمة المحافظات والمناطق ───────────────────────────────── -->
  <div id="da-zones-list" style="display:flex;flex-direction:column;gap:24px">
    ${govsWithZones.map(g => `
      <div style="background:rgba(139,92,246,0.02);border:1px solid rgba(139,92,246,0.15);border-radius:20px;padding:18px">
        <h3 style="margin:0 0 14px;font-family:'Cairo',sans-serif;font-weight:800;font-size:17px;color:var(--primary);display:flex;align-items:center;gap:8px">
          🏛️ ${escHtml(g.name)} 
          <span style="font-size:12px;font-weight:500;color:var(--text-muted)">(${g.zones.length} منطقة رئيسية)</span>
        </h3>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${g.zones.map(z => {
            const zSubzones  = subzones.filter(s => s.zoneId === z.id);
            const zRoutes    = routes.filter(r => r.zoneId === z.id);
            const isExpanded = window.__da_expandedZones[z.id] !== false;
            const isActive   = z.active !== false;
            const qLow       = q;

            const filteredSz = qLow
              ? zSubzones.filter(s => (s.name||'').toLowerCase().includes(qLow))
              : zSubzones;

            return `
            <div class="da-zone-card" id="da-zone-${z.id}" style="border-color:${isActive?'var(--border)':'rgba(239,68,68,0.25)'};background:var(--bg-card)">
              <div class="da-zone-header" onclick="da_toggleZone('${z.id}')">
                <div style="display:flex;align-items:center;gap:12px">
                  <div style="width:10px;height:10px;border-radius:50%;background:${isActive?'#10b981':'#ef4444'};flex-shrink:0;box-shadow:0 0 0 3px ${isActive?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.15)'}"></div>
                  <div>
                    <div style="font-size:16px;font-weight:800;font-family:'Cairo',sans-serif;color:var(--text-main)">
                      📍 ${escHtml(z.name)}
                      <span style="font-size:11px;font-weight:500;color:var(--text-muted);margin-right:6px">(${zSubzones.length} عنوان · ${zRoutes.length} مسار)</span>
                    </div>
                    ${!isActive ? `<div style="font-size:11px;color:#ef4444;margin-top:2px">معطّلة — لن تظهر في أسعار التوصيل</div>` : ''}
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px" onclick="event.stopPropagation()">
                  <button class="btn btn-sm btn-secondary" onclick="dp_openAddSubzoneModal('${z.id}')" title="إضافة عنوان فرعي" style="padding:5px 10px;font-size:12px">+ عنوان</button>
                  <button class="btn btn-sm btn-secondary" onclick="dp_openEditZoneModal('${z.id}')" title="تعديل المنطقة" style="padding:5px 10px;font-size:12px">✏️</button>
                  <button class="btn btn-sm btn-danger" onclick="dp_confirmDeleteZone('${z.id}','${escHtml(z.name)}')" title="حذف المنطقة" style="padding:5px 10px;font-size:12px">🗑️</button>
                  <div style="color:var(--text-muted);font-size:18px;transition:transform 0.2s;transform:rotate(${isExpanded?'180':'0'}deg)" id="da-arrow-${z.id}">⌄</div>
                </div>
              </div>

              ${isExpanded ? `
              <div class="da-zone-body">
                ${filteredSz.length === 0 ? `
                <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">
                  ${qLow ? `لا توجد نتائج في هذه المنطقة لـ "${escHtml(qLow)}"` : 'لا توجد عناوين فرعية بعد'}
                  ${!qLow ? `<br><button class="btn btn-sm btn-primary" style="margin-top:8px" onclick="dp_openAddSubzoneModal('${z.id}')">+ إضافة عنوان فرعي</button>` : ''}
                </div>` : `
                <div style="display:flex;flex-wrap:wrap;gap:8px;padding-top:14px">
                  ${filteredSz.map(sz => {
                    const szRoutes  = routes.filter(r => r.fromArea === sz.name && r.zoneId === z.id).length;
                    const szActive  = sz.active !== false;
                    return `
                    <div class="da-sz-chip" style="${!szActive?'opacity:0.5;':''}">
                      <span style="color:${szActive?'#10b981':'#ef4444'};font-size:9px">●</span>
                      <span>${escHtml(sz.name)}</span>
                      ${szRoutes > 0 ? `<span style="font-size:10px;background:rgba(139,92,246,0.15);color:var(--primary);padding:1px 5px;border-radius:6px;font-weight:700">${szRoutes}</span>` : ''}
                      <span style="display:flex;gap:3px;margin-right:2px">
                        <button onclick="dp_openEditSubzoneModal('${sz.id}')" style="background:none;border:none;cursor:pointer;font-size:12px;padding:0;color:var(--text-muted)" title="تعديل">✏️</button>
                        <button onclick="dp_confirmDeleteSubzone('${sz.id}','${escHtml(sz.name)}')" style="background:none;border:none;cursor:pointer;font-size:12px;padding:0;color:var(--text-muted)" title="حذف">🗑️</button>
                      </span>
                    </div>`;
                  }).join('')}
                  <button class="da-sz-chip" onclick="dp_openAddSubzoneModal('${z.id}')"
                          style="border-style:dashed;color:var(--primary);border-color:rgba(139,92,246,0.3);background:rgba(139,92,246,0.04)"
                          onmouseenter="this.style.background='rgba(139,92,246,0.1)'"
                          onmouseleave="this.style.background='rgba(139,92,246,0.04)'">
                    <span style="font-size:16px;font-weight:500">+</span> إضافة عنوان
                  </button>
                </div>`}
              </div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
    `).join('')}

    ${legacyZones.length > 0 ? `
      <div style="background:rgba(239,68,68,0.02);border:1px dashed rgba(239,68,68,0.25);border-radius:20px;padding:18px;margin-top:20px">
        <h3 style="margin:0 0 14px;font-family:'Cairo',sans-serif;font-weight:800;font-size:17px;color:#ef4444;display:flex;align-items:center;gap:8px">
          ⚠️ مناطق قديمة (بدون محافظة)
          <span style="font-size:12px;font-weight:500;color:var(--text-muted)">(${legacyZones.length} منطقة رئيسية)</span>
        </h3>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${legacyZones.map(z => {
            const zSubzones  = subzones.filter(s => s.zoneId === z.id);
            const zRoutes    = routes.filter(r => r.zoneId === z.id);
            const isExpanded = window.__da_expandedZones[z.id] !== false;
            const isActive   = z.active !== false;
            const qLow       = q;

            const filteredSz = qLow
              ? zSubzones.filter(s => (s.name||'').toLowerCase().includes(qLow))
              : zSubzones;

            return `
            <div class="da-zone-card" id="da-zone-${z.id}" style="border-color:${isActive?'var(--border)':'rgba(239,68,68,0.25)'};background:var(--bg-card)">
              <div class="da-zone-header" onclick="da_toggleZone('${z.id}')">
                <div style="display:flex;align-items:center;gap:12px">
                  <div style="width:10px;height:10px;border-radius:50%;background:${isActive?'#10b981':'#ef4444'};flex-shrink:0;box-shadow:0 0 0 3px ${isActive?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.15)'}"></div>
                  <div>
                    <div style="font-size:16px;font-weight:800;font-family:'Cairo',sans-serif;color:var(--text-main)">
                      📍 ${escHtml(z.name)}
                      <span style="font-size:11px;font-weight:500;color:var(--text-muted);margin-right:6px">(${zSubzones.length} عنوان · ${zRoutes.length} مسار)</span>
                    </div>
                    ${!isActive ? `<div style="font-size:11px;color:#ef4444;margin-top:2px">معطّلة — لن تظهر في أسعار التوصيل</div>` : ''}
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px" onclick="event.stopPropagation()">
                  <button class="btn btn-sm btn-secondary" onclick="dp_openAddSubzoneModal('${z.id}')" title="إضافة عنوان فرعي" style="padding:5px 10px;font-size:12px">+ عنوان</button>
                  <button class="btn btn-sm btn-secondary" onclick="dp_openEditZoneModal('${z.id}')" title="تعديل المنطقة / ربطها بمحافظة" style="padding:5px 10px;font-size:12px">✏️ تعديل / ربط</button>
                  <button class="btn btn-sm btn-danger" onclick="dp_confirmDeleteZone('${z.id}','${escHtml(z.name)}')" title="حذف المنطقة" style="padding:5px 10px;font-size:12px">🗑️</button>
                  <div style="color:var(--text-muted);font-size:18px;transition:transform 0.2s;transform:rotate(${isExpanded?'180':'0'}deg)" id="da-arrow-${z.id}">⌄</div>
                </div>
              </div>

              ${isExpanded ? `
              <div class="da-zone-body">
                ${filteredSz.length === 0 ? `
                <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">
                  ${qLow ? `لا توجد نتائج في هذه المنطقة لـ "${escHtml(qLow)}"` : 'لا توجد عناوين فرعية بعد'}
                  ${!qLow ? `<br><button class="btn btn-sm btn-primary" style="margin-top:8px" onclick="dp_openAddSubzoneModal('${z.id}')">+ إضافة عنوان فرعي</button>` : ''}
                </div>` : `
                <div style="display:flex;flex-wrap:wrap;gap:8px;padding-top:14px">
                  ${filteredSz.map(sz => {
                    const szRoutes  = routes.filter(r => r.fromArea === sz.name && r.zoneId === z.id).length;
                    const szActive  = sz.active !== false;
                    return `
                    <div class="da-sz-chip" style="${!szActive?'opacity:0.5;':''}">
                      <span style="color:${szActive?'#10b981':'#ef4444'};font-size:9px">●</span>
                      <span>${escHtml(sz.name)}</span>
                      ${szRoutes > 0 ? `<span style="font-size:10px;background:rgba(139,92,246,0.15);color:var(--primary);padding:1px 5px;border-radius:6px;font-weight:700">${szRoutes}</span>` : ''}
                      <span style="display:flex;gap:3px;margin-right:2px">
                        <button onclick="dp_openEditSubzoneModal('${sz.id}')" style="background:none;border:none;cursor:pointer;font-size:12px;padding:0;color:var(--text-muted)" title="تعديل">✏️</button>
                        <button onclick="dp_confirmDeleteSubzone('${sz.id}','${escHtml(sz.name)}')" style="background:none;border:none;cursor:pointer;font-size:12px;padding:0;color:var(--text-muted)" title="حذف">🗑️</button>
                      </span>
                    </div>`;
                  }).join('')}
                  <button class="da-sz-chip" onclick="dp_openAddSubzoneModal('${z.id}')"
                          style="border-style:dashed;color:var(--primary);border-color:rgba(139,92,246,0.3);background:rgba(139,92,246,0.04)"
                          onmouseenter="this.style.background='rgba(139,92,246,0.1)'"
                          onmouseleave="this.style.background='rgba(139,92,246,0.04)'">
                    <span style="font-size:16px;font-weight:500">+</span> إضافة عنوان
                  </button>
                </div>`}
              </div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
    ` : ''}
  </div>

  <!-- ─── رابط سريع لأسعار التوصيل ─────────────────────── -->
  <div style="margin-top:24px;padding:16px 20px;background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.2);border-radius:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">💡</span>
      <div style="font-size:13px">
        <strong>هذه العناوين مشتركة بين جميع أنواع المركبات.</strong>
        <span style="color:var(--text-muted)"> لضبط أسعار التوصيل لكل مسار، اذهب إلى قسم أسعار التوصيل.</span>
      </div>
    </div>
    <button class="btn btn-primary btn-sm" onclick="setAdminTab('delivery_pricing')">🚚 أسعار التوصيل ←</button>
  </div>
  `;
};

// ─── مساعدات قاعدة العناوين ──────────────────────────────────────
window.da_toggleZone = function(id) {
  const wasExpanded = window.__da_expandedZones[id] !== false;
  window.__da_expandedZones[id] = !wasExpanded;

  const card  = document.getElementById(`da-zone-${id}`);
  const arrow = document.getElementById(`da-arrow-${id}`);
  if (!card) return;

  if (!wasExpanded) {
    // فتح: أعد رسم بسيط
    render();
  } else {
    // إغلاق: أعد رسم بسيط
    render();
  }
};

window.da_expandAll = function() {
  (AppData.deliveryZones || []).forEach(z => { window.__da_expandedZones[z.id] = true; });
  render();
};
window.da_collapseAll = function() {
  (AppData.deliveryZones || []).forEach(z => { window.__da_expandedZones[z.id] = false; });
  render();
};

window.da_filterInPlace = function() {
  const q = (window.__da_searchQuery || '').trim().toLowerCase();
  const zones    = AppData.deliveryZones    || [];
  const subzones = AppData.deliverySubzones || [];

  document.querySelectorAll('.da-zone-card').forEach(card => {
    const zId   = card.id.replace('da-zone-','');
    const zone  = zones.find(z => z.id === zId);
    if (!zone) return;
    const zoneName = (zone.name || '').toLowerCase();
    const szNames  = subzones.filter(s => s.zoneId === zId).map(s => (s.name||'').toLowerCase());
    const matches  = !q || zoneName.includes(q) || szNames.some(n => n.includes(q));
    card.style.display = matches ? '' : 'none';
  });
};

// Final override after load: ensure our admin renderers and tab setter persist
try {
  window.addEventListener && window.addEventListener('load', function () {
    try {
      if (typeof renderAdminUsers === 'function') window.renderAdminUsers = renderAdminUsers;
      if (typeof renderAdminOrders === 'function') window.renderAdminOrders = renderAdminOrders;
      if (typeof renderAdminWallet === 'function') window.renderAdminWallet = renderAdminWallet;
      if (typeof renderAdminPermissions === 'function') window.renderAdminPermissions = renderAdminPermissions;
      if (typeof renderAdminLoginSettings === 'function') window.renderAdminLoginSettings = renderAdminLoginSettings;

      window.setAdminTab = async function (tab) {
        const sidebarOpen = document.getElementById('adminSidebar')?.classList.contains('open');
        if (sidebarOpen) {
          const sidebar = document.getElementById('adminSidebar');
          const overlay = document.getElementById('adminSidebarOverlay');
          if (sidebar) { sidebar.classList.remove('open'); sidebar.classList.remove('dragging'); }
          if (overlay) overlay.classList.remove('open');
          document.body.style.overflow = '';
        }
        document.body.style.overflow = '';
        await navigate('admin', { tab }, sidebarOpen);
      };
    } catch (e) { console.warn('[phase3] final override failed', e); }
  });
} catch (e) { /* ignore */ }

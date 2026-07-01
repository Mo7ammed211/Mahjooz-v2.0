/* phase17.js — Major upgrades:
   1) Remove "خدمة العملاء" (cs) role; merge all permissions/data into "موظف" (staff).
   2) Multi-currency price popup (YER base, YER/USD with rates) shown at purchase time
      with admin-editable rates. NOT shown in navbar.
   3) Permission delegation — admin can grant any admin permission to any user
      (including customers); permissions list expanded.
   4) Admin can add / suspend (block login) / unsuspend / delete user accounts.
   5) Admin can toggle the loyalty rewards system on/off.
   6) Smart routing for store orders: nearest-provider cascade on rejection,
      then nearest-driver cascade on rejection, with reason picker.

   Implementation notes:
   - Adds an `app_settings` collection (single doc id="global") for runtime
     configuration: currencies, loyaltyEnabled, deliveryFee.
   - Adds an `order_routing` log collection for cascade history (auditable).
   - All overrides use `window.fn = function(){...}` (per project convention).
*/
(function () {
  'use strict';

  // ──────────────────────────────────────────────────────────────────
  // 0) Settings store (Firestore single-doc + in-memory cache)
  // ──────────────────────────────────────────────────────────────────
  const DEFAULT_SETTINGS = {
    couponsEnabled: true,
    loyaltyEnabled: true,
    currencies: [
      { code: 'YER', name: 'ريال يمني',   nameEn: 'Yemeni Rial',  rate: 1,    base: true,  symbol: '﷼ يمني' },
      { code: 'YER', name: 'ريال سعودي',  nameEn: 'Saudi Riyal',  rate: 406,  base: false, symbol: '﷼ سعودي' },
      { code: 'USD', name: 'دولار أمريكي', nameEn: 'US Dollar',    rate: 1589, base: false, symbol: '$' }
    ]
  };
  window.PH17_DEFAULTS = DEFAULT_SETTINGS;

  function _settingsDoc() {
    try { return db.collection('app_settings').doc('global'); }
    catch (e) { return null; }
  }
  window.ph17_settings = function () {
    const s = (window.AppData && AppData.appSettings) || {};
    return Object.assign({}, DEFAULT_SETTINGS, s, {
      loyaltyEnabled: false, // FORCE DISABLED globally
      currencies: (s.currencies && s.currencies.length) ? s.currencies : DEFAULT_SETTINGS.currencies
    });
  };
  window.ph17_loadSettings = async function () {
    const ref = _settingsDoc(); if (!ref) return;
    try {
      const snap = await ref.get();
      AppData.appSettings = snap.exists ? snap.data() : {};
    } catch (e) {
      AppData.appSettings = {};
    }
  };
  window.ph17_saveSettings = async function (patch) {
    const ref = _settingsDoc(); if (!ref) { toast('تعذّر الحفظ','error'); return; }
    const cur = (AppData.appSettings) || {};
    const next = Object.assign({}, cur, patch);
    AppData.appSettings = next;
    await ref.set(next, { merge: true });
  };

  // Load on boot, then again after each loadAllData (capture admin updates).
  if (typeof loadAllData === 'function') {
    const __orig = window.loadAllData;
    window.loadAllData = async function () {
      const r = await __orig.apply(this, arguments);
      try { await ph17_loadSettings(); } catch (e) {}
      return r;
    };
  }
  ph17_loadSettings();

  // ──────────────────────────────────────────────────────────────────
  // 1) Migrate role 'cs' → 'staff' (keep permissions, run once per session)
  // ──────────────────────────────────────────────────────────────────
  let __ph17_migratedCs = false;
  async function migrateCsToStaff() {
    if (__ph17_migratedCs) return;
    __ph17_migratedCs = true;
    const csUsers = (AppData.users || []).filter(u => u.role === 'cs');
    for (const u of csUsers) {
      try {
        await fsUpdate('users', u.id, { role: 'staff', _migratedFromCs: true });
        u.role = 'staff';
      } catch (e) { console.warn('[phase17] cs→staff migration failed for', u.id, e); }
    }
    if (csUsers.length) console.log(`[phase17] migrated ${csUsers.length} cs users → staff`);
  }
  // Run shortly after data loads.
  setInterval(() => {
    if (AppData.users && AppData.users.length && !__ph17_migratedCs) migrateCsToStaff();
  }, 2000);

  // ──────────────────────────────────────────────────────────────────
  // 2) Suspend / unsuspend users + block suspended login
  // ──────────────────────────────────────────────────────────────────
  window.ph17_isSuspended = function (uid) {
    const u = (AppData.users || []).find(x => x.id === uid || x.uid === uid);
    return !!(u && u.suspended);
  };
  window.ph17_toggleSuspend = async function (userId) {
    const u = (AppData.users || []).find(x => x.id === userId);
    if (!u) return;
    const next = !u.suspended;
    if (next && !confirm(`تعليق حساب "${u.name}"؟ لن يتمكّن من تسجيل الدخول.`)) return;
    await fsUpdate('users', userId, { suspended: next, suspendedAt: next ? new Date() : null });
    u.suspended = next;
    toast(next ? 'تم تعليق الحساب ⏸️' : 'تم تفعيل الحساب ▶️', 'success');
    await render();
  };
  window.ph17_deleteUser = async function (userId) {
    const u = (AppData.users || []).find(x => x.id === userId);
    if (!u) return;
    if (!confirm(`حذف حساب "${u.name}" نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    if (!confirm('تأكيد الحذف النهائي؟')) return;
    try {
      await fsDelete('users', userId);
      toast('تم حذف الحساب 🗑️','success');
      if (typeof loadAllData === 'function') await loadAllData();
      await render();
    } catch (e) { toast('فشل الحذف: ' + (e.message||e),'error'); }
  };

  // Wrap login functions to reject suspended accounts.
  function wrapLoginBlock(fnName) {
    const orig = window[fnName];
    if (typeof orig !== 'function') return;
    window[fnName] = async function () {
      const r = await orig.apply(this, arguments);
      try {
        const cu = State.currentUser;
        if (cu) {
          const u = (AppData.users || []).find(x => x.uid === cu.uid || x.id === cu.uid);
          if (u && u.suspended) {
            toast('🚫 حسابك معلّق. تواصل مع الإدارة.','error');
            try { await auth.signOut(); } catch(e){}
            State.currentUser = null;
            await render();
          }
        }
      } catch (e) {}
      return r;
    };
  }
  ['loginUser','loginAdmin','submitLoginForm'].forEach(wrapLoginBlock);

  // ──────────────────────────────────────────────────────────────────
  // 3) Currency converter — popup on price/booking, no navbar UI
  // ──────────────────────────────────────────────────────────────────
  window.ph17_convert = function (amountYer, code) {
    const cur = (ph17_settings().currencies || []).find(c => c.code === code);
    if (!cur || !cur.rate) return null;
    return cur.base ? amountYer : (amountYer / cur.rate);
  };
  window.ph17_fmt = function (n, code) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    const v = Math.round(n * 100) / 100;
    const cur = (ph17_settings().currencies || []).find(c => c.code === code);
    return v.toLocaleString('en-US', {maximumFractionDigits:2}) + ' ' + (cur ? cur.symbol : code);
  };

  window.ph17_showCurrencyDialog = function (priceYer, label) {
    const setts = ph17_settings();
    const cs = setts.currencies || [];
    const base = cs.find(c => c.base) || cs[0];
    const rows = cs.map(c => {
      const v = ph17_convert(priceYer, c.code);
      return `<tr>
        <td>
          <div style="font-weight:700">${c.name||c.code}</div>
          <div style="font-size:11px;color:var(--text-muted)">${c.nameEn||''}</div>
        </td>
        <td style="text-align:center;color:var(--text-muted);font-size:12px">
          ${c.base ? '— الأساس —' : `1 ${c.code} = ${c.rate} ${base?base.code:''}`}
        </td>
        <td style="text-align:left;font-weight:800;font-size:18px;color:var(--accent-purple,#7c3aed)">
          ${ph17_fmt(v, c.code)}
        </td>
      </tr>`;
    }).join('');
    openModal(`
      <div class="modal-header">
        <h2 class="modal-title">💱 الأسعار بالعملات</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="ph17-curr-modal">
        ${label ? `<div class="ph17-curr-label">${escHtml(label)}</div>` : ''}
        <div class="ph17-curr-amt">${ph17_fmt(priceYer, base ? base.code : 'YER')}</div>
        <table class="ph17-curr-table">
          <thead><tr><th>العملة</th><th>سعر الصرف</th><th style="text-align:left">القيمة</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="ph17-curr-foot">سعر الصرف يُحدَّد من الإدارة وقد يتغيّر بمرور الوقت.</div>
      </div>`);
  };

  // Inject "💱 الأسعار بالعملات" link inside the booking modal.
  // The modal is created in pages.js / app.js via openModal(html). We wrap openModal.
  const __origOpenModal = window.openModal;
  window.openModal = function (html) {
    try {
      if (typeof html === 'string' && /confirmBooking\('([^']+)'\)/.test(html)) {
        const m = html.match(/confirmBooking\('([^']+)'\)/);
        const svcId = m && m[1];
        const svc = (AppData.services || []).find(s => s.id === svcId);
        if (svc) {
          const totalYer = (svc.price || 0) + 15;
          const link = `
            <div class="ph17-curr-link" onclick="ph17_showCurrencyDialog(${totalYer}, '${escAttr(svc.name||'')}')">
              💱 عرض السعر بالعملات الأخرى (السعودي / الدولار)
            </div>`;
          // Insert before the confirm button.
          html = html.replace(
            /(<button[^>]*onclick="confirmBooking\(')/,
            link + '$1'
          );
        }
      }
    } catch (e) { console.warn('[phase17] openModal wrap', e); }
    return __origOpenModal.apply(this, arguments);
  };

  // ──────────────────────────────────────────────────────────────────
  // 4) Loyalty toggle — gate phase12 award + redeem visibility
  // ──────────────────────────────────────────────────────────────────
  // Wrap once phase12 is loaded.
  setTimeout(() => {
    if (typeof window.ph12_levelOf !== 'function') return;
    // Wrap updateOrderStatus + updateDeliveryStatus so award is skipped if disabled.
    ['updateOrderStatus','updateDeliveryStatus'].forEach(fn => {
      const orig = window[fn];
      if (typeof orig !== 'function') return;
      window[fn] = async function (orderId, status) {
        const enabled = ph17_settings().loyaltyEnabled !== false;
        if (!enabled) {
          // Skip phase12 award by un-wrapping for this single call: easiest
          // approach is to mark a flag that a downstream wrap can read.
          window.__ph17_skipLoyalty = true;
          try { return await orig.apply(this, arguments); }
          finally { window.__ph17_skipLoyalty = false; }
        }
        return orig.apply(this, arguments);
      };
    });
  }, 1500);
  // Hide the loyalty card in renderSettingsPage when disabled.
  setTimeout(() => {
    const orig = window.renderSettingsPage;
    if (typeof orig !== 'function') return;
    window.renderSettingsPage = function () {
      let html = orig.apply(this, arguments);
      if (ph17_settings().loyaltyEnabled === false) {
        html = html.replace(/<div class="ph12-card[\s\S]*?<\/div>\s*<\/div>/g, '');
      }
      return html;
    };
  }, 1800);

  // ──────────────────────────────────────────────────────────────────
  // 5) Permissions — expand list + allow assigning to any role
  // ──────────────────────────────────────────────────────────────────
  // Extra admin-level perms a customer/staff can be granted.
  const PH17_EXTRA_PERMS = [
    // 📊 الإحصائيات والتقارير
    { k: 'dashboard',          l: '📊 لوحة التحكم: نظرة عامة' },
    { k: 'reports',            l: '📊 لوحة التحكم: التقارير المالية' },
    { k: 'advance_stats',      l: '📊 لوحة التحكم: التحليلات المتقدمة' },
    { k: 'advanced',           l: '📊 لوحة التحكم: الإحصائيات المتقدمة' },
    { k: 'driver_performance', l: '📊 لوحة التحكم: أداء المندوبين' },

    // ⚙️ الأنظمة المستقلة
    { k: 'sys_catalog',     l: '⚙️ الأنظمة: المنتجات والخدمات' },
    { k: 'sys_bookings',    l: '⚙️ الأنظمة: نظام الحجوزات' },
    { k: 'sys_professions', l: '⚙️ الأنظمة: نظام المهن' },
    { k: 'sys_services',    l: '⚙️ الأنظمة: الخدمات العامة' },
    { k: 'sys_stores',      l: '⚙️ الأنظمة: نظام المتاجر' },
    { k: 'sys_digital',     l: '⚙️ الأنظمة: المتاجر الرقمية' },
    { k: 'sys_offers',      l: '⚙️ الأنظمة: العروض والخصومات' },

    // 📦 العمليات والطلبات
    { k: 'orders',               l: '📦 العمليات: إدارة الطلبات' },
    { k: 'archived_orders',      l: '📦 العمليات: أرشيف الطلبات' },
    { k: 'live_tracking',        l: '📦 العمليات: التتبع المباشر' },
    { k: 'availability_monitor', l: '📦 العمليات: مراقبة الإتاحة' },
    { k: 'provider_svcs',        l: '📦 العمليات: خدمات المزودين (قبول/رفض)' },
    { k: 'ads',                  l: '🎨 التسويق: الإعلانات والكوبونات' },
    { k: 'customer_feedback',    l: '📝 العمليات: الاقتراحات والشكاوى' },

    // 💰 الإدارة المالية
    { k: 'wallet',              l: '💰 المالية: المحافظ الإلكترونية' },
    { k: 'wallet_audit',        l: '💰 المالية: سجل تدقيق المحافظ' },
    { k: 'deposit_docs',        l: '💰 المالية: مستندات وإيصالات الإيداع' },
    { k: 'platform_agreements', l: '💰 المالية: اتفاقيات وعقود الشركاء' },
    { k: 'audit_logs',          l: '💰 المالية: سجل العمليات الإدارية' },
    { k: 'banks',               l: '💰 المالية: الحسابات البنكية' },

    // 🎨 التسويق والمحتوى
    { k: 'cms_banners',             l: '🎨 التسويق: إدارة رسائل ونصوص النظام' },
    { k: 'broadcast_notifications', l: '🎨 التسويق: التنبيهات الجماعية' },

    // 👥 إدارة المستخدمين
    { k: 'users',              l: '👥 المستخدمين: عرض وإدارة حسابات المنصة' },
    { k: 'provider_groups',    l: '👥 المستخدمين: فروع وتصنيفات المزودين' },
    { k: 'providers_database', l: '👥 المستخدمين: قاعدة بيانات المزودين' },
    { k: 'drivers_database',   l: '👥 المستخدمين: قاعدة بيانات المندوبين' },
    { k: 'permissions',        l: '👥 المستخدمين: أدوار وصلاحيات الموظفين' },
    { k: 'staff_performance',  l: '👥 المستخدمين: أداء الموظفين وتوزيع الأقسام' },

    // 🔧 إعدادات النظام
    { k: 'signup_settings',   l: '🔧 الإعدادات: تخصيص حقول نموذج التسجيل' },
    { k: 'login_settings',    l: '🔧 الإعدادات: خيارات تسجيل الدخول' },
    { k: 'regions',           l: '🔧 الإعدادات: إدارة المناطق الجغرافية' },
    { k: 'delivery_pricing',  l: '🔧 الإعدادات: أسعار التوصيل بين المناطق' },
    { k: 'delivery_addresses',l: '🔧 الإعدادات: قاعدة عناوين التوصيل' },
    { k: 'cms_texts',         l: '🔧 الإعدادات: تخصيص النصوص والأيقونات' },
    { k: 'cms_pages',         l: '🔧 الإعدادات: الصفحات الثابتة (الشروط/الخصوصية)' },
    { k: 'ph17settings',      l: '🔧 الإعدادات: الإعدادات العامة (العملات/الولاء)' },
    { k: 'direct_routing',    l: '🔧 الإعدادات: التوجيه المباشر وتوزيع الطلبات تلقائياً' },
    { k: 'routing_timeouts',  l: '🔧 الإعدادات: إدارة أوقات قبول الطلبات التلقائية' },
    { k: 'stalled_orders',    l: '🔧 الإعدادات: معالجة الطلبات المتوقفة' },
    { k: 'free_shipping',     l: '🔧 الإعدادات: شروط التوصيل المجاني للأقسام' },
    { k: 'platform_activity', l: '🔧 الإعدادات: عرض سجل نشاط المنصة الشامل' },
    { k: 'error_dashboard',   l: '🔧 الإعدادات: عرض لوحة الأخطاء التقنية' },
    { k: 'sys_visibility',    l: '🔧 الإعدادات: التحكم الشامل في تفعيل/تعطيل أقسام المنصة' }
  ];
  const PH17_PERM_LABELS = {
    view_orders: '👁️ إجراءات: عرض وتفاصيل الطلبات في القوائم',
    edit_orders: '✍️ إجراءات: تعديل وتحديث حالة الطلبات',
    create_users: '👤 إجراءات: إنشاء حسابات المستخدمين يدوياً',
    chat_customers: '💬 إجراءات: الدردشة والمراسلة مع العملاء',
    view_wallets: '👁️ إجراءات: عرض تفاصيل وأرصدة المحافظ',
    adjust_wallets: '💵 إجراءات: تعديل أرصدة المحافظ (شحن/خصم)',
    view_reports: '👁️ إجراءات: عرض وتصدير التقارير المالية'
  };
  PH17_EXTRA_PERMS.forEach(p => PH17_PERM_LABELS[p.k] = p.l);

  // ← expose labels globally so stats.js can access them
  window.PH17_PERM_LABELS = PH17_PERM_LABELS;

  // Returns ONLY the 48 page-level permissions (old action-based ones handled via fallback)
  window.ph17_allPerms = function () {
    return PH17_EXTRA_PERMS.map(p => p.k);
  };

  window.ph17_hasPerm = function (user, key) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role !== 'staff') return false; // الصلاحيات تمنح فقط للموظفين
    const perms = user.permissions || {};

    // Fallback logic for legacy action-based permissions
    if (key === 'view_orders'   && perms.orders)  return true;
    if (key === 'edit_orders'   && perms.orders)  return true;
    if (key === 'create_users'  && perms.users)   return true;
    if (key === 'view_wallets'  && perms.wallet)  return true;
    if (key === 'adjust_wallets'&& perms.wallet)  return true;
    if (key === 'view_reports'  && perms.reports) return true;

    return !!perms[key];
  };
  window.userHasPerm = window.ph17_hasPerm;

  // ── عرض صلاحيات موظف بشكل مفصّل (modal للقراءة فقط) ──────────────────
  window.showStaffPermsView = function (userId) {
    const u = (AppData.users || []).find(x => x.id === userId);
    if (!u) return;

    const ALL    = typeof ph17_allPerms === 'function' ? ph17_allPerms() : [];
    const LABELS = window.PH17_PERM_LABELS || {};
    const perms  = u.role === 'admin'
      ? Object.fromEntries(ALL.map(k => [k, true]))
      : (u.permissions || {});
    const activeCount = ALL.filter(k => perms[k]).length;

    // Group permissions by their emoji/category prefix
    const GROUP_MAP = {
      '📊': 'الإحصائيات والتقارير',
      '⚙️': 'الأنظمة المستقلة',
      '📦': 'العمليات والطلبات',
      '💰': 'الإدارة المالية',
      '🎨': 'التسويق والمحتوى',
      '👥': 'إدارة المستخدمين',
      '🔧': 'إعدادات النظام',
      '📝': 'العمليات والطلبات'
    };
    const groups = {};
    ALL.forEach(k => {
      const raw   = LABELS[k] || k;
      const match = raw.match(/^(📊|⚙️|📦|💰|🎨|👥|🔧|📝)/);
      const emoji = match ? match[1] : '🔑';
      const gName = GROUP_MAP[emoji] || 'أخرى';
      if (!groups[gName]) groups[gName] = { emoji, items: [] };
      // Strip category prefix from label for display
      const shortLabel = raw.replace(/^[📊⚙️📦💰🎨👥🔧📝🔑]\s*[^:]+:\s*/, '');
      groups[gName].items.push({ k, label: shortLabel });
    });

    const groupsHtml = Object.entries(groups).map(([gName, g]) => `
      <div style="margin-bottom:18px">
        <div style="font-weight:800;font-size:13px;color:var(--text-muted);letter-spacing:.5px;margin-bottom:8px;text-transform:uppercase">${g.emoji} ${gName}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
          ${g.items.map(({ k, label }) => {
            const has = !!perms[k];
            return `<div style="display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:6px;background:${has ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.05)'}">
              <span style="font-size:15px;flex-shrink:0">${has ? '✅' : '❌'}</span>
              <span style="font-size:12px;color:${has ? 'var(--text-main)' : 'var(--text-muted)'};line-height:1.3">${escHtml(label)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('');

    const roleLabel = { admin: 'مدير النظام', staff: 'موظف' };
    const roleBadge = { admin: 'badge-rose',  staff: 'badge-purple' };

    openModal(`
      <div class="modal-header">
        <h2 class="modal-title">🔑 صلاحيات: ${escHtml(u.name || u.email || '—')}</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:14px;background:var(--bg-hover);border-radius:12px">
        <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#0d9488);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:800;flex-shrink:0">${(u.name||u.email||'?')[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:16px">${escHtml(u.name||'—')}</div>
          <div style="font-size:12px;color:var(--text-muted);direction:ltr">${escHtml(u.email||'—')}</div>
        </div>
        <div style="text-align:center;flex-shrink:0">
          <span class="badge ${roleBadge[u.role]||'badge-purple'}">${roleLabel[u.role]||u.role}</span>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${activeCount} / ${ALL.length} صلاحية</div>
        </div>
      </div>

      ${u.role === 'admin' ? `
        <div style="padding:10px 14px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:8px;color:#10b981;font-size:13px;margin-bottom:14px;text-align:center">
          ⭐ مدير النظام — يمتلك كافة الصلاحيات تلقائياً ولا تحتاج لتخصيص
        </div>` : ''}

      <div style="max-height:52vh;overflow-y:auto;padding-left:2px">${groupsHtml}</div>

      ${u.role === 'staff' ? `
        <button class="btn btn-primary btn-block" style="margin-top:14px"
          onclick="closeModal(); setTimeout(() => showPermsModal('${userId}'), 200)">
          ✏️ تعديل الصلاحيات
        </button>` : ''}
    `);
  };

  // Override showPermsModal to support all roles + new perms.
  window.showPermsModal = function (userId) {
    const u = (AppData.users || []).find(x => x.id === userId);
    if (!u) return;
    if (u.role !== 'staff') {
      toast('لا يمكن منح صلاحيات إدارية إلا للموظفين فقط.', 'error');
      return;
    }
    const perms = u.permissions || {};
    const all = ph17_allPerms();
    const rows = all.map(k => `
      <label class="ph17-perm-row">
        <input type="checkbox" data-perm="${k}" ${perms[k]?'checked':''}>
        <div>
          <div class="ph17-perm-l">${PH17_PERM_LABELS[k] || k}</div>
          <div class="ph17-perm-c">${k}</div>
        </div>
      </label>`).join('');
    openModal(`
      <div class="modal-header">
        <h2 class="modal-title">🔑 صلاحيات: ${escHtml(u.name)}</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div style="margin-bottom:14px;color:var(--text-muted);font-size:13px">
        الدور الحالي: <b>${u.role}</b> — يمكن منح أي صلاحيات إضافية بغضّ النظر عن الدور.
      </div>
      <div class="ph17-perm-list">${rows}</div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn btn-secondary" style="flex:1" onclick="ph17_permsSelectAll(true)">✅ اختيار الكل</button>
        <button class="btn btn-secondary" style="flex:1" onclick="ph17_permsSelectAll(false)">⛔ مسح الكل</button>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:10px" onclick="ph17_savePerms('${userId}')">💾 حفظ الصلاحيات</button>`);
  };
  window.ph17_permsSelectAll = function (val) {
    document.querySelectorAll('.ph17-perm-list input[type=checkbox]').forEach(cb => cb.checked = !!val);
  };
  window.ph17_savePerms = async function (userId) {
    const u = (AppData.users || []).find(x => x.id === userId);
    if (!u) return;
    if (u.role !== 'staff') {
      toast('لا يمكن منح صلاحيات إدارية إلا للموظفين فقط.', 'error');
      return;
    }
    const next = {};
    document.querySelectorAll('.ph17-perm-list input[type=checkbox]').forEach(cb => {
      if (cb.checked) next[cb.dataset.perm] = true;
    });
    await fsUpdate('users', userId, { permissions: next });
    closeModal();
    toast('تم حفظ الصلاحيات ✅','success');
    if (typeof loadAllData === 'function') await loadAllData();
    await render();
  };

  // ──────────────────────────────────────────────────────────────────
  // 6) Override renderAdminUsers — show 🔑 for all roles, add ⏸️/▶️/🗑️,
  //    and a suspended badge.
  // ──────────────────────────────────────────────────────────────────
  // Removed renderAdminUsers override. Functionality integrated into dashboards.js


  // Quick add-user modal (simple — admin enters email, name, role).
  window.ph17_openCreateUser = function () {
    openModal(`
      <div class="modal-header">
        <h2 class="modal-title">➕ إضافة مستخدم جديد</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="form-group"><label class="form-label">الاسم</label><input class="form-control" id="ph17-cu-name" placeholder="الاسم الكامل"></div>
      <div class="form-group"><label class="form-label">البريد الإلكتروني</label><input class="form-control" id="ph17-cu-email" type="email" placeholder="user@example.com"></div>
      <div class="form-group"><label class="form-label">الجوال</label><input class="form-control" id="ph17-cu-phone" placeholder="9665xxxxxxxx"></div>
      <div class="form-group"><label class="form-label">الدور</label>
        <select class="form-control" id="ph17-cu-role">
          <option value="customer">عميل</option>
          <option value="staff">موظف</option>
          <option value="vendor">صاحب خدمة</option>
          <option value="driver">مندوب</option>
          <option value="admin">مدير</option>
        </select>
      </div>
      <button class="btn btn-primary btn-block" onclick="ph17_saveCreateUser()">💾 إنشاء الحساب</button>`);
  };
  window.ph17_saveCreateUser = async function () {
    const name = document.getElementById('ph17-cu-name').value.trim();
    const email = document.getElementById('ph17-cu-email').value.trim();
    const phone = document.getElementById('ph17-cu-phone').value.trim();
    const role = document.getElementById('ph17-cu-role').value;
    if (!name || !email) { toast('الاسم والبريد مطلوبان','error'); return; }
    await fsAdd('users', { name, email, phone, role, suspended:false, permissions:{}, createdAt: new Date() });
    closeModal();
    toast('تم إنشاء الحساب ✅','success');
    if (typeof loadAllData === 'function') await loadAllData();
    await render();
  };

  // ──────────────────────────────────────────────────────────────────
  // 7) Admin Settings tab — currencies + loyalty toggle
  // ──────────────────────────────────────────────────────────────────
  // Override the admin sidebar by wrapping renderAdmin in core.js.
  // Easier: inject a tab via render dispatcher pattern that other phases use.
  setTimeout(() => {
    const origRender = window.render;
    if (typeof origRender !== 'function') return;
    // Intercept setAdminTab to allow 'ph17settings'.
    const origSet = window.setAdminTab;
    if (typeof origSet === 'function') {
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
    }
  }, 1800);

  // Insert "⚙️ الإعدادات العامة" into admin sidebar by wrapping renderAdmin html.
  // window.renderAdmin override removed to prevent conflicts with dashboards.js hub UI.



  window.ph17_setCouponsEnabled = async function (val) {
    showLoader();
    try {
      const doc = _settingsDoc();
      if (!doc) throw new Error('No DB');
      await doc.set({ couponsEnabled: val }, { merge: true });
      if (!window.AppData) window.AppData = {};
      if (!window.AppData.appSettings) window.AppData.appSettings = {};
      window.AppData.appSettings.couponsEnabled = val;
      hideLoader(); toast('تم تحديث إعداد الكوبونات', 'success');
      await render();
    } catch (e) { hideLoader(); toast('خطأ: ' + e.message, 'error'); }
  };

  function renderPh17AdminSettings() {
    const s = ph17_settings();
    const cs = s.currencies || [];
    return `
      <h2>الإعدادات العامة</h2>
      <div class="ph17-stngs-grid">
        <div class="ph17-stngs-card">
          <div class="ph17-stngs-h">🎟️ نظام الكوبونات</div>
          <p>تمكين أو إيقاف نظام الكوبونات والخصومات على مستوى المنصة بالكامل.</p>
          <label class="ph17-switch">
            <input type="checkbox" id="ph17-coupons-toggle" ${s.couponsEnabled!==false?'checked':''} onchange="ph17_setCouponsEnabled(this.checked)">
            <span>${s.couponsEnabled!==false?'مفعّل':'متوقّف'}</span>
          </label>
        </div>

        <div class="ph17-stngs-card" style="display:none">
          <div class="ph17-stngs-h">🏆 برنامج الولاء</div>
          <p>تمكين/إيقاف منح نقاط الولاء على الطلبات المكتملة.</p>
          <label class="ph17-switch">
            <input type="checkbox" id="ph17-loyalty-toggle" ${s.loyaltyEnabled!==false?'checked':''} onchange="ph17_setLoyaltyEnabled(this.checked)">
            <span>${s.loyaltyEnabled!==false?'مفعّل':'متوقّف'}</span>
          </label>
        </div>

        <div class="ph17-stngs-card">
          <div class="ph17-stngs-h">💱 العملات وأسعار الصرف</div>
          <p>أسعار الصرف بالنسبة لعملة الأساس (الريال اليمني). تظهر للعميل عند الشراء.</p>
          <table class="ph17-curr-edit">
            <thead><tr><th>الرمز</th><th>الاسم</th><th>سعر الصرف (مقابل YER)</th><th>—</th></tr></thead>
            <tbody>
              ${cs.map((c,i) => `<tr>
                <td><b>${c.code}</b>${c.base?' <span class="badge badge-gold">الأساس</span>':''}</td>
                <td><input class="form-control" data-i="${i}" data-f="name" value="${escAttr(c.name||'')}"></td>
                <td><input class="form-control" data-i="${i}" data-f="rate" type="number" step="0.0001" value="${c.rate}" ${c.base?'disabled':''}></td>
                <td>${c.base?'—':`<button class="btn btn-sm btn-danger" onclick="ph17_removeCurrency(${i})">🗑️</button>`}</td>
              </tr>`).join('')}
            </tbody>
          </table>
          <div style="display:flex;gap:8px;margin-top:8px">
            <input class="form-control" id="ph17-new-cur-code" placeholder="رمز (مثال: AED)" maxlength="6" style="max-width:140px">
            <input class="form-control" id="ph17-new-cur-name" placeholder="اسم العملة">
            <input class="form-control" id="ph17-new-cur-rate" type="number" step="0.0001" placeholder="سعر الصرف" style="max-width:160px">
            <button class="btn btn-secondary" onclick="ph17_addCurrency()">➕ إضافة</button>
          </div>
          <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="ph17_saveCurrencies()">💾 حفظ أسعار الصرف</button>
        </div>
      </div>`;
  }

  window.ph17_setLoyaltyEnabled = async function (val) {
    await ph17_saveSettings({ loyaltyEnabled: !!val });
    toast(val?'تم تفعيل الولاء 🏆':'تم إيقاف الولاء','success');
    await render();
  };
  window.ph17_addCurrency = async function () {
    const code = (document.getElementById('ph17-new-cur-code').value||'').trim().toUpperCase();
    const name = document.getElementById('ph17-new-cur-name').value.trim();
    const rate = parseFloat(document.getElementById('ph17-new-cur-rate').value);
    if (!code || !name || !rate || isNaN(rate)) { toast('عبّ كل الحقول','error'); return; }
    const cs = [...ph17_settings().currencies];
    if (cs.some(c => c.code === code)) { toast('الرمز موجود مسبقاً','error'); return; }
    cs.push({ code, name, rate, base:false, symbol: code });
    await ph17_saveSettings({ currencies: cs });
    toast('تمت الإضافة ✅','success'); await render();
  };
  window.ph17_removeCurrency = async function (idx) {
    const cs = [...ph17_settings().currencies];
    if (cs[idx]?.base) { toast('لا يمكن حذف عملة الأساس','error'); return; }
    cs.splice(idx,1);
    await ph17_saveSettings({ currencies: cs });
    toast('تم الحذف','success'); await render();
  };
  window.ph17_saveCurrencies = async function () {
    const cs = [...ph17_settings().currencies];
    document.querySelectorAll('.ph17-curr-edit input').forEach(inp => {
      const i = +inp.dataset.i, f = inp.dataset.f;
      if (!cs[i]) return;
      if (f === 'rate') cs[i].rate = parseFloat(inp.value) || cs[i].rate;
      else cs[i][f] = inp.value;
    });
    await ph17_saveSettings({ currencies: cs });
    toast('تم حفظ أسعار الصرف ✅','success');
  };

  // ──────────────────────────────────────────────────────────────────
  // 8) Smart routing: nearest-provider/driver cascade for STORE orders
  // ──────────────────────────────────────────────────────────────────
  function haversineKm(a, b) {
    if (!a || !b || a.lat==null || a.lng==null || b.lat==null || b.lng==null) return Infinity;
    const R = 6371, toRad = x => x * Math.PI/180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
    return 2*R*Math.asin(Math.sqrt(s));
  }
  function userLocation(uid) {
    const u = (AppData.users||[]).find(x => x.uid===uid || x.id===uid);
    if (!u) return null;
    if (u.lat!=null && u.lng!=null) return {lat:u.lat, lng:u.lng};
    return null;
  }

  // Build provider pool for an order: vendors who serve the same category and have a location.
  function buildProviderPool(order) {
    const svc = (AppData.services||[]).find(s => s.id === order.svcId);
    const catId = svc && svc.catId;
    if (!catId) return [];
    const customer = { lat: order.customerLat, lng: order.customerLng };
    const myService = svc;
    const candidates = (AppData.services||[])
      .filter(s => s.catId === catId)
      .map(s => {
        const vendorUid = s.vendorId;
        const u = (AppData.users||[]).find(x => x.uid===vendorUid || x.id===vendorUid);
        if (!u || u.role !== 'vendor' || u.suspended) return null;
        const loc = userLocation(vendorUid) || (s.lat!=null ? {lat:s.lat,lng:s.lng} : null);
        return { vendorId: vendorUid, name: u.name || s.provider || '—', loc };
      })
      .filter(Boolean);
    // Dedup by vendorId, keep best (with location preferred).
    const map = new Map();
    candidates.forEach(c => {
      if (!map.has(c.vendorId) || (!map.get(c.vendorId).loc && c.loc)) map.set(c.vendorId, c);
    });
    let arr = Array.from(map.values());
    const orderRegion = order.orderRegionId || order.regionId || null;
    arr.forEach(c => {
      c.distKm = customer.lat != null ? haversineKm(customer, c.loc) : 1e9;
      const u = (AppData.users||[]).find(x => x.uid === c.vendorId || x.id === c.vendorId);
      const vendorRegion = u?.regionId || null;
      const svc = (AppData.services||[]).find(s => s.vendorId === c.vendorId && s.catId === catId);
      const svcRegion = svc?.regionId || null;
      c.sameRegion = !!(orderRegion && (vendorRegion === orderRegion || svcRegion === orderRegion));
    });
    arr.sort((a,b) => {
      if (a.sameRegion && !b.sameRegion) return -1;
      if (!a.sameRegion && b.sameRegion) return 1;
      return (a.distKm || 1e9) - (b.distKm || 1e9);
    });
    return arr.map(c => c.vendorId);
  }

  window.__buildDriverPool = buildDriverPool;
  function buildDriverPool(order) {
    const customer = { lat: order.customerLat, lng: order.customerLng };
    const drivers = (AppData.users||[])
      .filter(u => u.role === 'driver' && !u.suspended)
      .filter(u => {
        const driverId = u.uid || u.id;
        const hasActiveOrder = (AppData.orders || []).some(o => 
          (o.driverId === driverId || o.assignedDriverId === driverId) && 
          o.status !== 'completed' && 
          o.status !== 'cancelled'
        );
        return !hasActiveOrder;
      })
      .map(u => ({ uid: u.uid || u.id, name: u.name, loc: userLocation(u.uid||u.id) }));
    
    const orderRegion = order.orderRegionId || order.regionId || null;
    drivers.forEach(d => {
      d.distKm = customer.lat != null ? haversineKm(customer, d.loc) : 1e9;
      const u = (AppData.users||[]).find(x => x.uid === d.uid || x.id === d.uid);
      const userRegion = u?.regionId || null;
      const entry = (AppData.ddbEntries || []).find(e => e.linkedUserId === d.uid);
      const ddbRegion = entry?.regionId || null;
      d.sameRegion = !!(orderRegion && (userRegion === orderRegion || ddbRegion === orderRegion));
    });
    drivers.sort((a,b) => {
      if (a.sameRegion && !b.sameRegion) return -1;
      if (!a.sameRegion && b.sameRegion) return 1;
      return (a.distKm || 1e9) - (b.distKm || 1e9);
    });
    return drivers.map(d => d.uid);
  }

  function isStoreOrder(order) {
    const svc = (AppData.services||[]).find(s => s.id === order.svcId);
    const cat = svc && (AppData.cats||[]).find(c => c.id === svc.catId);
    return cat && cat.section === 'stores';
  }
  window.ph17_isStoreOrder = isStoreOrder;

  // Wrap confirmBooking to start the routing pipeline for store orders.
  setTimeout(() => {
    const orig = window.confirmBooking;
    if (typeof orig !== 'function') return;
    window.confirmBooking = async function (svcId) {
      // Capture current order count to find the just-created order.
      const before = (AppData.orders||[]).length;
      const result = await orig.apply(this, arguments);
      try {
        // Reload to get the new order.
        if (typeof loadAllData === 'function') await loadAllData();
        const after = AppData.orders||[];
        const newOrder = after.slice().sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))[0];
        if (newOrder && isStoreOrder(newOrder) && !newOrder.routingKind) {
          const pool = buildProviderPool(newOrder);
          const patch = {
            routingKind: 'store',
            providerPool: pool,
            providerIdx: 0,
            providerHistory: [],
            assignedProviderId: pool[0] || null,
            vendorId: pool[0] || null,
            status: pool.length ? 'pending' : 'no_providers'
          };
          await fsUpdate('orders', newOrder.id, patch);
          if (!pool.length) toast('⚠️ لا يوجد مزوّدون متاحون لهذا المنتج حالياً','error');
          else toast(`📦 تم إرسال الطلب لأقرب مزوّد (${pool.length} مزود محتمل)`,'success');
        }
      } catch (e) { console.warn('[phase17] confirmBooking routing', e); }
      return result;
    };
  }, 2000);

  // Vendor view: show only orders where assignedProviderId === me.uid (for store orders).
  setTimeout(() => {
    const orig = window.renderVendorOrders;
    if (typeof orig !== 'function') return;
    window.renderVendorOrders = function () {
      const u = State.currentUser;
      if (!u) return orig.apply(this, arguments);
      // Inject header + reject buttons. Easiest: wrap and post-process the HTML.
      let html = orig.apply(this, arguments);
      const myStoreOrders = (AppData.orders||[]).filter(o =>
        o.routingKind === 'store' && o.assignedProviderId === u.uid &&
        ['pending','accepted'].includes(o.status)
      );
      if (myStoreOrders.length) {
        const cards = myStoreOrders.map(o => {
          const svc = (AppData.services||[]).find(s => s.id === o.svcId);
          const distInfo = (o.customerLat!=null && u.lat!=null)
            ? `≈ ${haversineKm({lat:o.customerLat,lng:o.customerLng},{lat:u.lat,lng:u.lng}).toFixed(1)} كم`
            : '';
          return `<div class="ph17-route-card">
            <div class="ph17-route-h">🏪 طلب متجر — ${escHtml(svc?.name||o.svcName||'')}</div>
            <div class="ph17-route-b">
              <div>العميل: <b>${escHtml(o.customerName||'—')}</b> ${distInfo?`<span class="ph17-route-dist">${distInfo}</span>`:''}</div>
              <div>القيمة: <b>${o.total||0} ﷼</b> · رقم: ${o.orderId||o.id}</div>
              <div>المحاولة: ${(o.providerIdx||0)+1} من ${o.providerPool?.length||1}</div>
            </div>
            <div class="ph17-route-acts">
              <button class="btn btn-success" onclick="ph17_providerAccept('${o.id}')">✅ قبول</button>
              <button class="btn btn-danger" onclick="ph17_providerRejectModal('${o.id}')">❌ رفض</button>
            </div>
          </div>`;
        }).join('');
        const banner = `<div class="ph17-route-banner">
          <h3>📥 طلبات متاجر موجّهة إليك (${myStoreOrders.length})</h3>
          ${cards}
        </div>`;
        // Insert banner at top of original html.
        html = banner + html;
      }
      return html;
    };
  }, 2000);

  // Driver view: show only orders where assignedDriverId === me.uid.
  setTimeout(() => {
    const orig = window.renderDriverOrders;
    if (typeof orig !== 'function') return;
    window.renderDriverOrders = function () {
      const u = State.currentUser;
      if (!u) return orig.apply(this, arguments);
      let html = orig.apply(this, arguments);
      const mine = (AppData.orders||[]).filter(o =>
        o.assignedDriverId === u.uid && ['provider_accepted','accepted'].includes(o.status)
      );
      if (mine.length) {
        const cards = mine.map(o => {
          const distInfo = (o.customerLat!=null && u.lat!=null)
            ? `≈ ${haversineKm({lat:o.customerLat,lng:o.customerLng},{lat:u.lat,lng:u.lng}).toFixed(1)} كم`
            : '';
          return `<div class="ph17-route-card">
            <div class="ph17-route-h">🛵 طلب توصيل — ${escHtml(o.svcName||'')}</div>
            <div class="ph17-route-b">
              <div>العميل: <b>${escHtml(o.customerName||'—')}</b> ${distInfo?`<span class="ph17-route-dist">${distInfo}</span>`:''}</div>
              <div>عنوان: ${escHtml(o.customerAddr||'—')}</div>
              <div>القيمة: <b>${o.total||0} ﷼</b> · رقم: ${o.orderId||o.id}</div>
              <div>المحاولة: ${(o.driverIdx||0)+1} من ${o.driverPool?.length||1}</div>
            </div>
            <div class="ph17-route-acts">
              <button class="btn btn-success" onclick="ph17_driverAccept('${o.id}')">✅ قبول التوصيل</button>
              <button class="btn btn-danger" onclick="ph17_driverRejectModal('${o.id}')">❌ رفض</button>
            </div>
          </div>`;
        }).join('');
        html = `<div class="ph17-route-banner"><h3>📥 طلبات موجّهة لك (${mine.length})</h3>${cards}</div>` + html;
      }
      return html;
    };
  }, 2000);

  // ── Provider actions
  window.ph17_providerAccept = async function (orderId) {
    const o = (AppData.orders||[]).find(x => x.id === orderId);
    if (!o) return;
    // Build driver pool now (drivers may not have locations; fallback to all).
    const dPool = buildDriverPool(o);
    await fsUpdate('orders', orderId, {
      status: 'provider_accepted',
      providerAcceptedAt: new Date(),
      driverPool: dPool,
      driverIdx: 0,
      driverHistory: [],
      assignedDriverId: dPool[0] || null,
      driverId: dPool[0] || null
    });
    await fsAdd('order_routing', { orderId, kind: 'provider_accept', uid: State.currentUser.uid, at: new Date() });
    toast(dPool.length?'تم القبول — تم إسناد الطلب لأقرب مندوب':'تم القبول — لا يوجد مندوبون','success');
    if (typeof loadAllData==='function') await loadAllData();
    await render();
  };

  const PROVIDER_REASONS = [
    { k:'out_of_stock', l:'المنتج غير متوفر' },
    { k:'busy',         l:'مشغول حالياً' },
    { k:'far',          l:'العميل بعيد' },
    { k:'price',        l:'السعر غير مناسب' },
    { k:'other',        l:'سبب آخر' }
  ];
  const DRIVER_REASONS = [
    { k:'busy',         l:'مشغول الآن' },
    { k:'far',          l:'الموقع بعيد جداً' },
    { k:'vehicle',      l:'مشكلة في المركبة' },
    { k:'shift_end',    l:'انتهت ساعات العمل' },
    { k:'other',        l:'سبب آخر' }
  ];

  function rejectModal(orderId, kind) {
    const reasons = kind==='provider' ? PROVIDER_REASONS : DRIVER_REASONS;
    openModal(`
      <div class="modal-header">
        <h2 class="modal-title">${kind==='provider'?'❌ رفض الطلب':'❌ رفض التوصيل'}</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="form-group">
        <label class="form-label">سبب الرفض</label>
        <select class="form-control" id="ph17-rej-reason">
          ${reasons.map(r => `<option value="${r.k}">${r.l}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">ملاحظات (اختياري)</label>
        <textarea class="form-control" id="ph17-rej-note" rows="3"></textarea>
      </div>
      <button class="btn btn-danger btn-block" onclick="${kind==='provider'?'ph17_doProviderReject':'ph17_doDriverReject'}('${orderId}')">
        تأكيد الرفض وإعادة التوجيه
      </button>`);
  }
  window.ph17_providerRejectModal = id => rejectModal(id, 'provider');
  window.ph17_driverRejectModal   = id => rejectModal(id, 'driver');

  window.ph17_doProviderReject = async function (orderId) {
    const reason = document.getElementById('ph17-rej-reason').value;
    const note = document.getElementById('ph17-rej-note').value.trim();
    const o = (AppData.orders||[]).find(x => x.id === orderId);
    if (!o) return;
    const hist = (o.providerHistory||[]).concat([{ providerId: o.assignedProviderId, reason, note, at: new Date() }]);
    const nextIdx = (o.providerIdx||0) + 1;
    const next = (o.providerPool||[])[nextIdx] || null;
    const patch = {
      providerHistory: hist,
      providerIdx: nextIdx,
      assignedProviderId: next,
      vendorId: next,
      status: next ? 'pending' : 'no_providers'
    };
    await fsUpdate('orders', orderId, patch);
    await fsAdd('order_routing', { orderId, kind:'provider_reject', reason, note, uid: State.currentUser.uid, at: new Date() });
    closeModal();
    toast(next?'تم الرفض — أُعيد التوجيه لأقرب مزوّد آخر':'تم الرفض — لا يوجد مزوّدون آخرون','success');
    if (typeof loadAllData==='function') await loadAllData();
    await render();
  };

  window.ph17_driverAccept = async function (orderId) {
    await fsUpdate('orders', orderId, { status: 'accepted', driverAcceptedAt: new Date(), driverAssignedAt: null });
    await fsAdd('order_routing', { orderId, kind:'driver_accept', uid: State.currentUser.uid, at: new Date() });
    toast('تم قبول التوصيل ✅','success');
    if (typeof loadAllData==='function') await loadAllData();
    await render();
  };

  window.ph17_doDriverReject = async function (orderId) {
    const reason = document.getElementById('ph17-rej-reason').value;
    const note = document.getElementById('ph17-rej-note').value.trim();
    const o = (AppData.orders||[]).find(x => x.id === orderId);
    if (!o) return;
    const hist = (o.driverHistory||[]).concat([{ driverId: o.assignedDriverId, reason, note, at: new Date() }]);
    const nextIdx = (o.driverIdx||0) + 1;
    const next = (o.driverPool||[])[nextIdx] || null;
    const patch = {
      driverHistory: hist,
      driverIdx: nextIdx,
      assignedDriverId: next,
      driverId: next,
      driverAssignedAt: next ? new Date() : null,
      status: next ? 'provider_accepted' : 'no_drivers'
    };
    await fsUpdate('orders', orderId, patch);
    await fsAdd('order_routing', { orderId, kind:'driver_reject', reason, note, uid: State.currentUser.uid, at: new Date() });
    closeModal();
    toast(next?'تم الرفض — أُعيد التوجيه لأقرب مندوب آخر':'تم الرفض — لا يوجد مندوبون آخرون','success');
    if (typeof loadAllData==='function') await loadAllData();
    await render();
  };

  // ──────────────────────────────────────────────────────────────────
  // CSS
  // ──────────────────────────────────────────────────────────────────
  const css = `
    /* Currency popup */
    .ph17-curr-link { display:flex; align-items:center; justify-content:center; gap:8px; padding:12px 16px; margin:14px 0; background:linear-gradient(135deg,rgba(124,58,237,.1),rgba(20,184,166,.1)); border:1px dashed rgba(124,58,237,.4); border-radius:10px; cursor:pointer; font-weight:700; color:#7c3aed; transition:all .2s; }
    .ph17-curr-link:hover { background:linear-gradient(135deg,rgba(124,58,237,.18),rgba(20,184,166,.18)); transform:translateY(-1px); }
    .ph17-curr-modal { padding:6px 0; }
    .ph17-curr-label { color:var(--text-muted); font-size:13px; margin-bottom:6px; }
    .ph17-curr-amt { font-size:30px; font-weight:800; background:linear-gradient(135deg,#7c3aed,#0d9488); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:14px; }
    .ph17-curr-table { width:100%; border-collapse:separate; border-spacing:0; border:1px solid var(--border); border-radius:12px; overflow:hidden; }
    .ph17-curr-table th { background:var(--bg-hover); padding:10px 12px; text-align:right; font-size:12px; color:var(--text-muted); font-weight:700; }
    .ph17-curr-table td { padding:12px; border-top:1px solid var(--border); }
    .ph17-curr-foot { margin-top:10px; font-size:11px; color:var(--text-muted); text-align:center; }
    /* Permissions modal */
    .ph17-perm-list { max-height:340px; overflow:auto; border:1px solid var(--border); border-radius:10px; padding:6px; }
    .ph17-perm-row { display:flex; gap:10px; align-items:center; padding:10px 12px; border-radius:8px; cursor:pointer; }
    .ph17-perm-row:hover { background:var(--bg-hover); }
    .ph17-perm-row input { width:18px; height:18px; }
    .ph17-perm-l { font-weight:600; }
    .ph17-perm-c { font-size:11px; color:var(--text-muted); direction:ltr; }
    /* Settings */
    .ph17-stngs-grid { display:grid; gap:16px; margin-top:14px; }
    .ph17-stngs-card { background:var(--bg-hover); border-radius:14px; padding:18px; border:1px solid var(--border); }
    .ph17-stngs-h { font-size:18px; font-weight:800; margin-bottom:6px; }
    .ph17-stngs-card p { color:var(--text-muted); font-size:13px; margin:0 0 12px; }
    .ph17-switch { display:inline-flex; align-items:center; gap:10px; cursor:pointer; }
    .ph17-switch input { width:22px; height:22px; }
    .ph17-curr-edit { width:100%; border-collapse:separate; border-spacing:0; }
    .ph17-curr-edit th { background:var(--bg-main, transparent); padding:8px; text-align:right; font-size:12px; color:var(--text-muted); border-bottom:1px solid var(--border); }
    .ph17-curr-edit td { padding:6px; border-bottom:1px solid var(--border); }
    .ph17-curr-edit input { font-size:14px; }
    /* Routing cards */
    .ph17-route-banner { background:linear-gradient(135deg,rgba(124,58,237,.06),rgba(20,184,166,.06)); border:1px solid rgba(124,58,237,.25); border-radius:14px; padding:16px; margin-bottom:18px; }
    .ph17-route-banner h3 { margin:0 0 12px; font-size:16px; color:#7c3aed; }
    .ph17-route-card { background:var(--bg-card,#fff); border-radius:12px; padding:14px; margin-bottom:10px; border:1px solid var(--border); }
    .ph17-route-h { font-weight:800; margin-bottom:8px; font-size:15px; }
    .ph17-route-b { font-size:13px; line-height:1.9; color:var(--text-main); }
    .ph17-route-b > div { margin-bottom:2px; }
    .ph17-route-dist { background:rgba(13,148,136,.12); color:#0d9488; padding:2px 8px; border-radius:6px; font-size:11px; margin-right:6px; font-weight:700; }
    .ph17-route-acts { display:flex; gap:8px; margin-top:12px; }
    .ph17-route-acts .btn { flex:1; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  console.log('[Phase 17] cs→staff merge, currencies, perms, suspend, loyalty toggle, smart routing — loaded.');
})();

// ═══════════════════════════════════════════════════════
//  محجوز v2.0 — Admin, Vendor, Driver, Staff Dashboards
// ═══════════════════════════════════════════════════════

// ─── Helper: Render content for rental_stores_ tabs ─────
function _renderRentalStoresTab(catId) {
  if (!catId) return '<div style="padding:40px;text-align:center;color:var(--text-muted)">معرف التصنيف غير موجود</div>';
  if (typeof window.ph_renderAdminRentalStores !== 'function') {
    return '<div style="padding:40px;color:red;text-align:center;font-weight:bold;font-size:18px;">❌ عذراً، ملف نظام التأجير لم يتم تحميله. يرجى تحديث الصفحة (Refresh).</div>';
  }
  try {
    return window.ph_renderAdminRentalStores(catId);
  } catch (err) {
    console.error('Rental Stores Render Error:', err);
    return '<div style="padding:40px;color:red;text-align:center;font-weight:bold;font-size:18px;">❌ حدث خطأ أثناء فتح المتاجر: ' + (err.message || err) + '</div>';
  }
}

// ─── خريطة التبويب ← القائمة الأم ──────────────────────────────
function _adminHubForTab(tab) {
  if (tab.startsWith('rental_stores_')) return 'hub_systems';
  const m = {
    // ── الإحصائيات والتقارير
    dashboard:'hub_stats', reports:'hub_stats', advance_stats:'hub_stats', advanced:'hub_stats', driver_performance:'hub_stats',
    // ── الأنظمة المستقلة
    sys_catalog:'hub_systems', sys_bookings:'hub_systems', sys_professions:'hub_systems', sys_services:'hub_systems',
    sys_stores:'hub_systems', sys_digital:'hub_systems', sys_offers:'hub_systems',
    // ── العمليات والطلبات
    orders:'hub_ops', ads:'hub_ops', live_tracking:'hub_ops', availability_monitor:'hub_ops', provider_svcs:'hub_ops', customer_feedback:'hub_ops',
    // ── المالية
    wallet:'hub_finance', wallet_audit:'hub_finance', banks:'hub_finance',
    // ── التسويق والمحتوى
    cms_banners:'hub_content', cms_texts:'hub_content', cms_pages:'hub_content',
    // ── إدارة المستخدمين
    users:'hub_users', permissions:'hub_users', providers_database:'hub_users', drivers_database:'hub_users',
    provider_groups:'hub_users', staff_performance:'hub_users', staff_assignments:'hub_users',
    // ── إعدادات النظام
    ph17settings:'hub_settings', signup_settings:'hub_settings', delivery_pricing:'hub_settings',
    delivery_addresses:'hub_settings', login_settings:'hub_settings', regions:'hub_settings',
    free_shipping:'hub_settings', direct_routing:'hub_settings', routing_timeouts:'hub_settings',
    stalled_orders:'hub_settings', platform_activity:'hub_settings', error_dashboard:'hub_settings',
    sys_visibility:'hub_settings',
  };
  return m[tab] || 'hub_stats';
}

// ─── Breadcrumb Renderer ──────────────────────────────────────
function _renderAdminBreadcrumb(activeTab, groups) {
  const hubId    = _adminHubForTab(activeTab);
  const hub      = groups.find(g => g.id === hubId);
  const hubItem  = groups.find(g => g.items.some(i => i.k === activeTab));
  const tabItem  = (hubItem || hub)?.items.find(i => i.k === activeTab);
  const tabLabel = tabItem?.label || activeTab;
  const tabIcon  = tabItem?.icon  || '📄';
  const hubLabel = hub?.title || hubId;
  const hubIcon  = hub?.icon  || '🏠';
  return `
  <nav class="admin-breadcrumb" aria-label="مسار التنقل">
    <button class="adm-bc-home" onclick="setAdminTab('hub_stats')" title="الصفحة الرئيسية">🏠</button>
    <span class="adm-bc-sep">›</span>
    <button class="adm-bc-item" onclick="setAdminTab('${hubId}')">${hubIcon} ${hubLabel}</button>
    <span class="adm-bc-sep">›</span>
    <span class="adm-bc-current">${tabIcon} ${tabLabel}</span>
    <button class="adm-bc-back" onclick="setAdminTab('${hubId}')">← رجوع</button>
  </nav>`;
}

// ─── Hub Page Renderer ────────────────────────────────────────
function _renderHubPage(hubId, groups) {
  const hub = groups.find(g => g.id === hubId);
  if (!hub) return '';
  return `
  <div class="admin-hub-page">
    <div class="admin-hub-hero">
      <span class="admin-hub-hero-icon">${hub.icon}</span>
      <div>
        <h1 class="admin-hub-hero-title">${hub.title}</h1>
        <p class="admin-hub-hero-sub">اختر القسم المطلوب</p>
      </div>
    </div>
    <div class="admin-hub-grid">
      ${hub.items.map(item => `
        <div class="admin-hub-card" onclick="setAdminTab('${item.k}')">
          <div class="admin-hub-card-icon">${item.icon}</div>
          <div class="admin-hub-card-body">
            <div class="admin-hub-card-title">${item.label}</div>
            <div class="admin-hub-card-desc">${item.desc || ''}</div>
          </div>
          ${item.badge ? `<span class="admin-hub-badge${item.urgent ? ' urgent' : ''}">${item.badge}</span>` : ''}
          <span class="admin-hub-card-arrow">›</span>
        </div>`).join('')}
    </div>
  </div>`;
}


window.renderAdmin = function () {
  const u = State.currentUser;
  if (!u || (u.role !== 'admin' && u.role !== 'staff')) { navigate('home'); return ''; }
  // ── حارس: يضمن دائماً إمكانية التمرير عند عرض لوحة المدير ──
  if (document.body.style.overflow === 'hidden') document.body.style.overflow = '';

  const tabPermMap = {
    dashboard: 'view_advanced_stats',
    reports: 'view_reports',
    advance_stats: 'view_advanced_stats',
    advanced: 'view_advanced_stats',
    driver_performance: 'view_reports',
    sys_catalog: 'manage_services',
    sys_bookings: 'manage_services',
    sys_professions: 'manage_services',
    sys_services: 'manage_services',
    sys_stores: 'manage_stores',
    sys_digital: 'manage_stores',
    sys_offers: 'manage_coupons',
    users: 'manage_users',
    permissions: 'manage_users',
    provider_groups: 'manage_users',
    providers_database: 'manage_users',
    drivers_database: 'manage_users',
    wallet: 'view_wallets',
    wallet_audit: 'view_wallets',
    banks: 'manage_banks',
    ads: 'manage_ads',
    cms_banners: 'manage_cms',
    signup_settings: 'manage_signup_settings',
    login_settings: 'manage_login_settings',
    regions: 'manage_regions',
    delivery_pricing: 'manage_delivery_pricing',
    delivery_addresses: 'manage_delivery_addresses',
    cms_texts: 'manage_cms',
    cms_pages: 'manage_cms',
    ph17settings: 'manage_settings',
    direct_routing: 'manage_direct_routing',
    routing_timeouts: 'manage_routing_timeouts',
    stalled_orders: 'manage_stalled_orders',
    free_shipping: 'manage_free_shipping',
    platform_activity: 'view_platform_activity',
    error_dashboard: 'view_error_dashboard',
    sys_visibility: 'manage_system_visibility',
    orders: 'view_orders',
    live_tracking: 'view_orders',
    availability_monitor: 'view_orders',
    deposit_docs: 'view_wallets',
    archived_orders: 'view_orders',
    platform_agreements: 'manage_settings',
    audit_logs: 'view_wallets',
    broadcast_notifications: 'manage_settings',
    customer_feedback: 'manage_settings'
  };

  const hasPerm = (key) => {
    if (u.role === 'admin') return true;
    if (u.role !== 'staff') return false;
    const req = tabPermMap[key];
    if (!req) return true;
    return typeof userHasPerm === 'function' ? userHasPerm(u, req) : (u.permissions && u.permissions[req]);
  };

  const initial = (u.name || 'A').trim().charAt(0).toUpperCase();

  // ── إحصائيات سريعة ──
  const pendingOrders  = (AppData.orders   || []).filter(o => o.status === 'pending' || o.status === 'pending_admin').length;
  const pendingUsers   = (AppData.users    || []).filter(u => u.status === 'pending').length;
  const pendingSvcs    = (AppData.services || []).filter(s => s.status === 'pending_approval').length;
  const totalOrders    = (AppData.orders   || []).length;

  // ── مجموعات Hub (كل زر = صفحة كروت منفصلة) ──
  const groups = [
    {
      id: 'hub_stats', icon: '📊', title: 'الإحصائيات والتقارير',
      items: [
        { k: 'dashboard',          icon: '🏠', label: 'نظرة عامة',           desc: 'ملخص الأداء والأرقام الرئيسية' },
        { k: 'reports',            icon: '📈', label: 'التقارير المالية',     desc: 'إيرادات ومصروفات مفصّلة' },
        { k: 'advance_stats',      icon: '🔬', label: 'التحليلات المتقدمة',  desc: 'إحصائيات وتوقعات ذكية' },
        { k: 'advanced',           icon: '📊', label: 'الإحصائيات المتقدمة', desc: 'رسوم بيانية وتحليلات الأداء' },
        { k: 'driver_performance', icon: '🚗', label: 'أداء المندوبين',      desc: 'تقرير الطلبات والتقييمات ووقت التوصيل' },
      ]
    },
    {
      id: 'hub_systems', icon: '⚙️', title: 'الأنظمة المستقلة',
      items: [
        { k: 'sys_catalog',     icon: '🗂️', label: 'المنتجات والخدمات', desc: 'قاعدة البيانات الموحدة — إدارة شاملة',
          badge: (() => { try { return (AppData.catalogItems||[]).filter(i=>i.status==='pending_approval').length || null; } catch(e){ return null; } })(),
          urgent: (() => { try { return (AppData.catalogItems||[]).some(i=>i.status==='pending_approval'); } catch(e){ return false; } })()
        },
        { k: 'sys_bookings',    icon: '📅', label: 'نظام الحجوزات',   desc: 'فنادق، قاعات، مرافق الحجز' },
        { k: 'sys_professions', icon: '🔧', label: 'نظام المهن',       desc: 'مهنيون وخدمات متخصصة' },
        { k: 'sys_stores',      icon: '🏪', label: 'نظام المتاجر',     desc: 'منتجات وتسوق إلكتروني' },
        { k: 'sys_digital',     icon: '🛒', label: 'المتاجر الرقمية',   desc: 'بيع بطاقات شبكة وأكواد رقمية' },
        { k: 'sys_services',    icon: '🛠️', label: 'الخدمات العامة',   desc: 'خدمات متنوعة وعامة' },
        { k: 'sys_offers',      icon: '🏷️', label: 'العروض والخصومات', desc: 'إدارة عروض الأقسام الثلاثة',
          badge: (() => { try { const now=new Date(); return (AppData.offers||[]).filter(o=>o.active&&(!o.expiresAt||(o.expiresAt.toDate?o.expiresAt.toDate():new Date(o.expiresAt))>now)).length || null; } catch(e){ return null; } })()
        },
      ]
    },
    {
      id: 'hub_ops', icon: '📦', title: 'العمليات والطلبات',
      items: [
        { k: 'orders',        icon: '📦', label: 'إدارة الطلبات',    desc: 'مراجعة وتتبع جميع الطلبات',       badge: pendingOrders || null, urgent: pendingOrders > 0 },
        { k: 'archived_orders', icon: '🗄️', label: 'أرشيف الطلبات',   desc: 'الطلبات المكتملة والمرفوضة والملغية المؤرشفة' },
        { k: 'live_tracking', icon: '🗺️', label: 'التتبع المباشر',   desc: 'تتبع المندوبين لحظياً على الخريطة' },
        { k: 'availability_monitor', icon: '📡', label: 'مراقبة الإتاحة', desc: 'حالة المزودين والمندوبين في الخدمة / خارجها' },
        { k: 'provider_svcs', icon: '🛎️', label: 'خدمات المزودين',  desc: 'مراجعة وقبول خدمات المزودين',     badge: pendingSvcs || null, urgent: pendingSvcs > 0 },
        { k: 'ads',           icon: '📣', label: 'الكوبونات والعروض',desc: 'إدارة العروض الترويجية' },
        { k: 'customer_feedback', icon: '📝', label: 'الاقتراحات والشكاوى', desc: 'استعراض والرد على شكاوى واقتراحات العملاء',
          badge: (() => { try { return (AppData.customerFeedback||[]).filter(x => x.status === 'new').length || null; } catch(e) { return null; } })(),
          urgent: (() => { try { return (AppData.customerFeedback||[]).some(x => x.status === 'new'); } catch(e) { return false; } })()
        },
      ]
    },
    {
      id: 'hub_finance', icon: '💰', title: 'الإدارة المالية',
      items: [
        { k: 'wallet',       icon: '👛', label: 'المحافظ الإلكترونية', desc: 'إدارة أرصدة المستخدمين بأمان عالٍ' },
        { k: 'wallet_audit', icon: '📋', label: 'سجل تدقيق المحافظ', desc: 'كل العمليات الإدارية على المحافظ موثّقة' },
        { k: 'deposit_docs', icon: '📄', label: 'مستندات الإيداع',    desc: 'مراجعة وتأكيد كافة مستندات وإيصالات التحويل البنكي' },
        { k: 'platform_agreements', icon: '📝', label: 'اتفاقيات الشركاء', desc: 'عقود واتفاقيات العمل الموقعة مع المزودين والمندوبين' },
        { k: 'audit_logs',   icon: '📋', label: 'سجل العمليات الإدارية', desc: 'سجل تدقيق للعمليات الحساسة التي يقوم بها الإداريون' },
        { k: 'banks',        icon: '🏦', label: 'الحسابات البنكية',    desc: 'إدارة حسابات التحويل البنكي' },
      ]
    },
    {
      id: 'hub_content', icon: '🎨', title: 'التسويق والمحتوى',
      items: [
        { k: 'ads',                   icon: '📢', label: 'الإعلانات',              desc: 'بانرات وإعلانات الصفحة الرئيسية' },
        { k: 'cms_banners',           icon: '💬', label: 'إدارة الرسائل',          desc: 'رسائل ونصوص النظام' },
        { k: 'broadcast_notifications', icon: '📣', label: 'التنبيهات الجماعية',  desc: 'إرسال إشعارات مع روابط وأزرار لجميع المستخدمين' },
      ]
    },
    {
      id: 'hub_users', icon: '👥', title: 'إدارة المستخدمين',
      items: [
        { k: 'users',             icon: '👤', label: 'كل المستخدمين',         desc: 'عرض وإدارة حسابات المنصة',              badge: (AppData.users||[]).length || null },
        { k: 'users',             icon: '⏳', label: 'حسابات معلقة',          desc: 'حسابات تنتظر الموافقة',                  badge: pendingUsers || null, urgent: pendingUsers > 0 },
        { k: 'provider_groups',   icon: '🏢', label: 'فروع المزودين',         desc: 'تصنيف مزودي الخدمات في فروع منظّمة' },
        { k: 'providers_database',icon: '🗂️', label: 'قاعدة بيانات المزودين', desc: 'إدارة مزودي الخدمات وعناوينهم وصورهم',  badge: (() => { try { return (AppData.pdbEntries||[]).length || null; } catch(e){ return null; } })() },
        { k: 'drivers_database',  icon: '🚗', label: 'قاعدة بيانات المندوبين',desc: 'إدارة مندوبي التوصيل وبياناتهم',         badge: (() => { try { return (AppData.ddbEntries||[]).length || null; } catch(e){ return null; } })() },
        { k: 'permissions',       icon: '🔑', label: 'الصلاحيات',             desc: 'أدوار وصلاحيات الموظفين' },
        { k: 'staff_performance', icon: '📊', label: 'أداء الموظفين',         desc: 'مقارنة أداء الفريق وتوزيع الأقسام' },
      ]
    },
    {
      id: 'hub_settings', icon: '🔧', title: 'إعدادات النظام',
      items: [
        { k: 'signup_settings',  icon: '📝', label: 'حقول التسجيل',     desc: 'تخصيص نموذج التسجيل' },
        { k: 'login_settings',   icon: '🔐', label: 'إعدادات الدخول',   desc: 'خيارات تسجيل الدخول' },
        { k: 'delivery_pricing',   icon: '🚚', label: 'أسعار التوصيل',    desc: 'تسعير التوصيل بين المناطق' },
        { k: 'delivery_addresses', icon: '🗺️', label: 'قاعدة العناوين',   desc: 'إدارة المناطق والعناوين الفرعية' },
        { k: 'cms_texts',        icon: '✏️', label: 'النصوص والأيقونات', desc: 'تخصيص نصوص المنصة' },
        { k: 'cms_pages',        icon: '📄', label: 'الصفحات الثابتة',  desc: 'شروط الخدمة وسياسة الخصوصية' },
        { k: 'ph17settings',     icon: '⚙️', label: 'الإعدادات العامة', desc: 'إعدادات النظام الشاملة' },
        { k: 'direct_routing',      icon: '🚦', label: 'التوجيه المباشر',           desc: 'ضبط توزيع الطلبات تلقائياً' },
        { k: 'routing_timeouts',    icon: '⏱', label: 'حد أقصى وقت القبول',        desc: 'Timeout تلقائي للمزوّدين والمندوبين' },
        { k: 'stalled_orders',     icon: '🚨', label: 'الطلبات المتوقفة',           desc: 'طلبات انتهت قوائم المزوّدين أو المندوبين',
          badge: (() => { try { return (window.AppData?.orders||[]).filter(o=>o.status==='no_providers'||o.status==='no_drivers').length || null; } catch(e){ return null; } })(),
          urgent: (() => { try { return (window.AppData?.orders||[]).some(o=>o.status==='no_providers'||o.status==='no_drivers'); } catch(e){ return false; } })()
        },
        { k: 'free_shipping',    icon: '🚚', label: 'التوصيل المجاني',   desc: 'شروط الحصول على توصيل مجاني لكل قسم' },
        { k: 'platform_activity', icon: '📋', label: 'سجل نشاط المنصة',       desc: 'جدول زمني شامل لجميع الأحداث والإجراءات على المنصة',
          badge: (() => { try { const ls = parseInt(localStorage.getItem('pal_seen_ts')||'0',10); const logs = JSON.parse(localStorage.getItem('mahjooz_error_log')||'[]'); return null; } catch(e){ return null; } })()
        },
        { k: 'error_dashboard',  icon: '🚨', label: 'لوحة الأخطاء التقنية',   desc: 'مراقبة فورية لجميع الأخطاء والتحذيرات في المنصة',
          badge: (() => { try { const logs = JSON.parse(localStorage.getItem('mahjooz_error_log') || '[]'); const c = logs.filter(l => l.type === 'error' || l.type === 'rejection').length; return c || null; } catch(e){ return null; } })(),
          urgent: (() => { try { const logs = JSON.parse(localStorage.getItem('mahjooz_error_log') || '[]'); return logs.some(l => l.type === 'error' || l.type === 'rejection'); } catch(e){ return false; } })()
        },
        { k: 'sys_visibility',   icon: '🛡️', label: 'التحكم الشامل في المنصة', desc: 'إيقاف أو إخفاء أي قسم أو نظام أو ميزة في المنصة',
          badge: (() => { try { const d = JSON.parse(localStorage.getItem('sv_config_v3')||localStorage.getItem('sv_config_v2')||'{}'); const keys=['bookings','services','stores','digital','offers','wallet','coupons','loyalty','reviews','wishlist','self_pickup','live_tracking','notifications','delivery','cancellation','arboon','free_shipping','scheduling','share','deposits','refunds','ads','hero','featured','search','hotels','car_rental','flights','medical','halls','order_notes','driver_messaging','smart_alerts','analytics_dash','reports','bulk_import','ads_management','map_tracking','vendor_analytics','wallet_admin','section_control','region_picker']; const hidden=keys.filter(k=>d[k]===false).length; const maint=['bookings','services','stores','digital','offers','hotels','car_rental','flights','medical','halls'].filter(k=>!!d[k+'_maint']).length; return (hidden+maint)||null; } catch(e){ return null; } })(),
          urgent: (() => { try { const d = JSON.parse(localStorage.getItem('sv_config_v3')||localStorage.getItem('sv_config_v2')||'{}'); return !!d.full_maint; } catch(e){ return false; } })()
        },
      ]
    },
  ];

  const allowedGroups = groups.map(g => {
    const items = g.items.filter(item => hasPerm(item.k));
    return items.length ? { ...g, items } : null;
  }).filter(Boolean);

  if (allowedGroups.length === 0) {
    toast('عذراً، لا تمتلك أي صلاحيات إدارية للوصول.', 'error');
    navigate('home');
    return '';
  }

  // Ensure active tab is allowed
  const allAllowedKeys = allowedGroups.reduce((acc, g) => {
    acc.push(g.id);
    g.items.forEach(item => acc.push(item.k));
    return acc;
  }, []);

  let activeTab = State.adminTab || (allowedGroups[0] ? allowedGroups[0].id : 'dashboard');
  if (!allAllowedKeys.includes(activeTab) && !activeTab.startsWith('rental_stores_')) {
    activeTab = allowedGroups[0] ? allowedGroups[0].id : 'dashboard';
  }

  // أيّ hub يحتوي على التبويب النشط حالياً
  const activeHub = allowedGroups.find(g => g.items.some(i => i.k === activeTab))?.id || null;

  const navHTML = allowedGroups.map(g => {
    const isActive = activeTab === g.id || activeHub === g.id;
    return `
    <button class="admin-hub-nav-btn${isActive ? ' active' : ''}" onclick="setAdminTab('${g.id}')">
      <span class="hub-nav-icon">${g.icon}</span>
      <span class="hub-nav-title">${g.title}</span>
      <span class="hub-nav-arrow">›</span>
    </button>`;
  }).join('');


  return `
    <div id="app-content">
      <div class="admin-sidebar-overlay" id="adminSidebarOverlay" onclick="closeAdminSidebar()"></div>

      <div class="admin-layout">
        <aside class="admin-sidebar" id="adminSidebar">

          <!-- ══ رأس الدرج ══ -->
          <div class="admin-sidebar-header">
            <div class="sidebar-header-row">
              <div class="sidebar-user-block">
                <div class="sidebar-avatar-lg">${initial}</div>
                <div class="sidebar-user-meta">
                  <div class="sidebar-user-name">${u.name || 'المدير'}</div>
                  <div class="sidebar-user-role">
                    <span class="sidebar-role-dot"></span>${u.role === 'admin' ? 'مدير النظام' : 'موظف النظام'}
                  </div>
                </div>
              </div>
              <button class="admin-sidebar-close" onclick="closeAdminSidebar()">✕</button>
            </div>
            <div class="sidebar-deposit-wrap">
              <div class="sidebar-deposit-chip${pendingSvcs > 0 ? ' urgent' : ''}">
                <span class="dep-val">${pendingSvcs || 0}</span>
                <span class="dep-lbl">إيداعات معلقة</span>
              </div>
            </div>
          </div>

          <!-- ══ التنقل ══ -->
          <div class="admin-sidebar-body" id="adminSidebarBody">
            ${navHTML}
          </div>

          <!-- ══ تذييل الدرج ══ -->
          <div class="sidebar-footer">
            <button class="sidebar-footer-notif" onclick="closeAdminSidebar();navigate('notifications')">مركز الإشعارات</button>
            <button class="sidebar-footer-btn" onclick="closeAdminSidebar();navigate('settings')">الإعدادات</button>
            <button class="sidebar-footer-btn sidebar-footer-danger" onclick="closeAdminSidebar();logoutConfirm()">تسجيل الخروج</button>
          </div>

        </aside>

        <main class="admin-main">
          ${!activeTab.startsWith('hub_') ? _renderAdminBreadcrumb(activeTab, allowedGroups) : ''}
          ${activeTab.startsWith('hub_')        ? _renderHubPage(activeTab, allowedGroups) : ''}
          ${activeTab === 'dashboard'            ? renderAdminDash() : ''}
          ${activeTab === 'users'               ? renderAdminUsers() : ''}
          ${activeTab === 'sys_catalog'         ? (typeof ph46_renderAdminProductsCatalog === 'function' ? ph46_renderAdminProductsCatalog() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل النظام...</div>') : ''}
          ${activeTab === 'sys_bookings'        ? renderAdminSystem('bookings') : ''}
          ${activeTab === 'sys_professions'     ? renderAdminSystem('professions') : ''}
          ${activeTab === 'sys_services'        ? renderAdminSystem('services') : ''}
          ${activeTab === 'sys_stores'          ? (typeof ph43_renderAdminStores === 'function' ? ph43_renderAdminStores() : renderAdminSystem('stores')) : ''}
          ${activeTab === 'sys_digital'         ? (typeof ph45_renderAdminDigitalStores === 'function' ? ph45_renderAdminDigitalStores() : 'جاري التحميل...') : ''}
          ${activeTab === 'sys_offers'          ? (typeof renderAdminOffers === 'function' ? renderAdminOffers() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل نظام العروض...</div>') : ''}
          ${activeTab.startsWith('rental_stores_') ? _renderRentalStoresTab(activeTab.replace('rental_stores_', '')) : ''}
           ${activeTab === 'orders'              ? renderAdminOrders() : ''}
          ${activeTab === 'archived_orders'     ? (typeof renderAdminArchivedOrders === 'function' ? renderAdminArchivedOrders() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل الأرشيف...</div>') : ''}
          ${activeTab === 'deposit_docs'        ? (typeof renderAdminDepositDocs === 'function' ? renderAdminDepositDocs() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل الإيداعات...</div>') : ''}
          ${activeTab === 'platform_agreements' ? (typeof renderAdminPlatformAgreements === 'function' ? renderAdminPlatformAgreements() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل الاتفاقيات...</div>') : ''}
          ${activeTab === 'audit_logs'          ? (typeof renderAdminAuditLogs === 'function' ? renderAdminAuditLogs() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل سجل العمليات...</div>') : ''}
          ${activeTab === 'broadcast_notifications' ? (typeof renderAdminBroadcastNotif === 'function' ? renderAdminBroadcastNotif() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل التنبيهات الجماعية...</div>') : ''}
          ${activeTab === 'ads'                 ? (typeof window.renderAdminAds === 'function' ? window.renderAdminAds() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل نظام الإعلانات...</div>') : ''}
          ${activeTab === 'wallet'              ? (typeof renderSecureWalletPanel === 'function' ? renderSecureWalletPanel() : renderAdminWallet()) : ''}
          ${activeTab === 'wallet_audit'        ? (typeof renderAdminWalletAudit === 'function' ? renderAdminWalletAudit() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري التحميل...</div>') : ''}
          ${activeTab === 'reports'             ? renderAdminReports() : ''}
          ${activeTab === 'permissions'         ? (typeof renderAdminPermissions === 'function' ? renderAdminPermissions() : renderAdminUsers()) : ''}
          ${activeTab === 'live_tracking'       ? (typeof renderAdminLiveTracking === 'function' ? renderAdminLiveTracking() : renderAdminOrders()) : ''}
          ${activeTab === 'availability_monitor' ? (typeof renderAdminAvailabilityMonitor === 'function' ? renderAdminAvailabilityMonitor() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل نظام المراقبة...</div>') : ''}
          ${activeTab === 'advance_stats'       ? (typeof renderAdvancedAnalytics === 'function' ? renderAdvancedAnalytics() : renderAdminReports()) : ''}
          ${activeTab === 'advanced'            ? (typeof renderAdminAdvancedStats === 'function' ? renderAdminAdvancedStats() : renderAdminReports()) : ''}
          ${activeTab === 'driver_performance' ? (typeof renderAdminDriverPerformance === 'function' ? renderAdminDriverPerformance() : renderAdminReports()) : ''}
          ${activeTab === 'provider_svcs'       ? (typeof renderAdminPendingSvcs === 'function' ? renderAdminPendingSvcs() : renderAdminDash()) : ''}
          ${activeTab === 'banks'               ? (typeof renderAdminBanks === 'function' ? renderAdminBanks() : renderAdminWallet()) : ''}
          ${activeTab === 'cms_banners'         ? (typeof renderAdminCmsBanners === 'function' ? renderAdminCmsBanners() : renderAdminDash()) : ''}
          ${activeTab === 'login_settings'      ? (typeof renderAdminLoginSettings === 'function' ? renderAdminLoginSettings() : renderAdminDash()) : ''}
          ${activeTab === 'regions'             ? (typeof renderAdminRegions === 'function' ? renderAdminRegions() : renderAdminDash()) : ''}
          ${activeTab === 'cms_texts'           ? (typeof renderAdminCmsTexts === 'function' ? renderAdminCmsTexts() : renderAdminDash()) : ''}
          ${activeTab === 'cms_pages'           ? (typeof renderAdminCmsPages === 'function' ? renderAdminCmsPages() : renderAdminDash()) : ''}
          ${activeTab === 'ph17settings'        ? (typeof renderPh17Settings === 'function' ? renderPh17Settings() : renderAdminDash()) : ''}
          ${activeTab === 'direct_routing'      ? (typeof ph18_renderLiveRouting === 'function' ? ph18_renderLiveRouting() : renderAdminDash()) : ''}
          ${activeTab === 'signup_settings'     ? (typeof renderAdminSignupSettings === 'function' ? renderAdminSignupSettings() : 'جاري التحميل...') : ''}
          ${activeTab === 'delivery_pricing'    ? (typeof renderAdminDeliveryPricing === 'function' ? renderAdminDeliveryPricing() : 'جاري التحميل...') : ''}
          ${activeTab === 'delivery_addresses'  ? (typeof renderAdminDeliveryAddresses === 'function' ? renderAdminDeliveryAddresses() : 'جاري التحميل...') : ''}
          ${activeTab === 'provider_groups'      ? (typeof renderAdminProviderGroups === 'function' ? renderAdminProviderGroups() : 'جاري التحميل...') : ''}
          ${activeTab === 'providers_database'  ? (typeof renderAdminProvidersDatabase === 'function' ? renderAdminProvidersDatabase() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل قاعدة بيانات المزودين...</div>') : ''}
          ${activeTab === 'drivers_database'    ? (typeof renderAdminDriversDatabase === 'function' ? renderAdminDriversDatabase() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل قاعدة بيانات المندوبين...</div>') : ''}
          ${activeTab === 'sys_visibility'      ? (typeof renderAdminSectionVisibility === 'function' ? renderAdminSectionVisibility() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل نظام التحكم...</div>') : ''}
          ${activeTab === 'free_shipping'       ? (typeof renderAdminFreeShipping === 'function' ? renderAdminFreeShipping() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل نظام التوصيل المجاني...</div>') : ''}
          ${activeTab === 'routing_timeouts'    ? (typeof renderAdminRoutingTimeouts === 'function' ? renderAdminRoutingTimeouts() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل إعدادات الـ Timeout...</div>') : ''}
          ${activeTab === 'stalled_orders'     ? (typeof renderAdminStalledOrders === 'function' ? renderAdminStalledOrders() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل الطلبات المتوقفة...</div>') : ''}
          ${activeTab === 'platform_activity' ? (typeof renderAdminPlatformActivity === 'function' ? renderAdminPlatformActivity() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل سجل النشاط...</div>') : ''}
          ${activeTab === 'error_dashboard'   ? (typeof renderAdminErrorDashboard === 'function' ? renderAdminErrorDashboard() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل لوحة الأخطاء...</div>') : ''}
          ${activeTab === 'customer_feedback' ? (typeof renderAdminCustomerFeedback === 'function' ? renderAdminCustomerFeedback() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل لوحة الاقتراحات والشكاوى...</div>') : ''}
        </main>
      </div>
    </div>
  `;
};

window.filterAdminNav = function(query) {
  const q = (query || '').trim().toLowerCase();
  const btns = document.querySelectorAll('.admin-hub-nav-btn');
  btns.forEach(btn => {
    const matches = !q || btn.textContent.toLowerCase().includes(q);
    btn.style.display = matches ? '' : 'none';
  });
};

function toggleAdminSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  if (!sidebar) return;
  sidebar.classList.contains('open') ? closeAdminSidebar() : openAdminSidebar();
}
window.toggleAdminSidebar = toggleAdminSidebar;

function openAdminSidebar() {
  const sidebar  = document.getElementById('adminSidebar');
  const overlay  = document.getElementById('adminSidebarOverlay');
  const hint     = document.getElementById('adminSwipeHint');
  if (sidebar)  sidebar.classList.add('open');
  if (overlay)  overlay.classList.add('open');
  if (hint)     hint.style.opacity = '0';
  document.body.style.overflow = 'hidden';
  _restoreSidebarGroupState();
  setTimeout(_scrollToActiveSidebarTab, 380);
  // لا نُضيف إدخالاً في التاريخ للـ sidebar — يُعالَج في popstate مباشرةً
}
window.openAdminSidebar = openAdminSidebar;

function closeAdminSidebar() {
  const sidebar  = document.getElementById('adminSidebar');
  const overlay  = document.getElementById('adminSidebarOverlay');
  const hint     = document.getElementById('adminSwipeHint');
  if (sidebar) { sidebar.classList.remove('open'); sidebar.classList.remove('dragging'); }
  if (overlay)  overlay.classList.remove('open');
  if (hint)     hint.style.opacity = '0.5';
  document.body.style.overflow = '';
}
window.closeAdminSidebar = closeAdminSidebar;

// ── طي/فتح مجموعة ──
window.toggleSidebarGroup = function(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.classList.toggle('collapsed');
  try {
    const saved = JSON.parse(localStorage.getItem('_sbGroups') || '{}');
    saved[groupId] = group.classList.contains('collapsed');
    localStorage.setItem('_sbGroups', JSON.stringify(saved));
  } catch(e) {}
};

function _restoreSidebarGroupState() {
  try {
    const saved = JSON.parse(localStorage.getItem('_sbGroups') || '{}');
    Object.entries(saved).forEach(([id, collapsed]) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('collapsed', collapsed);
    });
  } catch(e) {}
}

function _scrollToActiveSidebarTab() {
  const body = document.querySelector('.admin-sidebar-body');
  const active = body && body.querySelector('.admin-nav-item.active');
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── إغلاق بـ Escape ──
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeAdminSidebar();
});

// ── السحب بالإصبع لفتح (من حافة اليمين) وإغلاق (داخل الدرج) ──
(function initAdminSwipeGesture() {
  let startX = 0, startY = 0, edgeSwipe = false, sidebarSwipe = false, currentX = 0;
  const EDGE_ZONE = 28, OPEN_THRESH = 60, CLOSE_THRESH = 60, MAX_AX_DIFF = 40;

  document.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    edgeSwipe = startX > window.innerWidth - EDGE_ZONE;
    const sb = document.getElementById('adminSidebar');
    sidebarSwipe = sb && sb.classList.contains('open');
    currentX = startX;
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!edgeSwipe && !sidebarSwipe) return;
    currentX = e.touches[0].clientX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dy > MAX_AX_DIFF) { edgeSwipe = false; sidebarSwipe = false; return; }

    const sb = document.getElementById('adminSidebar');
    if (!sb) return;
    const dx = startX - currentX;

    if (edgeSwipe && dx < 0) {
      const pull = Math.min(-dx, 300);
      sb.classList.add('dragging');
      sb.style.transform = 'translateX(' + (300 - pull) + 'px)';
    } else if (sidebarSwipe && dx > 0) {
      sb.classList.add('dragging');
      sb.style.transform = 'translateX(' + Math.min(dx, 300) + 'px)';
    }
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    const sb = document.getElementById('adminSidebar');
    if (!sb) return;
    sb.classList.remove('dragging');
    sb.style.transform = '';
    const dx = startX - currentX;
    if (edgeSwipe && dx < -OPEN_THRESH) openAdminSidebar();
    if (sidebarSwipe && dx > CLOSE_THRESH) closeAdminSidebar();
    edgeSwipe = false; sidebarSwipe = false;
  }, { passive: true });
})();

async function setAdminTab(tab) {
  State.adminSearch = '';
  // إغلاق الـ sidebar إن كان مفتوحاً (بدون التأثير على التاريخ)
  const sidebar = document.getElementById('adminSidebar');
  if (sidebar && sidebar.classList.contains('open')) {
    closeAdminSidebar();
  }
  window._adminNavFromTab = true;
  document.body.style.overflow = '';
  // دائماً pushState لضمان تاريخ تنقّل خطوة بخطوة
  await navigate('admin', { tab }, false);
}
window.setAdminTab = setAdminTab;

// ── فتح تلقائي للدرج عند دخول لوحة المدير على الموبايل ──
(function _watchAdminSidebarMount() {
  let _lastSidebar = null;
  const obs = new MutationObserver(function() {
    const sb = document.getElementById('adminSidebar');
    if (!sb || sb === _lastSidebar) return;
    _lastSidebar = sb;
    if (window.innerWidth <= 768) {
      if (window._adminNavFromTab) {
        window._adminNavFromTab = false;
      } else {
        // فتح تلقائي فقط لصفحة admin وعند أدوار admin/staff فقط
        const isAdminPage = State.currentPage === 'admin';
        const role = State.currentUser?.role;
        const isAdminRole = role === 'admin' || role === 'staff';
        if (isAdminPage && isAdminRole && !State._adminSidebarAutoOpened) {
          State._adminSidebarAutoOpened = true;
          setTimeout(function() {
            if (!sb.classList.contains('open')) openAdminSidebar();
          }, 180);
        }
      }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();


// ─── Direct DOM Injection for Rental Stores ─────
// This bypasses setAdminTab overrides from stats.js / roles-permissions.js
window.ph_openRentalAdmin = async function(catId, storeId = null) {
  State.adminTab = 'rental_stores_' + catId;
  State.adminRentalView = storeId;
  State.adminRentalCat = null;

  // Find the admin-main container
  const mainEl = document.querySelector('.admin-main');
  if (!mainEl) {
    if (typeof render === 'function') render();
    return;
  }

  // Show loading indicator inside the panel while we fetch
  mainEl.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:12px">⏳</div><div>جاري تحميل المتاجر...</div></div>';

  // Always fetch fresh data from Firestore for rental collections
  try {
    const [freshStores, freshSubCats, freshProducts] = await Promise.all([
      db.collection('rentalStores').get(),
      db.collection('rentalSubCats').get(),
      db.collection('rentalProducts').get()
    ]);
    AppData.rentalStores   = freshStores.docs.map(d => ({ id: d.id, ...d.data() }));
    AppData.rentalSubCats  = freshSubCats.docs.map(d => ({ id: d.id, ...d.data() }));
    AppData.rentalProducts = freshProducts.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('ph_openRentalAdmin fetch error:', e);
  }

  // Update sidebar active state
  document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));

  // Render into the main panel
  const html = _renderRentalStoresTab(catId);
  mainEl.innerHTML = '<div data-rental-stores="' + catId + '">' + html + '</div>';
};



function renderAdminDash() {
  const stats = {
    users: AppData.users.filter(u=>u.role!=='admin').length,
    vendors: AppData.users.filter(u=>u.role==='vendor').length,
    customers: AppData.users.filter(u=>u.role==='customer').length,
    orders: AppData.orders.length,
    completedOrders: AppData.orders.filter(o=>o.status==='completed').length,
    totalRevenue: AppData.transactions.filter(t=>t.type==='debit').reduce((a,t)=>a+t.amount,0),
  };
  
  // Initialize Chart.js safely after render
  setTimeout(() => {
    const ctx = document.getElementById('revenueChart');
    if (ctx && window.Chart) {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
          datasets: [{
            label: 'الإيرادات الشهرية (ريال)',
            data: [0, 0, 0, 500, 1200, stats.totalRevenue],
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.2)',
            borderWidth: 3,
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } }
        }
      });
    }
  }, 100);

  return `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
      <h2 style="margin:0; font-size:20px;">📊 لوحة الإحصائيات${window.ui_helpBtn('admin_dashboard')}</h2>
      <button class="btn btn-primary btn-sm" onclick="ph6_generateStatement && ph6_generateStatement(State.currentUser.uid||State.currentUser.id, 30)">📄 تقرير PDF</button>
    </div>
    <div class="stats-grid">
      <div class="stat-card glass-card"><div class="stat-num">${stats.users}</div><div class="stat-label">المستخدمون</div></div>
      <div class="stat-card glass-card"><div class="stat-num">${stats.vendors}</div><div class="stat-label">مزودي الخدمات</div></div>
      <div class="stat-card glass-card"><div class="stat-num">${stats.customers}</div><div class="stat-label">العملاء</div></div>
      <div class="stat-card glass-card"><div class="stat-num">${stats.orders}</div><div class="stat-label">إجمالي الطلبات</div></div>
      <div class="stat-card glass-card"><div class="stat-num">${stats.completedOrders}</div><div class="stat-label">الطلبات المكتملة</div></div>
      <div class="stat-card glass-card"><div class="stat-num">${stats.totalRevenue}</div><div class="stat-label">إجمالي الإيرادات</div></div>
    </div>
    
    <div class="glass-card" style="margin-top:24px; padding:24px; border-radius: var(--radius); height: 350px;">
      <h3 style="margin-bottom:16px;">📈 الأداء المالي</h3>
      <div style="height: 250px; width: 100%;"><canvas id="revenueChart"></canvas></div>
    </div>
    
    <div class="glass-card" style="padding:24px;margin-top:24px; border-radius: var(--radius);">
      <h3 style="margin-bottom:12px">إجراءات سريعة</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="setAdminTab('cats')">إضافة تصنيف</button>
        <button class="btn btn-primary btn-sm" onclick="setAdminTab('services')">إضافة خدمة</button>
        <button class="btn btn-secondary btn-sm" onclick="setAdminTab('orders')">إدارة الطلبات</button>
        <button class="btn btn-secondary btn-sm" onclick="setAdminTab('wallet')">إدارة المحافظ</button>
      </div>
    </div>`;
}

window.renderAdminSystem = function(section) {
  const titles   = { bookings: 'نظام الحجوزات', professions: 'نظام المهن', services: 'خدمات أخرى', stores: 'نظام المتاجر' };
  const secIcons = { bookings: '📅', professions: '🔧', services: '🛠️', stores: '🏪' };

  // ── مستوى التصفح الحالي ──
  // State._sysBrowse[section] = null  →  نعرض التصنيفات
  // State._sysBrowse[section] = catId →  نعرض خدمات ذلك التصنيف
  if (!State._sysBrowse) State._sysBrowse = {};
  const activeCatId = State._sysBrowse[section] || null;

  if (activeCatId) {
    return _renderSysServices(section, activeCatId, titles, secIcons);
  }
  return _renderSysCats(section, titles, secIcons);
}

function _renderSysCats(section, titles, secIcons) {
  const cats = (AppData.cats||[]).filter(c=>c.section===section).sort((a,b)=>(a.order||0)-(b.order||0));
  const allSvcs = AppData.services || [];
  const q = (State.adminSearch||'').toLowerCase();
  const filtered = cats.filter(c => !q || (c.name||'').toLowerCase().includes(q));
  const totalSvcs = cats.reduce((t,c)=>t+allSvcs.filter(s=>s.catId===c.id).length,0);

  const grid = filtered.map(cat => {
    const svcCount = cat.catType==='rental'
      ? (AppData.rentalStores||[]).filter(s=>s.catId===cat.id).length
      : allSvcs.filter(s=>s.catId===cat.id).length;
    const isRental = cat.catType === 'rental';
    return `
    <div class="sb-cat-card" onclick="sysNavInto('${section}','${cat.id}')">
      <div class="sb-cat-icon">${cat.icon||'📂'}</div>
      <div class="sb-cat-body">
        <div class="sb-cat-name">
          ${cat.name}
          ${section === 'bookings' ? `
            <span class="ph46-badge" style="background:${isRental ? 'rgba(234,179,8,0.15)' : 'rgba(16,185,129,0.15)'}; color:${isRental ? '#eab308' : '#10b981'}; font-size:10px; margin-right:6px; padding:2px 6px; border-radius:6px; border:1px solid ${isRental ? 'rgba(234,179,8,0.3)' : 'rgba(16,185,129,0.3)'}">
              ${isRental ? 'متجر تأجير' : 'خدمة حجز'}
            </span>
          ` : ''}
        </div>
        <div class="sb-cat-count">${isRental ? `🏷️ ${svcCount} متجر تأجير` : `🛎️ ${svcCount} خدمة`}</div>
      </div>
      <div class="sb-cat-foot" onclick="event.stopPropagation()">
        <button class="btn btn-xs btn-secondary" onclick="showEditCatModal('${cat.id}','${section}')">✏️</button>
        <button class="btn btn-xs btn-danger"    onclick="deleteCat('${cat.id}')">🗑️</button>
        <span class="sb-arrow">›</span>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="sb-header">
    <div class="sb-title"><span>${secIcons[section]||'📂'}</span>${titles[section]||section}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <input type="text" class="form-control" id="admin-sys-cats-search-${section}" placeholder="🔍 بحث في التصنيفات..." value="${State.adminSearch||''}"
        oninput="State.adminSearch=this.value;render();" style="width:210px">
      <button class="btn btn-secondary btn-sm" onclick="showAddCatModalWithSection('${section}')">📂 تصنيف جديد</button>
    </div>
  </div>

  <div class="sb-stat-bar">
    <div class="sb-pill">📂 التصنيفات: <strong>${cats.length}</strong></div>
    <div class="sb-pill">🛎️ إجمالي الخدمات: <strong>${totalSvcs}</strong></div>
  </div>

  ${filtered.length === 0 ? `
    <div class="sb-empty">
      <div class="sb-empty-ic">📭</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:8px">${q?'لا توجد نتائج':'لا توجد تصنيفات بعد'}</div>
      ${!q?`<button class="btn btn-primary" onclick="showAddCatModalWithSection('${section}')">➕ أضف أول تصنيف</button>`:''}
    </div>` : `<div class="sb-grid">${grid}</div>`}
  `;
}

function _renderSysServices(section, catId, titles, secIcons) {
  const cat = (AppData.cats||[]).find(c=>c.id===catId);
  if (!cat) { State._sysBrowse[section]=null; return window.renderAdminSystem(section); }
  const allSvcs = AppData.services||[];
  const q = (State.adminSearch||'').toLowerCase();
  const svcs = allSvcs.filter(s=>s.catId===catId);
  const filtered = q ? svcs.filter(s=>(s.name||'').toLowerCase().includes(q)) : svcs;

  const cards = filtered.map(s => {
    const isActive = s.status === 'active' || !s.status;
    const priceLabel = s.price ? `${Number(s.price).toLocaleString('ar-YE')} ريال` : (section==='professions' ? 'بعد المعاينة' : '—');
    const stockChip = typeof ph48_stockChipHtml === 'function' ? ph48_stockChipHtml(s) : '';
    return `
    <div class="usys-svc-card">
      <div class="usys-svc-card-top">
        <div class="usys-svc-icon">${s.icon || '🔷'}</div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px">
          <span class="badge ${isActive ? 'badge-teal' : 'badge-gold'}" style="font-size:11px">${isActive ? '✅ نشط' : '⏸️ متوقف'}</span>
          ${stockChip}
        </div>
      </div>
      <div class="usys-svc-name">${escHtml(s.name || '')}</div>
      ${s.description ? `<div class="usys-svc-desc">${escHtml(s.description).slice(0,70)}${s.description.length>70?'...':''}</div>` : ''}
      <div class="usys-svc-footer">
        <span class="usys-svc-price">${priceLabel}</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-secondary" onclick="showEditSvcModal('${s.id}')">✏️</button>
          <button class="btn btn-sm btn-danger"    onclick="deleteSvc('${s.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');

  const emptyState = `
    <div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🔷</div>
      <div class="empty-title">${q ? 'لا توجد نتائج للبحث' : 'لا توجد خدمات بعد'}</div>
      <div class="empty-sub">${q ? 'جرّب كلمة بحث مختلفة' : 'اضغط ➕ خدمة جديدة لإضافة أول خدمة'}</div>
    </div>`;

  return `
  <div class="sb-header">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <button class="btn btn-sm btn-secondary" onclick="sysNavBack('${section}')">← رجوع</button>
      <span style="color:var(--text-muted);font-size:13px">${secIcons[section]} ${titles[section]||section}</span>
      <span style="color:var(--text-muted)">›</span>
      <span style="font-size:20px">${cat.icon||'📂'}</span>
      <span style="font-weight:800;font-size:16px">${cat.name}</span>
      <span class="badge badge-purple" style="font-size:11px">${svcs.length} خدمة</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <input type="text" class="form-control" id="admin-sys-services-search-${section}-${catId}" placeholder="🔍 بحث..." value="${State.adminSearch||''}"
        oninput="State.adminSearch=this.value;render();" style="width:180px">
      <button class="btn btn-sm btn-secondary" onclick="showEditCatModal('${catId}','${section}')">✏️ تعديل التصنيف</button>
      <button class="btn btn-primary btn-sm" onclick="showAddSvcInCat('${catId}','${section}')">➕ خدمة جديدة</button>
    </div>
  </div>

  <div class="usys-svc-grid">
    ${filtered.length === 0 ? emptyState : cards}
  </div>`;
}

window.sysNavInto = function(section, catId) {
  if (!State._sysBrowse) State._sysBrowse = {};
  State.adminSearch = '';
  const cat = (AppData.cats||[]).find(c=>c.id===catId);
  if (cat && cat.catType==='rental') { ph_openRentalAdmin(catId); return; }
  State._sysBrowse[section] = catId;
  render();
}

window.sysNavBack = function(section) {
  if (!State._sysBrowse) State._sysBrowse = {};
  State._sysBrowse[section] = null;
  State.adminSearch = '';
  render();
}

window.showAddSvcInCat = function(catId, section) {
  if (State.currentUser && State.currentUser.role === 'admin') {
    window.ph46_showAdminAddSvcModal(catId, section);
  } else {
    toast('غير مسموح لمزودي الخدمة بالإضافة المباشرة للحجوزات والأقسام. يرجى إرسال طلب إضافة خدمة للمراجعة.', 'warning');
  }
}

window.showAddCatModalWithSection = function(section) {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">➕ إضافة تصنيف جديد</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group"><label class="form-label">الاسم</label><input class="form-control" id="cat-name" placeholder="مثال: سباكة"></div>
    <div class="form-group"><label class="form-label">الأيقونة</label><input class="form-control" id="cat-icon" placeholder="مثال: 🛠️"></div>
    <div class="form-group"><label class="form-label">ترتيب الظهور</label><input class="form-control" id="cat-order" type="number" value="0"></div>
    <div class="form-group"><label class="form-label">الوصف (اختياري)</label><textarea class="form-control" id="cat-desc" rows="3" placeholder="وصف يظهر للمستخدم..."></textarea></div>
    <div class="form-group" style="display: none;"><label class="form-label">القسم</label>
      <select class="form-control" id="cat-section">
        ${['professions', 'services'].includes(section) ? `
          <option value="services" ${section==='services'?'selected':''}>🔧 الخدمات العامة</option>
          <option value="professions" ${section==='professions'?'selected':''}>🛠️ نظام المهن</option>
        ` : (section === 'bookings' ? `
          <option value="bookings" selected>📅 الحجوزات</option>
        ` : `
          <option value="stores" selected>🏪 المتاجر</option>
        `)}
      </select>
    </div>
    ${section === 'bookings' ? `
    <div class="form-group"><label class="form-label">نوع التصنيف</label>
      <select class="form-control" id="cat-type">
        <option value="booking">📅 حجز عادي (خدمات)</option>
        <option value="rental">🏷️ متجر تأجير (منتجات)</option>
      </select>
    </div>
    ` : ''}
    <button class="btn btn-primary btn-block" onclick="saveNewCat()">حفظ</button>`);
}

window.showAddSvcModalWithCatSelection = function(section) {
  const cats = (AppData.cats || []).filter(c => c.section === section && (section === 'bookings' ? c.catType !== 'rental' : true));
  openModal(`
    <div class="modal-header"><h2 class="modal-title">➕ إضافة خدمة جديدة</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div id="svc-section-wrapper"></div>
    ${typeof _svcModalBody === 'function' ? _svcModalBody({}, section) : ''}
    <button class="btn btn-primary btn-block" onclick="saveNewSvc()">💾 حفظ</button>`);
}

function renderAdminUsers() {
  const me = State.currentUser;
  const isAdmin = me?.role === 'admin';
  const canCreate = isAdmin || (typeof userHasPerm === 'function' && userHasPerm(me, 'create_users'));
  const canAdjust = isAdmin || (typeof userHasPerm === 'function' && userHasPerm(me, 'adjust_wallets'));
  const canViewWallets = isAdmin || (typeof userHasPerm === 'function' && userHasPerm(me, 'view_wallets'));
  const allUsers = (AppData.users || []).filter(u=> isAdmin ? true : u.role!=='admin');
  const roleLabel = { admin:'مدير', staff:'موظف', vendor:'مزود خدمة', driver:'مندوب', customer:'عميل', guest:'زائر', cs:'موظف', provider:'مزود خدمة' };
  const roleBadge = { admin:'badge-rose', staff:'badge-purple', vendor:'badge-teal', driver:'badge-gold', customer:'badge-teal', guest:'badge-teal', cs:'badge-purple', provider:'badge-teal' };
  const roleIcon  = { staff:'👨‍💼', vendor:'🏪', driver:'🚗', customer:'👤', provider:'🔧', guest:'👁️', cs:'🎧' };

  // Role filter sidebar state
  if (!State.adminUsersRoleFilter) State.adminUsersRoleFilter = 'all';
  const activeFilter = State.adminUsersRoleFilter;

  // Counts per role
  const roleCounts = {};
  allUsers.forEach(u => { roleCounts[u.role] = (roleCounts[u.role]||0)+1; });

  const sidebarRoles = [
    { key:'all',      icon:'', label:'جميع المستخدمين' },
    { key:'admin',    icon:'', label:'المدراء' },
    { key:'staff',    icon:'', label:'الموظفون' },
    { key:'driver',   icon:'', label:'المندوبون' },
    { key:'vendor',   icon:'', label:'مزودو الخدمات' },
    { key:'customer', icon:'', label:'العملاء' },
    { key:'guest',    icon:'', label:'الزوار' },
  ];

  const searchQuery = (State.adminSearch || '').toLowerCase();
  let users = activeFilter === 'all' ? allUsers : allUsers.filter(u => {
    if (activeFilter === 'vendor') return u.role === 'vendor' || u.role === 'provider';
    return u.role === activeFilter;
  });
  const filteredUsers = users.filter(u =>
    (u.name || '').toLowerCase().includes(searchQuery) ||
    (u.email || '').toLowerCase().includes(searchQuery) ||
    (u.phone || '').toLowerCase().includes(searchQuery)
  );

  return `
  <style>
    .au-layout{display:flex;gap:20px;align-items:flex-start}
    .au-sidebar{width:200px;flex-shrink:0;display:flex;flex-direction:column;gap:6px}
    .au-sidebar-btn{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;border:1.5px solid transparent;background:var(--bg-card);cursor:pointer;transition:all 0.15s;font-size:14px;width:100%;text-align:right}
    .au-sidebar-btn:hover{background:var(--bg-secondary);border-color:var(--primary)}
    .au-sidebar-btn.active{background:rgba(139,92,246,0.1);border-color:var(--primary);font-weight:700;color:var(--primary)}
    .au-sidebar-count{margin-inline-start:auto;font-size:11px;background:var(--bg-secondary);border-radius:20px;padding:2px 8px;font-weight:600;color:var(--text-muted)}
    .au-sidebar-btn.active .au-sidebar-count{background:var(--primary);color:#fff}
    .au-main{flex:1;min-width:0}
    @media(max-width:640px){.au-layout{flex-direction:column}.au-sidebar{width:100%;flex-direction:row;flex-wrap:wrap}}
  </style>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
    <h2>👥 إدارة المستخدمين (${filteredUsers.length})</h2>
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <input type="text" class="form-control" id="admin-users-search"
             placeholder="🔍 ابحث بالاسم أو البريد أو الجوال..."
             value="${State.adminSearch || ''}"
             oninput="State.adminSearch=this.value;render();"
             style="width:260px">
      ${canCreate ? `<button class="btn btn-primary" onclick="typeof showAddUserModal === 'function' ? showAddUserModal() : (typeof ph17_openCreateUser === 'function' ? ph17_openCreateUser() : null)">➕ إضافة مستخدم</button>` : ''}
    </div>
  </div>
  <div class="au-layout">
    <div class="au-sidebar">
      ${sidebarRoles.map(r => {
        let cnt = r.key === 'all' ? allUsers.length : (roleCounts[r.key]||0);
        if (r.key === 'vendor') cnt += (roleCounts['provider']||0);
        return `<button class="au-sidebar-btn${activeFilter===r.key?' active':''}"
          onclick="State.adminUsersRoleFilter='${r.key}';State.adminSearch='';render()">
          <span style="flex:1">${r.label}</span>
          <span class="au-sidebar-count">${cnt}</span>
        </button>`;
      }).join('')}
    </div>
    <div class="au-main">
      <div class="usys-svc-grid" style="margin-top:10px">
        ${filteredUsers.length === 0 ? `<div class="empty-state" style="grid-column:1/-1;background:var(--bg-card);border:1px dashed var(--border);border-radius:14px;padding:30px;text-align:center;color:var(--text-muted)"><div style="font-size:30px;margin-bottom:10px">🔍</div>لا يوجد مستخدمون في هذه الفئة</div>` :
        filteredUsers.map(u=>{
          const sus = !!u.suspended;
          return `
          <div class="usys-svc-card" style="${sus?'opacity:0.6;filter:grayscale(0.5)':''}">
            <div class="usys-svc-card-top" style="margin-bottom:12px">
              <div style="display:flex;align-items:center;gap:10px">
                ${u.photoBase64 ? `<img src="${u.photoBase64}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;box-shadow:0 2px 8px rgba(0,0,0,0.1)">` : `<div style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#a389f4);color:#fff;font-size:16px;font-weight:800;box-shadow:0 2px 8px rgba(139,92,246,0.3)">${(u.name||'؟').charAt(0)}</div>`}
                <div>
                  <div class="usys-svc-name" style="font-size:15px;margin-bottom:2px">${escHtml(u.name||'—')}</div>
                  <div style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:4px">
                    ${sus?'<span style="color:#ef4444;font-weight:700">⏸️ معلّق</span>':'<span style="color:#10b981;font-weight:700">✅ نشط</span>'}
                  </div>
                </div>
              </div>
            </div>
            <div style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">
              <span class="badge ${roleBadge[u.role]||'badge-purple'}" style="font-size:11px;padding:4px 8px">${roleIcon[u.role]||''} ${roleLabel[u.role]||u.role||'—'}</span>
              ${(u.role==='vendor'||u.role==='provider') ? (()=>{
                const grp = (AppData.providerGroups||[]).find(g=>g.id===u.providerGroupId);
                return grp
                  ? `<span style="font-size:11px;padding:3px 8px;border-radius:20px;background:rgba(139,92,246,0.12);color:var(--primary);border:1px solid rgba(139,92,246,0.25);font-weight:600">${grp.icon||'🏢'} ${escHtml(grp.name)}</span>`
                  : `<span style="font-size:11px;padding:3px 8px;border-radius:20px;background:rgba(100,116,139,0.1);color:var(--text-muted);border:1px solid rgba(100,116,139,0.2);font-weight:500">غير مصنّف</span>`;
              })() : ''}
            </div>
            <div class="usys-svc-desc" style="font-size:12px;display:flex;flex-direction:column;gap:6px;margin-bottom:16px;flex:1">
              <div style="display:flex;align-items:center;gap:6px;justify-content:space-between">
                <div style="display:flex;align-items:center;gap:6px;color:var(--text-secondary);min-width:0;flex:1">
                  <span style="font-size:14px;flex-shrink:0">📧</span>
                  <span style="direction:ltr;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.email||'—'}</span>
                </div>
                ${isAdmin && u.email ? `<button onclick="adminToggleVerify('${u.id||u.uid}','email',${!!u.emailVerified})"
                  style="flex-shrink:0;padding:2px 8px;border-radius:20px;border:1px solid ${u.emailVerified?'rgba(16,185,129,0.4)':'rgba(239,68,68,0.3)'};background:${u.emailVerified?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.08)'};color:${u.emailVerified?'#10b981':'#ef4444'};cursor:pointer;font-size:10px;font-weight:700;white-space:nowrap"
                  title="${u.emailVerified?'إلغاء توثيق البريد':'توثيق البريد'}"
                  >${u.emailVerified?'✅ موثّق':'✕ غير موثّق'}</button>` : ''}
              </div>
              <div style="display:flex;align-items:center;gap:6px;justify-content:space-between">
                <div style="display:flex;align-items:center;gap:6px;color:var(--text-secondary);min-width:0;flex:1">
                  <span style="font-size:14px;flex-shrink:0">📞</span>
                  <span style="direction:ltr;font-family:monospace">${u.phone||'—'}</span>
                </div>
                ${isAdmin && u.phone ? `<button onclick="adminToggleVerify('${u.id||u.uid}','phone',${!!u.phoneVerified})"
                  style="flex-shrink:0;padding:2px 8px;border-radius:20px;border:1px solid ${u.phoneVerified?'rgba(16,185,129,0.4)':'rgba(239,68,68,0.3)'};background:${u.phoneVerified?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.08)'};color:${u.phoneVerified?'#10b981':'#ef4444'};cursor:pointer;font-size:10px;font-weight:700;white-space:nowrap"
                  title="${u.phoneVerified?'إلغاء توثيق الجوال':'توثيق الجوال'}"
                  >${u.phoneVerified?'✅ موثّق':'✕ غير موثّق'}</button>` : ''}
              </div>
            </div>
            <div class="usys-svc-footer" style="border-top:1px solid var(--border);padding-top:12px;margin-top:auto">
              ${(canViewWallets && u.role && !['admin', 'super_admin', 'staff', 'cs'].includes(String(u.role).toLowerCase())) ? `<div style="text-align:center;font-weight:700;margin-bottom:8px;color:#10b981;font-size:14px">${AppData.wallets ? (AppData.wallets[u.id || u.uid]?.balance || 0) : 0} ر</div>` : ''}
              <div style="display:flex;gap:6px">
                <button class="btn btn-sm btn-secondary" style="flex:1" onclick="showUserDetails('${u.id}')">👁️ عرض</button>
                ${(isAdmin && (u.role === 'staff' || u.role === 'admin')) ? `<button class="btn btn-sm btn-secondary" onclick="showPermsModal('${u.id}')" title="صلاحيات">🔑</button>` : ''}
                ${(canAdjust && u.role && !['admin', 'super_admin', 'staff', 'cs'].includes(String(u.role).toLowerCase())) ? `<button class="btn btn-sm btn-secondary" onclick="wsecOpenAdjust('${u.id}')" title="تعديل رصيد">💰</button>` : ''}
                ${isAdmin ? `<button class="btn btn-sm" style="background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.2)" onclick="deleteUser('${u.id}')">🗑️</button>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div style="margin-top:12px;font-size:13px;color:var(--text-muted)">
        إجمالي: <strong>${filteredUsers.length}</strong> مستخدم
        ${activeFilter!=='all'?` من فئة <strong>${roleLabel[activeFilter]||activeFilter}</strong>`:''}
      </div>
    </div>
  </div>`;
}
window.adminToggleVerify = async function(userId, field, currentVal) {
  const newVal = !currentVal;
  const fieldLabel = field === 'phone' ? 'الجوال' : 'البريد الإلكتروني';
  const action     = newVal ? 'توثيق' : 'إلغاء توثيق';
  if (!confirm(`${action} ${fieldLabel} لهذا المستخدم؟`)) return;
  try {
    const key = field === 'phone' ? 'phoneVerified' : 'emailVerified';
    await fsUpdate('users', userId, { [key]: newVal });
    // تحديث AppData محلياً دون إعادة تحميل كاملة
    const idx = (AppData.users||[]).findIndex(u => (u.id||u.uid) === userId);
    if (idx !== -1) AppData.users[idx][key] = newVal;
    toast(`✅ تم ${action} ${fieldLabel} بنجاح`, 'success');
    render();
  } catch (e) {
    toast('خطأ: ' + (e.message || e), 'error');
  }
};

async function deleteUser(userId) {
  if (!confirm('حذف هذا المستخدم؟')) return;
  await fsDelete('users', userId);
  toast('تم حذف المستخدم','success'); await render();
}
function showUserDetails(userId) {
  const u = AppData.users.find(x=>x.id===userId);
  if (!u) return;
  openModal(`
    <div class="modal-header"><h2 class="modal-title">معلومات المستخدم</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group"><label>الاسم</label><div class="form-value">${u.name}</div></div>
    <div class="form-group"><label>البريع</label><div class="form-value">${u.email}</div></div>
    <div class="form-group"><label>الجوال</label><div class="form-value">${u.phone||'—'}</div></div>
    <div class="form-group"><label>النوع</label><div class="form-value"><span class="badge badge-teal">${u.role}</span></div></div>
    <div class="form-group"><label>تاريخ التسجيل</label><div class="form-value">${fmtDate(u.createdAt)}</div></div>`);
}

function renderAdminCats() {
  const searchQuery = (State.adminSearch || '').toLowerCase();
  const filteredCats = AppData.cats.filter(c => 
    (c.name || '').toLowerCase().includes(searchQuery) ||
    (c.section || '').toLowerCase().includes(searchQuery)
  );
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <h2>📂 التصنيفات</h2>
      <div style="display:flex;gap:12px">
        <input type="text" class="form-control" id="admin-cats-search" placeholder="🔍 ابحث بالاسم أو القسم..." value="${State.adminSearch || ''}" oninput="State.adminSearch = this.value; render();" style="width:300px">
        <button class="btn btn-primary" onclick="showAddCatModal()">➕ إضافة</button>
      </div>
    </div>
    <div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>الأيقونة</th><th>الاسم</th><th>القسم</th><th>الخدمات</th><th>إجراءات</th></tr></thead>
        <tbody>
          ${filteredCats.map(c=>`
            <tr>
              <td style="font-size:24px">${c.icon||'📌'}</td>
              <td>
                <div style="font-weight:600">${c.name}</div>
                ${c.catType === 'rental' ? `<div style="font-size:11px;color:var(--text-secondary)">🏷️ تأجير</div>` : ''}
              </td>
              <td><span class="badge badge-purple">${c.section}</span></td>
              <td>${c.catType === 'rental' ? (AppData.rentalStores||[]).filter(s=>s.catId===c.id).length + ' متجر' : AppData.services.filter(s=>s.catId===c.id).length + ' خدمة'}</td>
              <td style="display:flex;gap:4px;align-items:center;">
                ${c.catType === 'rental' ? `<button class="btn btn-sm btn-primary" onclick="ph_openRentalAdmin('${c.id}')">المتاجر 🏪</button>` : ''}
                <button class="btn btn-sm btn-secondary" onclick="showEditCatModal('${c.id}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCat('${c.id}')">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
window.showAddCatModal = function() {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">➕ إضافة تصنيف</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group"><label class="form-label">الاسم</label><input class="form-control" id="cat-name" placeholder="مثال: فنادق"></div>
    <div class="form-group"><label class="form-label">أيقونة</label><input class="form-control" id="cat-icon" placeholder="مثال: 🏨"></div>
    <div class="form-group"><label class="form-label">ترتيب الظهور</label><input class="form-control" id="cat-order" type="number" value="0"></div>
    <div class="form-group"><label class="form-label">الوصف (اختياري)</label><textarea class="form-control" id="cat-desc" rows="3" placeholder="وصف يظهر للمستخدم..."></textarea></div>
    <div class="form-group"><label class="form-label">القسم</label>
      <select class="form-control" id="cat-section" onchange="document.getElementById('cat-type-group').style.display = this.value === 'bookings' ? 'block' : 'none'">
        <option value="bookings">📅 الحجوزات</option>
        <option value="services">🔧 الخدمات المهنية</option>
        <option value="professions">🛠️ نظام المهن</option>
        <option value="stores">🏪 المتاجر</option>
      </select>
    </div>
    <div class="form-group" id="cat-type-group"><label class="form-label">نوع التصنيف</label>
      <select class="form-control" id="cat-type">
        <option value="booking">📅 حجز عادي (خدمات)</option>
        <option value="rental">🏷️ متجر تأجير (منتجات)</option>
      </select>
    </div>
    <button class="btn btn-primary btn-block" onclick="saveNewCat()">حفظ</button>`);
}
window.saveNewCat = async function() {
  const name = document.getElementById('cat-name').value.trim();
  const icon = document.getElementById('cat-icon').value.trim();
  const section = document.getElementById('cat-section').value;
  const catType = document.getElementById('cat-type')?.value || 'booking';
  const order = parseInt(document.getElementById('cat-order').value) || 0;
  const description = document.getElementById('cat-desc')?.value.trim() || '';
  if (!name) { toast('أدخل اسم التصنيف','error'); return; }
  
  showLoader();
  try {
    const collectionName = (section === 'bookings') ? 'categories' : 'professions_categories';
    await fsAdd(collectionName, { name, icon, section, catType, order, description, createdAt: new Date() });
    closeModal(); toast('تم إضافة التصنيف ✅','success'); await render();
  } catch (e) {
    console.error('Save Category Error:', e);
    toast('❌ فشل الحفظ: قد يكون جهازك محظوراً مؤقتاً من السيرفر', 'error');
  } finally {
    hideLoader();
  }
}
window.showEditCatModal = function(catId, contextSection = null) {
  const c = AppData.cats.find(x=>x.id===catId);
  if (!c) return;
  const section = contextSection || c.section;
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ تعديل التصنيف</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group"><label class="form-label">الاسم</label><input class="form-control" id="cat-name" value="${c.name}"></div>
    <div class="form-group"><label class="form-label">أيقونة</label><input class="form-control" id="cat-icon" value="${c.icon||''}"></div>
    <div class="form-group"><label class="form-label">ترتيب الظهور</label><input class="form-control" id="cat-order" type="number" value="${c.order||0}"></div>
    <div class="form-group"><label class="form-label">الوصف (اختياري)</label><textarea class="form-control" id="cat-desc" rows="3">${c.description||''}</textarea></div>
    <div class="form-group" style="display: none;"><label class="form-label">القسم</label>
        <select class="form-control" id="cat-section">
        ${['professions', 'services'].includes(section) ? `
          <option value="services" ${c.section==='services'?'selected':''}>🔧 الخدمات العامة</option>
          <option value="professions" ${c.section==='professions'?'selected':''}>🛠️ نظام المهن</option>
        ` : (section === 'bookings' ? `
          <option value="bookings" selected>📅 الحجوزات</option>
        ` : `
          <option value="stores" selected>🏪 المتاجر</option>
        `)}
      </select>
    </div>
    ${section === 'bookings' ? `
    <div class="form-group"><label class="form-label">نوع التصنيف</label>
        <select class="form-control" id="cat-type">
        <option value="booking" ${c.catType !== 'rental' ? 'selected' : ''}>📅 حجز عادي (خدمات)</option>
        <option value="rental" ${c.catType === 'rental' ? 'selected' : ''}>🏷️ متجر تأجير (منتجات)</option>
      </select>
    </div>
    ` : ''}
    <button class="btn btn-primary btn-block" onclick="updateCat('${catId}')">حفظ</button>`);
}
window.updateCat = async function(catId) {
  const originalCat = AppData.cats.find(x => x.id === catId);
  const newSection = document.getElementById('cat-section').value;
  const catType = document.getElementById('cat-type')?.value;
  
  const updateData = {
    name: document.getElementById('cat-name').value.trim(),
    icon: document.getElementById('cat-icon').value.trim(),
    order: parseInt(document.getElementById('cat-order').value) || 0,
    description: document.getElementById('cat-desc')?.value.trim() || '',
    section: newSection,
  };
  if (catType && newSection === 'bookings') {
    updateData.catType = catType;
  }
  
  showLoader();
  try {
    if (originalCat) {
      const originalCollection = (originalCat.section === 'bookings') ? 'categories' : 'professions_categories';
      const newCollection = (newSection === 'bookings') ? 'categories' : 'professions_categories';
      
      if (originalCollection !== newCollection) {
        await fsDelete(originalCollection, catId);
        await fsSet(newCollection, catId, { ...updateData, createdAt: originalCat.createdAt || new Date() });
      } else {
        await fsUpdate(originalCollection, catId, updateData);
      }
    } else {
      const collectionName = (newSection === 'bookings') ? 'categories' : 'professions_categories';
      await fsUpdate(collectionName, catId, updateData);
    }
    closeModal(); toast('تم التعديل ✅','success'); await render();
  } catch (e) {
    console.error('Update Category Error:', e);
    toast('❌ فشل تحديث التصنيف', 'error');
  } finally {
    hideLoader();
  }
}
window.deleteCat = async function(catId) {
  if (!confirm('حذف هذا التصنيف وجميع خدماته؟')) return;
  showLoader();
  try {
    const cat = AppData.cats.find(c => c.id === catId);
    const collectionName = (cat && cat.section === 'bookings') ? 'categories' : 'professions_categories';
    await fsDelete(collectionName, catId);
    const svcs = AppData.services.filter(s=>s.catId===catId);
    await Promise.all(svcs.map(s=>fsDelete('services',s.id)));
    toast('تم الحذف','success'); await render();
  } catch (e) {
    console.error('Delete Category Error:', e);
    toast('❌ فشل حذف التصنيف', 'error');
  } finally {
    hideLoader();
  }
}

function renderAdminServices() {
  const searchQuery = (State.adminSearch || '').toLowerCase();
  const filteredServices = AppData.services.filter(s => {
    const cat = AppData.cats.find(c=>c.id===s.catId);
    return (s.name || '').toLowerCase().includes(searchQuery) ||
           (s.provider || '').toLowerCase().includes(searchQuery) ||
           (cat?.name || '').toLowerCase().includes(searchQuery);
  });
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <h2>🛎️ الخدمات</h2>
      <div style="display:flex;gap:12px">
        <input type="text" class="form-control" id="admin-services-search" placeholder="🔍 ابحث بالاسم أو المقدم أو التصنيف..." value="${State.adminSearch || ''}" oninput="State.adminSearch = this.value; render();" style="width:300px">
        <button class="btn btn-primary" onclick="showAddSvcModal()">➕ إضافة</button>
      </div>
    </div>
    <div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>الخدمة</th><th>التصنيف</th><th>السعر</th><th>الحالة</th><th>إجراءات</th></tr></thead>
        <tbody>
          ${filteredServices.map(s=>{
            const cat = AppData.cats.find(c=>c.id===s.catId);
            return `<tr>
              <td style="font-weight:600">${s.icon||'🔷'} ${s.name}</td>
              <td><span class="badge badge-teal">${cat?.name||'—'}</span></td>
              <td>${s.price?s.price+' ريال':'عند الطلب'}</td>
              <td><span class="badge badge-gold">✅ نشطة</span></td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="showEditSvcModal('${s.id}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteSvc('${s.id}')">🗑️</button>
              </td>
            </tr>`;}).join('')}
        </tbody>
      </table>
    </div>`;
}

// --- Service Sections (Sub-categories) Management ---
window.showManageSvcSectionsModal = function(catId) {
  const cat = (AppData.cats || []).find(c=>c.id===catId);
  if (!cat) return;
  
  const renderList = () => {
    const sections = (AppData.svcSections || []).filter(s => s.catId === catId).sort((a,b)=>(a.order||0)-(b.order||0));
    return sections.length ? sections.map(s => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg-secondary);border-radius:12px;margin-bottom:8px;border:1px solid var(--border)">
        <span style="font-size:20px">${s.icon || '📂'}</span>
        <span style="flex:1;font-weight:600">${s.name}</span>
        <button class="btn btn-sm btn-danger" onclick="deleteSvcSection('${s.id}', '${catId}')">🗑️</button>
      </div>`).join('') : '<p style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد أقسام فرعية لهذا التصنيف</p>';
  };

  openModal(`
    <div class="modal-header"><h2 class="modal-title">📂 إدارة أقسام ${cat.name}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div id="svc-sections-list" style="margin-bottom:20px;max-height:300px;overflow-y:auto">
      ${renderList()}
    </div>
    <div style="background:var(--bg-secondary);border-radius:14px;padding:16px;border:1px solid var(--border)">
      <div style="font-weight:700;margin-bottom:12px">➕ إضافة قسم فرعي جديد</div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input class="form-control" id="new-sec-icon" placeholder="🛠️" style="width:60px;text-align:center">
        <input class="form-control" id="new-sec-name" placeholder="اسم القسم (مثال: صيانة)">
      </div>
      <button class="btn btn-primary btn-block" onclick="saveNewSvcSection('${catId}')">إضافة القسم</button>
    </div>
  `);
};

window.saveNewSvcSection = async function(catId) {
  const name = document.getElementById('new-sec-name').value.trim();
  const icon = document.getElementById('new-sec-icon').value.trim() || '📂';
  if (!name) { toast('أدخل اسم القسم', 'error'); return; }
  showLoader();
  try {
    await fsAdd('service_sections', { catId, name, icon, order: 0, createdAt: new Date() });
    await loadAllData();
    showManageSvcSectionsModal(catId);
    toast('✅ تم إضافة القسم', 'success');
  } catch(e) { toast('خطأ: ' + e.message, 'error'); } finally { hideLoader(); }
};

window.deleteSvcSection = async function(secId, catId) {
  if (!confirm('هل تريد حذف هذا القسم؟')) return;
  showLoader();
  try {
    await fsDelete('service_sections', secId);
    await loadAllData();
    showManageSvcSectionsModal(catId);
    toast('✅ تم الحذف', 'success');
  } catch(e) { toast('خطأ: ' + e.message, 'error'); } finally { hideLoader(); }
};

window.ph43_loadSvcSectionsForCat = function(catId) {
  const wrapper = document.getElementById('svc-section-wrapper');
  if (!wrapper) return;
  const sections = (AppData.svcSections || []).filter(s => s.catId === catId);
  if (sections.length === 0) {
    wrapper.innerHTML = '';
    return;
  }
  wrapper.innerHTML = `
    <div class="form-group">
      <label class="form-label">القسم الفرعي</label>
      <select class="form-control" id="svc-section-id">
        <option value="">-- بدون قسم فرعي --</option>
        ${sections.map(sec => `<option value="${sec.id}">${sec.icon || ''} ${sec.name}</option>`).join('')}
      </select>
    </div>`;
};

window.ph43_toggleVendorPickerMode = function(isMulti) {
  const cbs = document.querySelectorAll('.svc-vendor-cb');
  const actions = document.getElementById('multi-vendor-actions');
  const hint = document.getElementById('picker-hint');
  
  cbs.forEach(c => {
    c.type = isMulti ? 'checkbox' : 'radio';
  });

  if (actions) actions.style.display = isMulti ? 'flex' : 'none';
  if (hint) hint.innerText = isMulti ? (isMulti ? 'سيقوم النظام بتوجيه الطلب تلقائياً للأقرب من القائمة المحددة.' : 'يرجى تحديد مزود واحد فقط لهذه الخدمة.') : '';
  
  // Refined hint logic
  if (hint) {
     hint.innerText = isMulti ? 'سيقوم النظام بتوجيه الطلب تلقائياً للأقرب من القائمة المحددة.' : 'يرجى تحديد مزود واحد فقط لهذه الخدمة.';
  }

  // If switched to single mode, keep only the first checked one
  if (!isMulti) {
    let found = false;
    cbs.forEach(c => {
      if (c.checked && !found) found = true;
      else if (c.checked) c.checked = false;
    });
  }
};


// --- Updated _svcModalBody to include Section selection ---
window.ph21_updateFinalPrice = function() {
  const p = parseFloat(document.getElementById('svc-price')?.value) || 0;
  const c = parseFloat(document.getElementById('svc-commission')?.value) || 0;
  const t = parseFloat(document.getElementById('svc-tax')?.value) || 0;
  const commAmount = p * (c / 100);
  const taxAmount = p * (t / 100);
  const total = p + commAmount + taxAmount;
  const disp = document.getElementById('ph21-final-price-disp');
  if (disp) {
    disp.textContent = total.toFixed(2) + ' ريال';
    disp.parentElement.style.display = total > 0 ? 'block' : 'none';
  }
};

// ─── دوال مساعدة لحقول العروض في مودال الخدمة ──────────
window.ph_toggleOfferFields = function (show) {
  const wrap = document.getElementById('offer-fields-wrap');
  if (wrap) wrap.style.display = show ? 'block' : 'none';
};

window.ph_offerFieldsCalc = function () {
  const price = parseFloat(document.getElementById('svc-price')?.value) || parseFloat(document.getElementById('ph21-final-price-disp')?.textContent?.replace(/\D/g,'')) || 0;
  const pct   = parseFloat(document.getElementById('svc-offer-pct')?.value) || 0;
  if (price > 0 && pct > 0) {
    const discounted = Math.round(price * (1 - pct / 100));
    const el = document.getElementById('svc-offer-discounted');
    if (el) el.value = discounted;
    const preview = document.getElementById('offer-price-preview');
    if (preview) {
      preview.style.display = 'block';
      preview.textContent = `💰 السعر الأصلي: ${price.toLocaleString('ar-YE')} ريال  →  السعر بعد الخصم: ${discounted.toLocaleString('ar-YE')} ريال  (وفّر ${(price - discounted).toLocaleString('ar-YE')} ريال)`;
    }
  }
};

// --- Service Modal Custom Patches Removed & Integrated ---

function showAddSvcModal() {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">➕ إضافة خدمة</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    ${typeof _svcModalBody === 'function' ? _svcModalBody() : ''}
    <button class="btn btn-primary btn-block" onclick="saveNewSvc()">حفظ</button>`);
}
window.saveNewSvc = async function() {
  const catId = document.getElementById('svc-cat').value;
  const name = document.getElementById('svc-name').value.trim();
  const provider = document.getElementById('svc-provider').value.trim();
  const desc = document.getElementById('svc-desc').value.trim();
  const price = parseInt(document.getElementById('svc-price').value) || null;
  const commission = parseInt(document.getElementById('svc-commission')?.value) || 0;
  const tax = parseInt(document.getElementById('svc-tax')?.value) || 0;
  const finalPrice = parseInt(document.getElementById('ph21-final-price-disp')?.textContent?.replace(/\D/g, '') || '0') || price;
  const sectionId = document.getElementById('svc-section-id')?.value || null;
  const order = parseInt(document.getElementById('svc-order').value) || 0;
  const multiVendors = document.getElementById('svc-multi-vendors')?.checked || false;
  const assignedVendors = Array.from(document.querySelectorAll('.svc-vendor-cb:checked')).map(cb=>cb.value);
  const issues = document.getElementById('svc-issues') ? document.getElementById('svc-issues').value.trim().split('\n').filter(l=>l.trim()) : [];
  if (!catId || !name) { toast('اختر التصنيف والخدمة','error'); return; }
  if (!assignedVendors.length) { toast('يرجى تحديد مزود واحد على الأقل لهذه الخدمة', 'warning'); return; }

  // ── بيانات التنبيهات وحالة التوفر (ph48) ─────────────────────────
  let stockStatus = 'available', alertBadge = null;
  if (typeof ph48_collectAlertData === 'function') {
    const alertData = ph48_collectAlertData();
    stockStatus = alertData.stockStatus || 'available';
    alertBadge  = alertData.alertBadge  || null;
  }

  showLoader();
  try {
    const svcId = await fsAdd('services', { catId, sectionId, name, provider, desc, price, commission, tax, finalPrice, order, assignedVendors, multiVendors, icon: '🔷', commonIssues: issues, status: 'active', stockStatus, alertBadge, createdAt: new Date() });

    const addToOffers = document.getElementById('svc-add-to-offers')?.checked;
    if (addToOffers && typeof ph_saveOfferFromSource === 'function') {
      const offerPct  = parseFloat(document.getElementById('svc-offer-pct')?.value) || 0;
      const offerDisc = parseFloat(document.getElementById('svc-offer-discounted')?.value) || 0;
      const expStr    = document.getElementById('svc-offer-expires')?.value || '';
      const cat       = AppData.cats.find(c => c.id === catId);
      const srcSec    = cat?.section === 'bookings' ? 'bookings' : (cat?.section === 'professions' || cat?.section === 'services') ? 'services' : 'bookings';
      if (offerPct > 0 && (price || finalPrice)) {
        await ph_saveOfferFromSource({
          title: name, desc, sourceType: 'service', sourceId: svcId,
          sourceSection: srcSec, originalPrice: finalPrice || price,
          discountPercent: offerPct, imageBase64: null,
          expiresStr: expStr
        });
        toast('✅ تمت إضافة الخدمة والعرض بنجاح', 'success');
      } else {
        toast('تم إضافة الخدمة ✅ (يرجى إدخال نسبة الخصم لإضافة العرض)', 'warning');
      }
    } else {
      toast('تم إضافة الخدمة ✅','success');
    }

    closeModal(); await render();
  } catch (e) {
    console.error('Save Service Error:', e);
    toast('❌ فشل الحفظ: السيرفر يرفض الطلب حالياً', 'error');
  } finally {
    hideLoader();
  }
}
window.showEditSvcModal = function(svcId) {
  const s = AppData.services.find(x=>x.id===svcId);
  if (!s) return;
  const isMulti = s.multiVendors !== false;
  const cat = AppData.cats.find(c=>c.id===s.catId);
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ تعديل الخدمة</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    ${typeof _svcModalBody === 'function' ? _svcModalBody(s, cat?.section) : ''}
    <button class="btn btn-primary btn-block" onclick="updateSvc('${svcId}')">&#x1F4BE; حفظ</button>`);
}
window.updateSvc = async function(svcId) {
  const assignedVendors = Array.from(document.querySelectorAll('.svc-vendor-cb:checked')).map(cb=>cb.value);
  // ── بيانات التنبيهات وحالة التوفر (ph48) ─────────────────────────
  let stockStatus = 'available', alertBadge = null;
  if (typeof ph48_collectAlertData === 'function') {
    const alertData = ph48_collectAlertData();
    stockStatus = alertData.stockStatus || 'available';
    alertBadge  = alertData.alertBadge  || null;
  }

  await fsUpdate('services', svcId, {
    catId: document.getElementById('svc-cat').value,
    name: document.getElementById('svc-name').value.trim(),
    provider: document.getElementById('svc-provider').value.trim(),
    desc: document.getElementById('svc-desc').value.trim(),
    price: parseInt(document.getElementById('svc-price').value) || null,
    commission: parseInt(document.getElementById('svc-commission')?.value) || 0,
    tax: parseInt(document.getElementById('svc-tax')?.value) || 0,
    finalPrice: parseInt(document.getElementById('ph21-final-price-disp')?.textContent?.replace(/\D/g, '') || '0') || (parseInt(document.getElementById('svc-price').value) || null),
    order: parseInt(document.getElementById('svc-order').value) || 0,
    multiVendors: document.getElementById('svc-multi-vendors')?.checked !== false,
    assignedVendors,
    commonIssues: document.getElementById('svc-issues') ? document.getElementById('svc-issues').value.trim().split('\n').filter(l=>l.trim()) : [],
    stockStatus,
    alertBadge
  });
  closeModal(); toast('تم التعديل ✅','success'); await render();
}
window.deleteSvc = async function(svcId) {
  if (!confirm('حذف هذه الخدمة؟')) return;
  await fsDelete('services', svcId);
  toast('تم الحذف','success'); await render();
}

function renderAdminOrders() {
  const me = State.currentUser;
  const isAdmin = me?.role === 'admin';
  const canEdit = isAdmin || (typeof userHasPerm === 'function' && userHasPerm(me, 'edit_orders'));
  const orders = AppData.orders || [];

  if (!State.adminOrdersTab) State.adminOrdersTab = 'current';
  const activeOrdersTab = State.adminOrdersTab;

  const statusLabel = {
    pending_admin:'⏳ بانتظار الإدارة',
    pending_provider:'🔔 عند المزود',
    pending_inspection:'🛠️ بانتظار المعاينة',
    pending_agreement:'📝 بانتظار الاتفاق',
    awaiting_payment:'💳 بانتظار الدفع',
    approved:'✅ مقبول',
    rejected:'❌ مرفوض',
    completed:'🎉 مكتمل',
    cancelled:'❌ ملغى',
    pending:'⏳ معلق',
    accepted:'✅ مقبول'
  };
  const statusBadge = {
    pending_admin:'badge-gold',
    pending_provider:'badge-purple',
    pending_inspection:'badge-gold',
    pending_agreement:'badge-purple',
    awaiting_payment:'badge-gold',
    approved:'badge-teal',
    rejected:'badge-rose',
    completed:'badge-teal',
    cancelled:'badge-rose',
    pending:'badge-gold',
    accepted:'badge-teal'
  };

  // Split into Current vs Past
  const currentStatuses = ['pending_admin', 'pending_provider', 'pending_inspection', 'pending_agreement', 'awaiting_payment', 'approved', 'pending', 'accepted'];
  const pastStatuses = ['completed', 'rejected', 'cancelled'];

  const currentOrders = orders.filter(o => currentStatuses.includes(o.status));
  const pastOrders = orders.filter(o => pastStatuses.includes(o.status));

  const searchQuery = (State.adminSearch || '').toLowerCase();
  const filterFn = o =>
    (o.orderId || o.id || '').toLowerCase().includes(searchQuery) ||
    (o.customerName || '').toLowerCase().includes(searchQuery) ||
    (o.svcName || '').toLowerCase().includes(searchQuery) ||
    (o.providerName || o.vendorName || '').toLowerCase().includes(searchQuery);

  const filteredCurrent = currentOrders.filter(filterFn);
  const filteredPast = pastOrders.filter(filterFn);

  const displayOrders = activeOrdersTab === 'current' ? filteredCurrent : filteredPast;

  // Helper to format createdAt date and time
  function formatCreatedAt(createdAt) {
    if (!createdAt) return { date: '—', time: '—' };
    let dateObj = null;
    if (typeof createdAt.toDate === 'function') {
      dateObj = createdAt.toDate();
    } else if (createdAt.seconds) {
      dateObj = new Date(createdAt.seconds * 1000);
    } else {
      dateObj = new Date(createdAt);
    }
    if (!dateObj || isNaN(dateObj.getTime())) return { date: '—', time: '—' };

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    let hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12;
    hours = hours ? hours : 12;
    
    return {
      date: `${year}/${month}/${day}`,
      time: `${hours}:${minutes} ${ampm}`
    };
  }

  return `
    <style>
      .orders-tab-switcher {
        display: flex;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 4px;
        margin-bottom: 24px;
        max-width: 450px;
        gap: 4px;
      }
      .orders-tab-switcher .tab-btn {
        flex: 1;
        border: 0;
        padding: 10px 16px;
        border-radius: 8px;
        font-weight: 700;
        font-size: 13px;
        background: none;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .orders-tab-switcher .tab-btn.active {
        background: var(--primary) !important;
        color: #fff !important;
        box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
      }
      .orders-tab-switcher .tab-btn:hover:not(.active) {
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-main);
      }
      .order-tab-badge {
        font-size: 11px;
        background: rgba(255, 255, 255, 0.15);
        color: inherit;
        padding: 2px 8px;
        border-radius: 99px;
        font-weight: 800;
      }
      .orders-tab-switcher .tab-btn.active .order-tab-badge {
        background: rgba(255, 255, 255, 0.25);
      }
      .order-meta-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: rgba(255,255,255,0.015);
        border: 1px solid var(--border);
        border-radius: 12px;
        margin-bottom: 12px;
      }
      .order-meta-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12.5px;
      }
      .order-meta-label {
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .order-meta-value {
        font-weight: 700;
        color: var(--text-main);
      }
      .order-card-price-tag {
        font-size: 18px;
        font-weight: 800;
        color: #10b981;
        text-align: center;
        margin-bottom: 10px;
        padding: 6px;
        background: rgba(16, 185, 129, 0.05);
        border-radius: 8px;
        border: 1px solid rgba(16, 185, 129, 0.1);
      }
    </style>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:15px">
      <div>
        <h2>📋 إدارة الطلبات</h2>
        <p style="color:var(--text-muted);font-size:13px;margin-top:4px">تتبع وتنظيم حجوزات وطلبات العملاء بشكل مباشر</p>
      </div>
      <input type="text" class="form-control" id="admin-orders-search" placeholder="🔍 ابحث بالرقم أو العميل أو الخدمة..." value="${State.adminSearch || ''}" oninput="State.adminSearch=this.value;render();" style="width:300px">
    </div>

    ${!canEdit ? '<p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">🔒 وضع العرض فقط — لا تملك صلاحية تعديل الطلبات</p>' : ''}

    <div class="orders-tab-switcher">
      <button class="tab-btn ${activeOrdersTab === 'current' ? 'active' : ''}" onclick="window.setAdminOrdersTab('current')">
        <span>📥 الطلبات الحالية</span>
        <span class="order-tab-badge">${currentOrders.length}</span>
      </button>
      <button class="tab-btn ${activeOrdersTab === 'past' ? 'active' : ''}" onclick="window.setAdminOrdersTab('past')">
        <span>⏱️ الطلبات السابقة</span>
        <span class="order-tab-badge">${pastOrders.length}</span>
      </button>
    </div>

    <div class="usys-svc-grid" style="margin-top:10px">
      ${displayOrders.length === 0 ? `<div class="empty-state" style="grid-column:1/-1;background:var(--bg-card);border:1px dashed var(--border);border-radius:14px;padding:30px;text-align:center;color:var(--text-muted)"><div style="font-size:30px;margin-bottom:10px">🔍</div>لا توجد طلبات في هذا القسم</div>` :
      displayOrders.map(o => {
        const createdTimeInfo = formatCreatedAt(o.createdAt);
        return `
        <div class="usys-svc-card" style="display:flex;flex-direction:column;justify-content:space-between;min-height:350px">
          <div>
            <div class="usys-svc-card-top" style="margin-bottom:14px">
              <div style="display:flex;align-items:center;gap:10px;flex:1">
                <div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;background:rgba(139,92,246,0.1);font-size:20px">${o.svcIcon||'📦'}</div>
                <div>
                  <div class="usys-svc-name" style="font-size:14.5px;margin-bottom:2px">${escHtml(o.svcName||'—')}</div>
                  <div style="font-size:11px;color:var(--text-muted);font-weight:600;font-family:monospace">#${o.orderId}</div>
                </div>
              </div>
              <span class="badge ${statusBadge[o.status]||'badge-purple'}" style="font-size:10px;padding:4px 6px">${statusLabel[o.status]||o.status}</span>
            </div>

            <div class="order-meta-info">
              <div class="order-meta-row">
                <span class="order-meta-label">👤 العميل:</span>
                <span class="order-meta-value">${escHtml(o.customerName||'—')}</span>
              </div>
              <div class="order-meta-row">
                <span class="order-meta-label">🏪 المزود:</span>
                <span class="order-meta-value">${escHtml(o.providerName||o.vendorName||'—')}</span>
              </div>
              <div class="order-meta-row">
                <span class="order-meta-label">💳 الدفع:</span>
                <span class="order-meta-value" style="font-size:11.5px">${escHtml(o.paymentMethod === 'wallet' ? 'المحفظة 💰' : o.paymentMethod === 'cod' ? 'عند الاستلام 💵' : o.paymentMethod || '—')}</span>
              </div>
            </div>

            <div class="order-meta-info" style="border-color:rgba(139,92,246,0.15)">
              <div class="order-meta-row">
                <span class="order-meta-label">📅 تاريخ الطلب:</span>
                <span class="order-meta-value">${createdTimeInfo.date}</span>
              </div>
              <div class="order-meta-row">
                <span class="order-meta-label">⏰ وقت الطلب:</span>
                <span class="order-meta-value">${createdTimeInfo.time}</span>
              </div>
              ${o.date ? `
              <div class="order-meta-row" style="border-top:1px dashed var(--border);padding-top:6px;margin-top:4px">
                <span class="order-meta-label" style="color:var(--primary);font-weight:700">🛎️ موعد الحجز:</span>
                <span class="order-meta-value" style="color:var(--primary);font-weight:800">${o.date} ${o.time || ''}</span>
              </div>
              ` : ''}
            </div>
          </div>

          <div>
            <div class="order-card-price-tag">${o.total||o.finalPrice||0} ريال</div>
            ${typeof ph37_pickupBadge === 'function' ? `<div style="margin-top:6px">${ph37_pickupBadge(o)}</div>` : ''}
            <div class="usys-svc-footer" style="border-top:1px solid var(--border);padding-top:12px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">
              <button class="btn btn-sm btn-secondary" style="flex:1;padding:8px;font-size:12px;font-weight:700" onclick="showOrderDetails('${o.id}')">👁️ تفاصيل</button>
              
              ${canEdit && o.status==='pending_admin' ? `
                <button class="btn btn-sm btn-success" style="padding:8px 12px;font-size:12px;font-weight:700" onclick="ph21_adminApprove('${o.id}')">✅ قبول</button>
                <button class="btn btn-sm" style="background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.2);padding:8px 12px;font-size:12px;font-weight:700" onclick="ph21_adminReject('${o.id}')">❌ رفض</button>
              ` : ''}

              ${canEdit && o.status==='pending' ? `
                <button class="btn btn-sm btn-success" style="padding:8px 12px;font-size:12px;font-weight:700" onclick="updateOrderStatus('${o.id}','accepted')">✅ قبول</button>
                <button class="btn btn-sm" style="background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.2);padding:8px 12px;font-size:12px;font-weight:700" onclick="ph21_adminReject('${o.id}')">❌ رفض</button>
              ` : ''}

              ${canEdit && isAdmin ? `
                <button class="btn btn-sm" style="background:rgba(239,68,68,0.05);color:#ef4444;border:1px solid rgba(239,68,68,0.1);padding:8px 10px;font-size:12px" onclick="deleteOrder('${o.id}')" title="حذف الطلب">🗑️</button>
              ` : ''}
            </div>

            ${canEdit ? `
            <div style="border-top:1px dashed var(--border);padding-top:10px;margin-top:6px">
              ${o.driverId ? `
              <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:7px 12px;margin-bottom:8px">
                <span style="font-size:12px;color:#10b981;font-weight:700">🚗 ${escHtml(o.driverName||'مندوب معيّن')}</span>
                <button class="btn btn-sm" style="background:rgba(124,58,237,0.08);color:#7c3aed;border:1px solid rgba(124,58,237,0.2);padding:4px 10px;font-size:11px;font-weight:700" onclick="adminAssignDriver('${o.id}')">🔄 تغيير</button>
              </div>` : `
              <button class="btn btn-sm" style="width:100%;background:rgba(124,58,237,0.08);color:#7c3aed;border:1.5px solid rgba(124,58,237,0.25);padding:8px;font-size:12px;font-weight:800" onclick="adminAssignDriver('${o.id}')">🚗 تعيين مندوب</button>
              `}
            </div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

window.setAdminOrdersTab = function(tab) {
  State.adminOrdersTab = tab;
  render();
}
// ─── View Order Details (Shared Function) ────────────
function showOrderDetails(orderId) {
  const o = AppData.orders.find(x=>x.id===orderId);
  if (!o) return;

  function formatCreatedAt(createdAt) {
    if (!createdAt) return '—';
    let dateObj = null;
    if (typeof createdAt.toDate === 'function') {
      dateObj = createdAt.toDate();
    } else if (createdAt.seconds) {
      dateObj = new Date(createdAt.seconds * 1000);
    } else {
      dateObj = new Date(createdAt);
    }
    if (!dateObj || isNaN(dateObj.getTime())) return '—';

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    let hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12;
    hours = hours ? hours : 12;
    
    return `${year}/${month}/${day} - ${hours}:${minutes} ${ampm}`;
  }

  const creationStr = formatCreatedAt(o.createdAt);
  const statusLabel = {
    pending_admin:'⏳ بانتظار الإدارة',
    pending_provider:'🔔 عند المزود',
    pending_inspection:'🛠️ بانتظار المعاينة',
    pending_agreement:'📝 بانتظار الاتفاق',
    awaiting_payment:'💳 بانتظار الدفع',
    approved:'✅ مقبول',
    rejected:'❌ مرفوض',
    completed:'🎉 مكتمل',
    cancelled:'❌ ملغى',
    pending:'⏳ معلق',
    accepted:'✅ مقبول'
  };

  openModal(`
    <div class="modal-header"><h2 class="modal-title">📋 تفاصيل الطلب #${o.orderId}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:10px">
      <div class="form-group"><label>رقم الطلب</label><div class="form-value">${o.orderId}</div></div>
      <div class="form-group"><label>الحالة</label><div class="form-value"><span class="badge badge-teal">${statusLabel[o.status] || o.status}</span></div></div>
      <div class="form-group"><label>العميل</label><div class="form-value">${o.customerName}</div></div>
      <div class="form-group"><label>المزود</label><div class="form-value">${o.providerName || o.vendorName || '—'}</div></div>
      <div class="form-group" style="grid-column: 1/-1"><label>الخدمة المطلوبة</label><div class="form-value">${o.svcIcon||'📦'} ${o.svcName}</div></div>
      <div class="form-group"><label>المبلغ الإجمالي</label><div class="form-value" style="color:#10b981;font-weight:800">${o.total||0} ريال</div></div>
      <div class="form-group"><label>طريقة الدفع</label><div class="form-value">${o.paymentMethod === 'wallet' ? 'المحفظة 💰' : o.paymentMethod === 'cod' ? 'عند الاستلام 💵' : o.paymentMethod || '—'}</div></div>
      <div class="form-group"><label>تاريخ تقديم الطلب</label><div class="form-value">${creationStr}</div></div>
      <div class="form-group"><label>موعد الحجز المحدد</label><div class="form-value" style="color:var(--primary);font-weight:700">${o.date || '—'} ${o.time || ''}</div></div>
      <div class="form-group" style="grid-column: 1/-1"><label>العنوان</label><div class="form-value">${o.customerAddr||'—'}</div></div>
    </div>
    ${o.housePics && o.housePics.length ? `
      <div class="form-group" style="grid-column: 1/-1; margin-top: 12px;">
        <label style="font-weight:700;display:block;margin-bottom:8px">📸 صور موقع التوصيل (المنزل/الباب):</label>
        <div class="signup-pics-preview-grid">
          ${o.housePics.map((pic, idx) => `
            <div class="su-pic-thumb" style="width:90px; height:90px; cursor:pointer;" onclick="window.ph8_openLightbox(${JSON.stringify(o.housePics)}, ${idx})">
              <img src="${pic}">
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    ${(() => {
      const linkedSvc = (AppData.services || []).find(s => s.id === o.svcId);
      const linkedItem = (AppData.catalogItems || []).find(i =>
        i.id === o.catalogItemId || i.id === o.itemId || i.id === o.productId
      );
      const alerts = (linkedSvc?.adminAlerts?.length ? linkedSvc.adminAlerts : null)
                  || (linkedItem?.adminAlerts?.length ? linkedItem.adminAlerts : null)
                  || [];
      if (!alerts.length) return '';
      return `
        <div style="
          margin-top: 18px;
          background: linear-gradient(135deg, rgba(234,179,8,0.08), rgba(245,158,11,0.05));
          border: 1.5px solid rgba(234,179,8,0.5);
          border-radius: 14px;
          padding: 14px 16px;
        ">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
            <span style="font-size:18px;">⚠️</span>
            <span style="font-weight:800; font-size:14px; color:#f59e0b;">ملاحظات تنبيهية للإدارة</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:7px;">
            ${alerts.map((a, i) => `
              <div style="
                display:flex; align-items:flex-start; gap:9px;
                background: rgba(234,179,8,0.06);
                border: 1px solid rgba(234,179,8,0.25);
                border-radius: 9px;
                padding: 8px 12px;
              ">
                <span style="
                  background:#f59e0b; color:#fff;
                  font-weight:800; font-size:11px;
                  min-width:24px; height:24px;
                  border-radius:50%;
                  display:flex; align-items:center; justify-content:center;
                  flex-shrink:0; margin-top:1px;
                ">${i + 1}</span>
                <span style="color:#fef3c7; font-size:13px; line-height:1.6;">${escHtml(a)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    })()}
  `);
}
async function updateOrderStatus(orderId, status) {
  if (['completed', 'rejected', 'cancelled'].includes(status)) {
    showLoader('جاري نقل الطلب للأرشيف...');
    const ok = await ph53_archiveOrder(orderId, status);
    hideLoader();
    if (ok) {
      toast('✅ تم إنهاء الطلب ونقله إلى الأرشيف بنجاح', 'success');
    }
  } else {
    await fsUpdate('orders', orderId, { status });
    toast('تم تحديث حالة الطلب','success');
  }
  await render();
}
async function deleteOrder(orderId) {
  if (!confirm('حذف هذا الطلب؟')) return;
  await fsDelete('orders', orderId);
  toast('تم الحذف','success'); await render();
}

// ── نظام الإعلانات محوّل بالكامل إلى ads.js (window.renderAdminAds) ──

function renderAdminWallet() {
  const pending = AppData.rechargeReqs.filter(r=>r.status==='pending');
  const approved = AppData.rechargeReqs.filter(r=>r.status==='approved');
  const searchQuery = (State.adminSearch || '').toLowerCase();
  const filteredPending = pending.filter(r => (r.userName || '').toLowerCase().includes(searchQuery));
  const filteredApproved = approved.filter(r => (r.userName || '').toLowerCase().includes(searchQuery));
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <h2>💰 إدارة المحافظ</h2>
      <input type="text" class="form-control" id="admin-wallet-search" placeholder="🔍 ابحث بالاسم..." value="${State.adminSearch || ''}" oninput="State.adminSearch = this.value; render();" style="width:300px">
    </div>
    <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:var(--radius);padding:16px;margin-bottom:24px">
      <h3 style="margin-bottom:8px">⏳ طلبات الشحن المعلقة: ${filteredPending.length}</h3>
      ${filteredPending.length ? `
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>المستخدم</th><th>المبلغ</th><th>الإثبات</th><th>الإجراءات</th></tr></thead>
          <tbody>
            ${filteredPending.map(r=>`
              <tr>
                <td>${r.userName}</td>
                <td style="font-weight:700">${r.amount} ريال</td>
                <td>${r.proofBase64?`<button class="btn btn-sm btn-secondary" onclick="viewProof('${r.proofBase64}')">📸</button>`:'—'}</td>
                <td>
                  <button class="btn btn-sm btn-success" onclick="approveRecharge('${r.id}','${r.userId}','${r.amount}')">✅</button>
                  <button class="btn btn-sm btn-danger" onclick="rejectRecharge('${r.id}')">❌</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<p style="color:var(--text-muted)">لا توجد طلبات معلقة</p>'}
    </div>
    <h3>✅ الطلبات الموافق عليها: ${filteredApproved.length}</h3>
    ${filteredApproved.length?`<div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>المستخدم</th><th>المبلغ</th><th>التاريخ</th></tr></thead>
        <tbody>
          ${filteredApproved.map(r=>`
            <tr>
              <td>${r.userName}</td>
              <td>${r.amount} ريال</td>
              <td>${fmtDate(r.createdAt)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`:''}`
}
function viewProof(base64) {
  openModal(`<div style="text-align:center"><img src="${base64}" style="max-width:100%;max-height:500px;border-radius:8px"></div>`);
}
async function approveRecharge(reqId, userId, amount) {
  if (!confirm('الموافقة على هذا الطلب وإضافة الرصيد؟')) return;
  await creditWallet(userId, parseInt(amount), 'شحن محفظة - موافقة إدارية');
  await fsUpdate('recharge_requests', reqId, { status: 'approved' });
  toast('تم إضافة الرصيد ✅','success'); await render();
}
async function rejectRecharge(reqId) {
  if (!confirm('رفض هذا الطلب؟')) return;
  await fsUpdate('recharge_requests', reqId, { status: 'rejected' });
  toast('تم رفض الطلب','success'); await render();
}

function renderAdminReports() {
  // استدعاء نظام التقارير المالية المتقدم (Phase 49)
  if (typeof renderReportsPage === 'function') {
    // تأجير قصير لضمان تحميل الـ DOM ثم توليد التقارير
    setTimeout(async () => {
      await generateReports();
    }, 120);
    return renderReportsPage();
  }

  // احتياطي بسيط في حال عدم تحميل reports.js
  return `
    <h2>📈 التقارير</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin:24px 0">
      <div class="stat-card">
        <div class="stat-num">${AppData.orders.filter(o=>o.status==='completed').length}</div>
        <div class="stat-label">الطلبات المكتملة</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${AppData.ratings.length}</div>
        <div class="stat-label">التقييمات</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${AppData.transactions.filter(t=>t.type==='debit').reduce((a,t)=>a+t.amount,0)}</div>
        <div class="stat-label">إجمالي المبيعات</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${(AppData.transactions.filter(t=>t.type==='debit').reduce((a,t)=>a+t.amount,0)*0.1).toFixed(0)}</div>
        <div class="stat-label">عمولة المنصة (10%)</div>
      </div>
    </div>`;
}

// ─── Vendor Dashboard ──────────────────────────────
function renderVendor() {
  if (State.currentUser?.role !== 'vendor' && State.currentUser?.role !== 'provider') { navigate('home'); return ''; }
  const u = State.currentUser;
  // ── فحص اتفاقية العمل (غير إجباري للرندر، يُظهر مودال إذا لم يوقع) ──
  if (typeof ph53_checkPartnerAgreement === 'function' && !State._agreementChecked_vendor) {
    State._agreementChecked_vendor = true;
    setTimeout(() => ph53_checkPartnerAgreement(), 400);
  }
  const vendorTab = State.vendorTab || 'orders';
  const initial = (u.name || u.email || 'V')[0].toUpperCase();
  const displayName = u.name || u.email || 'المزود';
  const tabs = [['orders','📋','الطلبات'],['earnings','💰','الأرباح'],['services','🛎️','خدماتي'],['profile','👤','الملف']];
  let content = '';
  if (vendorTab==='orders')    content = renderVendorOrders();
  else if (vendorTab==='earnings') content = renderVendorEarnings();
  else if (vendorTab==='services') content = renderVendorServices();
  else if (vendorTab==='profile') content = renderVendorProfile();
  return `
  <div id="app-content">
    <div class="admin-sidebar-overlay" id="adminSidebarOverlay" onclick="closeAdminSidebar()"></div>
    <div class="admin-layout">
      <aside class="admin-sidebar" id="adminSidebar">
        <!-- ══ رأس الدرج ══ -->
        <div class="admin-sidebar-header">
          <div class="sidebar-header-row">
            <div class="sidebar-user-block">
              <div class="sidebar-avatar-lg">${initial}</div>
              <div class="sidebar-user-meta">
                <div class="sidebar-user-name">${displayName}</div>
                <div class="sidebar-user-role">صاحب الخدمة / المزود</div>
              </div>
            </div>
            <button class="admin-sidebar-close" onclick="closeAdminSidebar()">✕</button>
          </div>
        </div>
        <nav class="admin-nav" style="padding: 12px 10px;">
          ${tabs.map(([t,ic,l])=>`
            <button class="admin-nav-item${vendorTab===t?' active':''}" onclick="setVendorTab('${t}');closeAdminSidebar()">
              <span>${ic}</span><span>${l}</span>
            </button>`).join('')}
        </nav>
        ${typeof renderAvailabilityToggle === 'function' ? renderAvailabilityToggle('vendor') : ''}
        <div class="sidebar-footer">
          <button class="sidebar-footer-notif" onclick="closeAdminSidebar();navigate('notifications')">مركز الإشعارات</button>
        </div>
      </aside>
      <main class="admin-main">
        <div style="margin-bottom:12px">
          <button class="back-btn" onclick="navigate('home')">→ الرئيسية</button>
        </div>
        ${content}
      </main>
    </div>
  </div>`;
}
window.renderVendor = renderVendor;
async function setVendorTab(tab) {
  State.vendorTab = tab;
  await navigate('vendor', {tab});
}
window.setVendorTab = setVendorTab;

function renderVendorOrders() {
  const u = State.currentUser;
  const orders = AppData.orders.filter(o=>o.vendorId===u.uid || o.providerUid===u.uid).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  const isProfUser = orders.some(o => o.isProfession);
  const availCard   = typeof renderAvailabilityCard   === 'function' ? renderAvailabilityCard('vendor')   : '';
  const availBanner = typeof renderAvailabilityBanner === 'function' ? renderAvailabilityBanner('vendor') : '';
  const sLabel = {
    pending:'⏳ جديد',
    pending_inspection:'🛠️ معاينة',
    pending_agreement:'📝 اتفاق',
    awaiting_payment:'💳 بانتظار الدفع',
    accepted:'✅ مقبول',
    with_driver:'🚗 مع المندوب',
    delivered:'📦 وصل',
    completed:'🎉 مكتمل',
    cancelled:'❌ ملغى'
  };
  return `
    ${availCard}
    ${availBanner}
    <h2>📋 ${isProfUser ? 'طلبات المهن والخدمات' : 'الطلبات الواردة'}${window.ui_helpBtn('provider_dashboard')}</h2>
    ${orders.length ? `
    <div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>رقم الطلب</th><th>العميل</th><th>التاريخ</th><th>المبلغ</th><th>الحالة</th><th>إجراءات</th></tr></thead>
        <tbody>
          ${orders.map(o=>`
            <tr>
              <td style="font-weight:700;color:#7c3aed">${o.orderId}</td>
              <td>${o.customerName}</td>
              <td>${o.date}</td>
              <td>${o.total} ريال</td>
              <td><span class="badge badge-gold">${sLabel[o.status]||o.status}</span></td>
              <td>
                ${o.status==='pending'?`
                  <button class="btn btn-sm btn-success" onclick="vendorAcceptOrder('${o.id}')">✅ قبول</button>
                  <button class="btn btn-sm btn-danger" onclick="vendorRejectOrder('${o.id}')">❌ رفض</button>
                `:''}
                ${(o.status==='pending_inspection' || o.status==='pending_agreement') ? `
                  <button class="btn btn-sm btn-primary" onclick="ph_openProfessionAgreement('${o.id}')">📝 اتمام الاتفاق</button>
                `:''}
                <button class="btn btn-sm btn-secondary" onclick="viewOrderDetails('${o.id}')">👁️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `
    <div class="empty-state" style="padding:60px 20px;text-align:center;background:var(--bg-card);border:1px solid var(--glass-border);border-radius:var(--radius);margin-top:20px">
      <div class="empty-icon" style="font-size:48px;margin-bottom:16px;opacity:0.7">📋</div>
      <div class="empty-title" style="font-size:18px;font-weight:700;margin-bottom:8px">لا توجد طلبات واردة حالياً</div>
      <p style="color:var(--text-muted);font-size:14px;margin:0">عندما يقوم العملاء بطلب خدماتك، ستظهر طلباتهم هنا للموافقة عليها أو معالجتها.</p>
    </div>`}`;
}
async function vendorAcceptOrder(orderId) {
  await fsUpdate('orders', orderId, { status: 'accepted' });
  toast('تم قبول الطلب ✅','success'); await render();
}
async function vendorRejectOrder(orderId) {
  showLoader('جاري إلغاء الطلب والأرشفة...');
  await ph53_archiveOrder(orderId, 'cancelled');
  hideLoader();
  toast('تم رفض وإلغاء الطلب وأرشفته','success'); await render();
}

function renderVendorEarnings() {
  const u = State.currentUser;
  const completed = AppData.orders.filter(o=>(o.vendorId===u.uid || o.providerUid===u.uid) && o.status==='completed');
  const earnings = completed.reduce((a,o)=>a+(o.servicePrice||0),0);
  return `
    <h2>💰 الأرباح والمحفظة</h2>
    <div class="stat-card">
      <div class="stat-num">${earnings}</div>
      <div class="stat-label">إجمالي الأرباح</div>
    </div>
    <div class="stat-card" style="margin-top:16px">
      <div class="stat-num">${completed.length}</div>
      <div class="stat-label">طلبات مكتملة</div>
    </div>
    <button class="btn btn-primary" style="margin-top:24px" onclick="showWithdrawModal()">💳 طلب سحب</button>`;
}
function showWithdrawModal() {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">💳 طلب سحب الأرباح</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group"><label class="form-label">المبلغ (ريال)</label><input class="form-control" id="wd-amount" type="number" min="50" placeholder="الحد الأدنى: 50 ريال"></div>
    <div class="form-group"><label class="form-label">طريقة التحويل</label>
      <select class="form-control" id="wd-method">
        <option value="bank">🏦 تحويل بنكي</option>
        <option value="cash">💵 كاش</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">بيانات البنك (في حالة التحويل)</label><textarea class="form-control" id="wd-bank" placeholder="رقم الحساب، رقم الايبان..."></textarea></div>
    <button class="btn btn-primary btn-block" onclick="submitWithdrawRequest()">إرسال الطلب</button>`);
}
async function submitWithdrawRequest() {
  const amount = parseFloat(document.getElementById('wd-amount').value);
  const method = document.getElementById('wd-method').value;
  const bank = document.getElementById('wd-bank').value.trim();
  if (!amount || amount < 50) { toast('أدخل مبلغاً صحيحاً (50 ريال على الأقل)','error'); return; }
  const u = State.currentUser;
  await fsAdd('withdrawal_requests', { userId: u.uid, userName: u.name, amount, method, bankDetails: bank, status: 'pending' });
  closeModal(); toast('تم إرسال طلب السحب ✅','success'); await render();
}

function renderVendorServices() {
  const u = State.currentUser;
  const svcs = (AppData.services || []).filter(s => s.providerUid === u.uid || (s.assignedVendors && s.assignedVendors.includes(u.uid)) || s.vendorId === u.uid);
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <h2>🛎️ خدماتي</h2>
      <button class="btn btn-primary" onclick="ph21_showProviderAddSvc()">➕ إضافة خدمة جديدة</button>
    </div>
    ${svcs.length ? `<div class="table-wrap"><table class="admin-table">
      <thead><tr><th>الخدمة</th><th>السعر</th><th>الحالة</th></tr></thead>
      <tbody>${svcs.map(s => `<tr>
        <td>${s.name}</td>
        <td>${s.price ? s.price + ' ريال' : 'بعد المعاينة'}</td>
        <td><span class="badge ${s.status==='active'?'badge-teal':'badge-gold'}">${s.status==='active'?'نشطة':'بانتظار الموافقة'}</span></td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<div class="empty-state"><div class="empty-icon">🛎️</div><div class="empty-title">لم تقم بإضافة أي خدمات بعد</div></div>'}`;
}

function renderVendorProfile() {
  const u = State.currentUser;
  const accTypeLabel = u.role === 'provider'
    ? '💼 صاحب مهنة (مهن حرة)'
    : (u.vendorType === 'store' ? '🏪 مزود خدمة (متاجر / إيجار)' : '🛎️ مزود خدمة (خدمات)');
  return `
    <h2>👤 ملفي الشخصي</h2>
    <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:var(--radius);padding:24px">
      <div class="form-group"><label>الاسم</label><div class="form-value">${u.name}</div></div>
      <div class="form-group"><label>البريد</label><div class="form-value">${u.email}</div></div>
      <div class="form-group"><label>الجوال</label><div class="form-value">${u.phone||'—'}</div></div>
      <div class="form-group"><label>نوع الحساب</label><div class="form-value" style="font-weight:700;color:var(--primary)">${accTypeLabel}</div></div>
      <button class="btn btn-secondary" style="margin-top:20px" onclick="logoutConfirm()">تسجيل الخروج</button>
    </div>`;
}

// ─── Driver Dashboard ──────────────────────────────
function renderDriver() {
  if (State.currentUser?.role !== 'driver') { navigate('home'); return ''; }
  const u = State.currentUser;
  // ── فحص اتفاقية العمل (غير إجباري للرندر، يُظهر مودال إذا لم يوقع) ──
  if (typeof ph53_checkPartnerAgreement === 'function' && !State._agreementChecked_driver) {
    State._agreementChecked_driver = true;
    setTimeout(() => ph53_checkPartnerAgreement(), 400);
  }
  const driverTab = State.driverTab || 'orders';
  const initial = (u.name || u.email || 'D')[0].toUpperCase();
  const displayName = u.name || u.email || 'المندوب';
  const pdbCount   = (AppData.pdbEntries || []).filter(e => e.active !== false).length;
  const newOrders  = (window.DRIVER_ALERTS?.newCount || 0);
  const tabs = [
    ['orders',    '📋', `طلباتي${newOrders ? ` <span style="background:#ef4444;color:#fff;border-radius:99px;padding:0 6px;font-size:10px;margin-right:2px">${newOrders}</span>` : ''}`],
    ['providers', '🏢', `مزودو الخدمات${pdbCount ? ` <span style="background:#8b5cf6;color:#fff;border-radius:99px;padding:0 6px;font-size:10px;margin-right:2px">${pdbCount}</span>` : ''}`],
    ['earnings',  '💰', 'أرباحي'],
    ['profile',   '👤', 'الملف'],
  ];
  let content = '';
  if (driverTab==='orders')         content = renderDriverOrders();
  else if (driverTab==='providers') content = renderDriverProviders();
  else if (driverTab==='earnings')  content = renderDriverEarnings();
  else if (driverTab==='profile')   content = renderDriverProfile();
  return `
  <div id="app-content">
    <div class="admin-sidebar-overlay" id="adminSidebarOverlay" onclick="closeAdminSidebar()"></div>
    <div class="admin-layout">
      <aside class="admin-sidebar" id="adminSidebar">
        <!-- ══ رأس الدرج ══ -->
        <div class="admin-sidebar-header">
          <div class="sidebar-header-row">
            <div class="sidebar-user-block">
              <div class="sidebar-avatar-lg">${initial}</div>
              <div class="sidebar-user-meta">
                <div class="sidebar-user-name">${displayName}</div>
                <div class="sidebar-user-role">مندوب التوصيل</div>
              </div>
            </div>
            <button class="admin-sidebar-close" onclick="closeAdminSidebar()">✕</button>
          </div>
        </div>
        <nav class="admin-nav" style="padding: 12px 10px;">
          ${tabs.map(([t,ic,l])=>`
            <button class="admin-nav-item${driverTab===t?' active':''}" onclick="setDriverTab('${t}');closeAdminSidebar()">
              <span>${ic}</span><span>${l}</span>
            </button>`).join('')}
        </nav>
        ${typeof renderAvailabilityToggle === 'function' ? renderAvailabilityToggle('driver') : ''}
        <div class="sidebar-footer">
          <button class="sidebar-footer-notif" onclick="closeAdminSidebar();navigate('notifications')">مركز الإشعارات</button>
        </div>
      </aside>
      <main class="admin-main">
        <div style="margin-bottom:12px">
          <button class="back-btn" onclick="navigate('home')">→ الرئيسية</button>
        </div>
        ${content}
      </main>
    </div>
  </div>`;
}
window.renderDriver = renderDriver;
async function setDriverTab(tab) {
  State.driverTab = tab;
  await navigate('driver', {tab});
}
window.setDriverTab = setDriverTab;

function renderDriverOrders() {
  const u = State.currentUser;
  // طلبات الاستلام الشخصي لا تحتاج مندوباً — لا تظهر في لوحة المندوب
  const orders = AppData.orders.filter(o=>o.driverId===u.uid && o.deliveryType !== 'pickup').sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  const driverCard   = typeof renderAvailabilityCard   === 'function' ? renderAvailabilityCard('driver')   : '';
  const driverBanner = typeof renderAvailabilityBanner === 'function' ? renderAvailabilityBanner('driver') : '';

  if (orders.length === 0) {
    return `
      ${driverCard}
      ${driverBanner}
      <h2>📋 طلبات التوصيل</h2>
      <div class="empty-state" style="padding:48px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);text-align:center;margin-top:16px">
        <div style="font-size:48px;margin-bottom:16px">🚚</div>
        <div style="font-size:18px;font-weight:700;color:var(--text-main);margin-bottom:8px">لا توجد طلبات توصيل مسندة إليك</div>
        <p style="color:var(--text-muted);font-size:14px;margin:0;line-height:1.6">سيتم إشعارك وتحديث الصفحة فور تعيين طلب توصيل جديد لك من قِبل إدارة النظام</p>
      </div>`;
  }

  return `
    ${driverCard}
    ${driverBanner}
    <h2>📋 طلبات التوصيل</h2>
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">
      ${orders.map(o => {
        const linkedProviders = _driver_getOrderProviders(o);
        const hasProviders = linkedProviders.length > 0;
        const statusLabel = {
          pending:'⏳ انتظار', accepted:'✅ مقبول', with_driver:'🚗 معك',
          delivered:'📦 تم التوصيل', completed:'✅ مكتمل', cancelled:'❌ ملغي'
        }[o.status] || o.status;
        return `
        <div style="background:var(--bg-card);border:1.5px solid var(--border);border-radius:16px;padding:18px;transition:border-color 0.2s">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px">
            <div>
              <div style="font-weight:900;font-size:15px;color:var(--text-main)">طلب #${escHtml(o.orderId||o.id?.slice(-6)||'—')}</div>
              <div style="font-size:13px;color:var(--text-secondary);margin-top:3px">👤 ${escHtml(o.customerName||'—')}</div>
              ${o.customerAddr ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">📍 ${escHtml(o.customerAddr)}</div>` : ''}
            </div>
            <span style="font-size:13px;font-weight:700;padding:5px 12px;border-radius:20px;background:rgba(13,148,136,0.1);color:#0d9488;border:1px solid rgba(13,148,136,0.25);white-space:nowrap">${statusLabel}</span>
          </div>
          ${hasProviders ? `
          <div style="background:rgba(139,92,246,0.05);border:1px solid rgba(139,92,246,0.15);border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--text-secondary)">
            🏢 مرتبط بـ <strong style="color:var(--primary)">${linkedProviders.length}</strong> موفر خدمة
            ${linkedProviders.slice(0,2).map(p=>`· ${escHtml(p.name)}`).join('')}${linkedProviders.length>2?` · +${linkedProviders.length-2}…`:''}
          </div>` : ''}
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            <button class="btn btn-sm btn-secondary" onclick="showDeliveryMap('${o.id}')">🗺️ موقع التوصيل</button>
            ${hasProviders ? `<button class="btn btn-sm" style="background:rgba(139,92,246,0.12);color:var(--primary);border:1px solid rgba(139,92,246,0.3);border-radius:8px;padding:5px 12px;font-size:13px;font-weight:700;cursor:pointer" onclick="driver_showOrderProviders('${o.id}')">🏢 مزودو هذا الطلب</button>` : ''}
            ${o.status==='accepted' ? `<button class="btn btn-sm btn-primary" onclick="startDriverDelivery('${o.id}')">🚗 بدء التوصيل</button>` : ''}
            ${o.status==='with_driver' ? `<button class="btn btn-sm btn-success" onclick="stopDriverDelivery('${o.id}')">📦 تم التوصيل</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function _driver_getOrderProviders(order) {
  if (!order) return [];
  const entries   = AppData.pdbEntries || [];
  const catalogItems = AppData.catalogItems || [];

  const pdbIds = new Set();
  const result  = [];

  const refIds = [order.catalogItemId, order.itemId, order.productId].filter(Boolean);
  refIds.forEach(id => {
    const item = catalogItems.find(i => i.id === id);
    if (item) (item.linkedProviders||[]).forEach(l => { if(l.pdbId) pdbIds.add(l.pdbId); });
  });
  if (order.linkedProviders) {
    order.linkedProviders.forEach(l => { if(l.pdbId) pdbIds.add(l.pdbId); });
  }

  pdbIds.forEach(id => {
    const entry = entries.find(e => e.id === id);
    if (entry) result.push(entry);
  });
  return result;
}

window.driver_showOrderProviders = function(orderId) {
  const order = (AppData.orders||[]).find(o=>o.id===orderId);
  if (!order) return;
  const providers = _driver_getOrderProviders(order);
  const cats    = AppData.pdbCats    || [];
  const subcats = AppData.pdbSubcats || [];

  if (providers.length === 0) {
    openModal(`
    <div class="modal-header">
      <h2 class="modal-title">🏢 مزودو الطلب</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="padding:32px;text-align:center;color:var(--text-muted)">
      <div style="font-size:36px;margin-bottom:10px">🏢</div>
      <div>لا يوجد مزودو خدمات مرتبطون بهذا الطلب</div>
    </div>`);
    return;
  }

  const html = providers.map(p => _driver_providerCardHTML(p, cats, subcats)).join('');
  openModal(`
  <div class="modal-header">
    <h2 class="modal-title">🏢 مزودو خدمات الطلب #${escHtml(order.orderId||orderId.slice(-6))}</h2>
    <button class="modal-close" onclick="closeModal()">✕</button>
  </div>
  <div style="padding:0 20px 20px;max-height:72vh;overflow-y:auto">
    ${html}
  </div>`, 'large');
};

// ── عرض مزودي الخدمات لجميع الطلبات (تبويب مستقل) ──────────────────
function renderDriverProviders() {
  const entries = (AppData.pdbEntries || []).filter(e => e.active !== false);
  const cats    = AppData.pdbCats    || [];
  const subcats = AppData.pdbSubcats || [];
  const sq      = (State._driverPdbSearch || '').toLowerCase().trim();

  const filtered = sq ? entries.filter(e =>
    (e.name||'').toLowerCase().includes(sq) ||
    (e.phone||'').toLowerCase().includes(sq) ||
    (cats.find(c=>c.id===e.catId)?.name||'').toLowerCase().includes(sq) ||
    (subcats.find(s=>s.id===e.subcatId)?.name||'').toLowerCase().includes(sq)
  ) : entries;

  const grouped = {};
  filtered.forEach(e => {
    const cat = cats.find(c => c.id === e.catId);
    const key = cat?.name || 'غير مصنّف';
    if (!grouped[key]) grouped[key] = { icon: cat?.icon || '🏢', entries: [] };
    grouped[key].entries.push(e);
  });

  return `
  ${_driverPdbStyles()}
  <div style="padding:20px;max-width:960px;margin:0 auto;font-family:'Cairo',sans-serif">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div>
        <h2 style="margin:0;font-size:20px;font-weight:900;color:var(--text-main)">🏢 مزودو الخدمات</h2>
        <p style="color:var(--text-muted);font-size:13px;margin:4px 0 0">${entries.length} مزود خدمة — عناوينهم ومواقعهم وصورهم</p>
      </div>
    </div>

    <!-- بحث -->
    <div style="position:relative;margin-bottom:20px">
      <span style="position:absolute;right:13px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none;font-size:16px">🔍</span>
      <input
        style="width:100%;padding:11px 42px 11px 14px;border:1.5px solid var(--border);border-radius:12px;background:var(--glass-bg);color:var(--text-main);font-family:'Cairo',sans-serif;font-size:14px;box-sizing:border-box;transition:border-color 0.2s"
        placeholder="ابحث بالاسم أو التصنيف أو الهاتف..."
        value="${escHtml(State._driverPdbSearch || '')}"
        oninput="State._driverPdbSearch=this.value; render()"
        onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
    </div>

    ${entries.length === 0 ? `
    <div style="text-align:center;padding:60px 20px;background:rgba(139,92,246,0.03);border:2px dashed rgba(139,92,246,0.15);border-radius:20px">
      <div style="font-size:48px;margin-bottom:14px">🏢</div>
      <h3 style="color:var(--text-secondary);font-family:'Cairo',sans-serif;margin-bottom:8px">لا يوجد مزودو خدمات بعد</h3>
      <p style="color:var(--text-muted);font-size:13px">يُضيفهم المدير من قسم "قاعدة بيانات المزودين"</p>
    </div>` : filtered.length === 0 ? `
    <div style="text-align:center;padding:40px;color:var(--text-muted)">
      <div style="font-size:36px;margin-bottom:10px">🔍</div>
      <div>لا توجد نتائج مطابقة لـ "<strong>${escHtml(sq)}</strong>"</div>
    </div>` : `
    <div style="display:flex;flex-direction:column;gap:28px">
      ${Object.entries(grouped).map(([catName, group]) => `
      <div>
        <div style="font-size:14px;font-weight:800;color:var(--text-secondary);margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <span>${group.icon}</span>
          <span>${escHtml(catName)}</span>
          <span style="background:var(--bg-card);border:1px solid var(--border);border-radius:20px;padding:2px 8px;font-size:11px;font-weight:600;color:var(--text-muted)">${group.entries.length}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          ${group.entries.map(e => _driver_providerCardHTML(e, cats, subcats)).join('')}
        </div>
      </div>`).join('')}
    </div>`}
  </div>`;
}

function _driver_providerCardHTML(entry, cats, subcats) {
  const cat    = cats.find(c => c.id === entry.catId);
  const subcat = subcats.find(s => s.id === entry.subcatId);
  const addresses = entry.addresses || [];
  const allImages = addresses.flatMap(a => a.images || []);

  return `
  <div style="background:var(--bg-card);border:1.5px solid var(--border);border-radius:18px;overflow:hidden">

    <!-- رأس البطاقة -->
    <div style="padding:16px 18px 12px;display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--border)">
      <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#7c3aed);color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;flex-shrink:0">
        ${(entry.name||'م').charAt(0).toUpperCase()}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:16px;font-weight:900;color:var(--text-main)">${escHtml(entry.name||'—')}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:3px">
          🏢 ${escHtml(cat?.name||'—')} › ${escHtml(subcat?.name||'—')}
        </div>
      </div>
      ${entry.phone ? `
      <a href="tel:${escAttr(entry.phone)}"
         style="display:inline-flex;align-items:center;gap:5px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:#10b981;border-radius:10px;padding:7px 12px;font-size:13px;font-weight:700;text-decoration:none;flex-shrink:0;font-family:'Cairo',sans-serif">
        📞 اتصال
      </a>` : ''}
    </div>

    <!-- صور المحل (إن وجدت) -->
    ${allImages.length > 0 ? `
    <div style="display:flex;gap:6px;padding:10px 14px;overflow-x:auto;background:rgba(0,0,0,0.02)">
      ${allImages.slice(0,6).map(img => `
      <img src="${escAttr(img)}" alt="صورة المحل" loading="lazy"
           style="width:80px;height:70px;object-fit:cover;border-radius:10px;flex-shrink:0;border:1px solid var(--border)"
           onerror="this.style.display='none'">`).join('')}
      ${allImages.length > 6 ? `<div style="width:80px;height:70px;border-radius:10px;background:rgba(139,92,246,0.1);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--primary);font-weight:700;flex-shrink:0">+${allImages.length-6} أخرى</div>` : ''}
    </div>` : ''}

    <!-- العناوين -->
    ${addresses.length > 0 ? `
    <div style="padding:12px 16px;display:flex;flex-direction:column;gap:10px">
      ${addresses.map((addr, idx) => `
      <div style="background:rgba(139,92,246,0.04);border:1px solid rgba(139,92,246,0.12);border-radius:12px;padding:12px 14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:800;color:var(--text-main);margin-bottom:4px">
              📍 ${escHtml(addr.label || `عنوان ${idx+1}`)}
            </div>
            ${addr.text ? `<div style="font-size:12px;color:var(--text-secondary);line-height:1.5">${escHtml(addr.text)}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap">
            ${addr.lat && addr.lng ? `
            <a href="https://www.google.com/maps?q=${addr.lat},${addr.lng}" target="_blank" rel="noopener"
               style="display:inline-flex;align-items:center;gap:4px;background:#1a73e8;color:#fff;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;text-decoration:none;font-family:'Cairo',sans-serif">
              🗺️ خرائط
            </a>
            <a href="https://waze.com/ul?ll=${addr.lat},${addr.lng}&navigate=yes" target="_blank" rel="noopener"
               style="display:inline-flex;align-items:center;gap:4px;background:#33ccff;color:#fff;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;text-decoration:none;font-family:'Cairo',sans-serif">
              🚗 Waze
            </a>` : ''}
          </div>
        </div>
        ${addr.lat && addr.lng ? `
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
          <span style="font-size:10px;font-family:monospace;background:rgba(139,92,246,0.08);color:#8b5cf6;border:1px solid rgba(139,92,246,0.2);border-radius:6px;padding:2px 7px">Lat: ${addr.lat}</span>
          <span style="font-size:10px;font-family:monospace;background:rgba(139,92,246,0.08);color:#8b5cf6;border:1px solid rgba(139,92,246,0.2);border-radius:6px;padding:2px 7px">Lng: ${addr.lng}</span>
        </div>` : ''}
      </div>`).join('')}
    </div>` : `
    <div style="padding:14px 18px;font-size:12px;color:var(--text-muted);font-style:italic">لم يُسجّل عنوان لهذا المزود بعد</div>`}

    <!-- ملاحظات -->
    ${entry.notes ? `
    <div style="padding:10px 18px 14px;font-size:12px;color:var(--text-muted);border-top:1px solid var(--border);line-height:1.6">
      💬 ${escHtml(entry.notes)}
    </div>` : ''}
  </div>`;
}

function _driverPdbStyles() {
  if (document.getElementById('driver-pdb-styles')) return '';
  return `<style id="driver-pdb-styles">
    @media (max-width:600px) { }
  </style>`;
}

function showDeliveryMap(orderId) {
  const order = (AppData.orders || []).find(o => o.id === orderId);
  if (!order) { toast('الطلب غير موجود', 'error'); return; }

  const customerAddr = order.customerAddr || order.address || order.deliveryAddress || '';
  const customerName = order.customerName || 'العميل';
  const orderNum     = order.orderId || order.id?.slice(-6) || '—';

  // ── الـ Modal الخارجي ──
  openModal(`
    <div id="dlv-map-wrap" style="display:flex;flex-direction:column;gap:0;min-height:480px">
      <!-- رأس المودال -->
      <div style="display:flex;align-items:center;gap:12px;padding:0 0 14px 0;border-bottom:1px solid var(--glass-border)">
        <div style="width:42px;height:42px;background:linear-gradient(135deg,#0d9488,#0f766e);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">🗺️</div>
        <div>
          <div style="font-weight:800;font-size:16px;color:var(--text-main)">موقع التوصيل — طلب #${escHtml(orderNum)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">👤 ${escHtml(customerName)}</div>
        </div>
      </div>

      <!-- معلومات العنوان -->
      <div style="background:rgba(13,148,136,0.07);border:1px solid rgba(13,148,136,0.2);border-radius:10px;padding:10px 14px;margin:14px 0 12px;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">📍</span>
        <div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">عنوان التوصيل</div>
          <div style="font-size:14px;font-weight:700;color:var(--text-main)" id="dlv-addr-text">${escHtml(customerAddr || 'لا يوجد عنوان محدد')}</div>
        </div>
      </div>

      <!-- حاوية الخريطة -->
      <div id="dlv-map-container" style="width:100%;height:340px;border-radius:14px;overflow:hidden;border:2px solid rgba(13,148,136,0.25);position:relative;background:#1a2a3a">
        <!-- شاشة التحميل -->
        <div id="dlv-map-loading" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:10;background:linear-gradient(135deg,#0d1b2a,#1a2a3a)">
          <div style="font-size:40px">🗺️</div>
          <div style="color:#fff;font-size:14px;font-weight:600">جاري تحميل الخريطة...</div>
          <div style="width:40px;height:4px;background:rgba(255,255,255,0.2);border-radius:4px;overflow:hidden">
            <div style="height:100%;background:#0d9488;border-radius:4px;animation:dlv-prog 1.5s ease-in-out infinite"></div>
          </div>
        </div>
        <div id="dlv-leaflet-map" style="width:100%;height:100%;z-index:1"></div>
      </div>

      <!-- شريط الإجراءات -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid var(--glass-border)">
        <button class="btn btn-secondary btn-sm" style="flex:1" onclick="dlvMap_openExternal('${encodeURIComponent(customerAddr)}')">
          🌍 فتح في خرائط Google
        </button>
        ${customerAddr ? `<button class="btn btn-sm" style="flex:1;background:rgba(13,148,136,0.12);color:#0d9488;border:1px solid rgba(13,148,136,0.3);border-radius:8px;font-weight:700" onclick="dlvMap_copyAddr('${escHtml(customerAddr).replace(/'/g,"\\'")}')">📋 نسخ العنوان</button>` : ''}
      </div>
    </div>
    <style>
      @keyframes dlv-prog { 0%{transform:translateX(-100%)} 100%{transform:translateX(300%)} }
    </style>
  `);

  // ── تحميل Leaflet إن لم يكن محملاً ──
  function _initLeafletMap(lat, lng, label) {
    const loadingEl = document.getElementById('dlv-map-loading');
    if (loadingEl) loadingEl.style.display = 'none';

    // تحقق من وجود Leaflet
    if (!window.L) {
      _showMapError('مكتبة الخرائط غير متاحة');
      return;
    }

    const mapEl = document.getElementById('dlv-leaflet-map');
    if (!mapEl) return;

    try {
      // تدمير أي خريطة سابقة
      if (window._dlvMapInstance) {
        try { window._dlvMapInstance.remove(); } catch(e) {}
        window._dlvMapInstance = null;
      }

      const map = L.map('dlv-leaflet-map', {
        center: [lat, lng],
        zoom: 15,
        zoomControl: true,
        attributionControl: false
      });

      // طبقة الخريطة (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(map);

      // أيقونة مخصصة للتوصيل
      const deliveryIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:44px;height:44px;
          background:linear-gradient(135deg,#0d9488,#0f766e);
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:3px solid #fff;
          box-shadow:0 4px 15px rgba(13,148,136,0.5);
          display:flex;align-items:center;justify-content:center;
        "><span style="transform:rotate(45deg);font-size:18px;display:block;margin:auto;line-height:38px;text-align:center">📍</span></div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 44],
        popupAnchor: [0, -48]
      });

      const marker = L.marker([lat, lng], { icon: deliveryIcon }).addTo(map);
      marker.bindPopup(`
        <div style="direction:rtl;text-align:right;font-family:inherit;min-width:160px">
          <div style="font-weight:800;color:#0d9488;margin-bottom:4px">📦 موقع التوصيل</div>
          <div style="font-size:12px;color:#333">${label}</div>
        </div>
      `).openPopup();

      window._dlvMapInstance = map;
      setTimeout(() => map.invalidateSize(), 200);
    } catch(err) {
      console.error('Map init error:', err);
      _showMapError('حدث خطأ أثناء تحميل الخريطة');
    }
  }

  function _showMapError(msg) {
    const loadingEl = document.getElementById('dlv-map-loading');
    if (loadingEl) {
      loadingEl.innerHTML = `
        <div style="font-size:36px">😕</div>
        <div style="color:#f87171;font-size:13px;font-weight:600">${msg}</div>
        <div style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:4px">يمكنك فتح الموقع في Google Maps</div>
      `;
    }
  }

  function _geocodeAndShow(address) {
    if (!address || address.trim() === '') {
      // اليمن كنقطة مركزية افتراضية إن لم يكن عنوان
      _initLeafletMap(15.5527, 48.5164, 'موقع غير محدد');
      return;
    }
    // Nominatim geocoding (OpenStreetMap — مجاني)
    const query = encodeURIComponent(address + ', Yemen');
    fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
      headers: { 'Accept-Language': 'ar' }
    })
    .then(r => r.json())
    .then(data => {
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        _initLeafletMap(lat, lng, address);
      } else {
        // لم نجد إحداثيات → اعرض الخريطة على مركز اليمن
        _initLeafletMap(15.5527, 48.5164, address + ' (موقع تقريبي)');
      }
    })
    .catch(() => {
      _showMapError('تعذّر تحديد الموقع على الخريطة');
    });
  }

  // ── تحميل Leaflet ديناميكياً إن لم يكن موجوداً ──
  function _ensureLeaflet(callback) {
    if (window.L) { callback(); return; }
    // CSS
    if (!document.getElementById('leaflet-css')) {
      const css = document.createElement('link');
      css.id = 'leaflet-css';
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
    }
    // JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = callback;
    script.onerror = () => _showMapError('تعذّر تحميل مكتبة الخرائط');
    document.head.appendChild(script);
  }

  // ── تشغيل بعد فتح المودال ──
  setTimeout(() => {
    _ensureLeaflet(() => {
      // إذا كان في الطلب إحداثيات مباشرة
      const lat = order.customerLat || order.lat || order.deliveryLat || null;
      const lng = order.customerLng || order.lng || order.deliveryLng || null;
      if (lat && lng) {
        _initLeafletMap(parseFloat(lat), parseFloat(lng), customerAddr || 'موقع التوصيل');
      } else {
        _geocodeAndShow(customerAddr);
      }
    });
  }, 350);
}

// مساعدات خريطة التوصيل
window.dlvMap_openExternal = function(encodedAddr) {
  const addr = decodeURIComponent(encodedAddr);
  const q = encodeURIComponent(addr || 'اليمن');
  window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
};
window.dlvMap_copyAddr = function(addr) {
  navigator.clipboard?.writeText(addr).then(() => toast('تم نسخ العنوان ✅','success')).catch(() => toast('تعذّر النسخ','error'));
};
async function updateDeliveryStatus(orderId, status) {
  if (status === 'delivered') {
    showLoader('جاري إنهاء الطلب ونقله للأرشيف...');
    const order = (AppData.orders || []).find(o => o.id === orderId || o.orderId === orderId);
    if (order) {
      order.status = 'completed';
      await ph53_archiveOrder(order.id, 'completed');
    }
    hideLoader();
    toast('تم تسليم وإنهاء الطلب ونقله للأرشيف بنجاح ✅','success');
  } else {
    await fsUpdate('orders', orderId, { status });
    toast('تم تحديث الحالة','success');
  }
  await render();
}

function renderDriverEarnings() {
  const u = State.currentUser;
  const delivered = AppData.orders.filter(o=>o.driverId===u.uid && o.status==='completed');
  const deliveryFee = delivered.reduce((a)=>a+15,0);
  return `
    <h2>💰 أرباح التوصيل</h2>
    <div class="stat-card">
      <div class="stat-num">${deliveryFee}</div>
      <div class="stat-label">إجمالي الأرباح</div>
    </div>
    <div class="stat-card" style="margin-top:16px">
      <div class="stat-num">${delivered.length}</div>
      <div class="stat-label">عمليات مكتملة</div>
    </div>`;
}

function renderDriverProfile() {
  const u = State.currentUser;
  return `
    <h2>👤 ملفي الشخصي</h2>
    <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:var(--radius);padding:24px">
      <div class="form-group"><label>الاسم</label><div class="form-value">${u.name}</div></div>
      <div class="form-group"><label>البريد</label><div class="form-value">${u.email}</div></div>
      <div class="form-group"><label>الجوال</label><div class="form-value">${u.phone||'—'}</div></div>
      <button class="btn btn-secondary" style="margin-top:20px" onclick="logoutConfirm()">تسجيل الخروج</button>
    </div>`;
}

// ─── Staff Dashboard ───────────────────────────────
window.renderStaff = function() {
  if (State.currentUser?.role !== 'staff') { navigate('home'); return ''; }
  const u = State.currentUser;
  const staffTab = State.staffTab || 'orders';
  const initial = (u.name || u.email || 'S')[0].toUpperCase();
  const displayName = u.name || u.email || 'الموظف';

  // حساب عدد الطلبات المعينة للموظف
  const myAssignedOrders = typeof ph_filterOrdersByAssignment === 'function'
    ? ph_filterOrdersByAssignment(AppData.orders || [], u)
    : (AppData.orders || []);
  const pendingMine = myAssignedOrders.filter(o => ['pending','pending_admin'].includes(o.status)).length;

  const tabs = [
    ['orders', '📋', `طلباتي${pendingMine ? ` <span style="background:#ef4444;color:#fff;border-radius:99px;padding:0 6px;font-size:10px;margin-right:2px">${pendingMine}</span>` : ''}`],
    ['support','💬','الدعم والمحادثات'],
    ['payments','💳','توثيق المدفوعات'],
    ['cats','📂','إدارة التصنيفات'],
    ['services','🛠️','إدارة الخدمات']
  ];

  let content = '';
  if (staffTab==='orders') content = typeof renderStaffOrders === 'function' ? renderStaffOrders() : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري التحميل...</div>';
  else if (staffTab==='support') {
    content = typeof renderSupportDashboard === 'function'
      ? renderSupportDashboard()
      : '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل نظام الدعم...</div>';
    if (typeof initSupportDashboard === 'function') {
      setTimeout(() => initSupportDashboard(), 0);
    }
  }
  else if (staffTab==='payments') content = renderStaffPayments();
  else if (staffTab==='cats') content = renderStaffCats();
  else if (staffTab==='services') content = renderStaffServices();

  return `
  <div id="app-content">
    <div class="admin-sidebar-overlay" id="adminSidebarOverlay" onclick="closeAdminSidebar()"></div>
    <div class="admin-layout">
      <aside class="admin-sidebar" id="adminSidebar">
        <!-- ══ رأس الدرج ══ -->
        <div class="admin-sidebar-header">
          <div class="sidebar-header-row">
            <div class="sidebar-user-block">
              <div class="sidebar-avatar-lg">${initial}</div>
              <div class="sidebar-user-meta">
                <div class="sidebar-user-name">${displayName}</div>
                <div class="sidebar-user-role">موظف العمليات</div>
              </div>
            </div>
            <button class="admin-sidebar-close" onclick="closeAdminSidebar()">✕</button>
          </div>
        </div>
        <nav class="admin-nav" style="padding: 12px 10px;">
          ${tabs.map(([t,ic,l])=>`
            <button class="admin-nav-item${staffTab===t?' active':''}" onclick="setStaffTab('${t}');closeAdminSidebar()">
              <span>${ic}</span><span class="nav-label">${l}</span>
            </button>`).join('')}
        </nav>
        <div class="sidebar-footer">
          <button class="sidebar-footer-notif" onclick="closeAdminSidebar();navigate('notifications')">مركز الإشعارات</button>
        </div>
      </aside>
      <main class="admin-main">
        <div style="margin-bottom:12px">
          <button class="back-btn" onclick="navigate('home')">→ الرئيسية</button>
        </div>
        <div class="admin-content-card">
          ${content}
        </div>
      </main>
    </div>
  </div>`;
}

function renderStaffPayments() {
  const pending = AppData.rechargeReqs.filter(r=>r.status==='pending');
  return `
    <div class="dashboard-header">
      <h2>💳 توثيق عمليات الدفع</h2>
      <p>مراجعة طلبات شحن الرصيد والتحقق من إيصالات التحويل</p>
    </div>
    ${pending.length?`
    <div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>المستخدم</th><th>المبلغ</th><th>الإثبات</th><th>الملاحظة</th><th>إجراء</th></tr></thead>
        <tbody>
          ${pending.map(r=>`
            <tr>
              <td><div style="font-weight:600">${r.userName}</div></td>
              <td><span class="price-tag">${r.amount} ريال</span></td>
              <td>${r.proofBase64?`<button class="btn btn-sm btn-secondary" onclick="viewProof('${r.id}')">🖼️ عرض الإيصال</button>`:'—'}</td>
              <td style="color:var(--text-secondary);font-size:13px">${r.note||'—'}</td>
              <td>
                <div style="display:flex;gap:4px">
                  <button class="btn btn-sm btn-success" onclick="approvePayment('${r.id}')">✅ قبول</button>
                  <button class="btn btn-sm btn-danger" onclick="rejectPayment('${r.id}')">❌ رفض</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`:'<div class="empty-state"><div class="empty-icon">💳</div><p>لا توجد طلبات دفع معلقة للمراجعة</p></div>'}`;
}

function renderStaffCats() {
  return `
    <div class="dashboard-header dashboard-header-row">
      <div>
        <h2>📂 إدارة التصنيفات</h2>
        <p>إدارة وتحديث تصنيفات المهن، الخدمات والمتاجر</p>
      </div>
      <button class="btn btn-primary" onclick="window.showAddCatModal()">➕ إضافة تصنيف جديد</button>
    </div>
    ${AppData.cats.length ? `
    <div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>أيقونة</th><th>الاسم</th><th>القسم</th><th>الترتيب</th><th>إجراءات</th></tr></thead>
        <tbody>
          ${AppData.cats.sort((a,b)=> (a.order||0)-(b.order||0)).map(c=>`
            <tr>
              <td style="font-size:24px">${c.icon||'📁'}</td>
              <td>
                <div style="font-weight:700">${c.name}</div>
                <div style="font-size:11px;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.description||'لا يوجد وصف'}</div>
              </td>
              <td><span class="badge badge-secondary">${c.section}</span></td>
              <td><span class="badge badge-teal">${c.order||0}</span></td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="window.showEditCatModal('${c.id}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="window.deleteCat('${c.id}')">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `
    <div class="empty-state" style="padding:60px 20px;text-align:center;background:var(--bg-card);border:1px solid var(--glass-border);border-radius:var(--radius);margin-top:20px">
      <div class="empty-icon" style="font-size:48px;margin-bottom:16px;opacity:0.7">📂</div>
      <div class="empty-title" style="font-size:18px;font-weight:700;margin-bottom:8px">لا توجد تصنيفات حالياً</div>
      <p style="color:var(--text-muted);font-size:14px;margin:0">قم بإضافة تصنيفات جديدة لتظهر للعملاء في التطبيق.</p>
    </div>`}`;
}

function renderStaffServices() {
  return `
    <div class="dashboard-header dashboard-header-row">
      <div>
        <h2>🛠️ إدارة الخدمات</h2>
        <p>إدارة كافة الخدمات المهنية المضافة في النظام</p>
      </div>
      <button class="btn btn-primary" onclick="window.showAddSvcModal()">➕ إضافة خدمة جديدة</button>
    </div>
    ${AppData.services.length ? `
    <div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>الخدمة</th><th>المزود</th><th>السعر</th><th>المنطقة</th><th>إجراءات</th></tr></thead>
        <tbody>
          ${AppData.services.map(s=>`
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  ${s.images?.[0]?`<img src="${s.images[0]}" style="width:32px;height:32px;border-radius:4px;object-fit:cover">`:'<div style="width:32px;height:32px;background:#eee;border-radius:4px;display:flex;align-items:center;justify-content:center">🛠️</div>'}
                  <div style="font-weight:600">${s.name}</div>
                </div>
              </td>
              <td style="color:var(--text-secondary)">${s.provider||'—'}</td>
              <td><span class="price-tag">${s.price?s.price+' ريال':'بعد المعاينة'}</span></td>
              <td>${AppData.regions.find(r=>r.id===s.regionId)?.name||'—'}</td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="window.showEditSvcModal('${s.id}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="window.deleteSvc('${s.id}')">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `
    <div class="empty-state" style="padding:60px 20px;text-align:center;background:var(--bg-card);border:1px solid var(--glass-border);border-radius:var(--radius);margin-top:20px">
      <div class="empty-icon" style="font-size:48px;margin-bottom:16px;opacity:0.7">🛠️</div>
      <div class="empty-title" style="font-size:18px;font-weight:700;margin-bottom:8px">لا توجد خدمات حالياً</div>
      <p style="color:var(--text-muted);font-size:14px;margin:0">قم بإضافة خدمات مهنية جديدة أو اربطها بمزودين في النظام.</p>
    </div>`}`;
}

async function setStaffTab(tab) {
  State.staffTab = tab; await render();
}

// ─── ADMIN: Service Management (Rich Version) ─────────
let _svcImagesBuf = { main: null, extras: [], existing: [] };
let _modalStateStack = [];

window.showAddSvcModal = function() {
  if (State.currentUser && State.currentUser.role === 'admin') {
    window.ph46_showAdminAddSvcModal(null, 'bookings');
  } else {
    toast('غير مسموح لمزودي الخدمة بالإضافة المباشرة للحجوزات والأقسام. يرجى إرسال طلب إضافة خدمة للمراجعة.', 'warning');
  }
};

window.saveNewSvc = async function() {
  const data = _collectSvcForm([]);
  if (!data.catId || !data.name) { toast('\u0627\u062e\u062a\u0631 \u0627\u0644\u062a\u0635\u0646\u064a\u0641 \u0648\u0627\u062f\u062e\u0644 \u0627\u0633\u0645 \u0627\u0644\u062e\u062f\u0645\u0629', 'error'); return; }
  // ── بيانات التنبيهات وحالة التوفر (ph48) ─────────────────────────
  if (typeof ph48_collectAlertData === 'function') {
    const alertData = ph48_collectAlertData();
    data.stockStatus = alertData.stockStatus || 'available';
    data.alertBadge  = alertData.alertBadge  || null;
  }

  showLoader();
  try {
    await fsAdd('services', { ...data, status: 'active', icon: '\ud83d\udd37', createdAt: new Date() });
    closeModal(); toast('\u062a\u0645 \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u062e\u062f\u0645\u0629 \u2705', 'success'); await render();
  } catch (e) {
    console.error('Save Service Error:', e);
    toast('\u274c \u0641\u0634\u0644 \u0627\u0644\u062d\u0641\u0638: ' + e.message, 'error');
  } finally {
    hideLoader();
  }
}

window.showEditSvcModal = function(svcId) {
  const s = AppData.services.find(x=>x.id===svcId);
  if (!s) return;
  _svcImagesBuf = { main:null, extras:[], existing: s.images||[] };
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ تعديل الخدمة</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    ${_svcModalBody(s)}
    <button class="btn btn-primary btn-block" onclick="updateSvc('${svcId}')">حفظ</button>`);
}

window.updateSvc = async function(svcId) {
  const s = AppData.services.find(x=>x.id===svcId);
  const data = _collectSvcForm(s?.images||[], s?.videoUrl||'');
  if (!data.assignedVendors || !data.assignedVendors.length) { toast('يرجى تحديد مزود واحد على الأقل لهذه الخدمة', 'warning'); return; }

  showLoader('جاري الحفظ...');
  try {
    // ─── رفع الصورة الرئيسية إن وُجدت (مع ضغط تلقائي) ───
    const imgInput = document.getElementById('svc-img-main');
    if (imgInput && imgInput.files && imgInput.files[0] && typeof window.mUpload_uploadImage === 'function') {
      showLoader('⏳ جاري ضغط ورفع الصورة...');
      const imgUrl = await window.mUpload_uploadImage(imgInput.files[0], `images/services/${svcId}_main`);
      if (imgUrl) data.images = [imgUrl, ...(data.images||[]).slice(1)];
    }

    // ─── رفع الفيديو إن وُجد ───
    const vidInput = document.getElementById('svc-video');
    if (vidInput && vidInput.files && vidInput.files[0] && typeof window.mUpload_uploadVideo === 'function') {
      showLoader('🎬 جاري رفع الفيديو...');
      window.mUpload_showProgressToast('🎬 رفع فيديو الخدمة...');
      const vidFile = vidInput.files[0];
      const ext = vidFile.name.split('.').pop().toLowerCase();
      data.videoUrl = await window.mUpload_uploadVideo(
        vidFile,
        `videos/services/${svcId}_${Date.now()}.${ext}`,
        (pct) => window.mUpload_updateProgressToast(pct, `🎬 رفع الفيديو... ${pct}%`)
      );
      window.mUpload_hideProgressToast();
    }

    // ── بيانات التنبيهات وحالة التوفر (ph48) ─────────────────────────
    if (typeof ph48_collectAlertData === 'function') {
      const alertData = ph48_collectAlertData();
      data.stockStatus = alertData.stockStatus || 'available';
      data.alertBadge  = alertData.alertBadge  || null;
    }

    await fsUpdate('services', svcId, data);
    closeModal(); toast('تم التعديل ✅','success'); await render();
  } catch (e) {
    window.mUpload_hideProgressToast();
    console.error('Update Service Error:', e);
    toast('❌ فشل التعديل: ' + (e.message||''), 'error');
  } finally {
    hideLoader();
  }
}

window.deleteSvc = async function(svcId) {
  if (!confirm('حذف هذه الخدمة؟')) return;
  await fsDelete('services', svcId);
  toast('تم الحذف','success'); await render();
}

window._svcOnCatChange = function(catId) {
  const sections = (AppData.svcSections || []).filter(sec => sec.catId === catId);
  const container = document.getElementById('svc-section-container');
  if (!container) return;

  if (sections.length > 0) {
    container.innerHTML = `
      <label class="form-label">القسم الفرعي (اختياري)</label>
      <select class="form-control" id="svc-section-id">
        <option value="">-- اختر القسم الفرعي --</option>
        ${sections.map(sec => `<option value="${sec.id}">${sec.icon || ''} ${sec.name}</option>`).join('')}
      </select>`;
  } else {
    container.innerHTML = `
      <label class="form-label">ترتيب الظهور</label>
      <input class="form-control" id="svc-order" type="number" value="0" placeholder="0">`;
  }
};

window._svcModalBody = function(s = {}, section = null) {
  const regions = AppData.deliveryZones || AppData.regions || [];
  const oh = s.openingHours || { open:'09:00', close:'22:00', days:['sat','sun','mon','tue','wed','thu'] };
  const categories = AppData.cats || [];
  const cat = categories.find(c => c.id === s.catId);
  
  // Determine active section to filter categories dropdown properly
  const activeSec = section || cat?.section || 'bookings';
  let filteredCats = [];
  if (activeSec === 'bookings') {
    filteredCats = categories.filter(c => c.section === 'bookings' && c.catType !== 'rental');
  } else if (activeSec === 'professions' || activeSec === 'services') {
    filteredCats = categories.filter(c => c.section === 'professions' || c.section === 'services');
  } else if (activeSec === 'stores') {
    filteredCats = categories.filter(c => c.section === 'stores');
  } else {
    filteredCats = categories.filter(c => c.section === activeSec);
  }

  const isProfessions = cat ? (cat.section === 'professions' || cat.section === 'services') : (activeSec !== 'bookings' && activeSec !== 'stores');
  const sections = (AppData.svcSections || []).filter(sec => sec.catId === s.catId);

  return `
    <style>
      .admin-modal-card {
        background: var(--bg-card, #1e1e2d);
        border: 1px solid var(--border, rgba(255,255,255,0.08));
        border-radius: 16px;
        padding: 18px;
        margin-bottom: 18px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      }
      .admin-modal-card-title {
        font-size: 14px;
        font-weight: 700;
        color: var(--primary, #8b5cf6);
        margin-bottom: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
        padding-bottom: 8px;
      }
      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
    </style>

    <!-- 1. البيانات الأساسية للخدمة -->
    <div class="admin-modal-card">
      <div class="admin-modal-card-title">📝 البيانات الأساسية للخدمة</div>
      
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">التصنيف</label>
          <select class="form-control" id="svc-cat" onchange="window._svcOnCatChange(this.value)">
            <option value="">-- اختر التصنيف --</option>
            ${filteredCats.map(c=>`<option value="${c.id}"${s.catId===c.id?' selected':''}>${c.icon||''} ${c.name}</option>`).join('')}
          </select>
        </div>
        
        <div class="form-group" id="svc-section-container">
          ${sections.length > 0 ? `
            <label class="form-label">القسم الفرعي (اختياري)</label>
            <select class="form-control" id="svc-section-id">
              <option value="">-- اختر القسم الفرعي --</option>
              ${sections.map(sec => `<option value="${sec.id}" ${s.sectionId === sec.id ? 'selected' : ''}>${sec.icon || ''} ${sec.name}</option>`).join('')}
            </select>
          ` : `
            <label class="form-label">ترتيب الظهور</label>
            <input class="form-control" id="svc-order" type="number" value="${s.order||0}" placeholder="0">
          `}
        </div>
      </div>

      <div class="grid-2" style="margin-top: 12px;">
        <div class="form-group">
          <label class="form-label">اسم الخدمة</label>
          <input class="form-control" id="svc-name" value="${s.name||''}" placeholder="مثال: حجز فندق">
        </div>
        <div class="form-group">
          <label class="form-label">مقدم الخدمة (يظهر للادارة فقط)</label>
          <input class="form-control" id="svc-provider" value="${s.provider||''}" placeholder="الفندق الذهبي">
        </div>
      </div>

      ${sections.length > 0 ? `
        <div class="form-group" style="margin-top: 12px;">
          <label class="form-label">ترتيب الظهور</label>
          <input class="form-control" id="svc-order" type="number" value="${s.order||0}" placeholder="0">
        </div>
      ` : ''}

      <div class="form-group" style="margin-top: 12px;">
        <label class="form-label">الوصف</label>
        <textarea class="form-control" id="svc-desc" rows="3" placeholder="اكتب وصفاً مختصراً ومميزاً للخدمة...">${s.desc||''}</textarea>
      </div>
    </div>

    <!-- 2. التسعير والرسوم والعمولات -->
    <div class="admin-modal-card">
      <div class="admin-modal-card-title">💰 التسعير والرسوم والعمولات</div>
      
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">السعر الأساسي (ريال)</label>
          <input class="form-control" id="svc-price" type="number" value="${s.price||''}" placeholder="فارغ = عند الطلب" oninput="ph21_updateFinalPrice()">
        </div>
        <div class="form-group">
          <label class="form-label">نسبة العربون (%)</label>
          <input class="form-control" id="svc-deposit" type="number" value="${s.depositPercent||0}" placeholder="0" oninput="ph21_updateFinalPrice()">
        </div>
      </div>

      <div class="grid-2" style="margin-top: 12px;">
        <div class="form-group">
          <label class="form-label">العمولة (%)</label>
          <input class="form-control" id="svc-commission" type="number" value="${s.commission||0}" placeholder="مثال: 10" oninput="ph21_updateFinalPrice()">
        </div>
        <div class="form-group">
          <label class="form-label">الضريبة (%)</label>
          <input class="form-control" id="svc-tax" type="number" value="${s.tax||0}" placeholder="مثال: 15" oninput="ph21_updateFinalPrice()">
        </div>
      </div>

      <div class="form-group" style="background:rgba(var(--primary-rgb),0.08);padding:12px;border-radius:12px;margin-top:12px;border:1px solid rgba(var(--primary-rgb),0.2);display:${(s.finalPrice||0)>0?'block':'none'}">
        <label class="form-label" style="margin-bottom:2px;color:var(--primary);font-weight:800">السعر النهائي للعميل:</label>
        <div id="ph21-final-price-disp" style="font-size:20px;font-weight:900;color:var(--text-main)">${s.finalPrice||0} ريال</div>
      </div>
    </div>

    <!-- 3. تفاصيل الموقع والتوصيل -->
    <div class="admin-modal-card">
      <div class="admin-modal-card-title">📍 تفاصيل الموقع والتوصيل</div>
      
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">المحافظة التابعة</label>
          <select class="form-control" id="svc-gov" onchange="ph_onFormGovChange('svc-gov', 'svc-region')">
            <option value="">-- اختر المحافظة --</option>
            ${(AppData.deliveryGovernorates || []).filter(g => g.active !== false).map(g => `<option value="${g.id}" ${g.id === s.govId ? 'selected' : ''}>${escHtml(g.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">المنطقة</label>
          <select class="form-control" id="svc-region">
            <option value="">-- اختر المنطقة --</option>
            ${(AppData.deliveryZones || AppData.regions || []).filter(r => r.govId === s.govId && r.active !== false).map(r => `<option value="${r.id}" ${r.id === s.regionId ? 'selected' : ''}>${r.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-top: 12px;">
        <label class="form-label">العنوان داخل المنطقة</label>
        <input class="form-control" id="svc-address" value="${s.address||''}" placeholder="مثال: شارع الأربعين بجانب جامع النور">
      </div>

      <div class="form-group" style="margin-top: 12px;">
        <label class="form-label">الموقع على الخريطة</label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input class="form-control" id="svc-lat" value="${s.lat||''}" placeholder="خط العرض (Latitude)" style="flex:1;min-width:120px">
          <input class="form-control" id="svc-lng" value="${s.lng||''}" placeholder="خط الطول (Longitude)" style="flex:1;min-width:120px">
          <button type="button" class="btn btn-secondary btn-sm" onclick="svcUseMyLocation()" title="حدد موقعي" style="display:flex;align-items:center;gap:5px;white-space:nowrap;">📍 موقعي</button>
          <button type="button" onclick="openServiceMapPicker()" title="افتح الخريطة" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 5px 16px rgba(26,115,232,0.45)'" onmouseout="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(26,115,232,0.3)'" style="display:flex;align-items:center;gap:7px;background:linear-gradient(135deg,#1a73e8,#1557b0);color:#fff;border:none;border-radius:9px;padding:7px 14px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(26,115,232,0.3);transition:all 0.2s ease;white-space:nowrap;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><circle cx="12" cy="9" r="3.5" fill="#fff" opacity="0.9"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#fff" stroke-width="1.5" fill="rgba(255,255,255,0.15)"/></svg>
            خرائط قوقل
          </button>
        </div>
        <div id="svc-loc-hint" style="font-size:12px;color:var(--text-muted);margin-top:6px">${s.lat?'✅ موقع محفوظ':''}</div>
      </div>

      <div class="form-group" style="margin-top:16px;">
        <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="svc-delivery" ${s.requiresDelivery !== false ? 'checked' : ''} style="width:20px;height:20px;">
          <span>تتطلب مندوب توصيل (مثل: توصيل معدات للعميل)</span>
        </label>
      </div>

      ${isProfessions ? `
        <div class="form-group" style="margin-top: 12px;">
          <label class="form-label">الأعطال الشائعة (واحد في كل سطر - للمهن فقط)</label>
          <textarea class="form-control" id="svc-issues" rows="3" placeholder="مثال:&#10;تسريب مياه&#10;كسر في الانبوب">${(s.commonIssues||[]).join('\n')}</textarea>
        </div>
      ` : ''}
    </div>

    <!-- 4. مواعيد العمل -->
    <div class="admin-modal-card">
      <div class="admin-modal-card-title">🕒 مواعيد العمل</div>
      
      <div class="grid-2">
        <div><label style="font-size:12px;color:var(--text-secondary)">يفتح</label><input class="form-control" id="svc-open" type="time" value="${oh.open||'09:00'}"></div>
        <div><label style="font-size:12px;color:var(--text-secondary)">يغلق</label><input class="form-control" id="svc-close" type="time" value="${oh.close||'22:00'}"></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px" id="svc-days">
        ${_DB_DAYS.map(d => `<label class="day-chip${(oh.days||[]).includes(d.k)?' on':''}"><input type="checkbox" value="${d.k}" ${(oh.days||[]).includes(d.k)?'checked':''} onchange="this.parentElement.classList.toggle('on',this.checked)" hidden>${d.n}</label>`).join('')}
      </div>
    </div>

    <!-- 5. صور وفيديو الخدمة -->
    <div class="admin-modal-card">
      <div class="admin-modal-card-title">🎬 صور وفيديو الخدمة</div>

      <!-- الصورة الرئيسية بنظام الضغط الذكي -->
      ${typeof window.mUpload_renderMediaFields === 'function'
        ? window.mUpload_renderMediaFields({
            imageId: 'svc-img-main',
            videoId: 'svc-video',
            currentImageUrl: s.images?.[0] || '',
            currentVideoUrl: s.videoUrl || '',
            imageRequired: false,
            showVideo: true
          })
        : `<div class="form-group">
             <label class="form-label">الصورة الرئيسية</label>
             <input class="form-control" id="svc-img-main" type="file" accept="image/*" onchange="svcPreviewMain(this)">
             <div id="svc-main-preview" style="margin-top:8px">${s.images?.[0]?`<img src="${s.images[0]}" style="max-width:200px;max-height:140px;border-radius:8px;object-fit:cover">`:''}</div>
           </div>
           <div class="form-group" style="margin-top:12px">
             <label class="form-label">🎬 رابط فيديو (اختياري)</label>
             <input class="form-control" id="svc-video-url" value="${s.videoUrl||''}" placeholder="https://..."> 
           </div>`
      }

      <!-- صور إضافية -->
      <div class="form-group" style="margin-top:16px;">
        <label class="form-label">📸 صور إضافية للمعرض</label>
        <input class="form-control" id="svc-img-extra" type="file" accept="image/*" multiple onchange="svcPreviewExtras(this)">
        <div id="svc-extra-preview" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
          ${(s.images||[]).slice(1).map(b=>`<img src="${b}" style="width:80px;height:80px;border-radius:8px;object-fit:cover;border:2px solid var(--glass-border)">`).join('')}
        </div>
      </div>
    </div>

    <!-- 6. إضافة إلى قسم العروض والخصومات -->
    <div class="admin-modal-card" style="border:1px solid rgba(239,68,68,0.25);background:linear-gradient(135deg,rgba(239,68,68,0.04),rgba(245,158,11,0.03))">
      <div class="admin-modal-card-title" style="color:#ef4444">🏷️ قسم العروض والخصومات</div>

      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 14px;background:rgba(239,68,68,0.06);border:1px dashed rgba(239,68,68,0.3);border-radius:12px">
          <input type="checkbox" id="svc-add-to-offers" ${s.offerId ? 'checked' : ''} onchange="ph_toggleOfferFields(this.checked)" style="width:20px;height:20px;accent-color:#ef4444">
          <div>
            <div style="font-weight:700;font-size:14px">إضافة هذه الخدمة إلى قسم العروض والخصومات</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">ستظهر الخدمة للعملاء في قسم مخصص بسعر مخفض</div>
          </div>
        </label>
      </div>

      <div id="offer-fields-wrap" style="display:${s.offerId ? 'block' : 'none'};margin-top:14px">
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">نسبة الخصم (%) *</label>
            <input class="form-control" id="svc-offer-pct" type="number" min="1" max="99" value="${s.offerDiscountPct || ''}" placeholder="مثال: 20" oninput="ph_offerFieldsCalc()">
          </div>
          <div class="form-group">
            <label class="form-label">السعر بعد الخصم (ريال)</label>
            <input class="form-control" id="svc-offer-discounted" type="number" value="${s.offerDiscountedPrice || ''}" placeholder="يُحسب تلقائياً">
          </div>
        </div>
        <div class="form-group" style="margin-top:10px">
          <label class="form-label">تاريخ انتهاء العرض (اختياري — فارغ = دائم)</label>
          <input class="form-control" id="svc-offer-expires" type="date" value="${s.offerExpiresAt ? (s.offerExpiresAt.toDate ? s.offerExpiresAt.toDate() : new Date(s.offerExpiresAt)).toISOString().split('T')[0] : ''}">
        </div>
        <div id="offer-price-preview" style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:10px 14px;margin-top:10px;display:none;font-size:13px;color:#10b981;font-weight:700"></div>
      </div>
    </div>

    <!-- 7. إعدادات التوجيه التلقائي للمزودين -->
    <div class="admin-modal-card">
      <div class="admin-modal-card-title">⚙️ إعدادات التوجيه التلقائي للمزودين</div>
      
      <div class="form-group" style="background:rgba(var(--primary-rgb),0.05);padding:16px;border-radius:14px;margin-bottom:16px;border:1px dashed var(--primary)">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-weight:700;font-size:15px;margin-bottom:4px">🔄 إتاحة الطلب من عدة مزودين</div>
            <div style="font-size:11px;color:var(--text-secondary)">تفعيل هذا الخيار يحول الخدمة إلى "نظام توجيه تلقائي" للأقرب.</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="svc-multi-vendors" ${s.multiVendors!==false?'checked':''} onchange="ph43_toggleVendorPickerMode(this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      ${_renderVendorPicker(s.assignedVendors||[], s.multiVendors!==false)}

    </div>

    <!-- 8. التنبيهات وحالة التوفر -->
    <div class="admin-modal-card" style="border:1px solid rgba(99,102,241,0.25);background:linear-gradient(135deg,rgba(99,102,241,0.04),rgba(139,92,246,0.03));padding-bottom:8px">
      ${typeof renderAdminAlerts === 'function' && (s.adminAlerts||[]).length > 0 ? `
      <div class="admin-modal-card-title" style="color:var(--primary)">🔔 التنبيهات والإشعارات الإدارية</div>
      <div style="margin-bottom:14px;">
        ${renderAdminAlerts(s.adminAlerts || [])}
      </div>` : ''}
      ${typeof ph48_adminSectionHtml === 'function' ? ph48_adminSectionHtml(s) : ''}
    </div>`;
}

function _collectSvcForm(existingImages = [], existingVideoUrl = '') {
  const days = Array.from(document.querySelectorAll('#svc-days input:checked')).map(i=>i.value);
  const main = (_svcImagesBuf||{}).main || existingImages[0] || null;
  const extras = (_svcImagesBuf||{}).extras?.length ? _svcImagesBuf.extras : existingImages.slice(1);
  const images = [main, ...extras].filter(Boolean);
  const depositPercent = parseInt(document.getElementById('svc-deposit')?.value) || 0;
  // جمع رابط الفيديو (إما من حقل URL أو من بيانات موجودة)
  const videoUrl = document.getElementById('svc-video-url')?.value.trim() || existingVideoUrl || null;
  return {
    catId: document.getElementById('svc-cat')?.value || '',
    name: document.getElementById('svc-name')?.value.trim() || '',
    provider: document.getElementById('svc-provider')?.value.trim() || '',
    desc: document.getElementById('svc-desc')?.value.trim() || '',
    price: parseInt(document.getElementById('svc-price')?.value) || null,
    depositPercent: depositPercent,
    hasDeposit: depositPercent > 0,
    requiresDelivery: document.getElementById('svc-delivery') ? document.getElementById('svc-delivery').checked : true,
    regionId: document.getElementById('svc-region')?.value || null,
    address: document.getElementById('svc-address')?.value.trim() || '',
    phone: document.getElementById('svc-phone')?.value.trim() || '',
    whatsapp: document.getElementById('svc-whatsapp')?.value.trim() || '',
    commonIssues: document.getElementById('svc-issues') ? document.getElementById('svc-issues').value.trim().split('\n').filter(l=>l.trim()) : [],
    lat: parseFloat(document.getElementById('svc-lat')?.value) || null,
    lng: parseFloat(document.getElementById('svc-lng')?.value) || null,
    openingHours: {
      open: document.getElementById('svc-open')?.value || '09:00',
      close: document.getElementById('svc-close')?.value || '22:00',
      days,
    },
    order: parseInt(document.getElementById('svc-order')?.value) || 0,
    multiVendors: document.getElementById('svc-multi-vendors')?.checked !== false,
    assignedVendors: Array.from(document.querySelectorAll('.svc-vendor-cb:checked')).map(cb=>cb.value),
    sectionId: document.getElementById('svc-section-id')?.value || null,
    images,
    videoUrl,
    adminAlerts: typeof window.getAdminAlerts === 'function' ? window.getAdminAlerts() : [],
  };
}

function _renderVendorPicker(assignedIds = [], isMulti = true) {
  const groups = AppData.providerGroups || [];
  if (groups.length > 0 && typeof pg_renderVendorPickerGrouped === 'function') {
    window.__pg_selectedGroup = window.__pg_selectedGroup || null;
    return pg_renderVendorPickerGrouped(assignedIds, isMulti);
  }
  const vendors = (AppData.users || []).filter(u => ['vendor', 'provider'].includes(u.role));
  const type = isMulti ? 'checkbox' : 'radio';
  return `
    <div class="vendor-picker-container" style="background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:16px; padding:16px; margin-top:8px">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
        <label class="form-label" style="margin:0; font-weight:700; color:var(--primary)">💎 المزودون المعتمدون (إلزامي)</label>
        <div id="multi-vendor-actions" style="display:${isMulti?'flex':'none'}; gap:8px">
          <button type="button" class="btn btn-sm" style="font-size:11px; padding:4px 8px; background:rgba(139,92,246,0.1); color:var(--primary)" onclick="ph43_selectAllVendors(true)">تحديد الكل</button>
          <button type="button" class="btn btn-sm" style="font-size:11px; padding:4px 8px; background:rgba(244,63,94,0.1); color:var(--rose)" onclick="ph43_selectAllVendors(false)">إلغاء الكل</button>
        </div>
      </div>
      <input type="text" class="form-control form-control-sm" placeholder="🔍 ابحث عن مزود..." oninput="ph43_filterVendors(this.value)" style="margin-bottom:12px; height:36px; border-radius:10px; background:rgba(0,0,0,0.2)">
      <div style="max-height:200px; overflow-y:auto; padding-right:4px" id="svc-vendors-pool" class="custom-scrollbar">
        ${vendors.map(v => `
          <label class="vendor-item" data-name="${(v.name||'').toLowerCase()}" style="display:flex; align-items:center; gap:12px; margin-bottom:8px; cursor:pointer; padding:10px; border-radius:12px; background:rgba(255,255,255,0.02); transition:all 0.2s; border:1px solid transparent">
            <input type="${type}" name="svc-vendor" class="svc-vendor-cb" value="${v.id}" ${assignedIds.includes(v.id) ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary)">
            <div style="flex:1">
              <div style="font-weight:600; font-size:14px">${escHtml(v.name||'—')}</div>
              <div style="font-size:11px; color:var(--text-muted)">${escHtml(v.email || v.phone || '')}</div>
            </div>
            ${assignedIds.includes(v.id) ? '<span style="font-size:16px">✅</span>' : ''}
          </label>
        `).join('')}
      </div>
      <div id="picker-hint" style="font-size:11px; color:var(--text-muted); margin-top:10px; display:flex; align-items:center; gap:6px">
        <span style="font-size:14px">ℹ️</span> ${isMulti ? 'سيقوم النظام بتوجيه الطلب تلقائياً للأقرب من القائمة المحددة.' : 'يرجى تحديد مزود واحد فقط لهذه الخدمة.'}
      </div>
    </div>
    <style>
      .vendor-item:hover { background:rgba(139,92,246,0.08) !important; border-color:var(--primary) !important; }
      .vendor-item:has(input:checked) { background:rgba(139,92,246,0.1) !important; border-color:var(--primary) !important; }
    </style>
  `;
}

window.ph43_selectAllVendors = function(val) {
  document.querySelectorAll('.svc-vendor-cb').forEach(cb => cb.checked = val);
};

window.ph43_filterVendors = function(q) {
  const query = q.toLowerCase();
  document.querySelectorAll('.vendor-item').forEach(item => {
    const name = item.dataset.name;
    item.style.display = name.includes(query) ? 'flex' : 'none';
  });
};
const _DB_DAYS = [
  {k:'sat',n:'السبت'}, {k:'sun',n:'الأحد'}, {k:'mon',n:'الاثنين'},
  {k:'tue',n:'الثلاثاء'}, {k:'wed',n:'الأربعاء'}, {k:'thu',n:'الخميس'}, {k:'fri',n:'الجمعة'}
];

async function svcPreviewMain(input) {
  if (!input.files[0]) return;
  const b = await fileToResizedBase64(input.files[0], 1200, 0.8);
  _svcImagesBuf.main = b;
  document.getElementById('svc-main-preview').innerHTML = `<img src="${b}" style="max-width:200px;max-height:140px;border-radius:8px;object-fit:cover">`;
}
async function svcPreviewExtras(input) {
  const files = Array.from(input.files).slice(0,4);
  _svcImagesBuf.extras = [];
  const out = document.getElementById('svc-extra-preview');
  out.innerHTML = '';
  for (const f of files) {
    const b = await fileToResizedBase64(f, 900, 0.75);
    _svcImagesBuf.extras.push(b);
    out.insertAdjacentHTML('beforeend', `<img src="${b}" style="width:80px;height:80px;border-radius:8px;object-fit:cover">`);
  }
}
async function svcUseMyLocation() {
  const c = await new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => res({lat:p.coords.latitude,lng:p.coords.longitude}), () => res(null), {timeout:8000});
  });
  if (!c) { toast('تعذّر الحصول على الموقع','error'); return; }
  document.getElementById('svc-lat').value = c.lat.toFixed(6);
  document.getElementById('svc-lng').value = c.lng.toFixed(6);
  document.getElementById('svc-loc-hint').textContent = '✅ تم تحديد موقعك';
}

function fileToResizedBase64(file, maxW = 900, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── ADMIN: Modal State Management ────────────────────
function ph_pushModalState() {
  const body = document.getElementById('modal-body');
  if (!body) return;
  const state = { html: body.innerHTML, values: {} };
  body.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.id) {
      if (el.type === 'checkbox') state.values[el.id] = el.checked;
      else state.values[el.id] = el.value;
    }
  });
  _modalStateStack.push(state);
}
function ph_popModalState() {
  const state = _modalStateStack.pop();
  if (!state) return false;
  const body = document.getElementById('modal-body');
  if (!body) return false;
  body.innerHTML = state.html;
  Object.entries(state.values).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === 'checkbox') el.checked = val;
      else el.value = val;
    }
  });
  return true;
}

// ─── ADMIN: Map Picker (Mapbox GL) ───────────────────────────────
let _pickerMap, _pickerMarker;
window.openServiceMapPicker = function() {
  const latEl = document.getElementById('svc-lat');
  const lngEl = document.getElementById('svc-lng');
  const currentLat = latEl ? (parseFloat(latEl.value) || 15.3694) : 15.3694;
  const currentLng = lngEl ? (parseFloat(lngEl.value) || 44.1817) : 44.1817;
  ph_pushModalState();
  openModal(`
    <div class="modal-header"><h2 class="modal-title">🗺️ تحديد موقع الخدمة</h2><button class="modal-close" onclick="ph_popModalState() || closeModal()">✕</button></div>
    <div style="padding:20px">
      <div style="position:relative;margin-bottom:12px;">
        <input id="map-search-box" type="text" class="form-control" placeholder="🔍 ابحث عن موقع، مدينة، حي..." style="padding-left:12px;padding-right:12px;font-size:14px;">
        <div id="map-search-results" style="position:absolute;top:100%;right:0;left:0;background:#1e1e2e;border:1px solid var(--border);border-radius:8px;z-index:9999;display:none;max-height:200px;overflow-y:auto;"></div>
      </div>
      <div id="map-picker-canvas" style="height:340px;border-radius:12px;margin-bottom:16px;border:1px solid var(--border);overflow:hidden;"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label class="form-label">📍 Latitude</label><input class="form-control" id="map-lat-input" type="number" step="0.000001" value="${currentLat}"></div>
        <div class="form-group"><label class="form-label">📍 Longitude</label><input class="form-control" id="map-lng-input" type="number" step="0.000001" value="${currentLng}"></div>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="saveServiceLocation()">✅ تأكيد الموقع</button>
    </div>`);

  if (typeof mapboxgl === 'undefined') return;
  setTimeout(() => {
    mapboxgl.accessToken = window.MAPBOX_TOKEN;
    _pickerMap = new mapboxgl.Map({
      container: 'map-picker-canvas',
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [currentLng, currentLat],
      zoom: 13,
      language: 'ar'
    });
    _pickerMap.addControl(new mapboxgl.NavigationControl(), 'top-left');
    const el = document.createElement('div');
    el.style.cssText = 'width:32px;height:32px;background:url("https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6/svgs/solid/location-dot.svg") center/contain no-repeat;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));cursor:grab;';
    _pickerMarker = new mapboxgl.Marker({ element: el, draggable: true })
      .setLngLat([currentLng, currentLat])
      .addTo(_pickerMap);
    const updateCoords = (lng, lat) => {
      document.getElementById('map-lat-input').value = lat.toFixed(6);
      document.getElementById('map-lng-input').value = lng.toFixed(6);
    };
    _pickerMarker.on('dragend', () => {
      const pos = _pickerMarker.getLngLat();
      updateCoords(pos.lng, pos.lat);
    });
    _pickerMap.on('click', (e) => {
      _pickerMarker.setLngLat(e.lngLat);
      updateCoords(e.lngLat.lng, e.lngLat.lat);
    });
    // ── بحث سريع بـ Mapbox Geocoding ──
    const searchInput = document.getElementById('map-search-box');
    const resultsBox = document.getElementById('map-search-results');
    let searchTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = searchInput.value.trim();
      if (q.length < 2) { resultsBox.style.display = 'none'; return; }
      searchTimer = setTimeout(async () => {
        try {
          const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${window.MAPBOX_TOKEN}&language=ar&limit=5`);
          const data = await res.json();
          if (!data.features?.length) { resultsBox.style.display = 'none'; return; }
          resultsBox.innerHTML = data.features.map(f => `
            <div onclick="window._mbSelectPlace(${f.center[0]},${f.center[1]},'${f.place_name.replace(/'/g,"\\'")}')" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:#e2e8f0;" onmouseover="this.style.background='rgba(124,58,237,0.15)'" onmouseout="this.style.background=''">
              <div style="font-weight:600">${f.text}</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px">${f.place_name}</div>
            </div>`).join('');
          resultsBox.style.display = 'block';
        } catch(e) {}
      }, 350);
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('#map-search-box') && !e.target.closest('#map-search-results')) resultsBox.style.display = 'none'; }, { once: false });
    window._mbSelectPlace = (lng, lat, name) => {
      _pickerMap.flyTo({ center: [lng, lat], zoom: 15, speed: 1.4 });
      _pickerMarker.setLngLat([lng, lat]);
      updateCoords(lng, lat);
      searchInput.value = name;
      resultsBox.style.display = 'none';
    };
  }, 200);
};

window.saveServiceLocation = function() {
  const lat = document.getElementById('map-lat-input').value;
  const lng = document.getElementById('map-lng-input').value;
  if (ph_popModalState()) {
    document.getElementById('svc-lat').value = lat;
    document.getElementById('svc-lng').value = lng;
    document.getElementById('svc-loc-hint').textContent = '✅ تم تحديد الموقع';
  }
};

window.ph46_showAdminAddSvcModal = function(targetCatId = null, targetSection = 'bookings') {
  const sectionId = (targetSection === 'professions' || targetSection === 'services') ? 'professions' : 'bookings';
  const activeItems = (AppData.catalogItems || []).filter(item => item.status === 'active' && item.sectionId === sectionId);
  const providers = (AppData.users || []).filter(u => ['vendor', 'provider'].includes(u.role));
  const localCats = (AppData.cats || []).filter(c => c.section === 'bookings' ? c.catType !== 'rental' : (c.section === 'professions' || c.section === 'services'));

  let selectedCatId = targetCatId || (localCats[0]?.id || '');

  const modalHtml = `
    <div class="modal-header">
      <h2 class="modal-title">🔗 ربط وإضافة خدمات من الكتالوج الموحد</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="ph46-modal-body-scroll" style="max-height: 75vh; overflow-y: auto; padding: 12px; direction: rtl; text-align: right; color: #ffffff;">
      
      <!-- اختيار القسم المحلي — يُخفى عند الدخول من داخل تصنيف محدد -->
      ${targetCatId ? (() => {
        const cat = localCats.find(c => c.id === targetCatId);
        return cat ? `
        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 700;">📂 التصنيف المستهدف</label>
          <div style="
            background: rgba(139,92,246,0.08);
            border: 1px solid rgba(139,92,246,0.3);
            border-radius: 10px;
            padding: 10px 14px;
            font-weight: 700;
            font-size: 14px;
            color: var(--primary);
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            <span style="font-size:18px;">${cat.icon || '📁'}</span>
            <span>${cat.name}</span>
          </div>
        </div>` : '';
      })() : `
      <div class="form-group" style="margin-bottom: 16px;">
        <label class="form-label" style="font-weight: 700;">📂 اختر فئة الحجز المحلية المستهدفة *</label>
        <select class="form-control" id="ph46-local-cat-select" onchange="window.__ph46_selectedLocalCatId = this.value;">
          <option value="">-- اختر الفئة المحلية --</option>
          ${localCats.map(c => `<option value="${c.id}" ${c.id === selectedCatId ? 'selected' : ''}>${c.icon || ''} ${c.name} (${c.section === 'bookings' ? 'حجوزات' : 'مهن/خدمات'})</option>`).join('')}
        </select>
      </div>`}

      <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 16px; margin-top: 16px;">
        <!-- العمود الأيسر: قائمة الخدمات والمنتجات في الكتالوج -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 12px; padding: 16px;">
          <h4 style="margin-top:0; margin-bottom:12px; color:var(--primary); font-size:14px; border-bottom:1px solid var(--border, rgba(255,255,255,0.08)); padding-bottom:6px;">📋 1. اختر الخدمات/المنتجات من الكتالوج (يمكن اختيار متعدد)</h4>
          
          <div class="search-input-wrap" style="margin-bottom:12px;">
            <input type="text" class="form-control" placeholder="🔍 بحث بالاسم..." oninput="window.ph46_filterCatalogList(this.value)">
          </div>

          <div id="ph46-catalog-items-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 8px; padding: 8px; display:flex; flex-direction:column; gap:8px;">
            ${activeItems.length === 0 ? `
              <div style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد خدمات نشطة في الكتالوج لهذا القسم</div>
            ` : activeItems.map(item => `
              <label class="ph46-catalog-item-row" data-name="${item.name.toLowerCase()}" style="display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; background:rgba(255,255,255,0.01); border:1px solid transparent; transition:all 0.2s; cursor:pointer;">
                <input type="checkbox" class="ph46-catalog-cb" value="${item.id}" style="width:18px; height:18px;">
                ${item.mainImage ? `<img src="${item.mainImage}" style="width:36px; height:36px; border-radius:6px; object-fit:cover;">` : `<div style="width:36px; height:36px; border-radius:6px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center;">🔷</div>`}
                <div style="flex:1;">
                  <div style="font-weight:700; font-size:13px;">${item.name}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${item.price ? item.price + ' ريال' : 'حسب الاتفاق'}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- العمود الأيمن: قائمة مزودي الخدمة المتاحين للربط -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 12px; padding: 16px;">
          <h4 style="margin-top:0; margin-bottom:12px; color:var(--primary); font-size:14px; border-bottom:1px solid var(--border, rgba(255,255,255,0.08)); padding-bottom:6px;">👤 2. اختر مزودي الخدمة</h4>
          
          <div id="ph46-providers-list" style="max-height: 350px; overflow-y: auto; border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 8px; padding: 8px; display:flex; flex-direction:column; gap:8px;">
            ${providers.length === 0 ? `
              <div style="text-align:center; padding:20px; color:var(--text-muted);">لا يوجد مزودو خدمة مسجلون</div>
            ` : providers.map(p => `
              <label style="display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; background:rgba(255,255,255,0.01); cursor:pointer;">
                <input type="checkbox" class="ph46-provider-cb" value="${p.uid}" data-name="${p.name}" style="width:18px; height:18px;">
                <div style="flex:1;">
                  <div style="font-weight:700; font-size:13px;">${p.name}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${p.phone || ''}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- قسم الخصومات والعروض -->
      <div style="margin-top:20px; background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.2); border-radius:14px; padding:16px;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
          <span style="font-size:20px;">🏷️</span>
          <div>
            <div style="font-weight:700; font-size:14px;">إضافة خصم/عرض</div>
            <div style="font-size:12px; color:var(--text-muted);">يمكنك ربط عرض خصم بالخدمات المستوردة تلقائياً</div>
          </div>
          <label class="toggle-switch" style="margin-right:auto;">
            <input type="checkbox" id="ph46-local-add-to-offers" onchange="window.ph46_toggleLocalOfferFields(this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div id="ph46-local-offer-fields" style="display:none; margin-top:8px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">نسبة الخصم (%)</label>
              <input class="form-control" id="ph46-local-offer-pct" type="number" min="1" max="99" placeholder="مثال: 20">
            </div>
            <div class="form-group">
              <label class="form-label">تاريخ الانتهاء (فارغ = دائم)</label>
              <input class="form-control" id="ph46-local-offer-expires" type="date">
            </div>
          </div>
          <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:10px; padding:10px 14px; font-size:12px; color:#10b981;">
            💡 سيُطبَّق نفس الخصم على جميع الخدمات المحددة
          </div>
        </div>
      </div>

      <!-- التنبيهات وحالة التوفر -->
      ${typeof ph48_adminSectionHtml === 'function' ? `
      <div style="margin-top:20px;">
        ${ph48_adminSectionHtml(null)}
      </div>` : ''}

      <div style="margin-top:20px; display:flex; justify-content:flex-end; gap:10px;">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="window.ph46_saveAdminLocalSvcs()">💾 حفظ وربط الخدمات</button>
      </div>
    </div>
  `;

  openModal(modalHtml);
  window.__ph46_selectedLocalCatId = selectedCatId;
};

window.ph46_toggleLocalOfferFields = function(show) {
  const el = document.getElementById('ph46-local-offer-fields');
  if (el) el.style.display = show ? 'block' : 'none';
};

window.ph46_filterCatalogList = function(q) {
  const lowercase = q.toLowerCase().trim();
  const rows = document.querySelectorAll('.ph46-catalog-item-row');
  rows.forEach(r => {
    const name = r.getAttribute('data-name') || '';
    r.style.display = name.includes(lowercase) ? 'flex' : 'none';
  });
};

window.ph46_saveAdminLocalSvcs = async function() {
  const catId = window.__ph46_selectedLocalCatId;
  if (!catId) { toast('يرجى تحديد الفئة المحلية المستهدفة', 'error'); return; }

  const checkedItems = Array.from(document.querySelectorAll('.ph46-catalog-cb:checked')).map(cb => cb.value);
  const checkedProviders = Array.from(document.querySelectorAll('.ph46-provider-cb:checked')).map(cb => ({
    uid: cb.value,
    name: cb.getAttribute('data-name')
  }));

  if (checkedItems.length === 0) { toast('يرجى اختيار خدمة واحدة على الأقل من الكتالوج', 'warning'); return; }
  if (checkedProviders.length === 0) { toast('يرجى اختيار مزود خدمة واحد على الأقل', 'warning'); return; }

  showLoader();
  try {
    // ── قراءة بيانات التوفر والتنبيه من النموذج ──────────────────────
    let formStockStatus = 'available', formAlertBadge = null;
    if (typeof ph48_collectAlertData === 'function') {
      const alertData = ph48_collectAlertData();
      formStockStatus = alertData.stockStatus || 'available';
      formAlertBadge  = alertData.alertBadge  || null;
    }

    // ── قراءة بيانات العرض/الخصم ───────────────────────────────────
    const addToOffers  = document.getElementById('ph46-local-add-to-offers')?.checked;
    const offerPct     = parseFloat(document.getElementById('ph46-local-offer-pct')?.value) || 0;
    const offerExpires = document.getElementById('ph46-local-offer-expires')?.value || '';

    let addCount = 0;
    for (const itemId of checkedItems) {
      const item = (AppData.catalogItems || []).find(i => i.id === itemId);
      if (!item) continue;

      for (const provider of checkedProviders) {
        const svcData = {
          catId: catId,
          name: item.name,
          desc: item.desc || '',
          price: item.priceType === 'agreement' ? 0 : (item.price || 0),
          commission: item.commission || 0,
          tax: item.tax || 0,
          requiresDelivery: item.requiresDriver || false,
          providerUid: provider.uid,
          providerName: provider.name,
          images: item.images || [],
          icon: item.mainImage || '🔷',
          status: 'active',
          sku: item.sku || null,
          stockStatus: formStockStatus,
          alertBadge: formAlertBadge,
          commonIssues: typeof item.commonProblems === 'string' ? item.commonProblems.split('\n').filter(l => l.trim()) : (item.commonProblems || []),
          createdAt: new Date()
        };

        const svcId = await fsAdd('services', svcData);
        addCount++;

        // إضافة للعروض إن طُلب ذلك
        if (addToOffers && offerPct > 0 && item.price > 0 && typeof ph_saveOfferFromSource === 'function') {
          await ph_saveOfferFromSource({
            title: item.name,
            desc: item.desc || '',
            sourceType: 'service',
            sourceId: svcId,
            sourceSection: 'bookings',
            originalPrice: item.price,
            discountPercent: offerPct,
            imageBase64: item.mainImage || null,
            expiresStr: offerExpires
          });
        }
      }
    }

    if (typeof ph46_reloadData === 'function') await ph46_reloadData();
    closeModal();
    const addedToOffers = addToOffers && offerPct > 0;
    toast(`تمت إضافة وربط ${addCount} خدمة بنجاح 🎉${addedToOffers ? ' وتمت إضافتها للعروض 🏷️' : ''}`, 'success');
    await render();
  } catch(e) {
    toast('حدث خطأ أثناء الحفظ: ' + e.message, 'error');
  } finally {
    hideLoader();
  }
};

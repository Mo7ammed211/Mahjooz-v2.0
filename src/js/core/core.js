// ═══════════════════════════════════════════════════
//  محجوز v2.0 — Core: State, Firebase, Utils, Auth
// ═══════════════════════════════════════════════════
'use strict';

window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global Error:", { message, source, lineno, error });
  if (typeof toast === 'function') {
    toast('حدث خطأ غير متوقع. جاري العمل على حله.', 'error');
  }
  return true; 
};
window.t = window.t || ((k) => k);

let _secondaryAuth = null;
function getSecondaryAuth() {
  if (_secondaryAuth) return _secondaryAuth;
  try {
    const cfg = firebase.app().options;
    // Use a stable name to avoid multiple app initialization errors
    const sec = firebase.apps.find(a => a.name === 'secondary-auth') || firebase.initializeApp(cfg, 'secondary-auth');
    _secondaryAuth = sec.auth();
  } catch (e) { console.warn('Secondary auth init failed:', e); }
  return _secondaryAuth;
}

// ─── State ────────────────────────────────────────
const State = {
  currentUser: null,
  currentPage: 'loading',
  params: {},
  adminTab:  'dashboard',
  staffTab:  'services',
  vendorTab: 'orders',
  driverTab: 'orders',
  tempUserData: null,
  awaitingOTP: false,
  adminSearch: '',
};

window.AppData = {
  cats:[], cities:[], services:[], orders:[],
  users:[], ads:[], ratings:[],
  rechargeReqs:[], withdrawReqs:[], transactions:[],
  stores:[], storeCats:[], storeProducts:[],
  rentalStores:[], rentalSubCats:[], rentalProducts:[],
  catalogCats:[], catalogItems:[],           // Phase 46 — قاعدة المنتجات والخدمات الموحدة
};
const AppData = window.AppData;

// ─── Firebase Helpers ─────────────────────────────
async function fsGetAll(col) {
  const s = await db.collection(col).get();
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function fsGet(col, id) {
  const d = await db.collection(col).doc(id).get();
  return d.exists ? { id: d.id, ...d.data() } : null;
}
async function fsAdd(col, data) {
  const r = await db.collection(col).add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  window._forceDataReload = true;
  return r.id;
}
async function fsSet(col, id, data) {
  await db.collection(col).doc(id).set({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  window._forceDataReload = true;
}
async function fsUpdate(col, id, data) {
  await db.collection(col).doc(id).update({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  window._forceDataReload = true;
}
async function fsDelete(col, id) {
  await db.collection(col).doc(id).delete();
  window._forceDataReload = true;
}
async function fsQuery(col, field, op, val) {
  const s = await db.collection(col).where(field, op, val).get();
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Order ID ─────────────────────────────────────
async function generateOrderId() {
  let n;
  await db.runTransaction(async t => {
    const ref = db.collection('counters').doc('orders');
    const doc = await t.get(ref);
    n = (doc.exists ? (doc.data().count || 0) : 0) + 1;
    t.set(ref, { count: n });
  });
  return `MJZ-${new Date().getFullYear()}-${String(n).padStart(6,'0')}`;
}

// ─── Wallet ───────────────────────────────────────
async function ensureWallet(uid) {
  const w = await fsGet('wallets', uid);
  if (!w) await db.collection('wallets').doc(uid).set({ balance: 0, uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
}
async function getBalance(uid) {
  const w = await fsGet('wallets', uid);
  return w?.balance || 0;
}
async function creditWallet(uid, amount, note, orderId = null) {
  await db.runTransaction(async t => {
    const ref = db.collection('wallets').doc(uid);
    const doc = await t.get(ref);
    const cur = doc.exists ? (doc.data().balance || 0) : 0;
    t.set(ref, { balance: cur + amount, uid });
  });
  await fsAdd('transactions', { uid, type: 'credit', amount, note, orderId });
}
async function deductWallet(uid, amount, note, orderId = null) {
  let ok = false;
  await db.runTransaction(async t => {
    const ref = db.collection('wallets').doc(uid);
    const doc = await t.get(ref);
    const cur = doc.exists ? (doc.data().balance || 0) : 0;
    if (cur < amount) throw new Error('رصيد غير كافٍ');
    t.set(ref, { balance: cur - amount, uid });
    ok = true;
  });
  if (ok) await fsAdd('transactions', { uid, type: 'debit', amount, note, orderId });
  return ok;
}

// ─── Utilities ────────────────────────────────────
function showLoader(msg = 'جاري التحميل...') {
  let loader = document.getElementById('global-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.className = 'premium-loader';
    loader.innerHTML = `
      <div class="loader-spinner"></div>
      <div class="loader-text"></div>
    `;
    document.body.appendChild(loader);
  }
  const textEl = loader.querySelector('.loader-text');
  if (textEl) textEl.innerText = msg;
  loader.classList.remove('hidden');
}

function hideLoader() {
  const loader = document.getElementById('global-loader');
  if (loader) loader.classList.add('hidden');
}
function toast(msg, type = 'info') {
  const icons = { info:'ℹ️', success:'✅', error:'❌', warning:'⚠️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.style.opacity = 0, 3000);
  setTimeout(() => el.remove(), 3400);
}
let _closeModalTimeout = null;
function openModal(html) {
  if (_closeModalTimeout) {
    clearTimeout(_closeModalTimeout);
    _closeModalTimeout = null;
  }
  const modalContainer = document.getElementById('modal-body');
  modalContainer.innerHTML = html;
  
  // التغليف التلقائي لمحتويات المودال لضمان التناسق وعدم التداخل
  const header = modalContainer.querySelector('.modal-header');
  if (header) {
    const siblings = [];
    let next = header.nextSibling;
    while (next) {
      siblings.push(next);
      next = next.nextSibling;
    }
    const elementSiblings = siblings.filter(n => n.nodeType === 1);
    if (elementSiblings.length > 1 || (elementSiblings.length === 1 && elementSiblings[0].tagName !== 'DIV' && elementSiblings[0].tagName !== 'FORM')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'modal-content-body';
      siblings.forEach(node => wrapper.appendChild(node));
      modalContainer.appendChild(wrapper);
    } else if (elementSiblings.length === 1) {
      if (!elementSiblings[0].classList.contains('modal-content-body') && !elementSiblings[0].style.padding) {
        elementSiblings[0].classList.add('modal-content-body');
      }
    }
  } else {
    const children = Array.from(modalContainer.childNodes);
    const elementChildren = children.filter(n => n.nodeType === 1);
    if (elementChildren.length > 1 || (elementChildren.length === 1 && elementChildren[0].tagName !== 'DIV' && elementChildren[0].tagName !== 'FORM')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'modal-content-body';
      children.forEach(node => wrapper.appendChild(node));
      modalContainer.appendChild(wrapper);
    } else if (elementChildren.length === 1) {
      if (!elementChildren[0].classList.contains('modal-content-body') && !elementChildren[0].style.padding) {
        elementChildren[0].classList.add('modal-content-body');
      }
    }
  }

  document.getElementById('modal-overlay').classList.add('open');
  if (!window.history.state || !window.history.state._modalOpen) {
    window.history.pushState({ _modalOpen: true }, '');
  }
}
window.openModal = openModal;

function closeModal(fromPopstate = false) {
  const modal = document.getElementById('modal-overlay');
  if (!modal) return;
  const isOpen = modal.classList.contains('open');
  modal.classList.remove('open');
  
  if (_closeModalTimeout) {
    clearTimeout(_closeModalTimeout);
    _closeModalTimeout = null;
  }
  
  if (isOpen && !fromPopstate && window.history.state && window.history.state._modalOpen) {
    _closeModalTimeout = setTimeout(() => {
      const isStillOpen = document.getElementById('modal-overlay')?.classList.contains('open');
      if (!isStillOpen && window.history.state && window.history.state._modalOpen) {
        window.history.back();
      }
    }, 80);
  }
}
window.closeModal = closeModal;
function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ar-YE');
}
function fmtDateTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ar-YE');
}
function stars(n) {
  return '⭐'.repeat(n) + '☆'.repeat(5 - n);
}

// ─── Theme ────────────────────────────────────────
let isDarkMode = localStorage.getItem('mahjooz_theme') !== 'light';
if (!isDarkMode) document.body.classList.add('light-theme');

// Update theme toggle state everywhere
function _updateThemeBtn() {
  const cb   = document.getElementById('theme-menu-cb');
  const icon = document.getElementById('theme-menu-icon');
  const lbl  = document.getElementById('theme-menu-label');
  if (cb)   cb.checked       = isDarkMode;
  if (icon) icon.textContent = isDarkMode ? '☀️' : '🌙';
  if (lbl)  lbl.textContent  = isDarkMode ? 'وضع الإضاءة' : 'الوضع الداكن';
}
_updateThemeBtn();

function toggleTheme(event) {
  const ripple = document.getElementById('theme-ripple');
  if (ripple) {
    const goingLight = isDarkMode;
    ripple.style.setProperty('--ripple-color', goingLight ? '#fbfbfe' : '#0f0c20');

    // Use event target position, or default to top corner
    let rx = '90%', ry = '10%';
    if (event && event.target) {
      try {
        const r = (event.target.closest('label,button') || event.target).getBoundingClientRect();
        rx = Math.round(r.left + r.width  / 2) + 'px';
        ry = Math.round(r.top  + r.height / 2) + 'px';
      } catch(e) {}
    }
    ripple.style.setProperty('--rx', rx);
    ripple.style.setProperty('--ry', ry);
    ripple.classList.add('expanding');

    setTimeout(() => {
      isDarkMode = !isDarkMode;
      localStorage.setItem('mahjooz_theme', isDarkMode ? 'dark' : 'light');
      document.body.classList.toggle('light-theme', !isDarkMode);
      _updateThemeBtn();
      setTimeout(() => {
        ripple.classList.remove('expanding');
        ripple.addEventListener('transitionend', () => {
          ripple.style.setProperty('--ripple-color', '');
        }, { once: true });
      }, 50);
    }, 310);

  } else {
    isDarkMode = !isDarkMode;
    localStorage.setItem('mahjooz_theme', isDarkMode ? 'dark' : 'light');
    document.body.classList.toggle('light-theme', !isDarkMode);
    _updateThemeBtn();
  }
}

// ─── Demo Accounts ────────────────────────────────
const DEMO = [
  { email:'admin@mahjooz.app',    pass:'123456',    name:'نايف (المدير العام)',           role:'admin'    },
  { email:'staff@mahjooz.app',    pass:'staff123',    name:'سعد (الموظف)',      role:'staff'    },
  { email:'vendor-service@mahjooz.app', pass:'vendor123', name:'خالد (مزود الخدمات)', role:'vendor', vendorType:'services' },
  { email:'vendor-store@mahjooz.app',   pass:'vendor123', name:'أحمد (مزود المتاجر)', role:'vendor', vendorType:'store' },
  { email:'driver@mahjooz.app',   pass:'driver123',   name:'ياسر (المندوب)',    role:'driver'   },
  { email:'customer@mahjooz.app', pass:'customer123', name:'فيصل (العميل)',            role:'customer' },
  { email:'provider-demo@mahjooz.app', pass:'provider123', name:'سلمان (صاحب المهنة)', role:'provider' },
];
async function ensureDemoAccounts() {
  // Use secondary auth instance so we never sign out the current user
  const sa = typeof getSecondaryAuth === 'function' ? getSecondaryAuth() : auth;
  const sdb = sa !== auth ? firebase.app('secondary-auth').firestore() : db;
  for (const a of DEMO) {
      let createdUid = null;
      try {
        const cred = sa !== auth
          ? await sa.createUserWithEmailAndPassword(a.email, a.pass)
          : await auth.createUserWithEmailAndPassword(a.email, a.pass);
        createdUid = cred.user.uid;
      } catch(createErr) {
        if (createErr.code !== 'auth/email-already-in-use') {
          console.warn('ensureDemoAccounts Create Error:', a.email, createErr.message);
          alert("فشل إنشاء الحساب التجريبي (" + a.email + "): " + createErr.message);
        }
      }
      
      if (createdUid) {
        try {
          await sdb.collection('users').doc(createdUid).set({
            name: a.name,
            email: a.email,
            role: a.role,
            phone: '',
            firstLogin: a.role === 'vendor',
            vendorType: a.vendorType || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await sdb.collection('wallets').doc(createdUid).set({
            balance: 0,
            uid: createdUid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch(writeErr) {
          console.error('ensureDemoAccounts Firestore write error for:', a.email, writeErr);
        }
        if (sa !== auth) await sa.signOut().catch(()=>{});
        else await auth.signOut().catch(()=>{});
      }
  }
}

async function refreshWalletBalanceUI() {
  if (State.currentUser && State.currentUser.role === 'customer') {
    try {
      State.walletBalance = await getBalance(State.currentUser.uid);
      document.querySelectorAll('.nav-wallet-balance-disp').forEach(el => {
        el.innerHTML = `${(State.walletBalance||0).toLocaleString('ar-YE')} <span style="font-size:12px; font-weight:600; color: rgba(255,255,255,0.9);">ريال</span>`;
      });
    } catch(e) {}
  }
}

async function loadAllData() {
  try {
    // ─── Auto Migration for Legacy Categories in Firestore ───
    try {
      const catsBookingsRaw = await fsGetAll('categories').catch(()=>[]);
      const toMigrate = catsBookingsRaw.filter(c => c.section === 'professions' || c.section === 'services');
      if (toMigrate.length > 0) {
        console.log(`[Migration] Moving ${toMigrate.length} categories to professions_categories...`);
        for (const cat of toMigrate) {
          const catId = cat.id;
          const data = { ...cat };
          delete data.id;
          await db.collection('professions_categories').doc(catId).set(data);
          await db.collection('categories').doc(catId).delete();
          console.log(`[Migration] Moved category: ${cat.name} (${catId})`);
        }
      }
    } catch(err) {
      console.error('[Migration] Category migration failed:', err);
    }

    const [catsBookings,catsProfs,cities,services,orders,users,ads,ratings,rr,wr,tr, dictionarySnap, banners, pages, stores, storeCats, storeProducts, svcSections, deliveryZones, deliveryRoutes, rentalStores, rentalSubCats, rentalProducts, catalogCats, catalogItems, providerGroups, pdbCats, pdbSubcats, pdbEntries, ddbCats, ddbSubcats, ddbEntries] = await Promise.all([
      fsGetAll('categories').catch(()=>[]),
      fsGetAll('professions_categories').catch(()=>[]),
      fsGetAll('cities').catch(()=>[]), fsGetAll('services').catch(()=>[]),
      fsGetAll('orders').catch(()=>[]), fsGetAll('users').catch(()=>[]), fsGetAll('ads').catch(()=>[]),
      fsGetAll('ratings').catch(()=>[]), fsGetAll('recharge_requests').catch(()=>[]),
      fsGetAll('withdrawal_requests').catch(()=>[]), fsGetAll('transactions').catch(()=>[]),
      db.doc('settings/dictionary').get().catch(()=>null), fsGetAll('banners').catch(()=>[]), fsGetAll('pages').catch(()=>[]),
      fsGetAll('stores').catch(()=>[]), fsGetAll('store_cats').catch(()=>[]), fsGetAll('store_products').catch(()=>[]),
      fsGetAll('service_sections').catch(()=>[]),
      fsGetAll('delivery_zones').catch(()=>[]),
      fsGetAll('delivery_routes').catch(()=>[]),
      fsGetAll('rentalStores').catch(()=>[]),
      fsGetAll('rentalSubCats').catch(()=>[]),
      fsGetAll('rentalProducts').catch(()=>[]),
      fsGetAll('catalog_cats').catch(()=>[]),
      fsGetAll('product_catalog').catch(()=>[]),
      fsGetAll('provider_groups').catch(()=>[]),
      fsGetAll('pdb_cats').catch(()=>[]),
      fsGetAll('pdb_subcats').catch(()=>[]),
      fsGetAll('pdb_entries').catch(()=>[]),
      fsGetAll('ddb_cats').catch(()=>[]),
      fsGetAll('ddb_subcats').catch(()=>[]),
      fsGetAll('ddb_entries').catch(()=>[]),
    ]);
    const deliveryGovernorates = await fsGetAll('delivery_governorates').catch(()=>[]);
    const cats = [
      ...catsBookings.map(c => ({ ...c, section: 'bookings' })),
      ...catsProfs.map(c => ({ ...c, section: c.section === 'bookings' ? 'professions' : (c.section || 'professions') }))
    ];
    const dictionary = dictionarySnap && dictionarySnap.exists ? dictionarySnap.data() : { ar: {}, en: {} };
    Object.assign(AppData, { cats, cities, services, orders, users, ads, ratings,
      rechargeReqs: rr, withdrawReqs: wr, transactions: tr, dictionary, banners, pages,
      stores, storeCats, storeProducts, svcSections, deliveryGovernorates, deliveryZones, deliveryRoutes,
      regions: deliveryZones,
      rentalStores, rentalSubCats, rentalProducts, catalogCats, catalogItems,
      providerGroups: providerGroups.sort((a,b)=>(a.order||99)-(b.order||99)),
      pdbCats:    pdbCats.sort((a,b)=>(a.order||99)-(b.order||99)),
      pdbSubcats: pdbSubcats.sort((a,b)=>(a.order||99)-(b.order||99)),
      pdbEntries,
      ddbCats:    ddbCats.sort((a,b)=>(a.order||99)-(b.order||99)),
      ddbSubcats: ddbSubcats.sort((a,b)=>(a.order||99)-(b.order||99)),
      ddbEntries,
    });
    State._dataLoaded = true;
  } catch(e) {
    console.error('loadAllData core failed:', e);
  }
}

// ─── Navbar ───────────────────────────────────────
function _navItemsForRole(u) {
  if (u.role === 'customer' || u.role === 'guest') {
    const items = [{ page: 'home', icon: '🏠', label: 'الرئيسية' }];
    if (u.role === 'customer') {
      items.push({ page: 'myorders', icon: '📋', label: 'طلباتي' });
      const balStr = State.walletBalance !== undefined ? `${(State.walletBalance||0).toLocaleString('ar-YE')} <span style="font-size:12px; font-weight:600; color: rgba(255,255,255,0.9);">ريال</span>` : '...';
      const balPill = `<span class="nav-wallet-balance-disp" style="display:inline-flex; align-items:baseline; gap:4px; margin-inline-start:8px; font-weight:800; color:#ffffff; background:linear-gradient(135deg, #10b981, #059669); padding:4px 12px; border-radius:24px; font-size:15px; box-shadow:0 4px 12px rgba(16,185,129,0.3); border:1px solid rgba(255,255,255,0.2); transition:var(--transition); letter-spacing:0.5px;">${balStr}</span>`;
      items.push({ page: 'wallet',   icon: '💰', label: `محفظتي ${balPill}` });
      items.push({ page: 'support-chat', icon: '💬', label: 'الدعم' });
    }
    return items;
  }
  const map = {
    admin:  { page: 'admin',  icon: '⚙️', label: 'لوحة التحكم' },
    staff:  { page: 'staff',  icon: '🖥️', label: 'لوحة الموظف' },
    vendor: { page: 'vendor', icon: '🏪', label: 'لوحتي' },
    driver: { page: 'driver', icon: '🚗', label: 'طلباتي' },
    provider: { page: 'vendor', icon: '🏪', label: 'لوحتي' },
  };
  return map[u.role] ? [map[u.role]] : [];
}
function renderNavbar() {
  const u = State.currentUser; if (!u) return '';
  const rl = {admin:'مدير',staff:'موظف',vendor:'مزود خدمة',driver:'مندوب',customer:'عميل',guest:'زائر',provider:'مزود خدمة'};
  const rc = {admin:'badge-gold',staff:'badge-purple',vendor:'badge-teal',driver:'badge-rose',customer:'badge-purple',guest:'badge-teal',provider:'badge-purple'};
  const homePage = {admin:'admin',staff:'staff',vendor:'vendor',driver:'driver',customer:'home',guest:'home',provider:'provider'};
  const items = _navItemsForRole(u);
  const initial = (u.name || '?').trim().charAt(0).toUpperCase();
  const isActive = (p) => State.currentPage === p;

  // ── Desktop nav links (hidden via CSS for clean hamburger-only approach) ──
  const desktopLinks = items.map(it => `
    <button class="nav-link${isActive(it.page)?' active':''}" onclick="navigate('${it.page}')">
      <span class="nav-link-ic">${it.icon}</span><span>${it.label}</span>
    </button>`).join('');

  // ── Admin section tabs for the hamburger drawer ──
  const isAdminRole = u.role === 'admin';
  const adminTabs = isAdminRole ? (() => {
    const pendingSvcsCount = (AppData.services||[]).filter(s=>s.status==='pending_approval').length;
    const pendingOrdersCount = (AppData.orders||[]).filter(o=>o.status==='pending_admin' || o.status==='pending').length;
    const pendingUsersCount = (AppData.users||[]).filter(u=>u.status==='pending').length;

    const tabs = [
      { g:'الإحصائيات', items:[
        { k:'dashboard', l:'نظرة عامة' },
        { k:'reports', l:'التقارير المالية' },
        { k:'advance_stats', l:'التحليلات المتقدمة 📊' },
      ]},
      { g:'إدارة المستخدمين', items:[
        { k:'users', l:'كل المستخدمين' },
        { k:'users', l:`حسابات معلقة${pendingUsersCount?` <span class="badge badge-gold" style="font-size:10px;padding:2px 6px">${pendingUsersCount}</span>`:''}` },
        { k:'permissions', l:'الصلاحيات' },
      ]},
      { g:'العمليات والطلبات', items:[
        { k:'orders', l:`إدارة الطلبات${pendingOrdersCount?` <span class="badge badge-gold" style="font-size:10px;padding:2px 6px">${pendingOrdersCount}</span>`:''}` },
        { k:'live_tracking', l:'التتبع المباشر' },
        { k:'ads', l:'الكوبونات والعروض' },
      ]},
      { g:'الأنظمة المستقلة', items:[
        { k:'sys_bookings', l:'نظام الحجوزات' },
        { k:'sys_professions', l:'نظام المهن' },
        { k:'sys_stores', l:'نظام المتاجر' },
        { k:'sys_services', l:'خدمات أخرى' },
        { k:'sys_offers', l:'🏷️ العروض والخصومات' },
      ]},
      { g:'إدارة الموظفين', items:[
        { k:'permissions',       l:'🔑 الصلاحيات' },
        { k:'staff_performance', l:'📊 أداء الموظفين' },
      ]},
      { g:'إدارة المحتوى', items:[
        { k:'provider_svcs', l:`خدمات المزودين${pendingSvcsCount?` <span class="badge badge-gold" style="font-size:10px;padding:2px 6px">${pendingSvcsCount}</span>`:''}` },
      ]},
      { g:'الإدارة المالية', items:[
        { k:'wallet', l:'المحافظ الإلكترونية' },
        { k:'wallet', l:'طلبات الإيداع' },
        { k:'banks', l:'الحسابات البنكية' },
        { k:'banks', l:'طرق الدفع' },
      ]},
      { g:'التسويق والإشعارات', items:[
        { k:'ads', l:'الإعلانات' },
        { k:'cms_banners', l:'إدارة الرسائل' },
      ]},
      { g:'إعدادات النظام', items:[
        { k:'signup_settings', l:'حقول التسجيل' },
        { k:'login_settings', l:'إعدادات الدخول' },
        { k:'delivery_pricing', l:'أسعار التوصيل 🚚' },
        { k:'delivery_addresses', l:'قاعدة العناوين 🗺️' },
        { k:'cms_texts', l:'النصوص والأيقونات' },
        { k:'cms_pages', l:'الصفحات الثابتة' },
        { k:'ph17settings', l:'الإعدادات العامة' },
      ]},
      { g:'التوجيه المباشر', items:[
        { k:'direct_routing', l:'التوجيه المباشر 🚦' },
      ]},
    ];
    return tabs.map(group => `
      <div class="drawer-group">
        <div class="drawer-group-title">${group.g}</div>
        ${group.items.map(tab => `
          <button class="drawer-link${(State.adminTab||'dashboard')===tab.k?' active':''}"
            onclick="setAdminTab('${tab.k}');closeDrawer()">
            <span>${tab.l}</span>
          </button>`).join('')}
      </div>`).join('');
  })() : '';

  // ── Provider tabs in drawer ──
  const isProvider = u.role === 'provider';
  const providerTabs = isProvider ? (() => {
    const myOrders = (AppData.orders||[]).filter(o=>o.providerUid===u.uid&&o.status==='pending_provider').length;
    const tabs = [
      { page:'provider', ic:'💼', l:'لوحتي' },
    ];
    return tabs.map(it => `
      <button class="drawer-link${isActive(it.page)?' active':''}" onclick="navigate('${it.page}');closeDrawer()">
        <span>${it.l}${myOrders?` <span class="badge badge-gold" style="font-size:10px;padding:2px 6px">${myOrders}</span>`:''}</span>
      </button>`).join('');
  })() : '';

  // ── Regular nav links in drawer (for non-admin, non-provider) ──
  const staticPagesLinks = (AppData.pages || []).filter(p => p.active !== false).map(p => `
    <button class="drawer-link${isActive('page') && State.params?.id === p.id ? ' active':''}" onclick="navigate('page', {id: '${p.id}'});closeDrawer()">
      <span>${p.title}</span>
    </button>`).join('');

  const notifCenterLink = `
    <button class="drawer-link${isActive('notifications')?' active':''}" onclick="navigate('notifications');closeDrawer()">
      <span>🔔 مركز الإشعارات</span>
    </button>`;

  const drawerNavLinks = items.map(it => `
    <button class="drawer-link${isActive(it.page)?' active':''}" onclick="navigate('${it.page}');closeDrawer()">
      <span>${it.label}</span>
    </button>`).join('') + staticPagesLinks + notifCenterLink + `
    <button class="drawer-link${isActive('suggestions-complaints')?' active':''}" onclick="navigate('suggestions-complaints');closeDrawer()">
      <span>📝 الاقتراحات والشكاوى</span>
    </button>
    <button class="drawer-link${isActive('help-center')?' active':''}" onclick="navigate('help-center');closeDrawer()">
      <span>❓ مركز المساعدة</span>
    </button>`;

  const bottomNavHTML = `
  <div class="mobile-bottom-nav">
    <div class="bottom-nav-inner">
      <button class="bn-item ${isActive(homePage[u.role]) ? 'active' : ''}" onclick="navigate('${homePage[u.role]}')">
        <span class="bn-icon">🏠</span>
        <span class="bn-label">الرئيسية</span>
      </button>
      ${(u.role === 'customer' || u.role === 'guest') ? `
        <button class="bn-item" onclick="typeof ph8_openSearch === 'function' ? ph8_openSearch() : navigate('home')">
          <span class="bn-icon">🔍</span>
          <span class="bn-label">البحث</span>
        </button>
        <button class="bn-item ${isActive('offers') ? 'active' : ''}" onclick="navigate('offers')" style="${isActive('offers') ? '' : ''}">
          <span class="bn-icon">🏷️</span>
          <span class="bn-label" style="${isActive('offers') ? 'color:#ef4444' : ''}">العروض</span>
        </button>
      ` : ''}
      <button class="bn-item ${isActive('orders') || isActive('driver') || isActive('provider') || isActive('admin') || isActive('staff') ? 'active' : ''}" onclick="navigate('${u.role === 'driver' ? 'driver' : u.role === 'provider' ? 'provider' : u.role === 'admin' ? 'admin' : u.role === 'staff' ? 'staff' : 'orders'}')">
        <span class="bn-icon">📋</span>
        <span class="bn-label">${isAdminRole ? 'لوحتي' : u.role === 'staff' ? 'لوحتي' : 'طلباتي'}</span>
      </button>
      <button class="bn-item ${isActive('settings') ? 'active' : ''}" onclick="navigate('settings')">
        <span class="bn-icon">👤</span>
        <span class="bn-label">حسابي</span>
      </button>
    </div>
  </div>`;

  return `
  <nav id="navbar" class="navbar-modern">
    <div class="nav-left">
      ${(u.role === 'customer' || u.role === 'guest') ? `
      <button class="nav-hamburger" id="nav-hamburger" onclick="toggleDrawer()" aria-label="القائمة">
        <span></span><span></span><span></span>
      </button>
      ` : ['admin','vendor','provider','staff','driver'].includes(u.role) ? (() => {
        const _pOrd  = (AppData.orders||[]).filter(o=>o.status==='pending'||o.status==='pending_admin').length;
        const _pUsr  = (AppData.users||[]).filter(_u=>_u.status==='pending').length;
        const _pTot  = u.role === 'admin' ? (_pOrd + _pUsr) : _pOrd;
        return `
      <div class="admin-hbg-wrap" onclick="toggleAdminSidebar()">
        <button class="nav-hamburger" id="nav-admin-sidebar-btn" aria-label="القائمة الجانبية" tabindex="-1">
          <span></span><span></span><span></span>
        </button>
        <div class="admin-hbg-badges">
          ${u.role === 'admin' && _pOrd  > 0 ? `<span class="ahb-pill ahb-orders"  title="طلبات معلقة">${_pOrd}</span>`  : ''}
          ${u.role === 'admin' && _pUsr  > 0 ? `<span class="ahb-pill ahb-users"   title="حسابات معلقة">${_pUsr}</span>` : ''}
          ${u.role === 'admin' && _pTot  > 0 ? `<span class="ahb-pill ahb-total"   title="إجمالي معلق">${_pTot > 99 ? '99+' : _pTot}</span>` : ''}
        </div>
      </div>`;
      })() : ''}
      <div class="nav-brand" onclick="navigate('${homePage[u.role]}')">
        <span class="brand-mark">📅</span>
        <span class="brand-text">${typeof t==='function'?t('app_name'):'محجوز'}</span>
      </div>
    </div>

    <div class="nav-links nav-links-desktop">${desktopLinks}</div>

    <div class="nav-user">
      <div id="nav-live-alerts-target"></div>
      <div id="nav-notif-target"></div>
      <button id="pwa-nav-btn" onclick="pwaTriggerInstall && pwaTriggerInstall()" title="ثبّت التطبيق على جهازك">
        <span class="pwa-nav-icon">⬇️</span>
        <span class="pwa-nav-label">ثبّت</span>
      </button>
      <!-- Theme toggle removed as per request -->
      ${u.role === 'customer' ? `<button class="ph43-cart-nav-btn" onclick="typeof ph43_showCart==='function'&&ph43_showCart()" title="سلة التسوق"><span id="ph43-cart-badge"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg><span class="nav-desktop-only">السلة</span></button>` : ''}
      <div class="nav-profile">
        <button class="nav-profile-btn" onclick="toggleProfileMenu(event)">
          <div class="nav-avatar" title="${u.name||''}">${initial}</div>
          <div class="nav-profile-info">
            <div class="nav-profile-name">${u.name||'مستخدم'}</div>
            <span class="badge ${rc[u.role]}">${rl[u.role]}</span>
          </div>
          <span class="nav-profile-chev">▾</span>
        </button>
        <div class="nav-profile-menu" id="nav-profile-menu" onclick="event.stopPropagation()">
          <div class="profile-menu-header">
            <div class="nav-avatar nav-avatar-lg">${initial}</div>
            <div>
              <div class="profile-menu-name">${u.name||'مستخدم'}</div>
              <span class="badge ${rc[u.role]}">${rl[u.role]}</span>
            </div>
          </div>
          ${typeof languageToggleHTML==='function'?`<div style="padding:8px 12px">${languageToggleHTML()}</div>`:''}
          <button class="profile-menu-item" onclick="closeProfileMenu();navigate('settings')"><span>⚙️</span><span>الإعدادات</span></button>
          ${u.role === 'customer' ? `
          <div style="height:1px;background:var(--glass-border);margin:4px 0"></div>
          <button class="profile-menu-item" onclick="closeProfileMenu();typeof ph9_showRegionPicker==='function'&&ph9_showRegionPicker()"><span>🗺️</span><span>تغيير المنطقة</span></button>
          <button class="profile-menu-item" onclick="closeProfileMenu();typeof ph41_showAddressBook==='function'&&ph41_showAddressBook()"><span>📍</span><span>العناوين المحفوظة</span></button>
          <div style="height:1px;background:var(--glass-border);margin:4px 0"></div>
          ` : ''}
          <button class="profile-menu-item profile-menu-danger" onclick="closeProfileMenu();logoutConfirm()"><span>🚪</span><span>تسجيل الخروج</span></button>
          <div style="height:1px;background:var(--glass-border);margin:4px 0"></div>
          <div class="profile-menu-item profile-menu-theme-row" onclick="toggleTheme(event)">
            <span id="theme-menu-icon">${isDarkMode ? '☀️' : '🌙'}</span>
            <span id="theme-menu-label">${isDarkMode ? 'وضع الإضاءة' : 'الوضع الداكن'}</span>
            <label class="theme-menu-switch" onclick="event.stopPropagation()">
              <input type="checkbox" id="theme-menu-cb" ${isDarkMode ? 'checked' : ''} onchange="toggleTheme(event)">
              <span class="theme-menu-track"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </nav>

  ${(u.role === 'customer' || u.role === 'guest') ? `
  <!-- Mobile/Desktop Drawer + backdrop -->
  <div class="nav-drawer-backdrop" id="nav-drawer-backdrop" onclick="closeDrawer()"></div>
  <aside class="nav-drawer" id="nav-drawer" aria-hidden="true">
    <div class="drawer-header">
      <div class="drawer-user">
        <div class="nav-avatar nav-avatar-lg" style="background:linear-gradient(135deg,var(--primary),#a389f4)">${initial}</div>
        <div style="min-width:0;flex:1">
          <div class="drawer-user-name">${escHtml(u.name||'مستخدم')}</div>
          <span class="badge ${rc[u.role]}" style="font-size:10px">${rl[u.role]}</span>
          <div class="drawer-user-sub">
            ${u.phone    ? `<span>📞 <span style="direction:ltr;font-family:monospace">${escHtml(u.phone)}</span></span>` : ''}
            ${u.email    ? `<span>📧 <span style="direction:ltr;font-family:monospace;font-size:11px">${escHtml(u.email.length>22?u.email.substring(0,22)+'…':u.email)}</span></span>` : ''}
            ${u.regionId ? `<span>📍 ${escHtml((AppData.cities||[]).find(c=>c.id===u.regionId)?.name||u.regionId)}</span>` : ''}
          </div>
        </div>
      </div>
      <button class="drawer-close" onclick="closeDrawer()" aria-label="إغلاق">✕</button>
    </div>

    <div class="drawer-section">
      <div class="drawer-section-title">التنقل</div>
      <nav class="drawer-nav" style="padding:0">${drawerNavLinks}</nav>
    </div>
    <div class="drawer-divider"></div>

    <div class="drawer-section">
      <div class="drawer-section-title">الخيارات</div>
      <button class="drawer-tool" onclick="navigate('settings');closeDrawer()"><span>الإعدادات</span></button>
      <button class="drawer-tool drawer-tool-danger" onclick="closeDrawer();logoutConfirm()"><span>تسجيل الخروج</span></button>
      <div class="drawer-tool profile-menu-theme-row" style="cursor:pointer" onclick="toggleTheme(event)">
        <span>${isDarkMode ? '☀️' : '🌙'}</span>
        <span>${isDarkMode ? 'وضع الإضاءة' : 'الوضع الداكن'}</span>
        <label class="theme-menu-switch" onclick="event.stopPropagation()">
          <input type="checkbox" ${isDarkMode ? 'checked' : ''} onchange="toggleTheme(event)">
          <span class="theme-menu-track"></span>
        </label>
      </div>
    </div>
  </aside>` : ''}` + bottomNavHTML;
}

// ── نقل عناصر الدرج إلى <body> لتجاوز حدود الـ stacking context ──
function _teleportDrawers() {
  const u = typeof State !== 'undefined' && State.currentUser;
  const isCustomerOrGuest = !u || u.role === 'customer' || u.role === 'guest';
  const isAdminRole = u && (u.role === 'admin' || u.role === 'staff' || u.role === 'vendor' || u.role === 'driver' || u.role === 'cs');

  // ═══ خطوة 1: حذف كل الدرجين القديمة من body أولاً ═══
  // هذا يضمن عدم بقاء درج الدور القديم (مثلاً: درج العميل يبقى عند الانتقال للمدير)
  ['nav-drawer', 'nav-drawer-backdrop', 'adminSidebar', 'adminSidebarOverlay'].forEach(id => {
    // نحذف الفائضة (إذا كانت هناك نسخ متعددة)
    const allEls = document.querySelectorAll(`#${id}`);
    if (allEls.length > 1) {
      for (let i = 1; i < allEls.length; i++) allEls[i].remove();
    }
  });

  // ═══ خطوة 2: إزالة درج العميل من body إذا كان المستخدم في دور إداري ═══
  if (isAdminRole) {
    ['nav-drawer', 'nav-drawer-backdrop'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentElement === document.body) el.remove();
    });
  }

  // ═══ خطوة 3: إزالة درج المدير من body إذا كان المستخدم عميلاً/زائراً ═══
  if (isCustomerOrGuest) {
    ['adminSidebar', 'adminSidebarOverlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentElement === document.body) el.remove();
    });
  }

  // ═══ خطوة 4: نقل الدرج الصحيح للـ body ═══
  if (isCustomerOrGuest) {
    // درج العميل/الزائر
    ['nav-drawer', 'nav-drawer-backdrop'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentElement !== document.body) {
        document.body.appendChild(el);
      }
    });
  } else if (isAdminRole) {
    // درج المدير/المزود/المندوب/الموظف
    ['adminSidebar', 'adminSidebarOverlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentElement !== document.body) {
        document.body.appendChild(el);
      }
    });
  }
}
window._teleportDrawers = _teleportDrawers;

let _closeDrawerTimeout = null;
function toggleDrawer() {
  const d = document.getElementById('nav-drawer');
  const b = document.getElementById('nav-drawer-backdrop');
  const h = document.getElementById('nav-hamburger');
  if (!d) return;
  const open = !d.classList.contains('open');
  d.classList.toggle('open', open);
  b?.classList.toggle('open', open);
  h?.classList.toggle('open', open);
  d.setAttribute('aria-hidden', open ? 'false' : 'true');
  document.body.style.overflow = open ? 'hidden' : '';

  if (_closeDrawerTimeout) {
    clearTimeout(_closeDrawerTimeout);
    _closeDrawerTimeout = null;
  }

  if (open) {
    if (!window.history.state || !window.history.state._drawerOpen) {
      window.history.pushState({ _drawerOpen: true }, '');
    }
  } else {
    if (window.history.state && window.history.state._drawerOpen) {
      _closeDrawerTimeout = setTimeout(() => {
        const isStillOpen = document.getElementById('nav-drawer')?.classList.contains('open');
        if (!isStillOpen && window.history.state && window.history.state._drawerOpen) {
          window.history.back();
        }
      }, 80);
    }
  }
}
window.toggleDrawer = toggleDrawer;

function closeDrawer(fromPopstate = false) {
  const d = document.getElementById('nav-drawer');
  if (!d) return;
  const isOpen = d.classList.contains('open');
  d.classList.remove('open');
  document.getElementById('nav-drawer-backdrop')?.classList.remove('open');
  document.getElementById('nav-hamburger')?.classList.remove('open');
  d.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';

  if (_closeDrawerTimeout) {
    clearTimeout(_closeDrawerTimeout);
    _closeDrawerTimeout = null;
  }

  if (isOpen && !fromPopstate && window.history.state && window.history.state._drawerOpen) {
    _closeDrawerTimeout = setTimeout(() => {
      const isStillOpen = document.getElementById('nav-drawer')?.classList.contains('open');
      if (!isStillOpen && window.history.state && window.history.state._drawerOpen) {
        window.history.back();
      }
    }, 80);
  }
}
window.closeDrawer = closeDrawer;
function toggleProfileMenu(e) {
  e?.stopPropagation();
  const m = document.getElementById('nav-profile-menu');
  if (!m) return;
  const open = !m.classList.contains('open');
  
  if (open) {
    if (window.innerWidth <= 640) {
      if (m.parentElement !== document.body) {
        document.body.appendChild(m);
      }
      // Create backdrop for mobile centered layout
      let bg = document.getElementById('nav-profile-backdrop');
      if (!bg) {
        bg = document.createElement('div');
        bg.id = 'nav-profile-backdrop';
        bg.className = 'nav-profile-backdrop';
        bg.onclick = closeProfileMenu;
        document.body.appendChild(bg);
      }
      setTimeout(() => bg.classList.add('open'), 10);
    } else {
      const parent = document.querySelector('.nav-profile');
      if (parent && m.parentElement !== parent) {
        parent.appendChild(m);
      }
    }
  } else {
    const bg = document.getElementById('nav-profile-backdrop');
    if (bg) {
      bg.classList.remove('open');
      setTimeout(() => bg.remove(), 250);
    }
  }
  
  m.classList.toggle('open', open);
  const navProfile = document.querySelector('.nav-profile');
  if (navProfile) navProfile.classList.toggle('open', open);
  
  if (open) setTimeout(() => document.addEventListener('click', closeProfileMenu, { once: true }), 0);
}
function closeProfileMenu() {
  const m = document.getElementById('nav-profile-menu');
  if (!m) return;
  m.classList.remove('open');
  
  const bg = document.getElementById('nav-profile-backdrop');
  if (bg) {
    bg.classList.remove('open');
    setTimeout(() => bg.remove(), 250);
  }

  const navProfile = document.querySelector('.nav-profile');
  if (navProfile) {
    navProfile.classList.remove('open');
    if (m.parentElement === document.body) {
      navProfile.appendChild(m);
    }
  }
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeDrawer(); closeProfileMenu(); }
});
function renderFooter() {
  return `
    <footer style="padding: 24px 20px 16px; text-align: center; border-top: 1px solid var(--border); margin-top: 40px; display: flex; flex-direction: column; align-items: center; background: rgba(0,0,0,0.02);">
      <div style="font-size: 22px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', 'Tajawal', sans-serif; letter-spacing: -0.5px; margin-bottom: 0;">محجوز</div>
      <p style="color: var(--text-secondary); font-size: 13px; margin: 4px 0 16px;">منصة الحجوزات والخدمات الشاملة</p>
      
      <!-- Container for dynamic footer links (favorites-routing.js) -->
      <div id="footer" style="width: 100%; display: flex; justify-content: center; margin-bottom: 16px;"></div>
      
      <div style="width: 60%; height: 1px; background: var(--border); margin-bottom: 16px; opacity: 0.5;"></div>
      <p style="color: var(--text-muted); font-size: 13px; margin: 0; opacity: 0.8;">© ${new Date().getFullYear()} جميع الحقوق محفوظة لمحجوز</p>
    </footer>`;
}
function logoutConfirm() {
  const existing = document.getElementById('logout-confirm-overlay');
  if (existing) existing.remove();

  const isMobile = window.innerWidth <= 640;
  const overlay = document.createElement('div');
  overlay.id = 'logout-confirm-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    background:rgba(0,0,0,0.6);
    backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
    display:flex;
    align-items:${isMobile ? 'flex-end' : 'center'};
    justify-content:center;
    padding:${isMobile ? '0' : '20px'};
    opacity:0;transition:opacity 0.22s ease;
  `;
  overlay.innerHTML = `
    <div id="logout-confirm-card" style="
      background:var(--bg-card);
      border:1px solid rgba(139,92,246,0.15);
      border-radius:${isMobile ? '22px 22px 0 0' : '20px'};
      padding:${isMobile ? '20px 20px 32px' : '22px 20px 18px'};
      max-width:${isMobile ? '100%' : '300px'};
      width:${isMobile ? '100%' : 'calc(100% - 32px)'};
      box-shadow:0 -4px 40px rgba(0,0,0,0.4),0 0 0 1px rgba(139,92,246,0.1);
      text-align:center;
      transform:${isMobile ? 'translateY(24px)' : 'translateY(16px) scale(0.96)'};
      transition:transform 0.3s cubic-bezier(0.34,1.4,0.64,1),opacity 0.22s ease;
      opacity:0;
      position:relative;
    ">
      <button onclick="document.getElementById('logout-confirm-overlay').remove()" style="
        position:absolute;top:12px;inset-inline-end:12px;
        background:var(--bg-hover);border:none;
        width:26px;height:26px;border-radius:50%;
        color:var(--text-muted);font-size:12px;cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        transition:all 0.2s;line-height:1;
      " onmouseover="this.style.background='rgba(239,68,68,0.15)';this.style.color='#ef4444'"
         onmouseout="this.style.background='var(--bg-hover)';this.style.color='var(--text-muted)'">✕</button>

      <div style="
        width:52px;height:52px;border-radius:50%;margin:0 auto 12px;
        background:linear-gradient(135deg,rgba(239,68,68,0.14),rgba(239,68,68,0.04));
        border:1.5px solid rgba(239,68,68,0.22);
        display:flex;align-items:center;justify-content:center;
        font-size:24px;
        box-shadow:0 4px 14px rgba(239,68,68,0.15);
      ">🚪</div>

      <h2 style="margin:0 0 6px;font-size:16px;font-weight:800;color:var(--text-main)">تسجيل الخروج</h2>
      <p style="margin:0 0 18px;color:var(--text-muted);font-size:12.5px;line-height:1.55">
        هل أنت متأكد من رغبتك في الخروج؟
      </p>

      <div style="display:flex;gap:9px;flex-direction:row-reverse">
        <button onclick="doLogout()" style="
          flex:1;padding:10px 14px;border-radius:11px;border:none;cursor:pointer;
          background:linear-gradient(135deg,#ef4444,#dc2626);
          color:#fff;font-weight:700;font-size:13px;
          box-shadow:0 3px 12px rgba(239,68,68,0.28);
          transition:all 0.2s;font-family:inherit;letter-spacing:0.2px;
        " onmouseover="this.style.filter='brightness(1.1)';this.style.transform='translateY(-1px)'"
           onmouseout="this.style.filter='';this.style.transform=''">
          خروج
        </button>
        <button onclick="document.getElementById('logout-confirm-overlay').remove()" style="
          flex:1;padding:10px 14px;border-radius:11px;cursor:pointer;
          background:var(--bg-hover);border:1px solid var(--border);
          color:var(--text-main);font-weight:700;font-size:13px;
          transition:all 0.2s;font-family:inherit;
        " onmouseover="this.style.borderColor='rgba(139,92,246,0.5)'"
           onmouseout="this.style.borderColor='var(--border)'">
          إلغاء
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    const card = document.getElementById('logout-confirm-card');
    if (card) { card.style.transform = 'translateY(0) scale(1)'; card.style.opacity = '1'; }
  });
}
async function doLogout() {
  const confirmOverlay = document.getElementById('logout-confirm-overlay');
  if (confirmOverlay) confirmOverlay.remove();

  // ── تنظيف الدرج الجانبي بالقوة قبل الخروج ──
  // يمنع بقاء الدرج مفتوحاً عند الدخول بحساب مختلف
  try {
    const adminSidebar = document.getElementById('adminSidebar');
    const adminOverlay = document.getElementById('adminSidebarOverlay');
    if (adminSidebar) { adminSidebar.classList.remove('open'); adminSidebar.classList.remove('dragging'); }
    if (adminOverlay) adminOverlay.classList.remove('open');
    document.body.style.overflow = '';
  } catch(e) {}

  // ── إعادة تصفير حالة الدرج في State ──
  delete State._adminSidebarAutoOpened;
  delete State.adminTab;
  delete State.vendorTab;
  delete State.driverTab;
  delete State.staffTab;
  // إعادة ضبط علامات فحص اتفاقية الشركاء لضمان العرض للمستخدم القادم
  delete State._agreementChecked_vendor;
  delete State._agreementChecked_driver;

  closeModal();
  if (State.currentUser?.role !== 'guest') await auth.signOut();
  State.currentUser = null;
  toast('تم تسجيل الخروج','success');
  await navigate('login');
}

// ─── Dynamic CMS Utilities ────────────────────────
window.renderBanners = function(location) {
  if (!AppData.banners) return '';
  const activeBanners = AppData.banners.filter(b => b.location === location && b.active !== false);
  if (!activeBanners.length) return '';
  return activeBanners.map(b => {
    const colors = {
      info: 'background:rgba(59,130,246,0.1);border-color:rgba(59,130,246,0.3);color:var(--text)',
      warning: 'background:rgba(245,158,11,0.1);border-color:rgba(245,158,11,0.3);color:var(--text)',
      success: 'background:rgba(16,185,129,0.1);border-color:rgba(16,185,129,0.3);color:var(--text)',
      danger: 'background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.3);color:var(--text)'
    };
    const icons = { info: 'ℹ️', warning: '⚠️', success: '✅', danger: '❌' };
    const style = colors[b.type] || colors.info;
    const icon = icons[b.type] || icons.info;
    return `<div style="padding:12px 16px; margin-bottom:16px; border:1px solid; border-radius:12px; ${style}; display:flex; gap:12px; align-items:center;">
      <span style="font-size:20px">${icon}</span>
      <div style="flex:1;line-height:1.5">${b.content}</div>
    </div>`;
  }).join('');
};

function renderStaticPage() {
  const pageId = State.params.id;
  const page = (AppData.pages || []).find(p => p.id === pageId);
  if (!page) return `<div style="padding:60px;text-align:center">الصفحة غير موجودة</div>`;
  return `
    <div class="content-wrapper">
      <div class="card" style="padding:40px; border-radius:24px;">
        <h1 style="color:var(--primary);margin-bottom:24px;font-size:32px;">${page.title}</h1>
        <div style="line-height:1.8; color:var(--text-secondary); font-size:16px;">
          ${page.content}
        </div>
        <div style="margin-top:40px;text-align:center">
          <button class="btn btn-secondary" onclick="navigate('home')">العودة للرئيسية</button>
        </div>
      </div>
    </div>`;
}

// ─── Router ───────────────────────────────────────
let isNavigatingFromHistory = false;

window.addEventListener('popstate', async (event) => {
  // ── 1. اعتراض زر الرجوع لإغلاق درج الإدارة الجانبي إذا كان مفتوحاً ──
  //       نُغلق الدرج ونُعيد دفع الحالة الحالية حتى لا يُستهلك إدخال التاريخ
  const adminSidebar = document.getElementById('adminSidebar');
  if (adminSidebar && adminSidebar.classList.contains('open')) {
    if (typeof window.closeAdminSidebar === 'function') {
      window.closeAdminSidebar();
    } else {
      adminSidebar.classList.remove('open');
      document.getElementById('adminSidebarOverlay')?.classList.remove('open');
      document.body.style.overflow = '';
    }
    // أعِد دفع الحالة الحالية لإبقاء موضع التاريخ كما هو
    const currentTab = (typeof State !== 'undefined' ? State.adminTab : null) || 'hub_stats';
    const restoredUrl = new URL(window.location);
    restoredUrl.searchParams.set('page', 'admin');
    restoredUrl.searchParams.set('tab', currentTab);
    history.pushState({ page: 'admin', params: { tab: currentTab } }, '', restoredUrl);
    return;
  }

  // ── 2. اعتراض حدث الرجوع لإغلاق النافذة المنبثقة العامة (Modal Overlay) إذا كانت مفتوحة ──
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay && modalOverlay.classList.contains('open')) {
    if (typeof closeModal === 'function') {
      closeModal(true);
    } else {
      modalOverlay.classList.remove('open');
    }
    return;
  }

  // ── 3. اعتراض حدث الرجوع لإغلاق درج التنقل الجانبي (Nav Drawer) إذا كان مفتوحاً ──
  const navDrawer = document.getElementById('nav-drawer');
  if (navDrawer && navDrawer.classList.contains('open')) {
    if (typeof closeDrawer === 'function') {
      closeDrawer(true);
    } else {
      navDrawer.classList.remove('open');
      document.getElementById('nav-drawer-backdrop')?.classList.remove('open');
      document.getElementById('nav-hamburger')?.classList.remove('open');
    }
    return;
  }

  // ── 4. التنقل العادي بين الصفحات (مع تجنب إعادة الرندرة لنفس الصفحة الحالية) ──
  if (event.state && event.state.page) {
    const isSamePage = event.state.page === State.currentPage &&
      JSON.stringify(event.state.params || {}) === JSON.stringify(State.params || {});
    if (isSamePage) {
      return;
    }
    isNavigatingFromHistory = true;
    await navigate(event.state.page, event.state.params || {});
    isNavigatingFromHistory = false;
  }
});

// ── دالة الرجوع العالمية (زر الهاتف + الأزرار اليدوية) ──
window.goBack = function(fallback) {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    navigate(fallback || 'home');
  }
};

async function navigate(page, params = {}, replace = false) {
  State.currentPage = page; State.params = params; 
  if (page !== 'admin') {
    delete State._adminSidebarAutoOpened;
  } else {
    if (params.tab) {
      State.adminTab = params.tab;
    } else {
      params.tab = State.adminTab || 'hub_stats';
    }
  }
  if (page === 'vendor' && params.tab) State.vendorTab = params.tab;
  if (page === 'driver' && params.tab) State.driverTab = params.tab;
  
  if (!isNavigatingFromHistory) {
    const url = new URL(window.location);
    url.searchParams.set('page', page);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    // Remove old params that are not in the new params object
    const keys = Array.from(url.searchParams.keys());
    for (const k of keys) {
      if (k !== 'page' && !(k in params)) url.searchParams.delete(k);
    }
    
    // First time we navigate, we replace state if history length is 1 or if requested
    if (replace || !window.history.state) {
      window.history.replaceState({ page, params }, '', url);
    } else {
      window.history.pushState({ page, params }, '', url);
    }
  }
  
  await render();
}
async function render() {
  const activeElId = document.activeElement ? document.activeElement.id : null;
  let selStart = null, selEnd = null;
  if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
    try { selStart = document.activeElement.selectionStart; selEnd = document.activeElement.selectionEnd; } catch(e) {}
  }

  const nw = document.getElementById('navbar-wrap');
  const fw = document.getElementById('footer-wrap');
  const app = document.getElementById('app');

  // ── helper: reset scroll position to top ──
  const _resetScroll = () => {
    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch(e) {}
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    // also reset #app itself in case it's a scroll container
    if (app) app.scrollTop = 0;
  };

  // ── helper: swap content with transition ──
  const setContent = (html) => {
    _resetScroll();

    app.classList.remove('page-enter', 'page-exit');
    // Only animate if there's existing content
    if (app.innerHTML.trim()) {
      app.classList.add('page-exit');
      return new Promise(resolve => {
        setTimeout(() => {
          app.innerHTML = html;
          // Reset scroll again AFTER content injection (crucial for mobile)
          _resetScroll();
          app.classList.remove('page-exit');
          app.classList.add('page-enter');
          app.addEventListener('animationend', () => app.classList.remove('page-enter'), { once: true });
          resolve();
        }, 140);
      });
    } else {
      app.innerHTML = html;
      _resetScroll();
      app.classList.add('page-enter');
      app.addEventListener('animationend', () => app.classList.remove('page-enter'), { once: true });
      return Promise.resolve();
    }
  };

  if (State.currentPage === 'login') {
    nw.innerHTML = ''; fw.innerHTML = '';
    await setContent(renderLoginPage());
    if (typeof hideLoader === 'function') hideLoader();
    return;
  }
  if (State.currentPage === 'verify2fa') {
    nw.innerHTML = ''; fw.innerHTML = '';
    await setContent(renderOTPVerificationPage());
    if (typeof hideLoader === 'function') hideLoader();
    return;
  }
  if (State.currentPage === 'signup') {
    nw.innerHTML = ''; fw.innerHTML = '';
    await setContent(renderSignupPage());
    if (typeof hideLoader === 'function') hideLoader();
    return;
  }
  if (State.currentPage === 'forgot-password') {
    nw.innerHTML = ''; fw.innerHTML = '';
    await setContent(typeof renderForgotPasswordPage === 'function' ? renderForgotPasswordPage() : '');
    if (typeof hideLoader === 'function') hideLoader();
    return;
  }
  
  nw.innerHTML = renderNavbar(); fw.innerHTML = renderFooter();
  _teleportDrawers();
  refreshWalletBalanceUI();
  
  if (!State._dataLoaded || window._forceDataReload) {
    window._forceDataReload = false;
    showLoader(); 
    try {
      await Promise.race([
        loadAllData(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Data loading timeout")), 5000))
      ]);
      State._dataLoaded = true;
    } catch(err) {
      console.warn('loadAllData issue:', err);
    }
  } else {
    if (typeof hideLoader === 'function') hideLoader();
  }
  
  const u = State.currentUser;
  if (!u) { await navigate('login'); return; }
  
  const pages = {
    home: renderHome, listing: renderListing,
    myorders: renderMyOrders,
    wallet: () => {
      const r = State.currentUser?.role;
      if (r === 'admin' || r === 'staff') {
        navigate(r === 'admin' ? 'admin' : 'staff');
        return '';
      }
      return renderMyWallet();
    },
    mydeposits: () => {
      const r = State.currentUser?.role;
      if (r === 'admin' || r === 'staff') {
        navigate(r === 'admin' ? 'admin' : 'staff');
        return '';
      }
      return renderMyDeposits();
    },
    rate: renderRatingPage, settings: renderSettingsPage,
    admin: renderAdmin, staff: renderStaff,
    vendor: renderVendor, driver: renderDriver,
    page: renderStaticPage,
    'help-center': () => typeof renderHelpCenter === 'function' ? renderHelpCenter() : '<div style="padding:60px;text-align:center">جاري تحميل مركز المساعدة...</div>',
    'suggestions-complaints': () => typeof renderCustomerFeedbackPage === 'function' ? renderCustomerFeedbackPage() : '<div style="padding:60px;text-align:center">جاري تحميل صفحة الاقتراحات والشكاوى...</div>',
    offers: () => typeof ph_offersRenderPage === 'function' ? ph_offersRenderPage() : '<div style="padding:60px;text-align:center">جاري تحميل العروض...</div>',
    store: () => typeof ph43_renderStorePage === 'function' ? ph43_renderStorePage() : '<div style="padding:60px;text-align:center">جاري تحميل المتجر...</div>',
    rentalstore: () => typeof window.ph_rentalRenderStorePage === 'function' ? window.ph_rentalRenderStorePage() : '<div style="padding:60px;text-align:center">جاري تحميل المتجر...</div>',
    provider: () => typeof renderProviderDashboard === 'function' ? renderProviderDashboard() : '<div style="padding:60px;text-align:center">جاري التحميل...</div>',
    stores: () => { navigate('listing', {section: 'stores'}); return ''; },
    ...(window.ExtraPages || {}),
  };
  
  const fn = pages[State.currentPage];
  let html;
  try {
    html = fn ? fn() : `<div style="padding:120px;text-align:center;color:var(--text-muted)">الصفحة غير موجودة</div>`;
  } catch(e) {
    console.error('Render error on page ' + State.currentPage + ':', e);
    html = `<div style="padding:120px;text-align:center;color:var(--danger)">حدث خطأ أثناء عرض الصفحة. يرجى المحاولة مرة أخرى.</div>`;
  }

  await setContent(html);
  _teleportDrawers();
  if (typeof hideLoader === 'function') hideLoader();

  // Handle service deep link / redirect to service detail page
  if (State.params && State.params.serviceId) {
    const svcId = State.params.serviceId;
    delete State.params.serviceId;
    setTimeout(() => {
      navigate('service', { id: svcId }, true);
    }, 100);
  }

  if (activeElId) {
    setTimeout(() => {
      const el = document.getElementById(activeElId);
      if (el) {
        el.focus();
        if (selStart !== null && selEnd !== null && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          try { el.setSelectionRange(selStart, selEnd); } catch(e) {}
        }
      }
    }, 0);
  }
}

// ─── Login ────────────────────────────────────────
function renderLoginPage() {
  const demoBtn = (role, icon, label, grad) =>
    `<button class="btn btn-primary btn-block" style="background:${grad}; display:flex; align-items:center; gap:12px; padding:12px 20px; margin-bottom:10px; border:none; box-shadow:0 4px 12px rgba(0,0,0,0.1); transition:all 0.2s;" onclick="quickLogin('${role}')">
      <span style="font-size:22px">${icon}</span>
      <div style="text-align:right">
        <div style="font-size:14px; font-weight:800">${label}</div>
        <div style="font-size:10px; opacity:0.8">حساب تجريبي للمعاينة</div>
      </div>
    </button>`;

  return `
  <div id="login-page">
    <div class="login-bg-circle"></div><div class="login-bg-circle"></div>
    <div class="login-container">
      <div class="login-logo" style="font-family:'Outfit',sans-serif; letter-spacing:-1px">MAHJOOZ</div>
      <p class="login-tagline">منصة الخدمات والحجوزات الشاملة</p>
      
      <div class="login-card" style="padding:32px; border-radius:24px; box-shadow:0 20px 50px rgba(0,0,0,0.2);">
        <div style="margin-bottom:28px">
          <h3 style="margin-bottom:8px; text-align:center; color:var(--text-primary); font-size:22px">تسجيل الدخول</h3>
          <p style="text-align:center; color:var(--text-secondary); font-size:14px">مرحباً بك مجدداً في محجوز</p>
        </div>

        <div class="form-group">
          <label class="form-label">البريد الإلكتروني</label>
          <input class="form-control" id="l-email" type="email" placeholder="name@example.com">
        </div>
        <div class="form-group">
          <label class="form-label">كلمة المرور</label>
          <input class="form-control" id="l-pass" type="password" placeholder="••••••••">
        </div>
        
        <button class="btn btn-primary btn-block btn-lg" onclick="doEmailLogin()" style="margin-top:10px; font-weight:800; letter-spacing:0.5px">دخول آمن 🔒</button>
        
        <div style="text-align:center; margin-top:20px">
          <button class="guest-btn" onclick="enterGuest()" style="color:var(--primary); font-weight:700; background:none; border:none; cursor:pointer">👁️ تصفح كزائر</button>
        </div>

        <div class="login-divider" style="margin:30px 0; font-size:11px; font-weight:800; color:var(--text-muted); opacity:0.6; text-transform:uppercase; letter-spacing:2px">الوصول السريع للمطورين</div>
        
        <div style="background:rgba(245,158,11,0.05); border:1px dashed rgba(245,158,11,0.3); border-radius:12px; padding:12px; margin-bottom:20px; font-size:12px; color:#d97706; display:flex; gap:10px; align-items:center;">
          <span style="font-size:20px">🛠️</span>
          <span>هذه الحسابات مخصصة للاختبار والمعاينة الفورية للأدوار المختلفة.</span>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
          <div style="grid-column: span 2;">
            ${demoBtn('admin',   '👑','نايف (المدير العام)', 'linear-gradient(135deg,#f59e0b,#d97706)')}
          </div>
          ${demoBtn('staff',   '🖥️','سعد (الموظف)', 'linear-gradient(135deg,#6366f1,#4f46e5)')}
          ${demoBtn('provider','💼','سلمان (صاحب المهنة)', 'linear-gradient(135deg,#8b5cf6,#7c3aed)')}
          ${demoBtn('vendor_service','🛎️','خالد (مزود الخدمات)', 'linear-gradient(135deg,#7c3aed,#6d28d9)')}
          ${demoBtn('vendor_store','🏪','أحمد (مزود المتاجر)', 'linear-gradient(135deg,#10b981,#059669)')}
          ${demoBtn('driver',  '🚗','ياسر (المندوب)', 'linear-gradient(135deg,#0891b2,#0e7490)')}
          ${demoBtn('customer','👤','فيصل (العميل)', 'linear-gradient(135deg,#0d9488,#0f766e)')}
        </div>

        <div style="text-align:center; margin-top:24px; padding-top:20px; border-top:1px solid var(--border);">
          <span style="color:var(--text-secondary); font-size:14px">ليس لديك حساب؟</span>
          <button onclick="navigate('signup')" style="background:none; border:none; color:var(--primary); font-weight:800; cursor:pointer; padding:0 8px">إنشاء حساب جديد</button>
        </div>
      </div>
    </div>
  </div>`;
}
const RCREDS = {
  admin:'admin@mahjooz.app|123456', staff:'staff@mahjooz.app|staff123',
  vendor:'vendor-service@mahjooz.app|vendor123', driver:'driver@mahjooz.app|driver123',
  customer:'customer@mahjooz.app|customer123',
  provider:'provider-demo@mahjooz.app|provider123',
  vendor_service:'vendor-service@mahjooz.app|vendor123',
  vendor_store:'vendor-store@mahjooz.app|vendor123',
};
async function quickLogin(role) {
  showLoader('جاري الدخول...');
  const creds = RCREDS[role];
  if (!creds) { toast('الدور غير معروف', 'error'); await navigate('login'); return; }
  const [email, pass] = creds.split('|');
  try {
    await _signIn(email, pass);
  } catch(e) {
    toast('جاري تجهيز الحسابات التجريبية...', 'info');
    await ensureDemoAccounts();
    try {
      await _signIn(email, pass);
    } catch(err) {
      const errMsg = {
        'auth/invalid-credential': 'بيانات غير صحيحة — تأكد من تفعيل تسجيل الدخول بالبريد في Firebase',
        'auth/user-not-found': 'الحساب غير موجود — جاري الإنشاء، حاول مرة ثانية',
        'auth/wrong-password': 'كلمة المرور خاطئة',
      };
      alert("خطأ الدخول السريع: " + err.message + " | " + err.code);
      toast(errMsg[err.code] || err.message, 'error');
      await navigate('login');
    }
  }
}
async function doEmailLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-pass').value;
  if (!email||!pass) { toast('أدخل البريد وكلمة المرور','error'); return; }
  showLoader('جاري الدخول...');
  try { await _signIn(email,pass); }
  catch(e) {
    const m={'auth/user-not-found':'الحساب غير موجود','auth/wrong-password':'كلمة المرور خاطئة','auth/invalid-credential':'بيانات غير صحيحة'};
    toast(m[e.code]||e.message,'error'); await navigate('login');
  }
}
async function _signIn(email, pass) {
  const cred = await auth.signInWithEmailAndPassword(email, pass);
  let ud = (await db.collection('users').doc(cred.user.uid).get()).data();
  
  const demoAcc = typeof DEMO !== 'undefined' ? DEMO.find(d => d.email === email) : null;
  if (demoAcc) {
    ud = {
      name: demoAcc.name,
      email: demoAcc.email,
      role: demoAcc.role,
      phone: ud?.phone || '',
      firstLogin: demoAcc.role === 'vendor',
      vendorType: demoAcc.vendorType || ''
    };
    await fsSet('users', cred.user.uid, ud);
    await ensureWallet(cred.user.uid);
  } else if (!ud) {
    throw new Error('بيانات الحساب غير موجودة');
  }
  // التحقق من تفعيل المصادقة الثنائية
  if (ud.twoFAEnabled) {
    State.tempUserData = { uid: cred.user.uid, ...ud };
    State.awaitingOTP = true;
    await send2FAOTP(cred.user.uid, ud.email, ud.phone);
    await navigate('verify2fa');
    return;
  }
  
  State.currentUser = { uid: cred.user.uid, ...ud };
  await ensureWallet(cred.user.uid);
  if (typeof listenToNotifications === 'function') listenToNotifications(cred.user.uid);
  toast(`أهلاً ${ud.name} 👋`,'success');
  if (ud.role==='vendor' && ud.firstLogin) { await navigate('vendor'); showChangePwModal(); return; }
  const rp = { admin:'admin', staff:'staff', vendor:'vendor', driver:'driver', customer:'home', provider:'vendor' };
  await navigate(rp[ud.role]||'home');
}
async function enterGuest() {
  try {
    State.currentUser = { uid:null, role:'guest', name:'زائر', email:'' };
    showLoader('جاري الدخول...');
    await navigate('home');
  } catch (err) {
    console.error('Guest login failed:', err);
  } finally {
    if (typeof hideLoader === 'function') hideLoader();
  }
}

// ─── Change Password (Vendor first login) ─────────
function showChangePwModal() {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">🔐 يجب تغيير كلمة المرور</h2></div>
    <p style="color:var(--text-secondary);margin-bottom:20px">لأمان حسابك، يرجى تغيير كلمة المرور عند أول دخول</p>
    <div class="form-group"><label class="form-label">كلمة المرور الجديدة</label><input class="form-control" id="np1" type="password" placeholder="6 أحرف على الأقل"></div>
    <div class="form-group"><label class="form-label">تأكيد كلمة المرور</label><input class="form-control" id="np2" type="password" placeholder="أعد كلمة المرور"></div>
    <button class="btn btn-primary btn-block" onclick="saveNewPassword()">حفظ كلمة المرور</button>`);
}
async function saveNewPassword() {
  const p1 = document.getElementById('np1').value;
  const p2 = document.getElementById('np2').value;
  if (!p1||p1.length<6) { toast('كلمة المرور يجب أن تكون 6 أحرف على الأقل','error'); return; }
  if (p1!==p2) { toast('كلمتا المرور غير متطابقتين','error'); return; }
  try {
    await auth.currentUser.updatePassword(p1);
    await fsUpdate('users', State.currentUser.uid, { firstLogin: false });
    State.currentUser.firstLogin = false;
    closeModal(); toast('تم تغيير كلمة المرور ✅','success');
  } catch(e) { toast(e.message,'error'); }
}

// ─── Two-Factor Authentication (2FA) ───────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
// ─── EmailJS Config ───────────────────────────────
const _EJS = {
  publicKey:      'yoRVnRbtNtg1vaN-y',
  serviceId:      'service_tn2f0ml',
  otpTemplate:    'template_0new8ul',
  alertTemplate:  'template_0wmtlfy',
  _ready: false,
  init() {
    if (this._ready) return;
    if (typeof emailjs !== 'undefined') {
      emailjs.init({ publicKey: this.publicKey });
      this._ready = true;
    }
  },
  async send(templateId, params) {
    this.init();
    if (typeof emailjs === 'undefined') throw new Error('EmailJS غير محمّل');
    return emailjs.send(this.serviceId, templateId, params);
  }
};

function formatPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.toString().replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return '+' + cleaned.substring(2);
  
  // Yemen defaults
  if (cleaned.startsWith('7') && cleaned.length === 9) {
    return '+967' + cleaned;
  }
  if (cleaned.startsWith('07') && cleaned.length === 10) {
    return '+967' + cleaned.substring(1);
  }
  
  // Saudi defaults
  if (cleaned.startsWith('5') && cleaned.length === 9) {
    return '+966' + cleaned;
  }
  if (cleaned.startsWith('05') && cleaned.length === 10) {
    return '+966' + cleaned.substring(1);
  }
  
  // Generic fallback if starts with 0
  if (cleaned.startsWith('0')) {
    return '+967' + cleaned.substring(1);
  }
  
  return '+967' + cleaned;
}
window.formatPhoneNumber = formatPhoneNumber;

async function send2FAOTP(uid, email, phone) {
  if (phone) {
    const formattedPhone = formatPhoneNumber(phone);
    
    // Check or create recaptcha container
    let container = document.getElementById('recaptcha-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'recaptcha-container';
      container.style.position = 'fixed';
      container.style.bottom = '10px';
      container.style.right = '10px';
      container.style.zIndex = '99999';
      document.body.appendChild(container);
    }
    
    try {
      const sa = getSecondaryAuth() || auth;
      if (window.loginRecaptchaVerifier) {
        try { window.loginRecaptchaVerifier.clear(); } catch(e){}
      }
      window.loginRecaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'invisible'
      });
      
      showLoader('جاري إرسال رمز التحقق لجوالك...');
      const confirmationResult = await sa.signInWithPhoneNumber(formattedPhone, window.loginRecaptchaVerifier);
      State.loginConfirmationResult = confirmationResult;
      hideLoader();
      toast(`📱 تم إرسال رمز التحقق إلى جوالك ${phone} عبر Firebase Auth`, 'success');
      return true;
    } catch (err) {
      console.warn('Firebase Phone Auth 2FA failed, falling back to EmailJS:', err);
      State.loginConfirmationResult = null;
      hideLoader();
      toast('⚠️ تعذّر الإرسال للجوال، جاري إرسال الرمز للبريد الإلكتروني...', 'warning');
    }
  }
  
  // Fallback to EmailJS
  State.loginConfirmationResult = null;
  return sendOTP(uid, email);
}
window.send2FAOTP = send2FAOTP;

async function sendOTP(uid, email) {
  const otp = generateOTP();
  const expiry = new Date(Date.now() + 10 * 60000);
  await fsUpdate('users', uid, {
    otpCode: otp,
    otpExpiry: expiry,
    otpAttempts: 0
  });

  // إرسال البريد الحقيقي عبر EmailJS
  try {
    const userName = State.tempUserData?.name || 'مستخدم محجوز';
    await _EJS.send(_EJS.otpTemplate, {
      to_email: email,
      to_name:  userName,
      otp_code: otp,
    });
    toast(`📧 تم إرسال رمز التحقق إلى ${email}`, 'success');
  } catch (ejsErr) {
    console.warn('EmailJS OTP error:', ejsErr);
    toast('❌ تعذّر إرسال رمز التحقق، يرجى المحاولة مجدداً.', 'error');
  }
  return true;
}
async function verifyOTP(uid, otp) {
  const user = await fsGet('users', uid);
  if (!user) throw new Error('الحساب غير موجود');
  if (!user.otpCode) throw new Error('لم يتم طلب رمز تحقق');
  const expiry = user.otpExpiry?.toDate ? user.otpExpiry.toDate() : new Date(user.otpExpiry);
  if (new Date() > expiry) throw new Error('انتهت صلاحية الرمز');
  if (user.otpAttempts >= 3) throw new Error('عدد محاولات التحقق انتهت');
  if (user.otpCode !== otp) {
    await fsUpdate('users', uid, { otpAttempts: (user.otpAttempts || 0) + 1 });
    throw new Error('رمز غير صحيح');
  }
  await fsUpdate('users', uid, { otpCode: null, otpExpiry: null, otpAttempts: 0 });
  return true;
}
async function toggleTwoFA(uid) {
  const user = await fsGet('users', uid);
  const newStatus = !user?.twoFAEnabled;
  await fsUpdate('users', uid, { twoFAEnabled: newStatus });
  const msg = newStatus ? '✅ تم تفعيل المصادقة الثنائية' : '❌ تم تعطيل المصادقة الثنائية';
  toast(msg, 'success');
  return newStatus;
}
window.addSvcSection = async function(catId) {
  const name = document.getElementById('new-sec-name').value;
  const icon = document.getElementById('new-sec-icon').value;
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
function renderOTPVerificationPage() {
  return `
  <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg-main); padding:20px; position:relative; overflow:hidden;">
    <div class="login-bg-circle" style="top:-10%; left:-10%; width:400px; height:400px;"></div>
    <div class="login-bg-circle" style="bottom:-10%; right:-10%; width:300px; height:300px; animation-delay:-2s;"></div>
    
    <div class="login-card" style="width:100%; max-width:440px; padding:40px; border-radius:32px; box-shadow:0 25px 60px rgba(0,0,0,0.25); position:relative; z-index:1; border:1px solid var(--glass-border);">
      <div style="text-align:center; margin-bottom:32px">
        <div style="width:80px; height:80px; background:linear-gradient(135deg, var(--primary), #8b5cf6); border-radius:24px; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; font-size:40px; box-shadow:0 10px 25px rgba(124,58,237,0.3);">🔐</div>
        <h2 style="color:var(--text-primary); margin-bottom:12px; font-size:24px; font-weight:800">التحقق من الهوية</h2>
        <p style="color:var(--text-secondary); font-size:15px; line-height:1.6">
          لقد أرسلنا رمز التحقق المكون من 6 أرقام إلى بريدك الإلكتروني:
          <br><strong style="color:var(--text-primary); font-size:16px">${State.tempUserData?.email || 'حسابك'}</strong>
        </p>
      </div>

      <div class="form-group" style="margin-bottom:24px">
        <label class="form-label" style="text-align:center; display:block; margin-bottom:12px; font-weight:700">رمز التحقق (OTP)</label>
        <input class="form-control" id="otp-input" type="text" placeholder="0 0 0 0 0 0" maxlength="6" 
          style="text-align:center; font-size:32px; letter-spacing:12px; font-weight:900; height:70px; border-radius:16px; background:var(--bg-hover); border:2px solid var(--border); color:var(--primary); font-family:'Outfit',sans-serif;" 
          inputmode="numeric" onkeypress="if(event.key==='Enter') verify2FA()">
      </div>

      <button class="btn btn-primary btn-block btn-lg" onclick="verify2FA()" style="height:56px; font-size:16px; font-weight:800; border-radius:16px; box-shadow:0 8px 20px rgba(124,58,237,0.3);">تأكيد والدخول آمن 🚀</button>
      
      <div style="text-align:center; margin-top:24px">
        <div style="color:var(--text-muted); font-size:13px; margin-bottom:12px" id="otp-timer">الرمز صالح لمدة 10 دقائق</div>
        <button class="btn btn-secondary btn-block" style="border-radius:12px; height:48px; background:transparent; border:1px solid var(--border);" onclick="resendOTP()">إعادة إرسال الرمز 📧</button>
      </div>

      <div style="margin-top:32px; text-align:center;">
        <button onclick="navigate('login')" style="background:none; border:none; color:var(--text-muted); font-size:14px; cursor:pointer">العودة لتسجيل الدخول</button>
      </div>
    </div>
  </div>`;
}
async function verify2FA() {
  const otp = document.getElementById('otp-input')?.value?.trim();
  if (!otp || otp.length !== 6) {
    toast('أدخل رمز صحيح من 6 أرقام','error');
    return;
  }
  try {
    showLoader('جاري التحقق...');
    if (State.loginConfirmationResult) {
      await State.loginConfirmationResult.confirm(otp);
      const sa = getSecondaryAuth();
      if (sa) { await sa.signOut().catch(()=>{}); }
      State.loginConfirmationResult = null;
    } else {
      await verifyOTP(State.tempUserData.uid, otp);
    }
    State.currentUser = State.tempUserData;
    await ensureWallet(State.tempUserData.uid);
    State.tempUserData = null;
    State.awaitingOTP = false;
    toast(`✅ تم التحقق بنجاح! أهلاً ${State.currentUser.name}`, 'success');

    // كشف الجهاز الجديد (غير مُعيق)
    _checkNewDeviceLogin(State.currentUser.uid, State.currentUser.email, State.currentUser.name);

    if (State.currentUser.role === 'vendor' && State.currentUser.firstLogin) {
      await navigate('vendor');
      showChangePwModal();
      return;
    }
    const rp = { admin:'admin', staff:'staff', vendor:'vendor', driver:'driver', customer:'home' };
    await navigate(rp[State.currentUser.role]||'home', {}, true);
  } catch(e) {
    toast(e.message, 'error');
    showLoader();
  }
}
async function resendOTP() {
  try {
    await send2FAOTP(State.tempUserData.uid, State.tempUserData.email, State.tempUserData.phone);
    toast('✅ تم إعادة إرسال الرمز','success');
  } catch(e) {
    toast(e.message,'error');
  }
}

// ─── New Device / Location Detection ──────────────
function _genDeviceId() {
  const fp = [
    navigator.userAgent,
    screen.width + 'x' + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language
  ].join('|');
  let h = 0;
  for (const c of fp) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return 'dev_' + Math.abs(h).toString(36);
}

async function _getIPInfo() {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch('https://ipapi.co/json/?fields=ip,city,country_name', { signal: ctrl.signal });
    return await r.json();
  } catch { return null; }
}

function _getDeviceName() {
  const ua = navigator.userAgent;
  const device = /Mobile|Android|iPhone|iPad/.test(ua) ? '📱 جهاز محمول' : '💻 حاسب';
  const browser = ua.includes('Edg') ? 'Edge'
    : ua.includes('Chrome') ? 'Chrome'
    : ua.includes('Firefox') ? 'Firefox'
    : ua.includes('Safari') ? 'Safari'
    : 'متصفح غير معروف';
  const os = ua.includes('Windows') ? 'Windows'
    : ua.includes('Mac') ? 'macOS'
    : ua.includes('Android') ? 'Android'
    : ua.includes('iPhone') || ua.includes('iPad') ? 'iOS'
    : ua.includes('Linux') ? 'Linux'
    : '';
  return { device, browser, os };
}

async function _checkNewDeviceLogin(uid, email, name) {
  try {
    const deviceId  = _genDeviceId();
    const storeKey  = '_mdid_' + uid;
    const knownId   = localStorage.getItem(storeKey);
    const isNew     = !knownId || knownId !== deviceId;

    // جلب بيانات الموقع الجغرافي دائماً (للتسجيل حتى لو ليس جهازاً جديداً)
    const ipInfo    = await _getIPInfo();
    const city      = ipInfo?.city || '';
    const country   = ipInfo?.country_name || '';
    const location  = [city, country].filter(Boolean).join('، ') || 'غير محدد';
    const ip        = ipInfo?.ip || 'غير معروف';
    const { device, browser, os } = _getDeviceName();
    const timeStr   = new Date().toLocaleString('ar-YE', { dateStyle:'full', timeStyle:'short' });

    // حفظ بصمة الجهاز الحالي
    localStorage.setItem(storeKey, deviceId);

    if (!isNew) return; // ليس جهازاً جديداً

    // حفظ التنبيه في Firestore
    await db.collection('loginAlerts').add({
      uid, email, name,
      deviceId, device, browser, os,
      location, ip,
      time: new Date(),
      read: false,
      type: 'new_device'
    });

    // إرسال بريد إلكتروني حقيقي عبر EmailJS
    const resetLink = `${window.location.origin}/?page=forgot-password`;
    try {
      await _EJS.send(_EJS.alertTemplate, {
        to_email:   email,
        to_name:    name,
        device:     `${device} — ${browser}${os ? ' / ' + os : ''}`,
        location,
        ip,
        login_time: timeStr,
        reset_link: resetLink,
      });
      console.log(`📧 [EmailJS] تم إرسال تنبيه أمني إلى ${email}`);
    } catch (ejsErr) {
      console.warn('EmailJS alert error:', ejsErr);
    }

    // إشعار داخلي احترافي
    setTimeout(() => {
      openModal(`
        <div class="modal-header new-device-alert-header">
          <div class="new-device-alert-icon">🔔</div>
          <div>
            <h2 class="modal-title" style="color:#f59e0b">تنبيه أمني: دخول من جهاز جديد</h2>
            <p style="color:var(--text-secondary);font-size:13px;margin:4px 0 0">تم رصد هذا النشاط على حسابك</p>
          </div>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body new-device-alert-body">
          <p class="new-device-greeting">مرحباً <strong>${name}</strong>، لاحظنا دخولاً إلى حسابك من جهاز لم نتعرف عليه سابقاً.</p>

          <div class="new-device-info-card">
            <div class="new-device-info-row"><span class="info-label">📱 الجهاز</span><span class="info-val">${device} — ${browser}${os ? ' / ' + os : ''}</span></div>
            <div class="new-device-info-row"><span class="info-label">📍 الموقع</span><span class="info-val">${location}</span></div>
            <div class="new-device-info-row"><span class="info-label">🌐 عنوان IP</span><span class="info-val">${ip}</span></div>
            <div class="new-device-info-row"><span class="info-label">🕐 الوقت</span><span class="info-val">${timeStr}</span></div>
          </div>

          <p class="new-device-tip">إذا لم تكن أنت من قام بهذا الدخول، يرجى تغيير كلمة مرورك فوراً لحماية حسابك.</p>

          <div class="new-device-actions">
            <button class="btn btn-primary" onclick="closeModal()">✅ أنا من دخل، لا مشكلة</button>
            <button class="btn btn-danger new-device-change-pw-btn" onclick="navigate('forgot-password');closeModal()">🔒 تغيير كلمة المرور</button>
          </div>
        </div>
      `);
    }, 1200);

  } catch(e) {
    console.warn('[NewDevice] فشل كشف الجهاز:', e);
  }
}

// ─── Init ─────────────────────────────────────────
const _timeout = (ms, fallback=null) => new Promise(r => setTimeout(()=>r(fallback), ms));
window.addEventListener('DOMContentLoaded', async () => {
  if (typeof applyLang === 'function') applyLang();
  showLoader(typeof t === 'function' ? t('setting_up') : 'جاري إعداد المنصة...');

  // Pre-fetch delivery zones EARLY (non-blocking) so signup form finds them ready
  // Uses a short timeout so it doesn't delay app startup
  Promise.race([
    fsGetAll('delivery_zones').then(data => { AppData.deliveryZones = data; AppData.regions = data; }).catch(() => {}),
    _timeout(4000)
  ]).catch(() => {});

  // Promise.race([ensureDemoAccounts(), _timeout(4000)]).catch(()=>{});

  // Hard-fallback: if nothing has navigated within 6s, force the login page.
  const safetyNet = setTimeout(async () => {
    if (!State.currentUser && State.currentPage === 'loading') {
      console.warn('Auth state never resolved — falling back to login page');
      try { await navigate('login'); } catch(e) { console.error(e); }
    }
  }, 6000);

  auth.onAuthStateChanged(async firebaseUser => {
    clearTimeout(safetyNet);
    if (firebaseUser && (!State.currentUser || State.currentUser.role === 'guest')) {
      try {
        const snap = await Promise.race([
          db.collection('users').doc(firebaseUser.uid).get(),
          _timeout(5000),
        ]);
        const ud = snap?.data?.();
        if (ud) {
          State.currentUser = { uid: firebaseUser.uid, ...ud };
          ensureWallet(firebaseUser.uid).catch(()=>{});
          if (typeof listenToNotifications === 'function') listenToNotifications(firebaseUser.uid);
          const rp = { admin:'admin', staff:'staff', vendor:'vendor', driver:'driver', customer:'home', provider:'vendor' };
          
          let searchStr = window.location.search;
          const savedRedirect = sessionStorage.getItem('redirect_after_login');
          if (savedRedirect) {
            sessionStorage.removeItem('redirect_after_login');
            searchStr = savedRedirect;
          }
          
          const urlParams = new URLSearchParams(searchStr);
          const rId = urlParams.get('regionId');
          if (rId) {
            State.currentUser.regionId = rId;
            db.collection('users').doc(firebaseUser.uid).update({ regionId: rId }).catch(()=>{});
          }
          
          const initPage = urlParams.get('page');
          if (initPage && initPage !== 'login') {
            const p = {};
            for(const [k,v] of urlParams.entries()) if(k!=='page') p[k]=v;
            await navigate(initPage, p, true);
          } else {
            await navigate(rp[ud.role]||'home', {}, true);
          }
          return;
        }
      } catch(e) { console.warn('User doc fetch failed:', e); }
    }
    
    if (!State.currentUser) {
      const urlParams = new URLSearchParams(window.location.search);
      const isSharedLink = urlParams.has('serviceId') || urlParams.has('productId') || urlParams.has('storeId') || urlParams.has('regionId') || urlParams.get('page') === 'service' || urlParams.get('page') === 'store';
      
      if (isSharedLink) {
        State.currentUser = { uid: null, role: 'guest', name: 'زائر', email: '' };
        const rId = urlParams.get('regionId');
        if (rId) State.currentUser.regionId = rId;
        
        const initPage = urlParams.get('page') || 'home';
        const p = {};
        for(const [k,v] of urlParams.entries()) if(k!=='page') p[k]=v;
        await navigate(initPage, p, true);
        return;
      }

      if (window.location.search && window.location.search.length > 1) {
        sessionStorage.setItem('redirect_after_login', window.location.search);
      }
      await navigate('login', {}, true);
    }
  });
});

// ─── Reusable Governorate-Region Hierarchy Helpers ───
window.ph_onFormGovChange = function(govSelectId, regionSelectId, selectedRegionId = null) {
  const govEl = document.getElementById(govSelectId);
  const regSelect = document.getElementById(regionSelectId);
  if (!regSelect) return;
  const govId = govEl?.value;
  if (!govId) {
    regSelect.innerHTML = '<option value="">-- اختر المنطقة (تغطية عامة إذا تركت فارغة) --</option>';
    return;
  }
  const zones = (AppData.deliveryZones || AppData.regions || []).filter(r => r.govId === govId && r.active !== false);
  if (zones.length === 0) {
    regSelect.innerHTML = '<option value="">-- لا توجد مناطق مضافة في هذه المحافظة --</option>';
    return;
  }
  regSelect.innerHTML = '<option value="">-- اختر المنطقة --</option>' +
    zones.map(r => `<option value="${r.id}" ${r.id === selectedRegionId ? 'selected' : ''}>${escHtml(r.name)}</option>`).join('');
};

window.ph_matchesLocation = function(item, userRegionId, userGovId, parentStore = null) {
  // No location filter at all → show everything
  if (!userRegionId && !userGovId) return true;

  // Helper: get governorate of a regionId
  const govOfRegion = (rId) => {
    const r = (AppData.regions || []).find(x => x.id === rId);
    return r ? r.govId : null;
  };

  // Determine the user's effective govId (from explicit selection or derived from picked region)
  const effectiveGovId = userGovId || (userRegionId ? govOfRegion(userRegionId) : null);

  // 1. Item has its own regionId → match exactly or at gov level
  if (item.regionId) {
    if (userRegionId) return item.regionId === userRegionId;
    return govOfRegion(item.regionId) === effectiveGovId;
  }

  // 2. Item has govId only → match at gov level
  if (item.govId) {
    return item.govId === effectiveGovId;
  }

  // 3. Inherit location from parent store
  const store = parentStore || (item.storeId ? (AppData.stores || []).find(s => s.id === item.storeId) : null);
  if (store) {
    if (store.regionId) {
      if (userRegionId) return store.regionId === userRegionId;
      return govOfRegion(store.regionId) === effectiveGovId;
    }
    if (store.govId) {
      return store.govId === effectiveGovId;
    }
  }

  // 4. No location constraint defined on item → show to everyone
  return true;
};

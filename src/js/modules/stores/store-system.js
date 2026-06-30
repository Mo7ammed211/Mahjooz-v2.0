// ═══════════════════════════════════════════════════════
//  محجوز — Phase 43: Store & Pharmacy System
//  Shopping Cart + Multi-store + Admin Management
// ═══════════════════════════════════════════════════════
'use strict';

// ───────────────────────────────────────────────────────
// SECTION 1 — Cart State & Core Functions
// ───────────────────────────────────────────────────────
if (!window.__ph43Cart) window.__ph43Cart = [];

window.ph43_getCart    = () => window.__ph43Cart;
window.ph43_setCart    = (c) => { window.__ph43Cart = c; ph43_updateCartBadge(); };
window.ph43_cartTotal  = () => window.__ph43Cart.reduce((s, i) => s + i.price * i.qty, 0);
window.ph43_cartCount  = () => window.__ph43Cart.reduce((s, i) => s + i.qty, 0);

window.ph43_updateCartBadge = function () {
  const badge = document.getElementById('ph43-cart-badge');
  const count = ph43_cartCount();
  if (!badge) return;
  const oldVal = badge.textContent;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
  
  if (count > 0 && String(count) !== String(oldVal)) {
    const btn = badge.closest('.ph43-cart-nav-btn');
    if (btn) {
      btn.classList.remove('cart-bump');
      void btn.offsetWidth; // trigger reflow
      btn.classList.add('cart-bump');
    }
  }
};

window.ph43_addToCart = function (productId, storeId, selectedTier = null) {
  const u = State.currentUser;
  if (!u || u.role !== 'customer') { navigate('login'); return; }
  const store   = (AppData.stores || []).find(s => s.id === storeId);
  const product = (AppData.storeProducts || []).find(p => p.id === productId);
  if (!product || !store) return;
  if (typeof ph48_isAvailable === 'function' && !ph48_isAvailable(product)) {
    toast('هذا المنتج غير متاح للطلب حالياً', 'warning');
    return;
  }

  const cartItemKey = selectedTier ? `${productId}_${selectedTier.name}` : productId;
  const displayName = selectedTier ? `${product.name} (${selectedTier.name})` : product.name;
  const finalPrice  = selectedTier ? selectedTier.price : product.price;

  const cart     = ph43_getCart();
  const existing = cart.find(i => i.productId === cartItemKey);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      productId: cartItemKey,
      type: 'store',
      storeId,
      storeName: store.name,
      storeIcon: store.icon || '🏪',
      name: displayName,
      price: finalPrice,
      qty: 1,
      image: product.imageBase64 || null,
      tierName: selectedTier ? selectedTier.name : null
    });
  }
  ph43_setCart(cart);
  toast(`✅ أُضيف "${displayName}" للسلة`, 'success');
  ph43_refreshProductBtn(productId);
};

window.ph43_removeFromCart = function (productId) {
  ph43_setCart(ph43_getCart().filter(i => i.productId !== productId));
  ph43_renderCartBody();
  
  // Refresh base product button badge after removal
  const baseId = productId.split('_')[0];
  ph43_refreshProductBtn(baseId);
};

window.ph43_changeQty = function (productId, delta) {
  const cart = ph43_getCart();
  const item  = cart.find(i => i.productId === productId);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  ph43_setCart(cart);
  ph43_renderCartBody();
  
  const baseId = productId.split('_')[0];
  ph43_refreshProductBtn(baseId);
};

window.ph43_clearCart = function () {
  if (!confirm('هل تريد إفراغ السلة كاملاً؟')) return;
  const oldCart = ph43_getCart();
  ph43_setCart([]);
  closeModal();
  
  // Refresh all buttons
  oldCart.forEach(item => {
    const baseId = item.productId.split('_')[0];
    ph43_refreshProductBtn(baseId);
  });
};

window.ph43_refreshProductBtn = function (productId) {
  document.querySelectorAll(`[data-ph43-pid="${productId}"]`).forEach(btn => {
    const items = ph43_getCart().filter(i => i.productId === productId || i.productId.startsWith(productId + '_'));
    const totalQty = items.reduce((s, i) => s + i.qty, 0);
    const product = (AppData.storeProducts || []).find(p => p.id === productId);
    const hasTiers = product && product.tiers && product.tiers.length > 0;
    
    if (totalQty > 0) {
      btn.innerHTML = `🛒 <span>${totalQty} في السلة</span>`;
      btn.classList.add('in-cart');
    } else {
      btn.innerHTML = `🛒 <span>${hasTiers ? 'اختر الفئة' : 'أضف للسلة'}</span>`;
      btn.classList.remove('in-cart');
    }
  });
};

// ═══════════════════════════════════════════════════════
// BOOKING DATE PICKER ENGINE
// ═══════════════════════════════════════════════════════

window.__bkCalState = null;

const BK_MONTH_NAMES = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const BK_DAY_LABELS  = [
  {l:'أح', fri:false}, {l:'اث', fri:false}, {l:'ثل', fri:false},
  {l:'أر', fri:false}, {l:'خم', fri:false}, {l:'جم', fri:true},
  {l:'سب', fri:false},
];

function bk_todayStr() {
  const t = new Date(); t.setHours(0,0,0,0);
  return t.toISOString().split('T')[0];
}

function bk_formatAr(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${BK_MONTH_NAMES[parseInt(m)-1]}`;
}

window.bk_calRender = function () {
  const s = window.__bkCalState;
  const grid = document.getElementById('bk-cal-grid');
  const title = document.getElementById('bk-cal-month');
  if (!grid || !title || !s) return;

  title.textContent = `${BK_MONTH_NAMES[s.month]} ${s.year}`;

  const today = bk_todayStr();
  const firstDay = new Date(s.year, s.month, 1).getDay();
  const daysInMonth = new Date(s.year, s.month + 1, 0).getDate();

  let html = '';
  for (let i = 0; i < firstDay; i++) html += `<div class="bk-cal-day bk-cal-empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${s.year}-${String(s.month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const past = ds < today;
    const isToday = ds === today;
    const sel = s.selectedDates.has(ds);
    let cls = 'bk-cal-day';
    if (past) cls += ' disabled';
    if (isToday) cls += ' today';
    if (sel) cls += ' selected';
    html += `<div class="${cls}" ${past ? '' : `onclick="bk_calToggleDay('${ds}')"`}>${d}</div>`;
  }

  grid.innerHTML = html;
  bk_renderSelectedTags();
  bk_updateConfirmBtn();
};

window.bk_calToggleDay = function (ds) {
  const s = window.__bkCalState;
  if (!s) return;
  if (s.selectedDates.has(ds)) s.selectedDates.delete(ds);
  else s.selectedDates.add(ds);
  bk_calRender();
};

window.bk_calPrev = function () {
  const s = window.__bkCalState; if (!s) return;
  s.month--; if (s.month < 0) { s.month = 11; s.year--; }
  bk_calRender();
};

window.bk_calNext = function () {
  const s = window.__bkCalState; if (!s) return;
  s.month++; if (s.month > 11) { s.month = 0; s.year++; }
  bk_calRender();
};

function svc_calculatePriceForPeriod(svc, period) {
  const basePrice = svc.finalPrice || svc.price || 0;
  if (svc.isShiftBooking) {
    if (period === 'morning') return svc.priceMorning !== undefined && svc.priceMorning !== null ? svc.priceMorning : basePrice;
    if (period === 'evening') return svc.priceEvening !== undefined && svc.priceEvening !== null ? svc.priceEvening : basePrice;
    if (period === 'fullday') return svc.priceFullDay !== undefined && svc.priceFullDay !== null ? svc.priceFullDay : (basePrice * 2);
  }
  if (period === 'fullday') return basePrice * 2;
  return basePrice;
}

window.bk_setPeriod = function (p) {
  const s = window.__bkCalState; if (!s) return;
  s.period = p;
  document.querySelectorAll('.bk-period-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`bk-period-${p}`);
  if (btn) btn.classList.add('active');

  // تحديث السعر المعروض في نافذة الحجز بناءً على الفترة
  const svc = AppData.services.find(sv => sv.id === s.svcId);
  if (svc) {
    const calcPrice = svc_calculatePriceForPeriod(svc, p);
    const priceText = calcPrice ? calcPrice.toLocaleString('ar-YE') + ' ريال' : 'السعر عند التواصل';
    const priceEl = document.getElementById('bk-strip-price-val');
    if (priceEl) priceEl.textContent = priceText;
  }
};

window.bk_removeDate = function (ds) {
  const s = window.__bkCalState; if (!s) return;
  s.selectedDates.delete(ds);
  bk_calRender();
};

window.bk_renderSelectedTags = function () {
  const s = window.__bkCalState;
  const wrap = document.getElementById('bk-selected-tags');
  if (!wrap || !s) return;
  const sorted = [...s.selectedDates].sort();
  if (!sorted.length) {
    wrap.innerHTML = `<span class="bk-no-dates-hint">اضغط على أي يوم لتحديده</span>`;
    return;
  }
  wrap.innerHTML = `
    <span class="bk-sel-label">${sorted.length > 1 ? sorted.length + ' أيام' : 'يوم'}</span>
    ${sorted.map(ds => `
      <span class="bk-date-tag">
        📅 ${bk_formatAr(ds)}
        <button onclick="bk_removeDate('${ds}')" title="إزالة">✕</button>
      </span>
    `).join('')}`;
};

window.bk_updateConfirmBtn = function () {
  const s = window.__bkCalState;
  const btn = document.getElementById('bk-confirm-btn');
  if (!btn || !s) return;
  const count = s.selectedDates.size;
  btn.disabled = count === 0;
  btn.textContent = count > 0
    ? `✅ تأكيد الحجز — ${count} ${count === 1 ? 'يوم' : 'أيام'}`
    : 'اختر يوماً واحداً على الأقل';
};

// ── Show date picker modal for booking service ──
window.svc_showBookingDateModal = function (svcId) {
  const svc = AppData.services.find(s => s.id === svcId);
  if (!svc) return;
  const dispPrice = svc_calculatePriceForPeriod(svc, 'morning');
  const priceText = dispPrice ? dispPrice.toLocaleString('ar-YE') + ' ريال' : 'السعر عند التواصل';
  const now = new Date();

  window.__bkCalState = {
    svcId,
    selectedDates: new Set(),
    year: now.getFullYear(),
    month: now.getMonth(),
    period: 'morning',
  };

  openModal(`
    <div class="modal-header" style="padding-bottom:10px">
      <h2 class="modal-title" style="font-size:15px">📅 اختر موعد الحجز</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="bk-picker-wrap">

      <div class="bk-svc-strip">
        <span class="bk-strip-icon">${svc.icon || '📅'}</span>
        <span class="bk-strip-name">${escHtml(svc.name)}</span>
        <span class="bk-strip-price" id="bk-strip-price-val">${priceText}</span>
      </div>

      <div class="bk-calendar-wrap">
        <div class="bk-cal-header">
          <button class="bk-cal-nav-btn" onclick="bk_calPrev()">›</button>
          <h3 id="bk-cal-month"></h3>
          <button class="bk-cal-nav-btn" onclick="bk_calNext()">‹</button>
        </div>
        <div class="bk-cal-days-header">
          ${BK_DAY_LABELS.map(l => `<div class="bk-cal-day-label${l.fri?' friday':''}">${l.l}</div>`).join('')}
        </div>
        <div id="bk-cal-grid" class="bk-cal-grid"></div>
      </div>

      <div id="bk-selected-tags" class="bk-selected-row">
        <span class="bk-no-dates-hint">اضغط على أي يوم لتحديده</span>
      </div>

      <div class="bk-divider"></div>

      <div class="bk-period-wrap">
        <span class="bk-period-label-sm">⏰ الوقت</span>
        <div class="bk-period-seg">
          <button id="bk-period-morning" class="bk-period-btn active" onclick="bk_setPeriod('morning')">
            <span class="period-icon">🌅</span> صباحاً
          </button>
          <button id="bk-period-evening" class="bk-period-btn" onclick="bk_setPeriod('evening')">
            <span class="period-icon">🌆</span> مساءً
          </button>
          <button id="bk-period-fullday" class="bk-period-btn" onclick="bk_setPeriod('fullday')">
            <span class="period-icon">☀️</span> يوم كامل
          </button>
        </div>
      </div>

      <button id="bk-confirm-btn" class="bk-confirm-btn" disabled onclick="bk_confirmDates()">
        اختر يوماً على الأقل
      </button>
    </div>
  `);

  bk_calRender();
};

// ── Confirm and add booking to cart ──
window.bk_confirmDates = function () {
  const s = window.__bkCalState;
  if (!s || s.selectedDates.size === 0) { toast('اختر يوماً واحداً على الأقل', 'error'); return; }

  const svc = AppData.services.find(sv => sv.id === s.svcId);
  if (!svc) return;
  const cat = AppData.cats.find(c => c.id === svc.catId);
  const itemType = 'booking';
  const cartKey  = `svc_${s.svcId}`;

  const cart = ph43_getCart();
  if (cart.find(i => i.productId === cartKey)) {
    toast('هذه الخدمة موجودة بالفعل في السلة', 'warning');
    return;
  }

  const sortedDates = [...s.selectedDates].sort();

  const calcPrice = svc_calculatePriceForPeriod(svc, s.period);

  cart.push({
    productId: cartKey,
    svcId: s.svcId,
    type: itemType,
    name: svc.name,
    icon: svc.icon || '📅',
    price: calcPrice,
    qty: 1,
    priceLabel: (!calcPrice) ? 'السعر عند التواصل' : null,
    providerName: svc.providerName || svc.provider || '',
    providerUid: svc.providerUid || '',
    requiresDelivery: svc.requiresDelivery !== false,
    commonIssues: svc.commonIssues || [],
    bookingDates: sortedDates,
    bookingPeriod: s.period,
  });

  ph43_setCart(cart);
  closeModal();

  const count = sortedDates.length;
  const periodLabel = s.period === 'morning' ? 'صباحاً' : s.period === 'evening' ? 'مساءً' : 'يوم كامل';
  toast(`✅ أُضيفت "${svc.name}" للسلة — ${count} ${count===1?'يوم':'أيام'} (${periodLabel}) 🛒`, 'success');

  document.querySelectorAll(`[data-svc-cart-id="${s.svcId}"]`).forEach(btn => {
    btn.innerHTML = `✅ <span>في السلة</span>`;
    btn.disabled = true;
    btn.style.opacity = '0.75';
  });
};

// ── Show date range picker for rental ──
window.rental_showDateModal = function (productId, storeId) {
  const p     = (AppData.rentalProducts || []).find(x => x.id === productId);
  const store = (AppData.rentalStores   || []).find(x => x.id === storeId);
  if (!p || !store) return;

  const todayStr = bk_todayStr();

  openModal(`
    <div class="modal-header" style="padding-bottom:10px">
      <h2 class="modal-title" style="font-size:15px">🏚️ حدد فترة الإيجار</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="bk-picker-wrap">

      <div class="bk-svc-strip">
        <span class="bk-strip-icon">${p.imageBase64
          ? `<img src="${p.imageBase64}" style="width:24px;height:24px;border-radius:5px;object-fit:cover;vertical-align:middle">`
          : '🏚️'}</span>
        <span class="bk-strip-name">${escHtml(p.name)} <span style="font-weight:400;color:var(--text-muted);font-size:11px">· ${escHtml(store.name)}</span></span>
        <span class="bk-strip-price">${p.price ? p.price.toLocaleString('ar-YE') + ' ﷼' : '—'}</span>
      </div>

      <div class="bk-rental-row">
        <div class="form-group">
          <label class="form-label">📅 من</label>
          <input class="form-control" id="rent-modal-start" type="date"
            min="${todayStr}" onchange="rental_calcDuration()">
        </div>
        <div class="form-group">
          <label class="form-label">📅 إلى</label>
          <input class="form-control" id="rent-modal-end" type="date"
            min="${todayStr}" onchange="rental_calcDuration()">
        </div>
      </div>

      <div id="rent-modal-duration" class="bk-dur-badge">
        📆 حدد التواريخ
      </div>

      <div class="bk-divider"></div>

      <div class="bk-period-wrap">
        <span class="bk-period-label-sm">⏰ الاستلام</span>
        <div class="bk-period-seg">
          <button id="rent-period-morning" class="bk-period-btn active" onclick="rental_setPeriod('morning')">
            <span class="period-icon">🌅</span> صباحاً
          </button>
          <button id="rent-period-evening" class="bk-period-btn" onclick="rental_setPeriod('evening')">
            <span class="period-icon">🌆</span> مساءً
          </button>
        </div>
      </div>

      <button id="rent-confirm-btn" class="bk-confirm-btn"
        onclick="rental_confirmDates('${productId}','${storeId}')">
        ✅ إضافة للسلة
      </button>
    </div>
  `);

  window.__rentModalPeriod = 'morning';
};

window.rental_setPeriod = function (p) {
  window.__rentModalPeriod = p;
  document.querySelectorAll('.bk-period-btn[id^="rent-period"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`rent-period-${p}`);
  if (btn) btn.classList.add('active');
};

window.rental_calcDuration = function () {
  const startEl = document.getElementById('rent-modal-start');
  const endEl   = document.getElementById('rent-modal-end');
  const durEl   = document.getElementById('rent-modal-duration');
  if (!startEl || !endEl || !durEl) return;
  const start = startEl.value;
  const end   = endEl.value;
  if (!start || !end) { durEl.textContent = 'حدد التواريخ لمعرفة المدة'; return; }
  if (end < start) {
    durEl.innerHTML = '⚠️ تاريخ الانتهاء يجب أن يكون بعد البداية';
    durEl.style.color = '#f43f5e';
    endEl.value = '';
    return;
  }
  durEl.style.color = '';
  const diff = Math.round((new Date(end) - new Date(start)) / 86400000);
  durEl.innerHTML = diff === 0
    ? '📌 يوم واحد'
    : `📆 ${diff} ${diff === 1 ? 'يوم' : diff < 11 ? 'أيام' : 'يوم'}`;
  if (endEl.min) endEl.min = start;
};

window.rental_confirmDates = function (productId, storeId) {
  const start  = document.getElementById('rent-modal-start')?.value;
  const end    = document.getElementById('rent-modal-end')?.value;
  if (!start) { toast('اختر تاريخ البداية', 'error'); return; }
  if (!end)   { toast('اختر تاريخ الانتهاء', 'error'); return; }
  if (end < start) { toast('تاريخ الانتهاء يجب أن يكون بعد البداية', 'error'); return; }

  const p     = (AppData.rentalProducts || []).find(x => x.id === productId);
  const store = (AppData.rentalStores   || []).find(x => x.id === storeId);
  if (!p || !store) return;

  const cartKey = `rental_${productId}`;
  const cart    = ph43_getCart();
  if (cart.find(i => i.productId === cartKey)) {
    toast('هذا المنتج موجود بالفعل في السلة', 'warning');
    return;
  }

  const period = window.__rentModalPeriod || 'morning';
  const diff   = Math.round((new Date(end) - new Date(start)) / 86400000);

  cart.push({
    productId: cartKey,
    rentalProductId: productId,
    storeId,
    type: 'rental',
    name: p.name,
    icon: '🏚️',
    image: p.imageBase64 || null,
    price: p.price || 0,
    qty: 1,
    storeName: store.name,
    taxPercent: store.taxPercent || 0,
    startDate: start,
    endDate: end,
    rentalDays: diff || 1,
    rentalPeriod: period,
  });

  ph43_setCart(cart);
  closeModal();

  const periodLabel = period === 'morning' ? 'صباحاً' : 'مساءً';
  toast(`✅ أُضيف "${p.name}" للسلة — ${diff || 1} ${diff===1?'يوم':'أيام'} (${periodLabel}) 🛒`, 'success');

  document.querySelectorAll(`[data-rental-cart-id="${productId}"]`).forEach(btn => {
    btn.innerHTML = `✅ <span>في السلة</span>`;
    btn.disabled = true;
    btn.style.opacity = '0.75';
  });
};

// ─── إضافة خدمة/مهنة للسلة ─────────────────────────────
window.svc_addToCart = function (svcId) {
  const u = State.currentUser;
  if (!u || u.role !== 'customer') { navigate('login'); return; }
  if (typeof checkAccountActive === 'function' && !checkAccountActive()) return;

  const svc = AppData.services.find(s => s.id === svcId);
  if (!svc) return;
  if (typeof ph48_isAvailable === 'function' && !ph48_isAvailable(svc)) {
    toast('هذه الخدمة غير متاحة للطلب حالياً', 'warning');
    return;
  }

  const cat = AppData.cats.find(c => c.id === svc.catId);
  const isProfession = cat?.section === 'professions' || cat?.section === 'services';

  const cartKey = `svc_${svcId}`;
  const cart    = ph43_getCart();
  if (cart.find(i => i.productId === cartKey)) {
    toast('هذه الخدمة موجودة بالفعل في السلة', 'warning');
    return;
  }

  if (!isProfession) {
    // Booking items → show date picker first
    svc_showBookingDateModal(svcId);
    return;
  }

  // Profession items → add directly, date asked at checkout
  cart.push({
    productId: cartKey,
    svcId,
    type: 'profession',
    name: svc.name,
    icon: svc.icon || '💼',
    price: svc.finalPrice || svc.price || 0,
    qty: 1,
    priceLabel: (!svc.finalPrice && !svc.price) ? 'السعر بعد المعاينة' : null,
    providerName: svc.providerName || svc.provider || '',
    providerUid: svc.providerUid || '',
    requiresDelivery: svc.requiresDelivery !== false,
    commonIssues: svc.commonIssues || [],
  });

  ph43_setCart(cart);
  toast(`✅ أُضيفت "${svc.name}" للسلة 🛒`, 'success');
  document.querySelectorAll(`[data-svc-cart-id="${svcId}"]`).forEach(btn => {
    btn.innerHTML = `✅ <span>في السلة</span>`;
    btn.disabled = true;
    btn.style.opacity = '0.75';
  });
};

// ─── إضافة منتج تأجير للسلة ─────────────────────────────
window.rental_addToCart = function (productId, storeId) {
  const u = State.currentUser;
  if (!u || u.role !== 'customer') { navigate('login'); return; }

  const p     = (AppData.rentalProducts || []).find(x => x.id === productId);
  const store = (AppData.rentalStores   || []).find(x => x.id === storeId);
  if (!p || !store) return;

  const cartKey = `rental_${productId}`;
  const cart    = ph43_getCart();
  if (cart.find(i => i.productId === cartKey)) {
    toast('هذا المنتج موجود بالفعل في السلة', 'warning');
    return;
  }

  // Always show date picker first for rentals
  rental_showDateModal(productId, storeId);
};

// ─── دالة جلب موقع المنتج من مزوديه ───────────────────────────
window.ph47_getProductLocationHtml = function(assignedVendors) {
  const vendors = assignedVendors || [];
  const locations = [...new Set(
    vendors.map(vid => {
      // البحث في users أولاً ثم pdb_entries
      const user  = (AppData.users||[]).find(u => u.id===vid || u.uid===vid);
      const entry = (AppData.pdbEntries||[]).find(e => e.linkedUserId===vid);
      const subzone = user?.subzoneName || entry?.subzoneName;
      const zone    = user?.zoneName    || entry?.zoneName;
      const gov     = user?.govName     || entry?.govName;
      if (!subzone) return null;
      const parts = [gov, zone, subzone].filter(Boolean);
      return parts.join(' › ');
    }).filter(Boolean)
  )];

  if (!locations.length) return '';
  return `
    <div style="display:flex;align-items:center;gap:4px;font-size:11px;
                color:var(--primary);font-weight:700;margin-top:3px;margin-bottom:3px" title="موقع المنتج">
      <span>📍 موقع المنتج:</span>
      <span>${locations.join(' | ')}</span>
    </div>`;
};

// ───────────────────────────────────────────────────────
// SECTION 2 — Cart Modal
// ───────────────────────────────────────────────────────
window.ph43_showCart = function () {
  const cart = ph43_getCart();
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">🛒 سلة التسوق</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div id="ph43-cart-body" style="max-height:60vh;overflow-y:auto;padding-right:2px"></div>
    <div id="ph43-cart-actions" style="margin-top:16px"></div>
  `);
  ph43_renderCartBody();
};

function ph43_renderCartBody() {
  const cart = ph43_getCart();
  const body = document.getElementById('ph43-cart-body');
  const acts = document.getElementById('ph43-cart-actions');
  if (!body) return;

  if (!cart.length) {
    body.innerHTML = `
      <div style="text-align:center;padding:52px 20px;color:var(--text-muted)">
        <div style="font-size:56px;margin-bottom:12px;opacity:0.5">🛒</div>
        <div style="font-size:16px;font-weight:800;margin-bottom:6px;color:var(--text-main)">السلة فارغة</div>
        <div style="font-size:13px;opacity:0.7">أضف خدمات أو منتجات أو حجوزات</div>
      </div>`;
    if (acts) acts.innerHTML = '';
    return;
  }

  const SECTIONS = [
    { type: 'booking',    icon: '📅', label: 'خدمات الحجز',             color: '#3b82f6', bg: 'rgba(59,130,246,0.07)',   border: 'rgba(59,130,246,0.18)',  hasQty: false },
    { type: 'profession', icon: '💼', label: 'الخدمات المتخصصة',        color: '#8b5cf6', bg: 'rgba(139,92,246,0.07)',  border: 'rgba(139,92,246,0.18)', hasQty: false },
    { type: 'rental',     icon: '🏚️', label: 'متاجر التأجير',            color: '#10b981', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.18)', hasQty: false },
    { type: 'store',      icon: '🏪', label: 'متاجر محجوز',              color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.18)', hasQty: true  },
  ];

  let html = '';

  SECTIONS.forEach(sec => {
    const items = cart.filter(i => (i.type || 'store') === sec.type);
    if (!items.length) return;

    const secTotal = items.reduce((s, i) => s + ((i.price || 0) * (i.qty || 1)), 0);
    const secTotalText = secTotal > 0 ? secTotal.toLocaleString('ar-YE') + ' ﷼' : '';

    html += `
    <div style="margin-bottom:14px;border-radius:14px;overflow:hidden;border:1px solid ${sec.border};box-shadow:0 2px 12px rgba(0,0,0,0.08)">
      <div style="background:${sec.bg};padding:9px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid ${sec.border}">
        <div style="width:30px;height:30px;border-radius:8px;background:${sec.color};display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">${sec.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:13px;color:${sec.color}">${sec.label}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:1px">${items.length} ${items.length === 1 ? 'عنصر' : 'عناصر'}${secTotalText ? ' · ' + secTotalText : ''}</div>
        </div>
      </div>`;

    if (sec.hasQty) {
      // متاجر محجوز — مجمّعة حسب المتجر
      const byStore = {};
      items.forEach(item => {
        const key = item.storeId || 'unknown';
        if (!byStore[key]) byStore[key] = { name: item.storeName || '', icon: item.storeIcon || '🏪', items: [] };
        byStore[key].items.push(item);
      });
      Object.values(byStore).forEach((g, gi) => {
        if (Object.keys(byStore).length > 1) {
          html += `<div style="padding:5px 14px;background:rgba(245,158,11,0.04);font-size:11px;font-weight:700;color:var(--text-muted);display:flex;align-items:center;gap:5px;border-bottom:1px solid var(--glass-border)"><span>${g.icon}</span>${escHtml(g.name)}</div>`;
        }
        g.items.forEach((item, ii) => {
          const lineTotal = (item.price * item.qty).toLocaleString('ar-YE');
          const unitPrice = item.price ? item.price.toLocaleString('ar-YE') : '';
          html += `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid var(--glass-border);background:var(--bg-card)">
            ${item.image
              ? `<img src="${item.image}" style="width:48px;height:48px;border-radius:10px;object-fit:cover;flex-shrink:0;border:1px solid var(--glass-border)">`
              : `<div style="width:48px;height:48px;border-radius:10px;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">📦</div>`}
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px">${escHtml(item.name)}</div>
              ${item.storeName ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">🏪 ${escHtml(item.storeName)}</div>` : ''}
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                ${unitPrice ? `<span style="font-size:11px;color:var(--text-muted)">${unitPrice} ﷼ × ${item.qty}</span>` : ''}
                <span style="font-weight:800;font-size:13px;color:#f59e0b">${lineTotal} ﷼</span>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
              <button onclick="ph43_changeQty('${item.productId}',-1)" style="width:28px;height:28px;border-radius:50%;border:1.5px solid var(--glass-border);background:var(--bg-secondary);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--text-main)">−</button>
              <span style="font-weight:800;min-width:20px;text-align:center;font-size:14px">${item.qty}</span>
              <button onclick="ph43_changeQty('${item.productId}',1)" style="width:28px;height:28px;border-radius:50%;border:none;background:var(--primary);color:#fff;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;font-weight:700">+</button>
              <button onclick="ph43_removeFromCart('${item.productId}')" style="width:28px;height:28px;border-radius:50%;border:1.5px solid rgba(244,63,94,0.4);background:rgba(244,63,94,0.07);color:#f43f5e;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;margin-inline-start:2px" title="إزالة">✕</button>
            </div>
          </div>`;
        });
      });

    } else {
      items.forEach(item => {
        const priceText  = item.priceLabel || (item.price ? item.price.toLocaleString('ar-YE') + ' ﷼' : 'السعر عند التواصل');
        const isPriceSet = !item.priceLabel && item.price;
        const periodLabel    = item.bookingPeriod === 'evening' ? '🌆 مساءً' : item.bookingPeriod === 'morning' ? '🌅 صباحاً' : item.bookingPeriod === 'fullday' ? '☀️ يوم كامل' : '';
        const rentPeriodLabel = item.rentalPeriod === 'evening'  ? '🌆 مساءً' : item.rentalPeriod === 'morning'  ? '🌅 صباحاً' : '';

        /* ── Booking card ── */
        if (item.type === 'booking') {
          const dates = item.bookingDates || [];
          const datesRow = dates.length
            ? dates.map(ds => `<span class="cart-date-badge">📅 ${bk_formatAr(ds)}</span>`).join('')
            : `<span style="font-size:11px;color:var(--text-muted);font-style:italic">لم تحدد تواريخ</span>`;
          html += `
          <div style="padding:12px 14px;border-top:1px solid ${sec.border};background:var(--bg-card)">
            <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
              <div style="width:44px;height:44px;border-radius:10px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.18);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${item.icon || '📅'}</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:13px;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(item.name)}</div>
                ${item.providerName ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">👤 ${escHtml(item.providerName)}</div>` : ''}
                <div style="display:flex;align-items:center;gap:6px">
                  <span style="font-weight:800;font-size:13px;color:#3b82f6">${priceText}</span>
                  ${isPriceSet && dates.length > 1 ? `<span style="font-size:10px;color:var(--text-muted)">× ${dates.length} أيام</span>` : ''}
                </div>
              </div>
              <button onclick="ph43_removeFromCart('${item.productId}')" style="width:26px;height:26px;border-radius:50%;border:1.5px solid rgba(244,63,94,0.35);background:rgba(244,63,94,0.07);color:#f43f5e;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0" title="إزالة">✕</button>
            </div>
            <div style="background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.14);border-radius:8px;padding:8px 10px">
              <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">المواعيد المحجوزة</div>
              <div class="cart-date-summary" style="margin-bottom:${periodLabel ? '6px' : '0'}">${datesRow}</div>
              ${periodLabel ? `<div style="margin-top:4px;display:flex;align-items:center;gap:4px"><span style="font-size:10px;color:var(--text-muted)">الوقت المفضل:</span><span class="cart-period-badge">${periodLabel}</span></div>` : ''}
            </div>
          </div>`;

        /* ── Rental card ── */
        } else if (item.type === 'rental') {
          const days = item.rentalDays || 1;
          const daysLabel = days === 1 ? 'يوم واحد' : days === 2 ? 'يومان' : `${days} أيام`;
          const totalRent = item.price ? (item.price * days).toLocaleString('ar-YE') + ' ﷼' : '';
          html += `
          <div style="padding:12px 14px;border-top:1px solid ${sec.border};background:var(--bg-card)">
            <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
              <div style="width:44px;height:44px;border-radius:10px;overflow:hidden;flex-shrink:0;border:1px solid rgba(16,185,129,0.2)">
                ${item.image
                  ? `<img src="${item.image}" style="width:44px;height:44px;object-fit:cover">`
                  : `<div style="width:44px;height:44px;background:rgba(16,185,129,0.1);display:flex;align-items:center;justify-content:center;font-size:22px">🏚️</div>`}
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:13px;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(item.name)}</div>
                ${item.storeName ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">🏪 ${escHtml(item.storeName)}</div>` : ''}
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <span style="font-size:11px;color:var(--text-muted)">${priceText} / يوم</span>
                  ${totalRent ? `<span style="font-weight:800;font-size:13px;color:#10b981">${totalRent} إجمالي</span>` : ''}
                </div>
              </div>
              <button onclick="ph43_removeFromCart('${item.productId}')" style="width:26px;height:26px;border-radius:50%;border:1.5px solid rgba(244,63,94,0.35);background:rgba(244,63,94,0.07);color:#f43f5e;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0" title="إزالة">✕</button>
            </div>
            ${item.startDate ? `
            <div style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.14);border-radius:8px;padding:8px 10px">
              <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">فترة الإيجار</div>
              <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;margin-bottom:${rentPeriodLabel ? '6px' : '0'}">
                <div style="background:var(--bg-secondary);border-radius:6px;padding:5px 8px;text-align:center">
                  <div style="font-size:9px;color:var(--text-muted);margin-bottom:1px">من</div>
                  <div style="font-size:11px;font-weight:700;color:var(--text-main)">${bk_formatAr(item.startDate)}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:center;gap:1px">
                  <div style="font-size:9px;color:var(--text-muted)">${daysLabel}</div>
                  <div style="width:24px;height:1px;background:rgba(16,185,129,0.4)"></div>
                  <span style="font-size:9px">🏷️</span>
                </div>
                <div style="background:var(--bg-secondary);border-radius:6px;padding:5px 8px;text-align:center">
                  <div style="font-size:9px;color:var(--text-muted);margin-bottom:1px">إلى</div>
                  <div style="font-size:11px;font-weight:700;color:var(--text-main)">${bk_formatAr(item.endDate)}</div>
                </div>
              </div>
              ${rentPeriodLabel ? `<div style="display:flex;align-items:center;gap:4px"><span style="font-size:10px;color:var(--text-muted)">وقت الاستلام:</span><span class="cart-period-badge">${rentPeriodLabel}</span></div>` : ''}
            </div>` : `<div style="font-size:11px;color:var(--text-muted);font-style:italic;text-align:center;padding:4px 0">لم تحدد فترة الإيجار</div>`}
          </div>`;

        /* ── Profession card ── */
        } else {
          html += `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-top:1px solid ${sec.border};background:var(--bg-card)">
            <div style="width:44px;height:44px;border-radius:10px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.18);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${item.icon || '💼'}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:13px;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(item.name)}</div>
              ${item.providerName ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">👤 ${escHtml(item.providerName)}</div>` : ''}
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span style="font-weight:800;font-size:13px;color:#8b5cf6">${priceText}</span>
                <span style="font-size:10px;background:rgba(139,92,246,0.1);color:#8b5cf6;border-radius:20px;padding:1px 7px;font-weight:700">مهنة متخصصة</span>
              </div>
              ${item.commonIssues && item.commonIssues.length ? `<div style="margin-top:5px;font-size:10px;color:var(--text-muted)">⚙️ ${item.commonIssues.slice(0,2).map(v=>escHtml(v)).join(' · ')}</div>` : ''}
            </div>
            <button onclick="ph43_removeFromCart('${item.productId}')" style="width:26px;height:26px;border-radius:50%;border:1.5px solid rgba(244,63,94,0.35);background:rgba(244,63,94,0.07);color:#f43f5e;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0" title="إزالة">✕</button>
          </div>`;
        }
      });
    }

    html += `</div>`;
  });

  // ملخص الإجمالي
  const total      = ph43_cartTotal();
  const totalItems = cart.length;
  const hasApprox  = cart.some(i => i.type === 'booking' || i.type === 'profession' || i.type === 'rental');

  html += `
  <div style="background:linear-gradient(135deg,rgba(139,92,246,0.07),rgba(139,92,246,0.02));border-radius:14px;border:1px solid rgba(139,92,246,0.18);padding:14px;margin-top:4px">
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px">ملخص الطلب</div>
    ${SECTIONS.filter(s => cart.some(i => (i.type||'store') === s.type)).map(s => {
      const sItems = cart.filter(i => (i.type||'store') === s.type);
      const sTotal = sItems.reduce((acc, i) => acc + ((i.price||0)*(i.qty||1)), 0);
      return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:5px"><span>${s.icon}</span>${s.label}</span>
        <span style="font-size:12px;font-weight:700;color:${s.color}">${sTotal > 0 ? sTotal.toLocaleString('ar-YE') + ' ﷼' : '—'}</span>
      </div>`;
    }).join('')}
    <div style="height:1px;background:rgba(139,92,246,0.15);margin:10px 0"></div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-weight:800;font-size:15px">الإجمالي</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:1px">${totalItems} ${totalItems === 1 ? 'عنصر' : 'عناصر'}</div>
      </div>
      <span style="font-weight:800;font-size:20px;background:var(--gradient-main);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${total.toLocaleString('ar-YE')} ﷼</span>
    </div>
    ${hasApprox ? `<div style="font-size:10px;color:var(--text-muted);margin-top:8px;padding:6px 8px;background:rgba(0,0,0,0.1);border-radius:6px">⚠️ أسعار الخدمات والمهن قد تخضع للتأكيد النهائي من المزود</div>` : ''}
  </div>
  ${typeof fs_getShippingHintHTML === 'function' ? fs_getShippingHintHTML(total, 'stores') : ''}`;

  body.innerHTML = html;

  if (acts) acts.innerHTML = `
    <div style="display:flex;gap:8px">
      <button class="btn btn-secondary" onclick="ph43_clearCart()" style="flex-shrink:0;font-size:13px;padding:10px 14px">🗑️ إفراغ</button>
      <button class="btn btn-primary btn-block btn-lg" onclick="ph43_proceedCheckout()" style="font-size:14px">💳 متابعة الدفع</button>
    </div>`;
}

// ───────────────────────────────────────────────────────
// SECTION 3 — Checkout Flow
// ───────────────────────────────────────────────────────
window.ph43_proceedCheckout = async function () {
  const cart = ph43_getCart();
  if (!cart.length) { toast('السلة فارغة', 'error'); return; }
  const u = State.currentUser;
  if (!u || u.role !== 'customer') { navigate('login'); return; }
  if (typeof checkAccountActive === 'function' && !checkAccountActive()) return;
  if (typeof checkMandatoryVerification === 'function' && !checkMandatoryVerification()) return;

  let savedAddresses = [];
  try { if (typeof ph41_loadAddresses === 'function') savedAddresses = await ph41_loadAddresses(); } catch (e) {}
  const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];

  // تصنيف العناصر
  const storeItems    = cart.filter(i => (i.type || 'store') === 'store');
  const bookingItems  = cart.filter(i => i.type === 'booking');
  const profItems     = cart.filter(i => i.type === 'profession');
  const rentalItems   = cart.filter(i => i.type === 'rental');

  // ملخص المواعيد (محددة مسبقاً من شاشة التاريخ)
  let schedulingHtml = '';

  if (bookingItems.length) {
    schedulingHtml += `
    <div style="margin-bottom:18px;padding:14px 16px;background:rgba(59,130,246,0.06);border:1.5px solid rgba(59,130,246,0.2);border-radius:14px">
      <div style="font-weight:800;font-size:13px;margin-bottom:10px;color:#3b82f6;display:flex;align-items:center;gap:6px">
        <span>📅</span> خدمات الحجز — مواعيدك المختارة
      </div>
      ${bookingItems.map(item => {
        const pLabel = item.bookingPeriod === 'evening' ? '🌆 مساءً' : item.bookingPeriod === 'morning' ? '🌅 صباحاً' : '☀️ يوم كامل';
        const dates  = (item.bookingDates || []).map(ds => `<span class="cart-date-badge" style="font-size:12px">📅 ${bk_formatAr(ds)}</span>`).join('');
        return `
        <div style="margin-bottom:8px;padding:10px 12px;background:var(--bg-card);border-radius:10px;border:1px solid var(--glass-border)">
          <div style="font-weight:700;margin-bottom:8px;font-size:13px">${item.icon || '📅'} ${escHtml(item.name)}</div>
          <div class="cart-date-summary" style="margin-bottom:6px">${dates}<span class="cart-period-badge">${pLabel}</span></div>
        </div>`;
      }).join('')}
    </div>`;
  }

  if (profItems.length) {
    schedulingHtml += `
    <div style="margin-bottom:18px;padding:14px 16px;background:rgba(139,92,246,0.06);border:1.5px solid rgba(139,92,246,0.2);border-radius:14px">
      <div style="font-weight:800;font-size:13px;margin-bottom:10px;color:#8b5cf6;display:flex;align-items:center;gap:6px"><span>💼</span> المهن — حدد المواعيد والتفاصيل</div>
      ${profItems.map(item => `
      <div style="margin-bottom:10px;padding:10px 12px;background:var(--bg-card);border-radius:10px;border:1px solid var(--glass-border)">
        <div style="font-weight:700;margin-bottom:8px;font-size:13px">${item.icon || '💼'} ${escHtml(item.name)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div><label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">📅 التاريخ</label>
            <input class="form-control" id="prof-date-${item.productId}" type="date" min="${new Date().toISOString().split('T')[0]}" style="font-size:13px;padding:6px 10px"></div>
          <div><label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">⏰ الوقت</label>
            <input class="form-control" id="prof-time-${item.productId}" type="time" style="font-size:13px;padding:6px 10px"></div>
        </div>
        <textarea class="form-control" id="prof-note-${item.productId}" placeholder="اشرح المشكلة أو متطلباتك..." rows="2" style="font-size:13px;resize:vertical"></textarea>
      </div>`).join('')}
    </div>`;
  }

  if (rentalItems.length) {
    schedulingHtml += `
    <div style="margin-bottom:18px;padding:14px 16px;background:rgba(16,185,129,0.06);border:1.5px solid rgba(16,185,129,0.2);border-radius:14px">
      <div style="font-weight:800;font-size:13px;margin-bottom:10px;color:#10b981;display:flex;align-items:center;gap:6px">
        <span>🏚️</span> التأجير — مواعيدك المختارة
      </div>
      ${rentalItems.map(item => {
        const days = item.rentalDays || 1;
        const daysLabel = days === 1 ? 'يوم واحد' : `${days} أيام`;
        const pLabel = item.rentalPeriod === 'evening' ? '🌆 مساءً' : '🌅 صباحاً';
        return `
        <div style="margin-bottom:8px;padding:10px 12px;background:var(--bg-card);border-radius:10px;border:1px solid var(--glass-border)">
          <div style="font-weight:700;margin-bottom:8px;font-size:13px">📦 ${escHtml(item.name)}
            <span style="font-size:11px;color:var(--text-muted);font-weight:400">${escHtml(item.storeName || '')}</span></div>
          <div class="cart-date-summary">
            <span class="cart-date-badge rental-badge">📅 ${bk_formatAr(item.startDate)} ← ${bk_formatAr(item.endDate)}</span>
            <span class="cart-date-badge rental-badge">📆 ${daysLabel}</span>
            <span class="cart-period-badge">${pLabel}</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  const bankHtml = (AppData.bankAccounts||[]).filter(b=>b.active!==false).map(b =>
    `<div style="font-size:13px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--border)">🏦 <strong>${b.bankName}</strong><br><span style="font-family:monospace;font-size:14px">${b.accountNumber}</span><br><span style="color:var(--text-muted)">اسم المستفيد: ${b.ownerName}</span></div>`
  ).join('');

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📋 إتمام الطلب${window.ui_helpBtn('checkout')}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(139,92,246,0.02));border-radius:14px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;gap:14px">
      <div style="font-size:32px">🛍️</div>
      <div>
        <div style="font-size:12px;color:var(--text-muted)">${cart.length} عنصر في السلة</div>
        <div style="font-weight:800;font-size:22px;color:var(--primary)">${ph43_cartTotal().toLocaleString('ar-YE')} ريال</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px">+ رسوم التوصيل إن وجدت</div>
      </div>
    </div>
    ${typeof fs_getShippingHintHTML === 'function' ? fs_getShippingHintHTML(ph43_cartTotal(), 'stores') : ''}

    ${schedulingHtml}

    ${typeof ph37_getDeliveryTypeSelectorHTML === 'function' ? ph37_getDeliveryTypeSelectorHTML('') : ''}
    <div id="cart-addr-wrapper">
      ${savedAddresses.length && typeof ph41_renderAddressSelector === 'function' ? ph41_renderAddressSelector(savedAddresses) : ''}
      <div class="form-group">
        <label class="form-label">📍 عنوان التوصيل${savedAddresses.length ? ' (أو أدخل جديداً)' : ''}</label>
        <input class="form-control" id="cart-addr" placeholder="المدينة، الحي، الشارع..."
               value="${defaultAddr ? escAttr(defaultAddr.address) : ''}"
               style="${defaultAddr ? 'display:none' : ''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">💬 ملاحظات عامة</label>
      <textarea class="form-control" id="cart-note" placeholder="أي تعليمات إضافية..." style="resize:vertical"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">💳 طريقة الدفع</label>
      <div class="bk-payment-grid">
        <button class="bk-pay-btn active" id="bk-pay-wallet" onclick="bkSelectPayment('wallet')"><div style="font-weight:700">المحفظة</div><div style="font-size:11px;color:var(--text-muted)" id="checkout-wallet-bal">جاري الجلب...</div></button>
        <button class="bk-pay-btn" id="bk-pay-cod" onclick="bkSelectPayment('cod')"><div style="font-weight:700">عند الاستلام</div><div style="font-size:11px;color:var(--text-muted)">+5 ريال</div></button>
        <button class="bk-pay-btn" id="bk-pay-bank" onclick="bkSelectPayment('bank_transfer')"><div style="font-weight:700">تحويل بنكي</div><div style="font-size:11px;color:var(--text-muted)">إيداع مسبق</div></button>
      </div>
      <div id="bk-bank-info" style="display:none;margin-top:14px;padding:12px;background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.2);border-radius:8px">
        <div style="font-weight:700;margin-bottom:8px;color:var(--primary)">يرجى التحويل إلى أحد الحسابات التالية:</div>
        ${bankHtml}
        <div style="font-size:12px;color:var(--text-muted);margin-top:8px">سيتم إكمال الطلب، يرجى إرفاق صورة الإيصال لاحقاً من صفحة طلباتي.</div>
      </div>
    </div>
    <button class="btn btn-primary btn-block btn-lg" style="margin-top:8px" onclick="ph43_confirmOrder()">✅ تأكيد الطلب</button>
  `);
  State.selectedPaymentMethod = 'wallet';
  State._deliveryType = 'delivery';
  if (u?.uid) {
    getBalance(u.uid).then(bal => {
      const el = document.getElementById('checkout-wallet-bal');
      if (el) el.innerText = bal + ' ريال متاح';
    }).catch(() => {});
  }
};

window.ph43_confirmOrder = async function () {
  const cart      = ph43_getCart();
  const addrEl    = document.getElementById('cart-addr');
  const addr      = addrEl?.value.trim() || (window.__ph41_addresses || []).find(a => a.isSelected)?.address || '';
  const note      = document.getElementById('cart-note')?.value.trim() || '';
  const u         = State.currentUser;
  const payMethod = State.selectedPaymentMethod || 'wallet';

  const storeItems   = cart.filter(i => (i.type || 'store') === 'store');
  const bookingItems = cart.filter(i => i.type === 'booking');
  const profItems    = cart.filter(i => i.type === 'profession');
  const rentalItems  = cart.filter(i => i.type === 'rental');

  // تحقق من التواريخ (booking/rental: محفوظة في العنصر، profession: من DOM)
  for (const item of bookingItems) {
    if (!item.bookingDates || item.bookingDates.length === 0) {
      toast(`يرجى اختيار تاريخ لخدمة: ${item.name}`, 'error'); return;
    }
  }
  for (const item of profItems) {
    if (!document.getElementById(`prof-date-${item.productId}`)?.value) {
      toast(`يرجى اختيار تاريخ لمهنة: ${item.name}`, 'error'); return;
    }
  }
  for (const item of rentalItems) {
    if (!item.startDate || !item.endDate) {
      toast(`يرجى تحديد فترة الإيجار لـ: ${item.name}`, 'error'); return;
    }
  }

  const deliveryType = State._deliveryType || 'delivery';
  const isPickup     = deliveryType === 'pickup';
  const needsAddr = !isPickup && (storeItems.length > 0 || bookingItems.some(i => i.requiresDelivery) || profItems.some(i => i.requiresDelivery));
  if (needsAddr && !addr) { toast('أدخل عنوان التوصيل', 'error'); return; }

  // ── رسوم التوصيل الذكية — تُحسب حسب موقع المزود الأقرب لحي العميل ──
  let deliveryFee    = 0;
  let vendorFeeMap   = {};  // { vendorId: fee }
  let vendorSubzones = {};

  // احصل على حي العميل من العنوان المختار
  const selectedAddr     = (window.__ph41_addresses || []).find(a => a.address === addr);
  const customerSubzone  = window.__ph41_selectedSubzone?.subzoneName
                        || selectedAddr?.subzoneName
                        || '';
  const customerZone     = window.__ph41_selectedSubzone?.zoneName
                        || selectedAddr?.zoneName
                        || '';
  const customerGovId    = window.__ph41_selectedSubzone?.govId
                        || selectedAddr?.govId
                        || '';
  const customerGov      = window.__ph41_selectedSubzone?.govName
                        || selectedAddr?.govName
                        || '';

  if (!isPickup && storeItems.length && typeof ph47_calculateMultiVendorDeliveryFee === 'function' && customerSubzone) {
    // ── المنطق الجديد: أقل سعر توصيل من حي المزود إلى حي العميل ──
    const enrichedItems = storeItems.map(i => {
      const p = (AppData.storeProducts || []).find(sp => sp.id === i.productId);
      return { ...i, assignedVendors: p?.assignedVendors || [] };
    });
    const result = ph47_calculateMultiVendorDeliveryFee(enrichedItems, customerSubzone);
    deliveryFee    = result.totalFee;
    vendorFeeMap   = result.vendorFees;
    vendorSubzones = result.vendorSubzones;
    if (!Object.keys(vendorFeeMap).length) {
      // لا يوجد مزود بحي محدد → استخدم السعر الافتراضي
      deliveryFee = AppData.platformSettings?.deliveryFee || 0;
      if (storeItems.length) toast('⚠️ لم يُحدَّد موقع المزود، سيُستخدم السعر الافتراضي للتوصيل', 'warning');
    }
  } else if (!isPickup && storeItems.length && typeof dp_calculateFee === 'function' && !customerSubzone) {
    // ── احتياطي: إذا لم يختر العميل حياً → استخدم السعر الافتراضي ──
    deliveryFee = AppData.platformSettings?.deliveryFee || 0;
    if (storeItems.length) toast('⚠️ لم يُحدَّد حي العميل، سيُستخدم السعر الافتراضي للتوصيل', 'warning');
  } else if (!isPickup && storeItems.length) {
    deliveryFee = AppData.platformSettings?.deliveryFee || 0;
  }

  const codFee   = payMethod === 'cod' ? 5 : 0;

  // ── التوصيل المجاني للمتاجر ───────────────────────────────────
  const _storeSubtotal = ph43_cartTotal();
  if (deliveryFee > 0 && typeof fs_isFreeShipping === 'function' && fs_isFreeShipping(_storeSubtotal, 'stores')) {
    deliveryFee = 0;
    toast('🎉 مبروك! حصلت على توصيل مجاني', 'success');
  }

  const grandTotal = _storeSubtotal + deliveryFee + codFee;

  if (payMethod === 'wallet') {
    const bal = await getBalance(u.uid);
    if (bal < grandTotal) {
      toast(`رصيدك (${bal} ريال) غير كافٍ. المطلوب: ${grandTotal} ريال`, 'error');
      closeModal(); navigate('wallet'); return;
    }
  }

  showLoader('جاري تأكيد الطلبات...');
  const orderIds = [];

  try {
    const matchedAddr = (window.__ph41_addresses || []).find(a => a.address === addr);
    const housePics   = matchedAddr ? (matchedAddr.pics || []) : (u.housePics || []);

    // ── طلبات متاجر محجوز ─────────────────────────────
    if (storeItems.length) {
      const orderId    = await generateOrderId();
      const storeSubtotal = storeItems.reduce((s, i) => s + i.price * i.qty, 0);
      const storeNames = [...new Set(storeItems.map(i => i.storeName))].join(' & ');
      await fsAdd('orders', {
        orderId, type: 'store_order',
        items: storeItems.map(i => ({ productId: i.productId, name: i.name, qty: i.qty, price: i.price, storeId: i.storeId, storeName: i.storeName, _bestVendorId: i._bestVendorId || null })),
        svcName: `طلب متاجر: ${storeNames}`, svcIcon: '🏪',
        servicePrice: storeSubtotal, deliveryFee, codFee,
        total: storeSubtotal + deliveryFee + codFee,
        paymentMethod: payMethod,
        customerId: u.uid, customerName: u.name, customerAddr: isPickup ? '' : addr,
        customerSubzone, customerZone, customerGov, customerGovId,
        vendorDeliveryMap: vendorFeeMap,
        vendorId: null, vendorName: storeNames,
        driverId: null, driverName: null,
        deliveryType: isPickup ? 'pickup' : 'delivery',
        note, status: 'pending', housePics,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        orderRegionId: State.currentUser?.regionId || u?.regionId || null,
      });
      if (payMethod === 'wallet') await deductWallet(u.uid, storeSubtotal + deliveryFee + codFee, `طلب متاجر: ${orderId}`, orderId);
      orderIds.push(orderId);
    }

    // ── طلبات خدمات الحجز ────────────────────────────
    for (const item of bookingItems) {
      const svc    = AppData.services.find(s => s.id === item.svcId);
      const dates  = item.bookingDates || [];
      const period = item.bookingPeriod || 'morning';
      const periodLabel = period === 'evening' ? 'مساءً' : period === 'morning' ? 'صباحاً' : 'يوم كامل';
      const orderId = await generateOrderId();
      await fsAdd('orders', {
        orderId, type: 'booking_order',
        svcId: item.svcId, svcName: item.name, svcIcon: item.icon || '📅',
        providerUid: item.providerUid || svc?.providerUid || '',
        providerName: item.providerName || svc?.providerName || '',
        vendorId: item.providerUid || svc?.providerUid || '',
        customerId: u.uid, customerName: u.name, customerAddr: isPickup ? '' : addr,
        customerSubzone, customerZone, customerGov, customerGovId,
        userId: u.uid, userName: u.name,
        servicePrice: item.price || 0, total: item.price || 0,
        paymentMethod: payMethod,
        date: dates[0] || '',
        dates,
        period,
        time: periodLabel,
        note,
        requiresDelivery: item.requiresDelivery,
        deliveryType: isPickup ? 'pickup' : 'delivery',
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        orderRegionId: State.currentUser?.regionId || u?.regionId || null,
      });
      if (payMethod === 'wallet' && item.price) await deductWallet(u.uid, item.price, `حجز خدمة: ${orderId}`, orderId);
      orderIds.push(orderId);
    }

    // ── طلبات المهن ──────────────────────────────────
    for (const item of profItems) {
      const date     = document.getElementById(`prof-date-${item.productId}`)?.value || '';
      const time     = document.getElementById(`prof-time-${item.productId}`)?.value || '';
      const profNote = document.getElementById(`prof-note-${item.productId}`)?.value.trim() || note;
      const orderId  = await generateOrderId();
      await fsAdd('orders', {
        orderId, type: 'profession_order',
        svcId: item.svcId, svcName: item.name, svcIcon: item.icon || '💼',
        providerUid: item.providerUid || '',
        providerName: item.providerName || '',
        vendorId: item.providerUid || '',
        customerId: u.uid, customerName: u.name, customerAddr: addr,
        customerSubzone, customerZone, customerGov, customerGovId,
        userId: u.uid, userName: u.name,
        servicePrice: 0, total: 0,
        paymentMethod: payMethod,
        date, time, note: profNote,
        isProfession: true,
        requiresDelivery: item.requiresDelivery,
        status: 'pending_inspection',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        orderRegionId: State.currentUser?.regionId || u?.regionId || null,
      });
      orderIds.push(orderId);
    }

    // ── طلبات التأجير ────────────────────────────────
    for (const item of rentalItems) {
      const startDate  = item.startDate || '';
      const endDate    = item.endDate   || '';
      const rentalDays = item.rentalDays || 1;
      const period     = item.rentalPeriod || 'morning';
      const tax        = Math.round(item.price * (item.taxPercent || 0) / 100);
      const rentalTotal = item.price + tax;
      const orderId    = await generateOrderId();
      await fsAdd('orders', {
        orderId, type: 'rental_order',
        rentalProductId: item.rentalProductId,
        svcName: item.name, svcIcon: '🏚️',
        storeName: item.storeName, storeId: item.storeId,
        customerId: u.uid, customerName: u.name, customerAddr: addr,
        customerSubzone, customerZone, customerGov, customerGovId,
        servicePrice: item.price, taxAmount: tax, total: rentalTotal,
        paymentMethod: payMethod,
        startDate, endDate, rentalDays, period, note,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        orderRegionId: State.currentUser?.regionId || u?.regionId || null,
      });
      if (payMethod === 'wallet') await deductWallet(u.uid, rentalTotal, `حجز تأجير: ${orderId}`, orderId);
      orderIds.push(orderId);
    }

    ph43_setCart([]);
    hideLoader(); closeModal();
    const count = orderIds.length;
    toast(`✅ تم تأكيد ${count > 1 ? count + ' طلبات' : 'الطلب'} بنجاح!`, 'success');
    await navigate('myorders');
  } catch (e) {
    hideLoader();
    console.error('[Cart] خطأ في تأكيد الطلبات:', e);
    toast('حدث خطأ: ' + (e.message || e), 'error');
  }
};

// ───────────────────────────────────────────────────────
// SECTION 4 — Customer: Store Listing Page
// ───────────────────────────────────────────────────────
// ── دالة تبديل طريقة عرض المتاجر (مع إعادة تحميل البيانات) ──
window.ph43_setView = function(v) {
  State.ph43StoreView = v;
  window._forceDataReload = true;   // أجبر على تحديث المتاجر من Firebase
  if (typeof window.render === 'function') window.render();
};

window.ph43_renderStoresList = function () {
  // Support native routing / phone back button for digital stores
  if (State.params?.digital === 'cats' && typeof ph45_renderDigitalStorefront === 'function') {
    return ph45_renderDigitalStorefront();
  }
  if (State.params?.digital === 'cat' && State.params?.catId && typeof ph45_renderDigitalCat === 'function') {
    return ph45_renderDigitalCat(State.params.catId);
  }
  if (State.params?.digital === 'store' && State.params?.storeId && typeof ph45_renderDigitalStore === 'function') {
    return ph45_renderDigitalStore(State.params.storeId);
  }

  const _regionId = State.currentUser?.regionId;
  const _govId    = State.currentUser?.govId;
  const filter = State.activeSidebarFilter || 'all';

  let stores = (AppData.stores || []).filter(s => {
    if (s.active === false) return false;
    if (!_regionId && !_govId) return true;
    return typeof ph_matchesLocation === 'function'
      ? ph_matchesLocation(s, _regionId, _govId)
      : (!_regionId || !s.regionId || s.regionId === _regionId);
  });

  if (filter === 'nearby') {
    // Leave stores empty when selecting nearby as requested by the user
    stores = [];
  } else if (filter === 'new') {
    stores = stores.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
  } else if (filter === 'favorites') {
    const favs = typeof ph18_getFavorites === 'function' ? ph18_getFavorites() : [];
    stores = stores.filter(s => favs.includes(s.id));
  }

  const view = State.ph43StoreView || 'grid';

  return `<div id="app-content">
    <div class="page-header" style="padding-bottom:12px">
      <button class="back-btn" onclick="navigate('home')">→ رجوع</button>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <h1 style="margin:0">🏪 المتاجر والصيدليات${window.ui_helpBtn('listing_stores')}</h1>
          <p style="color:var(--text-secondary);margin:4px 0 0;font-size:13px">${stores.length} متجر متاح</p>
        </div>
        <!-- أزرار طريقة العرض -->
        <div class="ph43-view-toggle">
          <button class="ph43-vtbtn${view==='grid'?' active':''}" onclick="ph43_setView('grid')" title="مربعات">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>
            <span>مربعات</span>
          </button>
          <button class="ph43-vtbtn${view==='list'?' active':''}" onclick="ph43_setView('list')" title="قائمة">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="3" rx="1.5"/><rect x="1" y="6.5" width="14" height="3" rx="1.5"/><rect x="1" y="11" width="14" height="3" rx="1.5"/></svg>
            <span>قائمة</span>
          </button>
          <button class="ph43-vtbtn${view==='slideshow'?' active':''}" onclick="ph43_setView('slideshow')" title="شرائح">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="9" rx="2"/><rect x="4" y="13" width="8" height="2" rx="1"/></svg>
            <span>شرائح</span>
          </button>
        </div>
      </div>
    </div>
    <div class="sec-layout">
      ${typeof renderSectionSidebar === 'function' ? renderSectionSidebar() : ''}
      <main class="sec-main">
        <div class="search-wrap" style="margin-bottom:20px;">
          <div class="search-box" style="padding:0; border:none; background:transparent">
            <input class="search-input" id="stores-search" oninput="ph43_filterStores()" placeholder="ابحث عن متجر..." style="border-radius:12px">
            <span class="search-icon" style="right:16px; left:auto">🔍</span>
          </div>
        </div>

        <!-- ⚡ بطاقة النظام الرقمي ⚡ -->
        ${(AppData.digitalStoreCats && AppData.digitalStoreCats.length > 0) ? `
        <div onclick="navigate('stores', { digital: 'cats' })" style="background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(99,102,241,0.04));border:1px solid var(--glass-border);border-radius:16px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:14px;cursor:pointer;transition:all 0.2s" class="hover-scale">
          <div style="width:48px;height:48px;background:linear-gradient(135deg,var(--primary),#c4b5fd);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;box-shadow:0 6px 16px rgba(139,92,246,0.3);flex-shrink:0">⚡</div>
          <div style="flex:1">
            <div style="font-weight:800;font-size:15px;margin-bottom:2px">الشحن والمنتجات الرقمية</div>
            <div style="font-size:12px;color:var(--text-secondary)">رصيد · كروت شبكات · تسديد · وأكثر</div>
          </div>
          <div style="color:var(--primary);font-size:18px">←</div>
        </div>` : ''}

        ${stores.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🏪</div>
          <div class="empty-title">${filter==='nearby'?'المتاجر لا تدعم خاصية الموقع حالياً':'لا توجد متاجر متاحة'}</div>
          <div class="empty-sub">${filter==='nearby'?'سيتم تفعيلها في التحديثات القادمة':'ترقبوا إضافة المزيد قريباً'}</div>
        </div>` :
        view === 'grid' ? `<div class="ph43-stores-grid" id="stores-grid">${stores.map(s=>ph43_renderStoreCard(s)).join('')}</div>` :
        view === 'list' ? `<div class="ph43-stores-list" id="stores-grid">${stores.map(s=>ph43_renderStoreListItem(s)).join('')}</div>` :
        ph43_renderSlideshowView(stores)
        }
      </main>
    </div>
  </div>`;
};

window.ph43_filterStores = function () {
  const q = document.getElementById('stores-search')?.value.toLowerCase() || '';
  document.querySelectorAll('.ph43-store-card, .ph43-store-list-item, .ph43-sl-card').forEach(c => {
    c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
};

function ph43_renderStoreListItem(s) {
  const prodCount = (AppData.storeProducts||[]).filter(p=>p.storeId===s.id&&p.active!==false).length;
  return `
  <div class="ph43-store-list-item" onclick="navigate('store',{storeId:'${s.id}'})">
    <div class="ph43-list-logo">
      ${s.logoBase64 ? `<img src="${s.logoBase64}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:12px">` : `<span style="font-size:26px">${s.icon||'🏪'}</span>`}
    </div>
    <div class="ph43-list-info">
      <div class="ph43-list-name">${escHtml(s.name)}</div>
      ${s.desc ? `<div class="ph43-list-desc">${escHtml(s.desc.length>65?s.desc.substring(0,65)+'…':s.desc)}</div>` : ''}
      <div class="ph43-list-meta">
        <span>📦 ${prodCount} منتج</span>
        ${s.deliveryTime ? `<span>🚗 ${escHtml(s.deliveryTime)}</span>` : ''}
        ${s.active===false ? `<span style="color:#ef4444">⏸️ مغلق</span>` : '<span style="color:#10b981">✅ مفتوح</span>'}
      </div>
    </div>
    <div class="ph43-list-arrow">←</div>
  </div>`;
}

function ph43_renderSlideshowView(stores) {
  if (!stores.length) return `<div class="empty-state"><div class="empty-icon">🏪</div><div class="empty-title">لا توجد متاجر</div></div>`;

  // ألوان تلقائية للتصنيفات التي لا تملك صورة
  const palettes = [
    ['#7c3aed','#a855f7'],['#0891b2','#06b6d4'],['#059669','#10b981'],
    ['#d97706','#f59e0b'],['#dc2626','#ef4444'],['#db2777','#ec4899'],
  ];

  return `<div class="ph43-slideshow-view">
    ${stores.map((s, idx) => {
      const cats = (AppData.storeCats||[]).filter(c=>c.storeId===s.id).sort((a,b)=>(a.order||0)-(b.order||0));
      const prodCount = (AppData.storeProducts||[]).filter(p=>p.storeId===s.id&&p.active!==false).length;
      const [c1, c2] = palettes[idx % palettes.length];
      const isOpen = s.active !== false;

      return `
      <div class="ph43-sl-card">

        <!-- ══ رأس البطاقة (صورة أو تدرج) ══ -->
        <div class="ph43-sl-head" style="${s.bannerBase64 ? '' : `background:linear-gradient(135deg,${c1},${c2})`}"
             onclick="navigate('store',{storeId:'${s.id}'})">
          ${s.bannerBase64
            ? `<img src="${s.bannerBase64}" class="ph43-sl-banner" alt="">`
            : `<span class="ph43-sl-icon-big">${s.icon||'🏪'}</span>`}
          <div class="ph43-sl-head-overlay"></div>

          <!-- شارة الحالة -->
          <span class="ph43-sl-badge ${isOpen?'open':'closed'}">${isOpen?'✅ مفتوح':'⏸️ مغلق'}</span>

          <!-- معلومات المتجر -->
          <div class="ph43-sl-info">
            <div class="ph43-sl-avatar" style="border-color:${c1}33">
              ${s.logoBase64
                ? `<img src="${s.logoBase64}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`
                : `<span style="font-size:22px">${s.icon||'🏪'}</span>`}
            </div>
            <div style="flex:1;min-width:0">
              <div class="ph43-sl-name">${escHtml(s.name)}</div>
              ${s.desc ? `<div class="ph43-sl-desc">${escHtml(s.desc.length>55?s.desc.substring(0,55)+'…':s.desc)}</div>` : ''}
            </div>
          </div>
        </div>

        <!-- ══ الأقسام الداخلية + زر عرض الكل ══ -->
        <div class="ph43-sl-body">
          <div class="ph43-sl-body-top">
            <span class="ph43-sl-body-label">
              📦 ${cats.length ? cats.length + ' قسم' : prodCount + ' منتج'}
            </span>
            <button class="ph43-sl-showall" style="--accent:${c1}"
                    onclick="navigate('store',{storeId:'${s.id}'})">
              عرض الكل ←
            </button>
          </div>

          ${cats.length ? `
          <div class="ph43-sl-chips-scroll">
            ${cats.map(c => {
              const cnt = (AppData.storeProducts||[]).filter(p=>p.storeId===s.id&&p.catId===c.id&&p.active!==false).length;
              return `<button class="ph43-sl-chip"
                              style="border-color:${c1}55;background:${c1}14;"
                              onmouseover="this.style.background='${c1}28';this.style.borderColor='${c1}99';this.style.color='${c1}'"
                              onmouseout="this.style.background='${c1}14';this.style.borderColor='${c1}55';this.style.color=''"
                              onclick="State.storeActiveCat='${c.id}';navigate('store',{storeId:'${s.id}'})">
                <span class="ph43-sl-chip-ic">${c.icon||'📦'}</span>
                <span>${escHtml(c.name)}</span>
                <span class="ph43-sl-chip-cnt">${cnt}</span>
              </button>`;
            }).join('')}
          </div>` : `
          <p class="ph43-sl-no-cats">اضغط عرض الكل لتصفح المنتجات</p>`}
        </div>

      </div>`;
    }).join('')}
  </div>`;
}

function ph43_renderStoreCard(s) {
  const prodCount = (AppData.storeProducts || []).filter(p => p.storeId === s.id && p.active !== false).length;
  return `
  <div class="ph43-store-card" onclick="navigate('store',{storeId:'${s.id}'})">
    <div class="ph43-store-card-header">
      ${s.bannerBase64
        ? `<img src="${s.bannerBase64}" class="ph43-store-banner" alt="">`
        : `<div class="ph43-store-banner-placeholder">${s.icon || '🏪'}</div>`}
      <div class="ph43-store-card-avatar">
        ${s.logoBase64 ? `<img src="${s.logoBase64}" alt="">` : (s.icon || '🏪')}
      </div>
    </div>
    <div class="ph43-store-card-body">
      <div class="ph43-store-name">${escHtml(s.name)}</div>
      ${s.desc ? `<div class="ph43-store-desc">${escHtml(s.desc)}</div>` : ''}
      <div class="ph43-store-meta">
        <span>📦 ${prodCount} منتج</span>
        ${s.deliveryTime ? `<span>🚗 ${escHtml(s.deliveryTime)}</span>` : '<span>🚗 توصيل متاح</span>'}
      </div>
      <div style="display:flex; gap:8px; align-items:center; margin-top:8px;">
        <button class="btn btn-primary ph43-store-btn" style="flex:1; margin:0;">تسوق الآن ←</button>
        <button class="btn-share" onclick="event.stopPropagation(); ph34_shareItem('store', '${s.id}')" title="مشاركة المتجر" style="padding: 8px 12px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
        </button>
      </div>
    </div>
  </div>`;
}

// ───────────────────────────────────────────────────────
// SECTION 5 — Customer: Individual Store Page
// ───────────────────────────────────────────────────────
window.ph43_renderStorePage = function () {
  const { storeId } = State.params;
  const store = (AppData.stores || []).find(s => s.id === storeId);
  if (!store) return `<div id="app-content"><div class="empty-state"><div class="empty-icon">🏪</div><div class="empty-title">المتجر غير موجود</div></div></div>`;

  const cats      = (AppData.storeCats || []).filter(c => c.storeId === storeId).sort((a, b) => (a.order || 0) - (b.order || 0));
  const activeCat = State.storeActiveCat || null;
  let products    = (AppData.storeProducts || []).filter(p => p.storeId === storeId && p.active !== false);
  if (activeCat) products = products.filter(p => p.catId === activeCat);

  const cartCount = ph43_cartCount();
  const u         = State.currentUser;

  // Refresh cart badges after render
  setTimeout(() => {
    ph43_getCart().forEach(item => {
      const baseId = item.productId.split('_')[0];
      ph43_refreshProductBtn(baseId);
    });
    ph43_updateCartBadge();

    // Handle deep link / product details modal trigger on page load
    if (State.params && State.params.productId) {
      const pid = State.params.productId;
      delete State.params.productId;
      if (typeof ph43_showProductDetails === 'function') {
        ph43_showProductDetails(pid, storeId);
      }
    }
  }, 100);

  return `<div id="app-content" style="padding:0;">
    <!-- Store Hero Redesigned -->
    <div class="ph43-store-hero">
      <div class="ph43-store-hero-bg">
        ${store.bannerBase64
          ? `<img src="${store.bannerBase64}" class="ph43-store-hero-img" alt="">`
          : `<div class="ph43-store-hero-gradient"></div>`}
        <div class="ph43-store-hero-overlay"></div>
      </div>
      <div class="ph43-store-hero-content">
        <div class="ph43-store-hero-nav">
          <button class="ph43-hero-back-btn" onclick="State.storeActiveCat=null;navigate('listing',{section:'stores'})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><polyline points="15 18 9 12 15 6"></polyline></svg>
            رجوع
          </button>
          <div style="display:flex;gap:8px;align-items:center">
            ${cartCount > 0 ? `<button class="ph43-hero-cart-btn" onclick="ph43_showCart()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              ${cartCount}
            </button>` : ''}
            <button class="ph43-hero-share-btn" onclick="ph34_shareItem('store', '${store.id}')" title="مشاركة المتجر">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            </button>
          </div>
        </div>
        <div class="ph43-store-hero-identity">
          <div class="ph43-store-hero-logo">
            ${store.logoBase64 ? `<img src="${store.logoBase64}" alt="">` : (store.icon || '🏪')}
          </div>
          <div class="ph43-store-hero-text">
            <h1 class="ph43-store-hero-name">${escHtml(store.name)}</h1>
            ${store.desc ? `<p class="ph43-store-hero-desc">${escHtml(store.desc)}</p>` : ''}
            <div class="ph43-store-hero-badges">
              <span class="ph43-store-hero-badge">📦 ${products.length} منتج</span>
              ${store.deliveryTime ? `<span class="ph43-store-hero-badge">🚗 ${escHtml(store.deliveryTime)}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Category Tabs Bar (Horizontal) -->
    ${cats.length ? `
    <div class="ph43-cat-tabs-bar">
      <div class="ph43-cat-tabs-scroll">
        <button class="ph43-cat-tab${!activeCat ? ' active' : ''}" onclick="State.storeActiveCat=null;render()">
          الكل
          <span class="ph43-cat-tab-count">${(AppData.storeProducts || []).filter(p => p.storeId === storeId && p.active !== false).length}</span>
        </button>
        ${cats.map(c => {
          const cnt = (AppData.storeProducts || []).filter(p => p.storeId === storeId && p.catId === c.id && p.active !== false).length;
          return `<button class="ph43-cat-tab${activeCat === c.id ? ' active' : ''}" onclick="State.storeActiveCat='${c.id}';render()">
            ${escHtml(c.name)}
            <span class="ph43-cat-tab-count">${cnt}</span>
          </button>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Products Section -->
    <div class="ph43-products-section">
      <div class="ph43-products-topbar">
        <div class="ph43-products-title">
          ${activeCat ? escHtml(cats.find(c => c.id === activeCat)?.name || 'المنتجات') : 'جميع المنتجات'}
          <span class="ph43-products-count">${products.length}</span>
        </div>
        <div class="ph43-search-inline">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;color:var(--text-muted)"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input id="prod-search" oninput="ph43_filterProducts()" placeholder="ابحث في المنتجات...">
        </div>
      </div>

      ${products.length ? `
      <div class="ph43-product-grid" id="ph43-prod-grid">
        ${products.map(p => ph43_renderProductCard(p, storeId, u)).join('')}
      </div>` : `
      <div class="empty-state" style="padding:80px 0">
        <div class="empty-icon">📦</div>
        <div class="empty-title">لا توجد منتجات ${activeCat ? 'في هذا القسم' : ''}</div>
        <div class="empty-desc">جرّب قسماً آخر أو تحقق لاحقاً</div>
      </div>`}
    </div>

    <!-- Sticky Cart Bar -->
    ${cartCount > 0 ? `
    <div class="ph43-sticky-cart" onclick="ph43_showCart()">
      <div style="display:flex;align-items:center;gap:8px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
        <strong>${cartCount}</strong> منتج في السلة
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-weight:800">
        ${(ph43_cartTotal() + 15).toLocaleString('ar-YE')} ريال
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </div>
    </div>` : ''}
  </div>`;
};

window.ph43_renderProductCard = function(p, storeId, u) {
  // ── نظام التنبيهات (ph48) ─────────────────────────────────────────
  const alertBadgeHtml = typeof ph48_badgeHtml          === 'function' ? ph48_badgeHtml(p)           : '';
  const stockChipHtml  = typeof ph48_stockChipHtml       === 'function' ? ph48_stockChipHtml(p)        : '';
  const prodUnavail    = typeof ph48_unavailOverlayHtml  === 'function' ? ph48_unavailOverlayHtml(p)  : '';
  const isProdAvail    = typeof ph48_isAvailable         === 'function' ? ph48_isAvailable(p)         : true;

  const hasTiers = p.tiers && p.tiers.length > 0;
  const cartItems = ph43_getCart().filter(i => i.productId === p.id || i.productId.startsWith(p.id + '_'));
  const inCartQty = cartItems.reduce((sum, item) => sum + item.qty, 0);
  // عدد المشترين من هذا المنتج
  const buyCount = (AppData.orders||[]).filter(o =>
    o.status !== 'cancelled' &&
    Array.isArray(o.items) && o.items.some(i => i.productId === p.id)
  ).length;

  const activeOffer = typeof ph_getActiveOffer === 'function' ? ph_getActiveOffer(p.id) : null;
  const offerPct = activeOffer ? (activeOffer.discountPercent || (activeOffer.originalPrice > 0 ? Math.round(((activeOffer.originalPrice - activeOffer.discountedPrice) / activeOffer.originalPrice) * 100) : 0)) : 0;

  let priceHtml = '';
  if (activeOffer && typeof ph_offerPriceHtml === 'function') {
    const fallback = hasTiers
      ? `<div class="ph-price-block"><span class="ph-price-label">يبدأ من</span><span class="ph-price-num">${Math.min(...p.tiers.map(t => t.price || 0)).toLocaleString('ar-YE')}</span><span class="ph-price-cur">ريال</span></div>`
      : `<div class="ph-price-block"><span class="ph-price-num">${(p.price || 0).toLocaleString('ar-YE')}</span><span class="ph-price-cur">ريال</span></div>`;
    priceHtml = ph_offerPriceHtml(activeOffer, fallback);
  } else if (hasTiers) {
    const minPrice = Math.min(...p.tiers.map(t => t.price || 0));
    priceHtml = `<div class="ph-price-block"><span class="ph-price-label">يبدأ من</span><span class="ph-price-num">${minPrice.toLocaleString('ar-YE')}</span><span class="ph-price-cur">ريال</span></div>`;
  } else {
    priceHtml = `<div class="ph-price-block"><span class="ph-price-num">${(p.price || 0).toLocaleString('ar-YE')}</span><span class="ph-price-cur">ريال</span></div>`;
  }

  let btnHtml = '';
  if (u?.role === 'customer') {
    if (!isProdAvail) {
      btnHtml = `<button class="ph43-add-cart-btn ia-btn-disabled" style="background:rgba(100,116,139,0.3)">
        🚭 <span>${(p.stockStatus === 'out_of_stock') ? 'نفذت الكمية' : (p.stockStatus === 'coming_soon') ? 'قريباً' : 'غير متاح'}</span>
      </button>`;
    } else if (hasTiers) {
      btnHtml = `<button class="ph43-add-cart-btn${inCartQty > 0 ? ' in-cart' : ''}" style="background:linear-gradient(135deg,#8b5cf6,#6d28d9)" onclick="ph43_showProductDetails('${p.id}','${storeId}')">
        🛒 <span>${inCartQty > 0 ? `${inCartQty} في السلة` : 'اختر الفئة'}</span>
      </button>`;
    } else {
      btnHtml = `<button class="ph43-add-cart-btn${inCartQty > 0 ? ' in-cart' : ''}" data-ph43-pid="${p.id}" onclick="ph43_addToCart('${p.id}','${storeId}')">
        🛒 <span>${inCartQty > 0 ? `${inCartQty} في السلة` : 'أضف للسلة'}</span>
      </button>`;
    }
  } else if (u?.role === 'guest') {
    btnHtml = `<button class="ph43-add-cart-btn" onclick="navigate('login')">سجل للشراء</button>`;
  }

  const waNumStore = (AppData.platformSettings?.whatsappNumberStores || AppData.platformSettings?.whatsappNumber || '').replace(/\D/g,'');
  const waUrlStore = waNumStore
    ? `https://wa.me/${waNumStore}?text=${encodeURIComponent('أهلاً، أريد الاستفسار عن المنتج: ' + p.name)}`
    : '';

  // ── زر المفضلة العائم ────────────────────────────────────────────
  const isFav = typeof window.favIsFav === 'function' ? window.favIsFav(p.id) : false;
  const favBtn = (u?.role === 'customer') ? `
    <button
      class="fav-heart-btn${isFav ? ' active' : ''}"
      data-svc="${p.id}"
      title="${isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}"
      onclick="event.stopPropagation(); if(typeof favToggle==='function') favToggle('${p.id}', event);"
      style="inset-inline-end:12px;">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
                 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09
                 C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5
                 c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              stroke-linejoin="round"/>
      </svg>
    </button>` : '';

  // ── زر المشاركة العائم ───────────────────────────────────────────
  const shareFloatBtn = `
    <button
      class="fav-heart-btn"
      title="مشاركة المنتج"
      onclick="event.stopPropagation(); ph34_shareItem('product', '${p.id}', { storeId: '${storeId}' });"
      style="inset-inline-end:${u?.role === 'customer' ? '54' : '12'}px; background:rgba(139,92,246,0.15);">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;stroke:#8b5cf6">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
      </svg>
    </button>`;

  return `
  <div class="ph43-product-card" style="position:relative">
    ${alertBadgeHtml}
    ${activeOffer && typeof ph_offerBadgeHtml === 'function' ? ph_offerBadgeHtml(offerPct) : ''}
    ${favBtn}
    ${shareFloatBtn}
    <div onclick="ph43_showProductDetails('${p.id}', '${storeId}')" style="cursor:pointer">
      <div class="ph43-product-img-wrap">
        ${p.imageBase64
          ? `<img src="${p.imageBase64}" class="ph43-product-img" alt="${escAttr(p.name)}">`
          : `<div class="ph43-product-img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px;opacity:0.3"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"></path><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg></div>`}
        ${prodUnavail}
      </div>
      <div class="ph43-product-body">
        <div class="ph43-product-name">${escHtml(p.name)}</div>
        ${stockChipHtml ? `<div style="margin-top:4px">${stockChipHtml}</div>` : ''}
        ${window.ph47_getProductLocationHtml ? window.ph47_getProductLocationHtml(p.assignedVendors) : ''}
        ${p.sku ? `<div class="ph43-product-sku">#${escHtml(p.sku)}</div>` : ''}
        ${p.desc ? `<div class="ph43-product-desc">${escHtml(p.desc)}</div>` : ''}
      </div>
    </div>
    <div class="ph43-product-footer">
      <div class="ph43-product-price-block">
        ${priceHtml}
        ${buyCount > 0 ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#10b981;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:20px;padding:2px 8px;margin-top:5px">👥 ${buyCount.toLocaleString('ar-YE')} شراء</span>` : ''}
      </div>
      <div class="ph43-product-actions">
        ${btnHtml}
        ${waUrlStore ? `
          <a class="btn-wa-inquiry" href="${waUrlStore}" target="_blank" rel="noopener" title="استفسار عبر واتساب" style="padding:8px 10px;border-radius:10px;">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>
        ` : ''}
      </div>
    </div>
  </div>`;
}

window.ph43_filterProducts = function () {
  const q = document.getElementById('prod-search')?.value.toLowerCase() || '';
  document.querySelectorAll('.ph43-product-card').forEach(c => {
    c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
};

window.ph43_showProductDetails = function(pid, storeId) {
  const p = (AppData.storeProducts || []).find(x => x.id === pid);
  if (!p) return;
  const u = State.currentUser;
  const hasTiers = p.tiers && p.tiers.length > 0;
  
  if (hasTiers) {
    window.__ph43_selectedProductTier = { idx: 0, price: p.tiers[0].price, name: p.tiers[0].name };
  } else {
    window.__ph43_selectedProductTier = null;
  }

  // ── نظام التنبيهات (ph48) ─────────────────────────────────────────
  const alertBadgeHtml = typeof ph48_badgeHtml          === 'function' ? ph48_badgeHtml(p)           : '';
  const stockChipHtml  = typeof ph48_stockChipHtml       === 'function' ? ph48_stockChipHtml(p)        : '';
  const prodUnavail    = typeof ph48_unavailOverlayHtml  === 'function' ? ph48_unavailOverlayHtml(p)  : '';
  const isProdAvail    = typeof ph48_isAvailable         === 'function' ? ph48_isAvailable(p)         : true;

  const priceBlock = hasTiers ? '' : (() => {
    const activeOfferModal = typeof ph_getActiveOffer === 'function' ? ph_getActiveOffer(p.id) : null;
    const priceContent = activeOfferModal && typeof ph_offerPriceHtml === 'function'
      ? ph_offerPriceHtml(activeOfferModal,
          `<div class="ph-price-block ph-price-modal"><span class="ph-price-num">${(p.price || 0).toLocaleString('ar-YE')}</span><span class="ph-price-cur">ريال</span></div>`)
      : `<div class="ph-price-block ph-price-modal"><span class="ph-price-num">${(p.price || 0).toLocaleString('ar-YE')}</span><span class="ph-price-cur">ريال</span></div>`;
    return `
    <div style="background:rgba(59,130,246,0.05);padding:16px;border-radius:14px;margin-bottom:20px;border:1px solid rgba(59,130,246,0.12)">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase">السعر</div>
      ${priceContent}
      ${p.unit ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:6px">الوحدة: <strong>${escHtml(p.unit)}</strong></div>` : ''}
    </div>`;
  })();

  const selectorBlock = hasTiers ? ph43_renderProductTierSelector(p) : '';
  const cartItem = ph43_getCart().find(i => i.productId === p.id);

  let btnActionStr = '';
  if (hasTiers) {
    btnActionStr = `ph43_addToCart('${p.id}','${storeId}', window.__ph43_selectedProductTier); closeModal()`;
  } else {
    btnActionStr = `ph43_addToCart('${p.id}','${storeId}'); closeModal()`;
  }

  let btnLabel = hasTiers ? '🛒 أضف الفئة المختارة للسلة' : (cartItem ? '🛒 إضافة المزيد للكمية الموجودة بالسلة' : '🛒 أضف للسلة');

  const videoBlock = (p.videoUrl && typeof window.mUpload_renderVideoPlayer === 'function')
    ? `<div style="margin-top:12px;margin-bottom:16px">${window.mUpload_renderVideoPlayer(p.videoUrl, p.imageBase64 || '')}</div>`
    : '';

  openModal(`
    <div style="text-align:center; margin-bottom:16px; position:relative">
      ${alertBadgeHtml}
      ${p.imageBase64 
        ? `<img src="${p.imageBase64}" style="max-width:100%; max-height:250px; border-radius:12px; object-fit:contain; background:#f9fafb; padding:8px;">`
        : `<div style="font-size:64px; padding:32px; background:#f3f4f6; border-radius:12px; width:100px; height:100px; margin:0 auto; display:flex; align-items:center; justify-content:center">📦</div>`}
      ${prodUnavail}
    </div>
    ${videoBlock}
    <div style="font-size:22px; font-weight:800; margin-bottom:6px; text-align:right; display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:flex-end">
      <span>${escHtml(p.name)}</span>
      ${p.sku ? `<span style="font-family:monospace;font-size:13px;font-weight:700;background:rgba(139,92,246,0.12);color:#8b5cf6;border:1px solid rgba(139,92,246,0.25);border-radius:6px;padding:3px 8px;letter-spacing:0.5px;">#${escHtml(p.sku)}</span>` : ''}
    </div>
    ${(() => { const bc = (AppData.orders||[]).filter(o => o.status !== 'cancelled' && Array.isArray(o.items) && o.items.some(i => i.productId === p.id)).length; return bc > 0 ? `<div style="margin-bottom:10px;text-align:right"><span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:#10b981;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:20px;padding:3px 12px">\ud83d\udc65 ${bc.toLocaleString('ar-YE')} شخص اشترى هذا المنتج</span></div>` : ''; })()}
    ${stockChipHtml ? `<div style="margin-bottom:10px; text-align:right;">${stockChipHtml}</div>` : ''}
    ${window.ph47_getProductLocationHtml ? window.ph47_getProductLocationHtml(p.assignedVendors) : ''}
    ${p.desc ? `<div style="font-size:15px; line-height:1.6; color:var(--text-secondary); margin-bottom:16px; white-space:pre-wrap; text-align:right">${escHtml(p.desc)}</div>` : ''}
    
    ${priceBlock}
    ${selectorBlock}
    
    ${u?.role === 'customer'
      ? `<div style="display:flex; gap:10px; margin-top:8px;">
           ${isProdAvail ? `
             <button class="btn btn-primary btn-lg" style="flex:4; display:flex; justify-content:center; gap:8px; margin:0;" onclick="${btnActionStr}">
               <span>${btnLabel}</span>
             </button>
           ` : `
             <button class="btn btn-primary btn-lg ia-btn-disabled" style="flex:4; display:flex; justify-content:center; gap:8px; margin:0; background:rgba(100,116,139,0.3)" onclick="event.stopPropagation(); typeof toast==='function'&&toast('هذا المنتج غير متاح للطلب حالياً','warning')">
               <span>🚫 ${(p.stockStatus === 'out_of_stock') ? 'نفذت الكمية' : (p.stockStatus === 'coming_soon') ? 'قريباً' : 'غير متاح'}</span>
             </button>
           `}
           <button class="btn-share" onclick="ph34_shareItem('product', '${p.id}', { storeId: '${storeId}' })" title="مشاركة المنتج" style="flex:1; justify-content:center; padding:12px;">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
           </button>
         </div>`
      : u?.role === 'guest'
      ? `<button class="btn btn-primary btn-block btn-lg" onclick="closeModal(); navigate('login')">سجل للشراء</button>`
      : ''}
    ${(() => {
      const waNumDet = (AppData.platformSettings?.whatsappNumberStores || AppData.platformSettings?.whatsappNumber || '').replace(/\D/g,'');
      return waNumDet ? `
     <div style="margin-top:10px; display:flex; justify-content:center;">
       <a class="btn-wa-inquiry" href="https://wa.me/${waNumDet}?text=${encodeURIComponent('أهلاً، أريد الاستفسار عن المنتج: ' + p.name)}" target="_blank" rel="noopener" style="padding:10px 14px; border-radius:12px;" title="استفسار عبر واتساب">
         <svg viewBox="0 0 24 24" fill="currentColor" style="width:20px;height:20px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
       </a>
     </div>` : '';
    })()}
  `);
};

// ───────────────────────────────────────────────────────
// SECTION 6 — Admin: Store Management
// ───────────────────────────────────────────────────────
window.ph43_renderAdminStores = function () {
  if (State.adminStoreView) return ph43_renderAdminStoreDetail(State.adminStoreView);

  const stores = AppData.stores || [];
  return `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">
    <h2 style="margin:0">🏪 إدارة المتاجر</h2>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <input type="text" class="form-control" id="admin-stores-search" placeholder="🔍 ابحث عن متجر..." oninput="ph43_filterAdminStores()" style="width:240px">
      <button class="btn btn-primary" onclick="ph43_showAddStoreModal()">➕ إضافة متجر</button>
    </div>
  </div>
  ${stores.length ? `
  <div class="ph43-admin-store-grid">
    ${stores.map(s => {
      const prodCount = (AppData.storeProducts || []).filter(p => p.storeId === s.id).length;
      const catCount  = (AppData.storeCats || []).filter(c => c.storeId === s.id).length;
      return `
      <div class="ph43-admin-store-card">
        <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px">
          <div style="font-size:40px;flex-shrink:0">${s.icon || '🏪'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:800;font-size:16px;margin-bottom:4px">${escHtml(s.name)}</div>
            <div style="font-size:12px;color:var(--text-muted)">👤 ${escHtml(s.vendorName || '—')}</div>
            ${s.desc ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:6px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(s.desc)}</div>` : ''}
          </div>
          <span class="badge ${s.active !== false ? 'badge-teal' : 'badge-rose'}">${s.active !== false ? '✅ نشط' : '⏸️ معطّل'}</span>
        </div>
        <div style="display:flex;gap:16px;font-size:12px;color:var(--text-muted);margin-bottom:14px;padding:10px;background:var(--bg-secondary);border-radius:10px">
          <span>📦 ${prodCount} منتج</span>
          <span>📂 ${catCount} قسم</span>
          <span>${s.regionId ? '📍 منطقة محددة' : '🌍 جميع المناطق'}</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" style="flex:1" onclick="State.adminStoreView='${s.id}';State.adminStoreCat=null;render()">⚙️ إدارة المنتجات</button>
          <button class="btn btn-sm btn-secondary" onclick="ph43_showEditStoreModal('${s.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="ph43_deleteStore('${s.id}')">🗑️</button>
        </div>
      </div>`;
    }).join('')}
  </div>` : `
  <div class="empty-state">
    <div class="empty-icon">🏪</div>
    <div class="empty-title">لا توجد متاجر بعد</div>
    <div class="empty-sub">أضف أول متجر لبدء عرض المنتجات</div>
    <button class="btn btn-primary" style="margin-top:20px" onclick="ph43_showAddStoreModal()">➕ إضافة متجر</button>
  </div>`}`;
};

// ─── Store Detail (categories + products) ─────────────
function ph43_renderAdminStoreDetail(storeId) {
  const store = (AppData.stores || []).find(s => s.id === storeId);
  if (!store) return '<div class="empty-state"><div class="empty-title">المتجر غير موجود</div></div>';

  const cats      = (AppData.storeCats || []).filter(c => c.storeId === storeId).sort((a, b) => (a.order || 0) - (b.order || 0));
  const activeCat = State.adminStoreCat || null;
  const products  = (AppData.storeProducts || []).filter(p => p.storeId === storeId && (!activeCat || p.catId === activeCat));

  return `
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <button class="btn btn-secondary btn-sm" onclick="State.adminStoreView=null;State.adminStoreCat=null;State.adminSearch='';render()">← رجوع للمتاجر</button>
    <span style="font-size:22px">${store.icon || '🏪'}</span>
    <h2 style="margin:0;font-size:20px">${escHtml(store.name)}</h2>
    <div style="display:flex;gap:12px;margin-inline-start:auto;align-items:center;flex-wrap:wrap">
      <input type="text" class="form-control" id="admin-prods-search" placeholder="🔍 ابحث عن منتج..." oninput="ph43_filterAdminProducts()" style="width:200px">
      <button class="btn btn-secondary btn-sm" onclick="ph43_showManageCatsModal('${storeId}')">📂 إدارة الأقسام</button>
      <button class="btn btn-primary btn-sm" onclick="ph43_showAddProductModal('${storeId}')">➕ إضافة منتج</button>
    </div>
  </div>

  <!-- شريط الأقسام الأفقي المتطور -->
  <div class="ph43-cats-tabs-wrap">
    <div class="ph43-cats-title">📂 الأقسام:</div>
    <button class="ph43-cat-tab${!activeCat ? ' active' : ''}" onclick="State.adminStoreCat=null;render()">
      <span class="ph43-cat-tab-icon">🛍️</span>
      <span>الكل</span>
      <span class="ph43-cat-tab-count">${(AppData.storeProducts || []).filter(p => p.storeId === storeId).length}</span>
    </button>
    ${cats.map(c => {
      const cnt = (AppData.storeProducts || []).filter(p => p.storeId === storeId && p.catId === c.id).length;
      return `<button class="ph43-cat-tab${activeCat === c.id ? ' active' : ''}" onclick="State.adminStoreCat='${c.id}';render()">
        <span class="ph43-cat-tab-icon">${c.icon || '📦'}</span>
        <span>${escHtml(c.name)}</span>
        <span class="ph43-cat-tab-count">${cnt}</span>
      </button>`;
    }).join('')}
  </div>

  <div style="width:100%" data-ph43-products-container="true">
      ${products.length ? `
      <div class="table-wrap" style="max-height: calc(100vh - 220px); overflow-y: auto; -webkit-overflow-scrolling: touch;">
        <table class="admin-table">
          <thead><tr><th>الصورة</th><th>المنتج</th><th>القسم</th><th>السعر</th><th>الحالة</th><th>إجراءات</th></tr></thead>
          <tbody>
            ${products.map(p => {
              const cat = cats.find(c => c.id === p.catId);
              return `<tr class="ph43-admin-prod-row">
                <td>${p.imageBase64
                  ? `<img src="${p.imageBase64}" style="width:42px;height:42px;border-radius:10px;object-fit:cover">`
                  : '<span style="font-size:26px">📦</span>'}</td>
                <td>
                  <div style="font-weight:600">${escHtml(p.name)}</div>
                  ${p.desc ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${escHtml(p.desc).slice(0,60)}${p.desc.length>60?'...':''}</div>` : ''}
                  ${p.unit ? `<div style="font-size:11px;color:var(--text-muted)">${escHtml(p.unit)}</div>` : ''}
                </td>
                <td>${cat ? `<span class="badge badge-purple">${cat.icon || '📦'} ${escHtml(cat.name)}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
                <td style="font-weight:700">${
                  (p.tiers && p.tiers.length > 0)
                    ? `<span style="display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,rgba(139,92,246,0.12),rgba(139,92,246,0.04));color:var(--primary);border:1px solid rgba(139,92,246,0.25);border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700">🏷️ ${p.tiers.length} فئات</span><div style="font-size:11px;color:var(--text-muted);margin-top:3px">من ${Math.min(...p.tiers.map(t=>t.price||0)).toLocaleString('ar-YE')} ريال</div>`
                    : `<span style="color:var(--primary)">${(p.price || 0).toLocaleString('ar-YE')} ريال</span>`
                }</td>
                <td><span class="badge ${p.active !== false ? 'badge-teal' : 'badge-rose'}">${p.active !== false ? '✅ نشط' : '⏸️'}</span></td>
                <td>
                  <button class="btn btn-sm" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff" onclick="ph43_showProductTiersModal('${p.id}','${storeId}')" title="فئات المنتج">🏷️</button>
                  <button class="btn btn-sm btn-secondary" onclick="ph43_showEditProductModal('${p.id}','${storeId}')">✏️</button>
                  <button class="btn btn-sm btn-danger" onclick="ph43_deleteProduct('${p.id}')">🗑️</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:10px;font-size:13px;color:var(--text-muted)">${products.length} منتج</div>` : `
      <div class="empty-state" style="padding:60px">
        <div class="empty-icon">📦</div>
        <div class="empty-title">لا توجد منتجات${activeCat ? ' في هذا القسم' : ''}</div>
        <button class="btn btn-primary" style="margin-top:16px" onclick="ph43_showAddProductModal('${storeId}')">➕ إضافة منتج</button>
      </div>`}
  </div>`;
}

window.ph43_filterAdminStores = function() {
  const q = (document.getElementById('admin-stores-search')?.value || '').toLowerCase();
  document.querySelectorAll('.ph43-admin-store-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(q) ? '' : 'none';
  });
};

window.ph43_filterAdminProducts = function() {
  const q = (document.getElementById('admin-prods-search')?.value || '').toLowerCase();
  document.querySelectorAll('.ph43-admin-prod-row').forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(q) ? '' : 'none';
  });
};

window.ph43_readStoreImage = function (input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('st-logo-b64').value = e.target.result;
    document.getElementById('st-logo-preview').src = e.target.result;
    document.getElementById('st-logo-preview').style.display = 'block';
  };
  reader.readAsDataURL(input.files[0]);
};

// ─── Add/Edit Store Modals ────────────────────────────
window.ph43_showAddStoreModal = function () {
  const vendors = (AppData.users || []).filter(u => ['vendor', 'provider'].includes(u.role));
  const regions = AppData.regions || [];
  openModal(`
    <div class="modal-header"><h2 class="modal-title">➕ إضافة متجر جديد</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group"><label class="form-label">🏪 اسم المتجر *</label><input class="form-control" id="st-name" placeholder="مثال: صيدلية الأمل"></div>
    <div class="form-group"><label class="form-label">أيقونة (إيموجي)</label><input class="form-control" id="st-icon" value="🏪"></div>
    <div class="form-group">
      <label class="form-label">صورة المتجر (شعار)</label>
      <input type="file" class="form-control" accept="image/*" onchange="ph43_readStoreImage(this)">
      <input type="hidden" id="st-logo-b64" value="">
      <img id="st-logo-preview" style="display:none;width:64px;height:64px;margin-top:10px;border-radius:12px;object-fit:cover;border:2px solid var(--border)">
    </div>
    <div class="form-group"><label class="form-label">الوصف</label><textarea class="form-control" id="st-desc" placeholder="وصف مختصر عن المتجر..." style="resize:vertical"></textarea></div>
    <div class="form-group">
      <label class="form-label">🚗 وقت التوصيل</label>
      <input class="form-control" id="st-delivery" placeholder="مثال: 30-60 دقيقة">
    </div>
    ${_renderVendorPicker()}
    <div class="form-group">
      <label class="form-label">📍 المنطقة</label>
      <select class="form-control" id="st-region">
        <option value="">🌍 جميع المناطق</option>
        ${regions.map(r => `<option value="${r.id}">${escHtml(r.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" style="margin-top:12px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="st-has-address" onchange="document.getElementById('st-address-wrap').style.display = this.checked ? 'block' : 'none'" style="width:16px;height:16px;accent-color:var(--primary)">
        <span>هل تريد إضافة عنوان محدد للتوصيل؟ (موقع المنتج)</span>
      </label>
    </div>
    <div class="form-group" id="st-address-wrap" style="display:none;margin-top:8px">
      <label class="form-label">📍 العنوان التفصيلي الفرعي (من أسعار التوصيل)</label>
      <select class="form-control" id="st-address-id">
        <option value="">— اختر العنوان الفرعي —</option>
        ${(AppData.deliverySubzones || []).map(sz => {
          const parentZone = (AppData.deliveryZones || []).find(z => z.id === sz.zoneId)?.name || '';
          return `<option value="${sz.id}" data-name="${escAttr(sz.name)}" data-zone="${escAttr(parentZone)}">${escHtml(parentZone)} - ${escHtml(sz.name)}</option>`;
        }).join('')}
      </select>
    </div>
    <div class="form-group" style="display:flex;align-items:center;gap:12px;margin-top:12px">
      <label class="toggle-switch"><input type="checkbox" id="st-active" checked><span class="toggle-slider"></span></label>
      <span>متجر نشط (مرئي للعملاء)</span>
    </div>
    <button class="btn btn-primary btn-block" onclick="ph43_saveNewStore()">💾 حفظ المتجر</button>
  `);
};

window.ph43_saveNewStore = async function () {
  const name         = document.getElementById('st-name')?.value.trim();
  const icon         = document.getElementById('st-icon')?.value.trim() || '🏪';
  const desc         = document.getElementById('st-desc')?.value.trim();
  const deliveryTime = document.getElementById('st-delivery')?.value.trim();
  const assignedVendors = Array.from(document.querySelectorAll('.svc-vendor-cb:checked')).map(cb=>cb.value);
  const regionId     = document.getElementById('st-region')?.value || null;
  const hasAddress   = document.getElementById('st-has-address')?.checked || false;
  const addressEl    = document.getElementById('st-address-id');
  const storeAddressId = hasAddress ? (addressEl?.value || null) : null;
  const selectedOption = addressEl?.options[addressEl.selectedIndex];
  const storeAddressName = hasAddress ? (selectedOption?.dataset?.name || null) : null;
  const storeRegionName = hasAddress ? (selectedOption?.dataset?.zone || null) : null;
  const active       = document.getElementById('st-active')?.checked !== false;
  const logoBase64   = document.getElementById('st-logo-b64')?.value || null;

  if (!name) { toast('أدخل اسم المتجر', 'error'); return; }
  if (!assignedVendors.length) { toast('يجب اختيار مزود واحد على الأقل لهذا المتجر', 'error'); return; }

  showLoader('جاري الحفظ...');
  try {
    await fsAdd('stores', { name, icon, desc, deliveryTime, assignedVendors, regionId, active, logoBase64, hasAddress, storeAddressId, storeAddressName, storeRegionName });
    await ph43_reloadStoreData();
    hideLoader(); closeModal();
    toast('✅ تم إضافة المتجر', 'success');
    await render();
  } catch (e) { hideLoader(); toast('خطأ: ' + e.message, 'error'); }
};

window.ph43_showEditStoreModal = function (storeId) {
  const s       = (AppData.stores || []).find(x => x.id === storeId);
  if (!s) return;
  const vendors = (AppData.users || []).filter(u => ['vendor', 'provider'].includes(u.role));
  const regions = AppData.regions || [];
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ تعديل المتجر</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group"><label class="form-label">اسم المتجر *</label><input class="form-control" id="st-name" value="${escAttr(s.name)}"></div>
    <div class="form-group"><label class="form-label">أيقونة (إيموجي)</label><input class="form-control" id="st-icon" value="${escAttr(s.icon || '🏪')}"></div>
    <div class="form-group">
      <label class="form-label">صورة المتجر (شعار)</label>
      <input type="file" class="form-control" accept="image/*" onchange="ph43_readStoreImage(this)">
      <input type="hidden" id="st-logo-b64" value="${s.logoBase64 ? escAttr(s.logoBase64) : ''}">
      <img id="st-logo-preview" src="${s.logoBase64 ? s.logoBase64 : ''}" style="${s.logoBase64 ? 'display:block;' : 'display:none;'}width:64px;height:64px;margin-top:10px;border-radius:12px;object-fit:cover;border:2px solid var(--border)">
    </div>
    <div class="form-group"><label class="form-label">الوصف</label><textarea class="form-control" id="st-desc">${escHtml(s.desc || '')}</textarea></div>
    <div class="form-group"><label class="form-label">🚗 وقت التوصيل</label><input class="form-control" id="st-delivery" value="${escAttr(s.deliveryTime || '')}"></div>
    ${_renderVendorPicker(s.assignedVendors || (s.vendorId ? [s.vendorId] : []))}
    <div class="form-group">
      <label class="form-label">📍 المنطقة</label>
      <select class="form-control" id="st-region">
        <option value="">🌍 جميع المناطق</option>
        ${regions.map(r => `<option value="${r.id}"${s.regionId === r.id ? ' selected' : ''}>${escHtml(r.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" style="margin-top:12px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="st-has-address" ${s.hasAddress ? 'checked' : ''} onchange="document.getElementById('st-address-wrap').style.display = this.checked ? 'block' : 'none'" style="width:16px;height:16px;accent-color:var(--primary)">
        <span>هل تريد إضافة عنوان محدد للتوصيل؟ (موقع المنتج)</span>
      </label>
    </div>
    <div class="form-group" id="st-address-wrap" style="display:${s.hasAddress ? 'block' : 'none'};margin-top:8px">
      <label class="form-label">📍 العنوان التفصيلي الفرعي (من أسعار التوصيل)</label>
      <select class="form-control" id="st-address-id">
        <option value="">— اختر العنوان الفرعي —</option>
        ${(AppData.deliverySubzones || []).map(sz => {
          const parentZone = (AppData.deliveryZones || []).find(z => z.id === sz.zoneId)?.name || '';
          return `<option value="${sz.id}" data-name="${escAttr(sz.name)}" data-zone="${escAttr(parentZone)}"${s.storeAddressId === sz.id ? ' selected' : ''}>${escHtml(parentZone)} - ${escHtml(sz.name)}</option>`;
        }).join('')}
      </select>
    </div>
    <div class="form-group" style="display:flex;align-items:center;gap:12px;margin-top:12px">
      <label class="toggle-switch"><input type="checkbox" id="st-active"${s.active !== false ? ' checked' : ''}><span class="toggle-slider"></span></label>
      <span>متجر نشط</span>
    </div>
    <button class="btn btn-primary btn-block" onclick="ph43_updateStore('${storeId}')">💾 حفظ التعديلات</button>
  `);
};

window.ph43_updateStore = async function (storeId) {
  const name         = document.getElementById('st-name')?.value.trim();
  const icon         = document.getElementById('st-icon')?.value.trim() || '🏪';
  const desc         = document.getElementById('st-desc')?.value.trim();
  const deliveryTime = document.getElementById('st-delivery')?.value.trim();
  const assignedVendors = Array.from(document.querySelectorAll('.svc-vendor-cb:checked')).map(cb=>cb.value);
  const regionId     = document.getElementById('st-region')?.value || null;
  const hasAddress   = document.getElementById('st-has-address')?.checked || false;
  const addressEl    = document.getElementById('st-address-id');
  const storeAddressId = hasAddress ? (addressEl?.value || null) : null;
  const selectedOption = addressEl?.options[addressEl.selectedIndex];
  const storeAddressName = hasAddress ? (selectedOption?.dataset?.name || null) : null;
  const storeRegionName = hasAddress ? (selectedOption?.dataset?.zone || null) : null;
  const active       = document.getElementById('st-active')?.checked !== false;
  const logoBase64   = document.getElementById('st-logo-b64')?.value || null;

  if (!name) { toast('أدخل اسم المتجر', 'error'); return; }
  if (!assignedVendors.length) { toast('يجب اختيار مزود واحد على الأقل لهذا المتجر', 'error'); return; }
  showLoader();
  try {
    await fsUpdate('stores', storeId, { name, icon, desc, deliveryTime, assignedVendors, regionId, active, logoBase64, hasAddress, storeAddressId, storeAddressName, storeRegionName });
    await ph43_reloadStoreData();
    hideLoader(); closeModal();
    toast('✅ تم التعديل', 'success');
    await render();
  } catch (e) { hideLoader(); toast('خطأ: ' + e.message, 'error'); }
};

window.ph43_deleteStore = async function (storeId) {
  if (!confirm('هل تريد حذف هذا المتجر وجميع أقسامه ومنتجاته؟')) return;
  showLoader('جاري الحذف...');
  try {
    await fsDelete('stores', storeId);
    const cats  = (AppData.storeCats || []).filter(c => c.storeId === storeId);
    const prods = (AppData.storeProducts || []).filter(p => p.storeId === storeId);
    await Promise.all([...cats.map(c => fsDelete('store_cats', c.id)), ...prods.map(p => fsDelete('store_products', p.id))]);
    await ph43_reloadStoreData();
    hideLoader();
    toast('✅ تم حذف المتجر', 'success');
    await render();
  } catch (e) { hideLoader(); toast('خطأ: ' + e.message, 'error'); }
};

// ─── Manage Categories Modal ──────────────────────────
window.ph43_showManageCatsModal = function (storeId) {
  const renderList = () => {
    const cats = (AppData.storeCats || []).filter(c => c.storeId === storeId).sort((a, b) => (a.order || 0) - (b.order || 0));
    return cats.length
      ? cats.map(c => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg-secondary);border-radius:12px;margin-bottom:8px">
          <span style="font-size:20px">${c.icon || '📦'}</span>
          <span style="flex:1;font-weight:600">${escHtml(c.name)}</span>
          <span style="font-size:12px;color:var(--text-muted)">${(AppData.storeProducts || []).filter(p => p.storeId === storeId && p.catId === c.id).length} منتج</span>
          <button class="btn btn-sm btn-danger" onclick="ph43_deleteCat('${c.id}','${storeId}')">🗑️</button>
        </div>`).join('')
      : '<div style="text-align:center;padding:24px;color:var(--text-muted)">لا توجد أقسام بعد</div>';
  };

  const cats = (AppData.storeCats || []).filter(c => c.storeId === storeId);
  openModal(`
    <div class="modal-header"><h2 class="modal-title">📂 إدارة أقسام المتجر</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div id="store-cats-list" style="margin-bottom:20px;max-height:300px;overflow-y:auto">
      ${renderList()}
    </div>
    <div style="background:var(--bg-secondary);border-radius:14px;padding:16px">
      <div style="font-weight:700;margin-bottom:12px">➕ إضافة قسم جديد</div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input class="form-control" id="new-cat-icon" value="📦" style="width:70px;flex-shrink:0;text-align:center;font-size:18px">
        <input class="form-control" id="new-cat-name" placeholder="اسم القسم (مثال: مستلزمات طبية)">
      </div>
      <button class="btn btn-primary btn-block" onclick="ph43_addStoreCat('${storeId}')">➕ إضافة</button>
    </div>
  `);
};

window.ph43_addStoreCat = async function (storeId) {
  const name = document.getElementById('new-cat-name')?.value.trim();
  const icon = document.getElementById('new-cat-icon')?.value.trim() || '📦';
  if (!name) { toast('أدخل اسم القسم', 'error'); return; }
  try {
    const order = (AppData.storeCats || []).filter(c => c.storeId === storeId).length;
    await fsAdd('store_cats', { storeId, name, icon, order });
    await ph43_reloadStoreData();
    toast('✅ تم إضافة القسم', 'success');
    ph43_showManageCatsModal(storeId);
  } catch (e) { toast('خطأ: ' + e.message, 'error'); }
};

window.ph43_deleteCat = async function (catId, storeId) {
  if (!confirm('حذف هذا القسم؟ ستظل المنتجات المرتبطة به بدون قسم.')) return;
  await fsDelete('store_cats', catId);
  await ph43_reloadStoreData();
  toast('✅ تم حذف القسم', 'success');
  ph43_showManageCatsModal(storeId);
};

// ─── Add/Edit Product Modals ──────────────────────────
window.ph43_showAddProductModal = function (storeId) {
  if (State.currentUser && State.currentUser.role !== 'admin') {
    toast('غير مسموح لمزودي الخدمة بالإضافة المباشرة لقسم المتاجر والحجوزات. يرجى إرسال طلب إضافة خدمة للمراجعة.', 'warning');
    return;
  }

  const cats = (AppData.storeCats || []).filter(c => c.storeId === storeId);
  const activeItems = (AppData.catalogItems || []).filter(item => item.status === 'active' && (item.sectionId === 'stores' || item.sectionId === 'digital'));
  const providers = (AppData.users || []).filter(u => ['vendor', 'provider'].includes(u.role));

  const modalHtml = `
    <div class="modal-header">
      <h2 class="modal-title">🏪 ربط وإضافة منتجات من الكتالوج الموحد</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="ph46-modal-body-scroll" style="max-height: 75vh; overflow-y: auto; padding: 12px; direction: rtl; text-align: right; color: #ffffff;">
      
      <!-- اختيار القسم المحلي للتنزيل فيه -->
      <div class="form-group" style="margin-bottom: 16px;">
        <label class="form-label" style="font-weight: 700;">📂 اختر فئة المتجر المحلية المستهدفة *</label>
        <select class="form-control" id="ph46-local-store-cat-select" onchange="window.__ph46_selectedStoreCatId = this.value;">
          <option value="">-- بدون فئة (عام) --</option>
          ${cats.map(c => `<option value="${c.id}" ${State.adminStoreCat === c.id ? 'selected' : ''}>${c.icon || ''} ${escHtml(c.name)}</option>`).join('')}
        </select>
      </div>

      <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 16px; margin-top: 16px;">
        <!-- العمود الأيسر: قائمة المنتجات في الكتالوج -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 12px; padding: 16px;">
          <h4 style="margin-top:0; margin-bottom:12px; color:var(--primary); font-size:14px; border-bottom:1px solid var(--border, rgba(255,255,255,0.08)); padding-bottom:6px;">📋 1. اختر المنتجات من الكتالوج الموحد (يمكن اختيار متعدد)</h4>
          
          <div class="search-input-wrap" style="margin-bottom:12px;">
            <input type="text" class="form-control" placeholder="🔍 بحث بالاسم..." oninput="window.ph46_filterStoreCatalogList(this.value)">
          </div>

          <div id="ph46-store-catalog-items-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 8px; padding: 8px; display:flex; flex-direction:column; gap:8px;">
            ${activeItems.length === 0 ? `
              <div style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد منتجات نشطة في الكتالوج للمتاجر</div>
            ` : activeItems.map(item => `
              <label class="ph46-store-catalog-item-row" data-name="${item.name.toLowerCase()}" style="display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; background:rgba(255,255,255,0.01); border:1px solid transparent; transition:all 0.2s; cursor:pointer;">
                <input type="checkbox" class="ph46-store-catalog-cb" value="${item.id}" style="width:18px; height:18px;">
                ${item.mainImage ? `<img src="${item.mainImage}" style="width:36px; height:36px; border-radius:6px; object-fit:cover;">` : `<div style="width:36px; height:36px; border-radius:6px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center;">📦</div>`}
                <div style="flex:1;">
                  <div style="font-weight:700; font-size:13px;">${escHtml(item.name)} ${item.sectionId === 'digital' ? '<span style="color:#3b82f6; font-size:10px;">🔑 رقمي</span>' : ''}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${item.price ? item.price + ' ريال' : ''}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- العمود الأيمن: قائمة مزودي الخدمة المتاحين للربط -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 12px; padding: 16px;">
          <h4 style="margin-top:0; margin-bottom:12px; color:var(--primary); font-size:14px; border-bottom:1px solid var(--border, rgba(255,255,255,0.08)); padding-bottom:6px;">👤 2. اختر الشركاء/المزودين المربوطين بها</h4>
          
          <div id="ph46-store-providers-list" style="max-height: 350px; overflow-y: auto; border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 8px; padding: 8px; display:flex; flex-direction:column; gap:8px;">
            ${providers.length === 0 ? `
              <div style="text-align:center; padding:20px; color:var(--text-muted);">لا يوجد مزودون مسجلون</div>
            ` : providers.map(p => `
              <label style="display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; background:rgba(255,255,255,0.01); cursor:pointer;">
                <input type="checkbox" class="ph46-store-provider-cb" value="${p.uid}" style="width:18px; height:18px;">
                <div style="flex:1;">
                  <div style="font-weight:700; font-size:13px;">${escHtml(p.name)}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${p.phone || ''}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- قسم العروض والخصومات -->
      <div style="margin-top:20px;border:1px solid rgba(239,68,68,0.25);background:linear-gradient(135deg,rgba(239,68,68,0.04),rgba(245,158,11,0.03));border-radius:16px;padding:16px">
        <div style="font-weight:800;font-size:15px;color:#ef4444;margin-bottom:12px">🏷️ قسم العروض والخصومات</div>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 14px;background:rgba(239,68,68,0.06);border:1px dashed rgba(239,68,68,0.3);border-radius:12px;margin-bottom:12px">
          <input type="checkbox" id="ph46-add-to-offers" onchange="ph46_toggleOfferFields(this.checked)" style="width:20px;height:20px;accent-color:#ef4444">
          <div>
            <div style="font-weight:700;font-size:13px">إضافة هذه المنتجات إلى قسم العروض والخصومات</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">ستظهر المنتجات للعملاء في قسم العروض بسعر مخفض</div>
          </div>
        </label>
        <div id="ph46-offer-fields" style="display:none">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px">
            <div class="form-group">
              <label class="form-label">نسبة الخصم (%) *</label>
              <input class="form-control" id="ph46-offer-pct" type="number" min="1" max="99" placeholder="مثال: 20">
            </div>
            <div class="form-group">
              <label class="form-label">تاريخ الانتهاء (فارغ = دائم)</label>
              <input class="form-control" id="ph46-offer-expires" type="date">
            </div>
          </div>
          <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:10px 14px;font-size:12px;color:#10b981">
            💡 سيُطبَّق نفس الخصم على جميع المنتجات المحددة
          </div>
        </div>
      </div>

      <!-- التنبيهات وحالة التوفر -->
      ${typeof ph48_adminSectionHtml === 'function' ? `
      <div style="margin-top:20px;">
        ${ph48_adminSectionHtml(null)}
      </div>` : ''}

      <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:10px;">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="window.ph46_saveAdminStoreProducts('${storeId}')">💾 حفظ وربط المنتجات</button>
      </div>
    </div>
  `;

  openModal(modalHtml);
  window.__ph46_selectedStoreCatId = State.adminStoreCat || null;
};

window.ph46_toggleOfferFields = function (show) {
  const el = document.getElementById('ph46-offer-fields');
  if (el) el.style.display = show ? 'block' : 'none';
};

window.ph46_filterStoreCatalogList = function(q) {
  const lowercase = q.toLowerCase().trim();
  const rows = document.querySelectorAll('.ph46-store-catalog-item-row');
  rows.forEach(r => {
    const name = r.getAttribute('data-name') || '';
    r.style.display = name.includes(lowercase) ? 'flex' : 'none';
  });
};

window.ph46_saveAdminStoreProducts = async function(storeId) {
  const catId = window.__ph46_selectedStoreCatId;
  const checkedItems = Array.from(document.querySelectorAll('.ph46-store-catalog-cb:checked')).map(cb => cb.value);
  const checkedProviders = Array.from(document.querySelectorAll('.ph46-store-provider-cb:checked')).map(cb => cb.value);

  if (checkedItems.length === 0) { toast('يرجى اختيار منتج واحد على الأقل من الكتالوج الموحد', 'warning'); return; }
  if (checkedProviders.length === 0) { toast('يرجى اختيار شريك/مزود واحد على الأقل', 'warning'); return; }

  showLoader();
  try {
    // ── قراءة بيانات التوفر والتنبيه من النموذج ──────────────────────
    let formStockStatus = 'available', formAlertBadge = null;
    if (typeof ph48_collectAlertData === 'function') {
      const alertData = ph48_collectAlertData();
      formStockStatus = alertData.stockStatus || 'available';
      formAlertBadge  = alertData.alertBadge  || null;
    }

    let addCount = 0;
    for (const itemId of checkedItems) {
      const item = (AppData.catalogItems || []).find(i => i.id === itemId);
      if (!item) continue;

      const productData = {
        storeId: storeId,
        catId: catId || null,
        name: item.name,
        desc: item.desc || '',
        price: item.price || 0,
        unit: 'حبة',
        imageBase64: item.mainImage || null,
        videoUrl: item.videoUrl || null,
        active: true,
        isDigital: item.sectionId === 'digital',
        sku: item.sku || null,
        stockStatus: formStockStatus,
        alertBadge: formAlertBadge,
        assignedVendors: checkedProviders
      };

      const prodId = await fsAdd('store_products', productData);
      addCount++;

      // إضافة للعروض إن طُلب ذلك
      const addToOffers = document.getElementById('ph46-add-to-offers')?.checked;
      if (addToOffers && typeof ph_saveOfferFromSource === 'function') {
        const offerPct  = parseFloat(document.getElementById('ph46-offer-pct')?.value) || 0;
        const expStr    = document.getElementById('ph46-offer-expires')?.value || '';
        if (offerPct > 0 && item.price > 0) {
          await ph_saveOfferFromSource({
            title: item.name, desc: item.desc || '',
            sourceType: 'store_product', sourceId: prodId,
            sourceSection: 'stores', originalPrice: item.price,
            discountPercent: offerPct, imageBase64: item.mainImage || null,
            expiresStr: expStr
          });
        }
      }
    }

    if (typeof ph43_reloadStoreData === 'function') await ph43_reloadStoreData();
    closeModal();
    const addedToOffers = document.getElementById('ph46-add-to-offers')?.checked && parseFloat(document.getElementById('ph46-offer-pct')?.value) > 0;
    toast(`تمت إضافة وربط ${addCount} منتج بنجاح 🎉${addedToOffers ? ' وتمت إضافتها للعروض 🏷️' : ''}`, 'success');
    await render();
  } catch(e) {
    toast('حدث خطأ أثناء الحفظ: ' + e.message, 'error');
  } finally {
    hideLoader();
  }
};

window.ph43_showEditProductModal = function (productId, storeId) {
  const p    = (AppData.storeProducts || []).find(x => x.id === productId);
  if (!p) return;
  const cats = (AppData.storeCats || []).filter(c => c.storeId === storeId);
  window.__ph43_pendingImg = null;
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ تعديل المنتج</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group">
      <label class="form-label">القسم</label>
      <select class="form-control" id="prod-cat">
        <option value="">— بدون قسم —</option>
        ${cats.map(c => `<option value="${c.id}"${p.catId === c.id ? ' selected' : ''}>${c.icon || ''} ${escHtml(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">اسم المنتج *</label><input class="form-control" id="prod-name" value="${escAttr(p.name)}"></div>
    <div class="form-group"><label class="form-label">الوصف</label><textarea class="form-control" id="prod-desc">${escHtml(p.desc || '')}</textarea></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label class="form-label">السعر (ريال)</label><input class="form-control" id="prod-price" type="number" value="${p.price || ''}"></div>
      <div class="form-group"><label class="form-label">الوحدة</label><input class="form-control" id="prod-unit" value="${escAttr(p.unit || '')}"></div>
    </div>
    <div class="form-group" style="display:flex;align-items:center;gap:12px;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:12px 16px;margin-top:4px">
      <label class="toggle-switch"><input type="checkbox" id="prod-is-digital"${p.isDigital ? ' checked' : ''}><span class="toggle-slider"></span></label>
      <div><div style="font-weight:700;font-size:14px">🔑 منتج رقمي (أكواد)</div><div style="font-size:12px;color:var(--text-muted)">كروت شبكة، شرائح، قسائم رقمية</div></div>
    </div>
    ${_renderVendorPicker(p.assignedVendors||[])}
    <div class="form-group" style="margin-top:12px">
      ${typeof window.mUpload_renderMediaFields === 'function'
        ? window.mUpload_renderMediaFields({
            imageId: 'prod-img',
            videoId: 'prod-video',
            currentImageUrl: p.imageBase64 || '',
            currentVideoUrl: p.videoUrl || '',
            imageRequired: false,
            showVideo: true
          })
        : `
          <label class="form-label">صورة المنتج</label>
          ${p.imageBase64 ? `<img src="${p.imageBase64}" style="width:70px;height:70px;border-radius:12px;object-fit:cover;display:block;margin-bottom:8px;border:2px solid var(--primary)">` : ''}
          <input type="file" class="form-control" id="prod-img" accept="image/*" onchange="ph43_previewImg(this)">
          <div id="prod-img-preview"></div>
        `
      }
    </div>
    <div class="form-group" style="display:flex;align-items:center;gap:12px">
      <label class="toggle-switch"><input type="checkbox" id="prod-active"${p.active !== false ? ' checked' : ''}><span class="toggle-slider"></span></label>
      <span>منتج نشط</span>
    </div>

    <!-- قسم العروض -->
    <div style="border:1px solid rgba(239,68,68,0.25);background:linear-gradient(135deg,rgba(239,68,68,0.04),rgba(245,158,11,0.03));border-radius:14px;padding:14px;margin-top:12px">
      <div style="font-weight:800;font-size:14px;color:#ef4444;margin-bottom:10px">🏷️ قسم العروض والخصومات</div>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 12px;background:rgba(239,68,68,0.06);border:1px dashed rgba(239,68,68,0.3);border-radius:10px;margin-bottom:10px">
        <input type="checkbox" id="prod-add-to-offers" onchange="ph43_toggleEditOfferFields(this.checked)" style="width:18px;height:18px;accent-color:#ef4444" ${p.offerId ? 'checked' : ''}>
        <div>
          <div style="font-weight:700;font-size:13px">إضافة هذا المنتج إلى قسم العروض</div>
          <div style="font-size:11px;color:var(--text-muted)">يظهر للعملاء في صفحة العروض بسعر مخفض</div>
        </div>
      </label>
      <div id="prod-offer-fields" style="display:${p.offerId ? 'block' : 'none'}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">نسبة الخصم (%)</label>
            <input class="form-control" id="prod-offer-pct" type="number" min="1" max="99" value="${p.offerDiscountPct || ''}" placeholder="مثال: 25">
          </div>
          <div class="form-group">
            <label class="form-label">تاريخ الانتهاء (فارغ = دائم)</label>
            <input class="form-control" id="prod-offer-expires" type="date" value="${p.offerExpiresAt ? (p.offerExpiresAt.toDate ? p.offerExpiresAt.toDate() : new Date(p.offerExpiresAt)).toISOString().split('T')[0] : ''}">
          </div>
        </div>
      </div>
    </div>

    ${typeof ph48_adminSectionHtml === 'function' ? ph48_adminSectionHtml(p) : ''}
    <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="ph43_updateProduct('${productId}','${storeId}')">💾 حفظ التعديلات</button>
  `);
};

window.ph43_toggleEditOfferFields = function (show) {
  const el = document.getElementById('prod-offer-fields');
  if (el) el.style.display = show ? 'block' : 'none';
};

window.ph43_previewImg = function(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5*1024*1024) { toast('الصورة كبيرة جداً', 'error'); input.value=''; return; }
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('prod-img-preview');
    if (prev) prev.innerHTML = `<img src="${e.target.result}" style="width:70px;height:70px;border-radius:12px;object-fit:cover;border:2px solid var(--primary)">`;
    window.__ph43_pendingImg = e.target.result;
  };
  reader.readAsDataURL(file);
};

window.ph43_updateProduct = async function (productId, storeId) {
  const catId  = document.getElementById('prod-cat')?.value || null;
  const name   = document.getElementById('prod-name')?.value.trim();
  const desc   = document.getElementById('prod-desc')?.value.trim();
  const price  = parseFloat(document.getElementById('prod-price')?.value) || 0;
  const unit   = document.getElementById('prod-unit')?.value.trim();
  const active = document.getElementById('prod-active')?.checked !== false;
  const isDigital = document.getElementById('prod-is-digital')?.checked === true;
  const assignedVendors = Array.from(document.querySelectorAll('.svc-vendor-cb:checked')).map(cb=>cb.value);
  const upd = { catId, name, desc, price, unit, active, isDigital, assignedVendors };

  // ── بيانات التنبيهات وحالة التوفر (ph48) ─────────────────────────
  if (typeof ph48_collectAlertData === 'function') {
    const alertData = ph48_collectAlertData();
    upd.stockStatus = alertData.stockStatus || 'available';
    upd.alertBadge  = alertData.alertBadge  || null;
  }

  const p = (AppData.storeProducts || []).find(x => x.id === productId);
  if (!p) return;

  showLoader('جاري الحفظ...');
  try {
    // ─── رفع الصورة الرئيسية إن وُجدت (مع ضغط تلقائي) ───
    const imgInput = document.getElementById('prod-img');
    if (imgInput && imgInput.files && imgInput.files[0] && typeof window.mUpload_uploadImage === 'function') {
      showLoader('⏳ جاري ضغط ورفع الصورة...');
      const imgUrl = await window.mUpload_uploadImage(imgInput.files[0], `images/store_products/${productId}_main`);
      if (imgUrl) upd.imageBase64 = imgUrl;
    } else if (window.__ph43_pendingImg) {
      upd.imageBase64 = window.__ph43_pendingImg;
    } else {
      upd.imageBase64 = p.imageBase64 || null;
    }

    // ─── رفع الفيديو إن وُجد ───
    const vidInput = document.getElementById('prod-video');
    if (vidInput && vidInput.files && vidInput.files[0] && typeof window.mUpload_uploadVideo === 'function') {
      showLoader('🎬 جاري رفع الفيديو...');
      window.mUpload_showProgressToast('🎬 رفع فيديو المنتج...');
      const vidFile = vidInput.files[0];
      const ext = vidFile.name.split('.').pop().toLowerCase();
      upd.videoUrl = await window.mUpload_uploadVideo(
        vidFile,
        `videos/store_products/${productId}_${Date.now()}.${ext}`,
        (pct) => window.mUpload_updateProgressToast(pct, `🎬 رفع الفيديو... ${pct}%`)
      );
      window.mUpload_hideProgressToast();
    } else {
      upd.videoUrl = p.videoUrl || null;
    }

    await fsUpdate('store_products', productId, upd);
    window.__ph43_pendingImg = null;

    // معالجة العروض
    const addToOffers = document.getElementById('prod-add-to-offers')?.checked;
    if (addToOffers && typeof ph_saveOfferFromSource === 'function') {
      const offerPct = parseFloat(document.getElementById('prod-offer-pct')?.value) || 0;
      const expStr   = document.getElementById('prod-offer-expires')?.value || '';
      const p = (AppData.storeProducts || []).find(x => x.id === productId);
      if (offerPct > 0 && price > 0) {
        const img = window.__ph43_pendingImg || p?.imageBase64 || null;
        await ph_saveOfferFromSource({
          title: name, desc,
          sourceType: 'store_product', sourceId: productId,
          sourceSection: 'stores', originalPrice: price,
          discountPercent: offerPct, imageBase64: img,
          expiresStr: expStr
        });
      }
    }

    await ph43_reloadStoreData();
    hideLoader(); closeModal();
    toast('✅ تم التعديل', 'success');
    await render();
  } catch (e) {
    if (typeof window.mUpload_hideProgressToast === 'function') window.mUpload_hideProgressToast();
    hideLoader();
    toast('خطأ: ' + e.message, 'error');
  }
};

window.ph43_deleteProduct = async function (productId) {
  if (!confirm('حذف هذا المنتج؟')) return;
  await fsDelete('store_products', productId);
  await ph43_reloadStoreData();
  toast('✅ تم الحذف', 'success');
  await render();
};

// ─── Phase 43: Store Products Booking Tiers ───────────
window.ph43_showProductTiersModal = function (productId, storeId) {
  const p = (AppData.storeProducts || []).find(x => x.id === productId);
  if (!p) return;
  const tiers = p.tiers || [];

  const renderTierRow = (tier, idx) => `
    <div class="ph40-tier-row" id="ph43-tier-${idx}">
      <div class="ph40-tier-header">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">${tier.icon || '🏷️'}</span>
          <div>
            <div class="ph40-tier-name">${escHtml(tier.name)}</div>
            <div class="ph40-tier-price">${(tier.price || 0).toLocaleString('ar-YE')} ريال</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-sm btn-danger" onclick="ph43_deleteProductTier('${productId}', '${storeId}', ${idx})">🗑️ حذف</button>
        </div>
      </div>
      ${tier.desc ? `<div class="ph40-tier-desc">${escHtml(tier.desc)}</div>` : ''}
      ${tier.features && tier.features.length ? `
        <div class="ph40-tier-features">
          ${tier.features.map(f => `<span class="ph40-feature-tag">✓ ${escHtml(f)}</span>`).join('')}
        </div>` : ''}
    </div>`;

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">🏷️ فئات المنتج — ${escHtml(p.name)}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>

    <div class="ph40-info-box">
      💡 أضف فئات ومميزات مختلفة لهذا المنتج/الخدمة بالمتجر (مثال: سرير واحد بـ 5000 وسريرين بـ 8000). سيختار العميل منها عند الطلب.
    </div>

    <div id="ph43-tiers-list">
      ${tiers.length ? tiers.map(renderTierRow).join('') : `
        <div class="empty-state" style="padding:28px 20px">
          <div class="empty-icon">🏷️</div>
          <div class="empty-title">لا توجد فئات بعد</div>
          <div class="empty-sub">أضف الفئة الأولى للمنتج أدناه</div>
        </div>`}
    </div>

    <div class="ph40-add-tier-form">
      <h3 style="margin-bottom:14px;font-size:15px;font-weight:700">➕ إضافة فئة جديدة للمنتج</h3>
      <div class="ph40-form-grid">
        <div class="form-group">
          <label class="form-label">اسم الفئة *</label>
          <input class="form-control" id="ph43-t-name" placeholder="مثال: جناح عائلي">
        </div>
        <div class="form-group">
          <label class="form-label">السعر (ريال) *</label>
          <input class="form-control" id="ph43-t-price" type="number" min="0" placeholder="مثال: 5000">
        </div>
        <div class="form-group">
          <label class="form-label">أيقونة (اختياري)</label>
          <input class="form-control" id="ph43-t-icon" placeholder="مثال: 🛏️ أو 👑">
        </div>
        <div class="form-group">
          <label class="form-label">وصف مختصر</label>
          <input class="form-control" id="ph43-t-desc" placeholder="وصف الفئة...">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">المميزات (افصل بفاصلة)</label>
          <input class="form-control" id="ph43-t-features" placeholder="مثال: واي فاي مجاني, سريرين, إفطار مجاني">
        </div>
      </div>
      <button class="btn btn-primary btn-block" onclick="ph43_addProductTier('${productId}', '${storeId}')">➕ إضافة الفئة</button>
    </div>`);
};

window.ph43_addProductTier = async function (productId, storeId) {
  const name    = document.getElementById('ph43-t-name')?.value.trim();
  const price   = parseFloat(document.getElementById('ph43-t-price')?.value) || 0;
  const icon    = document.getElementById('ph43-t-icon')?.value.trim() || '🏷️';
  const desc    = document.getElementById('ph43-t-desc')?.value.trim() || '';
  const featStr = document.getElementById('ph43-t-features')?.value.trim() || '';
  const features = featStr ? featStr.split(',').map(f => f.trim()).filter(Boolean) : [];

  if (!name)          { toast('اسم الفئة مطلوب', 'error'); return; }
  if (!price || price <= 0) { toast('يجب إدخال سعر صحيح أكبر من صفر', 'error'); return; }

  const p = (AppData.storeProducts || []).find(x => x.id === productId);
  if (!p) return;

  const tiers = [...(p.tiers || []), { name, price, icon, desc, features }];
  showLoader('جاري حفظ الفئات...');
  try {
    await fsUpdate('store_products', productId, { tiers });
    p.tiers = tiers;
    await ph43_reloadStoreData();
    hideLoader();
    toast('✅ تمت إضافة الفئة بنجاح', 'success');
    ph43_showProductTiersModal(productId, storeId);
    await render();
  } catch (e) {
    hideLoader();
    toast('تعذّر الحفظ: ' + (e.message || e), 'error');
  }
};

window.ph43_deleteProductTier = async function (productId, storeId, idx) {
  if (!confirm('حذف هذه الفئة نهائياً؟')) return;
  const p = (AppData.storeProducts || []).find(x => x.id === productId);
  if (!p) return;
  const tiers = (p.tiers || []).filter((_, i) => i !== idx);
  showLoader('جاري الحذف...');
  try {
    await fsUpdate('store_products', productId, { tiers });
    p.tiers = tiers;
    await ph43_reloadStoreData();
    hideLoader();
    toast('تم حذف الفئة', 'success');
    ph43_showProductTiersModal(productId, storeId);
    await render();
  } catch (e) {
    hideLoader();
    toast('تعذّر الحذف: ' + (e.message || e), 'error');
  }
};

window.ph43_renderProductTierSelector = function (product) {
  const tiers = product.tiers;
  if (!tiers || !tiers.length) return '';
  return `
    <div class="ph40-tier-selector">
      <div class="ph40-tier-selector-header">
        <span class="ph40-tier-selector-title">🏷️ اختر الفئة المناسبة</span>
        <span class="ph40-tier-count-badge">${tiers.length} فئات متاحة</span>
      </div>
      <div class="ph40-tier-cards-grid" id="ph43-tier-cards">
        ${tiers.map((tier, idx) => `
          <div class="ph40-tier-card-v2${idx === 0 ? ' selected' : ''}" id="ph43-tc-${idx}"
               onclick="ph43_selectProductTier(${idx}, ${tier.price || 0}, '${escAttr(tier.name)}')">
            <div class="ph40-tcv2-check" id="ph43-check-${idx}">${idx === 0 ? '✓' : ''}</div>
            <div class="ph40-tcv2-icon">${tier.icon || '🏷️'}</div>
            <div class="ph40-tcv2-name">${escHtml(tier.name)}</div>
            ${tier.desc ? `<div class="ph40-tcv2-desc">${escHtml(tier.desc)}</div>` : ''}
            <div class="ph40-tcv2-price-row">
              <span class="ph40-tcv2-price">${(tier.price || 0).toLocaleString('ar-YE')}</span>
              <span class="ph40-tcv2-cur">ريال</span>
            </div>
            ${tier.features && tier.features.length ? `
              <div class="ph40-tcv2-features">
                ${tier.features.slice(0,3).map(f => `<span class="ph40-tcv2-feat">✓ ${escHtml(f)}</span>`).join('')}
                ${tier.features.length > 3 ? `<span class="ph40-tcv2-feat ph40-tcv2-feat-more">+${tier.features.length - 3}</span>` : ''}
              </div>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
};

window.ph43_selectProductTier = function (idx, price, name) {
  // Support both old (.ph40-tier-card) and new (.ph40-tier-card-v2) layouts
  const cards = document.querySelectorAll('#ph43-tier-cards .ph40-tier-card, #ph43-tier-cards .ph40-tier-card-v2');
  const isV2  = document.querySelector('#ph43-tier-cards .ph40-tier-card-v2') !== null;
  cards.forEach((c, i) => {
    c.classList.toggle('selected', i === idx);
    const chk = document.getElementById('ph43-check-' + i);
    if (chk) chk.textContent = i === idx ? (isV2 ? '✓' : '✅') : '';
  });
  window.__ph43_selectedProductTier = { idx, price, name };
};

window.__ph43_selectedProductTier = null;

// ─── Data Reload ──────────────────────────────────────
window.ph43_reloadStoreData = async function () {
  const [stores, storeCats, storeProducts] = await Promise.all([
    fsGetAll('stores').catch(() => []),
    fsGetAll('store_cats').catch(() => []),
    fsGetAll('store_products').catch(() => []),
  ]);
  AppData.stores       = stores;
  AppData.storeCats    = storeCats;
  AppData.storeProducts = storeProducts;
};

// ─── Periodically refresh cart badge ─────────────────
setInterval(ph43_updateCartBadge, 1000);

// ───────────────────────────────────────────────────────
// SECTION 7 — Styles
// ───────────────────────────────────────────────────────
(function () {
  if (window.__ph43Styles) return;
  window.__ph43Styles = true;
  const s = document.createElement('style');
  s.textContent = `
    /* ── Horizontal Categories Layout ── */
    .ph43-cats-tabs-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      flex-wrap: wrap;
      width: 100%;
    }
    .ph43-cats-title {
      font-size: 13px;
      font-weight: 800;
      color: var(--text-muted);
      margin-inline-end: 4px;
      font-family: var(--font, 'Cairo');
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .ph43-cat-tab {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(255, 255, 255, 0.02);
      color: var(--text-muted, #94a3b8);
      font-size: 13px;
      font-weight: 700;
      font-family: var(--font, 'Cairo');
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      user-select: none;
    }
    .ph43-cat-tab:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.15);
      color: #fff;
      transform: translateY(-1px);
    }
    .ph43-cat-tab.active {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(124, 58, 237, 0.18));
      border-color: var(--primary, #7c3aed);
      color: #fff;
      box-shadow: 0 0 14px rgba(124, 58, 237, 0.18);
    }
    .ph43-cat-tab-icon {
      font-size: 16px;
    }
    .ph43-cat-tab-count {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-muted, #94a3b8);
      border-radius: 6px;
      padding: 1px 7px;
      font-size: 10.5px;
      font-weight: 800;
      min-width: 20px;
      text-align: center;
      transition: all 0.2s;
    }
    .ph43-cat-tab.active .ph43-cat-tab-count {
      background: var(--primary, #7c3aed);
      color: #fff;
    }

    /* ── View Toggle ── */
    .ph43-view-toggle { display:flex; gap:4px; background:var(--bg-secondary); border-radius:12px; padding:4px; border:1px solid var(--border); }
    .ph43-vtbtn { display:flex; align-items:center; gap:5px; padding:6px 12px; border-radius:9px; border:none; background:transparent; cursor:pointer; font-size:12px; font-weight:600; color:var(--text-muted); font-family:inherit; transition:all 0.18s; }
    .ph43-vtbtn:hover { background:var(--bg-card); color:var(--text-main); }
    .ph43-vtbtn.active { background:var(--bg-card); color:var(--primary); box-shadow:0 2px 8px rgba(0,0,0,0.1); }
    @media(max-width:480px) { .ph43-vtbtn span:not(svg) { display:none; } .ph43-vtbtn { padding:7px 10px; } }

    /* ── Store Listing Grid ── */
    .ph43-stores-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:16px; }
    .ph43-store-card { background:var(--bg-card); border:1px solid var(--glass-border); border-radius:18px; overflow:hidden; cursor:pointer; transition:all 0.22s; }
    .ph43-store-card:hover { transform:translateY(-4px); box-shadow:var(--shadow-lg); border-color:rgba(139,92,246,0.4); }
    .ph43-store-card-header { position:relative; height:110px; overflow:hidden; background:var(--bg-secondary); }
    .ph43-store-banner { width:100%; height:100%; object-fit:cover; }
    .ph43-store-banner-placeholder { height:100%; display:flex; align-items:center; justify-content:center; font-size:46px; background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(139,92,246,0.02)); }
    .ph43-store-card-avatar { position:absolute; bottom:-16px; right:14px; width:44px; height:44px; border-radius:11px; border:3px solid var(--bg-card); background:var(--bg-secondary); display:flex; align-items:center; justify-content:center; font-size:22px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.12); }
    .ph43-store-card-avatar img { width:100%; height:100%; object-fit:cover; }
    .ph43-store-card-body { padding:22px 14px 14px; }
    .ph43-store-name { font-size:16px; font-weight:800; margin-bottom:4px; }
    .ph43-store-desc { font-size:12px; color:var(--text-secondary); line-height:1.5; margin-bottom:9px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .ph43-store-meta { display:flex; gap:10px; font-size:11px; color:var(--text-muted); margin-bottom:12px; flex-wrap:wrap; }
    .ph43-store-btn { width:100%; border-radius:11px !important; padding:9px !important; font-size:13px !important; }

    /* ── List View ── */
    .ph43-stores-list { display:flex; flex-direction:column; gap:10px; }
    .ph43-store-list-item { display:flex; align-items:center; gap:14px; background:var(--bg-card); border:1px solid var(--glass-border); border-radius:14px; padding:14px 16px; cursor:pointer; transition:all 0.2s; }
    .ph43-store-list-item:hover { border-color:rgba(139,92,246,0.35); box-shadow:0 4px 14px rgba(0,0,0,0.08); transform:translateX(-2px); }
    .ph43-list-logo { width:52px; height:52px; border-radius:13px; background:var(--bg-secondary); display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; border:1px solid var(--border); }
    .ph43-list-info { flex:1; min-width:0; }
    .ph43-list-name { font-weight:800; font-size:15px; margin-bottom:3px; }
    .ph43-list-desc { font-size:12px; color:var(--text-secondary); margin-bottom:5px; line-height:1.4; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ph43-list-meta { display:flex; gap:10px; font-size:11px; color:var(--text-muted); flex-wrap:wrap; }
    .ph43-list-arrow { font-size:18px; color:var(--primary); flex-shrink:0; padding:0 4px; }

    /* ── Slideshow View (redesigned) ── */
    .ph43-slideshow-view { display:flex; flex-direction:column; gap:18px; }

    .ph43-sl-card {
      background:var(--bg-card);
      border:1px solid var(--glass-border);
      border-radius:20px;
      overflow:hidden;
      box-shadow:0 4px 20px rgba(0,0,0,0.12);
      transition:transform 0.2s, box-shadow 0.2s;
    }
    .ph43-sl-card:hover { transform:translateY(-3px); box-shadow:0 8px 32px rgba(0,0,0,0.18); }

    /* رأس البطاقة */
    .ph43-sl-head {
      position:relative; height:148px; cursor:pointer; overflow:hidden;
      background:linear-gradient(135deg,#7c3aed,#a855f7);
    }
    .ph43-sl-banner {
      width:100%; height:100%; object-fit:cover; display:block;
      transition:transform 0.4s cubic-bezier(0.4,0,0.2,1);
    }
    .ph43-sl-head:hover .ph43-sl-banner { transform:scale(1.05); }
    .ph43-sl-icon-big {
      position:absolute; inset:0; display:flex; align-items:center;
      justify-content:center; font-size:64px; opacity:0.85;
    }
    .ph43-sl-head-overlay {
      position:absolute; inset:0;
      background:linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 55%, transparent 100%);
    }
    /* شارة الحالة */
    .ph43-sl-badge {
      position:absolute; top:10px; right:10px;
      font-size:11px; font-weight:700; padding:4px 10px; border-radius:20px;
      backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
    }
    .ph43-sl-badge.open { background:rgba(16,185,129,0.25); color:#6ee7b7; border:1px solid rgba(16,185,129,0.4); }
    .ph43-sl-badge.closed { background:rgba(239,68,68,0.25); color:#fca5a5; border:1px solid rgba(239,68,68,0.4); }
    /* معلومات المتجر فوق الصورة */
    .ph43-sl-info {
      position:absolute; bottom:0; inset-inline:0;
      display:flex; align-items:flex-end; gap:10px; padding:12px 14px;
    }
    .ph43-sl-avatar {
      width:42px; height:42px; border-radius:11px;
      background:rgba(255,255,255,0.15);
      display:flex; align-items:center; justify-content:center;
      font-size:22px; flex-shrink:0; overflow:hidden;
      border:2px solid rgba(255,255,255,0.3);
      backdrop-filter:blur(6px);
    }
    .ph43-sl-name { font-weight:800; font-size:15px; color:#fff; line-height:1.3; }
    .ph43-sl-desc { font-size:11px; color:rgba(255,255,255,0.72); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    /* جسم البطاقة */
    .ph43-sl-body { padding:12px 14px 14px; }
    .ph43-sl-body-top {
      display:flex; align-items:center; justify-content:space-between;
      margin-bottom:10px;
    }
    .ph43-sl-body-label { font-size:12px; font-weight:700; color:var(--text-muted); }

    /* زر عرض الكل */
    .ph43-sl-showall {
      display:inline-flex; align-items:center; gap:5px;
      padding:6px 14px; border-radius:10px; border:none; cursor:pointer;
      font-size:12px; font-weight:700; font-family:inherit;
      background:var(--primary); color:#fff;
      box-shadow:0 3px 10px rgba(139,92,246,0.35);
      transition:all 0.18s;
    }
    .ph43-sl-showall:hover { opacity:0.88; transform:translateX(-2px); }

    /* شرائح الأقسام */
    .ph43-sl-chips-scroll {
      display:flex; gap:8px; overflow-x:auto;
      padding-bottom:4px; padding-top:2px;
      scrollbar-width:none;
    }
    .ph43-sl-chips-scroll::-webkit-scrollbar { display:none; }
    .ph43-sl-chip {
      display:flex; align-items:center; gap:6px;
      padding:7px 13px; border-radius:22px; flex-shrink:0;
      border:1.5px solid rgba(139,92,246,0.25);
      background:rgba(139,92,246,0.07);
      color:var(--text-main); cursor:pointer;
      font-size:12.5px; font-weight:600; font-family:inherit;
      transition:all 0.18s; white-space:nowrap;
    }
    .ph43-sl-chip-ic { font-size:15px; }
    .ph43-sl-chip-cnt {
      background:rgba(0,0,0,0.08); border-radius:8px;
      padding:1px 7px; font-size:10px; font-weight:800;
      color:var(--text-muted); margin-inline-start:2px;
    }
    .ph43-sl-no-cats {
      font-size:12px; color:var(--text-muted); margin:0;
      padding:4px 0; font-style:italic;
    }

    /* ══ Store Hero Redesigned ══ */
    .ph43-store-hero { position:relative; margin-bottom:0; overflow:hidden; }
    .ph43-store-hero-bg { position:relative; height:220px; }
    .ph43-store-hero-gradient { width:100%; height:100%; background:linear-gradient(135deg,#1a0a2e 0%,#2d1060 40%,#1e0d4a 100%); }
    .ph43-store-hero-img { width:100%; height:100%; object-fit:cover; display:block; }
    .ph43-store-hero-overlay { position:absolute; inset:0; background:linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.65) 100%); }
    .ph43-store-hero-content { position:relative; padding:0; }
    .ph43-store-hero-nav { position:absolute; top:-180px; left:0; right:0; display:flex; align-items:center; justify-content:space-between; padding:16px 20px; z-index:10; }
    .ph43-hero-back-btn { display:inline-flex; align-items:center; gap:6px; background:rgba(0,0,0,0.35); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.15); color:#fff; border-radius:10px; padding:7px 14px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; transition:all 0.2s; }
    .ph43-hero-back-btn:hover { background:rgba(0,0,0,0.55); }
    .ph43-hero-cart-btn { display:inline-flex; align-items:center; gap:6px; background:linear-gradient(135deg,#8b5cf6,#6d28d9); border:none; color:#fff; border-radius:10px; padding:7px 14px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; transition:all 0.2s; box-shadow:0 4px 12px rgba(139,92,246,0.4); }
    .ph43-hero-cart-btn:hover { transform:scale(1.05); }
    .ph43-hero-share-btn { display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; background:rgba(0,0,0,0.35); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.15); color:#fff; border-radius:10px; cursor:pointer; transition:all 0.2s; }
    .ph43-hero-share-btn:hover { background:rgba(0,0,0,0.55); }
    .ph43-store-hero-identity { display:flex; align-items:flex-end; gap:16px; padding:0 20px 0; margin-top:-40px; position:relative; z-index:5; }
    .ph43-store-hero-logo { width:72px; height:72px; border-radius:16px; background:var(--bg-card); border:3px solid var(--bg-card); box-shadow:0 8px 24px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; font-size:32px; overflow:hidden; flex-shrink:0; }
    .ph43-store-hero-logo img { width:100%; height:100%; object-fit:cover; }
    .ph43-store-hero-text { flex:1; min-width:0; padding-bottom:4px; }
    .ph43-store-hero-name { font-size:22px; font-weight:800; color:var(--text-main); margin:0 0 4px; line-height:1.2; }
    .ph43-store-hero-desc { font-size:13px; color:var(--text-secondary); margin:0 0 8px; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .ph43-store-hero-badges { display:flex; gap:6px; flex-wrap:wrap; }
    .ph43-store-hero-badge { display:inline-flex; align-items:center; gap:4px; background:var(--bg-secondary); border:1px solid var(--glass-border); border-radius:8px; padding:3px 10px; font-size:12px; font-weight:600; color:var(--text-secondary); }

    /* ══ Category Tabs Bar (Horizontal) ══ */
    .ph43-cat-tabs-bar { background:var(--bg-card); border-bottom:1px solid var(--glass-border); padding:0 16px; position:sticky; top:60px; z-index:50; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); }
    .ph43-cat-tabs-scroll { display:flex; gap:2px; overflow-x:auto; scrollbar-width:none; padding:12px 0; }
    .ph43-cat-tabs-scroll::-webkit-scrollbar { display:none; }
    .ph43-cat-tab { display:inline-flex; align-items:center; gap:6px; padding:7px 16px; border-radius:10px; border:1px solid transparent; background:transparent; cursor:pointer; font-size:13px; font-weight:600; font-family:inherit; color:var(--text-secondary); white-space:nowrap; transition:all 0.2s; flex-shrink:0; }
    .ph43-cat-tab:hover { background:var(--bg-secondary); color:var(--text-main); }
    .ph43-cat-tab.active { background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(139,92,246,0.05)); color:var(--primary); border-color:rgba(139,92,246,0.3); font-weight:700; }
    .ph43-cat-tab-count { background:var(--bg-secondary); border-radius:6px; padding:1px 7px; font-size:11px; font-weight:700; color:var(--text-muted); }
    .ph43-cat-tab.active .ph43-cat-tab-count { background:rgba(139,92,246,0.2); color:var(--primary); }

    /* ══ Products Section ══ */
    .ph43-products-section { padding:20px 16px 100px; }
    .ph43-products-topbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; gap:12px; flex-wrap:wrap; }
    .ph43-products-title { font-size:17px; font-weight:800; color:var(--text-main); display:flex; align-items:center; gap:8px; }
    .ph43-products-count { display:inline-flex; align-items:center; justify-content:center; background:var(--bg-secondary); border-radius:8px; padding:2px 8px; font-size:12px; font-weight:700; color:var(--text-muted); }
    .ph43-search-inline { display:flex; align-items:center; gap:8px; background:var(--bg-secondary); border:1px solid var(--glass-border); border-radius:10px; padding:7px 12px; max-width:220px; width:100%; }
    .ph43-search-inline input { background:transparent; border:none; outline:none; font-size:13px; color:var(--text-main); font-family:inherit; width:100%; }
    .ph43-search-inline input::placeholder { color:var(--text-muted); }

    /* ══ Product Cards Premium ══ */
    .ph43-product-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:14px; }
    .ph43-product-card { background:var(--bg-card); border:1px solid var(--glass-border); border-radius:16px; overflow:hidden; transition:transform 0.22s cubic-bezier(0.4,0,0.2,1), box-shadow 0.22s, border-color 0.22s; display:flex; flex-direction:column; }
    .ph43-product-card:hover { box-shadow:0 12px 32px rgba(0,0,0,0.22); transform:translateY(-4px); border-color:rgba(139,92,246,0.3); }
    .ph43-product-img-wrap { position:relative; overflow:hidden; }
    .ph43-product-img { width:100%; height:150px; object-fit:cover; display:block; transition:transform 0.3s ease; }
    .ph43-product-card:hover .ph43-product-img { transform:scale(1.04); }
    .ph43-product-img-placeholder { width:100%; height:150px; background:linear-gradient(135deg,rgba(139,92,246,0.06),rgba(99,102,241,0.03)); display:flex; align-items:center; justify-content:center; }
    .ph43-product-body { padding:12px 12px 8px; flex:1; }
    .ph43-product-name { font-weight:700; font-size:13.5px; line-height:1.4; color:var(--text-main); margin-bottom:4px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .ph43-product-sku { display:inline-block; font-family:ui-monospace,monospace; font-size:10px; font-weight:700; background:rgba(139,92,246,0.08); color:var(--primary); border:1px solid rgba(139,92,246,0.18); border-radius:4px; padding:1px 6px; margin-top:3px; margin-bottom:3px; letter-spacing:0.5px; }
    .ph43-product-desc { font-size:11.5px; color:var(--text-secondary); line-height:1.55; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-top:4px; }
    .ph43-product-footer { padding:10px 12px 12px; display:flex; align-items:center; justify-content:space-between; gap:8px; border-top:1px solid var(--glass-border); margin-top:auto; }
    .ph43-product-price-block { display:flex; align-items:baseline; gap:4px; flex-shrink:0; flex-wrap:wrap; }
    /* Legacy (keep for backward compat) */
    .ph43-price-num { font-size:16px; font-weight:800; color:var(--primary); }
    .ph43-price-cur { font-size:11px; font-weight:600; color:var(--text-muted); }
    .ph43-price-label { font-size:10px; font-weight:600; color:var(--text-muted); margin-inline-end:2px; }
    .ph43-product-actions { display:flex; align-items:center; gap:5px; flex-shrink:0; }
    .ph43-add-cart-btn { display:inline-flex; align-items:center; gap:4px; padding:7px 12px; border-radius:10px; border:none; background:var(--gradient-main); color:#fff; cursor:pointer; font-size:11.5px; font-weight:700; transition:all 0.18s; white-space:nowrap; font-family:inherit; }
    .ph43-add-cart-btn:hover { transform:scale(1.06); box-shadow:0 4px 14px rgba(139,92,246,0.4); }
    .ph43-add-cart-btn.in-cart { background:linear-gradient(135deg,#10b981,#059669); }
    .ph43-add-cart-btn.ia-btn-disabled { background:rgba(100,116,139,0.25) !important; cursor:not-allowed; }

    /* ══ Cart Nav Button ══ */
    .ph43-cart-nav-btn { position:relative; display:inline-flex; align-items:center; gap:6px; background:linear-gradient(135deg,rgba(139,92,246,0.12),rgba(139,92,246,0.04)); color:var(--primary); border:1px solid rgba(139,92,246,0.25); border-radius:14px; padding:8px 14px; cursor:pointer; font-size:13px; font-weight:800; transition:all 0.3s cubic-bezier(0.4,0,0.2,1); overflow:visible; }
    .ph43-cart-nav-btn:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(139,92,246,0.18); border-color:rgba(139,92,246,0.4); }
    .ph43-cart-nav-btn svg { width:20px; height:20px; stroke-width:2; transition:all 0.3s; }
    #ph43-cart-badge { background:linear-gradient(135deg,#ef4444,#dc2626); color:#fff; border-radius:50%; min-width:20px; height:20px; padding:0 4px; font-size:11px; display:none; align-items:center; justify-content:center; font-weight:800; position:absolute; top:-8px; right:-8px; border:2px solid var(--bg-card); box-shadow:0 4px 10px rgba(239,68,68,0.4); z-index:2; transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1); }
    .cart-bump { animation:cartBumpAnim 0.5s cubic-bezier(0.34,1.56,0.64,1); }
    @keyframes cartBumpAnim { 0%{transform:scale(1)} 40%{transform:scale(1.15) translateY(-3px)} 100%{transform:scale(1) translateY(0)} }

    /* ══ Sticky Cart Bar Redesigned ══ */
    .ph43-sticky-cart { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:linear-gradient(135deg,#6d28d9,#8b5cf6); color:#fff; border-radius:16px; padding:12px 22px; display:flex; align-items:center; justify-content:space-between; gap:20px; min-width:280px; max-width:90vw; cursor:pointer; z-index:200; box-shadow:0 8px 28px rgba(109,40,217,0.55),0 0 0 1px rgba(255,255,255,0.1); font-size:14px; font-weight:700; transition:all 0.22s; animation:ph43CartPop 0.35s ease; border:1px solid rgba(255,255,255,0.12); }
    .ph43-sticky-cart:hover { transform:translateX(-50%) translateY(-3px); box-shadow:0 14px 36px rgba(109,40,217,0.65); }
    @keyframes ph43CartPop { from{opacity:0;transform:translateX(-50%) translateY(20px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }

    /* ══ Admin Store Cards ══ */
    .ph43-admin-store-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:20px; }
    .ph43-admin-store-card { background:var(--bg-card); border:1px solid var(--glass-border); border-radius:18px; padding:20px; transition:all 0.2s; }
    .ph43-admin-store-card:hover { box-shadow:var(--shadow-lg); }

    /* ══ Responsive ══ */
    @media(max-width:660px) {
      .ph43-store-hero-bg { height:160px; }
      .ph43-store-hero-identity { margin-top:-36px; padding:0 14px 0; gap:12px; }
      .ph43-store-hero-logo { width:60px; height:60px; font-size:26px; border-radius:12px; }
      .ph43-store-hero-name { font-size:18px; }
      .ph43-product-grid { grid-template-columns:repeat(2,1fr); gap:10px; }
      .ph43-stores-grid { grid-template-columns:1fr; }
      .ph43-sticky-cart { min-width:unset; left:12px; right:12px; transform:none; bottom:12px; border-radius:14px; }
      .ph43-sticky-cart:hover { transform:none; }
      .ph43-products-section { padding:16px 12px 100px; }
    }

    /* ── Product Tiers (فئات الحجز والمميزات) ── */
    .ph40-info-box { background:rgba(139,92,246,0.06); border:1px solid rgba(139,92,246,0.15); padding:12px 16px; border-radius:12px; font-size:13px; color:var(--primary); line-height:1.6; margin-bottom:20px; text-align:right; }
    .ph40-tier-row { background:var(--bg-secondary); border:1px solid var(--glass-border); border-radius:14px; padding:14px; margin-bottom:12px; text-align:right; }
    .ph40-tier-header { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .ph40-tier-name { font-weight:700; font-size:14px; }
    .ph40-tier-price { font-weight:800; color:var(--primary); font-size:13px; margin-top:2px; }
    .ph40-tier-desc { font-size:12px; color:var(--text-secondary); margin-top:6px; line-height:1.5; }
    .ph40-tier-features { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; justify-content:flex-start; }
    .ph40-feature-tag { font-size:11px; background:rgba(16,185,129,0.08); color:#10b981; border:1px solid rgba(16,185,129,0.15); border-radius:6px; padding:2px 8px; font-weight:600; }
    .ph40-add-tier-form { background:var(--bg-secondary); border:1.5px dashed var(--glass-border); border-radius:16px; padding:18px; margin-top:24px; text-align:right; }
    .ph40-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
    
    /* ── Tier Selector v2 (Grid) ── */
    .ph40-tier-selector { margin-bottom:20px; text-align:right; }
    .ph40-tier-selector-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
    .ph40-tier-selector-title { font-size:15px; font-weight:800; color:var(--text-main); }
    .ph40-tier-count-badge { background:rgba(139,92,246,0.12); color:var(--primary); border:1px solid rgba(139,92,246,0.2); border-radius:8px; padding:3px 10px; font-size:12px; font-weight:700; }
    .ph40-tier-cards-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px; }
    .ph40-tier-card-v2 { background:var(--bg-card); border:2px solid var(--glass-border); border-radius:14px; padding:14px 12px; cursor:pointer; transition:all 0.22s cubic-bezier(0.4,0,0.2,1); position:relative; text-align:center; display:flex; flex-direction:column; align-items:center; gap:6px; }
    .ph40-tier-card-v2:hover { border-color:rgba(139,92,246,0.35); background:var(--bg-secondary); transform:translateY(-2px); box-shadow:0 6px 16px rgba(0,0,0,0.1); }
    .ph40-tier-card-v2.selected { border-color:var(--primary); background:linear-gradient(135deg,rgba(139,92,246,0.1),rgba(139,92,246,0.04)); box-shadow:0 6px 20px rgba(139,92,246,0.2); }
    .ph40-tcv2-check { position:absolute; top:8px; left:8px; width:20px; height:20px; border-radius:50%; border:2px solid var(--glass-border); background:var(--bg-secondary); display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800; color:transparent; transition:all 0.2s; }
    .ph40-tier-card-v2.selected .ph40-tcv2-check { border-color:var(--primary); background:var(--primary); color:#fff; }
    .ph40-tcv2-icon { font-size:28px; margin-top:4px; }
    .ph40-tcv2-name { font-weight:800; font-size:13px; color:var(--text-main); line-height:1.3; }
    .ph40-tcv2-desc { font-size:11px; color:var(--text-muted); line-height:1.4; }
    .ph40-tcv2-price-row { display:flex; align-items:baseline; gap:3px; justify-content:center; margin-top:4px; }
    .ph40-tcv2-price { font-size:17px; font-weight:800; color:var(--primary); }
    .ph40-tcv2-cur { font-size:11px; font-weight:600; color:var(--text-muted); }
    .ph40-tcv2-features { display:flex; flex-wrap:wrap; gap:4px; justify-content:center; padding-top:8px; border-top:1px solid var(--glass-border); width:100%; margin-top:4px; }
    .ph40-tcv2-feat { font-size:10px; color:var(--text-secondary); background:var(--bg-secondary); border-radius:5px; padding:2px 6px; font-weight:600; }
    .ph40-tcv2-feat-more { background:rgba(139,92,246,0.1); color:var(--primary); }
    /* Legacy fallback */
    .ph40-tier-cards { display:flex; flex-direction:column; gap:10px; }
    .ph40-tier-card { background:var(--bg-card); border:1.5px solid var(--glass-border); border-radius:14px; padding:14px; cursor:pointer; transition:all 0.2s; position:relative; text-align:right; }
    .ph40-tier-card:hover { border-color:rgba(139,92,246,0.3); }
    .ph40-tier-card.selected { border-color:var(--primary); background:linear-gradient(135deg,rgba(139,92,246,0.06),rgba(139,92,246,0.02)); }
    .ph40-tc-header { display:flex; align-items:center; gap:12px; }
    .ph40-tc-icon { font-size:24px; flex-shrink:0; }
    .ph40-tc-info { flex:1; min-width:0; }
    .ph40-tc-name { font-weight:700; font-size:14px; }
    .ph40-tc-desc-inline { font-size:11px; color:var(--text-muted); }
    .ph40-tc-price-wrap { flex-shrink:0; display:flex; flex-direction:column; align-items:flex-end; }
    .ph40-tc-price { font-size:18px; font-weight:800; color:var(--primary); }
    .ph40-tc-currency { font-size:10px; color:var(--text-muted); font-weight:600; }
    .ph40-tc-check { font-size:16px; margin-inline-start:8px; flex-shrink:0; min-width:20px; text-align:center; }
    .ph40-tc-features { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; padding-top:10px; border-top:1px solid var(--glass-border); }
    .ph40-tc-feat { font-size:11px; color:var(--text-secondary); background:var(--bg-secondary); border-radius:6px; padding:2px 8px; font-weight:500; }
  `;
  document.head.appendChild(s);
})();

console.log('[Phase 43] Store & Shopping Cart System loaded');

// ═══════════════════════════════════════════════════════
//  محجوز — Rental System (نظام التأجير)
// ═══════════════════════════════════════════════════════
'use strict';

// ───────────────────────────────────────────────────────
// SECTION 1 — Core Logic
// ───────────────────────────────────────────────────────
if (!window.ph_rental_activeBooking) window.ph_rental_activeBooking = null;

// ───────────────────────────────────────────────────────
// SECTION 1.5 — Working Hours Helpers
// ───────────────────────────────────────────────────────
const RENTAL_DAYS = [
  { k: 'sat', n: 'السبت', i: 6 },
  { k: 'sun', n: 'الأحد', i: 0 },
  { k: 'mon', n: 'الاثنين', i: 1 },
  { k: 'tue', n: 'الثلاثاء', i: 2 },
  { k: 'wed', n: 'الأربعاء', i: 3 },
  { k: 'thu', n: 'الخميس', i: 4 },
  { k: 'fri', n: 'الجمعة', i: 5 }
];

function isRentalStoreOpenNow(store) {
  const oh = store?.openingHours;
  if (!oh || !oh.open || !oh.close || !oh.days || !oh.days.length) return null;
  const now = new Date();
  const dayIdx = now.getDay(); // 0=Sun..6=Sat
  const todayKey = RENTAL_DAYS.find(d => d.i === dayIdx)?.k;
  if (!oh.days.includes(todayKey)) return false;
  const [oh1, om1] = oh.open.split(':').map(Number);
  const [oh2, om2] = oh.close.split(':').map(Number);
  const cur = now.getHours()*60 + now.getMinutes();
  const start = oh1*60 + om1, end = oh2*60 + om2;
  return end > start ? (cur >= start && cur <= end) : (cur >= start || cur <= end);
}

function ph_getRentalStoreStatusHtml(s) {
  const open = isRentalStoreOpenNow(s);
  if (open === null) {
    return `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">🕒 مواعيد العمل غير محددة</div>`;
  }
  const statusBadge = open 
    ? `<span style="color:#14b8a6;font-weight:700">🟢 مفتوح الآن</span>` 
    : `<span style="color:#f43f5e;font-weight:700">⚪ مغلق حالياً</span>`;
  
  const oh = s.openingHours;
  const dayNames = (oh.days || []).map(k => RENTAL_DAYS.find(d => d.k === k)?.n || k).join('، ');
  
  return `
    <div style="display:flex;flex-direction:column;gap:4px;font-size:11px;margin-top:4px">
      <div style="display:flex;align-items:center;gap:6px">${statusBadge} <span style="color:var(--text-secondary)">(${oh.open} - ${oh.close})</span></div>
      <div style="color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="الأيام: ${escHtml(dayNames)}">📅 الأيام: ${escHtml(dayNames)}</div>
    </div>
  `;
}

// ───────────────────────────────────────────────────────
// SECTION 2 — Admin: Rental Store Management
// ───────────────────────────────────────────────────────
window.ph_renderAdminRentalStores = function (catId) {
  if (State.adminRentalView) return ph_renderAdminRentalStoreDetail(State.adminRentalView);

  const stores = (AppData.rentalStores || []).filter(s => s.catId === catId).sort((a, b) => (a.order || 0) - (b.order || 0));
  const cat = AppData.cats.find(c => c.id === catId);
  
  return `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">
    <div style="display:flex;align-items:center;gap:12px">
      <button class="btn btn-secondary btn-sm" onclick="State.adminTab='sys_bookings';render()">← رجوع للتصنيفات</button>
      <h2 style="margin:0">🏷️ متاجر التأجير: ${escHtml(cat?.name || '')}</h2>
    </div>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <input type="text" class="form-control" id="rental-stores-search" placeholder="🔍 ابحث عن متجر..." oninput="ph_filterAdminRentalStores()" style="width:240px">
      <button class="btn btn-primary" onclick="ph_showAddRentalStoreModal('${catId}')">➕ إضافة متجر تأجير</button>
    </div>
  </div>
  ${stores.length ? `
  <div class="ph43-admin-store-grid">
    ${stores.map(s => {
      const prodCount = (AppData.rentalProducts || []).filter(p => p.storeId === s.id).length;
      const subCatCount = (AppData.rentalSubCats || []).filter(c => c.storeId === s.id).length;
      return `
      <div class="ph43-admin-store-card ph-rental-store-card">
        <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px">
          <div style="font-size:40px;flex-shrink:0">${s.icon || '🏪'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:800;font-size:16px;margin-bottom:4px">${escHtml(s.name)}</div>
            ${s.desc ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:6px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(s.desc)}</div>` : ''}
            <div style="font-size:12px;color:var(--text-muted);margin-top:6px;display:flex;flex-wrap:wrap;gap:8px">
              <span>🔢 الترتيب: ${s.order || 0}</span>
              ${s.taxPercent ? `<span>📈 الضريبة: ${s.taxPercent}%</span>` : ''}
              <span>🕒 الدوام: ${s.openingHours ? `${s.openingHours.open} - ${s.openingHours.close}` : 'غير محدد'}</span>
            </div>
          </div>
          <span class="badge ${s.active !== false ? 'badge-teal' : 'badge-rose'}">${s.active !== false ? '✅ نشط' : '⏸️ معطّل'}</span>
        </div>
        <div style="display:flex;gap:16px;font-size:12px;color:var(--text-muted);margin-bottom:14px;padding:10px;background:var(--bg-secondary);border-radius:10px">
          <span>📦 ${prodCount} منتج</span>
          <span>📂 ${subCatCount} قسم</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" style="flex:1" onclick="ph_openRentalAdmin('${catId}', '${s.id}')">⚙️ إدارة المتجر</button>
          <button class="btn btn-sm btn-secondary" onclick="ph_showEditRentalStoreModal('${s.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="ph_deleteRentalStore('${s.id}')">🗑️</button>
        </div>
      </div>`;
    }).join('')}
  </div>` : `
  <div class="empty-state">
    <div class="empty-icon">🏪</div>
    <div class="empty-title">لا توجد متاجر تأجير هنا</div>
    <div class="empty-sub">أضف أول متجر لبدء إضافة منتجات التأجير</div>
    <button class="btn btn-primary" style="margin-top:20px" onclick="ph_showAddRentalStoreModal('${catId}')">➕ إضافة متجر تأجير</button>
  </div>`}`;
};

// ─── Store Detail (Sub-categories + Products) ─────────────
window.ph_renderAdminRentalStoreDetail = function (storeId) {
  const store = (AppData.rentalStores || []).find(s => s.id === storeId);
  if (!store) return '<div class="empty-state"><div class="empty-title">المتجر غير موجود</div></div>';

  const subCats = (AppData.rentalSubCats || []).filter(c => c.storeId === storeId).sort((a, b) => (a.order || 0) - (b.order || 0));
  const activeCat = State.adminRentalCat || null;
  const products = (AppData.rentalProducts || []).filter(p => p.storeId === storeId && (!activeCat || p.catId === activeCat));

  return `
  <div style="display:flex;align-items:center;margin-bottom:20px;background:var(--bg-card);padding:14px;border-radius:12px;border:1px solid var(--border);flex-wrap:wrap;gap:12px">
    <button class="btn btn-secondary btn-sm" onclick="ph_openRentalAdmin('${store.catId}')" style="margin-inline-end:16px">← رجوع للمتاجر</button>
    <span style="font-size:22px">${store.icon || '🏪'}</span>
    <h2 style="margin:0;font-size:20px">${escHtml(store.name)}</h2>
    <div style="display:flex;gap:12px;margin-inline-start:auto;align-items:center;flex-wrap:wrap">
      <input type="text" class="form-control" id="rental-prods-search" placeholder="🔍 ابحث عن منتج..." oninput="ph_filterAdminRentalProducts()" style="width:200px">
      <button class="btn btn-secondary btn-sm" onclick="ph_showManageRentalCatsModal('${storeId}')">📂 إدارة الأقسام الفرعية</button>
      <button class="btn btn-primary btn-sm" onclick="ph_showAddRentalProductModal('${storeId}')">➕ إضافة منتج إيجار</button>
    </div>
  </div>

  <!-- شريط الأقسام الأفقي المتطور -->
  <div class="ph43-cats-tabs-wrap">
    <div class="ph43-cats-title">📂 الأقسام:</div>
    <button class="ph43-cat-tab${!activeCat ? ' active' : ''}" onclick="State.adminRentalCat=null;ph_openRentalAdmin('${store.catId}', '${storeId}')">
      <span class="ph43-cat-tab-icon">🛍️</span>
      <span>الكل</span>
      <span class="ph43-cat-tab-count">${(AppData.rentalProducts || []).filter(p => p.storeId === storeId).length}</span>
    </button>
    ${subCats.map(c => {
      const cnt = (AppData.rentalProducts || []).filter(p => p.storeId === storeId && p.catId === c.id).length;
      return `<button class="ph43-cat-tab${activeCat === c.id ? ' active' : ''}" onclick="State.adminRentalCat='${c.id}';ph_openRentalAdmin('${store.catId}', '${storeId}')">
        <span class="ph43-cat-tab-icon">${c.icon || '📦'}</span>
        <span>${escHtml(c.name)}</span>
        <span class="ph43-cat-tab-count">${cnt}</span>
      </button>`;
    }).join('')}
  </div>

  <div style="width:100%" data-ph43-products-container="true">
      ${products.length ? `
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>الصورة</th><th>المنتج</th><th>القسم</th><th>المزودون</th><th>سعر الإيجار</th><th>الحالة</th><th>إجراءات</th></tr></thead>
          <tbody>
            ${products.map(p => {
              const cat = subCats.find(c => c.id === p.catId);
              const vCount = (p.vendors || []).length;
              return `<tr class="ph-rental-prod-row">
                <td>${p.imageBase64
                  ? `<img src="${p.imageBase64}" style="width:42px;height:42px;border-radius:10px;object-fit:cover">`
                  : '<span style="font-size:26px">📦</span>'}</td>
                <td>
                  <div style="font-weight:600">${escHtml(p.name)}</div>
                  ${p.desc ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${escHtml(p.desc).slice(0,60)}${p.desc.length>60?'...':''}</div>` : ''}
                </td>
                <td>${cat ? `<span class="badge badge-purple">${cat.icon || '📦'} ${escHtml(cat.name)}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
                <td><span class="badge badge-teal">${vCount} مزود${vCount>1?'ين':''}</span></td>
                <td style="font-weight:700;color:var(--primary)">${(p.price || 0).toLocaleString('ar-YE')} ريال</td>
                <td><span class="badge ${p.active !== false ? 'badge-teal' : 'badge-rose'}">${p.active !== false ? '✅ نشط' : '⏸️'}</span></td>
                <td>
                  <button class="btn btn-sm btn-secondary" onclick="ph_showEditRentalProductModal('${p.id}', '${storeId}')">✏️</button>
                  <button class="btn btn-sm btn-danger" onclick="ph_deleteRentalProduct('${p.id}')">🗑️</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:10px;font-size:13px;color:var(--text-muted)">${products.length} منتج تأجير</div>` : `
      <div class="empty-state" style="padding:60px">
        <div class="empty-icon">📦</div>
        <div class="empty-title">لا توجد منتجات${activeCat ? ' في هذا القسم' : ''}</div>
        <button class="btn btn-primary" style="margin-top:16px" onclick="ph_showAddRentalProductModal('${storeId}')">➕ إضافة منتج</button>
      </div>`}
  </div>`;
};

// ─── Store Modal ─────────────
window.ph_showAddRentalStoreModal = function (catId) {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">➕ إضافة متجر تأجير جديد</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group"><label class="form-label">اسم المتجر</label><input class="form-control" id="rst-name" placeholder="مثال: عالم فساتين الزفاف"></div>
    <div class="form-group"><label class="form-label">أيقونة</label><input class="form-control" id="rst-icon" placeholder="مثال: 👗"></div>
    <div class="form-group"><label class="form-label">صورة الشعار (اختياري)</label><input class="form-control" type="file" accept="image/*" onchange="ph_readRentalStoreImage(this, 'rst-logo-preview', 'rst-logo-b64')"><img id="rst-logo-preview" style="max-height:80px;margin-top:8px;border-radius:12px;display:none"><input type="hidden" id="rst-logo-b64"></div>
    <div class="form-group"><label class="form-label">صورة الغلاف (اختياري)</label><input class="form-control" type="file" accept="image/*" onchange="ph_readRentalStoreImage(this, 'rst-banner-preview', 'rst-banner-b64')"><img id="rst-banner-preview" style="max-height:80px;margin-top:8px;border-radius:12px;display:none;width:100%;object-fit:cover"><input type="hidden" id="rst-banner-b64"></div>
    <div class="form-group"><label class="form-label">ترتيب الظهور</label><input class="form-control" id="rst-order" type="number" value="0"></div>

    <div class="form-group"><label class="form-label">نسبة الضريبة (%)</label><input class="form-control" id="rst-tax-percent" type="number" step="0.01" value="0" placeholder="مثال: 15"></div>
    <div class="form-group">
      <label class="form-label">🕒 مواعيد العمل</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px">
        <div><label style="font-size:12px;color:var(--text-secondary)">يفتح</label><input class="form-control" id="rst-open" type="time" value="09:00"></div>
        <div><label style="font-size:12px;color:var(--text-secondary)">يغلق</label><input class="form-control" id="rst-close" type="time" value="22:00"></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px" id="rst-days">
        ${RENTAL_DAYS.map(d => `<label class="day-chip on"><input type="checkbox" value="${d.k}" checked onchange="this.parentElement.classList.toggle('on',this.checked)" hidden>${d.n}</label>`).join('')}
      </div>
    </div>
    <div class="form-group"><label class="form-label">الوصف (اختياري)</label><textarea class="form-control" id="rst-desc" rows="3"></textarea></div>
    <button class="btn btn-primary btn-block" onclick="ph_saveRentalStore('${catId}')">💾 حفظ المتجر</button>`);
};

window.ph_readRentalStoreImage = function (input, previewId, b64Id) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById(b64Id).value = e.target.result;
    const preview = document.getElementById(previewId);
    preview.src = e.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(input.files[0]);
};

window.ph_saveRentalStore = async function (catId) {
  const name = document.getElementById('rst-name').value.trim();
  const icon = document.getElementById('rst-icon').value.trim() || '🏪';
  if (!name) { toast('أدخل اسم المتجر', 'error'); return; }
  
  showLoader();
  try {
    await fsAdd('rentalStores', {
      catId, name, icon,
      desc: document.getElementById('rst-desc').value.trim(),
      logoBase64: document.getElementById('rst-logo-b64').value,
      bannerBase64: document.getElementById('rst-banner-b64').value,
      order: parseInt(document.getElementById('rst-order').value) || 0,
      taxPercent: parseFloat(document.getElementById('rst-tax-percent').value) || 0,
      openingHours: {
        open: document.getElementById('rst-open')?.value || '09:00',
        close: document.getElementById('rst-close')?.value || '22:00',
        days: Array.from(document.querySelectorAll('#rst-days input:checked')).map(i=>i.value)
      },
      hasAddress: false,
      storeAddressId: null,
      storeAddressName: null,
      storeRegionName: null,
      active: true
    });
    closeModal();
    toast('تم إضافة المتجر بنجاح ✅', 'success');
    await ph_openRentalAdmin(catId);
  } catch (e) { toast('خطأ في الحفظ: ' + e.message, 'error'); } finally { hideLoader(); }
};

window.ph_showEditRentalStoreModal = function (storeId) {
  const s = AppData.rentalStores.find(x => x.id === storeId);
  if (!s) return;
  const oh = s.openingHours || { open: '09:00', close: '22:00', days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] };
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ تعديل متجر التأجير</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group"><label class="form-label">اسم المتجر</label><input class="form-control" id="rst-name" value="${escAttr(s.name)}"></div>
    <div class="form-group"><label class="form-label">أيقونة</label><input class="form-control" id="rst-icon" value="${escAttr(s.icon || '')}"></div>
    <div class="form-group"><label class="form-label">الحالة</label>
      <select class="form-control" id="rst-active">
        <option value="true" ${s.active !== false ? 'selected' : ''}>✅ نشط</option>
        <option value="false" ${s.active === false ? 'selected' : ''}>⏸️ معطّل</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">صورة الشعار (اختياري)</label><input class="form-control" type="file" accept="image/*" onchange="ph_readRentalStoreImage(this, 'rst-logo-preview', 'rst-logo-b64')"><img id="rst-logo-preview" src="${s.logoBase64||''}" style="max-height:80px;margin-top:8px;border-radius:12px;display:${s.logoBase64?'block':'none'}"><input type="hidden" id="rst-logo-b64" value="${s.logoBase64||''}"></div>
    <div class="form-group"><label class="form-label">صورة الغلاف (اختياري)</label><input class="form-control" type="file" accept="image/*" onchange="ph_readRentalStoreImage(this, 'rst-banner-preview', 'rst-banner-b64')"><img id="rst-banner-preview" src="${s.bannerBase64||''}" style="max-height:80px;margin-top:8px;border-radius:12px;display:${s.bannerBase64?'block':'none'};width:100%;object-fit:cover"><input type="hidden" id="rst-banner-b64" value="${s.bannerBase64||''}"></div>
    <div class="form-group"><label class="form-label">ترتيب الظهور</label><input class="form-control" id="rst-order" type="number" value="${s.order || 0}"></div>

    <div class="form-group"><label class="form-label">نسبة الضريبة (%)</label><input class="form-control" id="rst-tax-percent" type="number" step="0.01" value="${s.taxPercent || 0}" placeholder="مثال: 15"></div>
    <div class="form-group">
      <label class="form-label">🕒 مواعيد العمل</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px">
        <div><label style="font-size:12px;color:var(--text-secondary)">يفتح</label><input class="form-control" id="rst-open" type="time" value="${oh.open||'09:00'}"></div>
        <div><label style="font-size:12px;color:var(--text-secondary)">يغلق</label><input class="form-control" id="rst-close" type="time" value="${oh.close||'22:00'}"></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px" id="rst-days">
        ${RENTAL_DAYS.map(d => `<label class="day-chip${(oh.days||[]).includes(d.k)?' on':''}"><input type="checkbox" value="${d.k}" ${(oh.days||[]).includes(d.k)?'checked':''} onchange="this.parentElement.classList.toggle('on',this.checked)" hidden>${d.n}</label>`).join('')}
      </div>
    </div>
    <div class="form-group"><label class="form-label">الوصف (اختياري)</label><textarea class="form-control" id="rst-desc" rows="3">${escHtml(s.desc || '')}</textarea></div>
    <button class="btn btn-primary btn-block" onclick="ph_updateRentalStore('${storeId}')">💾 تحديث المتجر</button>`);
};

window.ph_updateRentalStore = async function (storeId) {
  const name = document.getElementById('rst-name').value.trim();
  if (!name) { toast('أدخل اسم المتجر', 'error'); return; }
  showLoader();
  try {
    await fsUpdate('rentalStores', storeId, {
      name,
      icon: document.getElementById('rst-icon').value.trim(),
      desc: document.getElementById('rst-desc').value.trim(),
      active: document.getElementById('rst-active').value === 'true',
      logoBase64: document.getElementById('rst-logo-b64').value,
      bannerBase64: document.getElementById('rst-banner-b64').value,
      order: parseInt(document.getElementById('rst-order').value) || 0,
      taxPercent: parseFloat(document.getElementById('rst-tax-percent').value) || 0,
      openingHours: {
        open: document.getElementById('rst-open')?.value || '09:00',
        close: document.getElementById('rst-close')?.value || '22:00',
        days: Array.from(document.querySelectorAll('#rst-days input:checked')).map(i=>i.value)
      },
      hasAddress: false,
      storeAddressId: null,
      storeAddressName: null,
      storeRegionName: null,
    });
    // Get the catId so we can reload the correct tab
    const catId = State.adminTab ? State.adminTab.replace('rental_stores_', '') : null;
    closeModal(); toast('تم التحديث بنجاح ✅', 'success');
    if (catId) await ph_openRentalAdmin(catId);
    else await render();
  } catch (e) { toast('خطأ في التحديث', 'error'); } finally { hideLoader(); }
};

window.ph_deleteRentalStore = async function (storeId) {
  if (!confirm('حذف هذا المتجر وكل محتوياته؟')) return;
  showLoader();
  try {
    await fsDelete('rentalStores', storeId);
    const subCats = (AppData.rentalSubCats || []).filter(c => c.storeId === storeId);
    const prods = (AppData.rentalProducts || []).filter(p => p.storeId === storeId);
    await Promise.all([
      ...subCats.map(c => fsDelete('rentalSubCats', c.id)),
      ...prods.map(p => fsDelete('rentalProducts', p.id))
    ]);
    const catId = State.adminTab ? State.adminTab.replace('rental_stores_', '') : null;
    State.adminRentalView = null;
    toast('تم الحذف ✅', 'success');
    if (catId) await ph_openRentalAdmin(catId);
    else await render();
  } catch (e) { toast('خطأ في الحذف', 'error'); } finally { hideLoader(); }
};

// ─── Sub-categories Management ─────────────
window.ph_showManageRentalCatsModal = function (storeId) {
  const renderList = () => {
    const cats = (AppData.rentalSubCats || []).filter(c => c.storeId === storeId).sort((a,b)=>(a.order||0)-(b.order||0));
    return cats.length ? cats.map(c => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg-secondary);border-radius:12px;margin-bottom:8px;border:1px solid var(--border)">
        <span style="font-size:20px">${c.icon || '📂'}</span>
        <span style="flex:1;font-weight:600">${escHtml(c.name)}</span>
        <button class="btn btn-sm btn-danger" onclick="ph_deleteRentalSubCat('${c.id}', '${storeId}')">🗑️</button>
      </div>`).join('')
    : '<div style="text-align:center;padding:24px;color:var(--text-muted)">لا توجد أقسام فرعية بعد</div>';
  };

  openModal(`
    <div class="modal-header"><h2 class="modal-title">📂 إدارة الأقسام الفرعية للتأجير</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div id="rental-cats-list" style="margin-bottom:20px;max-height:300px;overflow-y:auto;direction:rtl;text-align:right">
      ${renderList()}
    </div>
    <div style="background:var(--bg-secondary);border-radius:14px;padding:16px;direction:rtl;text-align:right">
      <div style="font-weight:700;margin-bottom:12px;color:#ffffff">➕ إضافة قسم فرعي جديد</div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input class="form-control" id="new-rental-cat-icon" value="📂" style="width:70px;flex-shrink:0;text-align:center;font-size:18px">
        <input class="form-control" id="new-rental-cat-name" placeholder="اسم القسم الفرعي (مثال: فساتين)">
      </div>
      <button class="btn btn-primary btn-block" onclick="ph_saveRentalSubCat('${storeId}')">➕ إضافة</button>
    </div>
  `);
};

window.ph_saveRentalSubCat = async function (storeId) {
  const name = document.getElementById('new-rental-cat-name')?.value.trim();
  const icon = document.getElementById('new-rental-cat-icon')?.value.trim() || '📂';
  if (!name) { toast('أدخل اسم القسم', 'error'); return; }
  showLoader();
  try {
    const order = (AppData.rentalSubCats || []).filter(c => c.storeId === storeId).length;
    await fsAdd('rentalSubCats', { storeId, name, icon, order });
    await loadAllData();
    toast('✅ تم إضافة القسم الفرعي بنجاح', 'success');
    ph_showManageRentalCatsModal(storeId);
  } catch (e) {
    toast('خطأ: ' + e.message, 'error');
  } finally {
    hideLoader();
  }
};

window.ph_deleteRentalSubCat = async function (catId, storeId) {
  if (!confirm('حذف هذا القسم الفرعي؟ ستظل المنتجات المرتبطة به بدون قسم فرعي.')) return;
  showLoader();
  try {
    await fsDelete('rentalSubCats', catId);
    await loadAllData();
    toast('✅ تم حذف القسم الفرعي بنجاح', 'success');
    ph_showManageRentalCatsModal(storeId);
  } catch (e) {
    toast('خطأ: ' + e.message, 'error');
  } finally {
    hideLoader();
  }
};

window.ph_showAddRentalProductModal = function(storeId) {
  if (State.currentUser && State.currentUser.role !== 'admin') {
    toast('غير مسموح لمزودي الخدمة بالإضافة المباشرة لقسم التأجير. يرجى إرسال طلب إضافة خدمة للمراجعة.', 'warning');
    return;
  }

  const subCats = (AppData.rentalSubCats || []).filter(c => c.storeId === storeId);
  const activeItems = (AppData.catalogItems || []).filter(item => item.status === 'active' && ['bookings', 'stores'].includes(item.sectionId));
  const providers = (AppData.users || []).filter(u => ['vendor', 'provider'].includes(u.role));

  const modalHtml = `
    <div class="modal-header">
      <h2 class="modal-title">🏷️ ربط وإضافة منتجات تأجير من الكتالوج الموحد</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="ph46-modal-body-scroll" style="max-height: 75vh; overflow-y: auto; padding: 12px; direction: rtl; text-align: right; color: #ffffff;">
      
      <!-- اختيار القسم المحلي للتنزيل فيه -->
      <div class="form-group" style="margin-bottom: 16px;">
        <label class="form-label" style="font-weight: 700;">📂 اختر قسم المتجر الفرعي المستهدف *</label>
        <select class="form-control" id="ph46-local-rental-cat-select" onchange="window.__ph46_selectedRentalCatId = this.value;">
          <option value="">-- بدون قسم فرعي (عام) --</option>
          ${subCats.map(c => `<option value="${c.id}" ${State.adminRentalCat === c.id ? 'selected' : ''}>${c.icon || ''} ${escHtml(c.name)}</option>`).join('')}
        </select>
      </div>

      <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 16px; margin-top: 16px;">
        <!-- العمود الأيسر: قائمة المنتجات في الكتالوج -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 12px; padding: 16px;">
          <h4 style="margin-top:0; margin-bottom:12px; color:var(--primary); font-size:14px; border-bottom:1px solid var(--border, rgba(255,255,255,0.08)); padding-bottom:6px;">📋 1. اختر منتجات التأجير من الكتالوج الموحد</h4>
          
          <div class="search-input-wrap" style="margin-bottom:12px;">
            <input type="text" class="form-control" placeholder="🔍 بحث بالاسم..." oninput="window.ph46_filterRentalCatalogList(this.value)">
          </div>

          <div id="ph46-rental-catalog-items-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 8px; padding: 8px; display:flex; flex-direction:column; gap:8px;">
            ${activeItems.length === 0 ? `
              <div style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد منتجات نشطة في الكتالوج للتأجير</div>
            ` : activeItems.map(item => `
              <label class="ph46-rental-catalog-item-row" data-name="${item.name.toLowerCase()}" style="display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; background:rgba(255,255,255,0.01); border:1px solid transparent; transition:all 0.2s; cursor:pointer;">
                <input type="checkbox" class="ph46-rental-catalog-cb" value="${item.id}" style="width:18px; height:18px;">
                ${item.mainImage ? `<img src="${item.mainImage}" style="width:36px; height:36px; border-radius:6px; object-fit:cover;">` : `<div style="width:36px; height:36px; border-radius:6px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center;">📦</div>`}
                <div style="flex:1;">
                  <div style="font-weight:700; font-size:13px;">${escHtml(item.name)}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${item.price ? item.price + ' ريال' : ''}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- العمود الأيمن: قائمة مزودي الخدمة المتاحين للربط -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 12px; padding: 16px;">
          <h4 style="margin-top:0; margin-bottom:12px; color:var(--primary); font-size:14px; border-bottom:1px solid var(--border, rgba(255,255,255,0.08)); padding-bottom:6px;">👤 2. اختر المزودين المربوطين بها</h4>
          
          <div id="ph46-rental-providers-list" style="max-height: 350px; overflow-y: auto; border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 8px; padding: 8px; display:flex; flex-direction:column; gap:8px;">
            ${providers.length === 0 ? `
              <div style="text-align:center; padding:20px; color:var(--text-muted);">لا يوجد مزودون مسجلون</div>
            ` : providers.map(p => `
              <label style="display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; background:rgba(255,255,255,0.01); cursor:pointer;">
                <input type="checkbox" class="ph46-rental-provider-cb" value="${p.uid}" style="width:18px; height:18px;">
                <div style="flex:1;">
                  <div style="font-weight:700; font-size:13px;">${escHtml(p.name)}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${p.phone || ''}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>
      </div>

      <div style="margin-top:20px; display:flex; justify-content:flex-end; gap:10px;">
        <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="window.ph46_saveAdminRentalProducts('${storeId}')">💾 حفظ وربط المنتجات</button>
      </div>
    </div>
  `;

  openModal(modalHtml);
  window.__ph46_selectedRentalCatId = State.adminRentalCat || null;
};

window.ph46_filterRentalCatalogList = function(q) {
  const lowercase = q.toLowerCase().trim();
  const rows = document.querySelectorAll('.ph46-rental-catalog-item-row');
  rows.forEach(r => {
    const name = r.getAttribute('data-name') || '';
    r.style.display = name.includes(lowercase) ? 'flex' : 'none';
  });
};

window.ph46_saveAdminRentalProducts = async function(storeId) {
  const catId = window.__ph46_selectedRentalCatId;
  const checkedItems = Array.from(document.querySelectorAll('.ph46-rental-catalog-cb:checked')).map(cb => cb.value);
  const checkedProviders = Array.from(document.querySelectorAll('.ph46-rental-provider-cb:checked')).map(cb => cb.value);

  if (checkedItems.length === 0) { toast('يرجى اختيار منتج واحد على الأقل من الكتالوج الموحد', 'warning'); return; }
  if (checkedProviders.length === 0) { toast('يرجى اختيار شريك/مزود واحد على الأقل', 'warning'); return; }

  showLoader();
  try {
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
        imageBase64: item.mainImage || null,
        vendors: checkedProviders,
        active: true,
        sku: item.sku || null,
        createdAt: new Date()
      };

      await fsAdd('rentalProducts', productData);
      addCount++;
    }

    await loadAllData();
    const store = (AppData.rentalStores || []).find(s => s.id === storeId);
    const rentalCatId = store ? store.catId : '';
    closeModal();
    toast(`تمت إضافة وربط ${addCount} منتج بنجاح 🎉`, 'success');
    if (typeof ph_openRentalAdmin === 'function' && rentalCatId) {
      await ph_openRentalAdmin(rentalCatId, storeId);
    } else {
      await render();
    }
  } catch(e) {
    toast('حدث خطأ أثناء الحفظ: ' + e.message, 'error');
  } finally {
    hideLoader();
  }
};

window.ph_saveRentalProduct = async function(storeId) {
  return window.ph46_saveAdminRentalProducts(storeId);
};

window.ph_showEditRentalProductModal = function(productId, storeId) {
  if (State.currentUser && State.currentUser.role !== 'admin') {
    toast('غير مسموح لمزودي الخدمة بتعديل منتجات التأجير.', 'warning');
    return;
  }

  const p = AppData.rentalProducts.find(x => x.id === productId);
  if (!p) return;
  
  const subCats = (AppData.rentalSubCats || []).filter(c => c.storeId === storeId);
  const providers = (AppData.users || []).filter(u => u.role === 'provider' || u.role === 'vendor');
  const selectedVendors = p.vendors || [];
  
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ تعديل منتج التأجير</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    
    <div class="form-group">
      <label class="form-label">القسم الفرعي</label>
      <select class="form-control" id="rp-cat">
        <option value="">— بدون قسم فرعي —</option>
        ${subCats.map(c => `<option value="${c.id}" ${p.catId===c.id?'selected':''}>${c.icon||''} ${escHtml(c.name)}</option>`).join('')}
      </select>
    </div>
    
    <div class="form-group"><label class="form-label">اسم المنتج</label><input class="form-control" id="rp-name" value="${escAttr(p.name)}"></div>
    <div class="form-group"><label class="form-label">سعر الإيجار (ريال)</label><input class="form-control" id="rp-price" type="number" value="${p.price||0}"></div>
    <div class="form-group"><label class="form-label">الحالة</label>
      <select class="form-control" id="rp-active">
        <option value="true" ${p.active !== false ? 'selected' : ''}>✅ نشط</option>
        <option value="false" ${p.active === false ? 'selected' : ''}>⏸️ معطّل</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">صورة المنتج</label><input class="form-control" type="file" accept="image/*" onchange="ph_readRentalStoreImage(this, 'rp-img-preview', 'rp-img-b64')"><img id="rp-img-preview" src="${p.imageBase64||''}" style="max-height:100px;margin-top:8px;border-radius:12px;display:${p.imageBase64?'block':'none'};object-fit:contain"><input type="hidden" id="rp-img-b64" value="${p.imageBase64||''}"></div>
    <div class="form-group"><label class="form-label">وصف المنتج</label><textarea class="form-control" id="rp-desc" rows="3">${escHtml(p.desc||'')}</textarea></div>
    
    <div class="form-group" style="background:var(--bg-secondary);padding:16px;border-radius:14px;border:1px solid var(--border);margin-bottom:20px;">
      <label class="form-label" style="display:flex;align-items:center;gap:6px;font-weight:700;margin-bottom:8px;">
        <span>👥 المزودون (إجباري)</span>
        <span style="margin-inline-start:auto;font-size:12px;color:var(--text-muted);font-weight:400;">${providers.length} مزود متاح</span>
      </label>
      <div style="position:relative;margin-bottom:10px;">
        <span style="position:absolute;top:50%;right:12px;transform:translateY(-50%);font-size:16px;pointer-events:none;">🔍</span>
        <input type="text" class="form-control" placeholder="بحث بالاسم أو رقم الهاتف..."
          style="padding-right:40px;background:var(--bg-card);border-radius:10px;"
          oninput="(function(q){document.querySelectorAll('.rp-vendor-row').forEach(r=>{r.style.display=(r.dataset.name+r.dataset.phone).includes(q.toLowerCase())?'':'none'})})(this.value.toLowerCase())">
      </div>
      <div style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
        ${providers.length === 0
          ? `<div style="text-align:center;padding:28px;color:var(--text-muted);"><div style="font-size:36px;margin-bottom:8px;">👥</div>لا يوجد مزودون مسجلون بعد</div>`
          : providers.map(prov => {
              const isChecked = selectedVendors.includes(prov.id||prov.uid);
              return `
          <label class="rp-vendor-row" data-name="${(prov.name||'').toLowerCase()}" data-phone="${(prov.phone||'').toLowerCase()}"
            style="display:flex;align-items:center;gap:12px;padding:11px 14px;background:${isChecked?'rgba(124,77,255,0.07)':'var(--bg-card)'};border:1.5px solid ${isChecked?'var(--primary)':'var(--border)'};border-radius:12px;cursor:pointer;transition:all 0.2s;user-select:none;"
            onmouseover="this.style.borderColor='var(--primary)'" onmouseout="if(!this.querySelector('.rp-vendor-cb').checked)this.style.borderColor='var(--border)'">
            <input type="checkbox" class="rp-vendor-cb" value="${prov.id||prov.uid}" ${isChecked?'checked':''}
              style="width:18px;height:18px;cursor:pointer;accent-color:var(--primary);"
              onchange="this.parentElement.style.borderColor=this.checked?'var(--primary)':'var(--border)';this.parentElement.style.background=this.checked?'rgba(124,77,255,0.07)':'var(--bg-card)'">
            <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#a389f4);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex-shrink:0;">${prov.name?prov.name.charAt(0).toUpperCase():'?'}</div>
            <div style="flex:1;min-width:0;text-align:right;">
              <div style="font-weight:700;font-size:14px;color:var(--text-main);">${escHtml(prov.name||'')}</div>
              <div style="display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:wrap;">
                <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(16,185,129,0.12);color:#10b981;font-weight:600;">خدمة / تأجير</span>
                ${prov.phone?`<span style="font-size:11px;color:var(--text-muted);">📞 ${escHtml(prov.phone)}</span>`:''}
              </div>
            </div>
          </label>`;
            }).join('')}
      </div>
    </div>
    
    <button class="btn btn-primary btn-block" onclick="ph_updateRentalProduct('${productId}')">💾 تحديث المنتج</button>
  `);
};

window.ph_updateRentalProduct = async function(productId) {
  if (State.currentUser && State.currentUser.role !== 'admin') {
    toast('غير مسموح لمزودي الخدمة بتعديل منتجات التأجير.', 'warning');
    return;
  }

  const name = document.getElementById('rp-name').value.trim();
  const price = parseInt(document.getElementById('rp-price').value) || 0;
  const vendors = Array.from(document.querySelectorAll('.rp-vendor-cb:checked')).map(cb=>cb.value);
  
  if (!name) { toast('أدخل اسم المنتج', 'error'); return; }
  if (price <= 0) { toast('أدخل السعر الصحيح', 'error'); return; }
  if (vendors.length === 0) { toast('حدد مزود واحد على الأقل', 'error'); return; }
  
  showLoader();
  try {
    await fsUpdate('rentalProducts', productId, {
      catId: document.getElementById('rp-cat').value || null,
      name,
      price,
      desc: document.getElementById('rp-desc').value.trim(),
      imageBase64: document.getElementById('rp-img-b64').value,
      active: document.getElementById('rp-active').value === 'true',
      vendors
    });
    const p = (AppData.rentalProducts || []).find(x => x.id === productId);
    const storeId = p ? p.storeId : '';
    const store = (AppData.rentalStores || []).find(s => s.id === storeId);
    const catId = store ? store.catId : '';
    closeModal();
    toast('تم التحديث بنجاح ✅', 'success');
    if (typeof ph_openRentalAdmin === 'function' && catId && storeId) {
      await ph_openRentalAdmin(catId, storeId);
    } else {
      await render();
    }
  } catch(e) { toast('خطأ في التحديث', 'error'); } finally { hideLoader(); }
};

window.ph_deleteRentalProduct = async function(productId) {
  if (State.currentUser && State.currentUser.role !== 'admin') {
    toast('غير مسموح لمزودي الخدمة بحذف منتجات التأجير.', 'warning');
    return;
  }
  if (!confirm('حذف هذا المنتج؟')) return;
  showLoader();
  try {
    const p = (AppData.rentalProducts || []).find(x => x.id === productId);
    const storeId = p ? p.storeId : '';
    const store = (AppData.rentalStores || []).find(s => s.id === storeId);
    const catId = store ? store.catId : '';
    await fsDelete('rentalProducts', productId);
    toast('تم الحذف ✅', 'success');
    if (typeof ph_openRentalAdmin === 'function' && catId && storeId) {
      await ph_openRentalAdmin(catId, storeId);
    } else {
      await render();
    }
  } catch(e) { toast('خطأ في الحذف', 'error'); } finally { hideLoader(); }
};


// ───────────────────────────────────────────────────────
// SECTION 3 — Customer: Rental Store Listing & View
// ───────────────────────────────────────────────────────
window.ph_rentalRenderCatPage = function(catId) {
  const cat = AppData.cats.find(c => c.id === catId);
  const stores = (AppData.rentalStores || []).filter(s => s.catId === catId && s.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0));

  return `<div id="app-content">
    <div class="page-header">
      <button class="back-btn" onclick="navigate('listing', {section: '${cat?.section || 'bookings'}'})">→ رجوع</button>
      <h1>${cat?.icon||''} ${escHtml(cat?.name||'تأجير')}${window.ui_helpBtn('listing_rental')}</h1>
      <p style="color:var(--text-secondary);margin-top:4px">${stores.length} متجر متاح</p>
    </div>
    <div class="sec-layout">
      ${typeof renderSectionSidebar === 'function' ? renderSectionSidebar() : ''}
      <main class="sec-main">
        ${stores.length ? `
        <div class="ph43-stores-grid">
          ${stores.map(s => {
            const prodCount = (AppData.rentalProducts || []).filter(p => p.storeId === s.id && p.active !== false).length;
            return `
            <div class="ph43-store-card" onclick="navigate('rentalstore', {storeId: '${s.id}'})">
              <div class="ph43-store-card-header">
                ${s.bannerBase64 ? `<img src="${s.bannerBase64}" class="ph43-store-banner">` : `<div class="ph43-store-banner-placeholder">${s.icon||'🏪'}</div>`}
                <div class="ph43-store-card-avatar">${s.logoBase64 ? `<img src="${s.logoBase64}">` : (s.icon||'🏪')}</div>
              </div>
              <div class="ph43-store-card-body">
                <div class="ph43-store-name">${escHtml(s.name)}</div>
                ${s.hasAddress && s.storeAddressName ? `
                  <div style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--primary);font-weight:700;margin-top:4px;margin-bottom:6px">
                    <span>📍</span>
                    <span>${escHtml(s.storeRegionName || '')} - ${escHtml(s.storeAddressName)}</span>
                  </div>
                ` : ''}
                ${s.desc ? `<div class="ph43-store-desc">${escHtml(s.desc)}</div>` : ''}
                ${ph_getRentalStoreStatusHtml(s)}
                <div class="ph43-store-meta"><span>📦 ${prodCount} منتج متاح</span></div>
                <button class="btn btn-primary ph43-store-btn">عرض المتجر ←</button>
              </div>
            </div>`;
          }).join('')}
        </div>` : `
        <div class="empty-state">
          <div class="empty-icon">🏪</div>
          <div class="empty-title">لا توجد متاجر متاحة حالياً</div>
        </div>`}
      </main>
    </div>
  </div>`;
};

window.ph_rentalRenderStorePage = function() {
  const { storeId } = State.params;
  const store = (AppData.rentalStores || []).find(s => s.id === storeId);
  if (!store) return '<div id="app-content"><div class="empty-state"><div class="empty-title">المتجر غير موجود</div></div></div>';

  const subCats = (AppData.rentalSubCats || []).filter(c => c.storeId === storeId).sort((a,b)=>(a.order||0)-(b.order||0));
  const activeCat = State.rentalActiveCat || null;
  let products = (AppData.rentalProducts || []).filter(p => p.storeId === storeId && p.active !== false);
  if (activeCat) products = products.filter(p => p.catId === activeCat);

  return `<div id="app-content">
    <div class="ph43-store-hero">
      ${store.bannerBase64 ? `<img src="${store.bannerBase64}" class="ph43-store-hero-img">` : `<div class="ph43-store-hero-placeholder">${store.icon||'🏪'}</div>`}
      <div class="ph43-store-hero-info" style="display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; text-align:center; padding:24px 20px;">
        <button class="back-btn" style="position:absolute; right:20px; top:20px; margin:0; padding:6px 12px; font-size:12px;" onclick="navigate('listing', {section: 'bookings', catId: '${store.catId}'})">→ رجوع</button>
        <div class="ph43-store-hero-avatar" style="width:64px; height:64px; font-size:32px; margin-bottom:12px;">
          ${store.logoBase64 ? `<img src="${store.logoBase64}">` : (store.icon||'🏪')}
        </div>
        <div>
          <div class="ph43-store-hero-name" style="font-size:20px;">${escHtml(store.name)}</div>
          ${store.desc ? `<div class="ph43-store-hero-desc" style="font-size:14px; margin-top:6px; max-width:400px; margin-inline:auto;">${escHtml(store.desc)}</div>` : ''}
          <div style="margin-top:8px;">
            ${(() => {
              const open = isRentalStoreOpenNow(store);
              if (open === null) return '';
              const oh = store.openingHours;
              const daysStr = (oh.days || []).map(k => RENTAL_DAYS.find(d => d.k === k)?.n || k).join('، ');
              return `
                <div style="display:inline-flex;flex-direction:column;align-items:center;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);padding:8px 16px;border-radius:12px;font-size:12px;">
                  <div style="display:flex;align-items:center;gap:8px;font-weight:700">
                    ${open ? '<span style="color:#14b8a6">🟢 مفتوح الآن</span>' : '<span style="color:#f43f5e">⚪ مغلق حالياً</span>'}
                    <span style="color:rgba(255,255,255,0.9)">(${oh.open} - ${oh.close})</span>
                  </div>
                  <div style="color:rgba(255,255,255,0.6);font-size:10px;margin-top:4px;">الأيام: ${escHtml(daysStr)}</div>
                </div>
              `;
            })()}
          </div>
        </div>
      </div>
    </div>

    <div class="ph43-store-layout">
      ${subCats.length ? `
      <aside class="ph43-store-sidebar">
        <div class="ph43-sidebar-title">📂 الأقسام</div>
        <button class="ph43-sidebar-btn${!activeCat?' active':''}" onclick="State.rentalActiveCat=null;render()">
          <span>🛍️</span><span style="flex:1;text-align:right">الكل</span>
          <span class="ph43-sidebar-count">${(AppData.rentalProducts || []).filter(p => p.storeId === storeId && p.active !== false).length}</span>
        </button>
        ${subCats.map(c => {
          const cnt = (AppData.rentalProducts || []).filter(p => p.storeId === storeId && p.catId === c.id && p.active !== false).length;
          return `<button class="ph43-sidebar-btn${activeCat===c.id?' active':''}" onclick="State.rentalActiveCat='${c.id}';render()">
            <span>${c.icon||'📦'}</span><span style="flex:1;text-align:right">${escHtml(c.name)}</span>
            <span class="ph43-sidebar-count">${cnt}</span>
          </button>`;
        }).join('')}
      </aside>` : ''}

      <main class="ph43-products-area">
        <div class="ph43-products-header">
          <div style="font-weight:700;font-size:16px">
            ${activeCat ? escHtml(subCats.find(c=>c.id===activeCat)?.name || 'المنتجات') : 'جميع المنتجات'}
            <span style="color:var(--text-muted);font-size:14px;font-weight:400">(${products.length})</span>
          </div>
        </div>
        ${products.length ? `
        <div class="ph43-product-grid">
          ${products.map(p => {
          const _rOffer = typeof ph_getActiveOffer === 'function' ? ph_getActiveOffer(p.id) : null;
          const _rPct = _rOffer ? (_rOffer.discountPercent || (_rOffer.originalPrice > 0 ? Math.round(((_rOffer.originalPrice - _rOffer.discountedPrice) / _rOffer.originalPrice) * 100) : 0)) : 0;
          const _rPriceHtml = _rOffer && typeof ph_offerPriceHtml === 'function'
            ? ph_offerPriceHtml(_rOffer, `<div class="ph-price-block"><span class="ph-price-num">${(p.price||0).toLocaleString('ar-YE')}</span><span class="ph-price-cur">ريال</span></div>`)
            : `<div class="ph-price-block"><span class="ph-price-num">${(p.price||0).toLocaleString('ar-YE')}</span><span class="ph-price-cur">ريال</span></div>`;
          const _rWaNum = (AppData.platformSettings?.whatsappNumberStores || AppData.platformSettings?.whatsappNumber || '').replace(/\D/g,'');
          const _rWaUrl = _rWaNum ? `https://wa.me/${_rWaNum}?text=${encodeURIComponent('أهلاً، أريد الاستفسار عن منتج التأجير: ' + p.name)}` : '';
          return `
          <div class="ph43-product-card" style="position:relative">
            ${_rOffer && typeof ph_offerBadgeHtml === 'function' ? ph_offerBadgeHtml(_rPct) : ''}
            <div onclick="ph_rentalShowBookingModal('${p.id}', '${storeId}')" style="cursor:pointer">
              ${p.imageBase64 ? `<img src="${p.imageBase64}" class="ph43-product-img">` : `<div class="ph43-product-img-placeholder">📦</div>`}
              <div class="ph43-product-body" style="padding-bottom:8px">
                <div class="ph43-product-name">${escHtml(p.name)}</div>
                ${window.ph47_getProductLocationHtml ? window.ph47_getProductLocationHtml(p.vendors) : ''}
                ${p.sku ? `<div style="display:inline-block;font-family:monospace;font-size:10px;font-weight:700;background:rgba(139,92,246,0.1);color:#8b5cf6;border:1px solid rgba(139,92,246,0.2);border-radius:4px;padding:1px 5px;margin-top:3px;margin-bottom:3px;letter-spacing:0.5px;">#${escHtml(p.sku)}</div>` : ''}
                ${p.desc ? `<div class="ph43-product-desc">${escHtml(p.desc)}</div>` : ''}
              </div>
            </div>
            <div class="ph43-product-footer" style="padding: 0 12px 12px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <div class="ph43-product-price">${_rPriceHtml}</div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <button class="ph43-add-cart-btn" data-rental-cart-id="${p.id}" style="background:var(--primary); margin:0;" onclick="typeof rental_addToCart==='function'?rental_addToCart('${p.id}','${storeId}'):ph_rentalShowBookingModal('${p.id}','${storeId}')">${_rOffer ? '🏷️ احجز' : '🛒 أضف للسلة'}</button>
                ${_rWaUrl ? `
                  <a class="btn-wa-inquiry" href="${_rWaUrl}" target="_blank" rel="noopener" title="استفسار عبر واتساب" style="padding: 7px 10px;">
                    <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </a>
                ` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
        </div>` : `
        <div class="empty-state" style="padding:60px 0">
          <div class="empty-icon">📦</div>
          <div class="empty-title">لا توجد منتجات ${activeCat ? 'في هذا القسم' : ''}</div>
        </div>`}
      </main>
    </div>
  </div>`;
};

// ─── Customer: Booking Flow ─────────────
window.ph_rentalShowBookingModal = function(productId, storeId) {
  const p = (AppData.rentalProducts || []).find(x => x.id === productId);
  const store = (AppData.rentalStores || []).find(x => x.id === storeId);
  if (!p || !store) return;
  const u = State.currentUser;
  
  if (!u || u.role !== 'customer') {
    navigate('login');
    return;
  }

  const vendors = p.vendors || [];
  const providers = (AppData.users || []).filter(user => vendors.includes(user.id || user.uid));

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📅 حجز منتج تأجير${window.ui_helpBtn('checkout')}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    
    <div style="background:var(--gradient-card);border:1px solid var(--glass-border);border-radius:var(--radius-sm);padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:14px">
      ${p.imageBase64 ? `<img src="${p.imageBase64}" style="width:64px;height:64px;border-radius:12px;object-fit:cover">` : `<div style="font-size:36px">📦</div>`}
      <div style="flex:1">
        <div style="font-size:17px;font-weight:700">${escHtml(p.name)}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:2px">متجر: ${escHtml(store.name)}</div>
        ${window.ph47_getProductLocationHtml ? window.ph47_getProductLocationHtml(p.vendors) : ''}
        <div style="font-size:20px;font-weight:800;margin-top:6px;color:var(--primary)">${(p.price||0).toLocaleString('ar-YE')} ريال</div>
      </div>
    </div>
    ${store.taxPercent ? `
    <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px; padding:12px 16px; margin-bottom:20px; font-size:13px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="color:var(--text-secondary)">💵 سعر الإيجار الأساسي:</span><span style="font-weight:700">${(p.price || 0).toLocaleString('ar-YE')} ريال</span></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="color:var(--text-secondary)">📈 نسبة الضريبة:</span><span style="font-weight:700; color:var(--rose)">${store.taxPercent}%</span></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="color:var(--text-secondary)">💸 قيمة الضريبة:</span><span style="font-weight:700; color:var(--rose)">${Math.round((p.price || 0) * store.taxPercent / 100).toLocaleString('ar-YE')} ريال</span></div>
      <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border); padding-top:6px; margin-top:6px; font-weight:800;"><span style="color:var(--text-main)">💰 الإجمالي شامل الضريبة:</span><span style="color:var(--primary); font-size:15px;">${(p.price + Math.round((p.price || 0) * store.taxPercent / 100)).toLocaleString('ar-YE')} ريال</span></div>
    </div>
    ` : ''}

    <div class="form-group">
      <label class="form-label">📅 تاريخ بداية الإيجار</label>
      <input class="form-control" id="rbk-start-date" type="date" min="${new Date().toISOString().split('T')[0]}">
    </div>
    <div class="form-group">
      <label class="form-label">📅 تاريخ الإرجاع (اختياري)</label>
      <input class="form-control" id="rbk-end-date" type="date" min="${new Date().toISOString().split('T')[0]}">
    </div>
    
    <div class="form-group">
      <label class="form-label">👨‍💼 اختر المزود</label>
      <select class="form-control" id="rbk-vendor">
        <option value="">-- يرجى اختيار المزود --</option>
        ${providers.map(prov => `<option value="${prov.id||prov.uid}">${escHtml(prov.name)}</option>`).join('')}
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">💬 ملاحظات إضافية (ألوان، مقاسات..الخ)</label>
      <textarea class="form-control" id="rbk-note" placeholder="أي تفاصيل خاصة بطلبك..." style="resize:vertical"></textarea>
    </div>
    
    <div class="form-group">
      <label class="form-label">💳 طريقة الدفع</label>
      <div class="bk-payment-grid">
        <button class="bk-pay-btn active" id="rbk-pay-wallet" onclick="window.ph_rSelectPayment('wallet')">
          <div style="font-weight:700">المحفظة</div>
          <div style="font-size:11px;color:var(--text-muted)" id="rbk-wallet-bal">جاري الجلب...</div>
        </button>
        <button class="bk-pay-btn" id="rbk-pay-cod" onclick="window.ph_rSelectPayment('cod')">
          <div style="font-weight:700">عند الاستلام</div>
        </button>
      </div>
    </div>

    <button class="btn btn-primary btn-block btn-lg" style="margin-top:8px" onclick="ph_rentalConfirmBooking('${p.id}', '${storeId}')">✅ تأكيد الحجز المسبق</button>
  `);

  window.ph_rental_activeBooking = { paymentMethod: 'wallet', total: p.price };
  
  if (u.uid) {
    getBalance(u.uid).then(bal => {
      const el = document.getElementById('rbk-wallet-bal');
      if (el) el.innerText = bal + ' ريال متاح';
    }).catch(e => {});
  }
};

window.ph_rSelectPayment = function(method) {
  if(window.ph_rental_activeBooking) window.ph_rental_activeBooking.paymentMethod = method;
  document.querySelectorAll('.bk-pay-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('rbk-pay-' + method);
  if (btn) btn.classList.add('active');
};

window.ph_rentalConfirmBooking = async function(productId, storeId) {
  const startDate = document.getElementById('rbk-start-date')?.value;
  const endDate = document.getElementById('rbk-end-date')?.value || null;
  const vendorId = document.getElementById('rbk-vendor')?.value;
  const note = document.getElementById('rbk-note')?.value.trim() || '';
  
  if (!startDate) { toast('يرجى اختيار تاريخ البداية', 'error'); return; }
  if (!vendorId) { toast('يرجى اختيار المزود', 'error'); return; }

  const p = AppData.rentalProducts.find(x => x.id === productId);
  const store = AppData.rentalStores.find(x => x.id === storeId);
  const u = State.currentUser;
  
  const payMethod = window.ph_rental_activeBooking?.paymentMethod || 'wallet';
  const total = p.price || 0;
  const taxPercent = store.taxPercent || 0;
  const taxAmount = Math.round(total * taxPercent / 100);
  const finalTotal = total + taxAmount;

  if (finalTotal > 0 && payMethod === 'wallet') {
    const bal = await getBalance(u.uid);
    if (bal < finalTotal) {
      toast(`رصيدك (${bal} ريال) غير كافٍ. المطلوب: ${finalTotal} ريال`, 'error');
      closeModal(); navigate('wallet'); return;
    }
  }

  showLoader('جاري تأكيد حجز التأجير...');
  try {
    const orderId = await generateOrderId();
    const vendorUser = (AppData.users||[]).find(v => v.uid === vendorId || v.id === vendorId);
    const vendorName = vendorUser ? vendorUser.name : '—';
    
    await fsAdd('orders', {
      orderId,
      type: 'rental_order',
      rentalProductId: productId,
      rentalStoreId: storeId,
      svcName: `تأجير: ${p.name}`,
      svcIcon: '🏷️',
      servicePrice: total,
      taxPercent,
      taxAmount,
      deliveryFee: 0,
      codFee: 0,
      total: finalTotal,
      paymentMethod: payMethod,
      customerId: u.uid,
      customerName: u.name,
      vendorId: vendorId,
      vendorName: vendorName,
      driverId: null,
      date: startDate,
      endDate: endDate,
      note,
      status: 'pending',
      orderRegionId: State.currentUser?.regionId || null,
    });

    if (finalTotal > 0 && payMethod === 'wallet') {
      await deductWallet(u.uid, finalTotal, `إيجار منتج: ${p.name}`, orderId);
    }

    closeModal();
    toast(`✅ تم إرسال طلب التأجير! العملية: ${orderId}`, 'success');
    await navigate('myorders');
  } catch (e) {
    hideLoader();
    toast('حدث خطأ أثناء الطلب: ' + e.message, 'error');
  }
};

window.ph_filterAdminRentalStores = function() {
  const q = (document.getElementById('rental-stores-search')?.value || '').toLowerCase();
  document.querySelectorAll('.ph-rental-store-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(q) ? '' : 'none';
  });
};

window.ph_filterAdminRentalProducts = function() {
  const q = (document.getElementById('rental-prods-search')?.value || '').toLowerCase();
  document.querySelectorAll('.ph-rental-prod-row').forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(q) ? '' : 'none';
  });
};

/* ============================================================
   Phase 40 — نظام فئات الحجز (Service Booking Tiers)
   - Admin: إدارة الفئات وأسعارها ومميزاتها والأقسام الداخلية لكل خدمة
   - Customer: اختيار الفئة المناسبة وتصفية الأقسام عند الحجز
   ============================================================ */
'use strict';

// ─── Admin: إدارة الأقسام الداخلية لمزود الخدمة ───────────────────
window.ph40_showInternalCatsModal = function (serviceId) {
  const svc = AppData.services.find(s => s.id === serviceId);
  if (!svc) return;
  const cats = svc.internalCats || [];

  const renderCatRow = (cat) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg-secondary);border-radius:12px;margin-bottom:8px;border:1px solid var(--border)">
      <span style="font-size:20px">${cat.icon || '📂'}</span>
      <span style="flex:1;font-weight:600">${escHtml(cat.name)}</span>
      <button class="btn btn-sm btn-danger" onclick="ph40_deleteInternalCat('${serviceId}', '${cat.id}')">🗑️ حذف</button>
    </div>`;

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📂 أقسام المزود — ${escHtml(svc.name)}</h2>
      <button class="modal-close" onclick="ph40_showTiersModal('${serviceId}')">✕</button>
    </div>
    
    <div class="ph40-info-box" style="margin-bottom:12px">
      💡 أنشئ أقساماً داخلية خاصة بك (مثل: غرف عادية، أجنحة، خدمات صيانة) لتصنيف فئات الحجز والأسعار بداخلها بوضوح للعميل.
    </div>

    <div id="ph40-internal-cats-list" style="margin-bottom:20px;max-height:200px;overflow-y:auto;padding-right:2px">
      ${cats.length ? cats.map(renderCatRow).join('') : '<p style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد أقسام داخلية بعد</p>'}
    </div>

    <div style="background:var(--bg-secondary);border-radius:14px;padding:16px;border:1px solid var(--border)">
      <div style="font-weight:700;margin-bottom:12px">➕ إضافة قسم داخلي جديد</div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input class="form-control" id="new-int-cat-icon" placeholder="🛏️" style="width:60px;text-align:center;font-size:16px" value="📂">
        <input class="form-control" id="new-int-cat-name" placeholder="اسم القسم (مثال: غرف عادية)">
      </div>
      <button class="btn btn-primary btn-block" onclick="ph40_addInternalCat('${serviceId}')">إضافة القسم</button>
    </div>
  `);
};

window.ph40_addInternalCat = async function (serviceId) {
  const name = document.getElementById('new-int-cat-name')?.value.trim();
  const icon = document.getElementById('new-int-cat-icon')?.value.trim() || '📂';
  if (!name) { toast('أدخل اسم القسم', 'error'); return; }

  const svc = AppData.services.find(s => s.id === serviceId);
  if (!svc) return;

  const newCat = {
    id: 'int_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
    name,
    icon,
    createdAt: new Date().toISOString()
  };

  const internalCats = [...(svc.internalCats || []), newCat];
  showLoader('جاري حفظ القسم...');
  try {
    await fsUpdate('services', serviceId, { internalCats });
    svc.internalCats = internalCats;
    hideLoader();
    toast('✅ تم إضافة القسم بنجاح', 'success');
    ph40_showInternalCatsModal(serviceId);
  } catch (e) {
    hideLoader();
    toast('تعذّر الحفظ: ' + (e.message || e), 'error');
  }
};

window.ph40_deleteInternalCat = async function (serviceId, catId) {
  if (!confirm('هل تريد حذف هذا القسم الداخلي؟ ستظل فئات الحجز المرتبطة به بدون قسم.')) return;

  const svc = AppData.services.find(s => s.id === serviceId);
  if (!svc) return;

  const internalCats = (svc.internalCats || []).filter(c => c.id !== catId);
  
  // Clean up tiers that refer to this category ID
  const tiers = (svc.tiers || []).map(t => {
    if (t.internalCatId === catId) {
      const { internalCatId, ...rest } = t;
      return rest;
    }
    return t;
  });

  showLoader('جاري حذف القسم...');
  try {
    await fsUpdate('services', serviceId, { internalCats, tiers });
    svc.internalCats = internalCats;
    svc.tiers = tiers;
    hideLoader();
    toast('✅ تم حذف القسم بنجاح', 'success');
    ph40_showInternalCatsModal(serviceId);
  } catch (e) {
    hideLoader();
    toast('تعذّر الحذف: ' + (e.message || e), 'error');
  }
};

// ─── Admin: فتح مودال إدارة الفئات وتجميعها ───────────────────────
window.ph40_showTiersModal = function (serviceId) {
  const svc = AppData.services.find(s => s.id === serviceId);
  if (!svc) return;
  const tiers = svc.tiers || [];
  const internalCats = svc.internalCats || [];
  const vendors = (AppData.users || []).filter(u => u.role === 'vendor' || u.role === 'provider');

  const renderTierRow = (tier, idx) => `
    <div class="ph40-tier-row" id="ph40-tier-${idx}">
      <div class="ph40-tier-header">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">${tier.icon || '🏷️'}</span>
          <div>
            <div class="ph40-tier-name">${escHtml(tier.name)}</div>
            <div class="ph40-tier-price">${(tier.price || 0).toLocaleString('ar-YE')} ريال</div>
            ${tier.vendorId ? `<div style="font-size:11px;color:var(--primary);margin-top:4px">🧑‍🔧 مزود مخصص: ${(vendors.find(v=>v.uid===tier.vendorId||v.id===tier.vendorId)?.name) || 'غير معروف'}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-sm btn-danger" onclick="ph40_deleteTier('${serviceId}', ${idx})">🗑️ حذف</button>
        </div>
      </div>
      ${tier.desc ? `<div class="ph40-tier-desc">${escHtml(tier.desc)}</div>` : ''}
      ${tier.features && tier.features.length ? `
        <div class="ph40-tier-features">
          ${tier.features.map(f => `<span class="ph40-feature-tag">✓ ${escHtml(f)}</span>`).join('')}
        </div>` : ''}
    </div>`;

  // Group tiers by category
  let groupedHtml = '';
  
  if (internalCats.length > 0) {
    internalCats.forEach(cat => {
      const catTiers = tiers.map((t, i) => ({ t, i })).filter(item => item.t.internalCatId === cat.id);
      if (catTiers.length > 0) {
        groupedHtml += `
          <div style="font-weight:700;font-size:14px;color:var(--primary);margin:16px 0 8px 0;border-bottom:1px solid var(--glass-border);padding-bottom:6px;display:flex;align-items:center;gap:6px">
            <span>${cat.icon || '📂'}</span>
            <span>${escHtml(cat.name)}</span>
          </div>
          ${catTiers.map(item => renderTierRow(item.t, item.i)).join('')}
        `;
      }
    });

    const uncatTiers = tiers.map((t, i) => ({ t, i })).filter(item => !item.t.internalCatId || !internalCats.some(c => c.id === item.t.internalCatId));
    if (uncatTiers.length > 0) {
      groupedHtml += `
        <div style="font-weight:700;font-size:14px;color:var(--text-muted);margin:16px 0 8px 0;border-bottom:1px solid var(--glass-border);padding-bottom:6px">
          🏷️ فئات غير مصنفة
        </div>
        ${uncatTiers.map(item => renderTierRow(item.t, item.i)).join('')}
      `;
    }
  } else {
    groupedHtml = tiers.length ? tiers.map((t, i) => renderTierRow(t, i)).join('') : `
      <div class="empty-state" style="padding:28px 20px">
        <div class="empty-icon">🏷️</div>
        <div class="empty-title">لا توجد فئات بعد</div>
        <div class="empty-sub">أضف فئتك الأولى أدناه</div>
      </div>`;
  }

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">🏷️ فئات الحجز — ${escHtml(svc.name)}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:12px 16px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:24px">📂</span>
        <div>
          <div style="font-weight:700;font-size:13px;color:var(--text-main)">الأقسام الداخلية للمزود</div>
          <div style="font-size:11px;color:var(--text-muted)">صنف فئات وأسعار الحجز داخل تبويبات</div>
        </div>
      </div>
      <button class="btn btn-sm btn-secondary" style="border:1px solid var(--glass-border)" onclick="ph40_showInternalCatsModal('${serviceId}')">⚙️ إدارة الأقسام</button>
    </div>

    <div id="ph40-tiers-list" style="max-height:260px;overflow-y:auto;padding-right:2px">
      ${groupedHtml}
    </div>

    <div class="ph40-add-tier-form">
      <h3 style="margin-bottom:14px;font-size:15px;font-weight:700">➕ إضافة فئة جديدة</h3>
      <div class="ph40-form-grid">
        <div class="form-group">
          <label class="form-label">اسم الفئة *</label>
          <input class="form-control" id="ph40-t-name" placeholder="مثال: غرفة سرير واحد">
        </div>
        <div class="form-group">
          <label class="form-label">السعر (ريال) *</label>
          <input class="form-control" id="ph40-t-price" type="number" min="0" placeholder="مثال: 5000">
        </div>
        <div class="form-group">
          <label class="form-label">القسم الداخلي (اختياري)</label>
          <select class="form-control" id="ph40-t-catId">
            <option value="">-- بدون قسم داخلي --</option>
            ${internalCats.map(c => `<option value="${c.id}">${c.icon || ''} ${escHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">تخصيص لمزود (اختياري)</label>
          <select class="form-control" id="ph40-t-vendorId">
            <option value="">-- التوجيه التلقائي --</option>
            ${vendors.map(v => `<option value="${v.uid||v.id}">${escHtml(v.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">أيقونة (اختياري)</label>
          <input class="form-control" id="ph40-t-icon" placeholder="مثال: 🛏️ أو 👑">
        </div>
        <div class="form-group">
          <label class="form-label">وصف مختصر</label>
          <input class="form-control" id="ph40-t-desc" placeholder="وصف الفئة...">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">المميزات (افصل بفاصلة)</label>
          <input class="form-control" id="ph40-t-features" placeholder="مثال: واي فاي مجاني, تلفزيون, مكيف هواء, إفطار">
        </div>
      </div>
      <button class="btn btn-primary btn-block" onclick="ph40_addTier('${serviceId}')">➕ إضافة الفئة</button>
    </div>`);
};

window.ph40_addTier = async function (serviceId) {
  const name    = document.getElementById('ph40-t-name')?.value.trim();
  const price   = parseFloat(document.getElementById('ph40-t-price')?.value) || 0;
  const icon    = document.getElementById('ph40-t-icon')?.value.trim() || '🏷️';
  const desc    = document.getElementById('ph40-t-desc')?.value.trim() || '';
  const featStr = document.getElementById('ph40-t-features')?.value.trim() || '';
  const features = featStr ? featStr.split(',').map(f => f.trim()).filter(Boolean) : [];
  const internalCatId = document.getElementById('ph40-t-catId')?.value || '';
  const vendorId = document.getElementById('ph40-t-vendorId')?.value || '';

  if (!name)          { toast('اسم الفئة مطلوب', 'error'); return; }
  if (!price || price <= 0) { toast('يجب إدخال سعر صحيح أكبر من صفر', 'error'); return; }

  const svc = AppData.services.find(s => s.id === serviceId);
  if (!svc) return;

  const newTier = { name, price, icon, desc, features };
  if (internalCatId) newTier.internalCatId = internalCatId;
  if (vendorId) newTier.vendorId = vendorId;

  const tiers = [...(svc.tiers || []), newTier];
  showLoader('جاري الحفظ...');
  try {
    await fsUpdate('services', serviceId, { tiers });
    svc.tiers = tiers;
    hideLoader();
    toast('✅ تمت إضافة الفئة بنجاح', 'success');
    ph40_showTiersModal(serviceId);
  } catch (e) {
    hideLoader();
    toast('تعذّر الحفظ: ' + (e.message || e), 'error');
  }
};

window.ph40_deleteTier = async function (serviceId, idx) {
  if (!confirm('حذف هذه الفئة نهائياً؟')) return;
  const svc = AppData.services.find(s => s.id === serviceId);
  if (!svc) return;
  const tiers = (svc.tiers || []).filter((_, i) => i !== idx);
  showLoader('جاري الحذف...');
  try {
    await fsUpdate('services', serviceId, { tiers });
    svc.tiers = tiers;
    hideLoader();
    toast('تم حذف الفئة', 'success');
    ph40_showTiersModal(serviceId);
  } catch (e) {
    hideLoader();
    toast('تعذّر الحذف: ' + (e.message || e), 'error');
  }
};

// ─── Customer: اختيار الفئة وتصفية الأقسام عند الحجز ───────────────
window.ph40_renderTierSelector = function (svc) {
  const tiers = svc.tiers;
  if (!tiers || !tiers.length) return '';
  const internalCats = svc.internalCats || [];

  let tabsHtml = '';
  if (internalCats.length > 0) {
    tabsHtml = `
      <div class="ph40-int-tabs" style="display:flex;gap:8px;margin-bottom:16px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none">
        <button class="ph40-int-tab active" onclick="ph40_filterCustomerTiers('${svc.id}', 'all', this)">الكل</button>
        ${internalCats.map(c => `
          <button class="ph40-int-tab" onclick="ph40_filterCustomerTiers('${svc.id}', '${c.id}', this)">
            <span>${c.icon || '📂'}</span> ${escHtml(c.name)}
          </button>
        `).join('')}
      </div>
    `;
  }

  return `
    <div class="ph40-tier-selector">
      <div class="ph40-tier-selector-header">
        <span class="ph40-tier-selector-title">🏷️ اختر الفئة المناسبة لك</span>
        <span class="ph40-tier-count-badge">${tiers.length} فئات متاحة</span>
      </div>

      ${tabsHtml}

      <div class="ph40-tier-cards-grid" id="ph40-tier-cards">
        ${tiers.map((tier, idx) => `
          <div class="ph40-tier-card-v2${idx === 0 ? ' selected' : ''}"
               id="ph40-tc-${idx}"
               data-cat-id="${tier.internalCatId || ''}"
               onclick="ph40_selectTier(${idx}, ${tier.price || 0}, '${escAttr(tier.name)}')">
            <div class="ph40-tcv2-check" id="ph40-check-${idx}">${idx === 0 ? '✓' : ''}</div>
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


window.ph40_filterCustomerTiers = function (serviceId, catId, btn) {
  if (btn) {
    btn.parentElement.querySelectorAll('.ph40-int-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  const cards = document.querySelectorAll('#ph40-tier-cards .ph40-tier-card, #ph40-tier-cards .ph40-tier-card-v2');
  let firstVisibleIdx = null;

  cards.forEach((card, idx) => {
    const cardCat = card.getAttribute('data-cat-id') || '';
    let isVisible = catId === 'all' || cardCat === catId;
    card.style.display = isVisible ? '' : 'none';
    if (isVisible && firstVisibleIdx === null) firstVisibleIdx = idx;
  });

  // Automatically select the first visible tier if the current one is hidden
  if (firstVisibleIdx !== null) {
    const currentSelected = document.querySelector('#ph40-tier-cards .ph40-tier-card.selected, #ph40-tier-cards .ph40-tier-card-v2.selected');
    if (!currentSelected || currentSelected.style.display === 'none') {
      const cardEl = document.getElementById('ph40-tc-' + firstVisibleIdx);
      if (cardEl) cardEl.click();
    }
  }
};

window.ph40_selectTier = function (idx, price, name) {
  const cards = document.querySelectorAll('.ph40-tier-card, .ph40-tier-card-v2');
  const isV2  = document.querySelector('.ph40-tier-card-v2') !== null;
  cards.forEach((c, i) => {
    c.classList.toggle('selected', i === idx);
    const chk = document.getElementById('ph40-check-' + i);
    if (chk) chk.textContent = i === idx ? (isV2 ? '✓' : '✅') : '';
  });
  window.__ph40_selectedTier = { idx, price, name };
  if (typeof window.ph40_onTierSelected === 'function') {
    window.ph40_onTierSelected(idx, price, name);
  }
};

window.__ph40_selectedTier = null;

// ─── Patch renderAdminServices & renderAdminSystem to add 🏷️ button ───────────────
setTimeout(() => {
  const origSvc = window.renderAdminServices;
  if (typeof origSvc === 'function') {
    window.renderAdminServices = function () {
      let html = origSvc.apply(this, arguments);
      html = html.replace(
        /(<button class="btn btn-sm btn-secondary" onclick="showEditSvcModal\('([^']+)'\)">✏️<\/button>)/g,
        `<button class="btn btn-sm" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff" onclick="ph40_showTiersModal('$2')" title="فئات الحجز">🏷️</button> $1`
      );
      return html;
    };
  }

  const origSys = window.renderAdminSystem;
  if (typeof origSys === 'function') {
    window.renderAdminSystem = function () {
      let html = origSys.apply(this, arguments);
      html = html.replace(
        /(<button class="btn btn-sm btn-secondary" onclick="showEditSvcModal\('([^']+)'\)">✏️<\/button>)/g,
        `<button class="btn btn-sm" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff" onclick="ph40_showTiersModal('$2')" title="فئات الحجز">🏷️</button> $1`
      );
      return html;
    };
  }
}, 2200);

// ─── Styles ────────────────────────────────────────────────────
(function () {
  if (window.__ph40_styles) return;
  window.__ph40_styles = true;
  const s = document.createElement('style');
  s.textContent = `
    .ph40-info-box { background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:12px 16px;font-size:13px;color:var(--text-secondary);margin-bottom:16px;line-height:1.7; }
    .ph40-tier-row { background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:14px 16px;margin-bottom:10px; }
    .ph40-tier-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:8px; }
    .ph40-tier-name { font-weight:700;font-size:15px; }
    .ph40-tier-price { color:var(--primary);font-weight:800;font-size:16px; }
    .ph40-tier-desc { color:var(--text-secondary);font-size:13px;margin-bottom:8px; }
    .ph40-tier-features { display:flex;flex-wrap:wrap;gap:6px;margin-top:8px; }
    .ph40-feature-tag { background:rgba(139,92,246,0.1);color:var(--primary);border-radius:8px;padding:3px 10px;font-size:12px; }
    .ph40-add-tier-form { margin-top:20px;padding:18px;background:var(--bg-card);border:1px dashed var(--glass-border);border-radius:14px; }
    .ph40-form-grid { display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px; }
    @media(max-width:640px) { .ph40-form-grid { grid-template-columns:1fr; } }

    .ph40-tier-selector { margin-bottom:20px; }

    /* ── Tier Selector v2 — Grid Cards (New Design) ── */
    .ph40-tier-selector-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
    .ph40-tier-selector-title { font-size:15px; font-weight:800; color:var(--text-main); }
    .ph40-tier-count-badge { background:rgba(139,92,246,0.12); color:var(--primary); border:1px solid rgba(139,92,246,0.2); border-radius:8px; padding:3px 10px; font-size:12px; font-weight:700; }
    .ph40-tier-cards-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:10px; margin-bottom:8px; }
    .ph40-tier-card-v2 { background:var(--bg-card); border:2px solid var(--glass-border); border-radius:14px; padding:14px 10px; cursor:pointer; transition:all 0.22s cubic-bezier(0.4,0,0.2,1); position:relative; text-align:center; display:flex; flex-direction:column; align-items:center; gap:5px; }
    .ph40-tier-card-v2:hover { border-color:rgba(139,92,246,0.35); background:var(--bg-secondary); transform:translateY(-2px); box-shadow:0 6px 16px rgba(0,0,0,0.1); }
    .ph40-tier-card-v2.selected { border-color:var(--primary); background:linear-gradient(135deg,rgba(139,92,246,0.1),rgba(139,92,246,0.04)); box-shadow:0 6px 20px rgba(139,92,246,0.2); }
    .ph40-tcv2-check { position:absolute; top:8px; left:8px; width:20px; height:20px; border-radius:50%; border:2px solid var(--glass-border); background:var(--bg-secondary); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; color:transparent; transition:all 0.2s; }
    .ph40-tier-card-v2.selected .ph40-tcv2-check { border-color:var(--primary); background:var(--primary); color:#fff; }
    .ph40-tcv2-icon { font-size:26px; margin-top:4px; }
    .ph40-tcv2-name { font-weight:800; font-size:13px; color:var(--text-main); line-height:1.3; }
    .ph40-tcv2-desc { font-size:11px; color:var(--text-muted); line-height:1.4; }
    .ph40-tcv2-price-row { display:flex; align-items:baseline; gap:3px; justify-content:center; margin-top:4px; }
    .ph40-tcv2-price { font-size:17px; font-weight:800; color:var(--primary); }
    .ph40-tcv2-cur { font-size:11px; font-weight:600; color:var(--text-muted); }
    .ph40-tcv2-features { display:flex; flex-wrap:wrap; gap:4px; justify-content:center; padding-top:8px; border-top:1px solid var(--glass-border); width:100%; margin-top:4px; }
    .ph40-tcv2-feat { font-size:10px; color:var(--text-secondary); background:var(--bg-secondary); border-radius:5px; padding:2px 6px; font-weight:600; }
    .ph40-tcv2-feat-more { background:rgba(139,92,246,0.1); color:var(--primary); }

    /* ── Legacy Card Style (fallback) ── */
    .ph40-tier-cards { display:flex;flex-direction:column;gap:10px; }
    .ph40-tier-card { background:var(--bg-card);border:2px solid var(--glass-border);border-radius:16px;padding:14px 16px;cursor:pointer;transition:all 0.2s; }
    .ph40-tier-card:hover { border-color:var(--primary);box-shadow:0 4px 16px rgba(139,92,246,0.15); }
    .ph40-tier-card.selected { border-color:var(--primary);background:rgba(139,92,246,0.07); }
    .ph40-tc-header { display:flex;align-items:center;gap:10px; }
    .ph40-tc-icon { font-size:26px;flex-shrink:0; }
    .ph40-tc-info { flex:1;min-width:0; }
    .ph40-tc-name { font-weight:700;font-size:15px; }
    .ph40-tc-desc-inline { font-size:12px;color:var(--text-secondary);margin-top:2px; }
    .ph40-tc-price-wrap { text-align:center;flex-shrink:0; }
    .ph40-tc-price { font-weight:800;font-size:18px;color:var(--primary); }
    .ph40-tc-currency { font-size:11px;color:var(--text-muted); }
    .ph40-tc-check { font-size:18px;min-width:20px;text-align:center; }
    .ph40-tc-features { display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--glass-border); }
    .ph40-tc-feat { background:rgba(16,185,129,0.1);color:#10b981;border-radius:8px;padding:3px 10px;font-size:12px; }


    .ph40-int-tab {
      padding: 6px 14px;
      border: 1px solid var(--glass-border);
      background: var(--bg-card);
      border-radius: 99px;
      cursor: pointer;
      color: var(--text-main);
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .ph40-int-tab:hover {
      border-color: var(--primary);
      background: rgba(139,92,246,0.05);
    }
    .ph40-int-tab.active {
      background: linear-gradient(135deg, var(--primary), #6d28d9);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 4px 10px rgba(124,58,237,0.25);
    }
  `;
  document.head.appendChild(s);
})();

console.log('[Phase 40] Booking Tiers System loaded');

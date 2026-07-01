/* ============================================================
   Phase 41 — نظام العناوين المتعددة للعميل
   - CRUD كامل للعناوين (منزل، عمل، أخرى)
   - اختيار العنوان في نموذج الحجز
   - عرض وإدارة العناوين من البروفايل
   ============================================================ */
'use strict';

window.__ph41_addresses = [];

// ─── تحميل العناوين من Firestore ────────────────────────────────
window.ph41_loadAddresses = async function () {
  const u = State.currentUser;
  if (!u || u.role !== 'customer') return [];
  try {
    const snap = await db.collection('user_addresses')
      .where('userId', '==', u.uid)
      .orderBy('createdAt', 'asc')
      .get();
    const addrs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.__ph41_addresses = addrs;
    return addrs;
  } catch (e) {
    try {
      const snap2 = await db.collection('user_addresses').where('userId', '==', u.uid).get();
      const addrs2 = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      window.__ph41_addresses = addrs2;
      return addrs2;
    } catch (e2) {
      window.__ph41_addresses = [];
      return [];
    }
  }
};

// ─── مودال دفتر العناوين ─────────────────────────────────────────
window.ph41_showAddressBook = async function () {
  showLoader('جاري تحميل العناوين...');
  const addrs = await ph41_loadAddresses();
  hideLoader();

  const typeIcon  = { home: '🏠', work: '💼', other: '📍' };
  const typeLabel = { home: 'المنزل', work: 'العمل', other: 'أخرى' };

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📍 دفتر عناوينك</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>

    <div id="ph41-addr-list" style="margin-bottom:16px">
      ${addrs.length ? addrs.map(a => `
        <div class="ph41-addr-card" id="ph41-ac-${a.id}">
          <div class="ph41-addr-main">
            <span class="ph41-addr-type-icon">${typeIcon[a.type] || '📍'}</span>
            <div class="ph41-addr-body">
              <div class="ph41-addr-label">
                ${escHtml(a.label)}
                ${a.isDefault ? '<span class="badge badge-teal" style="font-size:10px;margin-right:6px">افتراضي</span>' : ''}
              </div>
              <div class="ph41-addr-text">
                ${escHtml(a.address)}
                ${a.lat && a.lng ? `
                  <div style="margin-top:6px">
                    <a href="https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}" target="_blank" class="btn btn-xs btn-secondary" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 8px;border-radius:6px;text-decoration:none">
                      🌍 فتح في خرائط Google
                    </a>
                  </div>
                ` : ''}
              </div>
              ${a.subzoneName ? `<div style="font-size:11px;color:var(--primary);font-weight:600;margin-top:2px">📍 ${escHtml(a.govName||'')} ${a.govName?'›':''} ${escHtml(a.zoneName||'')} ${a.zoneName?'›':''} ${escHtml(a.subzoneName)}</div>` : ''}
            </div>
            <div class="ph41-addr-actions">
              ${!a.isDefault ? `<button class="btn btn-sm btn-secondary" onclick="ph41_setDefault('${a.id}')">افتراضي</button>` : ''}
              <button class="btn btn-sm btn-secondary" onclick="ph41_editAddress('${a.id}')">✏️</button>
              <button class="btn btn-sm btn-danger" onclick="ph41_deleteAddress('${a.id}')">🗑️</button>
            </div>
          </div>
        </div>`).join('') : `
        <div class="empty-state" style="padding:28px 20px">
          <div class="empty-icon">📍</div>
          <div class="empty-title">لا توجد عناوين محفوظة</div>
          <div class="empty-sub">أضف عنوانك الأول ليظهر عند الحجز تلقائياً</div>
        </div>`}
    </div>

    <div class="ph41-add-form">
      <h3 style="margin-bottom:14px;font-size:15px;font-weight:700">➕ إضافة عنوان جديد</h3>
      <div class="ph41-form-grid">
        <div class="form-group">
          <label class="form-label">الاسم (مثال: المنزل، العمل)</label>
          <input class="form-control" id="ph41-new-label" placeholder="المنزل">
        </div>
        <div class="form-group">
          <label class="form-label">النوع</label>
          <select class="form-control" id="ph41-new-type">
            <option value="home">🏠 المنزل</option>
            <option value="work">💼 العمل</option>
            <option value="other">📍 أخرى</option>
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">🏛️ المحافظة</label>
          <select class="form-control" id="ph41-new-gov" onchange="ph41_onGovChange('new')">
            <option value="">— اختر المحافظة —</option>
            ${(AppData.deliveryGovernorates || []).filter(g => g.active !== false).map(g =>
              `<option value="${g.id}">${escHtml(g.name)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group" id="ph41-new-zone-wrap" style="grid-column:1/-1;display:none">
          <label class="form-label">🗺️ المنطقة الرئيسية</label>
          <select class="form-control" id="ph41-new-zone" onchange="ph41_onZoneChange('new')">
            <option value="">— اختر المنطقة —</option>
          </select>
        </div>
        <div class="form-group" id="ph41-new-subzone-wrap" style="grid-column:1/-1;display:none">
          <label class="form-label">📍 الحي / المنطقة الفرعية</label>
          <select class="form-control" id="ph41-new-subzone">
            <option value="">— اختر الحي —</option>
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">العنوان التفصيلي *</label>
          <textarea class="form-control" id="ph41-new-address" placeholder="المدينة، الحي، الشارع، رقم البناية..." rows="2" style="resize:vertical"></textarea>
          <button type="button" class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="ph41_toggleMap('new')">📍 تحديد الموقع الجغرافي على الخريطة</button>
          <div id="ph41-new-map-container" style="display:none; margin-top:8px; height:220px; border-radius:12px; overflow:hidden; border: 1px solid var(--border);"></div>
          <input type="hidden" id="ph41-new-lat">
          <input type="hidden" id="ph41-new-lng">
        </div>
        <div class="form-group" style="grid-column:1/-1; margin-top:8px;">
          <label class="form-label" style="font-weight:700;">📸 أرفق صور للمنزل / باب المنزل (اختياري)</label>
          <div class="signup-pics-upload-zone" onclick="document.getElementById('ph41-new-pics-input').click()">
            <span style="font-size: 28px; display: block; margin-bottom: 6px;">📤</span>
            <span style="font-size: 12px; color: var(--text-secondary);">اضغط لرفع صور المنزل والباب (يمكنك اختيار عدة صور)</span>
            <input type="file" id="ph41-new-pics-input" accept="image/*" multiple hidden onchange="ph41_handleAddressPics(this, 'new')">
          </div>
          <div id="ph41-new-pics-preview" class="signup-pics-preview-grid"></div>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:var(--text-secondary)">
            <input type="checkbox" id="ph41-new-default" style="width:16px;height:16px">
            <span>تعيين كعنوان افتراضي (يُختار تلقائياً عند الحجز)</span>
          </label>
        </div>
      </div>
      <button class="btn btn-primary btn-block" onclick="ph41_saveNewAddress()">💾 حفظ العنوان</button>
    </div>`);
};

window.ph41_saveNewAddress = async function () {
  const label     = document.getElementById('ph41-new-label')?.value.trim();
  const type      = document.getElementById('ph41-new-type')?.value || 'home';
  const address   = document.getElementById('ph41-new-address')?.value.trim();
  const lat       = document.getElementById('ph41-new-lat')?.value ? parseFloat(document.getElementById('ph41-new-lat').value) : null;
  const lng       = document.getElementById('ph41-new-lng')?.value ? parseFloat(document.getElementById('ph41-new-lng').value) : null;
  const isDefault = document.getElementById('ph41-new-default')?.checked || false;
  const govEl     = document.getElementById('ph41-new-gov');
  const zoneEl    = document.getElementById('ph41-new-zone');
  const subzoneEl = document.getElementById('ph41-new-subzone');
  const govId     = govEl?.value || null;
  const zoneId    = zoneEl?.value || null;
  const subzoneId = subzoneEl?.value || null;
  const govObj    = (AppData.deliveryGovernorates||[]).find(g => g.id === govId);
  const zoneObj   = (AppData.deliveryZones||[]).find(z => z.id === zoneId);
  const szObj     = (AppData.deliverySubzones||[]).find(s => s.id === subzoneId);
  const govName     = govObj?.name  || '';
  const zoneName    = zoneObj?.name || '';
  const subzoneName = szObj?.name   || '';

  if (!address) { toast('يرجى إدخال العنوان التفصيلي', 'error'); return; }

  const u = State.currentUser;
  const typeLabels = { home: 'المنزل', work: 'العمل', other: 'أخرى' };
  const finalLabel = label || typeLabels[type] || 'عنوان';

  showLoader('جاري الحفظ...');
  try {
    if (isDefault) {
      const addrs = window.__ph41_addresses || [];
      await Promise.all(addrs.filter(x => x.isDefault).map(x =>
        db.collection('user_addresses').doc(x.id).update({ isDefault: false })
      ));
    }
    await db.collection('user_addresses').add({
      userId: u.uid,
      label: finalLabel,
      type,
      address,
      isDefault,
      govId, govName, zoneId, zoneName, subzoneId, subzoneName,
      pics: window.ph41_tempAddressPics || [],
      lat,
      lng,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    window.ph41_tempAddressPics = [];
    hideLoader();
    toast('✅ تم حفظ العنوان', 'success');
    ph41_showAddressBook();
  } catch (e) {
    hideLoader();
    toast('تعذّر الحفظ: ' + (e.message || e), 'error');
  }
};

window.ph41_deleteAddress = async function (addrId) {
  if (!confirm('حذف هذا العنوان نهائياً؟')) return;
  showLoader('جاري الحذف...');
  try {
    await db.collection('user_addresses').doc(addrId).delete();
    hideLoader();
    toast('تم حذف العنوان', 'success');
    ph41_showAddressBook();
  } catch (e) {
    hideLoader();
    toast('فشل الحذف: ' + (e.message || e), 'error');
  }
};

window.ph41_setDefault = async function (addrId) {
  const addrs = window.__ph41_addresses || [];
  showLoader('جاري التحديث...');
  try {
    await Promise.all(addrs.map(a =>
      db.collection('user_addresses').doc(a.id).update({ isDefault: a.id === addrId })
    ));
    hideLoader();
    toast('✅ تم تعيين العنوان الافتراضي', 'success');
    ph41_showAddressBook();
  } catch (e) {
    hideLoader();
    toast('تعذّر التحديث: ' + (e.message || e), 'error');
  }
};

window.ph41_editAddress = function (addrId) {
  const addr = (window.__ph41_addresses || []).find(a => a.id === addrId);
  if (!addr) return;
  
  window.ph41_tempEditAddressPics = [...(addr.pics || [])];
  
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">✏️ تعديل العنوان</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">الاسم</label>
      <input class="form-control" id="ph41-edit-label" value="${escAttr(addr.label || '')}">
    </div>
    <div class="form-group">
      <label class="form-label">النوع</label>
      <select class="form-control" id="ph41-edit-type">
        <option value="home" ${addr.type === 'home' ? 'selected' : ''}>🏠 المنزل</option>
        <option value="work" ${addr.type === 'work' ? 'selected' : ''}>💼 العمل</option>
        <option value="other" ${addr.type === 'other' ? 'selected' : ''}>📍 أخرى</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">🏛️ المحافظة</label>
      <select class="form-control" id="ph41-edit-gov" onchange="ph41_onGovChange('edit')">
        <option value="">— اختر المحافظة —</option>
        ${(AppData.deliveryGovernorates || []).filter(g => g.active !== false).map(g =>
          `<option value="${g.id}" ${addr.govId === g.id ? 'selected' : ''}>${escHtml(g.name)}</option>`
        ).join('')}
      </select>
    </div>
    <div class="form-group" id="ph41-edit-zone-wrap" style="display:${addr.zoneId ? 'block' : 'none'}">
      <label class="form-label">🗺️ المنطقة الرئيسية</label>
      <select class="form-control" id="ph41-edit-zone" onchange="ph41_onZoneChange('edit')">
        <option value="">— اختر المنطقة —</option>
        ${(AppData.deliveryZones || []).filter(z => z.govId === addr.govId && z.active !== false).map(z =>
          `<option value="${z.id}" ${addr.zoneId === z.id ? 'selected' : ''}>${escHtml(z.name)}</option>`
        ).join('')}
      </select>
    </div>
    <div class="form-group" id="ph41-edit-subzone-wrap" style="display:${addr.subzoneId ? 'block' : 'none'}">
      <label class="form-label">📍 الحي / المنطقة الفرعية</label>
      <select class="form-control" id="ph41-edit-subzone">
        <option value="">— اختر الحي —</option>
        ${(AppData.deliverySubzones || []).filter(sz => sz.zoneId === addr.zoneId && sz.active !== false).map(sz =>
          `<option value="${sz.id}" ${addr.subzoneId === sz.id ? 'selected' : ''}>${escHtml(sz.name)}</option>`
        ).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">العنوان التفصيلي</label>
      <textarea class="form-control" id="ph41-edit-address" rows="3" style="resize:vertical">${escHtml(addr.address || '')}</textarea>
    </div>
    <div class="form-group" style="grid-column:1/-1">
      <input type="hidden" id="ph41-edit-addr-id" value="${addrId}">
      <button type="button" class="btn btn-secondary btn-sm" onclick="ph41_toggleMap('edit')">📍 تعديل الموقع الجغرافي على الخريطة</button>
      <div id="ph41-edit-map-container" style="display:none; margin-top:8px; height:220px; border-radius:12px; overflow:hidden; border: 1px solid var(--border);"></div>
      <input type="hidden" id="ph41-edit-lat" value="${addr.lat || ''}">
      <input type="hidden" id="ph41-edit-lng" value="${addr.lng || ''}">
    </div>
    <div class="form-group" style="margin-top:12px;">
      <label class="form-label" style="font-weight:700;">📸 أرفق صور للمنزل / باب المنزل (اختياري)</label>
      <div class="signup-pics-upload-zone" onclick="document.getElementById('ph41-edit-pics-input').click()">
        <span style="font-size: 28px; display: block; margin-bottom: 6px;">📤</span>
        <span style="font-size: 12px; color: var(--text-secondary);">اضغط لرفع صور للمنزل والباب (يمكنك اختيار عدة صور)</span>
        <input type="file" id="ph41-edit-pics-input" accept="image/*" multiple hidden onchange="ph41_handleAddressPics(this, 'edit')">
      </div>
      <div id="ph41-edit-pics-preview" class="signup-pics-preview-grid">
        ${window.ph41_tempEditAddressPics.map((pic, pIdx) => `
          <div class="su-pic-thumb">
            <img src="${pic}">
            <button type="button" class="su-pic-remove" onclick="ph41_removeAddressPic('edit', ${pIdx}, this)">✕</button>
          </div>
        `).join('')}
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-primary" style="flex:1" onclick="ph41_saveEditAddress('${addrId}')">💾 حفظ التعديلات</button>
      <button class="btn btn-secondary" style="flex:1" onclick="ph41_showAddressBook()">إلغاء</button>
    </div>`);
};

window.ph41_saveEditAddress = async function (addrId) {
  const label   = document.getElementById('ph41-edit-label')?.value.trim();
  const type    = document.getElementById('ph41-edit-type')?.value;
  const address = document.getElementById('ph41-edit-address')?.value.trim();
  const lat     = document.getElementById('ph41-edit-lat')?.value ? parseFloat(document.getElementById('ph41-edit-lat').value) : null;
  const lng     = document.getElementById('ph41-edit-lng')?.value ? parseFloat(document.getElementById('ph41-edit-lng').value) : null;
  if (!address) { toast('العنوان التفصيلي مطلوب', 'error'); return; }
  const govEl     = document.getElementById('ph41-edit-gov');
  const zoneEl    = document.getElementById('ph41-edit-zone');
  const subzoneEl = document.getElementById('ph41-edit-subzone');
  const govId     = govEl?.value || null;
  const zoneId    = zoneEl?.value || null;
  const subzoneId = subzoneEl?.value || null;
  const govObj    = (AppData.deliveryGovernorates||[]).find(g => g.id === govId);
  const zoneObj   = (AppData.deliveryZones||[]).find(z => z.id === zoneId);
  const szObj     = (AppData.deliverySubzones||[]).find(s => s.id === subzoneId);
  const govName     = govObj?.name  || '';
  const zoneName    = zoneObj?.name || '';
  const subzoneName = szObj?.name   || '';
  showLoader('جاري الحفظ...');
  try {
    await db.collection('user_addresses').doc(addrId).update({
      label, type, address,
      govId, govName, zoneId, zoneName, subzoneId, subzoneName,
      pics: window.ph41_tempEditAddressPics || [],
      lat,
      lng,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    window.ph41_tempEditAddressPics = [];
    hideLoader();
    toast('✅ تم تحديث العنوان', 'success');
    ph41_showAddressBook();
  } catch (e) {
    hideLoader();
    toast('تعذّر الحفظ: ' + (e.message || e), 'error');
  }
};

// ─── مكوّن اختيار العنوان داخل مودال الحجز ─────────────────────
window.ph41_renderAddressSelector = function (addrs) {
  if (!addrs || !addrs.length) return '';
  const typeIcon = { home: '🏠', work: '💼', other: '📍' };
  const defaultIdx = addrs.findIndex(a => a.isDefault);
  const selIdx = defaultIdx >= 0 ? defaultIdx : 0;
  return `
    <div class="ph41-bk-wrap">
      <label class="form-label">📍 اختر من عناوينك المحفوظة</label>
      <div class="ph41-bk-list">
        ${addrs.map((a, i) => `
          <div class="ph41-bk-item${i === selIdx ? ' selected' : ''}"
               onclick="ph41_pickBookingAddress(this, '${escAttr(a.address)}', '${escAttr(a.subzoneName||'')}', '${escAttr(a.zoneName||'')}', '${escAttr(a.subzoneId||'')}', '${escAttr(a.zoneId||'')}', '${escAttr(a.govName||'')}', '${escAttr(a.govId||'')}')">
            <span class="ph41-bk-icon">${typeIcon[a.type] || '📍'}</span>
            <div class="ph41-bk-info">
              <div class="ph41-bk-label">${escHtml(a.label)}</div>
              ${a.subzoneName ? `<div style="font-size:11px;color:var(--primary);font-weight:700;margin-bottom:2px">📍 ${escHtml(a.govName||'')} ${a.govName?'›':''} ${escHtml(a.zoneName||'')} ${a.zoneName?'›':''} ${escHtml(a.subzoneName)}</div>` : ''}
              <div class="ph41-bk-text">
                ${escHtml(a.address)}
                ${a.lat && a.lng ? `
                  <div style="margin-top:6px">
                    <a href="https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}" target="_blank" class="btn btn-xs btn-secondary" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 8px;border-radius:6px;text-decoration:none">
                      🌍 فتح في خرائط Google
                    </a>
                  </div>
                ` : ''}
              </div>
            </div>
            <span class="ph41-bk-radio">${i === selIdx ? '🔵' : '⚪'}</span>
          </div>`).join('')}
        <div class="ph41-bk-item" onclick="ph41_pickBookingAddress(this, '')">
          <span class="ph41-bk-icon">✏️</span>
          <div class="ph41-bk-info">
            <div class="ph41-bk-label">إدخال عنوان آخر</div>
          </div>
          <span class="ph41-bk-radio">⚪</span>
        </div>
      </div>
    </div>`;
};

window.ph41_pickBookingAddress = function (el, address, subzoneName, zoneName, subzoneId, zoneId, govName, govId) {
  document.querySelectorAll('.ph41-bk-item').forEach(item => {
    item.classList.remove('selected');
    const r = item.querySelector('.ph41-bk-radio');
    if (r) r.textContent = '⚪';
  });
  el.classList.add('selected');
  const r = el.querySelector('.ph41-bk-radio');
  if (r) r.textContent = '🔵';
  const inp = document.getElementById('bk-addr');
  if (inp) {
    inp.value = address;
    inp.style.display = address ? 'none' : '';
    if (!address) { inp.style.display = ''; inp.focus(); }
  }
  // حفظ subzone والمحافظة للاستخدام في حساب التوصيل
  window.__ph41_selectedSubzone = { subzoneId: subzoneId||'', subzoneName: subzoneName||'', zoneId: zoneId||'', zoneName: zoneName||'', govId: govId||'', govName: govName||'' };
};

// ─── منتقي المحافظة والمنطقة والحي ──────────────────────────────
window.ph41_onGovChange = function(mode) {
  const govEl    = document.getElementById(`ph41-${mode}-gov`);
  const zoneWrap = document.getElementById(`ph41-${mode}-zone-wrap`);
  const zoneSelect = document.getElementById(`ph41-${mode}-zone`);
  const szWrap   = document.getElementById(`ph41-${mode}-subzone-wrap`);
  const szSelect = document.getElementById(`ph41-${mode}-subzone`);
  const govId    = govEl?.value;

  if (!govId) {
    if (zoneWrap) zoneWrap.style.display = 'none';
    if (zoneSelect) zoneSelect.innerHTML = '<option value="">— اختر المنطقة —</option>';
    if (szWrap) szWrap.style.display = 'none';
    if (szSelect) szSelect.innerHTML = '<option value="">— اختر الحي —</option>';
    return;
  }

  const zones = (AppData.deliveryZones || []).filter(z => z.govId === govId && z.active !== false);
  if (zoneSelect) {
    zoneSelect.innerHTML = '<option value="">— اختر المنطقة —</option>' +
      zones.map(z => `<option value="${z.id}">${escHtml(z.name)}</option>`).join('');
  }
  if (zoneWrap) zoneWrap.style.display = zones.length ? 'block' : 'none';
  if (szWrap) szWrap.style.display = 'none';
  if (szSelect) szSelect.innerHTML = '<option value="">— اختر الحي —</option>';
};

window.ph41_onZoneChange = function(mode) {
  const zoneEl    = document.getElementById(`ph41-${mode}-zone`);
  const szWrap    = document.getElementById(`ph41-${mode}-subzone-wrap`);
  const szSelect  = document.getElementById(`ph41-${mode}-subzone`);
  const zoneId    = zoneEl?.value;

  if (!zoneId) {
    if (szWrap) szWrap.style.display = 'none';
    if (szSelect) szSelect.innerHTML = '<option value="">— اختر الحي —</option>';
    return;
  }

  const subzones = (AppData.deliverySubzones || []).filter(sz => sz.zoneId === zoneId && sz.active !== false);
  if (szSelect) {
    szSelect.innerHTML = '<option value="">— اختر الحي —</option>' +
      subzones.map(sz => `<option value="${sz.id}">${escHtml(sz.name)}</option>`).join('');
  }
  if (szWrap) szWrap.style.display = subzones.length ? 'block' : 'none';
};

// ─── Styles ────────────────────────────────────────────────────
(function () {
  if (window.__ph41_styles) return;
  window.__ph41_styles = true;
  const s = document.createElement('style');
  s.textContent = `
    .ph41-addr-card { background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:14px 16px;margin-bottom:10px;transition:border-color 0.2s; }
    .ph41-addr-card:hover { border-color:var(--primary); }
    .ph41-addr-main { display:flex;align-items:flex-start;gap:12px; }
    .ph41-addr-type-icon { font-size:24px;flex-shrink:0;margin-top:2px; }
    .ph41-addr-body { flex:1;min-width:0; }
    .ph41-addr-label { font-weight:700;font-size:15px;margin-bottom:3px; }
    .ph41-addr-text { color:var(--text-secondary);font-size:13px;line-height:1.5; }
    .ph41-addr-actions { display:flex;gap:6px;flex-shrink:0;align-items:flex-start;flex-wrap:wrap;justify-content:flex-end; }
    .ph41-add-form { margin-top:16px;padding:18px;background:var(--bg-card);border:1px dashed var(--glass-border);border-radius:14px; }
    .ph41-form-grid { display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px; }
    @media(max-width:640px) { .ph41-form-grid { grid-column:1fr; } }

    .ph41-bk-wrap { margin-bottom:16px; }
    .ph41-bk-list { display:flex;flex-direction:column;gap:8px;margin-top:8px; }
    .ph41-bk-item { display:flex;align-items:center;gap:10px;background:var(--bg-card);border:2px solid var(--glass-border);border-radius:12px;padding:10px 14px;cursor:pointer;transition:all 0.15s; }
    .ph41-bk-item:hover { border-color:var(--primary); }
    .ph41-bk-item.selected { border-color:var(--primary);background:rgba(139,92,246,0.07); }
    .ph41-bk-icon { font-size:18px;flex-shrink:0; }
    .ph41-bk-info { flex:1;min-width:0; }
    .ph41-bk-label { font-weight:600;font-size:14px; }
    .ph41-bk-text { font-size:12px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
    .ph41-bk-radio { font-size:16px;flex-shrink:0; }

    .ph41-quick-btns { display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid var(--glass-border); }
    .ph41-quick-btn { flex:1;min-width:140px;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;background:var(--bg-card);border:1px solid var(--glass-border);border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;color:var(--text-main);transition:all 0.2s; }
    .ph41-quick-btn:hover { border-color:var(--primary);color:var(--primary);background:rgba(139,92,246,0.07); }
  `;
  document.head.appendChild(s);
})();

console.log('[Phase 41] Address Book System loaded');

// ───────────────────────────────────────────────────────
// ADDRESS BOOK PICS UPLOADER HELPERS
// ───────────────────────────────────────────────────────
window.ph41_tempAddressPics = [];
window.ph41_tempEditAddressPics = [];

window.ph41_handleAddressPics = function(input, mode) {
  const files = input.files;
  if (!files.length) return;
  const list = mode === 'new' ? window.ph41_tempAddressPics : window.ph41_tempEditAddressPics;
  const preview = document.getElementById(mode === 'new' ? 'ph41-new-pics-preview' : 'ph41-edit-pics-preview');
  if (!preview) return;
  
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) {
      toast('الحد الأقصى للصور 5 ميجابايت', 'error');
      continue;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64 = e.target.result;
      list.push(base64);
      
      const thumb = document.createElement('div');
      thumb.className = 'su-pic-thumb';
      thumb.innerHTML = `
        <img src="${base64}">
        <button type="button" class="su-pic-remove" onclick="ph41_removeAddressPic('${mode}', ${list.length - 1}, this)">✕</button>
      `;
      preview.appendChild(thumb);
    };
    reader.readAsDataURL(file);
  }
};

window.ph41_removeAddressPic = function(mode, idx, btn) {
  const list = mode === 'new' ? window.ph41_tempAddressPics : window.ph41_tempEditAddressPics;
  if (list && list[idx]) {
    list.splice(idx, 1);
  }
  btn.closest('.su-pic-thumb').remove();
  
  // Re-index remaining remove buttons
  const preview = document.getElementById(mode === 'new' ? 'ph41-new-pics-preview' : 'ph41-edit-pics-preview');
  if (preview) {
    preview.querySelectorAll('.su-pic-remove').forEach((b, i) => {
      b.setAttribute('onclick', `ph41_removeAddressPic('${mode}', ${i}, this)`);
    });
  }
};

// ───────────────────────────────────────────────────────
// MAPBOX INTEGRATION FOR ADDRESS PICKING
// ───────────────────────────────────────────────────────
window.ph41_toggleMap = function(mode) {
  const container = document.getElementById(`ph41-${mode}-map-container`);
  if (!container) return;
  
  if (container.style.display === 'block') {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  
  // Default coordinates (Sana'a, Yemen as default center)
  let lat = 15.35;
  let lng = 44.20;
  
  if (mode === 'edit') {
    const latVal = document.getElementById('ph41-edit-lat')?.value;
    const lngVal = document.getElementById('ph41-edit-lng')?.value;
    if (latVal && lngVal) {
      lat = parseFloat(latVal);
      lng = parseFloat(lngVal);
    }
  } else {
    // Attempt current user geolocation for new addresses
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        ph41_initMapbox(mode, lat, lng);
      }, () => {
        ph41_initMapbox(mode, lat, lng);
      });
      return;
    }
  }
  
  ph41_initMapbox(mode, lat, lng);
};

window.ph41_initMapbox = function(mode, lat, lng) {
  const token = window.MAPBOX_TOKEN;
  if (!token) {
    toast('مفتاح Mapbox غير متوفر', 'error');
    return;
  }
  
  mapboxgl.accessToken = token;
  const containerId = `ph41-${mode}-map-container`;
  
  // Destroy previous map instance if any to prevent memory leaks and duplicate maps
  if (window[`_ph41_${mode}MapInstance`]) {
    try { window[`_ph41_${mode}MapInstance`].remove(); } catch(e){}
    window[`_ph41_${mode}MapInstance`] = null;
  }
  
  const map = new mapboxgl.Map({
    container: containerId,
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [lng, lat],
    zoom: 13
  });
  
  window[`_ph41_${mode}MapInstance`] = map;
  
  map.addControl(new mapboxgl.NavigationControl(), 'top-right');
  
  const marker = new mapboxgl.Marker({
    draggable: true
  })
  .setLngLat([lng, lat])
  .addTo(map);
  
  document.getElementById(`ph41-${mode}-lat`).value = lat;
  document.getElementById(`ph41-${mode}-lng`).value = lng;
  
  function onDragEnd() {
    const lngLat = marker.getLngLat();
    document.getElementById(`ph41-${mode}-lat`).value = lngLat.lat;
    document.getElementById(`ph41-${mode}-lng`).value = lngLat.lng;
    
    // Reverse geocoding to suggest address name
    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lngLat.lng},${lngLat.lat}.json?access_token=${token}&language=ar`)
      .then(res => res.json())
      .then(data => {
        if (data.features && data.features.length > 0) {
          const placeName = data.features[0].place_name;
          const addrTextarea = document.getElementById(`ph41-${mode}-address`);
          if (addrTextarea && !addrTextarea.value.trim()) {
            addrTextarea.value = placeName;
          }
        }
      }).catch(err => console.log('Reverse geocoding error:', err));
  }
  
  marker.on('dragend', onDragEnd);
  
  map.on('click', (e) => {
    marker.setLngLat(e.lngLat);
    document.getElementById(`ph41-${mode}-lat`).value = e.lngLat.lat;
    document.getElementById(`ph41-${mode}-lng`).value = e.lngLat.lng;
  });
  
  // Resize to fix container layout bugs in modal
  setTimeout(() => map.resize(), 300);
};

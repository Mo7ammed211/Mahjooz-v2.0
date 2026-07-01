// Phase 21 - Provider Workflow & Pricing System
(function () {
  if (typeof I18N !== 'undefined') {
    I18N.ar.pending_admin    = 'بانتظار الإدارة';
    I18N.ar.pending_provider = 'بانتظار المزود';
    I18N.ar.approved         = 'مقبول';
    I18N.ar.rejected         = 'مرفوض';
    I18N.en.pending_admin    = 'Pending Admin';
    I18N.en.pending_provider = 'Pending Provider';
    I18N.en.approved         = 'Approved';
    I18N.en.rejected         = 'Rejected';
  }
})();

// --- Helper: get providers list ---
function getProviders() {
  return (AppData.users || []).filter(u => ['vendor', 'provider'].includes(u.role));
}

// --- Helper: calculate final price ---
function calcFinalPrice(basePrice, commission, tax) {
  const base = parseFloat(basePrice) || 0;
  const comm = parseFloat(commission) || 0;
  const tx   = parseFloat(tax) || 0;
  return Math.round(base + (base * comm / 100) + (base * tx / 100));
}

// --- Override removed as it conflicts with the new multi-vendor system ---
/*
const __ph21_origSvcModalBody = typeof window._svcModalBody === 'function' ? window._svcModalBody : null;
window._svcModalBody = function(s = {}) {
  ...
};
*/


window.ph21_updateFinalPrice = function() {
  const priceEl = document.getElementById('svc-price');
  const commEl  = document.getElementById('svc-commission');
  const taxEl   = document.getElementById('svc-tax');
  const dispEl  = document.getElementById('ph21-final-price-disp');
  const prevEl  = document.getElementById('ph21-price-preview');
  if (!priceEl || !commEl || !taxEl || !dispEl) return;
  const fp = calcFinalPrice(priceEl.value, commEl.value, taxEl.value);
  if (fp > 0) {
    dispEl.textContent = fp.toLocaleString('ar-YE') + ' ريال';
    if (prevEl) prevEl.style.display = 'block';
  } else {
    dispEl.textContent = '—';
  }
};

// --- Collection override removed ---
/*
const __ph21_origCollect = typeof window._collectSvcForm === 'function' ? window._collectSvcForm : null;
window._collectSvcForm = function(existingImages = []) {
  ...
};
*/

// --- Validation overrides removed ---
/*
const __ph21_origSaveNewSvc = ...
*/

// --- Display finalPrice on service cards ---
const __ph21_origCard = typeof window.renderServiceCard === 'function' ? window.renderServiceCard : null;
window.renderServiceCard = function(s) {
  const dispPrice = s.finalPrice || s.price;
  const sPatched = { ...s, price: dispPrice };
  return __ph21_origCard ? __ph21_origCard(sPatched) : '';
};

// --- New bookService with pending_admin workflow ---
window.bookService = function(svcId) {
  const svc = AppData.services.find(s => s.id === svcId);
  if (!svc) return;

  // ── التحقق من حالة التوفر (ph48) ──
  if (typeof ph48_isAvailable === 'function' && !ph48_isAvailable(svc)) {
    toast('عذراً، صاحب هذه المهنة/الخدمة غير متاح للطلبات حالياً', 'error');
    return;
  }

  const cat = AppData.cats.find(c => c.id === svc.catId);
  const isProfession = cat?.section === 'professions' || cat?.section === 'services';
  
  // ── Reset tier selection ──
  const hasTiers = svc.tiers && svc.tiers.length > 0;
  window.__ph40_selectedTier = null;
  if (hasTiers) {
    window.__ph40_selectedTier = { idx: 0, price: svc.tiers[0].price, name: svc.tiers[0].name };
  }

  const initialPrice = window.__ph40_selectedTier ? window.__ph40_selectedTier.price : (svc.finalPrice || svc.price);
  const priceLabel = hasTiers 
    ? `${initialPrice.toLocaleString('ar-YE')} ريال`
    : (isProfession ? 'السعر بعد المعاينة' : (initialPrice ? initialPrice.toLocaleString('ar-YE')+' ريال' : 'السعر عند التواصل'));

  let issuesHtml = '';
  if (isProfession && svc.commonIssues && svc.commonIssues.length > 0) {
    issuesHtml = `
      <div class="form-group">
        <label class="form-label">🛠️ اختر نوع المشكلة (يمكنك اختيار أكثر من واحدة)</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:var(--bg-secondary);padding:12px;border-radius:12px">
          ${svc.commonIssues.map((issue, idx) => `
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
              <input type="checkbox" class="svc-issue-cb" value="${issue}">
              ${issue}
            </label>
          `).join('')}
        </div>
      </div>`;
  }

  // Dynamic callback to update selected price inside modal
  window.ph40_onTierSelected = function(idx, price, name) {
    const priceDisp = document.getElementById('bk-selected-price-display');
    if (priceDisp) {
      priceDisp.innerText = price.toLocaleString('ar-YE') + ' ريال';
    }
  };

  openModal(`
    <div class="modal-header"><h2 class="modal-title">${isProfession ? '🛠️ طلب مهني' : '🛒 تأكيد الطلب'}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="background:linear-gradient(135deg,rgba(139,92,246,.1),rgba(139,92,246,.05));border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:20px">
      <div style="font-size:28px;margin-bottom:8px">${svc.icon||'🔷'}</div>
      <div style="font-size:18px;font-weight:800">${svc.name}</div>
      <div style="color:var(--text-muted);font-size:13px;margin-top:4px">${isProfession ? '👤 صاحب المهنة:' : '👤 مزود الخدمة:'} ${svc.providerName||svc.provider||'—'}</div>
      <div id="bk-selected-price-display" style="font-size:26px;font-weight:800;margin-top:12px;color:#10b981">${priceLabel}</div>
    </div>
    ${hasTiers ? ph40_renderTierSelector(svc) : ''}
    ${issuesHtml}
    <div class="form-group"><label class="form-label">📅 التاريخ المطلوب</label><input class="form-control" id="bk-date" type="date" min="${new Date().toISOString().split('T')[0]}"></div>
    <div class="form-group"><label class="form-label">⏰ الوقت المفضل</label><input class="form-control" id="bk-time" type="time"></div>
    <div class="form-group"><label class="form-label">📝 وصف المشكلة / ملاحظات</label><textarea class="form-control" id="bk-note" rows="3" placeholder="اشرح المشكلة بالتفصيل هنا..."></textarea></div>
    <button class="btn btn-primary btn-block btn-lg" onclick="ph21_confirmOrder('${svcId}')">✅ ${isProfession ? 'طلب معاينة وحجز' : 'إرسال الطلب'}</button>`);
};

window.ph21_confirmOrder = async function(svcId) {
  const date = document.getElementById('bk-date').value;
  const time = document.getElementById('bk-time').value;
  const note = document.getElementById('bk-note').value;
  const selectedIssues = Array.from(document.querySelectorAll('.svc-issue-cb:checked')).map(cb => cb.value);

  if (!date) { toast('يرجى اختيار التاريخ', 'error'); return; }
  const svc = AppData.services.find(s => s.id === svcId);
  const cat = AppData.cats.find(c => c.id === svc?.catId);
  const isProfession = cat?.section === 'professions' || cat?.section === 'services';
  const u   = State.currentUser;
  
  const tier = window.__ph40_selectedTier;
  const finalPrice = tier ? tier.price : (svc?.finalPrice || svc?.price || 0);
  const tierName = tier ? tier.name : null;

  await fsAdd('orders', {
    svcId, svcName: svc?.name, svcIcon: svc?.icon || '🔷',
    tierName,
    providerUid: svc?.providerUid || '', providerName: svc?.providerName || svc?.provider || '',
    userId: u.uid, userName: u.name,
    finalPrice, date, time, note,
    selectedIssues,
    isProfession,
    requiresDelivery: svc?.requiresDelivery !== false,
    status: isProfession ? 'pending_inspection' : 'pending_admin',
    createdAt: new Date(),
    orderRegionId: State.currentUser?.regionId || null,
  });
  window.__ph40_selectedTier = null;
  closeModal();
  toast(isProfession ? '✅ تم إرسال طلبك لمزود الخدمة! بانتظار التواصل للمعاينة' : '✅ تم إرسال طلبك! بانتظار موافقة الإدارة', 'success');
};

// --- Provider Dashboard ---
window.renderProviderDashboard = function() {
  const u = State.currentUser;
  if (!u || u.role !== 'provider') return '<div>غير مصرح</div>';
  const myOrders   = (AppData.orders || []).filter(o => o.providerUid === u.uid);
  const mySvcs     = (AppData.services || []).filter(s => s.providerUid === u.uid && s.status === 'active');
  const myProposals = (AppData.catalogItems || []).filter(item => item.providerUid === u.uid);
  const myPendingProposals = myProposals.filter(p => p.status === 'pending_approval');
  
  const statusLabel = { pending_admin:'⏳ بانتظار الإدارة', pending_provider:'🔔 بانتظار موافقتك', approved:'✅ مكتمل/مقبول', rejected:'❌ مرفوض', provider_accepted: '🔄 جاري البحث عن مندوب', accepted: '🛵 مع المندوب', delivered: '📦 تم التوصيل' };
  const statusBadge = { pending_admin:'badge-gold', pending_provider:'badge-purple', approved:'badge-teal', rejected:'badge-rose', provider_accepted: 'badge-gold', accepted: 'badge-purple', delivered: 'badge-teal' };
  
  return `<div id="app-content">
    <div class="page-header"><h1>💼 لوحة مزود الخدمة</h1><p style="color:var(--text-muted)">مرحباً ${u.name}</p></div>
    <div class="stats-grid" style="margin-bottom:24px">
      <div class="stat-card"><div class="stat-num">${mySvcs.length}</div><div class="stat-label">خدماتي النشطة</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#f59e0b">${myPendingProposals.length}</div><div class="stat-label">طلبات كتالوج معلقة</div></div>
      <div class="stat-card"><div class="stat-num">${myOrders.filter(o=>o.status==='pending_provider').length}</div><div class="stat-label">طلبات جديدة</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#10b981">${myOrders.filter(o=>o.status==='approved').length}</div><div class="stat-label">طلبات مقبولة</div></div>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="ph21_showProviderAddSvc()">➕ اقتراح إضافة للكتالوج الموحد</button>
    </div>
    
    <h3 style="margin-bottom:12px">📋 الطلبات الواردة</h3>
    ${myOrders.length ? `<div class="table-wrap"><table class="admin-table">
      <thead><tr><th>الخدمة</th><th>العميل</th><th>التاريخ</th><th>السعر</th><th>الحالة</th><th>إجراء</th></tr></thead>
      <tbody>${myOrders.map(o => `<tr>
        <td>${o.svcName||'—'}</td>
        <td>${o.userName||'—'}</td>
        <td>${o.date||'—'}</td>
        <td style="font-weight:700;color:#10b981">${o.finalPrice ? o.finalPrice.toLocaleString('ar-YE')+' ريال' : '—'}</td>
        <td><span class="badge ${statusBadge[o.status]||'badge-purple'}">${statusLabel[o.status]||o.status}</span></td>
        <td>${o.status==='pending_provider'
          ? (o.type === 'store_order' || (o.items && o.items.length > 0)
              ? `<button class="btn btn-sm btn-primary" onclick="ph43_showPartialAcceptModal('${o.id}')">📦 مراجعة المنتجات</button>`
              : `<button class="btn btn-sm btn-success" onclick="ph21_providerAccept('${o.id}')">✅ قبول</button>`) +
             `<button class="btn btn-sm btn-danger" onclick="ph21_providerReject('${o.id}')" style="margin-top:4px">❌ رفض</button>`
          : '—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">لا توجد طلبات بعد</div></div>'}
    
    <h3 style="margin:24px 0 12px">🛎️ خدماتي النشطة (المرتبطة بالكتالوج الموحد)</h3>
    ${mySvcs.length ? `<div class="table-wrap"><table class="admin-table">
      <thead><tr><th>الخدمة</th><th>السعر الأساسي</th><th>السعر النهائي</th><th>الحالة</th></tr></thead>
      <tbody>${mySvcs.map(s => `<tr>
        <td>${s.name}</td>
        <td>${s.price ? s.price.toLocaleString('ar-YE')+' ريال' : '—'}</td>
        <td style="font-weight:700;color:#10b981">${s.finalPrice ? s.finalPrice.toLocaleString('ar-YE')+' ريال' : '—'}</td>
        <td><span class="badge badge-teal">✅ نشط</span></td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<div class="empty-state"><div class="empty-icon">🛎️</div><div class="empty-title">لا توجد خدمات نشطة مرتبطة بك حالياً</div></div>'}

    <h3 style="margin:24px 0 12px">📋 طلباتي المقترحة للكتالوج الموحد</h3>
    ${myProposals.length ? `<div class="table-wrap"><table class="admin-table">
      <thead><tr><th>الاسم المقترح</th><th>القسم المستهدف</th><th>التصنيف</th><th>السعر المقترح</th><th>الحالة</th><th>ملاحظات الإدارة</th></tr></thead>
      <tbody>${myProposals.map(p => {
        const cat = (AppData.catalogCats || []).find(c => c.id === p.catId);
        const sectionNames = { bookings: '📅 الحجوزات والخدمات', stores: '🛒 المتجر الإلكتروني', rental: '🚗 قسم التأجير' };
        const statusLabel = { pending_approval: '⏳ بانتظار الموافقة', active: '✅ مقبول ونشط', rejected: '❌ مرفوض' };
        const statusBadge = { pending_approval: 'badge-gold', active: 'badge-teal', rejected: 'badge-rose' };
        return `<tr>
          <td><span style="font-weight:700">${escHtml(p.name)}</span></td>
          <td><span class="badge badge-purple">${sectionNames[p.sectionId] || p.sectionId}</span></td>
          <td>${cat ? escHtml(cat.name) : '—'}</td>
          <td style="font-weight:700;color:#10b981">${p.price ? p.price.toLocaleString('ar-YE')+' ريال' : '—'}</td>
          <td><span class="badge ${statusBadge[p.status] || 'badge-gold'}">${statusLabel[p.status] || p.status}</span></td>
          <td style="color:var(--text-secondary);" title="${escHtml(p.rejectionReason || '')}">${escHtml(p.rejectionReason || '—')}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>` : '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">لم تقم بتقديم أي مقترحات إضافة للكتالوج بعد</div></div>'}
  </div>`;
};

window.ph21_providerAccept = async function(orderId) {
  const o = (AppData.orders || []).find(x => x.id === orderId);
  if (!o) return;
  const respondedAt = new Date();
  const notifiedMs = o.vendorNotifiedAt?.toMillis ? o.vendorNotifiedAt.toMillis()
    : o.vendorNotifiedAt ? new Date(o.vendorNotifiedAt).getTime() : null;
  const responseTimeSecs = notifiedMs ? Math.round((respondedAt.getTime() - notifiedMs) / 1000) : null;

  if (o.requiresDelivery !== false) {
    if (typeof window.__buildDriverPool === 'function') {
      const dPool = window.__buildDriverPool(o);
      await fsUpdate('orders', orderId, {
        status: 'provider_accepted',
        providerAcceptedAt: respondedAt,
        respondedAt,
        responseAction: 'accepted',
        responseTimeSecs,
        driverPool: dPool, driverIdx: 0, driverHistory: [],
        assignedDriverId: dPool[0] || null, driverId: dPool[0] || null,
        driverAssignedAt: dPool[0] ? new Date() : null,
      });
      await fsAdd('order_routing', { orderId, kind: 'provider_accept', uid: State.currentUser.uid, at: respondedAt, responseTimeSecs });
      toast(dPool.length ? 'تم القبول — تم إسناد الطلب لأقرب مندوب' : 'تم القبول — لا يوجد مندوبون', 'success');
    } else {
      toast('النظام غير جاهز لتعيين مندوب', 'error');
    }
  } else {
    await fsUpdate('orders', orderId, {
      status: 'approved',
      approvedByProviderAt: respondedAt,
      respondedAt,
      responseAction: 'accepted',
      responseTimeSecs,
    });
    toast('✅ تم قبول الطلب (بدون توصيل)', 'success');
  }
  await render();
};
window.ph21_providerReject = async function(orderId) {
  const o = (AppData.orders || []).find(x => x.id === orderId);
  const respondedAt = new Date();
  const notifiedMs = o?.vendorNotifiedAt?.toMillis ? o.vendorNotifiedAt.toMillis()
    : o?.vendorNotifiedAt ? new Date(o.vendorNotifiedAt).getTime() : null;
  const responseTimeSecs = notifiedMs ? Math.round((respondedAt.getTime() - notifiedMs) / 1000) : null;
  await fsUpdate('orders', orderId, {
    status: 'rejected',
    rejectedAt: respondedAt,
    respondedAt,
    responseAction: 'rejected',
    responseTimeSecs,
  });
  toast('❌ تم رفض الطلب', 'success'); await render();
};

// --- Provider: add own service (pending_approval) ---
window.ph21_showProviderAddSvc = function() {
  const cats = AppData.catalogCats || [];
  openModal(`
    <div class="modal-header"><h2 class="modal-title">➕ اقتراح إضافة عنصر للكتالوج الموحد</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="ph46-modal-body-scroll" style="max-height: 75vh; overflow-y: auto; padding: 12px; direction: rtl; text-align: right; color: #ffffff;">
      <div class="form-group"><label class="form-label" style="font-weight:700">📂 التصنيف المقترح بالكتالوج *</label>
        <select class="form-control" id="psvc-cat">
          <option value="">-- اختر الفئة المقترحة --</option>
          ${cats.map(c=>`<option value="${c.id}">${c.icon||''} ${c.name} (${c.sectionId === 'bookings' ? 'خدمات' : c.sectionId === 'stores' ? 'منتجات' : 'تأجير'})</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label" style="font-weight:700">🏷️ الاسم المقترح للمنتج/الخدمة *</label><input class="form-control" id="psvc-name" placeholder="مثال: خدمة صيانة مكيفات سبليت"></div>
      <div class="form-group"><label class="form-label" style="font-weight:700">📝 الوصف التفصيلي *</label><textarea class="form-control" id="psvc-desc" rows="3" placeholder="اكتب تفاصيل الخدمة/المنتج، مواصفاتها وشروطها..."></textarea></div>
      <div class="form-group"><label class="form-label" style="font-weight:700">💰 السعر المقترح (ريال) *</label><input class="form-control" id="psvc-price" type="number" placeholder="0"></div>
      <div class="form-group"><label class="form-label" style="font-weight:700">🛠️ المشاكل/الأعطال الشائعة (واحد في كل سطر - للمهن والخدمات فقط)</label><textarea class="form-control" id="psvc-issues" rows="4" placeholder="مثال:&#10;ضعف التبريد&#10;تسريب غاز الفريون"></textarea></div>
      <div class="form-group"><label class="form-label" style="font-weight:700">📞 رقم الجوال للتواصل</label><input class="form-control" id="psvc-phone" type="tel"></div>
      <div class="form-group" style="margin-top:16px;">
        <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="psvc-delivery" checked style="width:20px;height:20px;">
          <span>يتطلب مندوب توصيل (أو زيارة ميدانية)</span>
        </label>
      </div>
      <button class="btn btn-primary btn-block btn-lg" style="margin-top:16px;" onclick="ph21_saveProviderSvc()">📝 تقديم مقترح الإضافة للمراجعة</button>
    </div>`);
};

window.ph21_saveProviderSvc = async function() {
  const u = State.currentUser;
  const catId = document.getElementById('psvc-cat').value;
  const name  = document.getElementById('psvc-name').value.trim();
  const desc  = document.getElementById('psvc-desc').value.trim();
  const price = parseInt(document.getElementById('psvc-price').value) || null;
  const phone = document.getElementById('psvc-phone').value.trim();
  const issues = document.getElementById('psvc-issues').value.trim().split('\n').filter(l=>l.trim());
  const requiresDelivery = document.getElementById('psvc-delivery') ? document.getElementById('psvc-delivery').checked : true;
  
  if (!catId) { toast('يرجى اختيار التصنيف المقترح', 'error'); return; }
  if (!name) { toast('يرجى كتابة الاسم المقترح للمنتج/الخدمة', 'error'); return; }
  if (!desc) { toast('يرجى كتابة الوصف التفصيلي', 'error'); return; }
  if (price === null || price <= 0) { toast('يرجى إدخال السعر المقترح الصحيح', 'error'); return; }

  const cat = (AppData.catalogCats || []).find(c => c.id === catId);
  const sectionId = cat ? cat.sectionId : 'bookings';

  showLoader();
  try {
    await fsAdd('product_catalog', {
      sectionId,
      catId,
      name,
      desc,
      price,
      phone,
      provider: u.name,
      providerUid: u.uid,
      providerName: u.name,
      commonProblems: sectionId === 'bookings' ? issues.join('\n') : null,
      requiresDriver: requiresDelivery,
      status: 'pending_approval',
      createdAt: new Date(),
      updatedAt: new Date(),
      linkedProviders: [u.uid]
    });
    
    await loadAllData();
    closeModal();
    toast('✅ تم تقديم مقترح الإضافة بنجاح للمراجعة والتدقيق الإداري', 'success');
    await render();
  } catch(e) {
    toast('حدث خطأ أثناء إرسال المقترح: ' + e.message, 'error');
  } finally {
    hideLoader();
  }
};

// --- Admin: client-side search filtering (avoids losing input focus) ---
window.filterAdminOrdersTable = function(query) {
  State.adminSearch = query;
  const lowercaseQuery = query.toLowerCase().trim();
  const table = document.querySelector('.admin-table');
  if (!table) return;

  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr:not(.no-results-row)');
  let visibleCount = 0;

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    if (text.includes(lowercaseQuery)) {
      row.style.display = '';
      visibleCount++;
    } else {
      row.style.display = 'none';
    }
  });

  // Handle empty state row
  let noResultsRow = tbody.querySelector('.no-results-row');
  if (visibleCount === 0) {
    if (!noResultsRow) {
      noResultsRow = document.createElement('tr');
      noResultsRow.className = 'no-results-row';
      noResultsRow.innerHTML = `
        <td colspan="8" style="text-align: center !important; padding: 30px !important; color: var(--text-muted);">
          لا توجد نتائج مطابقة للبحث "${query}"
        </td>
      `;
      tbody.appendChild(noResultsRow);
    } else {
      noResultsRow.style.display = '';
      noResultsRow.querySelector('td').textContent = `لا توجد نتائج مطابقة للبحث "${query}"`;
    }
  } else {
    if (noResultsRow) {
      noResultsRow.style.display = 'none';
    }
  }
};

// --- Admin: orders management tab ---
window.clearOldOrdersDb = async function() {
  try {
    if (typeof db === 'undefined') return "قاعدة البيانات غير متصلة.";
    const snap = await db.collection('orders').get();
    const docs = [];
    snap.forEach(doc => {
      docs.push({ id: doc.id, ...doc.data() });
    });
    if (docs.length === 0) return "لا توجد طلبات في قاعدة البيانات.";
    
    // Sort by createdAt descending
    docs.sort((a, b) => {
      const ta = (a.createdAt && a.createdAt.seconds) ? a.createdAt.seconds : (a.createdAt || 0);
      const tb = (b.createdAt && b.createdAt.seconds) ? b.createdAt.seconds : (b.createdAt || 0);
      return tb - ta;
    });

    const lastPendingAdmin = docs.find(o => o.status === 'pending_admin' || o.status === 'pending_final_admin');
    if (!lastPendingAdmin) {
      return "لم يتم العثور على أي طلب معلق بانتظار الإدارة للجروب.";
    }

    let deletedCount = 0;
    for (const o of docs) {
      if (o.id !== lastPendingAdmin.id) {
        await db.collection('orders').doc(o.id).delete();
        deletedCount++;
      }
    }
    return `تم مسح ${deletedCount} طلب والاحتفاظ بأحدث طلب معلق بانتظار الإدارة.`;
  } catch (err) {
    console.error("Error clearing orders:", err);
    return "حدث خطأ: " + err.message;
  }
};

window.renderAdminOrders = function() {
  const orders = AppData.orders || [];

  if (!State.adminOrdersTab) State.adminOrdersTab = 'all';
  const activeOrdersTab = State.adminOrdersTab;

  const statusLabel = {
    pending_admin:'بانتظار الإدارة',
    pending_provider:'عند المزود',
    pending_final_admin:'بانتظار الموافقة النهائية',
    pending_inspection:'بانتظار المعاينة',
    pending_agreement:'بانتظار الاتفاق',
    awaiting_payment:'بانتظار الدفع',
    approved:'مقبول',
    rejected:'مرفوض',
    completed:'مكتمل',
    cancelled:'ملغى',
    pending:'معلق',
    accepted:'مقبول'
  };

  const statusBadge = {
    pending_admin:'badge-gold',
    pending_provider:'badge-purple',
    pending_final_admin:'badge-gold',
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

  // Subdivisions
  const pendingStatuses = ['pending_admin', 'pending_provider', 'pending_final_admin', 'pending_inspection', 'pending_agreement', 'awaiting_payment', 'pending'];
  const acceptedStatuses = ['approved', 'accepted'];
  const completedStatuses = ['completed'];
  const cancelledRejectedStatuses = ['rejected', 'cancelled'];

  const pendingOrders = orders.filter(o => pendingStatuses.includes(o.status));
  const acceptedOrders = orders.filter(o => acceptedStatuses.includes(o.status));
  const completedOrders = orders.filter(o => completedStatuses.includes(o.status));
  const cancelledRejectedOrders = orders.filter(o => cancelledRejectedStatuses.includes(o.status));

  let filteredTabOrders = orders;
  if (activeOrdersTab === 'pending') filteredTabOrders = pendingOrders;
  else if (activeOrdersTab === 'accepted') filteredTabOrders = acceptedOrders;
  else if (activeOrdersTab === 'completed') filteredTabOrders = completedOrders;
  else if (activeOrdersTab === 'cancelled_rejected') filteredTabOrders = cancelledRejectedOrders;

  const searchQuery = (State.adminSearch || '').toLowerCase();
  const filterFn = o =>
    (o.orderId || o.id || '').toLowerCase().includes(searchQuery) ||
    (o.svcName || '').toLowerCase().includes(searchQuery) ||
    (o.userName || o.customerName || '').toLowerCase().includes(searchQuery) ||
    (o.providerName || o.vendorName || '').toLowerCase().includes(searchQuery) ||
    (o.status || '').toLowerCase().includes(searchQuery);

  const displayOrders = filteredTabOrders.filter(filterFn);

  // Helper to format createdAt date and time
  function formatCreatedAt(createdAt) {
    if (!createdAt) return { date: '—', time: '—', full: '—' };
    let dateObj = null;
    if (typeof createdAt.toDate === 'function') {
      dateObj = createdAt.toDate();
    } else if (createdAt.seconds) {
      dateObj = new Date(createdAt.seconds * 1000);
    } else {
      dateObj = new Date(createdAt);
    }
    if (!dateObj || isNaN(dateObj.getTime())) return { date: '—', time: '—', full: '—' };

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    let hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12;
    hours = hours ? hours : 12;
    
    const dateStr = `${year}/${month}/${day}`;
    const timeStr = `${hours}:${minutes} ${ampm}`;
    return {
      date: dateStr,
      time: timeStr,
      full: `${dateStr} - ${timeStr}`
    };
  }

  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Tajawal:wght@400;500;700;900&display=swap');
      
      .admin-orders-container, .orders-tab-switcher, .admin-table, .tab-btn {
        font-family: 'Outfit', 'Tajawal', sans-serif !important;
      }
      
      #app-content:has(.admin-orders-container) {
        max-width: 100% !important;
        width: 100% !important;
        padding: 24px 2% !important;
      }
      
      .admin-orders-container {
        max-width: 1400px;
        margin: 0 auto;
        width: 100%;
        padding: 8px 12px;
      }
      
      /* Glassmorphic Tab Switcher */
      .orders-tab-switcher {
        display: flex;
        background: rgba(30, 27, 75, 0.4);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 6px;
        margin-bottom: 24px;
        max-width: 100%;
        overflow-x: auto;
        gap: 8px;
        white-space: nowrap;
        scrollbar-width: none;
      }
      .orders-tab-switcher::-webkit-scrollbar {
        display: none;
      }
      .orders-tab-switcher .tab-btn {
        flex-shrink: 0;
        border: 0;
        padding: 10px 18px;
        border-radius: 12px;
        font-weight: 700;
        font-size: 13px;
        background: none;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .orders-tab-switcher .tab-btn.active {
        background: linear-gradient(135deg, #7c3aed, #4f46e5) !important;
        color: #fff !important;
        box-shadow: 0 4px 20px rgba(124, 58, 237, 0.35);
      }
      .orders-tab-switcher .tab-btn:hover:not(.active) {
        background: rgba(255, 255, 255, 0.06);
        color: var(--text-main);
      }
      .order-tab-badge {
        font-size: 11px;
        background: rgba(255, 255, 255, 0.12);
        color: inherit;
        padding: 2px 8px;
        border-radius: 20px;
        font-weight: 800;
      }
      .orders-tab-switcher .tab-btn.active .order-tab-badge {
        background: rgba(255, 255, 255, 0.25);
      }

      /* Premium Table Design */
      .table-wrap {
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25); 
        border-radius: 16px; 
        border: 1px solid rgba(255, 255, 255, 0.08); 
        overflow-x: auto; 
        background: rgba(26, 21, 44, 0.65);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        width: 100%;
        transition: border-color 0.3s;
      }
      .admin-table {
        width: 100% !important;
        border-collapse: collapse !important;
      }
      .admin-table th {
        background: rgba(15, 10, 30, 0.8) !important;
        color: var(--text-secondary) !important;
        font-weight: 700 !important;
        font-size: 13px !important;
        padding: 16px 20px !important;
        border-bottom: 2px solid rgba(255, 255, 255, 0.08) !important;
        text-align: right !important;
        white-space: nowrap !important;
      }
      .admin-table td {
        padding: 16px 20px !important;
        font-size: 13px !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
        vertical-align: middle !important;
        color: var(--text-main) !important;
        transition: background-color 0.2s;
      }
      .admin-table tbody tr {
        transition: background-color 0.2s ease;
      }
      .admin-table tbody tr:hover {
        background: rgba(255, 255, 255, 0.02) !important;
      }
      .admin-table tbody tr:last-child td {
        border-bottom: none !important;
      }
      
      /* Premium Badges */
      .badge {
        font-weight: 700;
        font-size: 11px;
        padding: 6px 12px;
        border-radius: 30px;
        display: inline-block;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }
      .badge-gold {
        background: rgba(245, 158, 11, 0.15) !important;
        color: #f59e0b !important;
        border: 1px solid rgba(245, 158, 11, 0.3) !important;
      }
      .badge-purple {
        background: rgba(139, 92, 246, 0.15) !important;
        color: #a78bfa !important;
        border: 1px solid rgba(139, 92, 246, 0.3) !important;
      }
      .badge-teal {
        background: rgba(20, 184, 166, 0.15) !important;
        color: #14b8a6 !important;
        border: 1px solid rgba(20, 184, 166, 0.3) !important;
      }
      .badge-rose {
        background: rgba(244, 63, 94, 0.15) !important;
        color: #fb7185 !important;
        border: 1px solid rgba(244, 63, 94, 0.3) !important;
      }

      /* Premium Buttons */
      .btn-action-row {
        display: flex;
        gap: 6px;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
      }
      .btn-action-row button {
        border-radius: 20px;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 700;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
      }
      .btn-action-row button:hover {
        transform: translateY(-1.5px);
        filter: brightness(1.1);
        box-shadow: 0 6px 14px rgba(0,0,0,0.18);
      }
      .btn-action-row button:active {
        transform: translateY(0);
      }
      
      .btn-details {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #fff;
      }
      .btn-pdf {
        background: linear-gradient(135deg, #7c3aed, #6d28d9);
        border: none;
        color: #fff;
      }
      .btn-send {
        background: linear-gradient(135deg, #0d9488, #0f766e);
        border: none;
        color: #fff;
      }
      .btn-approve {
        background: linear-gradient(135deg, #10b981, #059669);
        border: none;
        color: #fff;
      }
      .btn-reject {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        border: none;
        color: #fff;
      }

      /* Date Grid */
      .date-col-box {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .date-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--text-secondary);
      }
      .date-item.highlight {
        color: #a78bfa;
        font-weight: 700;
        background: rgba(139, 92, 246, 0.08);
        padding: 2px 8px;
        border-radius: 6px;
        display: inline-flex;
        border: 1px solid rgba(139, 92, 246, 0.15);
      }
    </style>

    <div class="admin-orders-container">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <h2 style="font-size:22px;font-weight:800;margin:0">إدارة الطلبات</h2>
          <p style="color:var(--text-muted);font-size:12px;margin:4px 0 0 0">تتبع وتنظيم حجوزات وطلبات العملاء بشكل مباشر وتلقائي</p>
        </div>
        <input type="text" class="form-control" id="admin-orders-search" placeholder="ابحث بالرقم أو الخدمة أو العميل..." value="${State.adminSearch || ''}" oninput="window.filterAdminOrdersTable(this.value)" style="width:280px; font-family:'Tajawal', sans-serif; font-size:12px">
      </div>

      <div class="orders-tab-switcher">
        <button class="tab-btn ${activeOrdersTab === 'all' ? 'active' : ''}" onclick="window.setAdminOrdersTab('all')">
          <span>الكل</span>
          <span class="order-tab-badge">${orders.length}</span>
        </button>
        <button class="tab-btn ${activeOrdersTab === 'pending' ? 'active' : ''}" onclick="window.setAdminOrdersTab('pending')">
          <span>المعلقة</span>
          <span class="order-tab-badge">${pendingOrders.length}</span>
        </button>
        <button class="tab-btn ${activeOrdersTab === 'accepted' ? 'active' : ''}" onclick="window.setAdminOrdersTab('accepted')">
          <span>المقبولة</span>
          <span class="order-tab-badge">${acceptedOrders.length}</span>
        </button>
        <button class="tab-btn ${activeOrdersTab === 'completed' ? 'active' : ''}" onclick="window.setAdminOrdersTab('completed')">
          <span>المكتملة</span>
          <span class="order-tab-badge">${completedOrders.length}</span>
        </button>
        <button class="tab-btn ${activeOrdersTab === 'cancelled_rejected' ? 'active' : ''}" onclick="window.setAdminOrdersTab('cancelled_rejected')">
          <span>الملغاة/المرفوضة</span>
          <span class="order-tab-badge">${cancelledRejectedOrders.length}</span>
        </button>
      </div>

      ${displayOrders.length ? `
        <div class="table-wrap">
          <table class="admin-table">
             <thead>
              <tr>
                <th style="width: 100px; min-width: 90px;">رقم الطلب</th>
                <th style="min-width: 160px;">الخدمة</th>
                <th style="min-width: 130px;">العميل</th>
                <th style="min-width: 130px;">المزود / المهنة</th>
                <th style="min-width: 130px;">التفاصيل المالية</th>
                <th style="min-width: 170px;">تاريخ ووقت تقديم الطلب</th>
                <th style="width: 110px; min-width: 110px;">الحالة</th>
                <th style="text-align: center !important; min-width: 260px;">إجراءات العمل</th>
              </tr>
            </thead>
            <tbody>
              ${displayOrders.map(o => {
                const createdTimeInfo = formatCreatedAt(o.createdAt);
                return `
                <tr>
                  <td>
                    <span style="font-family:monospace;font-weight:700;color:var(--text-muted);white-space:nowrap">#${o.orderId || o.id.substring(0, 8)}</span>
                  </td>
                  <td style="white-space: normal !important;">
                    <div style="display:flex;align-items:center;gap:6px">
                      <span style="font-weight:700">${escHtml(o.svcName || '—')}</span>
                    </div>
                  </td>
                  <td>
                    <div style="font-weight:600">${escHtml(o.userName || o.customerName || '—')}</div>
                  </td>
                  <td>
                    <div style="font-weight:500">${escHtml(o.providerName || o.vendorName || '—')}</div>
                  </td>
                  <td>
                    <div style="font-weight:800;color:#10b981;font-size:13px;white-space:nowrap">
                      ${o.finalPrice ? o.finalPrice.toLocaleString('ar-YE') + ' ريال' : (o.total ? o.total.toLocaleString('ar-YE') + ' ريال' : '—')}
                    </div>
                    <div style="font-size:10px;color:var(--text-secondary);margin-top:2px;white-space:nowrap">
                      ${o.paymentMethod === 'wallet' ? 'المحفظة' : o.paymentMethod === 'cod' ? 'عند الاستلام' : o.paymentMethod || '—'}
                    </div>
                  </td>
                  <td>
                    <div class="date-col-box">
                      <div class="date-item" title="تاريخ تقديم الطلب">
                        <span>${createdTimeInfo.date}</span>
                        <span style="opacity: 0.6; margin-right: 4px;">(${createdTimeInfo.time})</span>
                      </div>
                      ${o.date ? `
                      <div class="date-item highlight" title="موعد الحجز المحدد">
                        <span>${o.date} ${o.time || ''}</span>
                      </div>
                      ` : ''}
                    </div>
                  </td>
                  <td>
                    <span class="badge ${statusBadge[o.status] || 'badge-purple'}" style="white-space:nowrap">${statusLabel[o.status] || o.status}</span>
                  </td>
                  <td>
                    <div class="btn-action-row">
                      <button class="btn btn-sm btn-details" onclick="showOrderDetails('${o.id}')" title="عرض التفاصيل">👁️ تفاصيل</button>
                      <button class="btn btn-sm btn-pdf" onclick="ph6_generateInvoice('${o.id}')" title="تحميل فاتورة PDF">📄 PDF</button>
                      <button class="btn btn-sm btn-send" onclick="ph7_showSendDialog('${o.id}')" title="إرسال الفاتورة">💬 إرسال</button>
                      
                      ${o.status === 'pending_admin' ? `
                        <button class="btn btn-sm btn-approve" onclick="ph43_approveAndAutoRoute('${o.id}')">✅ موافقة وتوجيه</button>
                        <button class="btn btn-sm btn-reject" onclick="ph21_adminReject('${o.id}')">❌ رفض</button>
                      ` : o.status === 'pending_final_admin' ? `
                        <button class="btn btn-sm btn-approve" onclick="ph43_adminFinalApprove('${o.id}')">✅ موافقة نهائية</button>
                        <button class="btn btn-sm btn-reject" onclick="ph21_adminReject('${o.id}')">❌ رفض</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="empty-state" style="background:var(--bg-card);border:1px dashed var(--border);border-radius:14px;padding:40px;text-align:center;color:var(--text-muted)">
          <div class="empty-icon" style="font-size:40px;margin-bottom:12px">📦</div>
          <div class="empty-title" style="font-weight:700;font-size:14px">لا توجد طلبات في هذا القسم حالياً</div>
        </div>
      `}
    </div>
  `;
};;

// --- Admin: pending provider services ---
window.renderAdminPendingSvcs = function() {
  const svcs = (AppData.services || []).filter(s => s.status === 'pending_approval');
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <h2 style="font-size:24px;font-weight:800">🔔 خدمات بانتظار الموافقة <span class="badge badge-gold">${svcs.length}</span></h2>
    </div>
    ${svcs.length ? `<div class="table-wrap"><table class="admin-table">
      <thead><tr><th>الخدمة</th><th>المزود</th><th>السعر</th><th>إجراء</th></tr></thead>
      <tbody>${svcs.map(s => `<tr>
        <td>${s.name}</td>
        <td>${s.providerName||'—'}</td>
        <td>${s.price ? s.price.toLocaleString('ar-YE')+' ريال' : '—'}</td>
        <td>
          <button class="btn btn-sm btn-success" onclick="ph21_approveProviderSvc('${s.id}')">✅ قبول</button>
          <button class="btn btn-sm btn-danger" onclick="ph21_rejectProviderSvc('${s.id}')" style="margin-top:4px">❌ رفض</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">لا توجد خدمات بانتظار الموافقة</div></div>'}`;
};

window.ph21_adminApprove = async function(orderId) {
  await fsUpdate('orders', orderId, { status: 'pending_provider', adminApprovedAt: firebase.firestore.FieldValue.serverTimestamp() });
  toast('✅ تم تأكيد الطلب وإرساله للمزود', 'success'); await render();
};
window.ph21_adminReject = async function(orderId) {
  await fsUpdate('orders', orderId, { status: 'rejected', adminRejectedAt: firebase.firestore.FieldValue.serverTimestamp() });
  toast('❌ تم رفض الطلب', 'success'); await render();
};
window.ph21_approveProviderSvc = async function(svcId) {
  await fsUpdate('services', svcId, { status: 'active' });
  toast('✅ تمت الموافقة على الخدمة', 'success'); await render();
};
window.ph21_rejectProviderSvc = async function(svcId) {
  await fsUpdate('services', svcId, { status: 'rejected' });
  toast('❌ تم رفض الخدمة', 'success'); await render();
};

// --- Professions Agreement System ---
window.ph_openProfessionAgreement = function(orderId) {
  const o = AppData.orders.find(x => x.id === orderId);
  if (!o) return;
  const u = State.currentUser;
  const isProvider = u.uid === o.providerUid;
  const myTerms = isProvider ? o.providerTerms : o.customerTerms;
  const otherTerms = isProvider ? o.customerTerms : o.providerTerms;

  openModal(`
    <div class="modal-header"><h2 class="modal-title">📝 اتفاقية العمل</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="background:var(--bg-secondary);padding:16px;border-radius:12px;margin-bottom:20px">
      <div style="font-size:14px;color:var(--text-muted);margin-bottom:8px">حالة الاتفاق الحالي:</div>
      <div style="display:flex;gap:10px">
        <span class="badge ${o.providerTerms ? 'badge-teal' : 'badge-gold'}">${o.providerTerms ? '✅ المزود حدد شروطه' : '⏳ المزود لم يحدد'}</span>
        <span class="badge ${o.customerTerms ? 'badge-teal' : 'badge-gold'}">${o.customerTerms ? '✅ العميل حدد شروطه' : '⏳ العميل لم يحدد'}</span>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">💰 المبلغ المتفق عليه (ريال)</label>
      <input class="form-control" id="agr-price" type="number" value="${myTerms?.price || ''}" placeholder="مثال: 500">
    </div>
    <div class="form-group">
      <label class="form-label">⏳ مدة العمل المتفق عليها</label>
      <select class="form-control" id="agr-duration">
        <option value="6h" ${myTerms?.duration==='6h'?'selected':''}>6 ساعات</option>
        <option value="12h" ${myTerms?.duration==='12h'?'selected':''}>12 ساعة</option>
        <option value="1d" ${myTerms?.duration==='1d'?'selected':''}>يوم واحد</option>
        <option value="3d" ${myTerms?.duration==='3d'?'selected':''}>3 أيام</option>
        <option value="1w" ${myTerms?.duration==='1w'?'selected':''}>أسبوع</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">📝 تفاصيل العمل (لضمان الحقوق)</label>
      <textarea class="form-control" id="agr-desc" rows="4" placeholder="اكتب ما تم الاتفاق عليه بدقة...">${myTerms?.desc || ''}</textarea>
    </div>

    ${otherTerms ? `
      <div style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.2);padding:12px;border-radius:8px;margin-bottom:16px;font-size:13px">
        <strong>💡 ملاحظة من الطرف الآخر:</strong><br>
        السعر المقترح: ${otherTerms.price} ريال<br>
        المدة: ${otherTerms.duration}
      </div>
    ` : ''}

    <button class="btn btn-primary btn-block btn-lg" onclick="ph_submitAgreement('${orderId}')">✅ تأكيد وحفظ الشروط</button>
  `);
};

window.ph_submitAgreement = async function(orderId) {
  const price = parseFloat(document.getElementById('agr-price').value);
  const duration = document.getElementById('agr-duration').value;
  const desc = document.getElementById('agr-desc').value.trim();

  if (!price || !desc) { toast('يرجى إكمال جميع البيانات', 'error'); return; }

  const o = AppData.orders.find(x => x.id === orderId);
  const u = State.currentUser;
  const isProvider = u.uid === o.providerUid;

  const terms = { price, duration, desc, at: new Date() };
  const updateData = isProvider ? { providerTerms: terms } : { customerTerms: terms };
  
  // If first time submitting, change status to pending_agreement
  if (o.status === 'pending_inspection') updateData.status = 'pending_agreement';

  await fsUpdate('orders', orderId, updateData);
  toast('✅ تم حفظ شروطك، بانتظار الطرف الآخر', 'success');
  
  // Check if they match now
  await ph_checkAgreementMatch(orderId);
  
  closeModal();
  await render();
};

window.ph_checkAgreementMatch = async function(orderId) {
  // Re-fetch order to get latest terms
  const allOrders = await fsGetAll('orders');
  const o = allOrders.find(x => x.id === orderId);
  if (!o || !o.providerTerms || !o.customerTerms) return;

  // Logic: They match if price is the same (and maybe duration)
  if (o.providerTerms.price === o.customerTerms.price) {
    await fsUpdate('orders', orderId, {
      status: 'awaiting_payment',
      finalPrice: o.providerTerms.price,
      agreedDuration: o.providerTerms.duration,
      agreedDesc: o.providerTerms.desc, // We take provider desc as primary or merge? Let's take provider as it's the "offer"
      matchedAt: new Date()
    });
    toast('🎊 مبروك! تم الاتفاق بنجاح. العميل يمكنه الدفع الآن', 'success');
  } else {
    toast('⚠️ تنبيه: المبالغ المدخلة من الطرفين غير متطابقة', 'warning');
  }
};

window.ph_payProfessionOrder = function(orderId) {
  const o = AppData.orders.find(x => x.id === orderId);
  if (!o) return;
  const u = State.currentUser;
  
  // Prepare order details for showDynamicPaymentModal
  const orderDetails = {
    svcId: o.svcId,
    orderId: o.orderId,
    total: o.finalPrice, // This is the agreed price
    deliveryFee: 0, // Assuming it's included or not applicable for local service
    s: { name: o.svcName, icon: o.svcIcon },
    u: u,
    addr: o.customerAddr,
    date: o.date,
    time: o.time,
    isExistingOrder: true,
    dbOrderId: o.id
  };

  if (typeof showDynamicPaymentModal === 'function') {
    showDynamicPaymentModal(orderDetails);
  } else {
    toast('نظام الدفع غير متاح حالياً', 'error');
  }
};

// --- Also add price input listener on page load ---
document.addEventListener('change', function(e) {
  if (e.target && e.target.id === 'svc-price') ph21_updateFinalPrice && ph21_updateFinalPrice();
});
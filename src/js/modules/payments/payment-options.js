// ═══════════════════════════════════════════════════════
//  محجوز v2.2 — Phase 20: Dynamic Payments & Delivery Fees
// ═══════════════════════════════════════════════════════
'use strict';

// ─── INIT DATA ─────────────────────────────────────────
if (typeof AppData !== 'undefined') {
  if (!AppData.paymentMethods) {
    AppData.paymentMethods = [
      { id: 'wallet', name: 'المحفظة', icon: '💰', active: true, type: 'wallet' },
      { id: 'cod', name: 'دفع عند الاستلام', icon: '💵', active: true, type: 'cod' },
      { id: 'bank_transfer', name: 'إيداع بنكي', icon: '🏦', active: true, type: 'bank_transfer', note: 'يرجى إرفاق إيصال التحويل لإكمال الطلب' }
    ];
  }
  if (!AppData.bankDeposits) AppData.bankDeposits = [];
  if (!AppData.platformSettings) AppData.platformSettings = { deliveryFee: 15 };
}

// ─── DATA LOADER OVERRIDE ──────────────────────────────
const __ph20_originalLoadAllData = window.loadAllData;
window.loadAllData = async function() {
  if (__ph20_originalLoadAllData) await __ph20_originalLoadAllData.apply(this, arguments);
  
  const safe = async (col) => {
    try {
      return await Promise.race([
        fsGetAll(col),
        new Promise(r => setTimeout(()=>r([]), 4500)),
      ]);
    } catch(e) { return []; }
  };
  
  const [methods, deposits, settings] = await Promise.all([
    safe('payment_methods'),
    safe('bank_deposits'),
    safe('platform_settings')
  ]);
  
  // Initialize default payment methods if empty
  if (methods.length === 0) {
    const defaults = [
      { id: 'wallet', name: 'المحفظة', icon: '💰', active: true, type: 'wallet', createdAt: new Date() },
      { id: 'cod', name: 'دفع عند الاستلام', icon: '💵', active: true, type: 'cod', createdAt: new Date() },
      { id: 'bank_transfer', name: 'إيداع بنكي', icon: '🏦', active: true, type: 'bank_transfer', note: 'يرجى إرفاق الإيصال', createdAt: new Date() }
    ];
    for (let d of defaults) {
      await fsSet('payment_methods', d.id, d);
      methods.push(d);
    }
  }
  
  AppData.paymentMethods = methods;
  AppData.bankDeposits = deposits;
  
  // Platform settings are stored as a single document 'main'
  const mainSetting = settings.find(s => s.id === 'main');
  if (mainSetting) {
    AppData.platformSettings = mainSetting;
  } else {
    await fsSet('platform_settings', 'main', { deliveryFee: 15 });
    AppData.platformSettings = { deliveryFee: 15 };
  }
};


// ── Finance & Settings tabs moved to Master Router (phase26.js) ──



// ─── ADMIN: PLATFORM SETTINGS ──────────────────────────
function renderAdminPlatformSettings() {
  const fee             = AppData.platformSettings?.deliveryFee          || 15;
  const waNum           = AppData.platformSettings?.whatsappNumber        || '';
  const waBookings      = AppData.platformSettings?.whatsappNumberBookings || '';
  const waServices      = AppData.platformSettings?.whatsappNumberServices || '';
  const waStores        = AppData.platformSettings?.whatsappNumberStores   || '';
  const waDigital       = AppData.platformSettings?.whatsappNumberDigital  || '';
  const walletThreshold = AppData.platformSettings?.walletAlertThreshold  ?? 500;
  const purchaseThresh  = AppData.platformSettings?.purchaseAlertThreshold ?? 1000;
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <h2>⚙️ الإعدادات العامة للمنصة</h2>
    </div>

    <!-- ═══ واتساب الاستفسار ═══ -->
    <div class="settings-card" style="max-width:600px;margin-bottom:20px;border:1.5px solid rgba(37,211,102,0.25);background:rgba(37,211,102,0.04)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="width:40px;height:40px;border-radius:12px;background:#25d36618;display:flex;align-items:center;justify-content:center;font-size:22px">💬</div>
        <div>
          <h3 style="margin:0 0 2px;font-size:16px">أرقام واتساب الاستفسار للأقسام</h3>
          <p style="margin:0;color:var(--text-secondary);font-size:13px">تخصيص أرقام تواصل واتساب مختلفة لكل قسم من أقسام المنصة</p>
        </div>
      </div>
      
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">الرقم الافتراضي / الدعم الفني العام (مع رمز الدولة، بدون +)</label>
        <input class="form-control" id="adm-wa-number" type="tel" placeholder="مثال: 9677XXXXXXXX" value="${escAttr(waNum)}" style="direction:ltr;text-align:left;font-family:monospace;letter-spacing:0.5px">
      </div>

      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">رقم واتساب قسم الحجوزات 📅</label>
        <input class="form-control" id="adm-wa-bookings" type="tel" placeholder="مثال: 9677XXXXXXXX" value="${escAttr(waBookings)}" style="direction:ltr;text-align:left;font-family:monospace;letter-spacing:0.5px">
      </div>

      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">رقم واتساب قسم الخدمات المهنية 🔧</label>
        <input class="form-control" id="adm-wa-services" type="tel" placeholder="مثال: 9677XXXXXXXX" value="${escAttr(waServices)}" style="direction:ltr;text-align:left;font-family:monospace;letter-spacing:0.5px">
      </div>

      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">رقم واتساب قسم المتاجر المحلية 🏪</label>
        <input class="form-control" id="adm-wa-stores" type="tel" placeholder="مثال: 9677XXXXXXXX" value="${escAttr(waStores)}" style="direction:ltr;text-align:left;font-family:monospace;letter-spacing:0.5px">
      </div>

      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">رقم واتساب قسم المتاجر الرقمية ⚡</label>
        <input class="form-control" id="adm-wa-digital" type="tel" placeholder="مثال: 9677XXXXXXXX" value="${escAttr(waDigital)}" style="direction:ltr;text-align:left;font-family:monospace;letter-spacing:0.5px">
      </div>

      <button class="btn btn-primary btn-block" style="background:#25d366;color:#fff;border:none" onclick="savePlatformSettings()">💾 حفظ أرقام الواتساب</button>
    </div>

    <!-- ═══ رسوم التوصيل ═══ -->
    <div class="settings-card" style="max-width:600px;margin-bottom:20px;">
      <h3 style="margin-bottom:16px">رسوم التوصيل</h3>
      <p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px">
        تعيين رسوم التوصيل الافتراضية التي سيتم إضافتها على طلبات الخدمات والمنتجات.
      </p>
      <div class="form-group">
        <label class="form-label">مبلغ رسوم التوصيل (ريال)</label>
        <input class="form-control" id="adm-delivery-fee" type="number" min="0" value="${fee}">
      </div>
      <button class="btn btn-primary" onclick="savePlatformSettings()">حفظ الإعدادات</button>
    </div>

    <!-- ═══ حدود التنبيهات المالية ═══ -->
    <div class="settings-card" style="max-width:600px;border:1.5px solid rgba(124,58,237,0.3);background:rgba(124,58,237,0.04)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
        <div style="width:40px;height:40px;border-radius:12px;background:rgba(124,58,237,0.15);display:flex;align-items:center;justify-content:center;font-size:22px">🔔</div>
        <div>
          <h3 style="margin:0 0 2px;font-size:16px">حدود التنبيهات المالية</h3>
          <p style="margin:0;color:var(--text-secondary);font-size:13px">يتلقى المدير إشعاراً فورياً عند تجاوز أي عملية للحد المحدد</p>
        </div>
      </div>
      <div style="height:1px;background:var(--border);margin:14px 0"></div>

      <!-- حد عمليات المحفظة الإدارية -->
      <div class="form-group" style="margin-bottom:18px">
        <label class="form-label" style="display:flex;align-items:center;gap:6px">
          💰 حد تنبيه عمليات المحفظة (إضافة / خصم / تعيين)
        </label>
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 8px">
          يُنبّه عند قيام المدير أو الموظف بعملية محفظة تتجاوز هذا المبلغ
        </p>
        <div style="display:flex;gap:10px;align-items:center">
          <input class="form-control" id="adm-wallet-alert-threshold" type="number" min="1"
            value="${walletThreshold}"
            placeholder="500"
            style="flex:1;max-width:220px">
          <span style="font-size:13px;color:var(--text-muted);white-space:nowrap">ريال يمني</span>
        </div>
        <div style="margin-top:6px;font-size:12px;color:rgba(124,58,237,0.8)">
          ⚡ الإعداد الحالي: كل عملية ≥ <strong>${walletThreshold.toLocaleString('ar-YE')} ر.ي</strong> تُولّد تنبيهاً
        </div>
      </div>

      <!-- حد عمليات الشراء والإيداعات -->
      <div class="form-group" style="margin-bottom:18px">
        <label class="form-label" style="display:flex;align-items:center;gap:6px">
          🏦 حد تنبيه الشراء والإيداعات البنكية
        </label>
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 8px">
          يُنبّه عند استلام إيداع بنكي أو عملية شراء من عميل تتجاوز هذا المبلغ
        </p>
        <div style="display:flex;gap:10px;align-items:center">
          <input class="form-control" id="adm-purchase-alert-threshold" type="number" min="1"
            value="${purchaseThresh}"
            placeholder="1000"
            style="flex:1;max-width:220px">
          <span style="font-size:13px;color:var(--text-muted);white-space:nowrap">ريال يمني</span>
        </div>
        <div style="margin-top:6px;font-size:12px;color:rgba(16,185,129,0.8)">
          ⚡ الإعداد الحالي: كل إيداع ≥ <strong>${purchaseThresh.toLocaleString('ar-YE')} ر.ي</strong> يُولّد تنبيهاً
        </div>
      </div>

      <button class="btn btn-primary" onclick="savePlatformSettings()" style="background:linear-gradient(135deg,#7c3aed,#5b21b6);border:none">
        💾 حفظ حدود التنبيهات
      </button>
    </div>
  `;
}
window.renderPh17Settings = renderAdminPlatformSettings;

window.savePlatformSettings = async function() {
  const fee             = parseFloat(document.getElementById('adm-delivery-fee')?.value || '15');
  const waRaw           = (document.getElementById('adm-wa-number')?.value || '').trim();
  const waNum           = waRaw.replace(/\D/g, '');
  const waBookingsRaw   = (document.getElementById('adm-wa-bookings')?.value || '').trim();
  const waBookings      = waBookingsRaw.replace(/\D/g, '');
  const waServicesRaw   = (document.getElementById('adm-wa-services')?.value || '').trim();
  const waServices      = waServicesRaw.replace(/\D/g, '');
  const waStoresRaw     = (document.getElementById('adm-wa-stores')?.value || '').trim();
  const waStores        = waStoresRaw.replace(/\D/g, '');
  const waDigitalRaw    = (document.getElementById('adm-wa-digital')?.value || '').trim();
  const waDigital       = waDigitalRaw.replace(/\D/g, '');

  const walletThreshold = parseFloat(document.getElementById('adm-wallet-alert-threshold')?.value || '500');
  const purchaseThresh  = parseFloat(document.getElementById('adm-purchase-alert-threshold')?.value || '1000');

  if (isNaN(fee) || fee < 0)             { toast('يرجى إدخال مبلغ رسوم توصيل صحيح', 'error'); return; }
  if (waRaw && waNum.length < 7)         { toast('رقم الواتساب الافتراضي قصير جداً، تأكد من إدخاله مع رمز الدولة', 'error'); return; }
  if (waBookingsRaw && waBookings.length < 7) { toast('رقم واتساب قسم الحجوزات قصير جداً، تأكد من إدخاله مع رمز الدولة', 'error'); return; }
  if (waServicesRaw && waServices.length < 7) { toast('رقم واتساب قسم الخدمات المهنية قصير جداً، تأكد من إدخاله مع رمز الدولة', 'error'); return; }
  if (waStoresRaw && waStores.length < 7)     { toast('رقم واتساب قسم المتاجر المحلية قصير جداً، تأكد من إدخاله مع رمز الدولة', 'error'); return; }
  if (waDigitalRaw && waDigital.length < 7)   { toast('رقم واتساب قسم المتاجر الرقمية قصير جداً، تأكد من إدخاله مع رمز الدولة', 'error'); return; }

  if (isNaN(walletThreshold) || walletThreshold < 1) { toast('يرجى إدخال حد تنبيه محفظة صحيح (1 على الأقل)', 'error'); return; }
  if (isNaN(purchaseThresh)  || purchaseThresh  < 1) { toast('يرجى إدخال حد تنبيه شراء صحيح (1 على الأقل)', 'error'); return; }

  const updates = {
    deliveryFee:           fee,
    whatsappNumber:        waNum,
    whatsappNumberBookings: waBookings,
    whatsappNumberServices: waServices,
    whatsappNumberStores:   waStores,
    whatsappNumberDigital:  waDigital,
    walletAlertThreshold:  walletThreshold,
    purchaseAlertThreshold: purchaseThresh,
  };
  await fsUpdate('platform_settings', 'main', updates);
  AppData.platformSettings = { ...(AppData.platformSettings || {}), ...updates };

  /* إعادة تهيئة مراقبات الإشعارات بالحدود الجديدة */
  if (typeof window.wsecReloadThresholds === 'function') {
    window.wsecReloadThresholds(walletThreshold, purchaseThresh);
  }

  toast('✅ تم حفظ الإعدادات بنجاح', 'success');
  await render();
}

// ─── ADMIN: PAYMENT METHODS ───────────────────────────
function renderAdminPaymentMethods() {
  const methods = AppData.paymentMethods || [];
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <h2>💳 إدارة طرق الدفع</h2>
      <button class="btn btn-primary" onclick="showAddPaymentMethodModal()">➕ إضافة طريقة دفع</button>
    </div>
    <div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>الأيقونة</th><th>الاسم</th><th>النوع</th><th>الحالة</th><th>إجراءات</th></tr></thead>
        <tbody>
          ${methods.map(m => `
            <tr>
              <td style="font-size:24px">${m.icon||'💳'}</td>
              <td style="font-weight:600">${m.name}</td>
              <td><span class="badge badge-purple">${m.type}</span></td>
              <td><span class="badge ${m.active?'badge-teal':'badge-rose'}">${m.active?'مفعل':'معطل'}</span></td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="showEditPaymentMethodModal('${m.id}')">✏️ تعديل</button>
                <button class="btn btn-sm ${m.active?'btn-warning':'btn-success'}" onclick="togglePaymentMethod('${m.id}')">${m.active?'⏸️ إيقاف':'▶️ تفعيل'}</button>
                <button class="btn btn-sm btn-danger" onclick="deletePaymentMethod('${m.id}')">🗑️ حذف</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

window.showAddPaymentMethodModal = function() {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">➕ إضافة طريقة دفع</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group">
      <label class="form-label">اسم طريقة الدفع</label>
      <input class="form-control" id="pm-name" placeholder="مثال: حوالة كريمي">
    </div>
    <div class="form-group">
      <label class="form-label">الأيقونة (ايموجي)</label>
      <input class="form-control" id="pm-icon" placeholder="💳" value="💳">
    </div>
    <div class="form-group">
      <label class="form-label">نوع الدفع</label>
      <select class="form-control" id="pm-type">
        <option value="bank_transfer">إيداع / حوالة</option>
        <option value="cod">عند الاستلام</option>
        <option value="wallet">محفظة رقمية</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">ملاحظات تظهر للعميل (للمدير فقط)</label>
      <textarea class="form-control" id="pm-note" rows="2" placeholder="اكتب تعليمات للعميل مثل: يرجى التحويل ثم إرفاق السند"></textarea>
    </div>
    <button class="btn btn-primary btn-block" onclick="saveNewPaymentMethod()">حفظ</button>
  `);
}

window.saveNewPaymentMethod = async function() {
  const name = document.getElementById('pm-name').value.trim();
  const icon = document.getElementById('pm-icon').value.trim();
  const type = document.getElementById('pm-type').value;
  const note = document.getElementById('pm-note').value.trim();
  
  if (!name) { toast('الاسم مطلوب', 'error'); return; }
  
  await fsAdd('payment_methods', { name, icon, type, note, active: true, createdAt: new Date() });
  closeModal(); toast('تم الإضافة بنجاح', 'success'); await loadAllData(); await render();
}

window.showEditPaymentMethodModal = function(id) {
  const m = AppData.paymentMethods.find(x => x.id === id);
  if (!m) return;
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ تعديل طريقة الدفع</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group">
      <label class="form-label">الاسم</label>
      <input class="form-control" id="pm-name" value="${m.name||''}">
    </div>
    <div class="form-group">
      <label class="form-label">الأيقونة</label>
      <input class="form-control" id="pm-icon" value="${m.icon||''}">
    </div>
    <div class="form-group">
      <label class="form-label">ملاحظات تظهر للعميل</label>
      <textarea class="form-control" id="pm-note" rows="2">${m.note||''}</textarea>
    </div>
    <button class="btn btn-primary btn-block" onclick="updatePaymentMethod('${m.id}')">حفظ التعديلات</button>
  `);
}

window.updatePaymentMethod = async function(id) {
  const name = document.getElementById('pm-name').value.trim();
  const icon = document.getElementById('pm-icon').value.trim();
  const note = document.getElementById('pm-note').value.trim();
  if (!name) return;
  await fsUpdate('payment_methods', id, { name, icon, note });
  closeModal(); toast('تم التحديث بنجاح', 'success'); await loadAllData(); await render();
}

window.togglePaymentMethod = async function(id) {
  const m = AppData.paymentMethods.find(x => x.id === id);
  await fsUpdate('payment_methods', id, { active: !m.active });
  await loadAllData(); await render();
}

window.deletePaymentMethod = async function(id) {
  if (!confirm('هل أنت متأكد من حذف طريقة الدفع هذه؟')) return;
  await fsDelete('payment_methods', id);
  toast('تم الحذف بنجاح', 'success'); await loadAllData(); await render();
}


// ─── ADMIN: BANK DEPOSITS ─────────────────────────────
function renderAdminBankDeposits() {
  const deposits = (AppData.bankDeposits || []).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <h2>🏦 الإيداعات البنكية (طلبات الدفع)</h2>
    </div>
    ${deposits.length ? `<div class="table-wrap"><table class="admin-table">
      <thead><tr><th>رقم الطلب</th><th>العميل</th><th>المبلغ</th><th>الحساب المحول إليه</th><th>التاريخ</th><th>الحالة</th><th>إجراءات</th></tr></thead>
      <tbody>${deposits.map(d=>`<tr>
        <td style="font-weight:700">${d.orderId}</td>
        <td>${d.customerName}</td>
        <td style="font-weight:700;color:var(--primary)">${d.amount} ريال</td>
        <td>${d.bankName||'—'}</td>
        <td>${fmtDate(d.createdAt)}</td>
        <td>
          ${d.status==='pending' ? '<span class="badge badge-gold">⏳ بانتظار المراجعة</span>' : 
            d.status==='approved' ? '<span class="badge badge-teal">✅ تم القبول</span>' : 
            '<span class="badge badge-rose">❌ مرفوض</span>'}
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="viewDepositDetails('${d.id}')">👁️ عرض التفاصيل</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>` : `<div class="empty-state"><div class="empty-icon">🏦</div><div class="empty-title">لا يوجد إيداعات حالياً</div></div>`}
  `;
}

window.viewDepositDetails = function(id) {
  const d = AppData.bankDeposits.find(x => x.id === id);
  if (!d) return;
  
  openModal(`
    <div class="modal-header"><h2 class="modal-title">تفاصيل الإيداع</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px;margin-bottom:16px">
      <div class="info-row"><span>رقم الطلب المرتبط</span><strong>${d.orderId}</strong></div>
      <div class="info-row"><span>المبلغ</span><strong style="color:var(--primary);font-size:18px">${d.amount} ريال</strong></div>
      <div class="info-row"><span>الحساب البنكي</span><strong>${d.bankName}</strong></div>
      <div class="info-row"><span>ملاحظات العميل</span><strong>${d.customerNote||'لا يوجد'}</strong></div>
      <div class="info-row"><span>تاريخ الإرسال</span><strong>${fmtDateTime(d.createdAt)}</strong></div>
    </div>
    
    ${d.receiptBase64 ? `
      <div style="margin-bottom:16px">
        <label class="form-label">صورة إيصال التحويل:</label>
        <img src="${d.receiptBase64}" style="width:100%;border-radius:8px;border:1px solid var(--border)">
      </div>
    ` : '<div class="empty-state" style="padding:20px;margin-bottom:16px">لا يوجد إيصال مرفق</div>'}
    
    ${d.status === 'pending' ? `
      <div style="display:flex;gap:12px;margin-top:20px">
        <button class="btn btn-success" style="flex:1" onclick="approveDeposit('${d.id}', '${d.orderId}')">✅ الموافقة وتأكيد الطلب</button>
        <button class="btn btn-danger" style="flex:1" onclick="rejectDeposit('${d.id}')">❌ رفض الإيداع</button>
      </div>
    ` : ''}
  `);
}

window.approveDeposit = async function(depositId, orderId) {
  if (!confirm('هل أنت متأكد من الموافقة على هذا الإيداع وتأكيد الطلب؟')) return;
  showLoader('جاري التأكيد...');

  try {
    const deposit = AppData.bankDeposits.find(d => d.id === depositId);

    await fsUpdate('bank_deposits', depositId, {
      status: 'approved',
      approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      approvedBy: State.currentUser?.displayName || State.currentUser?.name || State.currentUser?.email || 'الإدارة',
    });

    const orderRef = AppData.orders?.find(o => o.orderId === orderId);
    if (orderRef) {
      await fsUpdate('orders', orderRef.id, { paymentStatus: 'paid', status: 'accepted' });
    }

    /* ── إشعار الـ Firestore للعميل ── */
    const customerId = deposit?.customerId || orderRef?.customerId;
    if (customerId && typeof saveNotificationToFirestore === 'function') {
      await saveNotificationToFirestore(customerId, {
        title: '✅ تم قبول إيداعك وتأكيد طلبك!',
        body:  `إيداعك بمبلغ ${(deposit?.amount || 0).toLocaleString('ar-YE')} ر.ي تم استلامه والموافقة عليه. رقم الطلب: ${orderId}`,
        type:  'deposit_approved',
        icon:  '✅',
        data:  {
          depositId,
          orderId,
          amount:   deposit?.amount || 0,
          bankName: deposit?.bankName || '',
        },
      });
    }

    /* ── توست محلي في حال كان الأدمن وعميل واحد ── */
    if (typeof notificationManager !== 'undefined') {
      notificationManager.showNotification('✅ تم قبول الإيداع', {
        body: `إيداع بمبلغ ${(deposit?.amount || 0).toLocaleString('ar-YE')} ر.ي — رقم الطلب: ${orderId}`,
      });
    }

    toast('✅ تم اعتماد الإيداع وإشعار العميل بنجاح', 'success');
    closeModal();
    await loadAllData();
    await render();
  } catch(e) {
    console.error('[approveDeposit]', e);
    toast('حدث خطأ أثناء اعتماد الإيداع', 'error');
  } finally {
    hideLoader?.();
  }
};

window.rejectDeposit = async function(depositId) {
  const deposit = AppData.bankDeposits?.find(d => d.id === depositId);

  /* ── نافذة سبب الرفض ── */
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">❌ رفض الإيداع</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="padding:8px 0 16px;font-family:'Cairo',sans-serif">
      <div style="background:rgba(239,68,68,0.08);border:1.5px solid rgba(239,68,68,0.25);border-radius:12px;padding:14px 16px;margin-bottom:18px;font-size:13px;color:#ef4444;font-weight:700">
        ⚠️ سيتم إشعار العميل برفض الإيداع وعرض السبب له
      </div>
      ${deposit ? `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:13px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="color:var(--text-muted)">العميل</span>
          <strong>${deposit.customerName || '—'}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="color:var(--text-muted)">المبلغ</span>
          <strong style="color:#ef4444">${(deposit.amount||0).toLocaleString('ar-YE')} ر.ي</strong>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--text-muted)">رقم الطلب</span>
          <strong>${deposit.orderId || '—'}</strong>
        </div>
      </div>` : ''}
      <div class="form-group">
        <label class="form-label">سبب الرفض <span style="color:var(--text-muted);font-weight:400">(اختياري — سيظهر للعميل)</span></label>
        <textarea id="deposit-reject-reason"
          class="form-control"
          rows="3"
          placeholder="مثال: الإيصال غير واضح، المبلغ غير متطابق، تم التحويل لحساب خاطئ..."
          style="resize:vertical;font-family:'Cairo',sans-serif"></textarea>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="btn btn-danger" style="flex:1" onclick="confirmRejectDeposit('${depositId}')">❌ تأكيد الرفض وإشعار العميل</button>
        <button class="btn btn-secondary" style="flex:1" onclick="closeModal()">إلغاء</button>
      </div>
    </div>
  `);
};

window.confirmRejectDeposit = async function(depositId) {
  const reason = (document.getElementById('deposit-reject-reason')?.value || '').trim();
  const deposit = AppData.bankDeposits?.find(d => d.id === depositId);

  try {
    await fsUpdate('bank_deposits', depositId, {
      status:     'rejected',
      rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
      rejectedBy: State.currentUser?.displayName || State.currentUser?.name || State.currentUser?.email || 'الإدارة',
      rejectReason: reason || '',
    });

    /* ── إشعار الـ Firestore للعميل ── */
    const customerId = deposit?.customerId;
    if (customerId && typeof saveNotificationToFirestore === 'function') {
      const bodyText = reason
        ? `إيداعك بمبلغ ${(deposit?.amount || 0).toLocaleString('ar-YE')} ر.ي تم رفضه. السبب: ${reason}`
        : `إيداعك بمبلغ ${(deposit?.amount || 0).toLocaleString('ar-YE')} ر.ي تم رفضه. يرجى التواصل مع الدعم.`;
      await saveNotificationToFirestore(customerId, {
        title: '❌ تم رفض إيداعك',
        body:  bodyText,
        type:  'deposit_rejected',
        icon:  '❌',
        data:  {
          depositId,
          orderId:    deposit?.orderId || '',
          amount:     deposit?.amount  || 0,
          rejectReason: reason,
        },
      });
    }

    toast('تم رفض الإيداع وإشعار العميل', 'info');
    closeModal();
    await loadAllData();
    await render();
  } catch(e) {
    console.error('[rejectDeposit]', e);
    toast('حدث خطأ أثناء رفض الإيداع', 'error');
  }
};


// ─── CHECKOUT OVERRIDE ──────────────────────────────────
// Overriding confirmBooking from pages.js to open Payment Modal
window.confirmBooking = async function(svcId) {
  const date = document.getElementById('bk-date').value;
  const time = document.getElementById('bk-time').value;
  const addr = (document.getElementById('bk-addr')?.value || '').trim();
  const note = (document.getElementById('bk-note')?.value || '').trim();

  if (!date) { toast('يرجى اختيار التاريخ','error'); return; }

  const s = AppData.services.find(x=>x.id===svcId);
  const u = State.currentUser;
  const requiresDelivery = s?.requiresDelivery !== false;
  const deliveryType     = State._deliveryType || 'delivery';
  const isPickup         = requiresDelivery && deliveryType === 'pickup';

  // ─── حساب سعر التوصيل من النظام الجديد ─────────────────
  let deliveryFee = 0;
  let deliveryRoute = null;
  const fromArea = s?.location || s?.area || s?.address || '';
  const toArea   = addr || u?.address || u?.area || '';

  if (!isPickup && fromArea && toArea && typeof dp_calculateFee === 'function') {
    const result = dp_calculateFee(fromArea, toArea);
    if (result.found) {
      deliveryFee = result.fee;
      deliveryRoute = { from: fromArea, to: toArea, fee: result.fee };
    } else {
      // مسار غير مسجل — استخدم السعر الافتراضي وأشعر المدير
      deliveryFee = AppData.platformSettings?.deliveryFee || 0;
      toast('⚠️ سعر التوصيل لهذا المسار غير مسجّل — سيتم إشعار المدير', 'warning');
    }
  } else {
    deliveryFee = AppData.platformSettings?.deliveryFee || 0;
  }

  // ── التوصيل المجاني ───────────────────────────────────────────
  const _svcPrice = s?.price || 0;
  const _sectionId = s?.section || s?.sectionId || s?.category || 'professions';
  if (deliveryFee > 0 && typeof fs_isFreeShipping === 'function' && fs_isFreeShipping(_svcPrice, _sectionId)) {
    deliveryFee = 0;
    if (deliveryRoute) deliveryRoute.fee = 0;
  }

  const total = _svcPrice + deliveryFee;

  const orderDetails = {
    svcId, date, time, addr, note, total, deliveryFee, deliveryRoute, s, u,
    deliveryType: isPickup ? 'pickup' : 'delivery',
  };

  // Close the booking modal and open payment options
  closeModal();
  setTimeout(() => showDynamicPaymentModal(orderDetails), 300);
}

// ─── DYNAMIC PAYMENT MODAL ──────────────────────────────
window.showDynamicPaymentModal = async function(orderDetails) {
  const methods = AppData.paymentMethods.filter(m => m.active);
  const walletBal = await getBalance(orderDetails.u.uid);
  
  State.pendingOrder = orderDetails;
  State.selectedPaymentMethod = methods.length > 0 ? methods[0].id : '';

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">💳 خيارات الدفع</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    
    <div style="background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.2);border-radius:var(--radius-sm);padding:16px;margin-bottom:20px">
      <div style="text-align:center;margin-bottom:12px">
        <div style="color:var(--text-secondary);margin-bottom:4px">إجمالي المبلغ المطلوب</div>
        <div style="font-size:32px;font-weight:800;color:var(--primary)">${orderDetails.total} ريال</div>
      </div>
      ${orderDetails.deliveryRoute ? `
      <div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:8px;padding:10px;font-size:13px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="color:var(--text-muted)">سعر الخدمة</span>
          <strong>${(orderDetails.total - orderDetails.deliveryFee).toLocaleString('ar')} ريال</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="color:var(--text-muted)">🚚 التوصيل (${escHtml(orderDetails.deliveryRoute.from)} ← ${escHtml(orderDetails.deliveryRoute.to)})</span>
          <strong style="color:${orderDetails.deliveryFee === 0 ? '#10b981' : 'inherit'}">${orderDetails.deliveryFee === 0 ? 'مجاني 🎉' : orderDetails.deliveryFee.toLocaleString('ar') + ' ريال'}</strong>
        </div>
      </div>` : orderDetails.deliveryFee > 0 ? `
      <div style="text-align:center;font-size:13px;color:var(--text-muted);margin-top:4px">رسوم التوصيل: ${orderDetails.deliveryFee} ريال</div>` : ''}
    </div>
    ${typeof fs_getShippingHintHTML === 'function' ? fs_getShippingHintHTML(orderDetails.total - (orderDetails.deliveryFee||0), orderDetails.s?.section || orderDetails.s?.sectionId || orderDetails.s?.category || 'professions') : ''}
    
    ${methods.length ? `
      <div class="payment-methods" style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px">
        ${methods.map((m, i) => `
          <button class="payment-method ${i===0?'active':''}" style="display:flex;align-items:center;padding:16px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-card);text-align:right;width:100%;transition:all 0.2s" onclick="selectDynPaymentMethod(this, '${m.id}', '${m.type}')">
            <div style="font-size:28px;margin-left:16px">${m.icon}</div>
            <div style="flex:1">
              <div style="font-weight:700;font-size:16px">${m.name}</div>
              ${m.type === 'wallet' ? `<div style="font-size:13px;color:${walletBal>=orderDetails.total?'#10b981':'#f43f5e'}">الرصيد المتاح: ${walletBal} ريال</div>` : ''}
              ${m.note ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${m.note}</div>` : ''}
            </div>
            <div class="check-icon" style="font-size:20px;display:${i===0?'block':'none'}">✅</div>
          </button>
        `).join('')}
      </div>
    ` : '<p style="color:#f43f5e">لا توجد طرق دفع متاحة حالياً</p>'}
    
    <!-- Bank Transfer Fields (Hidden by default) -->
    <div id="bank-transfer-fields" style="display:${methods[0]?.type==='bank_transfer'?'block':'none'};margin-bottom:20px;background:var(--bg-main);padding:16px;border-radius:var(--radius-sm);border:1px dashed var(--border)">
      ${renderBankSelection()}
      <div class="form-group" style="margin-top:12px">
        <label class="form-label">ملاحظات التحويل (اختياري)</label>
        <textarea class="form-control" id="dyn-pm-note" rows="2" placeholder="رقم الحوالة، اسم المحول..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">إرفاق إيصال التحويل <span class="req">*</span></label>
        <input class="form-control" id="dyn-pm-receipt" type="file" accept="image/*" onchange="previewDynReceipt(this)">
      </div>
      <div id="dyn-receipt-preview"></div>
    </div>
    
    <button class="btn btn-primary btn-block btn-lg" onclick="processDynamicPayment()" ${methods.length===0?'disabled':''}>
      تأكيد الدفع وإرسال الطلب
    </button>
  `);
}

window.renderBankSelection = function() {
  const banks = AppData.bankAccounts?.filter(b => b.active !== false) || [];
  if (!banks.length) return '<div class="empty-state" style="padding:10px">لا توجد حسابات بنكية مضافة من الإدارة</div>';
  return `
    <label class="form-label">اختر الحساب المحول إليه <span class="req">*</span></label>
    <select class="form-control" id="dyn-pm-bank">
      ${banks.map(b => `<option value="${b.bankName} - ${b.accountNumber}">${b.bankName} (${b.accountNumber})</option>`).join('')}
    </select>
  `;
}

window.selectDynPaymentMethod = function(btn, id, type) {
  document.querySelectorAll('.payment-method').forEach(b => {
    b.classList.remove('active');
    b.style.borderColor = 'var(--border)';
    b.querySelector('.check-icon').style.display = 'none';
  });
  
  btn.classList.add('active');
  btn.style.borderColor = 'var(--primary)';
  btn.querySelector('.check-icon').style.display = 'block';
  
  State.selectedPaymentMethod = id;
  State.selectedPaymentType = type;
  
  const bankFields = document.getElementById('bank-transfer-fields');
  if (bankFields) {
    bankFields.style.display = type === 'bank_transfer' ? 'block' : 'none';
  }
}

window.previewDynReceipt = function(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('dyn-receipt-preview').innerHTML = `<img src="${e.target.result}" style="width:100%;border-radius:8px;max-height:150px;object-fit:cover;margin-top:10px">`;
  };
  reader.readAsDataURL(file);
}

window.processDynamicPayment = async function() {
  const details = State.pendingOrder;
  if (!details) return;
  
  const methodId = State.selectedPaymentMethod;
  const method = AppData.paymentMethods.find(m => m.id === methodId);
  const type = State.selectedPaymentType || method?.type || 'wallet';
  
  let receiptBase64 = null;
  let bankName = null;
  let customerNote = null;
  
  // Wallet validation
  if (type === 'wallet') {
    const bal = await getBalance(details.u.uid);
    if (bal < details.total) {
      toast(`رصيدك (${bal} ريال) غير كافٍ. المطلوب: ${details.total} ريال.`, 'error');
      return;
    }
  }
  
  // Bank Transfer Validation
  if (type === 'bank_transfer') {
    const file = document.getElementById('dyn-pm-receipt')?.files[0];
    if (!file) { toast('يرجى إرفاق إيصال التحويل', 'error'); return; }
    
    bankName = document.getElementById('dyn-pm-bank')?.value;
    if (!bankName) { toast('يرجى اختيار الحساب البنكي', 'error'); return; }
    
    customerNote = document.getElementById('dyn-pm-note')?.value.trim();
    
    receiptBase64 = await new Promise(res => {
      const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file);
    });
  }
  
  showLoader('جاري معالجة الطلب...');
  
  try {
    const isUpdate = !!details.isExistingOrder;
    const orderId = isUpdate ? details.orderId : await generateOrderId();
    const vendor = AppData.users.find(x => x.email === details.s?.vendorEmail) || null;
    
    // Status depends on payment method
    let orderStatus = 'pending';
    let paymentStatus = 'unpaid';
    
    if (type === 'wallet') {
      orderStatus = isUpdate ? 'approved' : 'pending'; // Profession order becomes approved immediately after agreement + payment
      paymentStatus = 'paid';
      await deductWallet(details.u.uid, details.total, `حجز خدمة: ${details.s.name}`, orderId);
    } else if (type === 'bank_transfer') {
      orderStatus = isUpdate ? 'pending_payment' : 'pending_payment'; 
      paymentStatus = 'verifying';
    } else if (type === 'cod') {
      orderStatus = isUpdate ? 'approved' : 'pending';
      paymentStatus = 'cod';
    }

    const matchedAddr = (window.__ph41_addresses || []).find(a => a.address === details.addr);
    const housePics = matchedAddr ? (matchedAddr.pics || []) : (details.u?.housePics || []);

    // 1. Create or Update the order
    const orderObj = {
      orderId, 
      svcId: details.svcId, 
      svcName: details.s?.name, 
      svcIcon: details.s?.icon,
      servicePrice: details.total - (details.deliveryFee||0), 
      deliveryFee: details.deliveryFee || 0, 
      total: details.total,
      customerId: details.u.uid, 
      customerName: details.u.name, 
      customerAddr: details.addr,
      vendorId: details.s?.vendorId || details.s?.providerUid || null, 
      vendorName: details.s?.provider || details.s?.providerName || '—',
      date: details.date, 
      time: details.time, 
      note: details.note, 
      status: orderStatus,
      paymentMethodId: methodId,
      paymentType: type,
      paymentStatus: paymentStatus,
      housePics: housePics,
      orderRegionId: details.u?.regionId || State.currentUser?.regionId || null
    };

    if (isUpdate) {
      await fsUpdate('orders', details.dbOrderId, orderObj);
    } else {
      await fsAdd('orders', { ...orderObj, createdAt: new Date(), driverId: null, driverName: null });
    }

    // 2. Create the deposit record if bank transfer
    if (type === 'bank_transfer') {
      const depRef = await fsAdd('bank_deposits', {
        orderId,
        customerId: details.u.uid,
        customerName: details.u.name,
        amount: details.total,
        bankName,
        customerNote,
        receiptBase64,
        status: 'pending', // pending admin approval
        createdAt: new Date()
      });
      await fsAdd('depositDocs', {
        userId: details.u.uid,
        userName: details.u.name,
        userPhone: details.u.phone || '',
        userRole: details.u.role || 'customer',
        depositType: 'order_payment',
        referenceId: orderId,
        amount: parseFloat(details.total),
        bankName: bankName || 'إيداع بنكي لدفع طلب',
        transferDate: new Date().toISOString().split('T')[0],
        receiptUrl: receiptBase64,
        status: 'pending',
        createdAt: new Date()
      });
      // Notify Admin
      if (typeof notificationManager !== 'undefined') {
        notificationManager.notifyAdmin(`تم استلام إيداع بنكي جديد لطلب ${orderId}`, 'deposit');
      }
    }
    
    closeModal();
    toast(isUpdate ? `✅ تم الدفع بنجاح لطلب رقم ${orderId}` : `تم إرسال طلبك! رقم العملية: ${orderId} ✅`, 'success');
    State.pendingOrder = null;
    await loadAllData();
    await navigate('myorders');

  } catch(e) {
    console.error(e);
    toast('حدث خطأ أثناء معالجة الطلب', 'error');
  }
}

// ═══════════════════════════════════════════════════════
//  محجوز v3.5 — Phase 15 (User Data Export)
//  - زر "📥 تصدير بياناتي" في صفحة الإعدادات
//  - يصدّر JSON كامل + PDF منسّق
//  - يشمل: الملف الشخصي، الطلبات، المحفظة، التقييمات، نقاط الولاء، النشاط
// ═══════════════════════════════════════════════════════
'use strict';

(function () {
  if (typeof I18N === 'undefined') return;
  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };
  add('export_section', '📥 تصدير بياناتي',     '📥 Export my data');
  add('export_hint',    'احصل على نسخة كاملة من بياناتك في ملف واحد', 'Get a full copy of your data in one file');
  add('export_json',    'تصدير JSON',           'Export JSON');
  add('export_pdf',     'تصدير PDF',            'Export PDF');
  add('export_done',    '✅ تم إنشاء ملف بياناتك', '✅ Your data file is ready');
})();

// ── Build a comprehensive snapshot of the current user's data
window.ph15_buildSnapshot = async function () {
  const u = State.currentUser;
  if (!u) return null;
  const orders = (AppData.orders || []).filter(o => o.customerId === u.uid);
  const ratings = (AppData.ratings || []).filter(r => r.customerId === u.uid);
  // Wallet history
  let wallet = [];
  try {
    const snap = await db.collection('wallet_transactions').where('uid', '==', u.uid).get();
    wallet = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {}
  // Activity log
  let activity = [];
  try {
    if (typeof ph11_fetchActivities === 'function') activity = await ph11_fetchActivities(u.uid, 200);
  } catch (e) {}
  // Loyalty
  let loyaltyPoints = u.loyaltyPoints || 0;
  let loyaltyHistory = [];
  try {
    const snap = await db.collection('loyalty_log').where('uid', '==', u.uid).get();
    loyaltyHistory = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {}
  // Notifications
  let notifications = [];
  try {
    const snap = await db.collection('user_notifications').where('uid', '==', u.uid).limit(100).get();
    notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {}

  return {
    exportedAt: new Date().toISOString(),
    appName: 'محجوز',
    appVersion: 'v3.5',
    profile: {
      uid: u.uid, name: u.name, email: u.email, phone: u.phone,
      phone2: u.phone2 || null,
      role: u.role, regionId: u.regionId, age: u.age,
      twoFAEnabled: !!u.twoFAEnabled, prefLang: u.prefLang || null,
      hasPhoto: !!u.photoBase64,
    },
    counts: {
      orders: orders.length,
      ratings: ratings.length,
      walletTxns: wallet.length,
      activities: activity.length,
      notifications: notifications.length,
      loyaltyEvents: loyaltyHistory.length,
    },
    loyalty: { points: loyaltyPoints, history: loyaltyHistory },
    orders, ratings, wallet, activity, notifications,
  };
};

// ── Helper: serialize Firestore Timestamps for JSON
function ph15_normalize(obj) {
  return JSON.parse(JSON.stringify(obj, (k, v) => {
    if (v && typeof v === 'object' && typeof v.seconds === 'number' && typeof v.nanoseconds === 'number') {
      return new Date(v.seconds * 1000).toISOString();
    }
    return v;
  }));
}

// ── Export as JSON
window.ph15_exportJSON = async function () {
  showLoader('جاري تجهيز بياناتك…');
  try {
    const snap = await ph15_buildSnapshot();
    const json = JSON.stringify(ph15_normalize(snap), null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mahjooz_${snap.profile.uid}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    hideLoader();
    toast(t('export_done'), 'success');
  } catch (e) {
    hideLoader();
    toast('تعذّر التصدير: ' + (e.message || e), 'error');
  }
};

// ── Export as PDF (re-uses html2canvas + jsPDF from phase 6)
window.ph15_exportPDF = async function () {
  showLoader('جاري تجهيز ملف PDF…');
  try {
    const snap = await ph15_buildSnapshot();
    const norm = ph15_normalize(snap);
    const fmtDate = (s) => { try { return new Date(s).toLocaleString('ar-EG'); } catch (e) { return s; } };
    const ordersTable = norm.orders.length ? `
      <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:11px">
        <thead><tr style="background:#f3e8ff">
          <th style="padding:6px;border:1px solid #ddd">الرقم</th>
          <th style="padding:6px;border:1px solid #ddd">الخدمة</th>
          <th style="padding:6px;border:1px solid #ddd">السعر</th>
          <th style="padding:6px;border:1px solid #ddd">الحالة</th>
          <th style="padding:6px;border:1px solid #ddd">التاريخ</th>
        </tr></thead>
        <tbody>${norm.orders.slice(0, 50).map(o => `
          <tr>
            <td style="padding:5px;border:1px solid #ddd">${o.orderId || '—'}</td>
            <td style="padding:5px;border:1px solid #ddd">${o.svcName || '—'}</td>
            <td style="padding:5px;border:1px solid #ddd">${o.total || o.servicePrice || 0} ر</td>
            <td style="padding:5px;border:1px solid #ddd">${o.status || '—'}</td>
            <td style="padding:5px;border:1px solid #ddd">${o.createdAt ? fmtDate(o.createdAt) : '—'}</td>
          </tr>`).join('')}</tbody>
      </table>` : '<p style="font-size:12px;color:#666">لا توجد طلبات</p>';

    const html = `
      <div style="font-family:'Tahoma','Arial',sans-serif;direction:rtl;background:#fff;color:#222;padding:30px;width:780px">
        <div style="text-align:center;border-bottom:3px solid #7c3aed;padding-bottom:14px;margin-bottom:18px">
          <h1 style="color:#7c3aed;margin:0">📥 تصدير بيانات حسابي</h1>
          <p style="margin:6px 0 0;color:#666;font-size:12px">محجوز • ${new Date().toLocaleString('ar-EG')}</p>
        </div>

        <h2 style="color:#7c3aed;border-bottom:1px solid #ddd;padding-bottom:6px">👤 الملف الشخصي</h2>
        <table style="width:100%;font-size:13px;margin-bottom:18px">
          <tr><td style="padding:4px;color:#888;width:140px">الاسم</td><td style="padding:4px"><b>${norm.profile.name || '—'}</b></td></tr>
          <tr><td style="padding:4px;color:#888">البريد</td><td style="padding:4px">${norm.profile.email || '—'}</td></tr>
          <tr><td style="padding:4px;color:#888">الجوال</td><td style="padding:4px">${norm.profile.phone || '—'}</td></tr>
          ${norm.profile.phone2 ? `<tr><td style="padding:4px;color:#888">هاتف إضافي</td><td style="padding:4px">${norm.profile.phone2}</td></tr>` : ''}
          <tr><td style="padding:4px;color:#888">الدور</td><td style="padding:4px">${norm.profile.role || '—'}</td></tr>
          <tr><td style="padding:4px;color:#888">المنطقة</td><td style="padding:4px">${norm.profile.regionId || '—'}</td></tr>
          <tr><td style="padding:4px;color:#888">المصادقة الثنائية</td><td style="padding:4px">${norm.profile.twoFAEnabled ? 'مفعّلة' : 'معطّلة'}</td></tr>
        </table>

        <h2 style="color:#7c3aed;border-bottom:1px solid #ddd;padding-bottom:6px">📊 ملخص</h2>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;font-size:12px">
          <div style="background:#f3e8ff;padding:8px 12px;border-radius:8px"><b>${norm.counts.orders}</b> طلب</div>
          <div style="background:#f3e8ff;padding:8px 12px;border-radius:8px"><b>${norm.counts.ratings}</b> تقييم</div>
          <div style="background:#f3e8ff;padding:8px 12px;border-radius:8px"><b>${norm.counts.walletTxns}</b> حركة محفظة</div>
          <div style="background:#fff7ed;padding:8px 12px;border-radius:8px"><b>${norm.loyalty.points}</b> نقطة ولاء</div>
          <div style="background:#f3e8ff;padding:8px 12px;border-radius:8px"><b>${norm.counts.activities}</b> نشاط</div>
        </div>

        <h2 style="color:#7c3aed;border-bottom:1px solid #ddd;padding-bottom:6px">📋 آخر الطلبات (${Math.min(50, norm.orders.length)} من ${norm.orders.length})</h2>
        ${ordersTable}

        <p style="text-align:center;margin-top:30px;font-size:10px;color:#888">
          هذا الملف يحتوي على نسخة من بياناتك على منصة محجوز. يحتفظ به للرجوع الشخصي.
        </p>
      </div>`;

    const fname = `mahjooz_data_${norm.profile.uid}_${Date.now()}.pdf`;
    if (typeof ph6_htmlToPdf === 'function') {
      await ph6_htmlToPdf(html, fname);
    } else {
      // Fallback: open as printable HTML
      const w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 600);
    }
    hideLoader();
    toast(t('export_done'), 'success');
  } catch (e) {
    hideLoader();
    toast('تعذّر التصدير: ' + (e.message || e), 'error');
  }
};

// ── Inject "📥 تصدير بياناتي" card into settings
(function patchSettingsForExport() {
  const __orig = window.renderSettingsPage;
  if (typeof __orig !== 'function') { setTimeout(patchSettingsForExport, 600); return; }
  window.renderSettingsPage = function () {
    let html = __orig.apply(this, arguments);
    const card = `
      <div class="ph9-card">
        <div class="ph9-card-head"><h3>${t('export_section')}</h3></div>
        <div class="ph9-hint" style="margin-bottom:10px">${t('export_hint')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="ph15_exportJSON()">📄 ${t('export_json')}</button>
          <button class="btn btn-primary" onclick="ph15_exportPDF()">📕 ${t('export_pdf')}</button>
        </div>
      </div>`;
    const idx = html.lastIndexOf('<div class="ph9-card">');
    if (idx !== -1) html = html.slice(0, idx) + card + html.slice(idx);
    return html;
  };
})();

console.log('[Phase 15] Data export loaded.');

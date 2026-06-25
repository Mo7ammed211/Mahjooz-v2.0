/* ================================================================
   rich-broadcast.js — التنبيهات الغنية مع الروابط (Task #54)
   نظام إرسال إشعارات جماعية تحتوي على أزرار / روابط قابلة للنقر
   ================================================================ */
(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────
     الثوابت
  ───────────────────────────────────────────────────────────── */
  const COLLECTION  = 'broadcastNotifications';
  const USER_NOTIF  = 'user_notifications';

  // أنواع الروابط المدعومة
  const ACTION_TYPES = {
    url:        { label: '🌐 رابط خارجي (موقع / متجر)',  placeholder: 'https://play.google.com/...' },
    navigate:   { label: '📱 صفحة داخل التطبيق',          placeholder: 'wallet' },
    download:   { label: '⬇️ رابط تحميل ملف / تطبيق',    placeholder: 'https://example.com/app.apk' },
    phone:      { label: '📞 رقم هاتف',                   placeholder: '967XXXXXXXXX' },
    whatsapp:   { label: '💬 واتساب',                     placeholder: '967XXXXXXXXX' },
  };

  // قوالب جاهزة للإشعارات الشائعة
  const TEMPLATES = [
    {
      label: '🚀 تحديث جديد متاح',
      icon: '🚀', type: 'info',
      title: '🚀 تحديث جديد لتطبيق محجوز!',
      body: 'يتوفر الآن تحديث جديد يحتوي على ميزات محسّنة وإصلاح للأخطاء. قم بالتحديث الآن للحصول على أفضل تجربة.',
      actionType: 'url', actionLabel: 'تحديث الآن ⬆️',
      actionUrl: 'https://play.google.com/store/apps/details?id=com.mahjooz',
    },
    {
      label: '📲 تحميل تطبيقاتنا الأخرى',
      icon: '📲', type: 'info',
      title: '📲 اكتشف باقي تطبيقاتنا!',
      body: 'لدينا تطبيقات متخصصة في قطاعات متعددة. حمّلها الآن واستمتع بتجربة احترافية في كل قطاع.',
      actionType: 'url', actionLabel: 'تصفح التطبيقات',
      actionUrl: 'https://mahjooz.app/apps',
    },
    {
      label: '🎉 عرض أو خصم خاص',
      icon: '🎉', type: 'success',
      title: '🎉 عرض حصري لفترة محدودة!',
      body: 'استمتع بخصم خاص على الخدمات المختارة. العرض لمدة 48 ساعة فقط — لا تفوّت الفرصة!',
      actionType: 'navigate', actionLabel: 'تصفح العروض',
      actionUrl: 'services',
    },
    {
      label: '🔔 إشعار نظام عام',
      icon: '🔔', type: 'warning',
      title: '🔔 تنويه مهم من إدارة محجوز',
      body: '',
      actionType: 'url', actionLabel: '',
      actionUrl: '',
    },
    {
      label: '📞 تواصل مع الدعم',
      icon: '📞', type: 'info',
      title: '📞 هل تحتاج مساعدة؟',
      body: 'فريق الدعم الفني متاح على مدار الساعة لمساعدتك. تواصل معنا عبر الواتساب.',
      actionType: 'whatsapp', actionLabel: 'تواصل معنا الآن',
      actionUrl: '9671234567890',
    },
  ];

  /* ─────────────────────────────────────────────────────────────
     1. واجهة المسؤول — إرسال إشعار جماعي
  ───────────────────────────────────────────────────────────── */
  window.renderAdminBroadcastNotif = function () {
    const sent = AppData.broadcastNotifications || [];
    sent.sort((a, b) => (b.sentAt?.seconds || 0) - (a.sentAt?.seconds || 0));

    if (!State._bcTab) State._bcTab = 'send';
    const activeTab = State._bcTab;

    return `
    <style>
      .bc-panel { max-width: 860px; }
      .bc-tabs  { display:flex; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:4px; gap:6px; margin-bottom:20px; }
      .bc-tab   { flex:1; padding:9px 16px; border:0; border-radius:9px; font-weight:800; font-size:12.5px;
                  background:none; color:var(--text-secondary); cursor:pointer; font-family:'Cairo',sans-serif; transition:all .2s; }
      .bc-tab.active { background:var(--primary,#7c3aed); color:#fff; }
      .bc-card  { background:var(--bg-card); border:1.5px solid var(--border); border-radius:16px; padding:24px; }
      .bc-tpl-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:10px; margin-bottom:20px; }
      .bc-tpl-btn  { padding:12px 14px; background:rgba(124,58,237,0.06); border:1.5px solid rgba(124,58,237,0.2);
                     border-radius:12px; cursor:pointer; text-align:right; font-family:'Cairo',sans-serif; transition:all .2s; }
      .bc-tpl-btn:hover { background:rgba(124,58,237,0.12); border-color:rgba(124,58,237,0.4); transform:translateY(-2px); }
      .bc-tpl-btn span { display:block; font-size:12px; color:var(--text-muted); margin-top:4px; }
      .bc-preview { background:rgba(124,58,237,0.06); border:1.5px solid rgba(124,58,237,0.25); border-radius:16px;
                    padding:16px 18px; margin-top:16px; direction:rtl; }
      .bc-preview-title { font-size:15px; font-weight:800; margin-bottom:6px; }
      .bc-preview-body  { font-size:13px; color:var(--text-secondary); line-height:1.6; margin-bottom:12px; }
      .bc-preview-btn   { display:inline-flex; align-items:center; gap:8px; padding:9px 18px; border-radius:10px;
                          background:var(--primary,#7c3aed); color:#fff; font-size:13px; font-weight:800; cursor:pointer; border:none;
                          font-family:'Cairo',sans-serif; transition:all .2s; }
      .bc-preview-btn:hover { opacity:.85; }
      .bc-history-item { display:flex; align-items:flex-start; gap:14px; padding:14px; background:var(--bg-card);
                         border:1.5px solid var(--border); border-radius:12px; margin-bottom:8px; }
      .bc-hist-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center;
                      font-size:22px; background:rgba(124,58,237,0.1); flex-shrink:0; }
      .bc-hist-meta { font-size:11px; color:var(--text-muted); margin-top:4px; display:flex; gap:10px; flex-wrap:wrap; }
      .bc-target-chip { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px;
                        background:rgba(124,58,237,0.12); border:1px solid rgba(124,58,237,0.3); font-size:11px;
                        font-weight:800; color:#a78bfa; }
    </style>

    <div class="bc-panel">
      <div style="margin-bottom:20px">
        <h2 style="font-size:22px;font-weight:800;margin:0">📢 التنبيهات الجماعية مع الروابط</h2>
        <p style="color:var(--text-muted);font-size:12px;margin:4px 0 0">إرسال إشعارات تفاعلية تحتوي على أزرار وروابط لجميع المستخدمين أو لفئة محددة</p>
      </div>

      <div class="bc-tabs">
        <button class="bc-tab ${activeTab==='send'?'active':''}" onclick="State._bcTab='send';render()">✏️ إنشاء وإرسال</button>
        <button class="bc-tab ${activeTab==='history'?'active':''}" onclick="State._bcTab='history';render()">📜 السجل والتاريخ</button>
      </div>

      ${activeTab === 'send' ? _renderSendPanel() : _renderHistoryPanel(sent)}
    </div>`;
  };

  function _renderSendPanel() {
    const s = State._bcForm || {};
    const aType = s.actionType || 'url';

    return `
    <div class="bc-card">
      <!-- القوالب الجاهزة -->
      <div style="margin-bottom:20px">
        <label class="form-label" style="font-size:13px;font-weight:800;margin-bottom:10px;display:block">
          ⚡ قوالب جاهزة — اختر قالباً للبدء السريع
        </label>
        <div class="bc-tpl-grid">
          ${TEMPLATES.map((t, i) => `
            <button class="bc-tpl-btn" onclick="ph54_loadTemplate(${i})">
              ${t.label}
              <span>${t.body ? t.body.substring(0,40)+'…' : 'اكتب النص يدوياً'}</span>
            </button>`).join('')}
        </div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:16px">

        <!-- العنوان -->
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">📌 عنوان الإشعار *</label>
          <input type="text" id="bc-title" class="form-control"
            placeholder="مثال: 🚀 تحديث جديد لتطبيق محجوز!"
            value="${escHtml(s.title||'')}"
            oninput="ph54_previewUpdate()">
        </div>

        <!-- النص -->
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">💬 نص الإشعار التفصيلي *</label>
          <textarea id="bc-body" class="form-control" rows="3"
            placeholder="اشرح التفاصيل هنا — يظهر هذا النص داخل الإشعار..."
            oninput="ph54_previewUpdate()"
            style="font-family:'Tajawal',sans-serif;font-size:13px;line-height:1.7">${escHtml(s.body||'')}</textarea>
        </div>

        <!-- الأيقونة -->
        <div class="form-group">
          <label class="form-label">🎨 أيقونة الإشعار</label>
          <input type="text" id="bc-icon" class="form-control"
            placeholder="🔔 (إيموجي واحد)"
            value="${escHtml(s.icon||'🔔')}"
            oninput="ph54_previewUpdate()"
            style="font-size:20px;text-align:center;width:80px">
        </div>

        <!-- نوع الرسالة -->
        <div class="form-group">
          <label class="form-label">🏷️ تصنيف الإشعار</label>
          <select id="bc-type" class="form-control" onchange="ph54_previewUpdate()">
            <option value="info"    ${(s.type||'info')==='info'    ?'selected':''}>💬 معلوماتي</option>
            <option value="success" ${(s.type||'')==='success'?'selected':''}>✅ نجاح / إيجابي</option>
            <option value="warning" ${(s.type||'')==='warning'?'selected':''}>⚠️ تحذير / تنبيه</option>
            <option value="danger"  ${(s.type||'')==='danger' ?'selected':''}>🚨 عاجل / هام</option>
          </select>
        </div>

      </div>

      <!-- قسم الرابط / الزر -->
      <div style="border-top:1px solid var(--border);margin-top:16px;padding-top:16px">
        <label class="form-label" style="font-size:13px;font-weight:800;margin-bottom:12px;display:block">
          🔗 زر الإجراء (اختياري) — الرابط أو الزر داخل الإشعار
        </label>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">

          <!-- نوع الرابط -->
          <div class="form-group">
            <label class="form-label">نوع الإجراء</label>
            <select id="bc-actionType" class="form-control" onchange="ph54_updateActionType()">
              ${Object.entries(ACTION_TYPES).map(([k, v]) =>
                `<option value="${k}" ${aType===k?'selected':''}>${v.label}</option>`
              ).join('')}
            </select>
          </div>

          <!-- نص الزر -->
          <div class="form-group">
            <label class="form-label">نص زر الإجراء</label>
            <input type="text" id="bc-actionLabel" class="form-control"
              placeholder="مثال: تحميل الآن"
              value="${escHtml(s.actionLabel||'')}"
              oninput="ph54_previewUpdate()">
          </div>

          <!-- الرابط / القيمة -->
          <div class="form-group">
            <label class="form-label">الرابط / القيمة</label>
            <input type="text" id="bc-actionUrl" class="form-control"
              id="bc-actionUrl"
              placeholder="${ACTION_TYPES[aType]?.placeholder || 'أدخل الرابط...'}"
              value="${escHtml(s.actionUrl||'')}"
              oninput="ph54_previewUpdate()">
          </div>

        </div>
      </div>

      <!-- الجمهور المستهدف -->
      <div style="border-top:1px solid var(--border);margin-top:16px;padding-top:16px">
        <label class="form-label" style="font-size:13px;font-weight:800;margin-bottom:12px;display:block">
          👥 الجمهور المستهدف
        </label>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${[
            ['all',      '👥', 'الجميع'],
            ['customer', '🛒', 'العملاء فقط'],
            ['vendor',   '🏢', 'مزودو الخدمات'],
            ['driver',   '🚗', 'المندوبون'],
            ['staff',    '👔', 'الموظفون'],
            ['admin',    '👑', 'المسؤولون'],
          ].map(([val, ic, lbl]) => `
            <label style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:rgba(255,255,255,0.04);
                          border:1.5px solid var(--border);border-radius:10px;cursor:pointer;font-size:13px;
                          font-weight:700;transition:all .2s;" class="bc-target-label">
              <input type="checkbox" id="bc-target-${val}" value="${val}"
                ${(s.targets||['all']).includes(val)?'checked':''}
                onchange="ph54_previewUpdate()"
                style="width:16px;height:16px;accent-color:var(--primary)">
              ${ic} ${lbl}
            </label>`).join('')}
        </div>
      </div>

      <!-- معاينة حية -->
      <div id="bc-preview-container" style="margin-top:20px"></div>

      <!-- زر الإرسال -->
      <div style="display:flex;gap:12px;margin-top:24px;padding-top:16px;border-top:1px solid var(--border)">
        <button class="btn btn-primary" style="flex:1;font-size:15px;padding:14px"
          onclick="ph54_sendBroadcast()">
          📢 إرسال الإشعار للمستهدفين الآن
        </button>
        <button class="btn btn-secondary" onclick="ph54_resetForm()">🗑️ مسح</button>
      </div>
    </div>

    <script>
      // تحميل معاينة أولية إن وجدت بيانات محفوظة
      setTimeout(() => ph54_previewUpdate(), 80);
    <\/script>`;
  }

  function _renderHistoryPanel(sent) {
    if (!sent.length) return `
      <div class="bc-card" style="text-align:center;padding:50px;color:var(--text-muted)">
        <div style="font-size:48px;margin-bottom:12px">📭</div>
        <div style="font-size:16px;font-weight:700">لم يتم إرسال أي تنبيه جماعي بعد</div>
        <div style="font-size:12px;margin-top:6px">ابدأ بإرسال أول إشعار من تبويب "إنشاء وإرسال"</div>
      </div>`;

    const targetLabel = { all:'الجميع', customer:'العملاء', vendor:'المزودون', driver:'المندوبون', staff:'الموظفون', admin:'المسؤولون' };
    const typeColor   = { info:'#0ea5e9', success:'#10b981', warning:'#f59e0b', danger:'#ef4444' };

    return `
    <div>
      ${sent.map(n => {
        const d = n.sentAt?.toDate ? n.sentAt.toDate() : (n.sentAt ? new Date(n.sentAt.seconds*1000) : null);
        const dateStr = d ? d.toLocaleString('ar-YE') : '—';
        const targets = Array.isArray(n.targets) ? n.targets : [n.targetRole || 'all'];
        const hasAction = n.actionLabel && n.actionUrl;
        return `
        <div class="bc-history-item">
          <div class="bc-hist-icon" style="background:${typeColor[n.type]||'#7c3aed'}1a;font-size:26px">${n.icon||'🔔'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:800;font-size:14px;margin-bottom:4px">${escHtml(n.title)}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;line-height:1.5">${escHtml(n.body||'')}</div>
            ${hasAction ? `
              <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;background:rgba(124,58,237,0.1);
                          border:1px solid rgba(124,58,237,0.3);border-radius:8px;font-size:11px;font-weight:800;color:#a78bfa;margin-bottom:8px">
                🔗 ${escHtml(n.actionLabel)} ← ${escHtml(n.actionUrl?.substring(0,40))}
              </div>` : ''}
            <div class="bc-hist-meta">
              <span>📅 ${dateStr}</span>
              <span>👤 ${escHtml(n.sentBy||'—')}</span>
              <span>📬 ${(n.recipientCount||0).toLocaleString('ar-YE')} مستقبل</span>
            </div>
            <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">
              ${targets.map(t => `<span class="bc-target-chip">${targetLabel[t]||t}</span>`).join('')}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  /* ─────────────────────────────────────────────────────────────
     2. دوال التفاعل — معاينة / إرسال / قوالب
  ───────────────────────────────────────────────────────────── */
  window.ph54_loadTemplate = function (idx) {
    const t = TEMPLATES[idx];
    if (!t) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('bc-title',       t.title);
    set('bc-body',        t.body);
    set('bc-icon',        t.icon);
    set('bc-type',        t.type);
    set('bc-actionType',  t.actionType);
    set('bc-actionLabel', t.actionLabel);
    set('bc-actionUrl',   t.actionUrl);
    // uncheck all targets, check 'all'
    ['all','customer','vendor','driver','staff','admin'].forEach(v => {
      const cb = document.getElementById('bc-target-'+v);
      if (cb) cb.checked = (v === 'all');
    });
    ph54_previewUpdate();
    toast('✅ تم تحميل القالب، يمكنك تعديله قبل الإرسال', 'info');
  };

  window.ph54_updateActionType = function () {
    const aType = document.getElementById('bc-actionType')?.value || 'url';
    const urlInput = document.getElementById('bc-actionUrl');
    if (urlInput) urlInput.placeholder = ACTION_TYPES[aType]?.placeholder || '';
    ph54_previewUpdate();
  };

  window.ph54_previewUpdate = function () {
    const get = id => document.getElementById(id)?.value?.trim() || '';
    const title       = get('bc-title');
    const body        = get('bc-body');
    const icon        = get('bc-icon') || '🔔';
    const actionLabel = get('bc-actionLabel');
    const actionUrl   = get('bc-actionUrl');
    const actionType  = get('bc-actionType') || 'url';

    // حفظ الحالة في State
    State._bcForm = { title, body, icon, type: get('bc-type'), actionType, actionLabel, actionUrl,
      targets: _getTargets() };

    const container = document.getElementById('bc-preview-container');
    if (!container) return;
    if (!title && !body) { container.innerHTML = ''; return; }

    container.innerHTML = `
      <div style="font-size:11px;font-weight:800;color:var(--text-muted);margin-bottom:8px;letter-spacing:.5px">
        👁️ معاينة حية — هكذا سيظهر الإشعار للمستخدم
      </div>
      <div class="bc-preview">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:28px">${icon}</span>
          <div class="bc-preview-title">${escHtml(title||'عنوان الإشعار')}</div>
        </div>
        ${body ? `<div class="bc-preview-body">${escHtml(body)}</div>` : ''}
        ${(actionLabel && actionUrl) ? `
          <button class="bc-preview-btn" onclick="ph54_handleAction('${actionType}','${escHtml(actionUrl)}')">
            ${escHtml(actionLabel)} →
          </button>` : ''}
      </div>`;
  };

  window.ph54_resetForm = function () {
    State._bcForm = {};
    ['bc-title','bc-body','bc-icon','bc-actionLabel','bc-actionUrl'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const icon = document.getElementById('bc-icon');
    if (icon) icon.value = '🔔';
    const container = document.getElementById('bc-preview-container');
    if (container) container.innerHTML = '';
  };

  function _getTargets() {
    const vals = [];
    ['all','customer','vendor','driver','staff','admin'].forEach(v => {
      if (document.getElementById('bc-target-'+v)?.checked) vals.push(v);
    });
    return vals.length ? vals : ['all'];
  }

  window.ph54_sendBroadcast = async function () {
    const get = id => document.getElementById(id)?.value?.trim() || '';
    const title       = get('bc-title');
    const body        = get('bc-body');
    const icon        = get('bc-icon') || '🔔';
    const type        = get('bc-type') || 'info';
    const actionType  = get('bc-actionType') || 'url';
    const actionLabel = get('bc-actionLabel');
    const actionUrl   = get('bc-actionUrl');
    const targets     = _getTargets();

    if (!title) { toast('يرجى إدخال عنوان الإشعار', 'warning'); return; }
    if (!body)  { toast('يرجى إدخال نص الإشعار',   'warning'); return; }

    const hasAction = actionLabel && actionUrl;

    // حساب المستقبلين
    const allUsers = AppData.users || [];
    let recipients = [];
    if (targets.includes('all')) {
      recipients = allUsers;
    } else {
      recipients = allUsers.filter(u => targets.includes(u.role));
    }

    if (!recipients.length) {
      toast('لا يوجد مستخدمون في الفئات المختارة', 'warning');
      return;
    }

    if (!confirm(`سيتم إرسال الإشعار لـ ${recipients.length.toLocaleString('ar-YE')} مستخدم. هل تريد المتابعة؟`)) return;

    showLoader(`جاري الإرسال لـ ${recipients.length} مستخدم...`);
    try {
      const admin = State.currentUser;
      const sentAt = new Date();

      // 1. حفظ في سجل broadcastNotifications
      const broadcastDoc = {
        title, body, icon, type,
        actionType:  hasAction ? actionType  : null,
        actionLabel: hasAction ? actionLabel : null,
        actionUrl:   hasAction ? actionUrl   : null,
        targets,
        sentBy: admin?.name || admin?.email || 'إداري',
        sentById: admin?.uid || '',
        recipientCount: recipients.length,
        sentAt,
      };
      await fsAdd(COLLECTION, broadcastDoc);

      // 2. كتابة إشعار فردي لكل مستقبل (دفعات لتجنب تجاوز حدود Firestore)
      const BATCH_SIZE = 50;
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = db.batch();
        recipients.slice(i, i + BATCH_SIZE).forEach(u => {
          const uid = u.uid || u.id;
          if (!uid) return;
          const ref = db.collection(USER_NOTIF).doc();
          batch.set(ref, {
            userId: uid,
            uid: uid,
            title,
            body,
            icon,
            type,
            actionType:  hasAction ? actionType  : null,
            actionLabel: hasAction ? actionLabel : null,
            actionUrl:   hasAction ? actionUrl   : null,
            source: 'broadcast',
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
      }

      // 3. تسجيل في سجل التدقيق
      if (typeof ph53_logAdminAction === 'function') {
        await ph53_logAdminAction('broadcast_notification', title,
          `إرسال إشعار جماعي للفئات: ${targets.join('، ')} — عدد المستقبلين: ${recipients.length}`);
      }

      toast(`✅ تم إرسال الإشعار لـ ${recipients.length.toLocaleString('ar-YE')} مستخدم بنجاح!`, 'success');
      ph54_resetForm();
      State._bcTab = 'history';
      await loadAllData();
      await render();
    } catch (e) {
      toast('حدث خطأ أثناء الإرسال: ' + e.message, 'error');
      console.error('[Broadcast]', e);
    } finally {
      hideLoader();
    }
  };

  /* ─────────────────────────────────────────────────────────────
     3. عرض الإشعارات مع أزرار الإجراء في مركز الإشعارات
  ───────────────────────────────────────────────────────────── */
  window.ph54_handleAction = function (actionType, url) {
    if (!url || url === 'null' || url === '') return;
    switch (actionType) {
      case 'url':
      case 'download':
        window.open(url, '_blank', 'noopener,noreferrer');
        break;
      case 'navigate':
        if (typeof navigate === 'function') navigate(url);
        break;
      case 'phone':
        window.location.href = 'tel:+' + url.replace(/\D/g,'');
        break;
      case 'whatsapp':
        window.open('https://wa.me/' + url.replace(/\D/g,''), '_blank', 'noopener,noreferrer');
        break;
      default:
        window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  /* ─────────────────────────────────────────────────────────────
     4. تحسين عرض بطاقات الإشعار في مركز الإشعارات
        (patch لدالة _itemHtml في notif-center.js)
  ───────────────────────────────────────────────────────────── */
  // نضيف CSS للأزرار داخل بطاقات الإشعار
  const richCSS = document.createElement('style');
  richCSS.id = 'ph54-rich-css';
  richCSS.textContent = `
    .nc-action-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 10px;
      padding: 8px 16px;
      border-radius: 10px;
      background: var(--primary, #7c3aed);
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      border: none;
      font-family: 'Cairo', sans-serif;
      transition: all .2s;
      text-decoration: none;
    }
    .nc-action-btn:hover { opacity: .85; transform: translateY(-1px); }
    .nc-action-btn.secondary {
      background: rgba(124,58,237,0.12);
      color: #a78bfa;
      border: 1.5px solid rgba(124,58,237,0.3);
    }
    .nc-source-broadcast {
      background: rgba(251,191,36,0.15) !important;
      border-color: rgba(251,191,36,0.3) !important;
    }
    .nc-broadcast-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 99px;
      background: rgba(251,191,36,0.2);
      border: 1px solid rgba(251,191,36,0.4);
      font-size: 10px;
      font-weight: 800;
      color: #fbbf24;
      margin-right: 6px;
    }

    /* Toast Rich */
    .toast-rich {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .toast-rich-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 8px;
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.25);
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      font-family: 'Cairo', sans-serif;
      width: fit-content;
    }
  `;
  document.head.appendChild(richCSS);

  /* ─────────────────────────────────────────────────────────────
     5. عرض الإشعارات الجماعية الواردة كـ Toast عند الاستقبال
        (patch على listenToNotifications في notifications.js)
  ───────────────────────────────────────────────────────────── */
  // نستبدل المستمع الأصلي بمستمع محسّن يعرض Toast غنياً
  const _origListen = window.listenToNotifications;
  window.listenToNotifications = function (userId) {
    if (typeof _origListen === 'function') _origListen(userId);
    _listenRichBroadcast(userId);
  };

  let _richUnsub = null;
  function _listenRichBroadcast(userId) {
    if (!userId || typeof db === 'undefined') return;
    if (_richUnsub) { try { _richUnsub(); } catch(e){} }
    _richUnsub = db.collection(USER_NOTIF)
      .where('uid', '==', userId)
      .where('source', '==', 'broadcast')
      .where('read', '==', false)
      .onSnapshot(snap => {
        snap.docChanges().forEach(ch => {
          if (ch.type !== 'added') return;
          const n = ch.doc.data();
          if (!document.hasFocus()) return;
          // عرض toast غني مع زر الإجراء
          _showRichToast(n, ch.doc.id);
        });
      }, err => {
        console.warn('[RichBroadcast] listener error:', err?.code || err?.message);
      });
  }

  function _showRichToast(n, docId) {
    const hasAction = n.actionLabel && n.actionUrl;
    const existing = document.getElementById('rich-toast-' + docId);
    if (existing) return;

    const wrap = document.createElement('div');
    wrap.id = 'rich-toast-' + docId;
    wrap.style.cssText = `
      position:fixed; bottom:90px; right:20px; z-index:99999;
      max-width:340px; min-width:280px;
      background:linear-gradient(135deg,#1e1b4b,#312e81);
      border:1.5px solid rgba(139,92,246,0.5);
      border-radius:18px; padding:16px 18px;
      box-shadow:0 12px 40px rgba(0,0,0,0.4),0 0 0 1px rgba(255,255,255,0.05);
      font-family:'Cairo','Tajawal',sans-serif;
      direction:rtl; color:#fff;
      animation:richToastIn .4s cubic-bezier(.34,1.56,.64,1);
    `;
    wrap.innerHTML = `
      <style>
        @keyframes richToastIn { from { transform:translateX(120%);opacity:0; } to { transform:translateX(0);opacity:1; } }
        @keyframes richToastOut{ to   { transform:translateX(120%);opacity:0; } }
      </style>
      <div style="display:flex;align-items:flex-start;gap:12px">
        <span style="font-size:28px;flex-shrink:0">${n.icon||'🔔'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:800;margin-bottom:4px">${escHtml(n.title||'')}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.75);line-height:1.5">${escHtml(n.body||'')}</div>
          ${hasAction ? `
            <button class="toast-rich-action" style="margin-top:10px"
              onclick="ph54_handleAction('${n.actionType||'url'}','${escHtml(n.actionUrl||'')}');ph54_closeRichToast('${docId}')">
              ${escHtml(n.actionLabel)} →
            </button>` : ''}
        </div>
        <button onclick="ph54_closeRichToast('${docId}')"
          style="background:rgba(255,255,255,.1);border:none;color:#fff;border-radius:8px;
                 padding:4px 8px;cursor:pointer;font-size:14px;flex-shrink:0">✕</button>
      </div>`;

    document.body.appendChild(wrap);

    // إغلاق تلقائي بعد 8 ثوانٍ
    setTimeout(() => ph54_closeRichToast(docId), 8000);
  }

  window.ph54_closeRichToast = function (docId) {
    const el = document.getElementById('rich-toast-' + docId);
    if (!el) return;
    el.style.animation = 'richToastOut .3s ease forwards';
    setTimeout(() => el?.remove(), 300);
    // تحديد كمقروء
    db.collection(USER_NOTIF).doc(docId).update({ read: true }).catch(() => {});
  };

  /* ─────────────────────────────────────────────────────────────
     6. تحميل الإشعارات الجماعية في extras.js (نسجّل الجمع محلياً)
  ───────────────────────────────────────────────────────────── */
  // تأكد من أن AppData.broadcastNotifications موجود
  if (typeof AppData !== 'undefined') {
    AppData.broadcastNotifications = AppData.broadcastNotifications || [];
  }

  console.log('[RichBroadcast] نظام التنبيهات الغنية جاهز 📢');
})();

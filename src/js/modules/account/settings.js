// ═══════════════════════════════════════════════════════
//  محجوز v2.9 — Phase 9 (Account & Profile)
//  - صفحة إعدادات حساب متكاملة
//  - رفع صورة شخصية + تعديل الاسم/الجوال/العمر
//  - تغيير كلمة المرور (الموجود مسبقاً)
//  - تغيير اللغة المفضّلة + الثيم
//  - عرض الصورة في القائمة + الـDrawer + شريط التنقل
// ═══════════════════════════════════════════════════════
'use strict';

// ─── Translations ─────────────────────────────────────
(function () {
  if (typeof I18N === 'undefined') return;
  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };
  add('settings_title',     '⚙️ إعدادات الحساب',           '⚙️ Account settings');
  add('profile_section',    'الملف الشخصي',                 'Profile');
  add('change_photo',       'تغيير الصورة',                 'Change photo');
  add('remove_photo',       'إزالة الصورة',                 'Remove photo');
  add('photo_max_hint',     'أقصى حجم 10 ميجا — JPG / PNG / WEBP', 'Max 10MB — JPG/PNG/WEBP');
  add('full_name_label',    'الاسم الكامل',                 'Full name');
  add('phone_label',        'رقم الجوال',                   'Phone');
  add('phone2_label',       'رقم هاتف إضافي (اختياري)',     'Secondary phone (optional)');
  add('phone2_add',         '➕ إضافة رقم هاتف إضافي',      '➕ Add secondary phone');
  add('phone2_edit',        '✏️ تعديل الرقم الإضافي',       '✏️ Edit secondary phone');
  add('phone2_remove',      '🗑️ حذف الرقم الإضافي',        '🗑️ Remove secondary phone');
  add('phone2_hint',        'رقم احتياطي للتواصل في حالة تعذّر الوصول عبر الرقم الرئيسي', 'Backup contact number');
  add('age_label',          'العمر',                        'Age');
  add('email_label',        'البريد الإلكتروني',            'Email');
  add('role_label',         'الدور',                        'Role');
  add('region_label',       'المنطقة',                      'Region');
  add('save_changes',       'حفظ التغييرات',                'Save changes');
  add('cancel',             'إلغاء',                        'Cancel');
  add('saved_ok',           '✅ تم حفظ التغييرات',           '✅ Changes saved');
  add('account_section',    'معلومات الحساب',               'Account info');
  add('password_section',   'كلمة المرور',                  'Password');
  add('change_password',    'تغيير كلمة المرور',            'Change password');
  add('language_section',   'اللغة المفضّلة',               'Preferred language');
  add('theme_section',      'المظهر',                       'Appearance');
  add('theme_dark',         '🌙 وضع ليلي',                   '🌙 Dark mode');
  add('theme_light',        '☀️ وضع نهاري',                  '☀️ Light mode');
  add('security_section',   'الأمان',                       'Security');
  add('twofa_label',        'المصادقة الثنائية (2FA)',      'Two-factor authentication');
  add('twofa_on',           '✅ مفعّلة — تستلم رمز عند كل دخول جديد', '✅ Enabled — code on each new login'),
  add('twofa_off',          '❌ معطّلة — يُستحسن تفعيلها لحماية أفضل', '❌ Disabled — turn it on for better protection');
  add('logout_section',     'الجلسة',                       'Session');
  add('logout_btn',         '🚪 تسجيل الخروج',                '🚪 Sign out');
  add('photo_too_big',      'الصورة كبيرة جداً (الحد 10 ميجا)', 'Image too big (max 10MB)');
  add('email_readonly',     'لتغيير البريد، تواصل مع الدعم', 'Contact support to change email');
})();

// ════════════════════════════════════════════════════════════
//  1) Avatar helper — show photo if available, fallback to initial
// ════════════════════════════════════════════════════════════
window.ph9_avatarHTML = function (user, sizeClass = '') {
  if (!user) return '';
  const initial = (user.name || user.email || '؟').charAt(0).toUpperCase();
  if (user.photoBase64) {
    return `<img src="${user.photoBase64}" alt="" class="nav-avatar-img ${sizeClass}">`;
  }
  return initial;
};

// Wrap renderNavbar to inject photo into avatar bubbles
(function patchNavbar() {
  const __orig = window.renderNavbar;
  if (typeof __orig !== 'function') return;
  window.renderNavbar = function () {
    let html = __orig.apply(this, arguments);
    const u = State.currentUser;
    if (!u || !u.photoBase64) return html;
    // Replace the inner content of every <div class="nav-avatar...">X</div> with an img.
    // The original code puts a single character or 👤 inside; we swap to <img>.
    html = html.replace(
      /<div class="nav-avatar([^"]*)"([^>]*)>([^<]*)<\/div>/g,
      (_m, cls, attrs, inner) => `<div class="nav-avatar${cls} has-photo"${attrs}><img src="${u.photoBase64}" alt=""></div>`
    );
    return html;
  };
})();

// ════════════════════════════════════════════════════════════
//  2) Override renderSettingsPage with a comprehensive page
// ════════════════════════════════════════════════════════════
window.renderSettingsPage = function () {
  const u = State.currentUser;
  if (!u) return `<div id="app-content"><div class="empty-state">يجب تسجيل الدخول</div></div>`;
  const region = (AppData.regions || []).find(r => r.id === u.regionId);
  const is2FA = !!u.twoFAEnabled;
  const lang = (typeof getLang === 'function') ? getLang() : 'ar';
  const dark = (typeof isDarkMode !== 'undefined') ? isDarkMode : true;
  const roleLabels = { admin:'مدير', staff:'موظف', vendor:'صاحب خدمة', driver:'مندوب', customer:'عميل', cs:'خدمة عملاء' };
  const homeRoute = (u.role === 'customer' || u.role === 'guest') ? 'home' : (u.role || 'home');

  return `<div id="app-content">
    <div class="page-header">
      <button class="back-btn" onclick="navigate('${homeRoute}')">→ ${t('back')||'رجوع'}</button>
      <h1>${t('settings_title')}</h1>
    </div>

    <div class="ph9-settings">

      ${u.isActive === false ? `
      <!-- Inactive Account Banner -->
      <div class="ph9-card" style="border: 2px solid var(--rose); background: rgba(239,68,68,0.08);">
        <div style="display:flex; align-items:center; gap:14px; padding:4px 0;">
          <span style="font-size:36px">⏳</span>
          <div>
            <div style="font-weight:800; font-size:16px; color:var(--rose)">حسابك قيد المراجعة</div>
            <div style="color:var(--text-secondary); font-size:14px; margin-top:4px">
              تم إرسال طلب تفعيل حسابك للإدارة. ستصلك رسالة إشعار بمجرد تفعيله.
            </div>
          </div>
        </div>
      </div>` : ''}

      <!-- Profile header card with avatar -->
      <div class="ph9-card ph9-profile-head">
        <div class="ph9-avatar-wrap">
          <div class="ph9-avatar" id="ph9-avatar-preview">
            ${u.photoBase64 ? `<img src="${u.photoBase64}" alt="">` : `<span>${(u.name||u.email||'؟').charAt(0).toUpperCase()}</span>`}
          </div>
          <button class="ph9-avatar-edit" onclick="document.getElementById('ph9-photo-input').click()" title="${t('change_photo')}">📷</button>
          <input type="file" id="ph9-photo-input" accept="image/*" hidden onchange="ph9_uploadPhoto(this)">
        </div>
        <div class="ph9-profile-meta">
          <div class="ph9-profile-name">${escHtml(u.name || 'مستخدم')}</div>
          <div class="ph9-profile-sub">${escHtml(u.email || '')}</div>
          <span class="badge badge-purple" style="margin-top:8px">${roleLabels[u.role] || u.role}</span>
          ${u.isActive === false ? '<span class="badge badge-rose" style="margin-top:4px; margin-right:6px">⏳ قيد المراجعة</span>' : '<span class="badge badge-teal" style="margin-top:4px; margin-right:6px">✅ مفعّل</span>'}
        </div>
        <div class="ph9-profile-actions">
          ${u.photoBase64 ? `<button class="ph9-link-btn" onclick="ph9_removePhoto()">${t('remove_photo')}</button>` : ''}
        </div>
      </div>

      ${u.role === 'customer' ? `
      <!-- Customer Quick Actions -->
      <div class="ph9-card">
        <div class="ph9-card-head"><h3>⚡ الإجراءات السريعة</h3></div>
        <div>
          <button onclick="ph9_showRegionPicker()" class="app-setting-item">
            <div class="app-setting-icon blue">🗺️</div>
            <div class="app-setting-content">
              <div class="app-setting-title">تغيير المنطقة</div>
              <div class="app-setting-sub">حالياً: <strong>${region ? escHtml(region.name) : 'جميع المناطق'}</strong></div>
            </div>
            <div class="app-setting-chev">←</div>
          </button>
          
          <button onclick="typeof ph41_showAddressBook === 'function' && ph41_showAddressBook()" class="app-setting-item">
            <div class="app-setting-icon green">📍</div>
            <div class="app-setting-content">
              <div class="app-setting-title">عناوينك المحفوظة</div>
              <div class="app-setting-sub">إدارة عناوين التوصيل الخاصة بك</div>
            </div>
            <div class="app-setting-chev">←</div>
          </button>
        </div>
      </div>` : ''}

      <!-- Locked personal info (name/age/gender) -->
      <div class="ph9-card">
        <div class="ph9-card-head">
          <h3>👤 المعلومات الشخصية</h3>
          ${u.role === 'admin' ? `<button class="btn btn-sm btn-secondary" onclick="ph9_toggleAdminEdit()" id="ph9-admin-edit-btn">🔓 تعديل المقيّدة</button>` : ''}
        </div>

        <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); border-radius:10px; padding:12px 16px; margin-bottom:16px; font-size:13px; color:#d97706;">
          🔒 الاسم والعمر والجنس لا يمكن تغييرها بعد إنشاء الحساب. تواصل مع الإدارة إذا كان هناك خطأ.
        </div>

        <div class="ph9-grid-2">
          <div class="ph9-info-row-field">
            <label class="form-label">الاسم الكامل 🔒</label>
            <div class="ph9-locked-field">${escHtml(u.name||'—')}</div>
          </div>
          <div class="ph9-info-row-field">
            <label class="form-label">الجنس 🔒</label>
            <div class="ph9-locked-field">${u.gender === 'male' ? 'ذكر 👨' : u.gender === 'female' ? 'أنثى 👩' : '—'}</div>
          </div>
          <div class="ph9-info-row-field">
            <label class="form-label">العمر 🔒</label>
            <div class="ph9-locked-field">${u.age ? u.age + ' سنة' : '—'}</div>
          </div>
          <div class="ph9-info-row-field">
            <label class="form-label">${t('region_label')}</label>
            <select class="form-control" id="ph9-region">
              <option value="">— ${t('region_label')} —</option>
              ${(AppData.regions||[]).filter(r=>r.active!==false).map(r =>
                `<option value="${r.id}"${u.regionId===r.id?' selected':''}>${escHtml(r.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Admin-only editable fields (hidden by default) -->
        <div id="ph9-admin-locked-fields" style="display:none; margin-top:16px; border-top:1px solid var(--border); padding-top:16px;">
          <div style="color:var(--gold); font-weight:700; margin-bottom:12px">🔓 تعديل المدير — هذه الحقول مقيّدة للمستخدمين العاديين</div>
          <div class="ph9-grid-2">
            <div class="form-group">
              <label class="form-label">الاسم الكامل</label>
              <input class="form-control" id="ph9-name-admin" value="${escAttr(u.name||'')}">
            </div>
            <div class="form-group">
              <label class="form-label">العمر</label>
              <input class="form-control" id="ph9-age-admin" type="number" min="10" max="100" value="${u.age||''}">
            </div>
            <div class="form-group">
              <label class="form-label">الجنس</label>
              <select class="form-control" id="ph9-gender-admin">
                <option value="">—</option>
                <option value="male" ${u.gender==='male'?'selected':''}>ذكر</option>
                <option value="female" ${u.gender==='female'?'selected':''}>أنثى</option>
              </select>
            </div>
          </div>
          <button class="btn btn-warning" onclick="ph9_adminSaveLockedFields()">💾 حفظ التعديلات المقيّدة</button>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
          <button class="btn btn-primary" onclick="ph9_saveProfile()">💾 ${t('save_changes')}</button>
        </div>
      </div>

      <!-- Phone number (changeable with OTP) -->
      <div class="ph9-card">
        <div class="ph9-card-head"><h3>📱 رقم الجوال</h3></div>
        <button class="app-setting-item" onclick="ph9_startPhoneChange()">
          <div class="app-setting-icon orange">📱</div>
          <div class="app-setting-content">
            <div class="app-setting-title" style="direction:ltr; text-align:right;">${escHtml(u.phone||'لم يُضف بعد')}</div>
            <div class="app-setting-sub">انقر هنا لتغيير رقم الجوال المرتبط بالحساب</div>
          </div>
          <div class="app-setting-chev">←</div>
        </button>
      </div>

      <!-- Secondary phone (optional, no OTP required) -->
      <div class="ph9-card">
        <div class="ph9-card-head"><h3>📞 ${t('phone2_label')}</h3></div>
        <div style="margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--bg-card,rgba(255,255,255,0.03));border:1.5px solid var(--glass-border,rgba(255,255,255,0.08));border-radius:14px;">
            <span style="font-size:22px">📞</span>
            <div style="flex:1">
              <div style="font-size:15px;font-weight:700;direction:ltr;text-align:right">${escHtml(u.phone2||'—')}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:3px">${t('phone2_hint')}</div>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="ph9_editPhone2()">
            ${u.phone2 ? t('phone2_edit') : t('phone2_add')}
          </button>
          ${u.phone2 ? `<button class="btn btn-sm" style="background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.25)" onclick="ph9_removePhone2()">${t('phone2_remove')}</button>` : ''}
        </div>
      </div>

      <!-- Account info (read-only) -->
      <div class="ph9-card">
        <div class="ph9-card-head"><h3>📋 ${t('account_section')}</h3></div>
        <div class="ph9-info-row">
          <span>${t('email_label')}</span>
          <strong>${escHtml(u.email||'—')}</strong>
        </div>
        <div class="ph9-info-row">
          <span>${t('role_label')}</span>
          <strong>${roleLabels[u.role] || u.role}</strong>
        </div>
        <div class="ph9-hint" style="margin-top:6px">${t('email_readonly')}</div>
      </div>

      <!-- Verification Status -->
      <div class="ph9-card" id="verification-card">
        <div class="ph9-card-head"><h3>✅ حالة التوثيق</h3></div>
        
        <div class="ph9-info-row" style="align-items:center;">
          <div>
            <span style="font-size:18px;margin-left:8px">📱</span> 
            <span>توثيق رقم الجوال:</span>
          </div>
          <div>
            ${u.phoneVerified 
              ? '<span class="badge badge-success" style="font-size:14px;background:#10b981">✅ موثّق</span>' 
              : '<button class="btn btn-sm" style="background:var(--gold);color:#000" onclick="startVerification(\'phone\')">توثيق الآن</button> <span class="badge badge-rose" style="font-size:14px;margin-right:8px">❌ غير موثّق</span>'}
          </div>
        </div>

        <div class="ph9-info-row" style="align-items:center; margin-top:12px">
          <div>
            <span style="font-size:18px;margin-left:8px">📧</span> 
            <span>توثيق البريد الإلكتروني:</span>
          </div>
          <div>
            ${u.emailVerified 
              ? '<span class="badge badge-success" style="font-size:14px;background:#10b981">✅ موثّق</span>' 
              : '<button class="btn btn-sm" style="background:var(--gold);color:#000" onclick="startVerification(\'email\')">توثيق الآن</button> <span class="badge badge-rose" style="font-size:14px;margin-right:8px">❌ غير موثّق</span>'}
          </div>
        </div>
        ${(!u.phoneVerified) ? '<div class="ph9-hint" style="margin-top:12px; color:var(--rose)">⚠️ توثيق رقم الجوال إجباري للتمكن من الشراء وحجز الخدمات. البريد الإلكتروني اختياري ولكنه ينصح به لزيادة الأمان.</div>' : ''}
      </div>

      <!-- Password -->
      <div class="ph9-card">
        <div class="ph9-card-head"><h3>🔒 ${t('password_section')}</h3></div>
        <button class="btn btn-secondary btn-block" onclick="showChangePasswordModal()">🔐 ${t('change_password')}</button>
      </div>

      <!-- Language -->
      <div class="ph9-card">
        <div class="ph9-card-head"><h3>🌐 ${t('language_section')}</h3></div>
        <div class="ph9-lang-row">
          <button class="ph9-lang-btn${lang==='ar'?' on':''}" onclick="ph9_setLang('ar')">
            <span class="ph9-lang-ic">🇸🇦</span><span>العربية</span>
          </button>
          <button class="ph9-lang-btn${lang==='en'?' on':''}" onclick="ph9_setLang('en')">
            <span class="ph9-lang-ic">🇬🇧</span><span>English</span>
          </button>
        </div>
      </div>

      <!-- Theme -->
      <div class="ph9-card">
        <div class="ph9-card-head"><h3>🎨 ${t('theme_section')}</h3></div>
        <div class="ph9-toggle-row">
          <div>
            <div class="ph9-toggle-title">${dark ? t('theme_dark') : t('theme_light')}</div>
            <div class="ph9-hint">${dark ? 'حفاظاً على راحة عينيك في الإضاءة المنخفضة' : 'مظهر فاتح وواضح في الأماكن المضيئة'}</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" ${dark?'checked':''} onchange="toggleTheme()">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- Security / 2FA -->
      <div class="ph9-card">
        <div class="ph9-card-head"><h3>🛡️ ${t('security_section')}</h3></div>
        <div class="ph9-toggle-row">
          <div>
            <div class="ph9-toggle-title">${t('twofa_label')}</div>
            <div class="ph9-hint">${is2FA ? t('twofa_on') : t('twofa_off')}</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" ${is2FA?'checked':''} onchange="toggle2FA()">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- Logout -->
      <div class="ph9-card">
        <div class="ph9-card-head"><h3>🚪 ${t('logout_section')}</h3></div>
        <button class="btn btn-danger btn-block" onclick="logoutConfirm()">${t('logout_btn')}</button>
      </div>

    </div>
  </div>`;
};

// ════════════════════════════════════════════════════════════
//  3) Save profile fields (only non-locked fields)
// ════════════════════════════════════════════════════════════
window.ph9_saveProfile = async function () {
  const u = State.currentUser;
  if (!u) return;
  // Only save region (name, age, gender are locked)
  const regionId = document.getElementById('ph9-region')?.value || null;

  try {
    await fsUpdate('users', u.uid, { regionId });
    State.currentUser = { ...u, regionId };
    toast(t('saved_ok'), 'success');
    await render();
  } catch (e) {
    toast('تعذّر الحفظ: ' + (e.message || e), 'error');
  }
};

// Admin-only: toggle locked fields editor
window.ph9_toggleAdminEdit = function () {
  const panel = document.getElementById('ph9-admin-locked-fields');
  const btn = document.getElementById('ph9-admin-edit-btn');
  if (!panel) return;
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    if (btn) btn.textContent = '🔒 إخفاء';
  } else {
    panel.style.display = 'none';
    if (btn) btn.textContent = '🔓 تعديل المقيّدة';
  }
};

// Admin-only: save the locked fields
window.ph9_adminSaveLockedFields = async function () {
  const u = State.currentUser;
  if (!u || u.role !== 'admin') { toast('غير مصرح', 'error'); return; }
  const name = document.getElementById('ph9-name-admin')?.value.trim();
  const age = parseInt(document.getElementById('ph9-age-admin')?.value) || null;
  const gender = document.getElementById('ph9-gender-admin')?.value || null;
  if (!name) { toast('الاسم مطلوب', 'error'); return; }
  try {
    await fsUpdate('users', u.uid, { name, age, gender });
    State.currentUser = { ...u, name, age, gender };
    toast('✅ تم حفظ التعديلات المقيّدة', 'success');
    await render();
  } catch (e) {
    toast('تعذّر الحفظ: ' + (e.message || e), 'error');
  }
};

// ════════════════════════════════════════════════════════════
//  3b) Phone change with OTP verification
// ════════════════════════════════════════════════════════════
window.ph9_startPhoneChange = function () {
  const u = State.currentUser;
  if (!u) return;
  let ph9ChangeOTP = null;
  let ph9ChangePending = null;

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📱 تغيير رقم الجوال</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <p style="color:var(--text-secondary); margin-bottom:20px">
      الرقم الحالي: <strong style="direction:ltr; display:inline-block">${escHtml(u.phone||'—')}</strong>
    </p>
    <div class="form-group">
      <label class="form-label">الرقم الجديد</label>
      <div style="display:flex; gap:8px">
        <input class="form-control" id="ph9-new-phone" type="tel" placeholder="+9677..." style="flex:1">
        <button class="btn btn-primary" onclick="ph9_sendPhoneOTP()">إرسال رمز</button>
      </div>
    </div>
    <div id="ph9-phone-otp-row" style="display:none; margin-top:12px">
      <div class="form-group">
        <label class="form-label">رمز التحقق (4 أرقام)</label>
        <input class="form-control" id="ph9-phone-otp" type="number" placeholder="••••" 
               style="text-align:center; font-size:24px; letter-spacing:8px; font-weight:bold">
      </div>
      <button class="btn btn-primary btn-block" onclick="ph9_confirmPhoneOTP()" style="margin-top:12px">
        ✅ تأكيد الرمز وحفظ الرقم الجديد
      </button>
      <p id="ph9-phone-otp-err" style="color:var(--rose); margin-top:10px; display:none">❌ الرمز غير صحيح</p>
    </div>
  `);
};

window.ph9_sendPhoneOTP = async function () {
  const phone = document.getElementById('ph9-new-phone').value.trim();
  if (!phone || phone.length < 7) { toast('أدخل رقم هاتف صالح', 'error'); return; }
  
  showLoader('جاري التحقق من رقم الهاتف...');
  try {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const formattedPhone = typeof formatPhoneNumber === 'function' ? formatPhoneNumber(phone) : phone;
    const currentUid = State.currentUser?.uid;
    
    const snap1 = await db.collection('users').where('phone', '==', phone).limit(1).get();
    let isDup = false;
    if (!snap1.empty && snap1.docs[0].id !== currentUid) {
      isDup = true;
    }
    if (!isDup && cleanPhone !== phone) {
      const snap2 = await db.collection('users').where('phone', '==', cleanPhone).limit(1).get();
      if (!snap2.empty && snap2.docs[0].id !== currentUid) {
        isDup = true;
      }
    }
    if (!isDup && formattedPhone !== phone && formattedPhone !== cleanPhone) {
      const snap3 = await db.collection('users').where('phone', '==', formattedPhone).limit(1).get();
      if (!snap3.empty && snap3.docs[0].id !== currentUid) {
        isDup = true;
      }
    }
    if (isDup) {
      hideLoader();
      toast('رقم الجوال هذا مسجل بالفعل في حساب آخر.', 'error');
      return;
    }
  } catch (checkErr) {
    console.warn('Error checking phone uniqueness in settings:', checkErr);
  }
  
  window.__ph9_changeOTP = String(Math.floor(1000 + Math.random() * 9000));
  window.__ph9_changePending = phone;
  document.getElementById('ph9-phone-otp-row').style.display = 'block';
  hideLoader();
  toast('تم إرسال رمز التحقق إلى رقم هاتفك.', 'info');
};

window.ph9_confirmPhoneOTP = async function () {
  const code = document.getElementById('ph9-phone-otp').value.trim();
  const err = document.getElementById('ph9-phone-otp-err');
  if (code !== window.__ph9_changeOTP) {
    err.style.display = 'block';
    return;
  }
  err.style.display = 'none';
  const u = State.currentUser;
  showLoader('جاري تحديث رقم الجوال...');
  try {
    await fsUpdate('users', u.uid, { phone: window.__ph9_changePending, phoneVerified: true });
    State.currentUser = { ...u, phone: window.__ph9_changePending, phoneVerified: true };
    hideLoader();
    closeModal();
    toast('✅ تم تغيير رقم الجوال بنجاح!', 'success');
    await render();
  } catch (e) {
    hideLoader();
    toast('تعذّر الحفظ: ' + (e.message || e), 'error');
  }
};

// ════════════════════════════════════════════════════════════
//  3c) Secondary phone — add / edit / remove (no OTP needed)
// ════════════════════════════════════════════════════════════
window.ph9_editPhone2 = function () {
  const u = State.currentUser;
  if (!u) return;
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📞 ${u.phone2 ? t('phone2_edit') : t('phone2_add')}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <p style="color:var(--text-secondary); margin-bottom:16px; font-size:13px; line-height:1.7">
      ${t('phone2_hint')}
    </p>
    <div class="form-group">
      <label class="form-label">رقم الهاتف الإضافي</label>
      <div style="display:flex; gap:8px">
        <input class="form-control" id="ph9-phone2-input" type="tel" placeholder="+9677..."
               value="${escAttr(u.phone2||'')}" style="flex:1; direction:ltr; text-align:right">
      </div>
    </div>
    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:10px 14px;font-size:12px;color:#d97706;margin-bottom:16px">
      ℹ️ هذا الرقم اختياري ولا يُستخدم لتسجيل الدخول — للتواصل الاحتياطي فقط.
    </div>
    <button class="btn btn-primary btn-block" onclick="ph9_savePhone2()">
      💾 حفظ الرقم الإضافي
    </button>
  `);
  // Focus input
  setTimeout(() => { document.getElementById('ph9-phone2-input')?.focus(); }, 200);
};

window.ph9_savePhone2 = async function () {
  const phone2 = document.getElementById('ph9-phone2-input')?.value.trim();
  if (!phone2 || phone2.length < 7) { toast('أدخل رقم هاتف صالح (7 أرقام على الأقل)', 'error'); return; }
  const u = State.currentUser;
  showLoader('جاري الحفظ...');
  try {
    await fsUpdate('users', u.uid, { phone2 });
    State.currentUser = { ...u, phone2 };
    hideLoader();
    closeModal();
    toast('✅ تم حفظ رقم الهاتف الإضافي بنجاح!', 'success');
    await render();
  } catch (e) {
    hideLoader();
    toast('تعذّر الحفظ: ' + (e.message || e), 'error');
  }
};

window.ph9_removePhone2 = async function () {
  const u = State.currentUser;
  if (!u) return;
  if (!confirm('هل تريد حذف رقم الهاتف الإضافي؟')) return;
  showLoader('جاري الحذف...');
  try {
    await fsUpdate('users', u.uid, { phone2: firebase.firestore.FieldValue.delete() });
    const updated = { ...u };
    delete updated.phone2;
    State.currentUser = updated;
    hideLoader();
    toast('✅ تم حذف رقم الهاتف الإضافي', 'success');
    await render();
  } catch (e) {
    hideLoader();
    toast('تعذّر الحذف: ' + (e.message || e), 'error');
  }
};



// ════════════════════════════════════════════════════════════
//  4) Photo upload / removal
// ════════════════════════════════════════════════════════════
window.ph9_uploadPhoto = async function (input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { toast(t('photo_too_big'), 'error'); input.value=''; return; }
  try {
    const base64 = await (typeof fileToResizedBase64 === 'function'
      ? fileToResizedBase64(file, 360, 0.82)
      : ph9_fileToB64(file));
    const u = State.currentUser;
    await fsUpdate('users', u.uid, { photoBase64: base64 });
    State.currentUser = { ...u, photoBase64: base64 };
    // Show right away
    const prev = document.getElementById('ph9-avatar-preview');
    if (prev) prev.innerHTML = `<img src="${base64}" alt="">`;
    toast(t('saved_ok'), 'success');
    await render();
  } catch (e) {
    toast('تعذّر تحميل الصورة', 'error');
  } finally {
    input.value = '';
  }
};

window.ph9_removePhoto = async function () {
  const u = State.currentUser;
  if (!u) return;
  try {
    await fsUpdate('users', u.uid, { photoBase64: null });
    State.currentUser = { ...u, photoBase64: null };
    toast(t('saved_ok'), 'success');
    await render();
  } catch (e) {
    toast('تعذّر الحذف', 'error');
  }
};

function ph9_fileToB64(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = e => res(e.target.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

// ════════════════════════════════════════════════════════════
//  5) Language preference (also saves to user doc)
// ════════════════════════════════════════════════════════════
window.ph9_setLang = async function (lang) {
  if (typeof setLang === 'function') setLang(lang);
  const u = State.currentUser;
  if (u && u.uid) {
    try { await fsUpdate('users', u.uid, { prefLang: lang }); } catch (e) {}
  }
};

// On login, restore preferred language if saved
(function watchUserForLangPref() {
  let last = null;
  setInterval(() => {
    const u = State?.currentUser;
    if (!u || u.uid === last) return;
    last = u.uid;
    if (u.prefLang && typeof setLang === 'function' && getLang() !== u.prefLang) {
      setLang(u.prefLang);
    }
  }, 1500);
})();

// ─── Region Picker Modal (Hierarchical: Governorate → Region) ────
window.ph9_showRegionPicker = function () {
  const u = State.currentUser;
  if (!u) return;
  const regions   = (AppData.regions || []).filter(r => r.active !== false);
  const govs      = (AppData.deliveryGovernorates || []).filter(g => g.active !== false);

  if (!regions.length && !govs.length) {
    toast('لا توجد مناطق محددة بعد. تواصل مع الإدارة.', 'info');
    return;
  }

  const curRegId = u.regionId;
  const curGovId = u.govId;

  // Build grouped HTML: Governorates with their regions nested inside
  let groupedHtml = '';
  if (govs.length) {
    govs.forEach(g => {
      const govRegions = regions.filter(r => r.govId === g.id);
      if (!govRegions.length) return;
      groupedHtml += `
        <div style="margin-bottom:10px;">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;padding:4px 8px;background:rgba(139,92,246,0.07);border-radius:6px;margin-bottom:6px;">
            🏛️ ${escHtml(g.name)}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;padding-right:8px;">
            ${govRegions.map(r => `
              <div class="ph9-region-opt${curRegId === r.id ? ' ph9-region-sel' : ''}"
                   onclick="ph9_saveRegion('${r.id}','${g.id}')">
                <span>📍</span>
                <div class="ph9-region-opt-info">
                  <div style="font-weight:600">${escHtml(r.name)}</div>
                  ${r.desc ? `<div style="font-size:12px;color:var(--text-muted)">${escHtml(r.desc)}</div>` : ''}
                </div>
                <span class="ph9-region-check">${curRegId === r.id ? '✅' : ''}</span>
              </div>`).join('')}
          </div>
        </div>`;
    });
  } else {
    // Fallback: flat list (no governorates defined)
    groupedHtml = regions.map(r => `
      <div class="ph9-region-opt${curRegId === r.id ? ' ph9-region-sel' : ''}"
           onclick="ph9_saveRegion('${r.id}', null)">
        <span>📍</span>
        <div class="ph9-region-opt-info">
          <div style="font-weight:600">${escHtml(r.name)}</div>
          ${r.desc ? `<div style="font-size:12px;color:var(--text-muted)">${escHtml(r.desc)}</div>` : ''}
        </div>
        <span class="ph9-region-check">${curRegId === r.id ? '✅' : ''}</span>
      </div>`).join('');
  }

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">🗺️ اختر منطقتك</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;line-height:1.6">
      سيتم تصفية الخدمات والمتاجر لعرض ما هو متاح في منطقتك فقط.
    </p>
    <div style="display:flex;flex-direction:column;gap:4px">
      <div class="ph9-region-opt${!curRegId ? ' ph9-region-sel' : ''}" onclick="ph9_saveRegion(null, null)">
        <span>🌍</span>
        <div class="ph9-region-opt-info">
          <div style="font-weight:600">جميع المناطق</div>
          <div style="font-size:12px;color:var(--text-muted)">عرض كل الخدمات المتاحة</div>
        </div>
        <span class="ph9-region-check">${!curRegId ? '✅' : ''}</span>
      </div>
      ${groupedHtml}
    </div>`);
};

window.ph9_saveRegion = async function (regionId, govId) {
  const u = State.currentUser;
  if (!u) return;
  showLoader('جاري حفظ المنطقة...');
  try {
    let upd;
    if (regionId) {
      upd = { regionId };
      if (govId) upd.govId = govId;
    } else {
      upd = {
        regionId: firebase.firestore.FieldValue.delete(),
        govId:    firebase.firestore.FieldValue.delete()
      };
    }
    await fsUpdate('users', u.uid, upd);
    State.currentUser.regionId = regionId || null;
    State.currentUser.govId    = govId    || null;
    hideLoader();
    const regionName = regionId
      ? (AppData.regions || []).find(r => r.id === regionId)?.name || regionId
      : 'جميع المناطق';
    toast(`✅ تم تحديث منطقتك إلى: ${regionName}`, 'success');
    closeModal();
    await render();
  } catch (e) {
    hideLoader();
    toast('تعذّر الحفظ: ' + (e.message || e), 'error');
  }
};

// ─── Region picker styles ────────────────────────────────────
(function () {
  if (window.__ph9RegStyles) return;
  window.__ph9RegStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .ph9-region-opt { display:flex;align-items:center;gap:12px;background:var(--bg-card);border:2px solid var(--glass-border);border-radius:14px;padding:12px 16px;cursor:pointer;transition:all 0.15s; }
    .ph9-region-opt:hover { border-color:var(--primary); }
    .ph9-region-opt.ph9-region-sel { border-color:var(--primary);background:rgba(139,92,246,0.07); }
    .ph9-region-opt-info { flex:1; }
    .ph9-region-check { font-size:18px;min-width:20px; }
  `;
  document.head.appendChild(s);
})();

console.log('[Phase 9] Account settings + profile photo loaded.');

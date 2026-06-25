// ═══════════════════════════════════════════════════════
//  محجوز v2.1 — Extras (Phase 1)
//  - New login landing (3 cards) + full signup
//  - Regions admin
//  - Bank accounts admin
//  - Language switcher integration
// ═══════════════════════════════════════════════════════
'use strict';

// ───────────────────────────────────────────────────────
//  STATE — Signup wizard temporary data
// ───────────────────────────────────────────────────────
const SignupState = {
  geo: null,           // { lat, lng } when user picks on map
  phoneVerified: false,
  pendingOTP: null,    // 6-digit code we generated
  pendingPhone: null,
  role: null,          // selected role: customer | driver | vendor
};

// ───────────────────────────────────────────────────────
//  LOGIN — Modern Unified Landing Page
// ───────────────────────────────────────────────────────
function renderLoginPage() {
  // Reset Google Sign-in status if navigating back to login page
  SignupState.isGoogle = false;
  SignupState.googleUid = null;
  SignupState.email = null;
  SignupState.name = null;

  return `
  <div id="unified-login-page">
    <div class="login-bg-circle circle-1"></div>
    <div class="login-bg-circle circle-2"></div>

    <div class="login-topbar-absolute">${languageToggleHTML()}</div>

    <div class="unified-login-wrapper">

      <!-- Right Side: Info & Features (Hidden on mobile via CSS) -->
      <div class="login-info-side">
        <div class="login-info-content">
          <div class="login-brand-badge">✨ ${t('app_name')}</div>
          <h1 class="info-title">مرحباً بك في <span>${t('app_name')}</span></h1>
          <p class="info-desc">المنصة الشاملة التي تجمع كل ما تحتاجه في مكان واحد. احجز، تسوّق، واطلب الخدمات بطريقة عصرية وسهلة.</p>

          <div class="info-features">
            <div class="info-feature-item">
              <div class="feature-icon glass-icon">📅</div>
              <div>
                <h4>حجوزات سلسة</h4>
                <p>فنادق، مواعيد وفعاليات بضغطة زر</p>
              </div>
            </div>
            <div class="info-feature-item">
              <div class="feature-icon glass-icon">🏪</div>
              <div>
                <h4>متاجر متكاملة</h4>
                <p>آلاف المنتجات توصل لبابك</p>
              </div>
            </div>
            <div class="info-feature-item">
              <div class="feature-icon glass-icon">🔧</div>
              <div>
                <h4>خدمات مهنية</h4>
                <p>أفضل المهنيين الموثوقين</p>
              </div>
            </div>
            <div class="info-feature-item">
              <div class="feature-icon glass-icon">🚗</div>
              <div>
                <h4>توصيل سريع</h4>
                <p>توصيل آمن في أي وقت</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Left Side: Login Form (Fully responsive) -->
      <div class="login-form-side">
        <div class="login-form-container">
          <div class="form-header-area">
            <div class="login-logo-mini">🔐 تسجيل الدخول الآمن</div>
            <h2 class="form-title">أهلاً بك مجدداً</h2>
            <p class="form-subtitle">أدخل بياناتك للمتابعة أو استخدم الدخول بـ Google</p>
          </div>

          ${typeof renderBanners === 'function' ? renderBanners('login') : ''}

          <div class="form-group" style="margin-top:20px">
            <label class="form-label">البريد الإلكتروني أو رقم الجوال</label>
            <div class="input-with-icon">
              <span class="input-icon">👤</span>
              <input class="form-control" id="u-login-id" type="text" placeholder="البريد الإلكتروني أو الجوال..." autocomplete="username">
            </div>
          </div>

          <div class="form-group">
            <div class="pw-label-row">
              <label class="form-label" style="margin-bottom:0">كلمة المرور</label>
              <a href="javascript:;" class="forgot-pw-inline-link" onclick="navigate('forgot-password')">نسيت كلمة المرور؟</a>
            </div>
            <div class="input-with-icon">
              <span class="input-icon">🔒</span>
              <input class="form-control" id="u-login-pass" type="password" placeholder="••••••••" autocomplete="current-password">
              <button type="button" class="pass-toggle-btn" onclick="togglePasswordVisibility('u-login-pass', this)">👁️</button>
            </div>
          </div>

          <div id="login-lockout-banner" style="display:none" class="login-lockout-banner">
            🔒 تم تعليق تسجيل الدخول مؤقتاً بسبب محاولات متكررة.
            <span id="lockout-countdown"></span>
          </div>

          <button id="login-submit-btn" class="btn btn-primary btn-block btn-lg login-submit-btn" onclick="unifiedLogin()">
            دخول آمن للمنصة <span style="margin-inline-start:6px">🚀</span>
          </button>

          <button class="google-signin-btn" onclick="continueWithGoogle()">
            <svg class="google-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>المتابعة باستخدام Google</span>
          </button>

          <div class="login-links">
            <p>ليس لديك حساب؟ <a href="javascript:;" class="create-acc-link" onclick="navigate('signup')">إنشاء حساب جديد</a></p>
            <div class="divider"><span>أو</span></div>
            <a href="javascript:;" class="guest-link" onclick="enterGuest()">
              <span>👁️</span> الدخول كضيف لتصفح المنصة
            </a>
          </div>

          <!-- Drawer for Developer quick login -->
          <div class="dev-console-drawer">
            <details>
              <summary class="dev-console-summary">
                <span>🛠️ أدوات المطورين: الدخول السريع</span>
                <span class="dev-console-summary-arrow">▶</span>
              </summary>
              <div class="dev-console-content">
                <div class="dev-console-grid">
                  <div style="grid-column: span 2;">
                    ${quickBtn('admin','👑','نايف (المدير العام)','#f59e0b','#d97706')}
                  </div>
                  ${quickBtn('staff','🖥️','سعد (الموظف)','#6366f1','#4f46e5')}
                  ${quickBtn('provider','💼','سلمان (صاحب المهنة)','#8b5cf6','#7c3aed')}
                  ${quickBtn('vendor_service','🛎️','خالد (مزود الخدمات)','#7c3aed','#6d28d9')}
                  ${quickBtn('vendor_store','🏪','أحمد (مزود المتاجر)','#10b981','#059669')}
                  ${quickBtn('driver','🚗','ياسر (المندوب)','#0891b2','#0e7490')}
                  ${quickBtn('customer','👤','فيصل (العميل)','#0d9488','#0f766e')}
                </div>
              </div>
            </details>
          </div>

        </div>
      </div>

    </div>
  </div>`;
}

// ───────────────────────────────────────────────────────
//  FORGOT PASSWORD PAGE
// ───────────────────────────────────────────────────────
function renderForgotPasswordPage() {
  return `
  <div id="unified-login-page">
    <div class="login-bg-circle circle-1"></div>
    <div class="login-bg-circle circle-2"></div>
    <div class="login-topbar-absolute">${languageToggleHTML()}</div>

    <div class="unified-login-wrapper forgot-pw-wrapper">
      <!-- Right Side: Info -->
      <div class="login-info-side">
        <div class="login-info-content">
          <div class="login-brand-badge">🔑 استعادة الحساب</div>
          <h1 class="info-title">نسيت كلمة <span>المرور؟</span></h1>
          <p class="info-desc">لا تقلق! أدخل بريدك الإلكتروني أو رقم جوالك وسنرسل لك رابطاً لاستعادة كلمة المرور فوراً.</p>
          <div class="info-features">
            <div class="info-feature-item">
              <div class="feature-icon glass-icon">📧</div>
              <div><h4>عبر البريد الإلكتروني</h4><p>رابط استعادة يصل لصندوق الوارد خلال ثوانٍ</p></div>
            </div>
            <div class="info-feature-item">
              <div class="feature-icon glass-icon">📱</div>
              <div><h4>عبر رقم الجوال</h4><p>نبحث عن حسابك ونرسل الرابط لبريدك المسجل</p></div>
            </div>
            <div class="info-feature-item">
              <div class="feature-icon glass-icon">🔒</div>
              <div><h4>آمن وسريع</h4><p>الرابط صالح لمرة واحدة فقط لحماية حسابك</p></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Left Side: Form -->
      <div class="login-form-side">
        <div class="login-form-container">
          <div class="form-header-area">
            <div class="login-logo-mini">🔑 استعادة كلمة المرور</div>
            <h2 class="form-title">إعادة تعيين كلمة المرور</h2>
            <p class="form-subtitle">أدخل بريدك الإلكتروني أو رقم جوالك المسجل في المنصة</p>
          </div>

          <div id="forgot-pw-success" style="display:none" class="forgot-pw-success-box">
            <div class="forgot-pw-success-icon">✅</div>
            <h3>تم الإرسال بنجاح!</h3>
            <p id="forgot-pw-success-msg">تم إرسال رابط استعادة كلمة المرور.</p>
            <button class="btn btn-primary btn-block" onclick="navigate('login')" style="margin-top:16px">
              العودة لتسجيل الدخول
            </button>
          </div>

          <div id="forgot-pw-form">
            <div class="form-group" style="margin-top:20px">
              <label class="form-label">البريد الإلكتروني أو رقم الجوال</label>
              <div class="input-with-icon">
                <span class="input-icon">👤</span>
                <input class="form-control" id="forgot-pw-input" type="text"
                  placeholder="أدخل بريدك الإلكتروني أو رقم جوالك..."
                  autocomplete="email"
                  onkeydown="if(event.key==='Enter') sendPasswordReset()">
              </div>
            </div>

            <button class="btn btn-primary btn-block btn-lg login-submit-btn" onclick="sendPasswordReset()">
              إرسال رابط الاستعادة <span style="margin-inline-start:6px">📨</span>
            </button>

            <div class="login-links" style="margin-top:20px">
              <p><a href="javascript:;" class="create-acc-link" onclick="navigate('login')">← العودة لتسجيل الدخول</a></p>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>`;
}

window.sendPasswordReset = async function() {
  const input = document.getElementById('forgot-pw-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) {
    toast('يرجى إدخال البريد الإلكتروني أو رقم الجوال', 'error');
    input.focus();
    return;
  }

  showLoader('جاري إرسال رابط الاستعادة...');
  try {
    let emailToUse = val;

    if (!val.includes('@')) {
      const snap = await db.collection('users').where('phone', '==', val).limit(1).get();
      if (snap.empty) {
        throw new Error('لم يتم العثور على حساب مرتبط برقم الجوال هذا.');
      }
      emailToUse = snap.docs[0].data().email;
      if (!emailToUse) {
        throw new Error('هذا الحساب لا يحتوي على بريد إلكتروني صالح لإعادة التعيين.');
      }
    }

    await auth.sendPasswordResetEmail(emailToUse);

    hideLoader();
    const form = document.getElementById('forgot-pw-form');
    const success = document.getElementById('forgot-pw-success');
    const msg = document.getElementById('forgot-pw-success-msg');
    if (form) form.style.display = 'none';
    if (success) success.style.display = 'flex';
    if (msg) msg.textContent = `تم إرسال رابط استعادة كلمة المرور إلى: ${emailToUse}`;
    toast('تم إرسال رابط الاستعادة بنجاح! تحقق من بريدك الإلكتروني 📧', 'success');

  } catch (err) {
    hideLoader();
    console.error('Password reset error:', err);
    let msg = 'حدث خطأ، يرجى المحاولة مرة أخرى.';
    if (err.code === 'auth/user-not-found') msg = 'لا يوجد حساب مسجل بهذا البريد الإلكتروني.';
    else if (err.code === 'auth/invalid-email') msg = 'البريد الإلكتروني غير صالح.';
    else if (err.code === 'auth/too-many-requests') msg = 'طلبات كثيرة، يرجى الانتظار قليلاً والمحاولة مجدداً.';
    else if (err.message) msg = err.message;
    toast(msg, 'error');
  }
};

function quickBtn(role, icon, label, c1, c2) {
  return `<button class="quick-demo-btn" style="background:linear-gradient(135deg,${c1},${c2})" onclick="quickLogin('${role}')">
    <span style="font-size:16px">${icon}</span> ${label}</button>`;
}

// Password toggle helper
window.togglePasswordVisibility = function(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = '🙈';
  } else {
    input.type = 'password';
    btn.innerHTML = '👁️';
  }
};
// Google Sign-In helper
window.continueWithGoogle = async function() {
  showLoader('جاري الاتصال بجوجل...');
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    if (!user) throw new Error('فشل تسجيل الدخول عبر جوجل.');

    // Check if user profile already exists in Firestore
    const userDoc = await fsGet('users', user.uid);
    
    if (userDoc) {
      toast('تم تسجيل الدخول بنجاح! ✅', 'success');
      setTimeout(async () => {
        closeModal();
        hideLoader();
        await render();
      }, 800);
    } else {
      // New user! Store Google profile details
      SignupState.isGoogle = true;
      SignupState.googleUid = user.uid;
      SignupState.email = user.email || '';
      SignupState.name = user.displayName || '';
      
      toast('مرحباً بك! يرجى استكمال بيانات حسابك 👤', 'success');
      setTimeout(() => {
        hideLoader();
        navigate('signup');
      }, 1000);
    }
  } catch (err) {
    hideLoader();
    console.error("Google Auth Error:", err);
    
    const errMsg = err.message || String(err);
    const errCode = err.code || '';
    
    if (errCode === 'auth/unauthorized-domain' || errMsg.includes('unauthorized-domain') || errMsg.includes('not authorized to run this operation')) {
      openModal(`
        <div class="modal-header" style="border-bottom:1px solid var(--border);padding-bottom:12px">
          <h2 class="modal-title" style="color:#f43f5e;display:flex;align-items:center;gap:8px">⚠️ نطاق غير معتمد (Firebase Auth Error)</h2>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body" style="padding: 20px 0; line-height: 1.8; text-align: right; direction: rtl;">
          <p style="color: var(--text-main); font-weight: 700; font-size: 16px; margin-bottom: 12px;">نطاق التشغيل الحالي <code>${window.location.hostname}</code> غير مصرح له باستخدام تسجيل الدخول بجوجل.</p>
          
          <div style="background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 24px; color: #f43f5e; font-size: 14px;">
            تتطلب خدمات Google OAuth استخدام نطاق مصرح به ومسجل مسبقاً في Firebase Console. بشكل افتراضي، تدعم المنصة نطاق <code>localhost</code>.
          </div>

          <h3 style="font-size: 15px; color: var(--primary); margin-bottom: 8px; font-weight:700">💡 الحل السريع والمباشر (موصى به):</h3>
          <p style="margin-bottom: 24px; font-size:14px; color: var(--text-secondary)">
            يرجى فتح وتصفح الموقع عبر الرابط التالي بدلاً من استخدام العنوان الحالي <code>127.0.0.1</code>:<br>
            <a href="http://localhost:5001/?page=login" style="display: inline-block; background: var(--primary); color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 700; margin-top: 10px; box-shadow: var(--shadow-sm); transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">🌐 فتح عبر localhost:5001</a>
          </p>

          <h3 style="font-size: 15px; color: var(--primary); margin-bottom: 8px; font-weight:700">🛠️ الحل الآخر (في لوحة تحكم Firebase):</h3>
          <p style="font-size: 13.5px; color: var(--text-muted); margin: 0; line-height:1.6">
            إذا كنت بحاجة للعمل على عنوان <code>127.0.0.1</code>، يجب عليك إضافته كـ <strong>Authorized Domain</strong>:<br>
            توجه إلى: <code>Firebase Console -> Authentication -> Settings -> Authorized Domains</code> ثم اضغط على <strong>Add Domain</strong> وأضف <code>127.0.0.1</code>.
          </p>
        </div>
      `);
      return;
    }
    
    const googleErrMap = {
      'auth/popup-closed-by-user':   'تم إغلاق نافذة جوجل، يرجى المحاولة مجدداً.',
      'auth/popup-blocked':          'تم حجب النافذة المنبثقة، يرجى السماح بها في المتصفح.',
      'auth/account-exists-with-different-credential': 'يوجد حساب بهذا البريد بطريقة دخول مختلفة.',
      'auth/network-request-failed': 'فشل الاتصال بالشبكة، تحقق من اتصالك بالإنترنت.',
      'auth/too-many-requests':      'محاولات كثيرة جداً، يرجى الانتظار قليلاً.',
      'auth/user-disabled':          'هذا الحساب موقوف، يرجى التواصل مع الإدارة.',
      'auth/cancelled-popup-request':'تم إلغاء الطلب، يرجى المحاولة مجدداً.',
    };
    toast(googleErrMap[errCode] || 'حدث خطأ أثناء تسجيل الدخول بجوجل، يرجى المحاولة مجدداً.', 'error');
  }
};

// ───────────────────────────────────────────────────────
//  LOGIN LOCKOUT HELPERS
// ───────────────────────────────────────────────────────
const _LOCKOUT_MAX = 5;
const _LOCKOUT_MS  = 15 * 60 * 1000; // 15 دقيقة

function _getLockData(key) {
  try { return JSON.parse(localStorage.getItem('_mlk_' + key) || '{"count":0,"until":0}'); }
  catch { return { count: 0, until: 0 }; }
}
function _setLockData(key, data) {
  localStorage.setItem('_mlk_' + key, JSON.stringify(data));
}
function _clearLockData(key) {
  localStorage.removeItem('_mlk_' + key);
}

let _lockTimer = null;
function _startLockCountdown(until) {
  const banner   = document.getElementById('login-lockout-banner');
  const countdown = document.getElementById('lockout-countdown');
  const btn       = document.getElementById('login-submit-btn');
  if (!banner || !btn) return;

  banner.style.display = 'flex';
  btn.disabled = true;
  btn.style.opacity = '0.5';

  clearInterval(_lockTimer);
  _lockTimer = setInterval(() => {
    const left = until - Date.now();
    if (left <= 0) {
      clearInterval(_lockTimer);
      if (banner) banner.style.display = 'none';
      if (countdown) countdown.textContent = '';
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
      return;
    }
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    if (countdown) countdown.textContent = ` انتظر ${m}:${String(s).padStart(2,'0')} دقيقة`;
  }, 1000);
}

// ───────────────────────────────────────────────────────
//  UNIFIED LOGIN LOGIC
// ───────────────────────────────────────────────────────
async function unifiedLogin() {
  const loginId = document.getElementById('u-login-id').value.trim();
  const pass    = document.getElementById('u-login-pass').value;

  if (!loginId || !pass) {
    toast('يرجى إدخال البريد الإلكتروني/رقم الجوال وكلمة المرور', 'error');
    return;
  }

  // ── فحص القفل المؤقت ──
  const lockKey  = loginId.toLowerCase();
  const lockData = _getLockData(lockKey);
  if (lockData.until > Date.now()) {
    _startLockCountdown(lockData.until);
    toast('🔒 الحساب مقفل مؤقتاً بسبب محاولات متكررة. حاول لاحقاً.', 'error');
    return;
  }

  showLoader('جاري تسجيل الدخول...');

  try {
    let emailToUse = loginId;

    if (!loginId.includes('@')) {
      const snap = await db.collection('users').where('phone', '==', loginId).limit(1).get();
      if (snap.empty) throw new Error('لم يتم العثور على حساب مرتبط برقم الجوال هذا.');
      emailToUse = snap.docs[0].data().email;
      if (!emailToUse) throw new Error('هذا الحساب لا يحتوي على بريد إلكتروني صالح.');
    }

    const cred = await auth.signInWithEmailAndPassword(emailToUse, pass);

    // ✅ نجح الدخول — أعد عداد المحاولات
    _clearLockData(lockKey);

    // ── جلب بيانات المستخدم ──
    const snap2 = await db.collection('users').doc(cred.user.uid).get();
    const ud    = snap2.data();
    if (!ud) throw new Error('بيانات الحساب غير موجودة في النظام.');

    // ── إرسال OTP وتحويل لصفحة التحقق ──
    hideLoader();
    State.tempUserData = { uid: cred.user.uid, ...ud };
    State.awaitingOTP  = true;
    await send2FAOTP(cred.user.uid, ud.email, ud.phone);
    await navigate('verify2fa');

  } catch (err) {
    hideLoader();
    console.error('Login Error:', err);

    const isAuthErr = err.code && (
      err.code === 'auth/wrong-password'    ||
      err.code === 'auth/user-not-found'    ||
      err.code === 'auth/invalid-credential'||
      err.code === 'auth/invalid-email'
    );

    if (isAuthErr) {
      const ld = _getLockData(lockKey);
      ld.count = (ld.count || 0) + 1;
      if (ld.count >= _LOCKOUT_MAX) {
        ld.until = Date.now() + _LOCKOUT_MS;
        _setLockData(lockKey, ld);
        _startLockCountdown(ld.until);
        toast(`🔒 تم تعليق الحساب مؤقتاً لمدة 15 دقيقة بعد ${_LOCKOUT_MAX} محاولات فاشلة.`, 'error');
        return;
      }
      _setLockData(lockKey, ld);
      const remaining = _LOCKOUT_MAX - ld.count;
      const msgs = {
        'auth/user-not-found':     'البريد الإلكتروني غير مسجل.',
        'auth/wrong-password':     'كلمة المرور خاطئة.',
        'auth/invalid-credential': 'بيانات الدخول غير صحيحة.',
        'auth/invalid-email':      'صيغة البريد الإلكتروني غير صحيحة.',
      };
      toast(`${msgs[err.code] || 'بيانات غير صحيحة.'} — تبقّى ${remaining} محاولة قبل القفل.`, 'error');
    } else {
      const otherErrs = {
        'auth/too-many-requests':      'محاولات كثيرة جداً، يرجى الانتظار ثم المحاولة مجدداً.',
        'auth/network-request-failed': 'فشل الاتصال بالشبكة، تحقق من اتصالك بالإنترنت.',
        'auth/user-disabled':          'هذا الحساب موقوف، يرجى التواصل مع الإدارة.',
        'auth/popup-closed-by-user':   'تم إغلاق نافذة تسجيل الدخول، يرجى المحاولة مجدداً.',
        'auth/popup-blocked':          'تم حجب النافذة المنبثقة، يرجى السماح بها في المتصفح.',
        'auth/requires-recent-login':  'يرجى تسجيل الدخول مجدداً للمتابعة.',
        'auth/internal-error':         'خطأ داخلي، يرجى المحاولة مجدداً.',
      };
      const fallback = otherErrs[err.code] || 'حدث خطأ، يرجى المحاولة مرة أخرى.';
      toast(fallback, 'error');
    }
  }
}


// ───────────────────────────────────────────────────────
//  SIGNUP MODAL — full form
// ───────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────
//  SIGNUP — Full Page (Step 1: Role Selection)
// ────────────────────────────────────────────────────────────
function renderSignupPage() {
  SignupState.geo = null;
  SignupState.phoneVerified = false;
  SignupState.pendingOTP = null;
  SignupState.pendingPhone = null;
  SignupState.role = null;

  return `
  <div id="unified-login-page">
    <div class="login-bg-circle circle-1"></div>
    <div class="login-bg-circle circle-2"></div>
    <div class="login-topbar-absolute">${languageToggleHTML()}</div>

    <div class="unified-login-wrapper signup-role-wrapper">

      <!-- Right: Info Side -->
      <div class="login-info-side">
        <div class="login-info-content">
          <div class="login-brand-badge">✨ ${t('app_name')}</div>
          <h1 class="info-title">انضم إلى <span>محجوز</span></h1>
          <p class="info-desc">منصتك الشاملة للحجوزات والخدمات — اختر دورك وابدأ رحلتك معنا في دقيقتين.</p>

          <!-- Progress Bar -->
          <div class="signup-progress-wrap">
            <div class="signup-progress-label">
              <span>الخطوة 1 من 2</span>
              <span>50%</span>
            </div>
            <div class="signup-progress-track">
              <div class="signup-progress-fill" style="width:50%"></div>
            </div>
          </div>

          <div class="info-features" style="margin-top:28px">
            <div class="info-feature-item">
              <div class="feature-icon glass-icon">🔐</div>
              <div><h4>حساب آمن ومحمي</h4><p>بيانات مشفرة وخصوصية تامة</p></div>
            </div>
            <div class="info-feature-item">
              <div class="feature-icon glass-icon">⚡</div>
              <div><h4>تسجيل خلال دقيقتين</h4><p>نموذج بسيط وسريع دون تعقيد</p></div>
            </div>
            <div class="info-feature-item">
              <div class="feature-icon glass-icon">🎯</div>
              <div><h4>تجربة مخصصة لك</h4><p>واجهة تتكيف مع دورك في المنصة</p></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Left: Role Selection -->
      <div class="login-form-side">
        <div class="login-form-container" style="max-width:460px">

          <div class="form-header-area">
            <div class="login-logo-mini">📋 الخطوة 1 من 2</div>
            <h2 class="form-title">ما هي صفتك في المنصة؟</h2>
            <p class="form-subtitle">اختر دورك لنخصّص تجربتك ونوجهك بشكل صحيح</p>
          </div>

          <div class="signup-role-cards-list">

            <button class="signup-role-card-v2" onclick="renderSignupFormPage('customer')">
              <div class="src-v2-top-row">
                <div class="src-v2-icon-wrap" style="background:linear-gradient(135deg,#0ea5e9,#0284c7)">👤</div>
                <div class="src-v2-body">
                  <div class="src-v2-name">عميل</div>
                  <div class="src-v2-desc">أبحث عن خدمات وأطلبها</div>
                </div>
                <div class="src-v2-arrow">←</div>
              </div>
              <div class="src-v2-features">
                <span>🛒 طلبات</span>
                <span>📦 توصيل</span>
                <span>⭐ تقييم</span>
              </div>
            </button>

            <button class="signup-role-card-v2" onclick="renderSignupFormPage('driver')">
              <div class="src-v2-top-row">
                <div class="src-v2-icon-wrap" style="background:linear-gradient(135deg,#10b981,#059669)">🚗</div>
                <div class="src-v2-body">
                  <div class="src-v2-name">مندوب توصيل</div>
                  <div class="src-v2-desc">أوصّل الطلبات للعملاء وأكسب</div>
                </div>
                <div class="src-v2-arrow">←</div>
              </div>
              <div class="src-v2-features">
                <span>📍 تتبع</span>
                <span>💰 أرباح</span>
                <span>🗺️ مسارات</span>
              </div>
            </button>

            <button class="signup-role-card-v2" onclick="renderSignupFormPage('vendor')">
              <div class="src-v2-top-row">
                <div class="src-v2-icon-wrap" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed)">🏪</div>
                <div class="src-v2-body">
                  <div class="src-v2-name">مزود خدمة أو متجر</div>
                  <div class="src-v2-desc">أقدّم خدمات أو أبيع منتجات</div>
                </div>
                <div class="src-v2-arrow">←</div>
              </div>
              <div class="src-v2-features">
                <span>📊 لوحة تحكم</span>
                <span>🏷️ منتجات</span>
                <span>📈 إحصائيات</span>
              </div>
            </button>

          </div>

          <div class="login-links" style="margin-top:20px;text-align:center">
            <p>لديك حساب بالفعل؟ <a href="javascript:;" onclick="navigate('login')" class="create-acc-link">تسجيل الدخول</a></p>
          </div>

        </div>
      </div>

    </div>
  </div>`;
}

// Step 2: Registration Form Page
// Pre-fetch regions into AppData so the form has them ready
window._prefetchRegions = async function() {
  try {
    const [allZones, allGovs] = await Promise.all([
      fsGetAll('delivery_zones'),
      fsGetAll('delivery_governorates'),
    ]);
    AppData.deliveryZones = allZones;
    AppData.regions = allZones;
    AppData.deliveryGovernorates = allGovs;
  } catch(e) { console.warn('delivery_zones prefetch failed (will retry on signup):', e); }
};

window.openTermsModal = function() {
  const pages = AppData.pages || [];
  const termsPage = pages.find(p => p.id === 'terms');
  const content = termsPage && termsPage.active !== false 
    ? termsPage.content 
    : '<p style="color:var(--text-muted);text-align:center;">جاري تحديث سياسة الشروط والأحكام. يرجى مراجعة الإدارة.</p>';
    
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📄 سياسة الشروط والأحكام</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" style="padding:16px; max-height:60vh; overflow-y:auto; line-height:1.8;">
      ${content}
    </div>
    <button class="btn btn-primary btn-block" onclick="closeModal()" style="margin-top:16px;">إغلاق والمتابعة</button>
  `);
};

window.renderSignupFormPage = async function(role) {
  SignupState.role = role;
  const labels = { customer: 'عميل 👤', driver: 'مندوب توصيل 🚗', vendor: 'مزود خدمة 🏪' };
  
  // 1️⃣ Try AppData (set when user is already authenticated / pre-fetched at startup)
  let regions = (AppData.deliveryZones || []).filter(r => r.active !== false);
  
  // 2️⃣ Try fetching fresh from Firestore (works if rules allow public reads)
  if (regions.length === 0) {
    try {
      const allZones = await fsGetAll('delivery_zones');
      AppData.deliveryZones = allZones;
      AppData.regions = allZones;
      regions = allZones.filter(r => r.active !== false);
      if (allZones.length > 0) {
        try { localStorage.setItem('mahjooz_zones_cache', JSON.stringify(allZones)); } catch(e) {}
      }
    } catch(e) { 
      console.warn('Firestore delivery_zones fetch failed (may need auth):', e.message);
    }
  }

  // 3️⃣ Fallback: read from localStorage cache (set when admin was logged in)
  if (regions.length === 0) {
    try {
      const cached = localStorage.getItem('mahjooz_zones_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        AppData.deliveryZones = parsed;
        AppData.regions = parsed;
        regions = parsed.filter(r => r.active !== false);
        console.log('✅ Loaded delivery zones from localStorage cache:', regions.length);
      }
    } catch(e) { console.warn('localStorage zones cache read failed:', e); }
  }
  
  const regionOpts = regions.length
    ? regions.map(r => `<option value="${escAttr(r.name)}">${escHtml(r.name)}</option>`).join('')
    : `<option value="" disabled>⚠️ لا توجد مناطق — يرجى تسجيل الدخول أولاً كمدير وإضافة منطقة</option>`;

  document.getElementById('app').innerHTML = `
  <div id="unified-login-page">
    <div class="login-bg-circle circle-1"></div>
    <div class="login-bg-circle circle-2"></div>

    <div class="signup-full-wrapper signup-form-wrapper">
      <div class="signup-full-header">
        <button class="signup-back-btn" onclick="navigate('signup')">← تغيير الدور</button>
        <div class="signup-logo">✨ ${t('app_name')} — ${labels[role]}</div>
      </div>

      <div class="signup-form-scroll">
        <div class="signup-step-badge">الخطوة 2 من 2 — بيانات الحساب</div>

        <div class="su-locked-warning">
          🔒 <strong>تنبيه:</strong> الاسم الرباعي والعمر والجنس لا يمكن تغييرها بعد الإنشاء. تأكد من صحتها.
        </div>

        <div class="signup-form-grid">
          ${_generateSignupFieldsHTML(role, regionOpts)}
        </div>

        <div class="form-group" style="margin-top:20px;">
          <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:14px; background:var(--card-bg); padding:12px; border-radius:12px; border:1px solid var(--border);">
            <input type="checkbox" id="su-terms-agree" style="width:20px; height:20px; accent-color:var(--primary)">
            <span>هل قرأت <a href="javascript:;" onclick="openTermsModal(); event.preventDefault();" style="color:var(--primary); font-weight:700;">سياسة الشروط والأحكام</a> ووافقت عليها؟</span>
          </label>
        </div>

        <button class="btn btn-primary btn-block btn-lg" onclick="doSignup()" style="margin-top:24px;font-size:17px;padding:16px">
          🚀 إنشاء الحساب
        </button>
        <div class="signup-login-hint" style="margin-top:16px">
          لديك حساب؟ <a href="javascript:;" onclick="navigate('login')" style="color:var(--primary);font-weight:700">تسجيل الدخول</a>
        </div>
      </div>
    </div>
  </div>`;
};

// Keep showSignupModal pointing to the new page for backward compatibility
function showSignupModal() { navigate('signup'); }


window.signupSelectRole = function(role) {
  SignupState.role = role;
  const labels = { customer: 'عميل 👤', driver: 'مندوب 🚗', vendor: 'مزود خدمة 🏪' };
  const regions = (AppData.deliveryZones || AppData.regions || []).filter(r => r.active !== false);
  const regionOpts = regions.length
    ? regions.map(r => `<option value="${escAttr(r.name)}">${escHtml(r.name)}</option>`).join('')
    : `<option disabled>لا توجد مناطق متاحة</option>`;

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">✨ إنشاء حساب — ${labels[role]}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>

    <!-- Name warning banner -->
    <div class="su-locked-warning">
      🔒 <strong>تنبيه مهم:</strong> الاسم الرباعي والعمر والجنس لا يمكن تغييرها بعد إنشاء الحساب. تأكد من صحتها قبل المتابعة.
    </div>

    <div class="signup-form-grid">
      ${_generateSignupFieldsHTML(role, regionOpts)}
    </div>

    <div class="form-group" style="margin-top:16px;">
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; background:rgba(255,255,255,0.03); padding:10px; border-radius:10px; border:1px solid var(--border);">
        <input type="checkbox" id="su-terms-agree" style="width:18px; height:18px; accent-color:var(--primary)">
        <span>هل قرأت <a href="javascript:;" onclick="openTermsModal(); event.preventDefault();" style="color:var(--primary); font-weight:700;">سياسة الشروط والأحكام</a> ووافقت عليها؟</span>
      </label>
    </div>

    <button class="btn btn-primary btn-block btn-lg" onclick="doSignup()" style="margin-top:8px">🚀 إنشاء الحساب</button>

    <div style="text-align:center;margin-top:14px">
      <button class="btn btn-secondary" onclick="showSignupModal()">← تغيير الدور</button>
    </div>
  `);
  setTimeout(()=>document.getElementById('su-name')?.focus(),100);
};

// Map picker — uses browser geolocation as a simple, working fallback
async function signupPickLocation() {
  const status = document.getElementById('su-map-status');
  if (!navigator.geolocation) {
    status.textContent = '❌ المتصفح لا يدعم تحديد الموقع';
    return;
  }
  status.textContent = '⏳ جاري تحديد موقعك...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      SignupState.geo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      status.innerHTML = `${t('map_picked')} — <a href="https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}" target="_blank" style="color:var(--primary)">عرض على الخريطة</a>`;
      const btn = document.getElementById('su-map-btn');
      if (btn) { btn.classList.remove('btn-secondary'); btn.classList.add('btn-success'); btn.textContent = t('map_picked'); }
    },
    err => {
      status.textContent = '❌ تعذّر تحديد الموقع: ' + (err.message || 'مرفوض');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// Helper for developer fallback
function fallbackToSimulatedOTP(phone, errMsg) {
  const code = String(Math.floor(100000 + Math.random()*900000));
  SignupState.pendingOTP = code;
  SignupState.pendingPhone = phone;
  SignupState.confirmationResult = null; // Mark as simulated
  
  const otpRow = document.getElementById('su-otp-row');
  if (otpRow) otpRow.style.display = 'block';
  
  console.log(`[DEVELOPER FALLBACK] Simulated OTP: ${code} for phone: ${phone}. Reason: ${errMsg}`);
  toast(`⚠️ تم إرسال رمز محاكاة للتجربة: ${code} (فشل Firebase: ${errMsg})`, 'warning', 8000);
  
  const status = document.getElementById('su-otp-status');
  if (status) {
    status.innerHTML = `⚠️ تم تفعيل رمز المحاكاة للتجربة المحلية: <strong style="color:var(--primary); font-size:16px;">${code}</strong>`;
  }
}

// OTP — Firebase Phone Auth integration with smart fallback
window.signupSendOTP = async function() {
  const phoneInput = document.getElementById('su-phone') || document.getElementById('su-tel');
  if (!phoneInput) {
    toast('تعذّر العثور على حقل الهاتف', 'error');
    return;
  }
  const phone = phoneInput.value.trim();
  if (!phone || phone.length < 7) { 
    toast('أدخل رقم هاتف صالح', 'error'); 
    return; 
  }
  
  const formattedPhone = typeof formatPhoneNumber === 'function' ? formatPhoneNumber(phone) : phone;
  
  showLoader('جاري التحقق من رقم الهاتف...');
  try {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const snap1 = await db.collection('users').where('phone', '==', phone).limit(1).get();
    let isDup = !snap1.empty;
    if (!isDup && cleanPhone !== phone) {
      const snap2 = await db.collection('users').where('phone', '==', cleanPhone).limit(1).get();
      isDup = !snap2.empty;
    }
    if (!isDup && formattedPhone !== phone && formattedPhone !== cleanPhone) {
      const snap3 = await db.collection('users').where('phone', '==', formattedPhone).limit(1).get();
      isDup = !snap3.empty;
    }
    if (isDup) {
      hideLoader();
      toast('رقم الجوال هذا مسجل بالفعل في حساب آخر. لا يمكن إنشاء أكثر من حساب بنفس الرقم.', 'error');
      return;
    }
  } catch (checkErr) {
    console.warn('Error checking phone uniqueness:', checkErr);
  }

  // Prepare reCAPTCHA container
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
  
  showLoader('جاري إرسال رمز التحقق...');
  try {
    if (window.signupRecaptchaVerifier) {
      try { window.signupRecaptchaVerifier.clear(); } catch(e){}
    }
    window.signupRecaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      size: 'invisible',
      callback: () => {
        console.log('reCAPTCHA solved');
      }
    });
    
    if (SignupState.isGoogle && auth.currentUser) {
      // User is already signed in with Google, link with Phone Auth
      const confirmationResult = await auth.currentUser.linkWithPhoneNumber(formattedPhone, window.signupRecaptchaVerifier);
      SignupState.confirmationResult = confirmationResult;
      SignupState.pendingPhone = phone;
      document.getElementById('su-otp-row').style.display = 'block';
      hideLoader();
      toast('📱 تم إرسال رمز التحقق لجوالك عبر Firebase Auth', 'success');
    } else {
      // Create verification using signInWithPhoneNumber
      const confirmationResult = await auth.signInWithPhoneNumber(formattedPhone, window.signupRecaptchaVerifier);
      SignupState.confirmationResult = confirmationResult;
      SignupState.pendingPhone = phone;
      document.getElementById('su-otp-row').style.display = 'block';
      hideLoader();
      toast('📱 تم إرسال رمز التحقق لجوالك عبر Firebase Auth', 'success');
    }
  } catch (err) {
    console.warn('Firebase Phone Auth failed, using developer fallback:', err);
    hideLoader();
    fallbackToSimulatedOTP(phone, err.message || String(err));
  }
};

window.signupVerifyOTP = async function() {
  const code = document.getElementById('su-otp')?.value?.trim();
  const phoneInput = document.getElementById('su-phone') || document.getElementById('su-tel');
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const status = document.getElementById('su-otp-status');
  
  if (!code || code.length < 6) {
    toast('أدخل رمز تحقق صالح (6 أرقام)', 'error');
    return;
  }
  if (phone !== SignupState.pendingPhone) {
    if (status) {
      status.textContent = '⚠️ تم تغيير رقم الهاتف، أعد إرسال الرمز';
      status.style.color = '#ef4444';
    }
    return;
  }
  
  showLoader('جاري التحقق من الرمز...');
  try {
    if (SignupState.confirmationResult) {
      // Real Firebase verification!
      const result = await SignupState.confirmationResult.confirm(code);
      SignupState.phoneVerified = true;
      SignupState.firebasePhoneUser = result.user;
      
      if (status) {
        status.textContent = '✅ تم التحقق عبر Firebase Auth بنجاح!';
        status.style.color = '#10b981';
      }
      toast('✅ تم التحقق من رقم الجوال عبر فايربيس بنجاح!', 'success');
    } else {
      // Simulated OTP fallback
      if (code === SignupState.pendingOTP) {
        SignupState.phoneVerified = true;
        if (status) {
          status.textContent = '✅ تم التحقق (محاكاة التجربة)';
          status.style.color = '#10b981';
        }
        toast('✅ تم التحقق بنجاح (محاكاة)!', 'success');
      } else {
        throw new Error('رمز التحقق غير صحيح');
      }
    }
  } catch (err) {
    console.error('OTP Verification Error:', err);
    if (status) {
      status.textContent = '❌ رمز غير صحيح: ' + (err.message || '');
      status.style.color = '#ef4444';
    }
    toast('❌ رمز التحقق غير صحيح أو منتهي الصلاحية', 'error');
  } finally {
    hideLoader();
  }
};

async function doSignup() {
  const role = SignupState.role || 'customer';
  const fields = AppData.signupConfig ? (AppData.signupConfig[role] || []) : [];
  
  const data = { role };
  let hasError = false;
  
  for (const f of fields) {
    if (f.hidden) continue;
    // Skip password fields requirement for Google signup
    if (SignupState.isGoogle && (f.type === 'password' || f.id === 'pass')) {
      continue;
    }
    const el = document.getElementById(`su-${f.id}`);
    if (!el && f.id !== 'pass') continue;
    
    let val = el ? el.value.trim() : '';
    if (f.type === 'number') val = parseInt(val) || 0;
    
    if (f.required && !val && val !== 0) {
      toast(`يرجى تعبئة حقل: ${f.label}`, 'error');
      hasError = true;
      break;
    }
    data[f.id] = val;
  }
  
  if (hasError) return;

  const termsAgree = document.getElementById('su-terms-agree')?.checked;
  if (!termsAgree) {
    toast('يجب قراءة سياسة الشروط والأحكام والموافقة عليها للمتابعة', 'warning');
    return;
  }
  
  // Only validate password if NOT signing up with Google
  if (!SignupState.isGoogle) {
    const pass = data.pass;
    const pass2El = document.getElementById('su-pass2');
    if (pass && pass.length < 6) { toast('كلمة المرور قصيرة جداً (6 أحرف على الأقل)', 'error'); return; }
    if (pass && pass2El && pass !== pass2El.value) { toast('كلمتا المرور غير متطابقتين', 'error'); return; }
  }
  
  if (!SignupState.phoneVerified) {
    toast('يجب التحقق من رقم الجوال أولاً', 'error'); return;
  }

  // ── Fallback: read key fields directly from DOM in case signupConfig uses different ids ──
  const _elEmail = document.getElementById('su-email');
  if (_elEmail && _elEmail.value.trim()) data.email = _elEmail.value.trim();
  const _elPhone = document.getElementById('su-phone');
  if (_elPhone && _elPhone.value.trim()) data.phone = _elPhone.value.trim();
  const _elName = document.getElementById('su-name');
  if (_elName && _elName.value.trim()) data.name = _elName.value.trim();
  // Password: try common field ids
  if (!data.pass) {
    for (const pid of ['su-pass', 'su-password', 'su-passwd']) {
      const _el = document.getElementById(pid);
      if (_el && _el.value) { data.pass = _el.value; break; }
    }
  }

  if (!SignupState.isGoogle) {
    if (!data.email || typeof data.email !== 'string' || !data.email.includes('@')) {
      toast('يرجى إدخال بريد إلكتروني صالح', 'error'); return;
    }
    if (!data.pass || data.pass.length < 6) {
      toast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error'); return;
    }
    const pass2El = document.getElementById('su-pass2');
    if (pass2El && data.pass !== pass2El.value) {
      toast('كلمتا المرور غير متطابقتين', 'error'); return;
    }
  }

  // Check duplicate email and phone
  try {
    if (data.email) {
      const checkEmail = data.email.trim().toLowerCase();
      const emailSnap = await db.collection('users').where('email', '==', checkEmail).limit(1).get();
      if (!emailSnap.empty) {
        toast('البريد الإلكتروني هذا مسجل بالفعل في حساب آخر.', 'error');
        return;
      }
    }

    if (data.phone) {
      const checkPhone = data.phone.trim();
      const cleanPhone = checkPhone.replace(/[\s\-\(\)]/g, '');
      const formattedPhone = typeof formatPhoneNumber === 'function' ? formatPhoneNumber(checkPhone) : checkPhone;
      
      const snap1 = await db.collection('users').where('phone', '==', checkPhone).limit(1).get();
      let isDup = !snap1.empty;
      if (!isDup && cleanPhone !== checkPhone) {
        const snap2 = await db.collection('users').where('phone', '==', cleanPhone).limit(1).get();
        isDup = !snap2.empty;
      }
      if (!isDup && formattedPhone !== checkPhone && formattedPhone !== cleanPhone) {
        const snap3 = await db.collection('users').where('phone', '==', formattedPhone).limit(1).get();
        isDup = !snap3.empty;
      }
      if (isDup) {
        toast('رقم الجوال هذا مسجل بالفعل في حساب آخر. لا يمكن إنشاء أكثر من حساب بنفس الرقم.', 'error');
        return;
      }
    }
  } catch (checkErr) {
    console.warn('Error checking email/phone uniqueness during registration:', checkErr);
  }

  showLoader('جاري إنشاء حسابك...');
  window.__suppressAuthRedirect = true;

  try {
    let uid;
    if (SignupState.isGoogle) {
      if (!auth.currentUser) throw new Error('انتهت جلسة تسجيل دخول Google. يرجى المحاولة مجدداً.');
      uid = auth.currentUser.uid;
      data.email = data.email || SignupState.email;
      data.name = data.name || SignupState.name;
    } else if (SignupState.confirmationResult && auth.currentUser) {
      // User verified their phone and is signed in via Phone Auth, let's link the Email/Password!
      try {
        const credential = firebase.auth.EmailAuthProvider.credential(data.email, data.pass);
        const linkResult = await auth.currentUser.linkWithCredential(credential);
        uid = linkResult.user.uid;
      } catch (linkErr) {
        console.error('Error linking email/pass to phone auth:', linkErr);
        if (linkErr.code === 'auth/provider-already-linked' || linkErr.code === 'auth/email-already-in-use') {
          throw new Error('البريد الإلكتروني مسجل بالفعل بحساب آخر.');
        } else {
          throw linkErr;
        }
      }
    } else {
      let cred;
      try {
        cred = await auth.createUserWithEmailAndPassword(data.email, data.pass);
      } catch (createErr) {
        if (createErr.code === 'auth/email-already-in-use') {
          // Could be a zombie account (Firebase Auth exists but no Firestore profile).
          // Try signing in with the same password to recover it.
          try {
            cred = await auth.signInWithEmailAndPassword(data.email, data.pass);
            const existingProfile = await fsGet('users', cred.user.uid);
            if (existingProfile) {
              // Real existing account — redirect to login
              hideLoader();
              window.__suppressAuthRedirect = false;
              toast('هذا البريد مسجّل بالفعل. سيتم توجيهك لصفحة الدخول...', 'info');
              setTimeout(() => navigate('login'), 1800);
              return;
            }
            // Zombie account: Auth exists but no Firestore profile → complete signup
          } catch (signInErr) {
            // Sign in failed → truly registered with a different password
            hideLoader();
            window.__suppressAuthRedirect = false;
            toast('هذا البريد الإلكتروني مستخدم بالفعل. إذا كنت تعرف كلمة المرور، سجّل الدخول من الصفحة الرئيسية.', 'error');
            return;
          }
        } else {
          throw createErr;
        }
      }
      uid = cred.user.uid;
    }

    const roleLabels = { customer: 'عميل', driver: 'مندوب', vendor: 'مزود خدمة' };
    
    const userData = {
      name: data.name || '',
      email: data.email || '',
      phone: data.phone || SignupState.pendingPhone || '',
      phoneVerified: true,
      role,
      isActive: false,
      isActivePending: true,
      createdAt: new Date(),
      firstLogin: false,
      onboardingSeen: false,
      geoLocation: SignupState.geo || null,
      housePics: SignupState.housePics || []
    };

    for (const [k, v] of Object.entries(data)) {
      if (k !== 'pass' && userData[k] === undefined) {
        userData[k] = v;
      }
    }

    await fsSet('users', uid, userData);
    await ensureWallet(uid);

    try {
      await fsAdd('notifications', {
        targetRole: 'admin',
        type: 'new_account',
        title: '🆕 حساب جديد بانتظار المراجعة',
        message: `${userData.name} (${roleLabels[role] || role}) أنشأ حساباً جديداً ويحتاج إلى تفعيل`,
        userId: uid,
        userName: userData.name,
        userRole: role,
        userEmail: userData.email,
        userPhone: userData.phone,
        read: false,
        createdAt: new Date(),
      });
    } catch(notifErr) { console.warn('Notification failed', notifErr); }

    State.currentUser = { uid, ...userData };
    SignupState.isGoogle = false;
    SignupState.googleUid = null;

    closeModal();
    toast('✅ تم إنشاء حسابك! يرجى الانتظار حتى تفعيله من قبل الإدارة.', 'info');
    
    window.__suppressAuthRedirect = false;
    await navigate('home');
  } catch (e) {
    window.__suppressAuthRedirect = false;
    hideLoader();
    const arabicErrors = {
      'auth/email-already-in-use':        'هذا البريد الإلكتروني مستخدم بالفعل، جرّب تسجيل الدخول.',
      'auth/invalid-email':               'صيغة البريد الإلكتروني غير صحيحة.',
      'auth/weak-password':               'كلمة المرور ضعيفة جداً، يجب أن تكون 6 أحرف على الأقل.',
      'auth/operation-not-allowed':       'هذه الطريقة غير مفعّلة، يرجى التواصل مع الإدارة.',
      'auth/too-many-requests':           'طلبات كثيرة جداً، يرجى الانتظار ثم المحاولة مجدداً.',
      'auth/network-request-failed':      'فشل الاتصال بالشبكة، تحقق من اتصالك بالإنترنت.',
      'auth/user-disabled':               'هذا الحساب موقوف، يرجى التواصل مع الإدارة.',
      'auth/requires-recent-login':       'يرجى تسجيل الدخول مجدداً للمتابعة.',
      'auth/credential-already-in-use':   'هذا البريد مرتبط بحساب آخر بالفعل.',
      'auth/account-exists-with-different-credential': 'يوجد حساب بهذا البريد بطريقة دخول مختلفة.',
    };
    const msg = arabicErrors[e.code] || (e.message && !e.message.includes('Firebase') && !e.message.includes('auth/') ? e.message : 'حدث خطأ غير متوقع، يرجى المحاولة مجدداً.');
    toast(msg, 'error');
  }
}

// ───────────────────────────────────────────────────────
//  ADMIN — Regions tab
// ───────────────────────────────────────────────────────
function renderAdminRegions() {
  const regs = AppData.regions || [];
  const searchQuery = (State.adminSearch || '').toLowerCase();
  const filteredRegs = regs.filter(r => (r.name || '').toLowerCase().includes(searchQuery));
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <h2>📍 ${t('regions_title')}</h2>
      <div style="display:flex;gap:12px">
        <input type="text" class="form-control" id="admin-regions-search" placeholder="🔍 ابحث بالاسم..." value="${State.adminSearch || ''}" oninput="State.adminSearch = this.value; render();" style="width:300px">
        <button class="btn btn-primary" onclick="showAddRegionModal()">➕ ${t('add_region')}</button>
      </div>
    </div>
    ${filteredRegs.length === 0 ? `
      <div class="empty-state">
        <div style="font-size:48px;margin-bottom:12px">📍</div>
        <p style="color:var(--text-muted)">${t('no_regions_yet')}</p>
      </div>
    ` : `
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>#</th><th>${t('region_name')}</th><th>${t('status')}</th><th>${t('actions')}</th></tr></thead>
          <tbody>
            ${filteredRegs.map((r,i)=>{
              const gov = (AppData.deliveryGovernorates || []).find(g => g.id === r.govId);
              const displayName = gov ? `${escHtml(r.name)} (${escHtml(gov.name)})` : escHtml(r.name);
              return `
              <tr>
                <td>${i+1}</td>
                <td style="font-weight:600">📍 ${displayName}</td>
                <td><span class="badge ${r.active!==false?'badge-teal':'badge-rose'}">${r.active!==false?t('active'):t('inactive')}</span></td>
                <td>
                  <button class="btn btn-sm btn-secondary" onclick="showEditRegionModal('${r.id}')">✏️</button>
                  <button class="btn btn-sm ${r.active!==false?'btn-warning':'btn-success'}" onclick="toggleRegion('${r.id}')">${r.active!==false?'⏸️':'▶️'}</button>
                  <button class="btn btn-sm btn-danger" onclick="deleteRegion('${r.id}')">🗑️</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}
function showAddRegionModal() {
  const govs = (AppData.deliveryGovernorates || []).filter(g => g.active !== false);
  openModal(`
    <div class="modal-header"><h2 class="modal-title">➕ ${t('add_region')}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group">
      <label class="form-label">🏛️ المحافظة التابعة *</label>
      <select class="form-control" id="reg-gov-id">
        <option value="">— اختر المحافظة —</option>
        ${govs.map(g => `<option value="${g.id}">${escHtml(g.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">${t('region_name')}</label>
      <input class="form-control" id="reg-name" placeholder="${t('region_name_placeholder')}">
    </div>
    <button class="btn btn-primary btn-block" onclick="saveNewRegion()">${t('save')}</button>
  `);
  setTimeout(()=>document.getElementById('reg-name')?.focus(),100);
}
async function saveNewRegion() {
  const govId = document.getElementById('reg-gov-id')?.value;
  const name = document.getElementById('reg-name')?.value.trim();
  if (!govId) { toast('اختر المحافظة التابعة', 'error'); return; }
  if (!name) { toast('أدخل اسم المنطقة','error'); return; }
  
  const gov = (AppData.deliveryGovernorates || []).find(g => g.id === govId);
  const govName = gov ? gov.name : '';
  
  await fsAdd('regions', { name, govId, govName, active: true });
  closeModal(); toast(t('region_added'),'success'); await render();
}
function showEditRegionModal(id) {
  const r = (AppData.regions||[]).find(x=>x.id===id);
  if (!r) return;
  const govs = (AppData.deliveryGovernorates || []).filter(g => g.active !== false);
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ ${t('edit_region')}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group">
      <label class="form-label">🏛️ المحافظة التابعة *</label>
      <select class="form-control" id="reg-gov-id">
        <option value="">— اختر المحافظة —</option>
        ${govs.map(g => `<option value="${g.id}" ${g.id === r.govId ? 'selected' : ''}>${escHtml(g.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">${t('region_name')}</label>
      <input class="form-control" id="reg-name" value="${escAttr(r.name)}">
    </div>
    <button class="btn btn-primary btn-block" onclick="updateRegion('${id}')">${t('save')}</button>
  `);
}
async function updateRegion(id) {
  const govId = document.getElementById('reg-gov-id')?.value;
  const name = document.getElementById('reg-name')?.value.trim();
  if (!govId) { toast('اختر المحافظة التابعة', 'error'); return; }
  if (!name) { toast('أدخل اسم المنطقة','error'); return; }
  
  const gov = (AppData.deliveryGovernorates || []).find(g => g.id === govId);
  const govName = gov ? gov.name : '';
  
  await fsUpdate('regions', id, { name, govId, govName });
  closeModal(); toast(t('region_updated'),'success'); await render();
}
async function toggleRegion(id) {
  const r = (AppData.regions||[]).find(x=>x.id===id);
  if (!r) return;
  await fsUpdate('regions', id, { active: r.active===false });
  await render();
}
async function deleteRegion(id) {
  if (!confirm(t('delete_region_confirm'))) return;
  await fsDelete('regions', id);
  toast(t('region_deleted'),'success'); await render();
}

// ───────────────────────────────────────────────────────
//  ADMIN — Bank accounts tab
// ───────────────────────────────────────────────────────
function renderAdminBanks() {
  const banks = AppData.bankAccounts || [];
  const searchQuery = (State.adminSearch || '').toLowerCase();
  const filteredBanks = banks.filter(b => 
    (b.bankName || '').toLowerCase().includes(searchQuery) ||
    (b.holder || '').toLowerCase().includes(searchQuery) ||
    (b.accountNumber || '').toLowerCase().includes(searchQuery)
  );
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h2>🏦 ${t('banks_title')}</h2>
      <div style="display:flex;gap:12px">
        <input type="text" class="form-control" id="admin-banks-search" placeholder="🔍 ابحث بالبنك أو الحساب أو المالك..." value="${State.adminSearch || ''}" oninput="State.adminSearch = this.value; render();" style="width:300px">
        <button class="btn btn-primary" onclick="showAddBankModal()">➕ ${t('add_bank')}</button>
      </div>
    </div>
    <p style="color:var(--text-muted);font-size:14px;margin-bottom:24px">${t('banks_help')}</p>
    ${filteredBanks.length === 0 ? `
      <div class="empty-state">
        <div style="font-size:48px;margin-bottom:12px">🏦</div>
        <p style="color:var(--text-muted)">${t('no_banks_yet')}</p>
      </div>
    ` : `
      <div class="bank-grid">
        ${filteredBanks.map(b => `
          <div class="bank-card">
            <div class="bank-card-head">
              <div>
                <div class="bank-card-name">🏦 ${escHtml(b.bankName)}</div>
                <div class="bank-card-holder">${escHtml(b.holder||'')}</div>
              </div>
              <span class="badge ${b.active!==false?'badge-teal':'badge-rose'}">${b.active!==false?t('active'):t('inactive')}</span>
            </div>
            <div class="bank-row"><span>${t('account_number')}:</span> <code>${escHtml(b.accountNumber||'—')}</code></div>
            <div class="bank-row"><span>${t('iban')}:</span> <code>${escHtml(b.iban||'—')}</code></div>
            ${b.notes?`<div class="bank-notes">📝 ${escHtml(b.notes)}</div>`:''}
            <div class="bank-actions">
              <button class="btn btn-sm btn-secondary" onclick="showEditBankModal('${b.id}')">✏️ ${t('edit')}</button>
              <button class="btn btn-sm ${b.active!==false?'btn-warning':'btn-success'}" onclick="toggleBank('${b.id}')">${b.active!==false?'⏸️':'▶️'}</button>
              <button class="btn btn-sm btn-danger" onclick="deleteBank('${b.id}')">🗑️ ${t('delete')}</button>
            </div>
          </div>`).join('')}
      </div>
    `}
  `;
}
function bankFormFields(b={}) {
  return `
    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label">${t('bank_name')}</label>
        <input class="form-control" id="bk-bankName" placeholder="${t('bank_name_placeholder')}" value="${escAttr(b.bankName||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">${t('account_holder')}</label>
        <input class="form-control" id="bk-holder" value="${escAttr(b.holder||'')}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">${t('account_number')}</label>
      <input class="form-control" id="bk-accountNumber" value="${escAttr(b.accountNumber||'')}">
    </div>
    <div class="form-group">
      <label class="form-label">${t('iban')}</label>
      <input class="form-control" id="bk-iban" value="${escAttr(b.iban||'')}">
    </div>
    <div class="form-group">
      <label class="form-label">${t('bank_notes')}</label>
      <textarea class="form-control" id="bk-notes" rows="2">${escHtml(b.notes||'')}</textarea>
    </div>`;
}
function readBankForm() {
  return {
    bankName: document.getElementById('bk-bankName').value.trim(),
    holder: document.getElementById('bk-holder').value.trim(),
    accountNumber: document.getElementById('bk-accountNumber').value.trim(),
    iban: document.getElementById('bk-iban').value.trim(),
    notes: document.getElementById('bk-notes').value.trim(),
  };
}
function showAddBankModal() {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">➕ ${t('add_bank')}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    ${bankFormFields()}
    <button class="btn btn-primary btn-block" onclick="saveNewBank()">${t('save')}</button>
  `);
}
async function saveNewBank() {
  const data = readBankForm();
  if (!data.bankName || !data.accountNumber) { toast('اسم البنك ورقم الحساب مطلوبان','error'); return; }
  await fsAdd('bank_accounts', { ...data, active: true });
  closeModal(); toast(t('bank_added'),'success'); await render();
}
function showEditBankModal(id) {
  const b = (AppData.bankAccounts||[]).find(x=>x.id===id);
  if (!b) return;
  openModal(`
    <div class="modal-header"><h2 class="modal-title">✏️ ${t('edit_bank')}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    ${bankFormFields(b)}
    <button class="btn btn-primary btn-block" onclick="updateBank('${id}')">${t('save')}</button>
  `);
}
async function updateBank(id) {
  await fsUpdate('bank_accounts', id, readBankForm());
  closeModal(); toast(t('bank_updated'),'success'); await render();
}
async function toggleBank(id) {
  const b = (AppData.bankAccounts||[]).find(x=>x.id===id);
  if (!b) return;
  await fsUpdate('bank_accounts', id, { active: b.active===false });
  await render();
}
async function deleteBank(id) {
  if (!confirm(t('delete_bank_confirm'))) return;
  await fsDelete('bank_accounts', id);
  toast(t('bank_deleted'),'success'); await render();
}

// ─── Override renderAdmin removed to prevent conflicts with dashboards.js hub UI ───

// ───────────────────────────────────────────────────────
//  SAFE HELPERS
// ───────────────────────────────────────────────────────
function escHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) { return escHtml(s); }

// ───────────────────────────────────────────────────────
//  DATA LOADER PATCH — extend loadAllData to include new collections
//  with per-collection timeout so a slow/blocked Firestore call
//  cannot hang the entire app.
// ───────────────────────────────────────────────────────
const __originalLoadAllData = typeof loadAllData === 'function' ? loadAllData : null;
async function loadAllData() {
  const safe = async (col) => {
    try {
      return await Promise.race([
        fsGetAll(col),
        new Promise(r => setTimeout(()=>r([]), 4500)),
      ]);
    } catch(e) { return []; }
  };
  const [cats,cities,services,orders,users,ads,ratings,rr,wr,tr,banks,walletsArr,
         stores,storeCats,storeProducts,banners,pages,svcSections,deliveryZones,deliveryRoutes,digitalCodes,
         digitalStoreCats,digitalStores,digitalProducts,depositDocs,agreements,archivedOrders,broadcastNotifs,customerFeedback] = await Promise.all([
    safe('categories'), safe('cities'), safe('services'),
    safe('orders'), safe('users'), safe('ads'),
    safe('ratings'), safe('recharge_requests'),
    safe('withdrawal_requests'), safe('transactions'),
    safe('bank_accounts'),
    safe('wallets'),
    // ✅ المتاجر — يجب تحميلها هنا لأن هذه النسخة تستبدل loadAllData في core.js
    safe('stores'), safe('store_cats'), safe('store_products'),
    safe('banners'), safe('pages'),
    safe('service_sections'), safe('delivery_zones'), safe('delivery_routes'),
    safe('digital_codes'),
    safe('digital_store_cats'), safe('digital_stores'), safe('digital_products'),
    safe('depositDocs'), safe('platform_agreements'), safe('archivedOrders'), safe('broadcastNotifications'), safe('customer_feedback')
  ]);

  // Convert wallets array → { uid: walletDoc } map (each doc id IS the uid).
  const wallets = {};
  walletsArr.forEach(w => { if (w && w.id) wallets[w.id] = w; });
  Object.assign(AppData, {
    cats, cities, services, orders, users, ads, ratings,
    rechargeReqs: rr, withdrawReqs: wr, transactions: tr,
    regions: deliveryZones, bankAccounts: banks,
    wallets,
    // ✅ بيانات المتاجر
    stores, storeCats, storeProducts,
    banners, pages,
    svcSections, deliveryZones, deliveryRoutes,
    digitalCodes,
    digitalStoreCats, digitalStores, digitalProducts,
    depositDocs,
    agreements,
    archivedOrders,
    broadcastNotifications: broadcastNotifs,
    customerFeedback
  });
  State._archivedOrdersLoaded = true; // Mark as loaded so dynamic view uses AppData directly
  // ✅ Cache deliveryZones in localStorage so the signup page can read them without auth
  if (deliveryZones && deliveryZones.length > 0) {
    try { localStorage.setItem('mahjooz_zones_cache', JSON.stringify(deliveryZones)); } catch(e) {}
  }
}
// Also seed AppData with the new arrays for any code that reads them before first load
if (typeof AppData !== 'undefined') {
  if (!AppData.regions) AppData.regions = [];
  if (!AppData.deliveryZones) AppData.deliveryZones = [];
  if (!AppData.bankAccounts) AppData.bankAccounts = [];
  if (!AppData.wallets) AppData.wallets = {};
  if (!AppData.orders) AppData.orders = [];
}

// ───────────────────────────────────────────────────────
// DYNAMIC SIGNUP FIELDS GENERATOR & HOUSE PICS HANDLER
// ───────────────────────────────────────────────────────
window._generateSignupFieldsHTML = function(role, regionOpts) {
  const fields = AppData.signupConfig ? (AppData.signupConfig[role] || []) : (window.DEFAULT_SIGNUP_CONFIG ? (window.DEFAULT_SIGNUP_CONFIG[role] || []) : []);
  if (!fields.length) return '';
  
  return fields.map((f, i) => {
    if (f.hidden) return '';
    
    // Skip password fields entirely if registered with Google
    if (SignupState.isGoogle && (f.type === 'password' || f.id === 'pass')) {
      return '';
    }
    
    let html = `<div class="form-group" style="${f.type === 'textarea' || f.type === 'region' || f.id === 'locText' ? 'grid-column: 1/-1;' : ''}">
      <label class="form-label">${escHtml(f.label)}${f.required ? ' <span class="req" style="color:var(--rose)">*</span>' : ''}</label>`;
      
    if (f.type === 'select') {
      const opts = (f.options || '').split(',').map(o => {
        const parts = o.split(':');
        return `<option value="${escAttr(parts[0])}">${escHtml(parts[1] || parts[0])}</option>`;
      }).join('');
      html += `<select class="form-control" id="su-${f.id}" ${f.required ? 'required' : ''}>${opts}</select>`;
    } else if (f.type === 'region') {
      // Cascading: first pick governorate, then zone
      const govs = (AppData.deliveryGovernorates || []).filter(g => g.active !== false);
      const govOpts = govs.map(g => `<option value="${escAttr(g.id)}">${escHtml(g.name)}</option>`).join('');
      html += `
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <label class="form-label" style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">🏛️ المحافظة</label>
            <select class="form-control" id="su-gov-select"
              onchange="su_onGovChange(this.value,'su-${f.id}')"
              ${f.required ? 'required' : ''}>
              <option value="">— اختر المحافظة أولاً —</option>
              ${govOpts}
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">📍 المنطقة / الحي</label>
            <select class="form-control" id="su-${f.id}" ${f.required ? 'required' : ''} disabled>
              <option value="">— اختر المحافظة أولاً —</option>
            </select>
          </div>
        </div>`;

    } else if (f.type === 'tel' || f.id === 'phone') {
      html += `
        <div style="display:flex; gap:8px;">
          <input type="tel" class="form-control" id="su-${f.id}" placeholder="+9677..." style="flex:1;" ${f.required ? 'required' : ''}>
          <button type="button" class="btn btn-secondary" onclick="signupSendOTP()" style="white-space:nowrap; padding: 0 12px; font-size:13px;">إرسال الرمز</button>
        </div>
        <div id="su-otp-row" style="display:none; margin-top:8px;">
          <div style="display:flex; gap:8px;">
            <input type="text" class="form-control" id="su-otp" placeholder="رمز التحقق (6 أرقام)" style="flex:1;">
            <button type="button" class="btn btn-primary" onclick="signupVerifyOTP()" style="white-space:nowrap; padding: 0 16px;">تأكيد</button>
          </div>
          <div id="su-otp-status" style="font-size:12px; margin-top:4px; color:var(--text-muted);"></div>
        </div>
      `;
    } else if (f.type === 'textarea') {
      html += `<textarea class="form-control" id="su-${f.id}" rows="2" style="resize:vertical" ${f.required ? 'required' : ''}></textarea>`;
    } else if (f.type === 'password' || f.id === 'pass') {
      html += `
        <input type="password" class="form-control" id="su-${f.id}" placeholder="••••••••" ${f.required ? 'required' : ''}>
        </div>
        <div class="form-group">
          <label class="form-label">تأكيد كلمة المرور <span class="req" style="color:var(--rose)">*</span></label>
          <input type="password" class="form-control" id="su-pass2" placeholder="••••••••" ${f.required ? 'required' : ''}>
      `;
    } else {
      let valAttr = '';
      let disabledAttr = '';
      if (SignupState.isGoogle) {
        if (f.id === 'name' && SignupState.name) {
          valAttr = `value="${escAttr(SignupState.name)}"`;
          disabledAttr = 'disabled style="background:rgba(255,255,255,0.05); opacity:0.8; cursor:not-allowed;"';
        } else if (f.id === 'email' && SignupState.email) {
          valAttr = `value="${escAttr(SignupState.email)}"`;
          disabledAttr = 'disabled style="background:rgba(255,255,255,0.05); opacity:0.8; cursor:not-allowed;"';
        }
      }
      html += `<input type="${f.type || 'text'}" class="form-control" id="su-${f.id}" ${valAttr} ${disabledAttr} ${f.required ? 'required' : ''}>`;
    }
    
    // Append picture attachment uploader below detailed address for customers
    if (f.id === 'locText' && role === 'customer') {
      html += `
        <div style="margin-top:12px;">
          <label class="form-label" style="display:flex; align-items:center; gap:8px; font-weight:700;">
            📸 أرفق صور للمنزل وباب المنزل (اختياري)
          </label>
          <div class="signup-pics-upload-zone" onclick="document.getElementById('su-house-pics-input').click()">
            <span style="font-size: 28px; display: block; margin-bottom: 6px;">📤</span>
            <span style="font-size: 13px; color: var(--text-secondary);">اضغط لرفع صور المنزل والباب (يمكنك اختيار عدة صور)</span>
            <input type="file" id="su-house-pics-input" accept="image/*" multiple hidden onchange="su_handleHousePics(this)">
          </div>
          <div id="su-house-pics-preview" class="signup-pics-preview-grid"></div>
        </div>
      `;
    }
    
    html += `</div>`;
    return html;
  }).join('');
};

// ─── Cascading Governorate → Zone selector for signup ────────────────────────
window.su_onGovChange = function(govId, zoneSelectId) {
  const zoneEl = document.getElementById(zoneSelectId);
  if (!zoneEl) return;

  // Store the selected govId in SignupState for later use
  SignupState.selectedGovId = govId;

  if (!govId) {
    zoneEl.innerHTML = '<option value="">— اختر المحافظة أولاً —</option>';
    zoneEl.disabled = true;
    return;
  }

  const zones = (AppData.deliveryZones || AppData.regions || [])
    .filter(z => z.govId === govId && z.active !== false);

  if (zones.length === 0) {
    zoneEl.innerHTML = '<option value="">— لا توجد مناطق في هذه المحافظة بعد —</option>';
    zoneEl.disabled = true;
    return;
  }

  zoneEl.disabled = false;
  zoneEl.innerHTML = '<option value="">— اختر المنطقة / الحي —</option>' +
    zones.map(z => `<option value="${escAttr(z.name)}">${escHtml(z.name)}</option>`).join('');

  // Auto-select if only one zone
  if (zones.length === 1) {
    zoneEl.value = zones[0].name;
  }
};

window.su_handleHousePics = function(input) {
  const files = input.files;
  if (!files.length) return;
  SignupState.housePics = SignupState.housePics || [];
  const preview = document.getElementById('su-house-pics-preview');
  if (!preview) return;
  
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) {
      toast('بعض الصور كبيرة جداً (الحد الأقصى 5 ميجابايت)', 'error');
      continue;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64 = e.target.result;
      SignupState.housePics.push(base64);
      
      const thumb = document.createElement('div');
      thumb.className = 'su-pic-thumb';
      thumb.innerHTML = `
        <img src="${base64}">
        <button type="button" class="su-pic-remove" onclick="su_removeHousePic(${SignupState.housePics.length - 1}, this)">✕</button>
      `;
      preview.appendChild(thumb);
    };
    reader.readAsDataURL(file);
  }
};

window.su_removeHousePic = function(idx, btn) {
  if (SignupState.housePics && SignupState.housePics[idx]) {
    SignupState.housePics.splice(idx, 1);
  }
  btn.closest('.su-pic-thumb').remove();
  
  // Re-index remaining remove buttons
  const preview = document.getElementById('su-house-pics-preview');
  if (preview) {
    preview.querySelectorAll('.su-pic-remove').forEach((b, i) => {
      b.setAttribute('onclick', `su_removeHousePic(${i}, this)`);
    });
  }
};

// Premium Styles injection for the upload zones
(function() {
  const css = `
    .signup-pics-upload-zone {
      border: 2px dashed var(--glass-border, rgba(255,255,255,0.1));
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease-in-out;
      background: var(--bg-card, rgba(255,255,255,0.02));
      margin-top: 6px;
    }
    .signup-pics-upload-zone:hover {
      border-color: var(--primary, #7c3aed);
      background: rgba(124, 58, 237, 0.05);
    }
    .signup-pics-preview-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .su-pic-thumb {
      position: relative;
      width: 72px;
      height: 72px;
      border-radius: 8px;
      border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
      overflow: hidden;
    }
    .su-pic-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .su-pic-remove {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--rose, #ef4444);
      color: #fff;
      border: none;
      font-size: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

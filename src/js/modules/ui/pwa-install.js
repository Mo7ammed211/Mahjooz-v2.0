// ═══════════════════════════════════════
//  محجوز — PWA Install Manager
// ═══════════════════════════════════════
(function () {
  'use strict';

  let _deferredPrompt = null;
  const DISMISSED_KEY = 'pwa_banner_dismissed';
  const BANNER_DELAY  = 4000;

  // ── Register SW ──────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  // ── Detect platform ───────────────────
  const _isIOS     = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const _isSafari  = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const _isInstalled = window.matchMedia('(display-mode: standalone)').matches
                    || window.navigator.standalone === true;

  // ── Capture install prompt (Android/Desktop Chrome) ──
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    _onInstallable();
  });

  // ── Trigger install ───────────────────
  window.pwaTriggerInstall = async function () {
    if (_deferredPrompt) {
      // Chrome / Android: native prompt
      _hideBanner();
      _deferredPrompt.prompt();
      const { outcome } = await _deferredPrompt.userChoice;
      _deferredPrompt = null;
      if (outcome === 'accepted') _onInstalled();
    } else if (_isIOS && _isSafari) {
      // iPhone / iPad: show instructions
      _showIOSGuide();
    } else {
      // Desktop Chrome without prompt (criteria not met yet)
      _showDesktopGuide();
    }
  };

  // ── Dismiss banner ────────────────────
  window.pwaDismissBanner = function () {
    _hideBanner();
    try { localStorage.setItem(DISMISSED_KEY, Date.now()); } catch (_) {}
  };

  // ── When app is installable via prompt ──
  function _onInstallable() {
    _showNavBtn();
    const dismissed = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() - dismissed > threeDays) {
      setTimeout(_showBanner, BANNER_DELAY);
    }
  }

  // ── When app is installed ─────────────
  function _onInstalled() {
    _hideBanner();
    const navBtn = document.getElementById('pwa-nav-btn');
    if (navBtn) navBtn.style.display = 'none';
    try { localStorage.setItem(DISMISSED_KEY, Date.now()); } catch (_) {}
  }

  window.addEventListener('appinstalled', _onInstalled);

  // ── Show nav button ─────────────────
  function _showNavBtn() {
    const navBtn = document.getElementById('pwa-nav-btn');
    if (navBtn) navBtn.classList.add('pwa-ready');
  }

  // ── iOS Guide modal ───────────────────
  function _showIOSGuide() {
    if (typeof openModal === 'function') {
      openModal(`
        <div style="text-align:center;padding:8px 0">
          <div style="font-size:48px;margin-bottom:12px">📱</div>
          <h3 style="font-size:18px;font-weight:700;color:var(--text-main);margin-bottom:16px">تثبيت محجوز على iPhone</h3>
          <div style="text-align:right;display:flex;flex-direction:column;gap:14px">
            <div style="display:flex;align-items:center;gap:12px;background:var(--bg-hover);border-radius:12px;padding:12px">
              <span style="font-size:28px;flex-shrink:0">1️⃣</span>
              <span style="font-size:14px;color:var(--text-main)">اضغط على زر <strong>المشاركة</strong> <span style="font-size:18px">⬆️</span> في أسفل المتصفح</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;background:var(--bg-hover);border-radius:12px;padding:12px">
              <span style="font-size:28px;flex-shrink:0">2️⃣</span>
              <span style="font-size:14px;color:var(--text-main)">اختر <strong>"إضافة إلى الشاشة الرئيسية"</strong></span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;background:var(--bg-hover);border-radius:12px;padding:12px">
              <span style="font-size:28px;flex-shrink:0">3️⃣</span>
              <span style="font-size:14px;color:var(--text-main)">اضغط <strong>"إضافة"</strong> ✅</span>
            </div>
          </div>
        </div>
      `, 'تثبيت التطبيق');
    }
  }

  // ── Desktop Guide modal ───────────────
  function _showDesktopGuide() {
    if (typeof openModal === 'function') {
      openModal(`
        <div style="text-align:center;padding:8px 0">
          <div style="font-size:48px;margin-bottom:12px">💻</div>
          <h3 style="font-size:18px;font-weight:700;color:var(--text-main);margin-bottom:16px">تثبيت محجوز على الكمبيوتر</h3>
          <div style="text-align:right;display:flex;flex-direction:column;gap:14px">
            <div style="display:flex;align-items:center;gap:12px;background:var(--bg-hover);border-radius:12px;padding:12px">
              <span style="font-size:28px;flex-shrink:0">1️⃣</span>
              <span style="font-size:14px;color:var(--text-main)">انظر إلى <strong>شريط العنوان</strong> في المتصفح</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;background:var(--bg-hover);border-radius:12px;padding:12px">
              <span style="font-size:28px;flex-shrink:0">2️⃣</span>
              <span style="font-size:14px;color:var(--text-main)">ابحث عن أيقونة <strong>التثبيت ⊕</strong> في الجهة اليمنى من شريط العنوان</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;background:var(--bg-hover);border-radius:12px;padding:12px">
              <span style="font-size:28px;flex-shrink:0">3️⃣</span>
              <span style="font-size:14px;color:var(--text-main)">اضغط عليها واختر <strong>"تثبيت"</strong> ✅</span>
            </div>
            <div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);border-radius:10px;padding:10px;font-size:13px;color:var(--text-muted)">
              💡 إذا لم تجد الأيقونة، تأكد أنك تستخدم <strong>Google Chrome</strong> أو <strong>Microsoft Edge</strong>
            </div>
          </div>
        </div>
      `, 'تثبيت التطبيق');
    }
  }

  // ── Banner helpers ────────────────────
  function _showBanner() {
    const b = document.getElementById('pwa-install-banner');
    if (b) { b.classList.remove('hiding'); b.classList.add('visible'); }
  }

  function _hideBanner() {
    const b = document.getElementById('pwa-install-banner');
    if (!b) return;
    b.classList.remove('visible');
    b.classList.add('hiding');
    // بعد انتهاء الـ animation، نُخفي تماماً
    setTimeout(() => {
      b.classList.remove('hiding');
      b.style.display = 'none'; // إخفاء نهائي صريح
    }, 460);
  }

  // ── Init: show button always unless already installed ──
  (function _init() {
    if (_isInstalled) { _onInstalled(); return; }

    // Always show the nav button (works as fallback with instructions)
    setTimeout(_showNavBtn, 800);

    // iOS/Safari: also show banner
    if (_isIOS && _isSafari) {
      const dismissed = Number(localStorage.getItem(DISMISSED_KEY) || 0);
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissed > threeDays) {
        setTimeout(_showBanner, BANNER_DELAY);
      }
    }
  })();
})();

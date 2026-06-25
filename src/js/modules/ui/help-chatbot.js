/* ============================================================
   Help Chatbot — بوت المساعدة الذكي
   ------------------------------------------------------------
   أيقونة عائمة متحركة قابلة للسحب — للعميل والمزود والمندوب فقط
   ============================================================ */
'use strict';

(function () {

  const ALLOWED_ROLES = new Set(['customer', 'vendor', 'driver', 'provider']);
  const LS_HIDDEN = 'mahjooz_help_fab_hidden';
  const LS_POS    = 'mahjooz_help_fab_pos';
  const DRAG_THRESHOLD = 6;

  // ── CSS ────────────────────────────────────────────────────
  const css = `
    #help-fab-wrap {
      position: fixed; left: 20px; bottom: 88px;
      z-index: 9990; touch-action: none;
      user-select: none;
    }
    #help-fab-wrap.fab-float { animation: helpFabFloat 3.2s ease-in-out infinite; }
    #help-fab-wrap.fab-dragging { animation: none !important; cursor: grabbing; }
    @keyframes helpFabFloat {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-10px); }
    }

    #help-fab {
      position: relative;
      width: 52px; height: 52px; border-radius: 50%;
      background: linear-gradient(135deg,#7c3aed,#4f46e5);
      border: none; cursor: grab; z-index: 2;
      box-shadow: 0 8px 24px rgba(124,58,237,0.45);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; transition: box-shadow 0.3s, background 0.3s;
      color: white;
    }
    #help-fab:hover { box-shadow: 0 12px 32px rgba(124,58,237,0.55); }
    #help-fab.open { background: linear-gradient(135deg,#ef4444,#dc2626); cursor: grab; }
    #help-fab .fab-badge {
      position: absolute; top:-4px; right:-4px;
      width:18px; height:18px; border-radius:50%;
      background:#ef4444; color:white;
      font-size:10px; font-weight:800;
      display:flex; align-items:center; justify-content:center;
      border:2px solid var(--bg-base,#0f0f1a);
      animation: fabPulse 1.5s infinite;
      pointer-events: none;
    }
    @keyframes fabPulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.2);} }

    #help-chat-panel {
      position: absolute; bottom: 64px; left: 0;
      width: 340px; max-height: 520px;
      background: var(--bg-card,#1e1e2e);
      border: 1px solid rgba(124,58,237,0.3);
      border-radius: 20px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.55);
      z-index: 1; display: flex; flex-direction: column;
      font-family: 'Cairo',sans-serif; direction: rtl;
      overflow: hidden;
      transform: scale(0.92) translateY(20px); opacity: 0;
      transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
      pointer-events: none;
    }
    #help-chat-panel.open {
      transform: scale(1) translateY(0); opacity: 1;
      pointer-events: all;
    }
    .hc-header {
      background: linear-gradient(135deg,#7c3aed,#4f46e5);
      padding: 14px 16px; display: flex; align-items: center; gap: 10px;
    }
    .hc-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
    }
    .hc-header-text { flex: 1; min-width: 0; }
    .hc-header-name { font-size: 14px; font-weight: 800; color: white; }
    .hc-header-status { font-size: 11px; color: rgba(255,255,255,0.75); display: flex; align-items: center; gap: 4px; }
    .hc-status-dot { width:7px; height:7px; border-radius:50%; background:#4ade80; display:inline-block; }
    .hc-header-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .hc-btn-icon {
      width: 30px; height: 30px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.25);
      background: rgba(0,0,0,0.15); color: #fff;
      cursor: pointer; font-size: 13px; line-height: 1;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    .hc-btn-icon:hover { background: rgba(0,0,0,0.3); }
    .hc-btn-stop {
      font-size: 11px; font-weight: 700; padding: 0 8px; width: auto;
      white-space: nowrap;
    }

    .hc-messages {
      flex: 1; overflow-y: auto; padding: 14px 12px;
      display: flex; flex-direction: column; gap: 10px;
      min-height: 200px;
    }
    .hc-messages::-webkit-scrollbar { width: 4px; }
    .hc-messages::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.3); border-radius: 99px; }

    .hc-msg {
      max-width: 85%; padding: 10px 14px;
      border-radius: 14px; font-size: 13px; line-height: 1.6;
      animation: hcMsgIn 0.25s ease;
    }
    @keyframes hcMsgIn { from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:translateY(0); } }
    .hc-msg.bot {
      background: rgba(124,58,237,0.1);
      border: 1px solid rgba(124,58,237,0.2);
      color: var(--text-main,#f1f5f9);
      align-self: flex-start; border-radius: 4px 14px 14px 14px;
    }
    .hc-msg.user {
      background: linear-gradient(135deg,#7c3aed,#4f46e5);
      color: white; align-self: flex-end;
      border-radius: 14px 4px 14px 14px;
    }

    .hc-quick-replies {
      display: flex; flex-wrap: wrap; gap: 6px;
      padding: 8px 12px 4px;
    }
    .hc-qr {
      background: rgba(124,58,237,0.1);
      border: 1px solid rgba(124,58,237,0.25);
      color: #a78bfa; border-radius: 99px;
      padding: 6px 12px; font-size: 12px; font-weight: 700;
      cursor: pointer; transition: all 0.2s;
      font-family: 'Cairo',sans-serif;
    }
    .hc-qr:hover { background: rgba(124,58,237,0.2); transform: translateY(-1px); }

    .hc-footer {
      padding: 10px 12px;
      border-top: 1px solid var(--border,rgba(255,255,255,0.07));
      display: flex; gap: 8px; align-items: center;
    }
    .hc-input {
      flex: 1; background: rgba(255,255,255,0.05);
      border: 1px solid var(--border,rgba(255,255,255,0.08));
      border-radius: 10px; padding: 9px 12px;
      font-size: 13px; color: var(--text-main,#f1f5f9);
      font-family: 'Cairo',sans-serif; outline: none;
      direction: rtl; text-align: right;
    }
    .hc-input:focus { border-color: rgba(124,58,237,0.5); }
    .hc-send {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg,#7c3aed,#4f46e5);
      border: none; cursor: pointer; color: white;
      font-size: 14px; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }

    .hc-whatsapp {
      display: flex; align-items: center; gap: 8px;
      background: rgba(37,211,102,0.12);
      border: 1px solid rgba(37,211,102,0.3);
      border-radius: 12px; padding: 10px 14px;
      margin: 4px 12px 8px; cursor: pointer;
      color: #25d366; font-size: 13px; font-weight: 700;
      text-decoration: none; transition: all 0.2s;
      font-family: 'Cairo',sans-serif; direction: rtl;
    }
    .hc-whatsapp:hover { background: rgba(37,211,102,0.2); }

    @media (max-width: 480px) {
      #help-chat-panel { width: min(340px, calc(100vw - 24px)); }
    }
  `;
  if (!document.getElementById('hc-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'hc-styles';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  // ── قاعدة بيانات الأسئلة ─────────────────────────────────
  const QA = {
    customer: [
      { q: '📅 كيف أحجز خدمة؟', a: 'من الصفحة الرئيسية اختر "خدمات" أو "حجوزات"، اضغط على الخدمة، ثم "احجز الآن" وحدد الموعد واكمل الدفع.' },
      { q: '💰 كيف أشحن المحفظة؟', a: 'اذهب لـ "محفظتي" ← "شحن الرصيد"، اختر طريقة الدفع وارفع صورة الإيصال.' },
      { q: '📍 كيف أتتبع طلبي؟', a: 'من "طلباتي" ستجد كل طلباتك مع حالتها. عند خروج المندوب يمكنك تتبعه على الخريطة.' },
      { q: '❌ كيف ألغي طلباً؟', a: 'يمكن الإلغاء قبل قبول المزود من "طلباتي". بعد القبول تواصل مع الدعم.' },
      { q: '🛒 كيف أستخدم السلة؟', a: 'أضف المنتجات للسلة ثم اضغط أيقونة السلة 🛒 لإتمام الطلب.' },
      { q: '⭐ كيف أقيّم الخدمة؟', a: 'بعد اكتمال الطلب من "طلباتي" اضغط "تقييم" بجانب الطلب.' }
    ],
    vendor: [
      { q: '🔔 كيف أقبل طلباً؟', a: 'افتح لوحة التحكم ← "الطلبات الواردة" واضغط "قبول" أو "رفض".' },
      { q: '📦 كيف أضيف منتجاً؟', a: 'من لوحة التحكم ← "المنتجات" ← "إضافة من الكتالوج" أو "اقتراح منتج جديد".' },
      { q: '💵 كيف أستلم أرباحي؟', a: 'الأرباح تُضاف لمحفظتك بعد اكتمال الطلب. اطلب السحب من "محفظتي".' },
      { q: '🕐 كيف أغير أوقات العمل؟', a: 'من الإعدادات ← "أوقات العمل" حدد أيام وساعات دوامك.' },
      { q: '📊 كيف أرى إحصائياتي؟', a: 'من لوحة التحكم اضغط "الإحصائيات".' }
    ],
    driver: [
      { q: '📦 كيف أقبل طلب توصيل؟', a: 'اضغط "قبول" على إشعار التوصيل خلال 60 ثانية.' },
      { q: '💵 كيف أستلم أجري؟', a: 'أجر كل توصيل يُضاف لمحفظتك فور التسليم.' },
      { q: '🗺️ كيف أصل للعميل؟', a: 'بعد استلام الطلب اضغط "عرض العنوان" لفتح الخريطة.' }
    ]
  };

  const WELCOME = {
    customer: 'أهلاً بك! 👋 أنا مساعدك الذكي في محجوز. كيف يمكنني مساعدتك؟',
    vendor:   'أهلاً مزود الخدمة! 💼 كيف يمكنني مساعدتك؟',
    provider: 'أهلاً مزود الخدمة! 💼 كيف يمكنني مساعدتك؟',
    driver:   'أهلاً مندوب التوصيل! 🚗 لديك سؤال؟ أنا هنا!'
  };

  const SUPPORT_WA = '96777000000';

  // ── حالة الواجهة ─────────────────────────────────────────
  let wrapEl = null, panelEl = null, messagesEl = null, inputEl = null, fabEl = null;
  let isOpen = false;
  let currentRole = 'customer';
  let isDragging = false;
  let dragMoved = false;
  let dragStartX = 0, dragStartY = 0, wrapStartX = 0, wrapStartY = 0;

  function normalizeRole(role) {
    if (role === 'provider') return 'vendor';
    return role || '';
  }

  function isRoleAllowed(role) {
    return ALLOWED_ROLES.has(role);
  }

  function isHiddenByUser() {
    try { return localStorage.getItem(LS_HIDDEN) === '1'; } catch (e) { return false; }
  }

  function shouldShowFab() {
    if (isHiddenByUser()) return false;
    const role = (window.State && State.currentUser) ? State.currentUser.role : null;
    if (!role || role === 'guest') return false;
    return isRoleAllowed(role);
  }

  function syncVisibility() {
    if (!wrapEl) return;
    const show = shouldShowFab();
    wrapEl.style.display = show ? '' : 'none';
    if (!show && isOpen) closePanel();
  }

  function loadSavedPosition() {
    if (!wrapEl) return;
    try {
      const raw = localStorage.getItem(LS_POS);
      if (!raw) return;
      const pos = JSON.parse(raw);
      if (typeof pos.left !== 'number' || typeof pos.top !== 'number') return;
      const maxL = Math.max(8, window.innerWidth - wrapEl.offsetWidth - 8);
      const maxT = Math.max(8, window.innerHeight - wrapEl.offsetHeight - 8);
      wrapEl.style.left   = Math.min(Math.max(8, pos.left), maxL) + 'px';
      wrapEl.style.top    = Math.min(Math.max(8, pos.top), maxT) + 'px';
      wrapEl.style.bottom = 'auto';
    } catch (e) { /* ignore */ }
  }

  function savePosition() {
    if (!wrapEl) return;
    const r = wrapEl.getBoundingClientRect();
    try {
      localStorage.setItem(LS_POS, JSON.stringify({ left: r.left, top: r.top }));
    } catch (e) { /* ignore */ }
  }

  function clampWrapToViewport() {
    if (!wrapEl) return;
    const r = wrapEl.getBoundingClientRect();
    let left = r.left;
    let top  = r.top;
    const maxL = Math.max(8, window.innerWidth - r.width - 8);
    const maxT = Math.max(8, window.innerHeight - r.height - 8);
    left = Math.min(Math.max(8, left), maxL);
    top  = Math.min(Math.max(8, top), maxT);
    wrapEl.style.left = left + 'px';
    wrapEl.style.top  = top + 'px';
    wrapEl.style.bottom = 'auto';
    savePosition();
  }

  function setupDrag() {
    if (!wrapEl || !fabEl) return;

    const onPointerDown = (e) => {
      if (e.target.closest('.hc-btn-icon') || e.target.closest('.hc-input') || e.target.closest('.hc-qr')) return;
      const pt = e.touches ? e.touches[0] : e;
      isDragging = true;
      dragMoved = false;
      dragStartX = pt.clientX;
      dragStartY = pt.clientY;
      const r = wrapEl.getBoundingClientRect();
      wrapStartX = r.left;
      wrapStartY = r.top;
      wrapEl.classList.add('fab-dragging');
      wrapEl.classList.remove('fab-float');
      wrapEl.style.bottom = 'auto';
      wrapEl.style.left = wrapStartX + 'px';
      wrapEl.style.top  = wrapStartY + 'px';
      if (e.cancelable) e.preventDefault();
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - dragStartX;
      const dy = pt.clientY - dragStartY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragMoved = true;
      if (!dragMoved) return;
      let left = wrapStartX + dx;
      let top  = wrapStartY + dy;
      const w = wrapEl.offsetWidth;
      const h = wrapEl.offsetHeight;
      left = Math.min(Math.max(8, left), window.innerWidth - w - 8);
      top  = Math.min(Math.max(8, top), window.innerHeight - h - 8);
      wrapEl.style.left = left + 'px';
      wrapEl.style.top  = top + 'px';
      if (e.cancelable) e.preventDefault();
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      const wasDrag = dragMoved;
      isDragging = false;
      wrapEl.classList.remove('fab-dragging');
      if (wasDrag) {
        savePosition();
      } else {
        togglePanel();
      }
      dragMoved = false;
      if (!isOpen && !isHiddenByUser()) wrapEl.classList.add('fab-float');
    };

    fabEl.addEventListener('mousedown', onPointerDown);
    fabEl.addEventListener('touchstart', onPointerDown, { passive: false });
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);
  }

  function buildUI() {
    wrapEl = document.createElement('div');
    wrapEl.id = 'help-fab-wrap';
    wrapEl.className = 'fab-float';

    fabEl = document.createElement('button');
    fabEl.id = 'help-fab';
    fabEl.type = 'button';
    fabEl.title = 'مساعدة — اسحب لتحريك المكان';
    fabEl.innerHTML = '<span class="fab-badge">؟</span>💬';

    panelEl = document.createElement('div');
    panelEl.id = 'help-chat-panel';
    panelEl.innerHTML =
      '<div class="hc-header">'
      + '<div class="hc-avatar">🤖</div>'
      + '<div class="hc-header-text">'
      + '<div class="hc-header-name">مساعد محجوز</div>'
      + '<div class="hc-header-status"><span class="hc-status-dot"></span> متاح الآن</div>'
      + '</div>'
      + '<div class="hc-header-actions">'
      + '<button type="button" class="hc-btn-icon hc-btn-stop" id="hc-stop-btn" title="إيقاف المساعد">إيقاف</button>'
      + '<button type="button" class="hc-btn-icon" id="hc-close-btn" title="إغلاق">✕</button>'
      + '</div></div>'
      + '<div class="hc-messages" id="hc-messages"></div>'
      + '<div class="hc-quick-replies" id="hc-qr"></div>'
      + '<a class="hc-whatsapp" href="https://wa.me/' + SUPPORT_WA + '?text=' + encodeURIComponent('مرحباً، أحتاج مساعدة في منصة محجوز') + '" target="_blank" rel="noopener">'
      + 'تواصل مع الدعم عبر واتساب</a>'
      + '<div class="hc-footer">'
      + '<input class="hc-input" id="hc-input" placeholder="اكتب سؤالك..." />'
      + '<button type="button" class="hc-send" id="hc-send-btn">➤</button>'
      + '</div>';

    wrapEl.appendChild(panelEl);
    wrapEl.appendChild(fabEl);
    document.body.appendChild(wrapEl);

    messagesEl = document.getElementById('hc-messages');
    inputEl    = document.getElementById('hc-input');

    document.getElementById('hc-close-btn').onclick = closePanel;
    document.getElementById('hc-stop-btn').onclick   = hideAssistantPermanently;
    document.getElementById('hc-send-btn').onclick   = () => window._hcSend();
    if (inputEl) {
      inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') window._hcSend(); });
    }

    loadSavedPosition();
    setupDrag();
    syncVisibility();
  }

  function openPanel() {
    isOpen = true;
    panelEl.classList.add('open');
    fabEl.classList.add('open');
    fabEl.innerHTML = '✕';
    wrapEl.classList.remove('fab-float');
    currentRole = normalizeRole(State?.currentUser?.role) || 'customer';
    if (!messagesEl.children.length) {
      addBotMsg(WELCOME[State?.currentUser?.role] || WELCOME[currentRole] || WELCOME.customer);
      showQuickReplies();
    }
    clampWrapToViewport();
  }

  function closePanel() {
    isOpen = false;
    panelEl.classList.remove('open');
    fabEl.classList.remove('open');
    fabEl.innerHTML = '<span class="fab-badge">؟</span>💬';
    if (!isHiddenByUser()) wrapEl.classList.add('fab-float');
  }

  function togglePanel() {
    if (isOpen) closePanel();
    else openPanel();
  }

  function hideAssistantPermanently() {
    try { localStorage.setItem(LS_HIDDEN, '1'); } catch (e) { /* ignore */ }
    closePanel();
    if (wrapEl) wrapEl.style.display = 'none';
    if (typeof toast === 'function') {
      toast('تم إيقاف مساعد محجوز. لإعادة تفعيله امسح بيانات الموقع أو أعد ضبط المتصفح.', 'info');
    }
  }

  window._hcShowAssistant = function () {
    try { localStorage.removeItem(LS_HIDDEN); } catch (e) { /* ignore */ }
    syncVisibility();
    if (typeof toast === 'function') toast('تم إعادة تفعيل مساعد محجوز', 'success');
  };

  function addBotMsg(text) {
    const msg = document.createElement('div');
    msg.className = 'hc-msg bot';
    msg.textContent = text;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addUserMsg(text) {
    const msg = document.createElement('div');
    msg.className = 'hc-msg user';
    msg.textContent = text;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showQuickReplies() {
    const qrEl = document.getElementById('hc-qr');
    if (!qrEl) return;
    const items = QA[currentRole] || QA.customer;
    qrEl.innerHTML = '';
    items.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hc-qr';
      btn.textContent = item.q;
      btn.onclick = () => {
        addUserMsg(item.q);
        qrEl.innerHTML = '';
        setTimeout(() => {
          addBotMsg(item.a);
          setTimeout(() => addMoreBtn(qrEl, items), 300);
        }, 400);
      };
      qrEl.appendChild(btn);
    });
  }

  function addMoreBtn(qrEl, items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hc-qr';
    btn.textContent = '🔄 أسئلة أخرى';
    btn.onclick = () => showQuickReplies();
    qrEl.appendChild(btn);
  }

  window._hcSend = function () {
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    addUserMsg(text);
    const items = QA[currentRole] || QA.customer;
    const lower = text.toLowerCase();
    let found = null;
    items.forEach((item) => {
      if (found) return;
      const keywords = item.q.replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, '').trim().split(/\s+/);
      if (keywords.some((k) => k.length > 2 && lower.includes(k))) found = item;
    });
    setTimeout(() => {
      addBotMsg(found ? found.a : 'لم أجد إجابة محددة. تواصل مع الدعم عبر واتساب أدناه 😊');
    }, 500);
  };

  function init() {
    if (document.getElementById('help-fab-wrap')) return;
    buildUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 800));
  } else {
    setTimeout(init, 800);
  }

  // تحديث الظهور عند تغيير الدور
  setInterval(() => {
    if (!wrapEl) return;
    const role = State?.currentUser?.role;
    const norm = normalizeRole(role);
    if (norm && norm !== currentRole && ALLOWED_ROLES.has(role)) {
      currentRole = norm;
      if (messagesEl) messagesEl.innerHTML = '';
    }
    syncVisibility();
  }, 1500);

  window.addEventListener('resize', () => { if (wrapEl) clampWrapToViewport(); });

  console.log('[HelpChatbot] ✅ بوت المساعدة loaded 💬');
})();

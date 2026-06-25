/* phase18.js — Production polish & feature pack:
   1) Live Routing Map (admin) — Leaflet visualization of in-flight store orders.
   2) Favorites system (per user, persisted on user doc).
   3) Address book (saved delivery addresses) + booking-modal quick-pick.
   4) Order tracking timeline with milestones.
   5) Order cancellation by customer + automatic wallet refund.
   6) Global search overlay (services / categories / providers).
   7) Static pages: About, Terms, Privacy, Help/FAQ + footer links.
   8) PWA install prompt + first-visit onboarding.
*/
(function () {
  'use strict';

  // Make sure ExtraPages bag exists (core.js merges it into the dispatcher).
  window.ExtraPages = window.ExtraPages || {};
  const addPage = (name, fn) => { window.ExtraPages[name] = fn; };

  // ──────────────────────────────────────────────────────────────────
  //  Tiny helpers
  // ──────────────────────────────────────────────────────────────────
  function meDoc() {
    const me = State.currentUser; if (!me) return null;
    return (AppData.users || []).find(u => u.uid === me.uid || u.id === me.uid) || null;
  }
  function nowTs() { return new Date(); }

  // ══════════════════════════════════════════════════════════════════
  //  1) FAVORITES
  // ══════════════════════════════════════════════════════════════════
  window.ph18_isFav = function (svcId) {
    const me = meDoc(); if (!me) return false;
    return Array.isArray(me.favorites) && me.favorites.includes(svcId);
  };
  window.ph18_toggleFav = async function (svcId, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const me = meDoc(); if (!me) { toast('سجّل الدخول أولاً','info'); return; }
    const cur = Array.isArray(me.favorites) ? me.favorites.slice() : [];
    const i = cur.indexOf(svcId);
    if (i >= 0) cur.splice(i, 1); else cur.push(svcId);
    await fsUpdate('users', me.id, { favorites: cur });
    me.favorites = cur;
    toast(i >= 0 ? '💔 تم الحذف من المفضّلة' : '❤️ تمت الإضافة للمفضّلة', 'success');
    await render();
  };

  // Heart injection & favorites page now handled by wishlist.js (نظام المفضلة الاحترافي)

  // ══════════════════════════════════════════════════════════════════
  //  2) ADDRESS BOOK
  // ══════════════════════════════════════════════════════════════════
  window.ph18_savedAddrs = function () {
    const me = meDoc();
    return (me && Array.isArray(me.savedAddresses)) ? me.savedAddresses : [];
  };
  window.ph18_addAddrModal = function (idx) {
    const list = ph18_savedAddrs();
    const a = (idx != null) ? list[idx] : { label:'', address:'', lat:'', lng:'' };
    openModal(`
      <div class="modal-header">
        <h2 class="modal-title">${idx!=null?'✏️ تعديل عنوان':'➕ إضافة عنوان جديد'}</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="form-group"><label class="form-label">التسمية</label>
        <input class="form-control" id="ph18-a-label" placeholder="مثال: المنزل · العمل · بيت أهلي" value="${escAttr(a.label||'')}"></div>
      <div class="form-group"><label class="form-label">العنوان التفصيلي</label>
        <textarea class="form-control" id="ph18-a-addr" rows="2" placeholder="المدينة، الحي، الشارع، رقم المبنى...">${escHtml(a.address||'')}</textarea></div>
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label">خط العرض (اختياري)</label>
          <input class="form-control" id="ph18-a-lat" type="number" step="0.0000001" value="${a.lat||''}"></div>
        <div class="form-group"><label class="form-label">خط الطول (اختياري)</label>
          <input class="form-control" id="ph18-a-lng" type="number" step="0.0000001" value="${a.lng||''}"></div>
      </div>
      <button class="btn btn-secondary btn-block" onclick="ph18_useGeo()" style="margin-bottom:8px">📍 استخدام موقعي الحالي</button>
      <button class="btn btn-primary btn-block" onclick="ph18_saveAddr(${idx==null?'null':idx})">💾 حفظ العنوان</button>`);
  };
  window.ph18_useGeo = function () {
    if (!navigator.geolocation) { toast('المتصفح لا يدعم تحديد الموقع','error'); return; }
    toast('📍 جاري تحديد موقعك...','info');
    navigator.geolocation.getCurrentPosition(p => {
      const la = document.getElementById('ph18-a-lat');
      const ln = document.getElementById('ph18-a-lng');
      if (la) la.value = p.coords.latitude.toFixed(6);
      if (ln) ln.value = p.coords.longitude.toFixed(6);
      toast('تم تحديد الموقع ✅','success');
    }, () => toast('تعذّر تحديد الموقع','error'));
  };
  window.ph18_saveAddr = async function (idx) {
    const me = meDoc(); if (!me) return;
    const label = document.getElementById('ph18-a-label').value.trim();
    const address = document.getElementById('ph18-a-addr').value.trim();
    const lat = parseFloat(document.getElementById('ph18-a-lat').value) || null;
    const lng = parseFloat(document.getElementById('ph18-a-lng').value) || null;
    if (!label || !address) { toast('التسمية والعنوان مطلوبان','error'); return; }
    const list = ph18_savedAddrs().slice();
    const obj = { id: idx!=null ? list[idx].id : ('a'+Date.now()), label, address, lat, lng };
    if (idx != null) list[idx] = obj; else list.push(obj);
    await fsUpdate('users', me.id, { savedAddresses: list });
    me.savedAddresses = list;
    closeModal(); toast('تم الحفظ ✅','success'); await render();
  };
  window.ph18_deleteAddr = async function (idx) {
    if (!confirm('حذف هذا العنوان؟')) return;
    const me = meDoc(); if (!me) return;
    const list = ph18_savedAddrs().slice();
    list.splice(idx,1);
    await fsUpdate('users', me.id, { savedAddresses: list });
    me.savedAddresses = list;
    toast('تم الحذف','success'); await render();
  };

  addPage('addresses', function renderAddresses() {
    const list = ph18_savedAddrs();
    return `
    <div id="app-content">
      <div class="page-header">
        <button class="back-btn" onclick="navigate('home')">→ رجوع</button>
        <h1>📍 دفتر العناوين</h1>
      </div>
      <div class="listing-container">
        <button class="btn btn-primary btn-block" style="margin-bottom:18px" onclick="ph18_addAddrModal()">➕ إضافة عنوان جديد</button>
        ${list.length ? `<div class="ph18-addr-list">${list.map((a,i) => `
          <div class="ph18-addr-card">
            <div class="ph18-addr-h">📍 ${escHtml(a.label)}</div>
            <div class="ph18-addr-b">${escHtml(a.address)}</div>
            ${(a.lat&&a.lng) ? `<div class="ph18-addr-coord">${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}</div>` : ''}
            <div class="ph18-addr-acts">
              <button class="btn btn-sm btn-secondary" onclick="ph18_addAddrModal(${i})">✏️ تعديل</button>
              <button class="btn btn-sm btn-danger" onclick="ph18_deleteAddr(${i})">🗑️ حذف</button>
            </div>
          </div>`).join('')}</div>` : `
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <div class="empty-title">لا توجد عناوين محفوظة</div>
            <div class="empty-sub">احفظ عناوينك المتكررة لتختارها بسرعة عند الحجز</div>
          </div>`}
      </div>
    </div>`;
  });

  // Inject saved-address chips into the booking modal.
  const __origOpenModal2 = window.openModal;
  window.openModal = function (html) {
    try {
      if (typeof html === 'string' && /id="bk-addr"/.test(html)) {
        const list = ph18_savedAddrs();
        if (list.length) {
          const chips = list.map((a,i) =>
            `<button type="button" class="ph18-addr-chip" onclick="(function(){document.getElementById('bk-addr').value=${JSON.stringify(a.address)};})()">📍 ${escHtml(a.label)}</button>`
          ).join('');
          html = html.replace(
            /(<input class="form-control" id="bk-addr"[^>]*>)/,
            '$1<div class="ph18-addr-chips">' + chips + '</div>'
          );
        }
      }
    } catch (e) { console.warn('[phase18] openModal addr chips', e); }
    return __origOpenModal2.apply(this, arguments);
  };

  // ══════════════════════════════════════════════════════════════════
  //  3) ORDER TIMELINE + CANCEL & REFUND
  // ══════════════════════════════════════════════════════════════════
  const TIMELINE_STEPS = [
    { k:'pending',           ic:'⏳', l:'تم استلام الطلب'           },
    { k:'accepted',          ic:'✅', l:'قُبل الطلب من المزوّد'      },
    { k:'with_driver',       ic:'🚗', l:'مع المندوب — قيد التوصيل' },
    { k:'delivered',         ic:'📦', l:'تم التوصيل'                 },
    { k:'completed',         ic:'🎉', l:'مكتمل'                       }
  ];
  window.ph18_orderTimeline = function (order) {
    if (!order) return '';
    const cur = order.status || 'pending';
    const idxOf = k => TIMELINE_STEPS.findIndex(s => s.k === k);
    const curIdx = Math.max(0, idxOf(cur));
    if (cur === 'cancelled') {
      return `<div class="ph18-timeline ph18-cancelled">
        <div class="ph18-tl-row done"><span class="ph18-tl-ic">⏳</span><span>تم استلام الطلب</span></div>
        <div class="ph18-tl-row cancelled"><span class="ph18-tl-ic">❌</span><span>أُلغي الطلب${order.cancelReason?` — ${escHtml(order.cancelReason)}`:''}</span></div>
        ${order.refundAmount?`<div class="ph18-tl-row done"><span class="ph18-tl-ic">💰</span><span>تم استرداد ${order.refundAmount} ﷼ إلى محفظتك</span></div>`:''}
      </div>`;
    }
    return `<div class="ph18-timeline">
      ${TIMELINE_STEPS.map((s,i) => {
        const cls = i < curIdx ? 'done' : (i === curIdx ? 'current' : 'pending');
        return `<div class="ph18-tl-row ${cls}"><span class="ph18-tl-ic">${s.ic}</span><span>${s.l}</span></div>`;
      }).join('')}
    </div>`;
  };

  window.ph18_cancelOrder = async function (orderId) {
    const o = (AppData.orders||[]).find(x => x.id === orderId);
    if (!o) return;
    if (!['pending','accepted'].includes(o.status)) {
      toast('لا يمكن الإلغاء بعد بدء التوصيل','error'); return;
    }
    const reason = prompt('سبب الإلغاء (اختياري):') || '—';
    if (reason === null) return;
    let refund = 0;
    try {
      // Refund to wallet if customer paid (servicePrice + deliveryFee).
      if (o.total && o.customerId === State.currentUser.uid) {
        await creditWallet(o.customerId, o.total, `استرداد طلب ${o.orderId||orderId}`, orderId);
        refund = o.total;
      }
    } catch (e) { console.warn('[phase18] refund failed', e); }
    await fsUpdate('orders', orderId, {
      status: 'cancelled', cancelledAt: nowTs(),
      cancelledBy: State.currentUser.uid, cancelReason: reason, refundAmount: refund
    });
    toast(refund?`تم الإلغاء — استُردّ ${refund} ﷼ لمحفظتك ✅`:'تم الإلغاء','success');
    if (typeof loadAllData==='function') await loadAllData();
    await render();
  };

  // Wrap renderMyOrders so each order shows a timeline + cancel button.
  setTimeout(() => {
    const orig = window.renderMyOrders;
    if (typeof orig !== 'function') return;
    window.renderMyOrders = function () {
      let html = orig.apply(this, arguments);
      // Append a "details" panel below the table summarizing each order's timeline.
      const u = State.currentUser; if (!u) return html;
      const orders = (AppData.orders||[]).filter(o => o.customerId === u.uid)
        .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))
        .slice(0, 6);
      if (!orders.length) return html;
      const cards = orders.map(o => `
        <div class="ph18-mo-card">
          <div class="ph18-mo-h">
            <span>${o.svcIcon||'🔷'} ${escHtml(o.svcName||'طلب')}</span>
            <span class="ph18-mo-id">#${o.orderId||o.id?.slice(0,6)}</span>
          </div>
          ${ph18_orderTimeline(o)}
          ${['pending','accepted'].includes(o.status) ? `
            <button class="btn btn-sm btn-danger" style="margin-top:8px" onclick="ph18_cancelOrder('${o.id}')">❌ إلغاء الطلب</button>
          ` : ''}
        </div>`).join('');
      const block = `<div class="ph18-mo-wrap">
        <h3 style="margin:24px 0 12px">📍 تتبّع آخر طلباتك</h3>
        ${cards}
      </div>`;
      // Append before the closing </div>#app-content (last </div>).
      return html.replace(/<\/div>\s*$/, block + '</div>');
    };
  }, 1500);

  // ══════════════════════════════════════════════════════════════════
  //  4) GLOBAL SEARCH overlay
  // ══════════════════════════════════════════════════════════════════
  window.ph18_openSearch = function () {
    const overlay = document.createElement('div');
    overlay.className = 'ph18-search-overlay';
    overlay.id = 'ph18-search-overlay';
    overlay.innerHTML = `
      <div class="ph18-search-box">
        <div class="ph18-search-bar">
          <span class="ph18-search-ic">🔎</span>
          <input id="ph18-search-input" placeholder="ابحث عن خدمة، تصنيف، أو مزوّد..." autocomplete="off">
          <button class="ph18-search-close" onclick="ph18_closeSearch()">✕</button>
        </div>
        <div class="ph18-search-results" id="ph18-search-results">
          <div class="ph18-search-empty">ابدأ الكتابة للبحث في كل المحتوى...</div>
        </div>
      </div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) ph18_closeSearch(); });
    document.body.appendChild(overlay);
    setTimeout(() => {
      const inp = document.getElementById('ph18-search-input');
      if (inp) { inp.focus(); inp.addEventListener('input', () => ph18_runSearch(inp.value)); }
    }, 50);
    document.addEventListener('keydown', ph18_searchEsc);
  };
  window.ph18_searchEsc = function (e) { if (e.key === 'Escape') ph18_closeSearch(); };
  window.ph18_closeSearch = function () {
    const o = document.getElementById('ph18-search-overlay');
    if (o) o.remove();
    document.removeEventListener('keydown', ph18_searchEsc);
  };
  window.ph18_runSearch = function (q) {
    q = (q||'').trim().toLowerCase();
    const box = document.getElementById('ph18-search-results');
    if (!box) return;
    if (q.length < 2) { box.innerHTML = '<div class="ph18-search-empty">اكتب حرفين على الأقل...</div>'; return; }
    const cats = (AppData.cats||[]).filter(c => (c.name||'').toLowerCase().includes(q)).slice(0,8);
    const svcs = (AppData.services||[]).filter(s =>
      (s.name||'').toLowerCase().includes(q) ||
      (s.desc||'').toLowerCase().includes(q) ||
      (s.provider||'').toLowerCase().includes(q)
    ).slice(0,15);
    const html = [];
    if (cats.length) {
      html.push('<div class="ph18-search-section">📂 التصنيفات</div>');
      cats.forEach(c => html.push(`
        <div class="ph18-search-item" onclick="ph18_closeSearch();navigate('listing',{catId:'${c.id}'})">
          <span class="ph18-si-ic">${c.icon||'📂'}</span>
          <div><div class="ph18-si-name">${escHtml(c.name)}</div><div class="ph18-si-meta">${c.section||''}</div></div>
        </div>`));
    }
    if (svcs.length) {
      html.push('<div class="ph18-search-section">🛎️ الخدمات</div>');
      svcs.forEach(s => html.push(`
        <div class="ph18-search-item" onclick="ph18_closeSearch();bookService('${s.id}')">
          <span class="ph18-si-ic">${s.icon||'🔷'}</span>
          <div>
            <div class="ph18-si-name">${escHtml(s.name)}</div>
            <div class="ph18-si-meta">${s.price?s.price+' ﷼':''}</div>
          </div>
        </div>`));
    }
    if (!html.length) html.push('<div class="ph18-search-empty">لا توجد نتائج</div>');
    box.innerHTML = html.join('');
  };

  // Inject search button into the navbar via DOM mutation observer.
  function injectSearchBtn() {
    const nw = document.getElementById('navbar-wrap');
    if (!nw) return;
    if (nw.querySelector('.ph18-nav-search')) return;
    const target = nw.querySelector('.nav-actions, .navbar-actions, .navbar, nav, header');
    if (!target) return;
    const btn = document.createElement('button');
    btn.className = 'ph18-nav-search';
    btn.title = 'بحث';
    btn.innerHTML = '🔎';
    btn.onclick = () => ph18_openSearch();
    target.appendChild(btn);
  }
  setInterval(injectSearchBtn, 700);

  // ══════════════════════════════════════════════════════════════════
  //  5) STATIC PAGES: about / terms / privacy / help
  // ══════════════════════════════════════════════════════════════════
  function staticPage(title, icon, body) {
    return `<div id="app-content">
      <div class="page-header">
        <button class="back-btn" onclick="navigate('home')">→ رجوع</button>
        <h1>${icon} ${title}</h1>
      </div>
      <div class="listing-container">
        <div class="ph18-static">${body}</div>
      </div>
    </div>`;
  }
  addPage('about', () => staticPage('من نحن', 'ℹ️', `
    <h2>محجوز</h2>
    <p>محجوز هي منصة عربية شاملة تجمع بين <b>الحجوزات</b> (فنادق، سيارات، رحلات، صحة، أعراس)،
    و<b>الخدمات المهنية</b> (كهربائي، سباك، تصوير، إعلام، تعليم)،
    و<b>المتاجر والصيدليات</b> مع توصيل ذكي.</p>
    <p>هدفنا تبسيط الحياة اليومية للمستخدم العربي وتوفير تجربة موحّدة آمنة وسهلة.</p>
    <h3>قيمنا</h3>
    <ul>
      <li>🔐 الأمان والخصوصية أولاً</li>
      <li>⚡ السرعة والاستجابة الفورية</li>
      <li>🤝 الشفافية في الأسعار والعمولات</li>
      <li>🌍 خدمة كل مدينة وقرية بكل اللغات</li>
    </ul>
    <p style="margin-top:20px;color:var(--text-muted)">للتواصل: <b>support@mahjooz.app</b></p>`));

  addPage('terms', () => staticPage('شروط الاستخدام', '📜', `
    <h3>1. القبول بالشروط</h3>
    <p>باستخدامك لمنصة محجوز فإنك توافق على الالتزام بهذه الشروط بالكامل.</p>
    <h3>2. حسابات المستخدمين</h3>
    <p>أنت مسؤول عن سرّية بيانات حسابك وكل النشاط الذي يجري تحته. يحقّ للمنصة تعليق أي حساب يخالف الشروط.</p>
    <h3>3. الحجوزات والمدفوعات</h3>
    <p>كل عملية تتم عبر المحفظة الرقمية أو وسيلة دفع معتمدة. تطبَّق سياسة الإلغاء والاسترداد المنشورة لكل خدمة.</p>
    <h3>4. مسؤولية مزوّدي الخدمة</h3>
    <p>المزوّد مسؤول عن جودة الخدمة المقدّمة، ومحجوز تلعب دور الوسيط التقني والتسهيلي.</p>
    <h3>5. التعديلات</h3>
    <p>تحتفظ محجوز بحقّ تعديل هذه الشروط في أي وقت، وسيتم إشعار المستخدمين بأي تغيير جوهري.</p>`));

  addPage('privacy', () => staticPage('سياسة الخصوصية', '🔒', `
    <h3>المعلومات التي نجمعها</h3>
    <p>نجمع البيانات اللازمة لتقديم الخدمة فقط: الاسم، البريد، الجوال، العنوان، الموقع الجغرافي عند الطلب،
    وسجل المعاملات داخل المنصة.</p>
    <h3>كيف نستخدم بياناتك</h3>
    <ul>
      <li>تنفيذ طلباتك وحجوزاتك</li>
      <li>تحسين الخدمة وتجربة الاستخدام</li>
      <li>إرسال إشعارات مهمّة بحالة الطلب</li>
      <li>منع الاحتيال وحماية الحسابات</li>
    </ul>
    <h3>المشاركة مع أطراف ثالثة</h3>
    <p>لا نشارك بياناتك الشخصية مع أي طرف ثالث للأغراض التسويقية. قد نشارك بيانات محدودة مع المزوّد/المندوب لإتمام التوصيل.</p>
    <h3>حقوقك</h3>
    <p>يحقّ لك طلب نسخة من بياناتك أو حذفها في أي وقت من <b>الإعدادات → تصدير بياناتي / حذف الحساب</b>.</p>`));

  addPage('help', () => staticPage('المساعدة والأسئلة الشائعة', '❓', `
    <details class="ph18-faq" open><summary>كيف أحجز خدمة؟</summary>
    <p>اختر التصنيف من الصفحة الرئيسية → اختر الخدمة → اضغط «احجز الآن» → عبّ التاريخ والعنوان → أكّد الحجز.</p></details>
    <details class="ph18-faq"><summary>كيف أشحن محفظتي؟</summary>
    <p>من «محفظتي» → «شحن الرصيد» → اختر طريقة الدفع → ارفع إيصال التحويل → الإدارة تعتمد خلال دقائق.</p></details>
    <details class="ph18-faq"><summary>متى يمكنني إلغاء الطلب؟</summary>
    <p>يمكنك إلغاء الطلب طالما لم يبدأ المندوب التوصيل. سيُسترد المبلغ تلقائياً إلى محفظتك.</p></details>
    <details class="ph18-faq"><summary>كيف أتواصل مع الدعم؟</summary>
    <p>عبر البريد <b>support@mahjooz.app</b> أو زرّ المحادثة 💬 في الزاوية السفلى.</p></details>`));

  // Inject footer links pointing to these pages.
  function injectFooterLinks() {
    const f = document.getElementById('footer');
    if (!f) return;
    if (f.querySelector('.ph18-foot-links')) return;
    const wrap = document.createElement('div');
    wrap.className = 'ph18-foot-links';
    wrap.innerHTML = `
      <a onclick="navigate('about')">من نحن</a>
      <a onclick="navigate('help')">المساعدة</a>
      <a onclick="navigate('terms')">الشروط</a>
      <a onclick="navigate('privacy')">الخصوصية</a>`;
    f.appendChild(wrap);
  }
  setInterval(injectFooterLinks, 800);

  // ══════════════════════════════════════════════════════════════════
  //  6) PROFILE MENU additions: favorites + addresses + install
  // ══════════════════════════════════════════════════════════════════
  function injectProfileMenuItems() {
    const menu = document.querySelector('.profile-menu');
    if (!menu || menu.dataset.ph18Done) return;
    const items = `
      <button class="profile-menu-item" onclick="closeProfileMenu();navigate('favorites')"><span>❤️</span><span>المفضّلة</span></button>
      <button class="profile-menu-item" onclick="closeProfileMenu();navigate('addresses')"><span>📍</span><span>دفتر العناوين</span></button>
      <button class="profile-menu-item" onclick="closeProfileMenu();navigate('help')"><span>❓</span><span>المساعدة</span></button>`;
    // Insert before the last item (logout) if present, else append.
    const last = menu.querySelector('.profile-menu-item:last-child');
    if (last) last.insertAdjacentHTML('beforebegin', items);
    else menu.insertAdjacentHTML('beforeend', items);
    menu.dataset.ph18Done = '1';
  }
  setInterval(injectProfileMenuItems, 700);

  // ══════════════════════════════════════════════════════════════════
  //  7) PWA install prompt + first-visit onboarding
  // ══════════════════════════════════════════════════════════════════
  let __ph18_installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    __ph18_installEvt = e;
    // showInstallChip(); // Disabled per user request
  });
  function showInstallChip() {
    if (document.getElementById('ph18-install-chip')) return;
    const chip = document.createElement('button');
    chip.id = 'ph18-install-chip';
    chip.className = 'ph18-install-chip';
    chip.innerHTML = '📲 تثبيت التطبيق';
    chip.onclick = async () => {
      if (!__ph18_installEvt) return;
      __ph18_installEvt.prompt();
      const r = await __ph18_installEvt.userChoice;
      __ph18_installEvt = null;
      chip.remove();
      if (r.outcome === 'accepted') toast('🎉 تم التثبيت!','success');
    };
    document.body.appendChild(chip);
  }

  // Onboarding — shows ONLY once after first signup (tracked in Firestore).
  function maybeShowOnboarding() {
    if (!State.currentUser) return;
    // Only show for newly registered users (onboardingSeen === false, not undefined)
    if (State.currentUser.onboardingSeen !== false) return;
    // Mark as seen immediately (Firestore + local) so it never shows again
    fsUpdate('users', State.currentUser.uid, { onboardingSeen: true }).catch(() => {});
    State.currentUser.onboardingSeen = true;
    const slides = [
      { ic:'🏨', t:'احجز ما تريد في ثوانٍ', s:'فنادق، سيارات، رحلات، صحة، أعراس، خدمات مهنية، صيدليات — كلها في تطبيق واحد.' },
      { ic:'🚦', t:'توصيل ذكي بأقرب مزوّد', s:'نظامنا يوصل طلبك أوتوماتيكياً لأقرب مزوّد ثم لأقرب مندوب — توفير وقت وجودة.' },
      { ic:'❤️', t:'مكافآت وولاء', s:'كل طلب مكتمل = نقاط ولاء تتحوّل لرصيد محفظة. وفّر مع كل تجربة!' }
    ];
    let i = 0;
    const overlay = document.createElement('div');
    overlay.className = 'ph18-onb-overlay';
    function paint() {
      const sl = slides[i];
      overlay.innerHTML = `
        <div class="ph18-onb-card">
          <div class="ph18-onb-ic">${sl.ic}</div>
          <h2>${sl.t}</h2>
          <p>${sl.s}</p>
          <div class="ph18-onb-dots">
            ${slides.map((_,n) => `<span class="${n===i?'on':''}"></span>`).join('')}
          </div>
          <div class="ph18-onb-acts">
            <button class="btn btn-secondary" onclick="document.querySelector('.ph18-onb-overlay').remove()">تخطّي</button>
            <button class="btn btn-primary" id="ph18-onb-next">${i<slides.length-1?'التالي →':'ابدأ الآن 🎉'}</button>
          </div>
        </div>`;
      
      // Ensure element exists in document before adding listener
      const nextBtn = document.getElementById('ph18-onb-next') || overlay.querySelector('#ph18-onb-next');
      if (nextBtn) {
        nextBtn.onclick = () => {
          if (i < slides.length - 1) { i++; paint(); }
          else overlay.remove();
        };
      }
    }
    document.body.appendChild(overlay);
    paint();
  }
  setTimeout(maybeShowOnboarding, 2500);

  // ══════════════════════════════════════════════════════════════════
  //  8) ADMIN — LIVE ROUTING MAP
  // ══════════════════════════════════════════════════════════════════
  // Inject "🚦 التوجيه المباشر" sidebar tab into admin via wrapping renderAdmin.
  // window.renderAdmin override removed to prevent conflicts with dashboards.js hub UI.



  function activeRoutedOrders() {
    return (AppData.orders||[]).filter(o =>
      o.routingKind === 'store' &&
      !['completed','delivered','cancelled','no_providers','no_drivers'].includes(o.status)
    );
  }

  window.ph18_renderLiveRouting = function () {
    const orders = activeRoutedOrders();
    const totalRej = orders.reduce((a,o) => a + (o.providerHistory?.length||0) + (o.driverHistory?.length||0), 0);
    return `
      <h2>🚦 التوجيه المباشر للطلبات</h2>
      <div class="ph18-route-stats">
        <div class="ph18-route-stat"><b>${orders.length}</b><span>طلب نشط</span></div>
        <div class="ph18-route-stat"><b>${totalRej}</b><span>محاولة مرفوضة</span></div>
        <div class="ph18-route-stat"><b>${orders.filter(o=>o.assignedDriverId).length}</b><span>مع مندوب</span></div>
      </div>
      <div class="ph18-route-grid">
        <div id="ph18-route-map" class="ph18-route-map"></div>
        <div class="ph18-route-side">
          <h3>الطلبات النشطة</h3>
          ${orders.length ? orders.map(o => {
            const svc = (AppData.services||[]).find(s => s.id === o.svcId);
            const provName = (AppData.users||[]).find(u => u.uid===o.assignedProviderId||u.id===o.assignedProviderId)?.name || '—';
            const drvName  = (AppData.users||[]).find(u => u.uid===o.assignedDriverId ||u.id===o.assignedDriverId)?.name  || '—';
            return `<div class="ph18-route-item" onclick="ph18_focusOrder('${o.id}')">
              <div class="ph18-route-iname">${svc?.icon||'🔷'} ${escHtml(svc?.name||o.svcName||'طلب')}</div>
              <div class="ph18-route-imeta">العميل: <b>${escHtml(o.customerName||'—')}</b></div>
              <div class="ph18-route-imeta">المزوّد: ${escHtml(provName)} · المندوب: ${escHtml(drvName)}</div>
              <div class="ph18-route-imeta">رفض: ${(o.providerHistory?.length||0)} مزوّد · ${(o.driverHistory?.length||0)} مندوب</div>
              <div class="ph18-route-istat">${o.status}</div>
            </div>`;
          }).join('') : '<div class="empty-state" style="padding:30px"><div class="empty-icon">📍</div><div class="empty-title">لا توجد طلبات نشطة</div></div>'}
        </div>
      </div>`;
  };

  let __ph18_map = null;
  let __ph18_layers = [];
  function clearLayers() {
    __ph18_layers.forEach(l => { try { __ph18_map.removeLayer(l); } catch(e){} });
    __ph18_layers = [];
  }
  function plotRouting() {
    if (typeof google === 'undefined') return;
    const el = document.getElementById('ph18-route-map');
    if (!el) return;
    if (!__ph18_map) {
      __ph18_map = new google.maps.Map(el, {
        center: { lat: 15.55, lng: 48.5 },
        zoom: 6,
        mapTypeControl: false,
        streetViewControl: false
      });
    }
    clearLayers();
    const orders = activeRoutedOrders();
    const bounds = new google.maps.LatLngBounds();
    let hasBounds = false;

    orders.forEach(o => {
      const cust = (o.customerLat!=null && o.customerLng!=null) ? { lat: o.customerLat, lng: o.customerLng } : null;
      const provUser = (AppData.users||[]).find(u => u.uid===o.assignedProviderId||u.id===o.assignedProviderId);
      const drvUser  = (AppData.users||[]).find(u => u.uid===o.assignedDriverId ||u.id===o.assignedDriverId);
      const prov = provUser && provUser.lat!=null ? { lat: provUser.lat, lng: provUser.lng } : null;
      const drv  = drvUser  && drvUser.lat !=null ? { lat: drvUser.lat,  lng: drvUser.lng }  : null;

      if (cust) {
        const m = new google.maps.Marker({
          position: cust,
          map: __ph18_map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#fca5a5',
            fillOpacity: 0.85,
            strokeColor: '#dc2626',
            strokeWeight: 2,
            scale: 9
          },
          title: `👤 ${o.customerName||''}`
        });
        __ph18_layers.push(m);
        bounds.extend(cust);
        hasBounds = true;
      }
      if (prov) {
        const m = new google.maps.Marker({
          position: prov,
          map: __ph18_map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#93c5fd',
            fillOpacity: 0.85,
            strokeColor: '#2563eb',
            strokeWeight: 2,
            scale: 9
          },
          title: `🏪 ${provUser.name||''}`
        });
        __ph18_layers.push(m);
        bounds.extend(prov);
        hasBounds = true;
        if (cust) {
          const ln = new google.maps.Polyline({
            path: [prov, cust],
            geodesic: true,
            strokeColor: '#2563eb',
            strokeOpacity: 0.5,
            strokeWeight: 2,
            map: __ph18_map
          });
          __ph18_layers.push(ln);
        }
      }
      if (drv) {
        const m = new google.maps.Marker({
          position: drv,
          map: __ph18_map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#86efac',
            fillOpacity: 0.85,
            strokeColor: '#16a34a',
            strokeWeight: 2,
            scale: 9
          },
          title: `🛵 ${drvUser.name||''}`
        });
        __ph18_layers.push(m);
        bounds.extend(drv);
        hasBounds = true;
        if (cust) {
          const ln = new google.maps.Polyline({
            path: [drv, cust],
            geodesic: true,
            strokeColor: '#16a34a',
            strokeOpacity: 0.5,
            strokeWeight: 2,
            map: __ph18_map
          });
          __ph18_layers.push(ln);
        }
      }
    });
    if (hasBounds) {
      __ph18_map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    }
  }
  // Re-plot whenever the routing tab is open.
  setInterval(() => {
    if ((State.adminTab === 'ph18routing' || State.adminTab === 'direct_routing') && document.getElementById('ph18-route-map')) {
      plotRouting();
    }
  }, 1500);

  window.ph18_focusOrder = function (orderId) {
    const o = (AppData.orders||[]).find(x => x.id === orderId);
    if (!o || !__ph18_map) return;
    if (o.customerLat!=null) __ph18_map.setView([o.customerLat, o.customerLng], 14);
  };

  // ══════════════════════════════════════════════════════════════════
  //  CSS
  // ══════════════════════════════════════════════════════════════════
  const css = `
  /* Favorites */
  .ph18-fav-btn { position:absolute; top:10px; left:10px; width:36px; height:36px; border-radius:50%; border:0; background:rgba(255,255,255,.9); font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,.12); transition:transform .15s; z-index:5; }
  .ph18-fav-btn:hover { transform:scale(1.1); }
  /* Address book */
  .ph18-addr-list { display:grid; gap:12px; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); }
  .ph18-addr-card { background:var(--bg-hover); border:1px solid var(--border); border-radius:14px; padding:16px; }
  .ph18-addr-h { font-weight:800; margin-bottom:6px; }
  .ph18-addr-b { color:var(--text-secondary); font-size:14px; line-height:1.6; }
  .ph18-addr-coord { color:var(--text-muted); font-size:11px; direction:ltr; margin-top:6px; }
  .ph18-addr-acts { display:flex; gap:8px; margin-top:10px; }
  .ph18-addr-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
  .ph18-addr-chip { background:rgba(124,58,237,.1); border:1px solid rgba(124,58,237,.3); color:#7c3aed; padding:6px 12px; border-radius:18px; font-size:12px; cursor:pointer; }
  .ph18-addr-chip:hover { background:rgba(124,58,237,.2); }
  /* Order timeline */
  .ph18-mo-wrap { margin-top:18px; }
  .ph18-mo-card { background:var(--bg-hover); border:1px solid var(--border); border-radius:14px; padding:14px; margin-bottom:10px; }
  .ph18-mo-h { display:flex; justify-content:space-between; font-weight:800; margin-bottom:8px; }
  .ph18-mo-id { color:var(--text-muted); font-size:12px; direction:ltr; }
  .ph18-timeline { display:grid; gap:6px; }
  .ph18-tl-row { display:flex; align-items:center; gap:10px; padding:6px 10px; border-radius:8px; font-size:13px; }
  .ph18-tl-row.done { color:#10b981; background:rgba(16,185,129,.06); }
  .ph18-tl-row.current { color:#7c3aed; background:rgba(124,58,237,.1); font-weight:700; box-shadow:inset 0 0 0 1px rgba(124,58,237,.3); }
  .ph18-tl-row.pending { color:var(--text-muted); }
  .ph18-tl-row.cancelled { color:#ef4444; background:rgba(239,68,68,.06); }
  .ph18-tl-ic { width:22px; text-align:center; }
  /* Search */
  .ph18-nav-search { background:transparent; border:0; font-size:20px; cursor:pointer; padding:8px 12px; border-radius:50%; transition:background .15s; }
  .ph18-nav-search:hover { background:rgba(124,58,237,.1); }
  .ph18-search-overlay { position:fixed; inset:0; background:rgba(15,23,42,.7); backdrop-filter:blur(6px); z-index:9999; display:flex; align-items:flex-start; justify-content:center; padding:80px 20px; }
  .ph18-search-box { background:var(--bg-card,#fff); width:100%; max-width:640px; border-radius:18px; box-shadow:0 20px 60px rgba(0,0,0,.4); overflow:hidden; }
  .ph18-search-bar { display:flex; align-items:center; padding:14px 18px; border-bottom:1px solid var(--border); }
  .ph18-search-ic { font-size:20px; margin-left:12px; }
  .ph18-search-bar input { flex:1; border:0; outline:0; font-size:16px; background:transparent; color:var(--text-main); }
  .ph18-search-close { background:transparent; border:0; font-size:18px; cursor:pointer; color:var(--text-muted); padding:4px 8px; }
  .ph18-search-results { max-height:60vh; overflow:auto; padding:8px 0; }
  .ph18-search-section { padding:10px 18px 4px; font-size:11px; color:var(--text-muted); font-weight:700; letter-spacing:1px; }
  .ph18-search-item { display:flex; gap:12px; align-items:center; padding:12px 18px; cursor:pointer; }
  .ph18-search-item:hover { background:var(--bg-hover); }
  .ph18-si-ic { font-size:24px; }
  .ph18-si-name { font-weight:700; }
  .ph18-si-meta { font-size:12px; color:var(--text-muted); }
  .ph18-search-empty { padding:40px; text-align:center; color:var(--text-muted); }
  /* Static pages */
  .ph18-static { background:var(--bg-hover); border-radius:14px; padding:24px; line-height:1.9; }
  .ph18-static h2,.ph18-static h3 { margin:18px 0 10px; }
  .ph18-static ul { margin-right:20px; }
  .ph18-faq { background:var(--bg-card,#fff); border:1px solid var(--border); border-radius:10px; padding:14px 18px; margin-bottom:8px; }
  .ph18-faq summary { cursor:pointer; font-weight:700; padding:6px 0; }
  .ph18-faq[open] summary { color:#7c3aed; }
  /* Footer */
  .ph18-foot-links { display:flex; gap:18px; justify-content:center; margin-top:14px; flex-wrap:wrap; }
  .ph18-foot-links a { color:var(--text-muted); cursor:pointer; font-size:13px; text-decoration:none; }
  .ph18-foot-links a:hover { color:#7c3aed; }
  /* Install chip */
  .ph18-install-chip { position:fixed; bottom:18px; left:18px; z-index:9000; background:linear-gradient(135deg,#7c3aed,#0d9488); color:#fff; border:0; padding:12px 18px; border-radius:30px; box-shadow:0 8px 24px rgba(124,58,237,.4); cursor:pointer; font-weight:700; }
  .ph18-install-chip:hover { transform:translateY(-2px); }
  /* Onboarding */
  .ph18-onb-overlay { position:fixed; inset:0; background:rgba(15,23,42,.85); backdrop-filter:blur(8px); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; }
  .ph18-onb-card { background:var(--bg-card,#fff); border-radius:20px; padding:30px; max-width:420px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,.5); }
  .ph18-onb-ic { font-size:56px; margin-bottom:14px; }
  .ph18-onb-card h2 { font-size:22px; margin-bottom:10px; }
  .ph18-onb-card p { color:var(--text-secondary); line-height:1.8; }
  .ph18-onb-dots { display:flex; gap:8px; justify-content:center; margin:20px 0; }
  .ph18-onb-dots span { width:10px; height:10px; border-radius:50%; background:var(--border); }
  .ph18-onb-dots span.on { background:#7c3aed; width:24px; border-radius:5px; }
  .ph18-onb-acts { display:flex; gap:10px; }
  .ph18-onb-acts .btn { flex:1; }
  /* Routing map */
  .ph18-route-stats { display:flex; gap:12px; margin:14px 0 18px; flex-wrap:wrap; }
  .ph18-route-stat { background:var(--bg-hover); padding:14px 18px; border-radius:12px; min-width:130px; }
  .ph18-route-stat b { display:block; font-size:24px; color:#7c3aed; }
  .ph18-route-stat span { font-size:12px; color:var(--text-muted); }
  .ph18-route-grid { display:grid; grid-template-columns:1fr 320px; gap:14px; }
  @media (max-width:900px) { .ph18-route-grid { grid-template-columns:1fr; } }
  .ph18-route-map { height:520px; border-radius:14px; overflow:hidden; border:1px solid var(--border); }
  .ph18-route-side { max-height:520px; overflow:auto; }
  .ph18-route-side h3 { margin:0 0 10px; font-size:14px; color:var(--text-muted); }
  .ph18-route-item { background:var(--bg-hover); border-radius:10px; padding:12px; margin-bottom:8px; cursor:pointer; border:1px solid var(--border); transition:transform .15s; }
  .ph18-route-item:hover { transform:translateX(-4px); border-color:#7c3aed; }
  .ph18-route-iname { font-weight:800; margin-bottom:4px; }
  .ph18-route-imeta { font-size:12px; color:var(--text-muted); margin-bottom:2px; }
  .ph18-route-istat { font-size:11px; padding:4px 8px; background:rgba(124,58,237,.1); color:#7c3aed; border-radius:6px; display:inline-block; margin-top:6px; font-weight:700; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  console.log('[Phase 18] Live routing map · favorites · address book · timeline · cancel/refund · global search · static pages · PWA · onboarding — loaded.');
})();

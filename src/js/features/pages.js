// ═══════════════════════════════════════════
//  محجوز v2.0 — Customer Pages
// ═══════════════════════════════════════════
// ─── Wallet Display Helper ───────────────
async function loadWalletForUser(uid) {
  try {
    const w = await fsGet('wallets', uid);
    return w?.balance || 0;
  } catch(e) { return 0; }
}
// ─── Home ─────────────────────────────────
function renderHome() {
  const u = State.currentUser;
  const activeAds = (AppData.ads || []).filter(a => {
    // Support both old format (a.active boolean) and new format (a.status)
    const isActive = a.status === 'active' || (a.status === undefined && a.active === true);
    if (!isActive) return false;
    // Check expiry only if endDate/expiresAt is set
    const expiry = a.endDate || a.expiresAt;
    if (expiry) {
      const expDate = expiry.toDate ? expiry.toDate() : new Date(expiry);
      if (expDate < new Date()) return false;
    }
    return true;
  });

  const sliderAds = activeAds.filter(a => a.type === 'slider' || !a.type);
  const bannerAds = activeAds.filter(a => a.type === 'banner');
  const nativeAds = activeAds.filter(a => a.type === 'native');

  // Trigger popup & interstitial ads on render
  setTimeout(() => {
    if (typeof triggerPopupAndInterstitialAds === 'function') {
      triggerPopupAndInterstitialAds(activeAds);
    }
  }, 300);

  const _regionId  = u?.regionId;
  const _govId     = u?.govId;
  const _regionObj = (AppData.regions || []).find(r => r.id === _regionId);
  const _regionedSvcs = (_regionId || _govId)
    ? AppData.services.filter(s => typeof ph_matchesLocation === 'function'
        ? ph_matchesLocation(s, _regionId, _govId)
        : (!s.regionId || s.regionId === _regionId))
    : AppData.services;
  const featured = _regionedSvcs.slice(0, 6);

  // Blend native ads inside the featured services list
  const serviceCards = featured.map(renderServiceCard);
  nativeAds.forEach((ad, index) => {
    const position = (index * 3) + 1; // Interleave native ads at index 1, 4, etc.
    if (position <= serviceCards.length) {
      serviceCards.splice(position, 0, renderNativeAdCard(ad));
    } else {
      serviceCards.push(renderNativeAdCard(ad));
    }
  });

  return `<div id="app-content" style="padding-top: 0;">
    <!-- Premium Hero Section -->
    <div class="hero-banner" style="background: linear-gradient(135deg, rgba(139,92,246,0.1), rgba(139,92,246,0.05)); border-radius: 0 0 32px 32px; padding: 60px 20px; text-align: center; margin-bottom: 40px; margin-top: -40px; border-bottom: 1px solid var(--glass-border);">
      <h1 style="font-size: 42px; font-weight: 800; margin-bottom: 16px; background: linear-gradient(135deg, var(--primary), #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">محجوز .. عالمك بين يديك</h1>
      <p style="color: var(--text-secondary); font-size: 18px; max-width: 600px; margin: 0 auto 32px; line-height: 1.6;">ابحث عن أقرب الفنادق، الخدمات المهنية، المتاجر، والصيدليات بضغطة زر. ماذا تحتاج اليوم؟</p>
      
      <div class="search-wrap" style="max-width: 600px; margin: 0 auto;">
        <div class="search-box" style="position: relative; display: flex; align-items: center; background: var(--bg-card); border-radius: 99px; border: 1px solid var(--glass-border); padding: 6px; box-shadow: var(--shadow-lg);">
          <input class="search-input" id="global-search" placeholder="ابحث عن خدمة، متجر، أو رقم صنف (#SKU)..." style="border: none; background: transparent; padding: 12px 24px; flex: 1; outline: none; font-size: 16px; color: var(--text-main);" onkeydown="if(event.key==='Enter'){const q=this.value.trim();navigate('listing',{section:'all',q:q})}">
          <button class="btn btn-primary" style="border-radius: 99px; padding: 12px 32px;" onclick="const q=document.getElementById('global-search').value.trim();navigate('listing',{section:'all',q:q})">بحث 🔍</button>
        </div>
      </div>
    </div>
    ${sliderAds.length ? renderAdsSlider(sliderAds) : ''}
    ${u?.role === 'customer' ? renderRegionBanner(_regionId, _regionObj) : ''}
    <div class="section-hub">
      <div class="section-title">🏠 الأقسام الرئيسية</div>
      <div class="hub-grid">
        ${(()=>{
          const isAdmin = u?.role === 'admin';
          const sv = window.SV;
          const _card = (key, html, adminLabel) => {
            if (!sv) return html;
            const visible = sv.get(key) !== false;
            const maint   = !!sv.get(key + '_maint');
            if (!isAdmin && !visible) return '';
            const overlay = isAdmin && !visible
              ? `<div class="sv-hub-badge sv-hub-badge-hidden">🙈 مخفي</div>` : '';
            const maintBadge = isAdmin && maint
              ? `<div class="sv-hub-badge sv-hub-badge-maint">🔧 صيانة</div>` : '';
            const dimStyle = isAdmin && !visible ? 'opacity:0.45;filter:grayscale(0.5);' : '';
            return html.replace('class="hub-card"', `class="hub-card" style="position:relative;${dimStyle}"`) + overlay + maintBadge;
          };
          const _click = (key, fallback) => {
            if (!window.SV || window.SV.isAccessible(key)) return fallback;
            return `svShowMaintMsg('${key}')`;
          };
          return `
          ${_card('bookings', `<div class="hub-card" onclick="${_click('bookings','navigate(\'listing\',{section:\'bookings\'})')}">
            <span class="hub-icon">📅</span><div class="hub-title">الحجوزات</div>
            <div class="hub-desc">فنادق، سيارات، رحلات، أطباء، أعراس وأكثر</div>
            <span class="badge badge-purple">${AppData.cats.filter(c=>c.section==='bookings' && !c.parentId).length} تصنيف</span>
          </div>`)}
          ${_card('services', `<div class="hub-card" onclick="${_click('services','navigate(\'listing\',{section:\'services\'})')}">
            <span class="hub-icon">🔧</span><div class="hub-title">الخدمات المهنية</div>
            <div class="hub-desc">كهربائي، سباك، نجار، مصور، محامي وأكثر</div>
            <span class="badge badge-teal">${AppData.cats.filter(c=>(c.section==='services'||c.section==='professions')&&!c.parentId).length} تصنيف</span>
          </div>`)}
          ${_card('stores', `<div class="hub-card" onclick="${_click('stores','navigate(\'listing\',{section:\'stores\'})')}">
            <span class="hub-icon">🏪</span><div class="hub-title">المتاجر والصيدليات</div>
            <div class="hub-desc">صيدليات ومنتجات طبية مع توصيل</div>
            <span class="badge badge-gold">${(AppData.stores||[]).length} متجر متاح</span>
          </div>`)}
          ${(()=>{
            // بطاقة العروض تظهر دائماً للعميل، بغض النظر عن إعدادات sv
            const offersCount = (()=>{const now=new Date();return(AppData.offers||[]).filter(o=>o.active&&(!o.expiresAt||(o.expiresAt.toDate?o.expiresAt.toDate():new Date(o.expiresAt))>now)).length;})();
            const offersHtml = `<div class="hub-card hub-card-offers" onclick="${_click('offers','navigate(\'offers\')')}" style="position:relative;overflow:hidden">
              <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(239,68,68,0.08),rgba(245,158,11,0.06));border-radius:inherit;pointer-events:none"></div>
              ${offersCount > 0 ? `<div style="position:absolute;top:10px;left:10px;background:linear-gradient(135deg,#ef4444,#f59e0b);color:#fff;font-size:11px;font-weight:800;border-radius:99px;padding:3px 9px;z-index:2">🔥 ${offersCount} عرض</div>` : ''}
              <span class="hub-icon">🏷️</span>
              <div class="hub-title" style="color:#ef4444">العروض والخصومات</div>
              <div class="hub-desc">أفضل العروض من جميع الأقسام في مكان واحد</div>
              <span class="badge" style="background:linear-gradient(135deg,#ef4444,#f59e0b);color:#fff">${offersCount > 0 ? offersCount + ' عرض نشط' : 'تابع أحدث العروض'}</span>
            </div>`;
            // للمدير نستخدم _card لإظهار شارات الإخفاء والصيانة، للعميل تظهر دائماً
            if (isAdmin) return _card('offers', offersHtml);
            return offersHtml;
          })()}`;
        })()}
      </div>
    </div>

    ${sliderAds.length ? renderAdsSlider(sliderAds) : ''}
    ${u?.role === 'customer' ? renderRegionBanner(_regionId, _regionObj) : ''}
    ${bannerAds.length ? renderStaticBanners(bannerAds) : ''}

    ${(!window.SV || window.SV.get('featured') !== false || u?.role === 'admin') && serviceCards.length ? `
    <div class="section-hub" style="padding-top:0">
      <div class="section-title">⭐ أبرز الخدمات</div>
      <div class="service-grid">${serviceCards.join('')}</div>
    </div>` : ''}
  </div>`;
}

window.renderAdsSlider = function(ads) {
  if (!ads.length) return '';
  const id = 'ads-slider-' + Date.now();
  setTimeout(() => {
    const slider = document.getElementById(id);
    if (!slider) return;
    const slides = slider.querySelectorAll('.ad-slide');
    const dots   = slider.parentElement.querySelectorAll('.ads-dot');
    if (!slides.length) return;
    let cur = 0;
    const goTo = (n) => {
      slides[cur].classList.remove('active');
      dots[cur]?.classList.remove('active');
      cur = (n + slides.length) % slides.length;
      slides[cur].classList.add('active');
      dots[cur]?.classList.add('active');
    };
    const interval = setInterval(() => {
      if (!document.getElementById(id)) { clearInterval(interval); return; }
      goTo(cur + 1);
    }, 4500);

    // Expose control API on the slider element so global helper functions can interact with it
    slider._goTo = goTo;
    slider._getCur = () => cur;
    slider._autoSlideInterval = interval;

    let startX = 0;
    slider.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    slider.addEventListener('touchend', e => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) {
        if (slider._autoSlideInterval) { clearInterval(slider._autoSlideInterval); slider._autoSlideInterval = null; }
        goTo(diff > 0 ? cur + 1 : cur - 1);
      }
    }, { passive: true });
  }, 80);

  // Track impressions for slider ads once rendered
  ads.forEach(ad => {
    if (typeof ph27_trackAdImpressionOnce === 'function') {
      ph27_trackAdImpressionOnce(ad.id);
    }
  });

  const dotsHtml = ads.length > 1
    ? `<div class="ads-dots">${ads.map((_,i) => `<span class="ads-dot${i===0?' active':''}" onclick="(function(){const s=document.getElementById('${id}'); if(s && typeof s._goTo === 'function') { if(s._autoSlideInterval) { clearInterval(s._autoSlideInterval); s._autoSlideInterval = null; } s._goTo(${i}); }})()"></span>`).join('')}</div>`
    : '';

  const navButtonsHtml = ads.length > 1
    ? `<button class="ad-slider-btn prev" onclick="event.stopPropagation(); if(typeof ph27_slideAdPrev === 'function') ph27_slideAdPrev('${id}')" aria-label="السابق">›</button>
       <button class="ad-slider-btn next" onclick="event.stopPropagation(); if(typeof ph27_slideAdNext === 'function') ph27_slideAdNext('${id}')" aria-label="التالي">‹</button>`
    : '';

  return `
  <div class="ads-section">
    <div class="ads-slider-wrap">
      ${navButtonsHtml}
      <div class="ads-slider" id="${id}">
        ${ads.map((a,i) => `
        <div class="ad-slide${i===0?' active':''}" style="cursor:pointer;" onclick="if(typeof ph27_openAdLightbox === 'function') ph27_openAdLightbox('${a.id}')">
          ${a.imageBase64 ? `<img src="${a.imageBase64}" class="ad-img" alt="" loading="lazy">` : `<div class="ad-placeholder">📢</div>`}
          <div class="ad-gradient-overlay"></div>
          <div class="ad-content">
            <span class="ad-chip">⚡ إعلان مميز</span>
            <div class="ad-title">${escHtml(a.title)}</div>
            ${a.description ? `<div class="ad-desc">${escHtml(a.description)}</div>` : ''}
            ${(a.serviceId || a.targetUrl) ? `
            <div class="ad-btns" onclick="event.stopPropagation();">
              ${a.serviceId ? `<button class="btn btn-primary btn-sm" onclick="if(typeof ph27_trackAdClick === 'function') ph27_trackAdClick('${a.id}'); bookService('${a.serviceId}')">🛒 اطلب الآن</button>` : ''}
              ${a.targetUrl ? `<a href="${a.targetUrl}" target="_blank" class="btn btn-sm ad-btn-ghost" onclick="if(typeof ph27_trackAdClick === 'function') ph27_trackAdClick('${a.id}')">🔗 تفاصيل</a>` : ''}
            </div>` : ''}
          </div>
        </div>`).join('')}
      </div>
      ${dotsHtml}
    </div>
  </div>`;
}


// ─── Diverse Ad rendering components ───
window.renderNativeAdCard = function(ad) {
  // Track impression once rendered
  if (typeof ph27_trackAdImpressionOnce === 'function') {
    ph27_trackAdImpressionOnce(ad.id);
  }

  const cover = ad.imageBase64;
  return `
  <div class="service-card native-ad-card" onclick="if(typeof ph27_openAdLightbox === 'function') ph27_openAdLightbox('${ad.id}')" style="cursor:pointer;position:relative;border-color:rgba(139,92,246,0.3)">
    <div class="service-cover">
      ${cover ? `<img src="${cover}" alt="${escAttr(ad.title)}">` : `<div class="service-cover-fallback">📢</div>`}
      <span class="svc-badge open" style="background:var(--primary);color:#fff;position:absolute;top:10px;right:10px;z-index:5">⚡ إعلان ممول</span>
    </div>
    <div class="service-body">
      <div class="service-name">${escHtml(ad.title)}</div>
      <div class="service-provider">شريك محجوز المعتمد</div>
      ${ad.description ? `<p class="service-desc" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(ad.description)}</p>` : ''}
      <div class="service-footer" style="margin-top:auto;padding-top:16px;border-top:1px dashed var(--border);display:flex;justify-content:space-between;align-items:center" onclick="event.stopPropagation();">
        <div>
          <div class="service-price" style="font-size:14px;color:var(--text-muted)">عرض مميز</div>
        </div>
        ${ad.targetUrl ? `<a class="btn btn-primary btn-sm" href="${ad.targetUrl}" target="_blank" onclick="if(typeof ph27_trackAdClick === 'function') ph27_trackAdClick('${ad.id}');">🔗 تفاصيل</a>` : (ad.serviceId ? `<button class="btn btn-primary btn-sm" onclick="if(typeof ph27_trackAdClick === 'function') ph27_trackAdClick('${ad.id}'); bookService('${ad.serviceId}')">🛒 اطلب</button>` : '')}
      </div>
    </div>
  </div>`;
};

window.renderStaticBanners = function(banners) {
  if (!banners.length) return '';
  
  // Track impressions
  banners.forEach(b => {
    if (typeof ph27_trackAdImpressionOnce === 'function') {
      ph27_trackAdImpressionOnce(b.id);
    }
  });

  return `
  <div class="static-banners-container">
    ${banners.map(b => `
    <div class="static-ad-card" onclick="if(typeof ph27_openAdLightbox === 'function') ph27_openAdLightbox('${b.id}')" style="cursor:pointer;">
      <div class="static-ad-thumb">
        ${b.imageBase64
          ? `<img src="${b.imageBase64}" class="static-ad-thumb-img" alt="" loading="lazy">`
          : `<div class="static-ad-thumb-fallback">📢</div>`}
      </div>
      <div class="static-ad-body">
        <span class="static-ad-badge">🎁 عرض خاص</span>
        <div class="static-ad-title">${escHtml(b.title)}</div>
        ${b.description ? `<div class="static-ad-desc">${escHtml(b.description)}</div>` : ''}
        ${(b.targetUrl || b.serviceId) ? `
        <div class="static-ad-action" onclick="event.stopPropagation();">
          ${b.targetUrl ? `<a href="${b.targetUrl}" target="_blank" class="btn btn-primary btn-sm" onclick="if(typeof ph27_trackAdClick === 'function') ph27_trackAdClick('${b.id}');">🔗 تفاصيل</a>` : `<button class="btn btn-primary btn-sm" onclick="if(typeof ph27_trackAdClick === 'function') ph27_trackAdClick('${b.id}'); bookService('${b.serviceId}')">🛒 احجز</button>`}
        </div>` : ''}
      </div>
      <div class="static-ad-arrow">›</div>
    </div>
    `).join('')}
  </div>`;
};

window.triggerPopupAndInterstitialAds = function(ads) {
  const activePopups = ads.filter(a => a.type === 'popup');
  const activeInterstitials = ads.filter(a => a.type === 'interstitial');

  // Check popup shown (once per session)
  const popupShown = sessionStorage.getItem('ad_popup_shown');
  if (!popupShown && activePopups.length > 0) {
    const ad = activePopups.sort((a,b) => (a.priority || 5) - (b.priority || 5))[0];
    showAdPopupModal(ad);
    sessionStorage.setItem('ad_popup_shown', 'true');
    return;
  }

  // Check interstitial shown (once per session)
  const interstitialShown = sessionStorage.getItem('ad_interstitial_shown');
  if (!interstitialShown && activeInterstitials.length > 0) {
    const ad = activeInterstitials.sort((a,b) => (a.priority || 5) - (b.priority || 5))[0];
    showAdInterstitial(ad);
    sessionStorage.setItem('ad_interstitial_shown', 'true');
  }
};

window.showAdPopupModal = function(ad) {
  if (typeof openModal !== 'function') return;

  // Track impression once shown
  if (typeof ph27_trackAdImpressionOnce === 'function') {
    ph27_trackAdImpressionOnce(ad.id);
  }

  const html = `
  <div class="ad-popup-modal" style="cursor:pointer;" onclick="if(!event.target.closest('.ad-popup-actions')) { closeModal(); if(typeof ph27_openAdLightbox === 'function') ph27_openAdLightbox('${ad.id}'); }">
    <div class="ad-popup-media">
      ${ad.imageBase64 ? `<img src="${ad.imageBase64}" class="ad-popup-img" alt="${ad.title}">` : `<div class="ad-popup-placeholder">📢</div>`}
    </div>
    <div class="ad-popup-body">
      <div class="ad-popup-badge">🔥 عرض مميز</div>
      <h2 class="ad-popup-title">${escHtml(ad.title)}</h2>
      <p class="ad-popup-desc">${escHtml(ad.description || '')}</p>
      <div class="ad-popup-actions" onclick="event.stopPropagation();">
        ${ad.serviceId ? `<button class="btn btn-primary" onclick="closeModal(); if(typeof ph27_trackAdClick === 'function') ph27_trackAdClick('${ad.id}'); bookService('${ad.serviceId}')">🛒 اطلب الآن</button>` : ''}
        ${ad.targetUrl ? `<a href="${ad.targetUrl}" target="_blank" class="btn btn-primary" onclick="closeModal(); if(typeof ph27_trackAdClick === 'function') ph27_trackAdClick('${ad.id}');">🔗 عرض التفاصيل</a>` : ''}
        <button class="btn btn-secondary" onclick="closeModal()">إغلاق</button>
      </div>
    </div>
  </div>`;
  openModal(html);
};

window.showAdInterstitial = function(ad) {
  // Remove existing if any
  closeAdInterstitial();

  // Track impression once shown
  if (typeof ph27_trackAdImpressionOnce === 'function') {
    ph27_trackAdImpressionOnce(ad.id);
  }
  
  const container = document.createElement('div');
  container.id = 'ad-interstitial-container';
  container.innerHTML = `
  <div id="ad-interstitial-overlay" class="ad-interstitial-overlay">
    <div class="ad-interstitial-header" onclick="event.stopPropagation();">
      <span class="ad-interstitial-sponsor">⚡ إعلان ممول</span>
      <button class="ad-interstitial-skip" id="ad-interstitial-skip-btn" onclick="closeAdInterstitial()" disabled>
        تخطي الإعلان (<span id="ad-interstitial-timer">3</span>)
      </button>
    </div>
    <div class="ad-interstitial-body">
      <div class="ad-interstitial-card" style="cursor:pointer;" onclick="if(!event.target.closest('.ad-interstitial-actions')) { closeAdInterstitial(); if(typeof ph27_openAdLightbox === 'function') ph27_openAdLightbox('${ad.id}'); }">
        ${ad.imageBase64 ? `<img src="${ad.imageBase64}" class="ad-interstitial-img" alt="${ad.title}">` : `<div class="ad-interstitial-placeholder">📢</div>`}
        <div class="ad-interstitial-content">
          <h1 class="ad-interstitial-title">${escHtml(ad.title)}</h1>
          <p class="ad-interstitial-desc">${escHtml(ad.description || '')}</p>
          <div class="ad-interstitial-actions" onclick="event.stopPropagation();">
            ${ad.serviceId ? `<button class="btn btn-primary btn-lg" onclick="closeAdInterstitial(); if(typeof ph27_trackAdClick === 'function') ph27_trackAdClick('${ad.id}'); bookService('${ad.serviceId}')">🛒 اطلب الآن</button>` : ''}
            ${ad.targetUrl ? `<a href="${ad.targetUrl}" target="_blank" class="btn btn-secondary btn-lg" onclick="closeAdInterstitial(); if(typeof ph27_trackAdClick === 'function') ph27_trackAdClick('${ad.id}');">🔗 عرض التفاصيل</a>` : ''}
          </div>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(container);
  
  let count = 3;
  const skipBtn = document.getElementById('ad-interstitial-skip-btn');
  const timerSpan = document.getElementById('ad-interstitial-timer');
  const timerInterval = setInterval(() => {
    count--;
    const el = document.getElementById('ad-interstitial-container');
    if (!el) { clearInterval(timerInterval); return; }
    if (count <= 0) {
      clearInterval(timerInterval);
      if (skipBtn) {
        skipBtn.disabled = false;
        skipBtn.innerHTML = 'تخطي ✕';
        skipBtn.style.background = 'var(--primary)';
        skipBtn.style.color = '#fff';
      }
    } else {
      if (timerSpan) timerSpan.textContent = count;
    }
  }, 1000);
};

window.closeAdInterstitial = function() {
  const el = document.getElementById('ad-interstitial-container');
  if (el) {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }
};


function renderRegionBanner(regionId, regionObj) {
  return `
    <div style="max-width:700px;margin:-10px auto 20px;padding:10px 20px;background:var(--bg-card);border:1px solid var(--glass-border);border-radius:99px;display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:14px;min-width:0">
        <span>📍</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-flex;align-items:center;gap:6px">
          ${regionObj
            ? `تعرض خدمات: <strong style="color:var(--primary)">${escHtml(regionObj.name)}</strong>`
            : 'تعرض <strong style="color:var(--primary)">جميع المناطق</strong>'}
          ${regionObj ? `
            <button class="btn-share" onclick="event.stopPropagation();ph34_shareItem('region', '${regionObj.id}')" title="مشاركة المنطقة/الفرع" style="padding: 2px 8px; font-size: 11px; height: 22px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; border-radius: 6px; border: 1px solid var(--glass-border); background: var(--bg-secondary); cursor: pointer; color: var(--text-secondary)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:10px;height:10px;"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              <span>مشاركة</span>
            </button>
          ` : ''}
        </span>
      </div>
      <button class="btn btn-sm btn-secondary" onclick="ph9_showRegionPicker && ph9_showRegionPicker()"
              style="border-radius:99px;font-size:13px;white-space:nowrap;flex-shrink:0">
        🗺️ تغيير المنطقة
      </button>
    </div>`;
}

// ─── Listing ──────────────────────────────
function renderListing() {
  const { section, catId } = State.params;

  // ── Global search across all sections ──
  if (section === 'all') {
    const q = (State.params.q || '').toLowerCase().trim();
    const matchSvc = (AppData.services || []).filter(s =>
      (s.name||'').toLowerCase().includes(q) ||
      (s.desc||'').toLowerCase().includes(q) ||
      (s.sku && s.sku.toString().toLowerCase().includes(q))
    );
    const matchRental = (AppData.rentalProducts || []).filter(p =>
      (p.name||'').toLowerCase().includes(q) ||
      (p.desc||'').toLowerCase().includes(q) ||
      (p.sku && p.sku.toString().toLowerCase().includes(q))
    );
    const matchStore = (AppData.storeProducts || []).filter(p =>
      (p.name||'').toLowerCase().includes(q) ||
      (p.desc||'').toLowerCase().includes(q) ||
      (p.sku && p.sku.toString().toLowerCase().includes(q))
    );
    const total = matchSvc.length + matchRental.length + matchStore.length;

    const renderResultCard = (item, type) => {
      const icons = { svc: '📅', rental: '🚗', store: '🛍️' };
      const labels = { svc: 'حجز/خدمة', rental: 'تأجير', store: 'منتج متجر' };
      const colors = { svc: '#8b5cf6', rental: '#f59e0b', store: '#10b981' };
      const icon = icons[type] || '🔷';
      const color = colors[type] || '#8b5cf6';
      const activeOffer = typeof ph_getActiveOffer === 'function' ? ph_getActiveOffer(item.id) : null;
      const offerPct = activeOffer ? (activeOffer.discountPercent || (activeOffer.originalPrice > 0 ? Math.round(((activeOffer.originalPrice - activeOffer.discountedPrice) / activeOffer.originalPrice) * 100) : 0)) : 0;
      return `
      <div style="background:var(--bg-card);border:1px solid ${activeOffer ? 'rgba(239,68,68,0.35)' : 'var(--glass-border)'};border-radius:14px;padding:16px;display:flex;align-items:flex-start;gap:14px;transition:transform 0.2s,box-shadow 0.2s;position:relative;overflow:hidden;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow-lg)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
        ${activeOffer ? `<div style="position:absolute;top:0;left:0;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-size:10px;font-weight:900;padding:3px 10px 3px 8px;border-radius:0 0 10px 0">🏷️ خصم ${offerPct}%</div>` : ''}
        <div style="width:48px;height:48px;border-radius:12px;background:${color}18;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;${activeOffer ? 'margin-top:14px' : ''}">${icon}</div>
        <div style="flex:1;min-width:0;${activeOffer ? 'margin-top:14px' : ''}">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <span style="font-weight:700;font-size:15px;color:var(--text-main)">${escHtml(item.name)}</span>
            ${item.sku ? `<span style="font-family:monospace;font-size:10.5px;font-weight:700;background:rgba(139,92,246,0.12);color:#8b5cf6;border:1px solid rgba(139,92,246,0.25);border-radius:4px;padding:1px 6px;letter-spacing:0.5px">#${escHtml(item.sku)}</span>` : ''}
            <span style="font-size:10px;font-weight:600;background:${color}18;color:${color};border-radius:4px;padding:2px 7px">${labels[type]}</span>
          </div>
          ${item.desc ? `<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(item.desc)}</div>` : ''}
          ${activeOffer && typeof ph_offerPriceHtml === 'function'
            ? ph_offerPriceHtml(activeOffer, item.price ? `<div class="ph-price-block" style="--price-color:${color}"><span class="ph-price-num" style="color:${color}">${item.price.toLocaleString('ar-YE')}</span><span class="ph-price-cur">ريال</span></div>` : `<div class="ph-price-block ph-price-on-contact">السعر عند التواصل</div>`)
            : item.price ? `<div class="ph-price-block"><span class="ph-price-num" style="color:${color}">${item.price.toLocaleString('ar-YE')}</span><span class="ph-price-cur">ريال</span></div>` : `<div class="ph-price-block ph-price-on-contact">السعر عند التواصل</div>`}
        </div>
      </div>`;
    };

    return `<div id="app-content">
      <div class="page-header">
        <button class="back-btn" onclick="navigate('home')">→ رجوع</button>
        <h1>🔍 نتائج البحث${window.ui_helpBtn('home')}</h1>
        <p style="color:var(--text-secondary);margin-top:4px">${q ? `نتائج البحث عن: <strong style="color:var(--primary)">${escHtml(q)}</strong> — وُجد <strong>${total}</strong> نتيجة` : 'أدخل كلمة بحث أو رقم صنف للبدء'}</p>
      </div>
      <div class="search-wrap" style="margin-bottom:24px">
        <div class="search-box" style="position:relative;display:flex;align-items:center;background:var(--bg-card);border-radius:99px;border:1px solid var(--glass-border);padding:6px;box-shadow:var(--shadow-lg)">
          <input class="search-input" id="global-search-results" placeholder="ابحث عن خدمة أو رقم صنف (#SKU)..." value="${escAttr(q)}" style="border:none;background:transparent;padding:10px 20px;flex:1;outline:none;font-size:15px;color:var(--text-main)" onkeydown="if(event.key==='Enter'){navigate('listing',{section:'all',q:this.value.trim()})}">
          <button class="btn btn-primary" style="border-radius:99px;padding:10px 28px" onclick="navigate('listing',{section:'all',q:document.getElementById('global-search-results').value.trim()})">بحث 🔍</button>
        </div>
      </div>
      ${!q ? `<div class="empty-state" style="padding:60px 0"><div class="empty-icon">🔍</div><div class="empty-title">ابدأ بكتابة اسم أو رقم الصنف للبحث في جميع الأقسام</div></div>` :
        total === 0 ? `<div class="empty-state" style="padding:60px 0"><div class="empty-icon">😕</div><div class="empty-title">لا توجد نتائج مطابقة لـ "${escHtml(q)}"</div><div class="empty-desc">جرّب كلمة بحث مختلفة أو رقم الصنف مباشرة</div></div>` : `
        <div style="display:grid;gap:12px">
          ${matchSvc.length ? `
          <div style="margin-bottom:8px">
            <div style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:10px;display:flex;align-items:center;gap:6px">📅 الحجوزات والخدمات <span style="background:rgba(139,92,246,0.1);color:#8b5cf6;border-radius:99px;padding:2px 10px;font-size:12px">${matchSvc.length}</span></div>
            <div style="display:grid;gap:10px">${matchSvc.map(s => renderResultCard(s, 'svc')).join('')}</div>
          </div>` : ''}
          ${matchRental.length ? `
          <div style="margin-bottom:8px">
            <div style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:10px;display:flex;align-items:center;gap:6px">🏷️ منتجات التأجير <span style="background:rgba(245,158,11,0.1);color:#f59e0b;border-radius:99px;padding:2px 10px;font-size:12px">${matchRental.length}</span></div>
            <div style="display:grid;gap:10px">${matchRental.map(p => renderResultCard(p, 'rental')).join('')}</div>
          </div>` : ''}
          ${matchStore.length ? `
          <div style="margin-bottom:8px">
            <div style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:10px;display:flex;align-items:center;gap:6px">🛍️ منتجات المتاجر <span style="background:rgba(16,185,129,0.1);color:#10b981;border-radius:99px;padding:2px 10px;font-size:12px">${matchStore.length}</span></div>
            <div style="display:grid;gap:10px">${matchStore.map(p => renderResultCard(p, 'store')).join('')}</div>
          </div>` : ''}
        </div>`}
    </div>`;
  }

  if (section === 'stores' && !catId) {
    if (typeof ph43_renderStoresList === 'function') return ph43_renderStoresList();
  }

  const sLabels = { bookings:'📅 الحجوزات', services:'🔧 الخدمات المهنية', professions: '🛠️ نظام المهن', stores:'🏪 المتاجر' };
  if (!catId) {
    let cats = AppData.cats.filter(c => (c.section === section || (section === 'services' && c.section === 'professions') || (section === 'professions' && c.section === 'services')) && !c.parentId);
    
    return `<div id="app-content">
      <div class="page-header">
        <button class="back-btn" onclick="navigate('home')">→ رجوع</button>
        <h1>${sLabels[section]||'الخدمات'}${window.ui_helpBtn(section === 'bookings' ? 'listing_bookings' : (section === 'services' ? 'listing_services' : (section === 'professions' ? 'listing_professions' : (section === 'stores' ? 'listing_stores' : 'home'))))}</h1>
      </div>
      ${cats.length ? `<div class="cat-grid">${cats.map(c=>`
        <div class="cat-card" onclick="navigate('listing',{section:'${section}',catId:'${c.id}'})">
          <span class="cat-icon">${c.icon||'📌'}</span>
          <div class="cat-name">${c.name}</div>
          <div class="cat-count">${c.catType === 'rental' ? (AppData.rentalStores||[]).filter(s=>s.catId===c.id).length + ' متجر' : AppData.services.filter(s=>s.catId===c.id&&(typeof ph_matchesLocation==='function'?ph_matchesLocation(s,State.currentUser?.regionId,State.currentUser?.govId):(!State.currentUser?.regionId||!s.regionId||s.regionId===State.currentUser?.regionId))).length + ' خدمة'}</div>
        </div>`).join('')}</div>` :
      `<div class="empty-state"><div class="empty-icon">📂</div><div class="empty-title">لا توجد تصنيفات بعد</div></div>`}
    </div>`;
  }
  
  const cat = AppData.cats.find(c=>c.id===catId);
  if (!cat) {
    return `<div id="app-content">
      <div class="page-header">
        <button class="back-btn" onclick="navigate('listing',{section:'${section}'})">→ رجوع</button>
        <h1>التصنيف غير موجود</h1>
      </div>
      <div class="empty-state"><div class="empty-icon">📂</div><div class="empty-title">التصنيف المطلوب غير متوفر حالياً</div></div>
    </div>`;
  }

  // If this category has subcategories, render them instead of rendering a flat list of services directly
  const subCats = AppData.cats.filter(c => c.parentId === catId);
  if (subCats.length > 0) {
    return `<div id="app-content">
      <div class="page-header">
        <button class="back-btn" onclick="navigate('listing',{section:'${section}'})">→ رجوع</button>
        <h1>${cat.icon||''} ${cat.name}</h1>
        <p style="color:var(--text-secondary);margin-top:4px">تصفح الأقسام الفرعية المتاحة</p>
      </div>
      <div class="cat-grid">${subCats.map(sc=>`
        <div class="cat-card" onclick="navigate('listing',{section:'${section}',catId:'${sc.id}'})">
          <span class="cat-icon">${sc.icon||'📌'}</span>
          <div class="cat-name">${sc.name}</div>
          <div class="cat-count">${sc.catType === 'rental' ? (AppData.rentalStores||[]).filter(s=>s.catId===sc.id).length + ' متجر' : AppData.services.filter(s=>s.catId===sc.id&&(typeof ph_matchesLocation==='function'?ph_matchesLocation(s,State.currentUser?.regionId,State.currentUser?.govId):(!State.currentUser?.regionId||!s.regionId||s.regionId===State.currentUser?.regionId))).length + ' خدمة'}</div>
        </div>`).join('')}</div>
    </div>`;
  }
  
  if (cat.catType === 'rental' && typeof window.ph_rentalRenderCatPage === 'function') {
    return window.ph_rentalRenderCatPage(catId);
  }
  
  const _listRegId = State.currentUser?.regionId;
  const _listGovId = State.currentUser?.govId;
  const svcs = AppData.services.filter(s => {
    if (s.catId !== catId) return false;
    if (!_listRegId && !_listGovId) return true;
    return typeof ph_matchesLocation === 'function'
      ? ph_matchesLocation(s, _listRegId, _listGovId)
      : (!s.regionId || s.regionId === _listRegId);
  });
  const _listRegObj = (AppData.regions || []).find(r => r.id === _listRegId);
  return `<div id="app-content">
    <div class="page-header">
      <button class="back-btn" onclick="navigate('listing',{section:'${section}'${cat.parentId ? `,catId:'${cat.parentId}'` : ''}})">→ رجوع</button>
      <h1>${cat.icon||''} ${cat.name}</h1>
      <p style="color:var(--text-secondary);margin-top:4px">${svcs.length} خدمة متاحة${_listRegObj ? ` في <strong>${escHtml(_listRegObj.name)}</strong>` : ''}</p>
    </div>
    <div class="search-wrap">
      <div class="search-box">
        <input class="search-input" id="svc-search" oninput="filterServices()" placeholder="ابحث...">
        <span class="search-icon">🔍</span>
      </div>
    </div>
    <div class="service-grid" id="svc-grid">
      ${svcs.length ? svcs.map(renderServiceCard).join('') : '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">لا توجد خدمات بعد</div></div>'}
    </div>
  </div>`;
}
function filterServices() {
  const q = document.getElementById('svc-search').value.toLowerCase();
  document.querySelectorAll('.service-card').forEach(c => {
    c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}
function renderServiceCard(s) {
  const u = State.currentUser;
  const rating = AppData.ratings.filter(r=>r.serviceId===s.id);
  const avg = rating.length ? (rating.reduce((a,r)=>a+(r.vendorStars||0),0)/rating.length).toFixed(1) : null;
  const cat = AppData.cats.find(c => c.id === s.catId);
  const isProf = cat?.section === 'professions' || cat?.section === 'services';

  const activeOffer = typeof ph_getActiveOffer === 'function' ? ph_getActiveOffer(s.id) : null;
  const offerPct = activeOffer ? (activeOffer.discountPercent || (activeOffer.originalPrice > 0 ? Math.round(((activeOffer.originalPrice - activeOffer.discountedPrice) / activeOffer.originalPrice) * 100) : 0)) : 0;

  let waNum = '';
  if (cat?.section === 'bookings') {
    waNum = AppData.platformSettings?.whatsappNumberBookings || AppData.platformSettings?.whatsappNumber || '';
  } else if (cat?.section === 'services' || cat?.section === 'professions') {
    waNum = AppData.platformSettings?.whatsappNumberServices || AppData.platformSettings?.whatsappNumber || '';
  } else {
    waNum = AppData.platformSettings?.whatsappNumber || '';
  }
  waNum = waNum.replace(/\D/g,'');
  const waUrl = waNum
    ? `https://wa.me/${waNum}?text=${encodeURIComponent('أهلاً، أريد الاستفسار أكثر عن الخدمة: ' + s.name)}`
    : '';
  
  const hasTiers = s.tiers && s.tiers.length > 0;
  const minPrice = hasTiers ? Math.min(...s.tiers.map(t => t.price || 0)) : null;

  const defaultPriceHtml = hasTiers
    ? `<div class="ph-price-block"><span class="ph-price-label">يبدأ من</span><span class="ph-price-num">${minPrice.toLocaleString('ar-YE')}</span><span class="ph-price-cur">ريال</span></div>`
    : (s.price
      ? `<div class="ph-price-block"><span class="ph-price-num">${s.price.toLocaleString('ar-YE')}</span><span class="ph-price-cur">ريال</span></div>`
      : `<div class="ph-price-block ph-price-on-contact">${isProf ? 'السعر بعد المعاينة' : 'السعر عند التواصل'}</div>`);

  // ── نظام التنبيهات وحالة التوفر (ph48) ──
  const alertBadgeHtml = typeof ph48_badgeHtml          === 'function' ? ph48_badgeHtml(s)           : '';
  const stockChipHtml  = typeof ph48_stockChipHtml       === 'function' ? ph48_stockChipHtml(s)        : '';
  const svcUnavail      = typeof ph48_unavailOverlayHtml  === 'function' ? ph48_unavailOverlayHtml(s)  : '';
  const isSvcAvail      = typeof ph48_isAvailable         === 'function' ? ph48_isAvailable(s)         : true;

  return `
  <div class="service-card" style="position:relative">
    ${alertBadgeHtml}
    ${activeOffer ? (typeof ph_offerBadgeHtml === 'function' ? ph_offerBadgeHtml(offerPct, 'left:10px') : '') : ''}
    <div class="service-header" style="position:relative; overflow:hidden">
      <div class="service-avatar" style="position:relative">
        ${s.icon||'🔷'}
        ${svcUnavail}
      </div>
      <div>
        <div class="service-name">${s.name}</div>
        ${s.sku ? `<div style="display:inline-block;font-family:monospace;font-size:10.5px;font-weight:700;background:rgba(139,92,246,0.1);color:#8b5cf6;border:1px solid rgba(139,92,246,0.2);border-radius:4px;padding:1px 6px;margin-top:3px;letter-spacing:0.5px;">#${s.sku}</div>` : ''}
        ${stockChipHtml ? `<div style="margin-top:4px">${stockChipHtml}</div>` : ''}
      </div>
    </div>
    ${s.desc?`<p style="color:var(--text-secondary);font-size:14px;margin-bottom:12px;line-height:1.6">${s.desc}</p>`:''}
    <div class="service-footer">
      <div>
        ${activeOffer && typeof ph_offerPriceHtml === 'function'
          ? ph_offerPriceHtml(activeOffer, defaultPriceHtml)
          : defaultPriceHtml}
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:13px;color:var(--text-muted)">${avg?'⭐ '+avg+' ('+rating.length+' تقييم)':'لا يوجد تقييم بعد'}</span>
          ${rating.length ? `<button id="ph36-reviews-btn" onclick="ph36_showReviewsModal('${s.id}','${(s.name||'').replace(/'/g,'\\\'')}')" style="font-size:11px;color:var(--primary);cursor:pointer;padding:2px 8px;background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);border-radius:10px;font-family:inherit;text-decoration:none">اقرأ التقييمات</button>` : ''}
        </div>
      </div>
      <div class="svc-card-actions">
        ${u?.role==='customer' ? (
          !isSvcAvail
            ? `<button class="btn btn-secondary btn-sm ia-btn-disabled" style="background:rgba(100,116,139,0.3)">🚫 ${s.stockStatus === 'out_of_stock' ? 'نفذت الكمية' : s.stockStatus === 'coming_soon' ? 'قريباً' : 'غير متوفر'}</button>`
            : `<button class="btn btn-primary btn-sm" data-svc-cart-id="${s.id}" onclick="${hasTiers ? `bookService('${s.id}')` : `typeof svc_addToCart==='function'?svc_addToCart('${s.id}'):bookService('${s.id}')`}">${activeOffer ? '🏷️ اطلب بالسعر المخفض' : '🛒 أضف للسلة'}</button>`
        ) : u?.role==='guest' ? (
          !isSvcAvail
            ? `<button class="btn btn-secondary btn-sm ia-btn-disabled" style="background:rgba(100,116,139,0.3)">🚫 ${s.stockStatus === 'out_of_stock' ? 'نفذت الكمية' : s.stockStatus === 'coming_soon' ? 'قريباً' : 'غير متوفر'}</button>`
            : `<button class="btn btn-secondary btn-sm" onclick="navigate('login')">سجل للحجز</button>`
        ) : ''}
        ${waUrl ? `<a class="btn-wa-inquiry" href="${waUrl}" target="_blank" rel="noopener" title="استفسار عبر واتساب">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </a>` : ''}
        <button class="btn-share" onclick="ph34_shareItem('service', '${s.id}')" title="مشاركة الخدمة">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          <span>مشاركة</span>
        </button>
      </div>
    </div>
  </div>`;
}

// ─── Booking ──────────────────────────────
async function bookService(svcId) {
  const s = AppData.services.find(x=>x.id===svcId);
  if (!s) return;

  // ── التحقق من حالة التوفر (ph48) ──
  if (typeof ph48_isAvailable === 'function' && !ph48_isAvailable(s)) {
    toast('عذراً، هذه الخدمة غير متوفرة للحجز حالياً', 'error');
    return;
  }

  const u = State.currentUser;
  if (!u || u.role !== 'customer') { navigate('login'); return; }

  if (typeof checkAccountActive === 'function' && !checkAccountActive()) return;
  if (typeof checkMandatoryVerification === 'function' && !checkMandatoryVerification()) return;

  if (s.hasDeposit && s.depositPercent > 0 && s.price > 0) {
    const addr = u.addr || '';
    if (typeof window.ph28_showBookingWithDeposit === 'function') {
      window.ph28_showBookingWithDeposit(s, addr);
      return;
    }
  }

  // --- Professions Logic ---
  const cat = AppData.cats.find(c => c.id === s.catId);
  if (cat?.section === 'professions' || cat?.section === 'services') {
    if (typeof window.bookService === 'function' && window.bookService !== bookService) {
       // Avoid recursion if they are named the same but different scopes
       // But actually, we want the workflow.js version
       // Let's just call the workflow logic directly or use the window version
       window.bookService(svcId);
       return;
    }
  }

  // ── Reset tier selection ──
  window.__ph40_selectedTier = null;
  if (s.tiers && s.tiers.length) {
    window.__ph40_selectedTier = { idx: 0, price: s.tiers[0].price, name: s.tiers[0].name };
  }

  // ── Load saved addresses ──
  let savedAddresses = [];
  try {
    if (typeof ph41_loadAddresses === 'function') {
      savedAddresses = await ph41_loadAddresses();
    }
  } catch (e) {}
  const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
  const hasTiers    = s.tiers && s.tiers.length > 0;
  const initialPrice = window.__ph40_selectedTier ? window.__ph40_selectedTier.price : (s.price || 0);

  // Define dynamic callback to update prices/deposit inside modal when a tier is selected
  window.ph40_onTierSelected = function(idx, price, name) {
    const priceDisp = document.getElementById('bk-selected-price-display');
    if (priceDisp) {
      priceDisp.innerHTML = price.toLocaleString('ar-YE') + ' ريال';
    }
    if (s.depositPercent) {
      const depContainer = document.getElementById('bk-deposit-container');
      if (depContainer) {
        depContainer.innerHTML = `
          <div style="margin-bottom:16px;padding:12px 16px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:12px">
            <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">💰 العربون (${s.depositPercent}%):</span><span style="font-weight:700;color:#10b981" id="bk-deposit-val">${Math.round(price*s.depositPercent/100)} ريال</span></div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:12px"><span style="color:var(--text-muted)">المتبقي عند الوصول:</span><span style="color:var(--text-muted)" id="bk-remaining-val">${price-Math.round(price*s.depositPercent/100)} ريال</span></div>
          </div>`;
      }
    }
  };

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">📋 تأكيد الحجز${window.ui_helpBtn('checkout')}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>

    <div style="background:var(--gradient-card);border:1px solid var(--glass-border);border-radius:var(--radius-sm);padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:14px">
      <div style="font-size:36px">${s.icon||'🔷'}</div>
      <div style="flex:1">
        <div style="font-size:17px;font-weight:700">${s.name}</div>
        <!-- Provider hidden -->
        <div id="bk-selected-price-display" style="font-size:20px;font-weight:800;margin-top:6px;color:var(--primary)">
          ${initialPrice ? `${initialPrice.toLocaleString('ar-YE')} ريال` : ''}
        </div>
      </div>
    </div>

    ${hasTiers ? ph40_renderTierSelector(s) : ''}

    <div id="bk-deposit-container">
      ${s.depositPercent && initialPrice ? `
      <div style="margin-bottom:16px;padding:12px 16px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:12px">
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">💰 العربون (${s.depositPercent}%):</span><span style="font-weight:700;color:#10b981" id="bk-deposit-val">${Math.round(initialPrice*s.depositPercent/100)} ريال</span></div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:12px"><span style="color:var(--text-muted)">المتبقي عند الوصول:</span><span style="color:var(--text-muted)" id="bk-remaining-val">${initialPrice-Math.round(initialPrice*s.depositPercent/100)} ريال</span></div>
      </div>` : ''}
    </div>

    <div class="form-group">
      <label class="form-label">📅 التاريخ المطلوب</label>
      <input class="form-control" id="bk-date" type="date" min="${new Date().toISOString().split('T')[0]}">
    </div>
    <div class="form-group">
      <label class="form-label">🕐 الوقت المفضل</label>
      <input class="form-control" id="bk-time" type="time">
    </div>

    ${s.requiresDelivery !== false && typeof ph37_getDeliveryTypeSelectorHTML === 'function'
      ? ph37_getDeliveryTypeSelectorHTML(s.location || s.address || s.area || '') : ''}

    <div id="dt-addr-wrapper" style="${s.requiresDelivery === false ? 'display:none' : ''}">
      ${savedAddresses.length && typeof ph41_renderAddressSelector === 'function'
        ? ph41_renderAddressSelector(savedAddresses) : ''}
      <div class="form-group">
        <label class="form-label">📍 عنوان التوصيل${savedAddresses.length ? ' (أو أدخل عنواناً جديداً)' : ''}</label>
        <input class="form-control" id="bk-addr"
               placeholder="المدينة، الحي، الشارع..."
               value="${defaultAddr ? escAttr(defaultAddr.address) : ''}"
               style="${defaultAddr ? 'display:none' : ''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">💬 ملاحظات إضافية</label>
      <textarea class="form-control" id="bk-note" placeholder="أي تفاصيل خاصة بطلبك..." style="resize:vertical"></textarea>
    </div>

    ${hasTiers || s.price ? `
    <div class="form-group">
      <label class="form-label">💳 طريقة الدفع</label>
      <div class="bk-payment-grid">
        <button class="bk-pay-btn active" id="bk-pay-wallet" onclick="bkSelectPayment('wallet')">
          <div style="font-weight:700">المحفظة</div>
          <div style="font-size:11px;color:var(--text-muted)" id="svc-checkout-wallet-bal">جاري الجلب...</div>
        </button>
        <button class="bk-pay-btn" id="bk-pay-cod" onclick="bkSelectPayment('cod')">
          <div style="font-weight:700">عند الاستلام</div>
          <div style="font-size:11px;color:var(--text-muted)">+5 ريال رسوم</div>
        </button>
        <button class="bk-pay-btn" id="bk-pay-bank" onclick="bkSelectPayment('bank_transfer')">
          <div style="font-weight:700">تحويل بنكي</div>
          <div style="font-size:11px;color:var(--text-muted)">إيداع مسبق</div>
        </button>
      </div>
      
      <div id="bk-bank-info" style="display:none; margin-top:16px; padding:12px; background:rgba(59,130,246,0.05); border:1px solid rgba(59,130,246,0.2); border-radius:8px;">
        <div style="font-weight:700; margin-bottom:8px; color:var(--primary)">يرجى التحويل إلى أحد الحسابات التالية:</div>
        ${(AppData.bankAccounts||[]).filter(b=>b.active!==false).map(b => `<div style="font-size:13px; margin-bottom:6px; padding-bottom:6px; border-bottom:1px solid var(--border)">🏦 <strong>${b.bankName}</strong><br><span style="font-family:monospace; font-size:14px">${b.accountNumber}</span><br><span style="color:var(--text-muted)">اسم المستفيد: ${b.ownerName}</span></div>`).join('')}
        <div style="font-size:12px; color:var(--text-muted); margin-top:8px">سيتم إكمال الطلب، يرجى إرفاق صورة الإيصال لاحقاً في تفاصيل الطلب من صفحة طلباتي لكي نتمكن من اعتماد الطلب.</div>
      </div>
    </div>` : ''}

    <button class="btn btn-primary btn-block btn-lg" style="margin-top:8px" onclick="confirmBooking('${svcId}')">✅ تأكيد الحجز</button>`);

  State.selectedPaymentMethod = 'wallet';
  
  if ((hasTiers || s.price) && State.currentUser?.uid) {
    getBalance(State.currentUser.uid).then(bal => {
      const el = document.getElementById('svc-checkout-wallet-bal');
      if (el) el.innerText = bal + ' ريال متاح';
    }).catch(e => {
      const el = document.getElementById('svc-checkout-wallet-bal');
      if (el) el.innerText = 'الرصيد غير متاح';
    });
  }
}

window.bkSelectPayment = function(method) {
  State.selectedPaymentMethod = method;
  document.querySelectorAll('.bk-pay-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('bk-pay-' + method);
  if (btn) btn.classList.add('active');
  
  const bankInfo = document.getElementById('bk-bank-info');
  if (bankInfo) bankInfo.style.display = method === 'bank_transfer' ? 'block' : 'none';
};

async function confirmBooking(svcId) {
  const date = document.getElementById('bk-date')?.value;
  const time = document.getElementById('bk-time')?.value;
  const addrEl = document.getElementById('bk-addr');
  const addr = addrEl?.value.trim() || '';
  const note = document.getElementById('bk-note')?.value.trim() || '';
  if (!date) { toast('يرجى اختيار التاريخ المطلوب', 'error'); return; }

  const s = AppData.services.find(x => x.id === svcId);
  const u = State.currentUser;
  const payMethod = State.selectedPaymentMethod || 'wallet';
  const requiresDelivery = s?.requiresDelivery !== false;
  const deliveryType = State._deliveryType || 'delivery';
  const isPickup     = requiresDelivery && deliveryType === 'pickup';

  // ─── حساب سعر التوصيل من النظام الجديد ─────────────────────────
  let deliveryFee = 0;
  let deliveryRoute = null;
  if (requiresDelivery && !isPickup) {
    const fromArea = s?.location || s?.area || s?.address || '';
    const toArea   = addr || u?.address || u?.area || '';
    if (fromArea && toArea && typeof dp_calculateFee === 'function') {
      const result = dp_calculateFee(fromArea, toArea);
      if (result.found) {
        deliveryFee = result.fee;
        deliveryRoute = { from: fromArea, to: toArea };
      } else {
        deliveryFee = AppData.platformSettings?.deliveryFee || 0;
        toast('⚠️ سعر التوصيل لهذا المسار غير مسجّل — سيتم إشعار المدير', 'warning');
      }
    } else {
      deliveryFee = AppData.platformSettings?.deliveryFee || 0;
    }
  }

  const codFee  = payMethod === 'cod' ? 5 : 0;

  // ── Use selected tier price if available, else service price ──
  const tier      = window.__ph40_selectedTier;
  const svcPrice  = tier ? tier.price : (s?.price || 0);
  const tierName  = tier ? tier.name  : null;

  // ── التوصيل المجاني ───────────────────────────────────────────
  const _sectionId = s?.section || s?.sectionId || s?.category || 'services';
  if (deliveryFee > 0 && typeof fs_isFreeShipping === 'function' && fs_isFreeShipping(svcPrice, _sectionId)) {
    deliveryFee = 0;
    toast('🎉 مبروك! حصلت على توصيل مجاني', 'success');
  }

  const total     = svcPrice + deliveryFee + codFee;

  if (svcPrice && payMethod === 'wallet') {
    const bal = await getBalance(u.uid);
    if (bal < total) {
      toast(`رصيدك (${bal} ريال) غير كافٍ. المطلوب: ${total} ريال`, 'error');
      closeModal(); navigate('wallet'); return;
    }
  }

  const orderId = await generateOrderId();
  
  // ── Auto-routing bypass for Tier-Level Vendor Routing ──
  const assignedVendorId = tier?.vendorId || s?.vendorId || null;
  const assignedVendorUser = assignedVendorId ? (AppData.users||[]).find(u => u.uid === assignedVendorId || u.id === assignedVendorId) : null;
  const assignedVendorName = assignedVendorUser ? assignedVendorUser.name : (s?.provider || '—');

  if (assignedVendorId && typeof isVendorOpen === 'function' && !isVendorOpen(assignedVendorId)) {
    toast('⛔ هذا المزود/المتجر مغلق حالياً ولا يقبل طلبات جديدة', 'error');
    closeModal();
    return;
  }

  await fsAdd('orders', {
    orderId, svcId,
    svcName: s?.name, svcIcon: s?.icon,
    tierName,
    servicePrice: svcPrice, deliveryFee, codFee, total,
    paymentMethod: payMethod,
    customerId: u.uid, customerName: u.name, customerAddr: addr,
    vendorId: assignedVendorId, vendorName: assignedVendorName,
    driverId: null, driverName: null, requiresDelivery,
    deliveryType: isPickup ? 'pickup' : 'delivery',
    date, time, note, status: 'pending',
    orderRegionId: State.currentUser?.regionId || null,
  });

  if (svcPrice && payMethod === 'wallet') {
    const desc = `حجز خدمة: ${s?.name}${tierName ? ' — ' + tierName : ''}`;
    await deductWallet(u.uid, total, desc, orderId);
  }

  window.__ph40_selectedTier = null;
  closeModal();
  const payLabel = { wallet: 'المحفظة 💰', cod: 'عند الاستلام 💵', bank_transfer: 'تحويل بنكي 🏦' };
  toast(`✅ تم إرسال طلبك! رقم العملية: ${orderId} — الدفع: ${payLabel[payMethod] || payMethod}`, 'success');
  await navigate('myorders');
}


// ─── My Orders ────────────────────────────
function renderMyOrders() {
  const u = State.currentUser;
  const orders = AppData.orders.filter(o=>o.customerId===u.uid).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  const sLabel = {
    pending:'⏳ بانتظار القبول',
    pending_admin:'⏳ بانتظار الإدارة',
    pending_provider:'🔔 عند المزود',
    pending_final_admin:'🛡️ بانتظار الموافقة النهائية',
    pending_inspection:'🛠️ بانتظار المعاينة',
    pending_agreement:'📝 بانتظار الاتفاق',
    awaiting_payment:'💳 بانتظار الدفع',
    approved:'✅ تم القبول',
    provider_accepted:'🔄 جاري تعيين مندوب',
    accepted:'✅ تم القبول',
    with_driver:'🚗 مع المندوب',
    delivered:'📦 تم التوصيل',
    completed:'🎉 مكتمل',
    cancelled:'❌ ملغي'
  };
  const sBadge = {
    pending:'badge-gold',
    pending_admin:'badge-gold',
    pending_provider:'badge-purple',
    pending_final_admin:'badge-gold',
    pending_inspection:'badge-gold',
    pending_agreement:'badge-purple',
    awaiting_payment:'badge-gold',
    approved:'badge-teal',
    provider_accepted:'badge-gold',
    accepted:'badge-teal',
    with_driver:'badge-purple',
    delivered:'badge-teal',
    completed:'badge-teal',
    cancelled:'badge-rose'
  };
  // تذكير تلقائي بالتقييم لأي طلب مكتمل غير مُقيَّم
  if (typeof ph36_autoPromptRating === 'function') setTimeout(ph36_autoPromptRating, 1800);

  return `<div id="app-content">
    <div class="page-header"><h1>📋 طلباتي${window.ui_helpBtn('myorders')}</h1></div>
    <div class="listing-container">
      ${orders.length ? orders.map(o=>`
      <div class="order-card">
        <div class="order-header">
          <div>
            <div class="order-id">${o.orderId}</div>
            <div class="order-svc">${o.svcIcon||'🔷'} ${o.svcName}</div>
            ${o.tierName ? `<div style="font-size:12px;color:var(--primary);font-weight:700;margin-top:4px"><span style="background:rgba(139,92,246,0.08);padding:2px 6px;border-radius:6px;border:1px solid rgba(139,92,246,0.15)">🏷️ الفئة: ${escHtml(o.tierName)}</span></div>` : ''}
            ${typeof ph37_pickupBadge === 'function' ? ph37_pickupBadge(o) : ''}
          </div>
          <span class="badge ${sBadge[o.status]||'badge-purple'}">${sLabel[o.status]||o.status}</span>
        </div>
        <div class="order-meta">
          <span>📅 ${o.date||'—'}</span>
          <span>💰 ${o.total||o.servicePrice||0} ريال</span>
          ${o.driverName?`<span>🚗 ${o.driverName}</span>`:''}
        </div>
        ${o.displayStatus ? `<div style="background:rgba(59,130,246,0.05); padding:8px 12px; border-radius:8px; font-size:13px; color:var(--primary); font-weight:600; margin-bottom:10px">📢 ${o.displayStatus}</div>` : ''}
        ${o.estimatedArrival?`<div class="order-eta">🕒 وقت الوصول المتوقع: <strong>${o.estimatedArrival}</strong></div>`:''}
        <div class="order-actions">
          <button class="btn btn-secondary btn-sm" onclick="showInvoice('${o.id}')">🧾 الفاتورة</button>
          ${(o.downloadUrl && (o.status==='completed' || o.status==='accepted' || o.status==='delivered')) ? `
            <button class="btn btn-sm" style="background:var(--teal);color:#fff;font-weight:700" onclick="ph45_downloadFile('${o.downloadUrl}', '${escAttr(o.downloadFileName || 'file')}')">⬇️ تحميل الملف</button>
          ` : ''}
          ${(o.status==='pending_inspection' || o.status==='pending_agreement') ? `
            <button class="btn btn-primary btn-sm" onclick="ph_openProfessionAgreement('${o.id}')">📝 اتمام الاتفاق</button>
          `:''}
          ${o.status==='awaiting_payment' ? `
            <button class="btn btn-success btn-sm" onclick="ph_payProfessionOrder('${o.id}')">💳 دفع الآن</button>
          `:''}
          ${(o.status==='completed' || o.status==='delivered') && !AppData.ratings.find(r=>r.orderId===o.id&&r.customerId===u.uid) ?
            `<button class="btn btn-primary btn-sm" onclick="(typeof ph36_showOrderRatingModal==='function'?ph36_showOrderRatingModal:ph29_showRatingModal)('${o.id}')">⭐ قيّم الطلب</button>` : ''}
          ${o.status==='with_driver' && o.driverPhone ?
            `<a href="https://wa.me/${o.driverPhone}" target="_blank" class="btn btn-sm" style="background:#25d366;color:#fff">💬 تواصل مع المندوب</a>` : ''}
          ${(o.status==='with_driver' || o.status==='delivered' || o.status==='completed') ?
            `<button class="btn btn-sm" style="background:var(--gold);color:#000" onclick="openLiveTrackingModal('${o.id}')">📍 تتبع الطلب</button>` : ''}
        </div>
      </div>`).join('') :
      `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">لا توجد طلبات بعد</div>
        <button class="btn btn-primary" style="margin-top:20px" onclick="navigate('home')">🏠 ابدأ التسوق</button></div>`}
    </div>
  </div>`;
}
function showInvoice(orderId) {
  const o = AppData.orders.find(x=>x.id===orderId);
  if (!o) return;
  const sLabel = {pending:'⏳ بانتظار القبول',accepted:'✅ تم القبول',with_driver:'🚗 مع المندوب',delivered:'📦 تم التوصيل',completed:'🎉 مكتمل',cancelled:'❌ ملغي'};
  openModal(`
    <div class="modal-header"><h2 class="modal-title">🧾 فاتورة الطلب</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="invoice">
      <div class="invoice-row"><span>رقم العمليات</span><strong>${o.orderId}</strong></div>
      <div class="invoice-row"><span>الخدمة</span><span>${o.svcIcon||''} ${o.svcName}</span></div>
      ${o.tierName ? `<div class="invoice-row"><span>الفئة المختارة</span><span style="font-weight:700;color:var(--primary)">🏷️ ${escHtml(o.tierName)}</span></div>` : ''}
      ${o.locationCount > 1 ? `<div class="invoice-row"><span>عدد المواقع</span><span>${o.locationCount} مواقع مختلقة</span></div>` : ''}
      <div class="invoice-row"><span>التاريخ</span><span>${o.date||'—'}</span></div>
      <div class="invoice-row"><span>سعر الخدمة</span><span>${o.servicePrice||0} ريال</span></div>
      ${o.taxAmount ? `
      <div class="invoice-row"><span>الضريبة (${o.taxPercent}%)</span><span>${o.taxAmount} ريال</span></div>
      ` : ''}
      <div class="invoice-row"><span>رسوم التوصيل</span><span>${o.deliveryFee||0} ريال</span></div>
      <div class="invoice-row total"><span>الإجمالي</span><strong>${o.total||0} ريال</strong></div>
      <div class="invoice-row"><span>الحالة</span><span>${sLabel[o.status]||o.status}</span></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-primary btn-block" onclick="ph6_generateInvoice('${o.id}')">📥 تنزيل PDF</button>
      <button class="btn btn-secondary btn-block" onclick="closeModal()">إغلاق</button>
    </div>`);
}

// ─── My Wallet ────────────────────────────
function renderMyWallet() {
  const u = State.currentUser;
  const bal = AppData.wallets ? (AppData.wallets[u.uid]?.balance||0) : 0;
  const txns = AppData.transactions.filter(t=>t.uid===u.uid).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,20);
  const myReqs = AppData.rechargeReqs.filter(r=>r.userId===u.uid);
  const pendingReq = myReqs.find(r=>r.status==='pending');

  // Multi-currency conversions (YER base → YER / USD).
  let currencyChips = '';
  try {
    if (typeof ph17_settings === 'function' && typeof ph17_convert === 'function') {
      const cs = (ph17_settings().currencies || []).filter(c => !c.base);
      currencyChips = cs.map(c => {
        const v = ph17_convert(bal, c.code);
        if (v == null) return '';
        const txt = (Math.round(v*100)/100).toLocaleString('en-US',{maximumFractionDigits:2});
        return `<span class="badge badge-teal" style="font-size:13px;padding:6px 10px;margin:2px">≈ ${txt} ${c.code}</span>`;
      }).join('');
    }
  } catch(e) {}

  return `<div id="app-content">
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <button class="back-btn" onclick="goBack('home')">→ رجوع</button>
      <h1>💰 محفظتي — ${bal.toLocaleString('ar-YE')} ريال${window.ui_helpBtn('wallet')}</h1>
      <button class="btn btn-secondary btn-sm" onclick="ph6_generateStatement && ph6_generateStatement(State.currentUser.uid||State.currentUser.id, 90)">📄 تحميل كشف PDF</button>
    </div>
    <div class="wallet-card">
      <div class="wallet-label">رصيدك الحالي</div>
      <div class="wallet-balance">${bal.toLocaleString('ar-YE')} <span style="font-size:18px">ريال</span></div>
      ${currencyChips ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center">${currencyChips}</div>` : ''}
      ${pendingReq ? `<div style="margin-top:12px"><span class="badge badge-gold">⏳ يوجد طلب شحن قيد المراجعة (${pendingReq.amount} ريال)</span></div>` : ''}
      <button class="btn btn-primary" style="margin-top:20px" onclick="showRechargeModal()" ${pendingReq?'disabled':''}>
        ➕ شحن الرصيد
      </button>
    </div>
    <!-- زر سجل الإيداعات -->
    <button onclick="navigate('mydeposits')"
      style="width:100%;margin-top:16px;background:rgba(59,130,246,0.08);border:1.5px solid rgba(59,130,246,0.3);color:#60a5fa;border-radius:14px;padding:14px 20px;font-size:14px;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif;display:flex;align-items:center;justify-content:space-between;transition:all 0.2s"
      onmouseover="this.style.background='rgba(59,130,246,0.14)'"
      onmouseout="this.style.background='rgba(59,130,246,0.08)'">
      <span style="display:flex;align-items:center;gap:10px">
        <span style="font-size:22px">🏦</span>
        <span>
          <span style="display:block">سجل إيداعاتي البنكية</span>
          <span style="font-size:11px;font-weight:400;color:var(--text-muted)">تتبع حالة الإيداعات (مقبول / قيد المراجعة / مرفوض)</span>
        </span>
      </span>
      <span style="font-size:18px;opacity:0.6">←</span>
    </button>

    <div class="section-title" style="margin-top:24px">📜 سجل المعاملات</div>
    ${txns.length ? `<div class="table-wrap"><table class="admin-table">
      <thead><tr><th>النوع</th><th>المبلغ</th><th>الوصف</th><th>التاريخ</th></tr></thead>
      <tbody>${txns.map(t=>`<tr>
        <td><span class="badge ${t.type==='credit'?'badge-teal':'badge-rose'}">${t.type==='credit'?'➕ إيداع':'➖ سحب'}</span></td>
        <td style="font-weight:700">${t.amount} ريال</td>
        <td style="color:var(--text-secondary)">${t.note||'—'}</td>
        <td style="color:var(--text-muted)">${fmtDate(t.createdAt)}</td>
      </tr>`).join('')}</tbody>
    </table></div>` : `<div class="empty-state"><div class="empty-icon">📜</div><div class="empty-title">لا توجد معاملات بعد</div></div>`}
  </div>`;
}
function showRechargeModal() {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">➕ شحن الرصيد</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.2);border-radius:var(--radius-sm);padding:16px;margin-bottom:20px">
      <p style="color:var(--text-secondary);line-height:1.8">
        1. حوّل المبلغ المطلوب إلى حساب المنصة<br>
        2. ارفع صورة إثبات التحويل<br>
        3. سيتم مراجعة طلبك وإضافة الرصيد خلال 24 ساعة
      </p>
    </div>
    <div class="form-group"><label class="form-label">المبلغ المراد شحنه (ريال)</label><input class="form-control" id="rc-amount" type="number" min="10" placeholder="مثال: 100"></div>
    <div class="form-group"><label class="form-label">صورة إثبات التحويل</label><input class="form-control" id="rc-proof" type="file" accept="image/*" onchange="previewProof(this)"></div>
    <div id="proof-preview" style="margin-bottom:16px"></div>
    <div class="form-group"><label class="form-label">ملاحظة (اختياري)</label><input class="form-control" id="rc-note" placeholder="رقم الحوالة أو أي تفصيل"></div>
    <button class="btn btn-primary btn-block" onclick="submitRechargeRequest()">إرسال طلب الشحن</button>`);
}
function previewProof(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('proof-preview').innerHTML = `<img src="${e.target.result}" style="max-width:100%;border-radius:8px;max-height:200px;object-fit:cover">`;
  };
  reader.readAsDataURL(file);
}
async function submitRechargeRequest() {
  const amount = parseFloat(document.getElementById('rc-amount').value);
  const note   = document.getElementById('rc-note').value.trim();
  const file   = document.getElementById('rc-proof').files[0];
  if (!amount || amount < 10) { toast('أدخل مبلغاً صحيحاً (10 ريال على الأقل)','error'); return; }
  let proofBase64 = null;
  if (file) {
    proofBase64 = await new Promise(res => {
      const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file);
    });
  }
  const u = State.currentUser;
  const rechargeRef = await fsAdd('recharge_requests', { userId: u.uid, userName: u.name, amount, note, proofBase64, status: 'pending' });
  await fsAdd('depositDocs', {
    userId: u.uid,
    userName: u.name,
    userPhone: u.phone || '',
    userRole: u.role || 'customer',
    depositType: 'wallet_recharge',
    referenceId: rechargeRef.id || '',
    amount: parseFloat(amount),
    bankName: note || 'إيداع بنكي لشحن المحفظة',
    transferDate: new Date().toISOString().split('T')[0],
    receiptUrl: proofBase64,
    status: 'pending',
    createdAt: new Date()
  });
  closeModal(); toast('تم إرسال طلب الشحن! سيتم المراجعة خلال 24 ساعة ✅','success');
  await navigate('wallet');
}

// ─── My Deposits (سجل الإيداعات البنكية للعميل) ─────────────
function renderMyDeposits() {
  const u        = State.currentUser;
  const deposits = (AppData.bankDeposits || [])
    .filter(d => d.customerId === u.uid)
    .sort((a, b) => {
      const ta = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime()/1000 : 0);
      const tb = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime()/1000 : 0);
      return tb - ta;
    });

  const statusInfo = {
    pending:  { label: '⏳ قيد المراجعة', badge: 'badge-gold',   icon: '⏳' },
    approved: { label: '✅ تم القبول',     badge: 'badge-teal',   icon: '✅' },
    rejected: { label: '❌ مرفوض',         badge: 'badge-rose',   icon: '❌' },
  };

  const cards = deposits.length ? deposits.map(d => {
    const s   = statusInfo[d.status] || statusInfo.pending;
    const dt  = d.createdAt
      ? (d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt.seconds ? d.createdAt.seconds * 1000 : d.createdAt))
      : null;
    const dtStr = dt ? dt.toLocaleString('ar-YE', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';

    return `
    <div style="
      background:var(--card-bg);
      border:1.5px solid ${d.status==='approved' ? 'rgba(16,185,129,0.3)' : d.status==='rejected' ? 'rgba(239,68,68,0.3)' : 'var(--border)'};
      border-radius:16px;
      padding:18px 20px;
      margin-bottom:14px;
      font-family:'Cairo',sans-serif;
    ">
      <!-- رأس البطاقة -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:42px;height:42px;border-radius:12px;background:${d.status==='approved'?'rgba(16,185,129,0.12)':d.status==='rejected'?'rgba(239,68,68,0.1)':'rgba(251,191,36,0.1)'};display:flex;align-items:center;justify-content:center;font-size:22px">
            ${s.icon}
          </div>
          <div>
            <div style="font-size:14px;font-weight:800;color:var(--text)">إيداع بنكي</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${dtStr}</div>
          </div>
        </div>
        <span class="badge ${s.badge}" style="font-size:12px;padding:5px 12px">${s.label}</span>
      </div>

      <!-- تفاصيل -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:${d.status==='rejected' && d.rejectReason ? '14px' : '0'}">
        <div style="background:var(--bg,rgba(255,255,255,0.03));border:1px solid var(--border);border-radius:10px;padding:10px 14px">
          <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:3px">المبلغ</div>
          <div style="font-size:18px;font-weight:900;color:${d.status==='approved'?'#10b981':d.status==='rejected'?'#ef4444':'var(--text)'}">
            ${(d.amount||0).toLocaleString('ar-YE')} <span style="font-size:12px;font-weight:600">ر.ي</span>
          </div>
        </div>
        <div style="background:var(--bg,rgba(255,255,255,0.03));border:1px solid var(--border);border-radius:10px;padding:10px 14px">
          <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:3px">رقم الطلب</div>
          <div style="font-size:13px;font-weight:800;color:var(--text)">${d.orderId || '—'}</div>
        </div>
        ${d.bankName ? `
        <div style="grid-column:1/-1;background:var(--bg,rgba(255,255,255,0.03));border:1px solid var(--border);border-radius:10px;padding:10px 14px">
          <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:3px">الحساب البنكي</div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">🏦 ${escHtml(d.bankName)}</div>
        </div>` : ''}
      </div>

      <!-- سبب الرفض -->
      ${d.status === 'rejected' && d.rejectReason ? `
      <div style="background:rgba(239,68,68,0.07);border:1.5px solid rgba(239,68,68,0.25);border-radius:10px;padding:12px 14px;font-size:12.5px;color:#ef4444;font-weight:700;display:flex;align-items:flex-start;gap:8px">
        <span style="flex-shrink:0">⚠️</span>
        <span><strong>سبب الرفض:</strong> ${escHtml(d.rejectReason)}</span>
      </div>` : ''}

      ${d.status === 'rejected' && !d.rejectReason ? `
      <div style="background:rgba(239,68,68,0.07);border:1.5px solid rgba(239,68,68,0.2);border-radius:10px;padding:10px 14px;font-size:12px;color:rgba(239,68,68,0.8)">
        يرجى التواصل مع الدعم لمعرفة سبب الرفض.
      </div>` : ''}

      ${d.status === 'approved' && d.approvedBy ? `
      <div style="margin-top:10px;font-size:11px;color:var(--text-muted);text-align:left;direction:ltr">
        ✅ اعتمد بواسطة: ${escHtml(d.approvedBy)}
      </div>` : ''}
    </div>`;
  }).join('') : `
  <div class="empty-state">
    <div class="empty-icon">🏦</div>
    <div class="empty-title">لا توجد إيداعات بعد</div>
    <p style="color:var(--text-muted);font-size:13px;margin-top:8px">إيداعاتك البنكية ستظهر هنا مع حالتها ونتيجة المراجعة</p>
  </div>`;

  /* ── ملخص سريع ── */
  const total     = deposits.length;
  const approved  = deposits.filter(d => d.status === 'approved').length;
  const pending   = deposits.filter(d => d.status === 'pending').length;
  const rejected  = deposits.filter(d => d.status === 'rejected').length;
  const totalAmt  = deposits.filter(d => d.status === 'approved').reduce((s, d) => s + (d.amount || 0), 0);

  const summary = total ? `
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;font-family:'Cairo',sans-serif">
    ${[
      { label:'الكل',      val: total,                                 color:'var(--primary)', bg:'rgba(124,58,237,0.08)' },
      { label:'مقبول',     val: approved,                              color:'#10b981',         bg:'rgba(16,185,129,0.08)' },
      { label:'قيد المراجعة', val: pending,                            color:'#fbbf24',         bg:'rgba(251,191,36,0.08)' },
      { label:'مرفوض',     val: rejected,                              color:'#ef4444',         bg:'rgba(239,68,68,0.08)'  },
    ].map(s => `
      <div style="background:${s.bg};border:1px solid ${s.color}30;border-radius:12px;padding:12px 8px;text-align:center">
        <div style="font-size:20px;font-weight:900;color:${s.color}">${s.val}</div>
        <div style="font-size:10.5px;color:var(--text-muted);margin-top:2px">${s.label}</div>
      </div>`).join('')}
  </div>
  ${totalAmt > 0 ? `
  <div style="background:rgba(16,185,129,0.07);border:1.5px solid rgba(16,185,129,0.25);border-radius:12px;padding:12px 16px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;font-family:'Cairo',sans-serif">
    <span style="font-size:13px;color:var(--text-muted);font-weight:700">💰 إجمالي الإيداعات المقبولة</span>
    <span style="font-size:17px;font-weight:900;color:#10b981">${totalAmt.toLocaleString('ar-YE')} ر.ي</span>
  </div>` : ''}` : '';

  return `<div id="app-content">
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <button class="back-btn" onclick="navigate('wallet')">→ رجوع</button>
      <h1>🏦 سجل إيداعاتي</h1>
      <button class="btn btn-secondary btn-sm" onclick="navigate('mydeposits')">🔄 تحديث</button>
    </div>
    <div class="listing-container" style="max-width:680px;margin:0 auto">
      ${summary}
      ${cards}
    </div>
  </div>`;
}
window.renderMyDeposits = renderMyDeposits;

// ─── Rating ───────────────────────────────
function renderRatingPage() {
  const { orderId } = State.params;
  const o = AppData.orders.find(x=>x.id===orderId);
  if (!o) { navigate('myorders'); return ''; }
  return `<div id="app-content">
    <div class="page-header">
      <button class="back-btn" onclick="navigate('myorders')">→ رجوع</button>
      <h1>⭐ تقييم الطلب</h1>
      <p style="color:var(--text-secondary)">${o.orderId} — ${o.svcName}</p>
    </div>
    <div class="listing-container">
      <div class="rating-card">
        <h3 style="margin-bottom:16px">تقييم صاحب الخدمة: ${o.vendorName||'—'}</h3>
        <div class="star-picker" id="vendor-stars">
          ${[1,2,3,4,5].map(n=>`<span class="star" onclick="pickStar('vendor',${n})" data-v="${n}">☆</span>`).join('')}
        </div>
        <div class="form-group" style="margin-top:16px"><textarea class="form-control" id="vendor-comment" placeholder="اكتب تعليقك على الخدمة..."></textarea></div>
      </div>
      ${o.driverName ? `
      <div class="rating-card">
        <h3 style="margin-bottom:16px">تقييم المندوب: ${o.driverName}</h3>
        <div class="star-picker" id="driver-stars">
          ${[1,2,3,4,5].map(n=>`<span class="star" onclick="pickStar('driver',${n})" data-v="${n}">☆</span>`).join('')}
        </div>
        <div class="form-group" style="margin-top:16px"><textarea class="form-control" id="driver-comment" placeholder="اكتب تعليقك على المندوب..."></textarea></div>
      </div>` : ''}
      <button class="btn btn-primary btn-block btn-lg" onclick="submitRating('${orderId}')">إرسال التقييم ⭐</button>
    </div>
  </div>`;
}
let _ratingVals = { vendor: 0, driver: 0 };
function pickStar(type, n) {
  _ratingVals[type] = n;
  document.querySelectorAll(`#${type}-stars .star`).forEach(s => {
    s.textContent = parseInt(s.dataset.v) <= n ? '⭐' : '☆';
  });
}
async function submitRating(orderId) {
  const vc = document.getElementById('vendor-comment')?.value.trim();
  const dc = document.getElementById('driver-comment')?.value.trim();
  if (!_ratingVals.vendor) { toast('يرجى تقييم صاحب الخدمة','error'); return; }
  const o = AppData.orders.find(x=>x.id===orderId);
  const u = State.currentUser;
  await fsAdd('ratings', {
    orderId, customerId: u.uid, customerName: u.name,
    vendorId: o?.vendorId, vendorStars: _ratingVals.vendor, vendorComment: vc,
    driverId: o?.driverId, driverStars: _ratingVals.driver||null, driverComment: dc,
    serviceId: o?.svcId,
  });
  _ratingVals = { vendor:0, driver:0 };
  toast('شكراً على تقييمك! ⭐','success');
  await navigate('myorders');
}

// ─── Settings & Security (2FA) ────────────────
function renderSettingsPage() {
  const u = State.currentUser;
  const is2FAEnabled = u?.twoFAEnabled || false;
  return `<div id="app-content">
    <div class="page-header">
      <button class="back-btn" onclick="navigate(State.currentUser.role==='customer'?'home':'admin')">→ رجوع</button>
      <h1>⚙️ الإعدادات والأمان</h1>
    </div>
    <div class="listing-container">
      <div class="settings-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <div>
            <h3 style="margin-bottom:4px">🔐 المصادقة الثنائية (2FA)</h3>
            <p style="color:var(--text-secondary);font-size:14px">حماية إضافية لحسابك عند تسجيل الدخول</p>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" ${is2FAEnabled?'checked':''} onchange="toggle2FA()">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div style="background:var(--gradient-card);border:1px solid var(--glass-border);border-radius:var(--radius-sm);padding:12px;font-size:13px;color:var(--text-secondary)">
          ${is2FAEnabled ? 
            '✅ المصادقة الثنائية مفعّلة. سيتلقى رمز التحقق عند دخول جديد.' :
            '❌ المصادقة الثنائية معطّلة. فعّلها لحماية أفضل.'}
        </div>
      </div>

      <div class="settings-card">
        <h3 style="margin-bottom:16px">👤 معلومات الحساب</h3>
        <div class="info-row">
          <span>الاسم</span><strong>${u?.name||'—'}</strong>
        </div>
        <div class="info-row">
          <span>البريد الإلكتروني</span><strong>${u?.email||'—'}</strong>
        </div>
        <div class="info-row">
          <span>الدور</span><strong>${{admin:'مدير',staff:'موظف',vendor:'مزود خدمة',driver:'مندوب',customer:'عميل',provider:'مزود خدمة'}[u?.role]||u?.role}</strong>
        </div>
        ${u?.phone ? `<div class="info-row"><span>رقم الهاتف</span><strong>${u.phone}</strong></div>` : ''}
      </div>

      <div class="settings-card">
        <h3 style="margin-bottom:16px">🔒 كلمة المرور</h3>
        <button class="btn btn-secondary btn-block" onclick="showChangePasswordModal()">تغيير كلمة المرور</button>
      </div>

      <div class="settings-card">
        <h3 style="margin-bottom:16px">📋 جلسات نشطة</h3>
        <div class="info-row">
          <span>الجهاز الحالي</span><strong>متصل الآن</strong>
        </div>
        <button class="btn btn-danger btn-block" style="margin-top:12px" onclick="logoutConfirm()">تسجيل الخروج</button>
      </div>
    </div>
  </div>`;
}
async function toggle2FA() {
  try {
    showLoader('جاري تحديث الإعدادات...');
    await toggleTwoFA(State.currentUser.uid);
    State.currentUser.twoFAEnabled = !State.currentUser.twoFAEnabled;
    await navigate('settings');
  } catch(e) {
    toast(e.message, 'error');
    await navigate('settings');
  }
}
function showChangePasswordModal() {
  openModal(`
    <div class="modal-header"><h2 class="modal-title">🔐 تغيير كلمة المرور</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p style="color:var(--text-secondary);margin-bottom:20px">أدخل كلمة مرورك الحالية والجديدة</p>
    <div class="form-group"><label class="form-label">كلمة المرور الحالية</label><input class="form-control" id="old-pwd" type="password" placeholder="كلمة المرور الحالية"></div>
    <div class="form-group"><label class="form-label">كلمة المرور الجديدة</label><input class="form-control" id="new-pwd-1" type="password" placeholder="6 أحرف على الأقل"></div>
    <div class="form-group"><label class="form-label">تأكيد كلمة المرور</label><input class="form-control" id="new-pwd-2" type="password" placeholder="أعد كلمة المرور"></div>
    <button class="btn btn-primary btn-block" onclick="changePassword()">حفظ التغييرات</button>`);
}
async function changePassword() {
  const oldPwd = document.getElementById('old-pwd')?.value;
  const newPwd1 = document.getElementById('new-pwd-1')?.value;
  const newPwd2 = document.getElementById('new-pwd-2')?.value;
  if (!oldPwd || !newPwd1 || !newPwd2) { toast('أكمل جميع الحقول','error'); return; }
  if (newPwd1.length < 6) { toast('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل','error'); return; }
  if (newPwd1 !== newPwd2) { toast('كلمتا المرور غير متطابقتين','error'); return; }
  try {
    const user = auth.currentUser;
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, oldPwd);
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(newPwd1);
    closeModal();
    toast('✅ تم تحديث كلمة المرور بنجاح','success');
  } catch(e) {
    toast('كلمة المرور الحالية خاطئة أو حدث خطأ','error');
  }
}

// ═══════════════════════════════════════════════════════
//  محجوز v2.2 — Phase 2
//  - Service images, gallery & rich details
//  - Category descriptions
//  - Smart global search
//  - Nearby & Open-Now sections
//  - Service detail page (/service?id=)
// ═══════════════════════════════════════════════════════

// ─── Translations (extend i18n) ────────────────────────
(function () {
  if (typeof I18N === 'undefined') return;
  const add = (k, ar, en) => { I18N.ar[k] = ar; I18N.en[k] = en; };
  add('search_placeholder', 'ابحث عن خدمة، مزود، أو تصنيف...', 'Search services, providers, categories...');
  add('search_results', 'نتائج البحث', 'Search results');
  add('no_results', 'لا توجد نتائج مطابقة', 'No matching results');
  add('nearby_services', '📍 خدمات قريبة منك', '📍 Nearby services');
  add('open_now', '🟢 مفتوحة الآن', '🟢 Open now');
  add('only_open_now', 'المفتوحة فقط', 'Open only');
  add('description', 'الوصف', 'Description');
  add('photos', 'الصور', 'Photos');
  add('main_photo', 'الصورة الرئيسية', 'Main photo');
  add('extra_photos', 'صور إضافية (حتى 4)', 'Extra photos (up to 4)');
  add('region', 'المنطقة', 'Region');
  add('address_in_region', 'العنوان داخل المنطقة', 'Address in region');
  add('location_on_map', 'الموقع على الخريطة', 'Location on map');
  add('pick_my_location', '📍 تحديد موقعي', '📍 Use my location');
  add('contact_phone', 'رقم الهاتف', 'Phone');
  add('whatsapp_number', 'رقم واتساب', 'WhatsApp');
  add('opening_hours', 'ساعات العمل', 'Opening hours');
  add('opens_at', 'يفتح', 'Opens');
  add('closes_at', 'يغلق', 'Closes');
  add('working_days', 'أيام العمل', 'Working days');
  add('open_status', 'الحالة', 'Status');
  add('currently_open', 'مفتوحة الآن', 'Open now');
  add('currently_closed', 'مغلقة الآن', 'Closed now');
  add('km_away', 'كم منك', 'km away');
  add('view_details', 'عرض التفاصيل', 'View details');
  add('call', '📞 اتصال', '📞 Call');
  add('whatsapp', '💬 واتساب', '💬 WhatsApp');
  add('directions', '🧭 الاتجاهات', '🧭 Directions');
  add('related_services', 'خدمات مشابهة', 'Related services');
  add('reviews', 'التقييمات', 'Reviews');
  add('cat_description', 'وصف التصنيف (اختياري)', 'Category description (optional)');
  add('saturday', 'السبت', 'Sat'); add('sunday', 'الأحد', 'Sun');
  add('monday', 'الإثنين', 'Mon'); add('tuesday', 'الثلاثاء', 'Tue');
  add('wednesday', 'الأربعاء', 'Wed'); add('thursday', 'الخميس', 'Thu');
  add('friday', 'الجمعة', 'Fri');
  add('book_now', '✨ احجز الآن', '✨ Book Now');
  if (typeof applyLang === 'function') applyLang();
})();

// ─── Helpers ───────────────────────────────────────────
const DAYS = [
  { k: 'sat', i: 6 }, { k: 'sun', i: 0 }, { k: 'mon', i: 1 },
  { k: 'tue', i: 2 }, { k: 'wed', i: 3 }, { k: 'thu', i: 4 }, { k: 'fri', i: 5 },
];
const dayName = (k) => ({sat:'saturday',sun:'sunday',mon:'monday',tue:'tuesday',wed:'wednesday',thu:'thursday',fri:'friday'}[k]);

function _haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function isServiceOpenNow(svc) {
  const oh = svc?.openingHours;
  if (!oh || !oh.open || !oh.close || !oh.days || !oh.days.length) return null;
  const now = new Date();
  const dayIdx = now.getDay(); // 0=Sun..6=Sat
  const todayKey = DAYS.find(d => d.i === dayIdx)?.k;
  if (!oh.days.includes(todayKey)) return false;
  const [oh1, om1] = oh.open.split(':').map(Number);
  const [oh2, om2] = oh.close.split(':').map(Number);
  const cur = now.getHours()*60 + now.getMinutes();
  const start = oh1*60 + om1, end = oh2*60 + om2;
  return end > start ? (cur >= start && cur <= end) : (cur >= start || cur <= end);
}

// Resize a File to a base64 PNG no wider than `maxW`.
function fileToResizedBase64(file, maxW = 900, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// User GPS cache (persisted in sessionStorage)
async function getUserCoords({ ask = false } = {}) {
  const cached = sessionStorage.getItem('user_coords');
  if (cached) { try { return JSON.parse(cached); } catch(e){} }
  if (!navigator.geolocation || !ask) return null;
  return new Promise(res => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        sessionStorage.setItem('user_coords', JSON.stringify(c));
        res(c);
      },
      () => {
        // retry with low accuracy on failure
        navigator.geolocation.getCurrentPosition(
          pos => {
            const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            sessionStorage.setItem('user_coords', JSON.stringify(c));
            res(c);
          },
          () => res(null),
          { timeout: 20000, enableHighAccuracy: false, maximumAge: 60000 }
        );
      },
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 }
    );
  });
}

async function requestNearbyAndRender() {
  const c = await getUserCoords({ ask: true });
  if (!c) { toast('تعذّر الحصول على موقعك. تأكد من السماح بالوصول للموقع.', 'error'); return; }
  await render();
}

// Category Admin functions moved to dashboards.js to prevent conflicts

// Service Admin functions moved to dashboards.js to prevent conflicts

// ─── Service card (override) ──────────────────────────
function renderServiceCard(s) {
  const u = State.currentUser;
  const rating = AppData.ratings.filter(r=>r.serviceId===s.id);
  const avg = rating.length ? (rating.reduce((a,r)=>a+(r.vendorStars||0),0)/rating.length).toFixed(1) : null;
  const cover = s.images?.[0];
  const open = isServiceOpenNow(s);
  const region = AppData.regions?.find(r => r.id === s.regionId);
  const userC = (() => { try { return JSON.parse(sessionStorage.getItem('user_coords')||'null'); } catch(e){ return null; } })();
  const distance = (userC && s.lat && s.lng) ? _haversine(userC.lat, userC.lng, s.lat, s.lng).toFixed(1) : null;
  const cat = AppData.cats?.find(c => c.id === s.catId);
  const isProf = cat?.section === 'professions' || cat?.section === 'services';

  const activeOffer = typeof ph_getActiveOffer === 'function' ? ph_getActiveOffer(s.id) : null;
  const offerPct = activeOffer ? (activeOffer.discountPercent || (activeOffer.originalPrice > 0 ? Math.round(((activeOffer.originalPrice - activeOffer.discountedPrice) / activeOffer.originalPrice) * 100) : 0)) : 0;
  const hasTiers = s.tiers && s.tiers.length > 0;
  const minPrice = hasTiers ? Math.min(...s.tiers.map(t => t.price || 0)) : null;

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

  const defaultPriceHtml = hasTiers
    ? `<div class="ph-price-block"><span class="ph-price-label">يبدأ من</span><span class="ph-price-num">${minPrice.toLocaleString('ar-YE')}</span><span class="ph-price-cur">ريال</span></div>`
    : (s.price
      ? `<div class="ph-price-block"><span class="ph-price-num">${s.price.toLocaleString('ar-YE')}</span><span class="ph-price-cur">ريال</span></div>`
      : `<div class="ph-price-block ph-price-on-contact">${isProf ? 'السعر بعد المعاينة' : 'السعر عند التواصل'}</div>`);

  // ── نظام التنبيهات (ph48) ─────────────────────────────────────
  const alertBadgeHtml = typeof ph48_badgeHtml   === 'function' ? ph48_badgeHtml(s)   : '';
  const stockChipHtml  = typeof ph48_stockChipHtml === 'function' ? ph48_stockChipHtml(s) : '';
  const unavailHtml    = typeof ph48_unavailOverlayHtml === 'function' ? ph48_unavailOverlayHtml(s) : '';
  const isAvail        = typeof ph48_isAvailable === 'function' ? ph48_isAvailable(s) : true;

  return `
  <div class="service-card" onclick="navigate('service',{id:'${s.id}'})" style="cursor:pointer;position:relative">
    <button class="card-share-btn" onclick="event.stopPropagation();ph34_shareItem('service', '${s.id}')" title="مشاركة الخدمة">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
    </button>
    ${alertBadgeHtml}
    ${activeOffer ? (typeof ph_offerBadgeHtml === 'function' ? ph_offerBadgeHtml(offerPct, 'left:10px;top:50px !important') : '') : ''}
    <div class="service-cover" style="position:relative;overflow:hidden">
      ${cover ? `<img src="${cover}" alt="${escAttr(s.name)}">` : `<div class="service-cover-fallback">${s.icon||'🔷'}</div>`}
      ${unavailHtml}
      ${open === true  ? `<span class="svc-badge open">🟢 ${t('currently_open')}</span>`   : ''}
      ${open === false ? `<span class="svc-badge closed">⚪ ${t('currently_closed')}</span>` : ''}
      ${distance ? `<span class="svc-badge dist">📍 ${distance} ${t('km_away')}</span>` : ''}
    </div>
    <div class="service-body">
      <div class="service-name">${escHtml(s.name)}</div>
      ${stockChipHtml ? `<div style="margin-top:4px">${stockChipHtml}</div>` : ''}
      ${s.sku ? `<div style="display:inline-block;font-family:monospace;font-size:10.5px;font-weight:700;background:rgba(139,92,246,0.1);color:#8b5cf6;border:1px solid rgba(139,92,246,0.2);border-radius:4px;padding:1px 6px;margin-top:3px;letter-spacing:0.5px;">#${s.sku}</div>` : ''}
      <div class="service-provider">${region?`📍 ${escHtml(region.name)}`:''}</div>
      ${s.desc?`<p class="service-desc">${escHtml(s.desc)}</p>`:''}
      <div class="service-footer">
        <div>
          ${activeOffer && typeof ph_offerPriceHtml === 'function'
            ? ph_offerPriceHtml(activeOffer, defaultPriceHtml)
            : defaultPriceHtml}
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px">
            <span style="font-size:13px;color:var(--text-muted)">${avg?'⭐ '+avg+' ('+rating.length+')':'لا يوجد تقييم'}</span>
            ${rating.length ? `<button id="ph36-reviews-btn" onclick="event.stopPropagation();ph36_showReviewsModal('${s.id}','${(s.name||'').replace(/'/g,"\\'")}')" style="font-size:11px;color:var(--primary);cursor:pointer;padding:2px 8px;background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);border-radius:10px;font-family:inherit;text-decoration:none">التقييمات</button>` : ''}
          </div>
        </div>
        <div class="svc-card-actions">
          ${u?.role==='customer' ? `<button class="btn btn-primary btn-sm${isAvail ? '' : ' ia-btn-disabled'}" data-svc-cart-id="${s.id}" onclick="event.stopPropagation();${isAvail ? (hasTiers ? `bookService('${s.id}')` : `typeof svc_addToCart==='function'?svc_addToCart('${s.id}'):bookService('${s.id}')`) : `typeof toast==='function'&&toast('هذه الخدمة غير متاحة حالياً','warning')`}">${isAvail ? (activeOffer ? '🏷️ اطلب' : '🛒 أضف') : '🚫 غير متاح'}</button>` :
            u?.role==='guest'    ? `<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();navigate('login')">سجل</button>` : ''}
          ${waUrl ? `<a class="btn-wa-inquiry" href="${waUrl}" target="_blank" rel="noopener" title="استفسار عبر واتساب" onclick="event.stopPropagation();">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

// ─── Service Detail Page ──────────────────────────────
function renderServiceDetail() {
  const s = AppData.services.find(x => x.id === State.params.id);
  if (!s) return `<div id="app-content"><div class="empty-state"><div class="empty-icon">❓</div><div class="empty-title">الخدمة غير موجودة</div><button class="btn btn-primary" style="margin-top:20px" onclick="navigate('home')">العودة</button></div></div>`;
  const u = State.currentUser;
  const cat = AppData.cats.find(c => c.id === s.catId);
  const region = AppData.regions?.find(r => r.id === s.regionId);
  const rating = AppData.ratings.filter(r => r.serviceId === s.id);
  const avg = rating.length ? (rating.reduce((a,r)=>a+(r.vendorStars||0),0)/rating.length).toFixed(1) : null;
  const open = isServiceOpenNow(s);
  const related = AppData.services.filter(x => x.catId === s.catId && x.id !== s.id).slice(0,4);
  const images = s.images?.length ? s.images : [];
  const cover = images[0];

  const phoneClean = (s.phone||'').replace(/\D/g,'');
  const waClean = (s.whatsapp||s.phone||'').replace(/\D/g,'');
  let waNumDetail = '';
  if (cat?.section === 'bookings') {
    waNumDetail = AppData.platformSettings?.whatsappNumberBookings || AppData.platformSettings?.whatsappNumber || '';
  } else if (cat?.section === 'services' || cat?.section === 'professions') {
    waNumDetail = AppData.platformSettings?.whatsappNumberServices || AppData.platformSettings?.whatsappNumber || '';
  } else {
    waNumDetail = AppData.platformSettings?.whatsappNumber || '';
  }
  waNumDetail = waNumDetail.replace(/\D/g,'');
  const waUrlDetail = waNumDetail
    ? `https://wa.me/${waNumDetail}?text=${encodeURIComponent('أهلاً، أريد الاستفسار عن الخدمة: ' + s.name)}`
    : '';
  const mapsLink = (s.lat && s.lng) ? `https://www.google.com/maps?q=${s.lat},${s.lng}` : null;

  const isProf = cat?.section === 'professions' || cat?.section === 'services';
  const hasTiers = s.tiers && s.tiers.length > 0;
  const minPrice = hasTiers ? Math.min(...s.tiers.map(t => t.price || 0)) : null;
  const priceDisp = hasTiers
    ? `يبدأ من ${minPrice.toLocaleString('ar-YE')} ريال`
    : (s.price ? s.price.toLocaleString('ar-YE') + ' ريال' : (isProf ? 'السعر بعد المعاينة' : 'السعر عند التواصل'));

  // ── نظام التنبيهات (ph48) ─────────────────────────────────────
  const alertBadgeHtml = typeof ph48_badgeHtml   === 'function' ? ph48_badgeHtml(s)   : '';
  const stockChipHtml  = typeof ph48_stockChipHtml === 'function' ? ph48_stockChipHtml(s) : '';
  const unavailHtml    = typeof ph48_unavailOverlayHtml === 'function' ? ph48_unavailOverlayHtml(s) : '';
  const isAvail        = typeof ph48_isAvailable === 'function' ? ph48_isAvailable(s) : true;

  return `<div id="app-content">
    <div class="page-header">
      <button class="back-btn" onclick="history.length>1?history.back():navigate('home')">→ ${t('back')||'رجوع'}</button>
      <h1>${escHtml(s.name)}</h1>
      <p style="color:var(--text-secondary)">${cat?.icon||''} ${escHtml(cat?.name||'')}${region?` · 📍 ${escHtml(region.name)}`:''}</p>
    </div>
    <div class="svc-detail">
      <div class="svc-gallery" style="position:relative">
        ${alertBadgeHtml}
        ${cover ? `<img class="gal-main" id="gal-main" src="${cover}" alt="${escAttr(s.name)}">` : `<div class="gal-main-placeholder">${s.icon||'🔷'}</div>`}
        ${unavailHtml}
        ${images.length > 1 ? `<div class="gal-thumbs">${images.map((b,i)=>`<img src="${b}" class="${i===0?'on':''}" onclick="document.getElementById('gal-main').src=this.src;document.querySelectorAll('.gal-thumbs img').forEach(x=>x.classList.remove('on'));this.classList.add('on')">`).join('')}</div>` : ''}
        ${s.videoUrl ? `
        <div class="svc-video-section" style="margin-top:12px">
          <div style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:8px;display:flex;align-items:center;gap:6px">
            🎬 <span>فيديو الخدمة</span>
          </div>
          ${typeof window.mUpload_renderVideoPlayer === 'function'
            ? window.mUpload_renderVideoPlayer(s.videoUrl, images[0]||'', false)
            : `<video src="${s.videoUrl}" controls playsinline preload="metadata"
                style="width:100%;border-radius:12px;background:#000;max-height:320px;display:block"
                poster="${images[0]||''}"></video>`
          }
        </div>` : ''}
      </div>

      <div class="svc-info">
        <div class="svc-quick">
          ${open === true ? `<span class="svc-badge open" style="position:static">🟢 ${t('currently_open')}</span>` : ''}
          ${open === false ? `<span class="svc-badge closed" style="position:static">⚪ ${t('currently_closed')}</span>` : ''}
          ${avg ? `<span class="svc-badge" style="position:static;background:rgba(245,158,11,0.18);color:#fbbf24">⭐ ${avg} (${rating.length})</span>` : ''}
          ${stockChipHtml}
        </div>
        <div class="svc-price-big">${priceDisp}</div>
        ${s.depositPercent && s.price && !hasTiers ? `
        <div style="margin-top:8px;padding:10px;background:linear-gradient(135deg,#10b98120,#05966920);border-radius:8px;border:1px solid #10b981;font-size:13px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:#10b981">💰 العربون (${s.depositPercent}%):</span>
            <span style="font-weight:700;color:#10b981">${Math.round(s.price * s.depositPercent / 100)} ريال</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:12px">
            <span style="color:var(--text-muted)">المتبقي عند الوصول:</span>
            <span style="color:var(--text-muted)">${s.price - Math.round(s.price * s.depositPercent / 100)} ريال</span>
          </div>
        </div>` : ''}
        <!-- Provider hidden -->

        ${s.desc ? `<div class="svc-section"><h3>${t('description')}</h3><p>${escHtml(s.desc)}</p></div>` : ''}

        ${hasTiers ? `
        <div class="svc-section">
          <h3>🏷️ فئات الخدمة والأسعار</h3>
          <div class="ph40-tier-cards-grid" style="margin-top:12px">
            ${s.tiers.map((t, idx) => `
              <div class="ph40-tier-card-v2" style="cursor:default">
                <div class="ph40-tcv2-icon">${t.icon || '🏷️'}</div>
                <div class="ph40-tcv2-name">${escHtml(t.name)}</div>
                ${t.desc ? `<div class="ph40-tcv2-desc">${escHtml(t.desc)}</div>` : ''}
                <div class="ph40-tcv2-price-row">
                  <span class="ph40-tcv2-price">${(t.price || 0).toLocaleString('ar-YE')}</span>
                  <span class="ph40-tcv2-cur">ريال</span>
                </div>
                ${t.features && t.features.length ? `
                  <div class="ph40-tcv2-features">
                    ${t.features.slice(0,3).map(f => `<span class="ph40-tcv2-feat">✓ ${escHtml(f)}</span>`).join('')}
                    ${t.features.length > 3 ? `<span class="ph40-tcv2-feat ph40-tcv2-feat-more">+${t.features.length - 3}</span>` : ''}
                  </div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>` : ''}

        <div class="svc-section">
          <h3>📞 التواصل</h3>
          <div class="svc-contact-row">
            ${phoneClean ? `<a class="btn btn-primary btn-sm" href="tel:${phoneClean}">${t('call')}</a>` : ''}
            ${waClean ? `<a class="btn btn-sm" style="background:#25d366;color:#fff;display:inline-flex;align-items:center;padding:6px 10px;" href="https://wa.me/${waClean}" target="_blank" title="${t('whatsapp')}"><svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>` : `
              ${waUrlDetail ? `<a class="btn btn-sm" style="background:#25d366;color:#fff;display:inline-flex;align-items:center;padding:6px 10px;" href="${waUrlDetail}" target="_blank" title="استفسار عبر واتساب"><svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>` : ''}
            `}
            ${mapsLink ? `<a class="btn btn-secondary btn-sm" href="${mapsLink}" target="_blank">${t('directions')}</a>` : ''}
          </div>
          ${s.address ? `<div style="margin-top:8px;color:var(--text-secondary)">📍 ${escHtml(s.address)}</div>` : ''}
        </div>

        ${s.openingHours?.open ? `<div class="svc-section">
          <h3>${t('opening_hours')}</h3>
          <div style="color:var(--text-secondary)">${s.openingHours.open} – ${s.openingHours.close}</div>
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${(s.openingHours.days||[]).map(k=>`<span class="day-chip on">${t(dayName(k))}</span>`).join('')}</div>
        </div>` : ''}

        ${u?.role==='customer' ? `<button class="btn btn-primary btn-block btn-lg${isAvail ? '' : ' ia-btn-disabled'}" data-svc-cart-id="${s.id}" style="margin-top:16px" onclick="${isAvail ? (hasTiers ? `bookService('${s.id}')` : `typeof svc_addToCart==='function'?svc_addToCart('${s.id}'):bookService('${s.id}')`) : `typeof toast==='function'&&toast('هذه الخدمة غير متاحة حالياً','warning')`}">${isAvail ? '🛒 أضف للسلة' : '🚫 غير متاح'}</button>` :
          u?.role==='guest' ? `<button class="btn btn-secondary btn-block" style="margin-top:16px" onclick="navigate('login')">سجّل لإتمام الحجز</button>` : ''}
      </div>
    </div>

    ${rating.length ? `<div class="svc-section" style="margin-top:24px">
      <h3>${t('reviews')} (${rating.length})</h3>
      <div class="reviews-list">
        ${rating.slice(0,8).map(r=>`<div class="review-card">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong>${escHtml(r.customerName||'مستخدم')}</strong>
            <span style="color:#fbbf24">${'⭐'.repeat(r.vendorStars||0)}</span>
          </div>
          ${r.vendorComment?`<p style="margin-top:8px;color:var(--text-secondary)">${escHtml(r.vendorComment)}</p>`:''}
        </div>`).join('')}
      </div>
    </div>` : ''}

    ${related.length ? `<div class="svc-section" style="margin-top:24px">
      <h3>${t('related_services')}</h3>
      <div class="service-grid">${related.map(renderServiceCard).join('')}</div>
    </div>` : ''}
  </div>`;
}

// ─── Home (override) — adds search, nearby, open-now ──
const __originalRenderHome = typeof renderHome === 'function' ? renderHome : null;
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

  const allSvcs = AppData.services || [];
  const featured = allSvcs.slice(0, 6);
  const openNow = allSvcs.filter(s => isServiceOpenNow(s) === true).slice(0, 6);
  const userC = (() => { try { return JSON.parse(sessionStorage.getItem('user_coords')||'null'); } catch(e){ return null; } })();
  let nearby = [];
  if (userC) {
    nearby = allSvcs
      .filter(s => s.lat && s.lng)
      .map(s => ({ s, d: _haversine(userC.lat, userC.lng, s.lat, s.lng) }))
      .sort((a,b) => a.d - b.d).slice(0,6).map(x => x.s);
  }

  // Blend native ads inside featured services list
  const serviceCards = featured.map(renderServiceCard);
  nativeAds.forEach((ad, index) => {
    const position = (index * 3) + 1; // Interleave native ads at index 1, 4, etc.
    if (position <= serviceCards.length) {
      serviceCards.splice(position, 0, renderNativeAdCard(ad));
    } else {
      serviceCards.push(renderNativeAdCard(ad));
    }
  });

  return `<div id="app-content">
    ${typeof renderBanners === 'function' ? renderBanners('home_top') : ''}
    <div class="search-hero">
      <input class="form-control search-input-big" id="global-search" placeholder="${t('search_placeholder')}" oninput="globalSearch()">
      <div id="search-results" class="search-results-pop"></div>
    </div>

    ${sliderAds.length ? renderAdsSlider(sliderAds) : ''}

    <div class="section-hub">
      <div class="section-title">🏠 الرئيسية</div>
      <div class="hub-grid">
        ${[
          { id: 'bookings', title: 'الحجوزات', icon: '📅', desc: 'فنادق - سيارات - رحلات - أطباء - أعراس - وأكثر', badge: `${AppData.cats.filter(c=>c.section==='bookings').length} تصنيف`, color: 'purple', order: AppData.settings?.hubOrder?.bookings || 1 },
          { id: 'services', title: 'الخدمات المهنية', icon: '🔧', desc: 'كهربائي - سباك - نجار - مصور - محامي - وأكثر', badge: `${AppData.cats.filter(c=>c.section==='services' || c.section==='professions').length} تصنيف`, color: 'teal', order: AppData.settings?.hubOrder?.services || 2 },
          { id: 'stores', title: 'متاجر محجوز', icon: '🏪', desc: 'متاجر - صيدليات - منتجات مع التوصيل', badge: `${(AppData.stores||[]).filter(s=>s.active!==false && (!u?.regionId || !s.regionId || s.regionId === u.regionId)).length} متجر`, color: 'gold', order: AppData.settings?.hubOrder?.stores || 3 }
        ].sort((a,b) => a.order - b.order).map(card => `
          <div class="hub-card" onclick="navigate('listing',{section:'${card.id}'})">
            <span class="hub-icon">${card.icon}</span><div class="hub-title">${card.title}</div>
            <div class="hub-desc">${card.desc}</div>
            <span class="badge badge-${card.color}">${card.badge}</span>
          </div>
        `).join('')}
      </div>
    </div>

    ${bannerAds.length ? renderStaticBanners(bannerAds) : ''}

    ${openNow.length ? `<div class="section-hub" style="padding-top:0">
      <div class="section-title">${t('open_now')}</div>
      <div class="service-grid">${openNow.map(renderServiceCard).join('')}</div>
    </div>` : ''}

    ${serviceCards.length ? `
    <div class="section-hub" style="padding-top:0">
      <div class="section-title">⭐ أبرز الخدمات</div>
      <div class="service-grid">${serviceCards.join('')}</div>
    </div>` : ''}
  </div>`;
}

// ─── Smart global search ───────────────────────────────
function globalSearch() {
  const q = (document.getElementById('global-search').value || '').toLowerCase().trim();
  const out = document.getElementById('search-results');
  if (!q) { out.innerHTML = ''; out.classList.remove('show'); return; }
  const score = (s) => {
    const txt = `${s.name} ${s.provider||''} ${s.desc||''}`.toLowerCase();
    if (txt.startsWith(q)) return 3;
    if (txt.includes(' '+q)) return 2;
    if (txt.includes(q)) return 1;
    return 0;
  };
  const svcResults = (AppData.services||[]).map(s => ({ s, sc: score(s) }))
    .filter(x => x.sc > 0).sort((a,b)=>b.sc-a.sc).slice(0,6).map(x => x.s);
  const catResults = (AppData.cats||[]).filter(c => c.name.toLowerCase().includes(q) || (c.description||'').toLowerCase().includes(q)).slice(0,4);
  const prodResults = (AppData.storeProducts||[]).map(p => ({ p, sc: score(p) }))
    .filter(x => x.sc > 0).sort((a,b)=>b.sc-a.sc).slice(0,6).map(x => x.p);
  const storeResults = (AppData.stores||[]).map(st => ({ st, sc: score(st) }))
    .filter(x => x.sc > 0).sort((a,b)=>b.sc-a.sc).slice(0,4).map(x => x.st);

  if (!svcResults.length && !catResults.length && !prodResults.length && !storeResults.length) {
    out.innerHTML = `<div class="search-empty">${t('no_results')}</div>`;
    out.classList.add('show'); return;
  }
  out.innerHTML = `
    ${catResults.length ? `<div class="search-section-h">📂 تصنيفات</div>${catResults.map(c=>`
      <div class="search-row" onclick="navigate('listing',{section:'${c.section}',catId:'${c.id}'})">
        <span style="font-size:20px">${c.icon||'📂'}</span>
        <div style="flex:1">
          <div style="font-weight:600">${escHtml(c.name)}</div>
          ${c.description ? `<div style="font-size:12px;color:var(--text-muted)">${escHtml(c.description)}</div>` : ''}
        </div>
      </div>`).join('')}` : ''}
    ${storeResults.length ? `<div class="search-section-h">🏪 المتاجر والصيدليات</div>${storeResults.map(st=>`
      <div class="search-row" onclick="navigate('store',{id:'${st.id}'})">
        ${st.imageBase64 ? `<img src="${st.imageBase64}" style="width:36px;height:36px;border-radius:6px;object-fit:cover">` : `<span style="font-size:20px">🏪</span>`}
        <div style="flex:1">
          <div style="font-weight:600">${escHtml(st.name)}</div>
          ${st.desc ? `<div style="font-size:12px;color:var(--text-muted)">${escHtml(st.desc)}</div>` : ''}
        </div>
      </div>`).join('')}` : ''}
    ${svcResults.length ? `<div class="search-section-h">🛎️ خدمات وحجوزات</div>${svcResults.map(s=>`
      <div class="search-row" onclick="navigate('service',{id:'${s.id}'})">
        ${s.images?.[0] ? `<img src="${s.images[0]}" style="width:36px;height:36px;border-radius:6px;object-fit:cover">` : `<span style="font-size:20px">${s.icon||'🔷'}</span>`}
        <div style="flex:1">
          <div style="font-weight:600">${escHtml(s.name)}</div>
          <div style="font-size:12px;color:var(--text-muted)">${s.price?' · '+s.price+' ريال':''}</div>
        </div>
      </div>`).join('')}` : ''}
    ${prodResults.length ? `<div class="search-section-h">📦 منتجات متاجر</div>${prodResults.map(p=>`
      <div class="search-row" onclick="navigate('store',{id:'${p.storeId}'})">
        ${p.imageBase64 ? `<img src="${p.imageBase64}" style="width:36px;height:36px;border-radius:6px;object-fit:cover">` : `<span style="font-size:20px">📦</span>`}
        <div style="flex:1">
          <div style="font-weight:600">${escHtml(p.name)}</div>
          <div style="font-size:12px;color:var(--text-muted)">${escHtml(AppData.stores?.find(st=>st.id===p.storeId)?.name||'')}${p.price?' · '+p.price+' ريال':''}</div>
        </div>
      </div>`).join('')}` : ''}`;
  out.classList.add('show');
}
document.addEventListener('click', e => {
  const out = document.getElementById('search-results');
  if (!out) return;
  if (!e.target.closest('.search-hero')) out.classList.remove('show');
});

// ─── Sidebar Filter & Listing Layout ────────────────────
window.renderSectionSidebar = function() {
  const f = State.activeSidebarFilter || 'all';
  return `
    <aside class="sec-sidebar">
      <button class="sec-sidebar-btn ${f==='all'?'active':''}" onclick="setSidebarFilter('all')">الكل</button>
      <button class="sec-sidebar-btn ${f==='nearby'?'active':''}" onclick="setSidebarFilter('nearby')">القريبة</button>
      <button class="sec-sidebar-btn ${f==='new'?'active':''}" onclick="setSidebarFilter('new')">الجديدة</button>
      <button class="sec-sidebar-btn ${f==='favorites'?'active':''}" onclick="setSidebarFilter('favorites')">المفضلة</button>
    </aside>
  `;
};

window.setSidebarFilter = async function(f) {
  if (f === 'nearby') {
    const c = await getUserCoords({ask:true});
    if (!c) { toast('تأكد من السماح بالوصول للموقع للبحث عن الأقرب لك', 'error'); return; }
  }
  State.activeSidebarFilter = f;
  if (f !== 'all') {
    delete State.params.catId;
  }
  render();
};

(function() {
  if (document.getElementById('sec-layout-styles')) return;
  const style = document.createElement('style');
  style.id = 'sec-layout-styles';
  style.textContent = `
    .sec-layout { display: flex; flex-direction: column; gap: 16px; margin-top: 12px; }
    .sec-sidebar { width: 100%; display: flex; flex-direction: row; gap: 10px; background: transparent; border: none; padding: 0 4px 8px 4px; overflow-x: auto; scrollbar-width: none; }
    .sec-sidebar::-webkit-scrollbar { display: none; }
    .sec-sidebar-btn { padding: 8px 22px; border: 1px solid var(--glass-border); background: var(--bg-card); border-radius: 99px; cursor: pointer; color: var(--text-main); font-family: inherit; font-weight: 600; font-size: 15px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); white-space: nowrap; user-select: none; }
    .sec-sidebar-btn:hover { border-color: var(--primary); background: rgba(139,92,246,0.05); color: var(--primary); }
    .sec-sidebar-btn.active { background: linear-gradient(135deg, var(--primary), #6d28d9); color: #fff; box-shadow: 0 4px 12px rgba(124,58,237,0.3); border-color: transparent; font-weight: 700; }
    .sec-main { width: 100%; }
    
    /* Floating Share Button at the top of Card */
    .card-share-btn {
      position: absolute;
      top: 12px;
      inset-inline-end: 54px; /* positioned next to the heart button (12px + 36px + 6px) */
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s, background-color 0.2s, color 0.2s;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      background: rgba(255,255,255,0.12);
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      color: var(--text-muted);
    }
    .card-share-btn:hover {
      transform: scale(1.15);
      box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
      background: rgba(255, 255, 255, 0.22);
      color: var(--primary);
    }
    .card-share-btn svg {
      width: 17px;
      height: 17px;
      transition: transform 0.2s;
    }
    .card-share-btn:hover svg {
      transform: scale(1.05);
    }
    
    @media (max-width: 768px) {
      .sec-sidebar-btn { padding: 8px 20px; font-size: 13px; }
    }
  `;
  document.head.appendChild(style);
})();

let _listingFilter = { openOnly: false };
let _listingView = 'grid'; // 'grid' | 'list'

// Toggle view globally
window.setListingView = function(v) {
  _listingView = v;
  const grid = document.getElementById('svc-grid');
  if (grid) {
    grid.classList.toggle('list-view', v === 'list');
  }
  document.querySelectorAll('.view-toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === v);
  });
};

function renderListing() {
  const { section, catId } = State.params;
  const filter = State.activeSidebarFilter || 'all';

  if (section === 'stores' && !catId) {
    if (typeof ph43_renderStoresList === 'function') return ph43_renderStoresList();
  }

  const sLabels = { bookings:'📅 الحجوزات', services:'🔧 الخدمات المهنية', stores:'🏪 المتاجر' };
  
  if (!catId && filter === 'all') {
    const cats = AppData.cats
      .filter(c => c.section === section || (section === 'services' && c.section === 'professions') || (section === 'professions' && c.section === 'services'))
      .sort((a,b) => (a.order || 0) - (b.order || 0));
    return `<div id="app-content">
      <div class="page-header">
        <button class="back-btn" onclick="navigate('home')">→ رجوع</button>
        <h1>${sLabels[section]||'الخدمات'}</h1>
      </div>
      <div class="sec-layout">
        ${renderSectionSidebar()}
        <main class="sec-main">
          ${cats.length ? `<div class="cat-grid">${cats.map(c=>`
            <div class="cat-card" onclick="State.activeSidebarFilter='all';navigate('listing',{section:'${section}',catId:'${c.id}'})">
              <span class="cat-icon">${c.icon||'📌'}</span>
              <div class="cat-name">${escHtml(c.name)}</div>
              ${c.description?`<div class="cat-desc">${escHtml(c.description)}</div>`:''}
              <div class="cat-count">${AppData.services.filter(s=>s.catId===c.id).length} خدمة</div>
            </div>`).join('')}</div>` :
          `<div class="empty-state"><div class="empty-icon">📂</div><div class="empty-title">لا توجد تصنيفات بعد</div></div>`}
        </main>
      </div>
    </div>`;
  }

  // Flat list for filters or specific category
  let allSvcs = [];
  let headerTitle = '';
  let headerSub = '';
  let backAction = `State.activeSidebarFilter='all';render()`;

  if (catId) {
    const cat = AppData.cats.find(c=>c.id===catId);
    if (cat?.catType === 'rental' && typeof window.ph_rentalRenderCatPage === 'function') {
      return window.ph_rentalRenderCatPage(catId);
    }
    allSvcs = AppData.services.filter(s=>s.catId===catId).sort((a,b) => (a.order || 0) - (b.order || 0));
    headerTitle = `${cat?.icon||''} ${escHtml(cat?.name||'الخدمات')}`;
    headerSub = cat?.description ? `<p style="color:var(--text-secondary);margin-top:6px;line-height:1.7">${escHtml(cat.description)}</p>` : '';
    backAction = `navigate('listing',{section:'${section}'})`;
  } else {
    allSvcs = AppData.services.filter(s => {
      const c = AppData.cats.find(cat => cat.id === s.catId);
      return c && (c.section === section || (section === 'services' && c.section === 'professions') || (section === 'professions' && c.section === 'services'));
    });
    headerTitle = sLabels[section];
    
    if (filter === 'nearby') {
      const userC = (() => { try { return JSON.parse(sessionStorage.getItem('user_coords')||'null'); } catch(e){ return null; } })();
      if (userC) {
        allSvcs = allSvcs.filter(s => s.lat && s.lng)
          .map(s => ({ s, d: _haversine(userC.lat, userC.lng, s.lat, s.lng) }))
          .sort((a,b) => a.d - b.d).map(x => x.s);
      } else {
        allSvcs = [];
      }
    } else if (filter === 'new') {
      allSvcs = allSvcs.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
    } else if (filter === 'favorites') {
      const favs = typeof ph18_getFavorites === 'function' ? ph18_getFavorites() : [];
      allSvcs = allSvcs.filter(s => favs.includes(s.id));
    }
  }

  if (_listingFilter.openOnly) allSvcs = allSvcs.filter(s => isServiceOpenNow(s) === true);

  return `<div id="app-content">
    <div class="page-header" style="position:relative">
      <button class="back-btn" onclick="${backAction}">→ رجوع</button>
      ${catId ? `
        <button class="btn-share" onclick="event.stopPropagation();ph34_shareItem('category', '${catId}', { section: '${section}' })" title="مشاركة التصنيف" style="position:absolute; left:20px; top:20px; padding:6px 12px; font-size:12px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; margin-inline-end: 4px;"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          <span>مشاركة</span>
        </button>
      ` : ''}
      <h1>${headerTitle}</h1>
      ${headerSub}
      <p style="color:var(--text-muted);margin-top:4px">${allSvcs.length} خدمة متاحة</p>
    </div>
    <div class="sec-layout">
      ${renderSectionSidebar()}
      <main class="sec-main">
        <div class="listing-toolbar" style="display: none;">
          <div class="search-box" style="flex:1">
            <input class="search-input" id="svc-search" oninput="filterServices()" placeholder="${t('search_placeholder')}">
            <span class="search-icon">🔍</span>
          </div>
          <label class="day-chip${_listingFilter.openOnly?' on':''}" onclick="_listingFilter.openOnly=!_listingFilter.openOnly;render()">${t('only_open_now')}</label>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <label class="day-chip${_listingFilter.openOnly?' on':''}" onclick="_listingFilter.openOnly=!_listingFilter.openOnly;render()">${t('only_open_now')}</label>
          <div class="view-toggle-bar">
            <span style="font-size:13px;color:var(--text-muted)">طريقة العرض:</span>
            <button class="view-toggle-btn ${_listingView==='grid'?'active':''}" data-view="grid" onclick="setListingView('grid')" title="عرض شبكة">&#9783;</button>
            <button class="view-toggle-btn ${_listingView==='list'?'active':''}" data-view="list" onclick="setListingView('list')" title="عرض قائمة">&#9776;</button>
          </div>
        </div>
        <div class="service-grid${_listingView==='list'?' list-view':''}" id="svc-grid">
          ${allSvcs.length ? allSvcs.map(renderServiceCard).join('') : '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">لا توجد خدمات متاحة</div></div>'}
        </div>
      </main>
    </div>
  </div>`;
}

window.ExtraPages = Object.assign(window.ExtraPages || {}, {
  service: renderServiceDetail,
});

// ══════════════════════════════════════════════════════════════════
//  محجوز — نظام أسعار التوصيل الذكي
//  delivery-pricing.js
//  الترتيب: أنواع المركبات → المناطق → العناوين الفرعية → المسارات
// ══════════════════════════════════════════════════════════════════

// ─── Cache للبيانات ───────────────────────────────────────────────
window.AppData.deliveryVehicleTypes = window.AppData.deliveryVehicleTypes || [];
window.AppData.deliveryGovernorates = window.AppData.deliveryGovernorates || [];
window.AppData.deliveryZones        = window.AppData.deliveryZones        || [];
window.AppData.deliverySubzones     = window.AppData.deliverySubzones     || [];
window.AppData.deliveryRoutes       = window.AppData.deliveryRoutes       || [];

// ══════════════════════════════════════════════════════════════════
//  أنواع المركبات — CRUD
// ══════════════════════════════════════════════════════════════════
window.dp_loadVehicleTypes = async function() {
  try {
    const snap = await Promise.race([
      db.collection('delivery_vehicle_types').get(),
      new Promise(r => setTimeout(() => r({ docs: [] }), 5000)),
    ]);
    AppData.deliveryVehicleTypes = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 99) - (b.order || 99));
    return AppData.deliveryVehicleTypes;
  } catch(e) {
    console.warn('[DeliveryPricing] فشل تحميل أنواع المركبات:', e);
    return [];
  }
};

window.dp_saveVehicleType = async function(data, id = null) {
  try {
    const count = (AppData.deliveryVehicleTypes || []).length;
    const payload = {
      name:   data.name?.trim(),
      icon:   data.icon?.trim()  || '🚗',
      color:  data.color         || '#3b82f6',
      active: data.active !== false,
      order:  Number(data.order) || (count + 1),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (id) {
      await db.collection('delivery_vehicle_types').doc(id).update(payload);
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('delivery_vehicle_types').add(payload);
    }
    await dp_loadVehicleTypes();
    return true;
  } catch(e) {
    console.error('[DeliveryPricing] فشل حفظ نوع المركبة:', e);
    return false;
  }
};

window.dp_deleteVehicleType = async function(id) {
  try {
    const routeSnap = await db.collection('delivery_routes').where('vehicleTypeId','==',id).get();
    await Promise.all(routeSnap.docs.map(d => d.ref.delete()));
    await db.collection('delivery_vehicle_types').doc(id).delete();
    await dp_loadVehicleTypes();
    return true;
  } catch(e) { return false; }
};

// ══════════════════════════════════════════════════════════════════
//  المحافظات — CRUD
// ══════════════════════════════════════════════════════════════════
window.dp_loadGovernorates = async function() {
  try {
    const snap = await Promise.race([
      db.collection('delivery_governorates').get(),
      new Promise(r => setTimeout(() => r({ docs: [] }), 5000)),
    ]);
    AppData.deliveryGovernorates = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
    return AppData.deliveryGovernorates;
  } catch(e) {
    console.warn('[DeliveryPricing] فشل تحميل المحافظات:', e);
    return [];
  }
};

window.dp_saveGovernorate = async function(data, id = null) {
  try {
    const payload = {
      name:   data.name?.trim(),
      active: data.active !== false,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    let resultId = id;
    if (id) {
      await db.collection('delivery_governorates').doc(id).update(payload);
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      const docRef = await db.collection('delivery_governorates').add(payload);
      resultId = docRef.id;
    }
    await dp_loadGovernorates();
    return resultId || true;
  } catch(e) {
    console.error('[DeliveryPricing] فشل حفظ المحافظة:', e);
    return false;
  }
};

window.dp_deleteGovernorate = async function(id) {
  try {
    const zonesSnap = await db.collection('delivery_zones').where('govId','==',id).get();
    await Promise.all(zonesSnap.docs.map(d => d.ref.update({ govId: null })));
    await db.collection('delivery_governorates').doc(id).delete();
    await dp_loadAll();
    return true;
  } catch(e) { return false; }
};

// ══════════════════════════════════════════════════════════════════
//  المناطق الرئيسية — CRUD
// ══════════════════════════════════════════════════════════════════
window.dp_loadZones = async function() {
  try {
    const snap = await Promise.race([
      db.collection('delivery_zones').get(),
      new Promise(r => setTimeout(() => r({ docs: [] }), 5000)),
    ]);
    AppData.deliveryZones = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
    return AppData.deliveryZones;
  } catch(e) {
    console.warn('[DeliveryPricing] فشل تحميل المناطق:', e);
    return [];
  }
};

window.dp_saveZone = async function(data, id = null) {
  try {
    const payload = {
      name:   data.name?.trim(),
      govId:  data.govId || null,
      active: data.active !== false,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (id) {
      await db.collection('delivery_zones').doc(id).update(payload);
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('delivery_zones').add(payload);
    }
    await dp_loadZones();
    return true;
  } catch(e) {
    console.error('[DeliveryPricing] فشل حفظ المنطقة:', e);
    return false;
  }
};

window.dp_deleteZone = async function(id) {
  try {
    const [routeSnap, subSnap] = await Promise.all([
      db.collection('delivery_routes').where('zoneId','==',id).get(),
      db.collection('delivery_subzones').where('zoneId','==',id).get(),
    ]);
    await Promise.all([
      ...routeSnap.docs.map(d => d.ref.delete()),
      ...subSnap.docs.map(d => d.ref.delete()),
    ]);
    await db.collection('delivery_zones').doc(id).delete();
    await dp_loadAll();
    return true;
  } catch(e) { return false; }
};

// ══════════════════════════════════════════════════════════════════
//  العناوين الفرعية — CRUD (قاعدة بيانات العناوين المشتركة)
// ══════════════════════════════════════════════════════════════════
window.dp_loadSubzones = async function(zoneId = null) {
  try {
    let query = db.collection('delivery_subzones');
    if (zoneId) query = query.where('zoneId','==',zoneId);
    const snap = await Promise.race([
      query.get(),
      new Promise(r => setTimeout(() => r({ docs: [] }), 5000)),
    ]);
    const subzones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!zoneId) AppData.deliverySubzones = subzones;
    return subzones;
  } catch(e) {
    console.warn('[DeliveryPricing] فشل تحميل العناوين الفرعية:', e);
    return [];
  }
};

window.dp_saveSubzone = async function(data, id = null) {
  try {
    const payload = {
      zoneId: data.zoneId,
      name:   data.name?.trim(),
      active: data.active !== false,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (id) {
      await db.collection('delivery_subzones').doc(id).update(payload);
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('delivery_subzones').add(payload);
    }
    await dp_loadSubzones();
    return true;
  } catch(e) {
    console.error('[DeliveryPricing] فشل حفظ العنوان الفرعي:', e);
    return false;
  }
};

window.dp_deleteSubzone = async function(id) {
  try {
    await db.collection('delivery_subzones').doc(id).delete();
    await dp_loadSubzones();
    return true;
  } catch(e) { return false; }
};

// ══════════════════════════════════════════════════════════════════
//  المسارات والأسعار — CRUD
// ══════════════════════════════════════════════════════════════════
window.dp_loadRoutes = async function(zoneId = null) {
  try {
    let query = db.collection('delivery_routes').where('active','==',true);
    if (zoneId) query = query.where('zoneId','==',zoneId);
    const snap = await Promise.race([
      query.get(),
      new Promise(r => setTimeout(() => r({ docs: [] }), 5000)),
    ]);
    const routes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!zoneId) AppData.deliveryRoutes = routes;
    return routes;
  } catch(e) {
    console.warn('[DeliveryPricing] فشل تحميل المسارات:', e);
    return [];
  }
};

window.dp_saveRoute = async function(data, id = null) {
  try {
    const payload = {
      vehicleTypeId: data.vehicleTypeId,
      zoneId:        data.zoneId,
      fromArea:      data.fromArea?.trim(),
      toArea:        data.toArea?.trim(),
      price:         Number(data.price) || 0,
      active:        data.active !== false,
      updatedAt:     firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (id) {
      await db.collection('delivery_routes').doc(id).update(payload);
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('delivery_routes').add(payload);
    }
    await dp_loadRoutes();
    return true;
  } catch(e) {
    console.error('[DeliveryPricing] فشل حفظ المسار:', e);
    return false;
  }
};

window.dp_deleteRoute = async function(id) {
  try {
    await db.collection('delivery_routes').doc(id).delete();
    await dp_loadRoutes();
    return true;
  } catch(e) { return false; }
};

// ══════════════════════════════════════════════════════════════════
//  تحميل الكل دفعة واحدة
// ══════════════════════════════════════════════════════════════════
window.dp_loadAll = async function() {
  await Promise.all([
    dp_loadVehicleTypes(),
    dp_loadGovernorates(),
    dp_loadZones(),
    dp_loadSubzones(),
    dp_loadRoutes(),
  ]);
};

// ══════════════════════════════════════════════════════════════════
//  حساب سعر التوصيل
// ══════════════════════════════════════════════════════════════════
window.dp_calculateFee = function(fromArea, toArea, vehicleTypeId = null) {
  if (!fromArea || !toArea) return { fee: 0, found: false, routeId: null };
  const normalize = s => (s || '').trim().toLowerCase().replace(/\s+/g,' ');
  const from = normalize(fromArea);
  const to   = normalize(toArea);
  const routes = AppData.deliveryRoutes || [];
  const route = routes.find(r => {
    if (vehicleTypeId && r.vehicleTypeId !== vehicleTypeId) return false;
    const rFrom = normalize(r.fromArea);
    const rTo   = normalize(r.toArea);
    return (rFrom === from && rTo === to) || (rFrom === to && rTo === from);
  });
  if (route) {
    return {
      fee: Number(route.price) || 0,
      found: true,
      routeId: route.id,
      zoneName: (AppData.deliveryZones || []).find(z => z.id === route.zoneId)?.name || '',
    };
  }
  dp_notifyMissingRoute(fromArea, toArea);
  return { fee: 0, found: false, routeId: null };
};

// ─── إشعار المدير بمسار مفقود ────────────────────────────────────
let _missingRouteCache = new Set();
window.dp_notifyMissingRoute = async function(fromArea, toArea) {
  const key = `${fromArea}→${toArea}`;
  if (_missingRouteCache.has(key)) return;
  _missingRouteCache.add(key);
  try {
    await db.collection('delivery_missing_routes').add({
      fromArea, toArea,
      reportedAt: firebase.firestore.FieldValue.serverTimestamp(),
      resolved: false,
    });
  } catch(e) {}
};

window.dp_loadMissingRoutes = async function() {
  try {
    const snap = await db.collection('delivery_missing_routes')
      .where('resolved','==',false)
      .orderBy('reportedAt','desc')
      .limit(20)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { return []; }
};

window.dp_resolveMissingRoute = async function(missingId) {
  try {
    await db.collection('delivery_missing_routes').doc(missingId).update({ resolved: true });
  } catch(e) {}
};

// ─── تحميل تلقائي عند بدء التطبيق ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => { dp_loadAll().catch(() => {}); });
if (typeof window.AppData !== 'undefined') { dp_loadAll().catch(() => {}); }

// ═══════════════════════════════════════════════════════════════════
//  محجوز v2.1 — Notifications System
//  نظام الإشعارات الفورية مع Firebase Cloud Messaging
// ═══════════════════════════════════════════════════════════════════
'use strict';

// ─── Notification Manager ─────────────────────────────────────────
class NotificationManager {
  constructor() {
    this.notifications = [];
    this.subscribers = {};
    this.fcmToken = null;
    this.init();
  }

  async init() {
    try {
      // طلب إذن إرسال الإشعارات
      if ('Notification' in window && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('✅ تم السماح بالإشعارات');
        }
      }
    } catch (e) {
      console.log('ℹ️ الإشعارات غير متاحة في هذا المتصفح');
    }
  }

  // ─── إرسال إشعار محلي (في التطبيق)
  showNotification(title, options = {}) {
    const id = Date.now().toString();
    const notification = {
      id,
      title,
      ...options,
      timestamp: new Date(),
    };
    this.notifications.unshift(notification);
    this.emit('notification-added', notification);
    
    // إرسال إشعار المتصفح إذا كان مسموحاً
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '📅',
        badge: '📅',
        ...options,
      });
    }
    
    return id;
  }

  // ─── إشعار قبول الطلب
  notifyOrderAccepted(orderId, orderName) {
    return this.showNotification(`✅ تم قبول طلبك!`, {
      body: `الطلب ${orderId} قد تم قبوله من قبل الخدمة`,
      tag: `order-${orderId}`,
      data: { type: 'order-accepted', orderId },
    });
  }

  // ─── إشعار رفض الطلب
  notifyOrderRejected(orderId, reason = '') {
    return this.showNotification(`❌ تم رفض الطلب`, {
      body: `الطلب ${orderId} تم رفضه${reason ? ': ' + reason : ''}`,
      tag: `order-${orderId}`,
      data: { type: 'order-rejected', orderId },
    });
  }

  // ─── إشعار تحديث حالة التوصيل
  notifyDeliveryStatusChange(status, details = '') {
    const statusMap = {
      'driver-assigned': '🚗 تم تعيين مندوب التوصيل',
      'on-the-way': '🚗 المندوب في الطريق إليك',
      'arrived': '📍 وصل المندوب',
      'delivered': '📦 تم التسليم بنجاح',
    };
    const message = statusMap[status] || `تحديث التوصيل: ${status}`;
    return this.showNotification(message, {
      body: details,
      tag: 'delivery-status',
      data: { type: 'delivery-status', status },
    });
  }

  // ─── إشعار المحفظة
  notifyWallet(type, amount, note = '') {
    const messages = {
      'recharge-approved': `✅ تم الموافقة على شحن ${amount} ريال`,
      'recharge-rejected': `❌ تم رفض طلب الشحن (${amount} ريال)`,
      'withdrawal-approved': `✅ تم الموافقة على السحب ${amount} ريال`,
      'withdrawal-rejected': `❌ تم رفض طلب السحب (${amount} ريال)`,
      'low-balance': `⚠️ رصيدك منخفض! تبقي ${amount} ريال فقط`,
    };
    return this.showNotification(messages[type] || `تحديث المحفظة`, {
      body: note,
      tag: `wallet-${type}`,
      data: { type: 'wallet', walletType: type, amount },
    });
  }

  // ─── إشعار جديد
  notifyNewRating(ratedBy, stars, comment = '') {
    return this.showNotification(`⭐ تقييم جديد من ${ratedBy}`, {
      body: `${stars} نجوم${comment ? ': ' + comment.substring(0, 50) : ''}`,
      tag: 'new-rating',
      data: { type: 'new-rating', ratedBy, stars },
    });
  }

  // ─── إشعار عرض خاص
  notifySpecialOffer(title, discount, expiresIn = '24h') {
    return this.showNotification(`🔥 عرض خاص: ${title}`, {
      body: `خصم ${discount}% - ينتهي في ${expiresIn}`,
      tag: 'special-offer',
      data: { type: 'special-offer', title, discount },
    });
  }

  // ─── إشعار دفع
  notifyPayment(status, amount, orderId = '') {
    const messages = {
      'success': `✅ تم الدفع بنجاح (${amount} ريال)`,
      'pending': `⏳ الدفع قيد المراجعة`,
      'failed': `❌ فشل الدفع (${amount} ريال)`,
    };
    return this.showNotification(messages[status], {
      body: orderId ? `رقم العملية: ${orderId}` : '',
      tag: `payment-${status}`,
      data: { type: 'payment', status, amount },
    });
  }

  // ─── حذف إشعار
  removeNotification(id) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.emit('notification-removed', id);
  }

  // ─── حذف جميع الإشعارات
  clearAll() {
    this.notifications = [];
    this.emit('notifications-cleared');
  }

  // ─── Event Emitter
  subscribe(event, callback) {
    if (!this.subscribers[event]) this.subscribers[event] = [];
    this.subscribers[event].push(callback);
    return () => {
      this.subscribers[event] = this.subscribers[event].filter(cb => cb !== callback);
    };
  }

  emit(event, data) {
    if (this.subscribers[event]) {
      this.subscribers[event].forEach(cb => cb(data));
    }
  }

  // ─── الحصول على الإشعارات
  getAll() {
    return this.notifications;
  }

  getUnread() {
    return this.notifications.filter(n => !n.read);
  }

  markAsRead(id) {
    const notif = this.notifications.find(n => n.id === id);
    if (notif) notif.read = true;
  }
}

// ─── Global Instance ──────────────────────────────────────────────
const notificationManager = new NotificationManager();

// ─── Notification Center UI ───────────────────────────────────────
function renderNotificationCenter() {
  const notifs = notificationManager.getAll().slice(0, 10);
  const unreadCount = notificationManager.getUnread().length;
  
  return `
  <div class="notification-center">
    <div class="notification-header">
      <h3>🔔 الإشعارات</h3>
      ${unreadCount > 0 ? `<span class="notification-badge">${unreadCount}</span>` : ''}
      ${notifs.length > 0 ? `<button class="btn btn-sm btn-secondary" onclick="notificationManager.clearAll()">مسح الكل</button>` : ''}
    </div>
    <div class="notification-list">
      ${notifs.length > 0 ? 
        notifs.map(n => `
        <div class="notification-item ${n.read ? 'read' : 'unread'}" onclick="notificationManager.markAsRead('${n.id}')">
          <div class="notification-content">
            <div class="notification-title">${n.title}</div>
            ${n.body ? `<div class="notification-body">${n.body}</div>` : ''}
            <div class="notification-time">${formatTime(n.timestamp)}</div>
          </div>
          <button class="notification-close" onclick="notificationManager.removeNotification('${n.id}'); event.stopPropagation()">✕</button>
        </div>`).join('')
        : '<div class="empty-state" style="padding:20px;text-align:center;color:var(--text-muted)">لا توجد إشعارات</div>'
      }
    </div>
  </div>`;
}

// ─── Helper Functions ─────────────────────────────────────────────
function formatTime(timestamp) {
  const now = new Date();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'الآن';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return timestamp.toLocaleDateString('ar-YE');
}

// ─── Test Notifications ──────────────────────────────────────────
function sendTestNotifications() {
  setTimeout(() => notificationManager.notifyOrderAccepted('MJZ-2026-123456', 'خدمة التنظيف'), 1000);
  setTimeout(() => notificationManager.notifyDeliveryStatusChange('on-the-way', 'المندوب محمود في الطريق'), 3000);
  setTimeout(() => notificationManager.notifyWallet('low-balance', 25), 5000);
  setTimeout(() => notificationManager.notifySpecialOffer('عرض على خدمات التنظيف', 20), 7000);
  toast('✅ تم إرسال إشعارات تجريبية', 'success');
}

// ─── Firebase Messaging Integration ───────────────────────────────
async function sendFCMNotification(userId, notification) {
  try {
    // إرسال الإشعار عبر Firebase Cloud Functions أو Admin SDK
    // هذه الدالة تُستدعى من الخادم أو من لوحة التحكم
    await db.collection('notifications').add({
      userId,
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      read: false,
      type: notification.type || 'general',
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

// ─── معالج الرسائل الواردة من FCM في المقدمة ──────────────────
window.handleFCMMessage = function(payload) {
  console.log('🔔 FCM Message (Foreground):', payload);
  
  // عرض الإشعار محلياً
  notificationManager.showNotification(payload.title, {
    body: payload.body,
    data: payload.data,
  });
  
  // تشغيل صوت إذا كان الإشعار مهماً
  playNotificationSound();
};

// ─── تشغيل صوت الإشعار ───────────────────────────────────────────
function playNotificationSound() {
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAAA=');
    audio.play().catch(err => console.log('Sound play failed:', err));
  } catch (e) {
    console.log('Audio not available');
  }
}

// ─── حفظ الإشعارات في Firestore ──────────────────────────────────
async function saveNotificationToFirestore(userId, notification) {
  try {
    if (!userId) return;
    
    const docRef = await db.collection('user_notifications').add({
      userId,
      title: notification.title,
      body: notification.body,
      type: notification.type || 'general',
      icon: notification.icon || '📅',
      data: notification.data || {},
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error saving notification:', error);
  }
}

// ─── تحميل الإشعارات من Firestore ────────────────────────────────
async function loadUserNotifications(userId) {
  try {
    if (!userId) return [];
    
    const snapshot = await db.collection('user_notifications')
      .where('userId', '==', userId)
      .limit(50)
      .get();

    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || 0;
        const tb = b.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });
  } catch (error) {
    console.warn('[Notifications] Load error:', error?.code || error?.message || error);
    return [];
  }
}

// ─── الاستماع للإشعارات الجديدة في الوقت الفعلي ──────────────────
let __notifListenerUid = null;
let __notifListenerUnsub = null;

function listenToNotifications(userId) {
  if (!userId || typeof db === 'undefined') return;
  // تجنّب مستمعين مكررين (يُستدعى من _signIn و onAuthStateChanged)
  if (__notifListenerUid === userId && __notifListenerUnsub) return;

  if (__notifListenerUnsub) {
    try { __notifListenerUnsub(); } catch (e) { /* ignore */ }
    __notifListenerUnsub = null;
  }

  __notifListenerUid = userId;

  // استعلام بسيط بدون فهرس مركّب — التصفية محلياً
  __notifListenerUnsub = db.collection('user_notifications')
    .where('userId', '==', userId)
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const notif = change.doc.data();
        if (notif.read) return;
        if (document.hasFocus() && typeof notificationManager !== 'undefined') {
          notificationManager.showNotification(notif.title || 'إشعار جديد', {
            body: notif.body || '',
            data: notif.data || {},
          });
        }
      });
    }, error => {
      // console.warn فقط — error-dashboard يحوّل console.error إلى toast للموظفين
      console.warn('[Notifications] Listener unavailable:', error?.code || error?.message || error);
      __notifListenerUid = null;
      __notifListenerUnsub = null;
    });
}

// ─── وظائف إرسال إشعارات محددة ────────────────────────────────────
async function notifyUserNewOrder(userId, orderId, orderName) {
  const notification = {
    title: '📦 طلب جديد!',
    body: `لديك طلب جديد: ${orderName}`,
    type: 'new-order',
    data: { orderId, orderName, timestamp: Date.now() },
  };
  
  // حفظ محلياً
  notificationManager.showNotification(notification.title, { body: notification.body });
  
  // حفظ في قاعدة البيانات
  await saveNotificationToFirestore(userId, notification);
}

async function notifyVendorPayment(vendorId, amount, orderId) {
  const notification = {
    title: '💰 تحويل جديد!',
    body: `تم تحويل ${amount} ريال للطلب ${orderId}`,
    type: 'payment',
    data: { orderId, amount, timestamp: Date.now() },
  };
  
  notificationManager.showNotification(notification.title, { body: notification.body });
  await saveNotificationToFirestore(vendorId, notification);
}

async function notifyAdminNewReport(report) {
  const notification = {
    title: '⚠️ تقرير جديد!',
    body: `تقرير من ${report.reporterName}`,
    type: 'new-report',
    data: { reportId: report.id, timestamp: Date.now() },
  };
  
  // إرسال للمدير
  const admin = await fsQuery('users', 'role', '==', 'admin');
  for (const adminUser of admin) {
    notificationManager.showNotification(notification.title, { body: notification.body });
    await saveNotificationToFirestore(adminUser.id, notification);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  محجوز — Firebase Messaging Service Worker
//  معالجة الإشعارات في الخلفية عندما لا يكون التطبيق مفتوحاً
// ═══════════════════════════════════════════════════════════════════
'use strict';

// استيراد Firebase Scripts
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// Firebase Config (نفس الإعدادات من firebase-config.js)
const firebaseConfig = {
  apiKey:            "AIzaSyA7ACdMvXQ5xiUIz7QfUbnSA4RcugOdCtM",
  authDomain:        "mahjooz-b502f.firebaseapp.com",
  projectId:         "mahjooz-b502f",
  storageBucket:     "mahjooz-b502f.firebasestorage.app",
  messagingSenderId: "1056495725021",
  appId:             "1:1056495725021:web:33a9b2ba7e96e8e288ae34",
  measurementId:     "G-Y1JYGN8J6K"
};

// تهيئة Firebase في Service Worker
firebase.initializeApp(firebaseConfig);

// الحصول على Messaging Instance
const messaging = firebase.messaging();

// معالجة الإشعارات في الخلفية (Background Messages)
messaging.onBackgroundMessage(payload => {
  console.log('📨 [Service Worker] Background message received:', payload);
  
  // استخراج بيانات الإشعار
  const title = payload.notification?.title || 'محجوز — إشعار جديد';
  const options = {
    body: payload.notification?.body || '',
    icon: '📅',
    badge: '📅',
    tag: payload.data?.type || 'notification',
    data: payload.data,
    actions: [
      {
        action: 'open',
        title: 'فتح'
      },
      {
        action: 'close',
        title: 'إغلاق'
      }
    ],
    // اختيارات إضافية
    ...(payload.data?.image && { image: payload.data.image }),
  };
  
  // عرض الإشعار
  return self.registration.showNotification(title, options);
});

// معالجة النقر على الإشعار
self.addEventListener('notificationclick', event => {
  console.log('🔔 Notification clicked:', event.notification);
  
  event.notification.close();
  
  // الحصول على بيانات الإشعار
  const data = event.notification.data;
  let url = '/';
  
  // توجيه المستخدم بناءً على نوع الإشعار
  if (data?.type === 'order-accepted') {
    url = `/?page=myorders&orderId=${data.orderId}`;
  } else if (data?.type === 'order-rejected') {
    url = `/?page=myorders`;
  } else if (data?.type === 'delivery-status') {
    url = `/?page=myorders`;
  } else if (data?.type === 'payment') {
    url = `/?page=wallet`;
  } else if (data?.type === 'chat-message') {
    url = `/?page=support-chat&chatId=${data.chatId || data.ticketId || ''}`;
  } else if (data?.type === 'new-rating') {
    url = `/?page=vendor`;
  }
  
  // فتح النافذة أو التركيز على النافذة الموجودة
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // البحث عن نافذة مفتوحة بالفعل
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // إذا لم توجد نافذة، فتح نافذة جديدة
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// معالجة إغلاق الإشعار (عند الضغط على إغلاق)
self.addEventListener('notificationclose', event => {
  console.log('❌ Notification dismissed:', event.notification);
});

// معالجة الأخطاء
self.addEventListener('error', event => {
  console.error('[Service Worker Error]:', event.error);
});

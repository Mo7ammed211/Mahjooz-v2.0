// ═══════════════════════════════════════════════════════════════════
//  محجوز — Support Chat System (نظام الدردشة مع الدعم الفني)
//  Chat management, real-time updates, ticket tracking
// ═══════════════════════════════════════════════════════════════════
'use strict';

// ─── Chat Manager Class ───────────────────────────────────────────
class ChatManager {
  constructor() {
    this.activeChat = null;
    this.conversations = [];
    this.messages = [];
    this.listeners = {};
    this.typingUsers = {};
    this.unsubscribers = [];
  }

  // ─── إنشاء حوار دعم جديد ─────────────────────────────────────────
  async createSupportTicket(userId, subject, description, priority = 'medium') {
    try {
      const ticketId = await fsAdd('support_tickets', {
        userId,
        subject,
        description,
        priority, // low, medium, high, urgent
        status: 'open', // open, in-progress, resolved, closed
        assignedTo: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        rating: 0,
        feedback: '',
        tags: [],
        attachments: [],
        messageCount: 0,
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // إضافة رسالة أولية للحوار
      await this.sendMessage(ticketId, userId, description, 'customer', null, 'ticket_init');

      return ticketId;
    } catch (error) {
      console.error('Error creating support ticket:', error);
      throw error;
    }
  }

  // ─── إرسال رسالة ─────────────────────────────────────────────────
  async sendMessage(ticketId, senderId, text, senderRole, attachmentUrl = null, messageType = 'text') {
    try {
      const messageId = await fsAdd('chat_messages', {
        ticketId,
        senderId,
        text,
        senderRole, // customer, staff, admin, system
        messageType, // text, attachment, system, typing
        attachmentUrl,
        attachmentName: null,
        attachmentSize: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        read: false,
        readAt: null,
        reactions: {}, // emoji reactions
        edited: false,
        editedAt: null,
        deleted: false,
        replyTo: null,
        metadata: {},
      });

      // تحديث معلومات التذكرة
      await fsUpdate('support_tickets', ticketId, {
        messageCount: firebase.firestore.FieldValue.increment(1),
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // إشعار الموظفين عند رسالة عميل
      if (senderRole === 'customer') {
        const customer = await fsGet('users', senderId);
        const staffUsers = await fsQuery('users', 'role', '==', 'staff');
        for (const staff of staffUsers) {
          await saveNotificationToFirestore(staff.id || staff.uid, {
            title: '💬 رسالة جديدة من عميل',
            body: `العميل ${customer?.name || customer?.displayName || 'مجهول'}: ${text.substring(0, 50)}...`,
            type: 'chat-message',
            data: { ticketId, chatId: ticketId, senderId, messageId },
          });
        }
      }

      // إشعار العميل عند رد الموظف أو المدير
      if (senderRole === 'staff' || senderRole === 'admin') {
        const ticket = await fsGet('support_tickets', ticketId);
        if (ticket?.userId && typeof saveNotificationToFirestore === 'function') {
          await saveNotificationToFirestore(ticket.userId, {
            title: '💬 رد من الدعم الفني',
            body: text.substring(0, 80),
            type: 'chat-message',
            data: { ticketId, chatId: ticketId, messageId },
          });
        }
      }

      return messageId;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // ─── تحميل رسائل الحوار ──────────────────────────────────────────
  async loadChatMessages(ticketId, limit = 50) {
    try {
      const snapshot = await db.collection('chat_messages')
        .where('ticketId', '==', ticketId)
        .orderBy('createdAt', 'asc')
        .limitToLast(limit)
        .get();

      this.messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return this.messages;
    } catch (error) {
      console.error('Error loading messages:', error);
      return [];
    }
  }

  // ─── الاستماع للرسائل الجديدة في الوقت الفعلي ───────────────────
  listenToChat(ticketId, callback) {
    const unsubscribe = db.collection('chat_messages')
      .where('ticketId', '==', ticketId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot(snapshot => {
        const messages = [];
        snapshot.forEach(doc => {
          messages.push({
            id: doc.id,
            ...doc.data()
          });
        });
        callback(messages.reverse());
      }, error => {
        console.error('Error listening to chat:', error);
      });

    this.unsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  // ─── تعليم الرسائل كمقروءة ──────────────────────────────────────
  async markMessagesAsRead(ticketId, userId) {
    try {
      const snapshot = await db.collection('chat_messages')
        .where('ticketId', '==', ticketId)
        .where('read', '==', false)
        .get();

      const batch = db.batch();
      snapshot.forEach(doc => {
        batch.update(doc.ref, {
          read: true,
          readAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  // ─── إسناد التذكرة لموظف ──────────────────────────────────────────
  async assignTicketToStaff(ticketId, staffId) {
    try {
      await fsUpdate('support_tickets', ticketId, {
        assignedTo: staffId,
        status: 'in-progress',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // إرسال إشعار للموظف
      await saveNotificationToFirestore(staffId, {
        title: '📌 تم إسناد تذكرة لك',
        body: 'تم إسناد تذكرة دعم جديدة لحسابك',
        type: 'ticket-assigned',
        data: { ticketId },
      });

      return true;
    } catch (error) {
      console.error('Error assigning ticket:', error);
      throw error;
    }
  }

  // ─── إغلاق التذكرة ────────────────────────────────────────────────
  async closeTicket(ticketId, resolution) {
    try {
      await fsUpdate('support_tickets', ticketId, {
        status: 'closed',
        resolution,
        closedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      return true;
    } catch (error) {
      console.error('Error closing ticket:', error);
      throw error;
    }
  }

  // ─── تقييم جودة الخدمة ────────────────────────────────────────────
  async rateChat(ticketId, rating, feedback) {
    try {
      await fsUpdate('support_tickets', ticketId, {
        rating,
        feedback,
        ratedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // إضافة تقييم إلى جودة الخدمة
      await fsAdd('support_ratings', {
        ticketId,
        rating,
        feedback,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      return true;
    } catch (error) {
      console.error('Error rating chat:', error);
      throw error;
    }
  }

  // ─── الحصول على التذاكر المفتوحة للمستخدم ──────────────────────
  async getUserOpenTickets(userId) {
    try {
      const snapshot = await db.collection('support_tickets')
        .where('userId', '==', userId)
        .where('status', '!=', 'closed')
        .orderBy('status')
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching user tickets:', error);
      return [];
    }
  }

  // ─── الحصول على جميع التذاكر للموظفين ───────────────────────────
  async getAllTickets(filter = {}) {
    try {
      let query = db.collection('support_tickets');

      if (filter.status) {
        query = query.where('status', '==', filter.status);
      }
      if (filter.priority) {
        query = query.where('priority', '==', filter.priority);
      }
      if (filter.assignedTo) {
        query = query.where('assignedTo', '==', filter.assignedTo);
      }

      const snapshot = await query
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching tickets:', error);
      return [];
    }
  }

  // ─── حساب إحصائيات الدعم ──────────────────────────────────────────
  async getSupportStats() {
    try {
      const allTickets = await fsGetAll('support_tickets');
      
      const stats = {
        total: allTickets.length,
        open: allTickets.filter(t => t.status === 'open').length,
        inProgress: allTickets.filter(t => t.status === 'in-progress').length,
        resolved: allTickets.filter(t => t.status === 'resolved').length,
        closed: allTickets.filter(t => t.status === 'closed').length,
        avgResolutionTime: this._calculateAvgTime(allTickets),
        avgRating: this._calculateAvgRating(allTickets),
        highPriority: allTickets.filter(t => t.priority === 'high' || t.priority === 'urgent').length,
      };

      return stats;
    } catch (error) {
      console.error('Error calculating support stats:', error);
      return {};
    }
  }

  _calculateAvgTime(tickets) {
    const resolved = tickets.filter(t => t.closedAt);
    if (resolved.length === 0) return 0;
    
    const times = resolved.map(t => {
      const createdTime = new Date(t.createdAt?.toDate()).getTime();
      const closedTime = new Date(t.closedAt?.toDate()).getTime();
      return (closedTime - createdTime) / (1000 * 60); // دقائق
    });

    return Math.round(times.reduce((a, b) => a + b) / times.length);
  }

  _calculateAvgRating(tickets) {
    const rated = tickets.filter(t => t.rating > 0);
    if (rated.length === 0) return 0;
    
    const sum = rated.reduce((acc, t) => acc + t.rating, 0);
    return (sum / rated.length).toFixed(1);
  }

  // ─── تنظيف الـ Listeners ──────────────────────────────────────────
  cleanup() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }
}

// ─── Global Instance ───────────────────────────────────────────────
const chatManager = new ChatManager();
let __activeMsgContainer = 'messages-container';

function getChatSenderRole() {
  const role = State.currentUser?.role;
  if (role === 'staff') return 'staff';
  if (role === 'admin') return 'admin';
  return 'customer';
}

function getCustomerName(userId) {
  const u = (AppData.users || []).find(x => x.uid === userId || x.id === userId);
  return u?.name || userId?.substring(0, 8) || '—';
}

// ─── UI Functions ─────────────────────────────────────────────────

// ─── عرض صفحة الدردشة للعميل ─────────────────────────────────────
function renderCustomerChatPage() {
  const userId = State.currentUser?.uid;
  
  return `
  <div class="chat-page">
    <div style="padding:8px 16px 0"><button class="back-btn" onclick="goBack('home')">→ رجوع</button></div>
    <div class="chat-container">
      <!-- Tickets List -->
      <div class="tickets-panel">
        <div class="panel-header">
          <h3>📬 تذاكري</h3>
          <button class="btn btn-sm btn-primary" onclick="showNewTicketForm()">+ طلب دعم جديد</button>
        </div>
        
        <div class="search-box">
          <input type="text" placeholder="ابحث عن التذاكر..." 
            onkeyup="filterTickets(this.value)">
        </div>

        <div class="tickets-list" id="tickets-list">
          <div class="loading">جاري التحميل...</div>
        </div>
      </div>

      <!-- Chat Area -->
      <div class="chat-panel">
        <div id="no-chat-selected" class="empty-state">
          <div style="font-size: 48px; margin-bottom: 20px;">💬</div>
          <p>اختر تذكرة للدردشة</p>
          <p style="color: var(--text-muted); font-size: 14px;">أو أنشئ تذكرة دعم جديدة</p>
        </div>
        
        <div id="chat-area" style="display: none;">
          <div class="chat-header">
            <div>
              <h3 id="chat-subject"></h3>
              <span id="chat-status" class="status-badge"></span>
            </div>
            <div class="chat-actions">
              <button class="btn btn-sm btn-outline" id="close-chat-btn" 
                onclick="closeCurrentTicket()">إغلاق التذكرة</button>
            </div>
          </div>

          <div class="messages-container" id="messages-container"></div>

          <div class="message-input-area">
            <input type="text" id="message-input" placeholder="اكتب رسالتك..." 
              onkeypress="if(event.key==='Enter') sendChatMessage()">
            <button onclick="sendChatMessage()" class="btn btn-primary">إرسال</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}

// ─── عرض لوحة الدعم للموظفين ─────────────────────────────────────
function renderSupportDashboard() {
  return `
  <div class="support-dashboard">
    <div style="padding:8px 0 0"><button class="back-btn" onclick="goBack('admin')">→ رجوع</button></div>
    <div class="dashboard-header">
      <h2>🎧 لوحة الدعم الفني</h2>
      <div class="support-stats" id="support-stats">
        <div class="stat-card">
          <div class="stat-value">-</div>
          <div class="stat-label">تذاكر مفتوحة</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">-</div>
          <div class="stat-label">قيد المعالجة</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">-</div>
          <div class="stat-label">متوسط التقييم</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">-</div>
          <div class="stat-label">وقت الحل (دقيقة)</div>
        </div>
      </div>
    </div>

    <div class="support-tabs">
      <button class="tab-btn active" onclick="switchSupportTab('queue')">📋 قائمة الانتظار</button>
      <button class="tab-btn" onclick="switchSupportTab('assigned')">👤 الموكلة لي</button>
      <button class="tab-btn" onclick="switchSupportTab('resolved')">✅ المحلولة</button>
      <button class="tab-btn" onclick="switchSupportTab('analytics')">📊 الإحصائيات</button>
    </div>

    <div class="support-content" id="support-content">
      <!-- Content will be filled by tab handlers -->
    </div>
  </div>
  `;
}

// ─── معالج التبويب ────────────────────────────────────────────────
async function switchSupportTab(tab) {
  if (tab === 'analytics') {
    await renderSupportAnalytics();
    updateTabButtons(tab);
    return;
  }

  const userId = State.currentUser?.uid;
  let tickets = [];

  switch (tab) {
    case 'queue':
      tickets = await chatManager.getAllTickets({ status: 'open' });
      break;
    case 'assigned':
      tickets = await chatManager.getAllTickets({ assignedTo: userId });
      break;
    case 'resolved':
      tickets = await chatManager.getAllTickets({ status: 'resolved' });
      break;
  }

  renderTicketsTable(tickets, tab);
  updateTabButtons(tab);
}

async function renderSupportAnalytics() {
  const el = document.getElementById('support-content');
  if (!el) return;
  el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل الإحصائيات...</div>';
  try {
    const stats = await chatManager.getSupportStats();
    el.innerHTML = `
      <div class="ph18-route-stats" style="margin-bottom:24px">
        <div class="ph18-route-stat"><b>${stats.total ?? 0}</b><span>إجمالي التذاكر</span></div>
        <div class="ph18-route-stat"><b>${stats.open ?? 0}</b><span>مفتوحة</span></div>
        <div class="ph18-route-stat"><b>${stats.inProgress ?? 0}</b><span>قيد المعالجة</span></div>
        <div class="ph18-route-stat"><b>${stats.resolved ?? 0}</b><span>محلولة</span></div>
        <div class="ph18-route-stat"><b>${stats.closed ?? 0}</b><span>مغلقة</span></div>
        <div class="ph18-route-stat"><b>${stats.highPriority ?? 0}</b><span>أولوية عالية</span></div>
        <div class="ph18-route-stat"><b>${stats.avgRating ?? '—'}</b><span>متوسط التقييم</span></div>
        <div class="ph18-route-stat"><b>${stats.avgResolutionTime ?? '—'}</b><span>دقائق للحل</span></div>
      </div>
      <p style="color:var(--text-muted);font-size:14px;text-align:center">تُحدَّث الإحصائيات من جميع تذاكر الدعم في قاعدة البيانات</p>`;
  } catch (error) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">تعذّر تحميل الإحصائيات</div></div>';
  }
}

// ─── عرض جدول التذاكر ─────────────────────────────────────────────
function renderTicketsTable(tickets, activeTab) {
  const html = `
  <div class="tickets-table-wrapper">
    <table class="tickets-table">
      <thead>
        <tr>
          <th>رقم التذكرة</th>
          <th>الموضوع</th>
          <th>الأولوية</th>
          <th>الحالة</th>
          <th>من قبل</th>
          <th>التاريخ</th>
          <th>الإجراءات</th>
        </tr>
      </thead>
      <tbody>
        ${tickets.length > 0 ? 
          tickets.map(ticket => `
          <tr>
            <td><strong>#${ticket.id.substring(0, 8)}</strong></td>
            <td>${ticket.subject}</td>
            <td>
              <span class="priority-badge priority-${ticket.priority}">
                ${getPriorityLabel(ticket.priority)}
              </span>
            </td>
            <td>
              <span class="status-badge status-${ticket.status}">
                ${getStatusLabel(ticket.status)}
              </span>
            </td>
            <td>${typeof escHtml === 'function' ? escHtml(getCustomerName(ticket.userId)) : getCustomerName(ticket.userId)}</td>
            <td>${formatDate(ticket.createdAt)}</td>
            <td style="white-space:nowrap">
              <button class="btn btn-sm btn-primary" onclick="openStaffTicket('${ticket.id}')">💬 فتح</button>
              ${ticket.status === 'open' ? `<button class="btn btn-sm btn-secondary" onclick="assignTicketToMe('${ticket.id}')">📌 إسناد</button>` : ''}
            </td>
          </tr>`).join('')
          : '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">لا توجد تذاكر</td></tr>'
        }
      </tbody>
    </table>
  </div>
  `;
  
  document.getElementById('support-content').innerHTML = html;
}

// ─── Helper Functions ──────────────────────────────────────────────
function getPriorityLabel(priority) {
  const labels = {
    'low': '🟢 منخفضة',
    'medium': '🟡 متوسطة',
    'high': '🔴 عالية',
    'urgent': '⛔ عاجلة'
  };
  return labels[priority] || priority;
}

function getStatusLabel(status) {
  const labels = {
    'open': '🟢 مفتوحة',
    'in-progress': '🟡 قيد المعالجة',
    'resolved': '✅ محلولة',
    'closed': '⬜ مغلقة'
  };
  return labels[status] || status;
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('ar-YE');
}

function updateTabButtons(activeTab) {
  document.querySelectorAll('.support-tabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${activeTab}'`) ?? false);
  });
}

// ─── إرسال رسالة ──────────────────────────────────────────────────
async function sendChatMessage() {
  const input = document.getElementById('staff-message-input') || document.getElementById('message-input');
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  const ticketId = chatManager.activeChat;
  const userId = State.currentUser?.uid;
  if (!ticketId || !userId) return;

  const senderRole = getChatSenderRole();

  try {
    await chatManager.sendMessage(ticketId, userId, text, senderRole, null, 'text');

    // إسناد تلقائي عند أول رد من الموظف/المدير
    if (senderRole === 'staff' || senderRole === 'admin') {
      const ticket = await fsGet('support_tickets', ticketId);
      if (ticket && !ticket.assignedTo) {
        await chatManager.assignTicketToStaff(ticketId, userId);
      }
    }

    input.value = '';
    input.focus();
  } catch (error) {
    toast('خطأ في إرسال الرسالة', 'error');
  }
}

// ─── فتح تذكرة ────────────────────────────────────────────────────
async function openTicket(ticketId) {
  chatManager.activeChat = ticketId;
  __activeMsgContainer = 'messages-container';
  const ticket = await fsGet('support_tickets', ticketId);
  if (!ticket) return;

  chatManager.cleanup();
  const messages = await chatManager.loadChatMessages(ticketId);
  renderChatMessages(messages, __activeMsgContainer);

  const subjectEl = document.getElementById('chat-subject');
  const statusEl = document.getElementById('chat-status');
  if (subjectEl) subjectEl.textContent = ticket.subject;
  if (statusEl) {
    statusEl.textContent = getStatusLabel(ticket.status);
    statusEl.className = `status-badge status-${ticket.status}`;
  }

  const chatArea = document.getElementById('chat-area');
  const noChat = document.getElementById('no-chat-selected');
  if (chatArea) chatArea.style.display = 'block';
  if (noChat) noChat.style.display = 'none';

  chatManager.listenToChat(ticketId, msgs => renderChatMessages(msgs, __activeMsgContainer));
  await chatManager.markMessagesAsRead(ticketId, State.currentUser?.uid);
}

async function openStaffTicket(ticketId) {
  chatManager.activeChat = ticketId;
  __activeMsgContainer = 'staff-messages-container';
  const ticket = await fsGet('support_tickets', ticketId);
  if (!ticket) { toast('التذكرة غير موجودة', 'error'); return; }

  const customerName = getCustomerName(ticket.userId);
  const assignedName = ticket.assignedTo ? getCustomerName(ticket.assignedTo) : 'غير مسندة';
  const canReply = ticket.status !== 'closed';

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">💬 ${typeof escHtml === 'function' ? escHtml(ticket.subject) : ticket.subject}</h2>
      <button class="modal-close" onclick="closeStaffTicketModal()">✕</button>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;font-size:13px">
      <span class="status-badge status-${ticket.status}">${getStatusLabel(ticket.status)}</span>
      <span class="priority-badge priority-${ticket.priority}">${getPriorityLabel(ticket.priority)}</span>
      <span style="color:var(--text-muted)">👤 ${typeof escHtml === 'function' ? escHtml(customerName) : customerName}</span>
      <span style="color:var(--text-muted)">📌 ${typeof escHtml === 'function' ? escHtml(assignedName) : assignedName}</span>
    </div>
    <div id="staff-messages-container" class="messages-container" style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:12px;background:var(--bg-secondary)"></div>
    ${canReply ? `
    <div class="message-input-area" style="display:flex;gap:8px;margin-bottom:16px">
      <input type="text" id="staff-message-input" class="form-control" placeholder="اكتب ردك للعميل..." style="flex:1"
        onkeypress="if(event.key==='Enter') sendChatMessage()">
      <button class="btn btn-primary" onclick="sendChatMessage()">إرسال</button>
    </div>` : '<p style="color:var(--text-muted);margin-bottom:16px">هذه التذكرة مغلقة — لا يمكن الرد.</p>'}
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${ticket.status === 'open' ? `<button class="btn btn-secondary btn-sm" onclick="assignTicketToMe('${ticketId}')">📌 إسناد لي</button>` : ''}
      ${ticket.status !== 'resolved' && ticket.status !== 'closed' ? `<button class="btn btn-success btn-sm" onclick="resolveTicket('${ticketId}')">✅ محلولة</button>` : ''}
      ${ticket.status !== 'closed' ? `<button class="btn btn-danger btn-sm" onclick="closeStaffTicket('${ticketId}')">⬜ إغلاق نهائي</button>` : ''}
    </div>
  `);

  chatManager.cleanup();
  const messages = await chatManager.loadChatMessages(ticketId);
  renderChatMessages(messages, __activeMsgContainer);
  chatManager.listenToChat(ticketId, msgs => renderChatMessages(msgs, __activeMsgContainer));
  await chatManager.markMessagesAsRead(ticketId, State.currentUser?.uid);

  const staffInput = document.getElementById('staff-message-input');
  if (staffInput) staffInput.focus();
}

function closeStaffTicketModal() {
  chatManager.cleanup();
  chatManager.activeChat = null;
  closeModal();
}

async function assignTicketToMe(ticketId) {
  const uid = State.currentUser?.uid;
  if (!uid) return;
  try {
    await chatManager.assignTicketToStaff(ticketId, uid);
    toast('✅ تم إسناد التذكرة إليك', 'success');
    if (chatManager.activeChat === ticketId && document.getElementById('staff-messages-container')) {
      await openStaffTicket(ticketId);
    } else {
      await refreshSupportTab();
    }
  } catch (error) {
    toast('فشل الإسناد', 'error');
  }
}

async function resolveTicket(ticketId) {
  try {
    await fsUpdate('support_tickets', ticketId, {
      status: 'resolved',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    toast('✅ تم تحديد التذكرة كمحلولة', 'success');
    if (document.getElementById('staff-messages-container')) {
      await openStaffTicket(ticketId);
    }
    await refreshSupportTab();
  } catch (error) {
    toast('فشل التحديث', 'error');
  }
}

async function closeStaffTicket(ticketId) {
  const resolution = prompt('ملاحظات الإغلاق (اختياري):');
  if (resolution === null) return;
  try {
    await chatManager.closeTicket(ticketId, resolution || 'تم الإغلاق');
    toast('✅ تم إغلاق التذكرة', 'success');
    closeStaffTicketModal();
    await refreshSupportTab();
  } catch (error) {
    toast('فشل الإغلاق', 'error');
  }
}

async function refreshSupportTab() {
  const activeBtn = document.querySelector('.support-tabs .tab-btn.active');
  const tab = activeBtn?.getAttribute('onclick')?.match(/'(\w+)'/)?.[1] || 'queue';
  if (typeof switchSupportTab === 'function') await switchSupportTab(tab);
  if (typeof initSupportDashboard === 'function') {
    const stats = await chatManager.getSupportStats();
    const cards = document.querySelectorAll('#support-stats .stat-value');
    if (cards[0]) cards[0].textContent = stats.open ?? 0;
    if (cards[1]) cards[1].textContent = stats.inProgress ?? 0;
    if (cards[2]) cards[2].textContent = stats.avgRating ?? '-';
    if (cards[3]) cards[3].textContent = stats.avgResolutionTime ?? '-';
  }
}

// ─── عرض الرسائل ──────────────────────────────────────────────────
function renderChatMessages(messages, containerId) {
  const container = document.getElementById(containerId || __activeMsgContainer);
  if (!container) return;

  const currentUserId = State.currentUser?.uid;
  const viewerRole = getChatSenderRole();

  container.innerHTML = messages.map(msg => {
    const isOwnMessage = msg.senderId === currentUserId;
    const senderName = msg.senderRole === 'staff' ? '👨‍💼 الموظف' :
                      msg.senderRole === 'admin' ? '👨‍💼 الإدارة' :
                      msg.senderRole === 'system' ? '🤖 النظام' :
                      viewerRole === 'customer' ? '👤 أنت' :
                      `👤 ${getCustomerName(msg.senderId)}`;
    
    return `
    <div class="message-item ${isOwnMessage ? 'sent' : 'received'}">
      <div class="message-bubble">
        <div class="message-sender">${senderName}</div>
        <div class="message-text">${escapeHtml(msg.text)}</div>
        ${msg.attachmentUrl ? `
          <div class="message-attachment">
            <a href="${msg.attachmentUrl}" target="_blank">📎 ${msg.attachmentName || 'ملف مرفق'}</a>
          </div>
        ` : ''}
        <div class="message-time">${formatTime(msg.createdAt)}</div>
      </div>
    </div>
    `;
  }).join('');
  
  // التمرير لآخر رسالة
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─── إغلاق التذكرة ────────────────────────────────────────────────
async function closeCurrentTicket() {
  if (!chatManager.activeChat) return;

  const resolution = prompt('أدخل حل المشكلة أو ملاحظاتك:');
  if (!resolution) return;

  try {
    const ticketId = chatManager.activeChat;
    await chatManager.closeTicket(ticketId, resolution);
    chatManager.cleanup();

    // تقييم اختياري من العميل
    if (getChatSenderRole() === 'customer') {
      const rating = prompt('قيّم خدمة الدعم من 1 إلى 5 (اختياري — اتركه فارغاً للتخطي):');
      if (rating && /^[1-5]$/.test(rating.trim())) {
        const feedback = prompt('ملاحظاتك (اختياري):') || '';
        await chatManager.rateChat(ticketId, parseInt(rating, 10), feedback);
      }
    }

    toast('✅ تم إغلاق التذكرة بنجاح', 'success');
    const chatArea = document.getElementById('chat-area');
    const noChat = document.getElementById('no-chat-selected');
    if (chatArea) chatArea.style.display = 'none';
    if (noChat) noChat.style.display = 'block';
    chatManager.activeChat = null;
    await loadCustomerTickets();
  } catch (error) {
    toast('❌ حدث خطأ في إغلاق التذكرة', 'error');
  }
}

// ─── عرض نموذج تذكرة جديدة ─────────────────────────────────────────
function showNewTicketForm() {
  const html = `
  <div class="modal-content">
    <h2>📝 طلب دعم جديد</h2>
    <form id="new-ticket-form">
      <div class="form-group">
        <label>الموضوع</label>
        <input type="text" id="ticket-subject" placeholder="موضوع المشكلة" required>
      </div>

      <div class="form-group">
        <label>الأولوية</label>
        <select id="ticket-priority">
          <option value="low">🟢 منخفضة</option>
          <option value="medium" selected>🟡 متوسطة</option>
          <option value="high">🔴 عالية</option>
          <option value="urgent">⛔ عاجلة</option>
        </select>
      </div>

      <div class="form-group">
        <label>الوصف التفصيلي</label>
        <textarea id="ticket-description" placeholder="صف المشكلة بالتفصيل..." 
          rows="5" required></textarea>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        <button type="submit" class="btn btn-primary">إنشاء التذكرة</button>
      </div>
    </form>
  </div>
  `;

  openModal(html);

  document.getElementById('new-ticket-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const subject = document.getElementById('ticket-subject').value;
    const description = document.getElementById('ticket-description').value;
    const priority = document.getElementById('ticket-priority').value;

    try {
      const ticketId = await chatManager.createSupportTicket(
        State.currentUser?.uid,
        subject,
        description,
        priority
      );
      
      closeModal();
      toast('✅ تم إنشاء التذكرة بنجاح', 'success');
      await loadCustomerTickets();
      await openTicket(ticketId);
    } catch (error) {
      toast('❌ خطأ في إنشاء التذكرة', 'error');
    }
  });
}

// ─── تهيئة صفحة العميل + تصدير الدوال ─────────────────────────────
let __customerTickets = [];

async function loadCustomerTickets() {
  const userId = State.currentUser?.uid;
  const listEl = document.getElementById('tickets-list');
  if (!userId || !listEl) return;
  try {
    const snapshot = await db.collection('support_tickets')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    __customerTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error loading customer tickets:', error);
    __customerTickets = [];
  }
  renderCustomerTicketsList(__customerTickets);
}

function renderCustomerTicketsList(tickets) {
  const el = document.getElementById('tickets-list');
  if (!el) return;
  if (!tickets.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">لا توجد تذاكر بعد — أنشئ طلب دعم جديد</div>';
    return;
  }
  el.innerHTML = tickets.map(t => `
    <div class="ticket-item" onclick="openTicket('${t.id}')" style="padding:12px;border-bottom:1px solid var(--border);cursor:pointer">
      <div style="font-weight:700">${typeof escHtml === 'function' ? escHtml(t.subject) : t.subject}</div>
      <div style="font-size:12px;color:var(--text-muted)">${getStatusLabel(t.status)} · ${formatDate(t.createdAt)}</div>
    </div>
  `).join('');
}

async function initCustomerChatPage() {
  await loadCustomerTickets();
  const chatId = new URLSearchParams(window.location.search).get('chatId');
  if (chatId) await openTicket(chatId);
}

async function initSupportDashboard() {
  await switchSupportTab('queue');
  try {
    const stats = await chatManager.getSupportStats();
    const cards = document.querySelectorAll('#support-stats .stat-value');
    if (cards[0]) cards[0].textContent = stats.open ?? 0;
    if (cards[1]) cards[1].textContent = stats.inProgress ?? 0;
    if (cards[2]) cards[2].textContent = stats.avgRating ?? '-';
    if (cards[3]) cards[3].textContent = stats.avgResolutionTime ?? '-';
  } catch (error) {
    console.error('Error loading support stats:', error);
  }
}

window.filterTickets = function (query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    renderCustomerTicketsList(__customerTickets);
    return;
  }
  renderCustomerTicketsList(__customerTickets.filter(t =>
    (t.subject || '').toLowerCase().includes(q) ||
    (t.description || '').toLowerCase().includes(q)
  ));
};

window.renderCustomerChatPage = renderCustomerChatPage;
window.renderSupportDashboard = renderSupportDashboard;
window.switchSupportTab = switchSupportTab;
window.openTicket = openTicket;
window.openStaffTicket = openStaffTicket;
window.assignTicketToMe = assignTicketToMe;
window.resolveTicket = resolveTicket;
window.closeStaffTicket = closeStaffTicket;
window.closeStaffTicketModal = closeStaffTicketModal;
window.sendChatMessage = sendChatMessage;
window.showNewTicketForm = showNewTicketForm;
window.closeCurrentTicket = closeCurrentTicket;
window.initSupportDashboard = initSupportDashboard;
window.refreshSupportTab = refreshSupportTab;

window.ExtraPages = window.ExtraPages || {};
window.ExtraPages['support-chat'] = function () {
  const html = renderCustomerChatPage();
  setTimeout(() => initCustomerChatPage(), 0);
  return html;
};

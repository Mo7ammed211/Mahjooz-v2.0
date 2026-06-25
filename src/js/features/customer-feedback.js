/* ============================================================
   Customer Feedback — الاقتراحات والشكاوى واستفسارات العملاء
   ------------------------------------------------------------
   نظام متكامل لتقديم ومتابعة الشكاوى والاقتراحات والاستفسارات
   للعملاء ولوحة تحكم مخصصة للمسؤولين للرد وتحديث الحالات.
   ============================================================ */
'use strict';

(function () {

  let __customerFeedbackList = [];
  let __pendingFeedbackImage = null;

  // ── 1. واجهة العميل: نموذج التقديم وسجل الطلبات ──────────────────
  window.renderCustomerFeedbackPage = function () {
    const u = State.currentUser;
    if (!u) {
      return `<div style="padding:60px;text-align:center;color:var(--text-muted)">
        <h3>🔒 يرجى تسجيل الدخول أولاً</h3>
        <p style="margin-top:12px"><button class="btn btn-primary" onclick="navigate('settings')">تسجيل الدخول</button></p>
      </div>`;
    }

    return `
    <div id="app-content" style="max-width:800px;margin:0 auto;padding:16px">
      <style>
        .cf-header {
          background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(124,58,237,0.08));
          border: 1px solid rgba(139,92,246,0.2);
          border-radius: 20px; padding: 28px 20px; text-align: center;
          margin-bottom: 24px;
        }
        .cf-header h1 { font-size:24px; font-weight:900; margin-bottom:8px; }
        
        .cf-type-selector {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;
        }
        .cf-type-btn {
          background: var(--bg-card, #1e1e2e);
          border: 1px solid var(--border, rgba(255,255,255,0.07));
          border-radius: 14px; padding: 14px 10px; text-align: center; cursor: pointer;
          transition: all 0.2s ease; display: flex; flex-direction: column; align-items: center; gap: 6px;
        }
        .cf-type-btn .icon { font-size: 24px; transition: transform 0.2s; }
        .cf-type-btn.active {
          border-color: var(--primary);
          box-shadow: 0 4px 15px rgba(139,92,246,0.15);
        }
        .cf-type-btn[data-type="suggestion"].active { background: rgba(16,185,129,0.08); border-color: #10b981; color: #10b981; }
        .cf-type-btn[data-type="complaint"].active { background: rgba(244,63,94,0.08); border-color: #f43f5e; color: #f43f5e; }
        .cf-type-btn[data-type="inquiry"].active { background: rgba(59,130,246,0.08); border-color: #3b82f6; color: #3b82f6; }
        .cf-type-btn:hover .icon { transform: scale(1.15); }

        .cf-upload-zone {
          border: 2px dashed rgba(139,92,246,0.3); border-radius: 12px; padding: 20px;
          text-align: center; cursor: pointer; background: rgba(255,255,255,0.01);
          transition: all 0.2s; position: relative;
        }
        .cf-upload-zone:hover {
          border-color: var(--primary); background: rgba(139,92,246,0.03);
        }
        .cf-preview-container {
          display: none; margin-top: 12px; position: relative; display: inline-block;
        }
        .cf-preview-img {
          max-width: 100%; max-height: 160px; border-radius: 8px; border: 1px solid var(--border);
        }
        .cf-remove-preview {
          position: absolute; top: -8px; right: -8px; width: 24px; height: 24px;
          background: #f43f5e; color: white; border-radius: 50%; display: flex;
          align-items: center; justify-content: center; font-size: 12px; font-weight: bold;
          cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }

        .cf-history-title {
          font-size: 18px; font-weight: 800; margin: 32px 0 16px;
          border-bottom: 2px solid var(--border); padding-bottom: 8px;
        }
        .cf-item-card {
          background: var(--bg-card, #1e1e2e); border: 1px solid var(--border);
          border-radius: 14px; padding: 16px; margin-bottom: 12px;
          transition: var(--transition);
        }
        .cf-item-card:hover { border-color: rgba(139,92,246,0.3); }
        .cf-item-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 8px; flex-wrap: wrap; gap: 8px;
        }
        .cf-item-type-badge {
          font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 20px;
        }
        .cf-item-type-badge.suggestion { background: rgba(16,185,129,0.1); color: #10b981; }
        .cf-item-type-badge.complaint { background: rgba(244,63,94,0.1); color: #f43f5e; }
        .cf-item-type-badge.inquiry { background: rgba(59,130,246,0.1); color: #3b82f6; }

        .cf-item-status {
          font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 20px;
        }
        .cf-item-status.new { background: rgba(156,163,175,0.15); color: #9ca3af; }
        .cf-item-status.in_progress { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .cf-item-status.resolved { background: rgba(16,185,129,0.15); color: #10b981; }
        .cf-item-status.closed { background: rgba(107,114,128,0.2); color: #6b7280; }

        .cf-admin-reply-box {
          background: rgba(139,92,246,0.06); border-right: 3px solid var(--primary);
          padding: 12px 14px; border-radius: 0 8px 8px 0; margin-top: 12px;
          font-size: 13px; line-height: 1.6;
        }
      </style>

      <div style="padding:0 0 16px"><button class="back-btn" onclick="goBack('home')">→ رجوع</button></div>

      <!-- Hero Header -->
      <div class="cf-header">
        <h1>📝 الاقتراحات والشكاوى والاستفسارات</h1>
        <p style="color:var(--text-secondary,#94a3b8);font-size:14px;">يسعدنا سماع صوتك لتطوير خدماتنا ومساعدتك بشكل أفضل</p>
      </div>

      <!-- Submission Form -->
      <div class="card" style="padding:24px;border-radius:16px;">
        <h3 style="margin-bottom:16px;font-weight:800;">تقديم طلب جديد</h3>
        <form id="cf-submit-form" onsubmit="event.preventDefault(); window.ph52_handleFeedbackSubmit();">
          
          <!-- Type Selector -->
          <div class="form-group">
            <label class="form-label">نوع الطلب</label>
            <div class="cf-type-selector">
              <div class="cf-type-btn active" data-type="suggestion" onclick="window.ph52_selectType('suggestion')">
                <span class="icon">💡</span>
                <span style="font-size:13px;font-weight:700">اقتراح</span>
              </div>
              <div class="cf-type-btn" data-type="complaint" onclick="window.ph52_selectType('complaint')">
                <span class="icon">⚠️</span>
                <span style="font-size:13px;font-weight:700">شكوى</span>
              </div>
              <div class="cf-type-btn" data-type="inquiry" onclick="window.ph52_selectType('inquiry')">
                <span class="icon">❓</span>
                <span style="font-size:13px;font-weight:700">استفسار</span>
              </div>
            </div>
            <input type="hidden" id="cf-input-type" value="suggestion">
          </div>

          <!-- Subject Title -->
          <div class="form-group">
            <label class="form-label" for="cf-input-title">موضوع الطلب</label>
            <input type="text" id="cf-input-title" class="form-control" placeholder="اكتب عنواناً يوضح طلبك باختصار..." required>
          </div>

          <!-- Message Body -->
          <div class="form-group">
            <label class="form-label" for="cf-input-message">التفاصيل والرسالة</label>
            <textarea id="cf-input-message" class="form-control" placeholder="اشرح هنا تفاصيل طلبك أو شكواك أو استفسارك..." style="min-height:120px" required></textarea>
          </div>

          <!-- Attachment Upload -->
          <div class="form-group">
            <label class="form-label">إرفاق صورة أو لقطة شاشة (اختياري)</label>
            <div class="cf-upload-zone" onclick="document.getElementById('cf-file-input').click()">
              <div id="cf-upload-prompt">
                <span style="font-size:24px;display:block;margin-bottom:6px">📸</span>
                <span style="font-size:13px;font-weight:700;color:var(--primary)">اضغط هنا لرفع صورة</span>
                <span style="font-size:11px;color:var(--text-muted);display:block;margin-top:2px">الحد الأقصى للملف: 5 ميجابايت (PNG, JPG)</span>
              </div>
              <div class="cf-preview-container" id="cf-preview-wrap" onclick="event.stopPropagation()">
                <img class="cf-preview-img" id="cf-preview-img" src="" alt="معاينة الصورة">
                <span class="cf-remove-preview" onclick="window.ph52_clearImagePreview(event)">✕</span>
              </div>
            </div>
            <input type="file" id="cf-file-input" accept="image/*" style="display:none" onchange="window.ph52_previewImage(this)">
          </div>

          <!-- Submit Button -->
          <button type="submit" id="cf-submit-btn" class="btn btn-primary btn-block" style="padding:14px;border-radius:12px;font-size:16px;">
            📤 إرسال الطلب الآن
          </button>
        </form>
      </div>

      <!-- Past Feedback History -->
      <div>
        <h3 class="cf-history-title">📅 طلباتي السابقة</h3>
        <div id="cf-history-list">
          <div style="padding:30px;text-align:center;color:var(--text-muted)">⏳ جاري تحميل سجل طلباتك...</div>
        </div>
      </div>
    </div>
    `;
  };

  // ── 2. دوال نموذج العميل ومعاينة الصور والتحميل ───────────────────
  window.ph52_selectType = function (type) {
    document.querySelectorAll('.cf-type-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.cf-type-btn[data-type="${type}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    const input = document.getElementById('cf-input-type');
    if (input) input.value = type;
  };

  window.ph52_previewImage = function (input) {
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast('حجم الصورة كبير جداً، الحد الأقصى 5 ميجابايت', 'error');
      input.value = '';
      return;
    }

    __pendingFeedbackImage = file;
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = document.getElementById('cf-preview-img');
      const wrap = document.getElementById('cf-preview-wrap');
      const prompt = document.getElementById('cf-upload-prompt');
      if (img && wrap && prompt) {
        img.src = e.target.result;
        wrap.style.display = 'inline-block';
        prompt.style.display = 'none';
      }
    };
    reader.readAsDataURL(file);
  };

  window.ph52_clearImagePreview = function (event) {
    if (event) event.stopPropagation();
    __pendingFeedbackImage = null;
    const input = document.getElementById('cf-file-input');
    const img = document.getElementById('cf-preview-img');
    const wrap = document.getElementById('cf-preview-wrap');
    const prompt = document.getElementById('cf-upload-prompt');
    
    if (input) input.value = '';
    if (img) img.src = '';
    if (wrap) wrap.style.display = 'none';
    if (prompt) prompt.style.display = 'block';
  };

  window.ph52_handleFeedbackSubmit = async function () {
    const u = State.currentUser;
    if (!u) return;

    const type = document.getElementById('cf-input-type')?.value || 'suggestion';
    const title = document.getElementById('cf-input-title')?.value?.trim();
    const message = document.getElementById('cf-input-message')?.value?.trim();
    const btn = document.getElementById('cf-submit-btn');

    if (!title || !message) {
      toast('يرجى ملء جميع الحقول المطلوبة', 'warning');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ جاري الإرسال...';
    }

    try {
      let imageUrl = '';
      if (__pendingFeedbackImage && typeof window.mUpload_uploadImage === 'function') {
        const path = `feedback/${u.uid}_${Date.now()}`;
        imageUrl = await window.mUpload_uploadImage(__pendingFeedbackImage, path);
      }

      await fsAdd('customer_feedback', {
        userId: u.uid || u.id,
        userName: u.name || u.displayName || 'مستخدم محجوز',
        userPhone: u.phone || u.phoneNumber || 'بلا رقم هاتف',
        userRole: u.role || 'customer',
        type,
        title,
        message,
        imageUrl,
        status: 'new',
        adminResponse: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      toast('🎉 تم إرسال طلبك بنجاح! شكراً لك.', 'success');
      
      // Reset Form
      document.getElementById('cf-input-title').value = '';
      document.getElementById('cf-input-message').value = '';
      window.ph52_clearImagePreview();

      // reload
      await window.ph52_loadCustomerFeedback();

    } catch (err) {
      console.error('Feedback Submit Error:', err);
      toast('حدث خطأ أثناء الإرسال، يرجى المحاولة لاحقاً', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '📤 إرسال الطلب الآن';
      }
    }
  };

  window.ph52_loadCustomerFeedback = async function () {
    const listEl = document.getElementById('cf-history-list');
    const u = State.currentUser;
    if (!u || !listEl) return;

    try {
      const snap = await db.collection('customer_feedback')
        .where('userId', '==', u.uid || u.id)
        .orderBy('createdAt', 'desc')
        .get();

      __customerFeedbackList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      window.ph52_renderHistoryList(__customerFeedbackList);
    } catch (error) {
      console.error('Error loading customer feedback:', error);
      listEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger)">⚠️ فشل تحميل تاريخ الطلبات.</div>';
    }
  };

  window.ph52_renderHistoryList = function (items) {
    const listEl = document.getElementById('cf-history-list');
    if (!listEl) return;

    if (items.length === 0) {
      listEl.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-muted)">لا توجد طلبات سابقة بعد. سيسعدنا استقبال أول مقترح أو شكوى منك!</div>';
      return;
    }

    const typeLabels = { suggestion: '💡 اقتراح', complaint: '⚠️ شكوى', inquiry: 'Inquiry ❓' };
    const statusLabels = { new: 'جديد 🆕', in_progress: 'قيد المتابعة ⏳', resolved: 'محلول ✅', closed: 'مغلق ⬜' };

    listEl.innerHTML = items.map(item => {
      const date = item.createdAt ? (item.createdAt.toDate ? item.createdAt.toDate().toLocaleDateString('ar-YE', { hour: '2-digit', minute: '2-digit' }) : new Date(item.createdAt).toLocaleDateString()) : '—';
      return `
      <div class="cf-item-card">
        <div class="cf-item-header">
          <span class="cf-item-type-badge ${item.type}">${typeLabels[item.type] || item.type}</span>
          <span style="font-size:11px;color:var(--text-muted);font-weight:600">${date}</span>
          <span class="cf-item-status ${item.status}">${statusLabels[item.status] || item.status}</span>
        </div>
        <h4 style="font-size:15px;font-weight:800;margin-bottom:8px">${typeof escHtml === 'function' ? escHtml(item.title) : item.title}</h4>
        <p style="font-size:13px;color:var(--text-muted);line-height:1.6;margin-bottom:8px">${typeof escHtml === 'function' ? escHtml(item.message) : item.message}</p>
        
        ${item.imageUrl ? `
          <div style="margin-top:8px">
            <a href="${item.imageUrl}" target="_blank" style="font-size:12px;color:var(--primary);text-decoration:none;font-weight:700">📎 عرض المرفق المرفق</a>
          </div>
        ` : ''}

        ${item.adminResponse ? `
          <div class="cf-admin-reply-box">
            <div style="font-weight:800;color:var(--primary);margin-bottom:4px">💬 رد الإدارة:</div>
            <div>${typeof escHtml === 'function' ? escHtml(item.adminResponse) : item.adminResponse}</div>
          </div>
        ` : ''}
      </div>
      `;
    }).join('');
  };

  // ── 3. واجهة المسؤول: إدارة الاقتراحات والشكاوى ────────────────────
  window.renderAdminCustomerFeedback = function () {
    return `
    <style>
      .cf-admin-filters {
        display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; background: var(--bg-card);
        padding: 16px; border-radius: 12px; border: 1px solid var(--border);
      }
      .cf-admin-filters select, .cf-admin-filters input {
        background: var(--bg-main); border: 1px solid var(--border); color: var(--text-main);
        padding: 8px 12px; border-radius: 8px; font-family: 'Cairo', sans-serif; font-size: 13px;
        outline: none;
      }
      .cf-admin-filters input { flex: 1; min-width: 200px; }
      
      .cf-badge {
        font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 20px; display: inline-block;
      }
      .cf-badge.suggestion { background: rgba(16,185,129,0.1); color: #10b981; }
      .cf-badge.complaint { background: rgba(244,63,94,0.1); color: #f43f5e; }
      .cf-badge.inquiry { background: rgba(59,130,246,0.1); color: #3b82f6; }
      
      .cf-status {
        font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 20px; display: inline-block;
      }
      .cf-status.new { background: rgba(156,163,175,0.15); color: #9ca3af; }
      .cf-status.in_progress { background: rgba(245,158,11,0.15); color: #f59e0b; }
      .cf-status.resolved { background: rgba(16,185,129,0.15); color: #10b981; }
      .cf-status.closed { background: rgba(107,114,128,0.2); color: #6b7280; }
    </style>

    <div class="admin-hub-page">
      <div class="admin-hub-hero">
        <span class="admin-hub-hero-icon">📝</span>
        <div>
          <h1 class="admin-hub-hero-title">الاقتراحات والشكاوى والاستفسارات</h1>
          <p class="admin-hub-hero-sub">استعراض والرد على شكاوى واقتراحات واستفسارات العملاء والمندوبين والمزودين</p>
        </div>
      </div>

      <!-- Filters & Search -->
      <div class="cf-admin-filters">
        <input type="text" id="cf-admin-search" placeholder="ابحث بالاسم أو رقم الهاتف أو الموضوع..." oninput="window.ph52_filterAdminFeedback()">
        
        <select id="cf-admin-filter-type" onchange="window.ph52_filterAdminFeedback()">
          <option value="all">كل الأنواع 📋</option>
          <option value="suggestion">💡 اقتراحات</option>
          <option value="complaint">⚠️ شكاوى</option>
          <option value="inquiry">❓ استفسارات</option>
        </select>
        
        <select id="cf-admin-filter-status" onchange="window.ph52_filterAdminFeedback()">
          <option value="all">كل الحالات ⚡</option>
          <option value="new">🆕 جديد</option>
          <option value="in_progress">⏳ قيد المتابعة</option>
          <option value="resolved">✅ محلول</option>
          <option value="closed">⬜ مغلق</option>
        </select>
      </div>

      <!-- Table Content -->
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>صاحب الطلب</th>
              <th>النوع</th>
              <th>الموضوع</th>
              <th>التاريخ</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody id="cf-admin-tbody">
            <tr>
              <td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px">⏳ جاري تحميل البيانات...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    `;
  };

  let __allAdminFeedback = [];

  window.ph52_loadAdminFeedback = async function () {
    try {
      const snap = await db.collection('customer_feedback')
        .orderBy('createdAt', 'desc')
        .get();
      
      __allAdminFeedback = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      window.ph52_renderAdminTable(__allAdminFeedback);
    } catch (e) {
      console.error('Error loading admin feedback:', e);
      const tbody = document.getElementById('cf-admin-tbody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--danger)">⚠️ فشل تحميل البيانات من السيرفر.</td></tr>`;
    }
  };

  window.ph52_renderAdminTable = function (items) {
    const tbody = document.getElementById('cf-admin-tbody');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px">لا توجد شكاوى أو اقتراحات مطابقة حالياً.</td></tr>`;
      return;
    }

    const typeLabels = { suggestion: '💡 اقتراح', complaint: '⚠️ شكوى', inquiry: '❓ استفسار' };
    const statusLabels = { new: 'جديد', in_progress: 'قيد المتابعة', resolved: 'محلول', closed: 'مغلق' };
    const roleLabels = { customer: 'عميل', vendor: 'مزود', driver: 'مندوب', guest: 'زائر' };

    tbody.innerHTML = items.map(item => {
      const date = item.createdAt ? (item.createdAt.toDate ? item.createdAt.toDate().toLocaleDateString('ar-YE', { hour: '2-digit', minute: '2-digit' }) : new Date(item.createdAt).toLocaleDateString()) : '—';
      const roleStr = roleLabels[item.userRole] || 'عميل';
      
      return `
      <tr>
        <td>
          <div style="font-weight:800">${typeof escHtml === 'function' ? escHtml(item.userName) : item.userName}</div>
          <div style="font-size:11px;color:var(--text-muted)">📱 ${typeof escHtml === 'function' ? escHtml(item.userPhone) : item.userPhone} (${roleStr})</div>
        </td>
        <td><span class="cf-badge ${item.type}">${typeLabels[item.type] || item.type}</span></td>
        <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          <strong style="font-size:13.5px">${typeof escHtml === 'function' ? escHtml(item.title) : item.title}</strong>
        </td>
        <td><span style="font-size:12px;color:var(--text-muted)">${date}</span></td>
        <td><span class="cf-status ${item.status}">${statusLabels[item.status] || item.status}</span></td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="window.ph52_openFeedbackAdminDetails('${item.id}')">💬 عرض والرد</button>
        </td>
      </tr>
      `;
    }).join('');
  };

  window.ph52_filterAdminFeedback = function () {
    const search = document.getElementById('cf-admin-search')?.value?.trim()?.toLowerCase() || '';
    const type = document.getElementById('cf-admin-filter-type')?.value || 'all';
    const status = document.getElementById('cf-admin-filter-status')?.value || 'all';

    let filtered = __allAdminFeedback;

    if (type !== 'all') {
      filtered = filtered.filter(x => x.type === type);
    }

    if (status !== 'all') {
      filtered = filtered.filter(x => x.status === status);
    }

    if (search) {
      filtered = filtered.filter(x => 
        (x.userName || '').toLowerCase().includes(search) ||
        (x.userPhone || '').toLowerCase().includes(search) ||
        (x.title || '').toLowerCase().includes(search) ||
        (x.message || '').toLowerCase().includes(search)
      );
    }

    window.ph52_renderAdminTable(filtered);
  };

  window.ph52_openFeedbackAdminDetails = async function (id) {
    const item = __allAdminFeedback.find(x => x.id === id);
    if (!item) return;

    const typeLabels = { suggestion: '💡 اقتراح', complaint: '⚠️ شكوى', inquiry: '❓ استفسار' };
    const roleLabels = { customer: 'عميل', vendor: 'مزود', driver: 'مندوب', guest: 'زائر' };

    const modalHtml = `
    <div class="modal-header">
      <h2 class="modal-title">💬 تفاصيل الطلب #${item.id.substring(0,8)}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" style="padding:16px 0;text-align:right" direction="rtl">
      
      <!-- Info block -->
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px;background:rgba(255,255,255,0.02);padding:12px;border-radius:8px;border:1px solid var(--border)">
        <div><b>صاحب الطلب:</b> ${typeof escHtml === 'function' ? escHtml(item.userName) : item.userName} (${roleLabels[item.userRole] || 'عميل'})</div>
        <div><b>الهاتف:</b> <a href="tel:${item.userPhone}" style="color:var(--primary);text-decoration:none;font-weight:700">${typeof escHtml === 'function' ? escHtml(item.userPhone) : item.userPhone}</a></div>
        <div><b>النوع:</b> <span class="cf-badge ${item.type}">${typeLabels[item.type] || item.type}</span></div>
      </div>

      <!-- Title & Message -->
      <div style="margin-bottom:16px">
        <h3 style="font-size:16px;font-weight:800;margin-bottom:6px">${typeof escHtml === 'function' ? escHtml(item.title) : item.title}</h3>
        <p style="font-size:14px;color:var(--text-muted);line-height:1.6;background:rgba(255,255,255,0.01);padding:12px;border-radius:8px;border:1px solid var(--border)">
          ${typeof escHtml === 'function' ? escHtml(item.message) : item.message}
        </p>
      </div>

      <!-- Screenshot Attachment -->
      ${item.imageUrl ? `
        <div style="margin-bottom:16px">
          <b style="display:block;margin-bottom:6px">🖼️ المرفق المرفوع:</b>
          <a href="${item.imageUrl}" target="_blank">
            <img src="${item.imageUrl}" style="max-width:100%;max-height:220px;border-radius:8px;border:1px solid var(--border);cursor:pointer;object-fit:contain" alt="المرفق المرفوع">
          </a>
        </div>
      ` : ''}

      <!-- Admin Actions form -->
      <div style="border-top:1px dashed var(--border);padding-top:16px;margin-top:16px">
        <h4 style="font-size:14px;font-weight:800;margin-bottom:12px">🛠️ معالجة الطلب والرد</h4>
        
        <div class="form-group">
          <label class="form-label" for="cf-admin-reply-text">رد الإدارة للعميل</label>
          <textarea id="cf-admin-reply-text" class="form-control" placeholder="اكتب الرد الرسمي هنا..." style="min-height:90px">${item.adminResponse || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label" for="cf-admin-status-select">تحديث الحالة</label>
          <select id="cf-admin-status-select" class="form-control">
            <option value="new" ${item.status === 'new' ? 'selected' : ''}>🆕 جديد</option>
            <option value="in_progress" ${item.status === 'in_progress' ? 'selected' : ''}>⏳ قيد المتابعة</option>
            <option value="resolved" ${item.status === 'resolved' ? 'selected' : ''}>✅ محلول</option>
            <option value="closed" ${item.status === 'closed' ? 'selected' : ''}>⬜ مغلق</option>
          </select>
        </div>
      </div>
    </div>
    
    <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="window.ph52_submitAdminFeedbackReply('${item.id}')">💾 حفظ الرد والحالة</button>
    </div>
    `;

    openModal(modalHtml);
  };

  window.ph52_submitAdminFeedbackReply = async function (id) {
    const replyText = document.getElementById('cf-admin-reply-text')?.value?.trim() || '';
    const status = document.getElementById('cf-admin-status-select')?.value || 'new';

    try {
      await fsUpdate('customer_feedback', id, {
        adminResponse: replyText,
        status,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // إضافة إشعار للعميل الذي قدم التذكرة
      const item = __allAdminFeedback.find(x => x.id === id);
      if (item && item.userId && typeof saveNotificationToFirestore === 'function') {
        const typeLabels = { suggestion: 'اقتراحك', complaint: 'شكواك', inquiry: 'استفسارك' };
        const label = typeLabels[item.type] || 'طلبك';
        
        await saveNotificationToFirestore(item.userId, {
          title: '📝 تحديث على شكواك/اقتراحك',
          body: `تم الرد على ${label} وتحديث الحالة إلى (${status === 'resolved' ? 'محلول' : status === 'in_progress' ? 'قيد المتابعة' : 'مغلق'}).`,
          type: 'feedback-update',
          data: { feedbackId: id }
        });
      }

      toast('✅ تم حفظ الرد وتحديث الحالة بنجاح', 'success');
      closeModal();
      await window.ph52_loadAdminFeedback();
    } catch (e) {
      console.error('Error saving feedback reply:', e);
      toast('فشل التحديث، يرجى المحاولة لاحقاً', 'error');
    }
  };

  // ── 4. تسجيل الصفحة في الروتر والتحميل التلقائي ─────────────────────
  function registerRoutes() {
    // تسجيل صفحة العميل
    if (window.AppRoutes && typeof AppRoutes === 'object') {
      AppRoutes['suggestions-complaints'] = function () {
        const html = renderCustomerFeedbackPage();
        setTimeout(() => window.ph52_loadCustomerFeedback(), 0);
        return html;
      };
    }
    
    if (window.Pages && typeof Pages === 'object') {
      Pages['suggestions-complaints'] = function () {
        const html = renderCustomerFeedbackPage();
        setTimeout(() => window.ph52_loadCustomerFeedback(), 0);
        return html;
      };
    }

    // تسجيل صفحة الأدمن
    if (window.ExtraPages && typeof window.ExtraPages === 'object') {
      window.ExtraPages['customer_feedback'] = function () {
        const html = renderAdminCustomerFeedback();
        setTimeout(() => window.ph52_loadAdminFeedback(), 0);
        return html;
      };
    }
  }

  setTimeout(registerRoutes, 500);

  console.log('[CustomerFeedback] ✅ نظام الاقتراحات والشكاوى loaded 📝');
})();

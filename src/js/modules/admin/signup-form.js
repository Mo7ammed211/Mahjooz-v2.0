// ═══════════════════════════════════════════════════════
//  محجوز v2.1 — Phase 26 (Dynamic Signup Form Builder)
// ═══════════════════════════════════════════════════════
'use strict';

// ── Inject CSS for Admin Layout ──
(function injectAdminStyles() {
  const css = `
    .ph9-info-row-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    /* Grouped Sidebar */
    .admin-sidebar-group {
      margin-bottom: 24px;
      padding-bottom: 8px;
    }
    .admin-sidebar-label {
      font-family: 'Cairo', 'Tajawal', sans-serif;
      font-size: 12px;
      font-weight: 800;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin: 0 16px 10px;
      opacity: 0.9;
      display: flex;
      align-items: center;
      gap: 10px;
      position: relative;
    }
    .admin-sidebar-label::before {
      content: '';
      width: 4px;
      height: 14px;
      background: var(--primary);
      border-radius: 2px;
      box-shadow: 0 0 10px var(--primary);
    }
    .admin-sidebar-label::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, rgba(255,255,255,0.1), transparent);
    }
    .admin-nav-item {
      font-family: 'Cairo', 'Tajawal', sans-serif;
      width: calc(100% - 24px);
      margin: 4px 12px;
      border-radius: 12px;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.7);
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }
    .admin-nav-item:hover { 
      background: rgba(139, 92, 246, 0.08); 
      color: #fff; 
      transform: translateX(-4px);
    }
    .admin-nav-item.active { 
      background: linear-gradient(135deg, var(--primary), #7c3aed);
      color: #fff; 
      font-weight: 800;
      box-shadow: 0 8px 20px rgba(139,92,246,0.3); 
      transform: scale(1.02) translateX(-6px);
    }
    .admin-nav-item.active::after {
      content: '';
      position: absolute;
      right: 0;
      top: 20%;
      height: 60%;
      width: 4px;
      background: #fff;
      border-radius: 4px 0 0 4px;
      box-shadow: -2px 0 10px rgba(255,255,255,0.5);
    }
    .admin-content-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px;
      box-shadow: var(--shadow-sm);
      min-height: 60vh;
    }
  `;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();

window.DEFAULT_SIGNUP_CONFIG = {
  customer: [
    { id: 'name', type: 'text', label: 'الاسم الرباعي الكامل', required: true, locked: true },
    { id: 'gender', type: 'select', label: 'الجنس', options: 'male:ذكر 👨,female:أنثى 👩', required: true },
    { id: 'age', type: 'number', label: 'العمر', required: true },
    { id: 'region', type: 'region', label: 'المنطقة', required: true },
    { id: 'locText', type: 'text', label: 'العنوان التفصيلي', required: true },
    { id: 'phone', type: 'tel', label: 'رقم الجوال', required: true, locked: true },
    { id: 'email', type: 'email', label: 'البريد الإلكتروني', required: true, locked: true },
    { id: 'pass', type: 'password', label: 'كلمة المرور', required: true, locked: true },
  ],
  driver: [
    { id: 'name', type: 'text', label: 'الاسم الرباعي الكامل', required: true, locked: true },
    { id: 'gender', type: 'select', label: 'الجنس', options: 'male:ذكر 👨,female:أنثى 👩', required: true },
    { id: 'age', type: 'number', label: 'العمر', required: true },
    { id: 'region', type: 'region', label: 'المنطقة', required: true },
    { id: 'locText', type: 'text', label: 'العنوان التفصيلي', required: true },
    { id: 'phone', type: 'tel', label: 'رقم الجوال', required: true, locked: true },
    { id: 'email', type: 'email', label: 'البريد الإلكتروني', required: true, locked: true },
    { id: 'pass', type: 'password', label: 'كلمة المرور', required: true, locked: true },
  ],
  vendor: [
    { id: 'name', type: 'text', label: 'اسم المزود / المنشأة', required: true, locked: true },
    { id: 'region', type: 'region', label: 'المنطقة', required: true },
    { id: 'locText', type: 'text', label: 'العنوان التفصيلي', required: true },
    { id: 'phone', type: 'tel', label: 'رقم الجوال', required: true, locked: true },
    { id: 'email', type: 'email', label: 'البريد الإلكتروني', required: true, locked: true },
    { id: 'pass', type: 'password', label: 'كلمة المرور', required: true, locked: true },
  ]
};

async function loadSignupConfig() {
  if (!AppData.signupConfig) {
    try {
      const data = await fsGetAll('signup_fields');
      if (data.length === 0) {
        AppData.signupConfig = JSON.parse(JSON.stringify(window.DEFAULT_SIGNUP_CONFIG));
      } else {
        const config = {};
        data.forEach(d => { config[d.id] = d.fields || []; });
        // Merge missing default roles just in case
        for (const role in window.DEFAULT_SIGNUP_CONFIG) {
          if (!config[role] || config[role].length === 0) {
            config[role] = JSON.parse(JSON.stringify(window.DEFAULT_SIGNUP_CONFIG[role]));
          }
        }
        AppData.signupConfig = config;
      }
    } catch(e) {
      AppData.signupConfig = JSON.parse(JSON.stringify(window.DEFAULT_SIGNUP_CONFIG));
    }
  }
}

window.renderAdminSignupSettings = function renderAdminSignupSettings() {
  if (!AppData.signupConfig) {
    loadSignupConfig().then(() => render());
    return `<div style="padding:40px;text-align:center">جاري تحميل إعدادات التسجيل...</div>`;
  }
  const currentRole = State.adminSignupRole || 'customer';
  
  const roleLabels = { customer: 'عميل', driver: 'مندوب توصيل', vendor: 'مزود خدمة' };
  
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <h2>إعدادات حقول التسجيل</h2>
      <button class="btn btn-primary" onclick="showAddSignupFieldModal('${currentRole}')">➕ إضافة حقل جديد</button>
    </div>
    
    <div class="support-tabs" style="margin-bottom:24px">
      ${Object.keys(roleLabels).map(role => `
        <button class="tab-btn ${currentRole === role ? 'active' : ''}" onclick="setAdminSignupRole('${role}')">
          ${roleLabels[role]}
        </button>
      `).join('')}
    </div>

    <div class="table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>اسم الحقل (Label)</th>
            <th>النوع</th>
            <th>مطلوب؟</th>
            <th>حالة النظام</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${(AppData.signupConfig[currentRole] || []).map((f, i) => {
            const types = { text:'نص قصير', number:'رقم', tel:'رقم هاتف', email:'بريد', password:'كلمة مرور', select:'قائمة', region:'مناطق', textarea:'نص طويل' };
            const typeLabel = types[f.type] || f.type;
            return `
            <tr>
              <td style="font-weight:600">${escHtml(f.label)} ${f.locked ? '🔒' : ''}</td>
              <td><span class="badge badge-purple">${typeLabel}</span></td>
              <td>${f.required ? '<span class="badge badge-rose">إجباري</span>' : '<span class="badge badge-teal">اختياري</span>'}</td>
              <td>${f.hidden ? '<span class="badge badge-warning">مخفي 👁️‍🗨️</span>' : '<span class="badge badge-success">ظاهر ✅</span>'}</td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="showEditSignupFieldModal('${currentRole}', ${i})">✏️</button>
                <button class="btn btn-sm btn-warning" onclick="toggleSignupFieldVisibility('${currentRole}', ${i})">${f.hidden ? 'إظهار' : 'إخفاء'}</button>
                <button class="btn btn-sm btn-danger" ${f.locked ? 'disabled style="opacity:0.5"' : ''} onclick="${f.locked ? '' : `deleteSignupField('${currentRole}', ${i})`}">🗑️</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <div style="margin-top:24px; padding:16px; background:var(--bg-hover); border-radius:var(--radius-sm); border:1px solid var(--border);">
      <button class="btn btn-success" onclick="saveSignupConfigToDB()">💾 حفظ الإعدادات</button>
      <span style="margin-right:12px; font-size:13px; color:var(--text-muted);">تأكد من الضغط على حفظ لتطبيق التغييرات على استمارة التسجيل.</span>
    </div>
  `;
}

window.setAdminSignupRole = async function(role) {
  State.adminSignupRole = role;
  await render();
};

window.toggleSignupFieldVisibility = function(role, index) {
  if (!AppData.signupConfig[role] || !AppData.signupConfig[role][index]) return;
  const field = AppData.signupConfig[role][index];
  if (field.locked && (field.id === 'phone' || field.id === 'email' || field.id === 'pass' || field.id === 'name')) {
    toast('لا يمكن إخفاء هذا الحقل الأساسي', 'error');
    return;
  }
  field.hidden = !field.hidden;
  render();
};

window.deleteSignupField = function(role, index) {
  if (!AppData.signupConfig[role] || !AppData.signupConfig[role][index]) return;
  if (AppData.signupConfig[role][index].locked) {
    toast('لا يمكن حذف الحقول الأساسية للنظام', 'error');
    return;
  }
  if (!confirm('هل أنت متأكد من حذف هذا الحقل؟')) return;
  AppData.signupConfig[role].splice(index, 1);
  render();
};

window.saveSignupConfigToDB = async function() {
  showLoader('جاري حفظ الإعدادات...');
  try {
    const promises = Object.keys(AppData.signupConfig).map(role => {
      return db.collection('signup_fields').doc(role).set({
        id: role,
        fields: AppData.signupConfig[role]
      });
    });
    
    await Promise.all(promises);
    hideLoader();
    toast('تم حفظ إعدادات التسجيل بنجاح ✅', 'success');
  } catch(e) {
    hideLoader();
    toast('حدث خطأ أثناء الحفظ', 'error');
    console.error(e);
  }
};

window.showAddSignupFieldModal = function(role) {
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">➕ إضافة حقل جديد</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">اسم الحقل (يظهر للمستخدم)</label>
      <input class="form-control" id="sf-label" placeholder="مثال: رقم الهوية">
    </div>
    <div class="form-group">
      <label class="form-label">المعرف البرمجي (إنجليزي بدون مسافات)</label>
      <input class="form-control" id="sf-id" placeholder="مثال: identity_number">
    </div>
    <div class="form-group">
      <label class="form-label">نوع الحقل</label>
      <select class="form-control" id="sf-type" onchange="toggleSfOptions()">
        <option value="text">نص قصير</option>
        <option value="textarea">نص طويل</option>
        <option value="number">رقم</option>
        <option value="select">قائمة خيارات</option>
      </select>
    </div>
    <div class="form-group" id="sf-options-group" style="display:none">
      <label class="form-label">الخيارات (افصل بينها بفاصلة، مثال: value1:Label1,value2:Label2)</label>
      <input class="form-control" id="sf-options" placeholder="مثال: 1:خيار أول,2:خيار ثاني">
    </div>
    <div class="form-group">
      <label class="form-label">هل الحقل إجباري؟</label>
      <select class="form-control" id="sf-required">
        <option value="true">نعم، إجباري</option>
        <option value="false">لا، اختياري</option>
      </select>
    </div>
    <button class="btn btn-primary btn-block" onclick="addSignupField('${role}')">إضافة</button>
  `);
};

window.toggleSfOptions = function() {
  const type = document.getElementById('sf-type').value;
  document.getElementById('sf-options-group').style.display = type === 'select' ? 'block' : 'none';
};

window.addSignupField = function(role) {
  const label = document.getElementById('sf-label').value.trim();
  let id = document.getElementById('sf-id').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const type = document.getElementById('sf-type').value;
  const options = document.getElementById('sf-options').value.trim();
  const required = document.getElementById('sf-required').value === 'true';

  if (!label || !id) {
    toast('يجب تعبئة الاسم والمعرف', 'error');
    return;
  }
  
  if (!id.startsWith('c_')) id = 'c_' + id; // custom prefix

  AppData.signupConfig[role].push({
    id, label, type, options: type === 'select' ? options : '', required, locked: false, hidden: false
  });
  
  closeModal();
  render();
};

window.showEditSignupFieldModal = function(role, index) {
  const field = AppData.signupConfig[role][index];
  if (!field) return;
  
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">✏️ تعديل الحقل</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">اسم الحقل (يظهر للمستخدم)</label>
      <input class="form-control" id="sfe-label" value="${escAttr(field.label)}">
    </div>
    <div class="form-group">
      <label class="form-label">المعرف البرمجي (للقراءة فقط)</label>
      <input class="form-control" value="${field.id}" disabled>
    </div>
    ${field.locked ? '<p style="color:var(--warning);font-size:12px">⚠️ هذا حقل نظام أساسي، لا يمكن تغيير نوعه أو إخفائه.</p>' : `
      <div class="form-group">
        <label class="form-label">نوع الحقل</label>
        <select class="form-control" id="sfe-type" onchange="toggleSfeOptions()">
          <option value="text" ${field.type==='text'?'selected':''}>نص قصير</option>
          <option value="textarea" ${field.type==='textarea'?'selected':''}>نص طويل</option>
          <option value="number" ${field.type==='number'?'selected':''}>رقم</option>
          <option value="select" ${field.type==='select'?'selected':''}>قائمة خيارات</option>
        </select>
      </div>
      <div class="form-group" id="sfe-options-group" style="${field.type==='select'?'block':'display:none'}">
        <label class="form-label">الخيارات (افصل بينها بفاصلة)</label>
        <input class="form-control" id="sfe-options" value="${escAttr(field.options||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">هل الحقل إجباري؟</label>
        <select class="form-control" id="sfe-required">
          <option value="true" ${field.required?'selected':''}>نعم، إجباري</option>
          <option value="false" ${!field.required?'selected':''}>لا، اختياري</option>
        </select>
      </div>
    `}
    <button class="btn btn-primary btn-block" onclick="updateSignupField('${role}', ${index})">حفظ التعديلات</button>
  `);
};

window.toggleSfeOptions = function() {
  const type = document.getElementById('sfe-type')?.value;
  if(type) {
    document.getElementById('sfe-options-group').style.display = type === 'select' ? 'block' : 'none';
  }
};

window.updateSignupField = function(role, index) {
  const field = AppData.signupConfig[role][index];
  if (!field) return;

  field.label = document.getElementById('sfe-label').value.trim();
  
  if (!field.locked) {
    field.type = document.getElementById('sfe-type').value;
    field.options = field.type === 'select' ? document.getElementById('sfe-options').value.trim() : '';
    field.required = document.getElementById('sfe-required').value === 'true';
  }
  
  closeModal();
  render();
};

// ───────────────────────────────────────────────────────
//  ADMIN — Master Orchestration & Tab Organization
// ───────────────────────────────────────────────────────

/**
 * window.renderAdmin override removed to prevent conflicts with dashboards.js hub UI.
 */


// Re-render if we are on the admin page
window.addEventListener('AppDataReady', () => {
  console.log('[Phase 26] Finalizing Master Admin Router ✅');
  if (State.currentPage === 'admin') render();
});

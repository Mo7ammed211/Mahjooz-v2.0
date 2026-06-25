/* ============================================================
   db-manager.js — إدارة قواعد البيانات والأرشفة والاتفاقيات
   ============================================================ */

(function () {
  if (typeof AppData === 'undefined') window.AppData = {};

  // تهيئة المصفوفات في AppData لمنع الأخطاء قبل التحميل
  AppData.depositDocs = AppData.depositDocs || [];
  AppData.agreements = AppData.agreements || [];
  AppData.archivedOrders = AppData.archivedOrders || [];
  AppData.auditLogs = AppData.auditLogs || [];
  AppData.refundRequests = AppData.refundRequests || [];
  AppData.broadcastNotifications = AppData.broadcastNotifications || [];

  /* ==========================================
     1. سجل العمليات الإدارية (Audit Logs)
     ========================================== */
  window.ph53_logAdminAction = async function (actionType, targetId, description) {
    const u = State.currentUser;
    if (!u) return;
    try {
      const logData = {
        actorId: u.uid,
        actorName: u.name || u.email || 'إداري',
        actionType, // e.g. 'approve_deposit', 'archive_order', 'update_agreement'
        targetId: targetId || '',
        description,
        ipAddress: '127.0.0.1', // Mocked IP
        createdAt: new Date()
      };
      await fsAdd('auditLogs', logData);
      console.log(`[AuditLog] ${actionType}: ${description}`);
    } catch (e) {
      console.warn('[AuditLog] Failed to write log:', e);
    }
  };

  /* ==========================================
     2. آلية أرشفة الطلبات (Order Archiving)
     ========================================== */
  window.ph53_archiveOrder = async function (orderId, reason = 'completed') {
    try {
      const order = (AppData.orders || []).find(o => o.id === orderId || o.orderId === orderId);
      if (!order) {
        console.warn(`[Archive] Order ${orderId} not found in AppData.`);
        return false;
      }
      
      const archivedObj = {
        ...order,
        archivedAt: new Date(),
        archiveReason: reason
      };
      
      // 1. إضافة الطلب إلى مجموعة الأرشيف
      await fsAdd('archivedOrders', archivedObj);
      
      // 2. حذف الطلب من مجموعة الطلبات النشطة
      await fsDelete('orders', order.id);
      
      // 3. إضافة سجل تدقيق
      await ph53_logAdminAction('archive_order', order.orderId || order.id, `أرشفة الطلب #${order.orderId || order.id} بسبب: ${reason}`);
      
      // 4. تحديث البيانات محلياً
      await loadAllData();
      return true;
    } catch (e) {
      console.error('[Archive] Failed to archive order:', e);
      toast('حدث خطأ أثناء أرشفة الطلب', 'error');
      return false;
    }
  };

  /* ==========================================
     3. تهيئة نصوص الاتفاقيات الافتراضية
     ========================================== */
  window.ph53_ensureAgreementTemplates = async function () {
    try {
      const providerTpl = await fsGet('platform_settings', 'provider_agreement_terms');
      if (!providerTpl) {
        await fsSet('platform_settings', 'provider_agreement_terms', {
          version: '1.0',
          title: 'اتفاقية تقديم الخدمات والانضمام للمنصة',
          text: `بند 1: يلتزم مزود الخدمة بتقديم الخدمات المسندة إليه بأعلى معايير الجودة والأمان.
بند 2: تحتسب المنصة عمولة قدرها 10% من إجمالي قيمة أي حجز أو خدمة مكتملة يتم دفعها للعميل.
بند 3: يتم تحويل مستحقات مزود الخدمة إلى محفظته الإلكترونية مباشرة بعد تأكيد اكتمال الطلب من العميل أو تلقائياً بعد مرور 24 ساعة من تاريخ التنفيذ.
بند 4: يحق للمنصة تعليق حساب الشريك في حال تلقي شكاوى متكررة أو تدني تقييم الخدمات عن 3 نجوم.`,
          updatedAt: new Date()
        });
      }
      const driverTpl = await fsGet('platform_settings', 'driver_agreement_terms');
      if (!driverTpl) {
        await fsSet('platform_settings', 'driver_agreement_terms', {
          version: '1.0',
          title: 'اتفاقية التوصيل والعمولات للمندوبين',
          text: `بند 1: يلتزم مندوب التوصيل بتوصيل الطلبات والخدمات الموكلة إليه في الوقت المحدد وبحالة سليمة.
بند 2: يتم احتساب رسوم التوصيل لصالح المندوب بناءً على تسعيرة المناطق المعتمدة في النظام، وتخصم المنصة عمولة ثابتة قدرها 5% من رسوم التوصيل.
بند 3: يجب على المندوب مراجعة حالة الدفع (محفظة، إيداع مسبق، أو كاش عند الاستلام) قبل تسليم الخدمة/المنتج للعميل.
بند 4: يلتزم المندوب بتشغيل نظام التتبع وتحديث حالة الطلب (مع المندوب، تم التوصيل) بشكل فوري.`,
          updatedAt: new Date()
        });
      }
    } catch (e) {
      console.warn('[Agreements] Template initialization issues:', e);
    }
  };

  /* ==========================================
     4. فحص وحظر الحسابات في حال عدم توقيع الاتفاقية
     ========================================== */
  window.ph53_checkPartnerAgreement = async function () {
    const u = State.currentUser;
    if (!u || (u.role !== 'provider' && u.role !== 'driver')) return;

    // جلب نصوص التواقيع
    const signed = (AppData.agreements || []).find(a => a.userId === u.uid && a.status === 'signed');
    if (signed) return; // الحساب وقع مسبقاً بنجاح!

    // جلب نسخة القالب الحالية
    const docId = u.role === 'provider' ? 'provider_agreement_terms' : 'driver_agreement_terms';
    let tplText = '';
    let tplTitle = '';
    let tplVer = '1.0';
    try {
      const tpl = await fsGet('platform_settings', docId);
      if (tpl) {
        tplText = tpl.text;
        tplTitle = tpl.title;
        tplVer = tpl.version || '1.0';
      }
    } catch (e) {
      // نصوص احتياطية في حال تعذر الاتصال
      tplTitle = u.role === 'provider' ? 'اتفاقية تقديم الخدمات والانضمام للمنصة' : 'اتفاقية التوصيل والعمولات للمندوبين';
      tplText = u.role === 'provider' 
        ? 'اتفاقية الشركاء: يرجى الالتزام بتقديم الخدمات بجودة عالية، عمولة المنصة 10% من قيمة الخدمات المكتملة.'
        : 'اتفاقية المندوبين: يرجى التوصيل بأمان وسرعة، عمولة المنصة 5% من رسوم التوصيل.';
    }

    // إظهار مودال إجباري يمنع التفاعل مع اللوحة الخلفية
    openModal(`
      <div style="text-align: right; direction: rtl; font-family: 'Cairo', sans-serif; color:#fff; padding: 10px;">
        <h2 style="font-weight: 800; color: var(--primary); margin-bottom: 12px; font-size: 20px;">📝 توقيع اتفاقية العمل المطلوبة</h2>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
          مرحباً بك في تطبيق محجوز. للاستمرار وتفعيل حسابك لاستقبال الطلبات، يرجى قراءة بنود الاتفاقية التالية والموافقة عليها والتوقيع رقمياً:
        </p>
        
        <div style="background: rgba(255,255,255,0.03); border: 1.5px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px; font-size: 13px; max-height: 250px; overflow-y: auto; line-height: 1.8; white-space: pre-wrap; font-family:'Tajawal', sans-serif;">
          <h4 style="font-weight: 700; color: #fff; margin-bottom: 8px;">${escHtml(tplTitle)} (إصدار ${tplVer})</h4>
          ${escHtml(tplText)}
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; font-size: 13px;">
            <input type="checkbox" id="agree-terms-checkbox" style="width: 20px; height: 20px; flex-shrink: 0; margin-top: 2px;">
            <span>أقر وأوافق بصفتي الرسمية على البنود والشروط الموضحة أعلاه، وأتعهد بالالتزام الكامل بها طوال فترة استخدام المنصة.</span>
          </label>
        </div>

        <button class="btn btn-primary btn-block btn-lg" onclick="ph53_signAgreement('${u.uid}', '${u.role}', '${tplVer}')">
          📝 توقيع وقبول الاتفاقية
        </button>
      </div>
    `, { disableClose: true });
  };

  window.ph53_signAgreement = async function (userId, role, version) {
    const check = document.getElementById('agree-terms-checkbox');
    if (!check || !check.checked) {
      toast('يرجى تحديد مربع الموافقة على الشروط للمتابعة', 'warning');
      return;
    }

    showLoader('جاري حفظ التوقيع...');
    try {
      const u = State.currentUser;
      await fsAdd('platform_agreements', {
        userId,
        userName: u.name || 'شريك',
        userRole: role,
        agreementType: role === 'provider' ? 'vendor_terms' : 'driver_terms',
        version: version || '1.0',
        signedAt: new Date(),
        ipAddress: '127.0.0.1',
        status: 'signed'
      });

      // تفعيل المستخدم تلقائياً بعد توقيع الاتفاقية (أمان إضافي)
      await fsUpdate('users', userId, { isActive: true, isActivePending: false });
      
      toast('🎉 تم توقيع الاتفاقية وتنشيط الحساب بنجاح!', 'success');
      closeModal();
      await loadAllData();
      await render();
    } catch (e) {
      toast('حدث خطأ أثناء حفظ التوقيع: ' + e.message, 'error');
    } finally {
      hideLoader();
    }
  };

  /* ============================================================
     5. واجهة مستندات الإيداع البنكي (depositDocs UI)
     ============================================================ */
  window.renderAdminDepositDocs = function () {
    const docs = AppData.depositDocs || [];
    
    if (!State.depositDocsTab) State.depositDocsTab = 'all';
    const activeSubTab = State.depositDocsTab;

    const pendingDocs = docs.filter(d => d.status === 'pending');
    const approvedDocs = docs.filter(d => d.status === 'approved');
    const rejectedDocs = docs.filter(d => d.status === 'rejected');

    let displayDocs = docs;
    if (activeSubTab === 'pending') displayDocs = pendingDocs;
    else if (activeSubTab === 'approved') displayDocs = approvedDocs;
    else if (activeSubTab === 'rejected') displayDocs = rejectedDocs;

    const searchQuery = (State.adminSearch || '').toLowerCase().trim();
    if (searchQuery) {
      displayDocs = displayDocs.filter(d =>
        (d.userName || '').toLowerCase().includes(searchQuery) ||
        (d.referenceId || '').toLowerCase().includes(searchQuery) ||
        (d.amount || 0).toString().includes(searchQuery) ||
        (d.bankName || '').toLowerCase().includes(searchQuery)
      );
    }

    const typeLabel = { wallet_recharge: '📥 شحن محفظة', order_payment: '📦 دفع طلب حجز' };
    const statusBadge = { pending: 'badge-gold', approved: 'badge-teal', rejected: 'badge-rose' };
    const statusText = { pending: '⏳ قيد المراجعة', approved: '✅ تم القبول', rejected: '❌ مرفوض' };

    return `
      <style>
        .dep-tab-btn {
          flex-shrink: 0;
          border: 0;
          padding: 8px 14px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 11.5px;
          background: none;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .dep-tab-btn.active {
          background: var(--primary) !important;
          color: #fff !important;
        }
      </style>

      <div class="admin-orders-container">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
          <div>
            <h2 style="font-size:22px;font-weight:800;margin:0">📄 مستندات الإيداع البنكي</h2>
            <p style="color:var(--text-muted);font-size:12px;margin:4px 0 0 0">مراجعة وتأكيد كافة إيصالات التحويل البنكي المرفوعة من العملاء لشحن المحافظ أو دفع الطلبات</p>
          </div>
          <input type="text" class="form-control" id="admin-dep-search" placeholder="ابحث بالاسم أو المبلغ أو الرقم المرجعي..." value="${State.adminSearch || ''}" oninput="State.adminSearch = this.value; render();" style="width:280px; font-family:'Tajawal', sans-serif; font-size:12px">
        </div>

        <div class="orders-tab-switcher" style="display:flex;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:4px;margin-bottom:20px;gap:6px">
          <button class="dep-tab-btn ${activeSubTab === 'all' ? 'active' : ''}" onclick="State.depositDocsTab='all';render();">
            <span>الكل</span>
            <span class="order-tab-badge" style="font-size:10px;background:rgba(255,255,255,0.15);padding:1px 6px;border-radius:99px;">${docs.length}</span>
          </button>
          <button class="dep-tab-btn ${activeSubTab === 'pending' ? 'active' : ''}" onclick="State.depositDocsTab='pending';render();">
            <span>⏳ قيد الانتظار</span>
            <span class="order-tab-badge" style="font-size:10px;background:rgba(255,255,255,0.15);padding:1px 6px;border-radius:99px;">${pendingDocs.length}</span>
          </button>
          <button class="dep-tab-btn ${activeSubTab === 'approved' ? 'active' : ''}" onclick="State.depositDocsTab='approved';render();">
            <span>✅ المقبولة</span>
            <span class="order-tab-badge" style="font-size:10px;background:rgba(255,255,255,0.15);padding:1px 6px;border-radius:99px;">${approvedDocs.length}</span>
          </button>
          <button class="dep-tab-btn ${activeSubTab === 'rejected' ? 'active' : ''}" onclick="State.depositDocsTab='rejected';render();">
            <span>❌ المرفوضة</span>
            <span class="order-tab-badge" style="font-size:10px;background:rgba(255,255,255,0.15);padding:1px 6px;border-radius:99px;">${rejectedDocs.length}</span>
          </button>
        </div>

        ${displayDocs.length ? `
          <div class="table-wrap" style="box-shadow: 0 4px 20px rgba(0,0,0,0.15); border-radius: 12px; border: 1px solid var(--border); overflow-x: auto; background: var(--bg-card); width: 100%">
            <table class="admin-table" style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>
                  <th>المستخدم</th>
                  <th>النوع</th>
                  <th>المبلغ</th>
                  <th>الحساب / البنك</th>
                  <th>الرقم المرجعي</th>
                  <th>تاريخ الإيداع</th>
                  <th>الحالة</th>
                  <th style="text-align:center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${displayDocs.map(d => `
                  <tr>
                    <td>
                      <div style="font-weight:600">${escHtml(d.userName)}</div>
                      <div style="font-size:10px;color:var(--text-secondary)">${escHtml(d.userPhone)} · <span class="badge" style="font-size:9px;padding:1px 4px">${d.userRole}</span></div>
                    </td>
                    <td>
                      <span style="font-weight:600">${typeLabel[d.depositType] || d.depositType}</span>
                    </td>
                    <td style="font-weight:800;color:#10b981;font-size:13px">${(d.amount||0).toLocaleString('ar-YE')} ر.ي</td>
                    <td><div style="font-weight:500">🏦 ${escHtml(d.bankName)}</div></td>
                    <td><span style="font-family:monospace;font-size:12px">${d.referenceId || '—'}</span></td>
                    <td style="color:var(--text-secondary)">${d.transferDate || '—'}</td>
                    <td><span class="badge ${statusBadge[d.status]}">${statusText[d.status]}</span></td>
                    <td style="text-align:center">
                      <div style="display:flex;gap:5px;justify-content:center">
                        <button class="btn btn-sm btn-secondary" onclick="ph53_viewDepositDoc('${d.id}')">تفاصيل وصورة</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state" style="background:var(--bg-card);border:1px dashed var(--border);border-radius:14px;padding:40px;text-align:center;color:var(--text-muted)">
            <div class="empty-icon" style="font-size:40px;margin-bottom:12px">🏦</div>
            <div class="empty-title" style="font-weight:700">لا توجد مستندات إيداع مطابقة حالياً</div>
          </div>
        `}
      </div>
    `;
  };

  window.ph53_viewDepositDoc = function (id) {
    const d = (AppData.depositDocs || []).find(x => x.id === id);
    if (!d) return;

    const typeLabel = { wallet_recharge: 'شحن رصيد المحفظة', order_payment: 'دفع حجز طلب' };

    openModal(`
      <div class="modal-header">
        <h2 class="modal-title">📄 تفاصيل مستند الإيداع</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div style="padding: 10px; text-align: right; direction: rtl; font-family:'Cairo',sans-serif; color:#fff">
        
        <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px;font-size:13px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><span style="color:var(--text-muted)">اسم المودع:</span> <strong>${escHtml(d.userName)}</strong></div>
          <div><span style="color:var(--text-muted)">رقم الجوال:</span> <strong>${escHtml(d.userPhone)}</strong></div>
          <div><span style="color:var(--text-muted)">المبلغ المودع:</span> <strong style="color:#10b981;font-size:16px">${(d.amount||0).toLocaleString('ar-YE')} ر.ي</strong></div>
          <div><span style="color:var(--text-muted)">نوع الإيداع:</span> <strong>${typeLabel[d.depositType] || d.depositType}</strong></div>
          <div style="grid-column: 1/-1"><span style="color:var(--text-muted)">الحساب المحول إليه:</span> <strong>🏦 ${escHtml(d.bankName)}</strong></div>
          <div><span style="color:var(--text-muted)">الرقم المرجعي:</span> <code>${d.referenceId || '—'}</code></div>
          <div><span style="color:var(--text-muted)">تاريخ المعاملة:</span> <strong>${d.transferDate || '—'}</strong></div>
          ${d.status !== 'pending' ? `<div style="grid-column: 1/-1"><span style="color:var(--text-muted)">المراجع:</span> <strong>${escHtml(d.reviewedBy || '—')}</strong></div>` : ''}
          ${d.status === 'rejected' && d.rejectReason ? `<div style="grid-column: 1/-1;color:#ef4444"><span style="color:var(--text-muted)">سبب الرفض:</span> <strong>${escHtml(d.rejectReason)}</strong></div>` : ''}
        </div>

        ${d.receiptUrl ? `
          <div style="margin-bottom:16px;text-align:center">
            <label class="form-label" style="display:block;text-align:right;font-weight:700">📸 إيصال التحويل المرفق:</label>
            <img src="${d.receiptUrl}" style="max-width:100%;max-height:350px;border-radius:12px;border:1.5px solid var(--border);box-shadow:0 4px 12px rgba(0,0,0,0.3)">
          </div>
        ` : '<div style="background:rgba(255,255,255,0.02);padding:20px;text-align:center;color:var(--text-muted);border-radius:12px;border:1px dashed var(--border);margin-bottom:16px">لا توجد صورة إيصال مرفقة</div>'}

        ${d.status === 'pending' ? `
          <div style="display:flex;gap:10px;margin-top:20px">
            <button class="btn btn-success" style="flex:1" onclick="ph53_approveDepositDoc('${d.id}')">✅ قبول واعتماد الإيداع</button>
            <button class="btn btn-danger" style="flex:1" onclick="ph53_rejectDepositDoc('${d.id}')">❌ رفض المستند</button>
          </div>
        ` : ''}
      </div>
    `);
  };

  window.ph53_approveDepositDoc = async function (docId) {
    const d = (AppData.depositDocs || []).find(x => x.id === docId);
    if (!d) return;

    if (!confirm(`هل أنت متأكد من قبول إيداع ${d.userName} بمبلغ ${d.amount.toLocaleString()} ريال؟`)) return;
    
    showLoader('جاري معالجة المعاملة...');
    try {
      const adminName = State.currentUser?.name || State.currentUser?.email || 'إداري';
      
      // 1. تحديث مستند الإيداع في depositDocs
      await fsUpdate('depositDocs', docId, {
        status: 'approved',
        reviewedBy: adminName,
        reviewedAt: new Date()
      });

      // 2. تحديث الإجراء الفعلي بناءً على نوع الإيداع
      if (d.depositType === 'wallet_recharge') {
        // شحن محفظة العميل
        await creditWallet(d.userId, parseInt(d.amount), 'شحن محفظة - موافقة إدارية على إيداع بنكي');
        
        // البحث عن طلب الشحن recharge_requests وتحديث حالته
        if (d.referenceId) {
          await fsUpdate('recharge_requests', d.referenceId, { status: 'approved' });
        }
      } else if (d.depositType === 'order_payment') {
        // تحديث حالة الطلب
        const order = (AppData.orders || []).find(o => o.orderId === d.referenceId || o.id === d.referenceId);
        if (order) {
          await fsUpdate('orders', order.id, { paymentStatus: 'paid', status: 'accepted' });
        }
        
        // البحث عن وثيقة bank_deposits وتحديث حالتها
        // قد نجدها عن طريق الاستعلام بالـ orderId
        const bankD = (AppData.bankDeposits || []).find(bd => bd.orderId === d.referenceId);
        if (bankD) {
          await fsUpdate('bank_deposits', bankD.id, {
            status: 'approved',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedBy: adminName
          });
        }
      }

      // 3. إرسال إشعار للعميل
      if (typeof saveNotificationToFirestore === 'function') {
        await saveNotificationToFirestore(d.userId, {
          title: '✅ تم قبول إيداعك بنجاح!',
          body: `تم اعتماد إيداعك البنكي بمبلغ ${d.amount.toLocaleString('ar-YE')} ر.ي بنجاح وإضافته لحسابك.`,
          type: 'deposit_approved',
          icon: '✅'
        });
      }

      // 4. كتابة سجل تدقيق
      await ph53_logAdminAction('approve_deposit', d.referenceId, `الموافقة على مستند الإيداع #${docId} للعميل ${d.userName} بمبلغ ${d.amount} ريال`);

      toast('✅ تم قبول الإيداع وتعديل الأرصدة بنجاح', 'success');
      closeModal();
      await loadAllData();
      await render();
    } catch (e) {
      toast('حدث خطأ أثناء معالجة الإيداع: ' + e.message, 'error');
    } finally {
      hideLoader();
    }
  };

  window.ph53_rejectDepositDoc = function (docId) {
    const d = (AppData.depositDocs || []).find(x => x.id === docId);
    if (!d) return;

    openModal(`
      <div class="modal-header">
        <h2 class="modal-title">❌ رفض مستند الإيداع</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div style="padding: 10px; text-align: right; direction: rtl; font-family:'Cairo',sans-serif; color:#fff">
        <div style="background:rgba(239,68,68,0.08);border:1.5px solid rgba(239,68,68,0.25);border-radius:12px;padding:12px;margin-bottom:16px;font-size:13px;color:#ef4444">
          ⚠️ سيتم إشعار العميل ${d.userName} برفض الإيداع مع إيضاح السبب
        </div>

        <div class="form-group">
          <label class="form-label">سبب الرفض *</label>
          <textarea id="dep-reject-reason" class="form-control" rows="3" placeholder="مثال: الصورة غير واضحة، تفاصيل التحويل غير متطابقة مع البنك..."></textarea>
        </div>

        <div style="display:flex;gap:10px;margin-top:20px">
          <button class="btn btn-danger" style="flex:1" onclick="ph53_confirmRejectDepositDoc('${docId}')">❌ تأكيد الرفض والإشعار</button>
          <button class="btn btn-secondary" style="flex:1" onclick="ph53_viewDepositDoc('${docId}')">رجوع</button>
        </div>
      </div>
    `);
  };

  window.ph53_confirmRejectDepositDoc = async function (docId) {
    const reason = document.getElementById('dep-reject-reason')?.value.trim();
    if (!reason) {
      toast('يجب إدخال سبب الرفض', 'warning');
      return;
    }

    const d = (AppData.depositDocs || []).find(x => x.id === docId);
    if (!d) return;

    showLoader('جاري الرفض...');
    try {
      const adminName = State.currentUser?.name || State.currentUser?.email || 'إداري';
      
      // 1. تحديث مستند الإيداع في depositDocs
      await fsUpdate('depositDocs', docId, {
        status: 'rejected',
        rejectReason: reason,
        reviewedBy: adminName,
        reviewedAt: new Date()
      });

      // 2. تحديث الإجراءات البينية
      if (d.depositType === 'wallet_recharge' && d.referenceId) {
        await fsUpdate('recharge_requests', d.referenceId, { status: 'rejected' });
      } else if (d.depositType === 'order_payment') {
        const order = (AppData.orders || []).find(o => o.orderId === d.referenceId || o.id === d.referenceId);
        if (order) {
          await fsUpdate('orders', order.id, { paymentStatus: 'rejected', status: 'pending_payment' });
        }
        
        const bankD = (AppData.bankDeposits || []).find(bd => bd.orderId === d.referenceId);
        if (bankD) {
          await fsUpdate('bank_deposits', bankD.id, {
            status: 'rejected',
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
            rejectedBy: adminName,
            rejectReason: reason
          });
        }
      }

      // 3. إرسال إشعار
      if (typeof saveNotificationToFirestore === 'function') {
        await saveNotificationToFirestore(d.userId, {
          title: '❌ تم رفض مستند الإيداع الخاص بك',
          body: `تم رفض الإيداع البنكي بمبلغ ${d.amount.toLocaleString('ar-YE')} ر.ي. السبب: ${reason}`,
          type: 'deposit_rejected',
          icon: '❌'
        });
      }

      // 4. كتابة سجل تدقيق
      await ph53_logAdminAction('reject_deposit', d.referenceId, `رفض مستند الإيداع #${docId} للعميل ${d.userName} بمبلغ ${d.amount} ريال. السبب: ${reason}`);

      toast('تم رفض مستند الإيداع وإشعار العميل', 'info');
      closeModal();
      await loadAllData();
      await render();
    } catch (e) {
      toast('حدث خطأ أثناء رفض الإيداع: ' + e.message, 'error');
    } finally {
      hideLoader();
    }
  };

  /* ============================================================
     6. واجهة أرشيف الطلبات (archivedOrders UI)
     ============================================================ */
  window.renderAdminArchivedOrders = function () {
    // الأرشيف لا يُحمل بالكامل عند البداية لتوفير الموارد.
    // نقوم بجلب البيانات من Firestore عند فتح هذه الصفحة ديناميكياً
    if (!State._archivedOrdersLoaded) {
      setTimeout(async () => {
        showLoader('جاري تحميل الأرشيف...');
        try {
          const list = await fsGetAll('archivedOrders');
          AppData.archivedOrders = list.sort((a,b) => {
            const ta = a.archivedAt?.seconds || 0;
            const tb = b.archivedAt?.seconds || 0;
            return tb - ta;
          });
          State._archivedOrdersLoaded = true;
          await render();
        } catch (e) {
          console.error(e);
        } finally {
          hideLoader();
        }
      }, 100);
      return `<div style="padding:40px;text-align:center;color:var(--text-muted);">⏳ جاري تحميل أرشيف الطلبات من الخادم...</div>`;
    }

    const list = AppData.archivedOrders || [];
    const searchQuery = (State.adminSearch || '').toLowerCase().trim();
    
    let displayList = list;
    if (searchQuery) {
      displayList = list.filter(o =>
        (o.orderId || '').toLowerCase().includes(searchQuery) ||
        (o.customerName || '').toLowerCase().includes(searchQuery) ||
        (o.svcName || '').toLowerCase().includes(searchQuery) ||
        (o.vendorName || '').toLowerCase().includes(searchQuery) ||
        (o.archiveReason || '').toLowerCase().includes(searchQuery)
      );
    }

    const sLabel = { completed: '📦 مكتمل', rejected: '❌ مرفوض', cancelled: '⚠️ ملغي' };
    const sBadge = { completed: 'badge-teal', rejected: 'badge-rose', cancelled: 'badge-rose' };

    return `
      <div class="admin-orders-container">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
          <div>
            <h2 style="font-size:22px;font-weight:800;margin:0">🗄️ أرشيف الطلبات المنتهية</h2>
            <p style="color:var(--text-muted);font-size:12px;margin:4px 0 0 0">كافة الطلبات المكتملة والمرفوضة والملغية التي تمت أرشفتها لتخفيف ضغط التحميل وتخزينها بأمان</p>
          </div>
          <div style="display:flex;gap:10px">
            <input type="text" class="form-control" id="admin-arch-search" placeholder="ابحث بالرقم، الخدمة، العميل..." value="${State.adminSearch || ''}" oninput="State.adminSearch = this.value; render();" style="width:280px; font-family:'Tajawal', sans-serif; font-size:12px">
            <button class="btn btn-secondary btn-sm" onclick="State._archivedOrdersLoaded=false;render();">🔄 تحديث</button>
          </div>
        </div>

        ${displayList.length ? `
          <div class="table-wrap" style="box-shadow: 0 4px 20px rgba(0,0,0,0.15); border-radius: 12px; border: 1px solid var(--border); overflow-x: auto; background: var(--bg-card); width: 100%">
            <table class="admin-table" style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>
                  <th>رقم الطلب</th>
                  <th>الخدمة</th>
                  <th>العميل</th>
                  <th>المزود / الشريك</th>
                  <th>التكلفة</th>
                  <th>تاريخ الأرشفة</th>
                  <th>سبب الأرشفة</th>
                  <th style="text-align:center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${displayList.map(o => {
                  const archDate = o.archivedAt 
                    ? (o.archivedAt.toDate ? o.archivedAt.toDate() : new Date(o.archivedAt.seconds * 1000 || o.archivedAt))
                    : null;
                  const archDateStr = archDate ? archDate.toLocaleDateString('ar-YE') : '—';
                  return `
                    <tr>
                      <td><span style="font-family:monospace;font-weight:700">#${o.orderId || o.id.substring(0,8)}</span></td>
                      <td><strong>${escHtml(o.svcName)}</strong></td>
                      <td>${escHtml(o.customerName || o.userName || '—')}</td>
                      <td>${escHtml(o.vendorName || o.providerName || '—')}</td>
                      <td style="font-weight:800;color:#10b981">${(o.total || o.finalPrice || 0).toLocaleString('ar-YE')} ر.ي</td>
                      <td>${archDateStr}</td>
                      <td><span class="badge ${sBadge[o.archiveReason] || 'badge-purple'}">${sLabel[o.archiveReason] || o.archiveReason}</span></td>
                      <td style="text-align:center">
                        <div style="display:flex;gap:5px;justify-content:center">
                          <button class="btn btn-sm btn-secondary" onclick="showOrderDetails('${o.id}')">تفاصيل</button>
                          <button class="btn btn-sm btn-secondary" style="background:#7c3aed;color:#fff;border-color:#7c3aed" onclick="ph6_generateInvoice('${o.id}')">Invoice</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state" style="background:var(--bg-card);border:1px dashed var(--border);border-radius:14px;padding:40px;text-align:center;color:var(--text-muted)">
            <div class="empty-icon" style="font-size:40px;margin-bottom:12px">🗄️</div>
            <div class="empty-title" style="font-weight:700">لا توجد طلبات مؤرشفة مطابقة حالياً</div>
          </div>
        `}
      </div>
    `;
  };

  /* ============================================================
     7. واجهة اتفاقيات ومستندات العمل (platformAgreements UI)
     ============================================================ */
  window.renderAdminPlatformAgreements = function () {
    const list = AppData.agreements || [];
    const searchQuery = (State.adminSearch || '').toLowerCase().trim();
    
    let displayList = list;
    if (searchQuery) {
      displayList = list.filter(a =>
        (a.userName || '').toLowerCase().includes(searchQuery) ||
        (a.userRole || '').toLowerCase().includes(searchQuery) ||
        (a.version || '').toLowerCase().includes(searchQuery)
      );
    }

    if (!State.agreementEditorTab) State.agreementEditorTab = 'signed';
    const activeSubTab = State.agreementEditorTab;

    return `
      <style>
        .agr-sub-tab-btn {
          flex-shrink: 0;
          border: 0;
          padding: 8px 14px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 11.5px;
          background: none;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .agr-sub-tab-btn.active {
          background: var(--primary) !important;
          color: #fff !important;
        }
      </style>

      <div class="admin-orders-container">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
          <div>
            <h2 style="font-size:22px;font-weight:800;margin:0">📝 اتفاقيات وعقود العمل</h2>
            <p style="color:var(--text-muted);font-size:12px;margin:4px 0 0 0">متابعة شروط المنصة وعقود العمولات الموقعة مع مزودي الخدمات والمندوبين، وتعديل البنود ديناميكياً</p>
          </div>
          <input type="text" class="form-control" id="admin-agr-search" placeholder="ابحث باسم الشريك أو دوره..." value="${State.adminSearch || ''}" oninput="State.adminSearch = this.value; render();" style="width:280px; font-family:'Tajawal', sans-serif; font-size:12px">
        </div>

        <div class="orders-tab-switcher" style="display:flex;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:4px;margin-bottom:20px;gap:6px">
          <button class="agr-sub-tab-btn ${activeSubTab === 'signed' ? 'active' : ''}" onclick="State.agreementEditorTab='signed';render();">
            <span>✍️ الشركاء الموقعون</span>
            <span class="order-tab-badge" style="font-size:10px;background:rgba(255,255,255,0.15);padding:1px 6px;border-radius:99px;">${list.length}</span>
          </button>
          <button class="agr-sub-tab-btn ${activeSubTab === 'vendor_template' ? 'active' : ''}" onclick="State.agreementEditorTab='vendor_template';ph53_loadTemplate('provider');">
            <span>🛠️ تعديل اتفاقية مزودي الخدمات</span>
          </button>
          <button class="agr-sub-tab-btn ${activeSubTab === 'driver_template' ? 'active' : ''}" onclick="State.agreementEditorTab='driver_template';ph53_loadTemplate('driver');">
            <span>🛵 تعديل اتفاقية المندوبين</span>
          </button>
        </div>

        ${activeSubTab === 'signed' ? `
          ${displayList.length ? `
            <div class="table-wrap" style="box-shadow: 0 4px 20px rgba(0,0,0,0.15); border-radius: 12px; border: 1px solid var(--border); overflow-x: auto; background: var(--bg-card); width: 100%">
              <table class="admin-table" style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr>
                    <th>اسم الشريك / المندوب</th>
                    <th>الدور في المنصة</th>
                    <th>نوع الاتفاقية الموقعة</th>
                    <th>الإصدار البنود</th>
                    <th>تاريخ التوقيع الرقمي</th>
                    <th>عنوان IP</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  ${displayList.map(a => {
                    const signDate = a.signedAt 
                      ? (a.signedAt.toDate ? a.signedAt.toDate() : new Date(a.signedAt.seconds * 1000 || a.signedAt))
                      : null;
                    const signDateStr = signDate ? signDate.toLocaleString('ar-YE') : '—';
                    return `
                      <tr>
                        <td><strong>${escHtml(a.userName)}</strong></td>
                        <td><span class="badge ${a.userRole === 'provider' ? 'badge-teal' : 'badge-gold'}">${a.userRole === 'provider' ? 'صاحب خدمة' : 'مندوب'}</span></td>
                        <td>${a.agreementType === 'vendor_terms' ? '📝 اتفاقية شركاء تقديم الخدمات' : '🛵 عقد توصيل وعمولات'}</td>
                        <td><span class="badge badge-purple">v${a.version}</span></td>
                        <td>${signDateStr}</td>
                        <td><code>${escHtml(a.ipAddress || '127.0.0.1')}</code></td>
                        <td><span class="badge badge-teal">✅ تم قبولها وتوقيعها</span></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="empty-state" style="background:var(--bg-card);border:1px dashed var(--border);border-radius:14px;padding:40px;text-align:center;color:var(--text-muted)">
              <div class="empty-icon" style="font-size:40px;margin-bottom:12px">✍️</div>
              <div class="empty-title" style="font-weight:700">لا يوجد شركاء موقعون مطابقون للبحث حالياً</div>
            </div>
          `}
        ` : `
          <!-- تعديل اتفاقية قالب -->
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;max-width:760px">
            <h3 style="margin-bottom:12px">🛠️ تعديل محتوى الاتفاقية</h3>
            <p style="color:var(--text-muted);font-size:12px;margin-bottom:20px">عند تعديل النص وزيادة رقم الإصدار، سيُطلب من أي شريك (مسجل مسبقاً أو جديد) الموافقة والتوقيع على الشروط الجديدة عند دخوله التالي للوحته.</p>
            
            <div class="form-group">
              <label class="form-label">العنوان الرئيسي للاتفاقية</label>
              <input type="text" id="tpl-title" class="form-control" placeholder="مثال: اتفاقية تقديم الخدمات والانضمام للمنصة" value="">
            </div>
            
            <div class="form-group" style="margin-top:12px">
              <label class="form-label">رقم الإصدار (يزاد عند تعديل البنود الجوهرية)</label>
              <input type="text" id="tpl-ver" class="form-control" style="width:120px;text-align:center;font-weight:700" placeholder="1.0">
            </div>

            <div class="form-group" style="margin-top:12px">
              <label class="form-label">شروط وبنود الاتفاقية بالتفصيل</label>
              <textarea id="tpl-text" class="form-control" rows="12" style="font-family:'Tajawal',sans-serif;line-height:1.6;font-size:13px" placeholder="اكتب البنود والشروط والعمولات هنا..."></textarea>
            </div>

            <button class="btn btn-primary" style="margin-top:20px" onclick="ph53_saveAgreementTemplate('${activeSubTab === 'vendor_template' ? 'provider' : 'driver'}')">
              💾 حفظ الاتفاقية وتعميم الإصدار الجديد
            </button>
          </div>
        `}
      </div>
    `;
  };

  window.ph53_loadTemplate = async function (role) {
    showLoader('جاري استرجاع القالب...');
    const docId = role === 'provider' ? 'provider_agreement_terms' : 'driver_agreement_terms';
    try {
      const tpl = await fsGet('platform_settings', docId);
      render(); // نحدث الشاشة ليظهر البناء أولاً
      setTimeout(() => {
        const titleInput = document.getElementById('tpl-title');
        const verInput = document.getElementById('tpl-ver');
        const textInput = document.getElementById('tpl-text');
        
        if (titleInput && tpl) titleInput.value = tpl.title || '';
        if (verInput && tpl) verInput.value = tpl.version || '1.0';
        if (textInput && tpl) textInput.value = tpl.text || '';
      }, 80);
    } catch (e) {
      toast('تعذر جلب القالب: ' + e.message, 'error');
    } finally {
      hideLoader();
    }
  };

  window.ph53_saveAgreementTemplate = async function (role) {
    const title = document.getElementById('tpl-title')?.value.trim();
    const version = document.getElementById('tpl-ver')?.value.trim();
    const text = document.getElementById('tpl-text')?.value.trim();

    if (!title || !version || !text) {
      toast('يرجى تعبئة كافة الحقول لحفظ الاتفاقية', 'warning');
      return;
    }

    showLoader('جاري حفظ وتعميم القالب الجديد...');
    const docId = role === 'provider' ? 'provider_agreement_terms' : 'driver_agreement_terms';
    try {
      await fsSet('platform_settings', docId, {
        title,
        version,
        text,
        updatedAt: new Date()
      });

      // إضافة سجل تدقيق
      const roleStr = role === 'provider' ? 'مزودي الخدمات' : 'المندوبين';
      await ph53_logAdminAction('update_agreement', docId, `تحديث شروط اتفاقية العمل الخاصة بـ ${roleStr} للإصدار ${version}`);

      toast('✅ تم حفظ قالب الاتفاقية وتحديث الإصدار بنجاح', 'success');
      State.agreementEditorTab = 'signed';
      await loadAllData();
      await render();
    } catch (e) {
      toast('حدث خطأ أثناء حفظ القالب: ' + e.message, 'error');
    } finally {
      hideLoader();
    }
  };


  /* ============================================================
     8. واجهة العمليات الإدارية الإضافية (سجلات التدقيق والإعلانات)
     ============================================================ */
  window.renderAdminAuditLogs = function () {
    if (!State._auditLogsLoaded) {
      setTimeout(async () => {
        showLoader('تحميل سجلات التدقيق...');
        try {
          const list = await fsGetAll('auditLogs');
          AppData.auditLogs = list.sort((a,b) => {
            const ta = a.createdAt?.seconds || 0;
            const tb = b.createdAt?.seconds || 0;
            return tb - ta;
          });
          State._auditLogsLoaded = true;
          await render();
        } catch(e) {
          console.error(e);
        } finally {
          hideLoader();
        }
      }, 100);
      return `<div style="padding:40px;text-align:center;color:var(--text-muted);">⏳ جاري تحميل سجلات التدقيق الإداري...</div>`;
    }

    const list = AppData.auditLogs || [];
    const searchQuery = (State.adminSearch || '').toLowerCase().trim();
    
    let displayList = list;
    if (searchQuery) {
      displayList = list.filter(l =>
        (l.actorName || '').toLowerCase().includes(searchQuery) ||
        (l.actionType || '').toLowerCase().includes(searchQuery) ||
        (l.description || '').toLowerCase().includes(searchQuery)
      );
    }

    const actionNames = {
      approve_deposit: '🏦 موافقة إيداع',
      reject_deposit: '❌ رفض إيداع',
      archive_order: '🗄️ أرشفة طلب',
      update_agreement: '📝 تعديل اتفاقية',
      adjust_wallet: '💳 تعديل محفظة'
    };

    return `
      <div class="admin-orders-container">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
          <div>
            <h2 style="font-size:22px;font-weight:800;margin:0">📋 سجل العمليات والتدقيق الإداري</h2>
            <p style="color:var(--text-muted);font-size:12px;margin:4px 0 0 0">سجل تراكمي غير قابل للتعديل يوثق كافة الإجراءات الحساسة التي تتم من قبل مسؤولي وموظفي المنصة</p>
          </div>
          <div style="display:flex;gap:10px">
            <input type="text" class="form-control" id="admin-aud-search" placeholder="ابحث بالمسؤول، الإجراء..." value="${State.adminSearch || ''}" oninput="State.adminSearch = this.value; render();" style="width:280px; font-family:'Tajawal', sans-serif; font-size:12px">
            <button class="btn btn-secondary btn-sm" onclick="State._auditLogsLoaded=false;render();">🔄 تحديث</button>
          </div>
        </div>

        ${displayList.length ? `
          <div class="table-wrap" style="box-shadow: 0 4px 20px rgba(0,0,0,0.15); border-radius: 12px; border: 1px solid var(--border); overflow-x: auto; background: var(--bg-card); width: 100%">
            <table class="admin-table" style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>
                  <th>المسؤول</th>
                  <th>نوع العملية</th>
                  <th>الوصف والحدث الموثّق</th>
                  <th>المعرف المستهدف</th>
                  <th>تاريخ العملية</th>
                  <th>IP الجلسة</th>
                </tr>
              </thead>
              <tbody>
                ${displayList.map(l => {
                  const dObj = l.createdAt 
                    ? (l.createdAt.toDate ? l.createdAt.toDate() : new Date(l.createdAt.seconds * 1000 || l.createdAt))
                    : null;
                  const dateStr = dObj ? dObj.toLocaleString('ar-YE') : '—';
                  return `
                    <tr>
                      <td><strong>👤 ${escHtml(l.actorName)}</strong></td>
                      <td><span class="badge badge-purple">${actionNames[l.actionType] || l.actionType}</span></td>
                      <td style="white-space:normal;font-weight:500;max-width:350px">${escHtml(l.description)}</td>
                      <td><code>${l.targetId || '—'}</code></td>
                      <td style="color:var(--text-secondary)">${dateStr}</td>
                      <td><code>${escHtml(l.ipAddress || '127.0.0.1')}</code></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state" style="background:var(--bg-card);border:1px dashed var(--border);border-radius:14px;padding:40px;text-align:center;color:var(--text-muted)">
            <div class="empty-icon" style="font-size:40px;margin-bottom:12px">📋</div>
            <div class="empty-title" style="font-weight:700">لا توجد سجلات تدقيق مطابقة حالياً</div>
          </div>
        `}
      </div>
    `;
  };

  /* ==========================================
     تثبيت نصوص الاتفاقيات عند تحميل التطبيق
     ========================================== */
  setTimeout(() => {
    ph53_ensureAgreementTemplates();
  }, 1000);

})();

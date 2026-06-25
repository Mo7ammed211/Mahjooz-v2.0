/* ============================================================
   Help Center — مركز المساعدة والأسئلة الشائعة
   ------------------------------------------------------------
   صفحة كاملة مستقلة بتبويبات للعملاء / المزودين / المندوبين
   مع بحث داخلي لحظي
   ============================================================ */
'use strict';

(function () {

  // ── قاعدة بيانات الأسئلة الشائعة ──────────────────────────
  const FAQ = {
    customer: [
      {
        cat: '🚀 البداية والتسجيل',
        items: [
          { q: 'كيف أسجل حساباً جديداً؟', a: 'اضغط "إنشاء حساب" في شاشة الدخول، أدخل اسمك ورقم هاتفك وأنشئ كلمة مرور. سيُرسَل رمز تحقق لرقمك وبعد إدخاله يُفعَّل حسابك فوراً.' },
          { q: 'نسيت كلمة المرور، ماذا أفعل؟', a: 'في شاشة تسجيل الدخول اضغط "نسيت كلمة المرور"، أدخل رقم هاتفك المسجل وسيصلك رمز إعادة التعيين.' },
          { q: 'هل يمكنني استخدام المنصة بدون تسجيل؟', a: 'يمكنك تصفح الخدمات والمنتجات بدون تسجيل، لكن الحجز والشراء والدفع يتطلب حساباً مفعَّلاً.' }
        ]
      },
      {
        cat: '📅 الحجز والخدمات',
        items: [
          { q: 'كيف أحجز خدمة؟', a: 'من الصفحة الرئيسية اختر القسم المطلوب (حجوزات / خدمات / متاجر / تأجير)، اضغط على الخدمة ثم "أضف للسلة" أو "احجز الآن". حدد الموعد وأكمل الدفع.' },
          { q: 'هل يمكنني حجز أكثر من خدمة في طلب واحد؟', a: 'نعم! استخدم "أضف للسلة" لجمع أي عدد من الخدمات أو المنتجات ثم أتمّ الدفع مرة واحدة لكل ما في السلة.' },
          { q: 'كيف أعرف أن حجزي تم بنجاح؟', a: 'ستصلك رسالة إشعار فور تأكيد حجزك. يمكنك أيضاً متابعة حالة طلبك من قسم "طلباتي" في أي وقت.' },
          { q: 'هل يمكنني تعديل موعد الحجز؟', a: 'يمكن تعديل الموعد قبل قبول الطلب من المزود. بعد القبول تواصل مع الدعم عبر واتساب.' }
        ]
      },
      {
        cat: '💰 الدفع والمحفظة',
        items: [
          { q: 'ما طرق الدفع المتاحة؟', a: 'المحفظة الرقمية (محجوز)، الدفع عند الاستلام نقداً، أو الإيداع البنكي المسبق مع رفع الإيصال.' },
          { q: 'كيف أشحن محفظتي؟', a: 'من "محفظتي" اضغط "شحن الرصيد". أرسل المبلغ لأحد أرقام حسابات المنصة (المعروضة هناك) وارفع صورة الإيصال. سيُضاف الرصيد خلال دقائق.' },
          { q: 'هل الدفع بالمحفظة آمن؟', a: 'نعم، الدفع بالمحفظة هو الطريقة الأكثر أماناً وأسرعها. لا تُشارك رمز التحقق مع أحد.' },
          { q: 'كيف أطلب استرداد مبلغ؟', a: 'في حال إلغاء طلب مدفوع، يُعاد المبلغ لمحفظتك تلقائياً خلال 24 ساعة. للطلبات المختلفة تواصل مع الدعم.' }
        ]
      },
      {
        cat: '📦 التوصيل والتتبع',
        items: [
          { q: 'كيف أتتبع طلبي؟', a: 'من "طلباتي" اضغط على الطلب النشط لترى تفاصيله وحالته الحالية. عند خروج المندوب تظهر خريطة تتبع حية.' },
          { q: 'كم تستغرق مدة التوصيل؟', a: 'تختلف المدة حسب نوع الخدمة والمنطقة. المتاجر عادةً 30-60 دقيقة. الخدمات المهنية حسب الموعد المحدد.' },
          { q: 'ماذا أفعل إذا تأخر المندوب؟', a: 'من تفاصيل الطلب يمكنك الاتصال بالمندوب مباشرة. أو تواصل مع الدعم عبر واتساب لمتابعة الموضوع.' }
        ]
      },
      {
        cat: '⭐ التقييم والمكافآت',
        items: [
          { q: 'كيف أقيّم الخدمة؟', a: 'بعد اكتمال الطلب ستظهر نافذة التقييم تلقائياً. يمكنك أيضاً تقييم أي طلب مكتمل من صفحة "طلباتي".' },
          { q: 'كيف تعمل نقاط الولاء؟', a: 'تحصل على نقاط تلقائياً مع كل طلب مكتمل. النقاط تتراكم وتحولها لرصيد حقيقي في محفظتك للشراء به لاحقاً.' }
        ]
      }
    ],
    vendor: [
      {
        cat: '💼 إدارة الحساب',
        items: [
          { q: 'كيف أسجل كمزود خدمة؟', a: 'تواصل مع إدارة المنصة لفتح حساب مزود. بعد الموافقة ستصلك بيانات الدخول وتعليمات إعداد ملفك التجاري.' },
          { q: 'كيف أحدث معلومات متجري؟', a: 'من لوحة التحكم اذهب لـ "الإعدادات" ← "معلومات المتجر" وعدّل الاسم والوصف والصور وأوقات العمل.' },
          { q: 'كيف أحدد منطقة التغطية؟', a: 'من الإعدادات ← "منطقة الخدمة" حدد المناطق التي تخدمها. ستصلك فقط طلبات من هذه المناطق.' }
        ]
      },
      {
        cat: '📋 إدارة الطلبات',
        items: [
          { q: 'كيف أقبل أو أرفض طلباً؟', a: 'ستصلك إشعار بكل طلب جديد. من لوحة التحكم في "الطلبات الواردة" اضغط "قبول" أو "رفض مع ذكر السبب" خلال 5 دقائق.' },
          { q: 'ماذا يحدث إذا لم أرد على الطلب؟', a: 'الطلبات التي لا يُرد عليها خلال 5 دقائق تُحوَّل تلقائياً لمزود آخر في نفس المنطقة. تجنب ذلك لضمان تقييم جيد.' },
          { q: 'كيف أحدث حالة الطلب؟', a: 'من تفاصيل الطلب النشط اضغط الزر المناسب: "بدء التجهيز"، "جاهز للتسليم"، وعند اكتمال التوصيل ستُغلق تلقائياً.' }
        ]
      },
      {
        cat: '📦 إدارة المنتجات',
        items: [
          { q: 'كيف أضيف منتجاً جديداً؟', a: 'من "المنتجات" اضغط "إضافة من الكتالوج" لاختيار منتج موجود. إذا لم تجد المنتج اضغط "اقتراح منتج جديد" للإدارة.' },
          { q: 'كيف أغير سعر منتج؟', a: 'من قائمة منتجاتك اضغط على المنتج ← تعديل ← غيّر السعر واحفظ. يُطبَّق السعر الجديد فوراً على الطلبات الجديدة.' },
          { q: 'كيف أوقف منتجاً مؤقتاً؟', a: 'من قائمة منتجاتك اضغط زر التبديل (Toggle) بجانب المنتج لإيقافه مؤقتاً. لن يظهر للعملاء حتى تُعيد تفعيله.' }
        ]
      },
      {
        cat: '💵 الأرباح والمحفظة',
        items: [
          { q: 'متى تُضاف أرباحي؟', a: 'تُضاف أرباح كل طلب لمحفظتك فور تأكيد تسليمه واكتماله من العميل أو بعد 24 ساعة من التسليم.' },
          { q: 'كيف أطلب سحب الأرباح؟', a: 'من "محفظتي" اضغط "طلب سحب"، حدد المبلغ والحساب البنكي المسجل. يتم التحويل خلال 24-48 ساعة في أيام العمل.' },
          { q: 'ما نسبة عمولة المنصة؟', a: 'تختلف العمولة حسب نوع الخدمة وحجم المبيعات. يمكن الاطلاع على التفاصيل في صفحة "الإعدادات" أو التواصل مع مدير حسابك.' }
        ]
      }
    ],
    driver: [
      {
        cat: '🚗 العمل كمندوب',
        items: [
          { q: 'كيف أبدأ العمل كمندوب توصيل؟', a: 'تواصل مع إدارة المنصة لتسجيل بياناتك ومنطقتك. بعد الموافقة وإنشاء حسابك تبدأ باستقبال طلبات التوصيل في منطقتك.' },
          { q: 'كيف أحدد منطقة عملي؟', a: 'منطقة عملك تحددها الإدارة عند تسجيل حسابك. ستصلك فقط طلبات التوصيل الواقعة في نطاق منطقتك الجغرافية.' },
          { q: 'كيف أقبل طلب توصيل؟', a: 'عند وصول طلب توصيل جديد يصلك إشعار. اضغط "قبول" خلال 60 ثانية وإلا سينتقل للمندوب التالي.' }
        ]
      },
      {
        cat: '📦 إتمام التوصيل',
        items: [
          { q: 'كيف أصل لعنوان العميل؟', a: 'بعد استلام الطلب من المزود اضغط "اتجاهات" لفتح الخريطة. يمكنك الاتصال بالعميل من تفاصيل الطلب إذا لزم.' },
          { q: 'ماذا أفعل إذا لم يرد العميل؟', a: 'حاول الاتصال مرتين وانتظر 10 دقائق. إذا لم تتمكن من التوصيل أبلغ المشرف عبر التطبيق لاتخاذ القرار المناسب.' },
          { q: 'كيف أؤكد تسليم الطلب؟', a: 'من تفاصيل الطلب اضغط "تم التسليم" بعد استلام العميل للطلب. يمكن طلب توقيع رقمي أو صورة للإيصال حسب الإعداد.' }
        ]
      },
      {
        cat: '💵 الأجر والمكافآت',
        items: [
          { q: 'كيف يُحسَب أجر التوصيل؟', a: 'الأجر يُحسَب بناءً على المسافة وطبيعة الطلب. يظهر مبلغ الطلب قبل القبول حتى تقرر.' },
          { q: 'متى يُضاف أجري؟', a: 'يُضاف أجر كل توصيل لمحفظتك فور تأكيد الاستلام من العميل.' },
          { q: 'هل هناك مكافآت إضافية؟', a: 'نعم! مكافآت على الطلبات في أوقات الذروة، والتقييمات المرتفعة، وعدد الطلبات اليومية المرتفع.' }
        ]
      }
    ]
  };

  // ── دالة render صفحة مركز المساعدة ────────────────────────
  window.renderHelpCenter = function() {
    const tabs = [
      { key: 'customer', label: '👤 العملاء' },
      { key: 'vendor',   label: '💼 المزودون' },
      { key: 'driver',   label: '🚗 المندوبون' }
    ];

    function buildFAQ(role) {
      return (FAQ[role] || []).map(function(section, si) {
        const items = section.items.map(function(item, ii) {
          const id = 'faq-' + role + '-' + si + '-' + ii;
          return '<div class="faq-item" id="' + id + '">'
            + '<button class="faq-q" onclick="document.getElementById(\'' + id + '\').classList.toggle(\'open\')">'
            + '<span>' + item.q + '</span>'
            + '<span class="faq-arrow">▼</span>'
            + '</button>'
            + '<div class="faq-a">' + item.a + '</div>'
            + '</div>';
        }).join('');
        return '<div class="faq-section">'
          + '<div class="faq-cat-title">' + section.cat + '</div>'
          + items
          + '</div>';
      }).join('');
    }

    const defaultRole = (window.State && State.currentUser)
      ? (State.currentUser.role === 'driver' ? 'driver' : (State.currentUser.role === 'vendor' ? 'vendor' : 'customer'))
      : 'customer';

    return `<div id="app-content" style="max-width:800px;margin:0 auto;padding:16px">
      <style>
        .hcc-hero {
          background: linear-gradient(135deg,rgba(124,58,237,0.15),rgba(79,70,229,0.08));
          border: 1px solid rgba(124,58,237,0.2);
          border-radius: 20px; padding: 32px 24px; text-align: center;
          margin-bottom: 24px;
        }
        .hcc-hero h1 { font-size:24px; font-weight:900; margin-bottom:8px; }
        .hcc-search-wrap {
          position: relative; max-width:480px; margin:16px auto 0;
        }
        .hcc-search {
          width:100%; background:rgba(255,255,255,0.06);
          border:1px solid rgba(124,58,237,0.3); border-radius:99px;
          padding:12px 20px 12px 44px; font-size:14px;
          color:var(--text-main,#f1f5f9); outline:none;
          font-family:'Cairo',sans-serif; direction:rtl; text-align:right;
          transition:border-color 0.2s; box-sizing:border-box;
        }
        .hcc-search:focus { border-color:rgba(124,58,237,0.6); }
        .hcc-search-icon {
          position:absolute; left:14px; top:50%; transform:translateY(-50%);
          font-size:18px; pointer-events:none;
        }
        .hcc-tabs {
          display:flex; gap:8px; margin-bottom:20px; flex-wrap:wrap;
        }
        .hcc-tab {
          padding:9px 20px; border-radius:99px; font-size:13px; font-weight:800;
          border:1px solid rgba(124,58,237,0.2); cursor:pointer;
          background:rgba(255,255,255,0.04); color:var(--text-secondary,#94a3b8);
          font-family:'Cairo',sans-serif; transition:all 0.2s;
        }
        .hcc-tab.active {
          background:linear-gradient(135deg,#7c3aed,#4f46e5); color:white;
          border-color:transparent; box-shadow:0 4px 14px rgba(124,58,237,0.3);
        }
        .faq-section { margin-bottom:20px; }
        .faq-cat-title {
          font-size:13px; font-weight:800; color:#a78bfa;
          margin-bottom:10px; padding:6px 14px;
          background:rgba(124,58,237,0.08); border-radius:8px;
          display:inline-block;
        }
        .faq-item {
          background:var(--bg-card,#1e1e2e);
          border:1px solid var(--border,rgba(255,255,255,0.07));
          border-radius:12px; margin-bottom:8px; overflow:hidden;
          transition:border-color 0.2s;
        }
        .faq-item.open { border-color:rgba(124,58,237,0.3); }
        .faq-q {
          width:100%; background:none; border:none; cursor:pointer;
          padding:14px 16px; display:flex; justify-content:space-between;
          align-items:center; gap:12px; text-align:right; direction:rtl;
          color:var(--text-main,#f1f5f9); font-size:14px; font-weight:700;
          font-family:'Cairo',sans-serif; transition:background 0.2s;
        }
        .faq-q:hover { background:rgba(255,255,255,0.03); }
        .faq-arrow { font-size:10px; color:#a78bfa; transition:transform 0.3s; flex-shrink:0; }
        .faq-item.open .faq-arrow { transform:rotate(180deg); }
        .faq-a {
          max-height:0; overflow:hidden; padding:0 16px;
          font-size:13px; line-height:1.7; color:var(--text-secondary,#94a3b8);
          direction:rtl; text-align:right;
          transition:max-height 0.35s ease, padding 0.35s ease;
        }
        .faq-item.open .faq-a { max-height:300px; padding:0 16px 16px; }
        .hcc-contact-card {
          background:linear-gradient(135deg,rgba(37,211,102,0.08),rgba(37,211,102,0.04));
          border:1px solid rgba(37,211,102,0.25); border-radius:16px;
          padding:20px 24px; text-align:center; margin-top:24px;
        }
        .hcc-contact-title { font-size:16px; font-weight:800; margin-bottom:6px; }
        .hcc-contact-desc { font-size:13px; color:var(--text-secondary,#94a3b8); margin-bottom:14px; }
        .hcc-wa-btn {
          display:inline-flex; align-items:center; gap:8px;
          background:#25d366; color:white; border:none; border-radius:12px;
          padding:11px 24px; font-size:14px; font-weight:800;
          font-family:'Cairo',sans-serif; cursor:pointer; text-decoration:none;
          transition:all 0.2s;
        }
        .hcc-wa-btn:hover { transform:translateY(-2px); box-shadow:0 8px 20px rgba(37,211,102,0.35); }
        .no-results {
          text-align:center; padding:40px 20px;
          color:var(--text-muted,#64748b); font-size:14px;
        }
      </style>

      <!-- Hero -->
      <div class="hcc-hero">
        <h1>❓ مركز المساعدة</h1>
        <p style="color:var(--text-secondary,#94a3b8);font-size:14px;">ابحث عن إجابة لأي سؤال أو تصفح الأسئلة الشائعة</p>
        <div class="hcc-search-wrap">
          <span class="hcc-search-icon">🔍</span>
          <input class="hcc-search" id="hcc-search-input" placeholder="ابحث في الأسئلة..." oninput="window._hccSearch(this.value)" />
        </div>
      </div>

      <!-- Tabs -->
      <div class="hcc-tabs">
        ${tabs.map(function(t){
          return '<button class="hcc-tab' + (t.key===defaultRole?' active':'') + '" id="hcc-tab-'+t.key+'" onclick="window._hccTab(\''+t.key+'\')">' + t.label + '</button>';
        }).join('')}
      </div>

      <!-- FAQ Content -->
      <div id="hcc-content">
        ${buildFAQ(defaultRole)}
      </div>

      <!-- تواصل مع الدعم -->
      <div class="hcc-contact-card">
        <div class="hcc-contact-title">💬 لم تجد إجابتك؟</div>
        <div class="hcc-contact-desc">فريق دعم محجوز جاهز لمساعدتك مباشرة على مدار الساعة</div>
        <a class="hcc-wa-btn" href="https://wa.me/96777000000?text=${encodeURIComponent('مرحباً، أحتاج مساعدة في منصة محجوز')}" target="_blank">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
          تواصل عبر واتساب
        </a>
        <div style="margin-top:12px; display:flex; gap:8px; justify-content:center; flex-wrap:wrap">
          <button class="btn btn-sm" style="background:rgba(255,255,255,0.06);color:var(--text-secondary,#94a3b8);border:1px solid var(--border);border-radius:8px;padding:7px 16px;font-family:'Cairo',sans-serif;cursor:pointer" onclick="typeof startOnboardingTour==='function'&&startOnboardingTour()">🚀 أعد جولة التعريف بالمنصة</button>
          <button class="btn btn-sm btn-secondary" style="border:1px solid var(--border);border-radius:8px;padding:7px 16px;font-family:'Cairo',sans-serif;cursor:pointer" onclick="navigate('suggestions-complaints')">📝 تقديم اقتراح أو شكوى</button>
        </div>
      </div>
    </div>`;
  };

  // ── وظائف التبويبات والبحث ────────────────────────────────
  window._hccTab = function(role) {
    document.querySelectorAll('.hcc-tab').forEach(function(t){ t.classList.remove('active'); });
    var tab = document.getElementById('hcc-tab-' + role);
    if (tab) tab.classList.add('active');

    var content = document.getElementById('hcc-content');
    if (!content) return;
    content.innerHTML = buildFAQContent(role);
  };

  function buildFAQContent(role) {
    return (FAQ[role] || []).map(function(section, si) {
      const items = section.items.map(function(item, ii) {
        const id = 'faq-' + role + '-' + si + '-' + ii;
        return '<div class="faq-item" id="' + id + '">'
          + '<button class="faq-q" onclick="document.getElementById(\'' + id + '\').classList.toggle(\'open\')">'
          + '<span>' + item.q + '</span>'
          + '<span class="faq-arrow">▼</span>'
          + '</button>'
          + '<div class="faq-a">' + item.a + '</div>'
          + '</div>';
      }).join('');
      return '<div class="faq-section">'
        + '<div class="faq-cat-title">' + section.cat + '</div>'
        + items + '</div>';
    }).join('');
  }

  window._hccSearch = function(query) {
    const content = document.getElementById('hcc-content');
    if (!content) return;
    query = (query || '').trim().toLowerCase();
    if (!query) {
      // إعادة عرض التبويب النشط
      var activeTab = document.querySelector('.hcc-tab.active');
      var role = activeTab ? activeTab.id.replace('hcc-tab-','') : 'customer';
      content.innerHTML = buildFAQContent(role);
      return;
    }

    var results = [];
    ['customer','vendor','driver'].forEach(function(role) {
      (FAQ[role] || []).forEach(function(section) {
        section.items.forEach(function(item) {
          if (item.q.toLowerCase().includes(query) || item.a.toLowerCase().includes(query)) {
            results.push({ role: role, section: section.cat, q: item.q, a: item.a });
          }
        });
      });
    });

    if (!results.length) {
      content.innerHTML = '<div class="no-results">😕 لا توجد نتائج مطابقة لـ "<strong>' + query + '</strong>"<br>جرّب كلمة أخرى أو تواصل مع الدعم</div>';
      return;
    }

    content.innerHTML = results.map(function(r, i) {
      const id = 'sr-' + i;
      const roleLabel = r.role === 'vendor' ? '💼 مزود' : (r.role === 'driver' ? '🚗 مندوب' : '👤 عميل');
      return '<div class="faq-item" id="' + id + '">'
        + '<button class="faq-q" onclick="document.getElementById(\'' + id + '\').classList.toggle(\'open\')">'
        + '<span>' + r.q + ' <span style="font-size:10px;color:#a78bfa;font-weight:600;">' + roleLabel + '</span></span>'
        + '<span class="faq-arrow">▼</span>'
        + '</button>'
        + '<div class="faq-a">' + r.a + '</div>'
        + '</div>';
    }).join('');
  };

  // ── تسجيل الصفحة في الروتر ───────────────────────────────
  function registerRoute() {
    if (window.AppRoutes && typeof AppRoutes === 'object') {
      AppRoutes['help-center'] = window.renderHelpCenter;
    }
    // محاولة ثانية مع Pages object
    if (window.Pages && typeof Pages === 'object') {
      Pages['help-center'] = window.renderHelpCenter;
    }
  }

  setTimeout(registerRoute, 500);

  console.log('[HelpCenter] ✅ مركز المساعدة loaded ❓📚');
})();

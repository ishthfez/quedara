'use strict';
/* ============ تجميع أزرار الاستيراد + وضع الصيانة + شريط عدم الاتصال ============ */
(() => {
  const css = document.createElement('style');
  css.textContent = `
    main .bar [data-fee-import]:not(.qimp *){display:none!important}
    main .bar label:has([data-pay="importXlsx"]):not(.qimp *){display:none!important}
    main .bar label:has([data-pay="import"]):not(.qimp *){display:none!important}
    main .bar + .bar:has(label:has([data-pay="importXlsx"])):not(.qimp){display:none!important}
    .qsettools{display:none!important}
    .qsettools + p.muted{display:none!important}
    .card:has(.qsettools){display:none!important}
    .overlay{z-index:9999!important}
    .maint-screen{position:fixed;inset:0;z-index:99999;background:var(--navy-d,#13294b);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.5rem;color:#fff;text-align:center;padding:2rem}
    .maint-screen img{width:120px;height:120px;border-radius:24px;opacity:.9}
    .maint-screen h1{font-size:1.3rem;font-weight:700;margin:0;line-height:1.6}
    .maint-screen p{font-size:1rem;opacity:.7;margin:0}
    /* شريط عدم الاتصال */
    .offline-bar{position:fixed;top:0;right:0;left:0;z-index:99998;background:#b3372f;color:#fff;text-align:center;padding:.5rem 1rem;font-size:.9rem;font-weight:600;display:none}
    .offline-bar.show{display:block}
    body.is-offline .shell .content{padding-top:calc(2.2rem + var(--top-h,0px))!important}
  `;
  document.head.appendChild(css);

  /* ---- شريط عدم الاتصال ---- */
  const offBar = document.createElement('div');
  offBar.className = 'offline-bar';
  offBar.textContent = 'الخدمة تعمل بدون اتصال بالإنترنت، قد تعرض لك بيانات غير محدثة';
  document.body.prepend(offBar);

  function updateOnline() {
    const offline = !navigator.onLine;
    offBar.classList.toggle('show', offline);
    document.body.classList.toggle('is-offline', offline);
  }
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();

  /* ---- وضع الصيانة ---- */
  let maintEl = null;
  function checkMaint() {
    try {
      if (!db || !db.settings || !session) return;
      const on = !!db.settings.maintenance;
      const isAdmin = session.role === 'admin';
      if (on && !isAdmin) {
        if (!maintEl) {
          maintEl = document.createElement('div');
          maintEl.className = 'maint-screen';
          maintEl.innerHTML = '<img src="logo.png" alt=""><h1>الخدمة متوقفة في الوقت الحالي</h1><p>زوروُنا في وقت آخر</p>';
          document.body.appendChild(maintEl);
        }
        const app = document.getElementById('app'); if (app) app.style.display = 'none';
        const side = document.querySelector('.side'); if (side) side.style.display = 'none';
      } else {
        if (maintEl) { maintEl.remove(); maintEl = null; }
        const app = document.getElementById('app'); if (app) app.style.display = '';
        const side = document.querySelector('.side'); if (side) side.style.display = '';
      }
    } catch(e) {}
  }
  const maintObs = new MutationObserver(checkMaint);
  maintObs.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  setInterval(checkMaint, 2000);

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-maint-toggle]');
    if (!b || session?.role !== 'admin') return;
    const cur = !!db.settings.maintenance;
    const msg = cur ? 'إعادة تشغيل الموقع للجميع؟' : 'إيقاف الموقع؟ سيرى الجميع (عدا المديرين) رسالة «الخدمة متوقفة».';
    ask(msg, () => {
      db.settings.maintenance = !cur;
      save(); render();
      toast(cur ? 'تم تشغيل الموقع' : 'تم إيقاف الموقع — المديرون فقط يرونه');
    });
  });

  /* ---- قسم الاستيراد + زر الصيانة ---- */
  const prev = adminViews.settings;
  adminViews.settings = function() {
    const base = prev();
    const isAdm = session?.role === 'admin';
    const hasFeeImport = isAdm && window.QLFeeImport;
    const hasPayroll = !!window.Payroll;
    const maintOn = !!(db.settings && db.settings.maintenance);

    const sec = `<div class="card"><h2>استيراد</h2>
      <div class="row qimp" style="flex-wrap:wrap;gap:.5rem">
        <button type="button" class="btn" data-act="importMembers" data-k="students">استيراد طلاب من Excel / Sheets</button>
        <button type="button" class="btn" data-act="importMembers" data-k="teachers">استيراد معلمين من Excel / Sheets</button>
        ${hasFeeImport ? '<button type="button" class="btn" data-fee-import>استيراد دفعات الاشتراكات</button>' : ''}
        ${hasPayroll ? '<label class="btn" style="margin:0">استيراد الموظفين من ملف الرواتب (Excel)<input type="file" accept=".xlsx" data-pay="importXlsx" hidden></label>' : ''}
        ${hasPayroll ? '<label class="btn" style="margin:0">استيراد بيانات المرتبات (JSON)<input type="file" accept="application/json,.json" data-pay="import" hidden></label>' : ''}
      </div>
      <div class="row" style="flex-wrap:wrap;gap:.5rem;margin-top:.7rem">
        <button type="button" class="btn" data-act="dupOpen">الأسماء المتشابهة</button>
        <button type="button" class="btn ${window.QLHeads?.on() ? 'primary' : ''}" data-qheads>تعديل رؤوس الأعمدة: ${window.QLHeads?.on() ? 'مُشغَّل' : 'مُطفأ'}</button>
      </div>
      <p class="muted" style="margin:.5rem 0 0;font-size:.85rem">كل أدوات الاستيراد مجموعة هنا. عند استيراد ملف Excel أو Sheets، الأعمدة المعروفة تُستورد مباشرة وغيرها تظهر في «بيانات معلّقة».</p>
    </div>`;

    const maintSec = isAdm ? `<div class="card"><h2>حالة الموقع</h2>
      <p style="margin:0 0 .7rem">${maintOn ? '<span class="tag tag-no">الموقع متوقف حالياً</span> — المديرون فقط يرون التطبيق.' : '<span class="tag tag-ok">الموقع يعمل</span> — الجميع يستطيع الدخول.'}</p>
      <button type="button" class="btn ${maintOn ? 'primary' : 'danger'}" data-maint-toggle>${maintOn ? 'تشغيل الموقع' : 'إيقاف الموقع'}</button>
    </div>` : '';

    return sec + maintSec + base;
  };
})();

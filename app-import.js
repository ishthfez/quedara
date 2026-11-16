'use strict';
/* ============ تجميع كل أزرار الاستيراد في قسم واحد بالإعدادات ============ */
(() => {
  const css = document.createElement('style');
  css.textContent = `
    main .bar [data-fee-import]:not(.qimp *){display:none!important}
    main .bar label:has([data-pay="importXlsx"]):not(.qimp *){display:none!important}
    main .bar label:has([data-pay="import"]):not(.qimp *){display:none!important}
    main .bar + .bar:has(label:has([data-pay="importXlsx"])):not(.qimp){display:none!important}
    /* إخفاء قسم الاستيراد القديم من nav.js بالكامل */
    .qsettools{display:none!important}
    .qsettools + p.muted{display:none!important}
    .card:has(.qsettools){display:none!important}
  `;
  document.head.appendChild(css);

  const prev = adminViews.settings;
  adminViews.settings = function() {
    const base = prev();

    const isAdm = session?.role === 'admin';
    const hasFeeImport = isAdm && window.QLFeeImport;
    const hasPayroll = !!window.Payroll;

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

    return sec + base;
  };
})();

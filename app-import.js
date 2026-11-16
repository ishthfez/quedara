'use strict';
/* ============ تجميع كل أزرار الاستيراد في قسم واحد بالإعدادات ============
   يُحمَّل بعد nav.js فيعترض استبداله لـ adminViews.settings ويضيف كل أزرار الاستيراد.
   الأزرار الأصلية في الأقسام الأخرى تُخفى بـ CSS. */
(() => {
  /* 1) CSS: إخفاء أزرار الاستيراد من مواقعها الأصلية (إلا في الإعدادات) */
  const css = document.createElement('style');
  css.textContent = `
    /* أزرار الاستيراد في الأقسام الأخرى */
    main .bar [data-fee-import]:not(.qimp *){display:none!important}
    main .bar label:has([data-pay="importXlsx"]):not(.qimp *){display:none!important}
    main .bar label:has([data-pay="import"]):not(.qimp *){display:none!important}
    main .bar + .bar:has(label:has([data-pay="importXlsx"])):not(.qimp){display:none!important}
    /* النص القديم الذي يشير لـاستيراد الدفعات */
    .qsettools + p.muted{display:none!important}
  `;
  document.head.appendChild(css);

  /* 2) استبدال قسم الإعدادات: قسم «استيراد» شامل */
  const prev = adminViews.settings;
  adminViews.settings = function() {
    const base = prev();
    /* إزالة قسم «الاستيراد والمراجعة» القديم من nav.js — سنستبدله بقسمنا الجديد */
    const cleaned = base.replace(/<div class="card"><h2>الاستيراد والمراجعة<\/h2>[\s\S]*?<\/div>\s*<\/div>/, '');

    const isAdm = session?.role === 'admin';
    const hasFeeImport = isAdm && window.QLFeeImport;
    const hasPayroll = !!window.Payroll;

    const sec = `<div class="card"><h2>استيراد</h2>
      <div class="row qimp" style="flex-wrap:wrap;gap:.5rem">
        <button type="button" class="btn" data-act="importMembers" data-k="students">استيراد طلاب من Excel / Sheets</button>
        <button type="button" class="btn" data-act="importMembers" data-k="teachers">استيراد معلمين من Excel / Sheets</button>
        ${hasFeeImport ? '<button type="button" class="btn" data-fee-import>\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u062f\u0641\u0639\u0627\u062a \u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643\u0627\u062a</button>' : ''}
        ${hasPayroll ? '<label class="btn" style="margin:0">\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0627\u0644\u0645\u0648\u0638\u0641\u064a\u0646 \u0645\u0646 \u0645\u0644\u0641 \u0627\u0644\u0631\u0648\u0627\u062a\u0628 (Excel)<input type="file" accept=".xlsx" data-pay="importXlsx" hidden></label>' : ''}
        ${hasPayroll ? '<label class="btn" style="margin:0">\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u0631\u062a\u0628\u0627\u062a (JSON)<input type="file" accept="application/json,.json" data-pay="import" hidden></label>' : ''}
      </div>
      <div class="row" style="flex-wrap:wrap;gap:.5rem;margin-top:.7rem">
        <button type="button" class="btn" data-act="dupOpen">الأسماء المتشابهة</button>
        <button type="button" class="btn ${window.QLHeads?.on() ? 'primary' : ''}" data-qheads>تعديل رؤوس الأعمدة: ${window.QLHeads?.on() ? '\u0645\u064f\u0634\u063a\u064e\u0651\u0644' : '\u0645\u064f\u0637\u0641\u0623'}</button>
      </div>
      <p class="muted" style="margin:.5rem 0 0;font-size:.85rem">كل أدوات الاستيراد مجموعة هنا. عند استيراد ملف Excel أو Sheets، الأعمدة المعروفة تُستورد مباشرة وغيرها تظهر في «بيانات معلّقة».</p>
    </div>`;

    return sec + cleaned;
  };
})();

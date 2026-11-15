'use strict';
/* ============ صف أدوات واحد فوق كل جدول، بأيقونات ============
   في كل بطاقة فيها شريط أدوات (تصفية، بحث، أزرار) وجدول واحد:
     - ينتقل شريط البطاقة إلى صف أدوات الجدول نفسه (التكبير وExcel وPDF والطباعة)، فيصيران صفًا واحدًا.
       (شريط البطاقة هو الذي ينتقل لا العكس: أزرار الجدول تجد جدولها بأنه العنصر الذي يلي صفها مباشرة)
     - الأزرار المعروفة تصير أيقونات، واسمها يظهر عند الوقوف عليها (وعند الضغط المطوّل على الجوال)، والعدد في رقم صغير.
     - Excel وPDF أيقونتان ملوّنتان (جدول أخضر، ومستند أحمر مكتوب عليه PDF) بدل الكلمة.
     - ملاحظة الإرشاد تحت الشريط تُخفى، ما عدا التنبيهات المهمة (شريط «إصلاح» وما فيه أزرار).
     - زر «إضافة» آخر الصف (على اليسار)، والأزرار متجاورة بعد التصفية والبحث.
     - التكبير والتصغير زر واحد يفتح شريطًا رأسيًا للحجم (يسري على كل الجداول كما كان).
     - «استيراد» و«الأسماء المتشابهة» في «الإعدادات» وحدها.
   عرض فقط: لا يغيّر أي وظيفة ولا بيانات. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./toolbar.js')) VFILES.push('./toolbar.js'); } catch (e) { /* ignore */ } });
  const S = p => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const PERSON_ADD = S('<circle cx="9" cy="8" r="3.2"/><path d="M3 20v-1a6 6 0 0 1 12 0v1"/><path d="M19 8v6M16 11h6"/>');
  const ICONS = {
    addTeacher: PERSON_ADD, addMember: PERSON_ADD, addStudent: PERSON_ADD,
    importMembers: S('<path d="M14 3H7a1 1 0 0 0-1 1v4M6 16v4a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M2 12h10M9 9l3 3-3 3"/>'),
    dupOpen: S('<circle cx="6" cy="8" r="2.5"/><path d="M2 18.5v-.5a4 4 0 0 1 8 0v.5"/><circle cx="18" cy="8" r="2.5"/><path d="M14 18.5v-.5a4 4 0 0 1 8 0v.5"/><path d="M10.5 10.5h3M10.5 13h3"/>'),
    credsOpen: S('<path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 20.5l1.5-5A8.5 8.5 0 1 1 21 11.5z"/><circle cx="9" cy="11.5" r="2.2"/><path d="M11.2 11.5H17M15 11.5v2.2"/>'),
    clsAuto: S('<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8z"/>'),
    cloudPwAll: S('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>'),
    wmk: S('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>'),
    delSel: S('<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    /* الاشتراكات */
    feeCfg: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    feeBulk: S('<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.4"/>'),
    feeImport: S('<path d="M14 3H7a1 1 0 0 0-1 1v4M6 16v4a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M2 12h10M9 9l3 3-3 3"/>'),
    remindAll: S('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>')
  };
  /* مفتاح الأيقونة: data-act، أو إحدى السمات المعروفة */
  const keyOf = b => b.dataset.act || ['wmk', 'feeCfg', 'feeBulk', 'feeImport', 'remindAll'].find(k => k in b.dataset) || '';
  /* أيقونتا التصدير: جدول أخضر، ومستند أحمر عليه PDF (أشكال عامة لا شعارات الشركات) */
  const XLS = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3.5" fill="#1d6f42"/><path d="M3 9h18M3 15h18M9.5 9v12M15 9v12" stroke="#fff" stroke-width="1.4" opacity=".9"/><rect x="3" y="3" width="18" height="6" rx="3.5" fill="#185c37"/></svg>';
  const PDF = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 2.5h8.5L19 7v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1-1.5z" fill="#b3372f"/><path d="M14.5 2.5V7H19" fill="#e07d74"/><text x="12" y="17.2" text-anchor="middle" font-family="Arial,sans-serif" font-size="6.2" font-weight="700" fill="#fff">PDF</text></svg>';

  const css = document.createElement('style');
  css.textContent = `.tblprint.qtb{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem;margin-bottom:.6rem}
    .tblprint.qtb > .bar{display:contents}
    .tblprint.qtb > .bar > .grow{flex:0 1 auto}
    .tblprint.qtb > .bar > h2{margin:0!important;font-size:1.05rem}
    .tblprint.qtb .qsp{flex:1 1 0;min-width:.2rem;order:1}
    .tblprint.qtb > *{order:3}
    .tblprint.qtb > .bar > *{order:0}
    .tblprint.qtb > .bar > .btn,.tblprint.qtb > .bar > button{order:2}
    .tblprint.qtb .qadd{order:9!important}
    .tblprint.qtb .tzoom{display:none}
    main .bar [data-act="importMembers"],main .bar [data-act="dupOpen"],main .tblprint [data-act="importMembers"],main .tblprint [data-act="dupOpen"]{display:none!important}
    .qzoom{position:relative;display:inline-flex}
    .qzoom > .btn{width:auto;min-width:38px;height:36px;padding:0 .45rem;gap:.2rem;font:700 .8rem Arial,sans-serif}
    .qzpop{position:absolute;top:calc(100% + .35rem);inset-inline-start:50%;transform:translateX(50%);z-index:20;background:var(--card,#fff);border:1px solid var(--line,#e5e7eb);border-radius:12px;box-shadow:0 8px 24px rgba(15,25,50,.18);padding:.6rem .5rem;display:flex;flex-direction:column;align-items:center;gap:.35rem}
    .qzpop[hidden]{display:none}
    .qzpop input[type=range]{writing-mode:vertical-lr;direction:rtl;width:28px;height:150px;margin:0;accent-color:var(--navy,#13294b)}
    .qzpop small{font:700 .78rem Arial,sans-serif;color:var(--muted,#777)}
    .tblprint.qtb .tzoom{margin-inline-end:0}
    .tblprint.qtb .btn.texp{width:38px;height:36px;padding:0;justify-content:center}
    .tblprint.qtb .btn.texp svg{width:22px;height:22px}
    .tblprint.qtb .msearch{flex:1 1 13rem;max-width:22rem;margin:0}
    .tblprint.qtb input[type=search]{flex:1 1 13rem;max-width:22rem;min-width:9rem}
    .btn.icon-only.primary svg{stroke:currentColor}
    .qnote-hidden{display:none!important}
    @media (max-width:600px){.tblprint.qtb .qsp{flex-basis:100%;height:0}}`;
  document.head.appendChild(css);

  const label = b => b.textContent.trim().replace(/\s+/g, ' ').replace(/^\+\s*/, 'إضافة ');
  function iconize(scope) {
    scope.querySelectorAll('.btn:not(.icon-only):not(.texp)').forEach(b => {
      const ic = ICONS[keyOf(b)]; if (!ic) return;
      const t = label(b), n = (t.match(/\((\d+)\)/) || [])[1];
      b.title = t; b.setAttribute('aria-label', t); b.classList.add('icon-only');
      b.innerHTML = ic + (n ? `<span class="cnt">${n}</span>` : '');
    });
    scope.querySelectorAll('.btn.texp:not([data-qi])').forEach(b => { b.dataset.qi = '1'; b.innerHTML = 'xls' in b.dataset ? XLS : PDF; });
  }
  /* ===== الحجم: زر واحد يفتح شريطًا رأسيًا. يحرّك أزرار tables.js المخفية (فالحجم يُحفظ ويسري على كل الجداول كما كان) ===== */
  const curZ = () => Math.round((+getComputedStyle(document.documentElement).getPropertyValue('--tz') || 1) * 100);
  const AA = S('<path d="M3 19l5-13 5 13M4.8 14.5h6.4"/><path d="M14 19l3.3-8.5L20.6 19M15.1 16.2h4.4"/>');
  const zoomBtn = () => `<span class="qzoom noprint"><button type="button" class="btn" data-qz title="حجم خط الجدول" aria-label="حجم خط الجدول" aria-expanded="false">${AA}<span data-qzv>${curZ()}%</span></button>
    <span class="qzpop" hidden><small>كبير</small><input type="range" min="70" max="180" step="10" value="${curZ()}" data-qzr aria-label="حجم خط الجدول"><small>صغير</small><button type="button" class="btn sm" data-qz0>100%</button></span></span>`;
  function setZoom(pct) {
    const tz = document.querySelector('main .tzoom'); if (!tz) return;
    tz.querySelector('[data-tz="0"]')?.click();
    const steps = Math.round((pct - 100) / 10), b = tz.querySelector(`[data-tz="${steps > 0 ? 1 : -1}"]`);
    for (let i = 0; i < Math.abs(steps); i++) b?.click();
    document.querySelectorAll('[data-qzv]').forEach(x => { x.textContent = curZ() + '%'; });
  }
  let zRaf = 0;
  document.addEventListener('input', e => { const r = e.target.closest?.('[data-qzr]'); if (!r) return; cancelAnimationFrame(zRaf); zRaf = requestAnimationFrame(() => setZoom(+r.value)); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-qz]'), z0 = e.target.closest('[data-qz0]');
    if (z0) { setZoom(100); const r = z0.parentNode.querySelector('[data-qzr]'); if (r) r.value = 100; return; }
    if (b) { const p = b.nextElementSibling, open = p.hidden; document.querySelectorAll('.qzpop').forEach(x => { x.hidden = true; }); p.hidden = !open; b.setAttribute('aria-expanded', open); if (open) p.querySelector('[data-qzr]').value = curZ(); return; }
    if (!e.target.closest('.qzpop')) document.querySelectorAll('.qzpop').forEach(x => { x.hidden = true; });
  });
  function merge() {
    raf = 0;
    if (!session) return;
    document.querySelectorAll('main .tblprint:not(.qtb)').forEach(tp => {
      const card = tp.parentElement; if (!card || card.matches('main, body')) return;
      if (card.querySelectorAll(':scope > .tblprint').length !== 1) return;   // حاوية فيها أكثر من جدول: تبقى كما هي
      const bar = card.querySelector(':scope > .bar');
      if (!bar || !(bar.compareDocumentPosition(tp) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
      /* ملاحظة الإرشاد بين الشريط والجدول: تُطوى خلف ⓘ (لا التنبيهات التي فيها أزرار أو شريط «إصلاح») */
      const notes = [...card.querySelectorAll(':scope > .note')].filter(n => !n.matches('[data-fixpay]') && !n.querySelector('button,input,select,a')
        && (bar.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) && (n.compareDocumentPosition(tp) & Node.DOCUMENT_POSITION_FOLLOWING));
      tp.classList.add('qtb');
      tp.prepend(bar);
      bar.insertAdjacentHTML('afterend', '<span class="qsp"></span>');
      notes.forEach(n => n.classList.add('qnote-hidden'));   // الإرشاد لا حاجة له في الصف
      const tz = tp.querySelector('.tzoom');
      if (tz && !tp.querySelector('.qzoom')) tz.insertAdjacentHTML('afterend', zoomBtn());
      iconize(tp);
    });
    /* أيقونتا Excel وPDF في كل مكان (حتى في البطاقات التي لم تُدمج) */
    document.querySelectorAll('main .bar, main .tblprint').forEach(iconize);
    /* أزرار الإضافة آخر الصف (ومنها «إضافة طالب» السريعة التي تُضاف بعد الرسم) */
    document.querySelectorAll('main .tblprint.qtb :is([data-act="addTeacher"],[data-act="addMember"],[data-act="addStudent"],[data-qadd]):not(.qadd)').forEach(b => b.classList.add('qadd'));
  }
  let raf = 0;
  new MutationObserver(ms => { if (!raf && ms.some(m => m.addedNodes.length)) raf = requestAnimationFrame(merge); }).observe(document.body, { childList: true, subtree: true });
})();

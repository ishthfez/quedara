'use strict';
/* ============ العرض الافتراضي: المنتظمون والعاملون فقط ============
   - «الطلاب»: التصفية تبدأ على «منتظم»، والمنقطعون يظهرون باختيار «منقطع» (لا «الكل»).
     (التصفية نفسها في nav.js بالمتغير ui.sstf؛ البحث بالاسم يبقى في كل الطلاب كما كان)
   - «العاملون»: قائمة بجانب الفئة: «العاملون» (الافتراضي) أو «الجميع»؛ المتوقف يُعرف من خانة حالته (.qoff).
     فئة «المتوقفون» و«غير مصنف» كما هما.
   - زر «إضافة طالب» بلون الموقع (الكحلي) بدل الإطار.
   - صف أدوات جدول الطلاب في سطرين: الأول العنوان والبحث والمكان والحلقة، والثاني تبويبا الحالة المتلاصقان (منتظم / منقطع) يمينًا
     بدل القائمة المنسدلة، والأزرار يسارًا بالترتيب من اليمين: الحجم، الحفظ، الطباعة، التذكير، الإضافة.
   - «المعاينة» بآخر إصدار دائمًا: المعاينة تُرسم بشيفرة التطبيق المفتوح نفسه، فإن نُشر تحديث يُعاد تحميل التطبيق فورًا
     (فحص التحديث في app-actions.js، كل 30 ثانية ما دامت المعاينة مفتوحة بدل كل 5 دقائق)، ويبقى الاختيار (النوع والشخص والجهاز).
     وبصمة التحديث صارت تشمل كل ملفات التطبيق (كل سكربت في index.html)، لا بعضها.
   - جرس «تذكير غير المسددين» في «الطلاب» أيقونة فقط بلا عدد.
   - زر الحجم في كل التطبيق: الحرفان AA وبجانبهما + وتحته − (بلا النسبة). زر الصفحات (toolbar.js) يفتح شريط الحجم كما كان،
     وأزرار جداول النوافذ (.ztools في nav.js) صارت AA بجانبه زرّا + و− فوق بعض، بلا زر النسبة.
   - كل الجداول: البيانات في وسط الخلايا عدا عمود الأسماء (يمينًا)، وعرض كل عمود بقدر أطول ما فيه (لا يتمدد الجدول ليملأ المساحة).
     عمود الأسماء يُعرف من عنوانه (الاسم، الطالب، العامل، الموظف...). جداول المرتبات وبطاقة الطالب كما هي.
     وغلاف الجدول (.tbl) بعرض الجدول نفسه، فشريط تمريره بجانب الجدول لا في طرف الصفحة البعيد.
   - زر «تذكير بالسداد» في سطر مستقل فوق الجدول (notify.js، مثل صفحة «التحصيل» عند المعلم) يُنقل إلى صف أدوات الجدول بجانب الحجم والطباعة.
   - الصفحة الرئيسية (المدير): بطاقة «الحلقات والطلاب» بعداداتها بشكل عدادات الاشتراكات (البيان والقيمة في سطر ملوّن)،
     ثم بطاقة «الاشتراكات» نفسها منقولة من صفحة «الطلاب» (QLFeeSummary في app-abs.js، لكل الطلاب)، ثم الإعلانات.
     وعلى الهاتف عدادان في كل سطر.
   - السرعة: حركة ظهور الصفحة (ql-in في style.css) تعمل عند الانتقال إلى صفحة أخرى فقط، لا عند كل تحديث للصفحة نفسها
     (تسجيل حضور، تبويب حالة، تصفية...): كانت تعيد رسم الجدول كله في كل إطار طوال الحركة. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./active.js')) VFILES.push('./active.js'); } catch (e) { /* ignore */ } });
  const css = document.createElement('style');
  css.textContent = `main [data-qadd],main [data-act="addStudent"]{background:var(--navy,#13294b)!important;color:var(--on-navy,#fff)!important;border-color:var(--navy,#13294b)!important}
    main [data-qadd]:hover,main [data-act="addStudent"]:hover{background:var(--navy-d,#0b1b33)!important}
    main [data-qadd] svg,main [data-act="addStudent"] svg{stroke:currentColor}
    html.qnoanim .content main,html.qnoanim .subnav ~ *{animation:none!important}
    main .tblprint.qtb:has([data-sstfseg]) [data-remind-all] .cnt{display:none!important}
    [data-qz] [data-qzv]{display:none!important}
    [data-qz]::after{content:'+\\A−';white-space:pre;display:inline-block;font:700 .82rem/0.9 Arial,sans-serif;text-align:center}
    .ztools{display:grid!important;grid-template-columns:auto auto;grid-template-rows:auto auto;justify-content:end;align-items:center;gap:.1rem .3rem}
    .ztools::before{content:'AA';grid-column:1;grid-row:1 / 3;font:700 .95rem Arial,sans-serif;color:var(--navy,#13294b)}
    .ztools [data-tz="0"],.ztools [data-pvtz="0"]{display:none!important}
    .ztools [data-tz="1"],.ztools [data-pvtz="1"]{grid-column:2;grid-row:1}
    .ztools [data-tz="-1"],.ztools [data-pvtz="-1"]{grid-column:2;grid-row:2}
    .ztools .btn{min-width:28px!important;min-height:0!important;height:22px;padding:0 .3rem!important;font-size:0!important;line-height:1}
    .ztools [data-tz="1"]::after,.ztools [data-pvtz="1"]::after{content:'+';font:700 .85rem Arial,sans-serif}
    .ztools [data-tz="-1"]::after,.ztools [data-pvtz="-1"]::after{content:'−';font:700 .85rem Arial,sans-serif}
    .tbl:not(.paytbl):not(.scard .tbl) th,.tbl:not(.paytbl):not(.scard .tbl) td{text-align:center!important;white-space:nowrap}
    .tbl:not(.paytbl):not(.scard .tbl) :is(th,td).qnm{text-align:right!important}
    .tbl:not(.paytbl):not(.scard .tbl) > table{width:max-content!important;min-width:0!important;max-width:none}
    .tbl:not(.paytbl):not(.scard .tbl){width:max-content;max-width:100%}
    main .tblprint.qtb:has([data-sstfseg]){justify-content:flex-start!important}
    main .tblprint.qtb:has([data-sstfseg]) > .bar > *{order:25!important}
    main .tblprint.qtb:has([data-sstfseg]) > .bar > h2{order:1!important;flex:0 0 auto!important}
    main .tblprint.qtb:has([data-sstfseg]) > .bar > :is(input[data-sq],.msearch){order:2!important;flex:0 1 18rem!important;max-width:18rem!important}
    main .tblprint.qtb:has([data-sstfseg]) > .bar > :is(select,.qcombo){order:3!important;flex:0 1 14rem!important;max-width:14rem!important}
    main .tblprint.qtb:has([data-sstfseg])::after{content:'';flex:0 0 100%;height:0;order:20}
    main .tblprint.qtb:has([data-sstfseg]) > .bar > [data-sstfseg]{order:21!important;flex:0 0 auto!important}
    main .tblprint.qtb:has([data-sstfseg]) > .qsp{order:22!important;flex:1 1 0!important;height:auto!important}
    main .tblprint.qtb:has([data-sstfseg]) > .bar > :is(.btn,button,details){order:35!important}
    main .tblprint.qtb:has([data-sstfseg]) > :not(.bar):not(.qsp){order:35!important}
    main .tblprint.qtb:has([data-sstfseg]) > .qzoom:not(.bar):not(.qsp){order:30!important}
    main .tblprint.qtb:has([data-sstfseg]) > .qsave:not(.bar):not(.qsp){order:31!important}
    main .tblprint.qtb:has([data-sstfseg]) > [data-print]:not(.bar):not(.qsp){order:32!important}
    main .tblprint.qtb:has([data-sstfseg]) > .bar > [data-remind-all]:is(.btn,button){order:33!important}
    main .tblprint.qtb:has([data-sstfseg]) > .bar > .qadd:is(.btn,button){order:34!important}
    .qdashcard .qfrow{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
    @media (max-width:600px){.qfrow,.qfrow.qfmon,.qdashcard .qfrow{grid-template-columns:1fr 1fr!important;gap:.45rem}
      .qfrow .feerow{padding:.5rem .65rem;font-size:.82rem;gap:.3rem;min-width:0}.qfrow .feerow b{font-size:1.05rem}
      .qfrow .feerow span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.qfrow .qfpct .qfbar{display:none}
      .qfrow > .feerow:last-child:nth-child(odd){grid-column:1 / -1}}
    .qseg{display:inline-flex;border:1px solid var(--line,#e6dfcf);border-radius:10px;overflow:hidden;background:var(--card,#fff)}
    .qseg button{border:0;margin:0;background:transparent;padding:.45rem .9rem;font:inherit;font-weight:700;color:var(--navy,#13294b);cursor:pointer;white-space:nowrap}
    .qseg button+button{border-inline-start:1px solid var(--line,#e6dfcf)}
    .qseg button.on{background:var(--navy,#13294b);color:var(--on-navy,#fff)}
    .qseg button small{font-weight:400;opacity:.75}
    .qseg button:disabled{opacity:.5;cursor:not-allowed}
    .qseg button:focus-visible{outline:2px solid var(--gold,#b8904f);outline-offset:-2px}`;
  document.head.appendChild(css);
  try { if (ui.sstf === undefined) ui.sstf = 'on'; if (ui.wstf === undefined) ui.wstf = 'on'; } catch (e) { /* ignore */ }

  /* ===== الطلاب: قائمة الحالة ← تبويبان متلاصقان (منتظم / منقطع) بأعدادهما، بلا «الكل» =====
     القيمة نفسها (ui.sstf) التي تقرؤها التصفية في nav.js؛ وتُعطَّل أثناء البحث بالاسم كما كانت القائمة (البحث في الكل). */
  const SEG = { on: 'منتظم', off: 'منقطع' };
  /* يُركَّب بعد DOMContentLoaded: nav.js يعيد تعريف adminViews.students عنده، فلو رُكّب قبله لضاع */
  const wrapStu = () => {
  const baseStu = adminViews.students;
  adminViews.students = function () {
    if (ui.sstf !== 'on' && ui.sstf !== 'off') ui.sstf = 'on';   // لا «الكل»: ما حُفظ عليه سابقًا يصير «منتظم»
    /* القائمة الكاملة قبل تضييقها بالحالة في nav.js: لعدادات الاشتراكات في app-abs.js */
    window.QLStuPool = db.students;
    let h; try { h = baseStu.apply(this, arguments); } finally { window.QLStuPool = null; }
    if (typeof h !== 'string') return h;
    return h.replace(/<select data-sstf([^>]*)>([\s\S]*?)<\/select>/, (m, attrs, opts) => {
      const dis = /\sdisabled/.test(attrs), title = (attrs.match(/title="([^"]*)"/) || [])[1] || '', cur = ui.sstf || '';
      const items = [...opts.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(([, v, t]) => [v, (t.match(/\((\d+)\)/) || [])[1]]).filter(([v]) => SEG[v]);
      return `<div class="qseg" data-sstfseg role="group" aria-label="حالة الطلاب"${title ? ` title="${title}"` : ''}>${items.map(([v, n]) => `<button type="button" class="${v === cur ? 'on' : ''}" data-sstfv="${v}" aria-pressed="${v === cur}"${dis ? ' disabled' : ''}>${SEG[v] || v}${n ? ` <small>(${n})</small>` : ''}</button>`).join('')}</div>`;
    });
  };
  };
  document.addEventListener('DOMContentLoaded', () => {
    wrapStu();   /* الرسم الأول ينتظر انتهاء كل معالجات DOMContentLoaded (boot-gate.js)، فيأتي بهذا التركيب */
    /* حركة الظهور للانتقال بين الصفحات فقط */
    let lastView = null;
    const baseRender = render;
    render = function () {
      let k = '';
      try { k = [session?.role, window.QLView ? window.QLView() : ui.tab, ui.svw || '', ui.msub || ''].join('|'); } catch (e) { /* ignore */ }
      document.documentElement.classList.toggle('qnoanim', k === lastView);
      lastView = k;
      return baseRender.apply(this, arguments);
    };
  });
  document.addEventListener('click', e => { const b = e.target.closest?.('[data-sstfv]'); if (!b || b.disabled) return; ui.sstf = b.dataset.sstfv; render(); });

  /* ===== عمود الأسماء في كل جدول: يمينًا (الباقي في الوسط من CSS أعلاه) ===== */
  const NAMEH = new Set(['الاسم', 'الطالب', 'العامل', 'الموظف', 'المعلم', 'المشرف', 'المحاسب', 'الإداري', 'اسم الطالب', 'اسم المعلم', 'العضو']);
  const nmSig = new WeakMap();
  function markNames() {
    document.querySelectorAll('.tbl:not(.paytbl) > table').forEach(tbl => {
      if (tbl.closest('.scard')) return;
      const sig = tbl.rows.length + '|' + (tbl.rows[1]?.cells.length || 0) + '|' + (tbl.rows[1]?.textContent.length || 0);
      if (nmSig.get(tbl) === sig) return; nmSig.set(tbl, sig);
      const head = [...tbl.rows].find(r => r.querySelector('th')); if (!head || [...head.cells].some(c => c.colSpan > 1)) return;
      const idx = [...head.cells].map((c, i) => NAMEH.has(c.textContent.trim()) ? i : -1).filter(i => i > -1); if (!idx.length) return;
      [...tbl.rows].forEach(r => idx.forEach(i => r.cells[i]?.classList.add('qnm')));
    });
  }
  let nmRaf = 0;
  new MutationObserver(() => { if (!nmRaf) nmRaf = requestAnimationFrame(() => { nmRaf = 0; try { markNames(); } catch (e) { /* ignore */ } }); }).observe(document.body, { childList: true, subtree: true });

  /* ===== «تذكير بالسداد» إلى صف أدوات الجدول ===== */
  new MutationObserver(() => {
    document.querySelectorAll('main .bar.noprint > [data-remind-all]').forEach(b => {
      const bar = b.parentElement, tp = bar.nextElementSibling?.matches?.('.tblprint') ? bar.nextElementSibling : bar.parentElement.querySelector(':scope > .tblprint');
      if (!tp || tp.contains(b)) return;
      tp.appendChild(b);
      if (!bar.querySelector('button, select, input')) bar.style.margin = '0 0 .4rem';
    });
  }).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });

  /* ===== الصفحة الرئيسية للمدير ===== */
  document.addEventListener('DOMContentLoaded', () => {
    const baseDash = adminViews.dash; if (typeof baseDash !== 'function') return;
    const MAP = { 'معلم': ['المعلمون', 'fr-plain', 1], 'مشرف': ['المشرفون', 'fr-plain', 1], 'مكان': ['الأماكن', 'fr-plain', 1], 'حلقة': ['الحلقات', 'fr-plain', 1],
      'طالب': ['الطلاب', 'fr-info', 2], 'حضور اليوم': ['حضور اليوم', 'fr-ok', 2], 'تسجيلات الأسبوع': ['تسجيلات الأسبوع', 'fr-info', 2] };
    adminViews.dash = function () {
      const h = baseDash.apply(this, arguments);
      if (session?.role !== 'admin' || typeof h !== 'string') return h;
      const t = document.createElement('template'); t.innerHTML = h;
      const grid = [...t.content.children].find(e => e.classList.contains('grid')); if (!grid) return h;
      const rows = { 1: [], 2: [] };
      grid.querySelectorAll('.stat').forEach(st => {
        const v = st.querySelector('b')?.textContent.trim() || '', l = st.querySelector('span')?.textContent.trim() || '';
        const [lab, cls, row] = MAP[l] || [l, 'fr-plain', 2];
        const pct = /%$/.test(v) ? parseInt(v, 10) : null;
        rows[row].push(pct != null
          ? `<div class="feerow ${cls} qfpct"><span>${esc(lab)}</span><span class="qfbar" aria-hidden="true"><span style="width:${Math.min(pct, 100)}%"></span></span><b>${esc(v)}</b></div>`
          : `<div class="feerow ${cls}"><span>${esc(lab)}</span><b>${esc(v)}</b></div>`);
      });
      grid.remove();
      const over = `<div class="card qdashcard" style="margin:0 0 1rem"><h3 style="margin:0 0 .8rem">الحلقات والطلاب</h3>
        <div class="qfrow">${rows[1].join('')}</div><div class="qfrow">${rows[2].join('')}</div></div>`;
      let fee = '';
      try { fee = window.QLFeeSummary ? window.QLFeeSummary(db.students) : ''; } catch (e) { console.error('dash fees:', e); }
      return over + fee + t.innerHTML;
    };
  });

  /* ===== العاملون: إخفاء المتوقفين ما لم يُختر «الجميع» ===== */
  const baseW = adminViews.teachers;
  adminViews.teachers = function () {
    const h = baseW.apply(this, arguments);
    if (typeof h !== 'string' || !h.includes('data-stfk')) return h;
    const t = document.createElement('template'); t.innerHTML = h;
    const C = t.content, cat = C.querySelector('select[data-stfk]');
    const k = cat?.querySelector('option[selected]')?.value || '';
    if (!cat || k === 'off' || k === 'un') return h;
    const rows = [...C.querySelectorAll('tr[data-stk]')];
    const isOff = r => !!r.querySelector('select[data-tstat].qoff,select[data-pstat].qoff');
    const nOff = rows.filter(isOff).length, nAll = rows.length;
    cat.insertAdjacentHTML('afterend', `<select data-wstf style="width:auto" aria-label="حالة العاملين">${[['on', 'العاملون', nAll - nOff], ['all', 'الجميع', nAll]].map(([v, l, n]) => `<option value="${v}" ${ui.wstf === v ? 'selected' : ''}>${l} (${n})</option>`).join('')}</select>`);
    if (ui.wstf !== 'all' && nOff) {
      rows.filter(isOff).forEach(r => r.remove());
      [...C.querySelectorAll('tr[data-stk]')].forEach((r, i) => { const c = r.cells[0]; if (c && /^\d+$/.test(c.textContent.trim())) c.textContent = i + 1; });
    }
    return t.innerHTML;
  };
  document.addEventListener('change', e => { const s = e.target.closest?.('select[data-wstf]'); if (s) { ui.wstf = s.value; render(); } });

  /* ===== المعاينة: آخر إصدار دائمًا ===== */
  document.addEventListener('DOMContentLoaded', () => {
    try { document.querySelectorAll('script[src]').forEach(sc => { const f = './' + sc.getAttribute('src').replace(/^\.\//, ''); if (!VFILES.includes(f)) VFILES.push(f); }); } catch (e) { /* ignore */ }
  });
  const PVK = 'qpv_restore';
  const onPv = () => { try { return ui.tab === 'preview' && session?.role === 'admin'; } catch (e) { return false; } };
  let pvLast = 0, restore = null;
  try { restore = JSON.parse(sessionStorage.getItem(PVK) || 'null'); sessionStorage.removeItem(PVK); } catch (e) { /* ignore */ }
  const pvCheck = () => { if (!onPv() || typeof checkUpdate !== 'function' || Date.now() - pvLast < 20000) return; pvLast = Date.now(); checkUpdate(); };
  /* بعد إعادة التحميل: النوع والشخص والجهاز كما كانت */
  function doRestore() {
    if (!restore || !onPv()) return;
    const r = restore; restore = null;
    const set = (q, v) => { const el = document.querySelector(q); if (el && v && el.value !== v && [...el.options].some(o => o.value === v)) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); } };
    set('main [data-pvk]', r.k); set('main [data-pvid]', r.id);
    if (r.dev) document.querySelector(`main [data-pvdev="${r.dev}"]:not(.on)`)?.click();
  }
  new MutationObserver(() => { if (!onPv()) return; doRestore(); pvCheck(); }).observe(document.getElementById('app') || document.body, { childList: true });
  setInterval(() => { if (onPv() && !document.hidden) { pvLast = 0; pvCheck(); } }, 30000);
  window.addEventListener('pagehide', () => {
    if (!onPv()) return;
    const v = q => document.querySelector(q)?.value || '';
    try { sessionStorage.setItem(PVK, JSON.stringify({ k: v('main [data-pvk]'), id: v('main [data-pvid]'), dev: document.querySelector('main [data-pvdev].on')?.dataset.pvdev || '' })); } catch (e) { /* ignore */ }
  });
})();

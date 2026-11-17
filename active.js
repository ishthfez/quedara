'use strict';
/* ============ العرض الافتراضي: المنتظمون والعاملون فقط ============
   - «الطلاب»: التصفية تبدأ على «منتظم»، والمنقطعون يظهرون باختيار «الكل» أو «منقطع».
     (التصفية نفسها في nav.js بالمتغير ui.sstf؛ البحث بالاسم يبقى في كل الطلاب كما كان)
   - «العاملون»: قائمة بجانب الفئة: «العاملون» (الافتراضي) أو «الجميع»؛ المتوقف يُعرف من خانة حالته (.qoff).
     فئة «المتوقفون» و«غير مصنف» كما هما.
   - زر «إضافة طالب» بلون الموقع (الكحلي) بدل الإطار.
   - صف أدوات جدول الطلاب في سطرين: الأول العنوان والبحث والمكان والحلقة، والثاني تبويبات الحالة المتلاصقة (الكل / منتظم / منقطع) يمينًا
     بدل القائمة المنسدلة، والأزرار يسارًا بالترتيب من اليمين: الحجم، الحفظ، الطباعة، التذكير، الإضافة.
   - «المعاينة» بآخر إصدار دائمًا: المعاينة تُرسم بشيفرة التطبيق المفتوح نفسه، فإن نُشر تحديث يُعاد تحميل التطبيق فورًا
     (فحص التحديث في app-actions.js، كل 30 ثانية ما دامت المعاينة مفتوحة بدل كل 5 دقائق)، ويبقى الاختيار (النوع والشخص والجهاز).
     وبصمة التحديث صارت تشمل كل ملفات التطبيق (كل سكربت في index.html)، لا بعضها. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./active.js')) VFILES.push('./active.js'); } catch (e) { /* ignore */ } });
  const css = document.createElement('style');
  css.textContent = `main [data-qadd],main [data-act="addStudent"]{background:var(--navy,#13294b)!important;color:var(--on-navy,#fff)!important;border-color:var(--navy,#13294b)!important}
    main [data-qadd]:hover,main [data-act="addStudent"]:hover{background:var(--navy-d,#0b1b33)!important}
    main [data-qadd] svg,main [data-act="addStudent"] svg{stroke:currentColor}
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
    .qseg{display:inline-flex;border:1px solid var(--line,#e6dfcf);border-radius:10px;overflow:hidden;background:var(--card,#fff)}
    .qseg button{border:0;margin:0;background:transparent;padding:.45rem .9rem;font:inherit;font-weight:700;color:var(--navy,#13294b);cursor:pointer;white-space:nowrap}
    .qseg button+button{border-inline-start:1px solid var(--line,#e6dfcf)}
    .qseg button.on{background:var(--navy,#13294b);color:var(--on-navy,#fff)}
    .qseg button small{font-weight:400;opacity:.75}
    .qseg button:disabled{opacity:.5;cursor:not-allowed}
    .qseg button:focus-visible{outline:2px solid var(--gold,#b8904f);outline-offset:-2px}`;
  document.head.appendChild(css);
  try { if (ui.sstf === undefined) ui.sstf = 'on'; if (ui.wstf === undefined) ui.wstf = 'on'; } catch (e) { /* ignore */ }

  /* ===== الطلاب: قائمة الحالة ← ثلاث تبويبات متلاصقة (الكل / منتظم / منقطع) بأعدادها =====
     القيمة نفسها (ui.sstf) التي تقرؤها التصفية في nav.js؛ وتُعطَّل أثناء البحث بالاسم كما كانت القائمة. */
  const SEG = { '': 'الكل', on: 'منتظم', off: 'منقطع' };
  /* يُركَّب بعد DOMContentLoaded: nav.js يعيد تعريف adminViews.students عنده، فلو رُكّب قبله لضاع */
  const wrapStu = () => {
  const baseStu = adminViews.students;
  adminViews.students = function () {
    /* القائمة الكاملة قبل تضييقها بالحالة في nav.js: لعدادات الاشتراكات في app-abs.js */
    window.QLStuPool = db.students;
    let h; try { h = baseStu.apply(this, arguments); } finally { window.QLStuPool = null; }
    if (typeof h !== 'string') return h;
    return h.replace(/<select data-sstf([^>]*)>([\s\S]*?)<\/select>/, (m, attrs, opts) => {
      const dis = /\sdisabled/.test(attrs), title = (attrs.match(/title="([^"]*)"/) || [])[1] || '', cur = ui.sstf || '';
      const items = [...opts.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(([, v, t]) => [v, (t.match(/\((\d+)\)/) || [])[1]]);
      return `<div class="qseg" data-sstfseg role="group" aria-label="حالة الطلاب"${title ? ` title="${title}"` : ''}>${items.map(([v, n]) => `<button type="button" class="${v === cur ? 'on' : ''}" data-sstfv="${v}" aria-pressed="${v === cur}"${dis ? ' disabled' : ''}>${SEG[v] || v}${n ? ` <small>(${n})</small>` : ''}</button>`).join('')}</div>`;
    });
  };
  };
  document.addEventListener('DOMContentLoaded', () => {
    wrapStu();   /* الرسم الأول ينتظر انتهاء كل معالجات DOMContentLoaded (boot-gate.js)، فيأتي بهذا التركيب */
  });
  document.addEventListener('click', e => { const b = e.target.closest?.('[data-sstfv]'); if (!b || b.disabled) return; ui.sstf = b.dataset.sstfv; render(); });

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

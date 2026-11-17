'use strict';
/* ============ العرض الافتراضي: المنتظمون والعاملون فقط ============
   - «الطلاب»: التصفية تبدأ على «المنتظمون»، و«كل الحالات» صار اسمها «الجميع» (المنقطعون يظهرون باختيارها أو باختيار «المنقطعون»).
     (التصفية نفسها في nav.js بالمتغير ui.sstf؛ البحث بالاسم يبقى في كل الطلاب كما كان)
   - «العاملون»: قائمة بجانب الفئة: «العاملون» (الافتراضي) أو «الجميع»؛ المتوقف يُعرف من خانة حالته (.qoff).
     فئة «المتوقفون» و«غير مصنف» كما هما.
   - زر «إضافة طالب» بلون الموقع (الكحلي) بدل الإطار.
   - صف أدوات جدول الطلاب: قائمة الحالة (المنتظمون/الجميع/المنقطعون) في سطر ثانٍ، والأزرار كلها (الطباعة والحفظ والبقية) في السطر الأول.
   - «المعاينة» بآخر إصدار دائمًا: المعاينة تُرسم بشيفرة التطبيق المفتوح نفسه، فإن نُشر تحديث يُعاد تحميل التطبيق فورًا
     (فحص التحديث في app-actions.js، كل 30 ثانية ما دامت المعاينة مفتوحة بدل كل 5 دقائق)، ويبقى الاختيار (النوع والشخص والجهاز).
     وبصمة التحديث صارت تشمل كل ملفات التطبيق (كل سكربت في index.html)، لا بعضها. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./active.js')) VFILES.push('./active.js'); } catch (e) { /* ignore */ } });
  const css = document.createElement('style');
  css.textContent = `main [data-qadd],main [data-act="addStudent"]{background:var(--navy,#13294b)!important;color:var(--on-navy,#fff)!important;border-color:var(--navy,#13294b)!important}
    main [data-qadd]:hover,main [data-act="addStudent"]:hover{background:var(--navy-d,#0b1b33)!important}
    main [data-qadd] svg,main [data-act="addStudent"] svg{stroke:currentColor}
    main .tblprint.qtb:has(select[data-sstf])::after{content:'';flex:0 0 100%;height:0;order:10}
    main .tblprint.qtb > .bar > select[data-sstf]{order:11!important}
    main .tblprint.qtb:has(select[data-sstf]) > .bar > input[data-sq]{flex:1 1 10rem;max-width:16rem}`;
  document.head.appendChild(css);
  try { if (ui.sstf === undefined) ui.sstf = 'on'; if (ui.wstf === undefined) ui.wstf = 'on'; } catch (e) { /* ignore */ }

  /* ===== الطلاب: «كل الحالات» ← «الجميع» ===== */
  const baseStu = adminViews.students;
  adminViews.students = function () {
    const h = baseStu.apply(this, arguments);
    return typeof h === 'string' ? h.replace(/(<select data-sstf[^>]*>[\s\S]*?<option value=""[^>]*>)كل الحالات/, '$1الجميع') : h;
  };

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

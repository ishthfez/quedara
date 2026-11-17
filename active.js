'use strict';
/* ============ العرض الافتراضي: المنتظمون والعاملون فقط ============
   - «الطلاب»: التصفية تبدأ على «المنتظمون»، و«كل الحالات» صار اسمها «الجميع» (المنقطعون يظهرون باختيارها أو باختيار «المنقطعون»).
     (التصفية نفسها في nav.js بالمتغير ui.sstf؛ البحث بالاسم يبقى في كل الطلاب كما كان)
   - «العاملون»: قائمة بجانب الفئة: «العاملون» (الافتراضي) أو «الجميع»؛ المتوقف يُعرف من خانة حالته (.qoff).
     فئة «المتوقفون» و«غير مصنف» كما هما. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./active.js')) VFILES.push('./active.js'); } catch (e) { /* ignore */ } });
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
})();

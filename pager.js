'use strict';
/* ============ الجداول الطويلة: 50 صفًا وزر «عرض المزيد» ============
   كل جدول في التطبيق (في الصفحات والنوافذ) فيه أكثر من 50 صفًا يعرض أول 50، وتحته زر «عرض المزيد» يُظهر 50 أخرى في كل ضغطة.
   - ما عدا صفحتي «الموظفون» و«المرتبات» فتُعرض كاملة.
   - صف الإجمالي يبقى ظاهرًا دائمًا، والتصدير إلى Excel وPDF والطباعة تشمل كل الصفوف.
   - مع البحث الحي (الذي يخفي الصفوف غير المطابقة) تُحسب الخمسون من الصفوف المطابقة.
   - ما فُتح بـ«عرض المزيد» يبقى مفتوحًا بعد تسجيل حضور أو أي تحديث للصفحة نفسها، ويعود إلى 50 عند الانتقال لصفحة أخرى. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./pager.js')) VFILES.push('./pager.js'); } catch (e) { /* ignore */ } });
  const STEP = 50, SKIP_TABS = ['teachers', 'payroll'];
  const css = document.createElement('style');
  /* قبل أن يصل الجدول إلى هذا الملف: صفوفه بعد الخمسين مخفية من البداية، فلا يحسب المتصفح تخطيط آلاف الصفوف ثم يخفيها */
  css.textContent = `.tbl table:not(.pgok)>tbody>tr:nth-child(n+53){display:none}tr.pgx{display:none}.pgmore{display:flex;align-items:center;justify-content:center;gap:.6rem;flex-wrap:wrap;margin:.5rem 0 .2rem}
    .pgmore small{color:var(--muted,#777)}@media print{tr.pgx,.tbl table>tbody>tr{display:table-row!important}.pgmore{display:none!important}}`;
  document.head.appendChild(css);

  const limits = new Map(); let page = '';
  const pageKey = () => `${session?.role}|${ui.tab}|${ui.msub || ''}|${ui.svw || ''}`;
  const firstData = t => { const i = [...t.rows].findIndex(r => [...r.cells].some(x => x.tagName === 'TD')); return i < 0 ? t.rows.length : i; };
  const sig = new WeakMap();   // جدول لم يتغير منذ آخر مرة لا يُعاد فحصه (المراقب يعمل مع كل تغيير في الصفحة)
  function apply(t, key, force, skip) {
    t.classList.add('pgok');
    if (skip) return;
    const wrap = t.closest('.tbl') || t;
    const lim = limits.get(key) || STEP;
    if (!force && t.rows.length <= STEP + 3 && !(wrap.nextElementSibling?.classList?.contains('pgmore'))) return;
    const rows = [...t.rows].slice(firstData(t)).filter(r => !r.classList.contains('sum'));
    const cand = rows.filter(r => !r.hidden && r.style.display !== 'none');
    const k = `${key}|${rows.length}|${cand.length}|${lim}|${rows[0]?.rowIndex}`;
    if (!force && sig.get(t) === k) return;
    sig.set(t, k);
    rows.forEach(r => r.classList.remove('pgx'));
    let btn = wrap.nextElementSibling?.classList?.contains('pgmore') ? wrap.nextElementSibling : null;
    if (cand.length <= STEP || lim >= cand.length) {
      if (btn && cand.length <= STEP) btn.remove();
      else if (btn) setHtml(btn, `<small>يظهر الكل: ${cand.length}</small><button type="button" class="btn sm" data-pgless>عرض أقل</button>`);
      return;
    }
    cand.slice(lim).forEach(r => r.classList.add('pgx'));
    if (!btn) { btn = document.createElement('div'); btn.className = 'pgmore noprint'; wrap.after(btn); }
    btn.dataset.pgkey = key;
    setHtml(btn, `<small>يظهر ${lim} من ${cand.length}</small><button type="button" class="btn sm primary" data-pgmore>عرض المزيد (${Math.min(STEP, cand.length - lim)})</button><button type="button" class="btn sm" data-pgall>عرض الكل</button>`);
  }
  /* لا يُعاد رسم الزر إن لم يتغير (وإلا أعاد المراقب التشغيل بلا نهاية) */
  const setHtml = (el, h) => { if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; } };
  function run() {
    raf = 0;
    if (!session) return;
    const pk = pageKey(); if (pk !== page) { page = pk; limits.clear(); }
    const skipMain = SKIP_TABS.includes(ui.tab);
    document.querySelectorAll('main .tbl table').forEach((t, i) => apply(t, 'm' + i, false, skipMain));
    document.querySelectorAll('.overlay .tbl table').forEach((t, i) => apply(t, 'o' + i));
  }
  let raf = 0;
  const later = () => { if (!raf) raf = requestAnimationFrame(run); };
  /* يعمل فور تغيّر الصفحة (قبل رسمها)، وما لم يتغير من الجداول لا يُعاد فحصه */
  new MutationObserver(() => { if (raf) { cancelAnimationFrame(raf); } raf = 1; run(); }).observe(document.body, { childList: true, subtree: true });
  /* بعد البحث الحي (يخفي الصفوف دون إعادة رسم) */
  document.addEventListener('input', () => setTimeout(() => { document.querySelectorAll('.tbl table').forEach(t => sig.delete(t)); later(); }, 0));
  document.addEventListener('click', e => {
    const b = e.target.closest('.pgmore button'); if (!b) return;
    const box = b.closest('.pgmore'), key = box.dataset.pgkey, t = box.previousElementSibling?.querySelector?.('table') || box.previousElementSibling;
    const total = t ? [...t.rows].slice(firstData(t)).filter(r => !r.classList.contains('sum') && !r.hidden && r.style.display !== 'none').length : 0;
    if (b.matches('[data-pgmore]')) limits.set(key, (limits.get(key) || STEP) + STEP);
    else if (b.matches('[data-pgall]')) limits.set(key, total);
    else if (b.matches('[data-pgless]')) limits.set(key, STEP);
    if (t) apply(t, key, true);
  });
})();

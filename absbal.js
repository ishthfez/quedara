'use strict';
/* ============ «الغياب»: ملخص الشهر في بطاقة، ورصيد الإجازات تحته وقابل للتعديل ============
   - «ملخص الشهر» كان في آخر بطاقة «سجل الغياب»: صار بطاقة مستقلة تحتها.
   - «رصيد الإجازات» كان أسفل الصفحة بعرضها: صار في العمود نفسه تحت «ملخص الشهر».
   - زر «تعديل» (للمدير) في صف أدوات الجدول بجانب الطباعة والحفظ: يجعل «الرصيد» و«المخصوم» خانات تُعدَّل لكل موظف.
     يُحفظ في إعدادات المرتبات (settings.lvAdj[السنة][الموظف] = { b: الرصيد، u: فرق المخصوم })، فالمخصوم = ما أُثبت «رصيد» + الفرق،
     ويستمر العدّ بعد التعديل بالغياب الجديد. الخانة التي تُترك على القيمة المحسوبة لا يُحفظ لها شيء.
   (البطاقة يرسمها payroll.js؛ هنا يُعاد ترتيبها بعد الرسم، ويُرسم جدول الرصيد بالحساب نفسه مع التعديلات)
   - المشرف: تعديلات الرصيد تُجلب من الخادم (leave_adj في supabase/leave_adj.sql، أرقام الرصيد وحدها) كلما فتح «غياب المعلمين»
     (مرة كل دقيقتين على الأكثر)، وتُعاد إلى إعداداته بعد كل مزامنة، فتحسب استمارة الغياب الرصيد كما في جدول المدير (absBalance في payroll.js). */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./absbal.js')) VFILES.push('./absbal.js'); } catch (e) { /* ignore */ } });
  const css = document.createElement('style');
  css.textContent = `.abs-col{display:flex;flex-direction:column;gap:1rem;min-width:0}.abs-col>.card{margin:0}
    .lvin{width:5.5rem;margin:0;padding:.25rem .4rem}
    .lvadj{font-weight:700;color:var(--gold-d,#8f6b33)}`;
  document.head.appendChild(css);

  let adjAt = 0, adjBusy = false, ADJ = null;
  /* كل مزامنة تعيد بناء db.payroll للمشرف (cloud.js) بلا التعديلات، فتُعاد إليه بعدها */
  /* «الغياب» قسم مستقل عند المشرف، وتبويب في «العاملون» عند المدير العام (nav.js: QLView) */
  const onAbs = () => ui.tab === 'absence' || (typeof window.QLView === 'function' && window.QLView() === 'absence');
  const putAdj = () => { const s = db.payroll?.settings; if (ADJ && s && s.lvAdj !== ADJ) s.lvAdj = ADJ; };
  async function freshAdj() {
    if (typeof CLOUD === 'undefined' || !CLOUD || session?.role !== 'supervisor' || adjBusy || Date.now() - adjAt < 120000 || !window.Cloud?.signedIn) return;
    adjBusy = true; adjAt = Date.now();
    try {
      const r = await window.Cloud.rpc('leave_adj');
      if (r && typeof r === 'object') {
        const changed = JSON.stringify(r) !== JSON.stringify(ADJ || {}); ADJ = r; putAdj();
        if (changed && onAbs() && !document.querySelector('.overlay')) render();   // الاستمارة تُعاد بمسودتها
      }
    } catch (e) { /* قبل تنفيذ leave_adj.sql: القاعدة العامة وحدها */ }
    adjBusy = false;
  }
  document.addEventListener('DOMContentLoaded', () => {
    const base = render;
    render = function () { try { if (session?.role === 'supervisor') { putAdj(); if (onAbs()) freshAdj(); } } catch (e) { /* ignore */ } return base.apply(this, arguments); };
  });
  let editing = false;
  const isAdm = () => typeof session !== 'undefined' && session?.role === 'admin';
  const PR = () => db.payroll || {};
  const adjOf = y => { const s = PR().settings || {}; return (s.lvAdj && s.lvAdj[y]) || {}; };
  function rowsOf(year) {
    const p = PR(), s = p.settings || {}, emps = p.employees || [], abs = (p.absences || []).filter(a => a.y === year), A = adjOf(year);
    const ids = new Set([...emps.filter(e => e.status !== 'متوقف').map(e => e.id), ...abs.map(a => a.eid)]);
    return [...ids].map(id => {
      const e = emps.find(x => x.id === id) || {}, mine = abs.filter(a => a.eid === id), d = A[id] || {};
      const b0 = e.sys === '(6) أيام' ? s.lv6 : e.sys === '(3) أيام' ? s.lv3 : null, cnt = mine.filter(a => a.proof === 'رصيد').length;
      const b = d.b != null ? +d.b : b0, used = cnt + (+d.u || 0);
      return { id, e, b0, cnt, b, used, rest: b == null ? null : b - used, bAdj: d.b != null, uAdj: !!+d.u, proven: mine.filter(a => a.proof === 'مثبت').length, n: mine.length };
    }).filter(x => x.e.name).sort((a, b) => b.n - a.n);
  }
  const PEN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/></svg>';
  function balCard(year) {
    const R = rowsOf(year); if (!R.length) return '';
    const ed = editing && isAdm(), mark = (v, on) => on ? `<span class="lvadj" title="معدّل يدويًا">${v}</span>` : v;
    const tools = !isAdm() ? '' : ed
      ? '<button type="button" class="btn primary" data-lvsave>حفظ التعديل</button><button type="button" class="btn" data-lvcancel>إلغاء</button>'
      : `<button type="button" class="btn icon-only" data-lvedit title="تعديل الرصيد" aria-label="تعديل الرصيد">${PEN}</button>`;
    return `<div class="card" data-lvcard="${year}"><div class="bar"><h2 class="grow" style="margin:0">رصيد الإجازات — ${year}</h2>${tools}</div>
      ${ed ? '<p class="muted" style="font-size:.85rem;margin:.2rem 0 .5rem">عدّل «الرصيد» أو «المخصوم» لمن يلزم. ما يبقى على القيمة المحسوبة لا يُحفظ له تعديل، والمخصوم يزيد بعد ذلك مع كل غياب يُثبت «رصيد».</p>' : ''}
      <div class="tbl"><table><tr><th>الاسم</th><th>نظام العمل</th><th>الرصيد</th><th>المخصوم</th><th>المتبقي</th><th>مثبت</th><th>إجمالي الغياب</th></tr>
      ${R.map(x => `<tr><td class="nm">${esc(x.e.name)}</td><td>${esc(x.e.sys || '—')}</td>
        <td>${ed ? `<input type="number" min="0" step="1" class="lvin" data-lvb="${esc(x.id)}" value="${x.b ?? ''}" placeholder="${x.b0 ?? '—'}" aria-label="رصيد ${esc(x.e.name)}">` : mark(x.b ?? '—', x.bAdj)}</td>
        <td>${ed ? `<input type="number" min="0" step="1" class="lvin" data-lvu="${esc(x.id)}" value="${x.used}" aria-label="مخصوم ${esc(x.e.name)}">` : mark(x.used, x.uAdj)}</td>
        <td class="net">${x.rest ?? '—'}</td><td>${x.proven}</td><td>${x.n}</td></tr>`).join('')}</table></div></div>`;
  }

  function arrange(h) {
    if (typeof h !== 'string' || !h.includes('abs-grid')) return h;
    const t = document.createElement('template'); t.innerHTML = h;
    const C = t.content, grid = C.querySelector('.abs-grid'); if (!grid) return h;
    /* السنة: من عنوان الرصيد، وإلا من قائمة السنة في السجل */
    const old = [...C.children].find(c => /^\s*رصيد الإجازات/.test(c.querySelector?.(':scope > h2')?.textContent || ''));
    const yr = +((old?.querySelector('h2')?.textContent.match(/(\d{4})/) || [])[1] || C.querySelector('select[data-pay="abY"] option[selected]')?.textContent || new Date().getFullYear());
    old?.remove();
    const rec = [...grid.children].find(c => c.querySelector?.('select[data-pay="abY"]')); if (!rec) return t.innerHTML;
    const col = document.createElement('div'); col.className = 'abs-col';
    rec.replaceWith(col); col.appendChild(rec);
    const h3 = [...rec.querySelectorAll('h3.sc-h')].find(x => x.textContent.trim() === 'ملخص الشهر');
    if (h3) {
      const tbl = h3.nextElementSibling?.classList.contains('tbl') ? h3.nextElementSibling : null;
      const card = document.createElement('div'); card.className = 'card';
      card.innerHTML = '<h2>ملخص الشهر</h2>'; if (tbl) card.appendChild(tbl);
      h3.remove(); col.appendChild(card);
    }
    col.insertAdjacentHTML('beforeend', balCard(yr));
    return t.innerHTML;
  }
  if (window.Payroll?.absView) { const base = window.Payroll.absView; window.Payroll.absView = function () { return arrange(base.apply(this, arguments)); }; }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-lvedit]') && isAdm()) { editing = true; render(); return; }
    if (e.target.closest('[data-lvcancel]')) { editing = false; render(); return; }
    const sv = e.target.closest('[data-lvsave]'); if (!sv || !isAdm()) return;
    const card = sv.closest('[data-lvcard]'), year = +card.dataset.lvcard, R = rowsOf(year);
    const s = (db.payroll.settings = db.payroll.settings || {}), all = (s.lvAdj = s.lvAdj || {}), A = {};
    const B = {}, U = {};
    card.querySelectorAll('[data-lvb]').forEach(i => { B[i.dataset.lvb] = i; });
    card.querySelectorAll('[data-lvu]').forEach(i => { U[i.dataset.lvu] = i; });
    for (const x of R) {
      const bi = B[x.id], ui2 = U[x.id];
      const bv = bi && bi.value !== '' ? +bi.value : null, uv = ui2 && ui2.value !== '' ? +ui2.value : x.cnt;
      if ((bv != null && (bv < 0 || !Number.isFinite(bv))) || uv < 0 || !Number.isFinite(uv)) { toast(`قيمة غير صحيحة عند «${x.e.name}»`); return; }
      const d = {};
      if (bv != null && bv !== x.b0) d.b = bv;
      if (uv !== x.cnt) d.u = uv - x.cnt;
      if (Object.keys(d).length) A[x.id] = d;
    }
    if (Object.keys(A).length) all[year] = A; else delete all[year];
    editing = false; save(); render(); toast('حُفظ رصيد الإجازات');
  });
})();

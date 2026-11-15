'use strict';
/* ============ «الأماكن والحلقات» بتنظيم جديد ============
   - شريط «يحتاج إجراء»: حلقات بلا مشرف، وفارغة، وبلا وقت، وبلا مكان، وأماكن بلا حلقات؛ كل رقم يعرض ما يخصه وحده.
   - ثلاث طرق عرض: حسب المكان (قائمة مختصرة، يُفتح مكان واحد في كل مرة)، وحسب المشرف، وكل الحلقات (جدول واحد).
   - التعديل الجماعي في «كل الحلقات»: تحديد عدة حلقات ثم تعيين مشرف لها، أو نسخ وقت حلقة إليها.
   - أدوات (تنظيف الحلقات، تقسيم بملف، توزيع بالنص) في زر واحد «أدوات».
   - للمدير فقط؛ قسم المحاسب المبني على هذه الصفحة يبقى كما كان.
   يُحمَّل بعد ملفات الأدوات (links، cleanup، distribute، split) وقبل nav.js و app-actions.js. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./places.js')) VFILES.push('./places.js'); } catch (e) { /* ignore */ } });
  const st = { v: 'place', f: '', open: '', q: '', sel: new Set(), sup: '', src: '' };
  const base = adminViews.halaqat;
  const stuN = h => db.students.filter(s => s.halaqaId === h.id).length;
  const hasTime = h => !!timeText(h);
  const short = h => { const t = byId(db.teachers, h.teacherId); return t ? 'حلقة ' + t.name : halaqaLabel(h); };
  const FILTERS = {
    nosup: ['بلا مشرف', h => !h.supervisorId, 'tag-no'],
    empty: ['فارغة', h => !stuN(h), 'tag-no'],
    notime: ['بلا وقت', h => !hasTime(h), ''],
    noplace: ['بلا مكان', h => !placeOf(h), 'tag-no']
  };
  const match = h => (!st.f || FILTERS[st.f][1](h)) && (!st.q || norm(short(h) + ' ' + placeName(h) + ' ' + supName(h.supervisorId)).includes(norm(st.q)));
  const flags = h => Object.entries(FILTERS).filter(([k, [, fn]]) => k !== 'noplace' && fn(h)).map(([, [l, , c]]) => ` <span class="tag ${c}">${l}</span>`).join('');
  const acts = h => `<button class="btn sm" data-act="editHalaqa" data-id="${h.id}">تعديل</button><button class="btn sm danger" data-act="delHalaqa" data-id="${h.id}">حذف</button>`;
  const nameCell = h => `<button type="button" class="lnk" data-hstu="${h.id}" title="عرض طلاب الحلقة"><b>${esc(short(h))}</b></button>${flags(h)}`;
  const table = (list, cols, check) => `<div class="tbl"><table><tr>${check ? `<th><input type="checkbox" data-plall aria-label="تحديد الكل" ${list.length && list.every(h => st.sel.has(h.id)) ? 'checked' : ''}></th>` : ''}${cols.map(c => `<th>${c[0]}</th>`).join('')}<th></th></tr>
    ${list.map(h => `<tr>${check ? `<td><input type="checkbox" data-plsel="${h.id}" ${st.sel.has(h.id) ? 'checked' : ''} aria-label="تحديد"></td>` : ''}${cols.map(c => `<td>${c[1](h)}</td>`).join('')}<td>${acts(h)}</td></tr>`).join('')}</table></div>`;
  const C = {
    name: ['الحلقة', nameCell],
    place: ['المكان', h => esc(placeName(h) || '—')],
    sup: ['المشرف', h => h.supervisorId ? esc(supName(h.supervisorId)) : '<span class="muted">—</span>'],
    time: ['الوقت', h => esc(timeText(h) || '—')],
    n: ['الطلاب', h => stuN(h)]
  };

  function header() {
    const hs = db.halaqat, nSt = db.students.filter(s => s.halaqaId && byId(hs, s.halaqaId)).length;
    const emptyPlaces = db.places.filter(p => !hs.some(h => h.placeId === p.id)).length;
    const chips = Object.entries(FILTERS).map(([k, [l, fn]]) => [k, l, hs.filter(fn).length]).filter(([k, , n]) => n || st.f === k)
      .map(([k, l, n]) => `<button type="button" class="btn sm ${st.f === k ? 'on' : ''}" data-plf="${k}">${l} <span class="count">${n}</span></button>`).join('');
    return `<div class="card"><div class="bar" style="margin:0"><h2 class="grow" style="margin:0">الأماكن والحلقات</h2><span class="muted">${db.places.length} مكان · ${hs.length} حلقة · ${nSt} طالب</span>
        <details class="pltools"><summary class="btn">أدوات</summary><div class="pltmenu"><button class="btn" data-cuopen>تنظيف الحلقات</button><button class="btn" data-spopen>تقسيم بملف</button><button class="btn" data-dsopen>توزيع بالنص</button></div></details>
        <button class="btn" data-act="addPlace">+ مكان</button><button class="btn primary" data-act="addHalaqa">+ حلقة</button></div>
      ${chips || emptyPlaces ? `<div class="bar" style="margin:.7rem 0 0"><span class="muted" style="font-size:.85rem">يحتاج إجراء:</span>${chips}${emptyPlaces ? `<span class="tag">${emptyPlaces} مكان بلا حلقات</span>` : ''}${st.f ? '<button type="button" class="btn sm" data-plf="">عرض الكل</button>' : ''}</div>` : '<p class="muted" style="margin:.6rem 0 0;font-size:.88rem">كل الحلقات لها مشرف ووقت وطلاب ✓</p>'}
      <div class="bar" style="margin:.7rem 0 0"><div class="plseg">${[['place', 'حسب المكان'], ['sup', 'حسب المشرف'], ['all', 'كل الحلقات']].map(([k, l]) => `<button type="button" class="btn ${st.v === k ? 'on' : ''}" data-plv="${k}">${l}</button>`).join('')}</div>
        <input type="search" data-plq value="${esc(st.q)}" placeholder="ابحث بالمعلم أو المكان أو المشرف" style="flex:1 1 14rem;max-width:24rem" aria-label="بحث في الحلقات"></div></div>`;
  }
  function byPlace() {
    const filtering = !!(st.f || st.q);
    const groups = [...db.places.map(p => [p, db.halaqat.filter(h => h.placeId === p.id)]), [null, db.halaqat.filter(h => !placeOf(h))]];
    const out = groups.map(([p, all]) => {
      if (!p && !all.length) return '';
      const list = all.filter(match);
      if (filtering && !list.length) return '';
      const key = p ? p.id : '_none', isOpen = filtering || st.open === key;
      const sups = [...new Set(all.map(h => h.supervisorId).filter(Boolean))].map(supName);
      const bad = all.filter(h => !h.supervisorId || !stuN(h)).length;
      return `<div class="card plcard"><div class="plhead" data-plopen="${key}" role="button" tabindex="0" aria-expanded="${isOpen}">
          <span class="pico">${p ? (p.type === 'دار تحفيظ' ? TAB_ICONS.house : TAB_ICONS.mosque) : TAB_ICONS.halaqat}</span>
          <div style="flex:1;min-width:0"><b>${esc(p ? p.name : 'حلقات لم يُحدَّد مكانها')}</b> ${p ? `<span class="tag">${esc(p.type)}</span>` : ''}${bad ? ` <span class="tag tag-no">${bad} تحتاج إجراء</span>` : ''}
            <div class="muted" style="font-size:.85rem">${all.length} حلقة · ${all.reduce((a, h) => a + stuN(h), 0)} طالب · ${esc(sups.join('، ') || 'بلا مشرف')}</div></div>
          <span class="plchev" aria-hidden="true">${isOpen ? '▴' : '▾'}</span></div>
        ${isOpen ? `${p ? `<div class="bar" style="margin:.6rem 0">${p.address ? `<span class="muted grow">${esc(p.address)}</span>` : '<span class="grow"></span>'}<button class="btn sm primary" data-act="addHalaqa" data-p="${p.id}">+ حلقة هنا</button><button class="btn sm" data-act="editPlace" data-id="${p.id}">تعديل المكان</button><button class="btn sm danger" data-act="delPlace" data-id="${p.id}">حذف المكان</button></div>` : ''}
          ${list.length ? table(list, [C.name, C.sup, C.time, C.n]) : empty('لا توجد حلقات في هذا المكان بعد.')}` : ''}</div>`;
    }).join('');
    return out || `<div class="card">${empty('لا توجد حلقات تطابق البحث.')}</div>`;
  }
  function bySup() {
    const g = new Map();
    db.halaqat.filter(match).forEach(h => { const k = h.supervisorId && byId(db.supervisors, h.supervisorId) ? h.supervisorId : ''; if (!g.has(k)) g.set(k, []); g.get(k).push(h); });
    const keys = [...g.keys()].sort((a, b) => (a === '') - (b === '') || g.get(b).length - g.get(a).length);
    return keys.map(k => { const l = g.get(k), sup = byId(db.supervisors, k);
      return `<div class="card plcard"><div class="bar" style="margin:0 0 .6rem"><div class="grow"><b>${esc(sup ? sup.name : 'بلا مشرف')}</b>${sup && sup.info?.scope === 'all' ? ' <span class="tag tag-ok">مشرف عام</span>' : ''}${!sup ? ' <span class="tag tag-no">عيّن لها مشرفًا</span>' : ''}
        <div class="muted" style="font-size:.85rem">${l.length} حلقة · ${new Set(l.map(h => h.placeId)).size} مكان · ${l.reduce((a, h) => a + stuN(h), 0)} طالب</div></div></div>
        ${table(l, [C.name, C.place, C.time, C.n])}</div>`; }).join('') || `<div class="card">${empty('لا توجد حلقات تطابق البحث.')}</div>`;
  }
  function all() {
    const list = db.halaqat.filter(match).sort((a, b) => (placeName(a) || '').localeCompare(placeName(b) || '', 'ar') || short(a).localeCompare(short(b), 'ar'));
    [...st.sel].forEach(id => { if (!byId(db.halaqat, id)) st.sel.delete(id); });
    const n = st.sel.size;
    const sups = (db.supervisors || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const timed = db.halaqat.filter(h => h.time && hasTime(h)).sort((a, b) => short(a).localeCompare(short(b), 'ar'));
    const bulk = n ? `<div class="card plbulk"><div class="bar" style="margin:0"><b>${n} حلقة محددة</b><button type="button" class="btn sm" data-plclear>إلغاء التحديد</button></div>
        <div class="bar" style="margin:.5rem 0 0;flex-wrap:nowrap"><span class="muted" style="min-width:5.5rem">المشرف</span><div style="flex:1;min-width:0"><select data-plsup aria-label="المشرف"><option value="">— اختر —</option>${sups.map(s => `<option value="${s.id}" ${st.sup === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}<option value="__none" ${st.sup === '__none' ? 'selected' : ''}>بلا مشرف</option></select></div><button type="button" class="btn sm primary" data-plsetsup>تعيين</button></div>
        <div class="bar" style="margin:.5rem 0 0;flex-wrap:nowrap"><span class="muted" style="min-width:5.5rem">الوقت مثل</span><div style="flex:1;min-width:0"><select data-plsrc aria-label="نسخ الوقت من حلقة"><option value="">— اختر حلقة —</option>${timed.map(h => `<option value="${h.id}" ${st.src === h.id ? 'selected' : ''}>${esc(short(h) + ' — ' + timeText(h))}</option>`).join('')}</select></div><button type="button" class="btn sm primary" data-plsettime>تعيين</button></div></div>` : '';
    return bulk + `<div class="card">${list.length ? `<p class="muted" style="margin:0 0 .6rem;font-size:.85rem">${list.length} حلقة. حدّد عدة حلقات لتعيين مشرفها أو وقتها مرة واحدة.</p>` + table(list, [C.name, C.place, C.sup, C.time, C.n], true) : empty('لا توجد حلقات تطابق البحث.')}</div>`;
  }
  /* بطاقة مراجعة ربط الحلقات بمعلميها (من links.js) تبقى كما هي إن وُجدت حلقات بلا معلم */
  function linksCard() {
    if (!window.QLLinks?.orphans?.().length) return '';
    const h = base(), i = h.indexOf('</p></div>'), j = h.indexOf('<div class="card place">', i);
    return i > -1 && j > i ? h.slice(i + 10, j) : '';
  }
  adminViews.halaqat = () => {
    if (session?.role !== 'admin') return base();
    return header() + linksCard() + (st.v === 'sup' ? bySup() : st.v === 'all' ? all() : byPlace());
  };

  const css = document.createElement('style');
  css.textContent = `.plseg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}.plseg .btn{border:0;border-radius:0;margin:0}.plseg .btn+.btn{border-inline-start:1px solid var(--line)}
    .pltools{position:relative}.pltools>summary{list-style:none;cursor:pointer}.pltools>summary::-webkit-details-marker{display:none}.pltools>summary::after{content:' ▾'}
    .pltmenu{position:absolute;z-index:20;inset-inline-start:0;top:110%;display:flex;flex-direction:column;gap:.35rem;background:var(--card,#fff);border:1px solid var(--line);border-radius:12px;padding:.5rem;min-width:11rem;box-shadow:0 8px 24px rgba(10,18,35,.15)}
    .plcard{padding:.7rem .9rem;margin-bottom:.55rem}.plhead{display:flex;align-items:center;gap:.7rem;cursor:pointer}.plhead .pico svg{width:22px;height:22px}.plchev{color:var(--muted,#667);font-size:1.1rem}
    .plbulk{position:sticky;top:.5rem;z-index:6;border:2px solid var(--navy)}`;
  document.head.appendChild(css);

  const reFocus = () => { const i = document.querySelector('[data-plq]'); if (i) { i.focus(); const n = i.value.length; i.setSelectionRange(n, n); } };
  let qT = 0;
  document.addEventListener('input', e => { if ('plq' in (e.target.dataset || {})) { st.q = e.target.value; clearTimeout(qT); qT = setTimeout(() => { render(); reFocus(); }, 250); } });
  document.addEventListener('change', e => {
    const d = e.target.dataset || {};
    if ('plsel' in d) { e.target.checked ? st.sel.add(d.plsel) : st.sel.delete(d.plsel); render(); }
    else if ('plall' in d) { const ids = db.halaqat.filter(match).map(h => h.id); ids.forEach(id => e.target.checked ? st.sel.add(id) : st.sel.delete(id)); render(); }
    else if ('plsup' in d) st.sup = e.target.value;
    else if ('plsrc' in d) st.src = e.target.value;
  });
  document.addEventListener('click', e => {
    const t = e.target;
    const v = t.closest('[data-plv]'); if (v) { st.v = v.dataset.plv; render(); return; }
    const f = t.closest('[data-plf]'); if (f) { st.f = st.f === f.dataset.plf ? '' : f.dataset.plf; render(); return; }
    const o = t.closest('[data-plopen]'); if (o) { st.open = st.open === o.dataset.plopen ? '' : o.dataset.plopen; render(); return; }
    if (t.closest('.pltmenu button')) t.closest('details').open = false;
    if (t.closest('[data-plclear]')) { st.sel.clear(); render(); return; }
    if (t.closest('[data-plsetsup]')) {
      if (!st.sup) { toast('اختر المشرف أولًا'); return; }
      const ids = [...st.sel], sid = st.sup === '__none' ? '' : st.sup;
      ids.forEach(id => { const h = byId(db.halaqat, id); if (h) h.supervisorId = sid; });
      save(); render(); toast(sid ? `عُيّن ${supName(sid)} مشرفًا لـ ${ids.length} حلقة` : `أُزيل المشرف من ${ids.length} حلقة`); return;
    }
    if (t.closest('[data-plsettime]')) {
      const src = byId(db.halaqat, st.src); if (!src || !hasTime(src)) { toast('اختر الحلقة التي يُنسخ وقتها أولًا'); return; }
      const ids = [...st.sel].filter(id => id !== src.id);
      ids.forEach(id => { const h = byId(db.halaqat, id); if (!h) return; if (src.time) h.time = JSON.parse(JSON.stringify(src.time)); else { delete h.time; h.schedule = src.schedule; } });
      save(); render(); toast(`نُسخ وقت «${short(src)}» إلى ${ids.length} حلقة`);
    }
  });
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-plopen]')) { e.preventDefault(); e.target.click(); } });
  /* أي نقرة خارج قائمة الأدوات تغلقها */
  document.addEventListener('click', e => { document.querySelectorAll('details.pltools[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; }); });
})();

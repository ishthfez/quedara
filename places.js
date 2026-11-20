'use strict';
/* ============ «الأماكن والحلقات» بتنظيم جديد ============
   - شريط «يحتاج إجراء»: حلقات بلا مشرف، وفارغة، وبلا وقت، وبلا مكان، وأماكن بلا حلقات؛ كل رقم يعرض ما يخصه وحده.
   - ثلاث طرق عرض: حسب المكان (قائمة مختصرة، يُفتح مكان واحد في كل مرة)، وحسب المشرف، وكل الحلقات (جدول واحد).
   - التعديل الجماعي في «كل الحلقات»: تحديد عدة حلقات ثم تعيين مشرف لها، أو نسخ وقت حلقة إليها.
   - اسم القسم «الحلقات». وأدواته (تنظيف الحلقات، تقسيم بملف، توزيع بالنص) للمدير وحده في «الإعدادات ← أدوات الحلقات».
   - للمدير فقط؛ قسم المحاسب المبني على هذه الصفحة يبقى كما كان.
   - «اشتراك المكان» بجانب «تعديل المكان»: مبالغ المكان لكل الفئات وقيم الخصومات (النافذة في fees.js، والعلامة «خاص» إن كان له شيء منها).
   - تنظيم الصفحة: البطاقة العلوية صفّان (الأعداد و«يحتاج إجراء» والقائمتان «أدوات» و«+ إضافة»، ثم العرض والبحث و«فتح/طي الكل»). رأس المكان أعداد وعلامات
     (الحلقات والطلاب والمشرفون، «اشتراك خاص»، «تحتاج إجراء») وأسماء المشرفين عند الوقوف عليه. أعمال المكان في صف وحده:
     «+ حلقة هنا» والترس (تعديل المكان واشتراكه وحذفه) في صف أدوات الجدول نفسه، والجدول بعرض البطاقة. يُفتح أكثر من مكان معًا، و«فتح الكل / طي الكل».
     وعلى الهاتف كل حلقة بطاقة صغيرة (المعلم، ثم المشرف وعدد الطلاب، ثم الوقت، وبجانبها تعديل وحذف) بدل الجدول العريض.
   - للمحاسب أيضًا (ولمن مُنح صلاحية «الأماكن والحلقات» halaqat.manage): الصفحة كاملة بكل إعداداتها؛ ومن لا يملكها من المحاسبين
     يراها للاطلاع كما كانت (accountant.js). الخادم يتحقق من الصلاحية (supabase/halaqat_perm.sql).
   يُحمَّل بعد ملفات الأدوات (links، cleanup، distribute، split) وقبل nav.js و app-actions.js. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./places.js')) VFILES.push('./places.js'); } catch (e) { /* ignore */ } });
  const st = { v: 'place', f: '', open: new Set(), q: '', sel: new Set(), sup: '', src: '' };
  /* صلاحية «الأماكن والحلقات»: للمحاسبين افتراضيًا، ويسحبها المدير أو يمنحها من «الصلاحيات» */
  try { Perms.define({ key: 'halaqat.manage', label: 'الحلقات', desc: 'إضافة الأماكن والحلقات وتعديلها (وحذفها بطلب يوافق عليه المدير)', group: 'الحلقات والطلاب', defaults: ['accountant'], roles: ['accountant'] }); } catch (e) { /* ignore */ }
  /* roles: الواجهة (canManage أدناه) لا تعمل بها إلا للمحاسب؛ فلا تُعرض خانتها لغيره في جدول الصلاحيات */
  const canManage = () => session?.role === 'admin' || (session?.role === 'accountant' && !!window.Perms?.can('halaqat.manage'));
  /* اسم القسم «الحلقات» (للمدير وللمحاسب)، قبل أن ترتّب nav.js وstuview.js القوائم */
  try { (TABS.admin || []).forEach(t => { if (t[0] === 'halaqat') t[1] = 'الحلقات'; }); } catch (e) { /* ignore */ }
  try { if (TABS.accountant && !TABS.accountant.some(t => t[0] === 'halaqat')) TABS.accountant.push(['halaqat', 'الحلقات']); } catch (e) { /* ignore */ }
  document.addEventListener('DOMContentLoaded', () => {
    const ro = VIEWS.accountant?.halaqat;
    if (VIEWS.accountant) VIEWS.accountant.halaqat = function () { return canManage() ? adminViews.halaqat() : (ro ? ro.apply(this, arguments) : adminViews.halaqat()); };
  });
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
  /* على الهاتف: كل حلقة بطاقة (والجدول للحاسوب، وللطباعة والتنزيل من أدواته) */
  /* سطر البطاقة: كبسولة «إشراف» قبل اسم المشرف، وعدد الطلاب في كبسولة، والموعد بعد أيقونة ساعة */
  const CLOCK = '<svg class="plclk" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  const cardBit = (c, h) => c === C.n ? `<span class="tag plpill">${stuN(h)} طالب</span>` : c === C.sup ? `<span class="tag plpill">إشراف</span> ${c[1](h)}` : c[1](h);
  const cards = (list, cols, check) => `<div class="plhl">${list.map(h => `<div class="plhi">${check ? `<input type="checkbox" data-plsel="${h.id}" ${st.sel.has(h.id) ? 'checked' : ''} aria-label="تحديد">` : ''}
      <div class="plhi-b"><div>${nameCell(h)}</div><div class="muted plhi-m">${cols.filter(c => c !== C.name && c !== C.time && c !== C.n).map(c => cardBit(c, h)).join(' · ')}${cols.includes(C.n) ? ' ' + cardBit(C.n, h) : ''}</div>${cols.includes(C.time) ? `<div class="muted plhi-m">${CLOCK}${C.time[1](h)}</div>` : ''}</div>
      <div class="plhi-a">${acts(h)}</div></div>`).join('')}</div>`;
  const table = (list, cols, check) => `<div class="tbl"><table><tr>${check ? `<th><input type="checkbox" data-plall aria-label="تحديد الكل" ${list.length && list.every(h => st.sel.has(h.id)) ? 'checked' : ''}></th>` : ''}${cols.map(c => `<th>${c[0]}</th>`).join('')}<th></th></tr>
    ${list.map(h => `<tr>${check ? `<td><input type="checkbox" data-plsel="${h.id}" ${st.sel.has(h.id) ? 'checked' : ''} aria-label="تحديد"></td>` : ''}${cols.map(c => `<td>${c[1](h)}</td>`).join('')}<td>${acts(h)}</td></tr>`).join('')}</table></div>` + cards(list, cols, check);   // البطاقات بعد الجدول: فصف الأعمال والأدوات فوقها على الهاتف
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
    /* صفّان فقط: (الأعداد ثم «يحتاج إجراء» في سطرها، والأدوات والإضافة) ثم (طريقة العرض والبحث و«فتح/طي الكل») */
    const need = chips || emptyPlaces ? `<span class="plneed"><span class="muted">يحتاج إجراء:</span>${chips}${emptyPlaces ? `<span class="tag">${emptyPlaces} مكان بلا حلقات</span>` : ''}${st.f ? '<button type="button" class="btn sm" data-plf="">عرض الكل</button>' : ''}</span>` : '<span class="plneed muted">كل الحلقات لها مشرف ووقت وطلاب ✓</span>';
    return `<div class="card plhdr"><div class="plrow"><span class="plsum"><span class="muted">${db.places.length} مكان · ${hs.length} حلقة · ${nSt} طالب</span>${need}</span>
        <details class="pltools pladd"><summary class="btn primary">+ إضافة</summary><div class="pltmenu"><button class="btn" data-act="addHalaqa">حلقة</button><button class="btn" data-act="addPlace">مكان</button></div></details></div>
      <div class="plrow plctl"><div class="plseg">${[['place', 'حسب المكان'], ['sup', 'حسب المشرف'], ['all', 'كل الحلقات']].map(([k, l]) => `<button type="button" class="btn ${st.v === k ? 'on' : ''}" data-plv="${k}">${l}</button>`).join('')}</div>
        <input type="search" data-plq value="${esc(st.q)}" placeholder="ابحث بالمعلم أو المكان أو المشرف" aria-label="بحث في الحلقات">
        ${st.v === 'place' && !st.f && !st.q ? `<button type="button" class="btn sm" data-plall2>${st.open.size ? 'طي الكل' : 'فتح الكل'}</button>` : ''}</div></div>`;
  }
  function byPlace() {
    const filtering = !!(st.f || st.q);
    const groups = [...db.places.map(p => [p, db.halaqat.filter(h => h.placeId === p.id)]), [null, db.halaqat.filter(h => !placeOf(h))]];
    const out = groups.map(([p, all]) => {
      if (!p && !all.length) return '';
      const list = all.filter(match);
      if (filtering && !list.length) return '';
      const key = p ? p.id : '_none', isOpen = filtering || st.open.has(key);
      const sups = [...new Set(all.map(h => h.supervisorId).filter(Boolean))].map(supName);
      const bad = all.filter(h => !h.supervisorId || !stuN(h)).length;
      const own = p && window.QLFeePlace?.can() && window.QLFeePlace.has(p.id);
      /* أعمال المكان («+ حلقة هنا» والترس وفيها تعديله واشتراكه وحذفه) في صف واحد مع أدوات الجدول (.bar تضمّه أدوات الجدول إليها) */
      const more = p ? `<details class="pltools plmore"><summary class="btn sm" aria-label="أعمال المكان" title="أعمال المكان"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></summary><div class="pltmenu">
          <button class="btn" data-act="editPlace" data-id="${p.id}">تعديل المكان</button>
          ${window.QLFeePlace?.can() ? `<button class="btn" data-fee-place="${p.id}">اشتراك المكان${own ? ' <span class="tag tag-ok">خاص</span>' : ''}</button>` : ''}
          <button class="btn danger" data-act="delPlace" data-id="${p.id}">حذف المكان</button></div></details>` : '';
      return `<div class="card plcard"><div class="plhead" data-plopen="${key}" role="button" tabindex="0" aria-expanded="${isOpen}">
          <span class="pico">${p ? (p.type === 'دار تحفيظ' ? TAB_ICONS.house : TAB_ICONS.mosque) : TAB_ICONS.halaqat}</span>
          <div style="flex:1;min-width:0"><b>${esc(p ? p.name : 'حلقات لم يُحدَّد مكانها')}</b> ${p ? `<span class="tag">${esc(p.type)}</span>` : ''}${own ? ' <span class="tag tag-ok">اشتراك خاص</span>' : ''}${bad ? ` <span class="tag tag-no">${bad} تحتاج إجراء</span>` : ''}
            <div class="muted" style="font-size:.85rem" title="${esc(sups.join('، ') || 'بلا مشرف')}">${all.length} حلقة · ${all.reduce((a, h) => a + stuN(h), 0)} طالب · ${sups.length ? `${sups.length} مشرف` : 'بلا مشرف'}</div></div>
          <span class="plchev" aria-hidden="true">${isOpen ? '▴' : '▾'}</span></div>
        ${isOpen ? `${p ? `<div class="bar placts"><button class="btn sm primary" data-act="addHalaqa" data-p="${p.id}">+ حلقة هنا</button>${more}${p.address ? `<span class="muted grow pladdr">${esc(p.address)}</span>` : '<span class="grow"></span>'}</div>` : ''}
          ${list.length ? table(list, [C.name, C.sup, C.time, C.n]) : empty('لا توجد حلقات في هذا المكان بعد.')}` : ''}</div>`;
    }).join('');
    return out || `<div class="card">${empty('لا توجد حلقات تطابق البحث.')}</div>`;
  }
  function bySup() {
    const g = new Map();
    db.halaqat.filter(match).forEach(h => { const k = h.supervisorId && byId(db.supervisors, h.supervisorId) ? h.supervisorId : ''; if (!g.has(k)) g.set(k, []); g.get(k).push(h); });
    const keys = [...g.keys()].sort((a, b) => (a === '') - (b === '') || g.get(b).length - g.get(a).length);
    return keys.map(k => { const l = g.get(k), sup = byId(db.supervisors, k);
      return `<div class="card plcard"><div class="bar" style="margin:0 0 .6rem"><div class="grow"><b>${esc(sup ? sup.name : 'بلا مشرف')}</b>${sup && sup.info?.scope === 'all' ? ' <span class="tag tag-ok">مدير عام</span>' : ''}${!sup ? ' <span class="tag tag-no">عيّن لها مشرفًا</span>' : ''}
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
    if (!canManage()) return base().replace('>الأماكن والحلقات</h2>', '>الحلقات</h2>');
    return header() + linksCard() + (st.v === 'sup' ? bySup() : st.v === 'all' ? all() : byPlace());
  };

  /* ===== «أدوات الحلقات»: تبويب في «الإعدادات» للمدير (بعد «مكرر للمراجعة») ===== */
  let toolsOn = false;
  const TOOLS = [
    ['data-cuopen', 'تنظيف الحلقات', 'يدمج الحلقات المكررة، وينقل طلاب الحلقات قليلة العدد، ويحذف الحلقات الفارغة والأماكن بلا حلقات. معاينة قبل التنفيذ، ولا يُحذف طالب أبدًا.'],
    ['data-spopen', 'تقسيم بملف', 'ملف (Excel أو CSV) أعمدته: المعلم، المكان، الطالب؛ فيُوزَّع طلاب كل معلم على حلقاته بحسب أماكنهم. معاينة قبل التنفيذ.'],
    ['data-dsopen', 'توزيع بالنص', 'نص ملصوق: المكان، ثم أسماء معلميه، ثم مشرفهم؛ فتُنشأ الحلقات وتُربط بمعلميها ومشرفها. معاينة قبل التنفيذ.']
  ];
  const toolsView = () => `<div class="card"><h2 style="margin-top:0">أدوات الحلقات</h2>
    ${TOOLS.map(([a, l, d]) => `<div class="qtl"><div class="qtl-b"><b>${l}</b><div class="muted">${d}</div></div><button type="button" class="btn" ${a}>فتح</button></div>`).join('')}</div>`;
  document.addEventListener('DOMContentLoaded', () => {
    const baseSet = adminViews.settings;
    if (typeof baseSet !== 'function') return;
    adminViews.settings = function () {
      const h = baseSet.apply(this, arguments);
      if (session?.role !== 'admin' || typeof h !== 'string') return h;
      const btn = `<button type="button" class="btn ${toolsOn ? 'on' : ''}" data-qtools>أدوات الحلقات</button>`;
      let out = h.replace(/(<button type="button" class="btn[^"]*" data-subtab="perms")/, btn + '$1');
      if (!out.includes('data-qtools')) out = out.replace(/(<div class="card subnav"><div class="bar" style="margin:0">[\s\S]*?)(<\/div><\/div>)/, `$1${btn}$2`);
      if (!toolsOn) return out;
      const i = out.indexOf('<div class="card subnav">'), e = i < 0 ? -1 : out.indexOf('</div></div>', i);
      if (e < 0) return out;
      return out.slice(0, e + 12).replace(/class="btn on" data-subtab/g, 'class="btn " data-subtab') + toolsView();
    };
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-qtools]')) { toolsOn = true; render(); window.scrollTo(0, 0); }
    else if (e.target.closest('[data-subtab]')) toolsOn = false;
  }, true);

  const css = document.createElement('style');
  css.textContent = `.plseg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}.plseg .btn{border:0;border-radius:0;margin:0}.plseg .btn+.btn{border-inline-start:1px solid var(--line)}
    .pltools{position:relative}.pltools>summary{list-style:none;cursor:pointer}.pltools>summary::-webkit-details-marker{display:none}.pltools>summary::after{content:' ▾'}
    .pltmenu{position:absolute;z-index:20;inset-inline-start:0;top:110%;display:flex;flex-direction:column;gap:.35rem;background:var(--card,#fff);border:1px solid var(--line);border-radius:12px;padding:.5rem;min-width:11rem;box-shadow:0 8px 24px rgba(10,18,35,.15)}
    .plcard{padding:.7rem .9rem;margin-bottom:.55rem}.plhead{display:flex;align-items:center;gap:.7rem;cursor:pointer}.plhead .pico svg{width:22px;height:22px}.plchev{color:var(--muted,#667);font-size:1.1rem}
    .plbulk{position:sticky;top:.5rem;z-index:6;border:2px solid var(--navy)}
    .pladd .pltmenu,.plmore .pltmenu{inset-inline-start:auto;inset-inline-end:0}.pladd>summary::after,.plmore>summary::after{content:''}
    .plmore>summary{min-width:2.4rem;display:inline-flex;align-items:center;justify-content:center}.plmore .pltmenu .tag{margin-inline-start:.3rem}
    .placts{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin:.5rem 0 .4rem}
    .plcard .tblprint.qtb{margin:.5rem 0 .4rem}.plcard .tbl:not(#qz0),.plcard .tbl:not(#qz0) > table{width:100%!important}.plcard .tbl:not(#qz0) td:not(:last-child){white-space:normal}
    .plhdr{padding-block:.8rem}.plrow{display:flex;align-items:center;gap:.5rem .6rem;flex-wrap:wrap}.plrow + .plrow{margin-top:.6rem}
    .plsum{flex:1 1 auto;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .9rem}
    .plneed{display:inline-flex;flex-wrap:wrap;align-items:center;gap:.35rem;font-size:.9rem}
    .plctl{flex-wrap:nowrap}.plctl .plseg{flex:none}.plctl input[data-plq]{flex:1 1 auto;min-width:8rem;max-width:26rem;width:auto;margin:0}.plctl [data-plall2]{flex:none;margin-inline-start:auto}
    .plhl{display:none}
    .qtl{display:flex;align-items:center;gap:.8rem;padding:.7rem 0;border-top:1px solid var(--line,#eee6d6)}.qtl:first-of-type{border-top:0}.qtl-b{flex:1;min-width:0;line-height:1.7}.qtl-b .muted{font-size:.88rem}
    @media (max-width:640px){
      main .card:has(.plhl) .tbl,main .card:has(.plhl) .tblprint .tzoom,main .card:has(.plhl) .tblprint .qzoom{display:none!important}
      .plhl{display:block}.plhi{display:flex;align-items:center;gap:.6rem;padding:.65rem .1rem;border-top:1px solid var(--line,#eee6d6)}
      .plhl .plhi:first-child{border-top:0}.plhi-b{flex:1;min-width:0}.plhi-b .lnk{text-align:start}
      .plhi-m{font-size:.84rem;margin-top:.15rem;line-height:1.5}.plhi-m .plpill{font-size:.75rem;padding:.05rem .45rem;margin:0}.plhi-m .plclk{vertical-align:-2px;margin-inline-end:.3rem}
      .plsum{flex-basis:100%}.plctl{flex-wrap:wrap}.plctl .plseg{flex:1 1 100%}.plctl .plseg .btn{flex:1 1 0;justify-content:center;text-align:center;padding-inline:.3rem;white-space:nowrap;font-size:.9rem;min-width:0}.plctl input[data-plq]{max-width:none;flex-basis:100%;order:3}.plctl [data-plall2]{order:4}.pladdr{display:none}
      .plhi-a{display:flex;flex-direction:column;gap:.3rem}.plhi-a .btn{padding:.25rem .55rem!important;min-height:0!important;font-size:.82rem}
      .plhi>input[type=checkbox]{flex:none;width:1.15rem;height:1.15rem}
      /* «+ إضافة» في أول الصف على الهاتف: قائمته تُفتح نحو داخل الشاشة لا خارجها */
      .pladd .pltmenu{inset-inline-start:0;inset-inline-end:auto;max-width:calc(100vw - 2rem)}
    }`;
  document.head.appendChild(css);

  /* يعود المؤشر إلى موضعه قبل إعادة الرسم (لا إلى آخر النص)، فيمكن التصحيح في وسط الكلمة */
  const reFocus = (a, b) => { const i = document.querySelector('[data-plq]'); if (i) { i.focus(); const n = i.value.length; try { i.setSelectionRange(Math.min(a ?? n, n), Math.min(b ?? a ?? n, n)); } catch (err) { /* ignore */ } } };
  let qT = 0;
  document.addEventListener('input', e => { if ('plq' in (e.target.dataset || {})) { st.q = e.target.value; clearTimeout(qT); qT = setTimeout(() => { const o = document.querySelector('[data-plq]'), a = o?.selectionStart, b = o?.selectionEnd; render(); reFocus(a, b); }, 250); } });
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
    const o = t.closest('[data-plopen]'); if (o) { const k = o.dataset.plopen; st.open.has(k) ? st.open.delete(k) : st.open.add(k); render(); return; }
    if (t.closest('[data-plall2]')) { if (st.open.size) st.open.clear(); else { db.places.forEach(p => st.open.add(p.id)); st.open.add('_none'); } render(); return; }
    if (t.closest('.plmore .pltmenu button')) t.closest('details').open = false;
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
  /* قوائم «+ إضافة» والترس لا تخرج عن حد الشاشة: تُزاح عند فتحها لتبقى داخلها */
  document.addEventListener('toggle', e => {
    const d = e.target; if (!d.matches?.('details.pltools') || !d.open) return;
    const m = d.querySelector('.pltmenu'); if (!m) return;
    m.style.transform = '';
    const r = m.getBoundingClientRect(), pad = 8, W = document.documentElement.clientWidth;
    const dx = r.right > W - pad ? W - pad - r.right : r.left < pad ? pad - r.left : 0;
    if (dx) m.style.transform = `translateX(${dx}px)`;
  }, true);
  /* أي نقرة خارج قائمة الأدوات تغلقها */
  document.addEventListener('click', e => { document.querySelectorAll('details.pltools[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; }); });
})();
